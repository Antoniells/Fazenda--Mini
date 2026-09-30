import Phaser from 'phaser';
import { Enemy } from './Enemy';
import { ensureSlimeAnims } from './Slime';
import {
  SLIME_KEY,
  SLIME_IDLE_ANIM_KEY,
  SLIME_IDLE_FRAMES,
  SLIME_DEATH_ANIM_KEY,
  SLIME_ATTACK_ANIM_KEY,
  SLIME_ATTACK_WINDUP_FRAME,
  SLIME_STATS,
} from '../data/enemies';
import { RAIDER_AI } from '../data/horde';
import { WalkableGrid } from '../systems/grid';
import { Farmland } from '../systems/farmland';
import { FarmFences } from '../systems/farmFences';
import { GridPoint } from '../systems/pathfinding';
import { findWeightedPath } from '../systems/hordePathfinding';

/** Alvo do ataque em preparação/em andamento. */
type AttackTarget = { kind: 'player' } | { kind: 'fence'; col: number; row: number } | { kind: 'crop'; col: number; row: number };
type RaiderState = 'advance' | 'windup' | 'strike' | 'recover';

/** O que a horda (cena) oferece ao inimigo: o mundo (grid, cercas, lavoura) e como aplicar cada tipo de dano. */
export interface RaiderContext {
  grid: WalkableGrid;
  tilePx: number;
  farmland: Farmland;
  fences: FarmFences;
  /** Chamado no impacto contra o jogador (só se ele ainda estiver ao alcance) — a cena aplica vida/feedback/evento. */
  hurtPlayer: (damage: number, time: number, attacker: Enemy) => void;
  /** Chamado no impacto contra uma cerca (dano de 1 golpe). */
  damageFence: (col: number, row: number) => void;
  /** Chamado no impacto contra uma plantação. */
  destroyCrop: (col: number, row: number) => void;
}

/**
 * Inimigo da horda (mesma arte do Slime): anda pelo grid por rotas A* PONDERADAS (`systems/hordePathfinding.ts`) e escolhe o
 * que atacar por 3 alvos, em ordem de prioridade:
 *  1. JOGADOR — se estiver a menos de `playerAggroRadius`, vira o alvo (e, sem nenhuma plantação viva pra atacar, ele caça o
 *     jogador onde estiver);
 *  2. CERCAS — quebráveis: contam como passagem com custo (`fenceBreakCost`) na rota. Quando o melhor caminho até o objetivo
 *     ATRAVESSA uma cerca (dar a volta pelo portão sai mais caro), o inimigo para diante dela e a ataca até cair;
 *  3. PLANTAÇÕES — o objetivo de fundo: a plantação viva mais próxima. Chegando nela, pisoteia (a planta morre).
 * Reavalia alvo/rota a cada `thinkMs`, então muda de ideia se o jogador se aproxima ou uma cerca cai. O ataque é o do Slime:
 * aviso (agachado/avermelhado) → golpe → recuperação; levar dano no aviso interrompe. Ao morrer chama `onDeathCallback` — os
 * drops vão pro pool da horda (`systems/horde.ts`), não caem no chão.
 */
export class Raider extends Enemy {
  private state: RaiderState = 'advance';
  private stateEndsAt = 0;
  private nextThinkAt = 0;
  private path: GridPoint[] = [];
  private attackTarget: AttackTarget | null = null;
  private telegraphTween: Phaser.Tweens.Tween | null = null;
  private readonly baseScale: number;

  constructor(
    scene: Phaser.Scene,
    col: number,
    row: number,
    private readonly ctx: RaiderContext,
    private readonly onDeathCallback: (x: number, y: number) => void,
    maxHp: number,
  ) {
    super(scene, col * ctx.tilePx + ctx.tilePx / 2, (row + 1) * ctx.tilePx, SLIME_KEY, SLIME_IDLE_FRAMES.start, {
      ...SLIME_STATS,
      maxHp,
      contactDamage: RAIDER_AI.contactDamage,
      moveSpeed: RAIDER_AI.moveSpeed,
    });
    ensureSlimeAnims(scene);
    this.sprite.play(SLIME_IDLE_ANIM_KEY);
    // Um pouco maiores que um Slime comum pra se distinguirem na horda.
    this.sprite.setScale(this.sprite.scaleX * 1.15);
    this.baseScale = this.sprite.scaleX;
    this.nextThinkAt = 0;
  }

