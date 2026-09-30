import Phaser from 'phaser';
import { DISPLAY_SCALE } from '../systems/mapBuilder';
import { createGroundShadow } from '../systems/shadow';
import { playEffect } from '../systems/soundEffects';
import { ENEMY_DEFEATED_SOUND } from '../data/audio';
import { SoundEffectDef } from '../data/audio';
import { popText } from '../systems/floatingText';

/** Atributos base de qualquer inimigo (Fase 8 — Combate) — cada subclasse concreta define os próprios valores. */
export interface EnemyStats {
  maxHp: number;
  /** Dano causado ao jogador quando o ataque do inimigo acerta (ver `entities/Slime.ts`). */
  contactDamage: number;
  /** Velocidade de movimento, em px de mundo por segundo (posição livre, não presa ao grid — ver comentário da classe). */
  moveSpeed: number;
  /** Som ao levar um golpe (inclusive o que mata) — opcional: sem ele, o inimigo apanha em silêncio. */
  hitSound?: SoundEffectDef;
}

const HIT_FLASH_MS = 80;
const KNOCKBACK_DISTANCE_PX = 22;
const KNOCKBACK_DURATION_MS = 140;
/** De quantos em quantos px o empurrão confere as paredes no caminho. */
const KNOCKBACK_STEP_PX = 2;
/** Quantos px acima dos pés (âncora do sprite) fica a sombra do inimigo — a arte do Slime tem margem vazia embaixo, então a sombra sobe pra ficar sob o corpo. */
const SHADOW_OFFSET_Y = 26;

/**
 * Base de qualquer inimigo (Fase 8 — Combate): posição LIVRE em pixels do
 * mundo, não presa ao grid de células como o `Player` — perseguir/vagar de
 * forma convincente fica muito mais simples com movimento contínuo, e
 * nenhum inimigo desta fase precisa desviar de obstáculo (não pedido).
 * Sprite próprio, ordenado por Y como qualquer objeto do mundo (mesma
 * convenção do personagem/árvores).
 *
 * Vida/dano de contato/velocidade vêm de `EnemyStats` (cada subclasse
 * define os seus, ver `entities/Slime.ts`); tremor/flash ao levar hit
 * reaproveita a mesma técnica de `systems/resourceInteraction.ts`
 * (`setTint` + `setTintMode(FILL)`, Phaser 4 não tem mais
 * `setTintFill(color)`), só que aqui também aplica um empurrão
 * (knockback) e verifica morte. Cada subclasse só precisa implementar a
 * IA (`updateBehavior`) e o que acontece ao morrer (`onDeath`).
 */
export abstract class Enemy {
  readonly sprite: Phaser.GameObjects.Sprite;
  protected readonly scene: Phaser.Scene;
  protected readonly stats: EnemyStats;
  protected readonly shadow: Phaser.GameObjects.Image; // <-- NOVA VARIÁVEL
  /** Quanto acima dos pés fica a sombra (a arte de cada bicho tem uma margem vazia diferente embaixo). */
  private readonly shadowOffsetY: number;

  private hp: number;
  private dead = false;

  constructor(scene: Phaser.Scene, x: number, y: number, textureKey: string, frame: number | string, stats: EnemyStats, shadowOffsetY: number = SHADOW_OFFSET_Y) {
    this.scene = scene;
    this.shadowOffsetY = shadowOffsetY;
    this.stats = stats;
    this.hp = stats.maxHp;

    // Cria a sombra antes do sprite com a mesma escala do player
    // Mude a criação da sombra para subtrair 20 no eixo Y
    this.shadow = createGroundShadow(scene, x, y - shadowOffsetY, DISPLAY_SCALE * 1.1, DISPLAY_SCALE * 0.5);
    this.shadow.setDepth(y - 0.1);

    this.sprite = scene.add.sprite(x, y, textureKey, frame);
    this.sprite.setOrigin(0.5, 1);
    this.sprite.setScale(DISPLAY_SCALE);
    this.sprite.setDepth(y);
  }

  get x(): number {
    return this.sprite.x;
  }

  get y(): number {
    return this.sprite.y;
  }

  getContactDamage(): number {
    return this.stats.contactDamage;
  }

  isDead(): boolean {
    return this.dead;
  }

