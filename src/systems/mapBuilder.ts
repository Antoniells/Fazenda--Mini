import Phaser from 'phaser';
import { BiomeId, BridgeDefinition, ExpansionChunk, ExpansionDirection, FarmMapData, getFarmlandFenceLayout } from '../data/maps/farmMap';
import {
  GRASS_TILESET_KEY,
  FENCE_TILESET_KEY,
  FENCE_CORNER_INDEX,
  FENCE_CORNER_BOTTOM_LEFT_INDEX,
  FENCE_CORNER_BOTTOM_RIGHT_INDEX,
  FENCE_EDGE_H_INDEX,
  FENCE_EDGE_V_INDEX,
  PINE_TREE_KEY,
  PINE_TREE_FRAME_NAME,
  SHIPPING_BIN_KEY,
  SHIPPING_BIN_FRAME_NAME,
  SHIPPING_BIN_FRAME,
  SHOP_STAND_KEY,
  CONSTRUCTION_SIGN_KEY,
  PLAYER_HOUSE_KEY,
  BRIDGE_KEY,
  BRIDGE_HORIZONTAL_FRAME,
  BRIDGE_VERTICAL_FRAME,
} from '../data/tiles';
import { createGroundShadow } from './shadow';
import { pickGroundTileVariant } from './groundVariation';
import { DirtZone, buildDirtZone, pickDirtBlobTile } from './dirtPaths';

/** Escala de exibição: cada tile de 16px é desenhado em 32px na tela. */
export const DISPLAY_SCALE = 2;

/**
 * Profundidade fixa das sombras de objetos estáticos (árvores, Caixa de
 * Remessas, Loja): acima do chão/solo (-1 / -0.5), abaixo de qualquer coisa
 * ordenada por Y (que começa em 0 pra cima) — sempre "no chão", nunca na
 * frente de nada. A sombra do personagem é diferente (acompanha o Y dele
 * dinamicamente, ver `entities/Player.ts`) porque ele se move.
 */
const STATIC_SHADOW_DEPTH = -0.4;

/** Coloca um único tile de cerca em (col, row), origem no canto superior esquerdo (igual ao tilemap de grama). */
function placeFenceTile(
  scene: Phaser.Scene,
  tile: number,
  col: number,
  row: number,
  frame: number,
  flipX = false,
  flipY = false,
): Phaser.GameObjects.Image {
  const image = scene.add.image(col * tile, row * tile, FENCE_TILESET_KEY, frame);
  image.setOrigin(0, 0);
  image.setScale(DISPLAY_SCALE);
  image.setFlip(flipX, flipY);
  return image;
}

/**
 * Tint (Fase 6.1 — Biomas) aplicado sobre o tile de grama de cada trecho de
 * expansão, já que ainda não temos tilesets próprios de areia/pedra/caverna
 * para cada bioma — separação visual provisória por cor, direto na camada
 * (`TilemapLayer.setTint`), sem desenhar nada via código (o tile em si
 * continua vindo do asset de grama). Núcleo e Madeireira ficam com a cor
 * natural do tileset (verde), sem tint.
 */
export const BIOME_TINTS: Partial<Record<BiomeId, number>> = {
  // Tints em multiply escurecem/saturam a base verde da grama (não
  // clareiam) — por isso a Praia usa um tom terroso mais forte (não um
  // areia claro quase branco, que multiply mal altera) pra ficar
  // perceptível como região distinta; confirmado visualmente no navegador.
  beach: 0xe0a85c,
  mining: 0xaaaaaa,
  cave: 0x555566,
};

/**
 * Constrói uma camada de grama retangular em qualquer posição do mundo
 * (`originCol`/`originRow` podem ser negativos) — reaproveitada tanto para
 * o núcleo da propriedade quanto para cada trecho de expansão
 * (`farmMap.expansions`), que já nascem cobertos de grama mesmo antes de
 * comprados (ver `MainScene.create`).
 *
 * Cada célula usa `pickGroundTileVariant` (com coordenadas ABSOLUTAS do
 * mundo, não relativas a este trecho) para decidir sua variante visual —
 * melhoria de QoL visual (Fase 9) pra reduzir a repetição perceptível do
 * mesmo tile, sem afetar grid/colisão/área cultivável. Se `dirtZone` for
 * passado (só o núcleo tem, ver `buildFarmGround`), as células que fazem
 * parte do caminho/manchas de terra (`systems/dirtPaths.ts`) substituem a
 * grama pelo tile de terra correto (canto/borda/preenchimento), escolhido
 * a partir dos vizinhos — mesmo depois de montado o `groundData` base.
 */
