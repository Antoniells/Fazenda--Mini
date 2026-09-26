import { gameState, PlacedDecorationRecord } from './gameState';
import { DECORATIONS, DecorationDefinition } from '../data/decorations';
import {
  BUILD_START_HOUR,
  BuildStatus,
  BuildTarget,
  ConstructionOrder,
  DEFAULT_BUILD_HOURS,
  DESTROY_REFUND_RATE,
} from '../data/construction';
import { canRemoveCoop, coopKey, discardCoop } from './animals';

/**
 * Regras das encomendas ao Marceneiro (`data/construction.ts`) — só ESTADO (`gameState.construction`, `placedDecorations`), sem Phaser:
 * quem mostra as placas de obra e o Tomás trabalhando é a Fazenda (`systems/constructionSites.ts`, `systems/builderCrew.ts`).
 *
 * O andamento de cada encomenda sai só do RELÓGIO: a obra é no dia seguinte ao pedido (`orderedDay + 1`), começa às `BUILD_START_HOUR` e dura
 * `buildHours` da estrutura; as do mesmo dia entram em fila, na ordem do pedido. Não há timer nem contador guardado — abrir a Fazenda
 * depois de um tempo ("já passou da hora") simplesmente encontra a encomenda `done` e a transforma em construção (`materializeDone`).
 */

export const buildHoursOf = (decorationId: string): number => DECORATIONS[decorationId]?.buildHours ?? DEFAULT_BUILD_HOURS;

const buildDayOf = (order: ConstructionOrder): number => order.orderedDay + 1;

export function getOrders(): ConstructionOrder[] {
  return gameState.construction.orders;
}

/** Quando a obra da encomenda acontece: no dia seguinte ao pedido, do `startHour` (a fila, decidida ao pedir) até a duração da estrutura. */
export function scheduleOf(order: ConstructionOrder): { day: number; start: number; end: number } {
  return { day: buildDayOf(order), start: order.startHour, end: order.startHour + buildHoursOf(order.decorationId) };
}

/** A hora em que uma encomenda feita AGORA começa: depois de todas as já marcadas pro mesmo dia de obra (senão, às `BUILD_START_HOUR`). */
function nextStartHour(orderedDay: number): number {
  return gameState.construction.orders
    .filter((order) => order.orderedDay === orderedDay)
    .reduce((hour, order) => Math.max(hour, scheduleOf(order).end), BUILD_START_HOUR);
}

export function getBuildStatus(order: ConstructionOrder): BuildStatus {
  const today = gameState.gameClock.getDay();
  const hours = gameState.gameClock.getHours();
  const { day, start, end } = scheduleOf(order);
  if (today < day) return 'waiting';
  if (today > day) return 'done';
  if (hours < start) return 'waiting';
  return hours >= end ? 'done' : 'building';
}

/** O Marceneiro está na Fazenda construindo agora — a loja dele fecha ("ocupado"). */
export function isCarpenterBusy(): boolean {
  return gameState.construction.orders.some((order) => getBuildStatus(order) === 'building');
}

const hourText = (hour: number): string => `${String(Math.floor(hour)).padStart(2, '0')}:00`;

/** "amanhã às 08:00", "hoje às 08:00", "no dia 12 às 08:00" — quando o Tomás começa esta obra. */
export function describeSchedule(order: ConstructionOrder): string {
  const { day, start } = scheduleOf(order);
  const today = gameState.gameClock.getDay();
  const when = day === today ? 'hoje' : day === today + 1 ? 'amanhã' : `no dia ${day}`;
  return `${when} às ${hourText(start)}`;
}

/** Só as estruturas do Marceneiro têm encomenda (e ícones de mover/cancelar/destruir). */
export const isCarpenterBuilt = (decorationId: string): boolean => !!DECORATIONS[decorationId]?.carpenterBuilt;

/** Encomenda nova: cobra o preço (recusa sem moedas) e a deixa pendente pro dia seguinte. */
export function placeOrder(decoration: DecorationDefinition, col: number, row: number): ConstructionOrder | null {
  if (!gameState.inventory.spendCoins(decoration.price)) return null;
  const order: ConstructionOrder = {
    id: gameState.construction.nextId++,
    decorationId: decoration.id,
    col,
    row,
    orderedDay: gameState.gameClock.getDay(),
    startHour: nextStartHour(gameState.gameClock.getDay()),
    paid: decoration.price,
  };
  gameState.construction.orders.push(order);
  return order;
}

export function findOrder(id: number): ConstructionOrder | undefined {
  return gameState.construction.orders.find((order) => order.id === id);
}

/** Cancela a encomenda e devolve o que foi pago. Devolve quanto (0 se ela não existe mais). */
export function cancelOrder(id: number): number {
  const order = findOrder(id);
  if (!order) return 0;
  gameState.construction.orders = gameState.construction.orders.filter((candidate) => candidate.id !== id);
  gameState.inventory.addCoins(order.paid);
  return order.paid;
}

/** Muda o local de uma encomenda pendente (sem custo; mantém o dia/fila dela). */
export function moveOrder(id: number, col: number, row: number): boolean {
  const order = findOrder(id);
  if (!order) return false;
  order.col = col;
  order.row = row;
  return true;
}

export function getBuiltAt(col: number, row: number): PlacedDecorationRecord | undefined {
  return gameState.placedDecorations.get(`${col},${row}`);
}

