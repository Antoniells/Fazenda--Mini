/**
 * Estações do ano (`ui/timeMoneyHud.ts`, o relógio de estação do HUD): o calendário gira só pelo número do dia — nada é salvo à parte, a estação SAI do dia
 * (`GameClock.getDay`). Cada estação dura `SEASON_LENGTH_DAYS` dias; o ano tem as 4 (`SEASONS`). Por enquanto a estação só aparece no relógio (nenhuma regra do jogo depende dela).
 *
 * Arte: `UI/Clock/Others/clock.png` (192x96, quadros de 32x32): 3 LINHAS de cenário — verde, outono, inverno — e 6 COLUNAS, as fases do dia (`dayPhase`). O pacote não tem
 * um cenário próprio de Verão: ele reusa o verde da Primavera (a diferença fica no nome, no dia da estação e na dica do relógio).
 */
export const SEASON_CLOCK_KEY = 'ui-season-clock';
export const SEASON_CLOCK_PATH = 'UI/Clock/Others/clock.png';
export const SEASON_CLOCK_FRAME_SIZE = 32;
const SEASON_CLOCK_COLUMNS = 6;

/** Dias que cada estação dura (ajustável aqui; o ano inteiro = 4x isto). */
export const SEASON_LENGTH_DAYS = 10;

export interface SeasonDefinition {
  id: 'spring' | 'summer' | 'autumn' | 'winter';
  name: string;
  /** Linha do cenário em `SEASON_CLOCK_KEY` (0 verde, 1 outono, 2 inverno). */
  row: number;
}

export const SEASONS: SeasonDefinition[] = [
  { id: 'spring', name: 'Primavera', row: 0 },
  { id: 'summer', name: 'Verão', row: 0 },
  { id: 'autumn', name: 'Outono', row: 1 },
  { id: 'winter', name: 'Inverno', row: 2 },
];

export interface SeasonInfo {
  season: SeasonDefinition;
  /** Dia dentro da estação (1..`SEASON_LENGTH_DAYS`). */
  dayOfSeason: number;
  /** Quantas estações completas já passaram desde o dia 1 (0 = primeiro ano, primeira estação). */
  seasonsElapsed: number;
}

/** A estação do dia `day` (contado a partir de 1, como `GameClock.getDay`): Primavera → Verão → Outono → Inverno → Primavera... */
export function seasonForDay(day: number): SeasonInfo {
  const zeroBased = Math.max(0, Math.floor(day) - 1);
  const seasonsElapsed = Math.floor(zeroBased / SEASON_LENGTH_DAYS);
  return { season: SEASONS[seasonsElapsed % SEASONS.length], dayOfSeason: (zeroBased % SEASON_LENGTH_DAYS) + 1, seasonsElapsed };
}

/**
 * A fase do dia mostrada no medalhão (coluna da folha), pela hora do relógio (0-24): 0 manhã (sol nascendo), 1 meio-dia, 2 tarde (sol descendo), 3 anoitecer (estrelas),
 * 4 noite (lua), 5 madrugada.
 */
export function dayPhase(hours: number): number {
  const h = ((hours % 24) + 24) % 24;
  if (h >= 6 && h < 10) return 0;
  if (h >= 10 && h < 14) return 1;
  if (h >= 14 && h < 18) return 2;
  if (h >= 18 && h < 21) return 3;
  if (h >= 21 || h < 3) return 4;
  return 5;
}

/** O quadro do medalhão pra uma estação e uma hora. */
export function seasonClockFrame(day: number, hours: number): number {
  return seasonForDay(day).season.row * SEASON_CLOCK_COLUMNS + dayPhase(hours);
}
