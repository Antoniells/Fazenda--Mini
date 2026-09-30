import { beforeEach, describe, expect, it } from 'vitest';
import { freshGame, memoryStorage } from './helpers';
import { gameState } from '../../src/systems/gameState';
import { load, save } from '../../src/systems/saveManager';
import { reachMilestone } from '../../src/systems/story';

/** A chave do slot 1 (a única gravada nestes testes). */
function slotKey(): string {
  const keys = [...memoryStorage.keys()];
  expect(keys.length).toBeGreaterThan(0);
  return keys[keys.length - 1];
}

describe('save da história', () => {
  beforeEach(() => {
    memoryStorage.clear();
    freshGame();
  });

  it('marcos, encantamentos, peixes do Mago e o plantio no altar voltam ao carregar', () => {
    reachMilestone('prophecy');
    reachMilestone('map');
    gameState.enchants.push('pickaxe');
    gameState.wizardDelivered.push('fish-tuna');
    gameState.sanctuary.plantedAt = 1234;
    save(0);

    freshGame(); // Zera o estado em memória; o save continua gravado.
    expect(gameState.story.reached).toEqual({});

    expect(load(0)).toBe(true);
    expect(Object.keys(gameState.story.reached)).toEqual(['prophecy', 'map']);
    expect(gameState.enchants).toEqual(['pickaxe']);
    expect(gameState.wizardDelivered).toEqual(['fish-tuna']);
    expect(gameState.sanctuary.plantedAt).toBe(1234);
  });

  it('um save antigo, sem os campos novos, carrega com a história zerada', () => {
    save(0);
    const key = slotKey();
    const data = JSON.parse(memoryStorage.get(key)!);
    delete data.story;
    delete data.enchants;
    delete data.wizardDelivered;
    delete data.sanctuary;
    memoryStorage.set(key, JSON.stringify(data));

    expect(load(0)).toBe(true);
    expect(gameState.story.reached).toEqual({});
    expect(gameState.enchants).toEqual([]);
    expect(gameState.wizardDelivered).toEqual([]);
    expect(gameState.sanctuary.plantedAt).toBeNull();
  });
});
