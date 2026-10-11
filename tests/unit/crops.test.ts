import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { CROPS, PACK_CROPS } from '../../src/data/crops';
import { shopPageCount, shopPageItems, turnShopPage } from '../../src/ui/shopPaging';

/** Largura x altura de um PNG (cabeçalho IHDR). */
function pngSize(path: string): { width: number; height: number } {
  const file = readFileSync(path);
  return { width: file.readUInt32BE(16), height: file.readUInt32BE(20) };
}

/** O quadro `frame` (16 x `frameHeight`) da folha tem algum pixel visível? (PNG RGBA 8 bits, sem entrelaçamento — o formato do pacote). */
function frameHasPixels(path: string, frame: number, frameHeight: number): boolean {
  const file = readFileSync(path);
  const width = file.readUInt32BE(16);
  const chunks: Buffer[] = [];
  for (let offset = 8; offset < file.length; ) {
    const length = file.readUInt32BE(offset);
    if (file.toString('latin1', offset + 4, offset + 8) === 'IDAT') chunks.push(file.subarray(offset + 8, offset + 8 + length));
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(chunks));
  const stride = width * 4;
  const rows: Buffer[] = [];
  let previous = Buffer.alloc(stride);
  for (let y = 0; y < frameHeight; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const out = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const left = x >= 4 ? out[x - 4] : 0;
      const up = previous[x];
      const upLeft = x >= 4 ? previous[x - 4] : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - upLeft;
        predictor = Math.abs(p - left) <= Math.abs(p - up) && Math.abs(p - left) <= Math.abs(p - upLeft) ? left : Math.abs(p - up) <= Math.abs(p - upLeft) ? up : upLeft;
      }
      out[x] = (line[x] + predictor) & 0xff;
    }
    rows.push(out);
    previous = out;
  }
  for (const row of rows) for (let x = frame * 16; x < frame * 16 + 16; x++) if (row[x * 4 + 3] > 0) return true;
  return false;
}

describe('cultivos do pacote', () => {
  it('são 30 cultivos (os 3 de antes + 27 do pacote), com ids únicos', () => {
    expect(PACK_CROPS.length).toBe(27);
    expect(Object.keys(CROPS).length).toBe(30);
    expect(Object.keys(CROPS).slice(0, 3)).toEqual(['carrot', 'potato', 'onion']);
  });

  it('cada cultivo: 4 a 6 dias pra crescer, vende por mais do que a semente custa, ícones dentro da folha de ícones', () => {
    for (const crop of Object.values(CROPS)) {
      const days = crop.growthFrames.length - 1;
      expect(days, crop.id).toBeGreaterThanOrEqual(4);
      expect(days, crop.id).toBeLessThanOrEqual(6);
      expect(crop.sellPrice, crop.id).toBeGreaterThan(crop.seedPrice);
      for (const rect of [crop.seedFrameRect, crop.cropFrameRect]) {
        expect(rect.x + rect.width, crop.id).toBeLessThanOrEqual(416);
        expect(rect.y + rect.height, crop.id).toBeLessThanOrEqual(288);
      }
    }
  });

  it('cada folha existe, tem a altura de quadro declarada e todos os quadros usados têm desenho', () => {
    for (const crop of Object.values(CROPS)) {
      const path = `assets/${crop.texturePath}`;
      const { width, height } = pngSize(path);
      const frameHeight = crop.frameHeight ?? 16;
      expect(height, crop.id).toBe(frameHeight);
      for (const frame of crop.growthFrames) {
        expect(frame, crop.id).toBeLessThan(width / 16);
        expect(frameHasPixels(path, frame, frameHeight), `${crop.id} quadro ${frame}`).toBe(true);
      }
    }
  });
});

describe('páginas da loja', () => {
  it('uma aba com mais itens que o grid vira várias páginas; virar fica preso nas pontas', () => {
    const items = Array.from({ length: 30 }, (_, index) => index);
    expect(shopPageCount(30, 24)).toBe(2);
    expect(shopPageCount(0, 24)).toBe(1);
    expect(shopPageItems(items, 0, 24)).toEqual(items.slice(0, 24));
    expect(shopPageItems(items, 1, 24)).toEqual([24, 25, 26, 27, 28, 29]);
    expect(shopPageItems(items, 7, 24)).toEqual([24, 25, 26, 27, 28, 29]);
    expect(turnShopPage(0, 1, 30, 24)).toBe(1);
    expect(turnShopPage(1, 1, 30, 24)).toBe(1);
    expect(turnShopPage(0, -1, 30, 24)).toBe(0);
  });
});
