import { FarmMapData, getFarmlandFenceLayout } from '../data/maps/farmMap';
import {
  DIRT_BLOB_TOP_LEFT,
  DIRT_BLOB_TOP_RIGHT,
  DIRT_BLOB_BOTTOM_LEFT,
  DIRT_BLOB_BOTTOM_RIGHT,
  DIRT_BLOB_TOP_VARIANTS,
  DIRT_BLOB_BOTTOM_VARIANTS,
  DIRT_BLOB_LEFT_VARIANTS,
  DIRT_BLOB_RIGHT_VARIANTS,
  DIRT_BLOB_FILL_VARIANTS,
} from '../data/tiles';
import { hash2D } from './groundVariation';

/**
 * Caminhos de terra + manchas soltas (Fase 9, melhoria visual do chão v2):
 * um caminho liga a porta de casa à lavoura (pelo portão da cerca) e à
 * loja, e algumas manchas pequenas e esparsas ficam espalhadas pela grama
 * — tudo desenhado com o blob de terra de `data/tiles.ts`
 * (`DIRT_BLOB_*`), escolhendo o tile certo (canto/borda/preenchimento)
 * célula a célula a partir dos vizinhos ortogonais que também são "terra".
 * Só afeta a camada de chão (`systems/mapBuilder.ts`); não toca grid,
 * colisão, área cultivável nem a lógica de arar/plantar/regar/colher.
 */
export interface DirtZone {
  has(col: number, row: number): boolean;
}

interface Rect {
  col0: number;
  row0: number;
  cols: number;
  rows: number;
}

function cellsOfRect(rect: Rect): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  for (let row = rect.row0; row < rect.row0 + rect.rows; row++) {
    for (let col = rect.col0; col < rect.col0 + rect.cols; col++) {
      cells.push([col, row]);
    }
  }
  return cells;
}

/** A cada bloco de N células, uma chance de nascer uma mancha pequena (2x2 a 3x3) ali perto. */
const PATCH_GRID_STEP = 7;
const PATCH_CHANCE = 0.4;

function scatterPatchCells(map: FarmMapData, exclude: Set<string>): Array<[number, number]> {
  const cells: Array<[number, number]> = [];

  for (let row = 2; row < map.rows - 2; row += PATCH_GRID_STEP) {
    for (let col = 2; col < map.cols - 2; col += PATCH_GRID_STEP) {
      if (hash2D(col * 13 + 5, row * 29 + 11) >= PATCH_CHANCE) continue;

      const w = 2 + Math.floor(hash2D(col, row) * 2);
      const h = 2 + Math.floor(hash2D(row, col) * 2);
      const jitterCol = Math.floor(hash2D(col + 3, row) * (PATCH_GRID_STEP - w));
      const jitterRow = Math.floor(hash2D(col, row + 3) * (PATCH_GRID_STEP - h));

      const rect: Rect = { col0: col + jitterCol, row0: row + jitterRow, cols: w, rows: h };
      const rectCells = cellsOfRect(rect);
      if (rectCells.some(([c, r]) => exclude.has(`${c},${r}`))) continue;

      cells.push(...rectCells);
    }
  }

  return cells;
}

let cachedZone: { map: FarmMapData; cells: Set<string> } | null = null;

/**
 * Monta (uma vez por `FarmMapData`, com cache simples por referência) o
 * conjunto de células que devem ser desenhadas como terra: o caminho
 * casa→portão da lavoura→loja mais as manchas soltas. Chamado por
 * `buildFarmGround` e passado adiante para `buildGroundChunk`.
 */
