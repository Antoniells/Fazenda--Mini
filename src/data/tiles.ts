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
/**
 * Segunda variante plana de grama (Fase 9 — variação visual do chão), um
 * tom mais escuro (linha 2, coluna 21). A maior parte deste spritesheet é
 * na verdade um conjunto de "moitas" arredondadas com borda denteada
 * (autotile de arbusto) — varrendo pixel a pixel, só dois tiles são 100%
 * opacos e de cor sólida (sem a borda de moita), exatamente estes dois.
 * Usado por `systems/groundVariation.ts` para misturar sutilmente as duas
 * tonalidades pelo chão, em vez de repetir sempre o mesmo tile.
 */
export const GRASS_FLAT_DARK_TILE_INDEX = 69;

/**
 * Blob de terra (caminho/mancha) — Fase 9, melhoria visual do chão v2:
 * dentro do MESMO "Tileset Grass Summer.png" (linhas 8-11, colunas 8-11)
 * existe um conjunto completo de peças de canto/borda/preenchimento com a
 * borda de grama já entalhada dentro do próprio tile (confirmado varrendo
 * quais lados de cada tile têm pixels esverdeados — só o lado que faz
 * fronteira com grama tem a borda desenhada, os outros lados encaixam sem
 * emenda com peças vizinhas). Isso permite montar retângulos de terra de
 * qualquer tamanho (usado tanto para o caminho que liga casa/lavoura/loja
 * quanto para as manchas soltas) com borda orgânica de verdade, em vez de
 * um tile plano tingido — mesma técnica de canto+borda já usada na cerca
 * (`FENCE_CORNER_INDEX`/`FENCE_EDGE_H_INDEX`), só aplicada a este blob.
 * Ver `systems/dirtPaths.ts`.
 *
 * Existe um grupo irmão idêntico em colunas 4-7 (mesmas linhas) — descartado
 * porque vários tiles dele (preenchimento e um dos cantos) têm bolhas
 * verdes decorativas (uma "moita" inteira) coladas no meio da terra, visível
 * como pontos verdes destoantes espalhados pelo caminho/mancha (relatado
 * pelo usuário). O grupo em colunas 8-11 tem exatamente a mesma forma sem
 * essa contaminação — confirmado recortando e inspecionando cada tile
 * individualmente. Uma célula (col 10, linha 9) desse grupo é um recorte
 * (buraco/entalhe) e por isso não é usada em nenhum papel.
 */
const DIRT_BLOB_COLS = 24;
function dirtBlobIndex(col: number, row: number): number {
  return row * DIRT_BLOB_COLS + col;
}
export const DIRT_BLOB_TOP_LEFT = dirtBlobIndex(8, 8);
export const DIRT_BLOB_TOP_RIGHT = dirtBlobIndex(11, 8);
export const DIRT_BLOB_BOTTOM_LEFT = dirtBlobIndex(8, 11);
export const DIRT_BLOB_BOTTOM_RIGHT = dirtBlobIndex(11, 11);
export const DIRT_BLOB_TOP_VARIANTS = [dirtBlobIndex(9, 8), dirtBlobIndex(10, 8)];
export const DIRT_BLOB_BOTTOM_VARIANTS = [dirtBlobIndex(9, 11), dirtBlobIndex(10, 11)];
export const DIRT_BLOB_LEFT_VARIANTS = [dirtBlobIndex(8, 9), dirtBlobIndex(8, 10)];
export const DIRT_BLOB_RIGHT_VARIANTS = [dirtBlobIndex(11, 9), dirtBlobIndex(11, 10)];
// Só o tile 100% limpo (sem nenhum resquício de verde nos cantos, ver
// comentário acima) — os outros dois candidatos de preenchimento deste
// grupo têm uma pontinha verde bem no canto, insignificante isolada mas
// perceptível quando repetida lado a lado no meio de uma mancha grande.
export const DIRT_BLOB_FILL_VARIANTS = [dirtBlobIndex(10, 10)];

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

/**
 * Estágios de crescimento da árvore (Fase 7 — Coleta de Recursos): a MESMA
 * folha `Pine Tree.png` já traz, à esquerda da árvore adulta usada acima,
 * uma sequência de estágios menores (confirmado pixel a pixel varrendo a
 * folha) — um brotinho pequeno e uma muda intermediária, antes da árvore
 * adulta (`PINE_TREE_FRAME`, o 3º estágio). Usados tanto pelo respawn
 * diário de árvores selvagens (`systems/resourceNodeRegistry.ts`) quanto
 * por bolotas plantadas pelo jogador (`systems/treePlanting.ts`) — as duas
 * situações crescem exatamente do mesmo jeito, só a origem do broto muda.
 */
