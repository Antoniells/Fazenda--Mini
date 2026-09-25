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
} from '../data/ui';

/** Uma escolha da conversa (botão): rótulo, se pode ser escolhida agora e o que faz. O painel fecha ANTES de chamar `onSelect` (que pode abrir outra fala). */
export interface DialogueAction {
  label: string;
  enabled?: boolean;
  onSelect: () => void;
}

/** O que o painel mostra: quem fala (com retrato opcional), a fala e as escolhas — um botão "Fechar" é sempre acrescentado no fim. */
export interface DialoguePayload {
  speaker: string;
  subtitle?: string;
  portrait?: { key: string; frame: { x: number; y: number; width: number; height: number } };
  text: string;
  /**
   * Fala em várias páginas (pedido explícito — eventos do mundo, `systems/events/visitorEvent.ts`): com isto o painel mostra as setas
   * `<` `>` e o contador "1/3", e ignora `text`. Os botões (`actions` e "Fechar") só aparecem na ÚLTIMA página, e `details` também.
   */
  pages?: string[];
  /** Chamado quando o jogador aperta "Fechar" (nunca no ESC, que só fecha) — nas falas paginadas, isso só é possível na última página. */
  onFinish?: () => void;
  /** Linhas menores abaixo da fala (progresso da missão, recompensa) — uma por linha, mostradas em cor de destaque. */
  details?: string[];
  actions: DialogueAction[];
}

/** Evento GLOBAL (`game.events`) que abre o painel — mesmo padrão da carta/baú (`systems/petBox.ts`), pra o mundo não importar a UI. */
export const OPEN_DIALOGUE_EVENT = 'open-dialogue';

const PANEL_WIDTH = 1000;
const PANEL_HEIGHT = 300;
const PANEL_BOTTOM_MARGIN = 26;
const DEPTH = 3400;
const FONT = '"Courier New", Courier, monospace';
const TEXT_INK = '#4a3524';
const TEXT_DETAIL = '#6b3f1f';
const PORTRAIT_SCALE = 2.2;
const PORTRAIT_SIZE = 64 * PORTRAIT_SCALE;
const BUTTON_WIDTH = 210;
const BUTTON_HEIGHT = 34;
const BUTTON_GAP = 12;
const MAX_ACTIONS = 4;
const ARROW_WIDTH = 40;
const ARROW_HEIGHT = 34;

interface ActionButton {
  box: Phaser.GameObjects.NineSlice;
  label: Phaser.GameObjects.Text;
  action: DialogueAction | null;
}

/**
 * Painel de conversa (modal, na parte de baixo da tela): retrato + nome do morador, a fala e até 3 escolhas (botões) mais "Fechar".
 * Usa o mesmo painel/botão de papel do resto da UI. Vive na `UIScene` (câmera própria, sem zoom) e é aberto por evento
 * (`OPEN_DIALOGUE_EVENT`). Puramente visual: quem decide o que cada escolha faz é o `onSelect` de quem abriu (`systems/npcDialogue.ts`).
 * Enquanto aberto, o clique no papel não vaza pro mundo e a cena trava movimento (`isDialogueOpen` em `UIScene`).
 */
export class DialoguePanel {
  private readonly panel: Phaser.GameObjects.NineSlice;
  private readonly portrait: Phaser.GameObjects.Image;
  private readonly speaker: Phaser.GameObjects.Text;
  private readonly body: Phaser.GameObjects.Text;
  private readonly details: Phaser.GameObjects.Text;
  private readonly buttons: ActionButton[] = [];
  private isOpen_ = false;
  /** Y (px) onde o corpo da fala começa — os detalhes vêm logo abaixo dele, seja qual for o tamanho da fala. */
  private detailsTop = 0;
  /** Fala paginada em curso (`DialoguePayload.pages`); `null` = fala de uma página só, como sempre foi. */
  private pages: string[] | null = null;
  private pageIndex = 0;
  private payload: DialoguePayload | null = null;
  private readonly prevArrow: { box: Phaser.GameObjects.NineSlice; label: Phaser.GameObjects.Text };
  private readonly nextArrow: { box: Phaser.GameObjects.NineSlice; label: Phaser.GameObjects.Text };
  private readonly pageCounter: Phaser.GameObjects.Text;

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

    const cx = scene.scale.width / 2;
    const cy = scene.scale.height - PANEL_BOTTOM_MARGIN - PANEL_HEIGHT / 2;
    const left = cx - PANEL_WIDTH / 2;
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
    this.panel.setInteractive(); // Um clique no papel não pode "vazar" pro mundo por baixo.

