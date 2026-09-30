import { CaveFloorConfig } from '../data/caveFloors';
import { AZURITE_GUARANTEED, AZURITE_MIN_FLOOR, CAVE_ORE_ROSTER, caveOreCount } from '../data/caveLandmarks';
import type { OreKind } from '../data/ores';
import type { CaveLayout } from './caveGenerator';

export interface CaveOrePlacement {
  kind: OreKind;
  col: number;
  row: number;
}

/** Tipos de veio sorteáveis neste andar, com o peso já ajustado pela profundidade (`CAVE_ORE_ROSTER`). */
export function caveOreWeights(floor: number): Array<{ kind: OreKind; weight: number }> {
  return CAVE_ORE_ROSTER.filter((entry) => floor >= entry.minFloor && (entry.maxFloor === undefined || floor <= entry.maxFloor)).map((entry) => ({
    kind: entry.kind,
    weight: entry.weight + (entry.weightPerFloor ?? 0) * (floor - entry.minFloor),
  }));
}

function pickKind(weights: Array<{ kind: OreKind; weight: number }>, random: () => number): OreKind {
  const total = weights.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = random() * total;
  for (const entry of weights) {
    roll -= entry.weight;
    if (roll < 0) return entry.kind;
  }
  return weights[weights.length - 1].kind;
}

/** Quantas células abertas se alcançam da chegada (as `blocked` contam como parede). */
function reachable(layout: CaveLayout, blocked: Set<string>): number {
  const { cols, rows, walls, playerSpawn } = layout;
  const seen = new Set<string>([`${playerSpawn.col},${playerSpawn.row}`]);
  const queue = [playerSpawn];
  for (let head = 0; head < queue.length; head += 1) {
    const { col, row } = queue[head];
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const c = col + dc;
      const r = row + dr;
      const key = `${c},${r}`;
      if (c < 0 || r < 0 || c >= cols || r >= rows || walls[r][c] || blocked.has(key) || seen.has(key)) continue;
      seen.add(key);
      queue.push({ col: c, row: r });
    }
  }
  return seen.size;
}

/**
 * Sorteia os VEIOS de um andar (a cada visita, como os inimigos — o desenho do andar continua o mesmo, `systems/caveGenerator.ts`):
 * - só em chão encostado numa parede (veio "na rocha"), longe das escadas e fora de `occupied` (onde os inimigos nascem);
 * - um veio só entra se não isolar nenhum pedaço do andar (a mesma área continua alcançável, menos a própria célula);
 * - o tipo segue a profundidade e a raridade (`CAVE_ORE_ROSTER`); do andar 45 pra baixo, ao menos um é de Azurita.
 */
export function placeCaveOres(config: CaveFloorConfig, layout: CaveLayout, occupied: Set<string>, random: () => number = Math.random): CaveOrePlacement[] {
  const { cols, rows, walls, stairsUp, stairsDown } = layout;
  const nearStairs = (col: number, row: number): boolean =>
    (Math.abs(col - stairsUp.col) <= 2 && row >= stairsUp.row - 3) || (Math.abs(col - stairsDown.col) <= 2 && row <= 4);
  const isWall = (col: number, row: number): boolean => col < 0 || row < 0 || col >= cols || row >= rows || walls[row][col];

  const candidates: Array<{ col: number; row: number }> = [];
  for (let row = 1; row < rows - 1; row += 1) {
    for (let col = 1; col < cols - 1; col += 1) {
      if (walls[row][col] || nearStairs(col, row) || occupied.has(`${col},${row}`)) continue;
      if (isWall(col + 1, row) || isWall(col - 1, row) || isWall(col, row + 1) || isWall(col, row - 1)) candidates.push({ col, row });
    }
  }
  for (let i = candidates.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  const weights = caveOreWeights(config.floor);
  const wanted = caveOreCount(config.floor);
  const blocked = new Set<string>();
  const baseline = reachable(layout, blocked);
  const placed: CaveOrePlacement[] = [];
  for (const cell of candidates) {
    if (placed.length >= wanted) break;
    const key = `${cell.col},${cell.row}`;
    blocked.add(key);
    if (reachable(layout, blocked) !== baseline - blocked.size) {
      blocked.delete(key); // Fecharia uma passagem.
      continue;
    }
    placed.push({ kind: pickKind(weights, random), ...cell });
  }

  if (AZURITE_GUARANTEED && config.floor >= AZURITE_MIN_FLOOR && placed.length > 0 && !placed.some((ore) => ore.kind === 'azurite')) {
    placed[Math.floor(random() * placed.length)].kind = 'azurite';
  }
  return placed;
}
