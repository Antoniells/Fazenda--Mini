import Phaser from 'phaser';
import { FarmMapData } from '../data/maps/farmMap';
import { Inventory } from './inventory';
import { WalkableGrid } from './grid';
import { PointerInputInterceptor } from './playerController';
import { DISPLAY_SCALE } from './mapBuilder';
import { registerFrame } from './externalMapBuilder';
import { resourceNodeRegistry } from './resourceNodeRegistry';
import { FarmResources, FARM_RESOURCES_KEY } from './farmResources';
import { BIRCH_ACORN, OAK_ACORN, RESOURCES } from '../data/resources';
import { speciesFromAcorn } from './treeVariety';
import { playEffect } from './soundEffects';
import { PLANT_SOUND } from '../data/audio';
import {
  PINE_TREE_KEY,
  PINE_SPROUT_FRAME_NAME,
  PINE_SPROUT_FRAME,
  BIRCH_TREE_KEY,
  BIRCH_SPROUT_FRAME_NAME,
  BIRCH_SPROUT_FRAME,
  OAK_TREE_KEY,
  OAK_SPROUT_FRAME_NAME,
  OAK_SPROUT_FRAME,
} from '../data/tiles';

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
 * Cada bolota planta a SUA espécie (`data/trees.ts` — a de Carvalho sorteia o Carvalho Rosa na hora de plantar); o fantasma mostra o
 * broto dela.
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
  /** A bolota que está sendo plantada (`data/resources.ts`). */
  private acornId = '';

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

  /** A bolota em uso no modo de plantio (`''` fora dele). */
  getAcornId(): string {
    return this.active ? this.acornId : '';
  }

  /** Entra no modo de plantio com esta bolota (o fantasma mostra o broto dela). Sem ela no estoque, não entra (só avisa no console). */
  start(acornId: string): void {
    if (this.inventory.getResourceCount(acornId) <= 0) {
      console.log('Sem bolotas no estoque — corte árvores com o Machado para conseguir.');
      return;
    }

    this.acornId = acornId;
    this.showSproutGhost(acornId);
    this.active = true;
    this.ghost.setVisible(true);
  }

  /** O fantasma vira o broto da espécie da bolota. */
  private showSproutGhost(acornId: string): void {
    if (acornId === OAK_ACORN.id) {
      registerFrame(this.scene, OAK_TREE_KEY, { name: OAK_SPROUT_FRAME_NAME, rect: OAK_SPROUT_FRAME });
      this.ghost.setTexture(OAK_TREE_KEY, OAK_SPROUT_FRAME_NAME).setScale(DISPLAY_SCALE * 2);
    } else if (acornId === BIRCH_ACORN.id) {
      registerFrame(this.scene, BIRCH_TREE_KEY, { name: BIRCH_SPROUT_FRAME_NAME, rect: BIRCH_SPROUT_FRAME });
      this.ghost.setTexture(BIRCH_TREE_KEY, BIRCH_SPROUT_FRAME_NAME).setScale(DISPLAY_SCALE * 2);
    } else {
      this.ghost.setTexture(PINE_TREE_KEY, PINE_SPROUT_FRAME_NAME).setScale(DISPLAY_SCALE * 2);
    }
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
    if (!this.inventory.useResource(this.acornId)) return;

    this.farmResources.plant(col, row, speciesFromAcorn(this.acornId));
    playEffect(this.scene, PLANT_SOUND); // Plantar uma bolota soa como plantar uma semente.
    console.log(`${RESOURCES[this.acornId]?.name ?? 'Bolota'} plantada — vai crescer com o passar dos dias.`);

    if (this.inventory.getResourceCount(this.acornId) <= 0) this.cancel();
  }
}
