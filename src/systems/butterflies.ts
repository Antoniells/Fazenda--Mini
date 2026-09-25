import Phaser from 'phaser';
import { BUTTERFLY_SPECIES, BUTTERFLY_FRAME_SIZE, BUTTERFLY_FRAMES, BUTTERFLY_FLAP_FPS } from '../data/effects';
import { GameClock } from './gameClock';
import { DISPLAY_SCALE } from './mapBuilder';

/** Quantas podem existir ao mesmo tempo e de quanto em quanto tempo (ms) tenta nascer uma nova — pequenas e esparsas, só um toque de vida. */
const MAX_ALIVE = 6;
const SPAWN_INTERVAL_MS = { min: 1500, max: 4500 };
const FIRST_SPAWN_MS = 600;
/** Tempo (ms) que o Tween de opacidade leva pra aparecer / sumir, e por quanto tempo ela fica totalmente visível entre os dois. */
const FADE_MS = 1400;
const VISIBLE_MS = { min: 6000, max: 12000 };
/** Velocidade média de deriva (px/s) + oscilação (batida irregular, sem voar em linha reta). */
const DRIFT_SPEED = { min: 8, max: 22 };
const WOBBLE_PX_PER_S = 16;
/** Acima de todo o mundo ordenado por Y (árvores, personagem) e abaixo do véu da noite (999) — voa por cima da copa das árvores. */
const DEPTH = 990;
/** Margem (em px) além da tela onde ainda pode nascer — assim elas também "entram" voando de fora. */
const SPAWN_MARGIN_PX = 32;
const SPAWN_TRIES = 12;

interface Butterfly {
  sprite: Phaser.GameObjects.Sprite;
  vx: number;
  vy: number;
  phase: number;
  elapsedMs: number;
  fade: Phaser.Tweens.Tween;
  leaving: boolean;
}

export function preloadButterflies(scene: Phaser.Scene): void {
  for (const species of BUTTERFLY_SPECIES) {
    scene.load.spritesheet(species.key, encodeURI(`/${species.path}`), { frameWidth: BUTTERFLY_FRAME_SIZE, frameHeight: BUTTERFLY_FRAME_SIZE });
  }
}

function ensureFlapAnims(scene: Phaser.Scene): void {
  for (const species of BUTTERFLY_SPECIES) {
    if (scene.anims.exists(species.animKey)) continue;
    scene.anims.create({
      key: species.animKey,
      frames: scene.anims.generateFrameNumbers(species.key, BUTTERFLY_FRAMES),
      frameRate: BUTTERFLY_FLAP_FPS,
      repeat: -1,
    });
  }
}

/**
 * Borboletinhas da Fazenda (efeito visual, só de dia): de tempos em tempos uma nasce numa posição aleatória de
 * grama dentro (ou logo além) da tela, aparece com um Tween de opacidade (alpha 0 → 1), fica um tempo à vista
 * batendo asa e derivando devagar, e some do mesmo jeito (1 → 0). É UM Tween só (`yoyo` + `hold`), então subir e
 * descer o alfa são as duas metades do mesmo movimento. Quando o dia acaba (`GameClock.isDaytime`) ninguém novo
 * nasce e as que estão no ar somem suavemente — nunca existe borboleta de noite.
 *
 * Sem colisão nem interação; a cena chama `update` a cada frame (mesmo padrão dos outros sistemas de cena) e os
 * sprites/tweens morrem junto com ela. Quais células servem de "chão" (`isSpawnCell`) é decisão da cena.
 */
