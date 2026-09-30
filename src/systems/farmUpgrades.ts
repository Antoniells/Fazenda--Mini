import { farmMap, RectArea } from '../data/maps/farmMap';
import { houseMap } from '../data/maps/houseMap';
import { HOUSE_DOOR_COL } from '../data/houseLevels';
import { currentHouseLevel } from './upgradeLevels';
import { DECORATIONS } from '../data/decorations';
import { UPGRADE_TRACKS, UpgradeStep, UpgradeTrack, maxUpgradeLevel } from '../data/upgrades';
import { gameState } from './gameState';
import { Inventory } from './inventory';
import { resourceNodeRegistry } from './resourceNodeRegistry';
import { FARM_RESOURCES_KEY, resetFarmResourceCaches } from './farmResources';

/**
 * Aplica as MELHORIAS do Marceneiro (`data/upgrades.ts`) ao mundo e cuida das compras. Os dados-base da Fazenda (`farmMap`) e da casa por dentro (`houseMap`) são módulos
 * globais lidos ao construir cada cena; `applyUpgrades` os REESCREVE conforme os níveis de `gameState.upgrades` — chamado ao começar/carregar uma partida, ao abrir a Fazenda e a casa e a cada
 * compra —, então as cenas (que são recriadas a cada entrada) já nascem com a casa, a lavoura e a cerca do nível atual. Nada aqui mexe em objetos do Phaser.
 *
 * - Casa (`data/houseLevels.ts`): `farmMap.housePosition`/`houseDoorPosition` (a arte é posicionada a partir da porta) e o cômodo de dentro (`houseMap`, saída no meio da parede de baixo).
 * - Plantio (`PLOT_LEVELS`): `farmMap.farmlandArea` (a cerca e todo o resto derivam dela) e as parcelas novas em `gameState.farmland`.
 * - Cerca (`data/fenceSkins.ts`): só o nível; quem desenha e dá vida às cercas lê `fenceSkin()`.
 */

/** As áreas da lavoura, por nível (0 = a original do mapa). Ficam dentro da grama da propriedade: a leste a estrada (colunas 32-34) e ao sul o caminho de terra (linha 26) limitam. */
export const PLOT_LEVELS: RectArea[] = [
  { col0: 14, row0: 13, cols: 12, rows: 8 },
  { col0: 12, row0: 13, cols: 16, rows: 10 },
  { col0: 10, row0: 13, cols: 20, rows: 12 },
  { col0: 8, row0: 13, cols: 22, rows: 13 },
];

/** Os dados originais da Fazenda/casa, guardados na 1ª carga do módulo (antes de qualquer melhoria) — o editor de mapas e o "começar de novo" partem deles. */
const BASE_FARMLAND = farmMap.farmlandArea;
const BASE_HOUSE_POSITION = { ...farmMap.housePosition };
const BASE_HOUSE_DOOR: [number, number] = [...farmMap.houseDoorPosition];
const BASE_HOUSE_MAP = { cols: houseMap.cols, rows: houseMap.rows, exitPosition: [...houseMap.exitPosition] as [number, number], spawnPosition: [...houseMap.spawnPosition] as [number, number] };

function clampLevel(track: UpgradeTrack, level: number | undefined): number {
  return Math.max(0, Math.min(maxUpgradeLevel(track), Math.floor(level ?? 0)));
}

function cellsOf(rect: RectArea): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  for (let row = rect.row0; row < rect.row0 + rect.rows; row++) for (let col = rect.col0; col < rect.col0 + rect.cols; col++) cells.push([col, row]);
  return cells;
}

/** Reescreve `farmMap`/`houseMap` conforme os níveis atuais e garante as parcelas da lavoura. Idempotente. */
export function applyUpgrades(): void {
  const house = currentHouseLevel();
  farmMap.housePosition = { col0: HOUSE_DOOR_COL - house.door.dx, row0: house.doorRow - house.door.dy, cols: house.cols, rows: house.rows };
  farmMap.houseDoorPosition = [HOUSE_DOOR_COL, house.doorRow];
  houseMap.cols = house.interior.cols;
  houseMap.rows = house.interior.rows;
  houseMap.exitPosition = [Math.floor(houseMap.cols / 2), houseMap.rows - 1];
  houseMap.spawnPosition = [houseMap.exitPosition[0], houseMap.rows - 2];

  farmMap.farmlandArea = cellsOf(PLOT_LEVELS[clampLevel('plot', gameState.upgrades.plot)]);
  gameState.farmland.addCells(farmMap.farmlandArea);
  resetFarmResourceCaches();
}

