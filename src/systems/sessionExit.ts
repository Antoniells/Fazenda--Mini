import Phaser from 'phaser';
import { save as saveGame } from './saveManager';
import { dayMusic } from './dayMusic';
import { UI_SCENE_KEY } from '../scenes/UIScene';
import { MAIN_MENU_SCENE_KEY } from '../scenes/MainMenuScene';

const EXIT_MUSIC_FADE_MS = 1000;

/**
 * "Sair para o Menu Principal" (Fase 10, pedido explícito) — usado pelo Menu
 * de Pausa de qualquer mapa jogável (Fazenda, Casa): salva o progresso atual
 * antes de qualquer coisa, para a `UIScene` (HUD não faz sentido sobre a tela
 * de título — `ensureUIScene` já sabe relançá-la do zero quando uma partida
 * for aberta de novo) e troca de cena. `scene.start` (não pausa): o mapa deve
 * nascer limpo da próxima vez, igual a qualquer troca de mapa já existente.
 */
export function exitToMainMenu(scene: Phaser.Scene): void {
  saveGame();
  dayMusic.disable(EXIT_MUSIC_FADE_MS);
  if (scene.scene.manager.isActive(UI_SCENE_KEY)) scene.scene.stop(UI_SCENE_KEY);
  scene.scene.start(MAIN_MENU_SCENE_KEY);
}