export function buildGroundChunk(
  scene: Phaser.Scene,
  tileSize: number,
  originCol: number,
  originRow: number,
  cols: number,
  rows: number,
  dirtZone?: DirtZone,
  tint?: number,
): Phaser.Tilemaps.TilemapLayer {
  const groundData: number[][] = [];

  for (let row = 0; row < rows; row++) {
    const dataRow: number[] = [];
    for (let col = 0; col < cols; col++) {
      const worldCol = originCol + col;
      const worldRow = originRow + row;
      const tileIndex = dirtZone?.has(worldCol, worldRow)
        ? pickDirtBlobTile(dirtZone, worldCol, worldRow)
        : pickGroundTileVariant(worldCol, worldRow);
      dataRow.push(tileIndex);
    }
    groundData.push(dataRow);
  }

  const tilemap = scene.make.tilemap({
    data: groundData,
    tileWidth: tileSize,
    tileHeight: tileSize,
  });

  const tileset = tilemap.addTilesetImage(GRASS_TILESET_KEY, GRASS_TILESET_KEY, tileSize, tileSize);
  if (!tileset) {
    throw new Error('Não foi possível carregar o tileset de grama.');
  }

  const tile = tileSize * DISPLAY_SCALE;
  const layer = tilemap.createLayer(0, tileset, originCol * tile, originRow * tile) as Phaser.Tilemaps.TilemapLayer;
  layer.setScale(DISPLAY_SCALE);
  // Sempre atrás de qualquer elemento ordenado por profundidade (árvores, personagem).
  layer.setDepth(-1);
  if (tint !== undefined) layer.setTint(tint);

  return layer;
}

/**
 * Constrói a camada de grama do núcleo da propriedade (`map.cols` x
 * `map.rows`, a partir de (0,0)) — o único chunk que recebe o caminho de
 * terra (`buildDirtZone`), já que ele liga casa/lavoura/loja, todos dentro
 * do núcleo.
 */
export function buildFarmGround(scene: Phaser.Scene, map: FarmMapData): Phaser.Tilemaps.TilemapLayer {
  return buildGroundChunk(scene, map.tileSize, 0, 0, map.cols, map.rows, buildDirtZone(map));
}

/**
 * Desenha só os 4 postes de canto do núcleo da propriedade — permanentes,
 * nunca removidos (mesmo depois de expandir os 2 lados que se encontram
 * naquele canto): funcionam como marcos decorativos da propriedade
 * original, evitando a complexidade de fundir cantos quando as duas
 * paredes adjacentes são compradas em momentos diferentes.
 */
export function buildFenceCorners(scene: Phaser.Scene, map: FarmMapData): void {
  const tile = map.tileSize * DISPLAY_SCALE;
  const { cols, rows } = map;

  placeFenceTile(scene, tile, 0, 0, FENCE_CORNER_INDEX);
  placeFenceTile(scene, tile, cols - 1, 0, FENCE_CORNER_INDEX, true, false);
  placeFenceTile(scene, tile, 0, rows - 1, FENCE_CORNER_BOTTOM_LEFT_INDEX);
  placeFenceTile(scene, tile, cols - 1, rows - 1, FENCE_CORNER_BOTTOM_RIGHT_INDEX);
}

/**
 * Desenha a parede reta de UM lado do núcleo (sem os cantos, permanentes —
 * ver `buildFenceCorners`) — a "cerca temporária" desse lado até a
 * expansão correspondente (`farmMap.expansions`) ser comprada, quando
 * desaparece (`MainScene.buyExpansion`). Por isso devolve as imagens
 * criadas, em vez de só desenhá-las.
 */
