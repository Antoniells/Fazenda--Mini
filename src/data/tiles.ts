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
 * - SHIPPING_BIN_FRAME foi obtido recortando "shipping box.png" (48x64):
 *   o spritesheet tem estados fechado/aberto em tiles de 16x16, mas só o
 *   frame fechado (linha 2, coluna 1) é uma imagem completa e autocontida
 *   dentro de um único tile — o estado aberto precisa de 2 tiles empilhados
 *   (topo com a tampa + base com o interior) para caber. Como a caixa é só
 *   um objeto estático (sem animação de abrir/fechar nesta fase), o frame
 *   fechado sozinho já é suficiente.
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

export const SHIPPING_BIN_KEY = 'shipping-bin';
export const SHIPPING_BIN_PATH = 'Objects/Exterior/shipping box.png';
export const SHIPPING_BIN_FRAME_NAME = 'shipping-bin-closed';
export const SHIPPING_BIN_FRAME = { x: 0, y: 16, width: 16, height: 16 };

/**
 * Banca da Loja (Fase 5): `Newsstand.png` (32x48) é uma única imagem
 * completa (uma bancada com mercadorias nas prateleiras), sem estados nem
 * frames — ao contrário da Caixa de Remessas, não precisa de recorte.
 * Ocupa 2 tiles de largura visualmente, mas só a célula central (base) é
 * bloqueada no grid — mesma simplificação já usada nas árvores (também
 * mais largas que 1 tile e bloqueadas só numa célula).
 */
export const SHOP_STAND_KEY = 'shop-stand';
export const SHOP_STAND_PATH = 'Objects/Exterior/Newsstand.png';
