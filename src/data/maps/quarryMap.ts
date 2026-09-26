/**
 * Pedreira (Sistema de Cenas — renomeado de "Mineração" só pro nome da
 * ponte/cena; a faixa de expansão dentro da Fazenda continua chamada
 * Mineração, ver `BIOME_LABELS` em `data/maps/farmMap.ts`): pedras/rochas
 * em grande abundância (pequenas e grandes, ver `QuarryScene`/
 * `systems/resourceInteraction.ts` — Fase 7, Coleta de Recursos), mais
 * os veios de minério (carvão e ferro, autorados aqui; cobre e ouro, e mais
 * deles, em `data/ores.ts`) — minerados com a Picareta.
 */
export interface QuarryMapData {
  cols: number;
  rows: number;
  /** Autorado manualmente no `MapEditorScene` (mesmo esquema de GID de `FarmMapData.ground`) — opcional, sem ele o chão continua gerado proceduralmente. */
  ground?: number[][];
  /** Cor de fundo escolhida na Sidebar do editor (`camera.setBackgroundColor`) — ver `FarmMapData.backgroundColor`. Não consumido pela cena ainda. */
  backgroundColor?: string;
  /** Células extras bloqueadas, pintadas no `MapEditorScene` (Modo Entities → Bloco de Colisão) — ver `FarmMapData.blockedArea`. `QuarryScene` já inclui isto em `obstacleCells`. */
  blockedArea?: Array<[number, number]>;
  /** Props de decoração ambiente (col, row, id de `data/mapProps.ts`) pintados no `MapEditorScene` (aba Decoração) — puramente visuais, sem colisão. */
  props?: Array<[number, number, string]>;
  /** Abundantes, de propósito — o oposto da Floresta ("poucas espalhadas"). Dropam 1-3 Pedras cada. */
  rockPositions: Array<[number, number]>;
  /** Rochas maiores (mesmo asset, escala maior — ver `ROCK_BIG_SCALE_MULT`), dropam 8-10 Pedras cada. */
  bigRockPositions: Array<[number, number]>;
  ironOrePositions: Array<[number, number]>;
  coalOrePositions: Array<[number, number]>;
}

export const quarryMap: QuarryMapData = {
  cols: 40,
  rows: 30,
  rockPositions: [
    [3, 3], [11, 3], [15, 4], [19, 3], [22, 4], [4, 8],
    [8, 9], [17, 8], [21, 9], [3, 13], [6, 15], [22, 16],
    [14, 15], [28, 3], [33, 5], [37, 4], [27, 9], [35, 10],
    [30, 14], [24, 18], [29, 22], [36, 20], [8, 21], [15, 24],
    [22, 26], [33, 26], [4, 24],
  ],
  bigRockPositions: [
    [7, 4], [19, 14], [10, 16], [31, 8], [26, 24], [37, 15],
    [5, 21],
  ],
  ironOrePositions: [
    [12, 6], [20, 11], [28, 16], [12, 22], [34, 24],
  ],
  coalOrePositions: [
    [6, 11], [16, 17], [25, 5], [32, 19], [18, 25],
  ],
  // Pedrinhas, moitas secas, cogumelos e um tronco caído — só decoração, sem colisão.
  props: [
    [2, 6, 'prop-rock-pebble-brown'], [9, 5, 'prop-tuft-orange-dry'], [18, 5, 'prop-rock-pebble-brown'], [23, 7, 'prop-tuft-orange-dry'],
    [2, 10, 'prop-mushroom-tan-double'], [13, 9, 'prop-mushroom-brown'], [9, 13, 'prop-mushroom-tan'], [15, 11, 'prop-rock-pebble-brown'],
    [12, 12, 'prop-tuft-orange-dry'], [24, 13, 'prop-rock-pebble-brown'], [5, 17, 'prop-fallen-log'], [20, 17, 'prop-rock-cluster-brown'],
    [30, 4, 'prop-rock-pebble-brown'], [36, 8, 'prop-tuft-orange-dry'], [27, 13, 'prop-mushroom-tan'], [34, 13, 'prop-rock-pebble-brown'],
    [10, 23, 'prop-tuft-orange-dry'], [19, 21, 'prop-rock-cluster-brown'], [28, 20, 'prop-fallen-log'], [38, 25, 'prop-tuft-orange-dry'],
  ],
};
