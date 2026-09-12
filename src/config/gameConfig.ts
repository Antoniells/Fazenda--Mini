import Phaser from 'phaser';
import { MainScene } from '../scenes/MainScene';
import { farmMap } from '../data/maps/farmMap';
import { DISPLAY_SCALE } from '../systems/mapBuilder';

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',

  width: farmMap.cols * farmMap.tileSize * DISPLAY_SCALE,
  height: farmMap.rows * farmMap.tileSize * DISPLAY_SCALE,

  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: farmMap.cols * farmMap.tileSize * DISPLAY_SCALE,
    height: farmMap.rows * farmMap.tileSize * DISPLAY_SCALE,
  },

  backgroundColor: '#1e1e1e',
  pixelArt: true,
  scene: [MainScene],
};

