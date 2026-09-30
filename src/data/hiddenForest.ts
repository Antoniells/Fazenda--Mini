/**
 * A FLORESTA OCULTA (Fase 11 — "Os Três Pilares", `data/story.ts`): o canto silencioso da Floresta que o Mapa Misterioso (baú do andar 50
 * das Cavernas) revela. Um arco de árvores aparece na Floresta; do outro lado, o castelo (a torre) engolido pelas árvores, onde vive um
 * mago excêntrico apaixonado por peixes. Quem lhe entrega os peixes que ele pede ganha acesso à Mesa de Encantamentos. Só DADOS: a cena é
 * `scenes/HiddenForestScene.ts`; o Mago, `systems/wizard.ts`.
 *
 * Artes: a torre é `Houses/NPCS houses/wizard's house.png` (4 variantes de 80x144; a 1ª, azul com trepadeiras, recorte pelo alfa); o Mago
 * é `Character/NPC'S/Mago/Idle/idle_0N.png` (quadros soltos de 64x64, pés em y=60 — créditos: https://pinogames.itch.io/); a Mesa é
 * `Work Benches/Alchemy Table.png` (3 quadros de 32x32: livro fechado, fechando, aberto); os arcos são `Deep Forest/Root portal.png`
 * (grade de 48x48).
 */

export const HIDDEN_FOREST_SCENE_KEY = 'HiddenForestScene';
export const HIDDEN_FOREST_NAME = 'Floresta Oculta';

export const HIDDEN_FOREST = {
  // Maior que a tela (1280x720 com o zoom do mundo): senão aparece o vazio em volta.
  cols: 34,
  rows: 22,
  /** A grama mais escura e fria: um lugar "silenciado". */
  groundTint: 0x9fbfb0,
} as const;

// --- O arco de árvores (entrada na Floresta e saída aqui) ---------------------------------------------------------------------------

export const ROOT_PORTAL = {
  key: 'root-portal',
  path: 'Objects/Exterior/Deep Forest/Root portal.png',
  /** Na Floresta: o arco verde com cogumelos (2ª linha, 2ª coluna); aqui dentro, o de folhas escuras (1ª linha, 1ª coluna). */
  forestFrame: { name: 'root-portal-forest', rect: { x: 48, y: 48, width: 48, height: 48 } },
  hiddenFrame: { name: 'root-portal-hidden', rect: { x: 0, y: 0, width: 48, height: 48 } },
};

/**
 * Onde o arco aparece na Floresta (canto noroeste, sempre livre): 3x3 células com a base em `cell`; a célula da base é a passagem (pisar
 * nela leva à área oculta) e as outras 8 são sólidas. A volta chega em `returnSpawn`, logo abaixo.
 */
export const FOREST_PORTAL = {
  cell: { col: 3, row: 3 },
  returnSpawn: { col: 3, row: 4 },
};

export function forestPortalCells(): Array<[number, number]> {
  const { col, row } = FOREST_PORTAL.cell;
  const cells: Array<[number, number]> = [];
  for (let dr = -2; dr <= 0; dr += 1) for (let dc = -1; dc <= 1; dc += 1) cells.push([col + dc, row + dr]);
  return cells;
}

// --- A torre, o Mago e a Mesa ------------------------------------------------------------------------------------------------------

export const WIZARD_TOWER = {
  key: 'wizard-tower',
  path: "Objects/Exterior/Houses/NPCS houses/wizard's house.png",
  frame: { name: 'wizard-tower', rect: { x: 10, y: 2, width: 60, height: 135 } },
  /** Base da torre (a porta fica no meio): a arte é ancorada pelo meio da base. */
  baseCol: 17,
  baseRow: 7,
  /** Células sólidas (o corpo da torre; o telhado é só por cima). */
  solid: { col0: 15, col1: 18, row0: 3, row1: 7 },
};

export const WIZARD = {
  name: 'Mago',
  title: 'O excêntrico da torre',
  idleFrames: [1, 2, 3, 4].map((n) => ({ key: `wizard-idle-${n}`, path: `Character/NPC'S/Mago/Idle/idle_0${n}.png` })),
  /** Quadro 64x64 com 3px de margem sob os pés. */
  frameSize: 64,
  footMargin: 3,
  scale: 1.25,
  cell: { col: 19, row: 9 },
};

export const ENCHANT_TABLE = {
  key: 'enchant-table',
  path: 'Objects/Work Benches/Alchemy Table.png',
  frameSize: 32,
  closedFrame: 0,
  openFrame: 2,
  /** Ocupa 2 células; a arte fica centrada entre elas. */
  cells: [
    { col: 14, row: 9 },
    { col: 15, row: 9 },
  ] as Array<{ col: number; row: number }>,
};

/** Árvores decorativas (sólidas) da clareira: um anel irregular em volta, deixando a passagem do arco livre. */
export function hiddenForestTrees(): Array<{ col: number; row: number; species: 'pine' | 'birch' }> {
  const { cols, rows } = HIDDEN_FOREST;
  const trees: Array<{ col: number; row: number; species: 'pine' | 'birch' }> = [];
  const exitCol = Math.floor(cols / 2);
  for (let col = 2; col < cols - 1; col += 2) {
    if (Math.abs(col - WIZARD_TOWER.baseCol) > 4) trees.push({ col, row: 2, species: col % 4 === 0 ? 'birch' : 'pine' });
    if (Math.abs(col - exitCol) > 2) trees.push({ col, row: rows - 3, species: col % 4 === 2 ? 'birch' : 'pine' });
  }
  for (let row = 5; row < rows - 3; row += 2) {
    trees.push({ col: 2, row, species: row % 4 === 1 ? 'birch' : 'pine' });
    trees.push({ col: cols - 3, row, species: row % 4 === 3 ? 'birch' : 'pine' });
  }
  // Algumas soltas na clareira.
  for (const [col, row] of [[8, 12], [26, 14], [9, 6], [25, 6], [6, 9], [12, 16], [23, 11]]) trees.push({ col, row, species: 'pine' });
  return trees;
}

// --- Os peixes que o Mago pede ---------------------------------------------------------------------------------------------------

/** "Espécies raras e específicas": um do mar e dois do lago (ids de `data/fishing.ts`). */
export const WIZARD_FISH_REQUESTS = ['fish-clownfish', 'fish-tiger-trout', 'fish-sturgeon'];

export const WIZARD_LINES = {
  intro: [
    'Hã? Visitas? Ninguém encontra esta torre há séculos... a não ser que alguém tenha seguido um certo mapa. Hmm.',
    'Você quer a minha Mesa de Encantamentos, não quer? Todos querem. Mas eu não confio em quem não sabe esperar à beira da água.',
    'Traga-me os peixes que eu peço — raros, belos, escorregadios! — e a mesa será sua.',
  ],
  waiting: 'Os peixes! Ainda faltam peixes! Sem peixe, sem magia. É uma regra antiga... e minha.',
  thanks: 'Magnífico! Você tem paciência e mão firme. A Mesa de Encantamentos é sua: use a Azurita das profundezas e a magia vai obedecer.',
  trusted: [
    'A Azurita canta quando encontra o metal certo. Leve Barras de Azurita à mesa.',
    'Uma picareta encantada estilhaça até barreiras mágicas. Hmm, eu sei de uma no fundo das Cavernas...',
    'Quando a profecia se cumprir, lembre-se: o pilar mais forte nunca é feito de ouro.',
  ],
};
