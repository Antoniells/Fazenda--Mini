import Phaser from 'phaser';
import {
  INVENTORY_PANEL_KEY,
  INVENTORY_PANEL_PATH,
  INVENTORY_PANEL_FRAME_NAME,
  INVENTORY_PANEL_RECT,
  INVENTORY_PANEL_BORDER,
  INVENTORY_LARGE_PANEL_KEY,
  INVENTORY_LARGE_PANEL_PATH,
  INVENTORY_LARGE_PANEL_FRAME_NAME,
  INVENTORY_LARGE_PANEL_RECT,
  INVENTORY_LARGE_PANEL_BORDER,
  MENU_BACKGROUND_KEY,
  MENU_BACKGROUND_PATH,
  MENU_UI_KEY,
  MENU_UI_PATH,
  MENU_PART_FRAMES,
} from '../data/ui';
import { EPILOGUE_PAGES } from '../data/campaign';
import { gameState } from '../systems/gameState';
import { countCompletedRequests } from '../systems/requests';
import { save as saveGame } from '../systems/saveManager';
import { dayMusic } from '../systems/dayMusic';
import { playClick } from '../systems/soundEffects';
import { UI_SCENE_KEY } from './UIScene';
import { MAIN_MENU_SCENE_KEY } from './MainMenuScene';

export const ENDING_SCENE_KEY = 'EndingScene';

const FONT = '"Courier New", Courier, monospace';
const INK = '#4a3524';
const PANEL_WIDTH = 760;
const PANEL_HEIGHT = 380;
const BUTTON_WIDTH = 250;
const BUTTON_HEIGHT = 40;
const FADE_MS = 900;

/**
 * Tela FINAL (epílogo): aparece quando o jogador vence a Noite Final e a campanha se completa (`systems/campaign.ts` `completeCampaign`).
 * Fundo da Fazenda (o mesmo do menu, escurecido), o logo do jogo e o texto do epílogo em páginas ("Continuar"); a última página mostra
 * um resumo da jornada (dias, hordas vencidas, moedas) e dois botões: "Continuar jogando" (volta pra Fazenda, modo livre — a campanha
 * fica completa, os moradores só conversam) e "Menu principal". Só texto e a arte do jogo: nada desenhado por código além da moldura
 * de papel/escurecimento de UI.
 */
export class EndingScene extends Phaser.Scene {
  private pageIndex = 0;
  private panelObjects: Phaser.GameObjects.GameObject[] = [];
  private transitioning = false;

  constructor() {
    super(ENDING_SCENE_KEY);
  }

  preload(): void {
    this.load.image(MENU_BACKGROUND_KEY, encodeURI(`/${MENU_BACKGROUND_PATH}`));
    this.load.image(MENU_UI_KEY, encodeURI(`/${MENU_UI_PATH}`));
    this.load.image(INVENTORY_PANEL_KEY, encodeURI(`/${INVENTORY_PANEL_PATH}`));
    this.load.image(INVENTORY_LARGE_PANEL_KEY, encodeURI(`/${INVENTORY_LARGE_PANEL_PATH}`));
  }

  create(): void {
    this.pageIndex = 0;
    this.panelObjects = [];
    this.transitioning = false;

    // Sem HUD por cima e sem música do dia: é o fim de uma história.
    if (this.scene.manager.isActive(UI_SCENE_KEY)) this.scene.stop(UI_SCENE_KEY);
    dayMusic.disable(1500);
    saveGame();

    const panelTexture = this.textures.get(INVENTORY_PANEL_KEY);
    if (!panelTexture.has(INVENTORY_PANEL_FRAME_NAME)) {
      const rect = INVENTORY_PANEL_RECT;
      panelTexture.add(INVENTORY_PANEL_FRAME_NAME, 0, rect.x, rect.y, rect.width, rect.height);
    }
    const largeTexture = this.textures.get(INVENTORY_LARGE_PANEL_KEY);
    if (!largeTexture.has(INVENTORY_LARGE_PANEL_FRAME_NAME)) {
      const rect = INVENTORY_LARGE_PANEL_RECT;
      largeTexture.add(INVENTORY_LARGE_PANEL_FRAME_NAME, 0, rect.x, rect.y, rect.width, rect.height);
    }
    this.textures.get(MENU_BACKGROUND_KEY).setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.textures.get(MENU_UI_KEY).setFilter(Phaser.Textures.FilterMode.LINEAR);
    const menuUi = this.textures.get(MENU_UI_KEY);
    if (!menuUi.has(MENU_PART_FRAMES.logo.name)) {
      const { x, y, width, height } = MENU_PART_FRAMES.logo.rect;
      menuUi.add(MENU_PART_FRAMES.logo.name, 0, x, y, width, height);
    }

    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    const background = this.add.image(cx, cy, MENU_BACKGROUND_KEY);
    background.setScale(Math.max(this.scale.width / background.width, this.scale.height / background.height));
    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.55).setOrigin(0, 0);

