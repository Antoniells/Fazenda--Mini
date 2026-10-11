import { beforeEach, describe, expect, it } from 'vitest';
import { freshGame } from './helpers';
import { gameState } from '../../src/systems/gameState';
import { STONE } from '../../src/data/resources';

/** O slot da Bolsa onde está o item (`category`, `id`), ou -1. */
function slotOf(category: string, id: string): number {
  for (let index = 0; index < 60; index++) {
    const ref = gameState.inventory.getSlot(index);
    if (ref?.category === category && ref.id === id) return index;
  }
  return -1;
}

describe('lixeira do caderno', () => {
  beforeEach(freshGame);

  it('joga fora o item inteiro do slot e libera o slot', () => {
    const inventory = gameState.inventory;
    inventory.addResources(STONE.id, 12);
    const slot = slotOf('resource', STONE.id);
    expect(slot).toBeGreaterThanOrEqual(0);
    expect(inventory.trashSlot(slot)).toEqual({ kind: 'trashed', ref: { category: 'resource', id: STONE.id }, amount: 12 });
    expect(inventory.getResourceCount(STONE.id)).toBe(0);
    expect(inventory.getSlot(slot)).toBeNull();
  });

  it('sementes também; ferramentas não vão pro lixo; slot vazio não faz nada', () => {
    const inventory = gameState.inventory;
    const seedSlot = slotOf('seed', 'carrot');
    expect(seedSlot).toBeGreaterThanOrEqual(0);
    expect(inventory.trashSlot(seedSlot).kind).toBe('trashed');
    expect(inventory.getSeedCount('carrot')).toBe(0);

    const hoeSlot = slotOf('tool', 'hoe');
    expect(inventory.trashSlot(hoeSlot)).toEqual({ kind: 'refused' });
    expect(inventory.getSlot(hoeSlot)).toEqual({ category: 'tool', id: 'hoe' });

    expect(inventory.trashSlot(seedSlot)).toEqual({ kind: 'empty' });
  });
});
