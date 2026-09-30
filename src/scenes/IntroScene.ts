import Phaser from 'phaser';
import { INTRO_SLIDES, INTRO_TIMING, IntroBackground } from '../data/intro';
import {
  INVENTORY_LARGE_PANEL_BORDER,
  INVENTORY_LARGE_PANEL_FRAME_NAME,
  INVENTORY_LARGE_PANEL_KEY,
  INVENTORY_LARGE_PANEL_PATH,
  INVENTORY_LARGE_PANEL_RECT,
  INVENTORY_PANEL_BORDER,
  INVENTORY_PANEL_FRAME_NAME,
  INVENTORY_PANEL_KEY,
  INVENTORY_PANEL_PATH,
  INVENTORY_PANEL_RECT,
  MENU_BACKGROUND_KEY,
  MENU_BACKGROUND_PATH,
} from '../data/ui';
import { CAVE_TILES } from '../data/caveTiles';
import { ALTAR_ART, BRAZIER_ART, GOLDEN_TINT, SAGE_RABBIT, SANCTUARY_TINT } from '../data/sanctuary';
import { FISH_BY_ID, GOLDEN_FISH_ID, fishTextureKey } from '../data/fishing';
import { CARROT } from '../data/crops';
import { SLIME_COLORS, slimeSheet } from '../data/caveEnemies';
import { SHADOW_FRAME, SHADOW_FRAME_NAME, SHADOW_PATH } from '../data/effects';
import { getPlayerAssets } from '../data/player';
import { getPetTextureKey } from '../data/pets';
import { gameState } from '../systems/gameState';
import { getEffectsVolume } from '../systems/audioSettings';
import { preloadPlayerSprites } from '../systems/playerSprites';
import { ensurePetAnimations, petAnimKey, preloadPet } from '../systems/petSprites';
import { playClick } from '../systems/soundEffects';
import { preloadSheets } from '../entities/cave/caveAnims';
import { Player } from '../entities/Player';
import { UI_SCENE_KEY } from './UIScene';

export const INTRO_SCENE_KEY = 'IntroScene';
const MAIN_SCENE_KEY = 'MainScene';

const FONT = '"Courier New", Courier, monospace';
const INK = '#4a3524';
const PANEL_WIDTH = 1000;
const PANEL_HEIGHT = 170;
const SKIP_WIDTH = 230;
const SKIP_HEIGHT = 40;
/** A mancha de sombra (`Tileset/Shadow.png`) em preenchimento quente + ADD: o brilho (a técnica de `systems/lightSources.ts`). */
const GLOW_KEY = 'intro-glow';
/** Quadro do ícone da cenoura já colhida na folha de crescimento (`Crops/Spring/Carrot.png`, ver `data/crops.ts`). */
const CARROT_ICON_FRAME = 7;
/** Tons de cada clima. */
const SEPIA = 0xa8916a;
const DARK_CAVE = 0x3c3252;
const DAWN = 0xffd2a8;

/**
 * CENA INTRODUTÓRIA (`data/intro.ts`): abre uma partida nova, entre a Criação de Personagem e o Dia 1. Quatro slides, cada um com um
 * fundo montado com a arte do jogo (a laje e o coelho em sépia, as cavernas escuras com slimes, o santuário iluminado, a Fazenda ao
 * amanhecer com o personagem e o pet escolhidos), o texto aparecendo letra a letra (datilógrafo) e a narração (`intro_slide_N.mp3`).
 *
 * - F ou Espaço: com o texto ainda aparecendo, mostra a frase inteira; com ela completa, corta a voz e passa pro próximo slide.
 * - Sozinho: com o texto completo e a voz terminada, espera um pouco e passa.
 * - "Pular Intro [ESC]" (botão no canto ou ESC): vai direto pra Fazenda.
 * - Entre os slides a tela escurece e clareia; no fim, escurece e a Fazenda abre no Dia 1 (a partida já foi criada e salva).
 * Sem o áudio (não gerado), tudo funciona igual, sem voz.
 */
export class IntroScene extends Phaser.Scene {
  private slideIndex = 0;
  private background: Phaser.GameObjects.Container | null = null;
  private text!: Phaser.GameObjects.Text;
  private fullText = '';
  private shownChars = 0;
  private typing: Phaser.Time.TimerEvent | null = null;
  private voice: Phaser.Sound.BaseSound | null = null;
  private voiceDone = false;
  private advanceTimer: Phaser.Time.TimerEvent | null = null;
  private transitioning = false;
  private finished = false;

