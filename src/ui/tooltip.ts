import Phaser from 'phaser';
import { INVENTORY_PANEL_KEY, INVENTORY_PANEL_FRAME_NAME, INVENTORY_PANEL_RECT, INVENTORY_PANEL_BORDER } from '../data/ui';

/** Acima do Livro do Inventário (3000-3500) e de qualquer outro menu da `UIScene`. */
const TOOLTIP_DEPTH = 6000;
/** Distância (px) entre o ponteiro e o canto do balão — longe o bastante pra não ficar por baixo do próprio cursor. */
const POINTER_OFFSET_X = 16;
const POINTER_OFFSET_Y = 20;
/** Folga (px) entre o texto e a moldura do painel, além da borda de `INVENTORY_PANEL_BORDER`. */
const PADDING_X = 4;
const PADDING_Y = 0;
const TEXT_INK = '#3b2a14';

/**
 * Balão de dica (Tooltip): um painel do próprio jogo (o mesmo creme dos
 * menus, `NineSlice` que cresce com o texto) + um texto, sempre INVISÍVEIS
 * até alguém chamar `show`. Quem usa (slots do Inventário/Hotbar) liga:
 * `pointerover` → `show`, `pointermove` → `follow`, `pointerout` → `hide` —
 * o balão só existe enquanto o ponteiro está em cima de um item e acompanha
 * o ponteiro; nunca intercepta cliques (não é interativo).
 *
 * Uma instância só, criada pela `UIScene` e compartilhada.
 */
export class Tooltip {
  private readonly scene: Phaser.Scene;
  private readonly panel: Phaser.GameObjects.NineSlice;
  private readonly label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    const texture = scene.textures.get(INVENTORY_PANEL_KEY);
    if (!texture.has(INVENTORY_PANEL_FRAME_NAME)) {
      texture.add(INVENTORY_PANEL_FRAME_NAME, 0, INVENTORY_PANEL_RECT.x, INVENTORY_PANEL_RECT.y, INVENTORY_PANEL_RECT.width, INVENTORY_PANEL_RECT.height);
    }

    this.panel = scene.add.nineslice(
      0,
      0,
      INVENTORY_PANEL_KEY,
      INVENTORY_PANEL_FRAME_NAME,
      INVENTORY_PANEL_BORDER * 2,
      INVENTORY_PANEL_BORDER * 2,
      INVENTORY_PANEL_BORDER,
      INVENTORY_PANEL_BORDER,
      INVENTORY_PANEL_BORDER,
      INVENTORY_PANEL_BORDER,
    );
    this.panel.setOrigin(0, 0);
    this.panel.setScrollFactor(0);
    this.panel.setDepth(TOOLTIP_DEPTH);

    this.label = scene.add.text(0, 0, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      fontStyle: 'bold',
      color: TEXT_INK,
    });
    this.label.setOrigin(0, 0);
    this.label.setScrollFactor(0);
    this.label.setDepth(TOOLTIP_DEPTH + 1);

    this.hide();
  }

  /** Mostra o balão com `text` junto do ponteiro. Texto vazio esconde. */
  show(text: string, pointer: Phaser.Input.Pointer): void {
    if (!text) {
      this.hide();
      return;
    }
    this.label.setText(text);
    this.panel.setSize(this.label.width + (INVENTORY_PANEL_BORDER + PADDING_X) * 2, this.label.height + (INVENTORY_PANEL_BORDER + PADDING_Y) * 2);
    this.panel.setVisible(true);
    this.label.setVisible(true);
    this.follow(pointer);
  }

  /** Reposiciona junto do ponteiro (canto inferior direito dele) — vira pra esquerda/cima quando não cabe na tela. */
  follow(pointer: Phaser.Input.Pointer): void {
    const width = this.panel.width;
    const height = this.panel.height;

    let x = pointer.x + POINTER_OFFSET_X;
    let y = pointer.y + POINTER_OFFSET_Y;
    if (x + width > this.scene.scale.width) x = pointer.x - POINTER_OFFSET_X - width;
    if (y + height > this.scene.scale.height) y = pointer.y - POINTER_OFFSET_Y / 2 - height;

    this.panel.setPosition(Math.max(0, x), Math.max(0, y));
    this.label.setPosition(this.panel.x + INVENTORY_PANEL_BORDER + PADDING_X, this.panel.y + INVENTORY_PANEL_BORDER + PADDING_Y);
  }

  hide(): void {
    this.panel.setVisible(false);
    this.label.setVisible(false);
  }

  isVisible(): boolean {
    return this.panel.visible;
  }
}
