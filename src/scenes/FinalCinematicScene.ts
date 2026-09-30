import Phaser from 'phaser';
import { CAVE_TILES } from '../data/caveTiles';
import { SLIME_COLORS, slimeSheet } from '../data/caveEnemies';
import { ALTAR_ART, CINEMATIC_CAPTIONS, DARK_CAVE_TINT, SAGE_RABBIT, SANCTUARY_TINT } from '../data/sanctuary';
import { preloadSheets } from '../entities/cave/caveAnims';
import { DISPLAY_SCALE } from '../systems/mapBuilder';
import { reachMilestone } from '../systems/story';
import { save as saveGame } from '../systems/saveManager';
import { dayMusic } from '../systems/dayMusic';
import { FINAL_CINEMATIC_SCENE_KEY } from '../systems/sanctuary';
import { UI_SCENE_KEY } from './UIScene';
import { ENDING_SCENE_KEY } from './EndingScene';
import { SHADOW_FRAME, SHADOW_FRAME_NAME, SHADOW_PATH } from '../data/effects';

/** A mancha de sombra (`Tileset/Shadow.png`) com filtro LINEAR, em preenchimento quente e blend ADD: a luz da onda (a mesma técnica de `systems/lightSources.ts`). */
const GLOW_KEY = 'cinematic-glow';
const GLOW_COLOR = 0xfff0b0;

const TILE_PX = 16 * DISPLAY_SCALE;
/** Quantos andares aparecem na subida e quantas fileiras cada um tem. */
const BANDS = 6;
const BAND_ROWS = 7;
const ENEMIES_PER_BAND = 5;
/** Duração da subida da onda (ms) e a pausa no fim antes do branco. */
const WAVE_MS = 12000;
const END_HOLD_MS = 1600;
const CAPTION_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: '"Courier New", Courier, monospace',
  fontSize: '22px',
  fontStyle: 'bold',
  color: '#fff6d8',
  stroke: '#2b1d0e',
  strokeThickness: 5,
  align: 'center',
};

interface CaveEnemyProp {
  sprite: Phaser.GameObjects.Image;
  gone: boolean;
}

/**
 * CINEMÁTICA FINAL (Fase 11 — `data/sanctuary.ts`): o Sábio Coelho desperta no fundo e uma onda de luz purificadora sobe pelas Cavernas,
 * andar por andar, de baixo pra cima; o chão escuro clareia quando a luz passa e as criaturas das trevas se desfazem. Só arte do jogo
 * (o tileset das Cavernas, os slimes, o altar e o coelho) com tom, escala e transparência — nada desenhado por código. Legendas contam o
 * momento. Clique, Espaço ou ESC pula. No fim, a tela branca leva ao epílogo e aos créditos (`scenes/EndingScene.ts`).
 */
export class FinalCinematicScene extends Phaser.Scene {
  private rows: Phaser.GameObjects.Image[][] = [];
  private litRows = new Set<number>();
  private enemies: CaveEnemyProp[] = [];
  private caption!: Phaser.GameObjects.Text;
  /** A frente da onda: manchas de luz lado a lado, na altura da onda. */
  private front: Phaser.GameObjects.Image[] = [];
  private finished = false;

  constructor() {
    super(FINAL_CINEMATIC_SCENE_KEY);
  }

  preload(): void {
    if (!this.textures.exists(CAVE_TILES.key)) this.load.spritesheet(CAVE_TILES.key, encodeURI(`/${CAVE_TILES.path}`), { frameWidth: CAVE_TILES.size, frameHeight: CAVE_TILES.size });
    if (!this.textures.exists(ALTAR_ART.key)) this.load.spritesheet(ALTAR_ART.key, encodeURI(`/${ALTAR_ART.path}`), { frameWidth: ALTAR_ART.frameSize, frameHeight: ALTAR_ART.frameSize });
    if (!this.textures.exists(SAGE_RABBIT.key)) this.load.spritesheet(SAGE_RABBIT.key, encodeURI(`/${SAGE_RABBIT.path}`), { frameWidth: SAGE_RABBIT.frameSize, frameHeight: SAGE_RABBIT.frameSize });
    preloadSheets(this, SLIME_COLORS.map((color) => slimeSheet(color)));
    if (!this.textures.exists(GLOW_KEY)) this.load.image(GLOW_KEY, encodeURI(`/${SHADOW_PATH}`));
  }

