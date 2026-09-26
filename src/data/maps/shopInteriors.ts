import type { NpcId } from '../npcs';

/**
 * Interiores das lojas do Vilarejo (`scenes/ShopInteriorScene.ts`) — um LAYOUT PRÓPRIO por loja, só dados: tamanho do cômodo, chão e paredes
 * (`Tileset/Tileset House.png`), onde fica cada móvel/peça e onde o dono atende. A arte de cada peça está em `PROP_ART` (recortes de folhas
 * de `Objects/Interior` e `Objects/Work Benches`, medidos pelo alfa) — trocar/mover uma peça é editar aqui, sem tocar na cena.
 *
 * Cada casa do Vilarejo com dono (`NpcDefinition.home`) leva ao interior dela: a Forja do Bruno, a Padaria do Alberto, a loja de insumos da
 * Lia e a Marcenaria do Tomás. Coordenadas em CÉLULAS de 16 px de arte (desenhadas a 2x).
 */
export type ShopInteriorId = 'forge' | 'bakery' | 'supplies' | 'carpentry';

/** Folha de tiles do chão/paredes: 832x384 = 52x24 tiles de 16x16 (frame = linha*52 + coluna). */
export const INTERIOR_TILES = { key: 'shop-int-tiles', path: 'Tileset/Tileset House.png', columns: 52, size: 16 };
export const interiorTileFrame = (col: number, row: number): number => row * INTERIOR_TILES.columns + col;

/**
 * Paredes: cada cor é um grupo de 4 colunas na folha (a 1ª é a ponta da esquerda, as 3 seguintes o miolo). O fundo usa 3 fileiras — painel
 * (linhas 6-7) e faixa ornamentada (linha 5) —, as laterais a ponta (linha 7) e a frente a faixa de baixo (linha 11).
 */
export const WALL_GROUPS = { beige: 0, rust: 4, blue: 8, white: 12, pink: 16, tan: 24, cream: 28, teal: 32, orange: 40, copper: 44 };

export interface PropFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Uma peça: imagem recortada de uma folha, ou (`anim`) uma folha de quadros 32x32 que anima em loop. */
export interface PropArt {
  key: string;
  path: string;
  frame: PropFrame;
  /** Peça animada: quadros 32x32 da folha (índices) e o tempo de cada um. `frame` é ignorado (o quadro inteiro é usado). */
  anim?: { frames: number[]; frameMs: number; contentBottom: number };
}

const INT = 'Objects/Interior';
const BENCH = 'Objects/Work Benches';

