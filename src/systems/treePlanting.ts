import Phaser from 'phaser';
import { FarmMapData } from '../data/maps/farmMap';
import { Inventory } from './inventory';
import { WalkableGrid } from './grid';
import { PointerInputInterceptor } from './playerController';
import { DISPLAY_SCALE } from './mapBuilder';
import { registerFrame } from './externalMapBuilder';
import { resourceNodeRegistry } from './resourceNodeRegistry';
import { FarmResources, FARM_RESOURCES_KEY } from './farmResources';
import { ACORN } from '../data/resources';
import { playEffect } from './soundEffects';
import { PLACE_SOUND } from '../data/audio';
import { PINE_TREE_KEY, PINE_SPROUT_FRAME_NAME, PINE_SPROUT_FRAME } from '../data/tiles';

const GHOST_VALID_TINT = 0x9be89b;
const GHOST_INVALID_TINT = 0xff8a8a;
const GHOST_ALPHA = 0.6;
const GHOST_DEPTH = 950; // Mesma faixa do TileCursor/DecorationPlacementSystem.

function cellKey(col: number, row: number): string {
  return `${col},${row}`;
}

/**
 * Plantio de bolotas (Fase 7 — Coleta de Recursos): mesma técnica de
 * "fantasma segue o mouse + clique confirma" do
 * `systems/decorationPlacement.ts`, mas dedicada a árvores (que crescem em
 * estágios com o passar dos dias, diferente de uma decoração estática) —
 * por isso uma classe própria, em vez de forçar o Poço/decorações a
 * conhecer o conceito de "crescer". Bolotas plantáveis só fora da lavoura
 * (mesma regra de decorações: não faz sentido uma árvore no meio de um
 * canteiro) e em célula livre (sem outra árvore/broto/pedra).
 *
 * Só cuida do MODO de plantio (fantasma + clique): a árvore plantada vira um
 * nó do registro da Fazenda e quem a desenha, faz crescer e a torna cortável
 * é o `FarmResources` (`systems/farmResources.ts`) — o mesmo das árvores do
 * mapa e dos brotos que nascem sozinhos.
 */
export class TreePlantingSystem implements PointerInputInterceptor {
  private readonly ghost: Phaser.GameObjects.Image;
  private readonly farmlandCells: Set<string>;
  private active = false;

  constructor(
    private readonly scene: Phaser.Scene,
    map: FarmMapData,
    private readonly tilePx: number,
    private readonly grid: WalkableGrid,
    private readonly inventory: Inventory,
    private readonly farmResources: FarmResources,
    /** Célula que é (ou era) uma cerca — nunca recebe muda, nem depois de a horda derrubá-la (a célula fica andável até o Martelo consertar). */
    private readonly isFenceCell: (col: number, row: number) => boolean = () => false,
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
  }

  isActive(): boolean {
    return this.active;
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
    return (
      this.grid.isWalkable(col, row) &&
      !this.isFenceCell(col, row) &&
      !this.farmlandCells.has(cellKey(col, row)) &&
      !resourceNodeRegistry.hasNodeAt(FARM_RESOURCES_KEY, col, row)
    );
  }

  /** Chamado pelo `PlayerController` enquanto este sistema está ativo (ver `PointerInputInterceptor`). */
  handleClick(x: number, y: number): void {
    if (!this.active) return;

    const col = Math.floor(x / this.tilePx);
    const row = Math.floor(y / this.tilePx);
    if (!this.canPlantAt(col, row)) return;
    if (!this.inventory.useResource(ACORN.id)) return;

    this.farmResources.plant(col, row);
    playEffect(this.scene, PLACE_SOUND);
    console.log(`Bolota plantada — vai crescer com o passar dos dias.`);

    if (this.inventory.getResourceCount(ACORN.id) <= 0) this.cancel();
  }
}
