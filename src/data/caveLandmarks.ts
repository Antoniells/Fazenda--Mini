import type { OreKind } from './ores';

/**
 * Os MARCOS da história dentro das Cavernas (Fase 11, "Os Três Pilares" — `data/story.ts`) e os minérios dos andares. Só DADOS: quem
 * põe no andar é `scenes/CaveFloorScene.ts` (com `systems/caveOres.ts` e `systems/caveLandmarks.ts`).
 *
 * - A partir do andar 45 as pedras começam a dar AZURITA (minério raro e cintilante, pros encantamentos).
 * - No andar 50 uma BARREIRA MÁGICA bloqueia a escada de descida: só uma picareta encantada a quebra. Não tem arte: é um aviso ao
 *   tentar descer. No mesmo andar, um BAÚ ESQUECIDO guarda o mapa da área oculta da Floresta.
 * - Do 51 ao 100 as profundezas são mais hostis; no 100, a HORDA FINAL em ondas.
 */
export const AZURITE_MIN_FLOOR = 45;
export const BARRIER_FLOOR = 50;
/** O fundo: a Horda Final e, vencida, o santuário do Sábio Coelho. */
export const FINAL_FLOOR = 100;

/** Do andar 51 em diante (depois da barreira) os bichos são mais fortes e mais numerosos (`data/caveFloors.ts`). */
export const ABYSS_BONUS = { hpMult: 1.15, dmgMult: 1.1, extraEnemies: 2 };

/**
 * A HORDA FINAL do andar 100: a 1ª onda é o grupo do próprio andar (com o Guardião); cada onda seguinte nasce quando a anterior cai.
 * Vencida a última, o andar vira o santuário (marco `sanctuary`).
 */
export const FINAL_HORDE_WAVES: Array<{ count: number; guardian: boolean }> = [
  { count: 12, guardian: false },
  { count: 14, guardian: true },
];
/** Pausa (ms) entre uma onda e a próxima (o aviso na tela). */
export const FINAL_HORDE_WAVE_DELAY_MS = 2500;

// --- Minérios nos andares ------------------------------------------------------------------------------------------------------

/**
 * Quais veios aparecem em cada profundidade e com que peso (a mesma regra das raridades da pesca): o carvão em toda parte; o cobre some
 * aos poucos lá embaixo; o ferro a partir do 10, o ouro do 25 e a azurita do 45 (rara no começo, mais comum no fundo).
 */
export const CAVE_ORE_ROSTER: Array<{ kind: OreKind; minFloor: number; maxFloor?: number; weight: number; weightPerFloor?: number }> = [
  { kind: 'coal', minFloor: 1, weight: 6 },
  { kind: 'copper', minFloor: 1, maxFloor: 40, weight: 8 },
  { kind: 'iron', minFloor: 10, weight: 5, weightPerFloor: 0.05 },
  { kind: 'gold', minFloor: 25, weight: 2, weightPerFloor: 0.05 },
  { kind: 'azurite', minFloor: AZURITE_MIN_FLOOR, weight: 1.5, weightPerFloor: 0.08 },
];

/** Quantos veios num andar: 3 no andar 1, até 10 lá embaixo. */
export function caveOreCount(floor: number): number {
  return Math.min(10, 3 + Math.floor(floor / 12));
}

/** A partir do andar da azurita, garante ao menos UM veio dela em cada andar (é o que a história pede pra encontrar). */
export const AZURITE_GUARANTEED = true;

// --- Arte do baú e do mapa ------------------------------------------------------------------------------------------------------

/** `Objects/Exterior/chest.png` (256x32): o baú de madeira simples (o 8º), fechado em cima e aberto embaixo — recortes pelo alfa. */
export const FORGOTTEN_CHEST = {
  key: 'forgotten-chest',
  path: 'Objects/Exterior/chest.png',
  closed: { name: 'forgotten-chest-closed', rect: { x: 232, y: 3, width: 15, height: 13 } },
  open: { name: 'forgotten-chest-open', rect: { x: 232, y: 18, width: 15, height: 14 } },
};

/** Ícone do Mapa Misterioso: `Icons/RPG icons/Extras/Books.png` (240x64, grade 16x16), o pergaminho com o X vermelho e a trilha tracejada (linha 3, coluna 4). */
export const STORY_ITEMS_KEY = 'rpg-books';
export const STORY_ITEMS_PATH = 'Icons/RPG icons/Extras/Books.png';
export const MAP_ICON_FRAME = { name: 'item-mysterious-map', rect: { x: 64, y: 48, width: 16, height: 16 } };
