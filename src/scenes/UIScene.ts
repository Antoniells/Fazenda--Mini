import Phaser from 'phaser';
import { gameState } from '../systems/gameState';
import { Hotbar } from '../ui/hotbar';
import { TimeMoneyHud } from '../ui/timeMoneyHud';
import { HealthHud } from '../ui/healthHud';
import { ArmorHud } from '../ui/armorHud';
import { WeatherOverlay } from '../ui/weatherOverlay';
import { SKILLS, SKILLS_TAB_ICON } from '../data/skills';
import { RAIN_KEY, RAIN_PATH, RAIN_FRAME_SIZE, SPLASH_KEY, SPLASH_PATH, SPLASH_FRAME_SIZE } from '../data/effects';
import { PLAYER_ATE_EVENT } from '../systems/eating';
import { dayMusic } from '../systems/dayMusic';
import { HEALTH_HEARTS_KEY, HEALTH_HEARTS_PATH, ARMOR_HUD_KEY, ARMOR_HUD_PATH, INVENTORY_PANEL_KEY, INVENTORY_PANEL_PATH, INVENTORY_LARGE_PANEL_KEY, INVENTORY_LARGE_PANEL_PATH } from '../data/ui';
import { InventoryScreen } from '../ui/inventoryScreen';
import { FurnaceMenu } from '../ui/furnaceMenu';
import { ChestMenu } from '../ui/chestMenu';
import { LetterPanel } from '../ui/letterPanel';
import { DialoguePanel, OPEN_DIALOGUE_EVENT, DialoguePayload } from '../ui/dialoguePanel';
import { QuestTracker } from '../ui/questTracker';
import { describeObjective } from '../systems/campaign';
import { WATER_OBJECTIVE_TEXT } from '../data/tutorial';
import { TutorialPanel } from '../ui/tutorialPanel';
import { tutorial } from '../systems/tutorial';
import { playEffect } from '../systems/soundEffects';
import { CHEST_SOUND, CRAFT_SOUND } from '../data/audio';
import { OPEN_LETTER_EVENT, OpenLetterPayload } from '../systems/petBox';
import { OPEN_CHEST_MENU_EVENT, OpenChestMenuPayload } from '../systems/furniturePlacement';
import { Tooltip } from '../ui/tooltip';
import { FURNACE_SMELTED_EVENT, OPEN_FURNACE_MENU_EVENT } from '../systems/decorationPlacement';
import { SMELT_COAL_AMOUNT, SMELT_FUEL_ID, SMELT_ORE_AMOUNT, getSmeltingRecipe } from '../data/smelting';
import { resourceDisplayName } from '../data/resources';
import { popText } from '../systems/floatingText';

export const UI_SCENE_KEY = 'UIScene';
/** Emitido (via `scene.game.events`) sempre que o slot ativo da Hotbar muda — quem mutou o `Inventory` é sempre quem emite, ver `UIScene`/`MainScene`. Outras cenas (ex.: `MainScene`, pra reagir com posicionamento de decoração) escutam este evento em vez de conhecer a `UIScene`. */
export const HOTBAR_CHANGED_EVENT = 'hotbar-changed';

/**
 * Garante que a `UIScene` esteja rodando por cima da cena de mapa atual —
 * chamada no início do `create()` de toda cena de mapa (`MainScene` e as
 * cenas externas, ver `scenes/ExternalMapScene.ts`). `launch` (não
 * `start`) roda a `UIScene` em PARALELO, sem parar a cena que chamou.
 *
 * `UIScene` está listada em `config/gameConfig.ts` (`scene: [...]`), então
 * o Phaser já registra a chave em `manager.keys` no boot do jogo, ANTES de
 * ela ser lançada pela primeira vez — `manager.keys[UI_SCENE_KEY]` sozinho
 * não diz se ela já rodou `create()` algum dia, só se já foi registrada.
 * Checar isso (versão anterior) fazia o primeiro `ensureUIScene` nunca
 * chamar `launch`, e a HUD nunca aparecia.
 *
 * `isActive()` sozinho (só true quando `status === RUNNING`) também não
 * basta: numa transição rápida entre cenas, a `UIScene` pode estar no meio
 * de `START`/`LOADING`/`CREATING` (launch anterior ainda em andamento) e
 * `isActive()` devolve `false` nesse meio-tempo, levando a chamar `launch`
 * de novo e duplicar a instância (Hotbar/HUD repetidos).
 *
 * Por isso o `status` bruto da cena decide: só chama `launch` se ela nunca
 * rodou (`INIT`, o estado logo após o registro em `gameConfig`) ou já foi
 * totalmente parada (`SHUTDOWN`) — nunca durante um `launch` já em curso.
 */
