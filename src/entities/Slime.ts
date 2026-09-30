import Phaser from 'phaser';
import { Enemy, EnemyStats } from './Enemy';
import {
  SLIME_KEY,
  SLIME_IDLE_ANIM_KEY,
  SLIME_IDLE_FRAMES,
  SLIME_DEATH_ANIM_KEY,
  SLIME_DEATH_FRAMES,
  SLIME_ATTACK_ANIM_KEY,
  SLIME_ATTACK_WINDUP_FRAME,
  SLIME_ATTACK_FRAMES,
  SLIME_STATS,
} from '../data/enemies';
import { WalkableGrid } from '../systems/grid';

/**
 * `windup` (agacha e avisa) -> `strike` (pula) -> `recover` (parado,
 * vulnerável) é o ciclo de ataque; `recover` também serve de recarga entre
 * ataques e de "atordoamento" quando o Slime é atingido durante o `windup`.
 */
type SlimeState = 'wander' | 'chase' | 'windup' | 'strike' | 'recover';

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

/**
 * Ataque. Distâncias medidas pé a pé (Slime e jogador são ancorados no chão,
 * origin 0.5,1). O Slime para de andar a 32px do jogador; começa a preparar
 * o golpe um pouco antes disso (40px), então chega já "em posição".
 */
const ATTACK_RANGE_PX = 40;
/** Alcance em que o golpe ainda ACERTA no impacto — um pouco maior que o de início, pra 1px de diferença não anular um golpe justo; andar uma célula (32px) durante o `windup` basta pra escapar. */
const HIT_RANGE_PX = 46;
/** Tempo de aviso (agachado, avermelhado) antes do pulo — a janela pro jogador reagir. */
const WINDUP_MS = 450;
/** Duração do pulo até o impacto (a animação de ataque tem 3 frames a 12fps ≈ 250ms; o dano cai na aterrissagem). */
const STRIKE_MS = 170;
/** Parado depois do golpe (recarga + janela pra contra-atacar). */
const RECOVER_MS = 1000;
/** Atordoamento quando o Slime é atingido durante o `windup` — o ataque em preparação é cancelado. */
const STAGGER_MS = 600;
const WINDUP_TINT = 0xff8a8a;

/** Chaves das 3 animações de uma folha de slime: a verde (Floresta/horda) mantém as de sempre; as outras cores (Caverna) derivam da chave da textura. */
function slimeAnimKeys(textureKey: string): { idle: string; death: string; attack: string } {
  if (textureKey === SLIME_KEY) return { idle: SLIME_IDLE_ANIM_KEY, death: SLIME_DEATH_ANIM_KEY, attack: SLIME_ATTACK_ANIM_KEY };
  return { idle: `${textureKey}:idle`, death: `${textureKey}:death`, attack: `${textureKey}:attack` };
}

