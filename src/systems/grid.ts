import { ExpansionChunk, FarmMapData } from '../data/maps/farmMap';

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

/** Bloqueia o perímetro externo PERMANENTE de um trecho de expansão — mesmas 3 bordas desenhadas por `buildExpansionChunkFence` (o lado que faz fronteira com o núcleo fica aberto). */
function blockExpansionChunkPerimeter(blocked: Set<string>, key: (col: number, row: number) => string, chunk: ExpansionChunk): void {
  const { direction, col0, row0, cols, rows } = chunk;
  const colEnd = col0 + cols - 1;
  const rowEnd = row0 + rows - 1;

  if (direction === 'east') {
    for (let col = col0; col <= colEnd; col++) blocked.add(key(col, row0));
    for (let col = col0; col <= colEnd; col++) blocked.add(key(col, rowEnd));
    for (let row = row0; row <= rowEnd; row++) blocked.add(key(colEnd, row));
  } else if (direction === 'west') {
    for (let col = col0; col <= colEnd; col++) blocked.add(key(col, row0));
    for (let col = col0; col <= colEnd; col++) blocked.add(key(col, rowEnd));
    for (let row = row0; row <= rowEnd; row++) blocked.add(key(col0, row));
  } else if (direction === 'north') {
    for (let col = col0; col <= colEnd; col++) blocked.add(key(col, row0));
    for (let row = row0; row <= rowEnd; row++) blocked.add(key(col0, row));
    for (let row = row0; row <= rowEnd; row++) blocked.add(key(colEnd, row));
  } else {
    for (let col = col0; col <= colEnd; col++) blocked.add(key(col, rowEnd));
    for (let row = row0; row <= rowEnd; row++) blocked.add(key(col0, row));
    for (let row = row0; row <= rowEnd; row++) blocked.add(key(colEnd, row));
  }
}

/**
 * Constrói a grade de caminhabilidade a partir dos dados do mapa: o anel da
 * borda do núcleo (onde a cerca é desenhada), as células das árvores, a
 * Caixa de Remessas e a Loja são bloqueados. Fonte única de obstáculos —
 * nenhuma posição é redefinida aqui, tudo vem de `farmMap`. Para adicionar
 * um novo tipo de obstáculo no futuro, basta marcar mais células como
 * bloqueadas aqui, sem alterar quem consome o grid.
 *
 * Desde a Fase 6 (Expansão), o mundo pode ter coordenadas negativas (trechos
 * a norte/oeste do núcleo) — `inBounds` cobre o retângulo total (núcleo +
 * todos os `farmMap.expansions`), não só `0..cols/rows`.
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
  blocked.add(key(map.shopPosition[0], map.shopPosition[1]-1));

  // Trechos de expansão (Fase 6): perímetro externo permanente de cada um
  // (a área interna já nasce andável — só a parede do núcleo, bloqueada
  // acima, isola o trecho até `MainScene.buyExpansion` remover essa
  // parede específica).
  let minCol = 0;
  let minRow = 0;
  let maxCol = map.cols - 1;
  let maxRow = map.rows - 1;
  for (const chunk of map.expansions) {
    blockExpansionChunkPerimeter(blocked, key, chunk);
    minCol = Math.min(minCol, chunk.col0);
    minRow = Math.min(minRow, chunk.row0);
    maxCol = Math.max(maxCol, chunk.col0 + chunk.cols - 1);
    maxRow = Math.max(maxRow, chunk.row0 + chunk.rows - 1);
  }

  const inBounds = (col: number, row: number): boolean =>
    col >= minCol && row >= minRow && col <= maxCol && row <= maxRow;

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