export function ensureUIScene(scene: Phaser.Scene): void {
  const manager = scene.scene.manager;
  const uiScene = manager.keys[UI_SCENE_KEY];
  const status = uiScene?.sys.settings.status;
  const neverStartedOrStopped = status === undefined || status === Phaser.Scenes.INIT || status === Phaser.Scenes.SHUTDOWN;

  if (neverStartedOrStopped) {
    scene.scene.launch(UI_SCENE_KEY);
  } else if (manager.isSleeping(UI_SCENE_KEY)) {
    scene.scene.wake(UI_SCENE_KEY);
  }
  scene.scene.bringToTop(UI_SCENE_KEY);
}

/**
 * Referência ao `InventoryScreen` único, criado dentro de `UIScene.create()`
 * (Fase 8 — Interface): igual a `Hotbar`/`TimeMoneyHud`, só pode existir
 * atrelado a uma `Phaser.Scene` (usa `scene.add.image`/`.text`), por isso
 * não mora em `gameState` (módulo puro, sem cena). As funções abaixo deixam
 * qualquer cena de mapa (`MainScene` e as 4 cenas externas) abrir/fechar/
 * consultar o Inventário sem precisar conhecer a `UIScene` diretamente —
 * mesmo padrão de `ensureUIScene`/`HOTBAR_CHANGED_EVENT`.
 *
 * Só fica `null` antes da primeira `UIScene.create()` rodar — como
 * `scene.launch` enfileira a criação para o próximo passo do jogo (não é
 * síncrono), qualquer cena de mapa que chame `ensureUIScene` no início do
 * próprio `create()` só volta a interagir com isto depois (clique/tecla do
 * jogador, sempre bem depois do boot), então na prática nunca é `null` no
 * momento em que essas funções são realmente chamadas.
 */
let sharedInventoryScreen: InventoryScreen | null = null;

/** Se o Inventário está aberto no momento — usado por qualquer cena de mapa para bloquear movimento/clique no mundo enquanto ele está em primeiro plano. */
export function isInventoryOpen(): boolean {
  return sharedInventoryScreen?.isOpen() ?? false;
}

/** Alterna o Inventário (tecla E) — chamado por qualquer cena de mapa. */
export function toggleInventoryScreen(): void {
  sharedInventoryScreen?.toggle(gameState.inventory);
}

/** Fecha o Inventário (ex.: tecla ESC) — no-op se já estiver fechado. */
export function closeInventoryScreen(): void {
  sharedInventoryScreen?.close();
}

/** Mesma ideia de `sharedInventoryScreen`, para a tela da Fornalha (`ui/furnaceMenu.ts`). */
let sharedFurnaceMenu: FurnaceMenu | null = null;

/** Se a tela da Fornalha está aberta no momento — usado por qualquer cena de mapa para bloquear movimento/clique no mundo enquanto ela está em primeiro plano. */
export function isFurnaceMenuOpen(): boolean {
  return sharedFurnaceMenu?.isOpen() ?? false;
}

/** Alterna a tela da Fornalha — chamado ao interagir com uma decoração `furnace` posicionada. */
export function toggleFurnaceMenu(): void {
  sharedFurnaceMenu?.toggle(gameState.inventory);
}

/** Fecha a tela da Fornalha (ex.: tecla ESC) — no-op se já estiver fechada. */
export function closeFurnaceMenu(): void {
  sharedFurnaceMenu?.close();
}

