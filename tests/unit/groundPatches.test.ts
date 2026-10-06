import { describe, expect, it } from 'vitest';
import { GRASS_TILESET_COLUMNS, PATCH_GROUP_COL, PATCH_GROUP_COLS, PATCH_GROUP_ROW, PATCH_GROUP_ROWS, PATCH_TILE_BY_MASK } from '../../src/data/groundPatches';
import { GRASS_FLAT_TILE_INDEX } from '../../src/data/tiles';
import { isPatchCell, patchField, pickGroundTileVariant, pickPatchTile } from '../../src/systems/groundVariation';

const allGrass = (): boolean => true;

describe('manchas orgânicas de grama', () => {
  it('o autotile cobre as 47 combinações de vizinhos, todas dentro do grupo da grama escura', () => {
    const masks = Object.keys(PATCH_TILE_BY_MASK).map(Number);
    expect(masks).toHaveLength(47);
    for (const mask of masks) {
      // Diagonal só vale com os dois lados dela ligados.
      const side = (bit: number): boolean => (mask & bit) !== 0;
      if (side(16)) expect(side(1) && side(8)).toBe(true);
      if (side(32)) expect(side(1) && side(2)).toBe(true);
      if (side(64)) expect(side(4) && side(8)).toBe(true);
      if (side(128)) expect(side(4) && side(2)).toBe(true);
      const tile = PATCH_TILE_BY_MASK[mask];
      const col = tile % GRASS_TILESET_COLUMNS;
      const row = Math.floor(tile / GRASS_TILESET_COLUMNS);
      expect(col).toBeGreaterThanOrEqual(PATCH_GROUP_COL);
      expect(col).toBeLessThan(PATCH_GROUP_COL + PATCH_GROUP_COLS);
      expect(row).toBeGreaterThanOrEqual(PATCH_GROUP_ROW);
      expect(row).toBeLessThan(PATCH_GROUP_ROW + PATCH_GROUP_ROWS);
    }
    expect(new Set(Object.values(PATCH_TILE_BY_MASK)).size).toBe(47);
  });

  it('miolo e mancha isolada usam as peças certas', () => {
    expect(pickPatchTile(0, 0, () => true)).toBe(69);
    expect(pickPatchTile(0, 0, (col, row) => col === 0 && row === 0)).toBe(84);
    // Faixa horizontal (vizinhos a leste e oeste) e a ponta de baixo de uma faixa vertical.
    expect(pickPatchTile(5, 5, (_col, row) => row === 5)).toBe(86);
    expect(pickPatchTile(5, 5, (col, row) => col === 5 && row <= 5)).toBe(60);
  });

  it('todo desenho de mancha num campo grande tem peça (nenhuma combinação sem tile)', () => {
    const isPatch = (col: number, row: number): boolean => isPatchCell(col, row, allGrass);
    for (let row = -40; row < 80; row++) {
      for (let col = -40; col < 120; col++) {
        if (isPatch(col, row)) expect(pickPatchTile(col, row, isPatch), `${col},${row}`).toBeDefined();
      }
    }
  });

  it('é determinístico e cobre uma fração moderada da grama, sem quadrados soltos', () => {
    let patches = 0;
    let total = 0;
    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 100; col++) {
        expect(patchField(col, row)).toBe(patchField(col, row));
        if (isPatchCell(col, row, allGrass)) patches++;
        total++;
      }
    }
    expect(patches / total).toBeGreaterThan(0.12);
    expect(patches / total).toBeLessThan(0.35);
  });

  it('mancha nunca encosta em terra, água ou piso (as 8 vizinhas precisam ser grama)', () => {
    // Acha uma célula que seria mancha e põe "terra" numa diagonal dela.
    let found: [number, number] | null = null;
    for (let col = 0; col < 200 && !found; col++) if (isPatchCell(col, 10, allGrass)) found = [col, 10];
    expect(found).not.toBeNull();
    const [col, row] = found!;
    expect(isPatchCell(col, row, (c, r) => !(c === col + 1 && r === row + 1))).toBe(false);
  });

  it('o chão-base é sempre a grama clara (o tom escuro só vem nas manchas)', () => {
    for (let index = 0; index < 50; index++) expect(pickGroundTileVariant(index * 3, index * 7)).toBe(GRASS_FLAT_TILE_INDEX);
  });
});