  constructor() {
    super(INTRO_SCENE_KEY);
  }

  preload(): void {
    const image = (key: string, path: string): void => {
      if (!this.textures.exists(key)) this.load.image(key, encodeURI(`/${path}`));
    };
    const sheet = (key: string, path: string, frameWidth: number, frameHeight = frameWidth): void => {
      if (!this.textures.exists(key)) this.load.spritesheet(key, encodeURI(`/${path}`), { frameWidth, frameHeight });
    };
    image(MENU_BACKGROUND_KEY, MENU_BACKGROUND_PATH);
    image(INVENTORY_PANEL_KEY, INVENTORY_PANEL_PATH);
    image(INVENTORY_LARGE_PANEL_KEY, INVENTORY_LARGE_PANEL_PATH);
    image(GLOW_KEY, SHADOW_PATH);
    sheet(CAVE_TILES.key, CAVE_TILES.path, CAVE_TILES.size);
    sheet(ALTAR_ART.key, ALTAR_ART.path, ALTAR_ART.frameSize);
    sheet(BRAZIER_ART.key, BRAZIER_ART.path, BRAZIER_ART.frameWidth, BRAZIER_ART.frameHeight);
    sheet(SAGE_RABBIT.key, SAGE_RABBIT.path, SAGE_RABBIT.frameSize);
    sheet(CARROT.textureKey, CARROT.texturePath, 16);
    const goldenFish = FISH_BY_ID[GOLDEN_FISH_ID];
    sheet(fishTextureKey(goldenFish), goldenFish.iconPath, 16);
    preloadSheets(this, SLIME_COLORS.map((color) => slimeSheet(color)));
    preloadPlayerSprites(this, gameState.profile.characterId);
    preloadPet(this, gameState.profile.petId);
    // A narração: um arquivo que falta não pode travar a cena (ela segue sem voz).
    for (const slide of INTRO_SLIDES) {
      if (!this.cache.audio.exists(slide.audio.key)) this.load.audio(slide.audio.key, encodeURI(`/${slide.audio.path}`));
    }
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => console.warn(`Intro: sem o arquivo ${file.src} (segue sem ele).`));
  }

  create(): void {
    this.slideIndex = 0;
    this.background = null;
    this.typing = null;
    this.voice = null;
    this.advanceTimer = null;
    this.transitioning = false;
    this.finished = false;

    // Sem HUD por cima (a Fazenda o abre de novo ao começar).
    if (this.scene.manager.isActive(UI_SCENE_KEY)) this.scene.stop(UI_SCENE_KEY);
    this.ensureFrames();
    this.cameras.main.setBackgroundColor('#07060b');
    this.buildTextPanel();
    this.buildSkipButton();

    const keyboard = this.input.keyboard!;
    keyboard.on('keydown-F', () => this.advance());
    keyboard.on('keydown-SPACE', () => this.advance());
    keyboard.on('keydown-ESC', () => this.finish());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.stopVoice());

    this.showSlide(0);
    this.cameras.main.fadeIn(INTRO_TIMING.slideFadeMs * 2, 0, 0, 0);
  }

  // --- Slides ------------------------------------------------------------------------------------------------------------------

  private showSlide(index: number): void {
    const slide = INTRO_SLIDES[index];
    this.slideIndex = index;
    this.background?.destroy();
    this.background = this.buildBackground(slide.background);

    // Quebra as linhas ANTES de começar a escrever: a palavra não "pula" de linha no meio da digitação.
    this.text.setText(slide.text);
    this.fullText = this.text.getWrappedText(slide.text).join('\n');
    this.text.setText('');
    this.shownChars = 0;

    this.voiceDone = true;
    let charMs = INTRO_TIMING.charMs;
    if (this.cache.audio.exists(slide.audio.key)) {
      const voice = this.sound.add(slide.audio.key, { volume: getEffectsVolume() });
      this.voice = voice;
      const durationMs = voice.duration * 1000;
      if (durationMs > 0) {
        this.voiceDone = false;
        const done = (): void => {
          if (this.voice !== voice || this.voiceDone) return;
          this.voiceDone = true;
          this.scheduleAutoAdvance();
        };
        voice.once(Phaser.Sound.Events.COMPLETE, done);
        // Rede de segurança: se o navegador ainda não liberou o áudio (ou o evento não vier), a voz conta como terminada pela duração.
        this.time.delayedCall(durationMs + 600, done);
        // O texto acompanha a voz: espalha as letras pela duração dela.
        charMs = Phaser.Math.Clamp((durationMs * INTRO_TIMING.audioSpread) / this.fullText.length, INTRO_TIMING.minCharMs, INTRO_TIMING.maxCharMs);
      }
      voice.play();
    }
    this.typing = this.time.addEvent({ delay: charMs, loop: true, callback: () => this.typeNextChar() });
  }

  private typeNextChar(): void {
    this.shownChars += 1;
    this.text.setText(this.fullText.slice(0, this.shownChars));
    if (this.shownChars >= this.fullText.length) this.completeText();
  }

  /** Frase inteira na tela (fim da digitação ou F/Espaço). */
  private completeText(): void {
    this.typing?.remove();
    this.typing = null;
    this.shownChars = this.fullText.length;
    this.text.setText(this.fullText);
    this.scheduleAutoAdvance();
  }

  private scheduleAutoAdvance(): void {
    if (this.typing || !this.voiceDone || this.advanceTimer) return;
    this.advanceTimer = this.time.delayedCall(INTRO_TIMING.holdMs, () => this.nextSlide());
  }

  /** F / Espaço: termina a frase; se ela já estava inteira, corta a voz e passa. */
  private advance(): void {
    if (this.transitioning || this.finished) return;
    if (this.typing) {
      this.completeText();
      return;
    }
    this.nextSlide();
  }

  private nextSlide(): void {
    if (this.transitioning || this.finished) return;
    this.advanceTimer?.remove();
    this.advanceTimer = null;
    this.stopVoice();
    if (this.slideIndex >= INTRO_SLIDES.length - 1) {
      this.finish();
      return;
    }
    this.transitioning = true;
    const camera = this.cameras.main;
    camera.fadeOut(INTRO_TIMING.slideFadeMs, 0, 0, 0);
    camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.showSlide(this.slideIndex + 1);
      camera.fadeIn(INTRO_TIMING.slideFadeMs, 0, 0, 0);
      this.transitioning = false;
    });
  }

  /** Fim (ou pulo): a tela escurece e a Fazenda abre no Dia 1. */
  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.typing?.remove();
    this.advanceTimer?.remove();
    this.stopVoice();
    const camera = this.cameras.main;
    camera.fadeOut(INTRO_TIMING.endFadeMs, 0, 0, 0);
    camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(MAIN_SCENE_KEY));
  }

  private stopVoice(): void {
    if (!this.voice) return;
    this.voice.stop();
    this.voice.destroy();
    this.voice = null;
  }

  // --- Fundos (só a arte do jogo) ------------------------------------------------------------------------------------------------

  private buildBackground(kind: IntroBackground): Phaser.GameObjects.Container {
    const { width, height } = this.scale;
    const cx = width / 2;
    const stageY = height / 2 - 70; // O centro da área acima da caixa de texto.
    const layer = this.add.container(0, 0).setDepth(0);

    if (kind === 'ancient') {
      // Uma "ilustração antiga": a laje do Sábio Coelho e o coelho, em sépia, no escuro, com um brilho fraco.
      layer.add(this.glow(cx, stageY, 520, 380, 0x6a5a3a, 0.35));
      const altar = this.add.image(cx, stageY + 110, ALTAR_ART.key, ALTAR_ART.dormantFrame).setOrigin(0.5, 1).setScale(5).setTint(SEPIA).setAlpha(0.9);
      const rabbit = this.add.sprite(cx, stageY + 110 - 150, SAGE_RABBIT.key, SAGE_RABBIT.sitFrames[0]).setOrigin(0.5, 1).setScale(6).setTint(SEPIA);
      rabbit.play(this.ensureAnim('intro-rabbit-sit', SAGE_RABBIT.key, SAGE_RABBIT.sitFrames, 3));
      layer.add([altar, rabbit]);
      this.tweens.add({ targets: layer, scale: { from: 1, to: 1.04 }, x: { from: 0, to: -cx * 0.04 }, y: { from: 0, to: -stageY * 0.04 }, duration: 9000 });
      return layer;
    }

    if (kind === 'caves') {
      // As cavernas tomadas pela escuridão: o chão de pedra escuro e slimes à espreita.
      this.addTileField(layer, DARK_CAVE, true);
      for (let index = 0; index < 6; index += 1) {
        const x = 140 + index * ((width - 280) / 5) + Phaser.Math.Between(-30, 30);
        const y = Phaser.Math.Between(170, 420);
        const slime = this.add.image(x, y, slimeSheet(SLIME_COLORS[(index + 3) % SLIME_COLORS.length]).key, 0).setOrigin(0.5, 1).setScale(3).setTint(0x9a8ab8);
        this.tweens.add({ targets: slime, y: y - 10, duration: Phaser.Math.Between(380, 620), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        layer.add(slime);
      }
      this.cameras.main.shake(700, 0.004);
      return layer;
    }

    if (kind === 'sanctuary') {
      // O santuário: luz suave, o altar desperto entre braseiros e, acima dele, a Cenoura e o Peixe Dourados.
      this.addTileField(layer, SANCTUARY_TINT, false);
      layer.add(this.glow(cx, stageY + 40, 640, 420, 0xfff0b0, 0.55));
      const altar = this.add.image(cx, stageY + 130, ALTAR_ART.key, ALTAR_ART.awakeFrames[ALTAR_ART.awakeFrames.length - 1]).setOrigin(0.5, 1).setScale(4);
      layer.add(altar);
      const flame = this.ensureAnim('intro-brazier', BRAZIER_ART.key, BRAZIER_ART.flameFrames, 8);
      for (const side of [-1, 1]) {
        layer.add(this.add.sprite(cx + side * 250, stageY + 130, BRAZIER_ART.key, BRAZIER_ART.flameFrames[0]).setOrigin(0.5, 1).setScale(3).play(flame));
      }
      // A Cenoura Dourada: a cenoura do pacote em preenchimento dourado, com a original meio transparente por cima (o tom multiplicado
      // sozinho deixaria o laranja quase igual).
      const carrot = this.add.container(cx - 60, stageY - 90, [
        this.add.image(0, 0, CARROT.textureKey, CARROT_ICON_FRAME).setScale(4).setTint(GOLDEN_TINT).setTintMode(Phaser.TintModes.FILL),
        this.add.image(0, 0, CARROT.textureKey, CARROT_ICON_FRAME).setScale(4).setAlpha(0.4),
      ]);
      const fish = this.add.image(cx + 60, stageY - 90, fishTextureKey(FISH_BY_ID[GOLDEN_FISH_ID]), 0).setScale(4);
      for (const [index, icon] of [carrot, fish].entries()) {
        this.tweens.add({ targets: icon, y: icon.y - 12, duration: 1300, delay: index * 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
      layer.add([carrot, fish]);
      return layer;
    }

    // A Fazenda ao amanhecer: a ilustração do menu clareando, com o personagem e o pet escolhidos.
    const farm = this.add.image(cx, height / 2, MENU_BACKGROUND_KEY);
    farm.setScale(Math.max(width / farm.width, height / farm.height)).setTint(0x8a6a8a);
    layer.add(farm);
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 4500,
      onUpdate: (tween) => {
        const color = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(0x8a6a8a), Phaser.Display.Color.ValueToColor(DAWN), 1, tween.getValue() ?? 0);
        farm.setTint(Phaser.Display.Color.GetColor(color.r, color.g, color.b));
      },
    });
    const assets = getPlayerAssets(gameState.profile.characterId);
    Player.createAnimations(this, gameState.profile.characterId);
    const groundY = height - PANEL_HEIGHT - 60;
    const player = this.add.sprite(cx - 40, groundY, assets.idleKey, 0).setOrigin(0.5, 1).setScale(5).play(`${assets.animPrefix}-idle-down`);
    ensurePetAnimations(this, gameState.profile.petId);
    const pet = this.add.sprite(cx + 70, groundY - 10, getPetTextureKey(gameState.profile.petId)).setOrigin(0.5, 1).setScale(4);
    pet.play(petAnimKey(gameState.profile.petId, 'sit-front'));
    layer.add([player, pet]);
    return layer;
  }

  /** O chão de pedra das Cavernas cobrindo a tela (paredes nas bordas, pedras soltas), num tom. */
  private addTileField(layer: Phaser.GameObjects.Container, tint: number, rocky: boolean): void {
    const tileScale = 3;
    const size = CAVE_TILES.size * tileScale;
    const cols = Math.ceil(this.scale.width / size);
    const rows = Math.ceil(this.scale.height / size);
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const hash = Math.abs((col * 73856093) ^ (row * 19349663));
        const wall = row === 0 || (rocky && hash % 11 === 0);
        const frames = wall ? CAVE_TILES.wallFrames : CAVE_TILES.floorFrames;
        layer.add(this.add.image(col * size, row * size, CAVE_TILES.key, frames[hash % frames.length]).setOrigin(0, 0).setScale(tileScale).setTint(tint));
      }
    }
  }

  private glow(x: number, y: number, width: number, height: number, color: number, alpha: number): Phaser.GameObjects.Image {
    return this.add
      .image(x, y, GLOW_KEY, SHADOW_FRAME_NAME)
      .setScale(width / SHADOW_FRAME.width, height / SHADOW_FRAME.height)
      .setTint(color)
      .setTintMode(Phaser.TintModes.FILL)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(alpha);
  }

  private ensureAnim(key: string, texture: string, frames: number[], frameRate: number): string {
    if (!this.anims.exists(key)) this.anims.create({ key, frames: this.anims.generateFrameNumbers(texture, { frames }), frameRate, repeat: -1 });
    return key;
  }

  // --- Interface -------------------------------------------------------------------------------------------------------------

  private buildTextPanel(): void {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height - PANEL_HEIGHT / 2 - 24;
    this.add
      .nineslice(cx, cy, INVENTORY_LARGE_PANEL_KEY, INVENTORY_LARGE_PANEL_FRAME_NAME, PANEL_WIDTH, PANEL_HEIGHT, INVENTORY_LARGE_PANEL_BORDER, INVENTORY_LARGE_PANEL_BORDER, INVENTORY_LARGE_PANEL_BORDER, INVENTORY_LARGE_PANEL_BORDER)
      .setDepth(10);
    this.text = this.add
      .text(cx - PANEL_WIDTH / 2 + 44, cy - PANEL_HEIGHT / 2 + 30, '', { fontFamily: FONT, fontSize: '21px', color: INK, lineSpacing: 8, wordWrap: { width: PANEL_WIDTH - 88 } })
      .setDepth(11);
    this.add
      .text(cx + PANEL_WIDTH / 2 - 30, cy + PANEL_HEIGHT / 2 - 18, 'F / Espaço: avançar', { fontFamily: FONT, fontSize: '12px', fontStyle: 'bold', color: '#8a6a4a' })
      .setOrigin(1, 1)
      .setDepth(11);
  }

  private buildSkipButton(): void {
    const x = this.scale.width - SKIP_WIDTH / 2 - 24;
    const y = 24 + SKIP_HEIGHT / 2;
    const box = this.add
      .nineslice(x, y, INVENTORY_PANEL_KEY, INVENTORY_PANEL_FRAME_NAME, SKIP_WIDTH, SKIP_HEIGHT, INVENTORY_PANEL_BORDER, INVENTORY_PANEL_BORDER, INVENTORY_PANEL_BORDER, INVENTORY_PANEL_BORDER)
      .setDepth(20)
      .setInteractive({ useHandCursor: true });
    box.on('pointerover', () => box.setAlpha(0.85));
    box.on('pointerout', () => box.setAlpha(1));
    box.on('pointerdown', () => {
      playClick(this);
      this.finish();
    });
    this.add.text(x, y, 'Pular Intro [ESC]', { fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: INK }).setOrigin(0.5).setDepth(21);
  }

  private ensureFrames(): void {
    const add = (key: string, name: string, rect: { x: number; y: number; width: number; height: number }): void => {
      const texture = this.textures.get(key);
      if (!texture.has(name)) texture.add(name, 0, rect.x, rect.y, rect.width, rect.height);
    };
    add(INVENTORY_PANEL_KEY, INVENTORY_PANEL_FRAME_NAME, INVENTORY_PANEL_RECT);
    add(INVENTORY_LARGE_PANEL_KEY, INVENTORY_LARGE_PANEL_FRAME_NAME, INVENTORY_LARGE_PANEL_RECT);
    add(GLOW_KEY, SHADOW_FRAME_NAME, SHADOW_FRAME);
    this.textures.get(GLOW_KEY).setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.textures.get(MENU_BACKGROUND_KEY).setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
}