/** Mesma ideia, para o painel da carta (evento do pet, `ui/letterPanel.ts`). */
let sharedLetterPanel: LetterPanel | null = null;

/** Se a carta está aberta — a cena de mapa trava movimento/clique no mundo enquanto ela está em primeiro plano. */
export function isLetterOpen(): boolean {
  return sharedLetterPanel?.isOpen() ?? false;
}

/** Mesma ideia, para o painel de conversa com os moradores (`ui/dialoguePanel.ts`). */
let sharedDialoguePanel: DialoguePanel | null = null;

/** Se há uma conversa aberta — a cena de mapa trava movimento/clique no mundo enquanto ela está em primeiro plano. */
export function isDialogueOpen(): boolean {
  return sharedDialoguePanel?.isOpen() ?? false;
}

/** Fecha a conversa (ex.: tecla ESC) — no-op se já estiver fechada. */
export function closeDialogue(): void {
  sharedDialoguePanel?.close();
}

/** Mesma ideia, para a tela do Baú (`ui/chestMenu.ts`) — aberta ao interagir com um baú da casa. */
let sharedChestMenu: ChestMenu | null = null;

/** Se a tela do Baú está aberta — a casa trava movimento/clique no mundo enquanto ela está em primeiro plano. */
export function isChestMenuOpen(): boolean {
  return sharedChestMenu?.isOpen() ?? false;
}

/** Fecha a tela do Baú (ex.: tecla ESC) — no-op se já estiver fechada. */
export function closeChestMenu(): void {
  sharedChestMenu?.close();
}

/**
 * Cena de UI persistente (Sistema de Cenas): antes, `Hotbar` e
 * `TimeMoneyHud` eram criados dentro de `MainScene.create()` — quando essa
 * cena era destruída/recriada (`scene.start`, ao atravessar uma ponte),
 * eles sumiam e voltavam do zero. Como uma `Phaser.Scene` própria, rodando
 * em paralelo (`scene.launch`, nunca `scene.start`) por cima de qualquer
 * cena de mapa ativa, esta cena só é criada UMA VEZ (ver `ensureUIScene`) e
 * nunca é reiniciada pelas trocas de mapa.
 *
 * Lê sempre do `gameState` compartilhado (não de um `Inventory`/`GameClock`
 * dono de cena) — é o que permite o saldo/estoque continuarem os mesmos
 * atravessando uma ponte. Não sabe nada sobre lavoura, loja ou
 * posicionamento de decoração (isso continua em `MainScene`); a única
 * ponte entre as duas é o evento `HOTBAR_CHANGED_EVENT`.
 */
export class UIScene extends Phaser.Scene {
  private hotbar!: Hotbar;
  private timeMoneyHud!: TimeMoneyHud;
  private healthHud!: HealthHud;
  private armorHud!: ArmorHud;
  private weatherOverlay!: WeatherOverlay;
  private inventoryScreen!: InventoryScreen;
  private furnaceMenu!: FurnaceMenu;
  private chestMenu!: ChestMenu;
  private letterPanel!: LetterPanel;
  private dialoguePanel!: DialoguePanel;
  private questTracker!: QuestTracker;

  constructor() {
    super(UI_SCENE_KEY);
  }