export class ButterflyField {
  private readonly alive = new Set<Butterfly>();
  private untilNextSpawnMs = FIRST_SPAWN_MS;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly clock: GameClock,
    private readonly tilePx: number,
    private readonly isSpawnCell: (col: number, row: number) => boolean,
  ) {
    ensureFlapAnims(scene);
  }

  update(deltaMs: number): void {
    // As que já estão no ar continuam voando enquanto somem (também na saída do fim do dia).
    const dt = deltaMs / 1000;
    for (const butterfly of this.alive) this.drift(butterfly, deltaMs, dt);

    if (!this.clock.isDaytime()) {
      if (this.alive.size > 0) this.dismissAll();
      this.untilNextSpawnMs = FIRST_SPAWN_MS;
      return;
    }

    this.untilNextSpawnMs -= deltaMs;
    if (this.untilNextSpawnMs > 0) return;
    this.untilNextSpawnMs = Phaser.Math.Between(SPAWN_INTERVAL_MS.min, SPAWN_INTERVAL_MS.max);
    if (this.alive.size < MAX_ALIVE) this.spawn();
  }

  private drift(butterfly: Butterfly, deltaMs: number, dt: number): void {
    butterfly.elapsedMs += deltaMs;
    const wobbleX = Math.cos(butterfly.elapsedMs * 0.004 + butterfly.phase) * WOBBLE_PX_PER_S;
    const wobbleY = Math.sin(butterfly.elapsedMs * 0.006 + butterfly.phase) * WOBBLE_PX_PER_S;
    butterfly.sprite.x += (butterfly.vx + wobbleX) * dt;
    butterfly.sprite.y += (butterfly.vy + wobbleY) * dt;
  }

  private pickSpawnPosition(): { x: number; y: number } | null {
    const view = this.scene.cameras.main.worldView;
    for (let attempt = 0; attempt < SPAWN_TRIES; attempt++) {
      const x = Phaser.Math.Between(view.x - SPAWN_MARGIN_PX, view.right + SPAWN_MARGIN_PX);
      const y = Phaser.Math.Between(view.y - SPAWN_MARGIN_PX, view.bottom + SPAWN_MARGIN_PX);
      if (this.isSpawnCell(Math.floor(x / this.tilePx), Math.floor(y / this.tilePx))) return { x, y };
    }
    return null;
  }

  private spawn(): void {
    const position = this.pickSpawnPosition();
    if (!position) return;

    const species = Phaser.Utils.Array.GetRandom(BUTTERFLY_SPECIES);
    const sprite = this.scene.add.sprite(position.x, position.y, species.key, 0);
    sprite.setScale(DISPLAY_SCALE);
    sprite.setDepth(DEPTH);
    sprite.setAlpha(0);
    sprite.play({ key: species.animKey, startFrame: Phaser.Math.Between(BUTTERFLY_FRAMES.start, BUTTERFLY_FRAMES.end) });

    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const speed = Phaser.Math.FloatBetween(DRIFT_SPEED.min, DRIFT_SPEED.max);
    const vx = Math.cos(angle) * speed;
    sprite.setFlipX(vx < 0);

    const butterfly: Butterfly = {
      sprite,
      vx,
      vy: Math.sin(angle) * speed,
      phase: Phaser.Math.FloatBetween(0, Math.PI * 2),
      elapsedMs: 0,
      leaving: false,
      // O mesmo Tween sobe o alfa, segura e desce (yoyo): aparece, fica visível e some sem nunca "estalar".
      fade: this.scene.tweens.add({
        targets: sprite,
        alpha: { from: 0, to: 1 },
        duration: FADE_MS,
        hold: Phaser.Math.Between(VISIBLE_MS.min, VISIBLE_MS.max),
        yoyo: true,
        ease: 'Sine.easeInOut',
        onComplete: () => this.remove(butterfly),
      }),
    };
    this.alive.add(butterfly);
  }

  /** Começou a anoitecer: derruba o alfa de quem está no ar até 0 (a partir do valor atual) e remove. */
  private dismissAll(): void {
    for (const butterfly of this.alive) {
      if (butterfly.leaving) continue;
      butterfly.leaving = true;
      butterfly.fade.stop();
      this.scene.tweens.add({
        targets: butterfly.sprite,
        alpha: 0,
        duration: FADE_MS,
        ease: 'Sine.easeIn',
        onComplete: () => this.remove(butterfly),
      });
    }
  }

  private remove(butterfly: Butterfly): void {
    if (!this.alive.delete(butterfly)) return;
    butterfly.sprite.destroy();
  }
}