  // --- Helpers de grade --------------------------------------------------------------------------------------------

  /** O empurrão do golpe para em cerca/parede (`Enemy.knockbackTarget`): só entra em célula andável do grid. */
  protected override canOccupy(x: number, y: number): boolean {
    const cell = this.cellOf(x, y);
    return this.ctx.grid.isWalkable(cell.col, cell.row);
  }

  private cellOf(x: number, y: number): GridPoint {
    return { col: Math.floor(x / this.ctx.tilePx), row: Math.floor((y - this.ctx.tilePx / 2) / this.ctx.tilePx) };
  }

  private centerX(col: number): number {
    return col * this.ctx.tilePx + this.ctx.tilePx / 2;
  }

  private bottomY(row: number): number {
    return (row + 1) * this.ctx.tilePx;
  }

  // --- IA ----------------------------------------------------------------------------------------------------------

  protected updateBehavior(time: number, delta: number, playerX: number, playerY: number): void {
    if (this.state !== 'advance') {
      this.updateAttack(time, playerX, playerY);
      return;
    }

    const distanceToPlayer = Math.hypot(playerX - this.x, playerY - this.y);
    if (distanceToPlayer <= RAIDER_AI.attackRange && distanceToPlayer <= RAIDER_AI.playerAggroRadius) {
      this.beginWindup(time, { kind: 'player' }, playerX - this.x);
      return;
    }

    if (time >= this.nextThinkAt) {
      this.nextThinkAt = time + RAIDER_AI.thinkMs + Phaser.Math.Between(0, 250);
      this.think(playerX, playerY);
    }

    this.followPath(time, delta);
  }

  /** Escolhe o objetivo (jogador ou plantação — a cerca aparece sozinha quando bloqueia) e traça a rota. */
  private think(playerX: number, playerY: number): void {
    const here = this.cellOf(this.x, this.y);
    const player = this.cellOf(playerX, playerY);
    const distanceToPlayer = Math.hypot(playerX - this.x, playerY - this.y);
    const isBreakable = (col: number, row: number): boolean => this.ctx.fences.isFence(col, row);

    // 1) Jogador por perto.
    let goal: GridPoint | null = null;
    if (distanceToPlayer <= RAIDER_AI.playerAggroRadius) goal = player;

    // 3) Plantação viva mais próxima.
    if (!goal) goal = this.nearestCrop(here);

    // Sem plantação pra atacar: caça o jogador onde estiver.
    if (!goal) goal = player;

    const path = findWeightedPath(this.ctx.grid, here, goal, isBreakable, RAIDER_AI.fenceBreakCost);
    this.path = path ?? [];
  }

