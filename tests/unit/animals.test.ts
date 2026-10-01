import { beforeEach, describe, expect, it } from 'vitest';
import { freshGame } from './helpers';
import { gameState } from '../../src/systems/gameState';
import { coopKey, fillFeeder, getCoopState, layEggs, petChicken } from '../../src/systems/animals';
import { CHICKEN_COOP_ID, CHICKEN_FEED_ID, FEEDER_CAPACITY, MAX_AFFECTION, eggTierForCare } from '../../src/data/animals';

const COL = 10;
const ROW = 10;
const KEY = coopKey(COL, ROW);

/** Um galinheiro na Fazenda com uma galinha de carinho `affection`. */
function coopWithChicken(affection: number): void {
  gameState.placedDecorations.set(KEY, { decorationId: CHICKEN_COOP_ID, col: COL, row: ROW });
  getCoopState(KEY).chickens = 1;
  getCoopState(KEY).birds![0].affection = affection;
}

/** Vira o dia como o jogo faz: o relógio avança e só depois a virada roda. */
function nextDay(): void {
  gameState.gameClock.advanceToNextMorning();
  layEggs();
}

/** O degrau de qualidade do ovo guardado (espera um só). */
function eggTier(): number {
  return getCoopState(KEY).eggTiers!.findIndex((count) => count > 0);
}

describe('felicidade das galinhas (carinho e comida do dia)', () => {
  beforeEach(freshGame);

  it('cada descuido derruba um degrau, nunca abaixo do comum', () => {
    expect(eggTierForCare(MAX_AFFECTION, true, true)).toBe(3);
    expect(eggTierForCare(MAX_AFFECTION, false, true)).toBe(2);
    expect(eggTierForCare(MAX_AFFECTION, false, false)).toBe(1);
    expect(eggTierForCare(0, false, false)).toBe(0);
  });

  it('com carinho e Capim, a galinha no máximo põe ovo de Irídio e come do comedouro', () => {
    coopWithChicken(MAX_AFFECTION);
    gameState.inventory.addResources(CHICKEN_FEED_ID, 5);
    expect(fillFeeder(KEY)).toEqual({ added: 5, feed: 5 });
    expect(petChicken(KEY, 0).result).toBe('max'); // No máximo, o carinho do dia ainda conta.
    nextDay();
    expect(eggTier()).toBe(3);
    expect(getCoopState(KEY).feed).toBe(4);
  });

  it('esquecida (sem carinho e sem comida), põe mesmo assim, mas um ovo pior', () => {
    coopWithChicken(MAX_AFFECTION);
    nextDay();
    expect(getCoopState(KEY).eggs).toBe(1);
    expect(eggTier()).toBe(1);
  });

  it('o carinho é um por dia e o comedouro tem limite', () => {
    coopWithChicken(0);
    expect(petChicken(KEY, 0)).toEqual({ result: 'petted', affection: 1 });
    expect(petChicken(KEY, 0).result).toBe('already');
    gameState.inventory.addResources(CHICKEN_FEED_ID, FEEDER_CAPACITY + 10);
    expect(fillFeeder(KEY)).toEqual({ added: FEEDER_CAPACITY, feed: FEEDER_CAPACITY });
    expect(gameState.inventory.getResourceCount(CHICKEN_FEED_ID)).toBe(10);
    expect(fillFeeder(KEY).added).toBe(0);
  });
});