export function buildFenceSide(scene: Phaser.Scene, map: FarmMapData, direction: ExpansionDirection): Phaser.GameObjects.Image[] {
  const tile = map.tileSize * DISPLAY_SCALE;
  const { cols, rows } = map;
  const images: Phaser.GameObjects.Image[] = [];

  if (direction === 'north') {
    for (let col = 1; col < cols - 1; col++) images.push(placeFenceTile(scene, tile, col, 0, FENCE_EDGE_H_INDEX));
  } else if (direction === 'south') {
    for (let col = 1; col < cols - 1; col++) images.push(placeFenceTile(scene, tile, col, rows - 1, FENCE_EDGE_H_INDEX));
  } else if (direction === 'west') {
    for (let row = 1; row < rows - 1; row++) images.push(placeFenceTile(scene, tile, 0, row, FENCE_EDGE_V_INDEX));
  } else {
    for (let row = 1; row < rows - 1; row++) images.push(placeFenceTile(scene, tile, cols - 1, row, FENCE_EDGE_V_INDEX));
  }

  return images;
}

/**
 * Desenha o perímetro externo PERMANENTE de um trecho de expansão — os 3
 * lados que não fazem fronteira com o núcleo (esse lado fica aberto, sem
 * cerca, unindo o trecho ao núcleo assim que a parede dele for removida).
 * Diferente da cerca do núcleo, esta nunca é removida — é o novo limite
 * final da propriedade nessa direção.
 */
export function buildExpansionChunkFence(scene: Phaser.Scene, tileSize: number, chunk: ExpansionChunk): void {
  const tile = tileSize * DISPLAY_SCALE;
  const { direction, col0, row0, cols, rows } = chunk;
  const colEnd = col0 + cols - 1;
  const rowEnd = row0 + rows - 1;

  if (direction === 'east') {
    // Lado compartilhado com o núcleo: oeste (col0) — fica aberto.
    for (let col = col0; col < colEnd; col++) placeFenceTile(scene, tile, col, row0, FENCE_EDGE_H_INDEX);
    for (let col = col0; col < colEnd; col++) placeFenceTile(scene, tile, col, rowEnd, FENCE_EDGE_H_INDEX);
    for (let row = row0 + 1; row < rowEnd; row++) placeFenceTile(scene, tile, colEnd, row, FENCE_EDGE_V_INDEX);
    placeFenceTile(scene, tile, colEnd, row0, FENCE_CORNER_INDEX, true, false);
    placeFenceTile(scene, tile, colEnd, rowEnd, FENCE_CORNER_BOTTOM_RIGHT_INDEX);
  } else if (direction === 'west') {
    // Lado compartilhado com o núcleo: leste (colEnd) — fica aberto.
    for (let col = col0 + 1; col <= colEnd; col++) placeFenceTile(scene, tile, col, row0, FENCE_EDGE_H_INDEX);
    for (let col = col0 + 1; col <= colEnd; col++) placeFenceTile(scene, tile, col, rowEnd, FENCE_EDGE_H_INDEX);
    for (let row = row0 + 1; row < rowEnd; row++) placeFenceTile(scene, tile, col0, row, FENCE_EDGE_V_INDEX);
    placeFenceTile(scene, tile, col0, row0, FENCE_CORNER_INDEX);
    placeFenceTile(scene, tile, col0, rowEnd, FENCE_CORNER_BOTTOM_LEFT_INDEX);
  } else if (direction === 'north') {
    // Lado compartilhado com o núcleo: sul (rowEnd) — fica aberto.
    for (let col = col0 + 1; col < colEnd; col++) placeFenceTile(scene, tile, col, row0, FENCE_EDGE_H_INDEX);
    for (let row = row0; row < rowEnd; row++) placeFenceTile(scene, tile, col0, row, FENCE_EDGE_V_INDEX);
    for (let row = row0; row < rowEnd; row++) placeFenceTile(scene, tile, colEnd, row, FENCE_EDGE_V_INDEX);
    placeFenceTile(scene, tile, col0, row0, FENCE_CORNER_INDEX);
    placeFenceTile(scene, tile, colEnd, row0, FENCE_CORNER_INDEX, true, false);
  } else {
    // south — lado compartilhado com o núcleo: norte (row0) — fica aberto.
    for (let col = col0 + 1; col < colEnd; col++) placeFenceTile(scene, tile, col, rowEnd, FENCE_EDGE_H_INDEX);
    for (let row = row0 + 1; row <= rowEnd; row++) placeFenceTile(scene, tile, col0, row, FENCE_EDGE_V_INDEX);
    for (let row = row0 + 1; row <= rowEnd; row++) placeFenceTile(scene, tile, colEnd, row, FENCE_EDGE_V_INDEX);
    placeFenceTile(scene, tile, col0, rowEnd, FENCE_CORNER_BOTTOM_LEFT_INDEX);
    placeFenceTile(scene, tile, colEnd, rowEnd, FENCE_CORNER_BOTTOM_RIGHT_INDEX);
  }
}

