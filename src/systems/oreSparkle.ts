import Phaser from 'phaser';
import { ORE_SPARKLE, SPARKLE_CROSS_FRAME, SPARKLE_DOT_FRAME, SPARKLE_KEY, SPARKLE_PATH } from '../data/effects';
import type { OreKind } from '../data/ores';
import { registerFrame } from './externalMapBuilder';
import { DISPLAY_SCALE } from './mapBuilder';
import { LIGHT_GLOW_DEPTH } from './lightSources';

/**
 * Os VEIOS CINTILAM (ideia do Terraria: minério brilha de vez em quando, mais quando está iluminado): de tempos em tempos uma estrelinha
 * (`Shine.png`) acende e apaga sobre um veio, na cor dele — bem mais vezes perto da luz do personagem (`systems/caveLighting.ts`), e mais nos
 * raros. Desenhada acima do véu da penumbra (ADD), então "brilha" no escuro. As estrelinhas são REAPROVEITADAS (um pool): uma que apagou
 * volta pra fila e é a próxima a acender, em vez de criar e destruir sprites a toda hora.
 */

/** Distância (células) até onde a luz do personagem alcança, e quanto ela multiplica o ritmo. */
const NEAR_LIGHT_CELLS = 3.5;
const NEAR_LIGHT_MULTIPLIER = 4;
/** Vida de uma estrelinha (acende + apaga) e o tamanho máximo. */
const SPARKLE_MS = 560;
const SPARKLE_SCALE = DISPLAY_SCALE * 1.5;
/** Chance de sair o ponto em vez da cruz. */
const DOT_CHANCE = 0.3;

export function preloadOreSparkles(scene: Phaser.Scene): void {
  if (!scene.textures.exists(SPARKLE_KEY)) scene.load.image(SPARKLE_KEY, encodeURI(`/${SPARKLE_PATH}`));
}

export class OreSparkles {
  private readonly ores: Array<{ sprite: Phaser.GameObjects.Image; kind: OreKind }> = [];
  private readonly pool: Phaser.GameObjects.Image[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly follow: Phaser.GameObjects.Sprite,
    private readonly tilePx: number,
  ) {
    registerFrame(scene, SPARKLE_KEY, SPARKLE_CROSS_FRAME);
    registerFrame(scene, SPARKLE_KEY, SPARKLE_DOT_FRAME);
  }

  add(sprite: Phaser.GameObjects.Image, kind: OreKind): void {
    this.ores.push({ sprite, kind });
  }

  update(deltaMs: number): void {
    const dt = deltaMs / 1000;
    const view = this.scene.cameras.main.worldView;
    for (let index = this.ores.length - 1; index >= 0; index--) {
      const { sprite, kind } = this.ores[index];
      if (!sprite.active) {
        this.ores.splice(index, 1); // Minerado.
        continue;
      }
      if (!view.contains(sprite.x, sprite.y - sprite.displayHeight / 2)) continue;
      const cells = Phaser.Math.Distance.Between(this.follow.x, this.follow.y, sprite.x, sprite.y) / this.tilePx;
      const rate = ORE_SPARKLE[kind].perSecond * (cells <= NEAR_LIGHT_CELLS ? NEAR_LIGHT_MULTIPLIER : 1);
      if (Math.random() < rate * dt) this.sparkle(sprite, ORE_SPARKLE[kind].color);
    }
  }

  private sparkle(ore: Phaser.GameObjects.Image, color: number): void {
    const x = ore.x + (Math.random() - 0.5) * ore.displayWidth * 0.7;
    const y = ore.y - ore.displayHeight * (0.25 + Math.random() * 0.6);
    const frame = Math.random() < DOT_CHANCE ? SPARKLE_DOT_FRAME.name : SPARKLE_CROSS_FRAME.name;
    const star = this.pool.pop() ?? this.scene.add.image(0, 0, SPARKLE_KEY, frame).setBlendMode(Phaser.BlendModes.ADD).setDepth(LIGHT_GLOW_DEPTH);
    star.setFrame(frame).setPosition(x, y).setTint(color).setScale(0).setAlpha(1).setVisible(true);
    this.scene.tweens.add({
      targets: star,
      scale: SPARKLE_SCALE,
      duration: SPARKLE_MS / 2,
      yoyo: true,
      ease: 'Sine.easeOut',
      onComplete: () => {
        star.setVisible(false);
        this.pool.push(star);
      },
    });
  }
}
