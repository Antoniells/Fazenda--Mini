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
  /** Frame do item já colhido, usado como ícone (ex.: na barra de sementes). */
  iconFrame: number;
  /**
   * Tempo total (ms) da semente até "pronta para colher" — baseado só no
   * tempo desde o plantio, independente de quantas vezes (ou se) foi
   * regada. Dividido em partes iguais entre os estágios de `growthFrames`.
   */
  totalGrowthMs: number;
  /**
   * Tempo máximo (ms) que a plantação sobrevive sem ser regada de novo
   * antes de morrer. Não tem relação com a velocidade de crescimento.
   */
  maxTimeWithoutWaterMs: number;
  /** Quantidade devolvida ao jogador por colheita. */
  yieldAmount: number;
  /** Valor de venda futuro (não usado nesta fase — sem economia ainda). */
  sellValue: number;
}

export const CARROT: CropDefinition = {
  id: 'carrot',
  name: 'Cenoura',
  textureKey: 'crop-carrot',
  texturePath: 'Crops/Spring/Carrot.png',
  growthFrames: [0, 2, 3, 4, 5],
  iconFrame: 7,
  totalGrowthMs: 16000,
  // 20s dá uma janela de 10s entre a terra ficar visivelmente seca (metade
  // deste valor, ver farmlandRenderer.renderSoil) e a plantação morrer —
  // tempo suficiente para o jogador perceber e regar de novo a tempo.
  maxTimeWithoutWaterMs: 20000,
  yieldAmount: 1,
  sellValue: 10,
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
  iconFrame: 7,
  totalGrowthMs: 20000,
  maxTimeWithoutWaterMs: 25000,
  yieldAmount: 1,
  sellValue: 10,
};

/**
 * Mesma convenção de frames da cenoura e da batata, conferida visualmente
 * em `Crops/Spring/Onion.png`. Cresce mais rápido que as outras duas — só
 * para dar variedade ao testar/alternar entre culturas.
 */
export const ONION: CropDefinition = {
  id: 'onion',
  name: 'Cebola',
  textureKey: 'crop-onion',
  texturePath: 'Crops/Spring/Onion.png',
  growthFrames: [0, 2, 3, 4, 5],
  iconFrame: 7,
  totalGrowthMs: 12000,
  maxTimeWithoutWaterMs: 16000,
  yieldAmount: 1,
  sellValue: 10,
};

export const CROPS: Record<string, CropDefinition> = {
  [CARROT.id]: CARROT,
  [POTATO.id]: POTATO,
  [ONION.id]: ONION,
};

/** Semente selecionada por padrão no `Inventory` ao iniciar o jogo. */
export const DEFAULT_CROP_ID = CARROT.id;