  preload(): void {
    // Auto-suficiente (mesma ideia de `MainMenuScene.preload`): os corações
    // da vida não dependem de nenhuma cena de mapa já ter carregado isto.
    this.load.image(HEALTH_HEARTS_KEY, encodeURI(`/${HEALTH_HEARTS_PATH}`));
    this.load.image(ARMOR_HUD_KEY, encodeURI(`/${ARMOR_HUD_PATH}`));
    // Molduras de papel dos painéis de conversa/carta/aviso (a Fazenda também as carrega, mas a UIScene não depende disso).
    this.load.image(INVENTORY_PANEL_KEY, encodeURI(`/${INVENTORY_PANEL_PATH}`));
    this.load.image(INVENTORY_LARGE_PANEL_KEY, encodeURI(`/${INVENTORY_LARGE_PANEL_PATH}`));
    // Ícones das habilidades e da aba "Habilidades" do Inventário (recortes de `Icons/RPG icons/...`, ver `data/skills.ts`).
    for (const icon of [SKILLS_TAB_ICON, ...SKILLS.map((skill) => skill.icon)]) {
      if (!this.textures.exists(icon.key)) this.load.image(icon.key, encodeURI(`/${icon.path}`));
    }
    this.load.spritesheet(RAIN_KEY, encodeURI(`/${RAIN_PATH}`), { frameWidth: RAIN_FRAME_SIZE, frameHeight: RAIN_FRAME_SIZE });
    // Respingo das gotas batendo (o mesmo de regar — a Fazenda já carrega, mas a UIScene não pode depender disso).
    if (!this.textures.exists(SPLASH_KEY)) {
      this.load.spritesheet(SPLASH_KEY, encodeURI(`/${SPLASH_PATH}`), { frameWidth: SPLASH_FRAME_SIZE, frameHeight: SPLASH_FRAME_SIZE });
    }
  }

