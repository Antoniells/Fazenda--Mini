import Phaser from 'phaser';
import { HEALTH_HEARTS_KEY, HUNGER_BAR_FRAME, HUNGER_FILL_FRAME, HUNGER_FILL_OFFSET } from '../data/ui';
import { HUNGRY_THRESHOLD, MAX_SATIETY } from '../data/hunger';

const SCALE = 2;
const MARGIN = 20;
/** Logo abaixo dos corações (y 20) e da armadura (y 47). */
const TOP = MARGIN + 53;
const DEPTH = 1000;

/**
 * A BARRA DE FOME (`systems/hunger.ts`) no canto, abaixo dos corações: a moldura vazia da barra verde com o raio e a faixa verde por cima,
 * recortada pela saciedade (arte real de `UI/Bars.png`, `HUNGER_*` em `data/ui.ts` — nada desenhado). Com fome (abaixo de
 * `HUNGRY_THRESHOLD`) a barra pisca devagar.
 */
export class HungerHud {
  private readonly bar: Phaser.GameObjects.Image;
  private readonly fill: Phaser.GameObjects.Image;
  private lastSatiety: number | null = null;
  private blink: Phaser.Tweens.Tween | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    const texture = scene.textures.get(HEALTH_HEARTS_KEY);
    for (const { name, rect } of [HUNGER_BAR_FRAME, HUNGER_FILL_FRAME]) {
      if (!texture.has(name)) texture.add(name, 0, rect.x, rect.y, rect.width, rect.height);
    }
    this.bar = scene.add.image(MARGIN, TOP, HEALTH_HEARTS_KEY, HUNGER_BAR_FRAME.name).setOrigin(0, 0).setScale(SCALE).setScrollFactor(0).setDepth(DEPTH);
    this.fill = scene.add
      .image(MARGIN + HUNGER_FILL_OFFSET.x * SCALE, TOP + HUNGER_FILL_OFFSET.y * SCALE, HEALTH_HEARTS_KEY, HUNGER_FILL_FRAME.name)
      .setOrigin(0, 0)
      .setScale(SCALE)
      .setScrollFactor(0)
      .setDepth(DEPTH + 1);
  }

  refresh(satiety: number): void {
    if (satiety === this.lastSatiety) return;
    this.lastSatiety = satiety;
    const fraction = Phaser.Math.Clamp(satiety / MAX_SATIETY, 0, 1);
    this.fill.setCrop(0, 0, Math.round(HUNGER_FILL_FRAME.rect.width * fraction), HUNGER_FILL_FRAME.rect.height);

    const hungry = satiety < HUNGRY_THRESHOLD;
    if (hungry && !this.blink) {
      this.blink = this.scene.tweens.add({ targets: [this.bar, this.fill], alpha: 0.45, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    } else if (!hungry && this.blink) {
      this.blink.stop();
      this.blink = null;
      this.bar.setAlpha(1);
      this.fill.setAlpha(1);
    }
  }
}
