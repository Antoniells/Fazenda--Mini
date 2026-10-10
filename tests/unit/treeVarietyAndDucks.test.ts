import { describe, expect, it } from 'vitest';
import {
  WORLD_OAK_CHANCE,
  WORLD_PINK_OAK_CHANCE,
  acornIdForSpecies,
  isAcornId,
  resolveTreeSpecies,
  rollOakSpecies,
  speciesFromAcorn,
  worldTreeSpeciesAt,
} from '../../src/systems/treeVariety';
import { PINK_OAK_CHANCE, EXTRA_FARM_OAKS, MORE_FARM_TREES } from '../../src/data/trees';
import { PLOT_LEVELS } from '../../src/systems/farmUpgrades';
import { ACORN, BIRCH_ACORN, OAK_ACORN } from '../../src/data/resources';
import { farmMap } from '../../src/data/maps/farmMap';
import { isFarmCellFreeForResource } from '../../src/systems/farmResources';
import { findDuckLanes } from '../../src/systems/duckLanes';

describe('espécies das árvores do mundo (sem espécie guardada)', () => {
  it('pela célula: o Carvalho Rosa é raro, o Carvalho mais comum, o resto pinheiro — e a mesma célula dá sempre a mesma árvore', () => {
    // Conta no laço e confere uma vez só (um expect por célula deixa o teste lento).
    const counts = { pine: 0, oak: 0, 'pink-oak': 0, birch: 0 };
    let unstable = 0;
    const size = 200;
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const species = worldTreeSpeciesAt(col, row);
        counts[species]++;
        if (worldTreeSpeciesAt(col, row) !== species) unstable++;
      }
    }
    const total = size * size;
    expect(unstable).toBe(0);
    expect(counts.birch).toBe(0);
    expect(counts['pink-oak'] / total).toBeGreaterThan(WORLD_PINK_OAK_CHANCE * 0.7);
    expect(counts['pink-oak'] / total).toBeLessThan(WORLD_PINK_OAK_CHANCE * 1.3);
    expect(counts.oak / total).toBeGreaterThan(WORLD_OAK_CHANCE * (1 - WORLD_PINK_OAK_CHANCE) * 0.7);
    expect(counts.oak / total).toBeLessThan(WORLD_OAK_CHANCE * 1.3);
  });

  it('a espécie guardada no nó vence a da célula', () => {
    expect(resolveTreeSpecies('birch', 3, 3)).toBe('birch');
    expect(resolveTreeSpecies(undefined, 3, 3)).toBe(worldTreeSpeciesAt(3, 3));
  });
});

describe('bolotas', () => {
  it('cada árvore solta a bolota da sua espécie; o Carvalho Rosa solta a de Carvalho', () => {
    expect(acornIdForSpecies('pine')).toBe(ACORN.id);
    expect(acornIdForSpecies('birch')).toBe(BIRCH_ACORN.id);
    expect(acornIdForSpecies('oak')).toBe(OAK_ACORN.id);
    expect(acornIdForSpecies('pink-oak')).toBe(OAK_ACORN.id);
    expect([ACORN.id, OAK_ACORN.id, BIRCH_ACORN.id].every(isAcornId)).toBe(true);
    expect(isAcornId('wood')).toBe(false);
  });

  it('plantar faz nascer a espécie da bolota; a de Carvalho dá Carvalho Rosa com PINK_OAK_CHANCE (15%)', () => {
    expect(PINK_OAK_CHANCE).toBe(0.15);
    expect(speciesFromAcorn(ACORN.id)).toBe('pine');
    expect(speciesFromAcorn(BIRCH_ACORN.id)).toBe('birch');
    expect(speciesFromAcorn(OAK_ACORN.id, 0.1)).toBe('pink-oak');
    expect(speciesFromAcorn(OAK_ACORN.id, 0.15)).toBe('oak');
    expect(speciesFromAcorn(OAK_ACORN.id, 0.9)).toBe('oak');
    let pink = 0;
    for (let index = 0; index < 1000; index++) if (rollOakSpecies(index / 1000) === 'pink-oak') pink++;
    expect(pink).toBe(150);
  });
});

describe('os 6 Carvalhos novos da Fazenda', () => {
  it('são 6, em células livres de grama, sem cair em cima de árvore ou pedra do mapa', () => {
    expect(EXTRA_FARM_OAKS).toHaveLength(6);
    const taken = new Set([...farmMap.treePositions, ...farmMap.rockPositions].map(([col, row]) => `${col},${row}`));
    for (const [col, row] of EXTRA_FARM_OAKS) {
      expect(taken.has(`${col},${row}`), `${col},${row}`).toBe(false);
      expect(isFarmCellFreeForResource(col, row), `${col},${row}`).toBe(true);
    }
  });
});

describe('as 10 árvores a mais da Fazenda', () => {
  it('6 Carvalhos e 4 Pinheiros, em células livres, sem repetir nenhuma árvore/pedra e fora da lavoura no tamanho máximo', () => {
    expect(MORE_FARM_TREES.filter((tree) => tree.species === 'oak')).toHaveLength(6);
    expect(MORE_FARM_TREES.filter((tree) => tree.species === 'pine')).toHaveLength(4);
    const taken = new Set([...farmMap.treePositions, ...farmMap.rockPositions, ...EXTRA_FARM_OAKS].map(([col, row]) => `${col},${row}`));
    const plot = PLOT_LEVELS[PLOT_LEVELS.length - 1];
    for (const { col, row } of MORE_FARM_TREES) {
      expect(taken.has(`${col},${row}`), `${col},${row}`).toBe(false);
      expect(isFarmCellFreeForResource(col, row), `${col},${row}`).toBe(true);
      const inPlot = col >= plot.col0 - 1 && col <= plot.col0 + plot.cols && row >= plot.row0 - 1 && row <= plot.row0 + plot.rows;
      expect(inPlot, `${col},${row}`).toBe(false);
      taken.add(`${col},${row}`);
    }
  });
});

describe('raias dos patos', () => {
  // O lago da Floresta: colunas 14-20, fileiras 7-10, e a última fileira (11) começando na coluna 15.
  const lake = (col: number, row: number): boolean => (row >= 7 && row <= 10 && col >= 14 && col <= 20) || (row === 11 && col >= 15 && col <= 20);

  it('no lago da Floresta: duas raias longe da margem, em fileiras não vizinhas, a 2ª no sentido contrário', () => {
    const lanes = findDuckLanes(lake, 40, 30, 2);
    expect(lanes).toHaveLength(2);
    for (const lane of lanes) {
      const [from, to] = [Math.min(lane.fromCol, lane.toCol), Math.max(lane.fromCol, lane.toCol)];
      for (let col = from; col <= to; col++) {
        for (const [dc, dr] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) expect(lake(col + dc, lane.row + dr)).toBe(true);
      }
    }
    expect(Math.abs(lanes[0].row - lanes[1].row)).toBeGreaterThanOrEqual(2);
    expect(lanes[0].toCol > lanes[0].fromCol).toBe(true);
    expect(lanes[1].toCol < lanes[1].fromCol).toBe(true);
  });

  it('água estreita (um riacho de 2 células) não tem raia', () => {
    expect(findDuckLanes((col, row) => row >= 3 && row <= 4 && col < 30, 40, 10, 2)).toHaveLength(0);
  });
});
