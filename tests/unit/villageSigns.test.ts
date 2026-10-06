import { describe, expect, it } from 'vitest';
import { SHOP_SIGNS } from '../../src/data/villageSigns';
import { VILLAGE_COLS, VILLAGE_ROWS, VILLAGE_STRUCTURES, VILLAGE_WELL, structureDoorCell, villageBlockedCells } from '../../src/data/maps/villageMap';
import { VILLAGE_LIGHT_SOURCES } from '../../src/data/lighting';
import { shopSignBaseCells, shopSignBlockedCells } from '../../src/systems/villageSigns';

const key = (col: number, row: number): string => `${col},${row}`;

/** O que já bloqueia o Vilarejo sem as placas: a borda do mapa, as casas, árvores, poço, colisões do editor e os postes. */
function baseBlocked(): Set<string> {
  const blocked = new Set(villageBlockedCells().map(([col, row]) => key(col, row)));
  for (const { col, row } of VILLAGE_LIGHT_SOURCES) blocked.add(key(col, row));
  for (let col = 0; col < VILLAGE_COLS; col++) {
    blocked.add(key(col, 0));
    blocked.add(key(col, VILLAGE_ROWS - 1));
  }
  for (let row = 0; row < VILLAGE_ROWS; row++) {
    blocked.add(key(0, row));
    blocked.add(key(VILLAGE_COLS - 1, row));
  }
  blocked.delete(key(0, Math.floor(VILLAGE_ROWS / 2))); // A ponte de volta à Fazenda (parede oeste).
  return blocked;
}

/** Células andáveis alcançáveis a partir da ponte. */
function reachableFromBridge(blocked: Set<string>): Set<string> {
  const start = { col: 1, row: Math.floor(VILLAGE_ROWS / 2) };
  const seen = new Set([key(start.col, start.row)]);
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const { col, row } = queue[head];
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const c = col + dc;
      const r = row + dr;
      if (c < 0 || r < 0 || c >= VILLAGE_COLS || r >= VILLAGE_ROWS || blocked.has(key(c, r)) || seen.has(key(c, r))) continue;
      seen.add(key(c, r));
      queue.push({ col: c, row: r });
    }
  }
  return seen;
}

describe('placas das lojas do Vilarejo', () => {
  const blocked = baseBlocked();
  const doorFronts = VILLAGE_STRUCTURES.flatMap((structure) => {
    const front = structureDoorCell(structure);
    return front ? [front] : [];
  });

  it('cada placa fica em chão livre, dentro do mapa, e nunca na frente de uma porta', () => {
    for (const sign of SHOP_SIGNS) {
      const cells = shopSignBaseCells(sign);
      expect(cells, sign.role).not.toBeNull();
      for (const [col, row] of cells!) {
        expect(blocked.has(key(col, row)), `${sign.role} em ${col},${row}`).toBe(false);
        expect(doorFronts.some((front) => front.col === col && front.row === row), `${sign.role} na frente de uma porta`).toBe(false);
        // A célula de cima (o painel) também não pode cobrir a frente de uma porta.
        expect(doorFronts.some((front) => front.col === col && front.row === row - 1)).toBe(false);
      }
    }
  });

  it('nenhuma placa fecha caminho: as portas, o poço e o resto do Vilarejo continuam alcançáveis da ponte', () => {
    const before = reachableFromBridge(blocked);
    const signCells = shopSignBlockedCells();
    const after = reachableFromBridge(new Set([...blocked, ...signCells.map(([col, row]) => key(col, row))]));
    expect(after.size).toBe(before.size - signCells.length);
    for (const front of doorFronts) expect(after.has(key(front.col, front.row)), `porta ${front.col},${front.row}`).toBe(true);
    expect(after.has(key(VILLAGE_WELL.col, VILLAGE_WELL.row + 1))).toBe(true);
  });
});
