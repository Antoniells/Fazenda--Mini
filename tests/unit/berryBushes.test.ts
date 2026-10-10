import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { BERRY_BUSH_FRAMES, BERRY_BUSH_PATH, BERRY_DAYS_TO_FRUIT, FARM_BERRY_BUSHES, berryBushFrame, daysUntilBerries } from '../../src/data/berryBushes';
import { BERRY_ICON_PATH, RESOURCES, WILD_BERRY } from '../../src/data/resources';
import { EXTRA_FARM_TREE_BATCHES } from '../../src/data/trees';
import { FLOWER_DETAILS } from '../../src/data/grassDetails';
import { forageKindOfGrassDetail } from '../../src/data/forage';
import { farmMap } from '../../src/data/maps/farmMap';
import { PLOT_LEVELS } from '../../src/systems/farmUpgrades';
import { gameState } from '../../src/systems/gameState';
import { advanceBerryBushes, berryBushDays, markBerryBushHarvested } from '../../src/systems/berryBushState';

describe('arbustos frutíferos', () => {
  it('o ciclo: liso ao colher, florindo, florido e com frutas no 5º dia (e parado com frutas até a colheita)', () => {
    expect(BERRY_DAYS_TO_FRUIT).toBe(5);
    expect([0, 1, 2, 3, 4, 5, 9].map(berryBushFrame)).toEqual([
      BERRY_BUSH_FRAMES.bare,
      BERRY_BUSH_FRAMES.budding,
      BERRY_BUSH_FRAMES.budding,
      BERRY_BUSH_FRAMES.flowering,
      BERRY_BUSH_FRAMES.flowering,
      BERRY_BUSH_FRAMES.fruit,
      BERRY_BUSH_FRAMES.fruit,
    ]);
    expect([0, 1, 3, 5, 7].map(daysUntilBerries)).toEqual([5, 4, 2, 0, 0]);

    gameState.berryBushes = {};
    const [col, row] = FARM_BERRY_BUSHES[0];
    expect(berryBushDays(col, row)).toBe(BERRY_DAYS_TO_FRUIT); // Arbusto que o save não conhece já tem frutas.
    markBerryBushHarvested(col, row);
    expect(berryBushDays(col, row)).toBe(0);
    for (let day = 0; day < 4; day++) advanceBerryBushes();
    expect(berryBushDays(col, row)).toBe(4);
    for (let day = 0; day < 3; day++) advanceBerryBushes();
    expect(berryBushDays(col, row)).toBe(BERRY_DAYS_TO_FRUIT);
  });

  it('a Frutinha Silvestre é comestível e vendável, e as artes existem', () => {
    expect(RESOURCES[WILD_BERRY.id]).toBe(WILD_BERRY);
    expect(WILD_BERRY.edible).toBe(true);
    expect(WILD_BERRY.sellPrice ?? 0).toBeGreaterThan(0);
    expect(existsSync(join('assets', BERRY_BUSH_PATH))).toBe(true);
    expect(existsSync(join('assets', BERRY_ICON_PATH))).toBe(true);
  });

  it('arbustos e árvores extras: posições únicas, dentro do mapa, sem cair em árvore/pedra do mapa nem na lavoura no tamanho máximo', () => {
    const plot = PLOT_LEVELS[PLOT_LEVELS.length - 1];
    const inPlot = (col: number, row: number): boolean => col >= plot.col0 - 1 && col <= plot.col0 + plot.cols && row >= plot.row0 - 1 && row <= plot.row0 + plot.rows;
    const taken = new Set([...farmMap.treePositions, ...farmMap.rockPositions].map(([col, row]) => `${col},${row}`));
    const cells: Array<[number, number]> = [...FARM_BERRY_BUSHES, ...EXTRA_FARM_TREE_BATCHES.flatMap((batch) => batch.trees.map((tree) => [tree.col, tree.row] as [number, number]))];
    const seen = new Set<string>();
    for (const [col, row] of cells) {
      const key = `${col},${row}`;
      expect(seen.has(key), `repetida ${key}`).toBe(false);
      seen.add(key);
      expect(taken.has(key), key).toBe(false);
      expect(col >= 0 && col < farmMap.cols && row >= 0 && row < farmMap.rows, key).toBe(true);
    }
    for (const [col, row] of FARM_BERRY_BUSHES) expect(inPlot(col, row), `arbusto ${col},${row}`).toBe(false);
    expect(new Set(EXTRA_FARM_TREE_BATCHES.map((batch) => batch.id)).size).toBe(EXTRA_FARM_TREE_BATCHES.length);
  });

  it('as flores novas da grama são colhidas com a Foice como flor', () => {
    expect(FLOWER_DETAILS.length).toBeGreaterThanOrEqual(4);
    for (const detail of FLOWER_DETAILS) expect(forageKindOfGrassDetail(detail.id), detail.id).toBe('flower');
  });
});
