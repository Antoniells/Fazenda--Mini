import Phaser from 'phaser';
import { DISPLAY_SCALE } from './mapBuilder';
import { SPARKLE_CROSS_FRAME, SPARKLE_KEY } from '../data/effects';
import { registerFrame } from './externalMapBuilder';
import { LIGHT_GLOW_DEPTH } from './lightSources';

/**
 * O PACOTE DE IMPACTO (ideia do hitstop — `reference-projects/hitstop`, sem licença: só a ideia, nada de código): um golpe que acerta pede
 * vários sinais juntos, e todos saem de UMA intensidade (`strength`, 0-1), calibrada só aqui:
 * - CONGELAMENTO (hitstop): a cena para por 30-120 ms — o golpe "encontra resistência" e o olho tem um instante pra registrar;
 * - TREMOR por "trauma": cada impacto soma trauma (que se esvai com o tempo) e a força do tremor é trauma² — golpe leve quase não treme,
 *   golpe forte sacode, e golpes seguidos se somam em vez de tremer aos trancos;
 * - EMPURRÃO da câmera na direção do golpe, voltando sozinho — dá direção ao golpe, não só força;
 * - golpe que MATA (strength ≥ 0.9): estrelinhas (`Shine.png`, a mesma dos veios) espirrando do ponto do impacto.
 *
 * Referência (a mesma tabela do hitstop): 0.1 golpe de ferramenta · 0.45 espadada · 0.6 dano no jogador · 0.9 golpe que mata.
 *
 * O tempo da cena é controlado envolvendo o `step` dela (`Systems.step`, que roda a lógica, os tweens, os timers, as animações e a
 * câmera com o mesmo `delta`): congelada, o passo é pulado (a cena continua sendo desenhada); em câmera lenta, o `delta` chega
 * multiplicado. Nenhuma entidade precisa saber disso.
 */

/** Quanto o trauma se esvai por segundo. */
const TRAUMA_DECAY_PER_SECOND = 1.6;
/** Intensidade do tremor do Phaser (fração do tamanho da câmera) com trauma 1 — calibrada pra a espadada ficar perto do tremor de antes. */
const MAX_SHAKE_INTENSITY = 0.035;

interface SceneTime {
  /** Até quando (relógio real, `performance.now`) a cena fica congelada. */
  freezeUntil: number;
  /** Até quando roda em câmera lenta, e a que velocidade. */
  slowUntil: number;
  slowScale: number;
  trauma: number;
  traumaAt: number;
  kick: Phaser.Tweens.Tween | null;
}

const sceneTimes = new WeakMap<Phaser.Scenes.Systems, SceneTime>();

/** O controle de tempo da cena (envolve o `step` dela na 1ª vez; a instância da cena é reaproveitada entre `scene.start`). */
function timeOf(scene: Phaser.Scene): SceneTime {
  const sys = scene.sys;
  let state = sceneTimes.get(sys);
  if (state) return state;
  const fresh: SceneTime = { freezeUntil: 0, slowUntil: 0, slowScale: 1, trauma: 0, traumaAt: 0, kick: null };
  state = fresh;
  sceneTimes.set(sys, fresh);
  const step = sys.step.bind(sys);
  sys.step = (time: number, delta: number): void => {
    const now = performance.now();
    if (now < fresh.freezeUntil) return; // Congelada: nada anda (o desenho continua).
    step(time, now < fresh.slowUntil ? delta * fresh.slowScale : delta);
  };
  // Reabrir a cena não herda congelamento, câmera lenta nem trauma da vez anterior.
  sys.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
    fresh.freezeUntil = 0;
    fresh.slowUntil = 0;
    fresh.trauma = 0;
    fresh.kick = null;
  });
  return fresh;
}

/** Congela a cena por `ms` (relógio real). Congelamentos seguidos não se somam: vale o que acabar depois. */
export function hitstop(scene: Phaser.Scene, ms: number): void {
  const state = timeOf(scene);
  state.freezeUntil = Math.max(state.freezeUntil, performance.now() + ms);
}

/** Câmera lenta: a cena roda a `scale` da velocidade por `ms` (relógio real) — o desmaio. */
export function slowMotion(scene: Phaser.Scene, ms: number, scale: number): void {
  const state = timeOf(scene);
  state.slowUntil = Math.max(state.slowUntil, performance.now() + ms);
  state.slowScale = scale;
}

/** Duração do congelamento (ms) de um impacto desta força. */
export function hitstopMs(strength: number): number {
  return (0.03 + strength * 0.09) * 1000;
}

