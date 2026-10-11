import { describe, expect, it } from 'vitest';
import { BEEHIVE_CHANCE, HONEY_DROP, rollBeehive } from '../../src/data/beehives';
import { HONEY, RESOURCES } from '../../src/data/resources';
import { resourceNodeRegistry } from '../../src/systems/resourceNodeRegistry';

describe('colmeias nas árvores', () => {
  it('15% das árvores que ficam adultas ganham colmeia', () => {
    expect(BEEHIVE_CHANCE).toBe(0.15);
    expect(rollBeehive(0)).toBe(true);
    expect(rollBeehive(0.149)).toBe(true);
    expect(rollBeehive(0.15)).toBe(false);
    expect(rollBeehive(0.99)).toBe(false);
  });

  it('a colmeia vai pro save junto com a árvore (e save antigo, sem o campo, fica sem colmeia)', () => {
    resourceNodeRegistry.ensureInitialized('TesteColmeia', [{ col: 1, row: 1, kind: 'tree', stage: 'mature' }], { maxTrees: 5, maxRocks: 0 });
    resourceNodeRegistry.addNode('TesteColmeia', { col: 2, row: 2, kind: 'tree', stage: 'mature', beehive: true });
    const saved = JSON.parse(JSON.stringify(resourceNodeRegistry.serialize()));
    resourceNodeRegistry.restore(saved);
    expect(resourceNodeRegistry.getNode('TesteColmeia', 2, 2)?.beehive).toBe(true);
    expect(resourceNodeRegistry.getNode('TesteColmeia', 1, 1)?.beehive).toBeUndefined();
  });

  it('o Mel é um material vendável, de 1 a 2 por colmeia', () => {
    expect(RESOURCES[HONEY.id]).toBe(HONEY);
    expect(HONEY.name).toBe('Mel');
    expect(HONEY.sellPrice).toBeGreaterThan(0);
    expect(HONEY_DROP).toEqual([1, 2]);
  });
});
