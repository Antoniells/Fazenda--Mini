/**
 * O FUNDO ANIMADO DO MENU INICIAL (`scenes/MenuBackdropScene.ts`): uma fazendinha viva montada SÓ com o que o jogo já tem — a mesma
 * composição da antiga imagem de fundo (`UI/Menu/menu_bg.jpg`): rio com cachoeira no alto à esquerda, patos nadando, árvores, a lavoura
 * de cenoura, cebola e milho no meio, a casa com o galinheiro cercado à direita e os caminhos de terra. Só DADOS: o desenho está na cena.
 *
 * O mapa tem o tamanho da tela (40 x 23 células de 32 px). `MENU_BACKDROP_LAYOUT`, uma linha por fileira, um caractere por célula:
 *   `.` grama · `w` água (o rio, com a borda de terra da Floresta) · `d` caminho de terra · `t` terra arada (a lavoura)
 *
 * A terra usa o blob de `data/tiles.ts` (`DIRT_BLOB_*`), que só tem canto, borda e miolo: toda faixa de terra precisa de pelo menos
 * 2 células de largura e de altura (numa faixa de 1 célula, a peça escolhida traz a franja de grama de um lado só e o outro fica
 * cortado reto). Fora do mapa, vale a célula da beira (`menuBackdropCell`) — o chão continua além da tela, sem borda na beira.
 */
export const MENU_BACKDROP_COLS = 40;
export const MENU_BACKDROP_ROWS = 23;

export const MENU_BACKDROP_LAYOUT: readonly string[] = [
  'wwwwwwwwwwwww...........................', // 0
  'wwwwwwwwwwwwww..........................', // 1
  'wwwwwwwwwwwwww..........................', // 2
  'wwwwwwwwwwwwwww.........................', // 3
  'wwwwwwwwwwwwww..........................', // 4
  'wwwwwwwwwwww............................', // 5
  'wwwwwwwww...............................', // 6
  'wwwww...................................', // 7
  '..............................dd........', // 8
  '..............................dd........', // 9
  '..tttttttttt..................dd........', // 10
  '..tttttttttt..................dd........', // 11
  '..tttttttttt..................dd........', // 12
  '..tttttttttt..................dd........', // 13
  '..tttttttttt..................dd........', // 14
  '.dddddddddddddddddddddddddddddddd.......', // 15
  'ddddddddddddddddddddddddddddddddddd.....', // 16
  'dddddd....................dddddddddddddd', // 17
  'dddddd......................dddddddddddd', // 18
  'dddd........................dddddddddddd', // 19
  'dddd........................dddddddddddd', // 20
  'dddddd....................dddddddddddddd', // 21
  'dddddd....................dddddddddddddd', // 22
];

/** O caractere da célula; fora do mapa, o da célula da beira mais próxima. */
export function menuBackdropCell(col: number, row: number): string {
  const r = Math.min(MENU_BACKDROP_ROWS - 1, Math.max(0, row));
  const c = Math.min(MENU_BACKDROP_COLS - 1, Math.max(0, col));
  return MENU_BACKDROP_LAYOUT[r][c];
}

/**
 * A casa (`Houses/3.png`, a "Casa" do jogador, 8 x 7 células): canto superior-esquerdo da arte, mais um ajuste em px de tela pra a porta
 * (x 43-57 da arte) cair no meio do caminho de 2 células (colunas 30-31) que desce dela.
 */
export const MENU_HOUSE = { col: 27, row: 1, offsetX: 28 };

/**
 * A cachoeira (`Tileset/Spring Waterfall.png`, 8 quadros de 64 x 64 na 1ª fileira = 4 x 4 células): canto superior-esquerdo, no alto do rio.
 * As células que ela cobre são o seu COLISOR: nenhum pato nada por elas (`isMenuDuckWater`).
 */
export const MENU_WATERFALL = { col: 4, row: 0, cols: 4, rows: 4 };

/** A célula está debaixo da cachoeira? */
export function isUnderMenuWaterfall(col: number, row: number): boolean {
  const { col: col0, row: row0, cols, rows } = MENU_WATERFALL;
  return col >= col0 && col < col0 + cols && row >= row0 && row < row0 + rows;
}

