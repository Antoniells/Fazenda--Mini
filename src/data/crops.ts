/**
 * `Crops/All Crops.png` (416x288, grid uniforme de 16x16): uma folha
 * consolidada com os ícones de várias culturas do pacote, uma por linha
 * (coluna 0-1 = saquinho de semente fechado/aberto, coluna 2 = item colhido
 * "puro" sem selo de qualidade, colunas 3-5 = o mesmo item com selo de
 * qualidade prata/ouro/roxo — estilo Stardew Valley, não usado aqui, ainda
 * não existe sistema de qualidade —, coluna 6 = outra variação do item puro,
 * coluna 7 = placa) — confirmado recortando/ampliando pixel a pixel linha a
 * linha. Cada `CropDefinition` usa a COLUNA 2 (o vegetal/fruta já colhido,
 * pedido explícito do usuário — antes usava a coluna 0, o saquinho de
 * semente, o que mostrava o item errado no Inventário/Loja/Hotbar) da linha
 * correspondente. Usada só para os ÍCONES (Hotbar/Loja/Inventário, ver
 * `resolveSlotVisual` em `data/items.ts`); o spritesheet próprio de cada
 * cultura (`CropDefinition.textureKey`) continua sendo usado para os
 * estágios de crescimento na lavoura — a troca de ícone não mexe na
 * plantinha no campo.
 */
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
  /** Nome do frame recortado de `ALL_CROPS_ICONS_KEY` (registrado uma vez em `MainScene`), usado como ícone (Hotbar/Loja/Inventário). */
  iconFrameName: string;
  /** Retângulo do recorte no spritesheet `ALL_CROPS_ICONS_KEY`. */
  iconFrameRect: { x: number; y: number; width: number; height: number };
  /** Quantidade devolvida ao jogador por colheita. */
  yieldAmount: number;
  /** Preço (moedas) para comprar uma semente desta cultura. */
  seedPrice: number;
  /** Preço (moedas) de venda de uma unidade colhida. Sempre maior que `seedPrice` — a diferença é a margem de lucro do jogador. */
  sellPrice: number;
}

export const CARROT: CropDefinition = {
  id: 'carrot',
  name: 'Cenoura',
  textureKey: 'crop-carrot',
  texturePath: 'Crops/Spring/Carrot.png',
  growthFrames: [0, 2, 3, 4, 5],
  // Linha 6, coluna 2 de `ALL_CROPS_ICONS_KEY` (cenoura já colhida, sem selo
  // de qualidade) — confirmado recortando/ampliando pixel a pixel.
  iconFrameName: 'crop-icon-carrot',
  iconFrameRect: { x: 32, y: 96, width: 16, height: 16 },
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
  // Linha 4, coluna 2 de `ALL_CROPS_ICONS_KEY` (batata já colhida, sem selo
  // de qualidade).
  iconFrameName: 'crop-icon-potato',
  iconFrameRect: { x: 32, y: 64, width: 16, height: 16 },
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
  // Linha 5, coluna 2 de `ALL_CROPS_ICONS_KEY` (cebola já colhida, sem selo
  // de qualidade).
  iconFrameName: 'crop-icon-onion',
  iconFrameRect: { x: 32, y: 80, width: 16, height: 16 },
  yieldAmount: 1,
  // Preço mais baixo — a mais barata das três.
  seedPrice: 4,
  sellPrice: 9,
};

export const CROPS: Record<string, CropDefinition> = {
  [CARROT.id]: CARROT,
  [POTATO.id]: POTATO,
  [ONION.id]: ONION,
};

/** Semente selecionada por padrão no `Inventory` ao iniciar o jogo. */
export const DEFAULT_CROP_ID = CARROT.id;
