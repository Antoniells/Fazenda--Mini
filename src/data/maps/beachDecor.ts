/**
 * Elementos da Praia além do chão e das pedras (`data/maps/beachMap.ts`): a casinha do pescador, os guarda-sóis com mesinha, cadeiras
 * de praia, toalhas, as barracas da feirinha, os coqueiros, o moai e uma canoa. Só DADOS + funções puras (sem Phaser): o desenho está
 * em `systems/beachBuilder.ts` e as colisões entram no grid da cena pela MESMA fonte (`beachBlockedCells`).
 *
 * Coordenadas em CÉLULAS da cena: (`col`, `row`) é a célula do canto INFERIOR ESQUERDO da arte (a arte cresce pra cima e pra direita a
 * partir dali; a profundidade é a borda de baixo dessa célula). `blocks` lista as células sólidas relativas a esse canto (`dy` 0 = a
 * linha de baixo, `dy` negativo sobe). A arte é desenhada em escala 2 (16px = 1 célula).
 */

export interface BeachFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BeachAsset {
  key: string;
  path: string;
  frame: BeachFrame;
  /** Células sólidas relativas ao canto inferior esquerdo (`[dx, dy]`, `dy` 0 = linha de baixo). Vazio = decoração sem colisão. */
  blocks: Array<[number, number]>;
  /** Objeto plano de chão (toalha/tapete): desenhado logo acima da areia, sempre atrás dos personagens. */
  flat?: boolean;
  /** Célula (relativa ao canto inferior esquerdo) EM FRENTE à porta, se a peça for uma casa com porta. */
  door?: { dx: number; dy: number };
}

const EXTERIOR = { key: 'beach-exterior', path: 'Objects/Exterior/Beach/Exterior Beach.png' };
const TENT = { key: 'beach-tent', path: 'Objects/Exterior/Beach/Tent.png' };
const row = (dx0: number, dx1: number, dy = 0): Array<[number, number]> => Array.from({ length: dx1 - dx0 + 1 }, (_, i) => [dx0 + i, dy] as [number, number]);

/** Mantém os nomes das peças como chaves literais (pra `BeachAssetId`) e confere cada uma contra `BeachAsset`. */
const defineAssets = <T extends Record<string, BeachAsset>>(assets: T): T => assets;

export const BEACH_ASSETS = defineAssets({
  /** A casa do pescador (`Houses/NPCS houses/Fishman.png`, a primeira das casas da folha): 5x6 células; as paredes são as 3 linhas de baixo, a porta fica na 4ª coluna. */
  house: {
    key: 'beach-house',
    path: 'Objects/Exterior/Houses/NPCS houses/Fishman.png',
    frame: { x: 2, y: 8, width: 82, height: 100 },
    blocks: [...row(0, 4, 0), ...row(0, 4, -1), ...row(0, 4, -2)],
    door: { dx: 3, dy: 1 },
  },
  umbrellaRed: { ...EXTERIOR, frame: { x: 7, y: 151, width: 34, height: 41 }, blocks: row(0, 1) },
  umbrellaGreen: { ...EXTERIOR, frame: { x: 55, y: 151, width: 34, height: 41 }, blocks: row(0, 1) },
  umbrellaOrange: { ...EXTERIOR, frame: { x: 7, y: 199, width: 34, height: 41 }, blocks: row(0, 1) },
  umbrellaPink: { ...EXTERIOR, frame: { x: 55, y: 199, width: 34, height: 41 }, blocks: row(0, 1) },
  towelYellow: { ...EXTERIOR, frame: { x: 102, y: 159, width: 19, height: 32 }, blocks: [], flat: true },
  towelBlue: { ...EXTERIOR, frame: { x: 134, y: 159, width: 19, height: 32 }, blocks: [], flat: true },
  towelRed: { ...EXTERIOR, frame: { x: 166, y: 159, width: 19, height: 32 }, blocks: [], flat: true },
  towelGreen: { ...EXTERIOR, frame: { x: 262, y: 159, width: 19, height: 32 }, blocks: [], flat: true },
  rugBlue: { ...EXTERIOR, frame: { x: 102, y: 207, width: 20, height: 32 }, blocks: [], flat: true },
  rugOrange: { ...EXTERIOR, frame: { x: 230, y: 207, width: 20, height: 32 }, blocks: [], flat: true },
  chairYellow: { ...EXTERIOR, frame: { x: 103, y: 96, width: 20, height: 32 }, blocks: [[0, 0]] },
  chairBlue: { ...EXTERIOR, frame: { x: 167, y: 96, width: 20, height: 32 }, blocks: [[0, 0]] },
  chairRed: { ...EXTERIOR, frame: { x: 135, y: 96, width: 20, height: 32 }, blocks: [[0, 0]] },
  umbrellaClosedRed: { ...EXTERIOR, frame: { x: 298, y: 208, width: 12, height: 30 }, blocks: [[0, 0]] },
  umbrellaClosedBlue: { ...EXTERIOR, frame: { x: 330, y: 208, width: 12, height: 30 }, blocks: [[0, 0]] },
  stallFish: { ...TENT, frame: { x: 0, y: 144, width: 48, height: 48 }, blocks: row(0, 2) },
  stallFruit: { ...TENT, frame: { x: 48, y: 48, width: 48, height: 48 }, blocks: row(0, 2) },
  palms: { key: 'beach-palms', path: 'Objects/Exterior/Beach/Coconut Tree.png', frame: { x: 0, y: 0, width: 80, height: 48 }, blocks: [[1, 0], [4, 0]] },
  moai: { key: 'beach-moai', path: 'Objects/Exterior/Beach/Moai.png', frame: { x: 0, y: 0, width: 32, height: 48 }, blocks: row(0, 1) },
  canoe: { key: 'beach-canoe', path: 'Objects/Exterior/Beach/wood canoe.png', frame: { x: 0, y: 0, width: 64, height: 48 }, blocks: row(0, 3) },
});

