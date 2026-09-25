import Phaser from 'phaser';
import { ARMOR_HUD_KEY, ARMOR_FULL_FRAME, ARMOR_HALF_FRAME, ARMOR_EMPTY_FRAME } from '../data/ui';
import { ARMOR_ICON_COUNT, DEFENSE_PER_ARMOR_ICON } from '../systems/playerHealth';

/** Tamanho (px de tela) de cada ícone — a arte tem 57px, então a escala sai dela (mesmo tamanho dos corações, ~22px de passo). */
const ICON_SIZE_PX = 22;
const SCALE = ICON_SIZE_PX / ARMOR_FULL_FRAME.rect.width;
const MARGIN = 20;
const ICON_SPACING = 22;
/** Logo abaixo da fileira de corações (`HealthHud`: 24px de altura a partir de `MARGIN`). */
const TOP = MARGIN + 27;

/**
 * Defesa da armadura equipada na tela, embaixo dos corações — mesmo esquema
 * deles: `ARMOR_ICON_COUNT` (5) ícones de peitoral, cada um cheio / meio /
 * vazio (arte real de `UI/Armor.png`, ver `data/ui.ts`). Cada ícone vale
 * `DEFENSE_PER_ARMOR_ICON` pontos de defesa (o meio vale 1): Armadura de
 * Madeira (2) = 1 ícone cheio, Armadura de Ferro (6) = 3 cheios.
 *
 * Sem armadura equipada a fileira inteira fica escondida. Puramente visual,
 * igual aos outros HUDs: `refresh` só espelha `Inventory.getDefense()`.
 */
export class ArmorHud {
  private readonly icons: Phaser.GameObjects.Image[] = [];
  private lastDefense: number | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    const texture = scene.textures.get(ARMOR_HUD_KEY);
    for (const { name, rect } of [ARMOR_FULL_FRAME, ARMOR_HALF_FRAME, ARMOR_EMPTY_FRAME]) {
      if (!texture.has(name)) texture.add(name, 0, rect.x, rect.y, rect.width, rect.height);
    }

    for (let index = 0; index < ARMOR_ICON_COUNT; index++) {
      const icon = scene.add.image(MARGIN + index * ICON_SPACING, TOP, ARMOR_HUD_KEY, ARMOR_EMPTY_FRAME.name);
      icon.setOrigin(0, 0);
      icon.setScale(SCALE);
      icon.setScrollFactor(0);
      icon.setDepth(1000);
      icon.setVisible(false);
      this.icons.push(icon);
    }
  }

  refresh(defense: number): void {
    if (defense === this.lastDefense) return;
    const changed = this.lastDefense !== null;
    this.lastDefense = defense;

    this.icons.forEach((icon, index) => {
      const value = Phaser.Math.Clamp(defense - index * DEFENSE_PER_ARMOR_ICON, 0, DEFENSE_PER_ARMOR_ICON);
      const frame = value >= DEFENSE_PER_ARMOR_ICON ? ARMOR_FULL_FRAME : value > 0 ? ARMOR_HALF_FRAME : ARMOR_EMPTY_FRAME;
      icon.setFrame(frame.name);
      icon.setVisible(defense > 0);

      // Equipou/trocou: os ícones "pulam" de leve, mesma linguagem dos corações.
      if (changed && defense > 0) {
        this.scene.tweens.killTweensOf(icon);
        icon.setScale(SCALE * 1.25);
        this.scene.tweens.add({ targets: icon, scale: SCALE, duration: 220, ease: 'Back.easeOut' });
      }
    });
  }
}
