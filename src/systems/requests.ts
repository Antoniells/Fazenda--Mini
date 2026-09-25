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

/** O pedido de HOJE deste morador, ou `null` se já cumpriu o de hoje (o próximo vem amanhã) ou ele não tem pedidos. */
export function getCurrentRequest(id: NpcId): RequestDefinition | null {
  const pool = REQUESTS[id] ?? [];
  if (pool.length === 0) return null;
  const from = gameState.requests.availableFromDay[id] ?? 0;
  if (gameState.gameClock.getDay() < from) return null;
  return pool[(gameState.requests.completed[id] ?? 0) % pool.length];
}

export function getRequestStatus(request: RequestDefinition, inventory: Inventory = gameState.inventory): RequestStatus {
  const lines = request.requirements.map((requirement) => evaluateRequirement(requirement, inventory, gameState.campaign));
  return { request, lines, ready: lines.every((line) => line.done) };
}

/** Quantos pedidos o jogador já cumpriu no total (pra tela final). */
export function countCompletedRequests(): number {
  return Object.values(gameState.requests.completed).reduce((sum, value) => sum + (value ?? 0), 0);
}

/**
 * Entrega o pedido de hoje: reconfere tudo, consome o pedido (colheita/recurso/moedas), paga a recompensa e marca o próximo pra
 * amanhã. Devolve o pedido cumprido, ou `null` (sem tocar em nada) se não dá.
 */
export function turnInRequest(id: NpcId, inventory: Inventory = gameState.inventory): RequestDefinition | null {
  const request = getCurrentRequest(id);
  if (!request || !getRequestStatus(request, inventory).ready) return null;

  consumeRequirements(request.requirements, inventory);
  grantReward(request.reward, inventory);

  gameState.requests.completed[id] = (gameState.requests.completed[id] ?? 0) + 1;
  gameState.requests.availableFromDay[id] = gameState.gameClock.getDay() + 1;
  return request;
}
