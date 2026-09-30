import { WOOD_KEY, WOOD_FRAME, ROCK_KEY, ROCK_FRAME_2, PINE_TREE_KEY, PINE_SPROUT_FRAME_NAME, IRON_KEY, IRON_FRAME, METAL_ICON_FRAMES, COAL_KEY, COAL_FRAME } from './tiles';
import { SLIME_KEY, SLIME_IDLE_FRAMES } from './enemies';
import { EGG_ICON } from './animals';
import { nameWithQuality, parseQualityId } from './quality';
import { GRASS_DETAILS_KEY, WILD_GRASS_DETAIL } from './grassDetails';
import { FISH_RESOURCES } from './fishing';
import { STORY_ITEMS_KEY, MAP_ICON_FRAME } from './caveLandmarks';
import { ALL_CROPS_ICONS_KEY, CARROT } from './crops';
import { GOLDEN_TINT } from './sanctuary';

/**
 * Materiais coletáveis (Fase 7 — Coleta de Recursos): loot de árvores/
 * pedras (`systems/resourceInteraction.ts`), guardados no `Inventory` como
 * uma categoria própria (`SlotCategory: 'resource'`, ver `data/items.ts`) —
 * diferente da colheita da lavoura (que nunca aparece na Hotbar, só é
 * vendida em bloco na Caixa de Remessas), estes precisam aparecer/serem
 * contáveis na Hotbar, então não fazia sentido reaproveitar o Map genérico
 * `Inventory.items` (invisível na UI) nem misturar com sementes/decorações
 * (que têm semântica própria — ver comentário de `Inventory`).
 */
export interface ResourceDefinition {
  id: string;
  name: string;
  textureKey: string;
  /**
   * Nome do frame recortado (registrado em `MainScene`, já feito por outro
   * sistema — ver comentário de cada item abaixo) ou, no caso de drops de
   * inimigo (Fase 8 — Combate: `SLIME_GOO`), o índice numérico de um frame
   * de spritesheet já carregado (`entities/Slime.ts`), sem precisar
   * recortar/nomear nada — o sprite do próprio Slime já é o ícone.
   */
  frameName: string | number;
  /** Preço (moedas) de venda de UMA unidade na Caixa de Remessas (`data/sellables.ts`). Ausente = não vende (ex.: bolota, que é semente de árvore). Baixo de propósito: um tronco rende 12-16 madeiras, então 1 moeda cada já vale ~14 por árvore. */
  sellPrice?: number;
  /** Pode ter qualidade (estrelas Prata/Ouro/Irídio, `data/quality.ts`) — só o ovo por enquanto. */
  hasQuality?: boolean;
  /** Tom aplicado ao ícone (uma arte real existente, tingida — a Cenoura Dourada é a cenoura do pacote em dourado). */
  tint?: number;
}

/** Ícone reaproveita o mesmo frame já recortado por `systems/externalMapBuilder.ts` (pilha de madeira). */
export const WOOD: ResourceDefinition = {
  id: 'wood',
  name: 'Madeira',
  textureKey: WOOD_KEY,
  frameName: WOOD_FRAME.name,
  sellPrice: 1,
};

/** Ícone reaproveita o mesmo boulder já usado como decoração no mundo (`ROCK_FRAME_2`, a pedra lisa — pedido explícito do usuário) — é literalmente a pedra que o jogador quebrou. */
export const STONE: ResourceDefinition = {
  id: 'stone',
  name: 'Pedra',
  textureKey: ROCK_KEY,
  frameName: ROCK_FRAME_2.name,
  sellPrice: 2,
};

/**
 * Bolota (semente de árvore, plantável — ver `systems/treePlanting.ts`):
 * ícone reaproveita o broto da própria árvore (`PINE_SPROUT_FRAME_NAME`,
 * já recortado por `systems/externalMapBuilder.ts`) — mostra visualmente
 * "no que isso se transforma", sem precisar de um ícone de bolota dedicado.
 */
export const ACORN: ResourceDefinition = {
  id: 'acorn',
  name: 'Bolota',
  textureKey: PINE_TREE_KEY,
  frameName: PINE_SPROUT_FRAME_NAME,
};

/** Drop do Slime derrotado (Fase 8 — Combate) — ícone reaproveita o próprio frame de idle do sprite do Slime (`entities/Slime.ts`), sem precisar de um ícone de item dedicado. */
export const SLIME_GOO: ResourceDefinition = {
  id: 'slime-goo',
  name: 'Gosma de Slime',
  textureKey: SLIME_KEY,
  frameName: SLIME_IDLE_FRAMES.start,
  /** A gosma não tem outro uso (nenhuma receita a pede) — vender é o que dá valor aos Slimes: ~2 gosmas por Slime x 5 Slimes por dia. */
  sellPrice: 4,
};

/** Barra de Ferro: sai da Fornalha (`data/smelting.ts`), e também é recompensa de sobreviver à horda (`data/horde.ts`) e drop da Caverna. Mantém o id `'iron'` (saves e missões antigas). Vende na Caixa de Remessas. */
export const IRON: ResourceDefinition = {
  id: 'iron',
  name: 'Barra de Ferro',
  textureKey: IRON_KEY,
  frameName: IRON_FRAME.name,
  sellPrice: 10,
};

/**
 * Metais e carvão (Pedreira → Fornalha → Ferreiro): os MINÉRIOS BRUTOS saem dos veios da Pedreira (`data/ores.ts`, picareta) e o Carvão também; a Fornalha (`data/smelting.ts`)
 * funde 5 brutos + 3 Carvões numa BARRA; o Ferreiro (`data/toolShop.ts`) cobra 5 barras (e moedas) por ferramenta. Ícones da folha `Bars and ores.png` (`METAL_ICON_FRAMES`) e de `Coal.png`.
 * Os preços de venda são baixos de propósito (a barra vale mais que os 5 brutos, mas muito menos que a ferramenta que ela compra).
 */
