import Phaser from 'phaser';
import { Npc } from '../entities/Npc';
import { NPCS, NpcDefinition } from '../data/npcs';
import { CARPENTER_ARRIVAL_CELL, CARPENTER_PICKAXE_SHEET, ConstructionOrder, PICKAXE_FRAME_RATE, PICKAXE_IMPACT_FRAME, PICKAXE_ROWS } from '../data/construction';
import { DECORATIONS } from '../data/decorations';
import { HAMMER_SOUND } from '../data/audio';
import { Player } from '../entities/Player';
import { WalkableGrid } from './grid';
import { GridPoint } from './pathfinding';
import { ConstructionSiteSystem } from './constructionSites';
import { DecorationPlacementSystem } from './decorationPlacement';
import { getBuildStatus, getOrders, materializeDone } from './construction';
import { playEffect } from './soundEffects';
import { popText } from './floatingText';

/** De quanto em quanto tempo (ms) confere se alguma obra terminou. */
const CHECK_MS = 500;
/** Até onde (células) o jogador ouve as picaretadas. */
const HAMMER_EARSHOT_CELLS = 14;

/**
 * O Tomás construindo na Fazenda (pedido explícito: ele deve ser visto andando até o local). Só existe enquanto há uma obra em andamento
 * (`getBuildStatus === 'building'`, que sai do relógio — `systems/construction.ts`): entra pela ponte LESTE, anda até uma célula colada
 * ao local, trabalha (a animação de PICARETA em loop, com o som no quadro em que ela bate) e, quando a obra termina, a construção aparece no lugar da placa; sem mais obras
 * ele volta pela ponte e some. Se a Fazenda abre com a obra já em curso, ele já está lá trabalhando. As obras que terminaram com a
 * Fazenda fechada viram construção na abertura (`materializeDone`, antes de `restorePlacements`).
 */
export class BuilderCrew {
  private readonly def: NpcDefinition;
  private npc: Npc | null = null;
  private workingOn: number | null = null;
  private standCell: GridPoint | null = null;
  private arrived = false;
  private lastCheck = 0;
  private workListener: ((animation: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => void) | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly grid: WalkableGrid,
    private readonly tilePx: number,
    private readonly player: Player,
    private readonly sites: ConstructionSiteSystem,
    private readonly placement: DecorationPlacementSystem,
  ) {
    // A mesma arte do morador do Vilarejo, mas sem casa/rotina: só anda quando há obra.
    this.def = { ...NPCS.carpenter, home: undefined, stationary: CARPENTER_ARRIVAL_CELL };
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  /** Abertura da Fazenda com uma obra em curso: ele já está no local, trabalhando (sem andar até lá). */
  init(): void {
    const current = this.currentJob();
    if (!current) return;
    const stand = this.findStandCell(current);
    if (!stand) return;
    this.spawnAt(stand, 'up');
    this.workingOn = current.id;
    this.standCell = stand;
    this.arrived = true;
    this.startWork(current, stand);
  }

  update(time: number, delta: number): void {
    if (time - this.lastCheck >= CHECK_MS) {
      this.lastCheck = time;
      this.finishDone();
    }

    const job = this.currentJob();
    const playerCell = { col: this.player.col, row: this.player.row };

    if (job) {
      if (!this.npc) this.spawnAt(CARPENTER_ARRIVAL_CELL, 'left');
      if (this.workingOn !== job.id) {
        this.workingOn = job.id;
        this.standCell = this.findStandCell(job);
        this.arrived = false;
      }
      if (!this.npc || !this.standCell) return;
      if (!this.arrived) {
        if (this.npc.stepToward(time, delta, this.standCell, playerCell)) {
          this.arrived = true;
          this.startWork(job, this.standCell);
        }
      }
      return;
    }

    // Sem obra: vai embora pela ponte.
    this.workingOn = null;
    if (!this.npc) return;
    this.stopWork();
    if (this.npc.stepToward(time, delta, CARPENTER_ARRIVAL_CELL, playerCell)) {
      this.npc.leave();
      this.npc = null;
    }
  }

  /** Começa a bater com a picareta virado pro local da obra (animação em loop; o som toca no quadro do impacto se o jogador está perto). */
  private startWork(order: ConstructionOrder, stand: GridPoint): void {
    const npc = this.npc;
    const decoration = DECORATIONS[order.decorationId];
    if (!npc || !decoration || !this.scene.textures.exists(CARPENTER_PICKAXE_SHEET.key)) {
      npc?.standFacing('up'); // Sem a folha carregada: só fica parado de frente pro local.
      return;
    }
    this.ensureWorkAnims();

    const dx = order.col + decoration.footprint.width / 2 - (stand.col + 0.5);
    const dy = order.row + decoration.footprint.height / 2 - (stand.row + 0.5);
    const vertical = Math.abs(dy) >= Math.abs(dx);
    const row = vertical ? (dy < 0 ? 'up' : 'down') : 'side';
    npc.sprite.setFlipX(!vertical && dx < 0); // O lado da folha olha pra direita; pra esquerda é o espelho.
    npc.sprite.play(`carpenter-pickaxe-${row}`);

    this.stopWork();
    this.workListener = (_animation, frame) => {
      if (frame.index - 1 !== PICKAXE_IMPACT_FRAME) return;
      if (Math.hypot(stand.col - this.player.col, stand.row - this.player.row) <= HAMMER_EARSHOT_CELLS) playEffect(this.scene, HAMMER_SOUND);
    };
    npc.sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, this.workListener);
  }

