import { beforeEach, describe, expect, it } from 'vitest';
import { freshGame } from './helpers';
import { gameState } from '../../src/systems/gameState';
import { getSleepBlockReason, isHordeToday } from '../../src/systems/horde';
import { reachMilestone } from '../../src/systems/story';
import { getCurrentQuest, getQuestStatus, turnInCurrentQuest } from '../../src/systems/campaign';
import { QUESTS } from '../../src/data/campaign';

describe('hordas', () => {
  beforeEach(freshGame);

  it('acontecem de 10 em 10 dias e na Noite Final marcada', () => {
    expect(isHordeToday(10)).toBe(true);
    expect(isHordeToday(11)).toBe(false);
    gameState.campaign.finalNightDay = 13;
    expect(isHordeToday(13)).toBe(true);
  });

  it('acabam depois do fim da história', () => {
    reachMilestone('awakening');
    expect(isHordeToday(10)).toBe(false);
    expect(isHordeToday(20)).toBe(false);
    expect(getSleepBlockReason()).toBeNull();
  });
});

describe('campanha depois do fim', () => {
  beforeEach(freshGame);

  it('a missão de vencer hordas conta como cumprida em paz', () => {
    gameState.campaign.questIndex = QUESTS.findIndex((quest) => quest.requirements.some((requirement) => requirement.kind === 'hordesWon'));
    expect(getQuestStatus(getCurrentQuest()!).ready).toBe(false);
    reachMilestone('awakening');
    expect(getQuestStatus(getCurrentQuest()!).ready).toBe(true);
  });

  it('a Noite Final pode ser entregue em paz e completa a campanha', () => {
    gameState.campaign.questIndex = QUESTS.length - 1;
    expect(getQuestStatus(getCurrentQuest()!).ready).toBe(false);
    reachMilestone('awakening');
    const coins = gameState.inventory.getCoins();
    expect(turnInCurrentQuest()).not.toBeNull();
    expect(gameState.campaign.completed).toBe(true);
    expect(gameState.inventory.getCoins()).toBeGreaterThan(coins);
    expect(getCurrentQuest()).toBeNull();
  });
});
