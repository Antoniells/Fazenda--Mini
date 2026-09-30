import Phaser from 'phaser';
import { playClick } from '../systems/soundEffects';
import {
  INVENTORY_PANEL_KEY,
  INVENTORY_SLOT_FRAME_NAME,
  INVENTORY_SLOT_RECT,
  SHOP_BOOK_KEY,
  SHOP_BOOK_FRAME_NAME,
  CLOSE_TAB_BG_FRAME,
  CLOSE_BUTTON_SHEET_KEY,
  CLOSE_X_ICON_FRAME,
  CLOSE_X_ICON_PRESSED_FRAME,
} from '../data/ui';
import { computeFitScale } from './slotIcon';
import { Inventory } from '../systems/inventory';
import { SMELTING_RECIPES, SMELT_COAL_AMOUNT, SMELT_ORE_AMOUNT, smeltingInputs } from '../data/smelting';
import { resolveSlotVisual } from '../data/items';
import { minutesToRealMs, queueStatus } from '../systems/smelting';

const BOOK_SCALE = 2.2;
const SLOT_SCALE = 2;
/** Espaço entre um slot e o próximo da mesma linha (onde ficam o "+" e a seta). */
const ROW_GAP_X = 30;
const ICON_FILL_RATIO = 0.8;
const ICON_TARGET_PX = 16 * SLOT_SCALE * ICON_FILL_RATIO;
const DIM_ALPHA = 0.45;
const FONT = '"Courier New", Courier, monospace';
const TEXT_INK = '#4a3524';
const TEXT_SOFT = '#6b5a4a';
const TEXT_ENOUGH = '#2f6b2f';
const TEXT_MISSING = '#a8322d';

/** Mesmo recorte de página (esquerda/direita) já pixel-verificado em `ShopMenu` — mesmo asset (`Book.png`), mesmo layout. */
const PAGE_RECT = {
  left: { x: 14, width: 100 },
  right: { x: 124, width: 96 },
  top: 4,
  height: 119,
};

const CLOSE_MARK_SCALE = 1.8;
const CLOSE_BOOK_OVERLAP = 30;
const CLOSE_X_TARGET_PX = 30;
const CLOSE_X_OFFSET_X = CLOSE_BOOK_OVERLAP + (CLOSE_TAB_BG_FRAME.rect.width * CLOSE_MARK_SCALE - CLOSE_BOOK_OVERLAP) / 2;

const INTRO_TEXT = `Cada barra leva ${SMELT_ORE_AMOUNT} minérios brutos e ${SMELT_COAL_AMOUNT} Carvões (a de Azurita, 1 Barra de Ouro).\n\nClique na barra que quer fundir: ela leva um tempinho e cai na Bolsa quando ficar pronta.\n\nOs minérios vêm da Pedreira e das Cavernas.`;

/** Um slot com um ícone de recurso e o texto de "tenho/preciso" logo abaixo. */
interface ItemSlot {
  frame: Phaser.GameObjects.Image;
  icon: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
}

interface SmeltRow {
  recipeId: string;
  ore: ItemSlot;
  plus: Phaser.GameObjects.Text;
  coal: ItemSlot;
  arrow: Phaser.GameObjects.Text;
  bar: ItemSlot;
}

/**
 * Tela da Fornalha (substitui a antiga Bancada de Trabalho): mesmo livro (`Book.png`) e mesmo quadrado de slot do `ShopMenu`. A página esquerda tem UMA LINHA POR BARRA
 * (\`data/smelting.ts\`): minério bruto + carvão → barra, cada slot com "tenho/preciso" embaixo (verde se basta, vermelho se falta); clicar na barra funde UMA.
 * A página direita explica a regra.
 *
 * Puramente visual e de clique, como o `ShopMenu`: quem confere e gasta os materiais é quem passa o callback \`onSmelt\` (\`UIScene.smelt\`); este painel só pede e depois se redesenha (\`refresh\`).
 */
export class FurnaceMenu {
  private readonly book: Phaser.GameObjects.Image;
  private readonly rows: SmeltRow[] = [];
  private readonly title: Phaser.GameObjects.Text;
  private readonly intro: Phaser.GameObjects.Text;
  private readonly closeButton: Phaser.GameObjects.Image;
  private readonly closeButtonMark: Phaser.GameObjects.Image;
  private isOpen_ = false;

