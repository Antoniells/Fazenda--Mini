import Phaser from 'phaser';
import {
  DUCK_FRAME_SIZE,
  DUCK_KEY,
  DUCK_PATH,
  DUCK_SWIM_FRAMES,
  DUCK_SWIM_FRAME_RATE,
  DUCK_SWIM_SPEED,
  DUCK_TURN_PAUSE_MS,
  DUCK_CHANGE_MS,
  DUCK_FADE_MS,
  DUCK_PRESENT_CHANCE,
} from '../data/ducks';
import { DISPLAY_SCALE } from './mapBuilder';
import type { DuckLane } from './duckLanes';

/**
 * Patos nadando (`data/ducks.ts`): cada um vai e volta na sua raia (`systems/duckLanes.ts`), virando o corpo em cada ponta. Ficam
 * acima da água (-0.9) e abaixo de tudo que é ordenado pelo Y.
 */
const DUCK_DEPTH = -0.4;
const SWIM_ANIM_KEY = `${DUCK_KEY}-swim`;

export function preloadDucks(scene: Phaser.Scene): void {
  scene.load.spritesheet(DUCK_KEY, encodeURI(`/${DUCK_PATH}`), { frameWidth: DUCK_FRAME_SIZE, frameHeight: DUCK_FRAME_SIZE });
}

/** Um pato nadando na raia `lane` (`index` só defasa o começo, pra os patos não andarem em sincronia). */
export function spawnSwimmingDuck(scene: Phaser.Scene, tilePx: number, lane: DuckLane, index = 0): Phaser.GameObjects.Sprite {
  if (!scene.anims.exists(SWIM_ANIM_KEY)) {
    scene.anims.create({ key: SWIM_ANIM_KEY, frames: scene.anims.generateFrameNumbers(DUCK_KEY, DUCK_SWIM_FRAMES), frameRate: DUCK_SWIM_FRAME_RATE, repeat: -1 });
  }
  const y = (lane.row + 1) * tilePx - 6;
  const duck = scene.add.sprite((lane.fromCol + 0.5) * tilePx, y, DUCK_KEY, DUCK_SWIM_FRAMES.start).setOrigin(0.5, 1).setScale(DISPLAY_SCALE).setDepth(DUCK_DEPTH);
  duck.play(SWIM_ANIM_KEY);
  // A arte olha pra esquerda: nadando pra direita, espelha.
  duck.setFlipX(lane.toCol > lane.fromCol);
  const distance = Math.abs(lane.toCol - lane.fromCol) * tilePx;
  scene.tweens.add({
    targets: duck,
    x: (lane.toCol + 0.5) * tilePx,
    duration: (distance / DUCK_SWIM_SPEED) * 1000,
    delay: index * 900,
    ease: 'Sine.easeInOut',
    yoyo: true,
    repeat: -1,
    hold: DUCK_TURN_PAUSE_MS,
    repeatDelay: DUCK_TURN_PAUSE_MS,
    onYoyo: () => duck.setFlipX(!duck.flipX),
    onRepeat: () => duck.setFlipX(!duck.flipX),
  });
  return duck;
}

/** A próxima mudança do lago (`roll` em [0, 1)): sai um pato, chega um, ou nada. Sem pato, só pode chegar; lotado, só pode sair. */
export function nextPondChange(ducks: number, lanes: number, roll: number): 'leave' | 'arrive' | null {
  if (lanes === 0) return null;
  if (ducks === 0) return 'arrive';
  if (ducks >= lanes) return 'leave';
  return roll < 0.5 ? 'leave' : 'arrive';
}

/**
 * Os patos que VÃO E VÊM (o lago da Floresta, `data/ducks.ts`): um pato por raia no máximo. Ao montar, cada raia sorteia se já tem pato
 * (`DUCK_PRESENT_CHANCE`); de tempos em tempos (`DUCK_CHANGE_MS`) um pato some aos poucos ou um novo surge na água (`DUCK_FADE_MS`). Fora da
 * hora (`canBeHere` falso — de noite, na chuva) ninguém chega e os que estão lá somem. A cena chama `update` a cada frame.
 */
export class DuckPond {
  private readonly ducks = new Map<number, Phaser.GameObjects.Sprite>();
  private untilChangeMs = Phaser.Math.Between(DUCK_CHANGE_MS.min, DUCK_CHANGE_MS.max);

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly tilePx: number,
    private readonly lanes: DuckLane[],
    private readonly canBeHere: () => boolean,
  ) {
    if (!canBeHere()) return;
    lanes.forEach((_lane, index) => {
      if (Math.random() < DUCK_PRESENT_CHANCE) this.arrive(index, false);
    });
  }

  update(deltaMs: number): void {
    if (!this.canBeHere()) {
      for (const index of [...this.ducks.keys()]) this.leave(index);
      return;
    }
    this.untilChangeMs -= deltaMs;
    if (this.untilChangeMs > 0) return;
    this.untilChangeMs = Phaser.Math.Between(DUCK_CHANGE_MS.min, DUCK_CHANGE_MS.max);

    const change = nextPondChange(this.ducks.size, this.lanes.length, Math.random());
    if (change === 'leave') this.leave(Phaser.Utils.Array.GetRandom([...this.ducks.keys()]));
    if (change === 'arrive') {
      const free = this.lanes.map((_lane, index) => index).filter((index) => !this.ducks.has(index));
      if (free.length > 0) this.arrive(Phaser.Utils.Array.GetRandom(free), true);
    }
  }

  /** Um pato na raia `index` — já à vista (ao montar) ou surgindo aos poucos na água. */
  private arrive(index: number, fadeIn: boolean): void {
    const duck = spawnSwimmingDuck(this.scene, this.tilePx, this.lanes[index], index);
    this.ducks.set(index, duck);
    if (!fadeIn) return;
    duck.setAlpha(0);
    this.scene.tweens.add({ targets: duck, alpha: 1, duration: DUCK_FADE_MS, ease: 'Sine.easeOut' });
  }

  /** O pato da raia `index` some aos poucos (para de nadar e se apaga). */
  private leave(index: number): void {
    const duck = this.ducks.get(index);
    if (!duck) return;
    this.ducks.delete(index);
    this.scene.tweens.killTweensOf(duck);
    this.scene.tweens.add({ targets: duck, alpha: 0, duration: DUCK_FADE_MS, ease: 'Sine.easeIn', onComplete: () => duck.destroy() });
  }
}
