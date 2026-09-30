import Phaser from 'phaser';
import { Enemy, EnemyStats } from '../Enemy';
import { Direction, SPIKE_SHEETS } from '../../data/caveEnemies';
import { WalkableGrid } from '../../systems/grid';
import { dirAnimKey, directionOf, ensureDirAnims } from './caveAnims';

type SpikeState = 'surface' | 'digging' | 'hidden' | 'cracking' | 'emerging' | 'vulnerable';

/** Distância em que o Espinho nota o jogador e mergulha. */
const AGGRO_PX = 210;
/** Debaixo da terra ele anda mais rápido que na superfície (multiplica a velocidade). */
const BURROW_SPEED_MULT = 2.4;
const HIDDEN_MIN_MS = 1500;
const HIDDEN_MAX_MS = 2400;
/** Chega a esta distância do jogador e já abre a rachadura. */
const CRACK_DISTANCE_PX = 44;
/** Aviso: só a rachadura aparece no chão (o jogador tem esse tempo pra sair de cima). */
const CRACK_MS = 650;
const EMERGE_MS = 300;
/** Alcance do golpe quando ele sai da terra. */
const EMERGE_HIT_RADIUS_PX = 52;
/** Parado na superfície, vulnerável, depois de emergir. */
const VULNERABLE_MS = 1500;
const DIG_MS = 460;
/** A folha do Espinho tem 8 linhas nativas (16 px) de margem vazia sob os pés: a sombra fica logo sob eles. */
const SHADOW_OFFSET_Y = 18;

/**
 * O Espinho (Spike da Caverna): um ouriço que MERGULHA quando nota o jogador e anda debaixo da terra (invisível e intocável) até ficar embaixo dele; aí aparece só
 * a rachadura no chão (o aviso — quem sai de cima desvia) e ele EMERGE golpeando quem ainda estiver ali. Depois fica um instante na superfície, vulnerável, antes de
 * mergulhar de novo. Levar um golpe só é possível na superfície (`surface`/`vulnerable`).
 */
