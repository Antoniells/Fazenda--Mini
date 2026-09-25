import { FarmMapData, RectArea } from '../data/maps/farmMap';
import { ForestMapData } from '../data/maps/forestMap';
import { CaveMapData } from '../data/maps/caveMap';
import { BeachMapData } from '../data/maps/beachMap';
import { QuarryMapData } from '../data/maps/quarryMap';

/** Uma célula de cerca pintada + a variante exata do spritesheet escolhida pra ela (ver `data/tiles.ts` FENCE_*_INDEX e `MapEditorScene.FENCE_VARIANTS`). */
export interface FenceExportEntry {
  col: number;
  row: number;
  variantId: string;
}

/**
 * Estado "puro" (sem nada do Phaser) que o `MapEditorScene` mantém enquanto
 * o usuário pinta — só os dados necessários pra gerar o `FarmMapData`.
 * Separado da cena pra a lógica de exportação poder ser testada/lida sem
 * depender de nenhum game object.
 */
export interface EditorExportState {
  cols: number;
  rows: number;
  /**
   * GIDs pintados no Modo Ground (`[row][col]`) — vira `FarmMapData.ground`.
   * "GID" (não um índice de tile cru): com múltiplos tilesets disponíveis
   * na paleta (Grama/Solo/Água, ver `ui/tilePickerPanel.ts`), o mesmo
   * número (ex. 57) pintado em tilesets diferentes seria ambíguo — cada
   * tileset reserva sua própria faixa de GIDs (Grama começa em 0, mantendo
   * compatibilidade com o que o jogo já gera hoje; os demais começam bem
   * acima do maior tileset pra nunca colidir). Ver
   * `systems/groundTilesets.ts` pras faixas exatas.
   */
  ground: number[][];
  treePositions: Array<[number, number]>;
  farmlandArea: Array<[number, number]>;
  /** Não existe campo equivalente em `FarmMapData` — ver comentário gerado abaixo. */
  fences: FenceExportEntry[];
  shopPosition: [number, number] | null;
  shippingBinPosition: [number, number] | null;
  /** Cor de fundo escolhida na Sidebar (`this.cameras.main.setBackgroundColor`) — ver doc de `exportFarmMapData`. */
  backgroundColor: string;
  /** Células pintadas com "Bloco de Colisão" (Modo Entities), já filtradas (ver `MapEditorScene.exportableBlockedArea`) — vira `FarmMapData.blockedArea`, lido de verdade por `systems/grid.ts`. */
  blockedArea: Array<[number, number]>;
  /** Props de decoração ambiente pintados na aba "Decoração" (col, row, id de `data/mapProps.ts`) — vira `FarmMapData.props`, sem colisão nenhuma. */
  props: Array<[number, number, string]>;
}

function formatCoordArray(cells: Array<[number, number]>, indent: string): string {
  if (cells.length === 0) return '[]';
  const rows = cells.map(([col, row]) => `${indent}  [${col}, ${row}],`).join('\n');
  return `[\n${rows}\n${indent}]`;
}

/** Mesmo formato de `formatCoordArray`, mais o id do prop (`data/mapProps.ts`) — vira `XMapData.props`. */
function formatPropsArray(props: Array<[number, number, string]>, indent: string): string {
  if (props.length === 0) return '[]';
  const rows = props.map(([col, row, id]) => `${indent}  [${col}, ${row}, '${id}'],`).join('\n');
  return `[\n${rows}\n${indent}]`;
}

function formatRectArea(area: RectArea): string {
  return `{ col0: ${area.col0}, row0: ${area.row0}, cols: ${area.cols}, rows: ${area.rows} }`;
}

function formatGround(ground: number[][], indent: string): string {
  if (ground.length === 0) return '[]';
  const rows = ground.map((row) => `${indent}  [${row.join(', ')}],`).join('\n');
  return `[\n${rows}\n${indent}]`;
}

/**
 * Se `cells` forma um retângulo SÓLIDO (sem buracos) — mesmo formato que
 * `buildRectangle` (`data/maps/farmMap.ts`) gera —, devolve seus limites;
 * senão `null`. Usado só pra decidir COMO formatar `farmlandArea` na
 * exportação (ver `formatFarmlandArea`): nunca pra validar nada em tempo de
 * jogo.
 */
