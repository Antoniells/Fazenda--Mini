import { ExpansionChunk, FarmMapData, getFarmlandFenceLayout } from '../data/maps/farmMap';
import { waterCellsFromGround } from './waterCells';

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
 * Bloqueia o perímetro externo PERMANENTE de um trecho de expansão — mesmas
 * 3 bordas desenhadas por `buildExpansionChunkFence` (o lado que faz
 * fronteira com o núcleo fica aberto). Para os biomas de Cavernas (norte) e
 * Praia (sul — ver `ExpansionChunk.biome`), essa borda mais distante do
 * núcleo É a parede da caverna / a água do oceano pedida na Fase 6.1: não
 * há bloqueio extra a fazer, o perímetro genérico já cobre exatamente essa
 * borda extrema em todos os 4 biomas.
 */
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
 * Caixa de Remessas, a Loja, a Casa e a cerca da lavoura (com seu portão,
 * ver `getFarmlandFenceLayout`) são bloqueados. Fonte única de obstáculos —
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

  // Árvores e pedras da Fazenda NÃO são bloqueadas aqui: são recursos colhíveis, então quem bloqueia (e
  // desbloqueia ao cortar/quebrar) é `systems/farmResources.ts`, a partir do registro atual.

  // Água pintada no chão (lago/rio) — não dá pra andar nela.
  for (const [col, row] of waterCellsFromGround(map.ground)) blocked.add(key(col, row));

  blocked.add(key(map.shippingBinPosition[0], map.shippingBinPosition[1]));
  blocked.add(key(map.shopPosition[0], map.shopPosition[1]));
  blocked.add(key(map.shopPosition[0]-1, map.shopPosition[1]));

  // Casa do jogador (Fase 9): bloco sólido inteiro — a única célula com
  // interação própria é a porta (`houseDoorPosition`, registrada à parte
  // em `systems/sleepInteraction.ts`), as demais só impedem passagem.
  const { col0: houseCol0, row0: houseRow0, cols: houseCols, rows: houseRows } = map.housePosition;
for (let row = houseRow0 + 3; row < houseRow0 + houseRows -1; row++) {
    for (let col = houseCol0; col < houseCol0 + houseCols -1; col++) {
      blocked.add(key(col, row));
    }
  }

  // Cerca da lavoura (Fase 9): mesmo perímetro desenhado por
  // `mapBuilder.buildFarmlandFence` (fonte única em `getFarmlandFenceLayout`,
  // pra nunca desenhar cerca sem colisão ou vice-versa) — bloqueada por
  // inteiro, exceto o portão (única abertura, alinhada com a porta de casa).
  const fence = getFarmlandFenceLayout(map);
  const gateKey = key(fence.gate[0], fence.gate[1]);
  for (let col = fence.col0; col <= fence.colEnd; col++) {
    blocked.add(key(col, fence.row0));
    blocked.add(key(col, fence.rowEnd));
  }
  for (let row = fence.row0; row <= fence.rowEnd; row++) {
    blocked.add(key(fence.col0, row));
    blocked.add(key(fence.colEnd, row));
  }
  blocked.delete(gateKey);
  blocked.delete(key(fence.gate[0] - 1, fence.gate[1]));

  // Blocos de colisão extras (pintados manualmente no `MapEditorScene`,
  // Modo Entities → Bloco de Colisão) — bloqueiam mesmo sem nenhum objeto
  // visível ali, ex.: reservar uma célula pra uma futura construção.
  for (const [col, row] of map.blockedArea ?? []) {
    blocked.add(key(col, row));
  }

  // Garantia defensiva (bug corrigido — a interação de dormir parou de
  // funcionar depois que `blockedArea` passou a ser lido de verdade): a
  // porta da Casa É a célula com a interação própria (ver
  // `systems/sleepInteraction.ts`) e o jogador anda direto EM CIMA dela pra
  // interagir (não é "objeto sólido com aproximação", como Loja/Caixa de
  // Remessas) — então ela nunca pode ficar bloqueada, nem por um Bloco de
  // Colisão pintado por cima dela sem querer no editor. Sempre por último,
  // depois de qualquer outro bloqueio nesta função.
  blocked.delete(key(map.houseDoorPosition[0], map.houseDoorPosition[1]));

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
