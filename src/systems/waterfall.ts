import Phaser from 'phaser';
import { WATERFALL_FPS, WATERFALL_FRAMES, WATERFALL_FRAME_SIZE, WATERFALL_KEY, WATERFALL_PATH } from '../data/effects';
import { DISPLAY_SCALE } from './mapBuilder';

/**
 * A CACHOEIRA animada (`WATERFALL_*` em `data/effects.ts`): os 8 quadros da 1ª fileira da folha, em loop, ocupando 4 x 4 células a partir
 * do canto superior-esquerdo dado. Fica acima do chão e da água (-0.9) e abaixo de tudo que é ordenado pelo Y. Quem bloqueia as células
 * (ninguém anda por dentro do paredão) é a cena.
 */
const WATERFALL_DEPTH = -0.5;
const FLOW_ANIM_KEY = `${WATERFALL_KEY}-flow`;

export function preloadWaterfall(scene: Phaser.Scene): void {
  scene.load.spritesheet(WATERFALL_KEY, encodeURI(`/${WATERFALL_PATH}`), { frameWidth: WATERFALL_FRAME_SIZE, frameHeight: WATERFALL_FRAME_SIZE });
}

export function buildWaterfall(scene: Phaser.Scene, tilePx: number, col: number, row: number): Phaser.GameObjects.Sprite {
  if (!scene.anims.exists(FLOW_ANIM_KEY)) {
    scene.anims.create({ key: FLOW_ANIM_KEY, frames: scene.anims.generateFrameNumbers(WATERFALL_KEY, { start: 0, end: WATERFALL_FRAMES - 1 }), frameRate: WATERFALL_FPS, repeat: -1 });
  }
  return scene.add.sprite(col * tilePx, row * tilePx, WATERFALL_KEY, 0).setOrigin(0, 0).setScale(DISPLAY_SCALE).setDepth(WATERFALL_DEPTH).play(FLOW_ANIM_KEY);
}
