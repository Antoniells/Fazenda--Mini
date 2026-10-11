import { gameState } from './gameState';
import { rollDailyWeather } from './weather';
import { waterFromSprinklers } from './sprinklers';
import { save as saveGame } from './saveManager';
import { advanceForestDay } from '../scenes/ForestScene';
import { advanceQuarryDay } from '../scenes/QuarryScene';
import { advanceFarmResourcesDay } from './farmResources';
import { layEggs } from './animals';
import { advanceBerryBushes } from './berryBushState';
import { deliverSeedOrders } from './seedOrders';
import type { FarmDayReport, Plot } from './farmland';
import { turnSeasonOnFarm } from './cropSeasons';

/** Avança só o estado do mundo (registros de árvores/pedras da Floresta, Pedreira e da Fazenda — na Fazenda, brotos novos nascem e as árvores crescem de estágio) — não depende de nenhuma cena estar aberta. */
export function advanceWorldResourcesState(): void {
  advanceForestDay();
  advanceQuarryDay();
  advanceFarmResourcesDay();
  layEggs(); // Cada galinha põe o ovo do dia no galinheiro dela.
  gameState.forageCut.clear(); // As plantinhas, flores e cogumelos cortados com a Foice renascem (`systems/forage.ts`).
  advanceBerryBushes(); // Os arbustos frutíferos andam um passo no ciclo (liso → flor → frutas).
}

/** Plantações regadas pela chuva / pelos aspersores na virada do dia — a cena aberta anima os respingos. */
export interface DayTurn {
  rained: Plot[];
  sprayed: Plot[];
  /** O que aconteceu na lavoura (o "Bom dia" da Fazenda, `describeFarmReport`). */
  farm: FarmDayReport;
}

/**
 * Virada de dia do MUNDO (não do relógio): a lavoura cresce, sorteia-se o clima (chuva rega tudo), os aspersores regam o resto e
 * árvores/pedras renascem. Só estado (`gameState`), sem game object — roda igual de qualquer cena (`systems/worldTime.ts` na
 * meia-noite, `startNextDay` ao dormir). Devolve o que foi regado pra a cena, se for a Fazenda, mostrar os respingos.
 */
export function runDayTurn(): DayTurn {
  const farm = gameState.farmland.onNewDay();
  // A estação virou: o que ficou fora de época morre (`systems/cropSeasons.ts`) — e não conta mais como pronta.
  const seasonTurned = turnSeasonOnFarm(gameState.farmland, gameState.gameClock.getDay());
  if (seasonTurned) {
    farm.seasonTurned = seasonTurned;
    farm.ready = gameState.farmland.getAllPlots().filter((plot) => gameState.farmland.isReady(plot)).length;
  }
  const rained = rollDailyWeather(gameState.farmland);
  const sprayed = waterFromSprinklers(gameState.farmland);
  // As murchas que a chuva ou um aspersor já regou não correm mais perigo hoje: o aviso só conta as que ainda precisam de água.
  farm.wilted = gameState.farmland.getAllPlots().filter((plot) => gameState.farmland.isWilted(plot)).length;
  gameState.morningReport = { day: gameState.gameClock.getDay(), report: farm };
  advanceWorldResourcesState();
  deliverSeedOrders(); // A encomenda de sementes de ontem chega na carta da Lia.
  return { rained, sprayed, farm };
}

/**
 * "Dormir": acorda no dia seguinte, às 06:00. Tudo é estado (`gameState`),
 * nada de game object — por isso roda igual de qualquer cena (hoje: a cama
 * da `HouseScene`) e a Fazenda simplesmente nasce já refletindo o novo dia
 * quando o jogador sair de casa. Ordem (pedido explícito): relógio →
 * vida cheia → lavoura cresce → clima do dia (chuva/aspersores regam) →
 * árvores/pedras renascem → SALVA (por último, pra o save já ter o dia novo).
 * Dormir DEPOIS da meia-noite não repete a virada (ela já rodou na Fazenda):
 * só o relógio vai pras 06:00 e a vida enche — ver `GameClock.advanceToNextMorning`.
 * O `save()` sem slot ativo (jogo aberto sem passar pelo menu) é ignorado.
 */
export function startNextDay(): void {
  const dayTurned = gameState.gameClock.advanceToNextMorning();
  gameState.playerHealth.restoreFull();
  if (dayTurned) runDayTurn();
  saveGame();
}
