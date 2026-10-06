import { beforeEach, describe, expect, it } from 'vitest';
import { freshGame } from './helpers';
import { gameState } from '../../src/systems/gameState';
import { isFloorExploredToday, markFloorExplored } from '../../src/systems/caveVisits';
import { DAY_LENGTH_MS, GameClock } from '../../src/systems/gameClock';
import { FINAL_FLOOR } from '../../src/data/caveLandmarks';

function setDay(day: number): void {
  gameState.gameClock = GameClock.deserialize({ day, dayProgressMs: (10 / 24) * DAY_LENGTH_MS });
}

describe('andares das Cavernas: uma vez por dia', () => {
  beforeEach(freshGame);

  it('a 1ª visita do dia rende; voltar no mesmo dia encontra o andar explorado; no dia seguinte, renova', () => {
    setDay(3);
    expect(isFloorExploredToday(7)).toBe(false);
    markFloorExplored(7);
    expect(isFloorExploredToday(7)).toBe(true);
    expect(isFloorExploredToday(8)).toBe(false);
    setDay(4);
    expect(isFloorExploredToday(7)).toBe(false);
    markFloorExplored(8);
    expect(gameState.caveExplored).toEqual({ day: 4, floors: [8] });
  });

  it('o andar 100 (Horda Final e santuário) fica fora da regra', () => {
    markFloorExplored(FINAL_FLOOR);
    expect(isFloorExploredToday(FINAL_FLOOR)).toBe(false);
  });
});