/**
 * Placa de "obra em andamento" (Fase 6 — Expansão): marca onde fica cada
 * trecho comprável, reaproveitando `Objects/Exterior/Construction area.png`
 * (caixa de ferramentas + capacete) — não é uma placa de verdade, mas é o
 * objeto mais próximo disso no pacote de assets, e a ideia de "terreno em
 * obras, aguardando liberação" combina com o que ele representa aqui.
 */
export function buildConstructionSign(scene: Phaser.Scene, tileSize: number, col: number, row: number): Phaser.GameObjects.Image {
  const tile = tileSize * DISPLAY_SCALE;
  const x = col * tile + tile / 2;
  const y = (row + 1) * tile;

  const shadow = createGroundShadow(scene, x, y, DISPLAY_SCALE * 1.3, DISPLAY_SCALE * 0.5);
  shadow.setDepth(STATIC_SHADOW_DEPTH);

  const sign = scene.add.image(x, y, CONSTRUCTION_SIGN_KEY);
  sign.setOrigin(0.5, 1);
  sign.setScale(DISPLAY_SCALE * 0.5);
  sign.setDepth(sign.y);

  return sign;
}

/**
 * Profundidade fixa da ponte: acima dos tiles de cerca (`placeFenceTile`,
 * sem `setDepth` — ficam no `depth` 0 padrão), abaixo de qualquer objeto
 * ordenado por Y (jogador, árvores, placas), que começam bem mais alto
 * (`(row+1)*tile`, no mínimo ~32). Precisa ficar ACIMA da cerca (não junto
 * dela) pra cobrir visualmente os tiles de cerca da própria célula —
 * ver `buildBridge`.
 */
const BRIDGE_DEPTH = 1;

/**
 * Desenha a ponte de transição de cena (`farmMap.bridges`) na célula
 * definida — sobre a parede do núcleo, cobrindo os tiles de cerca dali
 * (`BRIDGE_DEPTH` acima deles). Usa a variante VERTICAL do asset (corrimãos
 * nas laterais, tabuleiro de cima a baixo — pra atravessar andando na
 * vertical) nas paredes norte/sul, e a HORIZONTAL (corrimãos em cima/embaixo,
 * tabuleiro de um lado a outro — pra atravessar andando na horizontal) em
 * leste/oeste — confirmado visualmente no asset (`Bridge.png`), corrigindo
 * bug relatado de orientação trocada. Objeto plano de chão (como a própria
 * cerca), por isso `origin(0.5, 0.5)` centralizado na célula, e não
 * `origin(0.5, 1)` como objetos "em pé" (placas, árvores).
 */
export function buildBridge(scene: Phaser.Scene, tileSize: number, bridge: BridgeDefinition): Phaser.GameObjects.Image {
  const tile = tileSize * DISPLAY_SCALE;
  const isVerticalCrossing = bridge.direction === 'north' || bridge.direction === 'south';
  const frame = isVerticalCrossing ? BRIDGE_VERTICAL_FRAME : BRIDGE_HORIZONTAL_FRAME;

  const texture = scene.textures.get(BRIDGE_KEY);
  if (!texture.has(frame.name)) {
    texture.add(frame.name, 0, frame.rect.x, frame.rect.y, frame.rect.width, frame.rect.height);
  }

  const x = bridge.col * tile + tile / 2;
  const y = bridge.row * tile + tile / 2;

  const image = scene.add.image(x, y, BRIDGE_KEY, frame.name);
  image.setOrigin(0.5, 0.5);
  image.setScale(DISPLAY_SCALE);
  image.setDepth(BRIDGE_DEPTH);

  return image;
}