function findSolidRectangle(cells: Array<[number, number]>): RectArea | null {
  if (cells.length === 0) return null;

  let minCol = Infinity;
  let minRow = Infinity;
  let maxCol = -Infinity;
  let maxRow = -Infinity;
  const keys = new Set<string>();
  for (const [col, row] of cells) {
    minCol = Math.min(minCol, col);
    minRow = Math.min(minRow, row);
    maxCol = Math.max(maxCol, col);
    maxRow = Math.max(maxRow, row);
    keys.add(`${col},${row}`);
  }

  const cols = maxCol - minCol + 1;
  const rows = maxRow - minRow + 1;
  if (cells.length !== cols * rows) return null;

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      if (!keys.has(`${col},${row}`)) return null;
    }
  }

  return { col0: minCol, row0: minRow, cols, rows };
}

/**
 * `farmlandArea` como código-fonte: se as células pintadas formam um
 * retângulo sólido (o caso comum — mesmo formato que o `farmMap.ts`
 * original já usa), gera uma chamada a `buildRectangle(...)` em vez do
 * array cru, exatamente como o arquivo real escreveria à mão. Só nesse caso
 * a função `buildRectangle` é incluída no rodapé (`buildFarmFileFooter`) —
 * senão ela ficaria declarada e nunca usada, e o TypeScript recusa compilar
 * isso (`noUnusedLocals`, ver `tsconfig.json`).
 */
function formatFarmlandArea(cells: Array<[number, number]>): { code: string; usesBuildRectangle: boolean } {
  const rect = findSolidRectangle(cells);
  if (rect) {
    return { code: `buildRectangle(${rect.col0}, ${rect.row0}, ${rect.cols}, ${rect.rows})`, usesBuildRectangle: true };
  }
  return { code: formatCoordArray(cells, '  '), usesBuildRectangle: false };
}

/**
 * Cabeçalho REAL de `data/maps/farmMap.ts` (import + todos os `type`/
 * `interface` que `FarmMapData` usa) — precisa bater exatamente com o
 * arquivo de verdade, senão o `.ts` baixado (`MapEditorScene.exportMap`)
 * não teria as próprias definições que ele mesmo usa. Comentários de design
 * do arquivo original foram removidos daqui de propósito (documentação não
 * afeta a API — o que importa pro resto do jogo continuar funcionando são
 * os nomes/tipos, não o texto do comentário); o arquivo original continua
 * a fonte de verdade da documentação em si.
 */
const FARM_FILE_HEADER = [
  "export type ExpansionDirection = 'north' | 'south' | 'east' | 'west';",
  '',
  "export type BiomeId = 'core' | 'mining' | 'lumber' | 'beach' | 'cave' | 'village';",
  '',
  '/** Nome exibido de cada bioma — usado nos logs/textos da placa de compra. */',
  'export const BIOME_LABELS: Record<BiomeId, string> = {',
  "  core: 'Fazenda',",
  "  mining: 'Mineração',",
  "  lumber: 'Madeireira',",
  "  beach: 'Praia',",
  "  cave: 'Cavernas',",
  "  village: 'Vilarejo',",
  '};',
  '',
  'export interface ExpansionChunk {',
  '  direction: ExpansionDirection;',
  '  biome: BiomeId;',
  '  col0: number;',
  '  row0: number;',
  '  cols: number;',
  '  rows: number;',
  '  price: number;',
  '  signPosition: [number, number];',
  '  /** Já nasce aberto (sem parede nem placa de compra) — o Vilarejo a leste. */',
  '  startsUnlocked?: boolean;',
  '}',
  '',
  'export interface BridgeRequirement {',
  '  coins?: number;',
  '  items?: Array<{ itemId: string; amount: number; label: string }>;',
  '}',
  '',
  'export interface BridgeDefinition {',
  '  direction: ExpansionDirection;',
  '  col: number;',
  '  row: number;',
  '  destinationName: string;',
  '  destinationSceneKey: string;',
  '  requirement: BridgeRequirement;',
  '}',
  '',
  '/** Área retangular (canto superior-esquerdo + tamanho, em células) de uma estrutura estática do mapa. */',
  'export interface RectArea {',
  '  col0: number;',
  '  row0: number;',
  '  cols: number;',
  '  rows: number;',
  '}',
  '',
  'export interface FarmMapData {',
  '  tileSize: number;',
  '  cols: number;',
  '  rows: number;',
  '  ground?: number[][];',
  '  backgroundColor?: string;',
  '  blockedArea?: Array<[number, number]>;',
  '  expansions: ExpansionChunk[];',
  '  treePositions: Array<[number, number]>;',
  '  farmlandArea: Array<[number, number]>;',
  '  shippingBinPosition: [number, number];',
  '  shopPosition: [number, number];',
  '  housePosition: RectArea;',
  '  houseDoorPosition: [number, number];',
  '  rockPositions: Array<[number, number]>;',
  '  orePositions: Array<[number, number]>;',
  '  bridges: BridgeDefinition[];',
  '  foliagePositions: Array<[number, number]>;',
  '  props?: Array<[number, number, string]>;',
  '}',
].join('\n');

