/**
 * Referências para os assets utilizados na construção do mapa da fazenda.
 *
 * Os índices/coordenadas abaixo foram obtidos analisando os arquivos reais em
 * `assets/`, e não assumidos visualmente:
 * - GRASS_FLAT_TILE_INDEX foi encontrado varrendo os tiles 16x16 de
 *   "Tileset Grass Summer.png" e identificando os únicos blocos 100%
 *   uniformes (sem bordas de autotile), usados aqui como grama plana.
 * - Os índices de cerca foram confirmados recortando e comparando tiles
 *   adjacentes de "White Fence.png" para garantir que se repetem sem costura.
 * - PINE_TREE_FRAME foi obtido recortando visualmente uma árvore completa e
 *   isolada dentro do spritesheet "Pine Tree.png".
 * - Os índices de solo arado (seco/molhado) foram encontrados pela mesma
 *   varredura de tiles 100% uniformes em "Tilled Soil and wet soil.png"
 *   (metade de cima = seco, metade de baixo = molhado/regado).
 */

export const TILE_SIZE = 16;

export const GRASS_TILESET_KEY = 'tileset-grass-summer';
export const GRASS_TILESET_PATH = 'Tileset/Tileset Grass Summer.png';
/** Tile de grama sólida, sem marcações de borda de autotile (linha 2, coluna 9). */
export const GRASS_FLAT_TILE_INDEX = 57;

export const FENCE_TILESET_KEY = 'fence-white';
export const FENCE_TILESET_PATH = 'Objects/Exterior/Fence and Bridge/White Fence.png';
/** Poste de canto superior (linha 0, coluna 0). Usado nos dois cantos de cima (espelhado no direito). */
export const FENCE_CORNER_INDEX = 0;
/**
 * Cantos inferiores dedicados (linha 2, colunas 0 e 3). O spritesheet já traz
 * tiles próprios para o canto de baixo, com a orientação correta — por isso
 * NÃO devem ser obtidos espelhando verticalmente o canto superior (isso
 * invertia o poste e causava a orientação incorreta relatada no canto
 * inferior esquerdo).
 */
export const FENCE_CORNER_BOTTOM_LEFT_INDEX = 10;
export const FENCE_CORNER_BOTTOM_RIGHT_INDEX = 13;
/** Trecho de cerca vertical (linha 1, coluna 0). */
export const FENCE_EDGE_V_INDEX = 5;
/** Trecho de cerca horizontal (linha 3, coluna 0). */
export const FENCE_EDGE_H_INDEX = 15;

export const PINE_TREE_KEY = 'pine-tree';
export const PINE_TREE_PATH = 'Objects/Tree/Common/No Shadow/Pine Tree.png';
export const PINE_TREE_FRAME_NAME = 'pine-tree-full';
export const PINE_TREE_FRAME = { x: 96, y: 0, width: 32, height: 48 };

export const SOIL_TILESET_KEY = 'tilled-soil';
export const SOIL_TILESET_PATH = 'Tileset/Tilled Soil and wet soil.png';
/** Solo arado seco, tile sólido (linha 2, coluna 9). */
export const SOIL_DRY_INDEX = 57;
/** Solo arado molhado/regado, tile sólido (linha 6, coluna 9). */
export const SOIL_WET_INDEX = 153;
