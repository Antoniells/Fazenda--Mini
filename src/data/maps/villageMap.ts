/**
 * Vilarejo (cena própria, `scenes/VillageScene.ts`, alcançada pela ponte LESTE da Fazenda — antes era um trecho colado à Fazenda).
 * Só DADOS + funções puras (sem Phaser): o desenho está em `systems/villageBuilder.ts` e as colisões entram no grid da cena a partir
 * daqui (`villageBlockedCells`) — a mesma fonte pros dois, então nunca há casa sem colisão nem o contrário.
 *
 * Coordenadas em CÉLULAS da cena (mapa 30x30). A área andável é col 1..28, linha 1..28 (o perímetro é bloqueado pela base das cenas
 * externas). A ponte de volta à Fazenda fica no meio da parede OESTE (0, 15). Layout: uma rua principal leste-oeste (linhas 14-15),
 * que nasce na ponte e cruza uma praça com chafariz; uma avenida norte-sul sai da praça; casas em três fileiras (norte, ao longo da
 * rua e sul), com a rua/viela da frente sempre livre; árvores, poço, banca e flores pra dar vida. Três das casas têm moradores
 * (`data/npcs.ts`): cada uma tem a PORTA da frente (`VillageAsset.door`), por onde o morador sai e entra na rotina.
 */

import type { DirtZone } from '../../systems/dirtPaths';
import { villageLayout, VillageStructureRole } from './villageLayout';

/**
 * O que é EDITÁVEL no Vilarejo (tamanho, casas, poço, árvores, decoração, colisão, chão autorado) vem de `villageLayout.ts` — o arquivo
 * que o `MapEditorScene` (F2 no Vilarejo, tecla P) gera. Este arquivo guarda o que NÃO é do editor: as artes (`VILLAGE_ASSETS`, com a
 * máscara de colisão de cada uma) e as regras derivadas do layout (ruas de terra, colisão, portas).
 */
export const VILLAGE_COLS = villageLayout.cols;
export const VILLAGE_ROWS = villageLayout.rows;

/** Uma arte de estrutura: arquivo, tamanho em células (16px de arte = 1 célula) e a máscara de colisão medida pelo alfa (`#` = célula sólida). */
export interface VillageAsset {
  key: string;
  path: string;
  /** Recorte (px) dentro da imagem, quando ela é uma folha (o chafariz). Ausente = imagem inteira. */
  frame?: { x: number; y: number; width: number; height: number };
  /**
   * Máscara de colisão, linha a linha da arte (topo → base): `#` bloqueia a célula. Medida por alfa (célula com pelo menos ~30% de
   * pixels opacos e da altura das paredes pra baixo) — o telhado NÃO bloqueia: o jogador passa "atrás" dele (a profundidade da
   * estrutura é a base das paredes, como na casa do jogador).
   */
  solid: string[];
  /**
   * Célula (relativa ao canto superior-esquerdo da arte) EM FRENTE à porta, já na rua — por onde o morador entra e sai. Medida na
   * arte: a porta fica na fileira de baixo das paredes e a célula da frente é a seguinte. Ausente = sem porta (casa decorativa).
   */
  door?: { dx: number; dy: number };
}

export const VILLAGE_ASSETS = {
  /** A casa tomada pela vegetação, com a porta lacrada: decorativa (sem morador). */
  house2: { key: 'village-house-2', path: 'Objects/Exterior/Houses/2.png', solid: ['.....', '.....', '.....', '#####', '#####', '.###.', '.....'] },
  house3: { key: 'village-house-3', path: 'Objects/Exterior/Houses/3.png', solid: ['........', '........', '........', '########', '########', '########', '........'], door: { dx: 3, dy: 6 } },
  house7: { key: 'village-house-7', path: 'Objects/Exterior/Houses/7.png', solid: ['........', '........', '........', '########', '########', '.###....'], door: { dx: 1, dy: 6 } },
  house8: { key: 'village-house-8', path: 'Objects/Exterior/Houses/8.png', solid: ['........', '........', '........', '........', '########', '########', '########', '........'], door: { dx: 1, dy: 7 } },
  newsstand: { key: 'village-newsstand', path: 'Objects/Exterior/Newsstand.png', solid: ['..', '##', '##'] },
  /** `Water fountain.png` (192x128): folha de 4x2 quadros de 48x64 — a fileira de cima é o chafariz cheio, animado (`VILLAGE_FOUNTAIN_FRAMES`). */
  fountain: { key: 'village-fountain', path: 'Objects/Exterior/Water fountain.png', frame: { x: 0, y: 0, width: 48, height: 64 }, solid: ['...', '...', '###', '###'] },
} satisfies Record<string, VillageAsset>;

export type VillageAssetId = keyof typeof VILLAGE_ASSETS;

/** Quadros do chafariz (fileira de cima da folha), em loop. */
export const VILLAGE_FOUNTAIN_FRAMES = [0, 1, 2, 3].map((index) => ({ name: `village-fountain-${index}`, rect: { x: index * 48, y: 0, width: 48, height: 64 } }));
export const VILLAGE_FOUNTAIN_FRAME_MS = 220;

export interface VillageStructure {
  asset: VillageAssetId;
  /** Célula do canto superior-esquerdo da ARTE (não das paredes). */
  col: number;
  row: number;
}

