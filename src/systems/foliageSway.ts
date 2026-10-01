import Phaser from 'phaser';
import { advanceWind, windLean } from './wind';
import { LEAF_KEY, LEAF_PATH } from '../data/effects';
import { updateFallingLeaves } from './fallingLeaves';

/**
 * A VEGETAÇÃO NO VENTO: tufos, mato, plantações e árvores se registram aqui ao nascer (`registerSway`) e, a cada quadro, pendem conforme o
 * vento global (`systems/wind.ts`) — uma onda que atravessa o campo. Só o ângulo do sprite que já existe muda (todos têm a origem na
 * base, então giram "pelo pé"); nada de arte nova.
 *
 * - Quem já está num tween próprio (o balanço de pisar em cima, o tremor do golpe) fica de fora enquanto ele dura.
 * - Um empurrão extra (o balanço da árvore quando o personagem passa pela copa, `systems/treeSway.ts`) entra por `setSwayOffset` e soma
 *   com o vento, em vez de brigar com ele pelo ângulo.
 * - Cada cena se liga sozinha no 1º registro (evento `update`) e se desliga ao fechar; só o que está na tela é atualizado.
 * - As árvores adultas na tela soltam folhas (`systems/fallingLeaves.ts`); a folha é carregada aqui mesmo, sob demanda, na 1ª vez.
 */

export type SwayKind = 'grass' | 'crop' | 'tree';

/** Graus por unidade de `windLean` (que vai de -1,5 a 1,5) e a velocidade da onda de cada tipo. */
const PROFILES: Record<SwayKind, { degrees: number; cyclesPerSecond: number }> = {
  grass: { degrees: 7, cyclesPerSecond: 0.12 },
  crop: { degrees: 4.5, cyclesPerSecond: 0.12 },
  tree: { degrees: 1.4, cyclesPerSecond: 0.22 },
};
/** Tamanho (px) usado só pra dar a fase da onda a cada planta. */
const WAVE_CELL_PX = 32;
/** Margem além da câmera (px) que ainda é atualizada (a copa alta das árvores aparece antes da base). */
const VIEW_MARGIN_PX = 128;

interface SwayEntry {
  kind: SwayKind;
  col: number;
  row: number;
  offset: number;
}

const entries = new Map<Phaser.GameObjects.Image, SwayEntry>();
const hookedScenes = new WeakSet<Phaser.Scene>();
/** Último quadro do jogo em que o vento andou (várias cenas atualizam no mesmo quadro). */
let lastWindFrame = -1;

/** Põe o sprite no vento. Pode chamar de novo pro mesmo sprite (troca o tipo). */
export function registerSway(sprite: Phaser.GameObjects.Image, kind: SwayKind): void {
  const offset = entries.get(sprite)?.offset ?? 0;
  entries.set(sprite, { kind, col: Math.floor(sprite.x / WAVE_CELL_PX), row: Math.floor(sprite.y / WAVE_CELL_PX), offset });
  hookScene(sprite.scene);
}

/** Inclinação extra (graus) somada ao vento — 0 tira. */
export function setSwayOffset(sprite: Phaser.GameObjects.Image, degrees: number): void {
  const entry = entries.get(sprite);
  if (entry) entry.offset = degrees;
  else if (sprite.active) sprite.setAngle(degrees); // Fora do vento: o empurrão sozinho.
}

function hookScene(scene: Phaser.Scene): void {
  if (hookedScenes.has(scene)) return;
  hookedScenes.add(scene);
  if (!scene.textures.exists(LEAF_KEY)) {
    scene.load.image(LEAF_KEY, encodeURI(`/${LEAF_PATH}`));
    scene.load.start();
  }
  const onUpdate = (_time: number, delta: number): void => update(scene, delta);
  scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate);
    hookedScenes.delete(scene);
    for (const sprite of entries.keys()) if (!sprite.scene || sprite.scene === scene) entries.delete(sprite);
  });
}

function update(scene: Phaser.Scene, delta: number): void {
  const frame = scene.game.loop.frame;
  if (frame !== lastWindFrame) {
    lastWindFrame = frame;
    advanceWind(delta);
  }
  const view = scene.cameras.main.worldView;
  const left = view.x - VIEW_MARGIN_PX;
  const right = view.right + VIEW_MARGIN_PX;
  const top = view.y - VIEW_MARGIN_PX;
  const bottom = view.bottom + VIEW_MARGIN_PX * 2;
  const visibleTrees: Phaser.GameObjects.Image[] = [];

  for (const [sprite, entry] of entries) {
    if (!sprite.active || !sprite.scene) {
      entries.delete(sprite); // Destruído (colhido, cortado, cena recriada).
      continue;
    }
    if (sprite.scene !== scene || !sprite.visible) continue;
    if (sprite.x < left || sprite.x > right || sprite.y < top || sprite.y > bottom) continue;
    if (entry.kind === 'tree') visibleTrees.push(sprite);
    if (scene.tweens.isTweening(sprite)) continue;
    const profile = PROFILES[entry.kind];
    sprite.setAngle(profile.degrees * windLean(entry.col, entry.row, profile.cyclesPerSecond) + entry.offset);
  }
  updateFallingLeaves(scene, visibleTrees, delta);
}

/** Empurrão de pisar: inclinação máxima (graus), duração (ms) e quantos vai-e-véns até parar. */
const PUSH_DEGREES = 9;
const PUSH_MS = 480;
const PUSH_CYCLES = 1.5;
const pushing = new WeakSet<Phaser.GameObjects.Image>();

/**
 * A planta é EMPURRADA por quem passa (ideia do Terraria): pende primeiro pro lado em que o personagem anda (`direction` 1 = direita,
 * -1 = esquerda) e volta num vai-e-vem que morre — somado ao vento, sem tomar o ângulo dele (`setSwayOffset`).
 */
export function pushPlant(sprite: Phaser.GameObjects.Image, direction: number): void {
  if (pushing.has(sprite) || !sprite.active) return;
  pushing.add(sprite);
  sprite.scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: PUSH_MS,
    onUpdate: (tween) => {
      if (!sprite.active) return;
      const t = tween.getValue() ?? 0;
      setSwayOffset(sprite, direction * PUSH_DEGREES * (1 - t) * Math.sin(t * Math.PI * 2 * PUSH_CYCLES));
    },
    onComplete: () => {
      pushing.delete(sprite);
      setSwayOffset(sprite, 0);
    },
  });
}

const lastStep = new WeakMap<Phaser.Scene, { col: number; direction: number }>();

/** Pra que lado o personagem andou neste passo (pela coluna); passo vertical mantém o último lado. */
export function stepDirection(scene: Phaser.Scene, col: number): number {
  const last = lastStep.get(scene);
  const direction = last && col !== last.col ? Math.sign(col - last.col) : last?.direction ?? 1;
  lastStep.set(scene, { col, direction });
  return direction;
}
