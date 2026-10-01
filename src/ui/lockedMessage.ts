import Phaser from 'phaser';
import { INVENTORY_PANEL_KEY, INVENTORY_PANEL_FRAME_NAME, INVENTORY_PANEL_RECT, INVENTORY_PANEL_BORDER } from '../data/ui';

const PANEL_WIDTH = 280;
const PANEL_HEIGHT = 84;
/** Fica perto do topo, não no centro (evita cobrir o personagem/o próprio obstáculo que disparou a mensagem). */
const PANEL_TOP_MARGIN = 70;
const AUTO_HIDE_MS = 3200;
/** Com outro aviso esperando na fila, o da tela fica pelo menos isto (ms) e então dá a vez. */
const MIN_SHOW_WHEN_QUEUED_MS = 1600;
/** Intervalo entre um aviso e o próximo da fila (o painel "pisca", pra se notar que é outro). */
const QUEUE_GAP_MS = 180;
/** Avisos esperando no máximo (os mais antigos saem se lotar). */
const MAX_QUEUE = 4;
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
 *
 * FILA: um aviso novo não apaga o que está na tela — espera a vez (o da tela fica ao menos `MIN_SHOW_WHEN_QUEUED_MS` e sai). O mesmo
 * aviso repetido (já na tela ou já na fila) não se acumula: na tela, só renova o tempo.
 */
export class LockedMessage {
  private readonly panel: Phaser.GameObjects.NineSlice;
  private readonly title: Phaser.GameObjects.Text;
  private readonly body: Phaser.GameObjects.Text;
  private hideEvent: Phaser.Time.TimerEvent | null = null;
  private readonly queue: Array<{ title: string; body: string }> = [];
  /** O aviso na tela (`null` = nenhum) e quando apareceu. */
  private current: { title: string; body: string } | null = null;
  private shownAt = 0;
  /** O aviso da vez já está na tela (`false` no intervalo entre dois da fila). */
  private revealed = false;

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

  /** Mostra o aviso (ou o põe na fila, se outro estiver na tela). O mesmo aviso de novo só renova o tempo. */
  show(title: string, body: string): void {
    const same = (message: { title: string; body: string } | null): boolean => !!message && message.title === title && message.body === body;
    if (same(this.current)) {
      if (this.revealed && this.queue.length === 0) this.scheduleHide(AUTO_HIDE_MS);
      return;
    }
    if (this.queue.some(same)) return;
    if (!this.current) {
      this.display({ title, body });
      return;
    }
    this.queue.push({ title, body });
    if (this.queue.length > MAX_QUEUE) this.queue.shift();
    // Alguém esperando: o da tela sai assim que tiver ficado o mínimo (no intervalo entre dois, nada muda: o próximo já vai aparecer).
    if (!this.revealed) return;
    const elapsed = this.scene.time.now - this.shownAt;
    this.scheduleHide(Math.max(0, MIN_SHOW_WHEN_QUEUED_MS - elapsed));
  }

  private display(message: { title: string; body: string }): void {
    this.current = message;
    this.revealed = true;
    this.shownAt = this.scene.time.now;
    this.title.setText(message.title);
    this.body.setText(message.body);
    this.setVisible(true);
    this.scheduleHide(this.queue.length > 0 ? MIN_SHOW_WHEN_QUEUED_MS : AUTO_HIDE_MS);
  }

  private scheduleHide(delayMs: number): void {
    this.hideEvent?.remove(false);
    this.hideEvent = this.scene.time.delayedCall(delayMs, () => this.hideCurrent());
  }

  /** O aviso da tela sai; havendo fila, o próximo aparece logo depois. */
  private hideCurrent(): void {
    this.hideEvent = null;
    this.current = null;
    this.revealed = false;
    this.setVisible(false);
    const next = this.queue.shift();
    if (!next) return;
    // O próximo já é o "da vez" durante o intervalo (um aviso novo nesse meio-tempo entra na fila atrás dele).
    this.current = next;
    this.hideEvent = this.scene.time.delayedCall(QUEUE_GAP_MS, () => this.display(next));
  }

  private setVisible(visible: boolean): void {
    this.panel.setVisible(visible);
    this.title.setVisible(visible);
    this.body.setVisible(visible);
  }
}
