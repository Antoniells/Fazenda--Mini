import Phaser from 'phaser';
import { remainingQueueMs } from './smelting';
import { clearPlantsUnder } from './plantClearing';
import { DecorationDefinition, DECORATIONS } from '../data/decorations';
import { FarmMapData } from '../data/maps/farmMap';
import { Inventory } from './inventory';
import { InteractionRegistry, Interactable } from './interaction';
import { WalkableGrid } from './grid';
import { Player } from '../entities/Player';
import { PointerInputInterceptor } from './playerController';
import { DISPLAY_SCALE } from './mapBuilder';
import { createGroundShadow } from './shadow';
import { coverageRatio } from './treeOverlap';
import { FarmlandRenderer } from './farmlandRenderer';
import { gameState } from './gameState';
import { resourceNodeRegistry } from './resourceNodeRegistry';
import { FARM_RESOURCES_KEY } from './farmResources';
import { HOE } from '../data/tools';
import { isToolOfFamily } from '../data/toolProgression';
import { spawnLoot } from './lootDrops';
import { canRemoveCoop, collectCoopEggs, coopKey, discardCoop } from './animals';
import { playBreakEffect } from './breakEffect';
import { playSprinklerWater } from './sprinklerWater';
import { farmChestId, discardChest, isChestEmpty } from './chestStorage';
import { OPEN_CHEST_MENU_EVENT, OpenChestMenuPayload } from './furniturePlacement';
import { popText } from './floatingText';
import { sprinklerReachCells } from './sprinklers';
import { playEffect, playRandomEffect } from './soundEffects';
import { OBJECT_BREAK_SOUND, ORE_HIT_SOUNDS, PLACE_SOUND, WATER_SOUND } from '../data/audio';

/** Nome do evento global disparado ao interagir com a Fornalha — ouvido pela `UIScene`, que é quem realmente sabe abrir o `FurnaceMenu` (ver `scenes/UIScene.ts`). Um evento em `scene.game.events` (não `scene.events`) evita este módulo (`systems/`) precisar importar de `scenes/`, na direção errada da arquitetura. */
export const OPEN_FURNACE_MENU_EVENT = 'open-furnace-menu';
/** Disparado pela `UIScene` a cada barra posta na fila da Fornalha, com o tempo (ms) que a fila ainda leva: as Fornalhas posicionadas acendem o fogo por esse tempo (`DecorationPlacementSystem.lightUsedStructures`). */
export const FURNACE_SMELTED_EVENT = 'furnace-smelted';

const GHOST_VALID_TINT = 0x9be89b;
const GHOST_INVALID_TINT = 0xff8a8a;
const GHOST_ALPHA = 0.6;
const GHOST_DEPTH = 950; // Acima do mundo, abaixo dos HUDs (1000+) — mesma faixa do TileCursor.
/** Grid de alcance do aspersor (mesmo visual do grid de colisão de `debugGridOverlay.ts`, só que verde): logo abaixo do fantasma. */
const COVERAGE_DEPTH = GHOST_DEPTH - 1;
const COVERAGE_FILL = 0x22cc44;
const COVERAGE_FILL_ALPHA = 0.35;
const COVERAGE_LINE = 0x9dffb5;
const COVERAGE_LINE_ALPHA = 0.7;
const PLACED_SHADOW_DEPTH = -0.4; // Mesma faixa das sombras estáticas de mapBuilder.ts.

/**
 * Uma decoração já posicionada, quando clicada: por padrão remove-se e
 * devolve 1 unidade ao estoque — mesmo padrão dos outros `Interactable`
 * (Caixa de Remessas, Loja), objeto sólido com interação adjacente já
 * cuidada pelo `PlayerController`. O Poço é a exceção: tem uma utilidade
 * própria (encher o regador, ver `DecorationPlacementSystem.refillWateringCan`),
 * então clicar nele usa em vez de remover.
 *
 * `col`/`row` aqui são sempre a célula-âncora (canto superior-esquerdo do
 * footprint) — a MESMA instância é registrada em todas as células que a
 * construção ocupa (Fase 9, multi-tile), então não importa em qual célula
 * da base o jogador clicou: a ação sempre se refere à construção inteira.
 */
