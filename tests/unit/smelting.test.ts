import { beforeEach, describe, expect, it } from 'vitest';
import { freshGame } from './helpers';
import { gameState } from '../../src/systems/gameState';
import { DAY_LENGTH_MS } from '../../src/systems/gameClock';
import { activeSmeltAt, collectFinished, furnaceKey, readyBarAt, releaseFurnace, startSmeltAt } from '../../src/systems/smelting';
import { SMELT_MINUTES } from '../../src/data/smelting';
import { COAL, COPPER_BAR, COPPER_ORE, GOLD_BAR, AZURITE_ORE, STONE } from '../../src/data/resources';

const FURNACE = furnaceKey(5, 5);
const OTHER_FURNACE = furnaceKey(8, 5);

/** Avança `minutes` do relógio do jogo. */
const passMinutes = (minutes: number): void => {
  gameState.gameClock.update((minutes / 1440) * DAY_LENGTH_MS);
};

describe('Fornalha: clicar com o minério na mão', () => {
  beforeEach(freshGame);

  it('assar leva 4 horas', () => {
    expect(SMELT_MINUTES).toBe(240);
  });

  it('com o minério e o carvão: gasta 5 + 3 e assa; a barra fica pronta depois de 4 h e espera na Fornalha até ser buscada', () => {
    const inventory = gameState.inventory;
    inventory.addResources(COPPER_ORE.id, 7);
    inventory.addResources(COAL.id, 3);
    expect(startSmeltAt(FURNACE, COPPER_ORE.id, inventory)).toEqual({ kind: 'started', recipeId: 'smelt-copper', barId: COPPER_BAR.id });
    expect(inventory.getResourceCount(COPPER_ORE.id)).toBe(2);
    expect(inventory.getResourceCount(COAL.id)).toBe(0);

    passMinutes(SMELT_MINUTES - 30);
    expect(readyBarAt(FURNACE)).toBeNull();
    passMinutes(31);
    expect(readyBarAt(FURNACE)).toBe(COPPER_BAR.id);
    // Não vai sozinha pra Bolsa: fica flutuando sobre a Fornalha.
    expect(collectFinished()).toEqual([]);
    expect(inventory.getResourceCount(COPPER_BAR.id)).toBe(0);
    // Clicar nela (com o que for na mão) entrega a barra — e só isso, mesmo segurando minério.
    expect(startSmeltAt(FURNACE, COPPER_ORE.id, inventory)).toEqual({ kind: 'collected', barId: COPPER_BAR.id });
    expect(inventory.getResourceCount(COPPER_BAR.id)).toBe(1);
    expect(inventory.getResourceCount(COPPER_ORE.id)).toBe(2);
    expect(readyBarAt(FURNACE)).toBeNull();
    expect(activeSmeltAt(FURNACE)).toBeUndefined();
  });

  it('uma leva por Fornalha: ocupada recusa sem gastar; outra Fornalha assa ao mesmo tempo', () => {
    const inventory = gameState.inventory;
    inventory.addResources(COPPER_ORE.id, 10);
    inventory.addResources(COAL.id, 6);
    startSmeltAt(FURNACE, COPPER_ORE.id, inventory);
    const busy = startSmeltAt(FURNACE, COPPER_ORE.id, inventory);
    expect(busy.kind).toBe('busy');
    expect(busy.kind === 'busy' && busy.minutesLeft).toBe(SMELT_MINUTES);
    expect(inventory.getResourceCount(COPPER_ORE.id)).toBe(5);
    expect(startSmeltAt(OTHER_FURNACE, COPPER_ORE.id, inventory).kind).toBe('started');
  });

  it('sem minério na mão, ou sem materiais, nada é gasto', () => {
    const inventory = gameState.inventory;
    inventory.addResources(STONE.id, 10);
    inventory.addResources(COPPER_ORE.id, 4);
    inventory.addResources(COAL.id, 3);
    expect(startSmeltAt(FURNACE, null, inventory).kind).toBe('notOre');
    expect(startSmeltAt(FURNACE, STONE.id, inventory).kind).toBe('notOre');
    expect(startSmeltAt(FURNACE, COPPER_ORE.id, inventory)).toMatchObject({ kind: 'missing', oreAmount: 5, fuelId: COAL.id, fuelAmount: 3 });
    expect(inventory.getResourceCount(COPPER_ORE.id)).toBe(4);
    expect(inventory.getResourceCount(COAL.id)).toBe(3);
    expect(gameState.smelting.jobs).toEqual([]);
  });

  it('a Azurita assa com uma Barra de Ouro no lugar do carvão', () => {
    const inventory = gameState.inventory;
    inventory.addResources(AZURITE_ORE.id, 5);
    inventory.addResources(GOLD_BAR.id, 1);
    expect(startSmeltAt(FURNACE, AZURITE_ORE.id, inventory).kind).toBe('started');
    expect(inventory.getResourceCount(GOLD_BAR.id)).toBe(0);
  });

  it('save antigo (a fila da tela de receitas, sem Fornalha): não ocupa nenhuma Fornalha e vai sozinha pra Bolsa ao ficar pronta', () => {
    gameState.smelting.jobs.push({ recipeId: 'smelt-copper', doneAtMinute: (gameState.gameClock.getDay() - 1) * 1440 + gameState.gameClock.getHours() * 60 + 30 });
    expect(activeSmeltAt(FURNACE)).toBeUndefined();
    expect(collectFinished()).toEqual([]);
    passMinutes(31);
    expect(collectFinished().map((job) => job.recipeId)).toEqual(['smelt-copper']);
  });

  it('Fornalha tirada do lugar pelo Marceneiro: o que ela assava não se perde, vai sozinho pra Bolsa', () => {
    const inventory = gameState.inventory;
    inventory.addResources(COPPER_ORE.id, 5);
    inventory.addResources(COAL.id, 3);
    startSmeltAt(FURNACE, COPPER_ORE.id, inventory);
    releaseFurnace(FURNACE);
    expect(activeSmeltAt(FURNACE)).toBeUndefined();
    passMinutes(SMELT_MINUTES + 1);
    expect(collectFinished().map((job) => job.recipeId)).toEqual(['smelt-copper']);
  });
});
