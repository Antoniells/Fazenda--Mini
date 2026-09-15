import Phaser from 'phaser';
import { FarmMapData } from '../data/maps/farmMap';
import { Inventory } from './inventory';
import { InteractionRegistry } from './interaction';
import { WalkableGrid } from './grid';
import { Player } from '../entities/Player';
import { PointerInputInterceptor } from './playerController';
import { DISPLAY_SCALE } from './mapBuilder';
import { buildGrowingTree, registerFrame, WorldResourceVisual } from './externalMapBuilder';
import { resourceNodeRegistry } from './resourceNodeRegistry';
import { TreeInteractable } from './resourceInteraction';
import { ACORN } from '../data/resources';
import { PINE_TREE_KEY, PINE_SPROUT_FRAME_NAME, PINE_SPROUT_FRAME, TILE_SIZE } from '../data/tiles';

const GHOST_VALID_TINT = 0x9be89b;
const GHOST_INVALID_TINT = 0xff8a8a;
const GHOST_ALPHA = 0.6;
const GHOST_DEPTH = 950; // Mesma faixa do TileCursor/DecorationPlacementSystem.

/**
 * Chave usada no `resourceNodeRegistry` pras árvores plantadas na Fazenda —
 * mesmo mecanismo de crescimento por estágio (broto → muda → adulta,
 * avançado na virada de dia) das árvores selvagens da Floresta, só a
 * origem do broto muda (aqui é sempre o jogador plantando, nunca sorteio
 * aleatório — ver `advanceFarmTreesDay`).
 */
export const FARM_TREES_SCENE_KEY = 'MainScene:trees';

function cellKey(col: number, row: number): string {
  return `${col},${row}`;
}

/**
 * Virada de dia das árvores plantadas na Fazenda (Fase 7 — "gancho de
 * virada de dia"): só avança o ESTÁGIO das que já existem — `isCellFree`
 * sempre falso, porque diferente da Floresta/Pedreira (que respawnam
 * sozinhas), aqui só o jogador decide plantar uma bolota nova.
 */
export function advanceFarmTreesDay(): void {
  resourceNodeRegistry.advanceDay(FARM_TREES_SCENE_KEY, 0, 0, () => false);
}

/**
 * Plantio de bolotas (Fase 7 — Coleta de Recursos): mesma técnica de
 * "fantasma segue o mouse + clique confirma" do
 * `systems/decorationPlacement.ts`, mas dedicada a árvores (que crescem em
 * estágios com o passar dos dias, diferente de uma decoração estática) —
 * por isso uma classe própria, em vez de forçar o Poço/decorações a
 * conhecer o conceito de "crescer". Bolotas plantáveis só fora da lavoura
 * (mesma regra de decorações: não faz sentido uma árvore no meio de um
 * canteiro).
 */
export class TreePlantingSystem implements PointerInputInterceptor {
  private readonly ghost: Phaser.GameObjects.Image;
  private readonly farmlandCells: Set<string>;
  private readonly treeVisuals = new Map<string, WorldResourceVisual>();
  private active = false;

  constructor(
    private readonly scene: Phaser.Scene,
    map: FarmMapData,
    private readonly tilePx: number,
    private readonly grid: WalkableGrid,
    private readonly inventory: Inventory,
    private readonly interactions: InteractionRegistry,
    private readonly player: Player,
  ) {
    this.farmlandCells = new Set(map.farmlandArea.map(([col, row]) => cellKey(col, row)));

    registerFrame(scene, PINE_TREE_KEY, { name: PINE_SPROUT_FRAME_NAME, rect: PINE_SPROUT_FRAME });
    this.ghost = scene.add.image(0, 0, PINE_TREE_KEY, PINE_SPROUT_FRAME_NAME);
    this.ghost.setOrigin(0.5, 1);
    this.ghost.setScale(DISPLAY_SCALE * 2); // Broto é minúsculo (7x9) — dobrado só no fantasma, pra dar pra mirar direito.
    this.ghost.setDepth(GHOST_DEPTH);
    this.ghost.setAlpha(GHOST_ALPHA);
    this.ghost.setVisible(false);

    scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.handlePointerMove(pointer.worldX, pointer.worldY));

