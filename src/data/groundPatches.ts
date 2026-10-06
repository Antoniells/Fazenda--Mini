/**
 * MANCHAS DE GRAMA (variação orgânica do chão — `systems/groundPatches.ts`): só dados. A grama escura do `Tileset Grass Summer.png` não é
 * um tile solto: é um autotile "blob" completo de 47 peças (colunas 12-23, linhas 0-3 — o tile 69, que antes era espalhado sozinho e
 * virava um quadrado, é o MIOLO dele). Cada célula de mancha escolhe a peça pelos vizinhos, então a borda fica recortada e contínua.
 */

/** Recorte do grupo da grama escura no tileset (em tiles de 16 px). */
export const PATCH_GROUP_COL = 12;
export const PATCH_GROUP_ROW = 0;
export const PATCH_GROUP_COLS = 12;
export const PATCH_GROUP_ROWS = 4;
/** Colunas do tileset de grama (pra converter o índice do tileset no índice do recorte). */
export const GRASS_TILESET_COLUMNS = 24;

/** Textura do recorte já suavizado (criada uma vez, a partir do tileset carregado). */
export const PATCH_TEXTURE_KEY = 'grass-patches-soft';

/**
 * Suavização da borda: no pacote, a mancha tem um contorno quase preto (feito pra grama sobre buraco/terra). Por cima da grama clara isso
 * vira um "degrau"; aqui o contorno sai (fica transparente — a grama clara aparece) e a sombra verde da borda continua, então a mancha
 * só muda de tom, sem linha. Só cores que já estão no tileset. Chave: cor RGB do pacote → cor nova (`null` = transparente).
 */
export const PATCH_RECOLOR: Record<number, number | null> = {
  0x08292b: null,
  0x115536: null,
};

/**
 * Peça do autotile para cada combinação de vizinhos que também são mancha (índice do TILESET inteiro). Bits: N=1, L=2, S=4, O=8,
 * NO=16, NE=32, SO=64, SE=128 — uma diagonal só conta quando os dois lados dela também são mancha (as 47 combinações possíveis).
 * Medido pixel a pixel nas peças do pacote (lado ligado = meio da borda preenchido; diagonal ligada = canto preenchido).
 */
export const PATCH_TILE_BY_MASK: Readonly<Record<number, number>> = {
  0: 84, 1: 60, 2: 85, 3: 61, 4: 12, 5: 36, 6: 13, 7: 37, 8: 87, 9: 63, 10: 86, 11: 62, 12: 15, 13: 39, 14: 14, 15: 38,
  25: 95, 27: 90, 29: 67, 31: 16, 35: 92, 39: 64, 43: 89, 47: 19, 59: 93, 63: 94, 76: 23, 77: 43, 78: 18, 79: 88, 93: 71, 95: 47,
  111: 45, 127: 66, 134: 20, 135: 40, 142: 17, 143: 91, 159: 70, 167: 44, 175: 68, 191: 65, 206: 22, 207: 21, 223: 42, 239: 41, 255: 69,
};

/**
 * Campo de ruído que decide onde há mancha (coordenadas do MUNDO — o desenho continua igual nas emendas entre trechos e ao recarregar):
 * duas camadas de ruído suave, uma larga (o formato geral) e uma fina (recorta a borda), cada uma GIRADA num ângulo (radianos) pra
 * as manchas não saírem alinhadas à grade, e o limiar que deixa ~1/5 da grama escura. `edgeBiteChance`: fração das células da beira da
 * mancha que ficam de fora (quebra bordas retas e retângulos pequenos).
 */
export const PATCH_NOISE = {
  coarseCells: 6,
  coarseAngle: 0.5,
  fineCells: 2.5,
  fineAngle: -0.9,
  fineWeight: 0.5,
  threshold: 0.63,
  edgeBiteChance: 0.3,
};
