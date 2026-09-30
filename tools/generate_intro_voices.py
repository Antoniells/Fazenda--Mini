"""
Gera a narração da CENA INTRODUTÓRIA do Mini Fazenda com a API do ElevenLabs.

Saída: assets/audio/cutscene/intro_slide_1.mp3 ... intro_slide_4.mp3 (o jogo toca cada um no slide correspondente —
src/scenes/IntroScene.ts, textos em src/data/intro.ts). Se mudar um texto aqui, mude lá também (e vice-versa).

INSTALAÇÃO
    1. Python 3.9 ou mais novo: https://www.python.org/downloads/ (no instalador, marque "Add python.exe to PATH").
    2. Dependência:
           pip install elevenlabs

CHAVE DA API (ELEVENLABS_API_KEY)
    1. Entre em https://elevenlabs.io > seu perfil > "API Keys" > "Create API Key" e copie a chave (começa com "sk_").
    2. Defina a variável de ambiente ANTES de rodar o script (nunca escreva a chave no código nem a mande pro git):
           PowerShell (só nesta janela):   $env:ELEVENLABS_API_KEY = "sk_..."
           PowerShell (permanente):        setx ELEVENLABS_API_KEY "sk_..."   (abra um terminal novo depois)
           Git Bash / Linux / macOS:       export ELEVENLABS_API_KEY="sk_..."

USO (na pasta do projeto)
    python tools/generate_intro_voices.py                 # gera os 4 áudios que ainda não existem
    python tools/generate_intro_voices.py --forcar        # regera todos (sobrescreve)
    python tools/generate_intro_voices.py --slide 2       # só o slide 2
    python tools/generate_intro_voices.py --voz <ID>      # outra voz (veja --listar-vozes)
    python tools/generate_intro_voices.py --listar-vozes  # mostra as vozes que a sua conta pode usar

VOZ ("narrador de fantasia, grave e misteriosa")
    Padrão: "Brian" (nPczCjzI2devNBz1zQrb) — grave e ressonante —, uma das vozes padrão do ElevenLabs, que qualquer plano pode usar
    pela API. Com o modelo multilíngue (eleven_multilingual_v2) ela narra em português.
    Com plano pago, dá pra usar vozes brasileiras da biblioteca (Voice Library), que soam mais naturais em português. Sugestões:
      - "Nassif - Documentary, History & Thriller" (acdKA5HckGxoxxvy40dA): grave, de documentário — a mais próxima do pedido;
      - "Alexandre - Narration" (auTAgxuKRGwTsbs8ZkuN): grave e calma, pra histórias;
      - "Moutella - Brazilian Mentor" (X3j2R63Qu4Gdv6dsU2hB): madura e encorpada.
    Adicione a voz em "My Voices" no site e rode com --voz <ID>.
    O plano gratuito tem 10.000 caracteres por mês; os 4 textos somam cerca de 600.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

try:
    from elevenlabs import VoiceSettings
    from elevenlabs.client import ElevenLabs
except ImportError:
    sys.exit("Falta a biblioteca do ElevenLabs. Instale com:  pip install elevenlabs")

# Os textos EXATOS dos 4 slides (os mesmos de src/data/intro.ts).
INTRO_SLIDES = [
    "Há muitos anos, a profecia do Grande Sábio Coelho mantinha a natureza em perfeita harmonia...",
    "Mas com o desaparecimento da lendária Cenoura Dourada, o equilíbrio se rompeu. "
    "A escuridão tomou as cavernas e a terra começou a enfraquecer.",
    "A antiga lenda diz que a paz só retornará quando os Três Pilares do Equilíbrio forem reunidos no Altar Sagrado: "
    "a Cenoura Dourada, o Peixe Dourado... e um terceiro pilar oculto.",
    "Você foi o escolhido para essa jornada. Sua missão começa de forma humilde na superfície: cuide da sua terra, "
    "fortaleça seu novo companheiro e prepare-se para o que habita nas profundezas...",
]

DEFAULT_VOICE_ID = "nPczCjzI2devNBz1zQrb"  # Brian — grave e ressonante (voz padrão, qualquer plano).
MODEL_ID = "eleven_multilingual_v2"  # Fala português.
OUTPUT_FORMAT = "mp3_44100_128"

# Narrador de fantasia: estável o bastante pra soar solene, com um pouco de expressividade (style) pro mistério.
VOICE_SETTINGS = VoiceSettings(stability=0.55, similarity_boost=0.8, style=0.35, use_speaker_boost=True, speed=0.92)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = PROJECT_ROOT / "assets" / "audio" / "cutscene"


def output_path(slide: int) -> Path:
    return OUTPUT_DIR / f"intro_slide_{slide}.mp3"


def list_voices(client: ElevenLabs) -> None:
    for voice in client.voices.get_all().voices:
        labels = voice.labels or {}
        print(f"{voice.voice_id}  {voice.name}  ({labels.get('gender', '?')}, {labels.get('accent', '?')}, {labels.get('language', '?')})")


def generate(client: ElevenLabs, slide: int, text: str, voice_id: str) -> None:
    audio = client.text_to_speech.convert(
        voice_id=voice_id,
        text=text,
        model_id=MODEL_ID,
        output_format=OUTPUT_FORMAT,
        voice_settings=VOICE_SETTINGS,
    )
    target = output_path(slide)
    with open(target, "wb") as file:
        for chunk in audio:
            if chunk:
                file.write(chunk)
    print(f"  ok  {target.relative_to(PROJECT_ROOT)}  ({target.stat().st_size // 1024} KB)")


def main() -> None:
    parser = argparse.ArgumentParser(description="Gera a narração da intro do Mini Fazenda (ElevenLabs).")
    parser.add_argument("--voz", default=DEFAULT_VOICE_ID, help="ID da voz (padrão: Brian).")
    parser.add_argument("--slide", type=int, choices=range(1, len(INTRO_SLIDES) + 1), help="Gera só este slide.")
    parser.add_argument("--forcar", action="store_true", help="Sobrescreve os áudios que já existem.")
    parser.add_argument("--listar-vozes", action="store_true", help="Lista as vozes da conta e sai.")
    args = parser.parse_args()

    api_key = os.environ.get("ELEVENLABS_API_KEY")
    if not api_key:
        sys.exit("Defina a variável de ambiente ELEVENLABS_API_KEY (veja as instruções no topo do arquivo).")
    client = ElevenLabs(api_key=api_key)

    if args.listar_vozes:
        list_voices(client)
        return

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    slides = [args.slide] if args.slide else list(range(1, len(INTRO_SLIDES) + 1))
    print(f"Voz {args.voz}, modelo {MODEL_ID} -> {OUTPUT_DIR.relative_to(PROJECT_ROOT)}")
    for slide in slides:
        if output_path(slide).exists() and not args.forcar:
            print(f"  --  intro_slide_{slide}.mp3 já existe (use --forcar pra regerar)")
            continue
        try:
            generate(client, slide, INTRO_SLIDES[slide - 1], args.voz)
        except Exception as error:  # noqa: BLE001 — mostra o erro da API (chave inválida, cota, voz não permitida...) e segue.
            print(f"  ERRO no slide {slide}: {error}")


if __name__ == "__main__":
    main()