/** Árvores: pinheiros e Carvalhos Rosa floridos (`OAK_TREE_*` em `data/tiles.ts`). Célula do tronco. */
export const MENU_TREES: ReadonlyArray<{ col: number; row: number; kind: 'pine' | 'pink-oak' }> = [
  { col: 16, row: 4, kind: 'pine' },
  { col: 13, row: 8, kind: 'pink-oak' },
  { col: 22, row: 6, kind: 'pine' },
  { col: 37, row: 7, kind: 'pine' },
  { col: 37, row: 3, kind: 'pink-oak' },
  { col: 1, row: 8, kind: 'pink-oak' },
  { col: 14, row: 12, kind: 'pink-oak' },
  { col: 24, row: 11, kind: 'pine' },
  { col: 27, row: 13, kind: 'pink-oak' },
  { col: 7, row: 20, kind: 'pink-oak' },
  { col: 12, row: 20, kind: 'pine' },
  { col: 20, row: 21, kind: 'pine' },
  { col: 24, row: 19, kind: 'pink-oak' },
];

/** A lavoura: cada coluna da terra arada com a sua cultura (as três do jogo, maduras) — e o milho, que não é cultura do jogo, só enfeite. */
export const MENU_FIELD_COLUMNS: ReadonlyArray<{ col: number; crop: 'carrot' | 'onion' | 'potato' | 'corn' }> = [
  { col: 2, crop: 'carrot' },
  { col: 3, crop: 'carrot' },
  { col: 4, crop: 'carrot' },
  { col: 5, crop: 'onion' },
  { col: 6, crop: 'onion' },
  { col: 7, crop: 'potato' },
  { col: 8, crop: 'potato' },
  { col: 9, crop: 'corn' },
  { col: 10, crop: 'corn' },
  { col: 11, crop: 'corn' },
];

/** O milho maduro (`Crops/Fall/Corn.png`, 10 quadros de 16 x 32 — o 7 é o pé com as espigas). */
export const CORN = { key: 'menu-corn', path: 'Crops/Fall/Corn.png', frameWidth: 16, frameHeight: 32, ripeFrame: 7 };

/** O galinheiro cercado (cerca de madeira, `fenceSkins`): o retângulo da cerca e as galinhas soltas dentro dele. */
export const MENU_CHICKEN_YARD = { col0: 33, row0: 9, col1: 39, row1: 14 };
export const MENU_CHICKENS = 3;

/**
 * Os patos nadando no rio (`systems/ducks.ts`): quantos são e onde podem nadar — a água do rio menos a cachoeira. As raias saem de
 * `findDuckLanes` (`systems/duckLanes.ts`), o mesmo do lago da Floresta: longe da margem e, aqui, longe da cachoeira.
 */
export const MENU_DUCK_COUNT = 2;
export function isMenuDuckWater(col: number, row: number): boolean {
  return menuBackdropCell(col, row) === 'w' && !isUnderMenuWaterfall(col, row);
}

/**
 * O fazendeiro (o personagem pronto Alex): sai de casa, desce o caminho, rega a lavoura e volta — em loop. Cada parada é uma célula; `water`
 * = rega ali (olhando pra cima, pra a lavoura), `wait` = fica parado um tempo (ms).
 */
export type FarmerStep = { col: number; row: number } | { water: true } | { wait: number };
export const MENU_FARMER_START = { col: 30, row: 8 };
export const MENU_FARMER_ROUTE: readonly FarmerStep[] = [
  { col: 30, row: 15 },
  { col: 9, row: 15 },
  { water: true },
  { col: 6, row: 15 },
  { water: true },
  { col: 3, row: 15 },
  { water: true },
  { wait: 1500 },
  { col: 30, row: 15 },
  { col: 30, row: 8 },
  { wait: 2500 },
];

/** Flores, cogumelos e moitas (ids de `data/mapProps.ts`) espalhados pela grama: [coluna, fileira, id]. */
export const MENU_PROPS: ReadonlyArray<[number, number, string]> = [
  [17, 1, 'prop-flower-pink'],
  [19, 3, 'prop-flower-white-cluster'],
  [26, 9, 'prop-mushroom-orange'],
  [13, 10, 'prop-flower-blue-1'],
  [5, 8, 'prop-tuft-teal'],
  [9, 8, 'prop-flower-pink'],
  [16, 13, 'prop-flower-pink'],
  [22, 18, 'prop-flower-blue-2'],
  [17, 19, 'prop-mushroom-tan'],
  [9, 18, 'prop-flower-white-small'],
  [34, 15, 'prop-flower-purple-crystal'],
  [36, 15, 'prop-tuft-orange-dry'],
  [26, 6, 'prop-flower-white-small'],
  [12, 14, 'prop-mushroom-brown'],
  [5, 19, 'prop-tuft-teal'],
  [15, 22, 'prop-flower-white-cluster'],
  [38, 2, 'prop-flower-blue-1'],
];
