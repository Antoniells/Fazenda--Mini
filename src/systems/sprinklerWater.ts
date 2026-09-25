import Phaser from 'phaser';
import { SPRINKLER_WATER_KEY, SPRINKLER_WATER_TINT, SPRINKLER_WATER_SIDES, SprinklerWaterSide } from '../data/effects';
import { Farmland } from './farmland';

/** Escala do sprite (quadro de 32px nativos, água de ~28px): 1 = cerca de 1 tile na tela (tile = 16px nativos x DISPLAY_SCALE 2). */
const WATER_SCALE = 1;
const WATER_FRAME_RATE = 4;
const WATER_VISIBLE_MS = 2600;
const WATER_FADE_MS = 500;
const WATER_ALPHA = 0.95;
/** A água "chega" em ondas: cada terreno espera um pouco mais quanto mais longe está do aspersor. */
const RIPPLE_MS_PER_TILE = 90;

function ensureWaterAnimations(scene: Phaser.Scene): void {
  for (const side of Object.values(SPRINKLER_WATER_SIDES)) {
    if (scene.anims.exists(side.animKey)) continue;
    scene.anims.create({
      key: side.animKey,
      frames: side.frames.map((frame) => ({ key: SPRINKLER_WATER_KEY, frame })),
      frameRate: WATER_FRAME_RATE,
      repeat: -1,
    });
  }
}

/** De que lado do aspersor o terreno está (eixo dominante da distância) — define qual dos 4 pares de quadros usar. */
function sideOf(dx: number, dy: number): SprinklerWaterSide {
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

/**
 * Água do Aspersor (pedido explícito): em cada terreno arado que ele regou (`cells`, de `sprinklerReachCells`), aparece por um instante
 * o sprite da água por cima da terra, alternando entre 2 quadros, com a ponta fina virada pro aspersor (o quadro depende do lado em que o
 * terreno fica em relação a (`col`,`row`)). Só visual — quem rega de fato é `systems/sprinklers.ts`.
 */
export function playSprinklerWater(
  scene: Phaser.Scene,
  farmland: Farmland,
  cells: Array<{ col: number; row: number }>,
  col: number,
  row: number,
  tilePx: number,
): void {
  if (!scene.textures.exists(SPRINKLER_WATER_KEY)) return;
  ensureWaterAnimations(scene);

  for (const { col: c, row: r } of cells) {
    const plot = farmland.getPlot(c, r);
    if (!plot || plot.state === 'untilled' || !plot.wateredToday) continue;

    const dx = c - col;
    const dy = r - row;
    const side = SPRINKLER_WATER_SIDES[sideOf(dx, dy)];
    const y = (r + 1) * tilePx - tilePx / 2;

    const sprite = scene.add.sprite(c * tilePx + tilePx / 2, y, SPRINKLER_WATER_KEY, side.frames[0]);
    sprite.setScale(WATER_SCALE);
    sprite.setTint(SPRINKLER_WATER_TINT);
    sprite.setTintMode(Phaser.TintModes.FILL);
    sprite.setDepth(y + 0.5);
    sprite.setAlpha(0);

    const delay = Math.max(Math.abs(dx), Math.abs(dy)) * RIPPLE_MS_PER_TILE;
    scene.time.delayedCall(delay, () => {
      if (!sprite.active) return;
      sprite.setAlpha(WATER_ALPHA);
      sprite.play(side.animKey);
      scene.tweens.add({
        targets: sprite,
        alpha: 0,
        delay: WATER_VISIBLE_MS,
        duration: WATER_FADE_MS,
        onComplete: () => sprite.destroy(),
      });
    });
  }
}
