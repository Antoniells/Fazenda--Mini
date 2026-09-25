import Phaser from 'phaser';
import { NpcDefinition, NpcFacing, NpcPlace } from '../data/npcs';
import { structureDoorCell } from '../data/maps/villageMap';
import { WalkableGrid } from '../systems/grid';
import { findPath, GridPoint } from '../systems/pathfinding';
import { createGroundShadow } from '../systems/shadow';
import { DISPLAY_SCALE } from '../systems/mapBuilder';

/** Bloco de quadros de cada direção nas folhas dos NPCs (medido pela posição do rosto em relação ao cabelo): baixo, cima, e os dois lados — o 3º bloco olha pra DIREITA, o 4º pra ESQUERDA. Se uma folha vier com os lados trocados, é só ajustar aqui. */
const DIRECTION_INDEX: Record<NpcFacing, number> = { down: 0, up: 1, left: 3, right: 2 };
/** Velocidade de caminhada (px/s) — bem abaixo da do jogador (parece um passeio). */
const WALK_SPEED_PX = 52;
const FADE_MS = 260;
/** Quanto tempo (ms) espera antes de tentar de novo uma rota que falhou ou uma célula ocupada pelo jogador. */
const RETRY_MS = 1200;
const IDLE_FRAME_RATE = 3;
const WALK_FRAME_RATE = 8;

/** Onde o NPC está agora (a "posição na rotina"): parado numa célula, atrás do balcão, ou dentro de casa (invisível). */
export type NpcLocation = 'outside' | 'post' | 'inside';

/** Dados do balcão: posição (px) dos pés do NPC atrás dele e a profundidade de desenho (abaixo do balcão). */
export interface NpcPost {
  x: number;
  y: number;
  depth: number;
}

/**
 * Um morador do Vilarejo (`data/npcs.ts`): sprite de 32x32 ancorado nos pés (mesma âncora do jogador e do pet: meio da célula, borda de
 * baixo), com sombra de chão, andando célula a célula por rotas A* (`systems/pathfinding.ts`) no grid da cena — então contorna casas,
 * árvores e o chafariz como o jogador. Segue a rotina do dia: `update` recebe o LUGAR desejado agora (`NpcPlace`, decidido por
 * `systems/npcSystem.ts` a partir do relógio) e o NPC vai até ele — saindo/entrando pela porta da casa (fade in/out) quando o lugar é
 * dentro de casa ou atrás do balcão. Só se mexe quando a cena chama `update`.
 */
export class Npc {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Image;
  /** Célula em frente à porta de casa (só quem mora no Vilarejo tem; o morador parado não). */
  private readonly door: GridPoint | null;

