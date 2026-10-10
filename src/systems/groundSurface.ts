import Phaser from 'phaser';
import { GROUND_TILESETS } from './groundTilesets';

/**
 * DE QUE É O CHÃO de uma célula (o som dos passos — `attachFootstepSounds`): grama, terra ou pedra. Em vez de uma lista de tiles por mapa,
 * olha a ARTE do próprio tile do chão autorado: a cor média dos pixels visíveis (calculada uma vez por tile e guardada) — verde é grama,
 * laranja/marrom é terra (caminhos, areia), cinza (ou azulado/arroxeado, sem verde) é pedra. Vale pra qualquer mapa e qualquer tileset do
 * `GROUND_TILESETS`, sem precisar mexer aqui ao pintar um chão novo no editor.
 */
export type GroundSurface = 'grass' | 'dirt' | 'stone';

/** Diferença máxima entre os canais (0-255) abaixo da qual a cor é "cinza" (pedra). */
const GRAY_SPREAD = 28;

/** A superfície de uma cor média (0-255 por canal). */
export function classifyGroundColor(r: number, g: number, b: number): GroundSurface {
  if (Math.max(r, g, b) - Math.min(r, g, b) < GRAY_SPREAD) return 'stone';
  if (g >= r && g >= b) return 'grass';
  if (r > g && r >= b) return 'dirt';
  return 'stone';
}

const surfaceByGid = new Map<number, GroundSurface>();
const pixelsByTexture = new Map<string, { data: Uint8ClampedArray; width: number } | null>();

function texturePixels(scene: Phaser.Scene, textureKey: string): { data: Uint8ClampedArray; width: number } | null {
  if (pixelsByTexture.has(textureKey)) return pixelsByTexture.get(textureKey) ?? null;
  let result: { data: Uint8ClampedArray; width: number } | null = null;
  if (scene.textures.exists(textureKey)) {
    const image = scene.textures.get(textureKey).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (context) {
      context.drawImage(image, 0, 0);
      result = { data: context.getImageData(0, 0, image.width, image.height).data, width: image.width };
    }
  }
  pixelsByTexture.set(textureKey, result);
  return result;
}

/** A superfície do tile de chão `gid` (a numeração de `GROUND_TILESETS`). Água/tile desconhecido conta como grama (ninguém pisa na água). */
export function groundSurfaceOfGid(scene: Phaser.Scene, gid: number | undefined): GroundSurface {
  if (gid === undefined) return 'grass';
  const cached = surfaceByGid.get(gid);
  if (cached) return cached;

  let surface: GroundSurface = 'grass';
  const tileset = GROUND_TILESETS.find((candidate) => gid >= candidate.firstGid && gid < candidate.firstGid + candidate.columns * candidate.rows);
  const pixels = tileset && tileset.id !== 'water' ? texturePixels(scene, tileset.textureKey) : null;
  if (tileset && pixels) {
    const index = gid - tileset.firstGid;
    const x0 = (index % tileset.columns) * tileset.tileSize;
    const y0 = Math.floor(index / tileset.columns) * tileset.tileSize;
    let r = 0;
    let g = 0;
    let b = 0;
    let count = 0;
    for (let y = y0; y < y0 + tileset.tileSize; y++) {
      for (let x = x0; x < x0 + tileset.tileSize; x++) {
        const at = (y * pixels.width + x) * 4;
        if (pixels.data[at + 3] < 128) continue;
        r += pixels.data[at];
        g += pixels.data[at + 1];
        b += pixels.data[at + 2];
        count++;
      }
    }
    if (count > 0) surface = classifyGroundColor(r / count, g / count, b / count);
  }
  surfaceByGid.set(gid, surface);
  return surface;
}
