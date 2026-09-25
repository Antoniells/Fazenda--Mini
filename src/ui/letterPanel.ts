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
  HEALTH_HEARTS_KEY,
  HEART_FULL_FRAME,
} from '../data/ui';

const PANEL_WIDTH = 560;
const PANEL_HEIGHT = 396;
const DEPTH = 3500;
const FONT = '"Courier New", Courier, monospace';
const TEXT_INK = '#4a3524';
const BUTTON_WIDTH = 170;
const BUTTON_HEIGHT = 36;
const TEXT_PADDING_X = 44;

/**
 * Painel de carta/mensagem (modal): título, texto corrido com quebra de linha, um coração opcional no fim e UM botão que
 * "termina a leitura". Só fecha pelo botão (Esc não vale) — o evento do pet só desbloqueia depois que o jogador leu até o fim
 * (`onRead`). Usa o mesmo painel/botão de papel do resto da UI. Vive na `UIScene` (câmera própria) e é aberto por evento
 * (`OPEN_LETTER_EVENT`, `systems/petBox.ts`). Puramente visual: quem decide o que acontece depois da leitura é o `onRead`.
 */
export class LetterPanel {
  private readonly panel: Phaser.GameObjects.NineSlice;
  private readonly title: Phaser.GameObjects.Text;
  private readonly body: Phaser.GameObjects.Text;
  private readonly heart: Phaser.GameObjects.Image;
  private readonly button: Phaser.GameObjects.NineSlice;
  private readonly buttonLabel: Phaser.GameObjects.Text;
  private isOpen_ = false;
  private onRead: (() => void) | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    const panelTexture = scene.textures.get(INVENTORY_PANEL_KEY);
    if (!panelTexture.has(INVENTORY_PANEL_FRAME_NAME)) {
      const rect = INVENTORY_PANEL_RECT;
      panelTexture.add(INVENTORY_PANEL_FRAME_NAME, 0, rect.x, rect.y, rect.width, rect.height);
    }
    const largeTexture = scene.textures.get(INVENTORY_LARGE_PANEL_KEY);
    if (!largeTexture.has(INVENTORY_LARGE_PANEL_FRAME_NAME)) {
      const rect = INVENTORY_LARGE_PANEL_RECT;
      largeTexture.add(INVENTORY_LARGE_PANEL_FRAME_NAME, 0, rect.x, rect.y, rect.width, rect.height);
    }
    const heartTexture = scene.textures.get(HEALTH_HEARTS_KEY);
    if (!heartTexture.has(HEART_FULL_FRAME.name)) {
      const { x, y, width, height } = HEART_FULL_FRAME.rect;
      heartTexture.add(HEART_FULL_FRAME.name, 0, x, y, width, height);
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
    this.panel.setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(DEPTH);
    // Um clique no papel não pode "vazar" pro mundo por baixo.
    this.panel.setInteractive();

    this.title = scene.add.text(cx, top + 34, '', { fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: TEXT_INK });
    this.title.setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(DEPTH + 1);

    this.body = scene.add.text(cx - PANEL_WIDTH / 2 + TEXT_PADDING_X, top + 66, '', {
      fontFamily: FONT,
      fontSize: '14px',
      color: TEXT_INK,
      lineSpacing: 5,
      wordWrap: { width: PANEL_WIDTH - TEXT_PADDING_X * 2 },
    });
    this.body.setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH + 1);

    this.heart = scene.add.image(cx, top + PANEL_HEIGHT - 92, HEALTH_HEARTS_KEY, HEART_FULL_FRAME.name);
    this.heart.setScale(2.5).setScrollFactor(0).setDepth(DEPTH + 1);

    const buttonY = top + PANEL_HEIGHT - 44;
    this.button = scene.add.nineslice(
      cx,
      buttonY,
      INVENTORY_PANEL_KEY,
      INVENTORY_PANEL_FRAME_NAME,
      BUTTON_WIDTH,
      BUTTON_HEIGHT,
      INVENTORY_PANEL_BORDER,
      INVENTORY_PANEL_BORDER,
      INVENTORY_PANEL_BORDER,
      INVENTORY_PANEL_BORDER,
    );
    this.button.setScrollFactor(0).setDepth(DEPTH + 1);
    this.button.on('pointerover', () => this.button.setAlpha(0.85));
    this.button.on('pointerout', () => this.button.setAlpha(1));
    this.button.on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
      if (!this.isOpen_) return;
      event.stopPropagation();
      this.finish();
    });
    this.buttonLabel = scene.add.text(cx, buttonY, '', { fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: TEXT_INK });
    this.buttonLabel.setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(DEPTH + 2);

    this.setVisible(false);
  }

  isOpen(): boolean {
    return this.isOpen_;
  }

  open(title: string, body: string, buttonLabel: string, showHeart: boolean, onRead: () => void): void {
    this.isOpen_ = true;
    this.onRead = onRead;
    this.title.setText(title);
    this.body.setText(body);
    this.buttonLabel.setText(buttonLabel);
    this.heart.setVisible(showHeart);
    this.setVisible(true, showHeart);
  }

  /** Terminou a leitura: fecha e avisa (uma única vez). */
  private finish(): void {
    playClick(this.scene);
    const callback = this.onRead;
    this.isOpen_ = false;
    this.onRead = null;
    this.setVisible(false);
    callback?.();
  }

  private setVisible(visible: boolean, showHeart = false): void {
    for (const object of [this.panel, this.title, this.body, this.button, this.buttonLabel]) object.setVisible(visible);
    this.heart.setVisible(visible && showHeart);
    if (visible) {
      this.panel.setInteractive();
      this.button.setInteractive({ useHandCursor: true });
    } else {
      this.panel.disableInteractive();
      this.button.disableInteractive();
    }
  }
}
