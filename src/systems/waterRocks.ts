import Phaser from 'phaser';
import { WATER_ROCKS, WATER_ROCK_FPS, WATER_ROCK_FRAMES, type WaterRockSize } from '../data/effects';
import { DISPLAY_SCALE } from './mapBuilder';

/**
 * Rochas dentro d'água (`WATER_ROCKS`, `data/effects.ts`), com a ondinha em volta animada. Só enfeite: ficam na água (ninguém chega nelas),
 * acima da água (-0.9) e abaixo dos patos (-0.4). Ancoradas no centro de baixo da célula do pé.
 */
const WATER_ROCK_DEPTH = -0.45;

export function preloadWaterRocks(scene: Phaser.Scene): void {
  for (const rock of Object.values(WATER_ROCKS)) {
    scene.load.spritesheet(rock.key, encodeURI(`/${rock.path}`), { frameWidth: rock.frameWidth, frameHeight: rock.frameHeight });
  }
}

export function buildWaterRock(scene: Phaser.Scene, tilePx: number, col: number, row: number, size: WaterRockSize): Phaser.GameObjects.Sprite {
  const { key } = WATER_ROCKS[size];
  const animKey = `${key}-ripple`;
  if (!scene.anims.exists(animKey)) {
    scene.anims.create({ key: animKey, frames: scene.anims.generateFrameNumbers(key, { start: 0, end: WATER_ROCK_FRAMES - 1 }), frameRate: WATER_ROCK_FPS, repeat: -1 });
  }
  const rock = scene.add.sprite((col + 0.5) * tilePx, (row + 1) * tilePx, key, 0).setOrigin(0.5, 1).setScale(DISPLAY_SCALE).setDepth(WATER_ROCK_DEPTH);
  // Cada rocha começa num quadro diferente: as ondinhas não andam em sincronia.
  rock.play({ key: animKey, startFrame: (col + row) % WATER_ROCK_FRAMES });
  return rock;
}
