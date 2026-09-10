/**
 * Definições de culturas agrícolas. Apenas uma cultura de teste (cenoura)
 * nesta fase, mas a estrutura permite adicionar outras sem alterar o
 * sistema de agricultura (`systems/farmland.ts`) — basta acrescentar uma
 * entrada em `CROPS`.
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
  totalGrowthMs: 16000,
  maxTimeWithoutWaterMs: 10000,
  yieldAmount: 1,
  sellValue: 10,
};

export const CROPS: Record<string, CropDefinition> = {
  [CARROT.id]: CARROT,
};

/** Cultura usada ao plantar nesta fase de teste (ainda não há seleção de sementes). */
export const DEFAULT_CROP_ID = CARROT.id;
