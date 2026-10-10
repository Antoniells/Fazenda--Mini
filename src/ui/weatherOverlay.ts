import Phaser from 'phaser';
import { RAIN_KEY, RAIN_DROP_FRAMES, SPLASH_KEY, SPLASH_ANIM_KEY, SPLASH_FRAMES } from '../data/effects';

/** Escurecimento cinza da tela quando chove (0 = nenhum, 1 = opaco). */
const RAIN_VEIL_ALPHA = 0.3;
const RAIN_VEIL_COLOR = 0x59606b;
const FADE_MS = 1500;
/** Acima do mundo e do véu de dia/noite, abaixo de qualquer HUD (Hotbar/corações começam em depth 1000). */
const VEIL_DEPTH = 3;
const RAIN_DEPTH = 4;
/** Inclinação das gotas (graus, no sentido da queda pra esquerda) — a mesma direção da velocidade delas. */
const RAIN_TILT_DEGREES = 21;

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

/**
 * Chave do registro do jogo (`game.registry`) que a cena do mapa liga enquanto um menu DELA está aberto (a Caixa de Remessas, a
 * encomenda de sementes): a chuva vive na `UIScene`, desenhada depois do mapa, e cobria esses menus. Com ela ligada, as riscas e o
 * véu somem até o menu fechar.
 */
export const WORLD_MENU_OPEN_KEY = 'world-menu-open';

/** Cenas fechadas (sem céu) onde não chove: a Caverna (a entrada e os andares), o interior da casa e o das lojas. */
const INDOOR_SCENE_KEYS = ['CaveScene', 'CaveFloorScene', 'HouseScene', 'ShopInteriorScene'];

/**
 * Clima na tela (chuva): um véu cinza-azulado por cima do mundo + partículas
 * de gotas caindo, uma a uma (arte real: os riscos de `Objects/Props/Water props.png`
 * recortados um por um — ver `RAIN_DROP_FRAMES` em `data/effects.ts`). Vive na `UIScene` (persistente,
 * `scrollFactor` 0), então cobre qualquer mapa sem cada cena precisar
 * conhecer o clima; puramente visual — quem decide se chove é
 * `systems/weather.ts` (sorteio na virada do dia), aqui só se espelha
 * `gameState.weather.raining` via `refresh`. Não chove nas cenas fechadas (`INDOOR_SCENE_KEYS`).
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

    // Cada gota é UM risco (`RAIN_DROP_FRAMES`, recortados da folha — antes era o quadro inteiro, com três riscos juntos). Nascem acima
    // da tela, espalhadas na largura toda (+ folga à direita: o vento as leva pra esquerda), caem em diagonal e o risco inclina junto com
    // a queda: `rotate` = atan(240 / 630) ≈ 21° (a velocidade média de lado sobre a de queda). Quatro por vez (pedido
    // explícito: um pouco menos que os 6 riscos de antes — 2 quadros x 3 riscos).
    for (const { name, rect } of RAIN_DROP_FRAMES) {
      const texture = scene.textures.get(RAIN_KEY);
      if (!texture.has(name)) texture.add(name, 0, rect.x, rect.y, rect.width, rect.height);
    }
    this.rain = scene.add.particles(0, 0, RAIN_KEY, {
      frame: RAIN_DROP_FRAMES.map((drop) => drop.name),
      x: { min: -60, max: width + 360 },
      y: -30,
      lifespan: 1400,
      speedX: { min: -260, max: -220 },
      speedY: { min: 560, max: 700 },
      rotate: RAIN_TILT_DEGREES,
      scale: { min: 2, max: 3 },
      alpha: { start: 0.8, end: 0.5 },
      frequency: 14,
      quantity: 4,
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

  /** Um menu de cena de mapa aberto (`WORLD_MENU_OPEN_KEY`): a chuva (riscas e véu) some por cima dele e volta ao fechar. */
  setHiddenForMenu(hidden: boolean): void {
    this.rain.setVisible(!hidden);
    this.veil.setVisible(!hidden);
  }

  isRaining(): boolean {
    return this.raining;
  }
}