  create(): void {
    this.rows = [];
    this.litRows = new Set();
    this.enemies = [];
    this.front = [];
    this.finished = false;

    if (this.scene.manager.isActive(UI_SCENE_KEY)) this.scene.stop(UI_SCENE_KEY);
    dayMusic.disable(1200);
    reachMilestone('awakening');
    saveGame();

    const cols = Math.ceil(this.scale.width / TILE_PX) + 1;
    const totalRows = BANDS * BAND_ROWS;
    this.cameras.main.setBackgroundColor('#08090d');
    this.cameras.main.setBounds(0, 0, cols * TILE_PX, totalRows * TILE_PX);

    // As Cavernas vistas de lado: cada andar é um salão com o teto de pedra (uma fenda = a escada) e rochas soltas.
    for (let row = 0; row < totalRows; row += 1) {
      const band = Math.floor(row / BAND_ROWS);
      const ceiling = row % BAND_ROWS === 0 && row > 0;
      const gapCol = 3 + ((band * 7) % (cols - 6));
      const line: Phaser.GameObjects.Image[] = [];
      for (let col = 0; col < cols; col += 1) {
        const hash = Math.abs((col * 73856093) ^ (row * 19349663));
        const wall = col === 0 || col === cols - 1 || (ceiling && Math.abs(col - gapCol) > 1) || (!ceiling && hash % 23 === 0);
        const frames = wall ? CAVE_TILES.wallFrames : CAVE_TILES.floorFrames;
        const tile = this.add.image(col * TILE_PX, row * TILE_PX, CAVE_TILES.key, frames[hash % frames.length]);
        tile.setOrigin(0, 0).setScale(DISPLAY_SCALE).setTint(DARK_CAVE_TINT).setDepth(wall ? 0 : -1);
        line.push(tile);
      }
      this.rows.push(line);
    }

    // No fundo, o altar desperto e o Sábio Coelho: é dali que a luz nasce.
    const bottomY = totalRows * TILE_PX - TILE_PX * 2;
    const centerX = (cols * TILE_PX) / 2;
    this.add.image(centerX, bottomY, ALTAR_ART.key, ALTAR_ART.awakeFrames[ALTAR_ART.awakeFrames.length - 1]).setOrigin(0.5, 1).setScale(DISPLAY_SCALE).setDepth(bottomY);
    if (!this.anims.exists('sage-rabbit-sit')) {
      this.anims.create({ key: 'sage-rabbit-sit', frames: this.anims.generateFrameNumbers(SAGE_RABBIT.key, { frames: SAGE_RABBIT.sitFrames }), frameRate: 3, repeat: -1 });
    }
    this.add.sprite(centerX, bottomY - 44, SAGE_RABBIT.key, SAGE_RABBIT.sitFrames[0]).setOrigin(0.5, 1).setScale(SAGE_RABBIT.scale).setDepth(bottomY + 1).play('sage-rabbit-sit');

    // As criaturas das trevas, espalhadas pelos andares de cima.
    for (let band = 0; band < BANDS - 1; band += 1) {
      for (let index = 0; index < ENEMIES_PER_BAND; index += 1) {
        const x = Phaser.Math.Between(2, cols - 3) * TILE_PX + TILE_PX / 2;
        const y = (band * BAND_ROWS + Phaser.Math.Between(2, BAND_ROWS - 1)) * TILE_PX;
        const color = SLIME_COLORS[(band + index) % SLIME_COLORS.length];
        const sprite = this.add.image(x, y, slimeSheet(color).key, 0).setOrigin(0.5, 1).setScale(DISPLAY_SCALE).setDepth(y);
        sprite.setTint(0x9a90b0);
        this.tweens.add({ targets: sprite, y: y - 4, duration: Phaser.Math.Between(350, 600), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.enemies.push({ sprite, gone: false });
      }
    }

    // A frente da onda (acima de tudo no mundo) e um brilho no altar.
    const glowTexture = this.textures.get(GLOW_KEY);
    glowTexture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    if (!glowTexture.has(SHADOW_FRAME_NAME)) glowTexture.add(SHADOW_FRAME_NAME, 0, SHADOW_FRAME.x, SHADOW_FRAME.y, SHADOW_FRAME.width, SHADOW_FRAME.height);
    const glow = (x: number, y: number, width: number, height: number, alpha: number): Phaser.GameObjects.Image =>
      this.add.image(x, y, GLOW_KEY, SHADOW_FRAME_NAME).setScale(width / SHADOW_FRAME.width, height / SHADOW_FRAME.height).setTint(GLOW_COLOR).setTintMode(Phaser.TintModes.FILL).setBlendMode(Phaser.BlendModes.ADD).setAlpha(alpha).setDepth(8000);
    const altarGlow = glow(centerX, bottomY - 40, TILE_PX * 8, TILE_PX * 6, 0.6);
    this.tweens.add({ targets: altarGlow, alpha: 0.95, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const pieces = 6;
    const pieceWidth = (cols * TILE_PX) / (pieces - 1);
    for (let index = 0; index < pieces; index += 1) this.front.push(glow(index * pieceWidth, totalRows * TILE_PX, pieceWidth * 1.8, TILE_PX * 4, 0.85));

    this.caption = this.add.text(this.scale.width / 2, this.scale.height - 70, '', CAPTION_STYLE).setOrigin(0.5).setScrollFactor(0).setDepth(9000).setAlpha(0);
    this.showCaptions();

    // A onda: sobe do fundo ao topo; a câmera a acompanha.
    const camera = this.cameras.main;
    const worldHeight = totalRows * TILE_PX;
    camera.scrollY = worldHeight - this.scale.height;
    camera.fadeIn(1200, 255, 255, 255);
    const wave = { y: worldHeight };
    this.tweens.add({
      targets: wave,
      y: -TILE_PX * 2,
      delay: 1400,
      duration: WAVE_MS,
      ease: 'Sine.easeInOut',
      onUpdate: () => this.advanceWave(wave.y),
      onComplete: () => this.time.delayedCall(END_HOLD_MS, () => this.finish()),
    });

    this.input.on(Phaser.Input.Events.POINTER_DOWN, () => this.finish());
    this.input.keyboard?.on('keydown-SPACE', () => this.finish());
    this.input.keyboard?.on('keydown-ESC', () => this.finish());
  }

  /** A frente da onda está em `waveY`: clareia as fileiras que ela já passou, desfaz as criaturas e leva a câmera junto. */
  private advanceWave(waveY: number): void {
    const camera = this.cameras.main;
    camera.scrollY = Phaser.Math.Clamp(waveY - this.scale.height * 0.55, 0, this.rows.length * TILE_PX - this.scale.height);
    for (const piece of this.front) piece.setY(waveY);

    for (let row = this.rows.length - 1; row >= 0; row -= 1) {
      if (this.litRows.has(row) || row * TILE_PX < waveY) continue;
      this.litRows.add(row);
      // A frente da luz: a fileira acende em branco e assenta no tom claro do santuário.
      for (const tile of this.rows[row]) tile.setTint(0xffffff);
      this.time.delayedCall(260, () => {
        for (const tile of this.rows[row]) tile.setTint(SANCTUARY_TINT);
      });
      if (row % BAND_ROWS === 0) camera.shake(160, 0.004);
    }

    for (const enemy of this.enemies) {
      if (enemy.gone || enemy.sprite.y < waveY) continue;
      enemy.gone = true;
      this.tweens.killTweensOf(enemy.sprite);
      enemy.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      this.tweens.add({ targets: enemy.sprite, alpha: 0, scaleX: 0.2, scaleY: DISPLAY_SCALE * 1.6, y: enemy.sprite.y - 30, duration: 520, ease: 'Quad.easeIn', onComplete: () => enemy.sprite.destroy() });
    }
  }

  private showCaptions(): void {
    const step = (WAVE_MS + 1400) / CINEMATIC_CAPTIONS.length;
    CINEMATIC_CAPTIONS.forEach((line, index) => {
      this.time.delayedCall(400 + index * step, () => {
        this.caption.setText(line);
        this.tweens.killTweensOf(this.caption);
        this.caption.setAlpha(0);
        this.tweens.add({ targets: this.caption, alpha: 1, duration: 500, hold: step - 1100, yoyo: true });
      });
    });
  }

  /** Branco e epílogo (uma vez só: o pulo e o fim natural caem aqui). */
  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.cameras.main.fadeOut(1000, 255, 255, 255);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(ENDING_SCENE_KEY, { fromStory: true }));
  }
}
