import Phaser from 'phaser';
import {
  INVENTORY_PANEL_KEY,
  INVENTORY_PANEL_PATH,
  INVENTORY_PANEL_FRAME_NAME,
  INVENTORY_PANEL_RECT,
  INVENTORY_PANEL_BORDER,
  MENU_BACKGROUND_KEY,
  MENU_BACKGROUND_PATH,
  MENU_UI_KEY,
  MENU_UI_PATH,
  MENU_PART_FRAMES,
  MENU_BUTTON_FRAMES,
  CLOSE_BUTTON_SHEET_KEY,
  CLOSE_BUTTON_SHEET_PATH,
  DELETE_ICON_FRAME,
  DELETE_ICON_OPEN_FRAME,
} from '../data/ui';
import { preloadSoundEffects, playClick } from '../systems/soundEffects';
import { installGameCursor } from '../systems/gameCursor';
import { SettingsPanel } from '../ui/settingsPanel';
import { SAVE_SLOT_COUNT, getAllSlotSummaries, startNewGame, load as loadSave, deleteSave, SaveSlotSummary } from '../systems/saveManager';

export const MAIN_MENU_SCENE_KEY = 'MainMenuScene';
const MAIN_SCENE_KEY = 'MainScene';
const CHARACTER_CREATION_SCENE_KEY = 'CharacterCreationScene';

const TEXT_FONT = '"Courier New", Courier, monospace';
const TEXT_COLOR = '#ffe9b3';
const TEXT_STROKE = '#2b1d0e';

const BUTTON_WIDTH = 220;
const BUTTON_HEIGHT = 36;

/** Escala única das peças do menu (a folha original, 1536x1024, é bem maior que a tela) — o centro é sempre o centro da tela (`this.scale`), seja qual for a resolução do jogo. */
const MENU_UI_SCALE = 0.4;
/** Composição vertical, em px da imagem ORIGINAL (a partir do topo do logo): onde começa a coroa de folhas (atrás do logo, um pouco maior que o original pra abraçar o logo), onde começa o primeiro botão e o vão entre botões. */
const WREATH_TOP = 105;
const WREATH_SCALE = 1.3;
const BUTTONS_TOP = 545;
/** Só o logo (chapéu/MINI FAZENDA/galinha/girassol — não a coroa de folhas atrás dele) sobe esta quantidade de px de TELA em
 * relação à posição centralizada — a coroa e os botões ficam onde estão. Pedido explícito do usuário: só essa imagem sobe. */
const LOGO_LIFT_PX = 18;
const BUTTON_GAP = 18;
/** Tamanho da fonte dos rótulos (px de tela). */
const LABEL_FONT_PX = 16;
/**
 * Deslocamento do centro do texto em relação ao centro da placa (px originais). "Iniciar" e "Sair" são curtos e ficam CENTRALIZADOS na
 * placa (0); "Configurações" é longo demais pra isso — encostaria na engrenagem —, então fica deslocado pro vão livre à direita do ícone.
 */
const LABEL_OFFSET_CENTERED = 0;
const LABEL_OFFSET_BESIDE_ICON = 80;

const FADE_MS = 350;

type FrameRect = { x: number; y: number; width: number; height: number };
type MenuFrame = { name: string; rect: FrameRect };
interface MenuButton {
  /** Moldura dourada do hover (alfa 0 = escondida). */
  highlight: Phaser.GameObjects.Image;
}

const SLOT_WIDTH = 420;
const SLOT_HEIGHT = 60;
const SLOT_GAP = 14;

/** Lixeira no canto superior direito do slot: escala do ícone 12x14 e distância do CENTRO dela até as bordas direita/superior do painel. */
const DELETE_ICON_SCALE = 1.5;
const DELETE_ICON_INSET_X = 22;
const DELETE_ICON_INSET_Y = 20;
/** Área de clique além do ícone (px do ícone original) — 12x14 é pequeno demais pra mirar. */
const DELETE_ICON_HIT_PADDING = 4;