/**
 * Rodapé de `data/maps/farmMap.ts` — `getFarmlandFenceLayout` é exportada e
 * usada de verdade por `systems/grid.ts`/`systems/mapBuilder.ts`/
 * `systems/dirtPaths.ts`/`MapEditorScene.ts`, então SEMPRE entra.
 * `buildRectangle` só entra quando `usesBuildRectangle` é `true` (ver
 * `formatFarmlandArea`) — incluir a função sem ninguém chamar ela quebraria
 * a compilação (`noUnusedLocals`).
 */
function buildFarmFileFooter(usesBuildRectangle: boolean): string {
  const lines = [
    '',
    'export interface FarmlandFenceLayout {',
    '  col0: number;',
    '  row0: number;',
    '  colEnd: number;',
    '  rowEnd: number;',
    '  gate: [number, number];',
    '}',
    '',
    'export function getFarmlandFenceLayout(map: FarmMapData): FarmlandFenceLayout {',
    '  let minCol = Infinity;',
    '  let minRow = Infinity;',
    '  let maxCol = -Infinity;',
    '  let maxRow = -Infinity;',
    '  for (const [col, row] of map.farmlandArea) {',
    '    minCol = Math.min(minCol, col);',
    '    minRow = Math.min(minRow, row);',
    '    maxCol = Math.max(maxCol, col);',
    '    maxRow = Math.max(maxRow, row);',
    '  }',
    '',
    '  const row0 = minRow - 1;',
    '  return {',
    '    col0: minCol - 1,',
    '    row0,',
    '    colEnd: maxCol + 1,',
    '    rowEnd: maxRow + 1,',
    '    gate: [map.houseDoorPosition[0], row0],',
    '  };',
    '}',
  ];

  if (usesBuildRectangle) {
    lines.push(
      '',
      "/** Gera a lista de células (col, row) de um retângulo de `w` x `h` a partir de (`col0`, `row0`). */",
      'function buildRectangle(col0: number, row0: number, w: number, h: number): Array<[number, number]> {',
      '  const cells: Array<[number, number]> = [];',
      '  for (let row = row0; row < row0 + h; row++) {',
      '    for (let col = col0; col < col0 + w; col++) {',
      '      cells.push([col, row]);',
      '    }',
      '  }',
      '  return cells;',
      '}',
    );
  }

  return lines.join('\n');
}

