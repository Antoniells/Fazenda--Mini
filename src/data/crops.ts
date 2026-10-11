/**
 * `Crops/All Crops.png` (416x288, grid uniforme de 16x16): uma folha
 * consolidada com os ícones de várias culturas do pacote, uma por linha
 * (coluna 0-1 = saquinho de semente fechado/aberto, coluna 2 = item colhido
 * "puro" sem selo de qualidade, colunas 3-5 = o mesmo item com selo de
 * qualidade prata/ouro/roxo — estilo Stardew Valley, não usado aqui, ainda
 * não existe sistema de qualidade —, coluna 6 = outra variação do item puro,
 * coluna 7 = placa) — confirmado recortando/ampliando pixel a pixel linha a
 * linha. Usada só para os ÍCONES (Hotbar/Loja/Inventário, ver
 * `resolveSlotVisual` em `data/items.ts`); o spritesheet próprio de cada
 * cultura (`CropDefinition.textureKey`) continua sendo usado para os
 * estágios de crescimento na lavoura — a troca de ícone não mexe na
 * plantinha no campo.
 *
 * Cada `CropDefinition` tem DUAS colunas dessa folha, correspondendo a dois
 * momentos diferentes (pedido explícito do usuário — separar visualmente
 * semente de fruto colhido, que antes usavam o mesmo frame):
 * `seedFrame*` = coluna 0 (saquinho de semente fechado) — Loja e Bolsa
 * ANTES de plantar; `cropFrame*` = coluna 2 (o vegetal/fruta já colhido,
 * sem selo de qualidade) — Bolsa DEPOIS de colher e a aba Descobertas.
 */
import type { SeasonId } from './seasons';

export const ALL_CROPS_ICONS_KEY = 'all-crops-icons';
export const ALL_CROPS_ICONS_PATH = 'Crops/All Crops.png';

/**
 * Definições de culturas agrícolas. A estrutura permite adicionar outras
 * sem alterar o sistema de agricultura (`systems/farmland.ts`) — basta
 * acrescentar uma entrada em `CROPS`.
 */
export interface CropDefinition {
  id: string;
  name: string;
  textureKey: string;
  texturePath: string;
  /**
   * Frames (todos no mesmo spritesheet 16x16) na ordem de crescimento — o
   * primeiro é usado logo após plantar, o último é "pronta para colher".
   * Analisado visualmente em `Crops/Spring/Carrot.png` (8 frames): 0 e 1 são
   * variações de semente, 2-5 são estágios de broto/crescimento, 6 é um
   * frame vazio do spritesheet e 7 é o ícone do item já colhido — por isso
   * não usamos 1, 6 e 7 aqui.
   */
  growthFrames: number[];
  /** Altura do quadro na folha de crescimento (padrão 16): as plantas altas (Mirtilo, Uva, Milho, feijões, Pepino, Abacaxi, Girassol) usam quadros de 16x32. */
  frameHeight?: number;
  /**
   * Ajuste vertical (px de tela) da SEMENTE recém-plantada (estágio 0), que fica deitada no canteiro: o saquinho de cada folha está numa
   * altura diferente do quadro. Calculado pela última linha opaca do quadro 0, pra todas assentarem onde as sementes da Cenoura assentam.
   */
  seedOffsetY?: number;
  /** Nome do frame recortado de `ALL_CROPS_ICONS_KEY` (registrado uma vez em `MainScene`) pro FRUTO/vegetal já colhido — Bolsa depois de colher, aba Descobertas. */
  cropFrameName: string;
  /** Retângulo do recorte (coluna 2) no spritesheet `ALL_CROPS_ICONS_KEY`. */
  cropFrameRect: { x: number; y: number; width: number; height: number };
  /** Nome do frame recortado de `ALL_CROPS_ICONS_KEY` pro SAQUINHO DE SEMENTE fechado — Loja e Bolsa antes de plantar. */
  seedFrameName: string;
  /** Retângulo do recorte (coluna 0) no spritesheet `ALL_CROPS_ICONS_KEY`. */
  seedFrameRect: { x: number; y: number; width: number; height: number };
  /**
   * Estações em que dá pra plantar (`systems/cropSeasons.ts`): fora delas a semente não entra no canteiro, e na virada pra uma estação que
   * não está aqui a plantação morre. Os do pacote seguem a pasta da folha (`Crops/Spring`, `Summer`, `Fall`); Cenoura, Batata e Cebola
   * — os básicos que a campanha e os pedidos dos moradores pedem — crescem na Primavera, no Verão e no Outono. No Inverno, nada.
   */
  seasons: readonly SeasonId[];
  /** Quantidade devolvida ao jogador por colheita. */
  /** Colheita MÍNIMA de uma plantação pronta; a sorte pode render mais, até `HARVEST_MAX_YIELD` (ver `rollHarvestAmount`). */
  yieldAmount: number;
  /** Preço (moedas) para comprar uma semente desta cultura. */
  seedPrice: number;
  /** Preço (moedas) de venda de uma unidade colhida. Sempre maior que `seedPrice` — a diferença é a margem de lucro do jogador. */
  sellPrice: number;
}

