import Phaser from 'phaser';
import {
  CHICKEN_FRAME_SIZE,
  CHICKEN_IDLE_FRAME,
  CHICKEN_IDLE_MS,
  CHICKEN_PECK_FRAMES,
  CHICKEN_PECK_FRAME_RATE,
  CHICKEN_PECK_MS,
  CHICKEN_ROAM_RADIUS_CELLS,
  CHICKEN_STEP_MS,
  CHICKEN_VARIANTS,
  CHICKEN_WALK_FRAMES,
  CHICKEN_WALK_FRAME_RATE,
} from '../data/animals';
import { createGroundShadow } from '../systems/shadow';
import { DISPLAY_SCALE } from '../systems/mapBuilder';

/** Carrega as folhas de todas as cores de galinha — chamado no `preload` da cena que as usa. */
export function preloadChickens(scene: Phaser.Scene): void {
  for (const variant of CHICKEN_VARIANTS) {
    if (!scene.textures.exists(variant.key)) {
      scene.load.spritesheet(variant.key, encodeURI(`/${variant.path}`), { frameWidth: CHICKEN_FRAME_SIZE, frameHeight: CHICKEN_FRAME_SIZE });
    }
  }
}

const walkKey = (variantKey: string): string => `${variantKey}-walk`;
const peckKey = (variantKey: string): string => `${variantKey}-peck`;

/** Cria (uma vez, globais do jogo) as animações de andar e bicar de cada cor. */
function ensureChickenAnims(scene: Phaser.Scene): void {
  for (const variant of CHICKEN_VARIANTS) {
    if (!scene.anims.exists(walkKey(variant.key))) {
      scene.anims.create({
        key: walkKey(variant.key),
        frames: CHICKEN_WALK_FRAMES.map((frame) => ({ key: variant.key, frame })),
        frameRate: CHICKEN_WALK_FRAME_RATE,
        repeat: -1,
      });
    }
    if (!scene.anims.exists(peckKey(variant.key))) {
      scene.anims.create({
        key: peckKey(variant.key),
        frames: CHICKEN_PECK_FRAMES.map((frame) => ({ key: variant.key, frame })),
        frameRate: CHICKEN_PECK_FRAME_RATE,
        repeat: -1,
      });
    }
  }
}

/** O que a galinha precisa saber do mundo pra decidir onde pisar. */
export interface ChickenWorld {
  tilePx: number;
  /** Pode pisar nesta célula? (andável e fora da lavoura). */
  canStand: (col: number, row: number) => boolean;
}

type State = 'idle' | 'walk' | 'peck' | 'inside';

const NEIGHBORS: Array<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/**
 * Uma galinha da fazenda: mora num galinheiro (`homeCol`/`homeRow` = a célula da porta, em frente a ele), vaga de célula em célula pelas
 * redondezas (a até `CHICKEN_ROAM_RADIUS_CELLS` da porta), pára, bica o chão e, à noite, recolhe-se ao galinheiro (some) até de manhã. Não bloqueia
 * ninguém: é só vida no cenário. As folhas têm só a pose virada pra esquerda — pra direita o sprite é espelhado.
 */