    const portraitX = left + 34 + PORTRAIT_SIZE / 2;
    this.portrait = scene.add.image(portraitX, top + 40 + PORTRAIT_SIZE / 2, INVENTORY_PANEL_KEY, INVENTORY_PANEL_FRAME_NAME);
    this.portrait.setScale(PORTRAIT_SCALE).setScrollFactor(0).setDepth(DEPTH + 1);

    const textLeft = left + 34 + PORTRAIT_SIZE + 26;
    const textWidth = PANEL_WIDTH - (textLeft - left) - 40;
    this.speaker = scene.add.text(textLeft, top + 26, '', { fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: TEXT_INK });
    this.speaker.setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH + 1);

    this.body = scene.add.text(textLeft, top + 56, '', { fontFamily: FONT, fontSize: '15px', color: TEXT_INK, lineSpacing: 5, wordWrap: { width: textWidth } });
    this.body.setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH + 1);

    this.detailsTop = top + 56;
    this.details = scene.add.text(textLeft, top + 132, '', { fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: TEXT_DETAIL, lineSpacing: 3, wordWrap: { width: textWidth } });
    this.details.setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH + 1);

    // Botões alinhados à direita, na base do painel.
    const rightEdge = left + PANEL_WIDTH - 38;
    const buttonY = top + PANEL_HEIGHT - 32;
    for (let index = 0; index < MAX_ACTIONS + 1; index++) {
      const x = rightEdge - BUTTON_WIDTH / 2 - index * (BUTTON_WIDTH + BUTTON_GAP);
      const box = scene.add.nineslice(x, buttonY, INVENTORY_PANEL_KEY, INVENTORY_PANEL_FRAME_NAME, BUTTON_WIDTH, BUTTON_HEIGHT, INVENTORY_PANEL_BORDER, INVENTORY_PANEL_BORDER, INVENTORY_PANEL_BORDER, INVENTORY_PANEL_BORDER);
      box.setScrollFactor(0).setDepth(DEPTH + 1);
      const label = scene.add.text(x, buttonY, '', { fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: TEXT_INK, align: 'center' });
      label.setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(DEPTH + 2);
      const button: ActionButton = { box, label, action: null };
      box.on('pointerover', () => button.action?.enabled !== false && box.setAlpha(0.85));
      box.on('pointerout', () => box.setAlpha(button.action?.enabled === false ? 0.55 : 1));
      box.on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
        if (!this.isOpen_) return;
        event.stopPropagation();
        const action = button.action;
        if (!action || action.enabled === false) return;
        playClick(scene);
        this.close();
        action.onSelect();
      });
      this.buttons.push(button);
    }

    // Setas de página (`<` `>`) e contador, na base do painel, à esquerda dos botões — só aparecem nas falas paginadas.
    const makeArrow = (x: number, text: string, delta: number): { box: Phaser.GameObjects.NineSlice; label: Phaser.GameObjects.Text } => {
      const box = scene.add.nineslice(x, buttonY, INVENTORY_PANEL_KEY, INVENTORY_PANEL_FRAME_NAME, ARROW_WIDTH, ARROW_HEIGHT, INVENTORY_PANEL_BORDER, INVENTORY_PANEL_BORDER, INVENTORY_PANEL_BORDER, INVENTORY_PANEL_BORDER);
      box.setScrollFactor(0).setDepth(DEPTH + 1);
      const label = scene.add.text(x, buttonY, text, { fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: TEXT_INK });
      label.setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(DEPTH + 2);
      box.on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
        if (!this.isOpen_) return;
        event.stopPropagation();
        this.turnPage(delta);
      });
      return { box, label };
    };
    const arrowsLeft = textLeft + ARROW_WIDTH / 2;
    this.prevArrow = makeArrow(arrowsLeft, '<', -1);
    this.nextArrow = makeArrow(arrowsLeft + ARROW_WIDTH + 10, '>', 1);
    this.pageCounter = scene.add.text(arrowsLeft + ARROW_WIDTH * 2 + 28, buttonY, '', { fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: TEXT_INK });
    this.pageCounter.setOrigin(0, 0.5).setScrollFactor(0).setDepth(DEPTH + 1);

    // Teclado: setas ← → (ou Enter) viram a página.
    scene.input.keyboard?.on('keydown-RIGHT', () => this.turnPage(1));
    scene.input.keyboard?.on('keydown-ENTER', () => this.turnPage(1));
    scene.input.keyboard?.on('keydown-LEFT', () => this.turnPage(-1));

    this.setVisible(false);
  }

  /** Passa (ou volta) uma página; sem efeito fora de uma fala paginada ou além das pontas. */
  private turnPage(delta: number): void {
    if (!this.isOpen_ || !this.pages) return;
    const next = this.pageIndex + delta;
    if (next < 0 || next >= this.pages.length) return;
    playClick(this.scene);
    this.pageIndex = next;
    this.renderPage();
  }

  isOpen(): boolean {
    return this.isOpen_;
  }

  open(payload: DialoguePayload): void {
    this.isOpen_ = true;

    if (payload.portrait) {
      const { key, frame } = payload.portrait;
      const frameName = `${key}-face`;
      const texture = this.scene.textures.get(key);
      if (!texture.has(frameName)) texture.add(frameName, 0, frame.x, frame.y, frame.width, frame.height);
      this.portrait.setTexture(key, frameName).setVisible(true);
    } else {
      this.portrait.setVisible(false);
    }

    this.speaker.setText(payload.subtitle ? `${payload.speaker} — ${payload.subtitle}` : payload.speaker);
    this.payload = payload;
    this.pages = payload.pages && payload.pages.length > 0 ? payload.pages : null;
    this.pageIndex = 0;

    this.panel.setVisible(true).setInteractive();
    this.speaker.setVisible(true);
    this.body.setVisible(true);
    this.details.setVisible(true);
    this.renderPage();
  }

  /** Desenha a página atual: o texto, os detalhes e os botões — numa fala paginada, botões e detalhes só na última página. */
  private renderPage(): void {
    const payload = this.payload;
    if (!payload) return;
    const pages = this.pages;
    const isLastPage = !pages || this.pageIndex === pages.length - 1;

    this.body.setText(pages ? pages[this.pageIndex] : payload.text);
    this.details.setText(isLastPage ? (payload.details ?? []).join('\n') : '');
    this.details.setY(this.detailsTop + this.body.height + 12);

    // Ações (na ordem) da direita pra esquerda; "Fechar" sempre por último (o mais à direita fica o primeiro botão: "Fechar").
    const closeAction: DialogueAction = { label: 'Fechar', onSelect: payload.onFinish ?? (() => {}) };
    const actions: DialogueAction[] = isLastPage ? [...payload.actions.slice(0, MAX_ACTIONS), closeAction] : [];
    const ordered = actions.length > 0 ? [actions[actions.length - 1], ...actions.slice(0, -1).reverse()] : [];
    this.buttons.forEach((button, index) => {
      const action = ordered[index] ?? null;
      button.action = action;
      button.box.setVisible(!!action);
      button.label.setVisible(!!action);
      button.label.setText(action?.label ?? '');
      button.box.setAlpha(action?.enabled === false ? 0.55 : 1);
      if (action) button.box.setInteractive({ useHandCursor: action.enabled !== false });
      else button.box.disableInteractive();
    });

    // Setas: só numa fala paginada; a da ponta em que não dá pra ir fica apagada.
    const paged = !!pages;
    for (const [arrow, enabled] of [
      [this.prevArrow, paged && this.pageIndex > 0],
      [this.nextArrow, paged && this.pageIndex < (pages?.length ?? 1) - 1],
    ] as const) {
      arrow.box.setVisible(paged);
      arrow.label.setVisible(paged);
      arrow.box.setAlpha(enabled ? 1 : 0.4);
      if (paged && enabled) arrow.box.setInteractive({ useHandCursor: true });
      else arrow.box.disableInteractive();
    }
    this.pageCounter.setVisible(paged);
    this.pageCounter.setText(paged ? `${this.pageIndex + 1}/${pages!.length}` : '');
  }

  close(): void {
    if (!this.isOpen_) return;
    this.isOpen_ = false;
    this.setVisible(false);
  }

  private setVisible(visible: boolean): void {
    for (const object of [this.panel, this.portrait, this.speaker, this.body, this.details]) object.setVisible(visible);
    if (!visible) {
      for (const arrow of [this.prevArrow, this.nextArrow]) {
        arrow.box.setVisible(false).disableInteractive();
        arrow.label.setVisible(false);
      }
      this.pageCounter.setVisible(false);
    }
    if (!visible) this.panel.disableInteractive();
    for (const button of this.buttons) {
      button.box.setVisible(visible && !!button.action);
      button.label.setVisible(visible && !!button.action);
      if (!visible) button.box.disableInteractive();
    }
  }
}
