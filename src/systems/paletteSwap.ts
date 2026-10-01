import Phaser from 'phaser';

/**
 * TROCA DE PALETA (ideia do stardew.me): em vez de tingir o sprite inteiro, cada pixel de uma "família" de cor é trocado pelo tom
 * equivalente de outra paleta — o sombreado da arte original fica (o claro continua claro, o escuro continua escuro). Gera uma textura
 * nova UMA vez (as texturas do Phaser valem pro jogo todo) a partir de um quadro de uma textura já carregada; nada é desenhado do zero.
 *
 * Uso atual: a Cenoura Dourada e a semente dela (`toGold`: o laranja da cenoura vira ouro, as folhas continuam verdes).
 */

type Rgb = [number, number, number];

/** Rampa do ouro por luminosidade (0 = sombra, 1 = brilho). */
const GOLD_RAMP: Array<[number, number]> = [
  [0, 0x5e3c0c],
  [0.3, 0xa06a10],
  [0.5, 0xd99e1c],
  [0.7, 0xf6cb3c],
  [0.85, 0xffe57a],
  [1, 0xfff6c4],
];

function hueSatLum(r: number, g: number, b: number): { hue: number; sat: number; lum: number } {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const lum = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return { hue: 0, sat: 0, lum };
  const sat = delta / max; // Saturação do HSV: no HSL, um bege bem claro (o papel do saquinho) passaria por "saturado".
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  let hue = max === rn ? ((gn - bn) / delta) % 6 : max === gn ? (bn - rn) / delta + 2 : (rn - gn) / delta + 4;
  hue *= 60;
  if (hue < 0) hue += 360;
  return { hue, sat, lum };
}

function rampAt(ramp: Array<[number, number]>, t: number): Rgb {
  for (let index = 1; index < ramp.length; index++) {
    const [stop, color] = ramp[index];
    const [previousStop, previousColor] = ramp[index - 1];
    if (t <= stop) {
      const k = (t - previousStop) / (stop - previousStop);
      const channel = (shift: number): number => Math.round(((previousColor >> shift) & 0xff) * (1 - k) + ((color >> shift) & 0xff) * k);
      return [channel(16), channel(8), channel(0)];
    }
  }
  const last = ramp[ramp.length - 1][1];
  return [(last >> 16) & 0xff, (last >> 8) & 0xff, last & 0xff];
}

/**
 * Pixel laranja/vermelho-alaranjado (a cenoura) → o ouro de mesma luminosidade; qualquer outro (folha verde, contorno quase preto, papel
 * do saquinho) → `null` (fica como está). A luminosidade é esticada um pouco pra cima: o laranja é escuro perto do ouro.
 */
export function toGold(r: number, g: number, b: number): Rgb | null {
  const { hue, sat, lum } = hueSatLum(r, g, b);
  const isOrange = hue >= 5 && hue <= 50 && sat >= 0.4 && lum >= 0.18;
  if (!isOrange) return null;
  return rampAt(GOLD_RAMP, Math.min(1, lum * 1.25));
}

/** A chave da textura recolorida de um quadro (a mesma pra quem pedir de novo). */
export function recoloredKey(prefix: string, sourceKey: string, frame: string | number): string {
  return `${prefix}:${sourceKey}:${frame}`;
}

/**
 * Cria (uma vez) a textura `targetKey` com o quadro `frame` de `sourceKey` recolorido por `recolor`. Devolve `false` se a textura de
 * origem ainda não foi carregada (quem chama tenta de novo depois, ou fica com a original).
 */
export function recolorFrame(scene: Phaser.Scene, sourceKey: string, frame: string | number, targetKey: string, recolor: (r: number, g: number, b: number) => Rgb | null): boolean {
  if (scene.textures.exists(targetKey)) return true;
  if (!scene.textures.exists(sourceKey)) return false;
  const source = scene.textures.getFrame(sourceKey, frame);
  if (!source) return false;
  const { cutX, cutY, cutWidth, cutHeight } = source;
  const canvas = scene.textures.createCanvas(targetKey, cutWidth, cutHeight);
  if (!canvas) return false;
  const context = canvas.getContext();
  context.drawImage(source.source.image as CanvasImageSource, cutX, cutY, cutWidth, cutHeight, 0, 0, cutWidth, cutHeight);
  const image = context.getImageData(0, 0, cutWidth, cutHeight);
  const pixels = image.data;
  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3] === 0) continue;
    const swapped = recolor(pixels[index], pixels[index + 1], pixels[index + 2]);
    if (!swapped) continue;
    [pixels[index], pixels[index + 1], pixels[index + 2]] = swapped;
  }
  context.putImageData(image, 0, 0);
  canvas.refresh();
  return true;
}

/** A versão DOURADA de um quadro (cria na 1ª vez). Devolve a chave da textura dourada, ou `null` se a origem ainda não carregou. */
export function ensureGolden(scene: Phaser.Scene, sourceKey: string, frame: string | number): string | null {
  const key = recoloredKey('golden', sourceKey, frame);
  return recolorFrame(scene, sourceKey, frame, key, toGold) ? key : null;
}