class PlacedDecorationInteractable implements Interactable {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly system: DecorationPlacementSystem,
    private readonly player: Player,
    private readonly col: number,
    private readonly row: number,
    private readonly decorationId: string, // <-- ADICIONADO AQUI
  ) {}

  interact(): void {
    if (this.player.isBusy()) return;

    // Se o objeto clicado for o poço, toca a animação de buscar água (própria, ver PLAYER_ACTIONS.well) e NÃO remove!
    if (this.decorationId === 'well') {
      this.player.performAction('well', () => {
        this.system.refillWateringCan(this.col, this.row);
      });
      return; // <-- O return impede que o poço seja destruído
    }

    // Fornalha: interagir abre a tela de fundição (`ui/furnaceMenu.ts`). Como o Poço e o Galinheiro, ela é uma construção do Marceneiro: sai do mundo só por ele (mover/destruir, `systems/buildFlow.ts`).
    if (this.decorationId === 'furnace') {
      this.scene.game.events.emit(OPEN_FURNACE_MENU_EVENT);
      return;
    }

    // Galinheiro (Fase 7 — Animais): Picareta o quebra (só sem galinhas — não há como devolvê-las); qualquer outra coisa na mão recolhe os ovos.
    if (DECORATIONS[this.decorationId]?.isCoop) {
      const selected = gameState.inventory.getSelectedSlot();
      if (selected?.category === 'tool' && isToolOfFamily(selected.id, 'pickaxe')) {
        if (!canRemoveCoop(coopKey(this.col, this.row))) {
          this.system.warnCoopHasChickens(this.col, this.row);
          return;
        }
        this.player.performAction('pickaxe', () => this.system.removeAt(this.col, this.row, false, true));
        return;
      }
      this.system.collectEggs(this.col, this.row);
      return;
    }

    // Baú na Fazenda (pedido explícito — o baú também pode ficar fora da casa): Picareta quebra (só vazio, senão os itens sumiriam) e
    // qualquer outra coisa na mão abre a tela de transferência (`ui/chestMenu.ts`, por evento). O estoque tem id próprio (`farmChestId`).
    if (DECORATIONS[this.decorationId]?.isChest) {
      const chestId = farmChestId(this.col, this.row);
      const selected = gameState.inventory.getSelectedSlot();
      if (selected?.category === 'tool' && isToolOfFamily(selected.id, 'pickaxe')) {
        if (!isChestEmpty(chestId)) {
          this.system.warnChestNotEmpty(this.col, this.row);
          return;
        }
        this.player.performAction('pickaxe', () => this.system.removeAt(this.col, this.row, false, true));
        return;
      }
      const payload: OpenChestMenuPayload = { chestId, onPickUp: () => this.system.removeAt(this.col, this.row) };
      this.scene.game.events.emit(OPEN_CHEST_MENU_EVENT, payload);
      return;
    }

    // Aspersor: fica travando o terreno pra enxada (`Farmland.setTillLocked`) — com a enxada na mão o clique NÃO faz nada. Só um golpe
    // de PICARETA (qualquer tier) o tira do chão: ele cai como item no chão pra ser recolhido, e o terreno volta a poder ser arado.
    if (DECORATIONS[this.decorationId]?.locksTilling) {
      const selected = gameState.inventory.getSelectedSlot();
      if (selected?.category === 'tool' && selected.id === HOE.id) {
        console.log('Há um aspersor neste bloco — a enxada não age aqui. Bata nele com a Picareta pra tirá-lo.');
        return;
      }
      if (selected?.category !== 'tool' || !isToolOfFamily(selected.id, 'pickaxe')) {
        console.log('Selecione a Picareta pra tirar o aspersor do chão.');
        popText(this.scene, this.col * this.system.tilePx + this.system.tilePx / 2, this.row * this.system.tilePx, 'Precisa da Picareta', { color: '#ff8a8a', fontSize: 14 });
        return;
      }
      this.player.performAction('pickaxe', () => this.system.removeAt(this.col, this.row, true, true));
      return;
    }

    // Se for outra decoração qualquer, ela é removida e volta pro estoque
    this.system.removeAt(this.col, this.row);
  }
}