export const PINE_SPROUT_FRAME_NAME = 'pine-tree-sprout';
export const PINE_SPROUT_FRAME = { x: 44, y: 36, width: 7, height: 9 };
export const PINE_YOUNG_FRAME_NAME = 'pine-tree-young';
export const PINE_YOUNG_FRAME = { x: 68, y: 14, width: 23, height: 32 };

export const SOIL_TILESET_KEY = 'tilled-soil';
export const SOIL_TILESET_PATH = 'Tileset/Tilled Soil and wet soil.png';

/**
 * Autotile 9-slice + `isolated` do solo arado (melhoria visual — bordas se
 * conectando com a grama conforme os vizinhos, ver `Farmland.isTilled` e
 * `systems/farmlandRenderer.ts`).
 *
 * IMPORTANTE (varredura pixel a pixel confirmada, não estimada visualmente):
 * ao contrário de `Tileset Grass Summer.png` (que tem um blob de verdade,
 * com a borda de grama entalhada dentro do tile — ver `DIRT_BLOB_*` acima),
 * este spritesheet NÃO tem tiles de borda/canto com grama misturada para o
 * 9-slice. As variações da família laranja usada em `center`/bordas/cantos
 * são só textura autoladrilhável (os "cantos com marcas de terra" formam
 * losangos ao ladrilhar, não uma transição com grama). Por isso os 9
 * índices do 9-slice propriamente dito são PROVISÓRIOS: um grid 3x3 montado
 * por matemática de linha/coluna, ancorado no tile que já era usado antes
 * desta melhoria (linha 1, coluna 2) como `center` — zero mudança visual
 * para o caso mais comum (célula cercada de terra arada dos 4 lados).
 * Ajustar esses números aqui assim que houver um asset (ou recorte) com
 * essa borda pronta.
 *
 * `isolated` é diferente: a linha 0 (colunas 12-23) deste mesmo spritesheet
 * tem, sim, pequenos montes redondos isolados (silhueta completa dentro de
 * um único tile, fundo transparente) — confirmado pixel a pixel. Linha 0,
 * coluna 12 é o usado aqui.
 *
 * `vertical*`/`horizontal*` também são reais (não provisórios): a coluna 0
 * (linhas 0-2) forma uma "cápsula" vertical pronta (capa de cima, meio
 * repetível, capa de baixo) e a linha 3 (colunas 1-3) a mesma cápsula na
 * horizontal (capa esquerda, meio, capa direita) — usadas quando a faixa
 * arada tem só 1 célula de largura/altura, onde o 9-slice normal (que
 * pressupõe pelo menos 2 células em cada direção) não se aplica. Apontado
 * pelo usuário depois de eu já ter perguntado sobre o monte isolado.
 */
const SOIL_AUTOTILE_ANCHOR_COL = 2;
const SOIL_AUTOTILE_ANCHOR_ROW = 1;
const SOIL_TILESET_COLS = 24;

function soilAutotileIndex(colOffset: number, rowOffset: number): number {
  const col = SOIL_AUTOTILE_ANCHOR_COL + colOffset;
  const row = SOIL_AUTOTILE_ANCHOR_ROW + rowOffset;
  return row * SOIL_TILESET_COLS + col;
}

export interface SoilAutotileSet {
  isolated: number;
  center: number;
  top: number;
  bottom: number;
  left: number;
  right: number;
  topLeft: number;
  topRight: number;
  bottomLeft: number;
  bottomRight: number;
  /** Faixa vertical de 1 célula de largura — capa de cima. */
  verticalTop: number;
  /** Faixa vertical de 1 célula de largura — trecho do meio, repetível. */
  verticalMiddle: number;
  /** Faixa vertical de 1 célula de largura — capa de baixo. */
  verticalBottom: number;
  /** Faixa horizontal de 1 célula de altura — capa da esquerda. */
  horizontalLeft: number;
  /** Faixa horizontal de 1 célula de altura — trecho do meio, repetível. */
  horizontalMiddle: number;
  /** Faixa horizontal de 1 célula de altura — capa da direita. */
  horizontalRight: number;
}

