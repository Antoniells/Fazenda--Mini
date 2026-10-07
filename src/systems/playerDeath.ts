import Phaser from 'phaser';
import { gameState } from './gameState';
import { save as saveGame } from './saveManager';
import { finishHordeDefeat } from './horde';
import { slowMotion } from './impact';

const MAIN_SCENE_KEY = 'MainScene';

/** Moedas perdidas ao desmaiar (pedido explícito) — nunca deixa o saldo negativo (perde no máximo o que tem). */
const DEATH_COIN_PENALTY = 50;
/** ...ou esta fração do saldo, se for mais: com o bolso cheio, 50 moedas não pesavam nada (o playtest morreu sem sentir). */
const DEATH_COIN_FRACTION = 0.1;

/** Quanto se perde ao desmaiar com `coins` no bolso: 50 ou 10%, o que for maior, nunca mais que o saldo. */
export function deathCoinPenalty(coins: number): number {
  return Math.min(coins, Math.max(DEATH_COIN_PENALTY, Math.floor(coins * DEATH_COIN_FRACTION)));
}
const FADE_OUT_MS = 700;
/** Câmera lenta do desmaio: quanto tempo (relógio real) e a que velocidade. */
const DEATH_SLOWMO_MS = 900;
const DEATH_SLOWMO_SCALE = 0.35;

/** Dados que a `MainScene` recebe ao acordar depois de desmaiar (ver `MainScene.init`). */
export interface WakeUpAfterDeath {
  coinsLost: number;
  /** Só quando o jogador desmaiou NA HORDA: o evento acabou sem bônus, o que os inimigos derrubaram se perdeu e o dia deve avançar (`MainScene.init` chama `startNextDay`); `drops` = o que se perdeu. */
  hordeDefeat?: { drops: string[]; cropsLost?: number };
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
  // O desmaio em câmera lenta (0,35x por 0,9 s — `systems/impact.ts`): o momento pesa antes de a tela escurecer (o escurecer também anda devagar).
  slowMotion(scene, DEATH_SLOWMO_MS, DEATH_SLOWMO_SCALE);
  camera.fadeOut(FADE_OUT_MS, 0, 0, 0);
  camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
    const coinsLost = deathCoinPenalty(gameState.inventory.getCoins());
    gameState.inventory.spendCoins(coinsLost);
    gameState.playerHealth.restoreFull();

    // Morreu durante a horda: o evento termina SEM o bônus — o jogador leva apenas os drops dos inimigos que já tinha abatido — e
    // o dia avança (quem acorda, `MainScene.init`, roda a virada de dia).
    // Morrer não pode ser o jeito barato de pular a horda: o que os inimigos já tinham derrubado fica com eles.
    const defeat = gameState.horde.active ? finishHordeDefeat({ keepDrops: false }) : null;
    const hordeDefeat = defeat ? { drops: defeat.lines, cropsLost: defeat.cropsLost } : undefined;
    saveGame();

    isHandlingDeath = false;
    const data: { wokeUpAfterDeath: WakeUpAfterDeath } = { wokeUpAfterDeath: { coinsLost, hordeDefeat } };
    scene.scene.start(MAIN_SCENE_KEY, data);
  });
}
