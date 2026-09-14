/**
 * Floresta (Sistema de Cenas — renomeado de "Madeireira" só pro nome da
 * ponte/cena; a faixa de expansão dentro da Fazenda continua chamada
 * Madeireira, ver `BIOME_LABELS` em `data/maps/farmMap.ts`): árvores
 * (Pinheiro + Bétula, pra variar), um pequeno lago e poucas pedras
 * espalhadas — só o "visual básico" pedido, sem mecânica de cortar árvore
 * ainda (Fase 7 do roadmap, pendente).
 */
export interface ForestMapData {
  cols: number;
  rows: number;
  pineTreePositions: Array<[number, number]>;
  birchTreePositions: Array<[number, number]>;
  /** "Algumas poucas" — bem menos que a abundância pedida pra Pedreira. */
  rockPositions: Array<[number, number]>;
  /** Retângulo (em células) do pequeno lago. */
  lakeArea: { col0: number; row0: number; cols: number; rows: number };
}

export const forestMap: ForestMapData = {
  cols: 26,
  rows: 20,
  pineTreePositions: [
    [4, 4],
    [6, 9],
    [21, 4],
    [22, 10],
    [3, 16],
    [23, 16],
  ],
  birchTreePositions: [
    [9, 3],
    [17, 3],
    [4, 12],
    [21, 13],
  ],
  rockPositions: [
    [8, 8],
    [19, 6],
    [17, 15],
  ],
  lakeArea: { col0: 15, row0: 7, cols: 6, rows: 5 },
};
