import Phaser from 'phaser';
import { installUiCamera } from './uiCamera';

/**
 * Zoom da câmera que segue o jogador (Fazenda e áreas): 1 = a janela inteira de 1280x720 mostra 40x22,5 tiles; 1,25 aproxima o
 * enquadramento (32x18 tiles) — o personagem e a lavoura ficam maiores sem o campo de visão apertar. Ajuste aqui, num lugar só.
 */
export const WORLD_CAMERA_ZOOM = 1.25;

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
  const camera = scene.cameras.main;
  // O zoom vem ANTES dos limites: o tamanho visível do mundo (e portanto o quanto o mapa "cabe" na janela) depende dele.
  camera.setZoom(WORLD_CAMERA_ZOOM);
  applyWorldCameraBounds(scene, worldWidthPx, worldHeightPx, worldX, worldY);
  camera.startFollow(target, true, FOLLOW_LERP_X, FOLLOW_LERP_Y);
  // O zoom é só do mundo: os menus/avisos da própria cena (scrollFactor 0) passam pra uma câmera de interface sem zoom.
  installUiCamera(scene);
}

/**
 * Limites de rolagem da câmera do mundo. Chamado na criação e de novo quando o mundo visível CRESCE (a Fazenda libera um trecho de
 * expansão): a câmera só mostra o que já está liberado — o resto, atrás da cerca, fica fora dela.
 */
export function applyWorldCameraBounds(scene: Phaser.Scene, worldWidthPx: number, worldHeightPx: number, worldX = 0, worldY = 0): void {
  const camera = scene.cameras.main;
  // Mapa MENOR que a janela (Floresta/Pedreira/Caverna/Praia, ~830x640 numa janela de 1280x720): os limites
  // crescem igualmente dos dois lados, o que deixa o mapa no CENTRO da tela em vez de colado no canto
  // superior esquerdo com uma faixa vazia do outro lado. Mapa maior que a janela: limites = o próprio mapa.
  const viewWidth = camera.width / camera.zoom;
  const viewHeight = camera.height / camera.zoom;
  const boundsWidth = Math.max(worldWidthPx, viewWidth);
  const boundsHeight = Math.max(worldHeightPx, viewHeight);
  camera.setBounds(worldX - (boundsWidth - worldWidthPx) / 2, worldY - (boundsHeight - worldHeightPx) / 2, boundsWidth, boundsHeight);
}