  /** Posição lógica dos pés (px). */
  private x = 0;
  private y = 0;
  private location: NpcLocation = 'inside';
  private facing: NpcFacing = 'down';
  private path: GridPoint[] = [];
  private waypoint: GridPoint | null = null;
  private retryAt = 0;
  private transitioning = false;
  /** Célula em que está parado (fora), pra saber se já chegou ao destino. */
  private cell: GridPoint;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly def: NpcDefinition,
    private readonly grid: WalkableGrid,
    private readonly tilePx: number,
    private readonly post: NpcPost | null,
    /** Chamado a cada vez que ele passa pela porta (entra ou sai) — a cena toca o som se o jogador estiver perto. */
    private readonly onDoor: (door: GridPoint) => void = () => {},
  ) {
    const door = def.home ? structureDoorCell(def.home) : null;
    if (!door && !def.stationary) throw new Error(`Npc ${def.id}: sem casa com porta e sem posição fixa.`);
    this.door = door;
    this.cell = door ? { ...door } : { ...def.stationary! };

    Npc.ensureAnimations(scene, def);
    this.sprite = scene.add.sprite(0, 0, def.sprite.idleKey, 0);
    this.sprite.setOrigin(0.5, 1).setScale(DISPLAY_SCALE);
    const shadowScale = tilePx / 16;
    this.shadow = createGroundShadow(scene, 0, 0, shadowScale * 1.1, shadowScale * 0.5);
    this.setVisibleAmount(0);
  }

  /** Cria (uma vez por cena) as animações de repouso e de caminhada nas 4 direções. */
  private static ensureAnimations(scene: Phaser.Scene, def: NpcDefinition): void {
    const { idleKey, walkKey, idleFrames, walkFrames } = def.sprite;
    for (const [facing, index] of Object.entries(DIRECTION_INDEX) as Array<[NpcFacing, number]>) {
      const idleAnim = `${idleKey}-${facing}`;
      if (!scene.anims.exists(idleAnim)) {
        const start = index * idleFrames;
        scene.anims.create({ key: idleAnim, frames: scene.anims.generateFrameNumbers(idleKey, { start, end: start + idleFrames - 1 }), frameRate: IDLE_FRAME_RATE, repeat: -1 });
      }
      const walkAnim = `${walkKey}-${facing}`;
      if (walkKey && walkFrames && !scene.anims.exists(walkAnim)) {
        const start = index * walkFrames;
        scene.anims.create({ key: walkAnim, frames: scene.anims.generateFrameNumbers(walkKey, { start, end: start + walkFrames - 1 }), frameRate: WALK_FRAME_RATE, repeat: -1 });
      }
    }
  }

  // --- Estado ---------------------------------------------------------------------------------------------------------

  getLocation(): NpcLocation {
    return this.location;
  }

  /** Está visível e disponível pra conversa? (não dentro de casa, e não no meio de um fade). */
  isTalkable(): boolean {
    return this.location !== 'inside' && !this.transitioning && this.sprite.alpha > 0.9;
  }

  /** Atrás do balcão de trabalho, parado (a loja só atende com o dono lá). */
  isAtPost(): boolean {
    return this.location === 'post' && !this.transitioning;
  }

  /** Célula (fora) em que ele está — usado pra saber de onde o jogador pode falar com ele. */
  getCell(): GridPoint {
    return this.location === 'outside' ? { col: Math.floor(this.x / this.tilePx), row: Math.floor((this.y - 1) / this.tilePx) } : { ...this.cell };
  }

  /** Célula de onde o jogador conversa: a própria vizinhança dele, ou a porta se ele estiver atrás do balcão. */
  getTalkAnchor(): GridPoint {
    return this.location === 'post' && this.door ? { ...this.door } : this.getCell();
  }

  private setVisibleAmount(alpha: number): void {
    this.sprite.setAlpha(alpha);
    this.shadow.setAlpha(alpha * 0.5);
  }

  private applyPosition(depthOverride?: number): void {
    this.sprite.setPosition(this.x, this.y);
    const depth = depthOverride ?? this.y;
    this.sprite.setDepth(depth);
    this.shadow.setPosition(this.x, this.y - 13);
    this.shadow.setDepth(depth - 0.1);
  }

  private play(kind: 'idle' | 'walk', facing: NpcFacing): void {
    this.facing = facing;
    const key = kind === 'idle' ? this.def.sprite.idleKey : this.def.sprite.walkKey ?? this.def.sprite.idleKey;
    this.sprite.anims.play(`${key}-${facing}`, true);
  }

  private cellCenter(cell: GridPoint): { x: number; y: number } {
    return { x: cell.col * this.tilePx + this.tilePx / 2, y: (cell.row + 1) * this.tilePx };
  }

  // --- Colocação instantânea (entrada na cena) -------------------------------------------------------------------------

  /** Coloca o NPC direto no lugar (sem andar nem fade) — o estado do dia quando a cena abre. */
  snapTo(place: NpcPlace): void {
    this.path = [];
    this.waypoint = null;
    this.transitioning = false;
    this.scene.tweens.killTweensOf([this.sprite, this.shadow]);

    if (place.kind === 'spot') {
      this.location = 'outside';
      this.cell = { col: place.col, row: place.row };
      ({ x: this.x, y: this.y } = this.cellCenter(this.cell));
      this.applyPosition();
      this.setVisibleAmount(1);
      this.play('idle', place.facing);
    } else if (place.kind === 'post' && this.post) {
      this.location = 'post';
      this.x = this.post.x;
      this.y = this.post.y;
      this.applyPosition(this.post.depth);
      this.setVisibleAmount(1);
      this.play('idle', 'down');
    } else {
      this.location = 'inside';
      this.setVisibleAmount(0);
    }
  }

  // --- Eventos do mundo (fora da rotina) -------------------------------------------------------------------------------

  /** Um passo de caminhada até `goal`, sem usar a rotina do Vilarejo (`systems/events/`). Devolve `true` quando já está parado nele. */
  stepToward(time: number, delta: number, goal: GridPoint, playerCell: GridPoint): boolean {
    if (this.cell.col === goal.col && this.cell.row === goal.row && !this.waypoint) return true;
    this.walkTo(time, delta, goal, playerCell);
    return false;
  }

  /** Parado, virado pra `facing`. */
  standFacing(facing: NpcFacing): void {
    this.play('idle', facing);
  }

  /** Some com um fade e se destrói (o visitante indo embora). */
  leave(onDone: () => void = () => {}): void {
    this.fade(0, () => {
      this.destroy();
      onDone();
    });
  }

  // --- Rotina -----------------------------------------------------------------------------------------------------------

  /** Um passo da rotina: leva o NPC em direção ao lugar desejado agora. */
  update(time: number, delta: number, want: NpcPlace, playerCell: GridPoint): void {
    if (this.transitioning) return;
    const target: NpcPlace = want.kind === 'post' && !this.post ? { kind: 'inside' } : want;
    if (this.def.stationary) {
      this.updateStationary(target);
      return;
    }

    if (target.kind === 'inside' || target.kind === 'post') {
      this.updateTowardsBuilding(time, delta, target.kind, playerCell);
    } else {
      this.updateTowardsSpot(time, delta, target, playerCell);
    }
  }

  /** Morador parado (a sereia): não anda — só aparece e some (fade) conforme a rotina. */
  private updateStationary(want: NpcPlace): void {
    if (want.kind === 'spot') {
      if (this.location !== 'inside') return;
      this.location = 'outside';
      this.cell = { ...this.def.stationary! };
      ({ x: this.x, y: this.y } = this.cellCenter(this.cell));
      this.setVisibleAmount(0);
      this.applyPosition();
      this.play('idle', want.facing);
      this.fade(1, () => {});
    } else if (this.location !== 'inside') {
      this.fade(0, () => {
        this.location = 'inside';
      });
    }
  }

  /** Destino DENTRO da casa (escondido ou atrás do balcão). */
  private updateTowardsBuilding(time: number, delta: number, kind: 'inside' | 'post', playerCell: GridPoint): void {
    if (this.location === 'inside') {
      if (kind === 'post') this.appearAtPost();
      return;
    }
    if (this.location === 'post') {
      if (kind === 'inside') this.disappear('inside');
      return;
    }
    // Fora: vai até a porta e entra.
    if (this.cell.col === this.door!.col && this.cell.row === this.door!.row && !this.waypoint) {
      this.enter(kind);
      return;
    }
    this.walkTo(time, delta, this.door!, playerCell);
  }

  /** Destino numa célula da rua/praça. */
  private updateTowardsSpot(time: number, delta: number, spot: Extract<NpcPlace, { kind: 'spot' }>, playerCell: GridPoint): void {
    if (this.location !== 'outside') {
      this.exitToDoor();
      return;
    }
    const goal = { col: spot.col, row: spot.row };
    if (this.cell.col === goal.col && this.cell.row === goal.row && !this.waypoint) {
      if (this.sprite.anims.currentAnim?.key !== `${this.def.sprite.idleKey}-${spot.facing}`) this.play('idle', spot.facing);
      return;
    }
    this.walkTo(time, delta, goal, playerCell);
  }

  /** Anda em direção a `goal` por rota A*; espera se o jogador está na frente e tenta de novo se a rota falhar. */
  private walkTo(time: number, delta: number, goal: GridPoint, playerCell: GridPoint): void {
    if (!this.waypoint) {
      if (time < this.retryAt) return;
      if (this.path.length === 0) {
        const route = findPath(this.grid, this.cell, goal);
        if (!route || route.length === 0) {
          this.retryAt = time + RETRY_MS;
          this.play('idle', this.facing);
          return;
        }
        this.path = route;
      }
      const next = this.path[0];
      if (next.col === playerCell.col && next.row === playerCell.row) {
        this.retryAt = time + RETRY_MS / 3; // O jogador está no caminho: espera ele sair.
        this.path = [];
        this.play('idle', this.facing);
        return;
      }
      if (!this.grid.isWalkable(next.col, next.row)) {
        this.path = [];
        this.retryAt = time + RETRY_MS;
        return;
      }
      this.waypoint = this.path.shift()!;
      const dCol = this.waypoint.col - this.cell.col;
      const dRow = this.waypoint.row - this.cell.row;
      this.play('walk', dCol < 0 ? 'left' : dCol > 0 ? 'right' : dRow < 0 ? 'up' : 'down');
    }

    const target = this.cellCenter(this.waypoint!);
    const step = (WALK_SPEED_PX * delta) / 1000;
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= step) {
      this.x = target.x;
      this.y = target.y;
      this.cell = { ...this.waypoint! };
      this.waypoint = null;
      if (this.path.length === 0) this.play('idle', this.facing);
    } else {
      this.x += (dx / distance) * step;
      this.y += (dy / distance) * step;
    }
    this.applyPosition();
  }

  // --- Portas -----------------------------------------------------------------------------------------------------------

  private fade(to: number, onDone: () => void): void {
    this.transitioning = true;
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: to,
      duration: FADE_MS,
      onUpdate: () => this.shadow.setAlpha(this.sprite.alpha * 0.5),
      onComplete: () => {
        this.transitioning = false;
        onDone();
      },
    });
  }

  /** Entra pela porta (fade out): vira `inside` (some) ou `post` (reaparece atrás do balcão). */
  private enter(kind: 'inside' | 'post'): void {
    this.onDoor(this.door!);
    this.play('idle', 'up');
    this.fade(0, () => {
      if (kind === 'post') this.appearAtPost();
      else this.location = 'inside';
    });
  }

  /** Está dentro (escondido) e vai trabalhar: reaparece atrás do balcão. */
  private appearAtPost(): void {
    if (!this.post) return;
    this.location = 'post';
    this.x = this.post.x;
    this.y = this.post.y;
    this.applyPosition(this.post.depth);
    this.play('idle', 'down');
    this.fade(1, () => {});
  }

  /** Sai do balcão pra dentro (some) — usado ao fechar a loja. */
  private disappear(to: 'inside'): void {
    this.fade(0, () => {
      this.location = to;
    });
  }

  /** Sai de casa: reaparece na célula da frente da porta. */
  private exitToDoor(): void {
    this.onDoor(this.door!);
    this.location = 'outside';
    this.cell = { ...this.door! };
    ({ x: this.x, y: this.y } = this.cellCenter(this.cell));
    this.path = [];
    this.waypoint = null;
    this.setVisibleAmount(0);
    this.applyPosition();
    this.play('idle', 'down');
    this.fade(1, () => {});
  }

  destroy(): void {
    this.scene.tweens.killTweensOf([this.sprite, this.shadow]);
    this.sprite.destroy();
    this.shadow.destroy();
  }
}
