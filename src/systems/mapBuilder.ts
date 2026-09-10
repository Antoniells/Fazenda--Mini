import Phaser from 'phaser';
import { FarmMapData } from '../data/maps/farmMap';
import {
  GRASS_TILESET_KEY,
  GRASS_FLAT_TILE_INDEX,
  FENCE_TILESET_KEY,
  FENCE_CORNER_INDEX,
  FENCE_CORNER_BOTTOM_LEFT_INDEX,
  FENCE_CORNER_BOTTOM_RIGHT_INDEX,
  FENCE_EDGE_H_INDEX,
  FENCE_EDGE_V_INDEX,
  PINE_TREE_KEY,
  PINE_TREE_FRAME_NAME,
} from '../data/tiles';

/** Escala de exibição: cada tile de 16px é desenhado em 32px na tela. */
export const DISPLAY_SCALE = 2;

/**
 * Constrói a camada de terreno (grid de grama) a partir dos dados do mapa.
 * A definição do layout vem de `farmMap`; esta função só é responsável por
 * transformar esses dados em objetos renderizáveis do Phaser.
 */
export function buildFarmGround(
  scene: Phaser.Scene,
  map: FarmMapData,
): Phaser.Tilemaps.TilemapLayer {
  const groundData: number[][] = [];
  for (let row = 0; row < map.rows; row++) {
    groundData.push(new Array(map.cols).fill(GRASS_FLAT_TILE_INDEX));
  }

  const tilemap = scene.make.tilemap({
    data: groundData,
    tileWidth: map.tileSize,
    tileHeight: map.tileSize,
  });

  const tileset = tilemap.addTilesetImage(
    GRASS_TILESET_KEY,
    GRASS_TILESET_KEY,
    map.tileSize,
    map.tileSize,
  );

  if (!tileset) {
    throw new Error('Não foi possível carregar o tileset de grama.');
  }

  const layer = tilemap.createLayer(0, tileset, 0, 0) as Phaser.Tilemaps.TilemapLayer;
  layer.setScale(DISPLAY_SCALE);
  // Sempre atrás de qualquer elemento ordenado por profundidade (árvores, personagem).
  layer.setDepth(-1);

  return layer;
}

/** Desenha uma cerca ao redor de todo o perímetro do mapa. */
export function buildFarmFence(scene: Phaser.Scene, map: FarmMapData): void {
  const { cols, rows, tileSize } = map;
  const tile = tileSize * DISPLAY_SCALE;

  const placeFence = (
    col: number,
    row: number,
    frame: number,
    flipX = false,
    flipY = false,
  ): void => {
    const image = scene.add.image(col * tile, row * tile, FENCE_TILESET_KEY, frame);
    image.setOrigin(0, 0);
    image.setScale(DISPLAY_SCALE);
    image.setFlip(flipX, flipY);
  };

  for (let col = 1; col < cols - 1; col++) {
    placeFence(col, 0, FENCE_EDGE_H_INDEX);
    placeFence(col, rows - 1, FENCE_EDGE_H_INDEX);
  }

  for (let row = 1; row < rows - 1; row++) {
    placeFence(0, row, FENCE_EDGE_V_INDEX);
    placeFence(cols - 1, row, FENCE_EDGE_V_INDEX);
  }

  // Cantos superiores: um único tile de canto, espelhado horizontalmente à direita.
  placeFence(0, 0, FENCE_CORNER_INDEX);
  placeFence(cols - 1, 0, FENCE_CORNER_INDEX, true, false);

  // Cantos inferiores: tiles dedicados do próprio asset (não é o canto
  // superior espelhado verticalmente — isso invertia a orientação do poste).
  placeFence(0, rows - 1, FENCE_CORNER_BOTTOM_LEFT_INDEX);
  placeFence(cols - 1, rows - 1, FENCE_CORNER_BOTTOM_RIGHT_INDEX);
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
    const tree = scene.add.image(
      col * tile + tile / 2,
      (row + 1) * tile,
      PINE_TREE_KEY,
      PINE_TREE_FRAME_NAME,
    );
    tree.setOrigin(0.5, 1);
    tree.setScale(DISPLAY_SCALE);
    // Profundidade fixa baseada no Y da base da árvore, para ordenar contra
    // o personagem (que tem profundidade dinâmica igual ao seu próprio Y).
    tree.setDepth(tree.y);
    trees.push(tree);
  }

  return trees;
}
