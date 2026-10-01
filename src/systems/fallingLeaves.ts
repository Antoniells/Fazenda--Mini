import Phaser from 'phaser';
import { LEAF_FRAMES, LEAF_GREENS, LEAF_KEY } from '../data/effects';
import { registerFrame } from './externalMapBuilder';
import { DISPLAY_SCALE } from './mapBuilder';
import { getWind } from './wind';

/**
 * FOLHAS CAINDO (ideia do Terraria): as árvores na tela soltam folhinhas de vez em quando — bem mais com vento (`systems/wind.ts`). Cada
 * folha cai devagar, levada pro lado do vento, num zigue-zague que gira pra lá e pra cá; ao chegar ao chão fica parada um instante e some.
 * As folhas são REAPROVEITADAS (pool). Quem chama é o balanço da vegetação (`systems/foliageSway.ts`), que já sabe quais árvores estão na tela.
 */

/** Folhas por segundo, por árvore na tela: sem vento quase nada; com vento máximo, uma a cada ~3 s por árvore. */
const CALM_PER_SECOND = 0.025;
const WINDY_PER_SECOND = 0.3;
/** Teto de folhas ao mesmo tempo na cena. */
const MAX_LEAVES = 40;
/** Queda (px/s), deriva com vento máximo (px/s), largura do zigue-zague (px) e o giro máximo (graus). */
const FALL_SPEED = { min: 18, max: 30 };
const WIND_DRIFT_PX_PER_S = 45;
const WOBBLE_PX = 9;
const WOBBLE_DEGREES = 40;
/** Quanto tempo a folha fica no chão antes de sumir, e a duração do sumiço (ms). */
const REST_MS = 1400;
const FADE_MS = 600;
/** Folha que passou disto (px) além da tela é recolhida. */
const OFFSCREEN_PX = 64;

interface Leaf {
  image: Phaser.GameObjects.Image;
  baseX: number;
  landY: number;
  speed: number;
  phase: number;
  /** ms desde que pousou (`null` = ainda caindo). */
  restingMs: number | null;
}

const leavesByScene = new WeakMap<Phaser.Scene, { alive: Leaf[]; pool: Phaser.GameObjects.Image[] }>();

/** A cada quadro: talvez solta folhas das `trees` (já filtradas: adultas e na tela) e move as que estão no ar. */
export function updateFallingLeaves(scene: Phaser.Scene, trees: Phaser.GameObjects.Image[], deltaMs: number): void {
  if (!scene.textures.exists(LEAF_KEY)) return; // Cena que não carregou a folha: sem folhas.
  let state = leavesByScene.get(scene);
  if (!state) {
    for (const frame of LEAF_FRAMES) registerFrame(scene, LEAF_KEY, frame);
    state = { alive: [], pool: [] };
    leavesByScene.set(scene, state);
  }
  const dt = deltaMs / 1000;
  const wind = getWind();
  const perSecond = CALM_PER_SECOND + (WINDY_PER_SECOND - CALM_PER_SECOND) * Math.min(1, Math.abs(wind));
  const view = scene.cameras.main.worldView;
  for (const tree of trees) {
    if (state.alive.length >= MAX_LEAVES) break;
    // Só a copa que está NA TELA solta folha (as árvores da margem também balançam, mas a folha delas ninguém veria).
    if (!view.contains(tree.x, tree.y - tree.displayHeight * 0.6)) continue;
    if (Math.random() < perSecond * dt) state.alive.push(spawnLeaf(scene, state.pool, tree));
  }

  for (let index = state.alive.length - 1; index >= 0; index--) {
    const leaf = state.alive[index];
    const offscreen = leaf.image.x < view.x - OFFSCREEN_PX || leaf.image.x > view.right + OFFSCREEN_PX || leaf.image.y > view.bottom + OFFSCREEN_PX;
    if (offscreen) leaf.restingMs = REST_MS + FADE_MS + 1; // Saiu da tela (o vento levou, ou o personagem andou): volta pro pool já.
    if (leaf.restingMs === null) {
      leaf.phase += dt * 2.4;
      leaf.baseX += wind * WIND_DRIFT_PX_PER_S * dt;
      const y = leaf.image.y + leaf.speed * dt;
      leaf.image.setPosition(leaf.baseX + Math.sin(leaf.phase) * WOBBLE_PX, Math.min(y, leaf.landY));
      leaf.image.setAngle(Math.cos(leaf.phase) * WOBBLE_DEGREES);
      if (y >= leaf.landY) {
        leaf.restingMs = 0;
        leaf.image.setDepth(leaf.landY - 1); // No chão: atrás de quem passar por cima.
      }
      continue;
    }
    leaf.restingMs += deltaMs;
    if (leaf.restingMs > REST_MS) leaf.image.setAlpha(Math.max(0, 1 - (leaf.restingMs - REST_MS) / FADE_MS));
    if (leaf.restingMs > REST_MS + FADE_MS) {
      leaf.image.setVisible(false);
      state.pool.push(leaf.image);
      state.alive.splice(index, 1);
    }
  }
}

function spawnLeaf(scene: Phaser.Scene, pool: Phaser.GameObjects.Image[], tree: Phaser.GameObjects.Image): Leaf {
  const frame = LEAF_FRAMES[Math.floor(Math.random() * LEAF_FRAMES.length)].name;
  const x = tree.x + (Math.random() - 0.5) * tree.displayWidth * 0.6;
  const y = tree.y - tree.displayHeight * (0.45 + Math.random() * 0.4); // Do meio pra cima da copa.
  const image = pool.pop() ?? scene.add.image(0, 0, LEAF_KEY, frame).setTintMode(Phaser.TintModes.FILL).setScale(DISPLAY_SCALE);
  image.setFrame(frame).setTint(LEAF_GREENS[Math.floor(Math.random() * LEAF_GREENS.length)]).setPosition(x, y).setAlpha(1).setAngle(0).setVisible(true);
  image.setDepth(tree.depth + 1); // Caindo: na frente da própria árvore.
  return {
    image,
    baseX: x,
    // Pousa perto do pé da árvore (um pouco à frente ou atrás).
    landY: tree.y - 6 + Math.random() * 28,
    speed: Phaser.Math.FloatBetween(FALL_SPEED.min, FALL_SPEED.max),
    phase: Math.random() * Math.PI * 2,
    restingMs: null,
  };
}
