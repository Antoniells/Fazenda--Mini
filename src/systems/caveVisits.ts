import { gameState } from './gameState';
import { FINAL_FLOOR } from '../data/caveLandmarks';

/**
 * Cada andar das Cavernas rende UMA vez por dia: na primeira visita do dia ele vem com inimigos, veios e pedras sorteados; voltar a ele
 * no mesmo dia (subir e descer a escada) encontra o andar já explorado — vazio, com a escada à vista —, e tudo volta no dia seguinte.
 * Antes cada visita sorteava tudo de novo, e subir/descer rendia pedra e gosma sem fim (o playtest fez isso no dia 2). O andar 100 fica
 * de fora (a Horda Final e o santuário têm regras próprias). Vai pro save (`SaveData.caveExplored`), senão recarregar renovaria tudo.
 */

export interface CaveExploredState {
  /** Dia do jogo a que `floors` se refere (outro dia = lista vazia). */
  day: number;
  floors: number[];
}

/** Este andar renova uma vez por dia? (O 100 não entra na regra.) */
export function floorRenewsDaily(floor: number): boolean {
  return floor !== FINAL_FLOOR;
}

/** O jogador já explorou este andar hoje (então ele está vazio até amanhã)? */
export function isFloorExploredToday(floor: number): boolean {
  const explored = gameState.caveExplored;
  return floorRenewsDaily(floor) && explored.day === gameState.gameClock.getDay() && explored.floors.includes(floor);
}

/** Marca o andar como explorado hoje (chamado ao entrar nele). */
export function markFloorExplored(floor: number): void {
  if (!floorRenewsDaily(floor)) return;
  const today = gameState.gameClock.getDay();
  if (gameState.caveExplored.day !== today) gameState.caveExplored = { day: today, floors: [] };
  if (!gameState.caveExplored.floors.includes(floor)) gameState.caveExplored.floors.push(floor);
}
