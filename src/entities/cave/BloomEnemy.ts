import Phaser from 'phaser';
import { Enemy, EnemyStats } from '../Enemy';
import { BLOOM_SHEETS, SheetDef } from '../../data/caveEnemies';

type BloomState = 'dormant' | 'waking' | 'awake' | 'windup' | 'strike' | 'recover';

/** O botão fechado desperta quando o jogador chega a esta distância. */
const WAKE_RADIUS_PX = 150;
/** Desperta, ela começa a preparar a pancada quando o jogador está a esta distância. */
const ATTACK_RADIUS_PX = 96;
/** Raio do anel da pancada (a onda rosa da arte) — quem está dentro no impacto leva o dano. */
const RING_RADIUS_PX = 80;
const WAKE_MS = 750;
const WINDUP_MS = 700;
const STRIKE_MS = 320;
const RECOVER_MS = 1500;
const WINDUP_TINT = 0xff9a9a;
const SHADOW_OFFSET_Y = 8;

const frames = (sheet: SheetDef, scene: Phaser.Scene, start = 0, end = sheet.frames - 1): Phaser.Types.Animations.AnimationFrame[] =>
  scene.anims.generateFrameNumbers(sheet.key, { start, end });

/**
 * A Flor Venenosa (Venom Bloom da Caverna): fica parada. Começa como um botão fechado; quando o jogador chega perto ela ABRE (`waking`) e, com ele ao alcance, prepara a
 * pancada — as raízes se enrolam e ela fica avermelhada (o aviso) — e bate em ÁREA, um anel em volta dela (`RING_RADIUS_PX`): quem sai do alcance durante o aviso desvia. Depois
 * de bater fica parada um tempo, vulnerável. É a única que não persegue: o jogador escolhe se chega perto.
 */
export class BloomEnemy extends Enemy {
  private state: BloomState = 'dormant';
  private stateEndsAt = 0;
  private impactDone = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    stats: EnemyStats,
    private readonly onDeathCallback: (x: number, y: number) => void,
    private readonly onAttackHit: (damage: number, time: number, attacker: Enemy) => void,
  ) {
    super(scene, x, y, BLOOM_SHEETS.wake.key, 0, stats, SHADOW_OFFSET_Y);
    const create = (key: string, sheet: SheetDef, frameRate: number, repeat: number, start?: number, end?: number): void => {
      if (!scene.anims.exists(key)) scene.anims.create({ key, frames: frames(sheet, scene, start, end), frameRate, repeat });
    };
    create('cave-bloom:wake', BLOOM_SHEETS.wake, 8, 0);
    create('cave-bloom:idle', BLOOM_SHEETS.idle, 4, -1);
    create('cave-bloom:windup', BLOOM_SHEETS.attack, 4, 0, 0, 1);
    create('cave-bloom:strike', BLOOM_SHEETS.attack, 8, 0, 2, 3);
    create('cave-bloom:dead', BLOOM_SHEETS.dead, 7, 0);
    this.sprite.setFrame(0); // O botão fechado (o 1º quadro do despertar).
  }

  protected updateBehavior(time: number, _delta: number, playerX: number, playerY: number): void {
    const distance = Math.hypot(playerX - this.x, playerY - this.y);

    switch (this.state) {
      case 'dormant':
        if (distance < WAKE_RADIUS_PX) {
          this.state = 'waking';
          this.stateEndsAt = time + WAKE_MS;
          this.sprite.play('cave-bloom:wake');
        }
        break;
      case 'waking':
        if (time >= this.stateEndsAt) {
          this.state = 'awake';
          this.sprite.play('cave-bloom:idle');
        }
        break;
      case 'awake':
        if (distance < ATTACK_RADIUS_PX) {
          this.state = 'windup';
          this.impactDone = false;
          this.stateEndsAt = time + WINDUP_MS;
          this.sprite.play('cave-bloom:windup');
          this.sprite.setTint(WINDUP_TINT);
        }
        break;
      case 'windup':
        if (time >= this.stateEndsAt) {
          this.state = 'strike';
          this.stateEndsAt = time + STRIKE_MS;
          this.sprite.clearTint();
          this.sprite.play('cave-bloom:strike');
        }
        break;
      case 'strike':
        if (!this.impactDone && time >= this.stateEndsAt - STRIKE_MS / 2) {
          this.impactDone = true;
          if (distance <= RING_RADIUS_PX) this.onAttackHit(this.stats.contactDamage, time, this);
        }
        if (time >= this.stateEndsAt) {
          this.state = 'recover';
          this.stateEndsAt = time + RECOVER_MS;
          this.sprite.play('cave-bloom:idle');
        }
        break;
      case 'recover':
        if (time >= this.stateEndsAt) this.state = 'awake';
        break;
    }
  }

  /** Levar um golpe durante o aviso cancela a pancada. */
  protected override onDamaged(): void {
    if (this.state === 'dormant') {
      this.state = 'awake';
      this.sprite.play('cave-bloom:idle');
    } else if (this.state === 'windup') {
      this.sprite.clearTint();
      this.state = 'recover';
      this.stateEndsAt = this.scene.time.now + RECOVER_MS / 2;
      this.sprite.play('cave-bloom:idle');
    }
  }

  protected onDeath(): void {
    this.shadow.destroy();
    this.sprite.clearTint();
    this.onDeathCallback(this.x, this.y);
    this.sprite.play('cave-bloom:dead');
    this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.scene.tweens.add({ targets: this.sprite, alpha: 0, duration: 260, onComplete: () => this.sprite.destroy() });
    });
  }
}
