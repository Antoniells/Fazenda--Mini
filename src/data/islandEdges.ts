/**
 * AS ILHAS E O ABISMO (`systems/islandEdges.ts`): cada mapa com céu aberto é uma ILHA — em volta do chão, a beirada de grama e, embaixo
 * (borda sul), o paredão de pedra que desce até a água funda; as pontes atravessam essa água até sumirem da tela, ligando uma ilha à outra.
 *
 * Arte: `Tileset Grass Cliff Tileset Summer.png` (320x192, grade 20x12 de 16px — a grama de verão é a MESMA cor `#7ec433` do chão do jogo).
 * Peças conferidas por recorte/ampliação no bloco das colunas 8-11, linhas 0-5 (uma "ilha" pronta no tileset): linha 0 = borda de cima,
 * colunas 8/11 = lados, linha 3 = borda de baixo (grama, contorno e o começo da pedra), linha 5 = o paredão terminando na água. As colunas
 * 8 e 11 das linhas 1-2 e a 10 da linha 3 têm cantos internos (recortes) — não servem pra uma borda reta.
 */
export const CLIFF_TILESET_KEY = 'island-cliff';
export const CLIFF_TILESET_PATH = 'Tileset/Tileset Grass Cliff Tileset Summer.png';
const CLIFF_TILESET_COLS = 20;
const at = (col: number, row: number): number => row * CLIFF_TILESET_COLS + col;

export const CLIFF_TILES = {
  topLeft: at(8, 0),
  top: [at(9, 0), at(10, 0)],
  topRight: at(11, 0),
  left: at(8, 1),
  right: at(11, 2),
  bottomLeft: at(8, 3),
  bottom: at(9, 3),
  bottomRight: at(11, 3),
  faceLeft: at(8, 5),
  face: [at(9, 5), at(10, 5)],
  faceRight: at(11, 5),
} as const;

/** A água funda lá embaixo: a cor da base do paredão (e do tile liso de água funda de `Beach animations tiles.png`, coluna 21, linha 6). */
export const ISLAND_WATER_COLOR = '#005ba7';

/** Quantas células além da borda do mapa a câmera pode mostrar (a beirada, o paredão e a água). */
export const ISLAND_VIEW_MARGIN_CELLS = 3;

/** Comprimento (células) do trecho da ponte que atravessa a água — sempre mais que a tela, pra ela sumir no horizonte. */
export const BRIDGE_SPAN_CELLS = 40;

/** A Praia é uma ilha de areia no MAR (sem paredão): o mar em volta tem a cor do miolo da água animada (`Beach animations tiles.png`, coluna 9, linha 2). */
export const ISLAND_SEA_COLOR = '#1fafdb';
/** Quantas células de mar o chão da Praia ganha em volta (só o bastante pro autotile desenhar a margem). */
export const ISLAND_SHORE_PAD_CELLS = 2;