/** Cria as animações de idle/derrota/ataque da folha `textureKey` (a verde por padrão) uma única vez por `Game` (spritesheet global, não por cena) — mesma técnica idempotente de `FarmlandRenderer.ensureSplashAnim`. */
export function ensureSlimeAnims(scene: Phaser.Scene, textureKey: string = SLIME_KEY): void {
  const keys = slimeAnimKeys(textureKey);
  if (scene.anims.exists(keys.idle)) return;
  scene.anims.create({ key: keys.idle, frames: scene.anims.generateFrameNumbers(textureKey, SLIME_IDLE_FRAMES), frameRate: 6, repeat: -1 });
  scene.anims.create({ key: keys.death, frames: scene.anims.generateFrameNumbers(textureKey, SLIME_DEATH_FRAMES), frameRate: 6, repeat: 0 });
  scene.anims.create({ key: keys.attack, frames: scene.anims.generateFrameNumbers(textureKey, SLIME_ATTACK_FRAMES), frameRate: 12, repeat: 0 });
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
  /** Escala "normal" do sprite (`DISPLAY_SCALE`, definida por `Enemy`) — o aviso do ataque deforma em cima dela e volta pra cá. */
  private readonly baseScale: number;
  /** Quando o estado temporizado atual (`windup`/`strike`/`recover`) termina. */
  private stateEndsAt = 0;
  private telegraphTween: Phaser.Tweens.Tween | null = null;
  private readonly animKeys: { idle: string; death: string; attack: string };

constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    onDeath: (x: number, y: number) => void,
    private readonly grid: WalkableGrid,
    private readonly tilePx: number,
    /** Chamado no IMPACTO do golpe, só se o jogador ainda estiver ao alcance — quem chama decide o que fazer com o dano (aplicar na vida, feedback, etc.); `attacker` é este Slime (o pet companheiro revida contra ele). */
    private readonly onAttackHit: (damage: number, time: number, attacker: Enemy) => void,
    stats: EnemyStats = SLIME_STATS,
    /** Qual folha (cor) usar — a Caverna tem slimes de várias cores; padrão: o verde de sempre. */
    textureKey: string = SLIME_KEY,
    /** Multiplica o tamanho do sprite (o Slime Guardião da Caverna é maior). */
    sizeMultiplier = 1,
  ) {
    super(scene, x, y, textureKey, SLIME_IDLE_FRAMES.start, stats);
    ensureSlimeAnims(scene, textureKey);
    this.animKeys = slimeAnimKeys(textureKey);
    this.sprite.play(this.animKeys.idle);
    if (sizeMultiplier !== 1) {
      this.sprite.setScale(this.sprite.scaleX * sizeMultiplier);
      this.shadow.setScale(this.shadow.scaleX * sizeMultiplier);
    }
    this.onDeathCallback = onDeath;
    this.baseScale = this.sprite.scaleX;
  }

  protected updateBehavior(time: number, delta: number, playerX: number, playerY: number): void {
    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const distanceToPlayer = Math.hypot(dx, dy);

    // Ciclo de ataque: parado durante todo ele, não persegue nem vaga.
    if (this.state === 'windup' || this.state === 'strike' || this.state === 'recover') {
      this.updateAttack(time, dx, distanceToPlayer);
      return;
    }

    if (this.state === 'wander' && distanceToPlayer < AGGRO_RADIUS_PX) {
      this.state = 'chase';
    } else if (this.state === 'chase' && distanceToPlayer > DEAGGRO_RADIUS_PX) {
      this.state = 'wander';
      this.wanderTarget = null;
    }

if (this.state === 'chase') {
      if (distanceToPlayer <= ATTACK_RANGE_PX) {
        this.beginWindup(time, dx);
        return;
      }
      // Impede o Slime de entrar no mesmo bloco/pixel do jogador!
      if (distanceToPlayer > 32) {
        this.moveToward(playerX, playerY, delta);
      }
    } else {
      this.updateWander(time, delta);
    }
  }

  // --- Ataque -----------------------------------------------------------------

  private beginWindup(time: number, dxToPlayer: number): void {
    this.state = 'windup';
    this.stateEndsAt = time + WINDUP_MS;
    if (Math.abs(dxToPlayer) > 1) this.sprite.setFlipX(dxToPlayer < 0);

    // Congela no frame agachado (o mesmo de onde o pulo parte) e deforma +
    // avermelha: o aviso visual de que vem um golpe.
    this.sprite.stop();
    this.sprite.setFrame(SLIME_ATTACK_WINDUP_FRAME);
    this.sprite.setTint(WINDUP_TINT);
    this.telegraphTween = this.scene.tweens.add({
      targets: this.sprite,
      scaleX: this.baseScale * 1.15,
      scaleY: this.baseScale * 0.82,
      duration: WINDUP_MS,
      ease: 'Sine.easeIn',
    });
  }

  private updateAttack(time: number, dxToPlayer: number, distanceToPlayer: number): void {
    if (time < this.stateEndsAt) return;

    if (this.state === 'windup') {
      this.stopTelegraph();
      this.sprite.clearTint();
      if (Math.abs(dxToPlayer) > 1) this.sprite.setFlipX(dxToPlayer < 0);
      this.sprite.play(this.animKeys.attack);
      this.state = 'strike';
      this.stateEndsAt = time + STRIKE_MS;
      return;
    }

    if (this.state === 'strike') {
      // Impacto: só acerta se o jogador AINDA estiver ao alcance agora —
      // andar pra longe durante o `windup` desvia do golpe.
      if (distanceToPlayer <= HIT_RANGE_PX) this.onAttackHit(this.stats.contactDamage, time, this);
      this.state = 'recover'; // O frame final (aterrissagem achatada) fica congelado durante a recuperação.
      this.stateEndsAt = time + RECOVER_MS;
      return;
    }

    // `recover` acabou: volta ao normal.
    this.sprite.play(this.animKeys.idle);
    this.state = distanceToPlayer > DEAGGRO_RADIUS_PX ? 'wander' : 'chase';
    this.wanderTarget = null;
  }

  /**
   * Desfaz a deformação do aviso e devolve a escala normal. NÃO mexe no tom
   * avermelhado de propósito: quem chama decide (ao sair do aviso pro pulo,
   * `updateAttack` limpa; ao levar dano, o flash branco de `Enemy` já limpa o
   * tint sozinho em 80ms — limpar aqui cancelaria esse flash na hora).
   */
  private stopTelegraph(): void {
    this.telegraphTween?.stop();
    this.telegraphTween = null;
    this.sprite.setScale(this.baseScale);
  }

  /** Levar um golpe durante o aviso interrompe o ataque e deixa o Slime atordoado por um instante — dá valor a atacar primeiro. */
  protected override onDamaged(): void {
    if (this.state !== 'windup') return;
    this.stopTelegraph();
    this.sprite.play(this.animKeys.idle);
    this.state = 'recover';
    this.stateEndsAt = this.scene.time.now + STAGGER_MS;
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
  /** O empurrão do golpe para na parede (`Enemy.knockbackTarget`): o mesmo corpo de colisão do andar. */
  protected override canOccupy(x: number, y: number): boolean {
    return this.canWalkTo(x, y);
  }

  /** Verifica apenas a célula exata que o centro do corpo do Slime vai ocupar (grid 1x1 — Fase 9, pedido explícito do usuário). */
private canWalkTo(x: number, y: number): boolean {
    // Caixa de colisão de 28x28 (Tamanho do tile de 32px com 2px de folga de cada lado)
    // O eixo Y do Slime é nos pés, então o centro dele é y - 16.
    const left = Math.floor((x - 14) / this.tilePx);
    const right = Math.floor((x + 14) / this.tilePx);
    
    // Topo da cabeça (y - 32 + folga) até a base dos pés (y + folga)
    const top = Math.floor((y - 30) / this.tilePx);
    const bottom = Math.floor((y - 2) / this.tilePx);

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
    this.stopTelegraph(); // Morreu no meio do aviso: sem isso o tween de escala continuaria mexendo no sprite da animação de morte.
    this.shadow.destroy(); // <-- DESTROI A SOMBRA AQUI!

    this.sprite.play(this.animKeys.death);
    this.onDeathCallback(this.x, this.y);
    this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.sprite.destroy());
  }
}
