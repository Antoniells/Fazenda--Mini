import Phaser from 'phaser';

/** Mesmo suavizado de seguimento (lerp) usado pela câmera da Fazenda — ver `MainScene.create`. */
const FOLLOW_LERP_X = 0.15;
const FOLLOW_LERP_Y = 0.15;

/**
 * Configura a câmera principal de uma cena de mapa (limites do mundo +
 * seguir o jogador) com exatamente o mesmo comportamento da câmera da
 * Fazenda — pedido explícito do usuário ("mesmo tamanho e comportamento em
 * todos os cenários"). O TAMANHO em si (resolução da janela) já é sempre o
 * mesmo em qualquer cena sem precisar de nada aqui — vem de
 * `config/gameConfig.ts` (`SCREEN_WIDTH`/`SCREEN_HEIGHT`), que é global ao
 * jogo, não por cena. Isso só padroniza a parte que cada cena configura
 * por conta própria: os limites de rolagem e o suavizado do seguimento.
 */
export function setupWorldCamera(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Sprite,
  worldWidthPx: number,
  worldHeightPx: number,
  worldX = 0,
  worldY = 0,
): void {
  scene.cameras.main.setBounds(worldX, worldY, worldWidthPx, worldHeightPx);
  scene.cameras.main.startFollow(target, true, FOLLOW_LERP_X, FOLLOW_LERP_Y);
}