const DIALOG_DEPTH = 20;
const DIALOG_WIDTH = 420;
const DIALOG_HEIGHT = 200;
const DIALOG_INK = '#3b2a14';

/**
 * Cena de boot (Fase 10 — Estrutura Base e Persistência, pedido explícito):
 * primeira cena da lista em `config/gameConfig.ts` — o jogo abre aqui, não
 * mais direto na Fazenda. Dois "modos" dentro da MESMA cena: o menu principal
 * (logo + Iniciar/Configurações/Sair) e o painel de 3 Slots de Save,
 * alternados por `showRoot`/`showSlots` (com fade) — nunca os dois visíveis
 * ao mesmo tempo.
 *
 * Visual do menu: só arte real (`data/ui.ts` → `MENU_*`). O logo, a coroa
 * de folhas (atrás do logo), as 3 placas de madeira e a placa dourada vêm
 * NUMA folha só, então em vez de fatiar a imagem num editor a cena adiciona
 * frames nomeados por retângulo e monta as peças. Cada botão é a placa (vazia),
 * o texto ("Iniciar"/"Configurações"/"Sair", escrito pela cena), a moldura
 * dourada (só aparece no hover, sem escala nem animação) e uma Zone invisível
 * do tamanho da placa.
 *
 * "Configurações" abre o painel de volume de músicas/efeitos
 * (`ui/settingsPanel.ts`; ESC também fecha). Escolher
 * um slot VAZIO abre a `CharacterCreationScene` (nome do personagem e da
 * fazenda), que é quem inicia a partida nova (`SaveManager.startNewGame`).
 * Ao voltar dela, o menu reabre direto na tela de Slots
 * (`init({ showSlots: true })`).
 */
export class MainMenuScene extends Phaser.Scene {
  private rootObjects: Phaser.GameObjects.GameObject[] = [];
  private slotsObjects: Phaser.GameObjects.GameObject[] = [];
  /** Referência direta ao texto de cada slot (índice = número do slot) — evitar derivar isso por posição dentro de `slotsObjects` (frágil a qualquer reordenação de `buildSlots`). */
  private slotLabels: Phaser.GameObjects.Text[] = [];
  /** Lixeira de cada slot (índice = número do slot) — fora de `slotsObjects` de propósito: só aparece em slot COM save, e `setGroupVisible` reativaria todas. */
  private deleteButtons: Phaser.GameObjects.Image[] = [];
  /** Objetos do diálogo de confirmação aberto (vazio = nenhum aberto). */
  private dialogObjects: Phaser.GameObjects.GameObject[] = [];
  private menuButtons: MenuButton[] = [];
  /** Verdadeiro durante o fade de troca de tela — ignora cliques/hover pra não disparar duas transições. */
  private transitioning = false;
  private openOnSlots = false;
  private settings!: SettingsPanel;

  constructor() {
    super(MAIN_MENU_SCENE_KEY);
  }

  init(data?: { showSlots?: boolean }): void {
    this.openOnSlots = data?.showSlots ?? false;
  }

  preload(): void {
    // Auto-suficiente: esta cena pode ser a primeira a rodar no boot do
    // jogo (nunca depende de `MainScene.preload()` já ter carregado nada).
    this.load.image(INVENTORY_PANEL_KEY, encodeURI(`/${INVENTORY_PANEL_PATH}`));
    this.load.image(MENU_BACKGROUND_KEY, encodeURI(`/${MENU_BACKGROUND_PATH}`));
    this.load.image(MENU_UI_KEY, encodeURI(`/${MENU_UI_PATH}`));
    this.load.image(CLOSE_BUTTON_SHEET_KEY, encodeURI(`/${CLOSE_BUTTON_SHEET_PATH}`));
    // Efeitos sonoros (poucos KB): o cache de áudio é global, então basta carregar aqui uma vez pro jogo todo.
    preloadSoundEffects(this);
  }

