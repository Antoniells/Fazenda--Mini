import { gameState } from './gameState';
import { Farmland, Plot } from './farmland';

/** Chance de chover em cada dia novo (pedido explícito: 15%). */
export const RAIN_CHANCE = 0.15;

/**
 * Sorteio do clima do dia — chamado UMA vez por virada de dia (dormir, meia-noite),
 * logo depois de `Farmland.onNewDay`. Chovendo, a lavoura inteira é regada
 * automaticamente (as plantações voltam a precisar de rega só no dia seguinte).
 * O estado fica em `gameState.weather` (vai pro save); o visual da chuva é
 * `ui/weatherOverlay.ts`. Devolve as plantações que a chuva regou, pra a cena
 * animar o "varrer" de respingos.
 */
export function rollDailyWeather(farmland: Farmland): Plot[] {
  gameState.weather.raining = Math.random() < RAIN_CHANCE;
  return gameState.weather.raining ? farmland.waterAll() : [];
}
