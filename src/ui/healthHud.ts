import Phaser from 'phaser';
import { HEALTH_HEARTS_KEY, HEART_FULL_FRAME, HEART_HALF_FRAME, HEART_EMPTY_FRAME } from '../data/ui';
import { HEART_COUNT } from '../systems/playerHealth';

const SCALE = 1.5;
const MARGIN = 20;
const HEART_SPACING = 22;

/**
 * Vida do jogador na tela (Fase 8 — Combate), canto superior esquerdo:
 * `HEART_COUNT` (5) corações, cada um cheio / meio / vazio (arte real de
 * `UI/Bars.png`, ver `data/ui.ts`). Cada coração vale `maxHp / HEART_COUNT`
 * de vida (10 HP com o `MAX_HP` atual de 50) e o meio-coração é qualquer
 * valor entre 1 e 9 desse intervalo — com o dano de 5 do Slime, cada golpe
 * tira exatamente meio coração (e comer recupera meio coração, ver
 * `systems/playerHealth.ts`).
 *
 * Puramente visual, igual aos outros HUDs (`TimeMoneyHud`, `Hotbar`):
 * `refresh` só espelha o que `PlayerHealth` já calcula, nunca decide nada.
 * Só redesenha quando o HP muda de fato, e faz o coração que mudou
 * "pulsar" (forte ao perder vida, mais leve ao recuperar).
 */
export class HealthHud {
  private readonly hearts: Phaser.GameObjects.Image[] = [];
  private lastHp: number | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    const texture = scene.textures.get(HEALTH_HEARTS_KEY);
    for (const { name, rect } of [HEART_FULL_FRAME, HEART_HALF_FRAME, HEART_EMPTY_FRAME]) {
      if (!texture.has(name)) texture.add(name, 0, rect.x, rect.y, rect.width, rect.height);
    }

    for (let index = 0; index < HEART_COUNT; index++) {
      const heart = scene.add.image(MARGIN + index * HEART_SPACING, MARGIN, HEALTH_HEARTS_KEY, HEART_EMPTY_FRAME.name);
      heart.setOrigin(0, 0);
      heart.setScale(SCALE);
      heart.setScrollFactor(0);
      heart.setDepth(1000);
      this.hearts.push(heart);
    }
  }

  refresh(hp: number, maxHp: number): void {
    if (hp === this.lastHp) return;
    const tookDamage = this.lastHp !== null && hp < this.lastHp;
    const healed = this.lastHp !== null && hp > this.lastHp;
    this.lastHp = hp;

    const hpPerHeart = maxHp / HEART_COUNT;
    this.hearts.forEach((heart, index) => {
      const value = Phaser.Math.Clamp(hp - index * hpPerHeart, 0, hpPerHeart);
      const frame = value >= hpPerHeart ? HEART_FULL_FRAME : value > 0 ? HEART_HALF_FRAME : HEART_EMPTY_FRAME;
      const changed = heart.frame.name !== frame.name;
      heart.setFrame(frame.name);

      if ((tookDamage || healed) && changed) {
        this.scene.tweens.killTweensOf(heart);
        heart.setScale(SCALE * (tookDamage ? 1.4 : 1.25));
        this.scene.tweens.add({ targets: heart, scale: SCALE, duration: 220, ease: 'Back.easeOut' });
      }
    });
  }
}
