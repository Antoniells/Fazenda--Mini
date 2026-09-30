import { CaveFloorConfig } from '../data/caveFloors';

export interface Cell {
  col: number;
  row: number;
}

/** O desenho de um andar: quais células são parede, onde ficam as escadas e onde os bichos podem nascer. Puro dado (sem Phaser) — testável e sempre igual pra o mesmo andar. */
export interface CaveLayout {
  cols: number;
  rows: number;
  /** `walls[row][col]`: parede (borda + blocos internos). */
  walls: boolean[][];
  /** A escada por onde o jogador chegou (sobe pro andar de cima); ele nasce na célula logo acima dela. */
  stairsUp: Cell;
  playerSpawn: Cell;
  /** A escada que desce pro próximo andar. */
  stairsDown: Cell;
  /** Células andáveis alcançáveis e longe da chegada, embaralhadas — de onde os inimigos nascem. */
  spawnCells: Cell[];
}

/** Gerador pseudoaleatório pequeno e determinístico (mulberry32): o mesmo número de andar gera sempre o mesmo layout. */
function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Distância mínima (em células) da chegada até onde um inimigo pode nascer — ninguém nasce em cima do jogador. */
const MIN_SPAWN_DISTANCE = 8;

function flood(walls: boolean[][], cols: number, rows: number, from: Cell): Map<string, number> {
  const distance = new Map<string, number>();
  const queue: Cell[] = [from];
  distance.set(`${from.col},${from.row}`, 0);
  for (let head = 0; head < queue.length; head++) {
    const { col, row } = queue[head];
    const d = distance.get(`${col},${row}`)!;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const c = col + dc;
      const r = row + dr;
      if (c < 0 || r < 0 || c >= cols || r >= rows || walls[r][c] || distance.has(`${c},${r}`)) continue;
      distance.set(`${c},${r}`, d + 1);
      queue.push({ col: c, row: r });
    }
  }
  return distance;
}

function attempt(config: CaveFloorConfig, seed: number, withInnerWalls: boolean): CaveLayout | null {
  const { cols, rows } = config;
  const random = makeRandom(seed);
  const walls: boolean[][] = Array.from({ length: rows }, (_, row) => Array.from({ length: cols }, (_, col) => row === 0 || col === 0 || row === rows - 1 || col === cols - 1));

  const stairsUp: Cell = { col: Math.floor(cols / 2), row: rows - 2 };
  const playerSpawn: Cell = { col: stairsUp.col, row: stairsUp.row - 1 };
  const stairsDown: Cell = { col: 3 + Math.floor(random() * (cols - 6)), row: 1 };

  // Áreas que ficam sempre livres: em volta da chegada e da escada de descida.
  const isReserved = (col: number, row: number): boolean =>
    (Math.abs(col - stairsUp.col) <= 2 && row >= stairsUp.row - 3) || (Math.abs(col - stairsDown.col) <= 2 && row <= 4);

  if (withInnerWalls) {
    const blocks = Math.floor(cols * rows * config.wallDensity * 0.45);
    for (let i = 0; i < blocks; i++) {
      const w = 1 + Math.floor(random() * 3);
      const h = 1 + Math.floor(random() * 2);
      const col = 2 + Math.floor(random() * (cols - 4 - w));
      const row = 2 + Math.floor(random() * (rows - 4 - h));
      for (let dr = 0; dr < h; dr++) for (let dc = 0; dc < w; dc++) if (!isReserved(col + dc, row + dr)) walls[row + dr][col + dc] = true;
    }
  }

  const distance = flood(walls, cols, rows, playerSpawn);
  if (!distance.has(`${stairsDown.col},${stairsDown.row}`)) return null;
  const openCells = walls.flat().filter((wall) => !wall).length;
  if (distance.size < openCells * 0.9) return null; // Sem cantos isolados: quase todo o espaço aberto é alcançável.

  const spawnCells: Cell[] = [];
  for (const [key, d] of distance) {
    if (d < MIN_SPAWN_DISTANCE) continue;
    const [col, row] = key.split(',').map(Number);
    if (Math.abs(col - stairsDown.col) <= 1 && row <= 3) continue;
    spawnCells.push({ col, row });
  }
  if (spawnCells.length < 12) return null;
  // Embaralha (Fisher-Yates com o mesmo gerador).
  for (let i = spawnCells.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [spawnCells[i], spawnCells[j]] = [spawnCells[j], spawnCells[i]];
  }
  return { cols, rows, walls, stairsUp, playerSpawn, stairsDown, spawnCells };
}

/** O santuário do andar 100 (Fase 11, `data/sanctuary.ts`): o mesmo andar, mas um salão aberto, sem paredes internas. */
export function generateSanctuaryFloor(config: CaveFloorConfig): CaveLayout {
  return attempt(config, config.floor * 7919 + 13, false)!;
}

/** Gera o andar (sempre o mesmo pra o mesmo `config.floor`). Tenta algumas sementes até o desenho ficar conectado; no pior caso, um salão sem paredes internas. */
export function generateCaveFloor(config: CaveFloorConfig): CaveLayout {
  for (let n = 0; n < 24; n++) {
    const layout = attempt(config, config.floor * 7919 + n * 104729 + 13, true);
    if (layout) return layout;
  }
  return attempt(config, config.floor * 7919 + 13, false)!;
}