  private stopWork(): void {
    if (this.npc && this.workListener) this.npc.sprite.off(Phaser.Animations.Events.ANIMATION_UPDATE, this.workListener);
    this.workListener = null;
  }

  private ensureWorkAnims(): void {
    for (const [name, range] of Object.entries(PICKAXE_ROWS)) {
      const key = `carpenter-pickaxe-${name}`;
      if (this.scene.anims.exists(key)) continue;
      this.scene.anims.create({ key, frames: this.scene.anims.generateFrameNumbers(CARPENTER_PICKAXE_SHEET.key, range), frameRate: PICKAXE_FRAME_RATE, repeat: -1 });
    }
  }

  private currentJob(): ConstructionOrder | undefined {
    return getOrders().find((order) => getBuildStatus(order) === 'building');
  }

  private spawnAt(cell: GridPoint, facing: 'up' | 'left'): void {
    this.npc = new Npc(this.scene, this.def, this.grid, this.tilePx, null);
    this.npc.snapTo({ kind: 'spot', col: cell.col, row: cell.row, facing });
  }

  /** As obras que já passaram da hora viram construção: a placa sai e a estrutura aparece no lugar. */
  private finishDone(): void {
    const due = getOrders().filter((order) => getBuildStatus(order) === 'done');
    if (due.length === 0) return;
    for (const order of due) this.sites.remove(order.id);
    for (const order of materializeDone()) {
      const decoration = DECORATIONS[order.decorationId];
      if (!decoration) continue;
      this.placement.placeBuilt(decoration, order.col, order.row);
      popText(this.scene, order.col * this.tilePx + (decoration.footprint.width * this.tilePx) / 2, order.row * this.tilePx, `${decoration.name} pronto!`, { color: '#b8f5a0', fontSize: 15 });
    }
  }

  /** Uma célula andável colada ao local: a de baixo (no meio da base), senão as das laterais/de cima. */
  private findStandCell(order: ConstructionOrder): GridPoint | null {
    const decoration = DECORATIONS[order.decorationId];
    if (!decoration) return null;
    const { width, height } = decoration.footprint;
    const midCol = order.col + Math.floor(width / 2);
    const candidates: GridPoint[] = [
      { col: midCol, row: order.row + height },
      { col: order.col - 1, row: order.row + height - 1 },
      { col: order.col + width, row: order.row + height - 1 },
      { col: midCol, row: order.row - 1 },
    ];
    for (let dx = 0; dx < width; dx++) candidates.push({ col: order.col + dx, row: order.row + height });
    return candidates.find((cell) => this.grid.isWalkable(cell.col, cell.row)) ?? null;
  }

  private destroy(): void {
    this.stopWork();
    this.npc?.destroy();
    this.npc = null;
  }
}