export const SOIL_DRY_AUTOTILE: SoilAutotileSet = {
  center: soilAutotileIndex(0, 0), // = tile antigo usado sozinho (linha 1, coluna 2) — sem mudança visual.
  top: soilAutotileIndex(0, -1),
  bottom: soilAutotileIndex(0, 1),
  left: soilAutotileIndex(-1, 0),
  right: soilAutotileIndex(1, 0),
  topLeft: soilAutotileIndex(-1, -1),
  topRight: soilAutotileIndex(1, -1),
  bottomLeft: soilAutotileIndex(-1, 1),
  bottomRight: soilAutotileIndex(1, 1),
  // Monte redondo isolado de verdade (linha 0, coluna 12) — ver comentário
  // acima. Índice fixo (não usa `soilAutotileIndex`/âncora): fica numa
  // região totalmente diferente do spritesheet, sem relação com o grid 3x3.
  isolated: 12,
  // Cápsula vertical/horizontal (ver comentário acima) — também índices
  // fixos, absolutos, sem relação com a âncora do 9-slice.
  verticalTop: 0,
  verticalMiddle: 24,
  verticalBottom: 48,
  horizontalLeft: 73,
  horizontalMiddle: 74,
  horizontalRight: 75,
};

/**
 * Não existe família "molhada" utilizável aqui: as únicas variantes de cor
 * do spritesheet são laranja (seca) e azul, e o azul destoava da paleta
 * terrosa do jogo (ver o pedido que corrigiu isso, antes desta melhoria).
 * Solo molhado continua reusando os MESMOS frames do `SOIL_DRY_AUTOTILE`
 * com um tingimento marrom mais escuro por cima, em vez de trocar de frame
 * — ver `WET_SOIL_TINT` em `systems/farmlandRenderer.ts`. Mantido como um
 * objeto separado (em vez de só reaproveitar `SOIL_DRY_AUTOTILE` direto no
 * renderer) para o dia em que houver de fato uma variante azul/molhada
 * decente pra usar — só trocar os valores aqui, sem mexer no renderer.
 */
export const SOIL_WET_AUTOTILE: SoilAutotileSet = { ...SOIL_DRY_AUTOTILE };

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

/**
 * Casa do jogador (Fase 9): `Houses/3.png` (128x112 — 8x7 tiles exatos de
 * 16px, sem precisar recortar frame nenhum, imagem única já pronta).
 * Conteúdo real (varredura pixel a pixel) ocupa x=2-125,y=13-99 dentro do
 * canvas — a pequena margem transparente ao redor não atrapalha, então a
 * imagem inteira é usada como um bloco de 8x7 células (origem no canto
 * superior-esquerdo, igual à camada de grama).
 *
 * A porta (varredura pixel a pixel da região inferior-esquerda) fica em
 * x=36-58,y=78-98 — dentro da célula de coluna 2, linha 6 (0-indexado) do
 * bloco de 8x7, ou seja, a penúltima coluna da esquerda na última linha
 * (ver `PLAYER_HOUSE_DOOR_OFFSET` em `data/maps/farmMap.ts`).
 */
export const PLAYER_HOUSE_KEY = 'player-house';
export const PLAYER_HOUSE_PATH = 'Objects/Exterior/Houses/3.png';
export const PLAYER_HOUSE_TILE_COLS = 8;
export const PLAYER_HOUSE_TILE_ROWS = 7;
/** Célula (col, row) da porta, relativa ao canto superior-esquerdo da casa. */
export const PLAYER_HOUSE_DOOR_OFFSET: [number, number] = [2, 6];

/**
 * Pontes de transição entre cenas (Sistema de Cenas): `Fence and Bridge/
 * Bridge.png` (128x128) já traz, na mesma paleta/estilo da cerca do núcleo
 * (`FENCE_TILESET_KEY`), duas variantes prontas — confirmadas pixel a
 * pixel (bounding box real dos pixels não-transparentes de cada uma):
 * - HORIZONTAL (metade de cima do arquivo): travessia de cima a baixo,
 *   usada nas paredes norte/sul do núcleo (que são horizontais).
 * - VERTICAL (metade de baixo): travessia da esquerda a direita, usada
 *   nas paredes leste/oeste (que são verticais).
 * Cada uma é grande o bastante (várias células de largura) pra cobrir os
 * tiles de cerca ao redor da célula da ponte — ver `systems/bridgeSystem.ts`.
 */
export const BRIDGE_KEY = 'bridge';
export const BRIDGE_PATH = 'Objects/Exterior/Fence and Bridge/Bridge.png';
export const BRIDGE_HORIZONTAL_FRAME = { name: 'bridge-horizontal', rect: { x: 13, y: 0, width: 70, height: 50 } };
export const BRIDGE_VERTICAL_FRAME = { name: 'bridge-vertical', rect: { x: 0, y: 65, width: 48, height: 59 } };

/**
 * Bétula (variedade extra de árvore pra Floresta, ao lado do Pinheiro já
 * usado na Fazenda): `Tree/Common/No Shadow/Birch Tree.png` tem estágios
 * de crescimento + 3 variações de cor (verde/outono/neve) lado a lado — só
 * a árvore verde adulta é usada aqui. Frame confirmado pixel a pixel
 * (mesma posição x=96 do `PINE_TREE_FRAME`, só que desta folha).
 */
