import Phaser from 'phaser';
import { gameState } from '../systems/gameState';
import { Hotbar } from '../ui/hotbar';
import { TimeMoneyHud } from '../ui/timeMoneyHud';
import { InventoryScreen } from '../ui/inventoryScreen';
import { CraftingMenu } from '../ui/craftingMenu';
import { OPEN_CRAFTING_MENU_EVENT } from '../systems/decorationPlacement';
import { RECIPES } from '../data/recipes';
import { resolveSlotVisual } from '../data/items';

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

/** Mesma ideia de `sharedInventoryScreen`, para a Bancada de Trabalho (Fase 8 — Crafting, ver `ui/craftingMenu.ts`). */
let sharedCraftingMenu: CraftingMenu | null = null;

/** Se a Bancada de Trabalho está aberta no momento — usado por qualquer cena de mapa para bloquear movimento/clique no mundo enquanto ela está em primeiro plano. */
export function isCraftingMenuOpen(): boolean {
  return sharedCraftingMenu?.isOpen() ?? false;
}

/** Alterna a Bancada de Trabalho — chamado ao interagir com uma decoração `workbench` posicionada. */
export function toggleCraftingMenu(): void {
  sharedCraftingMenu?.toggle(gameState.inventory);
}

/** Fecha a Bancada de Trabalho (ex.: tecla ESC) — no-op se já estiver fechada. */
export function closeCraftingMenu(): void {
  sharedCraftingMenu?.close();
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
  private inventoryScreen!: InventoryScreen;
  private craftingMenu!: CraftingMenu;

  constructor() {
    super(UI_SCENE_KEY);
  }

  create(): void {
    this.hotbar = new Hotbar(this, (index) => this.requestHotbarSelect(index));
    this.hotbar.refresh(gameState.inventory);

    this.timeMoneyHud = new TimeMoneyHud(this);
    this.timeMoneyHud.refreshTime(gameState.gameClock.getDay(), gameState.gameClock.getTimeString());
    this.timeMoneyHud.refreshCoins(gameState.inventory.getCoins());

    // Mesma mutação central usada pelo teclado/scroll (`requestHotbarSelect`)
    // — clicar num slot da aba Mochila é só mais um jeito de trocar o slot.
    this.inventoryScreen = new InventoryScreen(this, (index) => this.requestHotbarSelect(index));
    sharedInventoryScreen = this.inventoryScreen;

    this.craftingMenu = new CraftingMenu(this, (recipeId) => this.craftItem(recipeId));
    sharedCraftingMenu = this.craftingMenu;

    // Bancada de Trabalho posicionada no mundo (Fase 8 — Crafting, pedido
    // explícito do usuário): `PlacedDecorationInteractable` dispara este
    // evento GLOBAL (`scene.game.events`, não `scene.events`) ao interagir
    // com ela — evita `systems/decorationPlacement.ts` (mundo) precisar
    // importar `scenes/UIScene.ts` (interface) diretamente, na direção
    // errada da arquitetura. Reaproveita `toggleCraftingMenu` (mesma função
    // exportada que qualquer cena já usaria) em vez de duplicar a lógica.
    const onOpenCraftingMenu = (): void => toggleCraftingMenu();
    this.game.events.on(OPEN_CRAFTING_MENU_EVENT, onOpenCraftingMenu);

    this.setupHotbarKeys();
    this.setupHotbarWheelScroll();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (sharedInventoryScreen === this.inventoryScreen) sharedInventoryScreen = null;
      if (sharedCraftingMenu === this.craftingMenu) sharedCraftingMenu = null;
      this.game.events.off(OPEN_CRAFTING_MENU_EVENT, onOpenCraftingMenu);
    });
  }

  /**
   * Fabrica o item de uma receita já desbloqueada (Fase 8 — Crafting):
   * único ponto que de fato debita `ingredients` e dá o item ao jogador —
   * o `CraftingMenu` só pede (`onCraft`), nunca muta o `Inventory` sozinho,
   * mesmo padrão de `requestHotbarSelect`/`MainScene.buyRecipe`. Revalida
   * tudo de novo aqui (receita desbloqueada, recursos suficientes) em vez
   * de confiar cegamente no clique — o `CraftingMenu` já filtra/escurece
   * isso na tela, mas a mutação real não pode depender só da UI concordar.
   */
  private craftItem(recipeId: string): void {
    const recipe = RECIPES[recipeId];
    if (!recipe) return;
    if (!gameState.inventory.hasRecipe(recipeId)) return;

    const hasAllIngredients = recipe.ingredients.every(
      (ingredient) => gameState.inventory.getResourceCount(ingredient.resourceId) >= ingredient.amount,
    );
    if (!hasAllIngredients) {
      console.log('Recursos insuficientes para fabricar.');
      return;
    }

    for (const ingredient of recipe.ingredients) gameState.inventory.useResource(ingredient.resourceId, ingredient.amount);
    if (recipe.category === 'armor') gameState.inventory.unlockArmor(recipe.itemId);
    else gameState.inventory.unlockTool(recipe.itemId);

    const itemVisual = resolveSlotVisual({ category: recipe.category === 'armor' ? 'armor' : 'tool', id: recipe.itemId });
    console.log(`Fabricado: ${itemVisual?.name ?? recipe.itemId}!`);

    this.craftingMenu.refresh(gameState.inventory);
  }

  /** Único ponto que muta o slot selecionado — qualquer gatilho (teclado/scroll aqui, clique na linha de cima do Inventário em `MainScene`) passa por aqui. */
  private requestHotbarSelect(index: number): void {
    gameState.inventory.selectHotbarSlot(index);
    this.hotbar.refresh(gameState.inventory);
    this.game.events.emit(HOTBAR_CHANGED_EVENT, index);
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
    this.timeMoneyHud.refreshTime(gameState.gameClock.getDay(), gameState.gameClock.getTimeString());
    if (this.inventoryScreen.isOpen()) this.inventoryScreen.refresh(gameState.inventory);
    if (this.craftingMenu.isOpen()) this.craftingMenu.refresh(gameState.inventory);
  }

  update(): void {
    this.refresh();
  }
}
