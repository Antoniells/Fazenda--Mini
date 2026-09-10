import Phaser from 'phaser';
import { MainScene } from '../scenes/MainScene';
import { farmMap } from '../data/maps/farmMap';
import { DISPLAY_SCALE } from '../systems/mapBuilder';

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  width: farmMap.cols * farmMap.tileSize * DISPLAY_SCALE,
  height: farmMap.rows * farmMap.tileSize * DISPLAY_SCALE,
  backgroundColor: '#1e1e1e',
  // Evita texture bleeding ao ampliar os tiles/spritesheets 16px (filtro
  // nearest-neighbor em vez de bilinear); necessário para pixel art nítida.
  pixelArt: true,
  scene: [MainScene],
};
