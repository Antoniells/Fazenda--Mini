import Phaser from 'phaser';
import { playClick } from '../systems/soundEffects';
import { tutorial } from '../systems/tutorial';
import { INVENTORY_PANEL_KEY, INVENTORY_PANEL_FRAME_NAME, INVENTORY_PANEL_RECT, INVENTORY_PANEL_BORDER } from '../data/ui';

const PANEL_WIDTH = 440;
const DEPTH = 3400;
const FONT = '"Courier New", Courier, monospace';
const TEXT_INK = '#4a3524';
const TEXT_SOFT = '#7a6250';
const PADDING = 16;
const TOP_MARGIN = 52;
const BUTTON_WIDTH = 150;
const BUTTON_HEIGHT = 34;
const DIM_ALPHA = 0.4;
const SKIP_WIDTH = 116;
const SKIP_HEIGHT = 24;

/**
 * Painel curto do tutorial (`systems/tutorial.ts`): "Passo n/N", título e texto do passo atual. Nos passos de AÇÃO fica
 * pequeno no alto da tela, sem tapar o jogo nem capturar cliques (o jogador precisa clicar no mundo); nos passos "info" fica
 * no centro, com a tela escurecida e um botão — é o único jeito de continuar (o gerenciador trava todo o resto). Vive na
 * `UIScene` (câmera própria), tem sempre o botão "Pular tutorial" (`tutorial.skip()`) e se redesenha a cada mudança do gerenciador; puramente visual: quem avança é `tutorial.confirm()`
 * (botão) ou o próprio jogo avisando que a ação aconteceu.
 */
export class TutorialPanel {
  private readonly dim: Phaser.GameObjects.Rectangle;
  private readonly panel: Phaser.GameObjects.NineSlice;
  private readonly counter: Phaser.GameObjects.Text;
  private readonly title: Phaser.GameObjects.Text;
  private readonly body: Phaser.GameObjects.Text;
  private readonly button: Phaser.GameObjects.NineSlice;
  private readonly buttonLabel: Phaser.GameObjects.Text;
  private readonly skipButton: Phaser.GameObjects.NineSlice;
  private readonly skipLabel: Phaser.GameObjects.Text;
  private readonly unsubscribe: () => void;
  private buttonEnabled = false;

  constructor(private readonly scene: Phaser.Scene) {
    const texture = scene.textures.get(INVENTORY_PANEL_KEY);
    if (!texture.has(INVENTORY_PANEL_FRAME_NAME)) {
      const { x, y, width, height } = INVENTORY_PANEL_RECT;
      texture.add(INVENTORY_PANEL_FRAME_NAME, 0, x, y, width, height);
    }

    // Escurece o jogo nos passos "info" (e engole o clique — nada vaza pro mundo por baixo).
    this.dim = scene.add.rectangle(0, 0, scene.scale.width, scene.scale.height, 0x000000, DIM_ALPHA);
    this.dim.setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH - 1).setInteractive();

    const makeSlice = (width: number, height: number): Phaser.GameObjects.NineSlice =>
      scene.add.nineslice(0, 0, INVENTORY_PANEL_KEY, INVENTORY_PANEL_FRAME_NAME, width, height, INVENTORY_PANEL_BORDER, INVENTORY_PANEL_BORDER, INVENTORY_PANEL_BORDER, INVENTORY_PANEL_BORDER);

    this.panel = makeSlice(PANEL_WIDTH, 100);
    this.panel.setOrigin(0.5, 0).setScrollFactor(0).setDepth(DEPTH);

