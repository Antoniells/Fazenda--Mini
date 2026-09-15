import Phaser from 'phaser';
import { gameState } from '../systems/gameState';
import { Hotbar } from '../ui/hotbar';
import { TimeMoneyHud } from '../ui/timeMoneyHud';
import { InventoryScreen } from '../ui/inventoryScreen';

export const UI_SCENE_KEY = 'UIScene';
/** Emitido (via `scene.game.events`) sempre que o slot ativo da Hotbar muda — quem mutou o `Inventory` é sempre quem emite, ver `UIScene`/`MainScene`. Outras cenas (ex.: `MainScene`, pra reagir com posicionamento de decoração) escutam este evento em vez de conhecer a `UIScene`. */
export const HOTBAR_CHANGED_EVENT = 'hotbar-changed';

/**
 * Garante que a `UIScene` esteja rodando por cima da cena de mapa atual —
 * chamada no início do `create()` de toda cena de mapa (`MainScene` e as
 * cenas externas, ver `scenes/ExternalMapScene.ts`). `launch` (não
 * `start`) roda a `UIScene` em PARALELO, sem parar a cena que chamou.
 *
 * Correção de segurança pedida pelo usuário: `isActive()` sozinho não
 * basta — numa transição rápida entre cenas, a `UIScene` pode estar
 * registrada mas ainda não `active` (ou dormindo), e `isActive()` nesse
 * meio-tempo devolve `false`, levando a chamar `launch` de novo e duplicar
 * a instância (Hotbar/HUD repetidos). Em vez disso: `manager.keys` diz se
 * a cena já existe DE VERDADE (registrada) — só usa `launch` se nunca
 * existiu; se existe mas está dormindo (`isSleeping`), `wake` em vez de
 * relançar.
 */
export function ensureUIScene(scene: Phaser.Scene): void {
  const manager = scene.scene.manager;
  if (!manager.keys[UI_SCENE_KEY]) {
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

    this.setupHotbarKeys();
    this.setupHotbarWheelScroll();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (sharedInventoryScreen === this.inventoryScreen) sharedInventoryScreen = null;
    });
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
  }

  update(): void {
    this.refresh();
  }
}
