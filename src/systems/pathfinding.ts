import { WalkableGrid } from './grid';

export interface GridPoint {
  col: number;
  row: number;
}

interface Node {
  col: number;
  row: number;
  g: number;
  f: number;
  parent: Node | null;
}

const key = (col: number, row: number): string => `${col},${row}`;
const heuristic = (a: GridPoint, b: GridPoint): number =>
  Math.abs(a.col - b.col) + Math.abs(a.row - b.row);

/**
 * A* simples em grid (4 direções, heurística Manhattan). Retorna a lista de
 * células do caminho (sem incluir o ponto de partida), ou `null` se não
 * houver rota válida. Mapa é pequeno (poucas centenas de células), então uma
 * lista aberta simples (sem heap) é suficiente — não há necessidade de uma
 * biblioteca externa para isso.
 */
export function findPath(grid: WalkableGrid, start: GridPoint, goal: GridPoint): GridPoint[] | null {
  if (!grid.isWalkable(goal.col, goal.row)) return null;
  if (start.col === goal.col && start.row === goal.row) return [];

  const open = new Map<string, Node>();
  const closed = new Set<string>();

  const startNode: Node = { col: start.col, row: start.row, g: 0, f: heuristic(start, goal), parent: null };
  open.set(key(start.col, start.row), startNode);

  const neighborOffsets = [
    { dCol: 0, dRow: -1 },
    { dCol: 0, dRow: 1 },
    { dCol: -1, dRow: 0 },
    { dCol: 1, dRow: 0 },
  ];

  while (open.size > 0) {
    let current: Node | null = null;
    for (const node of open.values()) {
      if (!current || node.f < current.f) current = node;
    }
    if (!current) break;

    if (current.col === goal.col && current.row === goal.row) {
      const path: GridPoint[] = [];
      let step: Node | null = current;
      while (step && step.parent) {
        path.unshift({ col: step.col, row: step.row });
        step = step.parent;
      }
      return path;
    }

    open.delete(key(current.col, current.row));
    closed.add(key(current.col, current.row));

    for (const { dCol, dRow } of neighborOffsets) {
      const col = current.col + dCol;
      const row = current.row + dRow;
      if (!grid.isWalkable(col, row)) continue;
      if (closed.has(key(col, row))) continue;

      const g = current.g + 1;
      const existing = open.get(key(col, row));
      if (!existing || g < existing.g) {
        open.set(key(col, row), {
          col,
          row,
          g,
          f: g + heuristic({ col, row }, goal),
          parent: current,
        });
      }
    }
  }

  return null;
}
