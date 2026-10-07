import { describe, expect, it } from 'vitest';
import { CHERRY_TREE_CHANCE, LEAFY_TREE_CHANCE, isCherryTreeCell, treeLookAt } from '../../src/systems/treeVariety';
import { findDuckLanes } from '../../src/systems/duckLanes';

describe('cerejeira rara', () => {
  it('é rara: perto de CHERRY_TREE_CHANCE das células, nem nenhuma nem a maioria', () => {
    let cherries = 0;
    const size = 200;
    for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) if (isCherryTreeCell(col, row)) cherries++;
    const rate = cherries / (size * size);
    expect(rate).toBeGreaterThan(CHERRY_TREE_CHANCE * 0.7);
    expect(rate).toBeLessThan(CHERRY_TREE_CHANCE * 1.3);
  });

  it('a mesma célula dá sempre a mesma árvore', () => {
    for (let col = 0; col < 40; col++) expect(isCherryTreeCell(col, 7)).toBe(isCherryTreeCell(col, 7));
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

describe('árvore verde da Fazenda', () => {
  it('só na Fazenda, nunca no lugar de uma cerejeira, e também rara', () => {
    // Conta no laço e confere uma vez só (um expect por célula deixava o teste lento a ponto de estourar o tempo com a máquina ocupada).
    let leafy = 0;
    let leafyInForest = 0;
    let cherryReplaced = 0;
    const size = 200;
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        if (treeLookAt(col, row, 'forest') === 'leafy') leafyInForest++;
        const look = treeLookAt(col, row, 'farm');
        if (isCherryTreeCell(col, row) && look !== 'cherry') cherryReplaced++;
        if (look === 'leafy') leafy++;
      }
    }
    expect(leafyInForest).toBe(0);
    expect(cherryReplaced).toBe(0);
    const rate = leafy / (size * size);
    expect(rate).toBeGreaterThan(LEAFY_TREE_CHANCE * (1 - CHERRY_TREE_CHANCE) * 0.7);
    expect(rate).toBeLessThan(LEAFY_TREE_CHANCE * 1.3);
  });
});
