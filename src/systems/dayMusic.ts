import Phaser from 'phaser';
import { gameState } from './gameState';
import { getMusicVolume } from './audioSettings';
import {
  DAYTIME_TRACKS,
  MORNING_TRACK,
  MusicTrackDef,
  MUSIC_DAY_END_HOUR,
  MUSIC_DAY_START_HOUR,
  MUSIC_FADE_IN_MS,
  MUSIC_FADE_OUT_MS,
  MUSIC_MORNING_UNTIL_HOUR,
  MUSIC_VOLUME,
} from '../data/audio';

/**
 * Música de fundo do dia: entra com FADE IN quando o dia começa (06:00 — novo
 * jogo ou ao acordar) e sai com FADE OUT quando ele termina (anoitecer às
 * 19:00, ou ao dormir). "Inicio de manhã" abre o dia; depois as outras
 * faixas se revezam, uma após a outra.
 *
 * Toca por STREAMING (um `HTMLAudioElement` por faixa), não pelo Phaser: o
 * Phaser decodifica o arquivo inteiro na memória antes de tocar — as 3
 * faixas (6:04 + 4:54 + 2:53 min, estéreo 48 kHz) virariam ~300 MB de PCM e
 * ~10 s de decodificação. Só os efeitos curtos passam pelo Phaser (ver
 * `systems/soundEffects.ts`).
 *
 * Roda no `STEP` do jogo (não numa cena): os fades continuam certos mesmo
 * quando a cena que os pediu já foi encerrada (ex.: "Sair para o Menu" para
 * a Fazenda no mesmo instante em que pede o fade out). O estado é DERIVADO
 * do relógio do jogo a cada frame (`shouldPlay`) — assim carregar um save,
 * dormir ou pular horas com o atalho de debug caem no comportamento certo
 * sem nenhum caso especial.
 */
class DayMusic {
  private game: Phaser.Game | null = null;
  /** Só há música com uma partida aberta (`UIScene` liga; sair pro menu desliga). */
  private enabled = false;
  /** Dia em que o jogador dormiu: sem música pelo resto dele mesmo que ainda fosse de dia (dormir às 15:00 encerra o dia). Dia novo = `getDay()` muda = volta a valer. */
  private endedDay: number | null = null;
  private audio: HTMLAudioElement | null = null;
  private volume = 0;
  /** Volume de cruzeiro do último frame (`MUSIC_VOLUME` x ajuste do jogador) — pra saber se a música está "estável" e deve seguir o ajuste na hora. */
  private lastCruise = 0;
  private fadeOutMs = MUSIC_FADE_OUT_MS;
  private clockMs = 0;
  /** Se o navegador recusar o `play()` (política de autoplay), espera um pouco antes de tentar de novo em vez de tentar todo frame. */
  private retryAtMs = 0;
  private morningPlayedOnDay: number | null = null;
  private daytimeIndex = 0;

  /** Liga a música (idempotente) — chamado pela `UIScene` a cada partida aberta. Registra o relógio próprio do módulo no `STEP` do jogo na primeira vez. */
  enable(game: Phaser.Game): void {
    if (!this.game) {
      this.game = game;
      game.events.on(Phaser.Core.Events.STEP, (_time: number, delta: number) => this.tick(delta));
      // Aba/janela escondida: pausa o streaming (o Phaser já faz isso com os efeitos).
      game.events.on(Phaser.Core.Events.HIDDEN, () => this.audio?.pause());
      game.events.on(Phaser.Core.Events.VISIBLE, () => {
        this.audio?.play().catch(() => undefined);
      });
    }
    if (this.enabled) return;
    this.enabled = true;
    this.endedDay = null;
    this.morningPlayedOnDay = null;
  }

  /** Desliga com fade out (ex.: "Sair para o Menu Principal"). */
  disable(fadeOutMs = MUSIC_FADE_OUT_MS): void {
    this.enabled = false;
    this.fadeOutMs = fadeOutMs;
  }

  /** O dia acabou pra valer (o jogador foi dormir): fade out agora, sem música até o dia seguinte. */
  endDay(fadeOutMs = MUSIC_FADE_OUT_MS): void {
    this.endedDay = gameState.gameClock.getDay();
    this.fadeOutMs = fadeOutMs;
  }

  private shouldPlay(): boolean {
    if (!this.enabled) return false;
    const clock = gameState.gameClock;
    if (this.endedDay === clock.getDay()) return false;
    const hours = clock.getHours();
    return hours >= MUSIC_DAY_START_HOUR && hours < MUSIC_DAY_END_HOUR;
  }

  private tick(delta: number): void {
    this.clockMs += delta;
    const wantPlay = this.shouldPlay();

    if (!this.audio) {
      if (wantPlay && this.clockMs >= this.retryAtMs) this.startNextTrack();
      return;
    }

    // O ajuste do jogador (Configurações) escala o volume de cruzeiro. A VELOCIDADE do fade continua baseada em `MUSIC_VOLUME` fixo (não no ajustado), e uma música já estável segue o ajuste na hora — mexer no controle não pode levar 3 s pra soar.
    const cruise = MUSIC_VOLUME * getMusicVolume();
    const steady = wantPlay && this.volume >= this.lastCruise - 1e-4;
    this.lastCruise = cruise;

    if (steady) {
      this.volume = cruise;
    } else {
      const target = wantPlay ? cruise : 0;
      const step = (MUSIC_VOLUME / (wantPlay ? MUSIC_FADE_IN_MS : this.fadeOutMs)) * delta;
      this.volume = this.volume < target ? Math.min(target, this.volume + step) : Math.max(target, this.volume - step);
    }
    this.audio.volume = this.volume;

    if (!wantPlay && this.volume <= 0) this.stopCurrentTrack();
  }

  /** Primeira faixa do dia = a de manhã (se ainda for manhã); o resto do tempo revezam as outras. */
  private pickTrack(): MusicTrackDef {
    const clock = gameState.gameClock;
    const day = clock.getDay();
    if (clock.getHours() < MUSIC_MORNING_UNTIL_HOUR && this.morningPlayedOnDay !== day) {
      this.morningPlayedOnDay = day;
      return MORNING_TRACK;
    }
    const track = DAYTIME_TRACKS[this.daytimeIndex % DAYTIME_TRACKS.length];
    this.daytimeIndex += 1;
    return track;
  }

  private startNextTrack(): void {
    const track = this.pickTrack();
    const audio = new Audio(encodeURI(`/${track.path}`));
    audio.volume = 0;
    this.audio = audio;
    this.volume = 0;
    this.lastCruise = Infinity; // Faixa nova: sempre entra com fade in (ver o cálculo de `steady` em `tick`).

    // Fim natural da faixa: libera o slot; o próximo `tick` inicia a seguinte (com fade in).
    audio.addEventListener('ended', () => {
      if (this.audio !== audio) return;
      this.audio = null;
      this.volume = 0;
    });

    audio.play().catch((error) => {
      console.warn(`DayMusic: não foi possível tocar "${track.id}" (autoplay bloqueado ou arquivo ausente).`, error);
      if (this.audio === audio) this.audio = null;
      this.retryAtMs = this.clockMs + 2000;
    });
  }

  private stopCurrentTrack(): void {
    if (!this.audio) return;
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load(); // Solta a conexão de streaming.
    this.audio = null;
    this.volume = 0;
    this.fadeOutMs = MUSIC_FADE_OUT_MS;
  }
}

export const dayMusic = new DayMusic();
