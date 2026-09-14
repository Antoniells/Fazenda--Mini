import Phaser from 'phaser';
import { INVENTORY_PANEL_KEY, INVENTORY_PANEL_FRAME_NAME, INVENTORY_PANEL_RECT, INVENTORY_PANEL_BORDER } from '../data/ui';

const PANEL_WIDTH = 280;
const PANEL_HEIGHT = 84;
/** Fica perto do topo, não no centro (evita cobrir o personagem/o próprio obstáculo que disparou a mensagem). */
const PANEL_TOP_MARGIN = 70;
const AUTO_HIDE_MS = 3200;
const TEXT_FONT = '"Courier New", Courier, monospace';
const TITLE_COLOR = '#ffb3b3';
const BODY_COLOR = '#ffe9b3';
const TEXT_STROKE = '#2b1d0e';

/**
 * Aviso genérico de "bloqueado" (Sistema de Cenas — pontes): reaproveita o
 * mesmo painel ornamentado do `PauseMenu`/Inventário (`INVENTORY_PANEL_*`),
 * só que no topo da tela, com duas linhas de texto (título + requisito) e
 * some sozinho depois de `AUTO_HIDE_MS` — não precisa de um botão de
 * fechar, já que não bloqueia interação com o resto do jogo por trás dele.
 *
 * Escrito de forma genérica (`show(title, body)`) de propósito: hoje só a
 * ponte usa, mas qualquer outro sistema que precise avisar "faltam X" no
 * futuro pode reaproveitar em vez de duplicar um painel de texto novo.
 */
export class LockedMessage {
  private readonly panel: Phaser.GameObjects.NineSlice;
  private readonly title: Phaser.GameObjects.Text;
  private readonly body: Phaser.GameObjects.Text;
  private hideEvent: Phaser.Time.TimerEvent | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    const texture = scene.textures.get(INVENTORY_PANEL_KEY);
    if (!texture.has(INVENTORY_PANEL_FRAME_NAME)) {
      texture.add(
        INVENTORY_PANEL_FRAME_NAME,
        0,
        INVENTORY_PANEL_RECT.x,
        INVENTORY_PANEL_RECT.y,
        INVENTORY_PANEL_RECT.width,
        INVENTORY_PANEL_RECT.height,
      );
    }

    const centerX = scene.scale.width / 2;
    const centerY = PANEL_TOP_MARGIN;

    this.panel = scene.add.nineslice(
      centerX,
      centerY,
      INVENTORY_PANEL_KEY,
      INVENTORY_PANEL_FRAME_NAME,
      PANEL_WIDTH,
      PANEL_HEIGHT,
      INVENTORY_PANEL_BORDER,
      INVENTORY_PANEL_BORDER,
      INVENTORY_PANEL_BORDER,
      INVENTORY_PANEL_BORDER,
    );
    this.panel.setOrigin(0.5, 0.5);
    this.panel.setScrollFactor(0);
    this.panel.setDepth(4500);

    this.title = scene.add.text(centerX, centerY - 16, '', {
      fontFamily: TEXT_FONT,
      fontSize: '13px',
      fontStyle: 'bold',
      color: TITLE_COLOR,
      stroke: TEXT_STROKE,
      strokeThickness: 3,
      align: 'center',
    });
    this.title.setOrigin(0.5, 0.5);
    this.title.setScrollFactor(0);
    this.title.setDepth(4501);

    this.body = scene.add.text(centerX, centerY + 10, '', {
      fontFamily: TEXT_FONT,
      fontSize: '11px',
      fontStyle: 'bold',
      color: BODY_COLOR,
      stroke: TEXT_STROKE,
      strokeThickness: 2,
      align: 'center',
      wordWrap: { width: PANEL_WIDTH - 24 },
    });
    this.body.setOrigin(0.5, 0.5);
    this.body.setScrollFactor(0);
    this.body.setDepth(4501);

    this.setVisible(false);
  }

  /** Mostra a mensagem e agenda o próprio sumiço — chamar de novo (ex.: outra ponte bloqueada) reinicia o tempo. */
  show(title: string, body: string): void {
    this.title.setText(title);
    this.body.setText(body);
    this.setVisible(true);

    this.hideEvent?.remove(false);
    this.hideEvent = this.scene.time.delayedCall(AUTO_HIDE_MS, () => this.setVisible(false));
  }

  private setVisible(visible: boolean): void {
    this.panel.setVisible(visible);
    this.title.setVisible(visible);
    this.body.setVisible(visible);
  }
}
