import Phaser from 'phaser';
import {
  INVENTORY_PANEL_KEY,
  INVENTORY_PANEL_FRAME_NAME,
  INVENTORY_PANEL_RECT,
  INVENTORY_PANEL_BORDER,
} from '../data/ui';

const PANEL_WIDTH = 220;
const PANEL_HEIGHT = 120;
const TEXT_FONT = '"Courier New", Courier, monospace';
const TEXT_COLOR = '#ffe9b3';
const TEXT_STROKE = '#2b1d0e';

/**
 * Menu de pausa (Fase 9): ESC abre quando nada mais estiver aberto (Loja,
 * Inventário, posicionamento de decoração) — quem decide essa prioridade é
 * a `MainScene`, esta classe só mostra/esconde e responde `isOpen()`.
 * Minimalista de propósito: só bloqueia o jogo com um aviso, sem opções
 * ainda — salvar/configurações não existem no jogo hoje, então não faz
 * sentido antecipar botões pra funcionalidade que não foi pedida.
 *
 * Reaproveita o painel ornamentado do Inventário (`INVENTORY_PANEL_*`, via
 * NineSlice) pra manter a mesma identidade visual, num tamanho menor.
 */
export class PauseMenu {
  private readonly dim: Phaser.GameObjects.Rectangle;
  private readonly panel: Phaser.GameObjects.NineSlice;
  private readonly title: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private isOpen_ = false;

  constructor(scene: Phaser.Scene) {
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

    this.title = scene.add.text(centerX, centerY - 16, 'JOGO PAUSADO', {
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

    this.hint = scene.add.text(centerX, centerY + 16, 'Pressione ESC para continuar', {
      fontFamily: TEXT_FONT,
      fontSize: '11px',
      fontStyle: 'bold',
      color: TEXT_COLOR,
      stroke: TEXT_STROKE,
      strokeThickness: 2,
    });
    this.hint.setOrigin(0.5, 0.5);
    this.hint.setScrollFactor(0);
    this.hint.setDepth(4001);

    this.setVisible(false);
  }

  isOpen(): boolean {
    return this.isOpen_;
  }

  open(): void {
    this.isOpen_ = true;
    this.setVisible(true);
  }

  close(): void {
    this.isOpen_ = false;
    this.setVisible(false);
  }

  toggle(): void {
    if (this.isOpen_) this.close();
    else this.open();
  }

  private setVisible(visible: boolean): void {
    this.dim.setVisible(visible);
    this.panel.setVisible(visible);
    this.title.setVisible(visible);
    this.hint.setVisible(visible);
  }
}
