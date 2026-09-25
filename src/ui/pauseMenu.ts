import Phaser from 'phaser';
import {
  INVENTORY_PANEL_KEY,
  INVENTORY_PANEL_FRAME_NAME,
  INVENTORY_PANEL_RECT,
  INVENTORY_PANEL_BORDER,
} from '../data/ui';
import { SettingsPanel } from './settingsPanel';
import { playClick } from '../systems/soundEffects';

const PANEL_WIDTH = 220;
const PANEL_HEIGHT = 210;
const TEXT_FONT = '"Courier New", Courier, monospace';
const TEXT_COLOR = '#ffe9b3';
const TEXT_STROKE = '#2b1d0e';

const BUTTON_WIDTH = 176;
const BUTTON_HEIGHT = 30;
const BUTTON_GAP = 10;

interface PauseMenuCallbacks {
  /** "Sair para o Menu Principal" (pedido explícito) — quem chama decide COMO salvar/trocar de cena (ver `MainScene.ts`), esta classe só avisa a intenção. */
  onExitToMenu: () => void;
}

/**
 * Menu de pausa (Fase 10 — Estrutura Base e Persistência, atualizado a
 * partir da versão minimalista da Fase 9): ESC abre quando nada mais
 * estiver aberto (Loja, Inventário, posicionamento de decoração) — quem
 * decide essa prioridade é a `MainScene`, esta classe só mostra/esconde e
 * responde `isOpen()`.
 *
 * 3 botões (pedido explícito): "Retomar" (fecha, mesmo efeito do ESC),
 * "Opções" (abre os ajustes de volume de músicas/efeitos, ver
 * `ui/settingsPanel.ts`) e "Sair para o Menu Principal" (dispara `onExitToMenu`, que a
 * `MainScene` usa pra salvar e trocar de cena — ver doc de
 * `PauseMenuCallbacks.onExitToMenu`).
 *
 * Reaproveita o painel ornamentado do Inventário (`INVENTORY_PANEL_*`, via
 * NineSlice) pra manter a mesma identidade visual, mesmo critério de
 * sempre — botões são retângulo + texto (CLAUDE.md regra 12: isto é UI/
 * "chrome" de interface, mesma linguagem já usada nas abas do
 * `MapEditorScene`/`TilePickerPanel`, nunca arte do mundo do jogo).
 */
export class PauseMenu {
  private readonly dim: Phaser.GameObjects.Rectangle;
  private readonly panel: Phaser.GameObjects.NineSlice;
  private readonly title: Phaser.GameObjects.Text;
  private readonly buttons: Array<{ background: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text }> = [];
  private readonly settings: SettingsPanel;
  private isOpen_ = false;

  constructor(scene: Phaser.Scene, callbacks: PauseMenuCallbacks) {
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
    const centerY = scene.scale.height / 2;

    this.dim = scene.add.rectangle(0, 0, scene.scale.width, scene.scale.height, 0x000000, 0.5);
    this.dim.setOrigin(0, 0);
    this.dim.setScrollFactor(0);
    this.dim.setDepth(3999);

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
    this.panel.setDepth(4000);

    const panelTop = centerY - PANEL_HEIGHT / 2;
    this.title = scene.add.text(centerX, panelTop + 26, 'JOGO PAUSADO', {
      fontFamily: TEXT_FONT,
      fontSize: '16px',
      fontStyle: 'bold',
      color: TEXT_COLOR,
      stroke: TEXT_STROKE,
      strokeThickness: 3,
    });
    this.title.setOrigin(0.5, 0.5);
    this.title.setScrollFactor(0);
    this.title.setDepth(4001);

    const firstButtonY = panelTop + 66;
    this.addButton(scene, centerX, firstButtonY, 'RETOMAR', () => this.close());
    // Acima de tudo do menu de pausa (depths 3999-4002).
    this.settings = new SettingsPanel(scene, 5000);
    this.addButton(scene, centerX, firstButtonY + (BUTTON_HEIGHT + BUTTON_GAP), 'OPÇÕES', () => this.settings.open());
    this.addButton(scene, centerX, firstButtonY + (BUTTON_HEIGHT + BUTTON_GAP) * 2, 'SAIR PARA O MENU', () => callbacks.onExitToMenu());

    this.setVisible(false);
  }

  private addButton(scene: Phaser.Scene, x: number, y: number, label: string, onClick: () => void): void {
    const background = scene.add.rectangle(x, y, BUTTON_WIDTH, BUTTON_HEIGHT, 0x2c2c2c, 0.95);
    background.setStrokeStyle(2, 0x6f5a3a, 1);
    background.setScrollFactor(0);
    background.setDepth(4001);
    background.setInteractive({ useHandCursor: true });
    background.on('pointerover', () => background.setFillStyle(0x4a3a24, 0.95));
    background.on('pointerout', () => background.setFillStyle(0x2c2c2c, 0.95));
    background.on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      playClick(scene);
      onClick();
    });

    const text = scene.add.text(x, y, label, {
      fontFamily: TEXT_FONT,
      fontSize: '13px',
      fontStyle: 'bold',
      color: TEXT_COLOR,
      stroke: TEXT_STROKE,
      strokeThickness: 2,
    });
    text.setOrigin(0.5, 0.5);
    text.setScrollFactor(0);
    text.setDepth(4002);

    this.buttons.push({ background, text });
  }

  isOpen(): boolean {
    return this.isOpen_;
  }

  open(): void {
    this.isOpen_ = true;
    this.setVisible(true);
  }

  close(): void {
    this.settings.close();
    this.isOpen_ = false;
    this.setVisible(false);
  }

  /** ESC com os ajustes abertos fecha só os ajustes (volta ao menu de pausa); só o ESC seguinte fecha o menu. */
  toggle(): void {
    if (this.settings.isOpen()) this.settings.close();
    else if (this.isOpen_) this.close();
    else this.open();
  }

  private setVisible(visible: boolean): void {
    this.dim.setVisible(visible);
    this.panel.setVisible(visible);
    this.title.setVisible(visible);
    for (const button of this.buttons) {
      button.background.setVisible(visible);
      button.text.setVisible(visible);
      if (visible) button.background.setInteractive({ useHandCursor: true });
      else button.background.disableInteractive();
    }
  }
}