/** Uma decoração posicionada: além do que já existia, guarda o `footprint` usado no momento da colocação — necessário pra `removeAt` desbloquear/desregistrar exatamente as mesmas células (a definição em `data/decorations.ts` poderia teoricamente mudar depois). */
interface PlacedDecoration {
  image: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  decorationId: string;
  /** Célula-âncora (canto superior-esquerdo do footprint). */
  col: number;
  row: number;
  footprint: { width: number; height: number };
  /** O que estava registrado em cada célula ANTES da construção (ex.: o canteiro, `PlotInteractable`, no caso do aspersor) — devolvido ao remover, senão a célula perderia a interação pra sempre. */
  replaced: Map<string, Interactable | undefined>;
  /** A animação da manhã está tocando agora (não deixa duas rodarem juntas). */
  animating: boolean;
  /** O fogo (`animatesWhenUsed`) está aceso: até quando (relógio da cena, ms) e se o timer dos quadros está rodando. */
  litUntil: number;
  burning: boolean;
}

/** Quem escolhe o LOCAL de uma construção sem gastar estoque (`startPicking` — a encomenda ao Marceneiro, `systems/buildFlow.ts`). */
export interface SitePickHandler {
  onPick(col: number, row: number): void;
}

/**
 * Modo de posicionamento livre de decorações (Fase 6): o jogador entra no
 * modo (`start`) com uma decoração do estoque, um preview semitransparente
 * segue o mouse (verde se o local for válido, vermelho se não), e o clique
 * confirma — reaproveitando o `PointerInputInterceptor` do
 * `PlayerController` para "roubar" esse clique do fluxo normal de
 * movimento/interação enquanto o modo estiver ativo.
 *
 * Uma decoração posicionada bloqueia todas as células do seu `footprint`
 * (Fase 9 — Construções Multi-tile) no `WalkableGrid` (dinâmico,
 * `block`/`unblock`) e se registra no `InteractionRegistry` em cada uma
 * delas, para poder ser clicada/removida a partir de qualquer ponto da sua
 * base — não só na célula onde o clique de colocação caiu.
 */