export const BIRCH_TREE_KEY = 'birch-tree';
export const BIRCH_TREE_PATH = 'Objects/Tree/Common/No Shadow/Birch Tree.png';
export const BIRCH_TREE_FRAME_NAME = 'birch-tree-full';
export const BIRCH_TREE_FRAME = { x: 96, y: 0, width: 32, height: 48 };

/**
 * Pedras/rochas decorativas (Floresta/Pedreira): `Exterior/Deep Forest/deep
 * forest stones.png` tem 2 variações de monte de pedra arredondado, bounds
 * confirmados pixel a pixel (a folha tem mais 2 elementos depois, não
 * usados aqui).
 */
export const ROCK_KEY = 'rock-boulder';
export const ROCK_PATH = 'Objects/Exterior/Deep Forest/deep forest stones.png';
export const ROCK_FRAME_1 = { name: 'rock-boulder-1', rect: { x: 6, y: 1, width: 24, height: 31 } };
export const ROCK_FRAME_2 = { name: 'rock-boulder-2', rect: { x: 37, y: 3, width: 22, height: 29 } };
/**
 * "Rocha Grande" (Pedreira, Fase 7 — Coleta de Recursos): mesmo asset do
 * boulder normal, só que desenhada numa escala maior (`ROCK_BIG_SCALE_MULT`,
 * multiplicado por `DISPLAY_SCALE` em `systems/externalMapBuilder.ts`) — o
 * pacote de assets não tem uma rocha grande dedicada, e recortar uma nova
 * só para isso não mudaria a "leitura" de rocha, então reaproveitar o
 * mesmo desenho maior é mais simples que caçar/forçar outro asset.
 */
export const ROCK_BIG_SCALE_MULT = 1.6;

/** Ícone de madeira (loot do Machado, Fase 7): `Objects/Props/wood.png` (64x16) tem 4 variações de cor/dano lado a lado — só a primeira é usada. Bounds confirmados pixel a pixel. */
export const WOOD_KEY = 'wood-pile';
export const WOOD_PATH = 'Objects/Props/wood.png';
export const WOOD_FRAME = { name: 'wood-pile-icon', rect: { x: 0, y: 0, width: 16, height: 13 } };

/**
 * Veios de minério (Pedreira): `Exterior/Mine and Dungeon/stone with
 * minerals.png` (176x272, grid uniforme 16x16) tem várias fileiras de
 * cristais coloridos — usadas aqui como "veio visível" de cada minério
 * (não a mecânica de minerar em si, ainda não implementada): cinza/prateado
 * para ferro, azul-marinho escuro (o mais próximo de preto na folha, que
 * não tem uma variação realmente preta) para carvão. Bounds confirmados
 * pixel a pixel.
 */
export const ORE_KEY = 'ore-minerals';
export const ORE_PATH = 'Objects/Exterior/Mine and Dungeon/stone with minerals.png';
export const ORE_IRON_FRAME = { name: 'ore-iron', rect: { x: 18, y: 34, width: 13, height: 14 } };
export const ORE_COAL_FRAME = { name: 'ore-coal', rect: { x: 130, y: 34, width: 13, height: 14 } };

/**
 * Entrada de caverna (Caverna): `Tileset Grass Cliff Tileset Summer.png`
 * tem, dentro do tileset de penhasco, 3 arcos escuros lado a lado
 * entalhados na parede de terra/grama — usados aqui como o rosto rochoso
 * de uma entrada de mina, no estilo pedido (parecido com a entrada das
 * minas do Stardew Valley). Bounds (os 3 arcos juntos) confirmados pixel a
 * pixel — cada arco individual é 16px, mas junto formam uma estrutura mais
 * larga e "importante" que um arco só.
 */
export const CAVE_ENTRANCE_KEY = 'cave-entrance';
export const CAVE_ENTRANCE_PATH = 'Tileset/Tileset Grass Cliff Tileset Summer.png';
export const CAVE_ENTRANCE_FRAME = { name: 'cave-entrance', rect: { x: 224, y: 0, width: 48, height: 32 } };

/**
 * Água plana (pequeno lago da Floresta, mar da Praia): `Water tile.png` é
 * um único tile 16x16 sem frames — a mesma simplificação já usada pro
 * chão antes da "variação de grama" (Fase 9): sem borda especial onde
 * encontra a areia/grama, só uma área retangular de água (ver
 * `systems/externalMapBuilder.ts`). Suficiente para o "visual básico"
 * pedido; uma borda de praia/lago de verdade fica pra um polimento futuro.
 */
export const WATER_KEY = 'water-flat';
export const WATER_PATH = 'Tileset/Water tile.png';
