import { FARM_BERRY_BUSHES, BERRY_DAYS_TO_FRUIT, berryBushKey } from '../data/berryBushes';
import { gameState } from './gameState';

/** O ESTADO dos arbustos frutíferos (sem Phaser — o save e a virada do dia usam): dias desde a última colheita de cada arbusto. */

/** Dias desde a colheita do arbusto (o que o save não conhece já tem frutas). */
export function berryBushDays(col: number, row: number): number {
  return gameState.berryBushes[berryBushKey(col, row)] ?? BERRY_DAYS_TO_FRUIT;
}

/** Colhido agora: volta a liso. */
export function markBerryBushHarvested(col: number, row: number): void {
  gameState.berryBushes[berryBushKey(col, row)] = 0;
}

/** Virada do dia: cada arbusto anda um dia no ciclo (parando quando já tem frutas — elas esperam a colheita). */
export function advanceBerryBushes(): void {
  for (const [col, row] of FARM_BERRY_BUSHES) {
    gameState.berryBushes[berryBushKey(col, row)] = Math.min(BERRY_DAYS_TO_FRUIT, berryBushDays(col, row) + 1);
  }
}
