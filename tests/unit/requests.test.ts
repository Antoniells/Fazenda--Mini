import { beforeEach, describe, expect, it } from 'vitest';
import { freshGame } from './helpers';
import { gameState } from '../../src/systems/gameState';
import { REQUESTS } from '../../src/data/requests';
import { CROPS } from '../../src/data/crops';
import { RESOURCES } from '../../src/data/resources';
import { getCurrentRequest, skipRequest, turnInRequest } from '../../src/systems/requests';
import { DAY_LENGTH_MS, GameClock } from '../../src/systems/gameClock';
import type { NpcId } from '../../src/data/npcs';

/** Quanto a Caixa de Remessas pagaria pelo que o pedido leva (colheitas e materiais com preço). */
function shippingValue(requirements: (typeof REQUESTS)[NpcId][number]['requirements']): number {
  let value = 0;
  for (const requirement of requirements) {
    if (requirement.kind === 'deliverCrop') value += CROPS[requirement.id].sellPrice * requirement.amount;
    if (requirement.kind === 'deliverResource') value += (RESOURCES[requirement.id].sellPrice ?? 0) * requirement.amount;
  }
  return value;
}

function nextDay(): void {
  const day = gameState.gameClock.getDay();
  gameState.gameClock = GameClock.deserialize({ day: day + 1, dayProgressMs: (8 / 24) * DAY_LENGTH_MS });
}

describe('pedidos dos moradores', () => {
  beforeEach(freshGame);

  it('pagam entre 1,2x e 3,5x o que a Caixa pagaria (os sem preço na Caixa — bolotas, doação — ficam fora)', () => {
    for (const [npc, pool] of Object.entries(REQUESTS)) {
      for (const request of pool) {
        const value = shippingValue(request.requirements);
        if (value === 0) continue;
        const resources = Object.entries(request.reward.resources ?? {}).reduce((sum, [id, amount]) => sum + (RESOURCES[id].sellPrice ?? 0) * (amount ?? 0), 0);
        const ratio = ((request.reward.coins ?? 0) + resources) / value;
        expect(ratio, `${npc}/${request.id}`).toBeGreaterThanOrEqual(1.2);
        expect(ratio, `${npc}/${request.id}`).toBeLessThanOrEqual(3.5);
      }
    }
  });

  it('pagar em moedas (a doação do coreto) devolve materiais que valem pelo menos 0,8x o pago na Caixa', () => {
    for (const pool of Object.values(REQUESTS)) {
      for (const request of pool) {
        const paid = request.requirements.reduce((sum, requirement) => sum + (requirement.kind === 'pay' ? requirement.coins : 0), 0);
        if (paid === 0) continue;
        const back = Object.entries(request.reward.resources ?? {}).reduce((sum, [id, amount]) => sum + (RESOURCES[id].sellPrice ?? 0) * (amount ?? 0), 0) + (request.reward.coins ?? 0);
        expect(back, request.id).toBeGreaterThanOrEqual(paid * 0.8);
      }
    }
  });

  it('o pedido de barra de ferro só aparece com a Picareta de Cobre, sem sair da fila', () => {
    // O 3º pedido do Bruno é o de ferro: chegando nele sem a picareta, ele pede o seguinte.
    gameState.requests.next = { blacksmith: 2 };
    expect(getCurrentRequest('blacksmith')!.id).toBe('bs-goo');
    gameState.inventory.upgradeTool('pickaxe-copper');
    expect(getCurrentRequest('blacksmith')!.id).toBe('bs-nails');
  });

  it('cumprir sem a picareta continua a fila depois do pedido cumprido, e o de ferro volta quando a picareta chegar', () => {
    gameState.requests.next = { blacksmith: 2 };
    gameState.inventory.addResources('slime-goo', 6);
    expect(turnInRequest('blacksmith')!.id).toBe('bs-goo');
    expect(getCurrentRequest('blacksmith')).toBeNull(); // Só amanhã.
    nextDay();
    expect(getCurrentRequest('blacksmith')!.id).toBe('bs-firewood'); // Depois do bs-goo (o último), a lista recomeça.
  });

  it('"Hoje não" dispensa sem pagar: o próximo pedido só vem amanhã', () => {
    const coins = gameState.inventory.getCoins();
    const first = getCurrentRequest('carpenter')!;
    expect(skipRequest('carpenter')!.id).toBe(first.id);
    expect(getCurrentRequest('carpenter')).toBeNull();
    expect(gameState.inventory.getCoins()).toBe(coins);
    expect(gameState.requests.completed.carpenter ?? 0).toBe(0);
    nextDay();
    expect(getCurrentRequest('carpenter')!.id).not.toBe(first.id);
  });

  it('save antigo (sem `next`) continua de onde os pedidos cumpridos apontam', () => {
    gameState.requests = { completed: { pirate: 1 }, availableFromDay: {} };
    expect(getCurrentRequest('pirate')!.id).toBe(REQUESTS.pirate[1].id);
  });
});
