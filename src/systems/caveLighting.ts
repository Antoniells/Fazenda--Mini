import Phaser from 'phaser';
import { CAVE_PENUMBRA_BOTTOM, CAVE_PENUMBRA_TOP, CAVE_PLAYER_LIGHT, CAVE_STAIRS_DOWN_LIGHT, CAVE_STAIRS_UP_LIGHT } from '../data/lighting';
import { CAVE_MAX_FLOOR } from '../data/caveFloors';
import { mixColors } from './ambientLight';
import { DayNightOverlay } from './dayNightOverlay';
import { GLOW_RING_ALPHAS, addGlowRings } from './lightSources';

/**
 * LUZ DAS CAVERNAS (ideia do Terraria — a escuridão só se abre onde há luz —, numa versão leve): o andar fica em PENUMBRA (o mesmo véu em
 * MULTIPLY da noite, `DayNightOverlay`, com a cor do andar: quanto mais fundo, mais escuro) e o personagem leva um halo quente (os anéis de
 * brilho dos postes, `addGlowRings`, em ADD acima do véu) que tremula de leve como uma lamparina. As escadas brilham fraquinho pra se acharem
 * de longe. Nenhum bloco barra a luz (o Terraria calcula isso célula a célula; aqui o halo basta). Só visual.
 */

/** Cor do véu do andar `floor` (1 = mais claro, `CAVE_MAX_FLOOR` = mais escuro). */
export function cavePenumbraColor(floor: number): number {
  const t = Math.min(1, Math.max(0, (floor - 1) / (CAVE_MAX_FLOOR - 1)));
  return mixColors(CAVE_PENUMBRA_TOP, CAVE_PENUMBRA_BOTTOM, t);
}

interface Glow {
  images: Phaser.GameObjects.Image[];
  alpha: number;
}

export class CaveLighting {
  private readonly veil: DayNightOverlay;
  private readonly color: number;
  private readonly halo: Glow;
  private readonly glows: Glow[] = [];

  constructor(
    scene: Phaser.Scene,
    floor: number,
    private readonly follow: Phaser.GameObjects.Sprite,
    tilePx: number,
    stairs: { up: { col: number; row: number }; down: { col: number; row: number } | null },
  ) {
    this.veil = new DayNightOverlay(scene);
    this.color = cavePenumbraColor(floor);
    const halo = CAVE_PLAYER_LIGHT;
    this.halo = { images: addGlowRings(scene, follow.x, follow.y, halo.radiusCells * tilePx, halo.color).images, alpha: halo.alpha };
    const stairsGlow = (cell: { col: number; row: number }, light: { radiusCells: number; color: number; alpha: number }): void => {
      const images = addGlowRings(scene, (cell.col + 0.5) * tilePx, (cell.row + 0.5) * tilePx, light.radiusCells * tilePx, light.color).images;
      this.glows.push({ images, alpha: light.alpha });
    };
    stairsGlow(stairs.up, CAVE_STAIRS_UP_LIGHT);
    if (stairs.down) stairsGlow(stairs.down, CAVE_STAIRS_DOWN_LIGHT);
    for (const glow of [this.halo, ...this.glows]) this.applyAlpha(glow, 1);
  }

  /** A cada quadro: o véu (que se refaz se a câmera saltar) e o halo atrás do personagem, tremulando. */
  update(timeMs: number): void {
    this.veil.setColor(this.color);
    const wave = 0.5 * Math.sin(timeMs / 230) + 0.5 * Math.sin(timeMs / 101 + 1.7);
    const flicker = 1 - CAVE_PLAYER_LIGHT.flicker * (0.5 + 0.5 * wave);
    for (const image of this.halo.images) image.setPosition(this.follow.x, this.follow.y + CAVE_PLAYER_LIGHT.offsetY);
    this.applyAlpha(this.halo, flicker);
  }

  private applyAlpha(glow: Glow, multiplier: number): void {
    glow.images.forEach((image, index) => image.setVisible(true).setAlpha(glow.alpha * GLOW_RING_ALPHAS[index] * multiplier));
  }
}
