import { beforeEach, describe, expect, it } from 'vitest';
import { freshGame } from './helpers';
import { gameState } from '../../src/systems/gameState';
import { describeCropsLost, describeHordeObjective, finishHordeDefeat, finishHordeVictory, getSleepBlockReason, isHordeToday, registerHordeCropLost, startHorde } from '../../src/systems/horde';
import { getUnreadMail, markMailRead } from '../../src/systems/mail';
import { DAY_LENGTH_MS, GameClock } from '../../src/systems/gameClock';
import { nextHordeDayFrom } from '../../src/data/horde';
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

/** Põe o relógio no dia `day`, às `hours` horas. */
function setClock(day: number, hours: number): void {
  gameState.gameClock = GameClock.deserialize({ day, dayProgressMs: (hours / 24) * DAY_LENGTH_MS });
}

describe('aviso de horda', () => {
  beforeEach(freshGame);

  it('o próximo dia de horda conta o próprio dia', () => {
    expect(nextHordeDayFrom(1)).toBe(10);
    expect(nextHordeDayFrom(9)).toBe(10);
    expect(nextHordeDayFrom(10)).toBe(10);
    expect(nextHordeDayFrom(11)).toBe(20);
  });

  it('a carta chega na véspera, fica até o dia da horda e some depois dele', () => {
    const warnings = (): string[] => getUnreadMail().map((mail) => mail.id).filter((id) => id.startsWith('horde-warning'));
    setClock(8, 10);
    expect(warnings()).toEqual([]);
    setClock(9, 6);
    expect(warnings()).toEqual(['horde-warning-10']);
    setClock(10, 12);
    expect(warnings()).toEqual(['horde-warning-10']);
    setClock(11, 6);
    expect(warnings()).toEqual([]);
    setClock(19, 6);
    expect(warnings()).toEqual(['horde-warning-20']);
    markMailRead('horde-warning-20');
    expect(warnings()).toEqual([]);
  });

  it('em paz não há carta de horda', () => {
    reachMilestone('awakening');
    setClock(9, 6);
    expect(getUnreadMail().some((mail) => mail.id.startsWith('horde-warning'))).toBe(false);
  });

  it('o marcador mostra a véspera, a contagem do dia e some durante e depois da horda', () => {
    setClock(8, 12);
    expect(describeHordeObjective()).toBeNull();
    setClock(9, 12);
    expect(describeHordeObjective()).toContain('amanhã às 19:00');
    setClock(10, 15.5);
    expect(describeHordeObjective()).toContain('faltam 3h');
    setClock(10, 18.5);
    expect(describeHordeObjective()).toContain('menos de 1h');
    setClock(10, 19.2);
    startHorde();
    expect(describeHordeObjective()).toBeNull();
    finishHordeVictory();
    expect(describeHordeObjective()).toBeNull();
    reachMilestone('awakening');
    setClock(19, 12);
    expect(describeHordeObjective()).toBeNull();
  });
});

describe('plantações perdidas na horda', () => {
  beforeEach(freshGame);

  it('entram no resumo da vitória e da derrota, e zeram a cada horda', () => {
    setClock(10, 19.5);
    startHorde();
    registerHordeCropLost();
    registerHordeCropLost();
    expect(finishHordeVictory().cropsLost).toBe(2);
    setClock(20, 19.5);
    startHorde();
    expect(finishHordeDefeat().cropsLost).toBe(0);
  });

  it('a frase do resumo', () => {
    expect(describeCropsLost(0)).toBeNull();
    expect(describeCropsLost(1)).toBe('1 plantação destruída.');
    expect(describeCropsLost(4)).toBe('4 plantações destruídas.');
  });
});

describe('desmaiar', () => {
  beforeEach(freshGame);

  it('custa 50 moedas ou 10% do saldo, o que for maior, nunca mais que o saldo', async () => {
    const { deathCoinPenalty } = await import('../../src/systems/playerDeath');
    expect(deathCoinPenalty(0)).toBe(0);
    expect(deathCoinPenalty(30)).toBe(30);
    expect(deathCoinPenalty(200)).toBe(50);
    expect(deathCoinPenalty(3000)).toBe(300);
  });

  it('na horda, o que os inimigos derrubaram se perde (amanhecer longe da Fazenda continua entregando)', () => {
    setClock(10, 19.5);
    startHorde();
    gameState.horde.drops = { 'slime-goo': 4 };
    const goo = gameState.inventory.getResourceCount('slime-goo');
    const lost = finishHordeDefeat({ keepDrops: false });
    expect(lost.lines.join()).toContain('4');
    expect(gameState.inventory.getResourceCount('slime-goo')).toBe(goo);

    setClock(20, 19.5);
    startHorde();
    gameState.horde.drops = { 'slime-goo': 3 };
    finishHordeDefeat();
    expect(gameState.inventory.getResourceCount('slime-goo')).toBe(goo + 3);
  });
});
