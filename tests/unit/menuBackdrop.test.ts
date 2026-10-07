import { describe, expect, it } from 'vitest';
import {
  MENU_BACKDROP_COLS,
  MENU_BACKDROP_LAYOUT,
  MENU_BACKDROP_ROWS,
  MENU_CHICKEN_YARD,
  MENU_FARMER_ROUTE,
  MENU_FARMER_START,
  MENU_FIELD_COLUMNS,
  MENU_PROPS,
  MENU_TREES,
  menuBackdropCell,
  MENU_DUCK_COUNT,
  isMenuDuckWater,
  isUnderMenuWaterfall,
} from '../../src/data/menuBackdrop';
import { findDuckLanes } from '../../src/systems/duckLanes';

const cell = (col: number, row: number): string => MENU_BACKDROP_LAYOUT[row]?.[col] ?? '?';

describe('fundo animado do menu', () => {
  it('o mapa tem o tamanho da tela (40 x 23) e só os caracteres conhecidos', () => {
    expect(MENU_BACKDROP_LAYOUT).toHaveLength(MENU_BACKDROP_ROWS);
    for (const line of MENU_BACKDROP_LAYOUT) {
      expect(line).toHaveLength(MENU_BACKDROP_COLS);
      expect(line).toMatch(/^[.wdt]+$/);
    }
  });

  it('toda faixa de terra tem pelo menos 2 células de largura e de altura (o blob de terra não tem peça de faixa fina)', () => {
    const dirt = (col: number, row: number): boolean => menuBackdropCell(col, row) === 'd';
    for (let row = 0; row < MENU_BACKDROP_ROWS; row++) {
      for (let col = 0; col < MENU_BACKDROP_COLS; col++) {
        if (!dirt(col, row)) continue;
        expect(dirt(col - 1, row) || dirt(col + 1, row), `terra fina na horizontal em ${col},${row}`).toBe(true);
        expect(dirt(col, row - 1) || dirt(col, row + 1), `terra fina na vertical em ${col},${row}`).toBe(true);
      }
    }
  });

  it('árvores, enfeites e o galinheiro ficam na grama; cada coluna da lavoura tem terra arada', () => {
    for (const tree of MENU_TREES) expect(cell(tree.col, tree.row), `árvore ${tree.col},${tree.row}`).toBe('.');
    for (const [col, row, id] of MENU_PROPS) expect(cell(col, row), `${id} ${col},${row}`).toBe('.');
    const { col0, row0, col1, row1 } = MENU_CHICKEN_YARD;
    for (let row = row0; row <= row1; row++) for (let col = col0; col <= col1; col++) expect(cell(col, row), `galinheiro ${col},${row}`).toBe('.');
    for (const column of MENU_FIELD_COLUMNS) expect(MENU_BACKDROP_LAYOUT.some((_, row) => cell(column.col, row) === 't')).toBe(true);
  });

  it('os patos nadam no rio sem passar pela cachoeira (nem encostar nela)', () => {
    const lanes = findDuckLanes(isMenuDuckWater, MENU_BACKDROP_COLS, MENU_BACKDROP_ROWS, MENU_DUCK_COUNT);
    expect(lanes).toHaveLength(MENU_DUCK_COUNT);
    for (const lane of lanes) {
      for (let col = Math.min(lane.fromCol, lane.toCol); col <= Math.max(lane.fromCol, lane.toCol); col++) {
        expect(cell(col, lane.row), `pato fora d'água em ${col},${lane.row}`).toBe('w');
        for (const [dc, dr] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) expect(isUnderMenuWaterfall(col + dc, lane.row + dr), `pato na cachoeira em ${col},${lane.row}`).toBe(false);
      }
    }
  });

  it('o fazendeiro só anda pelo caminho de terra, em linha reta de uma parada à outra', () => {
    let at = MENU_FARMER_START;
    expect(cell(at.col, at.row)).toBe('d');
    for (const step of MENU_FARMER_ROUTE) {
      if (!('col' in step)) continue;
      expect(step.col === at.col || step.row === at.row, `${at.col},${at.row} → ${step.col},${step.row}`).toBe(true);
      const [dc, dr] = [Math.sign(step.col - at.col), Math.sign(step.row - at.row)];
      for (let col = at.col, row = at.row; col !== step.col || row !== step.row; col += dc, row += dr) expect(cell(col, row), `${col},${row}`).toBe('d');
      expect(cell(step.col, step.row)).toBe('d');
      at = step;
    }
  });
});
