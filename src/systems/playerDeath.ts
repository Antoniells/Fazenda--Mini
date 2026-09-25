import Phaser from 'phaser';
import { gameState } from './gameState';
import { save as saveGame } from './saveManager';
import { finishHordeDefeat } from './horde';

const MAIN_SCENE_KEY = 'MainScene';

/** Moedas perdidas ao desmaiar (pedido explícito) — nunca deixa o saldo negativo (perde no máximo o que tem). */
const DEATH_COIN_PENALTY = 50;
const FADE_OUT_MS = 700;

/** Dados que a `MainScene` recebe ao acordar depois de desmaiar (ver `MainScene.init`). */
export interface WakeUpAfterDeath {
  coinsLost: number;
  /** Só quando o jogador desmaiou NA HORDA: o evento acabou sem bônus e o dia deve avançar (`MainScene.init` chama `startNextDay`); `drops` = só o que os inimigos já abatidos deram. */
  hordeDefeat?: { drops: string[] };
}

/** Trava contra reentrância: enquanto a tela escurece, a vida já está em 0 e nada deve disparar a morte de novo. */
let isHandlingDeath = false;

/**
 * Morte do jogador (pedido explícito): com 0 HP perde `DEATH_COIN_PENALTY`
 * moedas e acorda em casa — escurece a tela, aplica a penalidade, restaura a
 * vida (acordar é como dormir, senão o jogador nasceria com 0 HP e morreria
 * de novo), salva (igual dormir — evita "desfazer" a penalidade recarregando)
 * e reinicia a `MainScene` SEM ponto de spawn, que já nasce em frente à porta
 * da casa (`PLAYER_START`). Não avança o dia: desmaiar não é dormir de
 * verdade, só leva pra casa.
 *
 * Genérico de propósito (recebe a cena de onde o jogador morreu): hoje só a
 * Floresta tem inimigos, mas qualquer cena futura pode chamar isto.
 */
export function handlePlayerDeath(scene: Phaser.Scene): void {
  if (isHandlingDeath) return;
  isHandlingDeath = true;

  const camera = scene.cameras.main;
  camera.fadeOut(FADE_OUT_MS, 0, 0, 0);
  camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
    const coinsLost = Math.min(DEATH_COIN_PENALTY, gameState.inventory.getCoins());
    gameState.inventory.spendCoins(coinsLost);
    gameState.playerHealth.restoreFull();

    // Morreu durante a horda: o evento termina SEM o bônus — o jogador leva apenas os drops dos inimigos que já tinha abatido — e
    // o dia avança (quem acorda, `MainScene.init`, roda a virada de dia).
    const hordeDefeat = gameState.horde.active ? { drops: finishHordeDefeat().lines } : undefined;
    saveGame();

    isHandlingDeath = false;
    const data: { wokeUpAfterDeath: WakeUpAfterDeath } = { wokeUpAfterDeath: { coinsLost, hordeDefeat } };
    scene.scene.start(MAIN_SCENE_KEY, data);
  });
}
