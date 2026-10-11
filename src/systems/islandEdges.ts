import Phaser from 'phaser';
import { CLIFF_TILESET_KEY, CLIFF_TILESET_PATH, ISLAND_VIEW_MARGIN_CELLS, ISLAND_WATER_COLOR } from '../data/islandEdges';
import { IslandRegion, RimTile, islandRimTiles } from './islandLayout';
import { DISPLAY_SCALE } from './mapBuilder';
import { GRASS_FLAT_TILE_INDEX, GRASS_TILESET_KEY } from '../data/tiles';

/**
 * O DESENHO DA ILHA (`data/islandEdges.ts`): a moldura de peças do penhasco em volta do chão (`islandRimTiles`) numa camada de tilemap só,
 * atrás de tudo como o chão, e a água funda lá embaixo — a cor de fundo da câmera, a mesma da base do paredão. A câmera passa a mostrar
 * `ISLAND_VIEW_MARGIN_CELLS` além da borda (`islandCameraBounds`), então perto da borda se vê a beirada, o paredão e a água.
 */

export interface IslandEdgeStyle {
  /** O mesmo tint do chão do mapa (a Pedreira e a Floresta Oculta pintam a grama). */
  tint?: number;
  /** A mesma saturação do chão do mapa (a Pedreira deixa a grama quase cinza: vira pedra). */
  saturation?: number;
  /** Tint por célula da moldura (a Fazenda escurece a beirada do trecho de Mineração, igual ao chão dele). */
  tintAt?: (col: number, row: number) => number | undefined;
}

export function preloadIslandEdges(scene: Phaser.Scene): void {
  if (!scene.textures.exists(CLIFF_TILESET_KEY)) scene.load.image(CLIFF_TILESET_KEY, encodeURI(`/${CLIFF_TILESET_PATH}`));
}

/** Desenha a moldura da ilha e pinta a água de fundo. Devolve a camada (pra destruir e refazer quando a ilha cresce). */
export function buildIslandEdges(scene: Phaser.Scene, tileSize: number, region: IslandRegion, style: IslandEdgeStyle = {}): Phaser.Tilemaps.TilemapLayer {
  scene.cameras.main.setBackgroundColor(ISLAND_WATER_COLOR);

  const originCol = region.col0 - 1;
  const originRow = region.row0 - 1;
  const width = region.cols + 2;
  const height = region.rows + 3;
  const data: number[][] = Array.from({ length: height }, () => new Array<number>(width).fill(-1));
  const rim: RimTile[] = islandRimTiles(region);
  for (const tile of rim) data[tile.row - originRow][tile.col - originCol] = tile.index;

  const tilemap = scene.make.tilemap({ data, tileWidth: tileSize, tileHeight: tileSize });
  const tileset = tilemap.addTilesetImage(CLIFF_TILESET_KEY, CLIFF_TILESET_KEY, tileSize, tileSize);
  if (!tileset) throw new Error('Não foi possível carregar o tileset do penhasco.');
  const tilePx = tileSize * DISPLAY_SCALE;
  const layer = tilemap.createLayer(0, tileset, originCol * tilePx, originRow * tilePx) as Phaser.Tilemaps.TilemapLayer;
  layer.setScale(DISPLAY_SCALE);
  layer.setDepth(-1); // Como o chão: atrás de tudo que é ordenado por profundidade (e da ponte, que passa por cima).
  if (style.tint !== undefined) layer.setTint(style.tint);
  if (style.tintAt) {
    for (const tile of rim) {
      const tint = style.tintAt(tile.col, tile.row);
      if (tint !== undefined) layer.getTileAt(tile.col - originCol, tile.row - originRow)!.tint = tint;
    }
  }
  if (style.saturation !== undefined) {
    layer.enableFilters().filters!.internal.addColorMatrix().colorMatrix.saturate(style.saturation - 1);
    layer.filtersFocusContext = true; // O quadro do filtro cobre a tela (focado na camada, saía menor que ela e cortava a moldura).
  }
  return layer;
}

/**
 * Grama lisa POR BAIXO do chão do mapa (atrás da camada de chão, na frente da água do abismo), com o mesmo tint dele: algumas peças de
 * chão têm partes transparentes — a elevação de terra do norte da Fazenda (barranco em volta de um miolo vazado, que é o ALTO dela) e a
 * grama 59 do Vilarejo, ao lado da Forja — que antes mostravam a cor de fundo verde do mapa (`#7ec433`, a mesma da grama lisa); com a
 * ilha, mostravam a água funda do abismo. Um `TileSprite` só.
 */
export function buildGroundUnderlay(scene: Phaser.Scene, tileSize: number, region: IslandRegion, tint?: number): Phaser.GameObjects.TileSprite {
  const tilePx = tileSize * DISPLAY_SCALE;
  const frame = 'ground-underlay-grass';
  const texture = scene.textures.get(GRASS_TILESET_KEY);
  const columns = Math.floor(texture.getSourceImage().width / tileSize);
  if (!texture.has(frame)) {
    texture.add(frame, 0, (GRASS_FLAT_TILE_INDEX % columns) * tileSize, Math.floor(GRASS_FLAT_TILE_INDEX / columns) * tileSize, tileSize, tileSize);
  }
  const underlay = scene.add.tileSprite(region.col0 * tilePx, region.row0 * tilePx, region.cols * tilePx, region.rows * tilePx, GRASS_TILESET_KEY, frame);
  underlay.setOrigin(0, 0).setTileScale(DISPLAY_SCALE, DISPLAY_SCALE).setDepth(-1.5);
  if (tint !== undefined) underlay.setTint(tint);
  return underlay;
}

/** Os limites da câmera de uma ilha (em px): o mapa mais a margem de água em volta. */
export function islandCameraBounds(region: IslandRegion, tilePx: number): { x: number; y: number; width: number; height: number } {
  const margin = ISLAND_VIEW_MARGIN_CELLS * tilePx;
  return {
    x: region.col0 * tilePx - margin,
    y: region.row0 * tilePx - margin,
    width: region.cols * tilePx + margin * 2,
    height: region.rows * tilePx + margin * 2,
  };
}