/**
 * Desenha as árvores decorativas definidas em `farmMap.treePositions` e
 * retorna os game objects criados, para que a cena possa usá-los no sistema
 * de sobreposição de profundidade (`systems/treeOverlap`).
 */
export function buildFarmDecorations(
  scene: Phaser.Scene,
  map: FarmMapData,
): Phaser.GameObjects.Image[] {
  const tile = map.tileSize * DISPLAY_SCALE;
  const trees: Phaser.GameObjects.Image[] = [];

  for (const [col, row] of map.treePositions) {
    const x = col * tile + tile / 2;
    const y = (row + 1) * tile;

    const shadow = createGroundShadow(scene, x, y, DISPLAY_SCALE * 1.5, DISPLAY_SCALE * 0.6);
    shadow.setDepth(STATIC_SHADOW_DEPTH);

    const tree = scene.add.image(x, y + 6, PINE_TREE_KEY, PINE_TREE_FRAME_NAME);
    tree.setOrigin(0.5, 1);
    tree.setScale(DISPLAY_SCALE);
    // Profundidade fixa baseada no Y da base da árvore, para ordenar contra
    // o personagem (que tem profundidade dinâmica igual ao seu próprio Y).
    tree.setDepth(tree.y);
    trees.push(tree);
  }

  return trees;
}

/**
 * Desenha a Caixa de Remessas (ponto de venda da Fase 5) na posição
 * definida em `farmMap.shippingBinPosition`. É um objeto sólido e estático
 * (sem animação — só o frame fechado de `shipping box.png`, ver
 * `data/tiles.ts`); a célula correspondente é bloqueada em
 * `systems/grid.ts`, então o jogador não pisa nela, só interage encostado
 * (ver `PlayerController`).
 *
 * Profundidade fixa pelo Y da base, mesma técnica das árvores
 * (`buildFarmDecorations`): como a caixa nunca muda de posição, o resultado
 * é idêntico a recalcular a cada frame, sem o custo de fazer isso
 * 60x/segundo para algo que não se move.
 */
export function buildShippingBin(scene: Phaser.Scene, map: FarmMapData): Phaser.GameObjects.Image {
  const tile = map.tileSize * DISPLAY_SCALE;
  const [col, row] = map.shippingBinPosition;

  const texture = scene.textures.get(SHIPPING_BIN_KEY);
  if (!texture.has(SHIPPING_BIN_FRAME_NAME)) {
    texture.add(
      SHIPPING_BIN_FRAME_NAME,
      0,
      SHIPPING_BIN_FRAME.x,
      SHIPPING_BIN_FRAME.y,
      SHIPPING_BIN_FRAME.width,
      SHIPPING_BIN_FRAME.height,
    );
  }

  const x = col * tile + tile / 2;
  const y = (row + 1) * tile;

  const shadow = createGroundShadow(scene, x, y, DISPLAY_SCALE * 1.0, DISPLAY_SCALE * 0.45);
  shadow.setDepth(STATIC_SHADOW_DEPTH);

  const bin = scene.add.image(x, y, SHIPPING_BIN_KEY, SHIPPING_BIN_FRAME_NAME);
  bin.setOrigin(0.5, 1);
  bin.setScale(DISPLAY_SCALE);
  bin.setDepth(bin.y);

  return bin;
}

/**
 * Desenha a banca da Loja (Fase 5) na posição definida em
 * `farmMap.shopPosition`. `Newsstand.png` já é uma única imagem completa
 * (sem frames para recortar, ao contrário da Caixa de Remessas). Mesma
 * técnica de profundidade fixa das árvores e da Caixa de Remessas — objeto
 * estático, não precisa recalcular a cada frame.
 */
