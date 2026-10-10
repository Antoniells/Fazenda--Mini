// Gera build/icon.ico (ícone do .exe, do instalador e do atalho) a partir da arte real do jogo:
// o ícone 16x16 da cenoura colhida em `assets/Crops/All Crops.png` (o mesmo de `CARROT.cropFrameRect`
// em src/data/crops.ts), ampliado só em múltiplos inteiros e sem suavização, pra manter a pixel art.
// Nada é desenhado aqui — só recorte e ampliação. Sem dependências: PNG lido e escrito com o zlib do Node.
// Uso: node tools/make-app-icon.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { crc32, deflateSync, inflateSync } from 'node:zlib';

const SOURCE = 'assets/Crops/All Crops.png';
const CROP = { x: 32, y: 96, width: 16, height: 16 };
const SCALES = [1, 2, 3, 4, 8, 16]; // 16, 32, 48, 64, 128 e 256 px.
const OUTPUT = 'build/icon.ico';
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Lê um PNG RGBA de 8 bits sem entrelaçamento (o formato das folhas de sprite do jogo). */
function readPng(path) {
  const file = readFileSync(path);
  if (!file.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error(`${path} não é PNG`);
  let offset = 8;
  let width = 0;
  let height = 0;
  const idat = [];
  while (offset < file.length) {
    const length = file.readUInt32BE(offset);
    const type = file.toString('latin1', offset + 4, offset + 8);
    const data = file.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[9] !== 6 || data[12] !== 0) throw new Error(`${path}: só PNG RGBA 8 bits sem entrelaçamento`);
    } else if (type === 'IDAT') idat.push(data);
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const left = x >= 4 ? pixels[y * stride + x - 4] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upLeft = x >= 4 && y > 0 ? pixels[(y - 1) * stride + x - 4] : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = (left + up) >> 1;
      else if (filter === 4) {
        const estimate = left + up - upLeft;
        const distLeft = Math.abs(estimate - left);
        const distUp = Math.abs(estimate - up);
        const distUpLeft = Math.abs(estimate - upLeft);
        predictor = distLeft <= distUp && distLeft <= distUpLeft ? left : distUp <= distUpLeft ? up : upLeft;
      }
      pixels[y * stride + x] = (line[x] + predictor) & 0xff;
    }
  }
  return { width, height, pixels };
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([length, body, crc]);
}

function writePng(width, height, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8);
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) pixels.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  return Buffer.concat([PNG_SIGNATURE, chunk('IHDR', header), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/** Recorta `CROP` da folha e amplia por vizinho mais próximo (cada pixel vira um bloco `scale` x `scale`). */
function cropScaled(sheet, scale) {
  const size = CROP.width * scale;
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const from = ((CROP.y + Math.floor(y / scale)) * sheet.width + CROP.x + Math.floor(x / scale)) * 4;
      sheet.pixels.copy(out, (y * size + x) * 4, from, from + 4);
    }
  }
  return writePng(size, size, out);
}

const sheet = readPng(SOURCE);
const images = SCALES.map((scale) => ({ size: CROP.width * scale, png: cropScaled(sheet, scale) }));
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2); // 1 = ícone.
header.writeUInt16LE(images.length, 4);
let dataOffset = 6 + images.length * 16;
const entries = images.map(({ size, png }) => {
  const entry = Buffer.alloc(16);
  entry[0] = size >= 256 ? 0 : size; // 0 = 256 px no formato ICO.
  entry[1] = size >= 256 ? 0 : size;
  entry.writeUInt16LE(1, 4); // Planos.
  entry.writeUInt16LE(32, 6); // Bits por pixel.
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(dataOffset, 12);
  dataOffset += png.length;
  return entry;
});
writeFileSync(OUTPUT, Buffer.concat([header, ...entries, ...images.map(({ png }) => png)]));
writeFileSync(OUTPUT.replace(/\.ico$/, '.png'), images[images.length - 1].png);
console.log(`${OUTPUT}: ${images.map(({ size }) => size).join(', ')} px`);
