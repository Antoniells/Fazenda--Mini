import Phaser from 'phaser';
import { playClick, playEffect } from '../systems/soundEffects';
import { SPEND_MONEY_SOUND } from '../data/audio';
import { Inventory } from '../systems/inventory';
import { getSellables, Sellable } from '../data/sellables';
import { applySellBonus, getSellPriceMultiplier } from '../systems/skills';
import {
  INVENTORY_PANEL_KEY,
  INVENTORY_PANEL_FRAME_NAME,
  INVENTORY_PANEL_RECT,
  INVENTORY_PANEL_BORDER,
  INVENTORY_SLOT_FRAME_NAME,
  INVENTORY_SLOT_RECT,
  INVENTORY_LARGE_PANEL_KEY,
  INVENTORY_LARGE_PANEL_FRAME_NAME,
  INVENTORY_LARGE_PANEL_RECT,
  INVENTORY_LARGE_PANEL_BORDER,
} from '../data/ui';
import { computeFitScale } from './slotIcon';

const PANEL_WIDTH = 440;
const PANEL_HEIGHT = 372;
const DEPTH = 3000;

const SLOT_SCALE = 1.7;
const SLOT_GAP = 6;
const GRID_COLS = 8;
const GRID_ROWS = 2;
const SLOT_COUNT = GRID_COLS * GRID_ROWS;
const ICON_TARGET_PX = 16 * SLOT_SCALE * 0.8;

const FONT = '"Courier New", Courier, monospace';
const TEXT_INK = '#4a3524';
const TEXT_SOFT = '#6b5a4a';
const TEXT_GAIN = '#2f6b2a';
const BUTTON_WIDTH = 120;
const BUTTON_HEIGHT = 32;
const BUTTON_DISABLED_TINT = 0x8f8f8f;

/** Uma célula do grid (da caixa ou da bolsa): moldura clicável + ícone + quantidade. */
interface BinSlot {
  /** `Sellable.key` do que está na célula (`''` = vazia). */
  itemKey: string;
  frame: Phaser.GameObjects.Image;
  icon: Phaser.GameObjects.Image;
  countText: Phaser.GameObjects.Text;
}

/**
 * Menu da Caixa de Remessas (pedido explícito — "igual ao Stardew Valley"):
 * dois grids num painel só. Em cima, o que está **na caixa** (o que o jogador
 * vai vender); embaixo, as colheitas **da bolsa**. Clicar num item da bolsa
 * transfere 1 unidade pra caixa (Shift+clique ou botão direito: todas);
 * clicar num item da caixa devolve. Nada sai do `Inventory` até apertar
 * "Vender": aí o total (`Σ quantidade × sellPrice`) é calculado, as colheitas
 * saem da bolsa e as moedas entram — antes disso "transferir" é só uma
 * separação visual (`pending`), então fechar o menu sem vender não perde nada.
 *
 * Vendáveis (`data/sellables.ts`): as colheitas e os materiais com preço
 * (madeira, pedra, gosma de Slime). Puramente visual e de clique: quem
 * executa a venda é `Inventory` (`Sellable.take`/`addCoins`);
 * o resultado volta pelo callback `onSold` (feedback visual da caixa no mundo).
 */
