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
 * - Os índices de solo arado (seco/molhado) vieram de uma varredura de
 *   "Tilled Soil and wet soil.png" checando, por tile, opacidade total (sem
 *   nenhum pixel transparente — ladrilha sem emenda) e variância de cor
 *   (prioriza textura visível sobre cor sólida lisa), com o par seco/molhado
 *   sempre na mesma coluna, 4 linhas de diferença.
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
/**
 * Solo arado seco (linha 1, coluna 2). O tile "100% uniforme" original
 * (linha 2, coluna 9) era uma cor sólida sem nenhuma textura — visualmente
 * pobre. Este, escaneado por pixel (PowerShell + `System.Drawing`, checando
 * opacidade total e variância de cor de cada tile do spritesheet), tem
 * marcas de terra nos 4 cantos que, ao ladrilhar lado a lado, formam losangos
 * espaçados igualmente (confirmado renderizando um bloco 4x3 lado a lado,
 * sem nenhuma emenda/pixel transparente) — mesmo espírito "sem emendas" do
 * tile antigo, só que com textura de verdade.
 */
export const SOIL_DRY_INDEX = 26;
/**
 * Não existe índice "molhado" aqui: as únicas variantes de cor do
 * spritesheet são laranja (seca) e azul, e o azul destoava da paleta
 * terrosa do jogo (ver o pedido que corrigiu isso). Solo molhado reusa
 * `SOIL_DRY_INDEX` com um tingimento marrom mais escuro em vez de trocar de
 * frame — ver `WET_SOIL_TINT` em `systems/farmlandRenderer.ts`.
 */

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

/**
 * Placa de "obra em andamento" (Fase 6 — Expansão): marca cada trecho de
 * terra comprável ao redor da propriedade (`farmMap.expansions`). Imagem
 * única e completa (caixa de ferramentas + capacete), sem frames a recortar.
 */
export const CONSTRUCTION_SIGN_KEY = 'construction-sign';
export const CONSTRUCTION_SIGN_PATH = 'Objects/Exterior/Construction area.png';
