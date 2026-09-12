import Phaser from 'phaser';
import { MainScene } from '../scenes/MainScene';
import { farmMap } from '../data/maps/farmMap';
import { DISPLAY_SCALE } from '../systems/mapBuilder';

// Tamanho da JANELA (viewport) = o núcleo da propriedade (`farmMap.cols/rows`).
// Desde a Fase 6 (Expansão), o mundo é maior que isso — os trechos ao redor
// (`farmMap.expansions`) ficam fora da janela inicial, e a câmera rola até
// eles conforme o jogador se aproxima/expande (ver `MainScene.create`).
const viewportWidth = farmMap.cols * farmMap.tileSize * DISPLAY_SCALE;
const viewportHeight = farmMap.rows * farmMap.tileSize * DISPLAY_SCALE;

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',

  width: viewportWidth,
  height: viewportHeight,

  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: viewportWidth,
    height: viewportHeight,
  },

  backgroundColor: '#1e1e1e',
  pixelArt: true,
  scene: [MainScene],
};
