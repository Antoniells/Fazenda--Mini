import { describe, expect, it } from 'vitest';
import { caveFloorConfig, CAVE_MAX_FLOOR } from '../../src/data/caveFloors';
import { generateCaveFloor, generateSanctuaryFloor, CaveLayout } from '../../src/systems/caveGenerator';
import { caveOreWeights, placeCaveOres } from '../../src/systems/caveOres';
import { AZURITE_MIN_FLOOR } from '../../src/data/caveLandmarks';

/** Células abertas alcançáveis da chegada, com `blocked` fechadas. */
function reachable(layout: CaveLayout, blocked: Set<string>): Set<string> {
  const seen = new Set([`${layout.playerSpawn.col},${layout.playerSpawn.row}`]);
  const queue = [layout.playerSpawn];
  for (let head = 0; head < queue.length; head += 1) {
    const { col, row } = queue[head];
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const c = col + dc;
      const r = row + dr;
      const key = `${c},${r}`;
      if (c < 0 || r < 0 || c >= layout.cols || r >= layout.rows || layout.walls[r][c] || blocked.has(key) || seen.has(key)) continue;
      seen.add(key);
      queue.push({ col: c, row: r });
    }
  }
  return seen;
}

/** Gerador determinístico pros testes. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

describe('andares da Caverna', () => {
  it('o mesmo andar gera sempre o mesmo desenho', () => {
    const a = generateCaveFloor(caveFloorConfig(37));
    const b = generateCaveFloor(caveFloorConfig(37));
    expect(a.walls).toEqual(b.walls);
    expect(a.stairsDown).toEqual(b.stairsDown);
  });

  it('o santuário é um salão sem paredes internas', () => {
    const layout = generateSanctuaryFloor(caveFloorConfig(CAVE_MAX_FLOOR));
    for (let row = 1; row < layout.rows - 1; row += 1) for (let col = 1; col < layout.cols - 1; col += 1) expect(layout.walls[row][col]).toBe(false);
  });
});

describe('minérios nos andares', () => {
  const floors = [1, 5, 12, 30, 44, 45, 50, 63, 88, CAVE_MAX_FLOOR];

  it.each(floors)('andar %i: veios em chão livre, sem fechar passagens', (floor) => {
    const config = caveFloorConfig(floor);
    const layout = generateCaveFloor(config);
    const occupied = new Set(layout.spawnCells.slice(0, config.enemyCount + 1).map((cell) => `${cell.col},${cell.row}`));
    const ores = placeCaveOres(config, layout, occupied, seeded(floor));
    const oreCells = new Set(ores.map((ore) => `${ore.col},${ore.row}`));

    expect(ores.length).toBeGreaterThan(0);
    for (const ore of ores) {
      expect(layout.walls[ore.row][ore.col]).toBe(false);
      expect(occupied.has(`${ore.col},${ore.row}`)).toBe(false);
    }
    // Tudo o que era alcançável continua alcançável (menos as próprias células dos veios), incluindo a escada de descida.
    const before = reachable(layout, new Set());
    const after = reachable(layout, oreCells);
    expect(after.size).toBe(before.size - oreCells.size);
    expect(after.has(`${layout.stairsDown.col},${layout.stairsDown.row}`)).toBe(true);
  });

  it.each(floors)('andar %i: só os tipos daquela profundidade', (floor) => {
    const allowed = new Set(caveOreWeights(floor).map((entry) => entry.kind));
    const config = caveFloorConfig(floor);
    const ores = placeCaveOres(config, generateCaveFloor(config), new Set(), seeded(floor * 3));
    for (const ore of ores) expect(allowed.has(ore.kind)).toBe(true);
    expect(ores.some((ore) => ore.kind === 'azurite')).toBe(floor >= AZURITE_MIN_FLOOR);
  });
});