export const PROP_ART = {
  // Blacksmith.png
  counterU: { key: 'shop-int-blacksmith', path: `${INT}/Blacksmith.png`, frame: { x: 2, y: 64, w: 45, h: 32 } },
  display: { key: 'shop-int-blacksmith', path: `${INT}/Blacksmith.png`, frame: { x: 113, y: 64, w: 30, h: 32 } },
  crates: { key: 'shop-int-blacksmith', path: `${INT}/Blacksmith.png`, frame: { x: 207, y: 5, w: 34, h: 28 } },
  coalBin: { key: 'shop-int-blacksmith', path: `${INT}/Blacksmith.png`, frame: { x: 22, y: 5, w: 20, h: 22 } },
  swordRack: { key: 'shop-int-blacksmith', path: `${INT}/Blacksmith.png`, frame: { x: 129, y: 37, w: 30, h: 23 } },
  spearRack: { key: 'shop-int-blacksmith', path: `${INT}/Blacksmith.png`, frame: { x: 145, y: 70, w: 30, h: 25 } },
  armorRed: { key: 'shop-int-blacksmith', path: `${INT}/Blacksmith.png`, frame: { x: 49, y: 65, w: 14, h: 31 } },
  armorBlue: { key: 'shop-int-blacksmith', path: `${INT}/Blacksmith.png`, frame: { x: 65, y: 65, w: 15, h: 31 } },
  barrelWeapons: { key: 'shop-int-blacksmith', path: `${INT}/Blacksmith.png`, frame: { x: 200, y: 63, w: 17, h: 27 } },
  barrelSwords: { key: 'shop-int-blacksmith', path: `${INT}/Blacksmith.png`, frame: { x: 197, y: 34, w: 20, h: 24 } },
  // Tables and desks.png
  counterBrown: { key: 'shop-int-tables', path: `${INT}/Tables and desks.png`, frame: { x: 135, y: 199, w: 53, h: 22 } },
  tableRoundBrown: { key: 'shop-int-tables', path: `${INT}/Tables and desks.png`, frame: { x: 5, y: 229, w: 24, h: 22 } },
  tableRoundPink: { key: 'shop-int-tables', path: `${INT}/Tables and desks.png`, frame: { x: 36, y: 229, w: 24, h: 23 } },
  tableRoundWhite: { key: 'shop-int-tables', path: `${INT}/Tables and desks.png`, frame: { x: 164, y: 229, w: 24, h: 23 } },
  // Part 1 copiar.png (doces e pães)
  cake: { key: 'shop-int-part1', path: `${INT}/Part 1 copiar.png`, frame: { x: 225, y: 113, w: 13, h: 15 } },
  pie: { key: 'shop-int-part1', path: `${INT}/Part 1 copiar.png`, frame: { x: 241, y: 115, w: 13, h: 13 } },
  bread: { key: 'shop-int-part1', path: `${INT}/Part 1 copiar.png`, frame: { x: 225, y: 134, w: 14, h: 10 } },
  // Closet.png (armários/estantes marrons)
  shelfLarge: { key: 'shop-int-closet', path: `${INT}/Closet.png`, frame: { x: 69, y: 296, w: 35, h: 38 } },
  cabinetMid: { key: 'shop-int-closet', path: `${INT}/Closet.png`, frame: { x: 35, y: 298, w: 25, h: 36 } },
  cabinetSmall: { key: 'shop-int-closet', path: `${INT}/Closet.png`, frame: { x: 5, y: 301, w: 23, h: 33 } },
  // Objects/Work Benches (uma peça por arquivo; quadros de 32x32 recortados pelo alfa)
  anvil: { key: 'shop-int-anvil', path: `${BENCH}/Anvil.png`, frame: { x: 8, y: 12, w: 18, h: 12 } },
  sawmill: { key: 'shop-int-sawmill', path: `${BENCH}/Sawmill.png`, frame: { x: 8, y: 1, w: 17, h: 15 } },
  sharpening: { key: 'shop-int-sharpening', path: `${BENCH}/Sharpening Station.png`, frame: { x: 8, y: 1, w: 17, h: 15 } },
  workbench: { key: 'shop-int-workbench', path: `${BENCH}/Workbench.png`, frame: { x: 8, y: 6, w: 16, h: 18 } },
  churn: { key: 'shop-int-churn', path: `${BENCH}/Butter Churn.png`, frame: { x: 8, y: 3, w: 16, h: 25 } },
  cheesePress: { key: 'shop-int-cheese', path: `${BENCH}/Cheese Press.png`, frame: { x: 6, y: 5, w: 19, h: 26 } },
  fermentBarrel: { key: 'shop-int-ferment', path: `${BENCH}/fermentation barrel.png`, frame: { x: 8, y: 8, w: 17, h: 20 } },
  // Animadas: fornalha (fogo nos quadros 1-4) e panela fervendo (quadros 1-4)
  furnace: { key: 'shop-int-furnace', path: `${BENCH}/Furnace.png`, frame: { x: 0, y: 0, w: 32, h: 32 }, anim: { frames: [1, 2, 3, 4], frameMs: 140, contentBottom: 30 } },
  pot: { key: 'shop-int-pot', path: `${BENCH}/Kitchen pot.png`, frame: { x: 0, y: 0, w: 32, h: 32 }, anim: { frames: [1, 2, 3, 4], frameMs: 200, contentBottom: 31 } },
} satisfies Record<string, PropArt>;

export type PropArtId = keyof typeof PROP_ART;

/**
 * Uma peça posicionada: (`col`,`row`) é o canto superior-esquerdo da pegada `w` x `h` (células) e o sprite fica com a base no meio da borda de baixo
 * dela. `blocks` = células (relativas à pegada) que bloqueiam a passagem; sem ele só a fileira de baixo bloqueia (a arte "em pé" sobe pra trás).
 * `decor: true` = enfeite em cima de outra peça (sem bloquear); `lift` sobe o sprite (px de tela) — ex.: bolos em cima do balcão.
 */
export interface InteriorProp {
  art: PropArtId;
  col: number;
  row: number;
  w?: number;
  h?: number;
  blocks?: Array<[number, number]>;
  decor?: boolean;
  lift?: number;
}

export interface ShopInteriorLayout {
  id: ShopInteriorId;
  /** O dono (atende atrás do balcão): a definição do NPC (`data/npcs.ts`) dá o sprite, o nome e a loja. */
  npc: NpcId;
  cols: number;
  rows: number;
  /** Chão (tile da folha) e cor da parede (`WALL_GROUPS`). */
  floor: { col: number; row: number };
  wall: number;
  /** Coluna da porta, na parede de baixo. */
  doorCol: number;
  /** Célula onde o dono fica (atrás do balcão) e as células do balcão que abrem a conversa. */
  keeper: { col: number; row: number };
  counter: Array<[number, number]>;
  props: InteriorProp[];
}