/**
 * Gera o ARQUIVO `.ts` COMPLETO e pronto pra uso — pedido explícito do
 * usuário: baixar via `MapEditorScene.exportMap` (tecla `P`) e arrastar
 * direto pra `data/maps/farmMap.ts`, substituindo o antigo, sem faltar
 * import/type/interface/função nenhuma que o resto do jogo precise.
 *
 * `state` traz só o que o editor de fato edita (chão pintado, árvores,
 * terra arável, loja, caixa de remessas, cerca, cor de fundo, colisão);
 * `baseMap` é o `FarmMapData` real carregado ao abrir o editor — todo campo
 * que o editor NÃO tem ferramenta pra editar (expansões, pontes, casa,
 * pedras/minério/vegetação decorativa) é copiado dele tal como está, em vez
 * de virar um placeholder inventado. Isso é seguro porque o editor sempre
 * nasce mostrando o mapa atual — quem não mexeu numa área não mudou o dado
 * dela.
 *
 * "Cerca" também é pintável no editor, mas não é um campo de `FarmMapData`:
 * o jogo desenha a cerca sozinho, a partir de `farmlandArea` e dos limites
 * do núcleo (ver `getFarmlandFenceLayout`, incluída no rodapé). As células
 * (+ a variante exata escolhida) saem como comentário, só como guia visual.
 *
 * `backgroundColor` vira um campo real e opcional de `FarmMapData` (mesmo
 * tratamento de `ground`): a cena de jogo não lê esse campo ainda — é só
 * reservado pra quando alguém decidir consumi-lo.
 */
export function exportFarmMapData(baseMap: FarmMapData, state: EditorExportState): string {
  const farmland = formatFarmlandArea(state.farmlandArea);

  const lines: string[] = [];
  lines.push('export const farmMap: FarmMapData = {');
  lines.push(`  tileSize: ${baseMap.tileSize},`);
  lines.push(`  cols: ${state.cols},`);
  lines.push(`  rows: ${state.rows},`);
  lines.push(`  ground: ${formatGround(state.ground, '  ')},`);
  lines.push(`  backgroundColor: '${state.backgroundColor}',`);
  lines.push(`  expansions: ${JSON.stringify(baseMap.expansions)},`);
  lines.push(`  bridges: ${JSON.stringify(baseMap.bridges)},`);
  lines.push(`  treePositions: ${formatCoordArray(state.treePositions, '  ')},`);
  lines.push(`  farmlandArea: ${farmland.code},`);

  const shippingBin = state.shippingBinPosition ?? baseMap.shippingBinPosition;
  lines.push(`  shippingBinPosition: [${shippingBin[0]}, ${shippingBin[1]}],`);

  const shop = state.shopPosition ?? baseMap.shopPosition;
  lines.push(`  shopPosition: [${shop[0]}, ${shop[1]}],`);

  lines.push('  // Casa não tem ferramenta no editor (fora do escopo pedido) — valor atual preservado.');
  lines.push(`  housePosition: ${formatRectArea(baseMap.housePosition)},`);
  lines.push(`  houseDoorPosition: [${baseMap.houseDoorPosition[0]}, ${baseMap.houseDoorPosition[1]}],`);
  lines.push(`  rockPositions: ${formatCoordArray(baseMap.rockPositions, '  ')},`);
  lines.push(`  orePositions: ${formatCoordArray(baseMap.orePositions, '  ')},`);
  lines.push(`  foliagePositions: ${formatCoordArray(baseMap.foliagePositions, '  ')},`);
  lines.push(`  blockedArea: ${formatCoordArray(state.blockedArea, '  ')},`);
  lines.push(`  props: ${formatPropsArray(state.props, '  ')},`);
  lines.push('};');

  if (state.fences.length > 0) {
    lines.push('');
    lines.push('// "Cerca" pintada no editor — isto NÃO é um campo de FarmMapData: o jogo');
    lines.push('// desenha a cerca sozinho a partir de farmlandArea/limites do núcleo (ver');
    lines.push('// getFarmlandFenceLayout abaixo). Guia visual apenas, já com a variante');
    lines.push('// (orientação) exata escolhida pra cada célula:');
    lines.push(`// ${JSON.stringify(state.fences)}`);
  }

  const body = lines.join('\n');
  const footer = buildFarmFileFooter(farmland.usesBuildRectangle);

  return [
    '// Gerado pelo MapEditorScene (tecla P) — arquivo COMPLETO e pronto pra uso.',
    '// Arraste pra dentro de src/data/maps/, substituindo farmMap.ts.',
    FARM_FILE_HEADER,
    '',
    body,
    footer,
  ].join('\n');
}