  constructor(scene: Phaser.Scene, onSmelt: (recipeId: string) => void) {
    const texture = scene.textures.get(INVENTORY_PANEL_KEY);
    if (!texture.has(INVENTORY_SLOT_FRAME_NAME)) {
      texture.add(INVENTORY_SLOT_FRAME_NAME, 0, INVENTORY_SLOT_RECT.x, INVENTORY_SLOT_RECT.y, INVENTORY_SLOT_RECT.width, INVENTORY_SLOT_RECT.height);
    }

    const centerX = scene.scale.width / 2;
    const centerY = scene.scale.height / 2;

    this.book = scene.add.image(centerX, centerY, SHOP_BOOK_KEY, SHOP_BOOK_FRAME_NAME);
    this.book.setOrigin(0.5, 0.5).setScale(BOOK_SCALE).setScrollFactor(0).setDepth(3000);

    const bookWidth = this.book.displayWidth;
    const bookHeight = this.book.displayHeight;
    const bookLeft = centerX - bookWidth / 2;
    const bookTop = centerY - bookHeight / 2;

    // Botão de fechar na lateral direita — mesma técnica/asset do `ShopMenu`.
    const closeX = bookLeft + bookWidth - CLOSE_BOOK_OVERLAP;
    const closeDepth = this.book.depth + 1;
    this.closeButton = scene.add.image(closeX, centerY, SHOP_BOOK_KEY, CLOSE_TAB_BG_FRAME.name);
    this.closeButton.setOrigin(0, 0.5).setScale(CLOSE_MARK_SCALE).setScrollFactor(0).setDepth(closeDepth);
    this.closeButton.setInteractive({ useHandCursor: true });
    this.closeButton.disableInteractive();
    this.closeButton.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      if (!this.isOpen_) return;
      event.stopPropagation();
      playClick(scene);
      this.closeButtonMark.setFrame(CLOSE_X_ICON_PRESSED_FRAME.name);
      setTimeout(() => {
        if (!this.isOpen_) return;
        this.closeButtonMark.setFrame(CLOSE_X_ICON_FRAME.name);
        this.close();
      }, 90);
    });
    this.closeButtonMark = scene.add.image(closeX + CLOSE_X_OFFSET_X - 16, centerY - 8, CLOSE_BUTTON_SHEET_KEY, CLOSE_X_ICON_FRAME.name);
    this.closeButtonMark.setOrigin(0.5, 0.5);
    this.closeButtonMark.setScale(computeFitScale(this.closeButtonMark, CLOSE_X_TARGET_PX));
    this.closeButtonMark.setScrollFactor(0).setDepth(closeDepth + 1);

    // Página ESQUERDA: uma linha por barra (minério + carvão → barra), distribuídas na altura da página.
    const slotSize = INVENTORY_SLOT_RECT.width * SLOT_SCALE;
    const pageTop = bookTop + PAGE_RECT.top * BOOK_SCALE;
    const pageHeight = PAGE_RECT.height * BOOK_SCALE;
    const leftCenterX = bookLeft + PAGE_RECT.left.x * BOOK_SCALE + (PAGE_RECT.left.width * BOOK_SCALE) / 2;
    const step = slotSize + ROW_GAP_X;
    const firstX = Math.round(leftCenterX - step);

    const makeSlot = (x: number, y: number, interactive: boolean, onClick?: () => void): ItemSlot => {
      const frame = scene.add.image(x, y, INVENTORY_PANEL_KEY, INVENTORY_SLOT_FRAME_NAME);
      frame.setOrigin(0.5, 0.5).setScale(SLOT_SCALE).setScrollFactor(0).setDepth(3001);
      if (interactive) {
        frame.setInteractive({ useHandCursor: true });
        frame.disableInteractive();
        frame.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
          if (!this.isOpen_) return;
          event.stopPropagation();
          onClick?.();
        });
      }
      const icon = scene.add.image(x, y, INVENTORY_PANEL_KEY, INVENTORY_SLOT_FRAME_NAME);
      icon.setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(3002);
      const label = scene.add.text(x, y + slotSize / 2 + 3, '', { fontFamily: FONT, fontSize: '11px', fontStyle: 'bold', color: TEXT_INK, align: 'center' });
      label.setOrigin(0.5, 0).setScrollFactor(0).setDepth(3002);
      return { frame, icon, label };
    };
    const makeSymbol = (x: number, y: number, symbol: string): Phaser.GameObjects.Text => {
      const text = scene.add.text(x, y, symbol, { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: TEXT_SOFT });
      text.setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(3002);
      return text;
    };

    SMELTING_RECIPES.forEach((recipe, index) => {
      const y = Math.round(pageTop + pageHeight * ((index * 2 + 1) / (SMELTING_RECIPES.length * 2)) - 8); // Inteiro: texto em posição fracionária borra.
      this.rows.push({
        recipeId: recipe.id,
        ore: makeSlot(firstX, y, false),
        plus: makeSymbol(Math.round(firstX + step / 2), y, '+'),
        coal: makeSlot(firstX + step, y, false),
        arrow: makeSymbol(Math.round(firstX + step * 1.5), y, '→'),
        bar: makeSlot(firstX + step * 2, y, true, () => {
          playClick(scene);
          onSmelt(recipe.id);
        }),
      });
    });

    // Página DIREITA: o título e a regra.
    const rightCenterX = bookLeft + PAGE_RECT.right.x * BOOK_SCALE + (PAGE_RECT.right.width * BOOK_SCALE) / 2;
    const wrapWidth = PAGE_RECT.right.width * BOOK_SCALE - 24;
    this.title = scene.add.text(rightCenterX, pageTop + 26, 'Fornalha', { fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: TEXT_INK });
    this.title.setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(3002);
    this.intro = scene.add.text(rightCenterX, pageTop + 56, INTRO_TEXT, { fontFamily: FONT, fontSize: '12px', color: TEXT_SOFT, align: 'center', wordWrap: { width: wrapWidth } });
    this.intro.setOrigin(0.5, 0).setScrollFactor(0).setDepth(3002);

    this.setElementsVisible(false);
  }

  isOpen(): boolean {
    return this.isOpen_;
  }

  open(inventory: Inventory): void {
    this.isOpen_ = true;
    this.refresh(inventory);
    this.setElementsVisible(true);
  }

  close(): void {
    this.isOpen_ = false;
    this.setElementsVisible(false);
  }

  toggle(inventory: Inventory): void {
    if (this.isOpen_) this.close();
    else this.open(inventory);
  }

  /** Redesenha as linhas com o que o jogador tem agora: verde/vermelho no "tenho/preciso" e a barra apagada quando falta material. Chamado ao abrir e depois de cada fundição. */
  refresh(inventory: Inventory): void {
    const setSlot = (slot: ItemSlot, resourceId: string, label: string, color: string, dim: boolean): void => {
      const visual = resolveSlotVisual({ category: 'resource', id: resourceId });
      if (visual) {
        slot.icon.setTexture(visual.textureKey, visual.iconFrame);
        slot.icon.setScale(computeFitScale(slot.icon, ICON_TARGET_PX));
      }
      slot.icon.setAlpha(dim ? DIM_ALPHA : 1);
      slot.label.setText(label);
      slot.label.setColor(color);
    };

    SMELTING_RECIPES.forEach((recipe, index) => {
      const row = this.rows[index];
      const { oreId, oreAmount, fuelId, fuelAmount } = smeltingInputs(recipe);
      const ore = inventory.getResourceCount(oreId);
      const coal = inventory.getResourceCount(fuelId);
      const bars = inventory.getResourceCount(recipe.barId);
      const oreEnough = ore >= oreAmount;
      const coalEnough = coal >= fuelAmount;
      const canSmelt = oreEnough && coalEnough;

      setSlot(row.ore, oreId, `${ore}/${oreAmount}`, oreEnough ? TEXT_ENOUGH : TEXT_MISSING, !oreEnough);
      setSlot(row.coal, fuelId, `${coal}/${fuelAmount}`, coalEnough ? TEXT_ENOUGH : TEXT_MISSING, !coalEnough);
      // Barras já na fila: mostra quantas e em quantos segundos sai a próxima (a fila anda em tempo de jogo, `systems/smelting.ts`).
      const queue = queueStatus(recipe.id);
      const detail = queue.count > 0 ? `Fila: ${queue.count} (${Math.ceil(minutesToRealMs(queue.nextInMinutes) / 1000)}s)` : `(tem ${bars})`;
      setSlot(row.bar, recipe.barId, `${canSmelt ? 'Fundir' : 'Faltam'}\n${detail}`, canSmelt ? TEXT_ENOUGH : TEXT_MISSING, !canSmelt && queue.count === 0);
    });
  }

  private setElementsVisible(visible: boolean): void {
    this.book.setVisible(visible);
    this.closeButton.setVisible(visible);
    if (visible) this.closeButton.setInteractive();
    else this.closeButton.disableInteractive();
    this.closeButtonMark.setVisible(visible);
    this.title.setVisible(visible);
    this.intro.setVisible(visible);

    for (const row of this.rows) {
      for (const slot of [row.ore, row.coal, row.bar]) {
        slot.frame.setVisible(visible);
        slot.icon.setVisible(visible);
        slot.label.setVisible(visible);
      }
      row.plus.setVisible(visible);
      row.arrow.setVisible(visible);
      if (visible) row.bar.frame.setInteractive();
      else row.bar.frame.disableInteractive();
    }
  }
}