export function buildDirtZone(map: FarmMapData): DirtZone {
  if (cachedZone && cachedZone.map === map) {
    const { cells } = cachedZone;
    return { has: (col, row) => cells.has(`${col},${row}`) };
  }

  const exclude = new Set<string>();
  for (const [col, row] of map.farmlandArea) exclude.add(`${col},${row}`);
  for (let row = map.housePosition.row0; row < map.housePosition.row0 + map.housePosition.rows; row++) {
    for (let col = map.housePosition.col0; col < map.housePosition.col0 + map.housePosition.cols; col++) {
      exclude.add(`${col},${row}`);
    }
  }
  exclude.add(`${map.shopPosition[0]},${map.shopPosition[1]}`);
  exclude.add(`${map.shippingBinPosition[0]},${map.shippingBinPosition[1]}`);
  for (const [col, row] of map.treePositions) exclude.add(`${col},${row}`);

  const cells = new Set<string>();
  const [doorCol, doorRow] = map.houseDoorPosition;
  const gate = getFarmlandFenceLayout(map).gate;
  const [shopCol] = map.shopPosition;

  // Casa -> portão da lavoura: corredor vertical de 2 células de largura,
  // alinhado com a coluna da porta (a mesma coluna do portão, ver
  // `getFarmlandFenceLayout`).
  const vertical: Rect = {
    col0: doorCol - 1,
    row0: doorRow + 1,
    cols: 2,
    rows: gate[1] - (doorRow + 1) + 1,
  };
  // Casa -> loja: corredor horizontal de 2 células, saindo da mesma coluna
  // do corredor vertical (evita canto interno/côncavo: os dois corredores
  // só se sobrepõem numa coluna cheia, nunca formam um "L" apertado).
  const horizontal: Rect = {
    col0: Math.min(doorCol, shopCol - 1),
    row0: doorRow + 1,
    cols: Math.abs(shopCol - doorCol) + 1,
    rows: 2,
  };

  for (const [col, row] of cellsOfRect(vertical)) cells.add(`${col},${row}`);
  for (const [col, row] of cellsOfRect(horizontal)) cells.add(`${col},${row}`);

  // Manchas soltas: não nascem em cima do caminho recém-desenhado, pra
  // ficarem visualmente distintas dele (espalhadas, não coladas).
  for (const [col, row] of cells) exclude.add(`${col},${row}`);
  for (const [col, row] of scatterPatchCells(map, exclude)) cells.add(`${col},${row}`);

  cachedZone = { map, cells };
  return { has: (col, row) => cells.has(`${col},${row}`) };
}

function pickVariant(col: number, row: number, options: number[]): number {
  const index = Math.floor(hash2D(col, row) * options.length) % options.length;
  return options[index];
}

/**
 * Dado que (col, row) já é uma célula de terra, decide qual peça do blob
 * usar olhando os 4 vizinhos ortogonais: o lado que NÃO é terra precisa da
 * borda com grama; os demais lados encaixam com a peça vizinha sem emenda.
 */
export function pickDirtBlobTile(zone: DirtZone, col: number, row: number): number {
  const missingTop = !zone.has(col, row - 1);
  const missingBottom = !zone.has(col, row + 1);
  const missingLeft = !zone.has(col - 1, row);
  const missingRight = !zone.has(col + 1, row);

  if (missingTop && missingLeft) return DIRT_BLOB_TOP_LEFT;
  if (missingTop && missingRight) return DIRT_BLOB_TOP_RIGHT;
  if (missingBottom && missingLeft) return DIRT_BLOB_BOTTOM_LEFT;
  if (missingBottom && missingRight) return DIRT_BLOB_BOTTOM_RIGHT;
  if (missingTop) return pickVariant(col, row, DIRT_BLOB_TOP_VARIANTS);
  if (missingBottom) return pickVariant(col, row, DIRT_BLOB_BOTTOM_VARIANTS);
  if (missingLeft) return pickVariant(col, row, DIRT_BLOB_LEFT_VARIANTS);
  if (missingRight) return pickVariant(col, row, DIRT_BLOB_RIGHT_VARIANTS);
  return pickVariant(col, row, DIRT_BLOB_FILL_VARIANTS);
}
