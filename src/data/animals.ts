import { qualityId } from './quality';

/**
 * Animais da fazenda (Fase 7 — Animais e Produção Animal), começando pelas GALINHAS. Só DADOS: a lógica de compra/ovos está em
 * `systems/animals.ts`, o desenho/movimento em `entities/Chicken.ts` e `systems/chickenFlock.ts`.
 *
 * Regras: a galinha só existe DENTRO de um galinheiro (uma construção comprada na Loja e posicionada na Fazenda, `CHICKEN_COOP` em
 * `data/decorations.ts`); cada galinheiro abriga `COOP_CAPACITY`. Cada galinha põe `EGGS_PER_CHICKEN_PER_DAY` ovo por dia, que fica no galinheiro
 * até o jogador clicar nele (`COOP_MAX_EGGS` no máximo guardados). A qualidade do ovo vem do carinho acumulado e do cuidado do dia (carinho + Capim no
 * comedouro — `eggTierForCare`).
 */

/** Id do galinheiro (`DECORATIONS`) — o mesmo usado no registro de construções posicionadas. */
export const CHICKEN_COOP_ID = 'chicken-coop';
/** Id do item "Galinha" na Loja (aba Animais). */
export const CHICKEN_SHOP_ID = 'chicken';

export const COOP_CAPACITY = 4;
export const CHICKEN_PRICE = 90;
export const EGGS_PER_CHICKEN_PER_DAY = 1;
export const COOP_MAX_EGGS = 12;

/** Cada galinha do galinheiro (vai pro save): a cor sorteada UMA vez (nunca muda), o carinho recebido e o último dia em que ganhou. */
export interface ChickenRecord {
  /** Índice em `CHICKEN_VARIANTS`. */
  variant: number;
  /** Carinhos recebidos (0 a `MAX_AFFECTION`): define a qualidade dos ovos que ela põe. */
  affection: number;
  /** Dia (`GameClock.getDay`) do último carinho — só um por dia. */
  pettedDay: number;
}

/** O que vai pro save, por galinheiro (chave = célula-âncora `"col,row"`). `birds` e `eggTiers` são normalizados por `getCoopState` (saves antigos não os têm). */
export interface CoopState {
  chickens: number;
  eggs: number;
  birds?: ChickenRecord[];
  /** Ovos guardados por qualidade (`EGG_TIERS`): a soma é `eggs`. */
  eggTiers?: number[];
  /** Capim no comedouro (até `FEEDER_CAPACITY`); cada galinha come 1 na virada do dia. Saves antigos não têm: comedouro vazio. */
  feed?: number;
}

export interface AnimalsState {
  coops: Record<string, CoopState>;
}

export function createAnimalsState(): AnimalsState {
  return { coops: {} };
}

/**
 * `Animals/Farm/Chicken/Chicken <cor>.png` (64x112): grade de 4 colunas x 7 linhas de 16x16 (frame = linha*4 + coluna). Linha 0 = andando
 * (de lado, virada pra esquerda — pra direita espelha) e linha 6 = bicando (o 1º quadro é em pé, os outros 3 bicam); a linha 3 (sentada) não é usada — à noite ela some no galinheiro.
 * Cada galinha sorteia uma das cores abaixo.
 */
const CHICKEN_DIR = 'Animals/Farm/Chicken';
export const CHICKEN_VARIANTS = [
  { key: 'chicken-white', path: `${CHICKEN_DIR}/Chicken White.png` },
  { key: 'chicken-brown-white', path: `${CHICKEN_DIR}/Chicken Brown White.png` },
  { key: 'chicken-blonde', path: `${CHICKEN_DIR}/Chicken Blonde.png` },
  { key: 'chicken-black-white', path: `${CHICKEN_DIR}/Chicken Black White.png` },
];
export const CHICKEN_FRAME_SIZE = 16;
export const CHICKEN_WALK_FRAMES = [0, 1, 2, 3];
export const CHICKEN_IDLE_FRAME = 0;
export const CHICKEN_PECK_FRAMES = [24, 25, 26, 27, 26, 25];
export const CHICKEN_WALK_FRAME_RATE = 6;
export const CHICKEN_PECK_FRAME_RATE = 5;

/** Comportamento: anda até `ROAM_RADIUS_CELLS` da porta do galinheiro, de célula em célula, e dorme (some no galinheiro) à noite. */
export const CHICKEN_ROAM_RADIUS_CELLS = 5;
export const CHICKEN_STEP_MS = 520;
export const CHICKEN_IDLE_MS = { min: 1500, max: 4500 };
export const CHICKEN_PECK_MS = { min: 1800, max: 3200 };
export const CHICKEN_BEDTIME_HOUR = 19;
export const CHICKEN_WAKE_HOUR = 6;

/** Ícone do ovo (`Icons/Food Icons/Chicken Egg.png`, 32x16 = 2 quadros de 16x16; o 1º, de contorno escuro) — carregado como spritesheet. */
export const EGG_ICON = { key: 'icon-egg', path: 'Icons/Food Icons/Chicken Egg.png', frameSize: 16 };

/** Ícone da Galinha na Loja e na aba "Animais": recorte da folha `Icons/Farm Animals/Animals farm icons.png` (128x112, grade de 16x16) — a galinha branca. */
export const ANIMAL_ICONS = {
  key: 'ui-animal-icons',
  path: 'Icons/Farm Animals/Animals farm icons.png',
  chicken: { name: 'animal-icon-chicken', rect: { x: 64, y: 64, width: 16, height: 16 } },
};

/** Carinho máximo de uma galinha (um por dia) — pedido explícito. */
export const MAX_AFFECTION = 10;

/**
 * Qualidade dos ovos pelo carinho da galinha: quanto mais carinho, mais estrelas (Prata, Ouro, Irídio — `data/quality.ts`) e mais o ovo vale. Cada nível é o
 * MESMO ovo (`egg`) com a qualidade no id do estoque.
 */
export const EGG_TIERS = [
  { resourceId: qualityId('egg', 'normal'), minAffection: 0 },
  { resourceId: qualityId('egg', 'silver'), minAffection: 3 },
  { resourceId: qualityId('egg', 'gold'), minAffection: 6 },
  { resourceId: qualityId('egg', 'iridium'), minAffection: 9 },
];

export function eggTierForAffection(affection: number): number {
  let tier = 0;
  EGG_TIERS.forEach((candidate, index) => {
    if (affection >= candidate.minAffection) tier = index;
  });
  return tier;
}

/**
 * FELICIDADE DO DIA: o carinho acumulado diz a melhor qualidade que a galinha alcança, mas o ovo só sai nela se ela foi CUIDADA no dia
 * que passou — cada descuido (sem carinho, sem Capim no comedouro) derruba um degrau (nunca abaixo do comum). Ela põe o ovo mesmo
 * assim: o descuido pesa na qualidade, não na produção.
 */
export function eggTierForCare(affection: number, fed: boolean, petted: boolean): number {
  return Math.max(0, eggTierForAffection(affection) - (fed ? 0 : 1) - (petted ? 0 : 1));
}

/** A ração das galinhas é o Capim (`WILD_GRASS` em `data/resources.ts`, colhido com a Foice): 1 por galinha, na virada do dia. */
export const CHICKEN_FEED_ID = 'grass';
/** Quanto Capim cabe no comedouro de cada galinheiro (clicar no galinheiro enche com o Capim da Bolsa). */
export const FEEDER_CAPACITY = 24;