export const SHOP_INTERIORS: Record<ShopInteriorId, ShopInteriorLayout> = {
  // Forja do Bruno: fornalha, bigorna e amoladores no fundo, balcão em U no meio, armaduras e mostruário ao lado.
  forge: {
    id: 'forge',
    npc: 'blacksmith',
    cols: 10,
    rows: 8,
    floor: { col: 13, row: 2 },
    wall: WALL_GROUPS.rust,
    doorCol: 5,
    keeper: { col: 4, row: 4 },
    counter: [[3, 4], [4, 4], [5, 4], [3, 5], [4, 5], [5, 5]],
    props: [
      { art: 'coalBin', col: 1, row: 3 },
      { art: 'furnace', col: 3, row: 3 },
      { art: 'anvil', col: 5, row: 3 },
      { art: 'sharpening', col: 6, row: 3 },
      { art: 'swordRack', col: 7, row: 3, w: 2 },
      { art: 'counterU', col: 3, row: 4, w: 3, h: 2, blocks: [[0, 0], [2, 0], [0, 1], [1, 1], [2, 1]] },
      { art: 'armorRed', col: 1, row: 5 },
      { art: 'armorBlue', col: 2, row: 5 },
      { art: 'display', col: 7, row: 5, w: 2, h: 1 },
      { art: 'barrelWeapons', col: 8, row: 6 },
    ],
  },
  // Padaria do Alberto: fornos e panela no fundo, balcão de madeira com doces, mesinhas redondas.
  bakery: {
    id: 'bakery',
    npc: 'banker',
    cols: 9,
    rows: 7,
    floor: { col: 26, row: 0 },
    wall: WALL_GROUPS.cream,
    doorCol: 4,
    keeper: { col: 4, row: 3 },
    counter: [[2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4]],
    props: [
      { art: 'fermentBarrel', col: 1, row: 3 },
      { art: 'furnace', col: 3, row: 3 },
      { art: 'furnace', col: 5, row: 3 },
      { art: 'pot', col: 7, row: 3 },
      { art: 'counterBrown', col: 2, row: 4, w: 3 },
      { art: 'counterBrown', col: 5, row: 4, w: 3 },
      { art: 'cake', col: 3, row: 4, decor: true, lift: 22 },
      { art: 'pie', col: 5, row: 4, decor: true, lift: 22 },
      { art: 'bread', col: 6, row: 4, decor: true, lift: 22 },
      { art: 'tableRoundPink', col: 1, row: 5 },
      { art: 'tableRoundWhite', col: 7, row: 5 },
    ],
  },
  // Loja de insumos da Lia: estantes no fundo, balcão, sacos/caixas e utensílios da fazenda.
  supplies: {
    id: 'supplies',
    npc: 'supplier',
    cols: 10,
    rows: 8,
    floor: { col: 25, row: 0 },
    wall: WALL_GROUPS.teal,
    doorCol: 5,
    keeper: { col: 4, row: 4 },
    counter: [[3, 5], [4, 5], [5, 5]],
    props: [
      { art: 'shelfLarge', col: 1, row: 3, w: 2 },
      { art: 'cabinetMid', col: 4, row: 3, w: 2 },
      { art: 'shelfLarge', col: 7, row: 3, w: 2 },
      { art: 'counterBrown', col: 3, row: 5, w: 3 },
      { art: 'crates', col: 1, row: 5, w: 2 },
      { art: 'churn', col: 8, row: 5 },
      { art: 'cheesePress', col: 7, row: 6 },
      { art: 'barrelSwords', col: 1, row: 6 },
    ],
  },
  // Marcenaria do Tomás: serra, bancada e amolador no fundo, balcão, mesa e material empilhado.
  carpentry: {
    id: 'carpentry',
    npc: 'carpenter',
    cols: 10,
    rows: 8,
    floor: { col: 26, row: 0 },
    wall: WALL_GROUPS.beige,
    doorCol: 5,
    keeper: { col: 4, row: 4 },
    counter: [[3, 5], [4, 5], [5, 5]],
    props: [
      { art: 'sawmill', col: 1, row: 3 },
      { art: 'workbench', col: 3, row: 3 },
      { art: 'sharpening', col: 5, row: 3 },
      { art: 'cabinetSmall', col: 7, row: 3 },
      { art: 'counterBrown', col: 3, row: 5, w: 3 },
      { art: 'crates', col: 1, row: 5, w: 2 },
      { art: 'tableRoundBrown', col: 8, row: 5 },
      { art: 'barrelWeapons', col: 6, row: 6 },
      { art: 'anvil', col: 1, row: 6 },
    ],
  },
};

/** O interior de cada dono (a casa dele leva pra cá). */
export const SHOP_INTERIOR_BY_NPC: Partial<Record<NpcId, ShopInteriorId>> = {
  blacksmith: 'forge',
  banker: 'bakery',
  supplier: 'supplies',
  carpenter: 'carpentry',
};
