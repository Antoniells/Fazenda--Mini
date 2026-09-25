import Phaser from 'phaser';
import { playClick } from '../systems/soundEffects';
import { Inventory } from '../systems/inventory';
import { ChestSlot, CHEST_SLOT_COUNT, getChestSlots, isChestEmpty, depositToChest, withdrawFromChest, TransferResult } from '../systems/chestStorage';
import { resolveSlotVisual, SlotRef } from '../data/items';
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
const PANEL_HEIGHT = 448;
const DEPTH = 3000;

const SLOT_SCALE = 1.7;
const SLOT_GAP = 6;
const GRID_COLS = 8;
const GRID_ROWS = CHEST_SLOT_COUNT / GRID_COLS;
const ICON_TARGET_PX = 16 * SLOT_SCALE * 0.8;

const FONT = '"Courier New", Courier, monospace';
const TEXT_INK = '#4a3524';
const TEXT_SOFT = '#6b5a4a';
const TEXT_WARN = '#a8321f';
const BUTTON_WIDTH = 132;
const BUTTON_HEIGHT = 32;
const BUTTON_DISABLED_TINT = 0x8f8f8f;
/** Quanto tempo (ms) o aviso de uma transferência recusada fica na linha de informação. */
const FLASH_MS = 1800;

const FAILURE_MESSAGES: Record<NonNullable<TransferResult['reason']>, string> = {
  'chest-full': 'O baú está cheio.',
  'bag-full': 'Sua bolsa está cheia.',
  'not-allowed': 'Você já tem uma ferramenta dessa família na bolsa.',
  nothing: '',
};

/** Uma célula de um dos dois grids: moldura clicável + ícone + quantidade. */
interface GridSlot {
  ref: SlotRef | null;
  frame: Phaser.GameObjects.Image;
  icon: Phaser.GameObjects.Image;
  countText: Phaser.GameObjects.Text;
}

/**
 * Tela do Baú (interface simples de transferência): em cima o que está **no baú**, embaixo a **sua bolsa** — o mesmo
 * jeito da Caixa de Remessas (`ShippingBinMenu`): clique num item da bolsa guarda 1 unidade no baú (Shift+clique ou
 * botão direito: a pilha toda), clique num item do baú devolve pra bolsa. Diferente da Caixa, aqui a transferência é
 * IMEDIATA (`systems/chestStorage.ts` move de verdade, sem "confirmar"): fechar a tela não desfaz nada. "Recolher"
 * pega o móvel de volta (só com o baú vazio — nada se perde junto com ele).
 *
 * Vive na `UIScene` (câmera própria, sem o zoom da casa) e é aberta por evento (`OPEN_CHEST_MENU_EVENT`). Puramente
 * visual e de clique: quem move os itens é `chestStorage`/`Inventory`.
 */
export class ChestMenu {
  private readonly panel: Phaser.GameObjects.NineSlice;
  private readonly title: Phaser.GameObjects.Text;
  private readonly chestLabel: Phaser.GameObjects.Text;
  private readonly bagLabel: Phaser.GameObjects.Text;
  private readonly infoText: Phaser.GameObjects.Text;
  private readonly chestSlots: GridSlot[] = [];
  private readonly bagSlots: GridSlot[] = [];
  private readonly pickUpButton: Phaser.GameObjects.NineSlice;
  private readonly pickUpLabel: Phaser.GameObjects.Text;
  private readonly closeButton: Phaser.GameObjects.NineSlice;
  private readonly closeLabel: Phaser.GameObjects.Text;

  private isOpen_ = false;
  private chestId = '';
  private onPickUp: (() => void) | null = null;
  private lastSignature = '';
  private flash: { text: string; until: number } | null = null;
  private hoverText = '';

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly inventory: () => Inventory,
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