    resourceNodeRegistry.ensureInitialized(FARM_TREES_SCENE_KEY, [], { maxTrees: Number.POSITIVE_INFINITY, maxRocks: 0 });
    this.renderFromRegistry();
  }

  isActive(): boolean {
    return this.active;
  }

  /** Sprites das árvores plantadas pelo jogador (bolota → qualquer estágio) — pedido explícito do usuário: `MainScene.updateTreeOverlap` só recebia as árvores estáticas do mapa, então uma árvore plantada nunca ficava semitransparente ao personagem passar atrás dela. */
  getPlantedTrees(): Phaser.GameObjects.Image[] {
    return Array.from(this.treeVisuals.values()).map((v) => v.sprite);
  }

  /** Alterna o modo de plantio. Sem bolotas no estoque, não entra no modo (só avisa no console). */
  toggle(): void {
    if (this.active) {
      this.cancel();
      return;
    }

    if (this.inventory.getResourceCount(ACORN.id) <= 0) {
      console.log('Sem Bolotas no estoque — corte árvores com o Machado para conseguir.');
      return;
    }

    this.active = true;
    this.ghost.setVisible(true);
  }

  cancel(): void {
    this.active = false;
    this.ghost.setVisible(false);
  }

  private handlePointerMove(x: number, y: number): void {
    if (!this.active) return;

    const col = Math.floor(x / this.tilePx);
    const row = Math.floor(y / this.tilePx);
    this.ghost.setPosition(col * this.tilePx + this.tilePx / 2, (row + 1) * this.tilePx);
    this.ghost.setTint(this.canPlantAt(col, row) ? GHOST_VALID_TINT : GHOST_INVALID_TINT);
  }

  private canPlantAt(col: number, row: number): boolean {
    return this.grid.isWalkable(col, row) && !this.farmlandCells.has(cellKey(col, row));
  }

  /** Chamado pelo `PlayerController` enquanto este sistema está ativo (ver `PointerInputInterceptor`). */
  handleClick(x: number, y: number): void {
    if (!this.active) return;

    const col = Math.floor(x / this.tilePx);
    const row = Math.floor(y / this.tilePx);
    if (!this.canPlantAt(col, row)) return;
    if (!this.inventory.useResource(ACORN.id)) return;

    resourceNodeRegistry.addNode(FARM_TREES_SCENE_KEY, { col, row, kind: 'tree', stage: 'sprout' });
    this.treeVisuals.set(cellKey(col, row), buildGrowingTree(this.scene, TILE_SIZE, col, row, 'sprout'));
    console.log(`Bolota plantada — vai crescer com o passar dos dias.`);

    if (this.inventory.getResourceCount(ACORN.id) <= 0) this.cancel();
  }

  /**
   * Redesenha todas as árvores plantadas a partir do estado ATUAL do
   * registro — usado na criação (`MainScene` é recriada ao voltar de uma
   * ponte, mas o registro sobrevive) e depois de uma virada de dia (pra
   * mostrar o novo estágio sem precisar sair/voltar da Fazenda).
   */
private renderFromRegistry(): void {
    for (const node of resourceNodeRegistry.getNodes(FARM_TREES_SCENE_KEY)) {
      this.treeVisuals.set(cellKey(node.col, node.row), buildGrowingTree(this.scene, TILE_SIZE, node.col, node.row, node.stage));
      
      if (node.stage === 'mature') {
        this.grid.block(node.col, node.row); // <-- Bloqueia SÓ se for madura!
        this.interactions.set(
          node.col,
          node.row,
          new TreeInteractable(this.player, this.treeVisuals.get(cellKey(node.col, node.row))!, this.grid, this.interactions, FARM_TREES_SCENE_KEY, node.col, node.row),
        );
      }
    }
  }

  /** Chamado pela `MainScene` logo depois de `advanceFarmTreesDay()` — troca o sprite de cada árvore plantada pro estágio novo. */
  refreshAfterDayChange(): void {
    for (const visual of this.treeVisuals.values()) {
      visual.sprite.destroy();
      visual.shadow?.destroy();
    }
    this.treeVisuals.clear();
    this.renderFromRegistry();
  }

  /** Faz os brotos e mudas balançarem ao jogador pisar em cima */
  rustle(col: number, row: number): void {
    const key = cellKey(col, row);
    const visual = this.treeVisuals.get(key);
    if (!visual || this.scene.tweens.isTweening(visual.sprite)) return;

    const node = resourceNodeRegistry.getNodes(FARM_TREES_SCENE_KEY).find(n => n.col === col && n.row === row);
    
    // Só balança se NÃO for madura
    if (node && node.stage !== 'mature') {
      this.scene.tweens.add({
        targets: visual.sprite,
        angle: { from: 0, to: 8 },
        duration: 120,
        yoyo: true,
        repeat: 1,
        ease: 'Sine.easeInOut',
        onComplete: () => visual.sprite.setAngle(0),
      });
    }
  }
}
