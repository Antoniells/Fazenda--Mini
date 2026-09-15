import Phaser from 'phaser';
import { Enemy, EnemyStats } from './Enemy';
import { SLIME_KEY, SLIME_IDLE_ANIM_KEY, SLIME_IDLE_FRAMES, SLIME_DEATH_ANIM_KEY, SLIME_DEATH_FRAMES, SLIME_STATS } from '../data/enemies';
import { WalkableGrid } from '../systems/grid';

type SlimeState = 'wander' | 'chase';

/** Raio (px) em que o Slime nota o jogador e começa a perseguir. */
const AGGRO_RADIUS_PX = 100;
/** Raio de "desistir" — maior que o de aggro de propósito (histerese: sem isso, o Slime ficaria alternando perseguir/vagar toda hora bem na borda do raio). */
const DEAGGRO_RADIUS_PX = 160;
/** Intervalo (ms) entre decisões de vagar — pausa parado ou escolhe um ponto novo. */
const WANDER_DECISION_MIN_MS = 1500;
const WANDER_DECISION_MAX_MS = 3500;
/** Distância máxima (px) de um novo ponto de destino ao vagar, a partir da posição atual. */
const WANDER_RANGE_PX = 48;
/** Distância (px) considerada "chegou" ao destino — evita ficar tremendo em torno do ponto exato. */
const ARRIVE_THRESHOLD_PX = 4;

let animsRegistered = false;

/** Cria as animações de idle/derrota uma única vez por `Game` (spritesheet global, não por cena) — mesma técnica idempotente de `FarmlandRenderer.ensureSplashAnim`. */
function ensureSlimeAnims(scene: Phaser.Scene): void {
  if (animsRegistered && scene.anims.exists(SLIME_IDLE_ANIM_KEY)) return;
  scene.anims.create({
    key: SLIME_IDLE_ANIM_KEY,
    frames: scene.anims.generateFrameNumbers(SLIME_KEY, SLIME_IDLE_FRAMES),
    frameRate: 6,
    repeat: -1,
  });
  scene.anims.create({
    key: SLIME_DEATH_ANIM_KEY,
    frames: scene.anims.generateFrameNumbers(SLIME_KEY, SLIME_DEATH_FRAMES),
    frameRate: 6,
    repeat: 0,
  });
  animsRegistered = true;
}

/**
 * Primeiro inimigo do jogo (Fase 8 — Combate, pedido explícito do usuário):
 * nasce parado (`wander`), vagando aleatoriamente de tempos em tempos: a
 * cada intervalo (`WANDER_DECISION_MIN/MAX_MS`), escolhe entre ficar
 * parado ou ir até um ponto aleatório perto de onde está. Se o jogador
 * entrar no raio de detecção (`AGGRO_RADIUS_PX`), muda pra `chase` e anda
 * direto na direção dele a cada frame; some do raio maior de desistência
 * (`DEAGGRO_RADIUS_PX`) e volta a vagar.
 */
export class Slime extends Enemy {
  private state: SlimeState = 'wander';
  private wanderTarget: { x: number; y: number } | null = null;
  private nextWanderDecisionAt = 0;
  private readonly onDeathCallback: (x: number, y: number) => void;

constructor(
    scene: Phaser.Scene, 
    x: number, 
    y: number, 
    onDeath: (x: number, y: number) => void, 
    private readonly grid: WalkableGrid, 
    private readonly tilePx: number, 
    stats: EnemyStats = SLIME_STATS
  ) {
    super(scene, x, y, SLIME_KEY, SLIME_IDLE_FRAMES.start, stats);
    ensureSlimeAnims(scene);
    this.sprite.play(SLIME_IDLE_ANIM_KEY);
    this.onDeathCallback = onDeath;
  }

  protected updateBehavior(time: number, delta: number, playerX: number, playerY: number): void {
    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const distanceToPlayer = Math.hypot(dx, dy);

    if (this.state === 'wander' && distanceToPlayer < AGGRO_RADIUS_PX) {
      this.state = 'chase';
    } else if (this.state === 'chase' && distanceToPlayer > DEAGGRO_RADIUS_PX) {
      this.state = 'wander';
      this.wanderTarget = null;
    }

if (this.state === 'chase') {
      // Impede o Slime de entrar no mesmo bloco/pixel do jogador!
      if (distanceToPlayer > 32) {
        this.moveToward(playerX, playerY, delta);
      }
    } else {
      this.updateWander(time, delta);
    }
  }

  private updateWander(time: number, delta: number): void {
    if (time >= this.nextWanderDecisionAt) {
      this.nextWanderDecisionAt = time + Phaser.Math.Between(WANDER_DECISION_MIN_MS, WANDER_DECISION_MAX_MS);
      // Metade das vezes fica parado (idle), metade escolhe um ponto novo — Slime não anda o tempo todo sem parar.
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const distance = Phaser.Math.FloatBetween(0, WANDER_RANGE_PX);
      this.wanderTarget = Phaser.Math.Between(0, 1) === 0 ? null : { x: this.x + Math.cos(angle) * distance, y: this.y + Math.sin(angle) * distance };
    }

    if (this.wanderTarget) this.moveToward(this.wanderTarget.x, this.wanderTarget.y, delta);
  }
/** Verifica se a "caixa de colisão" inteira do slime pode pisar naquele ponto */
  private canWalkTo(x: number, y: number): boolean {
    // Cria uma "caixa" de 24px de largura por 16px de altura, focada na base do slime
    const left = Math.floor((x - 8) / this.tilePx);
    const right = Math.floor((x + 8) / this.tilePx);
    const top = Math.floor((y - 26) / this.tilePx);
    const bottom = Math.floor((y - 1) / this.tilePx); // -1 pra não travar na linha milimétrica de baixo

    return this.grid.isWalkable(left, top) &&
           this.grid.isWalkable(right, top) &&
           this.grid.isWalkable(left, bottom) &&
           this.grid.isWalkable(right, bottom);
  }

private moveToward(targetX: number, targetY: number, delta: number): void {
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const distance = Math.hypot(dx, dy);

    if (distance < ARRIVE_THRESHOLD_PX) {
      if (this.state === 'wander') this.wanderTarget = null;
      return;
    }

    const step = this.stats.moveSpeed * (delta / 1000);
    const moveX = (dx / distance) * step;
    const moveY = (dy / distance) * step;

    const nextX = this.x + moveX;
    const nextY = this.y + moveY;

    // Colisão Eixo X usando a nova Hitbox!
    if (this.canWalkTo(nextX, this.y)) {
      this.sprite.x = nextX;
    } else if (this.state === 'wander') {
      this.wanderTarget = null; // Bateu num obstáculo ao vagar, desiste e escolhe outro ponto
    }

    // Colisão Eixo Y usando a nova Hitbox!
    if (this.canWalkTo(this.x, nextY)) {
      this.sprite.y = nextY;
    } else if (this.state === 'wander') {
      this.wanderTarget = null;
    }

    if (Math.abs(dx) > 1) this.sprite.setFlipX(dx < 0);
  }

protected onDeath(): void {
    this.shadow.destroy(); // <-- DESTROI A SOMBRA AQUI!
    
    this.sprite.play(SLIME_DEATH_ANIM_KEY);
    this.onDeathCallback(this.x, this.y);
    this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.sprite.destroy());
  }
}
