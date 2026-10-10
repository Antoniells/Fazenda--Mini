/**
 * O que a Floresta tem além do mapa autorado (`data/maps/forestMap.ts`, exportado pelo editor — por isso estes dados ficam aqui, fora dele):
 *
 * - **A cachoeira** do lago: 4 x 4 células (a arte, `WATERFALL_*`) encostadas na borda NORTE do mapa, caindo no lago logo abaixo (o lago vai
 *   das linhas 4 a 12). As células dela são sólidas (ninguém anda por dentro do paredão) e nunca recebem árvore/pedra.
 * - **O tamanho de antes**: a Floresta cresceu de 40 x 30 para 56 x 42, só para LESTE e para o SUL (nenhuma posição antiga mudou). Um save de
 *   antes disso ganha uma vez os nós originais da área nova (`SaveData.forestExpanded`).
 */
/** A chave da cena da Floresta (e dos nós dela no `resourceNodeRegistry`). Mora aqui pra sistemas sem cena (o save) poderem usá-la. */
export const FOREST_SCENE_KEY = 'ForestScene';

export const FOREST_WATERFALL = { col: 15, row: 0, cols: 4, rows: 4 };

export function forestWaterfallCells(): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  const { col, row, cols, rows } = FOREST_WATERFALL;
  for (let dy = 0; dy < rows; dy++) for (let dx = 0; dx < cols; dx++) cells.push([col + dx, row + dy]);
  return cells;
}

/**
 * As rochas dentro do lago (`WATER_ROCKS`, `systems/waterRocks.ts`): a célula é a do pé da rocha (centro embaixo). Na tela, as duas ocupam
 * 3 x 2 células — a da rocha e as vizinhas dos lados, ela e a de cima (`forestLakeRockCells`) —, que os patos tratam como margem (desviam).
 */
export const FOREST_LAKE_ROCKS: ReadonlyArray<{ col: number; row: number; size: 'small' | 'big' }> = [
  { col: 14, row: 7, size: 'big' },
  { col: 19, row: 10, size: 'small' },
];

export function forestLakeRockCells(): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  for (const { col, row } of FOREST_LAKE_ROCKS) for (let dy = -1; dy <= 0; dy++) for (let dx = -1; dx <= 1; dx++) cells.push([col + dx, row + dy]);
  return cells;
}

/** Onde os patos NÃO nadam dentro d'água: as rochas e o pé da cachoeira (a espuma) — `findDuckLanes` trata como margem. */
export function isForestDuckObstacle(col: number, row: number): boolean {
  const inFall = col >= FOREST_WATERFALL.col && col < FOREST_WATERFALL.col + FOREST_WATERFALL.cols && row >= FOREST_WATERFALL.row && row < FOREST_WATERFALL.row + FOREST_WATERFALL.rows;
  return inFall || forestLakeRockCells().some(([c, r]) => c === col && r === row);
}

export const FOREST_OLD_SIZE = { cols: 40, rows: 30 };

/** A célula está na área que a Floresta ganhou ao crescer? */
export function isForestExpansionCell(col: number, row: number): boolean {
  return col >= FOREST_OLD_SIZE.cols || row >= FOREST_OLD_SIZE.rows;
}
