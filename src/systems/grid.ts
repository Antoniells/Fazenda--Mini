import { FarmMapData } from '../data/maps/farmMap';

export interface WalkableGrid {
  cols: number;
  rows: number;
  inBounds(col: number, row: number): boolean;
  isWalkable(col: number, row: number): boolean;
  /** Bloqueia uma célula em tempo de execução (ex.: uma decoração posicionada — Fase 6). */
  block(col: number, row: number): void;
  /** Libera uma célula bloqueada em tempo de execução (ex.: uma decoração removida). */
  unblock(col: number, row: number): void;
}

/**
 * Constrói a grade de caminhabilidade a partir dos dados do mapa: o anel da
 * borda (onde a cerca é desenhada), as células das árvores, a Caixa de
 * Remessas e a Loja são bloqueados. Fonte única de obstáculos — nenhuma
 * posição é redefinida aqui, tudo vem de `farmMap`. Para adicionar um novo
 * tipo de obstáculo no futuro, basta marcar mais células como bloqueadas
 * aqui, sem alterar quem consome o grid.
 */
export function buildWalkableGrid(map: FarmMapData): WalkableGrid {
  const blocked = new Set<string>();
  const key = (col: number, row: number): string => `${col},${row}`;

  for (let col = 0; col < map.cols; col++) {
    blocked.add(key(col, 0));
    blocked.add(key(col, map.rows - 1));
  }
  for (let row = 0; row < map.rows; row++) {
    blocked.add(key(0, row));
    blocked.add(key(map.cols - 1, row));
  }

  for (const [col, row] of map.treePositions) {
    blocked.add(key(col, row));
  }

  blocked.add(key(map.shippingBinPosition[0], map.shippingBinPosition[1]));
  blocked.add(key(map.shopPosition[0], map.shopPosition[1]));

  const inBounds = (col: number, row: number): boolean =>
    col >= 0 && row >= 0 && col < map.cols && row < map.rows;

  const isWalkable = (col: number, row: number): boolean =>
    inBounds(col, row) && !blocked.has(key(col, row));

  const block = (col: number, row: number): void => {
    blocked.add(key(col, row));
  };

  const unblock = (col: number, row: number): void => {
    blocked.delete(key(col, row));
  };

  return { cols: map.cols, rows: map.rows, inBounds, isWalkable, block, unblock };
}