  create(): void {
    // Música de fundo do dia (fade in às 06:00, fade out ao anoitecer/dormir): a UIScene existe durante toda a partida, em qualquer mapa.
    dayMusic.enable(this.game);

    // Balão com o nome do item sob o mouse: um só, compartilhado pela Hotbar e pelo Inventário.
    const tooltip = new Tooltip(this);

    this.hotbar = new Hotbar(this, (index) => this.requestHotbarSelect(index), tooltip);
    this.hotbar.refresh(gameState.inventory);

    this.timeMoneyHud = new TimeMoneyHud(this);
    this.timeMoneyHud.refreshTime(gameState.gameClock.getDay(), gameState.gameClock.getTimeString(), gameState.gameClock.getHours());
    this.timeMoneyHud.refreshCoins(gameState.inventory.getCoins());

    this.healthHud = new HealthHud(this);
    this.healthHud.refresh(gameState.playerHealth.getHp(), gameState.playerHealth.getMaxHp());

    // Chuva: véu cinza + partículas por cima do mundo, em qualquer mapa (ver `ui/weatherOverlay.ts`).
    this.weatherOverlay = new WeatherOverlay(this);
    this.weatherOverlay.refresh(gameState.weather.raining);

    this.armorHud = new ArmorHud(this);
    this.armorHud.refresh(gameState.inventory.getDefense());

    // Mesma mutação central usada pelo teclado/scroll (`requestHotbarSelect`)
    // — clicar num slot da aba Mochila é só mais um jeito de trocar o slot.
    this.inventoryScreen = new InventoryScreen(this, (index) => this.requestHotbarSelect(index), tooltip);
    sharedInventoryScreen = this.inventoryScreen;

    this.furnaceMenu = new FurnaceMenu(this, (recipeId) => this.smelt(recipeId));
    sharedFurnaceMenu = this.furnaceMenu;

    this.chestMenu = new ChestMenu(this, () => gameState.inventory);
    sharedChestMenu = this.chestMenu;
    // Baú da casa: o móvel dispara este evento GLOBAL (`game.events`, mesmo padrão da Fornalha) com o id do baú e o "recolher".
    const onOpenChestMenu = (payload: OpenChestMenuPayload): void => {
      playEffect(this, CHEST_SOUND);
      this.chestMenu.open(payload.chestId, payload.onPickUp);
    };
    this.game.events.on(OPEN_CHEST_MENU_EVENT, onOpenChestMenu);

    // Carta da caixa do pet: a caixa dispara o evento GLOBAL com o texto e o que fazer depois de lida.
    this.letterPanel = new LetterPanel(this);
    sharedLetterPanel = this.letterPanel;
    const onOpenLetter = (payload: OpenLetterPayload): void => this.letterPanel.open(payload.title, payload.body, payload.buttonLabel, payload.heart, payload.onRead);
    this.game.events.on(OPEN_LETTER_EVENT, onOpenLetter);

    // Conversa com os moradores do Vilarejo: o sistema de NPCs dispara o evento GLOBAL com a fala e as escolhas.
    this.dialoguePanel = new DialoguePanel(this);
    sharedDialoguePanel = this.dialoguePanel;
    const onOpenDialogue = (payload: DialoguePayload): void => this.dialoguePanel.open(payload);
    this.game.events.on(OPEN_DIALOGUE_EVENT, onOpenDialogue);
    this.input.keyboard!.on('keydown-ESC', () => this.dialoguePanel.close());

    // Marcador do objetivo (missão atual da campanha), canto superior esquerdo.
    this.questTracker = new QuestTracker(this);

    // Tutorial de novos jogadores: o painel se redesenha sozinho a cada mudança do gerenciador (`systems/tutorial.ts`).
    new TutorialPanel(this);

    // Fornalha posicionada no mundo: `PlacedDecorationInteractable` dispara este
    // evento GLOBAL (`scene.game.events`, não `scene.events`) ao interagir
    // com ela — evita `systems/decorationPlacement.ts` (mundo) precisar
    // importar `scenes/UIScene.ts` (interface) diretamente, na direção
    // errada da arquitetura. Reaproveita `toggleFurnaceMenu` (mesma função
    // exportada que qualquer cena já usaria) em vez de duplicar a lógica.
    const onOpenFurnaceMenu = (): void => toggleFurnaceMenu();
    this.game.events.on(OPEN_FURNACE_MENU_EVENT, onOpenFurnaceMenu);

    this.setupHotbarKeys();
    this.setupHotbarWheelScroll();
    // Comer é uma ação do personagem (`systems/eating.ts`, tecla F no
    // `PlayerController`, vale em qualquer mapa): quando ele TERMINA de comer,
    // a UIScene só redesenha corações e Hotbar.
    const onPlayerAte = (): void => this.refresh();
    this.game.events.on(PLAYER_ATE_EVENT, onPlayerAte);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(PLAYER_ATE_EVENT, onPlayerAte);
      if (sharedInventoryScreen === this.inventoryScreen) sharedInventoryScreen = null;
      if (sharedFurnaceMenu === this.furnaceMenu) sharedFurnaceMenu = null;
      if (sharedChestMenu === this.chestMenu) sharedChestMenu = null;
      this.game.events.off(OPEN_FURNACE_MENU_EVENT, onOpenFurnaceMenu);
      this.game.events.off(OPEN_CHEST_MENU_EVENT, onOpenChestMenu);
      if (sharedLetterPanel === this.letterPanel) sharedLetterPanel = null;
      this.game.events.off(OPEN_LETTER_EVENT, onOpenLetter);
      if (sharedDialoguePanel === this.dialoguePanel) sharedDialoguePanel = null;
      this.game.events.off(OPEN_DIALOGUE_EVENT, onOpenDialogue);
    });
  }

  /**
   * Funde UMA barra na Fornalha: único ponto que de fato gasta `SMELT_ORE_AMOUNT` minérios brutos + `SMELT_COAL_AMOUNT` Carvões e entrega a barra — o `FurnaceMenu` só pede (`onSmelt`), nunca muta
   * o `Inventory` sozinho. Revalida os materiais aqui em vez de confiar no clique (a tela já apaga o que falta, mas a mutação real não pode depender só da UI). Ao fundir, avisa as Fornalhas do
   * mundo (`FURNACE_SMELTED_EVENT`) pra acenderem o fogo.
   */
  private smelt(recipeId: string): void {
    const recipe = getSmeltingRecipe(recipeId);
    if (!recipe) return;
    const inventory = gameState.inventory;
    if (inventory.getResourceCount(recipe.oreId) < SMELT_ORE_AMOUNT || inventory.getResourceCount(SMELT_FUEL_ID) < SMELT_COAL_AMOUNT) {
      console.log('Materiais insuficientes para fundir.');
      return;
    }

    inventory.useResource(recipe.oreId, SMELT_ORE_AMOUNT);
    inventory.useResource(SMELT_FUEL_ID, SMELT_COAL_AMOUNT);
    inventory.addResources(recipe.barId, 1);
    console.log(`Fundido: 1 ${resourceDisplayName(recipe.barId)}.`);
    playEffect(this, CRAFT_SOUND);
    popText(this, this.scale.width / 2, this.scale.height / 2 - 150, `+1 ${resourceDisplayName(recipe.barId)}`, { color: '#ffd98a', fontSize: 18, screenFixed: true });
    this.game.events.emit(FURNACE_SMELTED_EVENT);

    this.furnaceMenu.refresh(inventory);
    this.hotbar.refresh(inventory);
  }

  /** Único ponto que muta o slot selecionado — qualquer gatilho (teclado/scroll aqui, clique na linha de cima do Inventário em `MainScene`) passa por aqui. */
  private requestHotbarSelect(index: number): void {
    if (!tutorial.allows({ kind: 'hotbar', index })) return; // Tutorial: só o item que o passo pede.
    gameState.inventory.selectHotbarSlot(index);
    this.hotbar.refresh(gameState.inventory);
    this.game.events.emit(HOTBAR_CHANGED_EVENT, index);
    tutorial.notify({ kind: 'select' });
  }

  /** Teclas 1-8 selecionam o slot correspondente da Hotbar — funciona em qualquer mapa, não só na Fazenda. */
  private setupHotbarKeys(): void {
    const keys = ['keydown-ONE', 'keydown-TWO', 'keydown-THREE', 'keydown-FOUR', 'keydown-FIVE', 'keydown-SIX', 'keydown-SEVEN', 'keydown-EIGHT'];
    keys.forEach((event, index) => {
      this.input.keyboard!.on(event, () => this.requestHotbarSelect(index));
    });
  }

  /** Scroll do mouse também troca o slot ativo — avança/retrocede circularmente entre 0 e 7. */
  private setupHotbarWheelScroll(): void {
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _go: unknown, _dx: number, dy: number) => {
      const current = gameState.inventory.getSelectedHotbarIndex();
      const next = (current + (dy > 0 ? 1 : -1) + 8) % 8;
      this.requestHotbarSelect(next);
    });
  }

  /** Chamado por quem já mutou `gameState.inventory`/`gameState.gameClock` diretamente (compra, venda, relógio) — não passa pelo evento porque não é uma troca de SLOT, só um valor mudando. */
  refresh(): void {
    this.hotbar.refresh(gameState.inventory);
    this.timeMoneyHud.refreshCoins(gameState.inventory.getCoins());
    this.timeMoneyHud.refreshTime(gameState.gameClock.getDay(), gameState.gameClock.getTimeString(), gameState.gameClock.getHours());
    this.healthHud.refresh(gameState.playerHealth.getHp(), gameState.playerHealth.getMaxHp());
    this.armorHud.refresh(gameState.inventory.getDefense());
    this.weatherOverlay.refresh(gameState.weather.raining);
    if (this.inventoryScreen.isOpen()) this.inventoryScreen.refresh(gameState.inventory);
    if (this.furnaceMenu.isOpen()) this.furnaceMenu.refresh(gameState.inventory);
    if (this.chestMenu.isOpen()) this.chestMenu.refresh();
    // Objetivo: só depois do tutorial (o painel dele já ocupa a tela) e enquanto a campanha não acabou.
    // O objetivo da água sai sozinho quando o regador é enchido (no poço da Vila ou da Fazenda).
    if (gameState.waterObjective && gameState.inventory.getWateringCanCharges() > 0) gameState.waterObjective = false;
    const objectives = [gameState.waterObjective ? WATER_OBJECTIVE_TEXT : null, describeObjective()].filter((line): line is string => line !== null);
    this.questTracker.refresh(gameState.tutorialCompleted && objectives.length > 0 ? objectives.map((line) => `• ${line}`).join('\n') : null);
  }

  update(): void {
    this.refresh();
  }
}