export class DecorationPlacementSystem implements PointerInputInterceptor {
  private readonly placed = new Map<string, PlacedDecoration>();
  private readonly ghost: Phaser.GameObjects.Image;
  /** Grid verde dos terrenos que o aspersor em posicionamento vai regar (só desenhado com uma decoração de `waterReach` ativa). */
  private readonly coverage: Phaser.GameObjects.Graphics;
  /** Célula/decoração do último desenho do grid — só redesenha quando muda. */
  private coverageKey = '';
  private readonly farmlandCells: Set<string>;
  private activeDecoration: DecorationDefinition | null = null;
  /** Escolha de local (encomenda ao Marceneiro): o clique válido chama isto em vez de colocar do estoque. */
  private pickHandler: SitePickHandler | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    map: FarmMapData,
    readonly tilePx: number,
    private readonly grid: WalkableGrid,
    private readonly inventory: Inventory,
    private readonly interactions: InteractionRegistry,
    private readonly player: Player,
    private readonly farmlandRenderer: FarmlandRenderer,
    firstDecoration: DecorationDefinition,
    /** Célula onde NÃO se pode construir (ex.: uma cerca — inclusive a destruída, que fica andável até ser consertada). */
    private readonly isBlockedCell: (col: number, row: number) => boolean = () => false,
  ) {
    this.farmlandCells = new Set(map.farmlandArea.map(([col, row]) => `${col},${row}`));

    this.ghost = scene.add.image(0, 0, firstDecoration.textureKey, firstDecoration.frameName);
    this.ghost.setOrigin(0.5, 1);
    this.ghost.setScale(DISPLAY_SCALE);
    this.ghost.setDepth(GHOST_DEPTH);
    this.ghost.setAlpha(GHOST_ALPHA);
    this.ghost.setVisible(false);

    this.coverage = scene.add.graphics();
    this.coverage.setDepth(COVERAGE_DEPTH);

    // worldX/worldY — com a câmera podendo rolar (Fase 6, Expansão), x/y
    // são coordenadas de tela, não do mundo.
    scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.handlePointerMove(pointer.worldX, pointer.worldY));

    // Cada barra fundida acende o fogo das Fornalhas (o evento vem da UIScene, que não conhece este sistema).
    const onSmelted = (durationMs: number): void => this.lightUsedStructures(durationMs);
    scene.game.events.on(FURNACE_SMELTED_EVENT, onSmelted);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.game.events.off(FURNACE_SMELTED_EVENT, onSmelted));
  }

  isActive(): boolean {
    return this.activeDecoration !== null;
  }

  /** Alterna o modo de posicionamento da decoração informada. Sem estoque, não entra no modo (só avisa no console). */
  toggle(decoration: DecorationDefinition): void {
    if (this.activeDecoration) {
      this.cancel();
      return;
    }

    if (this.inventory.getDecorationCount(decoration.id) <= 0) {
      console.log(`Sem ${decoration.name} no estoque — compre na loja.`);
      return;
    }

    this.activeDecoration = decoration;
    this.ghost.setTexture(decoration.textureKey, decoration.frameName);
    this.ghost.setScale(DISPLAY_SCALE * (decoration.displayScaleMultiplier ?? 1));
    this.ghost.setVisible(true);
  }

  /**
   * Escolher o LOCAL de uma construção (o fantasma segue o mouse, verde/vermelho como no posicionamento normal) sem tocar no estoque: o
   * clique num local válido chama `handler.onPick` e sai do modo. Enquanto vale, `cancel()` (hotbar, E...) não faz nada — quem sai é
   * `endPicking` (o `BuildFlow`, no ESC).
   */
  startPicking(decoration: DecorationDefinition, handler: SitePickHandler): void {
    this.activeDecoration = decoration;
    this.pickHandler = handler;
    this.ghost.setTexture(decoration.textureKey, decoration.frameName);
    this.ghost.setScale(DISPLAY_SCALE * (decoration.displayScaleMultiplier ?? 1));
    this.ghost.setVisible(true);
    const pointer = this.scene.input.activePointer;
    this.handlePointerMove(pointer.worldX, pointer.worldY);
  }

  endPicking(): void {
    this.pickHandler = null;
    this.cancel();
  }

  /** Sai do modo de posicionamento sem colocar nada. */
  cancel(): void {
    if (this.pickHandler) return;
    this.activeDecoration = null;
    this.ghost.setVisible(false);
    this.clearCoverage();
  }

  private clearCoverage(): void {
    this.coverage.clear();
    this.coverageKey = '';
  }

  /**
   * Aspersor (`waterReach`) em posicionamento: pinta de verde os terrenos que ele vai regar a partir de (`col`,`row`) — as células vêm
   * de `sprinklerReachCells` (a MESMA regra da rega de verdade, só onde existe terreno de plantio), então o que aparece é exatamente o
   * que será regado. Outras decorações não mostram nada.
   */
  private drawCoverage(col: number, row: number, decoration: DecorationDefinition): void {
    if (!decoration.waterReach) {
      this.clearCoverage();
      return;
    }
    const key = `${decoration.id}:${col},${row}`;
    if (key === this.coverageKey) return;
    this.coverageKey = key;

    this.coverage.clear();
    this.coverage.fillStyle(COVERAGE_FILL, COVERAGE_FILL_ALPHA);
    this.coverage.lineStyle(1, COVERAGE_LINE, COVERAGE_LINE_ALPHA);
    for (const cell of sprinklerReachCells(decoration, col, row)) {
      if (!gameState.farmland.getPlot(cell.col, cell.row)) continue;
      this.coverage.fillRect(cell.col * this.tilePx, cell.row * this.tilePx, this.tilePx, this.tilePx);
      this.coverage.strokeRect(cell.col * this.tilePx, cell.row * this.tilePx, this.tilePx, this.tilePx);
    }
  }

  private handlePointerMove(x: number, y: number): void {
    const decoration = this.activeDecoration;
    if (!decoration) return;

    const col = Math.floor(x / this.tilePx);
    const row = Math.floor(y / this.tilePx);
    const { width, height } = decoration.footprint;

    // Fantasma centralizado no footprint inteiro (não só na célula sob o
    // mouse): o `col`/`row` sob o cursor é o canto superior-esquerdo do
    // footprint, que se estende `width` células pra direita e `height` pra
    // baixo — o mesmo cálculo de antes (origem inferior-central da imagem)
    // generalizado, que pra `width: 1, height: 1` dá exatamente o resultado
    // de antes desta fase.
    this.ghost.setPosition(col * this.tilePx + (width * this.tilePx) / 2, (row + height) * this.tilePx);
    this.ghost.setTint(this.canPlaceAt(col, row, decoration) ? GHOST_VALID_TINT : GHOST_INVALID_TINT);
    this.drawCoverage(col, row, decoration);
  }

  /**
   * Verdadeiro só se TODAS as células do footprint, a partir de (`col`,`row`), estiverem livres e válidas pra esta decoração:
   * por padrão andáveis e FORA da lavoura; as de `placement: 'farmland'` (aspersor) são o contrário — só DENTRO da lavoura, em
   * terreno ainda não arado e sem nada plantado/construído (a célula do canteiro fica andável até ser ocupada).
   */
  private canPlaceAt(col: number, row: number, decoration: DecorationDefinition): boolean {
    const { footprint } = decoration;
    if (decoration.placement === 'house' && !decoration.outdoor) return false; // Móvel: só dentro da casa (`systems/furniturePlacement.ts`) — exceto o que também pode ficar fora (`outdoor`, o Baú).
    const onFarmland = decoration.placement === 'farmland';

    for (let dy = 0; dy < footprint.height; dy++) {
      for (let dx = 0; dx < footprint.width; dx++) {
        const c = col + dx;
        const r = row + dy;
        if (!this.grid.isWalkable(c, r) || this.isBlockedCell(c, r)) return false;
        // Broto e muda são ANDÁVEIS: sem esta checagem uma construção nascia em cima de um deles e, quando ele crescesse (ou fosse cortado),
        // bloqueava/liberava a célula por baixo dela e roubava a interação — ficava uma construção fantasma sem colisão.
        // (o MATO é planta: pode ser removido pra construir, `clearPlantsUnder`; árvores/brotos/pedras continuam impedindo)
        const node = resourceNodeRegistry.getNode(FARM_RESOURCES_KEY, c, r);
        if (node && node.kind !== 'weed') return false;

        const inFarmland = this.farmlandCells.has(`${c},${r}`);
        if (onFarmland) {
          if (!inFarmland || gameState.farmland.getPlot(c, r)?.state !== 'untilled') return false;
        } else if (inFarmland) {
          return false;
        }
      }
    }
    return true;
  }

  /** Chamado pelo `PlayerController` enquanto este sistema está ativo (ver `PointerInputInterceptor`). */
  handleClick(x: number, y: number): void {
    const decoration = this.activeDecoration;
    if (!decoration) return;

    const col = Math.floor(x / this.tilePx);
    const row = Math.floor(y / this.tilePx);
    if (!this.canPlaceAt(col, row, decoration)) return;
    if (this.pickHandler) {
      const handler = this.pickHandler;
      this.endPicking();
      handler.onPick(col, row);
      return;
    }
    if (!this.inventory.useDecoration(decoration.id)) return;

    this.placeAt(decoration, col, row);
    playEffect(this.scene, PLACE_SOUND);

    // Sem mais estoque, sai do modo — não tem sentido continuar "segurando"
    // uma decoração que o jogador não tem mais.
    if (this.inventory.getDecorationCount(decoration.id) <= 0) this.cancel();
  }

  /** Uma construção que o Marceneiro acabou de terminar: aparece no local (com o som de posicionar) e já vale como construída (`gameState.placedDecorations`). */
  placeBuilt(decoration: DecorationDefinition, col: number, row: number): void {
    this.placeAt(decoration, col, row);
    playEffect(this.scene, PLACE_SOUND);
  }

  /** O local (`col`,`row`) serve pra esta construção? — a mesma regra do posicionamento (usado pra validar a escolha do jogador). */
  isValidSite(decoration: DecorationDefinition, col: number, row: number): boolean {
    return this.canPlaceAt(col, row, decoration);
  }

  private placeAt(decoration: DecorationDefinition, col: number, row: number): void {
    const { width, height } = decoration.footprint;
    clearPlantsUnder(this.scene, col, row, width, height); // As plantinhas que estavam embaixo somem.
    const x = col * this.tilePx + (width * this.tilePx) / 2;
    const y = (row + height) * this.tilePx;

    const scaleMultiplier = decoration.displayScaleMultiplier ?? 1;
    const shadow = createGroundShadow(this.scene, x, y, DISPLAY_SCALE * 1.1 * scaleMultiplier, DISPLAY_SCALE * 0.5 * scaleMultiplier);
    shadow.setDepth(PLACED_SHADOW_DEPTH);

    // Decoração animada: posicionada, ela fica no quadro de REPOUSO (o 1º da animação — o `frameName` é só o ícone, um recorte mais justo).
    const frames = decoration.animationFrames;
    const image = this.scene.add.image(x, y, decoration.textureKey, frames?.[0]?.name ?? decoration.frameName);
    image.setOrigin(0.5, frames ? decoration.animationOriginY ?? 1 : 1);
    image.setScale(DISPLAY_SCALE * (decoration.displayScaleMultiplier ?? 1));
    image.setDepth(y);

    // Animação em LOOP (a que não é "uma vez por manhã"): troca de frame; o timer se remove sozinho quando a imagem some (removida ou cena fechada).
    if (frames && frames.length > 1 && !decoration.animatesEachMorning && !decoration.animatesWhenUsed) {
      let frameIndex = 0;
      const timer = this.scene.time.addEvent({
        delay: decoration.animationFrameMs ?? 120,
        loop: true,
        callback: () => {
          if (!image.active) {
            timer.remove();
            return;
          }
          frameIndex = (frameIndex + 1) % frames.length;
          image.setFrame(frames[frameIndex].name);
        },
      });
    }

    const interactable = new PlacedDecorationInteractable(this.scene, this, this.player, col, row, decoration.id);
    const replaced = new Map<string, Interactable | undefined>();
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        const cellKey = `${col + dx},${row + dy}`;
        replaced.set(cellKey, this.interactions.get(col + dx, row + dy));
        this.grid.block(col + dx, row + dy);
        this.interactions.set(col + dx, row + dy, interactable);
        if (decoration.locksTilling) gameState.farmland.setTillLocked(col + dx, row + dy, true);
      }
    }

    this.placed.set(`${col},${row}`, { image, shadow, decorationId: decoration.id, col, row, footprint: { width, height }, replaced, animating: false, litUntil: 0, burning: false });
    // Bug corrigido (Scene Persistence) — grava também no registro
    // persistente (`gameState`, sobrevive a uma troca de cena de verdade),
    // já que `this.placed` some junto com o `Phaser.GameObjects.Image`
    // assim que a cena é destruída (ver `restorePlacements`).
    gameState.placedDecorations.set(`${col},${row}`, { decorationId: decoration.id, col, row });
  }

  /**
   * Remove a decoração da célula-âncora (`col`,`row` — canto superior-
   * esquerdo do footprint, o que `PlacedDecorationInteractable` sempre usa,
   * não importa em qual célula da base o jogador clicou) e devolve 1
   * unidade ao estoque. Desbloqueia e desregistra TODAS as células do
   * footprint original, não só a âncora.
   */
  removeAt(col: number, row: number, dropAsLoot = false, breakEffect = false, returnToStock = true): void {
    const key = `${col},${row}`;
    const entry = this.placed.get(key);
    if (!entry) return;

    // Com golpe de ferramenta: a construção se despedaça (animação + som); senão some na hora, como antes.
    if (breakEffect) {
      playBreakEffect(this.scene, entry.image, entry.shadow);
      playEffect(this.scene, OBJECT_BREAK_SOUND);
      if (DECORATIONS[entry.decorationId]?.locksTilling) playRandomEffect(this.scene, ORE_HIT_SOUNDS); // O aspersor é de metal: um tinido junto.
    } else {
      entry.image.destroy();
      entry.shadow.destroy();
    }
    this.placed.delete(key);
    gameState.placedDecorations.delete(key);

    const { width, height } = entry.footprint;
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        this.grid.unblock(col + dx, row + dy);
        const previous = entry.replaced.get(`${col + dx},${row + dy}`);
        if (previous) this.interactions.set(col + dx, row + dy, previous); // Devolve o canteiro (o aspersor o tinha substituído).
        else this.interactions.remove(col + dx, row + dy);
        gameState.farmland.setTillLocked(col + dx, row + dy, false);
      }
    }

    if (DECORATIONS[entry.decorationId]?.isCoop) discardCoop(coopKey(col, row)); // Só chega aqui sem galinhas (a Picareta confere antes).
    if (DECORATIONS[entry.decorationId]?.isChest) discardChest(farmChestId(col, row)); // Só chega aqui vazio (Picareta/Recolher conferem antes).

    if (!returnToStock) return; // Destruída/movida pelo Marceneiro (`systems/buildFlow.ts`): a construção some, sem voltar pra Bolsa.

    if (dropAsLoot) {
      // O item "cai" no chão onde a construção estava e o jogador o recolhe (mesmo loot das árvores/pedras).
      spawnLoot(this.scene, this.player, col * this.tilePx + this.tilePx / 2, row * this.tilePx + this.tilePx * 0.75, { category: 'decoration', id: entry.decorationId, amount: 1 });
      console.log(`Removido: 1 ${entry.decorationId} caiu no chão.`);
      return;
    }
    this.inventory.addDecorations(entry.decorationId, 1);
    console.log(`Removido: 1 ${entry.decorationId} (estoque: ${this.inventory.getDecorationCount(entry.decorationId)}).`);
  }

  /** Recolhe os ovos do galinheiro em (`col`,`row`): caem no chão à frente da porta (`systems/animals.ts`). */
  collectEggs(col: number, row: number): void {
    collectCoopEggs(this.scene, this.player, col, row, this.tilePx);
  }

  /** Aviso flutuante em cima do galinheiro: a Picareta não o quebra com galinhas dentro. */
  warnCoopHasChickens(col: number, row: number): void {
    popText(this.scene, col * this.tilePx + this.tilePx * 1.5, row * this.tilePx, 'Tem galinhas aí dentro', { color: '#ff8a8a' });
  }

  /** Aviso flutuante em cima do baú: a Picareta não quebra um baú com itens (eles sumiriam). */
  warnChestNotEmpty(col: number, row: number): void {
    popText(this.scene, col * this.tilePx + this.tilePx / 2, row * this.tilePx, 'Esvazie o baú antes', { color: '#ff8a8a' });
  }

  /**
   * Toca UMA vez a animação das construções com `animatesEachMorning` (o aspersor jorrando) — chamado pela `MainScene` uma vez por
   * dia, de manhã. A imagem passa pelos quadros da sequência e termina no de repouso. Uma que já está tocando não reinicia.
   */
  playMorningAnimations(): void {
    for (const entry of this.placed.values()) {
      const decoration = DECORATIONS[entry.decorationId];
      // Aspersor (`waterReach`): água sobre os terrenos que ele regou, toda manhã (`systems/sprinklerWater.ts`).
      if (decoration?.waterReach) {
        playSprinklerWater(this.scene, gameState.farmland, sprinklerReachCells(decoration, entry.col, entry.row), entry.col, entry.row, this.tilePx);
      }
      const frames = decoration?.animatesEachMorning ? decoration.animationFrames : undefined;
      if (!decoration || !frames || frames.length < 2 || entry.animating) continue;

      entry.animating = true;
      let frameIndex = 0;
      const timer = this.scene.time.addEvent({
        delay: decoration.animationFrameMs ?? 120,
        repeat: frames.length - 1,
        callback: () => {
          if (!entry.image.active) {
            timer.remove();
            return;
          }
          entry.image.setFrame(frames[frameIndex].name);
          frameIndex += 1;
          if (frameIndex >= frames.length) entry.animating = false;
        },
      });
    }
  }

  /**
   * Acende (`animatesWhenUsed`) as construções em uso — a Fornalha depois de uma fundição: o fogo (quadros 2..N em loop) fica aceso por `durationMs` (o que a fila de fundição ainda leva) e ela volta ao quadro de repouso.
   * Uma que já está acesa só ganha mais tempo.
   */
  lightUsedStructures(durationMs: number): void {
    for (const entry of this.placed.values()) {
      const decoration = DECORATIONS[entry.decorationId];
      const frames = decoration?.animatesWhenUsed ? decoration.animationFrames : undefined;
      if (!decoration || !frames || frames.length < 2 || !entry.image.active) continue;

      entry.litUntil = this.scene.time.now + durationMs;
      if (entry.burning) continue;
      entry.burning = true;
      let step = 0;
      entry.image.setFrame(frames[1].name);
      const timer = this.scene.time.addEvent({
        delay: decoration.animationFrameMs ?? 120,
        loop: true,
        callback: () => {
          if (!entry.image.active) {
            timer.remove();
            return;
          }
          if (this.scene.time.now >= entry.litUntil) {
            entry.image.setFrame(frames[0].name);
            entry.burning = false;
            timer.remove();
            return;
          }
          step += 1;
          entry.image.setFrame(frames[1 + (step % (frames.length - 1))].name);
        },
      });
    }
  }

  /**
   * Bug corrigido (Scene Persistence) — chamado uma vez por `MainScene`
   * logo após construir este sistema (que sempre nasce com `this.placed`
   * vazio): recria as construções que já estavam colocadas numa sessão
   * anterior desta MESMA aba, lidas de `gameState.placedDecorations`
   * (sobrevive à destruição da cena antiga, ver `systems/gameState.ts`).
   * Reaproveita `placeAt` diretamente (nunca `handleClick`/`toggle`) — não
   * deve descontar estoque de novo nem entrar no modo de posicionamento, só
   * recriar o visual/bloqueio/interação exatamente como da primeira vez. Um
   * id que não exista mais em `DECORATIONS` (ex.: removido de propósito do
   * jogo) é ignorado silenciosamente, em vez de quebrar a cena inteira.
   */
  restorePlacements(): void {
    for (const { decorationId, col, row } of gameState.placedDecorations.values()) {
      const decoration = DECORATIONS[decorationId];
      if (!decoration) continue;
      this.placeAt(decoration, col, row);
    }
    // Fundições ainda na fila (o jogador saiu da Fazenda e voltou): o fogo continua aceso até a fila acabar.
    const smelting = remainingQueueMs();
    if (smelting > 0) this.lightUsedStructures(smelting);
  }

  /**
   * Enche o regador de volta ao máximo (Fase 7 — barra de água) e toca o
   * mesmo respingo d'água já usado ao regar a lavoura
   * (`FarmlandRenderer.spawnWaterSplash`) — sem sprite novo. Chamado por
   * `PlacedDecorationInteractable` quando o Poço é interagido, já dentro da
   * animação de regar (`Player.performAction('water', ...)`).
   */
  refillWateringCan(col: number, row: number): void {
    this.inventory.refillWateringCan();
    playEffect(this.scene, WATER_SOUND);
    this.farmlandRenderer.spawnWaterSplash(col, row);
    console.log(`Regador reabastecido no Poço (cargas: ${this.inventory.getWateringCanCharges()}).`);
  }

  /**
   * Uma decoração posicionada (ex.: o Poço) costuma ser visualmente mais
   * alta que 1 tile, mas ocupa só a célula onde foi colocada — então,
   * quando o personagem se aproxima por baixo (mesma coluna, uma linha
   * abaixo), a ordenação por Y o coloca na frente e ele acaba encobrindo
   * quase toda a decoração, que parece "sumir" bem na hora em que o
   * jogador mais precisa vê-la (para interagir/remover). Diferente da
   * árvore (`systems/treeOverlap.ts`, que se torna semitransparente para
   * não esconder o personagem), aqui é o personagem que fica
   * semitransparente — a decoração precisa continuar visível, não o
   * contrário. Chamado a cada frame por `MainScene.update`.
   */
updateOcclusion(): void {
    const sprite = this.player.sprite;
    const playerBounds = sprite.getBounds();

    for (const { image } of this.placed.values()) {
      // Verifica se a decoração está na frente do personagem
      const decInFront = image.depth > sprite.depth;
      const coverage = decInFront ? coverageRatio(playerBounds, image.getBounds()) : 0;

      // Agora é a IMAGEM (poço) que fica transparente (até 50%), e não o personagem
      image.setAlpha(Phaser.Math.Linear(1, 0.5, coverage));
    }

    // Garante que o personagem sempre fique totalmente opaco
    sprite.setAlpha(1);
  }
}
