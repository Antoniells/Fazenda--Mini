import Phaser from 'phaser';
import { gameState } from './gameState';
import { shouldStartHorde } from './horde';
import { closeChestMenu, closeDialogue, closeFurnaceMenu, closeInventoryScreen } from '../scenes/UIScene';

const MAIN_SCENE_KEY = 'MainScene';
const RECALL_FADE_MS = 400;

/**
 * CHAMADO DA HORDA: quando chega a hora da horda (ou ela já está em andamento), o jogador é TELETRANSPORTADO pra Fazenda de onde
 * estiver — Vilarejo, lojas, Floresta, Praia, Pedreira, Cavernas — pra lutar ou cair. Toda cena fora da Fazenda chama `recallToFarm`
 * no `update` quando `shouldRecallToFarm()`; a Fazenda (`MainScene`) nasce em frente à porta de casa e o `HordeDirector` começa a
 * noite. Na Fazenda, as pontes ficam fechadas durante a horda (`systems/bridgeSystem.ts`).
 */
export function shouldRecallToFarm(): boolean {
  return gameState.horde.active || shouldStartHorde();
}

/** Cenas já sendo levadas (o fade leva alguns quadros): não dispara duas vezes. Limpa quando a cena desliga. */
const recalling = new Set<Phaser.Scene>();
/** O jogador acabou de ser trazido pela horda: a Fazenda mostra o aviso uma vez (`consumeRecallNotice`). */
let pendingNotice = false;

export function recallToFarm(scene: Phaser.Scene): void {
  if (recalling.has(scene)) return;
  recalling.add(scene);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => recalling.delete(scene));

  closeInventoryScreen();
  closeFurnaceMenu();
  closeDialogue();
  closeChestMenu();

  pendingNotice = true;
  const camera = scene.cameras.main;
  camera.fadeOut(RECALL_FADE_MS, 0, 0, 0);
  // Sem ponto de chegada: a Fazenda nasce em frente à porta de casa (`PLAYER_START`).
  camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => scene.scene.start(MAIN_SCENE_KEY));
}

/** `true` uma única vez depois de um chamado da horda (pra a Fazenda explicar por que o jogador apareceu ali). */
export function consumeRecallNotice(): boolean {
  const had = pendingNotice;
  pendingNotice = false;
  return had;
}
