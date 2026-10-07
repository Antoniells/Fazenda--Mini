import Phaser from 'phaser';
import {
  DUCK_FRAME_SIZE,
  DUCK_KEY,
  DUCK_PATH,
  DUCK_SWIM_FRAMES,
  DUCK_SWIM_FRAME_RATE,
  DUCK_SWIM_SPEED,
  DUCK_TURN_PAUSE_MS,
} from '../data/ducks';
import { DISPLAY_SCALE } from './mapBuilder';
import type { DuckLane } from './duckLanes';

/**
 * Patos nadando (`data/ducks.ts`): cada um vai e volta na sua raia (`systems/duckLanes.ts`), virando o corpo em cada ponta. Ficam
 * acima da água (-0.9) e abaixo de tudo que é ordenado pelo Y.
 */
const DUCK_DEPTH = -0.4;
const SWIM_ANIM_KEY = `${DUCK_KEY}-swim`;

export function preloadDucks(scene: Phaser.Scene): void {
  scene.load.spritesheet(DUCK_KEY, encodeURI(`/${DUCK_PATH}`), { frameWidth: DUCK_FRAME_SIZE, frameHeight: DUCK_FRAME_SIZE });
}

/** Um pato nadando na raia `lane` (`index` só defasa o começo, pra os patos não andarem em sincronia). */
export function spawnSwimmingDuck(scene: Phaser.Scene, tilePx: number, lane: DuckLane, index = 0): Phaser.GameObjects.Sprite {
  if (!scene.anims.exists(SWIM_ANIM_KEY)) {
    scene.anims.create({ key: SWIM_ANIM_KEY, frames: scene.anims.generateFrameNumbers(DUCK_KEY, DUCK_SWIM_FRAMES), frameRate: DUCK_SWIM_FRAME_RATE, repeat: -1 });
  }
  const y = (lane.row + 1) * tilePx - 6;
  const duck = scene.add.sprite((lane.fromCol + 0.5) * tilePx, y, DUCK_KEY, DUCK_SWIM_FRAMES.start).setOrigin(0.5, 1).setScale(DISPLAY_SCALE).setDepth(DUCK_DEPTH);
  duck.play(SWIM_ANIM_KEY);
  // A arte olha pra esquerda: nadando pra direita, espelha.
  duck.setFlipX(lane.toCol > lane.fromCol);
  const distance = Math.abs(lane.toCol - lane.fromCol) * tilePx;
  scene.tweens.add({
    targets: duck,
    x: (lane.toCol + 0.5) * tilePx,
    duration: (distance / DUCK_SWIM_SPEED) * 1000,
    delay: index * 900,
    ease: 'Sine.easeInOut',
    yoyo: true,
    repeat: -1,
    hold: DUCK_TURN_PAUSE_MS,
    repeatDelay: DUCK_TURN_PAUSE_MS,
    onYoyo: () => duck.setFlipX(!duck.flipX),
    onRepeat: () => duck.setFlipX(!duck.flipX),
  });
  return duck;
}
