/**
 * Caverna (Sistema de Cenas): uma entrada para as minas/cavernas, estética
 * parecida com a entrada das minas do Stardew Valley (arco escuro entalhado
 * numa parede de penhasco/grama — ver `CAVE_ENTRANCE_FRAME` em
 * `data/tiles.ts`) — só o "visual básico" pedido, sem nada além disso por
 * enquanto (inimigos/minérios raros são Fase 7, pendente).
 */
export interface CaveMapData {
  cols: number;
  rows: number;
  /** Célula (col, row) da base da estrutura da entrada — ver `systems/externalMapBuilder.buildCaveEntrance`. */
  caveEntrancePosition: [number, number];
}

export const caveMap: CaveMapData = {
  // 25x19 células (32px cada) preenche a janela de 800x600 quase por
  // inteiro, evitando a faixa preta nas bordas que um mapa menor deixaria
  // à mostra (a câmera não rola além dos limites do mundo).
  cols: 25,
  rows: 19,
  caveEntrancePosition: [12, 4],
};
