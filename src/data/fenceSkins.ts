import { FENCE_TILESET_KEY, FENCE_TILESET_PATH } from './tiles';
import { FENCE_HP } from './horde';

/**
 * Os 4 materiais da CERCA da lavoura (`data/upgrades.ts`, linha `fence`; o nível 0 é a branca de sempre). Cada um é uma folha de quadros 16x16 de `Objects/Exterior/Fence and Bridge/`;
 * os números são índices de quadro (linha * colunas + coluna), conferidos olhando a folha com a grade. `hp` = quantos golpes a cerca aguenta antes de cair na horda (a branca: `FENCE_HP`).
 * O canto de cima à direita da branca é o de cima à esquerda espelhado (`flipTopRight`); as outras folhas trazem os quatro cantos.
 */
export interface FenceSkin {
  name: string;
  textureKey: string;
  texturePath: string;
  topLeft: number;
  topRight: number;
  bottomLeft: number;
  bottomRight: number;
  edgeTop: number;
  edgeBottom: number;
  edgeLeft: number;
  edgeRight: number;
  /** O pedaço que sobra da cerca destruída (só o Martelo a conserta). */
  broken: number;
  flipTopRight?: boolean;
  hp: number;
}

export const FENCE_SKINS: FenceSkin[] = [
  { name: 'Cerca branca', textureKey: FENCE_TILESET_KEY, texturePath: FENCE_TILESET_PATH, topLeft: 0, topRight: 0, flipTopRight: true, bottomLeft: 10, bottomRight: 13, edgeTop: 15, edgeBottom: 15, edgeLeft: 5, edgeRight: 5, broken: 1, hp: FENCE_HP },
  { name: 'Cerca de Madeira', textureKey: 'fence-wood', texturePath: 'Objects/Exterior/Fence and Bridge/Fence Wood.png', topLeft: 0, topRight: 2, bottomLeft: 12, bottomRight: 14, edgeTop: 13, edgeBottom: 13, edgeLeft: 6, edgeRight: 8, broken: 1, hp: 5 },
  { name: 'Cerca de Pedra', textureKey: 'fence-stone', texturePath: 'Objects/Exterior/Fence and Bridge/Fence Stone.png', topLeft: 0, topRight: 2, bottomLeft: 6, bottomRight: 8, edgeTop: 1, edgeBottom: 7, edgeLeft: 3, edgeRight: 5, broken: 4, hp: 8 },
  { name: 'Cerca de Ferro', textureKey: 'fence-iron', texturePath: 'Objects/Exterior/Fence and Bridge/Fence Iron.png', topLeft: 0, topRight: 2, bottomLeft: 6, bottomRight: 8, edgeTop: 7, edgeBottom: 7, edgeLeft: 3, edgeRight: 5, broken: 10, hp: 12 },
];
