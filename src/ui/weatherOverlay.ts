import Phaser from 'phaser';
import { RAIN_KEY, RAIN_FRAMES, SPLASH_KEY, SPLASH_ANIM_KEY, SPLASH_FRAMES } from '../data/effects';

/** Escurecimento cinza da tela quando chove (0 = nenhum, 1 = opaco). */
const RAIN_VEIL_ALPHA = 0.3;
const RAIN_VEIL_COLOR = 0x59606b;
const FADE_MS = 1500;
/** Acima do mundo e do véu de dia/noite, abaixo de qualquer HUD (Hotbar/corações começam em depth 1000). */
const VEIL_DEPTH = 3;
const RAIN_DEPTH = 4;

/**
 * Gotas batendo (`Objects/Props/Sprash.png`, o mesmo respingo azul de regar): a cada `SPLASH_INTERVAL_MS` nascem `SPLASHES_PER_TICK`
 * respingos em pontos aleatórios da área VISÍVEL do MUNDO — criados dentro da cena do mapa (não na tela da `UIScene`), então ficam
 * ancorados no chão: a câmera anda e eles ficam pra trás, e a profundidade é a própria posição Y (árvores, casas e o jogador passam na
 * frente, como qualquer objeto do mundo). As riscas de chuva caindo continuam sendo efeito de tela.
 */
const SPLASH_INTERVAL_MS = 55;
const SPLASHES_PER_TICK = 2;
const SPLASH_FRAME_RATE = 12;

/** Cenas de mapa a céu aberto — onde os respingos são criados (a que estiver ativa). */
const WORLD_SCENE_KEYS = ['MainScene', 'ForestScene', 'QuarryScene', 'BeachScene', 'VillageScene'];

/** Cenas fechadas (sem céu) onde não chove: a Caverna e o interior da casa. */
const INDOOR_SCENE_KEYS = ['CaveScene', 'HouseScene'];

/**
 * Clima na tela (chuva): um véu cinza-azulado por cima do mundo + partículas
 * de gotas caindo (arte real: `Objects/Props/Water props.png`, 4 riscos de
 * chuva de 16x16 — ver `data/effects.ts`). Vive na `UIScene` (persistente,
 * `scrollFactor` 0), então cobre qualquer mapa sem cada cena precisar
 * conhecer o clima; puramente visual — quem decide se chove é
 * `systems/weather.ts` (sorteio na virada do dia), aqui só se espelha
 * `gameState.weather.raining` via `refresh`. Na Caverna não chove.
 */
export class WeatherOverlay {
  private readonly veil: Phaser.GameObjects.Rectangle;
  private readonly rain: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly splashTimer: Phaser.Time.TimerEvent;
  private raining = false;

  constructor(private readonly scene: Phaser.Scene) {
    const { width, height } = scene.scale;

    // A animação do respingo é global do jogo (a Fazenda cria a mesma ao regar); só garante que exista.
    if (scene.textures.exists(SPLASH_KEY) && !scene.anims.exists(SPLASH_ANIM_KEY)) {
      scene.anims.create({
        key: SPLASH_ANIM_KEY,
        frames: scene.anims.generateFrameNumbers(SPLASH_KEY, SPLASH_FRAMES),
        frameRate: SPLASH_FRAME_RATE,
        repeat: 0,
      });
    }
    this.splashTimer = scene.time.addEvent({ delay: SPLASH_INTERVAL_MS, loop: true, paused: true, callback: () => this.spawnSplashes() });

    this.veil = scene.add.rectangle(0, 0, width, height, RAIN_VEIL_COLOR, 1);
    this.veil.setOrigin(0, 0);
    this.veil.setScrollFactor(0);
    this.veil.setDepth(VEIL_DEPTH);
    this.veil.setAlpha(0);

    // Gotas nascem acima da tela, espalhadas na largura toda (+ folga pra
    // vento), caem em diagonal pra esquerda e o risco é inclinado pra
    // acompanhar a queda (ver `rotate`: atan(120/620) ≈ 11°).
    this.rain = scene.add.particles(0, 0, RAIN_KEY, {
      frame: RAIN_FRAMES,
      x: { min: -60, max: width + 160 },
      y: -30,
      lifespan: 1400,
      speedX: { min: -140, max: -100 },
      speedY: { min: 560, max: 700 },
      rotate: 11,
      scale: { min: 1.6, max: 2.4 },
      alpha: { start: 0.8, end: 0.5 },
      frequency: 14,
      quantity: 2,
      emitting: false,
    });
    this.rain.setScrollFactor(0);
    this.rain.setDepth(RAIN_DEPTH);
  }

  /** Chamado a cada frame pela `UIScene`; só age quando o estado "chovendo" (ou estar num mapa coberto) muda. */
  refresh(isRaining: boolean): void {
    const shouldRain = isRaining && !INDOOR_SCENE_KEYS.some((key) => this.scene.scene.isActive(key));
    if (shouldRain === this.raining) return;
    this.raining = shouldRain;

    this.scene.tweens.killTweensOf(this.veil);
    this.scene.tweens.add({ targets: this.veil, alpha: shouldRain ? RAIN_VEIL_ALPHA : 0, duration: FADE_MS, ease: 'Sine.easeInOut' });

    if (shouldRain) this.rain.start();
    else this.rain.stop();
    this.splashTimer.paused = !shouldRain;
  }

  /** A cena de mapa a céu aberto que está rodando agora (a chuva cai nela), se houver. */
  private activeWorldScene(): Phaser.Scene | undefined {
    const key = WORLD_SCENE_KEYS.find((candidate) => this.scene.scene.isActive(candidate));
    return key ? this.scene.scene.get(key) : undefined;
  }

  /** Um punhado de respingos em pontos aleatórios da área visível do mundo — cada um toca a animação uma vez e se destrói. */
  private spawnSplashes(): void {
    const world = this.activeWorldScene();
    if (!world || !world.textures.exists(SPLASH_KEY) || !world.anims.exists(SPLASH_ANIM_KEY)) return;
    const view = world.cameras.main.worldView;

    for (let i = 0; i < SPLASHES_PER_TICK; i++) {
      const y = Phaser.Math.Between(Math.round(view.y), Math.round(view.bottom));
      const splash = world.add.sprite(Phaser.Math.Between(Math.round(view.x), Math.round(view.right)), y, SPLASH_KEY, 0);
      splash.setDepth(y);
      splash.setScale(Phaser.Math.FloatBetween(0.9, 1.5));
      splash.setAlpha(0.9);
      splash.play(SPLASH_ANIM_KEY);
      splash.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => splash.destroy());
    }
  }

  isRaining(): boolean {
    return this.raining;
  }
}
