import Phaser from 'phaser';
import { Interactable, InteractionRegistry } from './interaction';
import { WalkableGrid } from './grid';
import { Player } from '../entities/Player';
import { createGroundShadow } from './shadow';
import { DISPLAY_SCALE } from './mapBuilder';
import { popText } from './floatingText';
import { OPEN_LETTER_EVENT, OpenLetterPayload } from './petBox';
import { getUnreadMail, hasUnreadMail, markMailRead, renderMail } from './mail';
import { save as saveGame } from './saveManager';
import { MAILBOX_CELL, MAILBOX_KEY, MAILBOX_PATH, MAILBOX_FRAME, MAIL_PAPER_FRAME } from '../data/mail';

export function preloadMailbox(scene: Phaser.Scene): void {
  scene.load.image(MAILBOX_KEY, encodeURI(`/${MAILBOX_PATH}`));
}

const DEFAULT_BUTTON_LABEL = 'Guardar';
const PAPER_BOB_PX = 4;

/**
 * Interagir com a Caixa de Correio: abre a próxima carta não lida no painel de carta (`ui/letterPanel.ts`, aberto por evento — o
 * mundo não importa a UI). Ao terminar a leitura a carta é marcada como lida e o jogo salva; as seguintes ficam pra próxima
 * interação. Sem carta, só um aviso flutuante.
 */
class MailboxInteractable implements Interactable {
  /** Responde à tecla F (`PlayerController.handleInteractKey`), além do clique — mesmo padrão da Loja/Caixa de Remessas/Porta. */
  readonly keyInteractable = true;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Player,
    private readonly x: number,
    private readonly y: number,
  ) {}

  interact(): void {
    if (this.player.isBusy()) return;

    const [message] = getUnreadMail();
    if (!message) {
      popText(this.scene, this.x, this.y - 40, 'Sem cartas novas');
      return;
    }

    const { title, body } = renderMail(message);
    const payload: OpenLetterPayload = {
      title,
      body,
      buttonLabel: message.buttonLabel ?? DEFAULT_BUTTON_LABEL,
      heart: message.heart === true,
      onRead: () => {
        markMailRead(message.id);
        saveGame();
      },
    };
    this.scene.game.events.emit(OPEN_LETTER_EVENT, payload);
  }
}

/**
 * A Caixa de Correio da Fazenda (`data/mail.ts` `MAILBOX_CELL`): objeto sólido (bloqueia a célula, o jogador chega ao lado e
 * interage) com sombra, ordenado por Y como qualquer objeto do mundo. Enquanto há carta não lida, um papel flutua em cima dela —
 * `update()` (chamado todo frame pela cena) só liga/desliga esse indicador.
 */
export class Mailbox {
  private readonly image: Phaser.GameObjects.Image;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly indicator: Phaser.GameObjects.Image;

  constructor(
    private readonly scene: Phaser.Scene,
    tilePx: number,
    private readonly grid: WalkableGrid,
    private readonly interactions: InteractionRegistry,
    player: Player,
  ) {
    const texture = scene.textures.get(MAILBOX_KEY);
    for (const frame of [MAILBOX_FRAME, MAIL_PAPER_FRAME]) {
      if (!texture.has(frame.name)) texture.add(frame.name, 0, frame.rect.x, frame.rect.y, frame.rect.width, frame.rect.height);
    }

    const { col, row } = MAILBOX_CELL;
    const x = col * tilePx + tilePx / 2;
    const y = (row + 1) * tilePx;

    this.shadow = createGroundShadow(scene, x, y - 4, DISPLAY_SCALE * 0.8, DISPLAY_SCALE * 0.4);
    this.shadow.setDepth(y - 0.1);
    this.image = scene.add.image(x, y - 2, MAILBOX_KEY, MAILBOX_FRAME.name);
    this.image.setOrigin(0.5, 1);
    this.image.setScale(DISPLAY_SCALE);
    this.image.setDepth(y);

    const paperY = this.image.y - this.image.displayHeight - 6;
    this.indicator = scene.add.image(x, paperY, MAILBOX_KEY, MAIL_PAPER_FRAME.name);
    this.indicator.setOrigin(0.5, 1);
    this.indicator.setScale(DISPLAY_SCALE);
    this.indicator.setDepth(y + 0.1);
    this.indicator.setVisible(false);
    scene.tweens.add({ targets: this.indicator, y: paperY - PAPER_BOB_PX, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    grid.block(col, row);
    interactions.set(col, row, new MailboxInteractable(scene, player, x, this.image.y - this.image.displayHeight));
  }

  update(): void {
    const unread = hasUnreadMail();
    if (this.indicator.visible !== unread) this.indicator.setVisible(unread);
  }

  destroy(): void {
    this.scene.tweens.killTweensOf(this.indicator);
    this.indicator.destroy();
    this.image.destroy();
    this.shadow.destroy();
    this.grid.unblock(MAILBOX_CELL.col, MAILBOX_CELL.row);
    this.interactions.remove(MAILBOX_CELL.col, MAILBOX_CELL.row);
  }
}