/** Os básicos (Cenoura, Batata, Cebola): o ano todo, menos no Inverno. */
const STAPLE_SEASONS: readonly SeasonId[] = ['spring', 'summer', 'autumn'];

export const CARROT: CropDefinition = {
  id: 'carrot',
  name: 'Cenoura',
  textureKey: 'crop-carrot',
  texturePath: 'Crops/Spring/Carrot.png',
  growthFrames: [0, 2, 3, 4, 5],
  seasons: STAPLE_SEASONS,
  // Linha 6, coluna 2 de `ALL_CROPS_ICONS_KEY` (cenoura já colhida, sem selo
  // de qualidade) — confirmado recortando/ampliando pixel a pixel.
  cropFrameName: 'crop-icon-carrot',
  cropFrameRect: { x: 32, y: 96, width: 16, height: 16 },
  // Linha 6, coluna 0 (saquinho de semente fechado) — mesma linha, só muda a coluna.
  seedFrameName: 'seed-icon-carrot',
  seedFrameRect: { x: 0, y: 96, width: 16, height: 16 },
  yieldAmount: 1,
  seedPrice: 5,
  sellPrice: 12,
};

/**
 * Segue exatamente a mesma convenção da cenoura (0 e 1 = variações de
 * semente, 2-5 = crescimento, 6 = frame vazio, 7 = ícone do item), conferida
 * visualmente em `Crops/Spring/Potato.png` antes de usar — nem toda cultura
 * do pacote segue esse layout (ex.: Parsnip e Cabbage têm outra contagem de
 * frames), então cada uma precisa ser conferida antes de ser adicionada.
 */
export const POTATO: CropDefinition = {
  id: 'potato',
  name: 'Batata',
  textureKey: 'crop-potato',
  texturePath: 'Crops/Spring/Potato.png',
  growthFrames: [0, 2, 3, 4, 5],
  seasons: STAPLE_SEASONS,
  // Linha 4, coluna 2 de `ALL_CROPS_ICONS_KEY` (batata já colhida, sem selo
  // de qualidade).
  cropFrameName: 'crop-icon-potato',
  cropFrameRect: { x: 32, y: 64, width: 16, height: 16 },
  // Linha 4, coluna 0 (saquinho de semente fechado) — mesma linha, só muda a coluna.
  seedFrameName: 'seed-icon-potato',
  seedFrameRect: { x: 0, y: 64, width: 16, height: 16 },
  seedOffsetY: -5,
  yieldAmount: 1,
  // Preço mais alto que a cenoura — mesma lógica de risco/recompensa das
  // demais (todas levam o mesmo número de dias pra crescer por ora, ver
  // `growthFrames`; a diferença é só no preço/rendimento).
  seedPrice: 8,
  sellPrice: 18,
};

/**
 * Mesma convenção de frames da cenoura e da batata, conferida visualmente
 * em `Crops/Spring/Onion.png` — só para dar variedade ao testar/alternar
 * entre culturas.
 */
