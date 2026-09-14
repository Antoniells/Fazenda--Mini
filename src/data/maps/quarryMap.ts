/**
 * Pedreira (Sistema de Cenas — renomeado de "Mineração" só pro nome da
 * ponte/cena; a faixa de expansão dentro da Fazenda continua chamada
 * Mineração, ver `BIOME_LABELS` em `data/maps/farmMap.ts`): pedras/rochas
 * em grande abundância (pequenas e grandes, ver `QuarryScene`/
 * `systems/resourceInteraction.ts` — Fase 7, Coleta de Recursos), mais
 * alguns poucos veios de carvão e ferro (só decorativos por ora, sem
 * mecânica de minério própria ainda).
 */
export interface QuarryMapData {
  cols: number;
  rows: number;
  /** Abundantes, de propósito — o oposto da Floresta ("poucas espalhadas"). Dropam 1-3 Pedras cada. */
  rockPositions: Array<[number, number]>;
  /** Rochas maiores (mesmo asset, escala maior — ver `ROCK_BIG_SCALE_MULT`), dropam 8-10 Pedras cada. */
  bigRockPositions: Array<[number, number]>;
  ironOrePositions: Array<[number, number]>;
  coalOrePositions: Array<[number, number]>;
}

export const quarryMap: QuarryMapData = {
  cols: 26,
  rows: 20,
  rockPositions: [
    [3, 3], [11, 3], [15, 4], [19, 3], [22, 4],
    [4, 8], [8, 9], [17, 8], [21, 9],
    [3, 13], [6, 15], [22, 16],
    [14, 15],
  ],
  bigRockPositions: [
    [7, 4],
    [19, 14],
    [10, 16],
  ],
  ironOrePositions: [
    [12, 6],
    [20, 11],
  ],
  coalOrePositions: [
    [6, 11],
    [16, 17],
  ],
};