  create(): void {
    // A cena é reiniciada ao voltar do jogo pro menu (`scene.start`) mas os
    // campos da classe não — zera o que guarda objetos da instância anterior.
    this.rootObjects = [];
    this.slotsObjects = [];
    this.slotLabels = [];
    this.deleteButtons = [];
    this.dialogObjects = [];
    this.menuButtons = [];
    this.transitioning = false;

    const texture = this.textures.get(INVENTORY_PANEL_KEY);
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

    const iconsTexture = this.textures.get(CLOSE_BUTTON_SHEET_KEY);
    for (const frame of [DELETE_ICON_FRAME, DELETE_ICON_OPEN_FRAME]) {
      if (!iconsTexture.has(frame.name)) iconsTexture.add(frame.name, 0, frame.rect.x, frame.rect.y, frame.rect.width, frame.rect.height);
    }

    // Arte em alta resolução reduzida por escala fracionária: o `pixelArt: true`
    // global (filtro NEAREST) serrilharia tudo — estas duas texturas usam LINEAR.
    this.textures.get(MENU_BACKGROUND_KEY).setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.textures.get(MENU_UI_KEY).setFilter(Phaser.Textures.FilterMode.LINEAR);

    // Ponteiro do jogo (seta do HUD.png) — vale pro jogo inteiro; a folha de ícones já foi carregada no `preload` desta cena.
    installGameCursor(this);

    this.buildBackground();
    this.settings = new SettingsPanel(this, 50);
    this.input.keyboard!.on('keydown-ESC', () => this.settings.close());

    const centerX = this.scale.width / 2;
    this.buildRoot();
    this.buildSlots(centerX);

    if (this.openOnSlots) this.showSlots();
    else this.showRoot();
    this.cameras.main.fadeIn(FADE_MS, 0, 0, 0);
  }

  // --- Fundo -------------------------------------------------------------

  /** Fazenda estática cobrindo a tela toda (escala "cover": preenche as duas dimensões, cortando o excesso nas bordas em vez de deixar faixas vazias). */
  private buildBackground(): void {
    const background = this.add.image(this.scale.width / 2, this.scale.height / 2, MENU_BACKGROUND_KEY);
    const scale = Math.max(this.scale.width / background.width, this.scale.height / background.height);
    background.setScale(scale);
    background.setDepth(0);
  }

  // --- Tela principal (Logo + Iniciar / Configurações / Sair) --------------

  private buildRoot(): void {
    const texture = this.textures.get(MENU_UI_KEY);
    for (const frame of [...Object.values(MENU_PART_FRAMES), ...Object.values(MENU_BUTTON_FRAMES)]) {
      if (!texture.has(frame.name)) texture.add(frame.name, 0, frame.rect.x, frame.rect.y, frame.rect.width, frame.rect.height);
    }

    // Composição centralizada na tela: logo em cima, coroa de folhas atrás dele, os 3 botões embaixo.
    const buttons = [MENU_BUTTON_FRAMES.start, MENU_BUTTON_FRAMES.settings, MENU_BUTTON_FRAMES.quit];
    const contentHeight = BUTTONS_TOP + buttons.reduce((sum, frame) => sum + frame.rect.height, 0) + BUTTON_GAP * (buttons.length - 1);
    const centerX = this.scale.width / 2;
    const top = (this.scale.height - contentHeight * MENU_UI_SCALE) / 2;

    const wreath = this.add.image(centerX, top + WREATH_TOP * MENU_UI_SCALE, MENU_UI_KEY, MENU_PART_FRAMES.wreath.name);
    wreath.setOrigin(0.5, 0).setScale(MENU_UI_SCALE * WREATH_SCALE).setDepth(1);
    const logo = this.add.image(centerX, top - LOGO_LIFT_PX, MENU_UI_KEY, MENU_PART_FRAMES.logo.name);
    logo.setOrigin(0.5, 0).setScale(MENU_UI_SCALE).setDepth(2);
    this.rootObjects.push(wreath, logo);

    const entries: Array<{ frame: MenuFrame; label: string; labelOffsetX: number; onClick: () => void }> = [
      { frame: MENU_BUTTON_FRAMES.start, label: 'Iniciar', labelOffsetX: LABEL_OFFSET_CENTERED, onClick: () => this.transitionTo(() => this.showSlots()) },
      { frame: MENU_BUTTON_FRAMES.settings, label: 'Configurações', labelOffsetX: LABEL_OFFSET_BESIDE_ICON, onClick: () => this.settings.open() },
      { frame: MENU_BUTTON_FRAMES.quit, label: 'Sair', labelOffsetX: LABEL_OFFSET_CENTERED, onClick: () => this.exitGame() },
    ];
    let designY = BUTTONS_TOP;
    for (const { frame, label, labelOffsetX, onClick } of entries) {
      this.rootObjects.push(...this.createMenuButton(frame, label, labelOffsetX, centerX, top + designY * MENU_UI_SCALE, onClick));
      designY += frame.rect.height + BUTTON_GAP;
    }
  }