/** Trauma que um impacto desta força soma. */
export function traumaFor(strength: number): number {
  return 0.08 + strength * 0.45;
}

/** Soma `trauma` (que se esvaiu desde o último) e sacode a câmera com força trauma². */
function addTrauma(scene: Phaser.Scene, state: SceneTime, amount: number): void {
  const now = performance.now();
  state.trauma = Math.min(1, Math.max(0, state.trauma - ((now - state.traumaAt) / 1000) * TRAUMA_DECAY_PER_SECOND) + amount);
  state.traumaAt = now;
  scene.cameras.main.shake(90 + state.trauma * 220, state.trauma * state.trauma * MAX_SHAKE_INTENSITY, true);
}

/** Empurra a câmera `px` na direção (`dx`, `dy`) e a deixa voltar sozinha (só com a câmera seguindo alguém). */
function kickCamera(scene: Phaser.Scene, state: SceneTime, dx: number, dy: number, px: number): void {
  const camera = scene.cameras.main as Phaser.Cameras.Scene2D.Camera & { _follow?: unknown };
  if (!camera._follow) return;
  const length = Math.hypot(dx, dy);
  if (length === 0) return;
  state.kick?.stop();
  // O alvo seguido menos o `followOffset` é o centro da câmera: pra ela andar na direção do golpe, o offset vai pro lado oposto.
  camera.setFollowOffset((-dx / length) * px, (-dy / length) * px);
  state.kick = scene.tweens.add({ targets: camera.followOffset, x: 0, y: 0, duration: 160, ease: 'Quad.easeOut' });
}

/** Golpe que mata: algumas estrelinhas espirram do ponto do impacto e somem (a arte das estrelinhas dos veios). */
function sparkBurst(scene: Phaser.Scene, x: number, y: number, dx: number, dy: number): void {
  if (!scene.textures.exists(SPARKLE_KEY)) return;
  registerFrame(scene, SPARKLE_KEY, SPARKLE_CROSS_FRAME);
  const base = Math.hypot(dx, dy) > 0 ? Math.atan2(dy, dx) : -Math.PI / 2;
  for (let index = 0; index < 5; index++) {
    const angle = base + (Math.random() - 0.5) * 1.8;
    const distance = 18 + Math.random() * 22;
    const star = scene.add.image(x, y, SPARKLE_KEY, SPARKLE_CROSS_FRAME.name).setBlendMode(Phaser.BlendModes.ADD).setDepth(LIGHT_GLOW_DEPTH);
    star.setScale(DISPLAY_SCALE * (0.8 + Math.random() * 0.6)).setTint(index % 2 === 0 ? 0xffffff : 0xffe27a);
    scene.tweens.add({
      targets: star,
      x: x + Math.cos(angle) * distance,
      y: y + Math.sin(angle) * distance,
      scale: 0,
      duration: 260 + Math.random() * 120,
      ease: 'Quad.easeOut',
      onComplete: () => star.destroy(),
    });
  }
}

export interface ImpactOptions {
  /** 0-1: o quanto o golpe pesa (ver a tabela no topo). */
  strength: number;
  /** Direção do golpe (de quem bateu pra quem levou) — empurra a câmera e orienta as estrelinhas. */
  dirX?: number;
  dirY?: number;
  /** Onde foi o impacto (as estrelinhas do golpe que mata saem daqui). */
  x?: number;
  y?: number;
  /** Sem congelamento (a mordida do pet: congelar a cada mordida cansaria). */
  noHitstop?: boolean;
  /** Sem tremor (os golpes de ferramenta: só o congelamento curtinho). */
  noShake?: boolean;
}

/** Um impacto completo: congelamento + tremor + empurrão (+ estrelinhas no golpe que mata), tudo escalado de `strength`. */
export function impact(scene: Phaser.Scene, options: ImpactOptions): void {
  const strength = Math.min(1, Math.max(0, options.strength));
  const state = timeOf(scene);
  if (!options.noHitstop) hitstop(scene, hitstopMs(strength));
  if (!options.noShake) addTrauma(scene, state, traumaFor(strength));
  const dx = options.dirX ?? 0;
  const dy = options.dirY ?? 0;
  if (dx !== 0 || dy !== 0) kickCamera(scene, state, dx, dy, (1 + strength * 4) * DISPLAY_SCALE);
  if (strength >= 0.9 && options.x !== undefined && options.y !== undefined) sparkBurst(scene, options.x, options.y, dx, dy);
}
