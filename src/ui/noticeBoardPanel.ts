import Phaser from 'phaser';
import { playClick } from '../systems/soundEffects';
import {
  INVENTORY_PANEL_KEY,
  INVENTORY_PANEL_FRAME_NAME,
  INVENTORY_PANEL_RECT,
  INVENTORY_PANEL_BORDER,
  INVENTORY_LARGE_PANEL_KEY,
  INVENTORY_LARGE_PANEL_FRAME_NAME,
  INVENTORY_LARGE_PANEL_RECT,
  INVENTORY_LARGE_PANEL_BORDER,
  INVENTORY_SLOT_FRAME_NAME,
  INVENTORY_SLOT_RECT,
} from '../data/ui';
import { SEASON_LENGTH_DAYS } from '../data/seasons';
import type { VillageCalendar } from '../systems/villageCalendar';

const PANEL_WIDTH = 600;
const PANEL_HEIGHT = 440;
const DEPTH = 3500;
const FONT = '"Courier New", Courier, monospace';
const TEXT_INK = '#4a3524';
/** A cor do número de um dia com acontecimento (e do texto "hoje"). */
const EVENT_INK = '#a3341f';
const TODAY_TINT = 0xffe3a0;
const BUTTON_WIDTH = 150;
const BUTTON_HEIGHT = 36;
/** As células do calendário: a moldura de slot do caderno, numa grade de 5 colunas. */
const CALENDAR_COLS = 5;
const CELL_SCALE = 3;
const CELL_GAP = 10;

/**
 * O QUADRO DO MURAL do Vilarejo (modal, na `UIScene`, aberto por `OPEN_NOTICE_BOARD_EVENT`): o papel de sempre com o calendário da
 * estação (uma célula por dia, com a moldura dos slots do caderno; hoje em destaque, os dias com acontecimento com o número vermelho)
 * e a lista dos próximos acontecimentos. Fecha no botão ou no Esc. Só mostra — o conteúdo vem pronto de `villageCalendar`.
 */
export class NoticeBoardPanel {
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly panel: Phaser.GameObjects.NineSlice;
  private readonly title: Phaser.GameObjects.Text;
  private readonly cells: Array<{ frame: Phaser.GameObjects.Image; number: Phaser.GameObjects.Text }> = [];
  private readonly upcoming: Phaser.GameObjects.Text;
  private readonly button: Phaser.GameObjects.NineSlice;
  private isOpen_ = false;