    const logo = this.add.image(cx, 26, MENU_UI_KEY, MENU_PART_FRAMES.logo.name).setOrigin(0.5, 0).setScale(0.3);
    logo.setDepth(2);

    this.showPage();
    this.cameras.main.fadeIn(FADE_MS, 0, 0, 0);
  }

  private clearPanel(): void {
    for (const object of this.panelObjects) object.destroy();
    this.panelObjects = [];
  }

  private isLastPage(): boolean {
    return this.pageIndex >= EPILOGUE_PAGES.length;
  }

  /** Desenha a página atual: as do epílogo (texto + "Continuar") e, depois, o resumo da jornada com os botões finais. */
  private showPage(): void {
    this.clearPanel();
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2 + 60;
    const top = cy - PANEL_HEIGHT / 2;

    const panel = this.add.nineslice(
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
    panel.setOrigin(0.5, 0.5).setDepth(3);
    this.panelObjects.push(panel);

    if (!this.isLastPage()) {
      this.addText(cx, top + 150, EPILOGUE_PAGES[this.pageIndex], 19, false, PANEL_WIDTH - 120);
      this.addButton(cx, top + PANEL_HEIGHT - 60, this.pageIndex === EPILOGUE_PAGES.length - 1 ? 'Ver a minha história' : 'Continuar', () => this.nextPage());
      return;
    }

    this.addText(cx, top + 56, 'FIM', 30, true, PANEL_WIDTH - 120);
    const days = gameState.gameClock.getDay();
    const { hordesWon } = gameState.campaign;
    const lines = [
      `${gameState.profile.playerName}, da fazenda ${gameState.profile.farmName}`,
      '',
      `Dias de trabalho: ${days}`,
      `Noites de horda vencidas: ${hordesWon}`,
      `Pedidos atendidos: ${countCompletedRequests()}`,
      `Moedas guardadas: ${gameState.inventory.getCoins()}`,
      '',
      'Obrigado por jogar Mini Fazenda!',
    ];
    this.addText(cx, top + 175, lines.join('\n'), 17, false, PANEL_WIDTH - 120);
    this.addButton(cx - BUTTON_WIDTH / 2 - 12, top + PANEL_HEIGHT - 52, 'Continuar jogando', () => this.leave('MainScene'));
    this.addButton(cx + BUTTON_WIDTH / 2 + 12, top + PANEL_HEIGHT - 52, 'Menu principal', () => this.leave(MAIN_MENU_SCENE_KEY));
  }

  private addText(x: number, y: number, text: string, size: number, bold: boolean, wrapWidth: number): void {
    const label = this.add.text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: bold ? 'bold' : 'normal', color: INK, align: 'center', lineSpacing: 6, wordWrap: { width: wrapWidth } });
    label.setOrigin(0.5, 0.5).setDepth(4);
    this.panelObjects.push(label);
  }

  private addButton(x: number, y: number, label: string, onClick: () => void): void {
    const box = this.add.nineslice(x, y, INVENTORY_PANEL_KEY, INVENTORY_PANEL_FRAME_NAME, BUTTON_WIDTH, BUTTON_HEIGHT, INVENTORY_PANEL_BORDER, INVENTORY_PANEL_BORDER, INVENTORY_PANEL_BORDER, INVENTORY_PANEL_BORDER);
    box.setDepth(4).setInteractive({ useHandCursor: true });
    box.on('pointerover', () => box.setAlpha(0.85));
    box.on('pointerout', () => box.setAlpha(1));
    box.on('pointerdown', () => {
      if (this.transitioning) return;
      playClick(this);
      onClick();
    });
    const text = this.add.text(x, y, label, { fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: INK });
    text.setOrigin(0.5, 0.5).setDepth(5);
    this.panelObjects.push(box, text);
  }

  private nextPage(): void {
    this.pageIndex += 1;
    this.showPage();
  }

  private leave(sceneKey: string): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.cameras.main.fadeOut(FADE_MS / 2, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(sceneKey));
  }
}
