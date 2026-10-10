import { describe, expect, it } from 'vitest';
import { forestMap } from '../../src/data/maps/forestMap';
import { FOREST_LAKE_ROCKS, FOREST_OLD_SIZE, FOREST_WATERFALL, forestLakeRockCells, forestWaterfallCells, isForestDuckObstacle, isForestExpansionCell } from '../../src/data/forestFeatures';
import { FOREST_PORTAL, forestPortalCells } from '../../src/data/hiddenForest';
import { FOREST_DUCKS } from '../../src/data/ducks';
import { waterCellsFromGround } from '../../src/systems/waterCells';
import { findDuckLanes } from '../../src/systems/duckLanes';
import { nextPondChange } from '../../src/systems/ducks';

const key = (col: number, row: number): string => `${col},${row}`;
const water = new Set(waterCellsFromGround(forestMap.ground).map(([col, row]) => key(col, row)));
const fall = new Set(forestWaterfallCells().map(([col, row]) => key(col, row)));

describe('a Floresta maior, com o lago e a cachoeira', () => {
  it('tem 56 x 42 (cresceu só pra leste e pro sul) e o chão cobre o mapa todo', () => {
    expect([forestMap.cols, forestMap.rows]).toEqual([56, 42]);
    expect(forestMap.ground).toHaveLength(42);
    for (const line of forestMap.ground ?? []) expect(line).toHaveLength(56);
    expect(isForestExpansionCell(FOREST_OLD_SIZE.cols - 1, FOREST_OLD_SIZE.rows - 1)).toBe(false);
    expect(isForestExpansionCell(FOREST_OLD_SIZE.cols, 0)).toBe(true);
    expect(isForestExpansionCell(0, FOREST_OLD_SIZE.rows)).toBe(true);
  });

  it('a cachoeira encosta na borda norte e cai direto no lago: as 2 linhas de baixo dela já são água (o lago sobe por trás e envolve o pé do paredão), as 2 de cima não', () => {
    expect(FOREST_WATERFALL.row).toBe(0);
    const bottom = FOREST_WATERFALL.row + FOREST_WATERFALL.rows - 1;
    for (let col = FOREST_WATERFALL.col; col < FOREST_WATERFALL.col + FOREST_WATERFALL.cols; col++) {
      for (let row = FOREST_WATERFALL.row; row < bottom - 1; row++) expect(water.has(key(col, row)), `${col},${row}`).toBe(false);
      for (let row = bottom - 1; row <= bottom + 1; row++) expect(water.has(key(col, row)), `${col},${row}`).toBe(true);
    }
    // Dos dois lados do pé da cachoeira também é água.
    expect(water.has(key(FOREST_WATERFALL.col - 1, bottom))).toBe(true);
    expect(water.has(key(FOREST_WATERFALL.col + FOREST_WATERFALL.cols, bottom))).toBe(true);
  });

  it('as rochas do lago ficam inteiras dentro da água', () => {
    expect(FOREST_LAKE_ROCKS.length).toBeGreaterThanOrEqual(1);
    for (const [col, row] of forestLakeRockCells()) expect(water.has(key(col, row)), `${col},${row}`).toBe(true);
  });

  it('nenhuma árvore, pedra ou enfeite fica dentro da água, da cachoeira ou do portal da Floresta Oculta', () => {
    const portal = new Set([...forestPortalCells(), [FOREST_PORTAL.returnSpawn.col, FOREST_PORTAL.returnSpawn.row]].map(([col, row]) => key(col, row)));
    const things = [...forestMap.pineTreePositions, ...forestMap.birchTreePositions, ...forestMap.rockPositions, ...(forestMap.props ?? []).map(([col, row]) => [col, row] as [number, number])];
    for (const [col, row] of things) {
      expect(water.has(key(col, row)) || fall.has(key(col, row)) || portal.has(key(col, row)), `${col},${row}`).toBe(false);
      expect(col >= 0 && col < forestMap.cols && row >= 0 && row < forestMap.rows, `${col},${row}`).toBe(true);
    }
  });

  it('o lago tem uma raia pra cada pato, longe da margem, das rochas e da espuma da cachoeira', () => {
    const lanes = findDuckLanes((col, row) => water.has(key(col, row)) && !isForestDuckObstacle(col, row), forestMap.cols, forestMap.rows, FOREST_DUCKS);
    expect(lanes).toHaveLength(FOREST_DUCKS);
    // Nenhuma raia encosta numa rocha nem na cachoeira (nem na célula vizinha).
    for (const lane of lanes) {
      for (let col = Math.min(lane.fromCol, lane.toCol); col <= Math.max(lane.fromCol, lane.toCol); col++) {
        for (const [dc, dr] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) expect(isForestDuckObstacle(col + dc, lane.row + dr), `${col},${lane.row}`).toBe(false);
      }
    }
  });
});

describe('os patos vão e vêm', () => {
  it('sem pato só chega um; lotado só sai um; no meio, sai ou chega pelo sorteio', () => {
    expect(nextPondChange(0, 3, 0.1)).toBe('arrive');
    expect(nextPondChange(3, 3, 0.9)).toBe('leave');
    expect(nextPondChange(1, 3, 0.2)).toBe('leave');
    expect(nextPondChange(1, 3, 0.8)).toBe('arrive');
    expect(nextPondChange(0, 0, 0.5)).toBe(null);
  });
});
