import { beforeEach, describe, expect, it } from 'vitest';
import { freshGame, memoryStorage } from './helpers';
import { gameState } from '../../src/systems/gameState';
import { deliverSeedOrders, orderSeed, pendingSeedOrders } from '../../src/systems/seedOrders';
import { getUnreadMail, markMailRead } from '../../src/systems/mail';
import { load, save } from '../../src/systems/saveManager';
import { CARROT, POTATO } from '../../src/data/crops';
import { WATERING_CAN_TIERS, describeWateringCan, wateringCanCapacity, wateringCells } from '../../src/data/wateringCan';
import { TOOL_OFFERS } from '../../src/data/toolShop';

describe('encomenda de sementes pela Caixa de Correio', () => {
  beforeEach(freshGame);

  it('paga na hora, chega na carta da manhã seguinte e as sementes vão pra Bolsa ao ler (uma vez só)', () => {
    gameState.inventory.addCoins(100);
    const coins = gameState.inventory.getCoins();
    const carrots = gameState.inventory.getSeedCount(CARROT.id);
    expect(orderSeed(CARROT.id)).toBe(true);
    expect(orderSeed(CARROT.id)).toBe(true);
    expect(orderSeed(POTATO.id)).toBe(true);
    expect(gameState.inventory.getCoins()).toBe(coins - 2 * CARROT.seedPrice - POTATO.seedPrice);
    expect(pendingSeedOrders()).toBe(3);
    expect(gameState.inventory.getSeedCount(CARROT.id)).toBe(carrots); // Ainda não chegou.

    expect(deliverSeedOrders()).toBe(true);
    expect(pendingSeedOrders()).toBe(0);
    const letter = getUnreadMail().find((mail) => mail.seeds);
    expect(letter?.body).toContain('2 Sementes de Cenoura e 1 Semente de Batata');
    markMailRead(letter!.id);
    markMailRead(letter!.id);
    expect(gameState.inventory.getSeedCount(CARROT.id)).toBe(carrots + 2);
    expect(gameState.inventory.getSeedCount(POTATO.id)).toBe(1);
  });

  it('sem moedas não encomenda nada, e sem encomenda não há carta', () => {
    gameState.inventory.spendCoins(gameState.inventory.getCoins());
    expect(orderSeed(CARROT.id)).toBe(false);
    expect(deliverSeedOrders()).toBe(false);
  });

  it('a encomenda pendente vai pro save', () => {
    memoryStorage.clear();
    freshGame();
    orderSeed(CARROT.id);
    save(0);
    freshGame();
    expect(pendingSeedOrders()).toBe(0);
    expect(load(0)).toBe(true);
    expect(pendingSeedOrders()).toBe(1);
  });
});

describe('regadores por tier', () => {
  beforeEach(freshGame);

  it('cada tier leva mais água; Ferro rega 3 em linha e Ouro 3x3, a clicada primeiro', () => {
    expect(WATERING_CAN_TIERS.map((tier) => tier.capacity)).toEqual([10, 25, 40, 70]);
    expect(wateringCells(0, 5, 5)).toEqual([[5, 5]]);
    expect(wateringCells(1, 5, 5)).toEqual([[5, 5]]);
    expect(wateringCells(2, 5, 5)).toEqual([[5, 5], [4, 5], [6, 5]]);
    const square = wateringCells(3, 5, 5);
    expect(square[0]).toEqual([5, 5]);
    expect(new Set(square.map(([c, r]) => `${c},${r}`)).size).toBe(9);
    expect(describeWateringCan(2)).toContain('3 terras em linha');
  });

  it('o Ferreiro vende os três regadores, e o novo substitui o antigo já cheio', () => {
    expect(TOOL_OFFERS.filter((offer) => offer.toolId.startsWith('water')).map((offer) => offer.toolId)).toEqual(['water-copper', 'water-iron', 'water-gold']);
    const inventory = gameState.inventory;
    expect(inventory.getWateringCanCapacity()).toBe(10);
    inventory.useWaterCharge();
    expect(inventory.upgradeTool('water-copper')).toBe(true);
    expect(inventory.hasTool('water')).toBe(false);
    expect(inventory.getWateringCanCapacity()).toBe(wateringCanCapacity(1));
    expect(inventory.getWateringCanCharges()).toBe(25);
  });
});
