/**
 * Estações do ano (`ui/timeMoneyHud.ts`, o relógio de estação do HUD): o calendário gira só pelo número do dia — nada é salvo à parte, a estação SAI do dia
 * (`GameClock.getDay`). Cada estação dura `SEASON_LENGTH_DAYS` dias; o ano tem as 4 (`SEASONS`). Por enquanto a estação só aparece no relógio (nenhuma regra do jogo depende dela).
 *
 * Arte: `UI/Clock/Others/clock.png` (192x96, quadros de 32x32): 3 LINHAS de cenário — verde, outono, inverno — e 6 COLUNAS, as fases do dia (`dayPhase`). O pacote não tem
 * um cenário próprio de Verão: ele reusa o verde da Primavera (a diferença fica no nome, no dia da estação e na dica do relógio).
 *
 * Regras que dependem da estação: o plantio (`systems/cropSeasons.ts` — cada cultivo tem as suas; no inverno nada cresce; na virada, o que
 * ficou fora de época morre) e o chão (`systems/seasonalGround.ts` — a grama e a beirada das ilhas trocam pela folha da estação).
 */
export const SEASON_CLOCK_KEY = 'ui-season-clock';
export const SEASON_CLOCK_PATH = 'UI/Clock/Others/clock.png';
export const SEASON_CLOCK_FRAME_SIZE = 32;
const SEASON_CLOCK_COLUMNS = 6;

/** Dias que cada estação dura (ajustável aqui; o ano inteiro = 4x isto). */
export const SEASON_LENGTH_DAYS = 10;

export type SeasonId = 'spring' | 'summer' | 'autumn' | 'winter';

export interface SeasonDefinition {
  id: SeasonId;
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

/** O id da estação do dia `day`. */
export function seasonIdForDay(day: number): SeasonId {
  return seasonForDay(day).season.id;
}

/** O nome mostrado de uma estação ("Primavera"). */
export function seasonName(id: SeasonId): string {
  return SEASONS.find((season) => season.id === id)?.name ?? id;
}

/**
 * O CHÃO DE CADA ESTAÇÃO (`systems/seasonalGround.ts`): as folhas de grama e de penhasco do pacote existem nas 4 estações, com o MESMO
 * layout (só muda a cor — verde clara, verde, laranja de folhas, branca de neve), então trocar a folha muda o chão inteiro sem mexer em
 * nenhum índice de tile. O Verão é a folha de sempre do jogo.
 */
export const SEASON_GRASS_TILESETS: Record<SeasonId, { key: string; path: string }> = {
  spring: { key: 'ground-grass-spring', path: 'Tileset/Tileset Grass Spring.png' },
  summer: { key: 'ground-grass-summer', path: 'Tileset/Tileset Grass Summer.png' },
  autumn: { key: 'ground-grass-autumn', path: 'Tileset/Tileset Grass Fall.png' },
  winter: { key: 'ground-grass-winter', path: 'Tileset/Tileset Grass Winter.png' },
};
export const SEASON_CLIFF_TILESETS: Record<SeasonId, { key: string; path: string }> = {
  spring: { key: 'island-cliff-spring', path: 'Tileset/Tileset Grass Cliff Tileset Spring.png' },
  summer: { key: 'island-cliff-summer', path: 'Tileset/Tileset Grass Cliff Tileset Summer.png' },
  autumn: { key: 'island-cliff-autumn', path: 'Tileset/Tileset Grass Cliff Tileset Fall.png' },
  winter: { key: 'island-cliff-winter', path: 'Tileset/Tileset Grass Cliff Tileset Winter.png' },
};

/**
 * O MATO colhível da Fazenda (`systems/wildGrass.ts`, o Capim) não aparece no Outono (pedido do usuário: as moitas verdes destoavam do chão
 * de folhas): na virada do dia o mato que havia some e nenhum nasce (`advanceFarmResourcesDay`); e a Fazenda não o desenha nessa estação.
 */
export const WEEDLESS_SEASONS: readonly SeasonId[] = ['autumn'];

export function weedsGrowIn(season: SeasonId): boolean {
  return !WEEDLESS_SEASONS.includes(season);
}

/** O que cai do céu num dia de "chuva" (o sorteio de `systems/weather.ts`): no Inverno é NEVE (`ui/weatherOverlay.ts`, o aviso do dia). */
export function precipitationIn(season: SeasonId): 'rain' | 'snow' {
  return season === 'winter' ? 'snow' : 'rain';
}