  private nearestCrop(from: GridPoint): GridPoint | null {
    let best: GridPoint | null = null;
    let bestDistance = Infinity;
    for (const plot of this.ctx.farmland.getAllPlots()) {
      if (plot.state !== 'growing') continue;
      const distance = Math.abs(plot.col - from.col) + Math.abs(plot.row - from.row);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { col: plot.col, row: plot.row };
      }
    }
    return best;
  }

  /** Anda pelo caminho; diante de uma cerca (2º alvo) ataca; chegando numa plantação (3º alvo) pisoteia. */
  private followPath(time: number, delta: number): void {
    const next = this.path[0];
    if (!next) {
      // Rota vazia: ou chegou numa plantação, ou não achou caminho (repensa).
      const here = this.cellOf(this.x, this.y);
      if (this.ctx.farmland.hasLiveCrop(here.col, here.row)) this.beginWindup(time, { kind: 'crop', col: here.col, row: here.row }, 0);
      else this.nextThinkAt = Math.min(this.nextThinkAt, time + 200);
      return;
    }

    if (!this.ctx.grid.isWalkable(next.col, next.row)) {
      if (this.ctx.fences.isFence(next.col, next.row)) {
        this.beginWindup(time, { kind: 'fence', col: next.col, row: next.row }, this.centerX(next.col) - this.x);
      } else {
        this.path = []; // Bloqueou por outra coisa (construção, árvore que cresceu): repensa já.
        this.nextThinkAt = 0;
      }
      return;
    }

    const targetX = this.centerX(next.col);
    const targetY = this.bottomY(next.row);
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const distance = Math.hypot(dx, dy);
    const step = this.stats.moveSpeed * (delta / 1000);

    if (Math.abs(dx) > 1) this.sprite.setFlipX(dx < 0);
    if (distance <= step) {
      this.sprite.x = targetX;
      this.sprite.y = targetY;
      this.path.shift();
    } else {
      this.sprite.x += (dx / distance) * step;
      this.sprite.y += (dy / distance) * step;
    }
  }

  // --- Ataque (aviso → golpe → recuperação, como o Slime) -----------------------------------------------------------

  private beginWindup(time: number, target: AttackTarget, dxToTarget: number): void {
    this.state = 'windup';
    this.attackTarget = target;
    this.stateEndsAt = time + RAIDER_AI.windupMs;
    if (Math.abs(dxToTarget) > 1) this.sprite.setFlipX(dxToTarget < 0);

    this.sprite.stop();
    this.sprite.setFrame(SLIME_ATTACK_WINDUP_FRAME);
    this.sprite.setTint(0xff8a8a);
    this.telegraphTween = this.scene.tweens.add({
      targets: this.sprite,
      scaleX: this.baseScale * 1.15,
      scaleY: this.baseScale * 0.82,
      duration: RAIDER_AI.windupMs,
      ease: 'Sine.easeIn',
    });
  }

  private updateAttack(time: number, playerX: number, playerY: number): void {
    if (time < this.stateEndsAt) return;

    if (this.state === 'windup') {
      this.stopTelegraph();
      this.sprite.clearTint();
      this.sprite.play(SLIME_ATTACK_ANIM_KEY);
      this.state = 'strike';
      this.stateEndsAt = time + RAIDER_AI.strikeMs;
      return;
    }

    if (this.state === 'strike') {
      this.resolveImpact(time, playerX, playerY);
      this.state = 'recover';
      this.stateEndsAt = time + RAIDER_AI.recoverMs;
      return;
    }

    // recover acabou.
    this.sprite.play(SLIME_IDLE_ANIM_KEY);
    this.state = 'advance';
    this.attackTarget = null;
    this.nextThinkAt = 0;
  }

  private resolveImpact(time: number, playerX: number, playerY: number): void {
    const target = this.attackTarget;
    if (!target) return;

    if (target.kind === 'player') {
      // Só acerta se o jogador AINDA estiver ao alcance no impacto (andar pra longe durante o aviso desvia).
      if (Math.hypot(playerX - this.x, playerY - this.y) <= RAIDER_AI.hitRange) this.ctx.hurtPlayer(this.stats.contactDamage, time, this);
    } else if (target.kind === 'fence') {
      this.ctx.damageFence(target.col, target.row);
    } else {
      this.ctx.destroyCrop(target.col, target.row);
    }
  }

  private stopTelegraph(): void {
    this.telegraphTween?.stop();
    this.telegraphTween = null;
    this.sprite.setScale(this.baseScale);
  }

  /** Levar um golpe durante o aviso interrompe o ataque e deixa o inimigo atordoado um instante. */
  protected override onDamaged(): void {
    if (this.state !== 'windup') return;
    this.stopTelegraph();
    this.sprite.play(SLIME_IDLE_ANIM_KEY);
    this.state = 'recover';
    this.stateEndsAt = this.scene.time.now + RAIDER_AI.staggerMs;
  }

  protected onDeath(): void {
    this.stopTelegraph();
    this.shadow.destroy();
    this.sprite.play(SLIME_DEATH_ANIM_KEY);
    this.onDeathCallback(this.x, this.y);
    this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.sprite.destroy());
  }

  /** O amanhecer chegou (ou o evento acabou): o inimigo some sem drop — desvanece e se destrói. */
  vanish(): void {
    if (this.isDead()) return;
    this.stopTelegraph();
    this.shadow.destroy();
    this.scene.tweens.add({ targets: this.sprite, alpha: 0, duration: 500, onComplete: () => this.sprite.destroy() });
    this.markGone();
  }
}