/**
 * Os 4 exportadores abaixo (Floresta/Caverna/Praia/Pedreira) seguem o mesmo
 * princípio do de Fazenda acima — arquivo `.ts` COMPLETO, com o próprio
 * cabeçalho (`interface XMapData`, sem imports: nenhuma dessas 4 usa nada
 * de fora) — mas bem mais simples: essas 4 interfaces não têm nenhum campo
 * fora do alcance do editor (sem expansões/pontes/casa) e não têm nenhuma
 * função auxiliar própria (sem "rodapé"), então o editor cobre 100% dos
 * campos de cada uma sem precisar de "baseMap" nem funções extra.
 */

const FOREST_FILE_HEADER = [
  'export interface ForestMapData {',
  '  cols: number;',
  '  rows: number;',
  '  ground?: number[][];',
  '  backgroundColor?: string;',
  '  blockedArea?: Array<[number, number]>;',
  '  pineTreePositions: Array<[number, number]>;',
  '  birchTreePositions: Array<[number, number]>;',
  '  rockPositions: Array<[number, number]>;',
  '  lakeArea: { col0: number; row0: number; cols: number; rows: number };',
  '  props?: Array<[number, number, string]>;',
  '}',
].join('\n');

const CAVE_FILE_HEADER = [
  'export interface CaveMapData {',
  '  cols: number;',
  '  rows: number;',
  '  ground?: number[][];',
  '  backgroundColor?: string;',
  '  blockedArea?: Array<[number, number]>;',
  '  caveEntrancePosition: [number, number];',
  '  props?: Array<[number, number, string]>;',
  '}',
].join('\n');

const BEACH_FILE_HEADER = [
  'export interface BeachMapData {',
  '  cols: number;',
  '  rows: number;',
  '  ground?: number[][];',
  '  backgroundColor?: string;',
  '  blockedArea?: Array<[number, number]>;',
  '  oceanArea: { col0: number; row0: number; cols: number; rows: number };',
  '  rockPositions?: Array<[number, number]>;',
  '  bigRockPositions?: Array<[number, number]>;',
  '  props?: Array<[number, number, string]>;',
  '}',
].join('\n');

const QUARRY_FILE_HEADER = [
  'export interface QuarryMapData {',
  '  cols: number;',
  '  rows: number;',
  '  ground?: number[][];',
  '  backgroundColor?: string;',
  '  blockedArea?: Array<[number, number]>;',
  '  rockPositions: Array<[number, number]>;',
  '  bigRockPositions: Array<[number, number]>;',
  '  ironOrePositions: Array<[number, number]>;',
  '  coalOrePositions: Array<[number, number]>;',
  '  props?: Array<[number, number, string]>;',
  '}',
].join('\n');

function wrapSimpleMapFile(fileHeader: string, targetFile: string, body: string): string {
  return [
    '// Gerado pelo MapEditorScene (tecla P) — arquivo COMPLETO e pronto pra uso.',
    `// Arraste pra dentro de src/data/maps/, substituindo ${targetFile}.`,
    fileHeader,
    '',
    body,
  ].join('\n');
}

export interface ForestExportState {
  cols: number;
  rows: number;
  ground: number[][];
  pineTreePositions: Array<[number, number]>;
  birchTreePositions: Array<[number, number]>;
  rockPositions: Array<[number, number]>;
  lakeArea: RectArea;
  backgroundColor: string;
  /** Ver `EditorExportState.blockedArea`. */
  blockedArea: Array<[number, number]>;
  props: Array<[number, number, string]>;
}

export function exportForestMapData(state: ForestExportState): string {
  const lines: string[] = [];
  lines.push('export const forestMap: ForestMapData = {');
  lines.push(`  cols: ${state.cols},`);
  lines.push(`  rows: ${state.rows},`);
  lines.push(`  ground: ${formatGround(state.ground, '  ')},`);
  lines.push(`  backgroundColor: '${state.backgroundColor}',`);
  lines.push(`  blockedArea: ${formatCoordArray(state.blockedArea, '  ')},`);
  lines.push(`  pineTreePositions: ${formatCoordArray(state.pineTreePositions, '  ')},`);
  lines.push(`  birchTreePositions: ${formatCoordArray(state.birchTreePositions, '  ')},`);
  lines.push(`  rockPositions: ${formatCoordArray(state.rockPositions, '  ')},`);
  lines.push(`  lakeArea: ${formatRectArea(state.lakeArea)},`);
  lines.push(`  props: ${formatPropsArray(state.props, '  ')},`);
  lines.push('};');
  return wrapSimpleMapFile(FOREST_FILE_HEADER, 'forestMap.ts', lines.join('\n'));
}

