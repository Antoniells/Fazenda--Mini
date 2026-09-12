/**
 * Duração (ms) de um dia inteiro (24h em jogo). Bem mais curta que o ritmo
 * "realista" de outros jogos do gênero de propósito — as culturas daqui
 * crescem em 12-20s (ver `data/crops.ts`), então um dia no estilo Stardew
 * Valley (~13min reais) deixaria o relógio desconectado do resto do jogo.
 * 90s dá uns 5-7 ciclos de plantio por dia, o suficiente para o dia ter
 * peso sem travar o ritmo arcade já estabelecido.
 */
export const DAY_LENGTH_MS = 90_000;

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
export class GameClock {
  private dayProgressMs = 0;
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

  /** Hora do dia, 0 (meia-noite) a 24 (exclusivo). */
  getHours(): number {
    return (this.dayProgressMs / DAY_LENGTH_MS) * 24;
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
}
