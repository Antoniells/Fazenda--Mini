/**
 * As RAIAS dos patos (`systems/ducks.ts`): onde, numa água qualquer, um pato pode nadar de um lado pro outro sem encostar na margem.
 * Uma raia é um trecho horizontal de água "funda" — célula de água com água nos 4 vizinhos — de pelo menos `minLength` células.
 */
export interface DuckLane {
  row: number;
  fromCol: number;
  toCol: number;
}

/** Até `max` raias, as mais longas primeiro e nunca em fileiras vizinhas (os patos não nadam colados); a 2ª, 4ª... começa do outro lado. */
export function findDuckLanes(isWater: (col: number, row: number) => boolean, cols: number, rows: number, max: number, minLength = 3): DuckLane[] {
  const deep = (col: number, row: number): boolean =>
    isWater(col, row) && isWater(col - 1, row) && isWater(col + 1, row) && isWater(col, row - 1) && isWater(col, row + 1);

  const runs: DuckLane[] = [];
  for (let row = 0; row < rows; row++) {
    let start = -1;
    for (let col = 0; col <= cols; col++) {
      const inside = col < cols && deep(col, row);
      if (inside && start < 0) start = col;
      if (!inside && start >= 0) {
        if (col - start >= minLength) runs.push({ row, fromCol: start, toCol: col - 1 });
        start = -1;
      }
    }
  }
  runs.sort((a, b) => b.toCol - b.fromCol - (a.toCol - a.fromCol) || a.row - b.row);

  const lanes: DuckLane[] = [];
  for (const run of runs) {
    if (lanes.length >= max) break;
    if (lanes.some((lane) => Math.abs(lane.row - run.row) < 2)) continue;
    lanes.push(lanes.length % 2 === 0 ? run : { row: run.row, fromCol: run.toCol, toCol: run.fromCol });
  }
  return lanes;
}