export interface CaveExportState {
  cols: number;
  rows: number;
  ground: number[][];
  caveEntrancePosition: [number, number];
  backgroundColor: string;
  /** Ver `EditorExportState.blockedArea`. */
  blockedArea: Array<[number, number]>;
  props: Array<[number, number, string]>;
}

export function exportCaveMapData(state: CaveExportState): string {
  const lines: string[] = [];
  lines.push('export const caveMap: CaveMapData = {');
  lines.push(`  cols: ${state.cols},`);
  lines.push(`  rows: ${state.rows},`);
  lines.push(`  ground: ${formatGround(state.ground, '  ')},`);
  lines.push(`  backgroundColor: '${state.backgroundColor}',`);
  lines.push(`  blockedArea: ${formatCoordArray(state.blockedArea, '  ')},`);
  lines.push(`  caveEntrancePosition: [${state.caveEntrancePosition[0]}, ${state.caveEntrancePosition[1]}],`);
  lines.push(`  props: ${formatPropsArray(state.props, '  ')},`);
  lines.push('};');
  return wrapSimpleMapFile(CAVE_FILE_HEADER, 'caveMap.ts', lines.join('\n'));
}

export interface BeachExportState {
  cols: number;
  rows: number;
  ground: number[][];
  oceanArea: RectArea;
  backgroundColor: string;
  /** Ver `EditorExportState.blockedArea`. */
  blockedArea: Array<[number, number]>;
  rockPositions: Array<[number, number]>;
  bigRockPositions: Array<[number, number]>;
  props: Array<[number, number, string]>;
}

export function exportBeachMapData(state: BeachExportState): string {
  const lines: string[] = [];
  lines.push('export const beachMap: BeachMapData = {');
  lines.push(`  cols: ${state.cols},`);
  lines.push(`  rows: ${state.rows},`);
  lines.push(`  ground: ${formatGround(state.ground, '  ')},`);
  lines.push(`  backgroundColor: '${state.backgroundColor}',`);
  lines.push(`  blockedArea: ${formatCoordArray(state.blockedArea, '  ')},`);
  lines.push(`  oceanArea: ${formatRectArea(state.oceanArea)},`);
  lines.push(`  rockPositions: ${formatCoordArray(state.rockPositions, '  ')},`);
  lines.push(`  bigRockPositions: ${formatCoordArray(state.bigRockPositions, '  ')},`);
  lines.push(`  props: ${formatPropsArray(state.props, '  ')},`);
  lines.push('};');
  return wrapSimpleMapFile(BEACH_FILE_HEADER, 'beachMap.ts', lines.join('\n'));
}

export interface QuarryExportState {
  cols: number;
  rows: number;
  ground: number[][];
  rockPositions: Array<[number, number]>;
  bigRockPositions: Array<[number, number]>;
  ironOrePositions: Array<[number, number]>;
  coalOrePositions: Array<[number, number]>;
  backgroundColor: string;
  /** Ver `EditorExportState.blockedArea`. */
  blockedArea: Array<[number, number]>;
  props: Array<[number, number, string]>;
}

