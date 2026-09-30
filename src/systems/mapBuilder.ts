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
  CONSTRUCTION_SIGN_KEY,
  BRIDGE_KEY,
  BRIDGE_HORIZONTAL_FRAME,
  BRIDGE_VERTICAL_WALL_TILE_FRAME,
  BRIDGE_VERTICAL_POST_FRAME,
} from '../data/tiles';
import { currentHouseLevel, fenceSkin } from './upgradeLevels';
import { addBuildingShadows, createGroundShadow } from './shadow';
import { pickGroundTileVariant } from './groundVariation';
import { DirtZone, buildDirtZone, pickDirtBlobTile } from './dirtPaths';
import { GROUND_TILESETS } from './groundTilesets';
import { buildWaterAutotile } from './waterAutotile';
import type { WaterStyleId } from '../data/tiles';

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
  textureKey: string = FENCE_TILESET_KEY,
): Phaser.GameObjects.Image {
  const image = scene.add.image(col * tile, row * tile, textureKey, frame);
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
  // Só a Mineração ainda usa tint (multiply escurece a base verde da grama). Praia e Caverna NÃO têm mais: o filtro escurecia a arte
  // dos mapas deles (pedido explícito) — o chão dessas áreas mostra as cores naturais dos tilesets.
  mining: 0xaaaaaa,
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
/**
 * Chão AUTORADO no `MapEditorScene` (`XMapData.ground`, GID por célula) —
 * usado célula a célula com `putTileAt`, em vez de gerar proceduralmente.
 * Registra os 3 tilesets que o editor pode pintar (`systems/groundTilesets`,
 * a MESMA fonte de GID que o editor usa), pra um GID de qualquer um deles
 * renderizar certo aqui — não só grama.
 */
function buildAuthoredGroundChunk(
  scene: Phaser.Scene,
  tileSize: number,
  originCol: number,
  originRow: number,
  cols: number,
  rows: number,
  authoredGround: number[][],
  tint?: number,
  waterStyle?: WaterStyleId,
): Phaser.Tilemaps.TilemapLayer {
  const tilemap = scene.make.tilemap({ tileWidth: tileSize, tileHeight: tileSize, width: cols, height: rows });
  const tilesets = GROUND_TILESETS.map((ts) => tilemap.addTilesetImage(ts.textureKey, ts.textureKey, tileSize, tileSize, 0, 0, ts.firstGid)).filter(
    (tileset): tileset is Phaser.Tilemaps.Tileset => tileset !== null,
  );
  if (tilesets.length === 0) {
    throw new Error('Não foi possível carregar nenhum tileset de chão.');
  }

  const tile = tileSize * DISPLAY_SCALE;
  const layer = tilemap.createBlankLayer('ground', tilesets, originCol * tile, originRow * tile) as Phaser.Tilemaps.TilemapLayer;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const gid = authoredGround[row]?.[col];
      if (gid !== undefined) layer.putTileAt(gid, col, row);
    }
  }

  layer.setScale(DISPLAY_SCALE);
  layer.setDepth(-1);
  if (tint !== undefined) layer.setTint(tint);

  // Água: as células pintadas com água (lago/mar) ganham o autotile animado por cima do chão — bordas
  // escolhidas pelos vizinhos, não pelo tile que foi pintado à mão (ver `systems/waterAutotile.ts`).
  buildWaterAutotile(scene, tileSize, DISPLAY_SCALE, originCol, originRow, authoredGround, waterStyle);

  return layer;
}

