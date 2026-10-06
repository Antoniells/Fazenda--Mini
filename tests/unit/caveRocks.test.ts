import { describe, expect, it } from 'vitest';
import { caveFloorConfig } from '../../src/data/caveFloors';
import { HIDDEN_STAIRS_MIN_DISTANCE, caveRockCount } from '../../src/data/caveRocks';
import { CaveLayout, generateCaveFloor } from '../../src/systems/caveGenerator';
import { planCaveRocks } from '../../src/systems/caveRocks';

/** Sorteio repetível pros testes. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const key = (col: number, row: number): string => `${col},${row}`;

/** Células alcançáveis da chegada, com `blocked` contando como parede. */
function reachable(layout: CaveLayout, blocked: Set<string>): Set<string> {
  const seen = new Set([key(layout.playerSpawn.col, layout.playerSpawn.row)]);
  const queue = [layout.playerSpawn];
  for (let head = 0; head < queue.length; head++) {
    const { col, row } = queue[head];
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const c = col + dc;
      const r = row + dr;
      if (c < 0 || r < 0 || c >= layout.cols || r >= layout.rows || layout.walls[r][c] || blocked.has(key(c, r)) || seen.has(key(c, r))) continue;
      seen.add(key(c, r));
      queue.push({ col: c, row: r });
    }
  }
  return seen;
}

/** Passos a pé da chegada até `target` (contornando paredes e `blocked`). */
function walkDistance(layout: CaveLayout, blocked: Set<string>, target: { col: number; row: number }): number {
  const distance = new Map([[key(layout.playerSpawn.col, layout.playerSpawn.row), 0]]);
  const queue = [layout.playerSpawn];
  for (let head = 0; head < queue.length; head++) {
    const { col, row } = queue[head];
    if (col === target.col && row === target.row) return distance.get(key(col, row))!;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const c = col + dc;
      const r = row + dr;
      if (c < 0 || r < 0 || c >= layout.cols || r >= layout.rows || layout.walls[r][c] || blocked.has(key(c, r)) || distance.has(key(c, r))) continue;
      distance.set(key(c, r), distance.get(key(col, row))! + 1);
      queue.push({ col: c, row: r });
    }
  }
  return -1;
}

describe('pedras das Cavernas e a escada escondida', () => {
  for (const floor of [1, 12, 37, 63, 99]) {
    it(`andar ${floor}: pedras no chão livre, sem fechar passagem, e a escada debaixo de uma delas, longe da chegada`, () => {
      const layout = generateCaveFloor(caveFloorConfig(floor));
      const ore = layout.spawnCells[layout.spawnCells.length - 2];
      const blocked = new Set([key(ore.col, ore.row)]);
      const occupied = new Set([...blocked, ...layout.spawnCells.slice(0, 5).map((cell) => key(cell.col, cell.row))]);
      const plan = planCaveRocks(layout, { floor, occupied, blocked, hideStairs: true }, seeded(floor));

      expect(plan.rocks.length).toBe(caveRockCount(floor));
      const cells = new Set(plan.rocks.map((rock) => key(rock.col, rock.row)));
      expect(cells.size).toBe(plan.rocks.length);
      for (const rock of plan.rocks) {
        expect(layout.walls[rock.row][rock.col]).toBe(false);
        expect(occupied.has(key(rock.col, rock.row))).toBe(false);
        // Nada na área de chegada (a escada de subida e o espaço em volta).
        expect(Math.abs(rock.col - layout.stairsUp.col) <= 2 && rock.row >= layout.stairsUp.row - 3).toBe(false);
      }

      // Nenhuma pedra isola um pedaço do andar: tudo que era alcançável continua, menos as próprias pedras.
      const before = reachable(layout, blocked);
      const after = reachable(layout, new Set([...blocked, ...cells]));
      expect(after.size).toBe(before.size - cells.size);

      // A escada está debaixo de uma das pedras, a pelo menos HIDDEN_STAIRS_MIN_DISTANCE passos da chegada.
      expect(plan.hiddenStairs).not.toBeNull();
      expect(cells.has(key(plan.hiddenStairs!.col, plan.hiddenStairs!.row))).toBe(true);
      expect(walkDistance(layout, blocked, plan.hiddenStairs!)).toBeGreaterThanOrEqual(HIDDEN_STAIRS_MIN_DISTANCE);
    });
  }

  it('com a escada à vista (andar da barreira, quem sobe do andar de baixo), nada a esconde e a área dela fica livre', () => {
    const layout = generateCaveFloor(caveFloorConfig(50));
    const plan = planCaveRocks(layout, { floor: 50, occupied: new Set(), blocked: new Set(), hideStairs: false }, seeded(50));
    expect(plan.hiddenStairs).toBeNull();
    expect(plan.rocks.length).toBeGreaterThan(0);
    for (const rock of plan.rocks) {
      expect(Math.abs(rock.col - layout.stairsDown.col) <= 2 && rock.row <= layout.stairsDown.row + 3).toBe(false);
    }
  });

  it('cada visita sorteia de novo (outro sorteio, outras pedras), mas o mesmo sorteio repete o mesmo andar', () => {
    const layout = generateCaveFloor(caveFloorConfig(20));
    const options = { floor: 20, occupied: new Set<string>(), blocked: new Set<string>(), hideStairs: true };
    const a = planCaveRocks(layout, options, seeded(1));
    const b = planCaveRocks(layout, options, seeded(1));
    const c = planCaveRocks(layout, options, seeded(2));
    expect(b).toEqual(a);
    expect(c.rocks).not.toEqual(a.rocks);
  });
});
