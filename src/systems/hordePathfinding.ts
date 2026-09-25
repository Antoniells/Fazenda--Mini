import { WalkableGrid } from './grid';
import { GridPoint } from './pathfinding';

interface Node {
  col: number;
  row: number;
  g: number;
  f: number;
  parent: Node | null;
}

const key = (col: number, row: number): string => `${col},${row}`;
const heuristic = (a: GridPoint, b: GridPoint): number => Math.abs(a.col - b.col) + Math.abs(a.row - b.row);

/**
 * A* em grid (4 direções) onde algumas células BLOQUEADAS podem ser atravessadas por um custo extra — as cercas: um
 * inimigo da horda pode "abrir caminho" quebrando uma, mas só se isso compensar frente a dar a volta (o portão). Uma
 * célula bloqueada que `isBreakable` aceita custa `breakCost` passos em vez de 1; qualquer outra bloqueada é parede
 * (árvore, pedra, casa, água). O destino sempre vale, mesmo bloqueado (o alvo pode ser a própria cerca). Devolve as
 * células do caminho (sem o ponto de partida) ou `null` se não há rota. Mesma técnica de lista aberta simples de
 * `pathfinding.ts` — o mapa é pequeno.
 */
export function findWeightedPath(
  grid: WalkableGrid,
  start: GridPoint,
  goal: GridPoint,
  isBreakable: (col: number, row: number) => boolean,
  breakCost: number,
): GridPoint[] | null {
  if (start.col === goal.col && start.row === goal.row) return [];

  const open = new Map<string, Node>();
  const closed = new Set<string>();
  open.set(key(start.col, start.row), { col: start.col, row: start.row, g: 0, f: heuristic(start, goal), parent: null });

  const offsets = [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ];

  while (open.size > 0) {
    let current: Node | null = null;
    for (const node of open.values()) if (!current || node.f < current.f) current = node;
    if (!current) break;

    if (current.col === goal.col && current.row === goal.row) {
      const path: GridPoint[] = [];
      for (let step: Node | null = current; step && step.parent; step = step.parent) path.unshift({ col: step.col, row: step.row });
      return path;
    }

    open.delete(key(current.col, current.row));
    closed.add(key(current.col, current.row));

    for (const [dCol, dRow] of offsets) {
      const col = current.col + dCol;
      const row = current.row + dRow;
      if (!grid.inBounds(col, row) || closed.has(key(col, row))) continue;

      const isGoal = col === goal.col && row === goal.row;
      let stepCost = 1;
      if (!grid.isWalkable(col, row)) {
        if (isBreakable(col, row)) stepCost = breakCost;
        else if (!isGoal) continue;
      }

      const g = current.g + stepCost;
      const existing = open.get(key(col, row));
      if (!existing || g < existing.g) open.set(key(col, row), { col, row, g, f: g + heuristic({ col, row }, goal), parent: current });
    }
  }

  return null;
}
