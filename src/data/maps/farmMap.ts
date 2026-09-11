import { TILE_SIZE } from '../tiles';

export interface FarmMapData {
  tileSize: number;
  cols: number;
  rows: number;
  /** Posições (col, row) da base das árvores decorativas. */
  treePositions: Array<[number, number]>;
  /** Células (col, row) que podem ser cultivadas (aradas, plantadas). */
  farmlandArea: Array<[number, number]>;
  /**
   * Célula (col, row) onde a Caixa de Remessas (ponto de venda, Fase 5)
   * fica — um objeto sólido, bloqueado no grid (`systems/grid.ts`), não
   * uma célula andável. O jogador interage encostado nela, não em cima.
   */
  shippingBinPosition: [number, number];
  /**
   * Célula (col, row) onde a banca da Loja fica — também um objeto sólido,
   * bloqueado no grid, com interação adjacente (mesmo mecanismo da Caixa
   * de Remessas).
   */
  shopPosition: [number, number];
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
  // Encostada na cerca lateral direita (coluna 24 é a borda, bloqueada),
  // na mesma altura da lavoura — fácil de alcançar depois de colher, sem
  // ficar solta no meio do campo. Só 3 dos 4 vizinhos ficam andáveis (o do
  // lado da cerca não), o que já é o suficiente para a interação adjacente.
  shippingBinPosition: [23, 12],
  // Logo acima da lavoura (farmlandArea começa na linha 11) — de frente
  // para o campo, fácil de visitar tanto para plantar quanto para comprar
  // mais sementes na sequência.
  shopPosition: [9, 10],
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
