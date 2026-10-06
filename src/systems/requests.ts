import { gameState } from './gameState';
import { Inventory } from './inventory';
import { REQUESTS, RequestDefinition } from '../data/requests';
import type { NpcId } from '../data/npcs';
import { evaluateRequirement, consumeRequirements, grantReward } from './campaign';

export interface RequestStatus {
  request: RequestDefinition;
  lines: Array<{ text: string; done: boolean }>;
  ready: boolean;
}

/** O jogador já consegue cumprir este pedido? (`unlock`: ter a ferramenta pedida, ou melhor.) */
function isUnlocked(request: RequestDefinition, inventory: Inventory): boolean {
  return !request.unlock || inventory.getToolTier(request.unlock.family) >= request.unlock.tier;
}

/**
 * Índice (na lista do morador) do pedido da vez: a partir de onde a fila parou, o primeiro que o jogador já consegue cumprir — os
 * travados (`unlock`) são pulados SEM sair da fila, e voltam quando o jogador tiver a ferramenta. `null` = nenhum disponível.
 */
function currentIndex(id: NpcId, inventory: Inventory): number | null {
  const pool = REQUESTS[id] ?? [];
  const base = gameState.requests.next?.[id] ?? gameState.requests.completed[id] ?? 0;
  for (let offset = 0; offset < pool.length; offset++) {
    const index = (base + offset) % pool.length;
    if (isUnlocked(pool[index], inventory)) return index;
  }
  return null;
}

/** O pedido de HOJE deste morador, ou `null` se já cumpriu (ou dispensou) o de hoje — o próximo vem amanhã — ou ele não tem pedidos. */
export function getCurrentRequest(id: NpcId, inventory: Inventory = gameState.inventory): RequestDefinition | null {
  const from = gameState.requests.availableFromDay[id] ?? 0;
  if (gameState.gameClock.getDay() < from) return null;
  const index = currentIndex(id, inventory);
  return index === null ? null : REQUESTS[id][index];
}

export function getRequestStatus(request: RequestDefinition, inventory: Inventory = gameState.inventory): RequestStatus {
  const lines = request.requirements.map((requirement) => evaluateRequirement(requirement, inventory, gameState.campaign));
  return { request, lines, ready: lines.every((line) => line.done) };
}

/** Quantos pedidos o jogador já cumpriu no total (pra tela final). */
export function countCompletedRequests(): number {
  return Object.values(gameState.requests.completed).reduce((sum, value) => sum + (value ?? 0), 0);
}

/** A fila deste morador anda pro pedido seguinte ao `index`, que só vem amanhã. */
function advanceQueue(id: NpcId, index: number): void {
  gameState.requests.next = { ...(gameState.requests.next ?? {}), [id]: index + 1 };
  gameState.requests.availableFromDay[id] = gameState.gameClock.getDay() + 1;
}

/**
 * Entrega o pedido de hoje: reconfere tudo, consome o pedido (colheita/recurso/moedas), paga a recompensa e marca o próximo pra
 * amanhã. Devolve o pedido cumprido, ou `null` (sem tocar em nada) se não dá.
 */
export function turnInRequest(id: NpcId, inventory: Inventory = gameState.inventory): RequestDefinition | null {
  const request = getCurrentRequest(id, inventory);
  const index = currentIndex(id, inventory);
  if (!request || index === null || !getRequestStatus(request, inventory).ready) return null;

  consumeRequirements(request.requirements, inventory);
  grantReward(request.reward, inventory);

  gameState.requests.completed[id] = (gameState.requests.completed[id] ?? 0) + 1;
  advanceQueue(id, index);
  return request;
}

/**
 * "Hoje não": dispensa o pedido de hoje sem recompensa — a fila anda e o próximo pedido só vem amanhã (não dá pra trocar de pedido
 * no mesmo dia). Devolve o pedido dispensado, ou `null` se não havia nenhum.
 */
export function skipRequest(id: NpcId, inventory: Inventory = gameState.inventory): RequestDefinition | null {
  const request = getCurrentRequest(id, inventory);
  const index = currentIndex(id, inventory);
  if (!request || index === null) return null;
  advanceQueue(id, index);
  return request;
}
