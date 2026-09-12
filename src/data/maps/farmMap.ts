import { TILE_SIZE } from '../tiles';

export type ExpansionDirection = 'north' | 'south' | 'east' | 'west';

/**
 * Um trecho de terra bloqueado ao redor da propriedade original (o
 * "núcleo", `cols` x `rows`), comprável individualmente — inspirado no
 * Forager: vários trechos ao redor, cada um com sua própria placa física,
 * em vez de uma única expansão genérica. `col0/row0/cols/rows` são
 * absolutos (podem ser negativos, para norte/oeste) — a grama e a câmera já
 * alcançam esse retângulo desde o início (ver `MainScene.create`), mas ele
 * fica isolado pela parede do núcleo nesse lado até a compra.
 */
export interface ExpansionChunk {
  direction: ExpansionDirection;
  col0: number;
  row0: number;
  cols: number;
  rows: number;
  price: number;
  /** Célula (col, row) DENTRO do núcleo, encostada na parede desse lado — onde fica a placa de compra. */
  signPosition: [number, number];
}

export interface FarmMapData {
  tileSize: number;
  /** Dimensões do núcleo original da propriedade — não mudam com expansões. */
  cols: number;
  rows: number;
  /** Trechos de terra ao redor do núcleo, um por direção, compráveis independentemente. */
  expansions: ExpansionChunk[];
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
  // Um trecho por lado do núcleo (25x18) — leste/oeste com a mesma altura do
  // núcleo, norte/sul com a mesma largura, sem cantos diagonais (formato
  // "cruz", igual ao Forager: você vê a terra travada ao redor da ilha
  // atual, mas cada trecho só se conecta a UM lado do que já é seu).
  expansions: [
    { direction: 'east', col0: 25, row0: 0, cols: 8, rows: 18, price: 120, signPosition: [23, 9] },
    { direction: 'west', col0: -8, row0: 0, cols: 8, rows: 18, price: 120, signPosition: [1, 9] },
    { direction: 'north', col0: 0, row0: -6, cols: 25, rows: 6, price: 100, signPosition: [12, 1] },
    { direction: 'south', col0: 0, row0: 18, cols: 25, rows: 6, price: 100, signPosition: [12, 16] },
  ],
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