  /**
   * Aplica dano + tremor/flash + empurrão (Fase 8 — Combate) — chamado por
   * `systems/combat.ts` quando o golpe de espada acerta este inimigo.
   * `knockbackDx/Dy` já vem normalizado (direção jogador→inimigo) de quem
   * chama, que é quem sabe onde o jogador está. `source` diz quem bateu (o
   * pet companheiro também morde — ver `entities/Pet.ts`).
   */
  takeDamage(amount: number, knockbackDx: number, knockbackDy: number, source: 'player' | 'pet' = 'player'): void {
    if (this.dead) return;

    this.hp -= amount;
    this.playHitFlash();
    // Número de dano subindo da cabeça (como no Terraria) + tremidinha da câmera: o golpe "pesa". A mordida do pet só mostra o número (cor diferente) — sacudir a tela a cada mordida cansaria.
    popText(this.scene, this.sprite.x, this.sprite.y - 34, `-${amount}`, source === 'pet' ? { color: '#bfe6ff', fontSize: 15 } : { color: '#ffe27a', fontSize: 18 });
    if (source === 'player') this.scene.cameras.main.shake(70, 0.003);
    if (this.stats.hitSound) playEffect(this.scene, this.stats.hitSound);

    if (this.hp <= 0) {
      this.die();
      return;
    }

    this.onDamaged();

    const target = this.knockbackTarget(knockbackDx, knockbackDy);
    this.scene.tweens.add({
      targets: [this.sprite, this.shadow],
      x: target.x,
      y: target.y,
      duration: KNOCKBACK_DURATION_MS,
      ease: 'Cubic.easeOut',
    });
  }

  /**
   * O corpo do bicho cabe em (`x`, `y`) (pés)? O empurrão do golpe só vai até onde isso vale — sem isso ele atravessava paredes e caía dentro delas. Cada subclasse que
   * anda pelo grid sobrescreve com a mesma checagem de colisão que usa pra andar; o padrão (sem grid) não bloqueia nada.
   */
  protected canOccupy(_x: number, _y: number): boolean {
    return true;
  }

  /** Até onde o empurrão leva: anda `KNOCKBACK_DISTANCE_PX` na direção do golpe em passos curtos, escorregando ao longo da parede (só um eixo) e parando quando os dois estão fechados. */
  private knockbackTarget(dx: number, dy: number): { x: number; y: number } {
    let x = this.sprite.x;
    let y = this.sprite.y;
    const steps = Math.ceil(KNOCKBACK_DISTANCE_PX / KNOCKBACK_STEP_PX);
    for (let i = 0; i < steps; i += 1) {
      const nextX = x + dx * KNOCKBACK_STEP_PX;
      const nextY = y + dy * KNOCKBACK_STEP_PX;
      if (this.canOccupy(nextX, nextY)) {
        x = nextX;
        y = nextY;
      } else if (dx !== 0 && this.canOccupy(nextX, y)) x = nextX;
      else if (dy !== 0 && this.canOccupy(x, nextY)) y = nextY;
      else break;
    }
    return { x, y };
  }

  private playHitFlash(): void {
    this.sprite.setTint(0xffffff);
    this.sprite.setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(HIT_FLASH_MS, () => {
      if (this.dead) return;
      this.sprite.clearTint();
      this.sprite.setTintMode(Phaser.TintModes.MULTIPLY);
    });
  }

  /** Some de cena SEM morrer (a horda amanheceu): para de agir mas não dispara `onDeath` — a subclasse cuida do visual. */
  protected markGone(): void {
    this.dead = true;
  }

  private die(): void {
    this.dead = true;
    playEffect(this.scene, ENEMY_DEFEATED_SOUND);
    this.onDeath();
  }

  /** Hook: chamado quando leva dano E sobrevive — a subclasse pode reagir (ex.: interromper um ataque em preparação). Não faz nada por padrão. */
  protected onDamaged(): void {}

  /** Hook: cada subclasse decide a animação/efeito de morte e destrói o próprio sprite quando ela terminar. */
  protected abstract onDeath(): void;

  /** Hook de IA por frame — cada subclasse decide vagar/perseguir (ver `entities/Slime.ts`). */
  protected abstract updateBehavior(time: number, delta: number, playerX: number, playerY: number): void;

update(time: number, delta: number, playerX: number, playerY: number): void {
    if (this.dead) return;
    this.updateBehavior(time, delta, playerX, playerY);
    
    this.sprite.setDepth(this.sprite.y);
    
    // Atualiza a posição e a profundidade da sombra
    // Atualiza a posição da sombra para y - 20
    this.shadow.setPosition(this.sprite.x, this.sprite.y - this.shadowOffsetY);
    this.shadow.setDepth(this.sprite.y - 0.1);
  }
}