    this.counter = scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: '11px', color: TEXT_SOFT });
    this.counter.setOrigin(1, 0).setScrollFactor(0).setDepth(DEPTH + 1);
    this.title = scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: TEXT_INK });
    this.title.setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH + 1);
    this.body = scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: '13px', color: TEXT_INK, lineSpacing: 4, wordWrap: { width: PANEL_WIDTH - PADDING * 2 } });
    this.body.setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH + 1);

    this.button = makeSlice(BUTTON_WIDTH, BUTTON_HEIGHT);
    this.button.setScrollFactor(0).setDepth(DEPTH + 1).setInteractive({ useHandCursor: true });
    this.button.on('pointerover', () => this.button.setAlpha(0.85));
    this.button.on('pointerout', () => this.button.setAlpha(1));
    this.button.on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
      if (!this.buttonEnabled) return;
      event.stopPropagation();
      playClick(scene);
      tutorial.confirm();
    });
    this.buttonLabel = scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: TEXT_INK });
    this.buttonLabel.setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(DEPTH + 2);

    // "Pular tutorial": sempre disponível (também nos passos de ação, onde o painel em si não captura cliques — só este botão).
    this.skipButton = makeSlice(SKIP_WIDTH, SKIP_HEIGHT);
    this.skipButton.setScrollFactor(0).setDepth(DEPTH + 1);
    this.skipButton.on('pointerover', () => this.skipButton.setAlpha(0.85));
    this.skipButton.on('pointerout', () => this.skipButton.setAlpha(1));
    this.skipButton.on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      playClick(scene);
      tutorial.skip();
    });
    this.skipLabel = scene.add.text(0, 0, 'Pular tutorial', { fontFamily: FONT, fontSize: '11px', fontStyle: 'bold', color: TEXT_SOFT });
    this.skipLabel.setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(DEPTH + 2);

    this.unsubscribe = tutorial.subscribe(() => this.refresh());
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubscribe());
    this.refresh();
  }

  /** Redesenha o passo atual (ou esconde tudo se o tutorial não está rodando). */
  refresh(): void {
    const step = tutorial.getStep();
    if (!step) {
      this.setVisible(false, false);
      return;
    }

    const isInfo = step.goal.kind === 'info';
    const { index, total } = tutorial.getPosition();
    const progress = tutorial.getProgressLabel();

    const isHint = tutorial.isHint();
    this.counter.setText(isHint ? 'Dica' : `Tutorial ${index}/${total}`);
    this.title.setText(step.title);
    this.body.setText(progress ? `${step.text}  (${progress})` : step.text);

    // Altura pelo texto: título + corpo (+ botão nos passos "info").
    const buttonBlock = isInfo ? BUTTON_HEIGHT + 12 : SKIP_HEIGHT + 8;
    // A dica avulsa não tem "Pular tutorial" (o botão principal já a fecha) e o botão principal fica centralizado.
    const height = PADDING + this.title.height + 8 + this.body.height + buttonBlock + PADDING;
    this.panel.setSize(PANEL_WIDTH, height);

    const cx = this.scene.scale.width / 2;
    const top = isInfo ? (this.scene.scale.height - height) / 2 : TOP_MARGIN;
    const left = cx - PANEL_WIDTH / 2;
    this.panel.setPosition(cx, top);
    this.counter.setPosition(left + PANEL_WIDTH - PADDING, top + PADDING + 2);
    this.title.setPosition(left + PADDING, top + PADDING);
    this.body.setPosition(left + PADDING, top + PADDING + this.title.height + 8);

    // "Pular tutorial" no canto inferior direito do painel (na mesma linha do botão principal, nos passos "info").
    const skipX = left + PANEL_WIDTH - PADDING - SKIP_WIDTH / 2;
    const skipY = top + height - PADDING - (isInfo ? BUTTON_HEIGHT : SKIP_HEIGHT) / 2;
    this.skipButton.setPosition(skipX, skipY);
    this.skipLabel.setPosition(skipX, skipY);

    this.buttonEnabled = isInfo;
    if (isInfo && step.goal.kind === 'info') {
      const buttonY = top + height - PADDING - BUTTON_HEIGHT / 2;
      this.button.setPosition(cx, buttonY);
      this.buttonLabel.setPosition(cx, buttonY);
      this.buttonLabel.setText(step.goal.buttonLabel);
    }
    this.setVisible(true, isInfo);
    if (isHint) {
      this.skipButton.setVisible(false).disableInteractive();
      this.skipLabel.setVisible(false);
    }
  }

  private setVisible(visible: boolean, isInfo: boolean): void {
    this.dim.setVisible(visible && isInfo);
    if (visible && isInfo) this.dim.setInteractive();
    else this.dim.disableInteractive();

    this.panel.setVisible(visible);
    this.counter.setVisible(visible);
    this.title.setVisible(visible);
    this.body.setVisible(visible);
    this.skipButton.setVisible(visible);
    this.skipLabel.setVisible(visible);
    if (visible) this.skipButton.setInteractive({ useHandCursor: true });
    else this.skipButton.disableInteractive();
    const showButton = visible && isInfo;
    this.button.setVisible(showButton);
    this.buttonLabel.setVisible(showButton);
    if (showButton) this.button.setInteractive({ useHandCursor: true });
    else this.button.disableInteractive();
  }
}