  constructor(private readonly scene: Phaser.Scene) {
    const register = (key: string, name: string, rect: { x: number; y: number; width: number; height: number }): void => {
      const texture = scene.textures.get(key);
      if (!texture.has(name)) texture.add(name, 0, rect.x, rect.y, rect.width, rect.height);
    };
    register(INVENTORY_PANEL_KEY, INVENTORY_PANEL_FRAME_NAME, INVENTORY_PANEL_RECT);
    register(INVENTORY_PANEL_KEY, INVENTORY_SLOT_FRAME_NAME, INVENTORY_SLOT_RECT);
    register(INVENTORY_LARGE_PANEL_KEY, INVENTORY_LARGE_PANEL_FRAME_NAME, INVENTORY_LARGE_PANEL_RECT);

    const cx = scene.scale.width / 2;
    const cy = scene.scale.height / 2;
    const top = cy - PANEL_HEIGHT / 2;
    const add = <T extends Phaser.GameObjects.GameObject>(object: T): T => {
      this.objects.push(object);
      return object;
    };

    this.panel = add(
      scene.add.nineslice(cx, cy, INVENTORY_LARGE_PANEL_KEY, INVENTORY_LARGE_PANEL_FRAME_NAME, PANEL_WIDTH, PANEL_HEIGHT, INVENTORY_LARGE_PANEL_BORDER, INVENTORY_LARGE_PANEL_BORDER, INVENTORY_LARGE_PANEL_BORDER, INVENTORY_LARGE_PANEL_BORDER),
    );
    this.panel.setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(DEPTH);

    add(scene.add.text(cx, top + 30, 'Mural do Vilarejo', { fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: TEXT_INK }))
      .setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(DEPTH + 1);
    this.title = add(scene.add.text(cx, top + 56, '', { fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: TEXT_INK }));
    this.title.setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(DEPTH + 1);

    // O calendário: os dias da estação em linhas de 5 células.
    const cellSize = INVENTORY_SLOT_RECT.width * CELL_SCALE;
    const rowWidth = CALENDAR_COLS * cellSize + (CALENDAR_COLS - 1) * CELL_GAP;
    const gridTop = top + 80;
    for (let index = 0; index < SEASON_LENGTH_DAYS; index++) {
      const x = cx - rowWidth / 2 + cellSize / 2 + (index % CALENDAR_COLS) * (cellSize + CELL_GAP);
      const y = gridTop + cellSize / 2 + Math.floor(index / CALENDAR_COLS) * (cellSize + CELL_GAP);
      const frame = add(scene.add.image(x, y, INVENTORY_PANEL_KEY, INVENTORY_SLOT_FRAME_NAME)).setScale(CELL_SCALE).setScrollFactor(0).setDepth(DEPTH + 1);
      const number = add(scene.add.text(x, y, '', { fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: TEXT_INK }))
        .setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(DEPTH + 2);
      this.cells.push({ frame, number });
    }

    const rows = Math.ceil(SEASON_LENGTH_DAYS / CALENDAR_COLS);
    const listTop = gridTop + rows * cellSize + (rows - 1) * CELL_GAP + 18;
    this.upcoming = add(scene.add.text(cx - PANEL_WIDTH / 2 + 48, listTop, '', { fontFamily: FONT, fontSize: '13px', color: TEXT_INK, lineSpacing: 5, wordWrap: { width: PANEL_WIDTH - 96 } }));
    this.upcoming.setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH + 1);

    const buttonY = top + PANEL_HEIGHT - 40;
    this.button = add(
      scene.add.nineslice(cx, buttonY, INVENTORY_PANEL_KEY, INVENTORY_PANEL_FRAME_NAME, BUTTON_WIDTH, BUTTON_HEIGHT, INVENTORY_PANEL_BORDER, INVENTORY_PANEL_BORDER, INVENTORY_PANEL_BORDER, INVENTORY_PANEL_BORDER),
    );
    this.button.setScrollFactor(0).setDepth(DEPTH + 1);
    this.button.on('pointerover', () => this.button.setAlpha(0.85));
    this.button.on('pointerout', () => this.button.setAlpha(1));
    this.button.on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
      if (!this.isOpen_) return;
      event.stopPropagation();
      playClick(this.scene);
      this.close();
    });
    add(scene.add.text(cx, buttonY, 'Fechar', { fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: TEXT_INK }))
      .setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(DEPTH + 2);

    this.setVisible(false);
  }

  isOpen(): boolean {
    return this.isOpen_;
  }

  open(calendar: VillageCalendar): void {
    this.title.setText(calendar.title);
    calendar.days.forEach((day, index) => {
      const cell = this.cells[index];
      if (!cell) return;
      cell.number.setText(String(day.seasonDay)).setColor(day.events.length > 0 ? EVENT_INK : TEXT_INK);
      if (day.isToday) cell.frame.setTint(TODAY_TINT);
      else cell.frame.clearTint();
    });
    const lines = calendar.upcoming.map(({ when, text }) => `• ${when}: ${text}`);
    this.upcoming.setText(['Próximos acontecimentos (número vermelho = dia com evento):', ...lines].join('\n'));
    this.isOpen_ = true;
    this.setVisible(true);
  }

  close(): void {
    this.isOpen_ = false;
    this.setVisible(false);
  }

  private setVisible(visible: boolean): void {
    for (const object of this.objects) (object as unknown as Phaser.GameObjects.Components.Visible).setVisible(visible);
    if (visible) {
      this.panel.setInteractive(); // Um clique no papel não "vaza" pro mundo por baixo.
      this.button.setInteractive({ useHandCursor: true });
    } else {
      this.panel.disableInteractive();
      this.button.disableInteractive();
    }
  }
}