export class SpikeEnemy extends Enemy {
  private state: SpikeState = 'surface';
  private facing: Direction = 'down';
  private stateEndsAt = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    stats: EnemyStats,
    private readonly grid: WalkableGrid,
    private readonly tilePx: number,
    private readonly onDeathCallback: (x: number, y: number) => void,
    private readonly onAttackHit: (damage: number, time: number, attacker: Enemy) => void,
  ) {
    super(scene, x, y, SPIKE_SHEETS.idle.key, 0, stats, SHADOW_OFFSET_Y);
    ensureDirAnims(scene, SPIKE_SHEETS.idle, 'idle', { frameRate: 5, repeat: -1 });
    ensureDirAnims(scene, SPIKE_SHEETS.entering, 'dig', { frameRate: 9, repeat: 0 });
    ensureDirAnims(scene, SPIKE_SHEETS.leaving, 'crack', { frameRate: 5, repeat: 0, from: 0, to: 2 });
    ensureDirAnims(scene, SPIKE_SHEETS.leaving, 'emerge', { frameRate: 12, repeat: 0, from: 3, to: 5 });
    ensureDirAnims(scene, SPIKE_SHEETS.dead, 'dead', { frameRate: 7, repeat: 0 });
    this.playIdle();
  }

  /** Debaixo da terra (ou só com a rachadura aparecendo) ele não leva golpe. */
  override takeDamage(amount: number, knockbackDx: number, knockbackDy: number, source: 'player' | 'pet' = 'player'): void {
    if (this.state === 'digging' || this.state === 'hidden' || this.state === 'cracking' || this.state === 'emerging') return;
    super.takeDamage(amount, knockbackDx, knockbackDy, source);
  }

  protected updateBehavior(time: number, delta: number, playerX: number, playerY: number): void {
    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const distance = Math.hypot(dx, dy);

    switch (this.state) {
      case 'surface':
        this.face(dx, dy);
        if (distance < AGGRO_PX) this.beginDig(time);
        break;
      case 'digging':
        if (time >= this.stateEndsAt) this.goUnderground(time);
        break;
      case 'hidden':
        this.burrowToward(playerX, playerY, delta);
        if (time >= this.stateEndsAt || distance < CRACK_DISTANCE_PX) this.beginCrack(time);
        break;
      case 'cracking':
        if (time >= this.stateEndsAt) this.emerge(time, distance);
        break;
      case 'emerging':
        if (time >= this.stateEndsAt) {
          this.state = 'vulnerable';
          this.stateEndsAt = time + VULNERABLE_MS;
          this.playIdle();
        }
        break;
      case 'vulnerable':
        this.face(dx, dy);
        if (time >= this.stateEndsAt) {
          this.state = 'surface';
          if (distance < AGGRO_PX) this.beginDig(time);
        }
        break;
    }
  }

  private face(dx: number, dy: number): void {
    const next = directionOf(dx, dy);
    if (next === this.facing) return;
    this.facing = next;
    this.playIdle();
  }

  private playIdle(): void {
    this.sprite.play(dirAnimKey(SPIKE_SHEETS.idle, 'idle', this.facing));
  }

  private beginDig(time: number): void {
    this.state = 'digging';
    this.stateEndsAt = time + DIG_MS;
    this.sprite.play(dirAnimKey(SPIKE_SHEETS.entering, 'dig', this.facing));
  }

  private goUnderground(time: number): void {
    this.state = 'hidden';
    this.stateEndsAt = time + Phaser.Math.Between(HIDDEN_MIN_MS, HIDDEN_MAX_MS);
    this.sprite.setVisible(false);
    this.shadow.setVisible(false);
  }

  private beginCrack(time: number): void {
    this.state = 'cracking';
    this.stateEndsAt = time + CRACK_MS;
    this.sprite.setVisible(true);
    this.shadow.setVisible(false);
    this.sprite.play(dirAnimKey(SPIKE_SHEETS.leaving, 'crack', this.facing));
  }

  private emerge(time: number, distance: number): void {
    this.state = 'emerging';
    this.stateEndsAt = time + EMERGE_MS;
    this.shadow.setVisible(true);
    this.sprite.play(dirAnimKey(SPIKE_SHEETS.leaving, 'emerge', this.facing));
    if (distance <= EMERGE_HIT_RADIUS_PX) this.onAttackHit(this.stats.contactDamage, time, this);
  }

  /** O empurrão do golpe para na parede (`Enemy.knockbackTarget`): a célula dos pés, como ao cavar. */
  protected override canOccupy(x: number, y: number): boolean {
    return this.grid.isWalkable(Math.floor(x / this.tilePx), Math.floor((y - 2) / this.tilePx));
  }

  private burrowToward(targetX: number, targetY: number, delta: number): void {
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const distance = Math.hypot(dx, dy) || 1;
    this.facing = directionOf(dx, dy);
    const step = this.stats.moveSpeed * BURROW_SPEED_MULT * (delta / 1000);
    const nextX = this.x + (dx / distance) * step;
    const nextY = this.y + (dy / distance) * step;
    if (this.grid.isWalkable(Math.floor(nextX / this.tilePx), Math.floor((this.y - 2) / this.tilePx))) this.sprite.x = nextX;
    if (this.grid.isWalkable(Math.floor(this.x / this.tilePx), Math.floor((nextY - 2) / this.tilePx))) this.sprite.y = nextY;
  }

  protected onDeath(): void {
    this.shadow.destroy();
    this.onDeathCallback(this.x, this.y);
    this.sprite.setVisible(true);
    this.sprite.play(dirAnimKey(SPIKE_SHEETS.dead, 'dead', this.facing));
    this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.scene.tweens.add({ targets: this.sprite, alpha: 0, duration: 260, onComplete: () => this.sprite.destroy() });
    });
  }
}
