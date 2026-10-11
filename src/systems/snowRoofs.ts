import Phaser from 'phaser';
import { SNOW_COLORS, SNOW_KIT, SNOW_KIT_FILL_RECT, SNOW_ROOF_RECIPES, SNOW_TEMPLATES, type SnowRoofRecipe } from '../data/snowRoofs';
import { currentGroundSeason } from './seasonalGround';

/**
 * TELHADOS COM NEVE (`data/snowRoofs.ts`): no Inverno, cada prédio com receita vira uma TEXTURA COMPOSTA — a arte dele com a neve do kit do
 * pacote por cima (copiada de um gabarito nevado do pacote, ou a placa de neve do kit recortada nas telhas). Montada uma vez por prédio,
 * num canvas; nada é desenhado, só recorte e composição da arte real. Fora do Inverno (ou sem receita), a arte de sempre.
 */

export function preloadSnowRoofs(scene: Phaser.Scene): void {
  for (const { key, path } of [...Object.values(SNOW_TEMPLATES), SNOW_KIT]) {
    if (!scene.textures.exists(key)) scene.load.image(key, encodeURI(`/${path}`));
  }
}

type Frame = Phaser.Textures.Frame;

function imageData(frame: Frame, x = frame.cutX, y = frame.cutY, width = frame.cutWidth, height = frame.cutHeight): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d')!;
  context.drawImage(frame.source.image as CanvasImageSource, x, y, width, height, 0, 0, width, height);
  return context.getImageData(0, 0, width, height);
}

const rgb = (data: Uint8ClampedArray, index: number): number => (data[index] << 16) | (data[index + 1] << 8) | data[index + 2];
const inside = (rects: ReadonlyArray<{ x: number; y: number; width: number; height: number }>, x: number, y: number): boolean =>
  rects.some((rect) => x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height);

/** Gabarito: os pixels de neve (`SNOW_COLORS`) do gabarito, deslocados até o telhado, por cima da arte (menos nos `keep`). */
function applyTemplate(scene: Phaser.Scene, base: Frame, recipe: Extract<SnowRoofRecipe, { kind: 'template' }>, out: ImageData): boolean {
  let template: ImageData;
  if (recipe.template === 'self') {
    const rect = recipe.templateRect!;
    template = imageData(base.texture.get('__BASE'), rect.x, rect.y, rect.width, rect.height);
  } else {
    const key = SNOW_TEMPLATES[recipe.template].key;
    if (!scene.textures.exists(key)) return false;
    template = imageData(scene.textures.getFrame(key));
  }
  for (let y = 0; y < Math.min(template.height, recipe.maxY ?? template.height); y++) {
    for (let x = 0; x < template.width; x++) {
      const from = (y * template.width + x) * 4;
      if (template.data[from + 3] === 0 || !SNOW_COLORS.includes(rgb(template.data, from))) continue;
      const tx = x + recipe.dx;
      const ty = y + recipe.dy;
      if (tx < 0 || ty < 0 || tx >= out.width || ty >= out.height || inside(recipe.keep ?? [], tx, ty)) continue;
      const to = (ty * out.width + tx) * 4;
      out.data.set(template.data.subarray(from, from + 4), to);
    }
  }
  return true;
}

/** Recorte: a placa de neve do kit, repetida, só nos pixels de telha (`roofColors`) dentro das `regions`. */
function applyClip(scene: Phaser.Scene, recipe: Extract<SnowRoofRecipe, { kind: 'clip' }>, out: ImageData): boolean {
  if (!scene.textures.exists(SNOW_KIT.key)) return false;
  const { x, y, width, height } = SNOW_KIT_FILL_RECT;
  const fill = imageData(scene.textures.getFrame(SNOW_KIT.key), x, y, width, height);
  for (let py = 0; py < out.height; py++) {
    for (let px = 0; px < out.width; px++) {
      if (!inside(recipe.regions, px, py)) continue;
      const to = (py * out.width + px) * 4;
      if (out.data[to + 3] === 0 || !recipe.roofColors.includes(rgb(out.data, to))) continue;
      const from = ((py % height) * width + (px % width)) * 4;
      out.data.set(fill.data.subarray(from, from + 4), to);
    }
  }
  return true;
}

/**
 * A textura do prédio na estação do chão: no Inverno, a composição com neve (criada na 1ª vez); senão, a arte de sempre. `frameName`
 * ausente = a imagem inteira.
 */
export function seasonalBuildingTexture(scene: Phaser.Scene, textureKey: string, frameName?: string | number): { textureKey: string; frameName: string | number | undefined } {
  const original = { textureKey, frameName };
  if (currentGroundSeason() !== 'winter') return original;
  const recipe = SNOW_ROOF_RECIPES[frameName === undefined || frameName === '__BASE' ? textureKey : `${textureKey}|${frameName}`];
  if (!recipe || !scene.textures.exists(textureKey)) return original;

  const key = `${textureKey}|${frameName ?? '__BASE'}|snow`;
  if (!scene.textures.exists(key)) {
    const base = scene.textures.getFrame(textureKey, frameName);
    const out = imageData(base);
    const ok = recipe.kind === 'template' ? applyTemplate(scene, base, recipe, out) : applyClip(scene, recipe, out);
    if (!ok) return original;
    const canvas = scene.textures.createCanvas(key, out.width, out.height);
    if (!canvas) return original;
    canvas.getContext().putImageData(out, 0, 0);
    canvas.refresh();
  }
  return { textureKey: key, frameName: '__BASE' };
}