/**
 * `authoredGround` (opcional — `XMapData.ground`, autorado no
 * `MapEditorScene`): quando presente, o chão é pintado EXATAMENTE com esses
 * GIDs, célula a célula (`buildAuthoredGroundChunk`), e o resto desta
 * função (variação procedural, `dirtZone`) nem roda. Sem ele, continua o
 * método procedural de sempre — nenhum mapa existente sem `ground` muda de
 * comportamento.
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
  authoredGround?: number[][],
  waterStyle?: WaterStyleId,
): Phaser.Tilemaps.TilemapLayer {
  if (authoredGround) {
    return buildAuthoredGroundChunk(scene, tileSize, originCol, originRow, cols, rows, authoredGround, tint, waterStyle);
  }

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
 * Constrói a camada de chão do núcleo da propriedade (`map.cols` x
 * `map.rows`, a partir de (0,0)). Se `map.ground` existir (autorado no
 * `MapEditorScene`), usa ele célula a célula; senão, gera proceduralmente
 * como sempre — o único chunk que recebe o caminho de terra (`buildDirtZone`)
 * nesse caso, já que ele liga casa/lavoura/loja, todos dentro do núcleo.
 */
export function buildFarmGround(scene: Phaser.Scene, map: FarmMapData): Phaser.Tilemaps.TilemapLayer {
  return buildGroundChunk(scene, map.tileSize, 0, 0, map.cols, map.rows, buildDirtZone(map), undefined, map.ground);
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
 * Escala da placa de "obra" nas pontes bloqueadas (ver `buildConstructionSign`).
 * `Objects/Exterior/Construction area.png` (112x48) não é um ícone pequeno —
 * é uma barricada de madeira inteira, mais larga que a própria ponte na
 * escala padrão (`DISPLAY_SCALE * 0.5`, confirmado visualmente: sobrava dos
 * dois lados da ponte VERTICAL, 96px de largura, criando um "muro" torto).
 * Reduzida pra caber dentro da largura da ponte mais estreita.
 */
const CONSTRUCTION_SIGN_SCALE = 0.7;

/**
 * Placa de "obra em andamento" nas pontes bloqueadas (`BridgeSystem`),
 * reaproveitando `Objects/Exterior/Construction area.png` (barricada de
 * madeira com aviso de capacete/chave inglesa) — não é uma placa de
 * verdade, mas é o objeto mais próximo disso no pacote de assets, e a ideia
 * de "travessia interditada, obra em andamento" combina com o requisito de
 * pagar pra desbloquear. Centralizada exatamente sobre a ponte (mesma
 * âncora dela — `origin(0.5,0.5)`), em vez de "em pé" na célula como um
 * objeto comum: colocada como um objeto normal (âncora na base), a
 * barricada ficava mais larga que a ponte e desalinhada verticalmente com
 * ela, parecendo dois "muros" atravessados um no outro.
 */
export function buildConstructionSign(scene: Phaser.Scene, tileSize: number, col: number, row: number): Phaser.GameObjects.Image {
  const tile = tileSize * DISPLAY_SCALE;
  const x = col * tile + tile / 2;
  const y = row * tile + tile / 2;

  const sign = scene.add.image(x, y, CONSTRUCTION_SIGN_KEY);
  sign.setOrigin(0.5, 0.5);
  sign.setScale(CONSTRUCTION_SIGN_SCALE);
  // Acima da ponte (depth fixo BRIDGE_DEPTH=1, ver `buildBridge`) — qualquer
  // valor de profundidade "normal" (y de um objeto de mundo, sempre bem
  // maior que 1) já garante isso, sem precisar reordenar em relação ao
  // personagem (a célula da ponte é sempre bloqueada, ninguém pisa nela).
  sign.setDepth(y + 0.5);

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

function registerBridgeFrame(texture: Phaser.Textures.Texture, frame: { name: string; rect: { x: number; y: number; width: number; height: number } }): void {
  if (texture.has(frame.name)) return;
  const { name, rect } = frame;
  texture.add(name, 0, rect.x, rect.y, rect.width, rect.height);
}

/** Largura total (px nativos) da parede norte/sul montada em `buildVerticalBridge` — mesma largura de `BRIDGE_VERTICAL_FRAME` original (48), só que sem nenhum poste embutido nela. */
const BRIDGE_VERTICAL_WALL_WIDTH = 48;
/**
 * Offset (px nativos, a partir do centro) de cada poste. O direito fica
 * onde já estava originalmente (perto da borda, 21.5px do centro — ver
 * comentário de `BRIDGE_VERTICAL_POST_FRAME` em `data/tiles.ts`); o esquerdo
 * agora é colocado na posição espelhada, encostado na borda esquerda
 * também — pedido explícito do usuário ("mova até a borda da ponte").
 */
const BRIDGE_VERTICAL_RIGHT_POST_OFFSET = 21.5;
const BRIDGE_VERTICAL_LEFT_POST_OFFSET = -BRIDGE_VERTICAL_RIGHT_POST_OFFSET;

/**
 * Parede norte/sul (Fase 9 — polimento): montada a partir de 2 peças, não
 * de um recorte único como `BRIDGE_HORIZONTAL_FRAME` — ver o comentário de
 * `BRIDGE_VERTICAL_WALL_TILE_FRAME`/`BRIDGE_VERTICAL_POST_FRAME` em
 * `data/tiles.ts` pra entender por quê (o recorte único original tinha os
 * 2 postes de reforço quase colados um no outro, perto do centro, e
 * qualquer tentativa de "remendar"/mover um deles por cima deixava emenda
 * visível na grade de juntas da madeira). Um `TileSprite` de 4px repete a
 * ripa lisa (sem poste) pela largura toda sem nenhuma emenda por
 * construção; os 2 postes são desenhados por cima, cada um na sua própria
 * posição, sem nenhum vínculo um com o outro.
 */
function buildVerticalBridgeWall(scene: Phaser.Scene, x: number, y: number): void {
  const texture = scene.textures.get(BRIDGE_KEY);
  registerBridgeFrame(texture, BRIDGE_VERTICAL_WALL_TILE_FRAME);
  registerBridgeFrame(texture, BRIDGE_VERTICAL_POST_FRAME);

  const wallWidthPx = BRIDGE_VERTICAL_WALL_WIDTH * DISPLAY_SCALE;
  const wallHeightPx = BRIDGE_VERTICAL_WALL_TILE_FRAME.rect.height * DISPLAY_SCALE;
  const wall = scene.add.tileSprite(x, y, wallWidthPx, wallHeightPx, BRIDGE_KEY, BRIDGE_VERTICAL_WALL_TILE_FRAME.name);
  wall.setOrigin(0.5, 0.5);
  wall.setTileScale(DISPLAY_SCALE, DISPLAY_SCALE);
  wall.setDepth(BRIDGE_DEPTH);

  for (const offset of [BRIDGE_VERTICAL_LEFT_POST_OFFSET, BRIDGE_VERTICAL_RIGHT_POST_OFFSET]) {
    const post = scene.add.image(x + offset * DISPLAY_SCALE, y, BRIDGE_KEY, BRIDGE_VERTICAL_POST_FRAME.name);
    post.setOrigin(0.5, 0.5);
    post.setScale(DISPLAY_SCALE);
    post.setDepth(BRIDGE_DEPTH + 0.1);
  }
}

/**
 * Desenha a ponte de transição de cena (`farmMap.bridges`) na célula
 * definida — sobre a parede do núcleo, cobrindo os tiles de cerca dali
 * (`BRIDGE_DEPTH` acima deles). Norte/sul montam a própria parede em
 * `buildVerticalBridgeWall` (ripas finas de madeira, corrimão mais
 * discreto — pedido explícito do usuário, preferido à alvenaria grossa).
 * Leste/oeste usam `BRIDGE_HORIZONTAL_FRAME` (alvenaria, aprovado como
 * está) — um recorte único de verdade, sem o problema de postes
 * desalinhados. Objeto plano de chão (como a própria cerca), por isso
 * `origin(0.5, 0.5)` centralizado na célula, e não `origin(0.5, 1)` como
 * objetos "em pé" (placas, árvores).
 */
export function buildBridge(scene: Phaser.Scene, tileSize: number, bridge: BridgeDefinition): void {
  const tile = tileSize * DISPLAY_SCALE;
  const isVerticalCrossing = bridge.direction === 'north' || bridge.direction === 'south';

  const x = bridge.col * tile + tile / 2;
  const y = bridge.row * tile + tile / 2;

  if (isVerticalCrossing) {
    buildVerticalBridgeWall(scene, x, y);
    return;
  }

  const texture = scene.textures.get(BRIDGE_KEY);
  registerBridgeFrame(texture, BRIDGE_HORIZONTAL_FRAME);

  const image = scene.add.image(x, y, BRIDGE_KEY, BRIDGE_HORIZONTAL_FRAME.name);
  image.setOrigin(0.5, 0.5);
  image.setScale(DISPLAY_SCALE);
  image.setDepth(BRIDGE_DEPTH);
}

/**
 * Células (col, row) dos corrimões laterais de uma ponte — bloqueadas no
 * `WalkableGrid` pra criar um "túnel" invisível, só a célula central
 * (`bridge.col`/`bridge.row`, já tratada à parte por quem chama) fica
 * andável (pedido explícito do usuário: a arte da ponte é mais larga que 1
 * tile, o jogador não pode andar por cima do corrimão nem sair pela
 * lateral). Medido pixel a pixel ao vivo (recorte/zoom + overlay de grid,
 * ponte destravada): a arte sempre cobre exatamente 1 célula de cada lado
 * do trecho que fica DENTRO do núcleo (o lado que fica fora do núcleo não
 * importa pra colisão — vira outra cena).
 *
 * Norte/sul (`buildVerticalBridgeWall`, corrimão de ripas): o painel cobre
 * 3 colunas (`col-1..col+1`) e ~1 célula pra dentro do núcleo além da
 * própria borda (que já é bloqueada por inteiro) — daí bloquear
 * `col-1`/`col+1` na linha logo depois da borda.
 *
 * Leste/oeste (`BRIDGE_HORIZONTAL_FRAME`, alvenaria): o mesmo raciocínio,
 * só que girado 90° — o painel cobre 3 linhas (`row-1..row+1`) e ~1 célula
 * pra dentro do núcleo além da própria borda, daí bloquear `row-1`/`row+1`
 * na coluna logo depois da borda.
 */
export function bridgeRailingCells(bridge: BridgeDefinition): Array<[number, number]> {
  const isVerticalCrossing = bridge.direction === 'north' || bridge.direction === 'south';
  // Passo (em células) da borda pra DENTRO do núcleo — norte/oeste entram
  // em coordenadas crescentes, sul/leste em decrescentes.
  const interiorStep = bridge.direction === 'north' || bridge.direction === 'west' ? 1 : -1;

  // Pontes Norte/Sul continuam com 2 blocos de colisão por lado
  if (isVerticalCrossing) {
    const rowInner = bridge.row + interiorStep;
    const rowWall = bridge.row; 
    
    return [
      [bridge.col - 1, rowWall],  [bridge.col + 1, rowWall],
      [bridge.col - 1, rowInner], [bridge.col + 1, rowInner]
    ];
  }

  // Pontes Leste/Oeste (Esquerda/Direita) ganham 3 blocos de colisão por lado
  const colWall = bridge.col; 
  const colInner1 = bridge.col + interiorStep;
  const colInner2 = bridge.col + (interiorStep * 2); // <- Os novos quadradinhos!
  
  return [
    [colWall, bridge.row - 1],   [colWall, bridge.row + 1],  
    [colInner1, bridge.row - 1], [colInner1, bridge.row + 1], 
    [colInner2, bridge.row - 1], [colInner2, bridge.row + 1]  
  ];
}

/**
 * Células (col, row) do corredor andável de uma ponte — o trecho ENTRE os
 * corrimões de `bridgeRailingCells` (a célula da própria ponte + as de dentro
 * do núcleo cobertas pela arte). Nada de decoração solta (tufo/cogumelo do
 * `buildWildFoliage`) deve nascer aí: ficaria por cima da ponte.
 */
export function bridgeWalkwayCells(bridge: BridgeDefinition): Array<[number, number]> {
  const isVerticalCrossing = bridge.direction === 'north' || bridge.direction === 'south';
  const interiorStep = bridge.direction === 'north' || bridge.direction === 'west' ? 1 : -1;

  if (isVerticalCrossing) return [[bridge.col, bridge.row], [bridge.col, bridge.row + interiorStep]];
  return [[bridge.col, bridge.row], [bridge.col + interiorStep, bridge.row], [bridge.col + interiorStep * 2, bridge.row]];
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

    const shadow = createGroundShadow(scene, x, y - 6, DISPLAY_SCALE * 1.5, DISPLAY_SCALE * 0.6);
    shadow.setDepth(STATIC_SHADOW_DEPTH);

    const tree = scene.add.image(x, y, PINE_TREE_KEY, PINE_TREE_FRAME_NAME);
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
  const { col0, row0 } = map.housePosition;
  const level = currentHouseLevel();

  // A arte do nível atual (`data/houseLevels.ts`); a do meio é um recorte da folha `Upgrade House.png`.
  if (level.frame) {
    const texture = scene.textures.get(level.textureKey);
    const { name, rect } = level.frame;
    if (!texture.has(name)) texture.add(name, 0, rect.x, rect.y, rect.width, rect.height);
  }
  const house = scene.add.image(col0 * tile + level.offset.x, row0 * tile + level.offset.y, level.textureKey, level.frame?.name);
  house.setOrigin(0, 0);
  house.setScale(DISPLAY_SCALE);
  // Profundidade na última fileira sólida da arte (o jogador passa atrás do telhado e na frente da porta).
  const lastSolidRow = level.solid.reduce((last, line, index) => (line.includes('#') ? index : last), 0);
  house.setDepth((row0 + lastSolidRow) * tile);

  // Sombras retas coladas na base da parede (a arte tem a ala do fundo mais recuada: uma faixa por trecho de base).
  addBuildingShadows(scene, house);

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
export function buildFarmlandFence(scene: Phaser.Scene, map: FarmMapData): Map<string, Phaser.GameObjects.Image> {
  const images = new Map<string, Phaser.GameObjects.Image>();
  const tile = map.tileSize * DISPLAY_SCALE;
  const { col0, row0, colEnd, rowEnd, gate } = getFarmlandFenceLayout(map);

const skip = new Set<string>([
    `${gate[0]},${gate[1]}`,
    `${gate[0] - 1},${gate[1]}`, // <-- Novo bloco pulado (à esquerda da entrada)
    `${map.shippingBinPosition[0]},${map.shippingBinPosition[1]}`,
  ]);

  const skin = fenceSkin(); // O material da cerca (`data/fenceSkins.ts`): as melhorias do Marceneiro trocam a arte.
  const place = (col: number, row: number, frame: number, flipX = false, flipY = false): void => {
    if (skip.has(`${col},${row}`)) return;
    const image = placeFenceTile(scene, tile, col, row, frame, flipX, flipY, skin.textureKey);
    // Profundidade pela base da célula — mesma convenção das árvores/Casa,
    // pro jogador poder passar na frente ou atrás da cerca corretamente.
    image.setDepth((row + 1) * tile);
    images.set(`${col},${row}`, image);
  };

  place(col0, row0, skin.topLeft);
  place(colEnd, row0, skin.topRight, !!skin.flipTopRight, false);
  place(col0, rowEnd, skin.bottomLeft);
  place(colEnd, rowEnd, skin.bottomRight);

  for (let col = col0 + 1; col < colEnd; col++) {
    place(col, row0, skin.edgeTop);
    place(col, rowEnd, skin.edgeBottom);
  }
  for (let row = row0 + 1; row < rowEnd; row++) {
    place(col0, row, skin.edgeLeft);
    place(colEnd, row, skin.edgeRight);
  }

  // As imagens por célula: a horda usa (`systems/farmFences.ts`) pra dar vida às cercas e derrubá-las.
  return images;
}