export const ONION: CropDefinition = {
  id: 'onion',
  name: 'Cebola',
  textureKey: 'crop-onion',
  texturePath: 'Crops/Spring/Onion.png',
  growthFrames: [0, 2, 3, 4, 5],
  seasons: STAPLE_SEASONS,
  // Linha 5, coluna 2 de `ALL_CROPS_ICONS_KEY` (cebola já colhida, sem selo
  // de qualidade).
  cropFrameName: 'crop-icon-onion',
  cropFrameRect: { x: 32, y: 80, width: 16, height: 16 },
  // Linha 5, coluna 0 (saquinho de semente fechado) — mesma linha, só muda a coluna.
  seedFrameName: 'seed-icon-onion',
  seedFrameRect: { x: 0, y: 80, width: 16, height: 16 },
  seedOffsetY: -5,
  yieldAmount: 1,
  // Preço mais baixo — a mais barata das três.
  seedPrice: 4,
  sellPrice: 9,
};

/**
 * OS CULTIVOS DO PACOTE (`Crops/Spring`, `Crops/Summer`, `Crops/Fall`), conferidos quadro a quadro (recorte/ampliação e a caixa opaca de
 * cada quadro). Cada folha tem o seu layout: o quadro 0 (às vezes também o 1) são as sementes, depois vêm os estágios de crescimento —
 * `growthFrames` usa as sementes + os estágios, o último é "pronta pra colher" —, alguns quadros vazios e, no fim, o ícone do fruto (não
 * usado: o ícone vem de `ALL_CROPS_ICONS_KEY`). Os dias pra crescer = estágios - 1 (4 a 6); o preço acompanha os dias.
 *
 * Ícones em `Crops/All Crops.png`: três blocos de 8 colunas (semente fechada na 1ª, fruto puro na 3ª), uma cultura por linha — Primavera nas
 * colunas 0-7, Verão (e frutas) nas 9-16, Outono nas 18-25.
 */
type IconBlock = 'spring' | 'summer' | 'fall';
const ICON_BLOCK_SEED_X: Record<IconBlock, number> = { spring: 0, summer: 144, fall: 288 };
/** A estação de um cultivo do pacote: a pasta da folha dele. */
const SEASON_OF_FOLDER: Record<string, SeasonId> = { Spring: 'spring', Summer: 'summer', Fall: 'autumn' };

interface PackCropEntry {
  id: string;
  name: string;
  path: string;
  growthFrames: number[];
  frameHeight?: number;
  seedOffsetY: number;
  icon: [IconBlock, number];
  seedPrice: number;
  sellPrice: number;
}

function packCrop(entry: PackCropEntry): CropDefinition {
  const [block, row] = entry.icon;
  const seedX = ICON_BLOCK_SEED_X[block];
  return {
    id: entry.id,
    name: entry.name,
    textureKey: `crop-${entry.id}`,
    texturePath: `Crops/${entry.path}.png`,
    growthFrames: entry.growthFrames,
    seasons: [SEASON_OF_FOLDER[entry.path.split('/')[0]]],
    frameHeight: entry.frameHeight,
    seedOffsetY: entry.seedOffsetY,
    cropFrameName: `crop-icon-${entry.id}`,
    cropFrameRect: { x: seedX + 32, y: row * 16, width: 16, height: 16 },
    seedFrameName: `seed-icon-${entry.id}`,
    seedFrameRect: { x: seedX, y: row * 16, width: 16, height: 16 },
    yieldAmount: 1,
    seedPrice: entry.seedPrice,
    sellPrice: entry.sellPrice,
  };
}