export type BeachAssetId = keyof typeof BEACH_ASSETS;

export interface BeachPlacement {
  asset: BeachAssetId;
  col: number;
  row: number;
}

/** A casinha do pescador (norte-oeste da faixa de areia) — a porta dá pra célula (9, 9), de frente pra feirinha (é só a fachada: não dá pra entrar). */
export const BEACH_HOUSE: BeachPlacement = { asset: 'house', col: 6, row: 8 };

export const BEACH_PLACEMENTS: BeachPlacement[] = [
  BEACH_HOUSE,
  // Feirinha ao lado da casa.
  { asset: 'stallFish', col: 13, row: 9 },
  { asset: 'stallFruit', col: 17, row: 9 },
  // Coqueiros com rede, moai e uma canoa encalhada.
  { asset: 'palms', col: 27, row: 6 },
  { asset: 'moai', col: 35, row: 6 },
  { asset: 'canoe', col: 13, row: 18 },
  // Cantinhos de sol: guarda-sol com mesinha, cadeiras e toalhas.
  { asset: 'umbrellaRed', col: 24, row: 13 },
  { asset: 'towelYellow', col: 27, row: 13 },
  { asset: 'chairBlue', col: 22, row: 13 },
  { asset: 'umbrellaGreen', col: 31, row: 15 },
  { asset: 'towelBlue', col: 34, row: 15 },
  { asset: 'chairRed', col: 29, row: 15 },
  { asset: 'umbrellaOrange', col: 4, row: 14 },
  { asset: 'rugOrange', col: 7, row: 14 },
  { asset: 'chairYellow', col: 2, row: 14 },
  { asset: 'umbrellaPink', col: 9, row: 16 },
  { asset: 'towelRed', col: 12, row: 15 },
  { asset: 'towelGreen', col: 36, row: 12 },
  { asset: 'rugBlue', col: 19, row: 15 },
  { asset: 'umbrellaClosedRed', col: 16, row: 14 },
  { asset: 'umbrellaClosedBlue', col: 37, row: 16 },
];

/** Onde fica a sereia (uma célula de MAR encostada na areia, no meio da praia) — quem fala com ela fica na areia logo acima. */
export const BEACH_MERMAID_CELL = { col: 22, row: 20 };

/** TODAS as células sólidas dos elementos da praia (mesma fonte do desenho — nunca há peça sem colisão nem colisão sem peça). */
export function beachBlockedCells(): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  for (const placement of BEACH_PLACEMENTS) {
    for (const [dx, dy] of BEACH_ASSETS[placement.asset].blocks) cells.push([placement.col + dx, placement.row + dy]);
  }
  return cells;
}
