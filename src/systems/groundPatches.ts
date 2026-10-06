import Phaser from 'phaser';
import { GRASS_TILESET_KEY } from '../data/tiles';
import {
  GRASS_TILESET_COLUMNS,
  PATCH_GROUP_COL,
  PATCH_GROUP_COLS,
  PATCH_GROUP_ROW,
  PATCH_GROUP_ROWS,
  PATCH_RECOLOR,
  PATCH_TEXTURE_KEY,
} from '../data/groundPatches';
import { isPatchCell, pickPatchTile } from './groundVariation';

/**
 * MANCHAS ORGÂNICAS DE GRAMA (variação do chão): uma camada de tilemap por cima do chão-base (grama clara) com manchas da grama
 * escura do próprio tileset. Onde há mancha e qual peça do autotile cada célula usa vem de `systems/groundVariation.ts`
 * (`isPatchCell`/`pickPatchTile`, ruído determinístico em coordenadas do mundo); as peças e a suavização da borda, de
 * `data/groundPatches.ts`. Uma camada por trecho de chão (não um objeto por célula) — custa o mesmo que o chão.
 */

/** Profundidade: acima do chão (-1), abaixo dos detalhes de grama (-0.6), do solo arado (-0.5) e de tudo que é ordenado por Y. */
const PATCH_DEPTH = -0.9;

/**
 * Cria (uma vez por jogo) a textura das peças da mancha: o recorte do grupo da grama escura do tileset, com o contorno trocado por
 * `PATCH_RECOLOR` (pixel a pixel, sobre a arte do pacote — nada é desenhado). Devolve `false` se o tileset ainda não carregou.
 */
function ensurePatchTexture(scene: Phaser.Scene, tileSize: number): boolean {
  if (scene.textures.exists(PATCH_TEXTURE_KEY)) return true;
  if (!scene.textures.exists(GRASS_TILESET_KEY)) return false;
  const source = scene.textures.get(GRASS_TILESET_KEY).getSourceImage() as CanvasImageSource;
  const width = PATCH_GROUP_COLS * tileSize;
  const height = PATCH_GROUP_ROWS * tileSize;
  const canvas = scene.textures.createCanvas(PATCH_TEXTURE_KEY, width, height);
  if (!canvas) return false;
  const context = canvas.getContext();
  context.drawImage(source, PATCH_GROUP_COL * tileSize, PATCH_GROUP_ROW * tileSize, width, height, 0, 0, width, height);
  const image = context.getImageData(0, 0, width, height);
  const pixels = image.data;
  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3] === 0) continue;
    const color = (pixels[index] << 16) | (pixels[index + 1] << 8) | pixels[index + 2];
    if (!(color in PATCH_RECOLOR)) continue;
    const swapped = PATCH_RECOLOR[color];
    if (swapped === null) {
      pixels[index + 3] = 0;
    } else {
      pixels[index] = (swapped >> 16) & 0xff;
      pixels[index + 1] = (swapped >> 8) & 0xff;
      pixels[index + 2] = swapped & 0xff;
    }
  }
  context.putImageData(image, 0, 0);
  canvas.refresh();
  return true;
}

/** Índice do tileset de grama → índice no recorte das manchas. */
function toPatchFrame(tilesetIndex: number): number {
  const row = Math.floor(tilesetIndex / GRASS_TILESET_COLUMNS) - PATCH_GROUP_ROW;
  const col = (tilesetIndex % GRASS_TILESET_COLUMNS) - PATCH_GROUP_COL;
  return row * PATCH_GROUP_COLS + col;
}

/**
 * Monta a camada de manchas de um trecho de chão (`cols` x `rows` células a partir de `originCol`/`originRow`, coordenadas do mundo).
 * `isGrass(col, row)` diz se a célula do mundo é grama plana de verdade; fora do trecho NÃO conta como grama — a mancha para uma célula
 * antes da beira (na beira do mapa ela seria cortada reta; entre trechos da Fazenda a emenda tem cerca, e a grama clara dos dois lados
 * fica natural). Devolve `null` se não houver mancha nenhuma.
 */
export function buildGroundPatches(
  scene: Phaser.Scene,
  tileSize: number,
  originCol: number,
  originRow: number,
  cols: number,
  rows: number,
  isGrass: (worldCol: number, worldRow: number) => boolean,
  displayScale: number,
  tint?: number,
): Phaser.Tilemaps.TilemapLayer | null {
  if (!ensurePatchTexture(scene, tileSize)) return null;
  const inside = (col: number, row: number): boolean => col >= originCol && col < originCol + cols && row >= originRow && row < originRow + rows;
  const grassInside = (col: number, row: number): boolean => inside(col, row) && isGrass(col, row);

  // O campo de cada célula é calculado uma vez (a escolha da peça olha as 8 vizinhas): grade com uma borda de 1 célula em volta.
  const patch: boolean[][] = [];
  for (let row = -1; row <= rows; row++) {
    const line: boolean[] = [];
    for (let col = -1; col <= cols; col++) line.push(isPatchCell(originCol + col, originRow + row, grassInside));
    patch.push(line);
  }
  const isPatch = (worldCol: number, worldRow: number): boolean => patch[worldRow - originRow + 1][worldCol - originCol + 1];

  const data: number[][] = [];
  let any = false;
  for (let row = 0; row < rows; row++) {
    const line: number[] = [];
    for (let col = 0; col < cols; col++) {
      const worldCol = originCol + col;
      const worldRow = originRow + row;
      if (!isPatch(worldCol, worldRow)) {
        line.push(-1);
        continue;
      }
      line.push(toPatchFrame(pickPatchTile(worldCol, worldRow, isPatch)));
      any = true;
    }
    data.push(line);
  }
  if (!any) return null;

  const tilemap = scene.make.tilemap({ data, tileWidth: tileSize, tileHeight: tileSize });
  const tileset = tilemap.addTilesetImage(PATCH_TEXTURE_KEY, PATCH_TEXTURE_KEY, tileSize, tileSize);
  if (!tileset) return null;
  const tile = tileSize * displayScale;
  const layer = tilemap.createLayer(0, tileset, originCol * tile, originRow * tile) as Phaser.Tilemaps.TilemapLayer | null;
  if (!layer) return null;
  layer.setScale(displayScale);
  layer.setDepth(PATCH_DEPTH);
  if (tint !== undefined) layer.setTint(tint);
  return layer;
}

const PATCH_LAYER_DATA_KEY = 'groundPatches';

/** Guarda a camada de manchas junto da camada do chão (quem aplica um filtro no chão aplica nela também — ver `getGroundPatches`). */
export function attachGroundPatches(ground: Phaser.Tilemaps.TilemapLayer, patches: Phaser.Tilemaps.TilemapLayer | null): void {
  if (patches) ground.setData(PATCH_LAYER_DATA_KEY, patches);
}

/** A camada de manchas de um chão (ou `null` se ele não tem mancha). */
export function getGroundPatches(ground: Phaser.Tilemaps.TilemapLayer): Phaser.Tilemaps.TilemapLayer | null {
  return (ground.getData(PATCH_LAYER_DATA_KEY) as Phaser.Tilemaps.TilemapLayer | undefined) ?? null;
}