export class Chicken {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly variantKey: string;
  private col: number;
  private row: number;
  private state: State = 'idle';
  private stateUntil = 0;
  private fromX = 0;
  private fromY = 0;
  private toX = 0;
  private toY = 0;
  private stepElapsed = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: ChickenWorld,
    /** Id do galinheiro a que pertence (`coopKey`). */
    readonly coop: string,
    /** Posição dela na lista do galinheiro (`CoopState.birds`) — é como o carinho e a cor são achados. */
    readonly index: number,
    /** Cor (índice em `CHICKEN_VARIANTS`, guardada no save: não muda nunca). */
    variant: number,
    private readonly homeCol: number,
    private readonly homeRow: number,
    startInside: boolean,
  ) {
    ensureChickenAnims(scene);
    this.variantKey = CHICKEN_VARIANTS[variant % CHICKEN_VARIANTS.length].key;
    this.col = homeCol;
    this.row = homeRow;

    const { x, y } = this.anchor(this.col, this.row);
    this.sprite = scene.add.sprite(x, y, this.variantKey, CHICKEN_IDLE_FRAME);
    this.sprite.setOrigin(0.5, 1).setScale(DISPLAY_SCALE * 0.9);
    this.shadow = createGroundShadow(scene, x, y - 2, DISPLAY_SCALE * 0.5, DISPLAY_SCALE * 0.22);
    this.updateDepth();

    if (startInside) this.hide();
    else this.setIdle(scene.time.now);
  }

  private anchor(col: number, row: number): { x: number; y: number } {
    const { tilePx } = this.world;
    return { x: col * tilePx + tilePx / 2, y: (row + 1) * tilePx - 4 };
  }

  private updateDepth(): void {
    this.sprite.setDepth(this.sprite.y);
    this.shadow.setPosition(this.sprite.x, this.sprite.y - 2).setDepth(this.sprite.y - 0.1);
  }

  isInside(): boolean {
    return this.state === 'inside';
  }

  /** Célula onde ela está agora (o destino do passo em andamento, se estiver andando). */
  getCell(): { col: number; row: number } {
    return { col: this.col, row: this.row };
  }

  /** Ganhou carinho: pára um instante e dá um pulinho de alegria. */
  reactToPet(time: number): void {
    if (this.state === 'inside') return;
    this.setIdle(time);
    this.stateUntil = time + 1800;
    this.scene.tweens.add({ targets: this.sprite, y: this.sprite.y - 8, duration: 110, yoyo: true, repeat: 1, ease: 'Sine.easeOut' });
  }

  /** Recolhe-se ao galinheiro (fade e some) — a hora de dormir. */
  goInside(): void {
    if (this.state === 'inside') return;
    this.state = 'inside';
    this.scene.tweens.add({
      targets: [this.sprite, this.shadow],
      alpha: 0,
      duration: 500,
      onComplete: () => this.hide(),
    });
  }

  /** Sai do galinheiro (aparece na porta) — de manhã. */
  comeOut(time: number): void {
    if (this.state !== 'inside') return;
    this.col = this.homeCol;
    this.row = this.homeRow;
    const { x, y } = this.anchor(this.col, this.row);
    this.sprite.setPosition(x, y);
    this.sprite.setVisible(true).setAlpha(0);
    this.shadow.setVisible(true).setAlpha(0);
    this.updateDepth();
    this.scene.tweens.add({ targets: [this.sprite, this.shadow], alpha: { from: 0, to: 1 }, duration: 500 });
    this.setIdle(time);
  }

  private hide(): void {
    this.state = 'inside';
    this.sprite.anims.stop();
    this.sprite.setVisible(false).setAlpha(0);
    this.shadow.setVisible(false).setAlpha(0);
  }

  destroy(): void {
    this.scene.tweens.killTweensOf([this.sprite, this.shadow]);
    this.sprite.destroy();
    this.shadow.destroy();
  }

  private setIdle(time: number): void {
    this.state = 'idle';
    this.sprite.anims.stop();
    this.sprite.setFrame(CHICKEN_IDLE_FRAME);
    this.stateUntil = time + Phaser.Math.Between(CHICKEN_IDLE_MS.min, CHICKEN_IDLE_MS.max);
  }

  private startPeck(time: number): void {
    this.state = 'peck';
    this.sprite.play(peckKey(this.variantKey), true);
    this.stateUntil = time + Phaser.Math.Between(CHICKEN_PECK_MS.min, CHICKEN_PECK_MS.max);
  }

  /** Escolhe um vizinho livre dentro do raio e começa a andar até ele; sem nenhum, fica parada mais um pouco. */
  private tryStep(time: number): void {
    const options = NEIGHBORS.filter(([dc, dr]) => {
      const c = this.col + dc;
      const r = this.row + dr;
      return Math.abs(c - this.homeCol) <= CHICKEN_ROAM_RADIUS_CELLS && Math.abs(r - this.homeRow) <= CHICKEN_ROAM_RADIUS_CELLS && this.world.canStand(c, r);
    });
    if (options.length === 0) {
      this.setIdle(time);
      return;
    }

    const [dc, dr] = options[Phaser.Math.Between(0, options.length - 1)];
    const from = this.anchor(this.col, this.row);
    this.col += dc;
    this.row += dr;
    const to = this.anchor(this.col, this.row);
    this.fromX = from.x;
    this.fromY = from.y;
    this.toX = to.x;
    this.toY = to.y;
    this.stepElapsed = 0;
    this.state = 'walk';
    if (dc !== 0) this.sprite.setFlipX(dc > 0); // A arte olha pra esquerda.
    this.sprite.play(walkKey(this.variantKey), true);
  }

  update(time: number, delta: number): void {
    if (this.state === 'inside') return;

    if (this.state === 'walk') {
      this.stepElapsed += delta;
      const t = Math.min(1, this.stepElapsed / CHICKEN_STEP_MS);
      this.sprite.setPosition(Phaser.Math.Linear(this.fromX, this.toX, t), Phaser.Math.Linear(this.fromY, this.toY, t));
      this.updateDepth();
      if (t >= 1) {
        // Depois de um passo: continua andando, bica ou pára.
        const roll = Math.random();
        if (roll < 0.55) this.tryStep(time);
        else if (roll < 0.8) this.startPeck(time);
        else this.setIdle(time);
      }
      return;
    }

    if (time < this.stateUntil) return;
    if (this.state === 'peck') this.setIdle(time);
    else if (Math.random() < 0.7) this.tryStep(time);
    else this.startPeck(time);
  }
}
