import Phaser from 'phaser';
import { Enemy, EnemyStats } from '../Enemy';
import { Direction, WalkerSheets } from '../../data/caveEnemies';
import { WalkerAttack, WalkerConfig } from '../../data/caveWalkers';
import { WalkableGrid } from '../../systems/grid';
import { DIRECTION_VECTOR, dirAnimKey, directionOf, ensureDirAnims } from './caveAnims';

type WalkerState = 'wander' | 'chase' | 'windup' | 'strike' | 'recover';

const WANDER_DECISION_MIN_MS = 1400;
const WANDER_DECISION_MAX_MS = 3200;
const WANDER_RANGE_PX = 56;
const ARRIVE_THRESHOLD_PX = 4;
/** Mais perto que isto, o bicho para de andar em direção ao jogador (não entra no mesmo pixel). */
const STOP_DISTANCE_PX = 30;
/** Parado em `recover` depois de levar um golpe durante o aviso. */
const STAGGER_MS = 550;
const WINDUP_TINT = 0xff9a9a;
/** Sombra mais rente aos pés que a do Slime (a arte destes bichos quase não tem margem embaixo). */

/**
 * Bicho de 4 direções da Caverna (Cogumelo, Goblin Lanceiro, Goblin Arqueiro e o Broto — `data/caveWalkers.ts` diz o que cada um faz): vaga, persegue o jogador
 * (movimento livre em pixels, com colisão com as paredes do andar) e ataca. Os que têm `attack` usam o ciclo `windup` (avisa: fica avermelhado e parado) → `strike`
 * (o golpe; o dano cai no meio dele, e só se o jogador ainda está ao alcance) → `recover` (parado, vulnerável) — quem se afasta durante o aviso desvia. O corpo a corpo acerta
 * quem está à frente dentro de `hitRange`; o à distância (Arqueiro) acerta quem está NA LINHA do tiro, sem parede no meio — por isso ele tenta se alinhar com o jogador.
 * Quem só encosta (`contact`, o Broto) machuca por contato, com recarga.
 */