/** Ids de `VILLAGE_ASSETS` que o layout pode usar (o editor grava o id como texto); um id desconhecido (arquivo editado à mão) é ignorado. */
function isVillageAssetId(id: string): id is VillageAssetId {
  return id in VILLAGE_ASSETS;
}

/** Todas as estruturas do layout (`villageLayout.structures`) já com a arte resolvida; cada morador acha a casa dele por `role`. */
export const VILLAGE_STRUCTURES: VillageStructure[] = villageLayout.structures.flatMap((structure) =>
  isVillageAssetId(structure.asset) ? [{ asset: structure.asset, col: structure.col, row: structure.row }] : [],
);

/** A casa de um morador (a que tem o `role` dele no layout), ou a posição original se o arquivo não a tiver (nunca deixa o morador sem casa). */
function structureWithRole(role: VillageStructureRole, fallback: VillageStructure): VillageStructure {
  const found = villageLayout.structures.findIndex((structure) => structure.role === role && isVillageAssetId(structure.asset));
  if (found < 0) {
    console.warn(`villageLayout: nenhuma casa com role "${role}" — usando a posição padrão (${fallback.col}, ${fallback.row}).`);
    return fallback;
  }
  const layoutStructure = villageLayout.structures[found];
  return VILLAGE_STRUCTURES.find((s) => s.col === layoutStructure.col && s.row === layoutStructure.row && s.asset === layoutStructure.asset) ?? fallback;
}

/** A casa que é a LOJA do vilarejo e a moradia do Ferreiro (fachada e balcão em `data/villageShop.ts`, `systems/villageShop.ts`): a de madeira com toldo, na entrada da rua principal. */
export const VILLAGE_SHOP_HOUSE: VillageStructure = structureWithRole('shop', { asset: 'house8', col: 3, row: 7 });
/** Casa do Banqueiro (ao longo da rua principal, ao leste da praça) e do Pirata (fileira sul, de frente pra viela). */
export const VILLAGE_BANKER_HOUSE: VillageStructure = structureWithRole('banker', { asset: 'house3', col: 21, row: 8 });
export const VILLAGE_PIRATE_HOUSE: VillageStructure = structureWithRole('pirate', { asset: 'house7', col: 21, row: 18 });

/** O poço da praça (mesma arte do Poço construível, `data/decorations.ts` `WELL`, 2x1 células): célula do canto esquerdo. */
export const VILLAGE_WELL = villageLayout.well;

/** Pinheiros decorativos (só a célula do tronco bloqueia). */
export const VILLAGE_TREES: Array<[number, number]> = villageLayout.trees;

/** Flores/cogumelos/pedrinhas (ids de `data/mapProps.ts`) — só visuais, sem colisão. */
export const VILLAGE_PROPS: Array<[number, number, string]> = villageLayout.props ?? [];

function cellsOfRect(col0: number, row0: number, cols: number, rows: number): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  for (let row = row0; row < row0 + rows; row++) for (let col = col0; col < col0 + cols; col++) cells.push([col, row]);
  return cells;
}

/** Ruas de terra: rua principal (14-15), praça (11-17), avenida norte/sul (colunas 14..15) e a viela da fileira sul (24-25). */
const VILLAGE_DIRT_KEYS: Set<string> = new Set(
  [
    ...cellsOfRect(0, 14, 28, 2),
    ...cellsOfRect(10, 11, 9, 7),
    ...cellsOfRect(14, 1, 2, 10),
    ...cellsOfRect(14, 18, 2, 10),
    ...cellsOfRect(0, 24, 28, 2),
  ].map(([col, row]) => `${col},${row}`),
);

/** Célula de rua/praça de terra do vilarejo? (mesma interface de `DirtZone`, `systems/dirtPaths.ts`). */
export const villageDirtZone: DirtZone = { has: (col: number, row: number): boolean => VILLAGE_DIRT_KEYS.has(`${col},${row}`) };

/** Células da estrutura marcadas como sólidas pela máscara da arte. */
export function structureSolidCells(structure: VillageStructure): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  VILLAGE_ASSETS[structure.asset].solid.forEach((line, dy) => {
    for (let dx = 0; dx < line.length; dx++) if (line[dx] === '#') cells.push([structure.col + dx, structure.row + dy]);
  });
  return cells;
}

/** Última linha sólida da estrutura (a base das paredes) — a profundidade de desenho é a borda de baixo dela. */
export function structureBaseRow(structure: VillageStructure): number {
  const cells = structureSolidCells(structure);
  return Math.max(...cells.map(([, row]) => row));
}

/** Célula da rua em frente à porta da casa (por onde o morador entra e sai), ou `null` se a casa não tem porta. */
export function structureDoorCell(structure: VillageStructure): { col: number; row: number } | null {
  const door = (VILLAGE_ASSETS[structure.asset] as VillageAsset).door;
  return door ? { col: structure.col + door.dx, row: structure.row + door.dy } : null;
}

/** TODAS as células bloqueadas do vilarejo: paredes das estruturas, tronco das árvores, o poço e os Blocos de Colisão pintados no editor (`blockedArea`). A cena as soma ao grid. */
export function villageBlockedCells(): Array<[number, number]> {
  return [
    ...VILLAGE_STRUCTURES.flatMap(structureSolidCells),
    ...VILLAGE_TREES,
    [VILLAGE_WELL.col, VILLAGE_WELL.row],
    [VILLAGE_WELL.col + 1, VILLAGE_WELL.row],
    ...(villageLayout.blockedArea ?? []),
  ];
}