  /** Um botão do menu: placa + texto + moldura dourada (hover) + Zone de clique. `x` é o centro da placa; `y`, o topo dela (px de tela). */
  private createMenuButton(frame: MenuFrame, label: string, labelOffsetX: number, x: number, y: number, onClick: () => void): Phaser.GameObjects.GameObject[] {
    const width = frame.rect.width * MENU_UI_SCALE;
    const height = frame.rect.height * MENU_UI_SCALE;

    const plate = this.add.image(x, y, MENU_UI_KEY, frame.name);
    plate.setOrigin(0.5, 0).setScale(MENU_UI_SCALE).setDepth(2);

    // Só a moldura dourada (o interior é transparente): esticada pra cobrir exatamente a placa, por cima dela e por baixo do texto.
    const gold = MENU_PART_FRAMES.goldPlate.rect;
    const highlight = this.add.image(x, y, MENU_UI_KEY, MENU_PART_FRAMES.goldPlate.name);
    highlight.setOrigin(0.5, 0).setScale(width / gold.width, height / gold.height).setDepth(3).setAlpha(0);

    const text = this.add.text(x + labelOffsetX * MENU_UI_SCALE, y + height / 2, label, {
      fontFamily: TEXT_FONT,
      fontSize: `${LABEL_FONT_PX}px`,
      fontStyle: 'bold',
      color: TEXT_COLOR,
      stroke: TEXT_STROKE,
      strokeThickness: 3,
    });
    text.setOrigin(0.5, 0.5).setDepth(4);

    const zone = this.add.zone(x, y + height / 2, width, height);
    zone.setInteractive({ useHandCursor: true });

    const button: MenuButton = { highlight };
    this.menuButtons.push(button);

    zone.on('pointerover', () => {
      if (this.transitioning) return;
      highlight.setAlpha(1);
    });
    zone.on('pointerout', () => this.resetButton(button));
    zone.on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      if (this.transitioning) return;
      playClick(this);
      onClick();
    });

    return [plate, highlight, text, zone];
  }

  /** Esconde a moldura dourada — também chamado ao reexibir a tela (o `pointerout` nunca dispara numa Zone desativada). */
  private resetButton(button: MenuButton): void {
    button.highlight.setAlpha(0);
  }

  /**
   * Fora de um empacotamento desktop (Electron, Fase 10 de verdade — ainda
   * não integrado, ver CLAUDE.md), `window.close()` só funciona em abas que
   * o próprio script abriu — navegadores bloqueiam silenciosamente
   * fechar uma aba comum por segurança. Chamado mesmo assim (melhor
   * esforço): sem efeito visível hoje num navegador normal, mas já é o
   * comportamento certo quando o jogo virar um executável de verdade.
   */
  private exitGame(): void {
    window.close();
  }

  /** Fade out → troca a tela → fade in. Trava novos cliques até terminar. */
  private transitionTo(change: () => void): void {
    if (this.transitioning) return;
    this.transitioning = true;
    const camera = this.cameras.main;
    camera.fadeOut(FADE_MS, 0, 0, 0);
    camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      change();
      camera.fadeIn(FADE_MS, 0, 0, 0);
      camera.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () => {
        this.transitioning = false;
      });
    });
  }

  // --- Slots de Save -----------------------------------------------------

  private buildSlots(centerX: number): void {
    const centerY = this.scale.height / 2;
    const firstY = centerY - (SLOT_HEIGHT + SLOT_GAP) * (SAVE_SLOT_COUNT - 1) / 2 - 40;

    // Escurece a fazenda por trás pra os slots (painel + texto) ficarem legíveis.
    const dim = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.45);
    dim.setOrigin(0, 0);
    dim.setDepth(0.5);
    this.slotsObjects.push(dim);

    const hint = this.add.text(centerX, firstY - 40, 'ESCOLHA UM SLOT', {
      fontFamily: TEXT_FONT,
      fontSize: '16px',
      fontStyle: 'bold',
      color: TEXT_COLOR,
      stroke: TEXT_STROKE,
      strokeThickness: 3,
    });
    hint.setOrigin(0.5, 0.5);
    hint.setDepth(1);
    this.slotsObjects.push(hint);

    for (let slot = 0; slot < SAVE_SLOT_COUNT; slot++) {
      const y = firstY + slot * (SLOT_HEIGHT + SLOT_GAP);
      const [panel, label] = this.createSlotButton(centerX, y, slot);
      this.slotsObjects.push(panel, label);
      this.slotLabels[slot] = label as Phaser.GameObjects.Text;
      this.deleteButtons[slot] = this.createDeleteButton(centerX + SLOT_WIDTH / 2 - DELETE_ICON_INSET_X, y - SLOT_HEIGHT / 2 + DELETE_ICON_INSET_Y, slot);
    }

    const backY = firstY + SAVE_SLOT_COUNT * (SLOT_HEIGHT + SLOT_GAP) + 10;
    this.slotsObjects.push(...this.createButton(centerX, backY, 'VOLTAR', () => this.transitionTo(() => this.showRoot()), SLOT_WIDTH, BUTTON_HEIGHT));
  }

  private createSlotButton(x: number, y: number, slot: number): Phaser.GameObjects.GameObject[] {
    const panel = this.add.nineslice(
      x,
      y,
      INVENTORY_PANEL_KEY,
      INVENTORY_PANEL_FRAME_NAME,
      SLOT_WIDTH,
      SLOT_HEIGHT,
      INVENTORY_PANEL_BORDER,
      INVENTORY_PANEL_BORDER,
      INVENTORY_PANEL_BORDER,
      INVENTORY_PANEL_BORDER,
    );
    panel.setOrigin(0.5, 0.5);
    panel.setDepth(1);
    panel.setInteractive({ useHandCursor: true });

    const label = this.add.text(x, y, '', {
      fontFamily: TEXT_FONT,
      fontSize: '13px',
      fontStyle: 'bold',
      color: TEXT_COLOR,
      stroke: TEXT_STROKE,
      strokeThickness: 2,
      align: 'center',
    });
    label.setOrigin(0.5, 0.5);
    label.setDepth(2);

    panel.on('pointerdown', () => {
      playClick(this);
      this.selectSlot(slot);
    });

    return [panel, label];
  }

  // --- Excluir save -------------------------------------------------------

  private createDeleteButton(x: number, y: number, slot: number): Phaser.GameObjects.Image {
    const icon = this.add.image(x, y, CLOSE_BUTTON_SHEET_KEY, DELETE_ICON_FRAME.name);
    icon.setScale(DELETE_ICON_SCALE);
    icon.setDepth(3); // Acima do painel do slot (1) e do texto (2): o clique na lixeira nunca chega no painel.

    const pad = DELETE_ICON_HIT_PADDING;
    icon.setInteractive({
      useHandCursor: true,
      hitArea: new Phaser.Geom.Rectangle(-pad, -pad, DELETE_ICON_OPEN_FRAME.rect.width + pad * 2, DELETE_ICON_OPEN_FRAME.rect.height + pad * 2),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
    });
    icon.on('pointerover', () => icon.setFrame(DELETE_ICON_OPEN_FRAME.name));
    icon.on('pointerout', () => icon.setFrame(DELETE_ICON_FRAME.name));
    icon.on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      if (this.transitioning) return;
      playClick(this);
      this.askToDelete(slot);
    });

    icon.setVisible(false);
    icon.disableInteractive();
    return icon;
  }

  /** Mostra (e ativa o clique de) a lixeira só nos slots que têm save; esconde nas outras telas e nos slots vazios. */
  private updateDeleteButtons(slotsVisible: boolean): void {
    const summaries = slotsVisible ? getAllSlotSummaries() : [];
    this.deleteButtons.forEach((icon, slot) => {
      const show = slotsVisible && !summaries[slot].empty;
      icon.setFrame(DELETE_ICON_FRAME.name);
      icon.setVisible(show);
      if (show) icon.setInteractive();
      else icon.disableInteractive();
    });
  }

  /** Diálogo de confirmação (ação irreversível): tampa a tela inteira, e só "EXCLUIR" apaga — Esc/"CANCELAR" fecham sem mexer no save. */
  private askToDelete(slot: number): void {
    if (this.dialogObjects.length > 0) return;
    const summary = getAllSlotSummaries()[slot];
    if (summary.empty) return;

    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;

    const shield = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.6);
    shield.setOrigin(0, 0);
    shield.setDepth(DIALOG_DEPTH);
    shield.setInteractive(); // Engole os cliques: nada por baixo (slots, lixeiras) reage com o diálogo aberto.

    const panel = this.add.nineslice(
      centerX,
      centerY,
      INVENTORY_PANEL_KEY,
      INVENTORY_PANEL_FRAME_NAME,
      DIALOG_WIDTH,
      DIALOG_HEIGHT,
      INVENTORY_PANEL_BORDER,
      INVENTORY_PANEL_BORDER,
      INVENTORY_PANEL_BORDER,
      INVENTORY_PANEL_BORDER,
    );
    panel.setDepth(DIALOG_DEPTH + 1);

    const title = this.add.text(centerX, centerY - 66, `EXCLUIR O SLOT ${slot + 1}?`, {
      fontFamily: TEXT_FONT,
      fontSize: '16px',
      fontStyle: 'bold',
      color: DIALOG_INK,
    });
    title.setOrigin(0.5, 0.5);
    title.setDepth(DIALOG_DEPTH + 2);

    const body = this.add.text(
      centerX,
      centerY - 20,
      `${summary.playerName} — ${summary.farmName}\nDia ${summary.day} · ${summary.coins} moedas\n\nEssa ação não pode ser desfeita.`,
      { fontFamily: TEXT_FONT, fontSize: '13px', color: DIALOG_INK, align: 'center' },
    );
    body.setOrigin(0.5, 0.5);
    body.setDepth(DIALOG_DEPTH + 2);

    const buttonY = centerY + 62;
    const cancel = this.createButton(centerX - 90, buttonY, 'CANCELAR', () => this.closeDialog(), 150, BUTTON_HEIGHT);
    const confirm = this.createButton(centerX + 90, buttonY, 'EXCLUIR', () => {
      deleteSave(slot);
      this.closeDialog();
      this.refreshSlotLabels();
      this.updateDeleteButtons(true);
    }, 150, BUTTON_HEIGHT);
    for (const object of [...cancel, ...confirm]) (object as Phaser.GameObjects.Image).setDepth(DIALOG_DEPTH + 2);

    this.dialogObjects = [shield, panel, title, body, ...cancel, ...confirm];
    this.input.keyboard!.once('keydown-ESC', () => this.closeDialog());
  }

  private closeDialog(): void {
    for (const object of this.dialogObjects) object.destroy();
    this.dialogObjects = [];
  }

  /** Reflete `SaveManager.getSlotSummary` no texto de cada slot — chamado toda vez que a tela de slots aparece, pra nunca mostrar dado desatualizado (ex.: acabou de salvar e voltou pro menu). */
  private refreshSlotLabels(): void {
    for (const summary of getAllSlotSummaries()) {
      this.slotLabels[summary.slot].setText(this.describeSlot(summary));
    }
  }

  private describeSlot(summary: SaveSlotSummary): string {
    if (summary.empty) return `Slot ${summary.slot + 1}\nVazio — Nova Partida`;
    return `${summary.playerName} — ${summary.farmName}\nSlot ${summary.slot + 1} · Dia ${summary.day} · ${summary.coins} moedas`;
  }

  private selectSlot(slot: number): void {
    const summary = getAllSlotSummaries()[slot];
    if (summary.empty) {
      // Quem inicia a partida nova (e grava o slot) é a Criação de Personagem, depois dos nomes.
      this.scene.start(CHARACTER_CREATION_SCENE_KEY, { slot });
      return;
    }
    const loaded = loadSave(slot);
    if (!loaded) startNewGame(slot); // Save corrompido — mesma rede de segurança de `getSlotSummary`, nunca trava o menu.
    this.scene.start(MAIN_SCENE_KEY);
  }

  // --- Alternância entre as duas telas -------------------------------------

  private showRoot(): void {
    for (const button of this.menuButtons) this.resetButton(button);
    this.setGroupVisible(this.rootObjects, true);
    this.setGroupVisible(this.slotsObjects, false);
    this.updateDeleteButtons(false);
  }

  private showSlots(): void {
    this.refreshSlotLabels();
    this.setGroupVisible(this.rootObjects, false);
    this.setGroupVisible(this.slotsObjects, true);
    this.updateDeleteButtons(true);
  }

  private setGroupVisible(objects: Phaser.GameObjects.GameObject[], visible: boolean): void {
    for (const object of objects) {
      const target = object as Phaser.GameObjects.Image;
      target.setVisible(visible);
      // Só retângulos/painéis (`background`/`panel`) têm `input` — textos nunca chamam `setInteractive`, então `.input` fica `undefined` neles e o `if` abaixo não faz nada.
      if (!target.input) continue;
      if (visible) target.setInteractive({ useHandCursor: true });
      else target.disableInteractive();
    }
  }

  // --- Botão genérico (mesmo padrão de `ui/pauseMenu.ts`) ------------------

  private createButton(
    x: number,
    y: number,
    label: string,
    onClick: () => void,
    width = BUTTON_WIDTH,
    height = BUTTON_HEIGHT,
  ): Phaser.GameObjects.GameObject[] {
    const background = this.add.rectangle(x, y, width, height, 0x2c2c2c, 0.95);
    background.setStrokeStyle(2, 0x6f5a3a, 1);
    background.setDepth(1);
    background.setInteractive({ useHandCursor: true });
    background.on('pointerover', () => background.setFillStyle(0x4a3a24, 0.95));
    background.on('pointerout', () => background.setFillStyle(0x2c2c2c, 0.95));
    background.on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      playClick(this);
      onClick();
    });

    const text = this.add.text(x, y, label, {
      fontFamily: TEXT_FONT,
      fontSize: '14px',
      fontStyle: 'bold',
      color: TEXT_COLOR,
      stroke: TEXT_STROKE,
      strokeThickness: 2,
    });
    text.setOrigin(0.5, 0.5);
    text.setDepth(2);

    return [background, text];
  }
}