    const makeText = (x: number, y: number, text: string, size: number, color: string, bold = false): Phaser.GameObjects.Text => {
      const label = scene.add.text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: bold ? 'bold' : 'normal', color });
      label.setOrigin(0.5, 0.5);
      label.setScrollFactor(0);
      label.setDepth(DEPTH + 2);
      return label;
    };

    const slotWidth = INVENTORY_SLOT_RECT.width * SLOT_SCALE;
    const slotHeight = INVENTORY_SLOT_RECT.height * SLOT_SCALE;
    const gridWidth = GRID_COLS * slotWidth + (GRID_COLS - 1) * SLOT_GAP;
    const gridHeight = GRID_ROWS * slotHeight + (GRID_ROWS - 1) * SLOT_GAP;
    const startX = cx - gridWidth / 2 + slotWidth / 2;

    this.title = makeText(cx, top + 32, 'Baú', 18, TEXT_INK, true);
    this.chestLabel = makeText(cx, top + 58, 'No baú (clique para pegar)', 11, TEXT_SOFT);
    const chestTop = top + 82 + slotHeight / 2;
    const bagLabelY = chestTop + gridHeight - slotHeight / 2 + 22;
    this.bagLabel = makeText(cx, bagLabelY, 'Sua bolsa (clique para guardar)', 11, TEXT_SOFT);
    const bagTop = bagLabelY + 22 + slotHeight / 2;

    const buildGrid = (rowsTop: number, slots: GridSlot[], onClick: (ref: SlotRef, all: boolean) => void): void => {
      for (let index = 0; index < CHEST_SLOT_COUNT; index++) {
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

        const slot: GridSlot = { ref: null, frame, icon, countText };
        slots.push(slot);

        frame.on('pointerdown', (pointer: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
          if (!this.isOpen_) return;
          event.stopPropagation();
          if (!slot.ref) return;
          playClick(scene);
          // Shift+clique ou botão direito: a pilha toda; clique normal: 1 unidade (igual à Caixa de Remessas).
          onClick(slot.ref, pointer.rightButtonDown() || !!pointer.event?.shiftKey);
        });
        frame.on('pointerover', () => {
          if (!slot.ref) return;
          const visual = resolveSlotVisual(slot.ref);
          this.hoverText = visual ? `${visual.name}${slot.countText.text ? ` x${slot.countText.text}` : ''}` : '';
          this.renderInfo();
        });
        frame.on('pointerout', () => {
          this.hoverText = '';
          this.renderInfo();
        });
      }
    };

    buildGrid(chestTop, this.chestSlots, (ref, all) => this.transfer('withdraw', ref, all));
    buildGrid(bagTop, this.bagSlots, (ref, all) => this.transfer('deposit', ref, all));

    const infoY = bagTop + gridHeight - slotHeight / 2 + 22;
    this.infoText = makeText(cx, infoY, '', 11, TEXT_SOFT);

    const buttonsY = top + PANEL_HEIGHT - 40;
    const makeButton = (x: number, label: string, onClick: () => void): { button: Phaser.GameObjects.NineSlice; text: Phaser.GameObjects.Text } => {
      const button = scene.add.nineslice(
        x,
        buttonsY,
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
      return { button, text: makeText(x, buttonsY, label, 14, TEXT_INK, true) };
    };

    const pickUp = makeButton(cx - BUTTON_WIDTH / 2 - 10, 'Recolher', () => this.pickUp());
    this.pickUpButton = pickUp.button;
    this.pickUpLabel = pickUp.text;
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

  /** Abre o baú `chestId`. `onPickUp` recolhe o móvel (quem chama — a `HouseScene` — devolve ao estoque e o tira do mundo). */
  open(chestId: string, onPickUp: () => void): void {
    this.isOpen_ = true;
    this.chestId = chestId;
    this.onPickUp = onPickUp;
    this.lastSignature = '';
    this.flash = null;
    this.hoverText = '';
    this.refresh();
  }

  close(): void {
    this.isOpen_ = false;
    this.onPickUp = null;
    this.setVisible(false);
  }

  /** Redesenha só quando algo mudou (a `UIScene` chama todo frame — reconfigurar a interatividade dos slots a cada frame atrapalharia o hover). */
  refresh(): void {
    if (!this.isOpen_) return;

    const chestEntries = getChestSlots(this.chestId).map((slot) => ({ ref: { category: slot.category, id: slot.id } as SlotRef, amount: slot.amount }));
    const bagEntries = this.inventory().getBagStacks();
    const signature = JSON.stringify([chestEntries, bagEntries]);
    if (signature !== this.lastSignature) {
      this.lastSignature = signature;
      this.fill(this.chestSlots, chestEntries);
      this.fill(this.bagSlots, bagEntries);
      this.updatePickUpButton();
      this.setVisible(true);
    }
    this.renderInfo();
  }

  private fill(slots: GridSlot[], entries: Array<{ ref: SlotRef; amount: number }>): void {
    slots.forEach((slot, index) => {
      const entry = entries[index];
      slot.ref = entry?.ref ?? null;
      slot.icon.setVisible(!!entry);
      slot.countText.setVisible(!!entry);
      if (entry) slot.frame.setInteractive();
      else slot.frame.disableInteractive();
      if (!entry) return;

      const visual = resolveSlotVisual(entry.ref);
      if (visual) {
        slot.icon.setTexture(visual.textureKey, visual.iconFrame);
        slot.icon.setScale(computeFitScale(slot.icon, ICON_TARGET_PX));
      }
      // Ferramenta/armadura é uma pilha de 1: não mostra "1".
      slot.countText.setText(entry.amount > 1 ? String(entry.amount) : '');
    });
  }

  private transfer(direction: 'deposit' | 'withdraw', ref: SlotRef, all: boolean): void {
    const inventory = this.inventory();
    const amount = all ? Number.MAX_SAFE_INTEGER : 1;
    const result =
      direction === 'deposit' ? depositToChest(inventory, this.chestId, ref, amount) : withdrawFromChest(inventory, this.chestId, ref, amount);
    if (result.moved <= 0 && result.reason && FAILURE_MESSAGES[result.reason]) {
      this.flash = { text: FAILURE_MESSAGES[result.reason], until: this.scene.time.now + FLASH_MS };
    }
    this.refresh();
  }

  private pickUp(): void {
    if (!isChestEmpty(this.chestId)) {
      this.flash = { text: 'Esvazie o baú antes de recolher.', until: this.scene.time.now + FLASH_MS };
      this.renderInfo();
      return;
    }
    playClick(this.scene);
    const callback = this.onPickUp;
    this.close();
    callback?.();
  }

  private updatePickUpButton(): void {
    const empty = isChestEmpty(this.chestId);
    this.pickUpButton.setTint(empty ? 0xffffff : BUTTON_DISABLED_TINT);
    this.pickUpLabel.setAlpha(empty ? 1 : 0.6);
  }

  private renderInfo(): void {
    const now = this.scene.time.now;
    if (this.flash && now < this.flash.until) {
      this.infoText.setColor(TEXT_WARN);
      this.infoText.setText(this.flash.text);
      return;
    }
    this.infoText.setColor(TEXT_SOFT);
    this.infoText.setText(this.hoverText || 'Clique: 1 unidade  •  Shift+clique ou botão direito: todas');
  }

  private setVisible(visible: boolean): void {
    for (const object of [this.panel, this.title, this.chestLabel, this.bagLabel, this.infoText, this.pickUpButton, this.pickUpLabel, this.closeButton, this.closeLabel]) {
      object.setVisible(visible);
    }
    // O botão "Recolher" fica sempre clicável (avisa se o baú não estiver vazio); só o visual esmaece.
    if (visible) {
      this.pickUpButton.setInteractive();
      this.closeButton.setInteractive();
    } else {
      this.pickUpButton.disableInteractive();
      this.closeButton.disableInteractive();
    }

    for (const slot of [...this.chestSlots, ...this.bagSlots]) {
      slot.frame.setVisible(visible);
      slot.icon.setVisible(visible && !!slot.ref);
      slot.countText.setVisible(visible && !!slot.ref);
      if (!visible) slot.frame.disableInteractive();
    }
  }
}

export type { ChestSlot };
