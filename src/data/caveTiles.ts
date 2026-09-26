/**
 * Arte dos andares da Caverna (`scenes/CaveFloorScene.ts`):
 * - `Tileset/Dungeon tileset.png` (192x192, grade de 16x16, 12 colunas): o chão liso de pedra e 3 variações com rachadura (linha 11, colunas 4-7) e a parede de tijolos
 *   (linha 4, colunas 1-3) — conferidos quadro a quadro. Fora do salão o fundo é o vazio (preto).
 * - `Objects/Exterior/Mine and Dungeon/Mine/Stairs.png` (48x32, 3x2 quadros de 16x16): a escada da mina — o quadro da linha de baixo, coluna 0, é a escada dentro
 *   do buraco escuro (DESCE) e o da coluna 1 é a escada com a borda de pedra (SOBE).
 */
const TILE_COLUMNS = 12;
const tile = (col: number, row: number): number => row * TILE_COLUMNS + col;

export const CAVE_TILES = {
  key: 'cave-dungeon-tiles',
  path: 'Tileset/Dungeon tileset.png',
  size: 16,
  /** O 1º é o chão liso; os outros, com rachadura. */
  floorFrames: [tile(4, 11), tile(5, 11), tile(6, 11), tile(7, 11)],
  wallFrames: [tile(1, 4), tile(2, 4), tile(3, 4)],
};

export const CAVE_STAIRS = {
  key: 'cave-stairs',
  path: 'Objects/Exterior/Mine and Dungeon/Mine/Stairs.png',
  size: 16,
  downFrame: 3,
  upFrame: 4,
};
