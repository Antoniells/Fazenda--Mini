import Phaser from 'phaser';
import { CropDefinition } from '../data/crops';
import { INVENTORY_UI_KEY, SLOT_FRAME_NAME, SLOT_FRAME_RECT } from '../data/ui';

const SLOT_SCALE = 2;
const SLOT_GAP = 8;
const MARGIN = 16;
const SELECTED_TINT = 0xfff3b0;
const SELECTED_ICON_SCALE = SLOT_SCALE * 1.25;

interface Slot {
  cropId: string;
  frame: Phaser.GameObjects.Image;
  icon: Phaser.GameObjects.Image;
}

/**
 * HUD simples com um slot por semente disponível: a moldura vem de
 * `UI/Inventory/Slots.png` (um slot individual recortado do spritesheet) e
 * o conteúdo é o próprio frame de ícone de cada cultura
 * (`CropDefinition.iconFrame`) — nenhum desenho programático, só
 * composição de assets já existentes. Destaque da semente selecionada é só
 * escala/opacidade/tingimento (mesma técnica já usada para a plantação
 * morta em `farmlandRenderer.ts`), não uma forma nova desenhada por cima.
 *
 * Puramente visual: não decide nada, só reflete o que `Inventory` já diz
 * via `refresh()`.
 */
export class SeedBar {
  private readonly slots: Slot[] = [];

  constructor(scene: Phaser.Scene, crops: CropDefinition[]) {
    const texture = scene.textures.get(INVENTORY_UI_KEY);
    if (!texture.has(SLOT_FRAME_NAME)) {
      texture.add(
        SLOT_FRAME_NAME,
        0,
        SLOT_FRAME_RECT.x,
        SLOT_FRAME_RECT.y,
        SLOT_FRAME_RECT.width,
        SLOT_FRAME_RECT.height,
      );
    }

    const slotWidth = SLOT_FRAME_RECT.width * SLOT_SCALE;
    const slotHeight = SLOT_FRAME_RECT.height * SLOT_SCALE;
    const baseY = scene.scale.height - MARGIN - slotHeight;

    crops.forEach((crop, index) => {
      const x = MARGIN + index * (slotWidth + SLOT_GAP);

      const frame = scene.add.image(x, baseY, INVENTORY_UI_KEY, SLOT_FRAME_NAME);
      frame.setOrigin(0, 0);
      frame.setScale(SLOT_SCALE);
      frame.setScrollFactor(0);
      frame.setDepth(1000);

      const icon = scene.add.image(x + slotWidth / 2, baseY + slotHeight / 2, crop.textureKey, crop.iconFrame);
      icon.setScale(SLOT_SCALE);
      icon.setScrollFactor(0);
      icon.setDepth(1001);

      this.slots.push({ cropId: crop.id, frame, icon });
    });
  }

  /** Atualiza o destaque visual para refletir a semente atualmente selecionada em `Inventory`. */
  refresh(selectedCropId: string): void {
    for (const slot of this.slots) {
      const selected = slot.cropId === selectedCropId;
      slot.frame.setTint(selected ? SELECTED_TINT : 0xffffff);
      slot.icon.setScale(selected ? SELECTED_ICON_SCALE : SLOT_SCALE);
      slot.icon.setAlpha(selected ? 1 : 0.6);
    }
  }
}
