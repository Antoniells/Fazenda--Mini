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
/** Cerca DESTRUÍDA (ver `systems/farmFences.ts`): o 2º quadro da folha (índice 1) — só dois cepos de tábua quebrada, sem os postes. */
export const FENCE_BROKEN_INDEX = 1;

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
/** Cópia de `Tilled Soil and wet soil.png` SEM os pontinhos escuros do miolo (o 9-slice original traz um quarto de ponto em cada canto de tile, que numa área arada vira uma grade de "furos"); o original continua na pasta. */
export const SOIL_TILESET_PATH = 'Tileset/Tilled Soil and wet soil (sem pontos).png';

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
 * Dentro de `BRIDGE_VERTICAL_FRAME`, os 2 postes de reforço não ficam
 * simétricos em relação ao centro do módulo (confirmado varrendo coluna a
 * coluna, opacidade): o esquerdo fica nas colunas 16-19, bem perto do meio
 * (só 6.5px do centro em 24), enquanto o direito fica nas colunas 44-47,
 * colado na borda direita (21.5px do centro). Pedido explícito do usuário
 * pra "arrastar" o poste esquerdo até a borda e apagar o buraco que ele
 * deixava: tentar só "remendar" a posição antiga com um pedaço de parede de
 * outro trecho (`BRIDGE_VERTICAL_WALL_PATCH_FRAME`, descartado) deixava uma
 * emenda visível — as ripas/argamassa têm juntas verticais a cada 4px
 * (confirmado varrendo opacidade de todas as colunas: x=0,4,8,...44), e um
 * remendo de 8px puxado de outro trecho nunca encaixa nessa grade.
 *
 * A solução é montar a ponte a partir de 2 peças, não mais uma só: um
 * ladrilho de 4px (`BRIDGE_VERTICAL_WALL_TILE_FRAME`, exatamente 1 período
 * da grade de juntas — colunas 24-27, sem poste) repetido como
 * `TileSprite` pra cobrir a parede inteira sem nenhuma emenda por
 * construção, com os 2 postes (`BRIDGE_VERTICAL_POST_FRAME`, o poste
 * direito original — 4px limpos, reaproveitado nos dois lados) desenhados
 * por cima, cada um na posição desejada, de forma totalmente independente.
 */
