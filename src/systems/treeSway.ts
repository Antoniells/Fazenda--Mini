import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { TREE_RUSTLE_SOUNDS } from '../data/audio';
import { playRandomEffect } from './soundEffects';
import { setSwayOffset } from './foliageSway';

/**
 * VENTO NAS ÁRVORES: quando o personagem entra na copa (passa por trás da árvore, "no meio das folhas"), ela balança — gira em torno
 * da base do tronco (origem 0.5,1 das árvores), empurrada pro lado oposto ao personagem, num vai-e-vem que vai morrendo — e farfalha.
 * Só transforma o sprite que já existe (ângulo), sem arte nova; o empurrão SOMA com o vento (`setSwayOffset`, `systems/foliageSway.ts`). Broto e muda ficam de fora: já têm o balanço de pisar em cima
 * (`FarmResources.rustle`).
 */

/** Duração do balanço inteiro (ms). */
const SWAY_MS = 900;
/** Inclinação máxima (graus) no primeiro vai. */
const SWAY_DEGREES = 3;
/** Quantos vai-e-véns cabem no balanço. */
const SWAY_CYCLES = 2.5;
/** Uma mesma árvore não recomeça o balanço antes disso (ms) — andar pra lá e pra cá na borda da copa não vira tremedeira. */
const COOLDOWN_MS = 700;
/** Árvores mais baixas que isso (px na tela) são broto/muda. */
const MIN_TREE_HEIGHT_PX = 72;
/** A copa conta só a parte do meio da largura (as pontas do recorte são quase só transparência). */
const CANOPY_WIDTH_RATIO = 0.6;

interface SwayState {
  inside: boolean;
  readyAt: number;
}

const states = new WeakMap<Phaser.GameObjects.Image, SwayState>();

/** Chamar a cada quadro, junto de `updateTreeOverlap`, com as mesmas árvores. */
export function updateTreeSway(player: Player, trees: Phaser.GameObjects.Image[]): void {
  const body = player.sprite.getBounds();
  const feetX = body.centerX;
  const feetY = body.bottom - 4;

  for (const tree of trees) {
    if (!tree.active || tree.displayHeight < MIN_TREE_HEIGHT_PX) continue;
    const bounds = tree.getBounds();
    const halfWidth = (bounds.width * CANOPY_WIDTH_RATIO) / 2;
    const inside = Math.abs(feetX - tree.x) <= halfWidth && feetY >= bounds.top && feetY < bounds.bottom;

    let state = states.get(tree);
    if (!state) {
      state = { inside, readyAt: 0 };
      states.set(tree, state);
      continue; // Já nasceu com o personagem dentro (ex.: entrou na cena ali): não balança do nada.
    }
    const entered = inside && !state.inside;
    state.inside = inside;
    const now = tree.scene.time.now;
    if (!entered || now < state.readyAt) continue;

    state.readyAt = now + COOLDOWN_MS;
    sway(tree, feetX < tree.x ? 1 : -1);
  }
}

/** Balança a árvore: `direction` 1 = pende pra direita. */
function sway(tree: Phaser.GameObjects.Image, direction: number): void {
  const scene = tree.scene;
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: SWAY_MS,
    onUpdate: (tween) => {
      if (!tree.active) return;
      const t = tween.getValue() ?? 0;
      const damping = (1 - t) * (1 - t);
      setSwayOffset(tree, direction * SWAY_DEGREES * damping * Math.sin(t * Math.PI * 2 * SWAY_CYCLES));
    },
    onComplete: () => {
      setSwayOffset(tree, 0);
    },
  });
  playRandomEffect(scene, TREE_RUSTLE_SOUNDS);
}