export function buildShopStand(scene: Phaser.Scene, map: FarmMapData): Phaser.GameObjects.Image {
  const tile = map.tileSize * DISPLAY_SCALE;
  const [col, row] = map.shopPosition;

  const x = col * tile + tile / 2;
  const y = (row + 1) * tile;

  // Removida a linha da sombra aqui

  const stand = scene.add.image(x, y, SHOP_STAND_KEY);
  stand.setOrigin(0.5, 1);
  stand.setScale(DISPLAY_SCALE);
  stand.setDepth(stand.y-10);

  return stand;
}

/**
 * Desenha a Casa do jogador (Fase 9) na área definida em
 * `farmMap.housePosition`. `Houses/3.png` já é exatamente 8x7 tiles de
 * 16px (128x112, sem sobra) — ao contrário dos outros objetos estáticos
 * (âncora única + origem inferior-central), aqui a imagem inteira é
 * posicionada com origem no canto superior-esquerdo, igual à camada de
 * grama, porque cobre várias células por inteiro, não uma "base" de 1
 * célula com altura visual maior.
 */
export function buildPlayerHouse(scene: Phaser.Scene, map: FarmMapData): Phaser.GameObjects.Image {
  const tile = map.tileSize * DISPLAY_SCALE;
  const { col0, row0, rows } = map.housePosition;

  const house = scene.add.image(col0 * tile, row0 * tile, PLAYER_HOUSE_KEY);
  house.setOrigin(0, 0);
  house.setScale(DISPLAY_SCALE);
  // Profundidade fixa pela base (linha de baixo) da casa — mesma lógica das
  // árvores/Caixa de Remessas, só que calculada a partir do retângulo
  // inteiro, não de uma única célula-âncora.
  house.setDepth((row0 + rows) * tile);

  return house;
}

/**
 * Desenha a cerca ao redor de todo o retângulo que contém
 * `farmMap.farmlandArea` (Fase 9), uma célula fora dela — com colisão de
 * verdade no grid (ver `systems/grid.ts`), exceto no portão (a única
 * abertura, alinhada com a porta de casa). Geometria vem de
 * `getFarmlandFenceLayout` — a MESMA fonte usada pelo grid, pra nunca
 * desenhar cerca sem colisão ou vice-versa. Reaproveita o mesmo tileset e o
 * mesmo padrão de cantos/bordas já usados na cerca do núcleo da propriedade
 * (`buildFenceCorners`/`buildFenceSide`).
 *
 * Também pula a célula da Caixa de Remessas, que fica colada nessa borda
 * (posição escolhida em `farmMap.ts`) — puramente pra não desenhar uma
 * cerca por cima do sprite dela (a colisão ali já vem da própria caixa).
 */
export function buildFarmlandFence(scene: Phaser.Scene, map: FarmMapData): void {
  const tile = map.tileSize * DISPLAY_SCALE;
  const { col0, row0, colEnd, rowEnd, gate } = getFarmlandFenceLayout(map);

  const skip = new Set<string>([
    `${gate[0]},${gate[1]}`,
    `${map.shippingBinPosition[0]},${map.shippingBinPosition[1]}`,
  ]);

  const place = (col: number, row: number, frame: number, flipX = false, flipY = false): void => {
    if (skip.has(`${col},${row}`)) return;
    const image = placeFenceTile(scene, tile, col, row, frame, flipX, flipY);
    // Profundidade pela base da célula — mesma convenção das árvores/Casa,
    // pro jogador poder passar na frente ou atrás da cerca corretamente.
    image.setDepth((row + 1) * tile);
  };

  place(col0, row0, FENCE_CORNER_INDEX);
  place(colEnd, row0, FENCE_CORNER_INDEX, true, false);
  place(col0, rowEnd, FENCE_CORNER_BOTTOM_LEFT_INDEX);
  place(colEnd, rowEnd, FENCE_CORNER_BOTTOM_RIGHT_INDEX);

  for (let col = col0 + 1; col < colEnd; col++) {
    place(col, row0, FENCE_EDGE_H_INDEX);
    place(col, rowEnd, FENCE_EDGE_H_INDEX);
  }
  for (let row = row0 + 1; row < rowEnd; row++) {
    place(col0, row, FENCE_EDGE_V_INDEX);
    place(colEnd, row, FENCE_EDGE_V_INDEX);
  }
}
