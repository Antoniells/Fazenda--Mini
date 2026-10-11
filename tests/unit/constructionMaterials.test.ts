import { beforeEach, describe, expect, it } from 'vitest';
import { freshGame } from './helpers';
import { gameState } from '../../src/systems/gameState';
import { cancelOrder, hasMaterials, placeOrder } from '../../src/systems/construction';
import { FURNACE, WELL } from '../../src/data/decorations';
import { STONE } from '../../src/data/resources';

describe('Poço e Fornalha pedem Pedra', () => {
  beforeEach(freshGame);

  it('os dois levam Pedra', () => {
    expect(WELL.materials).toEqual([{ resourceId: STONE.id, amount: 15 }]);
    expect(FURNACE.materials).toEqual([{ resourceId: STONE.id, amount: 20 }]);
  });

  it('sem Pedra a encomenda é recusada sem cobrar; com Pedra cobra moedas e Pedra, e cancelar devolve as duas', () => {
    const inventory = gameState.inventory;
    inventory.addCoins(1000);
    const coins = inventory.getCoins();
    inventory.addResources(STONE.id, 10);
    expect(hasMaterials(WELL)).toBe(false);
    expect(placeOrder(WELL, 5, 5)).toBeNull();
    expect(inventory.getCoins()).toBe(coins);
    expect(inventory.getResourceCount(STONE.id)).toBe(10);

    inventory.addResources(STONE.id, 10);
    const order = placeOrder(WELL, 5, 5)!;
    expect(order).not.toBeNull();
    expect(inventory.getCoins()).toBe(coins - WELL.price);
    expect(inventory.getResourceCount(STONE.id)).toBe(5);

    expect(cancelOrder(order.id)).toBe(WELL.price);
    expect(inventory.getCoins()).toBe(coins);
    expect(inventory.getResourceCount(STONE.id)).toBe(20);
  });
});