export class CaveWalker extends Enemy {
  private state: WalkerState = 'wander';
  private facing: Direction = 'down';
  private wanderTarget: { x: number; y: number } | null = null;
  private nextWanderDecisionAt = 0;
  private stateEndsAt = 0;
  private impactDone = false;
  private nextContactAt = 0;
  private moving = false;
  private windupDirection: Direction = 'down';

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    stats: EnemyStats,
    private readonly config: WalkerConfig,
    private readonly grid: WalkableGrid,
    private readonly tilePx: number,
    private readonly onDeathCallback: (x: number, y: number) => void,
    /** O golpe acertou: quem chama aplica o dano no jogador (respeitando a invencibilidade) — `attacker` é este bicho (o pet revida contra ele). */
    private readonly onAttackHit: (damage: number, time: number, attacker: Enemy) => void,
  ) {
    super(scene, x, y, config.sheets.idle.key, 0, stats, config.shadowOffsetY);
    this.sprite.setScale(this.sprite.scaleX * (config.scale ?? 1));
    ensureWalkerAnims(scene, config.sheets, config.attack);
    this.playLoop('idle');
  }

  // --- IA -----------------------------------------------------------------------------------------------------------

  protected updateBehavior(time: number, delta: number, playerX: number, playerY: number): void {
    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const distance = Math.hypot(dx, dy);

    if (this.state === 'windup' || this.state === 'strike' || this.state === 'recover') {
      this.updateAttack(time, dx, dy, distance, playerX, playerY);
      return;
    }

    if (this.state === 'wander' && distance < this.config.aggro) this.state = 'chase';
    else if (this.state === 'chase' && distance > this.config.deaggro) {
      this.state = 'wander';
      this.wanderTarget = null;
    }

    this.moving = false;
    if (this.state === 'chase') this.updateChase(time, delta, dx, dy, distance, playerX, playerY);
    else this.updateWander(time, delta);
    this.playLoop(this.moving ? 'walk' : 'idle');
  }

  private updateChase(time: number, delta: number, dx: number, dy: number, distance: number, playerX: number, playerY: number): void {
    const attack = this.config.attack;
    this.facing = directionOf(dx, dy);

    if (attack?.kind === 'ranged') {
      // Arqueiro: mantém distância de tiro e se ALINHA com o jogador (mesma linha ou coluna) antes de mirar.
      const along = this.facing === 'left' || this.facing === 'right' ? Math.abs(dx) : Math.abs(dy);
      const across = this.facing === 'left' || this.facing === 'right' ? dy : dx;
      if (along <= attack.startRange && Math.abs(across) <= (attack.lineWidth ?? 16) * 0.6 && this.lineIsClear(playerX, playerY)) {
        this.beginWindup(time);
        return;
      }
      if (along <= attack.startRange) {
        // Perto o bastante: anda de lado até alinhar.
        const strafeX = this.facing === 'left' || this.facing === 'right' ? 0 : Math.sign(across);
        const strafeY = this.facing === 'left' || this.facing === 'right' ? Math.sign(across) : 0;
        this.moveBy(strafeX, strafeY, delta);
      } else {
        this.moveToward(playerX, playerY, delta);
      }
      return;
    }

    if (attack && distance <= attack.startRange) {
      this.beginWindup(time);
      return;
    }
    if (this.config.contact && distance <= this.config.contact.range && time >= this.nextContactAt) {
      this.nextContactAt = time + this.config.contact.cooldownMs;
      this.onAttackHit(this.stats.contactDamage, time, this);
    }
    if (distance > STOP_DISTANCE_PX) this.moveToward(playerX, playerY, delta);
  }

  // --- Ataque -------------------------------------------------------------------------------------------------------

  private beginWindup(time: number): void {
    const attack = this.config.attack!;
    this.state = 'windup';
    this.impactDone = false;
    this.stateEndsAt = time + attack.windupMs;
    this.windupDirection = this.facing;
    this.sprite.play(dirAnimKey(this.config.sheets.attack!, 'windup', this.facing));
    this.sprite.setTint(WINDUP_TINT);
  }

  private updateAttack(time: number, dx: number, dy: number, distance: number, playerX: number, playerY: number): void {
    const attack = this.config.attack!;
    if (this.state === 'windup') {
      if (time < this.stateEndsAt) return;
      this.sprite.clearTint();
      this.sprite.play(dirAnimKey(this.config.sheets.attack!, 'strike', this.windupDirection));
      this.state = 'strike';
      this.stateEndsAt = time + attack.strikeMs;
      return;
    }
    if (this.state === 'strike') {
      // O impacto cai na metade do golpe (quando aparece o efeito na arte).
      if (!this.impactDone && time >= this.stateEndsAt - attack.strikeMs / 2) {
        this.impactDone = true;
        if (this.playerIsHit(attack, dx, dy, distance, playerX, playerY)) this.onAttackHit(this.stats.contactDamage, time, this);
      }
      if (time < this.stateEndsAt) return;
      this.state = 'recover';
      this.stateEndsAt = time + attack.recoverMs;
      this.playLoop('idle');
      return;
    }
    // recover
    if (time < this.stateEndsAt) return;
    this.state = distance > this.config.deaggro ? 'wander' : 'chase';
    this.wanderTarget = null;
  }

  private playerIsHit(attack: WalkerAttack, dx: number, dy: number, distance: number, playerX: number, playerY: number): boolean {
    const forward = DIRECTION_VECTOR[this.windupDirection];
    if (attack.kind === 'melee') {
      if (distance > attack.hitRange) return false;
      return distance < 22 || dx * forward.dx + dy * forward.dy > 0; // À frente (ou colado nele).
    }
    // À distância: o jogador tem que estar na linha do tiro, no alcance, sem parede no meio.
    const along = dx * forward.dx + dy * forward.dy;
    const across = Math.abs(dx * forward.dy - dy * forward.dx);
    return along > 0 && along <= (attack.maxRange ?? attack.startRange) && across <= (attack.lineWidth ?? 16) && this.lineIsClear(playerX, playerY);
  }

  /** Levar um golpe durante o aviso interrompe o ataque e deixa o bicho atordoado um instante. */
  protected override onDamaged(): void {
    if (this.state !== 'windup') return;
    this.sprite.clearTint();
    this.state = 'recover';
    this.stateEndsAt = this.scene.time.now + STAGGER_MS;
    this.playLoop('idle');
  }

  /** Sem parede entre o bicho e o jogador (amostra a reta de célula em célula). */
  private lineIsClear(targetX: number, targetY: number): boolean {
    const steps = Math.ceil(Math.hypot(targetX - this.x, targetY - this.y) / (this.tilePx / 2));
    for (let i = 1; i < steps; i++) {
      const px = this.x + ((targetX - this.x) * i) / steps;
      const py = this.y - 12 + ((targetY - this.y) * i) / steps;
      if (!this.grid.isWalkable(Math.floor(px / this.tilePx), Math.floor(py / this.tilePx))) return false;
    }
    return true;
  }

  // --- Movimento -----------------------------------------------------------------------------------------------------

  private updateWander(time: number, delta: number): void {
    if (time >= this.nextWanderDecisionAt) {
      this.nextWanderDecisionAt = time + Phaser.Math.Between(WANDER_DECISION_MIN_MS, WANDER_DECISION_MAX_MS);
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const range = Phaser.Math.FloatBetween(0, WANDER_RANGE_PX);
      this.wanderTarget = Phaser.Math.Between(0, 1) === 0 ? null : { x: this.x + Math.cos(angle) * range, y: this.y + Math.sin(angle) * range };
    }
    if (this.wanderTarget) this.moveToward(this.wanderTarget.x, this.wanderTarget.y, delta);
  }

  /** O empurrão do golpe para na parede (`Enemy.knockbackTarget`). */
  protected override canOccupy(x: number, y: number): boolean {
    return this.canWalkTo(x, y);
  }

  /** O corpo (28x28 nos pés) cabe nesta posição? — só a célula exata que ele ocupa importa (grid 1x1). */
  private canWalkTo(x: number, y: number): boolean {
    const left = Math.floor((x - 14) / this.tilePx);
    const right = Math.floor((x + 14) / this.tilePx);
    const top = Math.floor((y - 30) / this.tilePx);
    const bottom = Math.floor((y - 2) / this.tilePx);
    return this.grid.isWalkable(left, top) && this.grid.isWalkable(right, top) && this.grid.isWalkable(left, bottom) && this.grid.isWalkable(right, bottom);
  }

  private moveToward(targetX: number, targetY: number, delta: number): void {
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const distance = Math.hypot(dx, dy);
    if (distance < ARRIVE_THRESHOLD_PX) {
      if (this.state === 'wander') this.wanderTarget = null;
      return;
    }
    if (this.state === 'wander') this.facing = directionOf(dx, dy);
    this.moveBy(dx / distance, dy / distance, delta);
  }

  /** Anda na direção (já normalizada) `ux,uy`, eixo por eixo (desliza na parede). */
  private moveBy(ux: number, uy: number, delta: number): void {
    const step = this.stats.moveSpeed * (delta / 1000);
    const nextX = this.x + ux * step;
    const nextY = this.y + uy * step;
    let moved = false;
    if (this.canWalkTo(nextX, this.y)) {
      this.sprite.x = nextX;
      moved = true;
    } else if (this.state === 'wander') this.wanderTarget = null;
    if (this.canWalkTo(this.x, nextY)) {
      this.sprite.y = nextY;
      moved = true;
    } else if (this.state === 'wander') this.wanderTarget = null;
    if (moved) this.moving = true;
  }

  private playLoop(kind: 'idle' | 'walk'): void {
    const sheet = kind === 'idle' ? this.config.sheets.idle : this.config.sheets.walk;
    const key = dirAnimKey(sheet, kind, this.facing);
    if (this.sprite.anims.currentAnim?.key !== key) this.sprite.play(key);
  }

  // --- Morte ---------------------------------------------------------------------------------------------------------

  protected onDeath(): void {
    this.shadow.destroy();
    this.sprite.clearTint();
    this.onDeathCallback(this.x, this.y);
    const dead = this.config.sheets.dead;
    if (dead) {
      this.sprite.play(dirAnimKey(dead, 'dead', this.facing));
      this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.fadeAway());
    } else {
      this.fadeAway();
    }
  }

  private fadeAway(): void {
    this.scene.tweens.add({ targets: this.sprite, alpha: 0, scaleY: this.sprite.scaleY * 0.6, duration: 260, onComplete: () => this.sprite.destroy() });
  }
}

/** Cria (uma vez por jogo) as animações do bicho: repouso e caminhada em loop; o ataque partido em aviso (`windup`) e golpe (`strike`). */
export function ensureWalkerAnims(scene: Phaser.Scene, sheets: WalkerSheets, attack?: WalkerAttack): void {
  ensureDirAnims(scene, sheets.idle, 'idle', { frameRate: 5, repeat: -1 });
  ensureDirAnims(scene, sheets.walk, 'walk', { frameRate: 8, repeat: -1 });
  if (sheets.attack && attack) {
    ensureDirAnims(scene, sheets.attack, 'windup', { frameRate: 6, repeat: 0, from: 0, to: attack.windupTo });
    ensureDirAnims(scene, sheets.attack, 'strike', { frameRate: 12, repeat: 0, from: attack.strikeFrom, to: attack.strikeTo });
  }
  if (sheets.dead) ensureDirAnims(scene, sheets.dead, 'dead', { frameRate: 7, repeat: 0 });
}
