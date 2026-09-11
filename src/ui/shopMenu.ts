import Phaser from 'phaser';
import { CropDefinition } from '../data/crops';
import { INVENTORY_UI_KEY, SLOT_FRAME_NAME, SLOT_FRAME_RECT } from '../data/ui';

const SLOT_SCALE = 1.8;
const SLOT_GAP = 8;
const AFFORDABLE_ALPHA = 1;
const UNAFFORDABLE_ALPHA = 0.45;

interface ShopSlot {
  cropId: string;
  price: number;
  frame: Phaser.GameObjects.Image;
  icon: Phaser.GameObjects.Image;
  priceText: Phaser.GameObjects.Text;
}

/**
 * Painel de compra de sementes: mesma linguagem visual da `SeedBar`/
 * `CoinBar` — moldura de `UI/Inventory/Slots.png`, ícone é o frame da
 * cultura já colhida (`CropDefinition.iconFrame`), preço em texto (mesma
 * justificativa da `CoinBar`: não há fonte em pixel art no pacote para um
 * número livre). Nenhuma forma nova desenhada por código.
 *
 * Fica oculto até `open()`/`toggle()`. Puramente visual e de clique: quem
 * decide se a compra é possível é sempre `Inventory`, via o callback
 * `onBuy` passado no construtor — este painel só pede a compra e depois
 * reflete o resultado (`refresh`), nunca decide sozinho.
 */
export class ShopMenu {
  private readonly slots: ShopSlot[] = [];
  private isOpen_ = false;

  constructor(scene: Phaser.Scene, crops: CropDefinition[], onBuy: (cropId: string) => void) {
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
    const totalWidth = crops.length * slotWidth + (crops.length - 1) * SLOT_GAP;
    const startX = (scene.scale.width - totalWidth) / 2 + slotWidth / 2;
    const centerY = scene.scale.height / 2;

    crops.forEach((crop, index) => {
      const x = startX + index * (slotWidth + SLOT_GAP);

      const frame = scene.add.image(x, centerY, INVENTORY_UI_KEY, SLOT_FRAME_NAME);
      frame.setOrigin(0.5, 0.5);
      frame.setScale(SLOT_SCALE);
      frame.setScrollFactor(0);
      frame.setDepth(3000);

      // Mesma técnica da SeedBar: interativo + stopPropagation, para o
      // clique não vazar para o PlayerController (que trataria como
      // mover/interagir com o mundo por baixo do painel).
      frame.setInteractive({ useHandCursor: true });
      frame.on(
        'pointerdown',
        (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
          event.stopPropagation();
          onBuy(crop.id);
        },
      );

      const icon = scene.add.image(x, centerY, crop.textureKey, crop.iconFrame);
      icon.setOrigin(0.5, 0.5);
      icon.setScale(SLOT_SCALE);
      icon.setScrollFactor(0);
      icon.setDepth(3001);

      const priceText = scene.add.text(x, centerY + slotHeight / 2 + 6, `${crop.seedPrice}`, {
        fontFamily: 'monospace',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#ffe27a',
        stroke: '#2b1d0e',
        strokeThickness: 3,
      });
      priceText.setOrigin(0.5, 0);
      priceText.setScrollFactor(0);
      priceText.setDepth(3001);

      this.slots.push({ cropId: crop.id, price: crop.seedPrice, frame, icon, priceText });
    });

    this.setElementsVisible(false);
  }

  isOpen(): boolean {
    return this.isOpen_;
  }

  open(): void {
    this.isOpen_ = true;
    this.setElementsVisible(true);
  }

  close(): void {
    this.isOpen_ = false;
    this.setElementsVisible(false);
  }

  toggle(): void {
    if (this.isOpen_) this.close();
    else this.open();
  }

  /** Escurece os slots que o jogador não tem saldo para comprar no momento. */
  refresh(coins: number): void {
    for (const slot of this.slots) {
      const affordable = coins >= slot.price;
      const alpha = affordable ? AFFORDABLE_ALPHA : UNAFFORDABLE_ALPHA;
      slot.frame.setAlpha(alpha);
      slot.icon.setAlpha(alpha);
    }
  }

  private setElementsVisible(visible: boolean): void {
    for (const slot of this.slots) {
      slot.frame.setVisible(visible);
      slot.icon.setVisible(visible);
      slot.priceText.setVisible(visible);
    }
  }
}
