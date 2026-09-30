import { beforeEach, describe, expect, it } from 'vitest';
import { freshGame } from './helpers';
import { gameState } from '../../src/systems/gameState';
import { countPillars, describeStoryObjective, hasMilestone, isWorldAtPeace, reachMilestone, sanitizeStoryState } from '../../src/systems/story';
import { markMailRead } from '../../src/systems/mail';
import { PROPHECY_MAIL_ID } from '../../src/data/story';

describe('história dos Três Pilares', () => {
  beforeEach(freshGame);

  it('começa sem marcos e sem objetivo no HUD', () => {
    expect(gameState.story.reached).toEqual({});
    expect(describeStoryObjective()).toBeNull();
  });

  it('a carta da profecia inicia a história e mostra o próximo passo', () => {
    markMailRead(PROPHECY_MAIL_ID);
    expect(hasMilestone('prophecy')).toBe(true);
    expect(describeStoryObjective()).toContain('Os Três Pilares (0/3)');
    expect(describeStoryObjective()).toContain('andar 45');
  });

  it('registrar um marco é idempotente', () => {
    expect(reachMilestone('map')).toBe(true);
    expect(reachMilestone('map')).toBe(false);
  });

  it('conta os pilares pelos marcos de cada um', () => {
    reachMilestone('goldenFish');
    reachMilestone('goldenCarrot');
    expect(countPillars()).toBe(2);
    reachMilestone('goldenFriendship');
    expect(countPillars()).toBe(3);
  });

  it('o mundo só fica em paz depois do despertar', () => {
    expect(isWorldAtPeace()).toBe(false);
    reachMilestone('awakening');
    expect(isWorldAtPeace()).toBe(true);
  });

  it('descarta marcos desconhecidos vindos do save', () => {
    const state = sanitizeStoryState({ reached: { map: 5, inventado: 3 } as never });
    expect(state.reached).toEqual({ map: 5 });
  });
});