export const COPPER_ORE: ResourceDefinition = { id: 'copper-ore', name: 'Cobre Bruto', textureKey: IRON_KEY, frameName: METAL_ICON_FRAMES.copperOre.name, sellPrice: 2 };
export const IRON_ORE: ResourceDefinition = { id: 'iron-ore', name: 'Ferro Bruto', textureKey: IRON_KEY, frameName: METAL_ICON_FRAMES.ironOre.name, sellPrice: 3 };
export const GOLD_ORE: ResourceDefinition = { id: 'gold-ore', name: 'Ouro Bruto', textureKey: IRON_KEY, frameName: METAL_ICON_FRAMES.goldOre.name, sellPrice: 5 };
export const COAL: ResourceDefinition = { id: 'coal', name: 'Carvão', textureKey: COAL_KEY, frameName: COAL_FRAME.name, sellPrice: 2 };
export const COPPER_BAR: ResourceDefinition = { id: 'copper-bar', name: 'Barra de Cobre', textureKey: IRON_KEY, frameName: METAL_ICON_FRAMES.copperBar.name, sellPrice: 8 };
export const GOLD_BAR: ResourceDefinition = { id: 'gold-bar', name: 'Barra de Ouro', textureKey: IRON_KEY, frameName: METAL_ICON_FRAMES.goldBar.name, sellPrice: 20 };
/** Azurita (Fase 11): minério raro das Cavernas (andar 45+); a barra sai da Fornalha com Barra de Ouro e serve pros encantamentos. */
export const AZURITE_ORE: ResourceDefinition = { id: 'azurite-ore', name: 'Azurita Bruta', textureKey: IRON_KEY, frameName: METAL_ICON_FRAMES.azuriteOre.name, sellPrice: 12 };
export const AZURITE_BAR: ResourceDefinition = { id: 'azurite-bar', name: 'Barra de Azurita', textureKey: IRON_KEY, frameName: METAL_ICON_FRAMES.azuriteBar.name, sellPrice: 60 };
/** Os pilares da terra (Fase 11, `data/sanctuary.ts`): a semente que o santuário entrega e a Cenoura colhida no altar — a arte da cenoura do pacote em dourado. Não se vendem. */
export const GOLDEN_CARROT_SEED: ResourceDefinition = { id: 'golden-carrot-seed', name: 'Semente da Cenoura Dourada', textureKey: ALL_CROPS_ICONS_KEY, frameName: CARROT.seedFrameName, tint: GOLDEN_TINT };
export const GOLDEN_CARROT: ResourceDefinition = { id: 'golden-carrot', name: 'Cenoura Dourada', textureKey: ALL_CROPS_ICONS_KEY, frameName: CARROT.cropFrameName, tint: GOLDEN_TINT };
/** O mapa do baú esquecido do andar 50 (`data/caveLandmarks.ts`): item da história, não se vende. */
export const MYSTERIOUS_MAP: ResourceDefinition = { id: 'mysterious-map', name: 'Mapa Misterioso', textureKey: STORY_ITEMS_KEY, frameName: MAP_ICON_FRAME.name };

/** Ovo de galinha (`data/animals.ts`): produção diária do galinheiro. Ícone: o 1º quadro (16x16) de `Icons/Food Icons/Chicken Egg.png`, carregado como spritesheet. Vende na Caixa de Remessas. */
export const EGG: ResourceDefinition = {
  id: 'egg',
  name: 'Ovo',
  textureKey: EGG_ICON.key,
  frameName: 0,
  sellPrice: 12,
  hasQuality: true,
};

/** Capim: o que a Foice colhe do mato da Fazenda (`systems/wildGrass.ts`). Ícone: a própria moita (`WILD_GRASS_DETAIL`, registrada pela `MainScene`). */
export const WILD_GRASS: ResourceDefinition = {
  id: 'grass',
  name: 'Capim',
  textureKey: GRASS_DETAILS_KEY,
  frameName: WILD_GRASS_DETAIL.frameName,
  sellPrice: 1,
};

/** O nome mostrado de um id de estoque, com a qualidade se tiver ("Ovo (Prata)"). */
export function resourceDisplayName(id: string): string {
  const { baseId, quality } = parseQualityId(id);
  return nameWithQuality(RESOURCES[baseId]?.name ?? id, quality);
}

export const RESOURCES: Record<string, ResourceDefinition> = {
  [WOOD.id]: WOOD,
  [STONE.id]: STONE,
  [ACORN.id]: ACORN,
  [SLIME_GOO.id]: SLIME_GOO,
  [IRON.id]: IRON,
  [COPPER_ORE.id]: COPPER_ORE,
  [IRON_ORE.id]: IRON_ORE,
  [GOLD_ORE.id]: GOLD_ORE,
  [COAL.id]: COAL,
  [COPPER_BAR.id]: COPPER_BAR,
  [GOLD_BAR.id]: GOLD_BAR,
  [AZURITE_ORE.id]: AZURITE_ORE,
  [AZURITE_BAR.id]: AZURITE_BAR,
  [MYSTERIOUS_MAP.id]: MYSTERIOUS_MAP,
  [GOLDEN_CARROT_SEED.id]: GOLDEN_CARROT_SEED,
  [GOLDEN_CARROT.id]: GOLDEN_CARROT,
  [WILD_GRASS.id]: WILD_GRASS,
  [EGG.id]: EGG,
  // Os peixes (`data/fishing.ts`): pescados com a Vara, vendidos na Caixa de Remessas.
  ...Object.fromEntries(FISH_RESOURCES.map((fish) => [fish.id, fish])),
};
