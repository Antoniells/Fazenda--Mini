import Phaser from 'phaser';

/**
 * Tela cheia (Configurações). Dois ambientes, mesma interface:
 *
 * - Electron (executável): pede à JANELA NATIVA pela ponte do preload
 *   (`window.electronAPI.display`) — a mesma que o F11 controla, então botão e
 *   tecla nunca discordam. O processo principal guarda a escolha e a janela
 *   já abre assim da próxima vez (ver `electron/main.cts`).
 * - Navegador (`npm run dev`): a API de tela cheia do próprio Phaser
 *   (`scene.scale`). O navegador exige um gesto do usuário (o clique no botão
 *   já é um) e não dá pra lembrar a escolha entre sessões.
 */

export function isFullscreen(scene: Phaser.Scene): boolean {
  const display = window.electronAPI?.display;
  return display ? display.isFullscreen() : scene.scale.isFullscreen;
}

/** Liga/desliga. Devolve o estado depois do pedido — no navegador isso só muda de fato depois (ver `Phaser.Scale.Events.ENTER_FULLSCREEN`), então lá devolve o estado PEDIDO. */
export function setFullscreen(scene: Phaser.Scene, fullscreen: boolean): boolean {
  const display = window.electronAPI?.display;
  if (display) return display.setFullscreen(fullscreen);

  if (fullscreen && !scene.scale.isFullscreen) scene.scale.startFullscreen();
  else if (!fullscreen && scene.scale.isFullscreen) scene.scale.stopFullscreen();
  return fullscreen;
}

export function toggleFullscreen(scene: Phaser.Scene): boolean {
  return setFullscreen(scene, !isFullscreen(scene));
}
