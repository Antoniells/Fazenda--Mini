import { beforeEach, describe, expect, it } from 'vitest';
import { freshGame } from './helpers';
import { gameState } from '../../src/systems/gameState';
import { fishPool, landFish, pickFish, reelChallenge } from '../../src/systems/fishing';
import { hasMilestone } from '../../src/systems/story';
import { FISH, FISH_BY_ID, GOLDEN_FISH_ID } from '../../src/data/fishing';
import { RESOURCES } from '../../src/data/resources';

describe('pesca', () => {
  beforeEach(freshGame);

  it('cada lugar tem os seus peixes', () => {
    expect(fishPool('beach').every((fish) => fish.locations.includes('beach'))).toBe(true);
    expect(fishPool('forestLake').length).toBeGreaterThan(5);
    expect(fishPool('beach').some((fish) => fish.id === GOLDEN_FISH_ID)).toBe(false);
  });

  it('no santuário só o Peixe Dourado morde, até ser pescado', () => {
    expect(fishPool('sanctuary').map((fish) => fish.id)).toEqual([GOLDEN_FISH_ID]);
    landFish(FISH_BY_ID[GOLDEN_FISH_ID]);
    expect(hasMilestone('goldenFish')).toBe(true);
    expect(fishPool('sanctuary').some((fish) => fish.id === GOLDEN_FISH_ID)).toBe(false);
  });

  it('o sorteio respeita o lugar nas duas pontas do intervalo', () => {
    expect(pickFish('beach', () => 0)?.locations).toContain('beach');
    expect(pickFish('beach', () => 0.999999)?.locations).toContain('beach');
  });

  it('a Sorte do Pescador alarga a faixa verde', () => {
    const fish = FISH_BY_ID['fish-tuna'];
    const before = reelChallenge(fish).zone;
    gameState.skills.ranks.fishingLuck = 3;
    expect(reelChallenge(fish).zone).toBeGreaterThan(before);
  });

  it('todo peixe é um recurso da Bolsa, e só o Dourado não se vende', () => {
    for (const fish of FISH) {
      expect(RESOURCES[fish.id]).toBeDefined();
      expect((RESOURCES[fish.id].sellPrice ?? 0) > 0).toBe(fish.id !== GOLDEN_FISH_ID);
    }
  });
});