/** Um galinheiro com galinhas não pode ser movido nem destruído (não há pra onde levá-las) — mesma regra da Picareta. */
export function isBuiltLocked(record: PlacedDecorationRecord): boolean {
  return !!DECORATIONS[record.decorationId]?.isCoop && !canRemoveCoop(coopKey(record.col, record.row));
}

/** Devolve `'locked'` (galinheiro ocupado), `false` (não existe) ou `true` — a construção pronta é retirada e o Tomás a refaz no novo local, no dia seguinte. */
export function moveBuilt(col: number, row: number, newCol: number, newRow: number): boolean | 'locked' {
  const record = getBuiltAt(col, row);
  if (!record) return false;
  if (isBuiltLocked(record)) return 'locked';
  if (DECORATIONS[record.decorationId]?.isCoop) discardCoop(coopKey(col, row));
  gameState.placedDecorations.delete(`${col},${row}`);
  gameState.construction.orders.push({
    id: gameState.construction.nextId++,
    decorationId: record.decorationId,
    col: newCol,
    row: newRow,
    orderedDay: gameState.gameClock.getDay(),
    startHour: nextStartHour(gameState.gameClock.getDay()),
    paid: 0,
  });
  return true;
}

/** Destrói a construção pronta e devolve 80% do preço. Devolve o reembolso, `'locked'` (galinheiro ocupado) ou `null` (não existe). */
export function destroyBuilt(col: number, row: number): number | 'locked' | null {
  const record = getBuiltAt(col, row);
  if (!record) return null;
  if (isBuiltLocked(record)) return 'locked';
  if (DECORATIONS[record.decorationId]?.isCoop) discardCoop(coopKey(col, row));
  gameState.placedDecorations.delete(`${col},${row}`);
  const refund = Math.floor((DECORATIONS[record.decorationId]?.price ?? 0) * DESTROY_REFUND_RATE);
  gameState.inventory.addCoins(refund);
  return refund;
}

/** As encomendas pendentes e as construções prontas de uma estrutura — o que os ícones da loja podem mudar. */
export function instancesOf(decorationId: string): { pending: ConstructionOrder[]; built: PlacedDecorationRecord[] } {
  return {
    pending: gameState.construction.orders.filter((order) => order.decorationId === decorationId),
    built: Array.from(gameState.placedDecorations.values()).filter((record) => record.decorationId === decorationId),
  };
}

/** Ações possíveis sobre a estrutura agora (os ícones da loja): mover qualquer uma; cancelar as pendentes pagas; destruir as prontas. */
export type ConstructionAction = 'move' | 'cancel' | 'destroy';
export function availableActions(decorationId: string): ConstructionAction[] {
  if (!isCarpenterBuilt(decorationId)) return [];
  const { pending, built } = instancesOf(decorationId);
  const actions: ConstructionAction[] = [];
  if (pending.length + built.length > 0) actions.push('move');
  if (pending.some((order) => order.paid > 0)) actions.push('cancel');
  if (built.length > 0) actions.push('destroy');
  return actions;
}

/** Candidatas de uma ação (cada uma é um `BuildTarget`). */
export function targetsFor(decorationId: string, action: ConstructionAction): BuildTarget[] {
  const { pending, built } = instancesOf(decorationId);
  const orders: BuildTarget[] = pending.filter((order) => action !== 'cancel' || order.paid > 0).map((order) => ({ kind: 'order', id: order.id }));
  const done: BuildTarget[] = built.map((record) => ({ kind: 'built', col: record.col, row: record.row }));
  if (action === 'cancel') return orders;
  if (action === 'destroy') return done;
  return [...orders, ...done];
}

/**
 * Encomendas que já terminaram (`done`) viram construção: saem da lista e entram em `placedDecorations`. Chamado quando a Fazenda abre
 * (antes de recriar as construções) e pelo `BuilderCrew` quando a obra termina com ela aberta. Devolve as que viraram.
 */
export function materializeDone(): ConstructionOrder[] {
  const finished = gameState.construction.orders.filter((order) => getBuildStatus(order) === 'done');
  if (finished.length === 0) return finished;
  const ids = new Set(finished.map((order) => order.id));
  gameState.construction.orders = gameState.construction.orders.filter((order) => !ids.has(order.id));
  for (const order of finished) {
    gameState.placedDecorations.set(`${order.col},${order.row}`, { decorationId: order.decorationId, col: order.col, row: order.row });
  }
  return finished;
}

/** As células (`"col,row"`) ocupadas por construções prontas e por obras encomendadas — onde não nasce planta decorativa nem mato (`buildGrassDetails`, `isFarmCellFreeForResource`). */
export function occupiedFootprintCells(): Set<string> {
  const cells = new Set<string>();
  const add = (decorationId: string, col: number, row: number): void => {
    const { width, height } = DECORATIONS[decorationId]?.footprint ?? { width: 1, height: 1 };
    for (let dy = 0; dy < height; dy++) for (let dx = 0; dx < width; dx++) cells.add(`${col + dx},${row + dy}`);
  };
  for (const record of gameState.placedDecorations.values()) add(record.decorationId, record.col, record.row);
  for (const order of gameState.construction.orders) add(order.decorationId, order.col, order.row);
  return cells;
}