export class ShippingBinMenu {
  private readonly panel: Phaser.GameObjects.NineSlice;
  private readonly title: Phaser.GameObjects.Text;
  private readonly binLabel: Phaser.GameObjects.Text;
  private readonly bagLabel: Phaser.GameObjects.Text;
  private readonly binSlots: BinSlot[] = [];
  private readonly bagSlots: BinSlot[] = [];
  private readonly infoText: Phaser.GameObjects.Text;
  private readonly totalText: Phaser.GameObjects.Text;
  private readonly sellButton: Phaser.GameObjects.NineSlice;
  private readonly sellLabel: Phaser.GameObjects.Text;
  private readonly closeButton: Phaser.GameObjects.NineSlice;
  private readonly closeLabel: Phaser.GameObjects.Text;
  /** Quantas unidades de cada colheita o jogador já passou pra caixa (ainda na bolsa até "Vender"). */
  private readonly pending = new Map<string, number>();
  private readonly sellables: Sellable[] = getSellables();
  private isOpen_ = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly inventory: Inventory,
    private readonly onSold: (totalCoins: number, totalItems: number) => void,
  ) {
    const panelTexture = scene.textures.get(INVENTORY_PANEL_KEY);
    for (const [name, rect] of [
      [INVENTORY_SLOT_FRAME_NAME, INVENTORY_SLOT_RECT],
      [INVENTORY_PANEL_FRAME_NAME, INVENTORY_PANEL_RECT],
    ] as const) {
      if (!panelTexture.has(name)) panelTexture.add(name, 0, rect.x, rect.y, rect.width, rect.height);
    }
    const largeTexture = scene.textures.get(INVENTORY_LARGE_PANEL_KEY);
    if (!largeTexture.has(INVENTORY_LARGE_PANEL_FRAME_NAME)) {
      const rect = INVENTORY_LARGE_PANEL_RECT;
      largeTexture.add(INVENTORY_LARGE_PANEL_FRAME_NAME, 0, rect.x, rect.y, rect.width, rect.height);
    }

    const cx = scene.scale.width / 2;
    const cy = scene.scale.height / 2;
    const top = cy - PANEL_HEIGHT / 2;

    this.panel = scene.add.nineslice(
      cx,
      cy,
      INVENTORY_LARGE_PANEL_KEY,
      INVENTORY_LARGE_PANEL_FRAME_NAME,
      PANEL_WIDTH,
      PANEL_HEIGHT,
      INVENTORY_LARGE_PANEL_BORDER,
      INVENTORY_LARGE_PANEL_BORDER,
      INVENTORY_LARGE_PANEL_BORDER,
      INVENTORY_LARGE_PANEL_BORDER,
    );
    this.panel.setOrigin(0.5, 0.5);
    this.panel.setScrollFactor(0);
    this.panel.setDepth(DEPTH);

    const makeText = (x: number, y: number, text: string, size: number, color: string, bold = false, originX = 0.5): Phaser.GameObjects.Text => {
      const label = scene.add.text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: bold ? 'bold' : 'normal', color });
      label.setOrigin(originX, 0.5);
      label.setScrollFactor(0);
      label.setDepth(DEPTH + 2);
      return label;
    };

    this.title = makeText(cx, top + 34, 'Caixa de Remessas', 18, TEXT_INK, true);
    this.binLabel = makeText(cx, top + 62, 'Na caixa (vai ser vendido)', 11, TEXT_SOFT);

    const slotWidth = INVENTORY_SLOT_RECT.width * SLOT_SCALE;
    const slotHeight = INVENTORY_SLOT_RECT.height * SLOT_SCALE;
    const gridWidth = GRID_COLS * slotWidth + (GRID_COLS - 1) * SLOT_GAP;
    const startX = cx - gridWidth / 2 + slotWidth / 2;

    const buildGrid = (rowsTop: number, slots: BinSlot[], onClick: (itemKey: string, all: boolean) => void): void => {
      for (let index = 0; index < SLOT_COUNT; index++) {
        const x = startX + (index % GRID_COLS) * (slotWidth + SLOT_GAP);
        const y = rowsTop + Math.floor(index / GRID_COLS) * (slotHeight + SLOT_GAP);

        const frame = scene.add.image(x, y, INVENTORY_PANEL_KEY, INVENTORY_SLOT_FRAME_NAME);
        frame.setScale(SLOT_SCALE);
        frame.setScrollFactor(0);
        frame.setDepth(DEPTH + 1);
        frame.setInteractive({ useHandCursor: true });
        frame.disableInteractive();

        const icon = scene.add.image(x, y, INVENTORY_PANEL_KEY, INVENTORY_SLOT_FRAME_NAME);
        icon.setScrollFactor(0);
        icon.setDepth(DEPTH + 2);

        const countText = scene.add.text(x + slotWidth / 2 - 2, y + slotHeight / 2 - 2, '', {
          fontFamily: 'monospace',
          fontSize: '11px',
          fontStyle: 'bold',
          color: '#ffffff',
          stroke: '#2b1d0e',
          strokeThickness: 3,
        });
        countText.setOrigin(1, 1);
        countText.setScrollFactor(0);
        countText.setDepth(DEPTH + 3);

        const slot: BinSlot = { itemKey: '', frame, icon, countText };
        slots.push(slot);

        frame.on('pointerdown', (pointer: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
          if (!this.isOpen_) return;
          event.stopPropagation();
          if (!slot.itemKey) return;
          playClick(scene);
          // Shift+clique ou botão direito: a pilha toda; clique normal: 1 unidade.
          onClick(slot.itemKey, pointer.rightButtonDown() || !!pointer.event?.shiftKey);
        });
        frame.on('pointerover', () => {
          const item = this.findSellable(slot.itemKey);
          if (item) this.infoText.setText(`${item.name} — ${item.price} moedas cada${getSellPriceMultiplier() > 1 ? ` (+${Math.round((getSellPriceMultiplier() - 1) * 100)}% ao vender)` : ''}`);
        });
        frame.on('pointerout', () => this.showDefaultInfo());
      }
    };

    buildGrid(top + 96, this.binSlots, (itemKey, all) => this.moveToBag(itemKey, all));
    this.bagLabel = makeText(cx, top + 176, 'Sua bolsa (colheitas e materiais — clique pra colocar na caixa)', 11, TEXT_SOFT);
    buildGrid(top + 210, this.bagSlots, (itemKey, all) => this.moveToBin(itemKey, all));

    this.infoText = makeText(cx, top + 282, '', 11, TEXT_SOFT);
    this.totalText = makeText(cx, top + 304, '', 14, TEXT_GAIN, true);

    const makeButton = (x: number, label: string, onClick: () => void): { button: Phaser.GameObjects.NineSlice; text: Phaser.GameObjects.Text } => {
      const button = scene.add.nineslice(
        x,
        top + 338,
        INVENTORY_PANEL_KEY,
        INVENTORY_PANEL_FRAME_NAME,
        BUTTON_WIDTH,
        BUTTON_HEIGHT,
        INVENTORY_PANEL_BORDER,
        INVENTORY_PANEL_BORDER,
        INVENTORY_PANEL_BORDER,
        INVENTORY_PANEL_BORDER,
      );
      button.setScrollFactor(0);
      button.setDepth(DEPTH + 1);
      button.setInteractive({ useHandCursor: true });
      button.disableInteractive();
      button.on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
        if (!this.isOpen_) return;
        event.stopPropagation();
        onClick();
      });
      return { button, text: makeText(x, top + 338, label, 14, TEXT_INK, true) };
    };

    const sell = makeButton(cx - BUTTON_WIDTH / 2 - 10, 'Vender', () => this.sell());
    this.sellButton = sell.button;
    this.sellLabel = sell.text;
    const close = makeButton(cx + BUTTON_WIDTH / 2 + 10, 'Fechar', () => {
      playClick(scene);
      this.close();
    });
    this.closeButton = close.button;
    this.closeLabel = close.text;

    this.setVisible(false);
  }

  isOpen(): boolean {
    return this.isOpen_;
  }

  open(): void {
    this.isOpen_ = true;
    this.pending.clear();
    this.render();
  }

  /** Fecha sem vender: o que estava "na caixa" continua na bolsa (nada tinha saído dela). */
  close(): void {
    this.isOpen_ = false;
    this.pending.clear();
    this.setVisible(false);
  }

  toggle(): void {
    if (this.isOpen_) this.close();
    else this.open();
  }

  private findSellable(itemKey: string): Sellable | undefined {
    return this.sellables.find((item) => item.key === itemKey);
  }

  /** Quanto o que está na caixa vale agora. */
  private pendingTotal(): { coins: number; items: number } {
    let coins = 0;
    let items = 0;
    for (const [itemKey, amount] of this.pending) {
      coins += amount * (this.findSellable(itemKey)?.price ?? 0);
      items += amount;
    }
    // Bônus da habilidade Comerciante: arredondado uma vez, no total.
    return { coins: applySellBonus(coins), items };
  }

  private moveToBin(itemKey: string, all: boolean): void {
    const item = this.findSellable(itemKey);
    if (!item) return;
    const available = item.count(this.inventory) - (this.pending.get(itemKey) ?? 0);
    if (available <= 0) return;
    this.pending.set(itemKey, (this.pending.get(itemKey) ?? 0) + (all ? available : 1));
    this.render();
  }

  private moveToBag(itemKey: string, all: boolean): void {
    const inBin = this.pending.get(itemKey) ?? 0;
    if (inBin <= 0) return;
    const remaining = all ? 0 : inBin - 1;
    if (remaining <= 0) this.pending.delete(itemKey);
    else this.pending.set(itemKey, remaining);
    this.render();
  }

  /** "Vender": a única hora em que a bolsa e as moedas mudam. Revalida contra o estoque real (não confia só no que a tela mostrava). */
  private sell(): void {
    if (!this.isOpen_) return;
    let coins = 0;
    let items = 0;
    for (const [itemKey, amount] of this.pending) {
      const item = this.findSellable(itemKey);
      if (!item) continue;
      const sold = item.take(this.inventory, amount);
      coins += sold * item.price;
      items += sold;
    }
    coins = applySellBonus(coins);
    this.pending.clear();
    if (items <= 0) {
      this.render();
      return;
    }

    playEffect(this.scene, SPEND_MONEY_SOUND); // Vender toca o mesmo som de comprar (pedido explícito).
    this.inventory.addCoins(coins);
    console.log(`Vendido: ${items} ite${items === 1 ? 'm' : 'ns'} por ${coins} moedas (saldo: ${this.inventory.getCoins()}).`);
    this.onSold(coins, items);
    this.render();
  }

  private showDefaultInfo(): void {
    this.infoText.setText('Clique: 1 unidade  •  Shift+clique ou botão direito: todas');
  }

  /** Redesenha os dois grids e o total a partir do `Inventory` + `pending`. */
  private render(): void {
    const fill = (slots: BinSlot[], entries: Array<{ itemKey: string; amount: number }>): void => {
      slots.forEach((slot, index) => {
        const entry = entries[index];
        slot.itemKey = entry?.itemKey ?? '';
        slot.icon.setVisible(this.isOpen_ && !!entry);
        slot.countText.setVisible(this.isOpen_ && !!entry);
        if (this.isOpen_ && entry) slot.frame.setInteractive();
        else slot.frame.disableInteractive();
        if (!entry) return;

        const item = this.findSellable(entry.itemKey)!;
        slot.icon.setTexture(item.textureKey, item.iconFrame);
        slot.icon.setScale(computeFitScale(slot.icon, ICON_TARGET_PX));
        slot.countText.setText(String(entry.amount));
      });
    };

    fill(
      this.binSlots,
      this.sellables.filter((item) => (this.pending.get(item.key) ?? 0) > 0).map((item) => ({ itemKey: item.key, amount: this.pending.get(item.key)! })),
    );
    fill(
      this.bagSlots,
      this.sellables
        .map((item) => ({ itemKey: item.key, amount: item.count(this.inventory) - (this.pending.get(item.key) ?? 0) }))
        .filter((entry) => entry.amount > 0),
    );

    const { coins, items } = this.pendingTotal();
    this.totalText.setText(items > 0 ? `Total: ${coins} moedas (${items} ite${items === 1 ? 'm' : 'ns'})` : 'A caixa está vazia');
    this.showDefaultInfo();

    const canSell = items > 0;
    this.sellButton.setTint(canSell ? 0xffffff : BUTTON_DISABLED_TINT);
    this.sellLabel.setAlpha(canSell ? 1 : 0.6);
    if (this.isOpen_ && canSell) this.sellButton.setInteractive();
    else this.sellButton.disableInteractive();

    this.setVisible(true);
  }

  private setVisible(visible: boolean): void {
    for (const object of [this.panel, this.title, this.binLabel, this.bagLabel, this.infoText, this.totalText, this.sellButton, this.sellLabel, this.closeButton, this.closeLabel]) {
      object.setVisible(visible);
    }
    if (visible) this.closeButton.setInteractive();
    else this.closeButton.disableInteractive();

    for (const slot of [...this.binSlots, ...this.bagSlots]) {
      slot.frame.setVisible(visible);
      slot.icon.setVisible(visible && !!slot.itemKey);
      slot.countText.setVisible(visible && !!slot.itemKey);
      if (!visible) slot.frame.disableInteractive();
    }
    if (!visible) this.sellButton.disableInteractive();
  }
}
