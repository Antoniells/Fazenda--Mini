import { CLIFF_TILES } from '../data/islandEdges';
import type { BridgeDefinition, ExpansionChunk, ExpansionDirection } from '../data/maps/farmMap';

/**
 * A GEOMETRIA DAS ILHAS (lógica pura — o desenho está em `systems/islandEdges.ts`): a moldura de peças do penhasco em volta do retângulo
 * do mapa e, na Fazenda, o retângulo liberado (núcleo + trechos comprados) e onde fica cada ponte — sempre na borda de fora.
 */

/** Retângulo de células que forma a ilha (o chão do mapa). */
export interface IslandRegion {
  col0: number;
  row0: number;
  cols: number;
  rows: number;
}

export interface RimTile {
  col: number;
  row: number;
  /** Índice da peça na folha do penhasco (`CLIFF_TILES`). */
  index: number;
}

/**
 * As peças em volta da ilha, FORA dela: uma linha de borda em cima, uma coluna de cada lado e, embaixo, a borda de baixo (grama + começo
 * da pedra) e o paredão até a água. Bordas longas alternam as duas variações da peça (sem repetir sempre a mesma).
 */
export function islandRimTiles(region: IslandRegion): RimTile[] {
  const { col0, row0, cols, rows } = region;
  const left = col0 - 1;
  const right = col0 + cols;
  const top = row0 - 1;
  const bottom = row0 + rows;
  const face = bottom + 1;
  const tiles: RimTile[] = [];

  tiles.push({ col: left, row: top, index: CLIFF_TILES.topLeft }, { col: right, row: top, index: CLIFF_TILES.topRight });
  for (let col = col0; col < right; col++) {
    const variant = col % 2 === 0 ? 0 : 1;
    tiles.push({ col, row: top, index: CLIFF_TILES.top[variant] });
    tiles.push({ col, row: bottom, index: CLIFF_TILES.bottom });
    tiles.push({ col, row: face, index: CLIFF_TILES.face[variant] });
  }
  for (let row = row0; row < bottom; row++) {
    tiles.push({ col: left, row, index: CLIFF_TILES.left }, { col: right, row, index: CLIFF_TILES.right });
  }
  tiles.push({ col: left, row: bottom, index: CLIFF_TILES.bottomLeft }, { col: right, row: bottom, index: CLIFF_TILES.bottomRight });
  tiles.push({ col: left, row: face, index: CLIFF_TILES.faceLeft }, { col: right, row: face, index: CLIFF_TILES.faceRight });
  return tiles;
}

/** O trecho de expansão já aberto naquela direção (comprado ou que já nasce aberto), se houver. */
function openChunk(expansions: readonly ExpansionChunk[], unlocked: ReadonlySet<string>, direction: ExpansionDirection): ExpansionChunk | undefined {
  return expansions.find((chunk) => chunk.direction === direction && (chunk.startsUnlocked || unlocked.has(chunk.direction)));
}

/** A ilha da Fazenda: o núcleo mais os trechos já abertos (o retângulo que os envolve — os cantos entre dois trechos abertos já têm grama). */
export function farmIslandRegion(
  map: { cols: number; rows: number; expansions: readonly ExpansionChunk[] },
  unlocked: ReadonlySet<string>,
): IslandRegion {
  let minCol = 0;
  let minRow = 0;
  let maxCol = map.cols - 1;
  let maxRow = map.rows - 1;
  for (const chunk of map.expansions) {
    if (!chunk.startsUnlocked && !unlocked.has(chunk.direction)) continue;
    minCol = Math.min(minCol, chunk.col0);
    minRow = Math.min(minRow, chunk.row0);
    maxCol = Math.max(maxCol, chunk.col0 + chunk.cols - 1);
    maxRow = Math.max(maxRow, chunk.row0 + chunk.rows - 1);
  }
  return { col0: minCol, row0: minRow, cols: maxCol - minCol + 1, rows: maxRow - minRow + 1 };
}

/**
 * Onde a ponte da Fazenda está agora: na parede do núcleo enquanto o trecho daquele lado está fechado; comprado o trecho, ela vai pra
 * parede de FORA dele (a nova borda da ilha), na mesma linha/coluna. O estado de cada ponte (destravada ou não) continua guardado pela
 * célula original (`bridge.col`/`bridge.row`).
 */
export function farmBridgeCell(
  bridge: Pick<BridgeDefinition, 'direction' | 'col' | 'row'>,
  expansions: readonly ExpansionChunk[],
  unlocked: ReadonlySet<string>,
): { col: number; row: number } {
  const chunk = openChunk(expansions, unlocked, bridge.direction);
  if (!chunk) return { col: bridge.col, row: bridge.row };
  if (bridge.direction === 'west') return { col: chunk.col0, row: bridge.row };
  if (bridge.direction === 'east') return { col: chunk.col0 + chunk.cols - 1, row: bridge.row };
  if (bridge.direction === 'north') return { col: bridge.col, row: chunk.row0 };
  return { col: bridge.col, row: chunk.row0 + chunk.rows - 1 };
}

/** A célula andável logo pra dentro da ilha, em frente à ponte (onde o jogador reaparece ao voltar por ela). */
export function cellInsideBridge(direction: ExpansionDirection, cell: { col: number; row: number }): { col: number; row: number } {
  if (direction === 'north') return { col: cell.col, row: cell.row + 1 };
  if (direction === 'south') return { col: cell.col, row: cell.row - 1 };
  if (direction === 'west') return { col: cell.col + 1, row: cell.row };
  return { col: cell.col - 1, row: cell.row };
}

/**
 * Ilha de AREIA no mar (a Praia — `ExternalMapConfig.islandShore`): o chão autorado cercado por `pad` células de água, só pro desenho. O
 * autotile da água (`systems/waterAutotile.ts`) faz a margem com espuma onde a areia encontra o mar em volta, e a cor de fundo do miolo
 * (`ISLAND_SEA_COLOR`) continua o mar até o horizonte. A colisão continua lendo o chão original.
 */
export function groundWithSeaAround(ground: readonly (readonly number[])[], pad: number, waterGid: number): number[][] {
  const cols = Math.max(0, ...ground.map((row) => row.length));
  const padded: number[][] = [];
  for (let row = -pad; row < ground.length + pad; row++) {
    const line: number[] = [];
    for (let col = -pad; col < cols + pad; col++) line.push(ground[row]?.[col] ?? waterGid);
    padded.push(line);
  }
  return padded;
}
