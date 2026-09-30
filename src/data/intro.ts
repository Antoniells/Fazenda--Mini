/**
 * A CENA INTRODUTÓRIA (`scenes/IntroScene.ts`): 4 slides narrados que abrem uma partida nova, entre a Criação de Personagem e o Dia 1
 * na Fazenda. Só DADOS: o texto de cada slide (escrito letra a letra), a narração (gerada pelo ElevenLabs com
 * `tools/generate_intro_voices.py` — mudou um texto aqui, mude lá e regere o áudio) e o fundo (montado com a arte do jogo).
 *
 * Os áudios ficam em `assets/audio/cutscene/` (a pasta pública do Vite é `assets/`, então o caminho carregado começa em `audio/`). Sem o
 * arquivo (ainda não gerado), a cena funciona do mesmo jeito, só sem voz.
 */

/** Qual fundo o slide monta (`IntroScene.buildBackground`). */
export type IntroBackground = 'ancient' | 'caves' | 'sanctuary' | 'farmDawn';

export interface IntroSlide {
  text: string;
  audio: { key: string; path: string };
  background: IntroBackground;
}

const audio = (slide: number): IntroSlide['audio'] => ({ key: `intro-slide-${slide}`, path: `audio/cutscene/intro_slide_${slide}.mp3` });

export const INTRO_SLIDES: IntroSlide[] = [
  {
    text: 'Há muitos anos, a profecia do Grande Sábio Coelho mantinha a natureza em perfeita harmonia...',
    audio: audio(1),
    background: 'ancient',
  },
  {
    text: 'Mas com o desaparecimento da lendária Cenoura Dourada, o equilíbrio se rompeu. A escuridão tomou as cavernas e a terra começou a enfraquecer.',
    audio: audio(2),
    background: 'caves',
  },
  {
    text: 'A antiga lenda diz que a paz só retornará quando os Três Pilares do Equilíbrio forem reunidos no Altar Sagrado: a Cenoura Dourada, o Peixe Dourado... e um terceiro pilar oculto.',
    audio: audio(3),
    background: 'sanctuary',
  },
  {
    text: 'Você foi o escolhido para essa jornada. Sua missão começa de forma humilde na superfície: cuide da sua terra, fortaleça seu novo companheiro e prepare-se para o que habita nas profundezas...',
    audio: audio(4),
    background: 'farmDawn',
  },
];

/** Ritmo da cena (ms). */
export const INTRO_TIMING = {
  /** Uma letra por vez: sem narração, este intervalo; com ela, o texto se espalha pela duração do áudio (entre o mínimo e o máximo). */
  charMs: 38,
  minCharMs: 18,
  maxCharMs: 70,
  /** O texto termina um pouco antes da voz (fração da duração do áudio). */
  audioSpread: 0.88,
  /** Depois do texto completo e da voz terminada, espera isto e passa sozinho pro próximo slide. */
  holdMs: 1600,
  /** Fade entre os slides e no fim (antes da Fazenda). */
  slideFadeMs: 500,
  endFadeMs: 1100,
};