const PACK_CROP_ENTRIES: PackCropEntry[] = [
  // Primavera.
  { id: 'strawberry', name: 'Morango', path: 'Spring/Strawberry', growthFrames: [0, 1, 2, 3, 4, 5], seedOffsetY: -8, icon: ['spring', 2], seedPrice: 12, sellPrice: 28 },
  { id: 'spring-onion', name: 'Cebolinha', path: 'Spring/Spring Onion', growthFrames: [0, 2, 3, 4, 5], seedOffsetY: -8, icon: ['spring', 3], seedPrice: 4, sellPrice: 9 },
  { id: 'blueberry', name: 'Mirtilo', path: 'Spring/Blueberry', growthFrames: [0, 1, 2, 3, 4, 5], frameHeight: 32, seedOffsetY: -6, icon: ['spring', 7], seedPrice: 14, sellPrice: 30 },
  { id: 'parsnip', name: 'Pastinaca', path: 'Spring/Parsnip', growthFrames: [0, 1, 2, 3, 4], seedOffsetY: -4, icon: ['spring', 8], seedPrice: 5, sellPrice: 11 },
  { id: 'cabbage', name: 'Repolho', path: 'Spring/Cabbage', growthFrames: [0, 2, 3, 4, 6], seedOffsetY: 0, icon: ['spring', 9], seedPrice: 9, sellPrice: 20 },
  { id: 'cauliflower', name: 'Couve-flor', path: 'Spring/Cauliflower', growthFrames: [0, 1, 2, 3, 4, 5], seedOffsetY: -6, icon: ['spring', 10], seedPrice: 15, sellPrice: 34 },
  { id: 'rice', name: 'Arroz', path: 'Spring/Rice', growthFrames: [0, 1, 2, 3, 4, 5], seedOffsetY: -4, icon: ['spring', 11], seedPrice: 8, sellPrice: 19 },
  { id: 'broccoli', name: 'Brócolis', path: 'Spring/Broccoli', growthFrames: [0, 1, 2, 3, 4], seedOffsetY: -8, icon: ['spring', 12], seedPrice: 10, sellPrice: 22 },
  { id: 'asparagus', name: 'Aspargo', path: 'Spring/Asparagus', growthFrames: [0, 1, 2, 3, 4], seedOffsetY: -8, icon: ['spring', 13], seedPrice: 11, sellPrice: 24 },
  // Verão.
  { id: 'tomato', name: 'Tomate', path: 'Summer/Tomato', growthFrames: [0, 1, 2, 3, 4, 6], seedOffsetY: -8, icon: ['summer', 4], seedPrice: 12, sellPrice: 27 },
  { id: 'sunflower', name: 'Girassol', path: 'Summer/Sunflower', growthFrames: [0, 2, 3, 4, 5], frameHeight: 32, seedOffsetY: -10, icon: ['summer', 5], seedPrice: 10, sellPrice: 23 },
  { id: 'hot-pepper', name: 'Pimenta', path: 'Summer/Hot Pepper', growthFrames: [0, 2, 3, 4, 5, 6], seedOffsetY: -8, icon: ['summer', 6], seedPrice: 13, sellPrice: 29 },
  { id: 'bell-pepper', name: 'Pimentão', path: 'Summer/Bell Pepper', growthFrames: [0, 1, 2, 3, 4, 6], seedOffsetY: -6, icon: ['summer', 8], seedPrice: 14, sellPrice: 31 },
  { id: 'melon', name: 'Melão', path: 'Summer/Melon', growthFrames: [0, 1, 2, 3, 4, 5], seedOffsetY: -6, icon: ['summer', 10], seedPrice: 18, sellPrice: 40 },
  { id: 'watermelon', name: 'Melancia', path: 'Summer/Watermelon', growthFrames: [0, 1, 2, 3, 4, 5, 7], seedOffsetY: -8, icon: ['summer', 11], seedPrice: 25, sellPrice: 58 },
  { id: 'cucumber', name: 'Pepino', path: 'Summer/Cucumber', growthFrames: [0, 1, 2, 3, 4, 5], frameHeight: 32, seedOffsetY: -8, icon: ['summer', 12], seedPrice: 12, sellPrice: 27 },
  { id: 'pineapple', name: 'Abacaxi', path: 'Summer/Pineapple', growthFrames: [0, 1, 2, 3, 4, 5], frameHeight: 32, seedOffsetY: -8, icon: ['summer', 13], seedPrice: 22, sellPrice: 50 },
  { id: 'green-beans', name: 'Vagem', path: 'Summer/Green Beans', growthFrames: [0, 2, 3, 4, 5, 6], frameHeight: 32, seedOffsetY: -8, icon: ['summer', 14], seedPrice: 11, sellPrice: 25 },
  { id: 'adzuki-bean', name: 'Feijão-azuki', path: 'Summer/Adzuki Bean', growthFrames: [0, 2, 3, 4, 5, 6], frameHeight: 32, seedOffsetY: -8, icon: ['summer', 15], seedPrice: 10, sellPrice: 23 },
  { id: 'blackberry', name: 'Amora', path: 'Summer/Blackberry', growthFrames: [0, 1, 2, 3, 4, 6], seedOffsetY: -8, icon: ['summer', 16], seedPrice: 13, sellPrice: 29 },
  { id: 'wheat', name: 'Trigo', path: 'Summer/Wheat', growthFrames: [0, 1, 2, 3, 4, 5], seedOffsetY: -6, icon: ['summer', 17], seedPrice: 6, sellPrice: 14 },
  // Outono.
  { id: 'beetroot', name: 'Beterraba', path: 'Fall/Beetroot', growthFrames: [0, 2, 3, 4, 5], seedOffsetY: -10, icon: ['fall', 1], seedPrice: 7, sellPrice: 16 },
  { id: 'pumpkin', name: 'Abóbora', path: 'Fall/Pumpkin', growthFrames: [0, 2, 3, 4, 5], seedOffsetY: -10, icon: ['fall', 2], seedPrice: 16, sellPrice: 36 },
  { id: 'grapes', name: 'Uva', path: 'Fall/Grapes', growthFrames: [0, 2, 3, 4, 5], frameHeight: 32, seedOffsetY: -8, icon: ['fall', 3], seedPrice: 15, sellPrice: 33 },
  { id: 'corn', name: 'Milho', path: 'Fall/Corn', growthFrames: [0, 2, 3, 4, 5, 7], frameHeight: 32, seedOffsetY: -6, icon: ['fall', 4], seedPrice: 12, sellPrice: 27 },
  { id: 'eggplant', name: 'Berinjela', path: 'Fall/Eggplant', growthFrames: [0, 1, 2, 3, 4, 5], seedOffsetY: -8, icon: ['fall', 5], seedPrice: 12, sellPrice: 26 },
  { id: 'aloe', name: 'Babosa', path: 'Fall/Aloe', growthFrames: [0, 1, 2, 3, 4, 5], seedOffsetY: -10, icon: ['fall', 6], seedPrice: 14, sellPrice: 30 },
];

