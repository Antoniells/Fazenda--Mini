import { TILE_SIZE } from '../tiles';

export interface FarmMapData {
  tileSize: number;
  cols: number;
  rows: number;
  /** Posições (col, row) da base das árvores decorativas. */
  treePositions: Array<[number, number]>;
  /** Células (col, row) que podem ser cultivadas (aradas, plantadas). */
  farmlandArea: Array<[number, number]>;
}

/**
 * Definição da primeira versão do mapa da fazenda: dimensões, grid, árvores
 * e a área cultivável. É a única fonte de verdade para essas posições —
 * tanto o desenho do mapa (`mapBuilder`) quanto a grade de colisão
 * (`systems/grid`) e a agricultura (`systems/farmland`) leem daqui, em vez
 * de duplicar as coordenadas. Novos elementos (construções, etc.) serão
 * adicionados aqui nas próximas fases, sem precisar alterar cena ou sistemas.
 */
export const farmMap: FarmMapData = {
  tileSize: TILE_SIZE,
  cols: 25,
  rows: 18,
  treePositions: [
    [3, 3],
    [21, 3],
    [3, 14],
    [21, 14],
  ],
  farmlandArea: buildRectangle(8, 11, 4, 3),
};

/** Gera a lista de células (col, row) de um retângulo de `w` x `h` a partir de (`col0`, `row0`). */
function buildRectangle(col0: number, row0: number, w: number, h: number): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  for (let row = row0; row < row0 + h; row++) {
    for (let col = col0; col < col0 + w; col++) {
      cells.push([col, row]);
    }
  }
  return cells;
}