export const BRIDGE_VERTICAL_WALL_TILE_FRAME = { name: 'bridge-vertical-wall-tile', rect: { x: 24, y: 65, width: 4, height: 59 } };
export const BRIDGE_VERTICAL_POST_FRAME = { name: 'bridge-vertical-post', rect: { x: 44, y: 65, width: 4, height: 59 } };

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
 * forest stones.png` tem 3 variações de monte de pedra arredondado, bounds
 * confirmados pixel a pixel (a folha tem mais 2 elementos depois, não
 * usados aqui).
 *
 * O retângulo original de `ROCK_FRAME_2` (x:37,y:3,22x29) na verdade continha DUAS pedras diferentes desenhadas uma embaixo da
 * outra — uma lisa em cima, outra com musgo embaixo (pedido explícito do usuário, que mandou um print apontando isso). Separadas
 * varrendo linha a linha: y=16-17 é o único par de linhas 100% transparentes no meio do retângulo — o corte exato entre as duas.
 */
export const ROCK_KEY = 'rock-boulder';
export const ROCK_PATH = 'Objects/Exterior/Deep Forest/deep forest stones.png';
export const ROCK_FRAME_1 = { name: 'rock-boulder-1', rect: { x: 6, y: 1, width: 24, height: 31 } };
/** Pedra lisa (metade de cima do antigo `ROCK_FRAME_2`) — também usada como ícone de "Pedra" (`data/resources.ts`). */
export const ROCK_FRAME_2 = { name: 'rock-boulder-2', rect: { x: 37, y: 3, width: 22, height: 13 } };
/** Pedra com musgo (metade de baixo do antigo `ROCK_FRAME_2`). */
export const ROCK_FRAME_3 = { name: 'rock-boulder-3', rect: { x: 37, y: 18, width: 22, height: 14 } };
/**
 * "Rocha Grande" (Pedreira, Fase 7 — Coleta de Recursos): mesmo asset do
 * boulder normal, só que desenhada numa escala maior (`ROCK_BIG_SCALE_MULT`,
 * multiplicado por `DISPLAY_SCALE` em `systems/externalMapBuilder.ts`) — o
 * pacote de assets não tem uma rocha grande dedicada, e recortar uma nova
 * só para isso não mudaria a "leitura" de rocha, então reaproveitar o
 * mesmo desenho maior é mais simples que caçar/forçar outro asset.
 */
export const ROCK_BIG_SCALE_MULT = 1.6;

/**
 * Ícone de madeira (loot do Machado, Fase 7 — o drop no chão, o slot do Inventário e a Caixa de Remessas):
 * `Icons/RPG icons/Extras/Wood.png` (64x48) é uma folha de ícones 16x16 (4 colunas x 3 linhas, variações de
 * cor/sombra do mesmo tronco) — só o primeiro (célula inteira 0,0) é usado.
 */
export const WOOD_KEY = 'wood-pile';
export const WOOD_PATH = 'Icons/RPG icons/Extras/Wood.png';
export const WOOD_FRAME = { name: 'wood-pile-icon', rect: { x: 0, y: 0, width: 16, height: 16 } };

/**
 * Veios de minério (Pedreira, minerados com a Picareta — `systems/oreInteraction.ts`, `data/ores.ts`): `Exterior/Mine and Dungeon/stone with
 * minerals.png` (176x176, grid uniforme 16x16) tem várias fileiras de
 * cristais coloridos — a 1ª linha (a pedra com o minério embutido; todas com o mesmo recorte 11x10 em y=4) dá o "veio visível" de cada minério: laranja
 * para cobre, cinza/prateado para ferro, amarelo para ouro, azul-marinho escuro (o mais próximo de preto na folha, que
 * não tem uma variação realmente preta) para carvão. Bounds confirmados
 * pixel a pixel.
 */
export const ORE_KEY = 'ore-minerals';
export const ORE_PATH = 'Objects/Exterior/Mine and Dungeon/stone with minerals.png';
export const ORE_IRON_FRAME = { name: 'ore-iron', rect: { x: 18, y: 4, width: 11, height: 10 } };
export const ORE_COAL_FRAME = { name: 'ore-coal', rect: { x: 130, y: 4, width: 11, height: 10 } };
export const ORE_COPPER_FRAME = { name: 'ore-copper', rect: { x: 2, y: 4, width: 11, height: 10 } };
export const ORE_GOLD_FRAME = { name: 'ore-gold', rect: { x: 34, y: 4, width: 11, height: 10 } };
/** Azurita (Fase 11 — só nas Cavernas, a partir do andar 45): a 8ª pedra da 1ª linha, a de cristais azul-ciano (mesmo recorte 11x10 em y=4). */
export const ORE_AZURITE_FRAME = { name: 'ore-azurite', rect: { x: 114, y: 4, width: 11, height: 10 } };

/**
 * Entrada de caverna (Caverna): a escadaria descendo pra dentro da terra de `Objects/Exterior/Deep Forest/Hidden Entrance.png` (80x96, um kit de peças: 4 colunas e essa
 * escadaria no meio). Recorte pixel a pixel (33x31 em (22, 49)) — só a escadaria; as colunas ao redor ficam de fora.
 */
export const CAVE_ENTRANCE_KEY = 'cave-entrance';
export const CAVE_ENTRANCE_PATH = 'Objects/Exterior/Deep Forest/Hidden Entrance.png';
export const CAVE_ENTRANCE_FRAME = { name: 'cave-entrance', rect: { x: 22, y: 49, width: 33, height: 31 } };

/**
 * Ícone de Ferro (recompensa da horda, ver `data/horde.ts`): a barra de ferro (cinza, 3ª coluna da 1ª linha) de
 * `Icons/RPG icons/Extras/Bars and ores.png` (256x64, grade de ícones 16x16).
 */
export const IRON_KEY = 'iron-bar';
export const IRON_PATH = 'Icons/RPG icons/Extras/Bars and ores.png';
export const IRON_FRAME = { name: 'iron-bar-icon', rect: { x: 32, y: 0, width: 16, height: 16 } };

/**
 * Ícones do resto dos metais (`data/resources.ts`), da MESMA folha (`IRON_KEY`, células 16x16): linha 0 = cobre (barra, minério bruto), ferro (barra — `IRON_FRAME` —, minério bruto);
 * linha 1 = ouro (barra, minério bruto); linha 2 = azurita (barra, minério bruto). Registrados na `MainScene`.
 */
export const METAL_ICON_FRAMES = {
  copperBar: { name: 'metal-copper-bar', rect: { x: 0, y: 0, width: 16, height: 16 } },
  copperOre: { name: 'metal-copper-ore', rect: { x: 16, y: 0, width: 16, height: 16 } },
  ironOre: { name: 'metal-iron-ore', rect: { x: 48, y: 0, width: 16, height: 16 } },
  goldBar: { name: 'metal-gold-bar', rect: { x: 0, y: 16, width: 16, height: 16 } },
  goldOre: { name: 'metal-gold-ore', rect: { x: 16, y: 16, width: 16, height: 16 } },
  // Linha 2: a barra dourada com azul (a "mesclagem do ouro com a azurita") e a pedrinha azul do minério bruto.
  azuriteBar: { name: 'metal-azurite-bar', rect: { x: 32, y: 32, width: 16, height: 16 } },
  azuriteOre: { name: 'metal-azurite-ore', rect: { x: 48, y: 32, width: 16, height: 16 } },
};

/** Ícone do Carvão: `Icons/RPG icons/Extras/Coal.png` (32x32, 2x2 células de 16x16) — a 1ª célula. */
export const COAL_KEY = 'coal-icons';
export const COAL_PATH = 'Icons/RPG icons/Extras/Coal.png';
export const COAL_FRAME = { name: 'coal-icon', rect: { x: 0, y: 0, width: 16, height: 16 } };

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

/**
 * Autotile ANIMADO da água (lago da Floresta, mar da Praia): `Beach animations tiles.png`
 * (384x256 = grade 24x16 de 16px, carregada como spritesheet — frame = linha*24 + coluna,
 * igual ao solo arado). A folha tem 4 BLOCOS de 4 linhas empilhados (linhas 0-3, 4-7, 8-11,
 * 12-15) que são as 4 FASES da animação (a espuma/ondulação da borda muda de um bloco pro
 * outro, o formato dos tiles é idêntico); cada bloco, nas colunas 0-3, é o MESMO layout de
 * 16 tiles do solo arado (`SOIL_DRY_AUTOTILE`), com fundo de areia opaco:
 *   col 0, linhas 0-2 = cápsula vertical (capa de cima / meio / capa de baixo)
 *   linha 3, cols 1-3 = cápsula horizontal (capa da esquerda / meio / capa da direita)
 *   col 0, linha 3    = ilhota (sem nenhum vizinho de água)
 *   cols 1-3, linhas 0-2 = 9-slice (cantos, bordas, centro)
 * O "centro" desse 9-slice tem rosquinhas nos 4 cantos (repetido, viraria bolinhas em todo
 * encontro de tiles), então o miolo do lago (4 vizinhos de água) usa o tile de água lisa da
 * coluna 9, linha 2 — o único 100% liso da folha (varredura pixel a pixel; idêntico nas 4 fases).
 *
 * A escolha é por BITMASK dos 4 vizinhos ortogonais (bit ligado = o vizinho também é água):
 * N=1, E=2, S=4, W=8 → 16 combinações, uma por tile (`WATER_AUTOTILE_FRAMES`).
 */
export const WATER_AUTOTILE_KEY = 'water-autotile';
export const WATER_AUTOTILE_PATH = 'Tileset/Beach animations tiles.png';
const WATER_SHEET_COLS = 24;
const waterFrame = (col: number, row: number): number => row * WATER_SHEET_COLS + col;
/** Primeira coluna do LAGO 4x4 (sem rosquinhas) — colunas 8-11 na folha da Praia; a da Floresta é a mesma deslocada de 12 colunas. */
const WATER_LAKE_COL = 8;

export const WATER_NEIGHBOR = { N: 1, E: 2, S: 4, W: 8 } as const;
const { N, E, S, W } = WATER_NEIGHBOR;

/** As 4 diagonais de uma célula (onde pode haver um canto interno de areia — ver `WaterStyle.innerCorners`). */
export type WaterDiagonal = 'NW' | 'NE' | 'SW' | 'SE';
/**
 * Cantos internos do bloco do MEIO (colunas 4-7): ali as "rosquinhas" (areia com anel) ficam cada uma no cruzamento de 4 tiles, então cada
 * tile do miolo 2x2 (colunas 5-6, linhas 1-2) leva um QUARTO de rosquinha no canto — exatamente o que falta quando a areia encosta na água só
 * pela diagonal (sem ele, o miolo liso deixa um "quadrado azul" avançando sobre a areia). Usados só nessas células, nunca nas bordas retas.
 */
const WATER_INNER_CORNER_FRAMES: Record<WaterDiagonal, number> = {
  NW: waterFrame(5, 1), //  areia no canto superior esquerdo
  NE: waterFrame(6, 1),
  SW: waterFrame(5, 2),
  SE: waterFrame(6, 2),
};

/**
 * Frame (na fase 0) de cada máscara de vizinhos. Só as formas FINAS — ilhota e cápsulas (água com 0, 1 ou 2 vizinhos opostos) — vêm do
 * bloco 1 (colunas 0-3), que é o único com esses formatos. Cantos e bordas (água com 2 vizinhos em L ou 3 vizinhos) NÃO usam o 9-slice do bloco 1:
 * ele tem "rosquinhas" (pontinhas de areia/terra com anel) nos cantos internos, que apareciam como arcos ao longo da margem. Vêm do LAGO 4x4
 * das colunas 8-11 (`WATER_LAKE_COL`), que não tem rosquinha nenhuma — ver `WATER_AUTOTILE_ALTERNATES` pras bordas.
 */
export const WATER_AUTOTILE_FRAMES: Record<number, number> = {
  0: waterFrame(0, 3), //           ilhota
  [S]: waterFrame(0, 0), //         só vizinho embaixo → capa de cima da cápsula vertical
  [N | S]: waterFrame(0, 1), //     meio da cápsula vertical
  [N]: waterFrame(0, 2), //         só vizinho em cima → capa de baixo
  [E]: waterFrame(1, 3), //         só vizinho à direita → capa da esquerda da cápsula horizontal
  [E | W]: waterFrame(2, 3), //     meio da cápsula horizontal
  [W]: waterFrame(3, 3), //         só vizinho à esquerda → capa da direita
  [E | S]: waterFrame(WATER_LAKE_COL, 0), //         canto superior esquerdo
  [E | S | W]: waterFrame(WATER_LAKE_COL + 1, 0), // borda de cima (alterna com a coluna vizinha, ver abaixo)
  [S | W]: waterFrame(WATER_LAKE_COL + 3, 0), //     canto superior direito
  [N | E | S]: waterFrame(WATER_LAKE_COL, 1), //     borda da esquerda (alterna por linha)
  [N | E | S | W]: waterFrame(9, 2), // miolo (água lisa)
  [N | S | W]: waterFrame(WATER_LAKE_COL + 3, 1), // borda da direita (alterna por linha)
  [N | E]: waterFrame(WATER_LAKE_COL, 3), //         canto inferior esquerdo
  [N | E | W]: waterFrame(WATER_LAKE_COL + 1, 3), // borda de baixo (alterna com a coluna vizinha)
  [N | W]: waterFrame(WATER_LAKE_COL + 3, 3), //     canto inferior direito
};

/**
 * As bordas do lago (blocos 4x4) não se repetem sozinhas: o topo é feito de DOIS tiles diferentes (colunas 9 e 10 do bloco), com uma onda
 * que só fecha com o par. Por isso as bordas alternam entre os dois: a de cima/de baixo pela COLUNA da célula, a da esquerda/direita pela
 * LINHA. `axis` diz qual; `frames` são [par, ímpar] (fase 0).
 */
export interface WaterEdgeAlternate {
  axis: 'col' | 'row';
  frames: [number, number];
}
export const WATER_AUTOTILE_ALTERNATES: Record<number, WaterEdgeAlternate> = {
  [E | S | W]: { axis: 'col', frames: [waterFrame(WATER_LAKE_COL + 1, 0), waterFrame(WATER_LAKE_COL + 2, 0)] },
  [N | E | W]: { axis: 'col', frames: [waterFrame(WATER_LAKE_COL + 1, 3), waterFrame(WATER_LAKE_COL + 2, 3)] },
  [N | E | S]: { axis: 'row', frames: [waterFrame(WATER_LAKE_COL, 1), waterFrame(WATER_LAKE_COL, 2)] },
  [N | S | W]: { axis: 'row', frames: [waterFrame(WATER_LAKE_COL + 3, 1), waterFrame(WATER_LAKE_COL + 3, 2)] },
};

/**
 * Estilos de água (autotile animado) disponíveis por cena. Todos têm o MESMO layout de 16 tiles em 4 fases (ver acima) — só mudam a
 * folha, a coluna onde o bloco de 4x4 começa e o tile de água lisa (miolo do lago):
 * - `beach` (padrão: Praia, mar): `Beach animations tiles.png`, blocos nas colunas 0-3, miolo em (9, 2).
 * - `waterGround` (Floresta): `Water Ground animations tiles.png` — mesma grade 24x16, mas o bloco de água azul com margem de terra
 *   fica nas colunas 12-15 e o miolo liso (o único tile 100% opaco e liso, achado por varredura de pixels) em (21, 2).
 */
export interface WaterStyle {
  textureKey: string;
  path: string;
  /** Frame (fase 0) de cada máscara de vizinhos. */
  frames: Record<number, number>;
  /** Canto INTERNO (água com os 4 vizinhos ortogonais, mas areia/terra numa DIAGONAL): frame (fase 0) por diagonal onde está a areia. */
  innerCorners: Record<WaterDiagonal, number>;
  /** Bordas que alternam entre dois tiles (fase 0) — ver `WATER_AUTOTILE_ALTERNATES`. */
  alternates: Record<number, WaterEdgeAlternate>;
}
/**
 * Bordas de um estilo de água deslocado de colunas. `single` (opcional) escolhe, por máscara, UM dos dois tiles alternados (0 = par, 1 = ímpar) e o usa em
 * todas as células — pra folhas em que um dos dois tiles tem a água encostando na borda de fora do bloco (um "buraco" na margem de terra), como na Floresta.
 */
const shiftedAlternates = (colOffset: number, single: Partial<Record<number, 0 | 1>> = {}): Record<number, WaterEdgeAlternate> =>
  Object.fromEntries(
    Object.entries(WATER_AUTOTILE_ALTERNATES).map(([mask, alt]) => {
      const frames: [number, number] = [alt.frames[0] + colOffset, alt.frames[1] + colOffset];
      const pick = single[Number(mask)];
      return [mask, { axis: alt.axis, frames: pick === undefined ? frames : ([frames[pick], frames[pick]] as [number, number]) }];
    }),
  );
const shiftedFrames = (colOffset: number, interior: number): Record<number, number> => {
  const frames: Record<number, number> = {};
  for (const [mask, frame] of Object.entries(WATER_AUTOTILE_FRAMES)) frames[Number(mask)] = frame + colOffset;
  frames[N | E | S | W] = interior;
  return frames;
};
/**
 * Qual dos dois tiles alternados de cada lado do lago NÃO deixa a água encostar na beirada de fora (o outro abre um "buraco" na margem de terra/areia): cima e direita
 * o 2º, baixo e esquerda o 1º. Vale pras duas folhas (Praia e Floresta têm o mesmo desenho de bloco).
 */
const LAKE_CONTINUOUS_EDGE: Partial<Record<number, 0 | 1>> = { [E | S | W]: 1, [N | E | W]: 0, [N | E | S]: 0, [N | S | W]: 1 };
export const WATER_STYLES = {
  beach: {
    textureKey: WATER_AUTOTILE_KEY,
    path: WATER_AUTOTILE_PATH,
    frames: WATER_AUTOTILE_FRAMES,
    innerCorners: WATER_INNER_CORNER_FRAMES,
    alternates: shiftedAlternates(0, LAKE_CONTINUOUS_EDGE),
  },
  waterGround: {
    textureKey: 'water-ground-autotile',
    path: 'Tileset/Water Ground animations tiles.png',
    frames: shiftedFrames(12, waterFrame(21, 2)),
    innerCorners: { NW: WATER_INNER_CORNER_FRAMES.NW + 12, NE: WATER_INNER_CORNER_FRAMES.NE + 12, SW: WATER_INNER_CORNER_FRAMES.SW + 12, SE: WATER_INNER_CORNER_FRAMES.SE + 12 },
    alternates: shiftedAlternates(12, LAKE_CONTINUOUS_EDGE),
  },
} satisfies Record<string, WaterStyle>;
export type WaterStyleId = keyof typeof WATER_STYLES;

/** Fases da animação: blocos de 4 linhas empilhados (fase p = frame + p * `WATER_AUTOTILE_PHASE_STRIDE`) e quanto dura cada fase. */
export const WATER_AUTOTILE_PHASES = 4;
export const WATER_AUTOTILE_PHASE_STRIDE = 4 * WATER_SHEET_COLS;
export const WATER_AUTOTILE_PHASE_MS = 520;
/** Máscara do miolo (água lisa, sem borda) — igual em todas as fases, então não precisa ser animada. */
export const WATER_AUTOTILE_INTERIOR_MASK = N | E | S | W;
/** Índices de `Beach animations tiles.png` que são AREIA lisa (não água) — o chão de areia da Praia é pintado com eles no editor. */
export const WATER_SAND_FILL_INDICES: readonly number[] = [waterFrame(12, 12), waterFrame(13, 12), waterFrame(14, 12)];

/**
 * Folha de props de decoração ambiente (pedras/cogumelos/flores/moitas/
 * tronco/trepadeira/parede de coral, pedido explícito — aba "Decoração" do
 * `MapEditorScene`, ver `data/mapProps.ts`): folha única com dezenas de
 * sprites de tamanhos bem diferentes, cada frame recortado pixel a pixel
 * (bounds confirmados por detecção de componentes conectados no canal
 * alpha, não estimados a olho — evita sprite cortado/deslocado). Puramente
 * decorativo, sem colisão nenhuma (pedido explícito).
 */
export const PROPS_TILESET_KEY = 'map-props';
export const PROPS_TILESET_PATH = 'Tileset/ALL props seasons.png';
