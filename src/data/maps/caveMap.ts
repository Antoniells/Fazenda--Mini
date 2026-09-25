/**
 * Caverna (Sistema de Cenas): uma entrada para as minas/cavernas, estética
 * parecida com a entrada das minas do Stardew Valley (arco escuro entalhado
 * numa parede de penhasco/grama — ver `CAVE_ENTRANCE_FRAME` em
 * `data/tiles.ts`) — só o "visual básico" pedido, sem nada além disso por
 * enquanto (inimigos/minérios raros são Fase 7, pendente).
 */
export interface CaveMapData {
  cols: number;
  rows: number;
  /** Autorado manualmente no `MapEditorScene` (mesmo esquema de GID de `FarmMapData.ground`) — opcional, sem ele o chão continua gerado proceduralmente. */
  ground?: number[][];
  /** Cor de fundo escolhida na Sidebar do editor (`camera.setBackgroundColor`) — ver `FarmMapData.backgroundColor`. Não consumido pela cena ainda. */
  backgroundColor?: string;
  /** Células extras bloqueadas, pintadas no `MapEditorScene` (Modo Entities → Bloco de Colisão) — ver `FarmMapData.blockedArea`. `CaveScene` já inclui isto em `obstacleCells`. */
  blockedArea?: Array<[number, number]>;
  /** Props de decoração ambiente (col, row, id de `data/mapProps.ts`) pintados no `MapEditorScene` (aba Decoração) — puramente visuais, sem colisão. */
  props?: Array<[number, number, string]>;
  /** Célula (col, row) da base da estrutura da entrada — ver `systems/externalMapBuilder.buildCaveEntrance`. */
  caveEntrancePosition: [number, number];
}

export const caveMap: CaveMapData = {
  // 25x19 células (32px cada) preenche a janela de 800x600 quase por
  // inteiro, evitando a faixa preta nas bordas que um mapa menor deixaria
  // à mostra (a câmera não rola além dos limites do mundo).
  cols: 25,
  rows: 19,
  caveEntrancePosition: [12, 4],
  // Cogumelos/pedras azuis e flores-cristal espalhados (mesma paleta de `data/mapProps.ts`), longe do caminho da ponte de volta (coluna 12, sul).
  props: [
    [3, 3, 'prop-fern-blue-tall'], [9, 3, 'prop-mushroom-blue'], [16, 3, 'prop-rock-pebble-purple'], [21, 3, 'prop-fern-blue-tall'],
    [6, 5, 'prop-mushroom-blue'], [18, 5, 'prop-mushroom-blue'], [3, 7, 'prop-rock-boulder-blue-tall'], [23, 7, 'prop-mushroom-blue'],
    [8, 8, 'prop-rock-boulder-blue'], [15, 8, 'prop-rock-boulder-blue-tall'], [12, 9, 'prop-flower-purple-crystal'], [20, 9, 'prop-flower-purple-crystal'],
    [4, 10, 'prop-rock-pebble-purple'], [10, 11, 'prop-tuft-teal'], [22, 13, 'prop-rock-boulder-blue'], [2, 14, 'prop-mushroom-dark-spiky'],
    [17, 14, 'prop-mushroom-dark-spiky'], [7, 15, 'prop-flower-purple-crystal'], [14, 16, 'prop-rock-pebble-purple'], [5, 17, 'prop-tuft-teal'],
  ],
};
