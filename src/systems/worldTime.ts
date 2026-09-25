import { gameState } from './gameState';
import { runDayTurn, DayTurn } from './dayCycle';
import { isDawn, finishHordeDefeat } from './horde';
import { expireMissedFinalNight } from './campaign';

/** O que aconteceu neste avanço do relógio — a cena que o chamou decide como mostrar (faixa "DIA n", respingos da chuva…). */
export interface WorldTimeResult {
  /** Um dia novo começou (meia-noite): a virada do mundo JÁ rodou (`runDayTurn`). `null` = o dia continua o mesmo. */
  dayTurn: DayTurn | null;
  /** A noite de horda amanheceu com o jogador FORA da Fazenda: o evento foi encerrado sem bônus (ver `advanceWorldTime`). */
  hordeMissed: boolean;
}

/**
 * ÚNICO ponto que faz o relógio do jogo andar (todas as cenas chamam daqui, a cada `update`): antes só a Fazenda avançava o
 * tempo — sair pra Floresta/Pedreira/Casa congelava o dia, a noite e a chuva. Agora o dia corre em qualquer lugar e, quando vira
 * (meia-noite), a virada do mundo (lavoura, clima, aspersores, árvores/pedras) roda igual, sem depender de qual cena está aberta.
 *
 * `onFarm`: a Fazenda é quem conduz a horda (`HordeDirector`). Se a noite da horda AMANHECE com o jogador em outro lugar (mapa
 * externo ou dentro de casa), ninguém a venceu: ela termina sem bônus — senão bastava ficar longe até o sol nascer pra ganhar a
 * recompensa sem lutar.
 */
export function advanceWorldTime(deltaMs: number, onFarm: boolean): WorldTimeResult {
  const newDay = gameState.gameClock.update(deltaMs);
  const dayTurn = newDay ? runDayTurn() : null;
  if (newDay) expireMissedFinalNight();

  let hordeMissed = false;
  if (!onFarm && gameState.horde.active && isDawn()) {
    finishHordeDefeat();
    hordeMissed = true;
  }
  return { dayTurn, hordeMissed };
}

/** Faixa de novo dia (título + subtítulo), igual em todas as cenas. */
export function describeNewDay(): { title: string; subtitle: string } {
  return { title: `DIA ${gameState.gameClock.getDay()}`, subtitle: gameState.weather.raining ? 'Está chovendo hoje.' : 'Um novo dia começa.' };
}
