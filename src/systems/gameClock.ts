/** Duração (ms) de um dia inteiro (24h em jogo) — pedido explícito: 12 minutos reais por dia. */
export const DAY_LENGTH_MS = 12 * 60_000;

/** Hora em que cada novo dia começa (06:00 — o jogador "acorda" com o sol já nascendo, não à meia-noite). */
const START_HOUR = 6;
/** Os minutos exibidos na UI avançam de 5 em 5 (relógio "read-out", não um cronômetro exato) — pedido explícito, ver `getMinutesOfDay`. */
const DISPLAY_MINUTE_STEP = 5;

/** Início/fim de cada trecho do dia, em horas (0-24). A transição entre dia e noite é suave dentro da janela informada, não abrupta. */
const DAWN_START_HOUR = 5;
const DAWN_END_HOUR = 7;
const DUSK_START_HOUR = 17;
const DUSK_END_HOUR = 19;
/** Opacidade máxima do véu noturno (ver `systems/dayNightOverlay.ts`) — nunca total, pra não esconder o jogo. */
const MAX_NIGHT_ALPHA = 0.55;

/**
 * Relógio interno do jogo (Fase 7): dia atual + hora do dia (0-24),
 * avançando com o tempo real a um ritmo fixo (`DAY_LENGTH_MS`). Deliberadamente
 * **não** é o mesmo relógio que já existe em `systems/farmland.ts`
 * (`Farmland.clockMs`, usado só pra crescimento/hidratação) — são conceitos
 * diferentes (hora do dia vs. temporizador de crescimento), e ligar um ao
 * outro mudaria como a agricultura já funciona hoje. Este relógio só produz
 * a hora do dia e o contador de dias; não tem efeito nenhum sobre plantio,
 * crescimento ou qualquer outra mecânica existente.
 */
/** Formato salvo pelo `SaveManager` (Fase 10 — Persistência). */
export interface GameClockSaveData {
  day: number;
  dayProgressMs: number;
}

export class GameClock {
  private dayProgressMs = (START_HOUR / 24) * DAY_LENGTH_MS;
  private day = 1;

  /** Avança o relógio; devolve `true` só no frame em que um novo dia começa (pra quem quiser reagir a isso). */
  update(deltaMs: number): boolean {
    this.dayProgressMs += deltaMs;

    if (this.dayProgressMs < DAY_LENGTH_MS) return false;

    this.dayProgressMs %= DAY_LENGTH_MS;
    this.day += 1;
    return true;
  }

  getDay(): number {
    return this.day;
  }

  /**
   * Pula direto para as 06:00 do dia seguinte — usado pela mecânica de
   * dormir (Fase 9, ver `systems/sleepInteraction.ts`): dormir sempre leva
   * pro início do próximo dia, não soma um número fixo de horas (diferente
   * de `update`, que avança gradualmente com o tempo real).
   *
   * O contador de dias JÁ vira à meia-noite (`update`), então dormir entre
   * 00:00 e 05:59 só leva o relógio pras 06:00 do MESMO dia — somar 1 de novo
   * pularia um dia inteiro (e rodaria a virada da lavoura duas vezes, matando
   * plantação não regada). Devolve `true` se o dia realmente virou (dormiu
   * antes da meia-noite), `false` se a virada já tinha acontecido — quem
   * chama só roda a virada de dia (lavoura, clima, mundo) no `true`.
   */
  advanceToNextMorning(): boolean {
    const midnightAlreadyPassed = this.getHours() < START_HOUR;
    this.dayProgressMs = (START_HOUR / 24) * DAY_LENGTH_MS;
    if (midnightAlreadyPassed) return false;
    this.day += 1;
    return true;
  }

  /** Hora do dia, 0 (meia-noite) a 24 (exclusivo) — contínua, usada pelo véu noturno (`getNightAlpha`) para uma transição suave. */
  getHours(): number {
    return (this.dayProgressMs / DAY_LENGTH_MS) * 24;
  }

  /**
   * Minuto do dia (0-1439) já arredondado para baixo em passos de
   * `DISPLAY_MINUTE_STEP` (5) — é o que a UI mostra (`getTimeString`), não
   * o progresso contínuo usado internamente (`getHours`/`getNightAlpha`).
   */
  getMinutesOfDay(): number {
    const rawMinutes = this.getHours() * 60;
    return Math.floor(rawMinutes / DISPLAY_MINUTE_STEP) * DISPLAY_MINUTE_STEP;
  }

  /** Hora exibida (0-23), já alinhada ao passo de 5 minutos de `getMinutesOfDay`. */
  getHour(): number {
    return Math.floor(this.getMinutesOfDay() / 60) % 24;
  }

  /** Minuto exibido (0-55, múltiplo de 5) dentro da hora atual. */
  getMinute(): number {
    return this.getMinutesOfDay() % 60;
  }

  /** Hora formatada "HH:MM" (minutos em passos de 5) — pronta pra UI. */
  getTimeString(): string {
    const hh = String(this.getHour()).padStart(2, '0');
    const mm = String(this.getMinute()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  /** É dia (sem nenhum véu de noite: do fim do amanhecer ao começo do entardecer)? Usado por efeitos que só existem de dia (borboletas). */
  isDaytime(): boolean {
    return this.getNightAlpha() === 0;
  }

  /**
   * Opacidade (0-1) do véu noturno para a hora atual — 0 em pleno dia,
   * `MAX_NIGHT_ALPHA` em plena noite, com transição suave no amanhecer/
   * anoitecer (ver constantes de janela no topo do arquivo).
   */
  getNightAlpha(): number {
    const hours = this.getHours();

    if (hours >= DAWN_END_HOUR && hours < DUSK_START_HOUR) return 0;
    if (hours >= DUSK_END_HOUR || hours < DAWN_START_HOUR) return MAX_NIGHT_ALPHA;

    if (hours >= DAWN_START_HOUR && hours < DAWN_END_HOUR) {
      const t = (hours - DAWN_START_HOUR) / (DAWN_END_HOUR - DAWN_START_HOUR);
      return MAX_NIGHT_ALPHA * (1 - t);
    }

    // dusk: DUSK_START_HOUR..DUSK_END_HOUR
    const t = (hours - DUSK_START_HOUR) / (DUSK_END_HOUR - DUSK_START_HOUR);
    return MAX_NIGHT_ALPHA * t;
  }

  serialize(): GameClockSaveData {
    return { day: this.day, dayProgressMs: this.dayProgressMs };
  }

  static deserialize(data: GameClockSaveData): GameClock {
    const clock = new GameClock();
    clock.day = data.day;
    clock.dayProgressMs = data.dayProgressMs;
    return clock;
  }
}