export function exportQuarryMapData(state: QuarryExportState): string {
  const lines: string[] = [];
  lines.push('export const quarryMap: QuarryMapData = {');
  lines.push(`  cols: ${state.cols},`);
  lines.push(`  rows: ${state.rows},`);
  lines.push(`  ground: ${formatGround(state.ground, '  ')},`);
  lines.push(`  backgroundColor: '${state.backgroundColor}',`);
  lines.push(`  blockedArea: ${formatCoordArray(state.blockedArea, '  ')},`);
  lines.push(`  rockPositions: ${formatCoordArray(state.rockPositions, '  ')},`);
  lines.push(`  bigRockPositions: ${formatCoordArray(state.bigRockPositions, '  ')},`);
  lines.push(`  ironOrePositions: ${formatCoordArray(state.ironOrePositions, '  ')},`);
  lines.push(`  coalOrePositions: ${formatCoordArray(state.coalOrePositions, '  ')},`);
  lines.push(`  props: ${formatPropsArray(state.props, '  ')},`);
  lines.push('};');
  return wrapSimpleMapFile(QUARRY_FILE_HEADER, 'quarryMap.ts', lines.join('\n'));
}

const VILLAGE_FILE_HEADER = [
  '/** Moradores que precisam saber qual casa é a deles — a casa carrega isto quando é movida no editor (`data/maps/villageMap.ts`). */',
  "export type VillageStructureRole = 'shop' | 'banker' | 'pirate';",
  '',
  'export interface VillageStructureLayout {',
  '  /** Id de `VILLAGE_ASSETS` (`data/maps/villageMap.ts`): house2, house3, house7, house8, newsstand, fountain. */',
  '  asset: string;',
  '  /** Célula do canto superior-esquerdo da ARTE (não das paredes). */',
  '  col: number;',
  '  row: number;',
  '  role?: VillageStructureRole;',
  '}',
  '',
  'export interface VillageLayoutData {',
  '  cols: number;',
  '  rows: number;',
  '  ground?: number[][];',
  '  backgroundColor?: string;',
  '  blockedArea?: Array<[number, number]>;',
  '  structures: VillageStructureLayout[];',
  '  well: { col: number; row: number };',
  '  trees: Array<[number, number]>;',
  '  props?: Array<[number, number, string]>;',
  '}',
].join('\n');

export interface VillageExportStructure {
  asset: string;
  col: number;
  row: number;
  role?: 'shop' | 'banker' | 'pirate';
}

export interface VillageExportState {
  cols: number;
  rows: number;
  ground: number[][];
  backgroundColor: string;
  /** Ver `EditorExportState.blockedArea`. */
  blockedArea: Array<[number, number]>;
  structures: VillageExportStructure[];
  well: { col: number; row: number };
  trees: Array<[number, number]>;
  props: Array<[number, number, string]>;
}

/** Gera o `villageLayout.ts` COMPLETO (interfaces + dados) — o Vilarejo lê o layout daqui (`data/maps/villageMap.ts`). */
export function exportVillageMapData(state: VillageExportState): string {
  const structureLines = state.structures.map((structure) => {
    const role = structure.role ? `, role: '${structure.role}'` : '';
    return `    { asset: '${structure.asset}', col: ${structure.col}, row: ${structure.row}${role} },`;
  });

  const lines: string[] = [];
  lines.push('export const villageLayout: VillageLayoutData = {');
  lines.push(`  cols: ${state.cols},`);
  lines.push(`  rows: ${state.rows},`);
  lines.push(`  ground: ${formatGround(state.ground, '  ')},`);
  lines.push(`  backgroundColor: '${state.backgroundColor}',`);
  lines.push(`  blockedArea: ${formatCoordArray(state.blockedArea, '  ')},`);
  lines.push(structureLines.length > 0 ? `  structures: [\n${structureLines.join('\n')}\n  ],` : '  structures: [],');
  lines.push(`  well: { col: ${state.well.col}, row: ${state.well.row} },`);
  lines.push(`  trees: ${formatCoordArray(state.trees, '  ')},`);
  lines.push(`  props: ${formatPropsArray(state.props, '  ')},`);
  lines.push('};');
  return wrapSimpleMapFile(VILLAGE_FILE_HEADER, 'villageLayout.ts', lines.join('\n'));
}

// Tipos re-exportados só pra documentar a intenção de cada `export function`
// acima (o parâmetro `state` já é auto-suficiente, sem "baseMap") — evita
// que quem for usar precise abrir os 4 arquivos de `data/maps/` só pra saber
// qual tipo de mapa cada exportador produz.
export type { ForestMapData, CaveMapData, BeachMapData, QuarryMapData };
