import { GRASS_FLAT_TILE_INDEX } from '../data/tiles';
import { PATCH_NOISE, PATCH_TILE_BY_MASK } from '../data/groundPatches';

/**
 * Variação visual do chão. Antes (Fase 9) cada célula sorteava o tom claro ou o escuro da grama plana — e o escuro, sozinho no meio do
 * claro, virava um quadrado de borda reta. Agora o chão-base é sempre a grama clara e o tom escuro vem em MANCHAS orgânicas
 * (`systems/groundPatches.ts`): um campo de ruído suave decide onde há mancha e cada célula dela usa a peça do autotile da grama escura
 * que casa com os vizinhos (borda recortada, cantos internos). Tudo determinístico (mesma célula do mundo = mesmo resultado, sem guardar
 * nada) e só visual: grid, colisão e área cultivável não mudam. As manchas de terra vêm de `systems/dirtPaths.ts`.
 */

/**
 * Hash 2D simples e determinístico (mesmos x/y sempre produzem o mesmo
 * resultado, sem precisar guardar nada em lugar nenhum) — não é
 * criptográfico, só precisa distribuir os valores o bastante pra não
 * formar um padrão visual óbvio quando lido em sequência pelo mapa.
 */
export function hash2D(x: number, y: number): number {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967295;
}

/**
 * O tile-base da grama numa célula (coordenadas ABSOLUTAS do mundo). É sempre a grama clara: o tom escuro vem das manchas
 * (`isPatchCell`/`pickPatchTile`), desenhadas numa camada por cima. Usado pelo chão procedural e pelo pincel de grama do editor.
 */
export function pickGroundTileVariant(_worldCol: number, _worldRow: number): number {
  return GRASS_FLAT_TILE_INDEX;
}

/**
 * Ruído de valor suave (0-1) numa grade de `cells` células girada em `angle` (sem girar, as formas saem alinhadas aos eixos):
 * `hash2D` nos nós, interpolado com curva suave entre eles.
 */
function valueNoise(worldCol: number, worldRow: number, cells: number, angle: number, seed: number): number {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const x = (worldCol * cos - worldRow * sin) / cells;
  const y = (worldCol * sin + worldRow * cos) / cells;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const smooth = (t: number): number => t * t * (3 - 2 * t);
  const tx = smooth(x - x0);
  const ty = smooth(y - y0);
  const node = (nx: number, ny: number): number => hash2D(nx * 7 + seed, ny * 13 - seed);
  const top = node(x0, y0) * (1 - tx) + node(x0 + 1, y0) * tx;
  const bottom = node(x0, y0 + 1) * (1 - tx) + node(x0 + 1, y0 + 1) * tx;
  return top * (1 - ty) + bottom * ty;
}

/** Campo das manchas (0-1) numa célula do mundo: o formato largo mais um ruído fino que recorta a borda. */
export function patchField(worldCol: number, worldRow: number): number {
  const { coarseCells, coarseAngle, fineCells, fineAngle, fineWeight } = PATCH_NOISE;
  const coarse = valueNoise(worldCol, worldRow, coarseCells, coarseAngle, 101);
  const fine = valueNoise(worldCol, worldRow, fineCells, fineAngle, 577);
  return (coarse + fine * fineWeight) / (1 + fineWeight);
}

/**
 * A célula é mancha? Só se o campo passar do limiar E ela e as 8 vizinhas forem grama de verdade (`isGrass`): assim a mancha nunca
 * encosta em terra, água, ponte ou piso — sobra sempre uma beirada de grama clara, e as transições que já existem ficam intactas.
 */
export function isPatchCell(worldCol: number, worldRow: number, isGrass: (worldCol: number, worldRow: number) => boolean): boolean {
  if (!passesField(worldCol, worldRow)) return false;
  for (let dRow = -1; dRow <= 1; dRow++) {
    for (let dCol = -1; dCol <= 1; dCol++) {
      if (!isGrass(worldCol + dCol, worldRow + dRow)) return false;
    }
  }
  return true;
}

/**
 * O campo passa do limiar nesta célula? Na BEIRA da mancha (alguma vizinha dos 4 lados fora do limiar), uma fração das células é
 * "mordida" (sorteio fixo por célula): quebra as bordas retas compridas e os retângulos pequenos que a grade de células deixaria.
 */
function passesField(worldCol: number, worldRow: number): boolean {
  const { threshold, edgeBiteChance } = PATCH_NOISE;
  if (patchField(worldCol, worldRow) < threshold) return false;
  const onEdge =
    patchField(worldCol, worldRow - 1) < threshold ||
    patchField(worldCol + 1, worldRow) < threshold ||
    patchField(worldCol, worldRow + 1) < threshold ||
    patchField(worldCol - 1, worldRow) < threshold;
  return !onEdge || hash2D(worldCol * 31 + 7, worldRow * 17 + 3) >= edgeBiteChance;
}

/** Peça do autotile da mancha (índice do tileset de grama) pela vizinhança: quais das 8 vizinhas também são mancha. */
export function pickPatchTile(worldCol: number, worldRow: number, isPatch: (worldCol: number, worldRow: number) => boolean): number {
  const n = isPatch(worldCol, worldRow - 1);
  const e = isPatch(worldCol + 1, worldRow);
  const s = isPatch(worldCol, worldRow + 1);
  const w = isPatch(worldCol - 1, worldRow);
  let mask = (n ? 1 : 0) | (e ? 2 : 0) | (s ? 4 : 0) | (w ? 8 : 0);
  if (n && w && isPatch(worldCol - 1, worldRow - 1)) mask |= 16;
  if (n && e && isPatch(worldCol + 1, worldRow - 1)) mask |= 32;
  if (s && w && isPatch(worldCol - 1, worldRow + 1)) mask |= 64;
  if (s && e && isPatch(worldCol + 1, worldRow + 1)) mask |= 128;
  return PATCH_TILE_BY_MASK[mask];
}