/** Os 27 cultivos do pacote, além de Cenoura, Batata e Cebola. */
export const PACK_CROPS: readonly CropDefinition[] = PACK_CROP_ENTRIES.map(packCrop);

export const CROPS: Record<string, CropDefinition> = {
  [CARROT.id]: CARROT,
  [POTATO.id]: POTATO,
  [ONION.id]: ONION,
  ...Object.fromEntries(PACK_CROPS.map((crop) => [crop.id, crop])),
};

/** Semente selecionada por padrão no `Inventory` ao iniciar o jogo. */
export const DEFAULT_CROP_ID = CARROT.id;

/** Chance de cada quantidade colhida de uma plantação (peso relativo): quase sempre 1 ou 2, mas com sorte vêm 3 ou até 4. */
export const HARVEST_YIELD_WEIGHTS: ReadonlyArray<{ amount: number; weight: number }> = [
  { amount: 1, weight: 50 },
  { amount: 2, weight: 30 },
  { amount: 3, weight: 15 },
  { amount: 4, weight: 5 },
];
export const HARVEST_MAX_YIELD = 4;

/** Sorteia quantas unidades uma colheita rende (1 a 4, conforme `HARVEST_YIELD_WEIGHTS`); nunca menos que o mínimo da cultura. `rng` (0-1) é injetável pra teste. */
export function rollHarvestAmount(minimum = 1, rng: () => number = Math.random): number {
  const total = HARVEST_YIELD_WEIGHTS.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rng() * total;
  for (const entry of HARVEST_YIELD_WEIGHTS) {
    roll -= entry.weight;
    if (roll < 0) return Math.max(minimum, entry.amount);
  }
  return Math.max(minimum, HARVEST_MAX_YIELD);
}
