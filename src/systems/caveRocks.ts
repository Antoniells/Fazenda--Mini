import { CAVE_ROCK_FRAMES, HIDDEN_STAIRS_MIN_DISTANCE, caveRockCount } from '../data/caveRocks';
import type { CaveLayout, Cell } from './caveGenerator';

export interface CaveRockPlacement extends Cell {
  /** Qual recorte de `CAVE_ROCK_FRAMES`. */
  variant: number;
}

export interface CaveRocksPlan {
  rocks: CaveRockPlacement[];
  /** A célula (uma das pedras) onde a escada de descida está escondida — `null` quando a escada fica à vista. */
  hiddenStairs: Cell | null;
}

export interface CaveRocksOptions {
  floor: number;
  /** Células que já estão ocupadas (onde os inimigos nascem, veios): pedra nenhuma entra nelas. */
  occupied: Set<string>;
  /** Células que já bloqueiam a passagem (os veios): contam como parede pra conferir que nenhuma pedra fecha um caminho. */
  blocked: Set<string>;
  /** Esconder a escada de descida debaixo de uma das pedras? (não no andar da barreira, no fundo nem pra quem sobe do andar de baixo). */
  hideStairs: boolean;
}

const key = (col: number, row: number): string => `${col},${row}`;

/** Distância a pé (passos, contornando paredes e `blocked`) da chegada até cada célula alcançável. */
function walkDistances(layout: CaveLayout, blocked: Set<string>): Map<string, number> {
  const { cols, rows, walls, playerSpawn } = layout;
  const distance = new Map<string, number>([[key(playerSpawn.col, playerSpawn.row), 0]]);
  const queue: Cell[] = [playerSpawn];
  for (let head = 0; head < queue.length; head += 1) {
    const { col, row } = queue[head];
    const d = distance.get(key(col, row))!;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const c = col + dc;
      const r = row + dr;
      const k = key(c, r);
      if (c < 0 || r < 0 || c >= cols || r >= rows || walls[r][c] || blocked.has(k) || distance.has(k)) continue;
      distance.set(k, d + 1);
      queue.push({ col: c, row: r });
    }
  }
  return distance;
}

/**
 * Sorteia as PEDRAS de um andar (a cada visita, como os veios e os inimigos — o desenho do andar continua o mesmo):
 * - em qualquer chão livre, fora da área de chegada, fora de `occupied` e, se a escada de descida estiver à vista, fora da área dela
 *   (no andar da barreira também fica o baú);
 * - uma pedra só entra se não isolar nenhum pedaço do andar (a mesma área continua alcançável, menos a própria célula) — o jogador
 *   nunca precisa quebrar pedra pra chegar a algum lugar, só pra achar a escada;
 * - com `hideStairs`, a escada vai pra debaixo de uma das pedras, sorteada entre as que ficam a `HIDDEN_STAIRS_MIN_DISTANCE` passos ou
 *   mais da chegada (sem nenhuma assim, a mais distante).
 */
export function planCaveRocks(layout: CaveLayout, options: CaveRocksOptions, random: () => number = Math.random): CaveRocksPlan {
  const { cols, rows, walls, stairsUp, stairsDown } = layout;
  const nearArrival = (col: number, row: number): boolean => Math.abs(col - stairsUp.col) <= 2 && row >= stairsUp.row - 3;
  const nearVisibleStairs = (col: number, row: number): boolean => !options.hideStairs && Math.abs(col - stairsDown.col) <= 2 && row <= stairsDown.row + 3;

  const candidates: Cell[] = [];
  for (let row = 1; row < rows - 1; row += 1) {
    for (let col = 1; col < cols - 1; col += 1) {
      if (walls[row][col] || nearArrival(col, row) || nearVisibleStairs(col, row) || options.occupied.has(key(col, row))) continue;
      candidates.push({ col, row });
    }
  }
  for (let i = candidates.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  const blocked = new Set(options.blocked);
  const baseline = walkDistances(layout, blocked).size;
  const wanted = caveRockCount(options.floor);
  const rocks: CaveRockPlacement[] = [];
  for (const cell of candidates) {
    if (rocks.length >= wanted) break;
    const k = key(cell.col, cell.row);
    blocked.add(k);
    if (walkDistances(layout, blocked).size !== baseline - rocks.length - 1) {
      blocked.delete(k); // Fecharia uma passagem (ou a célula nem era alcançável).
      continue;
    }
    rocks.push({ ...cell, variant: Math.floor(random() * CAVE_ROCK_FRAMES.length) });
  }

  let hiddenStairs: Cell | null = null;
  if (options.hideStairs && rocks.length > 0) {
    // Distância de cada pedra à chegada pelo chão SEM pedras (o caminho que o jogador faria quebrando o que estiver no meio).
    const distance = walkDistances(layout, new Set(options.blocked));
    const far = rocks.filter((rock) => (distance.get(key(rock.col, rock.row)) ?? 0) >= HIDDEN_STAIRS_MIN_DISTANCE);
    const pool = far.length > 0 ? far : [rocks.reduce((best, rock) => ((distance.get(key(rock.col, rock.row)) ?? 0) > (distance.get(key(best.col, best.row)) ?? 0) ? rock : best))];
    const chosen = pool[Math.floor(random() * pool.length)];
    hiddenStairs = { col: chosen.col, row: chosen.row };
  }
  return { rocks, hiddenStairs };
}
