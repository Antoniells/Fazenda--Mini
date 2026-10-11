/**
 * TELHADOS COM NEVE NO INVERNO (`systems/snowRoofs.ts`): a neve vem do kit de casa do pacote (`Objects/Exterior/Houses/Tiny House.png` — as
 * placas e a peça de duas águas de neve, só branco `#ffffff` e azul-claro `#d2e0ee`). Cada prédio tem a sua RECEITA, porque os telhados são
 * diferentes:
 *
 * - `template`: o pacote já traz a casa com a neve do kit montada no MESMO telhado (a casa 4 é a casa 3 nevada; a 12, a forma da 10/2; o
 *   galinheiro nevado está na mesma folha, logo abaixo). Copiam-se só os pixels de neve do gabarito, deslocados (`dx`, `dy`) até o telhado
 *   da casa — o deslocamento foi medido casando o contorno escuro dos telhados (7: +2,-10; 8: +1,-6; 2: 0,-6 — 92-94% do contorno bate).
 *   `keep`: retângulos em que a arte da casa fica por cima da neve (a chaminé da casinha 10, que a 12 não tem; o enfeite branco no
 *   frontão do galinheiro nevado). `maxY`: só as linhas do gabarito acima disto (a 12 tem enfeites listrados de Natal abaixo do telhado).
 * - `clip`: telhados sem gabarito (a casa do Ferreiro, a casa grande do jogador): a placa de neve do kit, repetida, recortada nos pixels de
 *   TELHA da casa (`roofColors`, dentro de `regions`) — o contorno escuro, a chaminé e as paredes ficam como estão.
 *
 * Coordenadas em px da arte, relativas ao quadro usado pelo jogo.
 */
export const SNOW_COLORS: readonly number[] = [0xffffff, 0xd2e0ee];

export const SNOW_TEMPLATES = {
  house4: { key: 'snow-template-house-4', path: 'Objects/Exterior/Houses/4.png' },
  house12: { key: 'snow-template-house-12', path: 'Objects/Exterior/Houses/12.png' },
} as const;

/** O kit e a placa de neve dele usada como textura no `clip`: o miolo todo opaco da placa de ponta inclinada à direita (48x21, medido pelo alfa). */
export const SNOW_KIT = { key: 'snow-kit-tiny-house', path: 'Objects/Exterior/Houses/Tiny House.png' };
export const SNOW_KIT_FILL_RECT = { x: 438, y: 89, width: 48, height: 21 };

type Rect = { x: number; y: number; width: number; height: number };

export type SnowRoofRecipe =
  | { kind: 'template'; template: keyof typeof SNOW_TEMPLATES | 'self'; templateRect?: Rect; dx: number; dy: number; keep?: Rect[]; maxY?: number }
  | { kind: 'clip'; regions: Rect[]; roofColors: readonly number[] };

/** Receitas por textura (e quadro, `textura|quadro`, quando a arte é um recorte de uma folha). */
export const SNOW_ROOF_RECIPES: Record<string, SnowRoofRecipe> = {
  // O Vilarejo.
  'village-house-3': { kind: 'template', template: 'house4', dx: 0, dy: 0 },
  'village-house-7': { kind: 'template', template: 'house4', dx: 2, dy: -10 },
  'village-house-8': { kind: 'template', template: 'house4', dx: 1, dy: -6 },
  'village-house-2': { kind: 'template', template: 'house12', dx: 0, dy: -6, maxY: 65 },
  'village-blacksmith-house': {
    kind: 'clip',
    regions: [
      { x: 0, y: 9, width: 93, height: 33 },
      { x: 88, y: 38, width: 56, height: 28 },
    ],
    roofColors: [0x8a3625, 0xae4924, 0x4a2123],
  },
  // A casa do jogador (os 3 níveis, `data/houseLevels.ts`).
  'player-house-small': { kind: 'template', template: 'house12', dx: 0, dy: 0, maxY: 65, keep: [{ x: 53, y: 20, width: 16, height: 30 }] },
  'player-house': { kind: 'template', template: 'house4', dx: 0, dy: 0 },
  'player-house-mid|player-house-mid-frame': {
    kind: 'clip',
    regions: [{ x: 0, y: 0, width: 140, height: 125 }],
    roofColors: [0xc33f1a, 0xd66226, 0x610f08, 0x7e210d, 0x550b04, 0x8c2b0b, 0xc6361b, 0xe0682b],
  },
  // O galinheiro: a versão nevada fica 80 px abaixo, na mesma folha.
  'decor-chicken-coop|decor-chicken-coop-icon': { kind: 'template', template: 'self', templateRect: { x: 13, y: 82, width: 55, height: 78 }, dx: 0, dy: 0, keep: [{ x: 22, y: 44, width: 14, height: 8 }] },
};