/** Devolve `farmMap`/`houseMap` aos dados originais (o editor de mapas nunca deve enxergar as melhorias de uma partida). */
export function resetFarmMapToBase(): void {
  farmMap.farmlandArea = BASE_FARMLAND;
  farmMap.housePosition = { ...BASE_HOUSE_POSITION };
  farmMap.houseDoorPosition = [...BASE_HOUSE_DOOR];
  houseMap.cols = BASE_HOUSE_MAP.cols;
  houseMap.rows = BASE_HOUSE_MAP.rows;
  houseMap.exitPosition = [...BASE_HOUSE_MAP.exitPosition];
  houseMap.spawnPosition = [...BASE_HOUSE_MAP.spawnPosition];
  resetFarmResourceCaches();
}

/** O nível atual de uma linha e o próximo degrau a comprar (`null` no nível máximo). */
export function upgradeLevel(track: UpgradeTrack): number {
  return clampLevel(track, gameState.upgrades[track]);
}

export function nextUpgradeStep(track: UpgradeTrack): UpgradeStep | null {
  return UPGRADE_TRACKS[track].steps[upgradeLevel(track)] ?? null;
}

/** O retângulo da lavoura MAIS a volta (1 célula) onde fica a cerca. */
function withFence(rect: RectArea): RectArea {
  return { col0: rect.col0 - 1, row0: rect.row0 - 1, cols: rect.cols + 2, rows: rect.rows + 2 };
}

/** As células que a próxima ampliação do plantio OCUPA de novo — as parcelas novas e o perímetro da cerca nova (as que a lavoura e a cerca de agora ainda não ocupam). */
function newPlotCells(): Array<[number, number]> {
  const next = PLOT_LEVELS[upgradeLevel('plot') + 1];
  if (!next) return [];
  const current = new Set(cellsOf(withFence(PLOT_LEVELS[upgradeLevel('plot')])).map(([col, row]) => `${col},${row}`));
  return cellsOf(withFence(next)).filter(([col, row]) => !current.has(`${col},${row}`));
}

/** O que impede a próxima melhoria agora (texto pro jogador), ou `null`. Só o plantio tem: construções (poço, galinheiro, baú, fornalha, aspersor...) e obras dentro da área nova. */
export function upgradeBlocker(track: UpgradeTrack): string | null {
  if (track !== 'plot') return null;
  const area = new Set(newPlotCells().map(([col, row]) => `${col},${row}`));
  if (area.size === 0) return null;
  const overlaps = (decorationId: string, col: number, row: number): boolean => {
    const { width, height } = DECORATIONS[decorationId]?.footprint ?? { width: 1, height: 1 };
    for (let dy = 0; dy < height; dy++) for (let dx = 0; dx < width; dx++) if (area.has(`${col + dx},${row + dy}`)) return true;
    return false;
  };
  for (const record of gameState.placedDecorations.values()) {
    if (overlaps(record.decorationId, record.col, record.row)) return `Tire: ${DECORATIONS[record.decorationId]?.name ?? record.decorationId}`;
  }
  for (const order of gameState.construction.orders) {
    if (overlaps(order.decorationId, order.col, order.row)) return `Obra: ${DECORATIONS[order.decorationId]?.name ?? order.decorationId}`;
  }
  return null;
}

export type UpgradePurchaseResult = 'bought' | 'maxed' | 'blocked' | 'poor' | 'noMaterials';

/**
 * Compra o próximo degrau de uma linha: confere tudo (nível máximo, obstáculo no plantio, materiais, moedas) ANTES de cobrar — nada sai numa recusa. Comprado, sobe o nível e aplica ao mundo
 * (`applyUpgrades`); as cenas já nascem com o novo nível na próxima vez que abrirem. Ampliar o plantio limpa árvores/pedras das parcelas novas e do perímetro da cerca nova, e trocar a cerca (ou a lavoura, que ganha
 * um perímetro novo) devolve uma cerca inteira: as destruídas pela horda somem.
 */
export function purchaseUpgrade(inventory: Inventory, track: UpgradeTrack): UpgradePurchaseResult {
  const step = nextUpgradeStep(track);
  if (!step) return 'maxed';
  if (upgradeBlocker(track)) return 'blocked';
  if (step.materials.some(({ resourceId, amount }) => inventory.getResourceCount(resourceId) < amount)) return 'noMaterials';
  if (!inventory.spendCoins(step.price)) return 'poor';
  for (const { resourceId, amount } of step.materials) inventory.useResource(resourceId, amount);

  if (track === 'plot') {
    const area = new Set(newPlotCells().map(([col, row]) => `${col},${row}`));
    for (const node of resourceNodeRegistry.getNodes(FARM_RESOURCES_KEY)) {
      if (node.kind !== 'weed' && area.has(`${node.col},${node.row}`)) resourceNodeRegistry.removeNode(FARM_RESOURCES_KEY, node.col, node.row);
    }
  }
  gameState.upgrades[track] = upgradeLevel(track) + 1;
  if (track === 'plot' || track === 'fence') gameState.destroyedFences = new Set();
  applyUpgrades();
  return 'bought';
}
