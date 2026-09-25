import Phaser from 'phaser';
import { gameState } from './gameState';
import { HALF_HEART_HP } from './playerHealth';
import { INVENTORY_SIZE } from './inventory';
import { playEffect } from './soundEffects';
import { Player } from '../entities/Player';
import { EATING_DURATION_MS } from '../data/player';
import { EAT_SOUND } from '../data/audio';
import { resolveSlotVisual } from '../data/items';

/** Emitido (via `scene.game.events`) quando o personagem TERMINA de comer — a `UIScene` escuta pra redesenhar corações e Hotbar. */
export const PLAYER_ATE_EVENT = 'player-ate';

const BITES = 3;
/** Alimento sobre a cabeça: altura (px de exibição) acima dos pés e escala do ícone 16x16. */
const FOOD_ICON_HEIGHT_PX = 74;
const FOOD_ICON_SCALE = 1.5;
const FOOD_ICON_MIN_SCALE_FRACTION = 0.25;

/**
 * Comer uma colheita (pedido explícito): consome 1 unidade de QUALQUER
 * colheita do inventário e recupera meio coração. Prefere a colheita do slot
 * selecionado na Hotbar (dá controle ao jogador de qual comer); se o slot
 * selecionado não for uma colheita, come a primeira que achar na Bolsa —
 * "qualquer das colheitas", sem obrigar a selecionar antes.
 *
 * Agora é uma AÇÃO do personagem, como arar/regar: ele agacha (folha
 * `Sitting`, ver `PLAYER_ACTIONS.eat`), o alimento aparece sobre a cabeça e
 * é mordido 3 vezes, toca o som de comer — e só ao TERMINAR a animação a
 * colheita é gasta e a vida sobe (`finishEating`). Disparado por `F` ou por
 * clicar no próprio personagem com uma colheita selecionada
 * (`PlayerController`), o que também respeita os bloqueios de sempre
 * (inventário/pausa/dormir).
 *
 * Não faz nada (e NÃO gasta a colheita) com a vida já cheia ou sem nenhuma
 * colheita. Devolve `true` só se começou a comer.
 */
export function startEating(scene: Phaser.Scene, player: Player): boolean {
  if (player.isBusy() || player.isMoving()) return false;

  const { playerHealth } = gameState;
  if (playerHealth.getHp() >= playerHealth.getMaxHp()) return false;

  const cropId = findCropToEat();
  if (!cropId) return false;

  player.performAction(
    'eat',
    () => finishEating(scene, cropId),
    () => {
      playEffect(scene, EAT_SOUND);
      showFoodBeingEaten(scene, player, cropId);
    },
  );
  return true;
}

/** A colheita selecionada na Hotbar é comestível agora? (usado pelo clique no personagem, que só deve comer se houver o que comer). */
export function isEdibleCropSelected(): boolean {
  const { inventory } = gameState;
  const selected = inventory.getSelectedSlot();
  return selected?.category === 'crop' && inventory.getCount(selected.id) > 0;
}

function finishEating(scene: Phaser.Scene, cropId: string): void {
  const { inventory, playerHealth } = gameState;
  if (!inventory.useCrop(cropId)) return;
  playerHealth.heal(HALF_HEART_HP);
  scene.game.events.emit(PLAYER_ATE_EVENT);
}

/** O ícone real da colheita (mesmo da Bolsa) sobre a cabeça, encolhendo a cada mordida até sumir ao fim da animação. */
function showFoodBeingEaten(scene: Phaser.Scene, player: Player, cropId: string): void {
  const visual = resolveSlotVisual({ category: 'crop', id: cropId });
  if (!visual || !scene.textures.exists(visual.textureKey)) return;

  const sprite = player.sprite;
  const icon = scene.add.image(sprite.x, sprite.y - FOOD_ICON_HEIGHT_PX, visual.textureKey, visual.iconFrame);
  icon.setScale(FOOD_ICON_SCALE);
  icon.setDepth(sprite.depth + 1);

  const biteMs = EATING_DURATION_MS / (BITES + 1);
  for (let bite = 1; bite <= BITES; bite++) {
    const remaining = 1 - (bite / BITES) * (1 - FOOD_ICON_MIN_SCALE_FRACTION);
    scene.tweens.add({
      targets: icon,
      scale: FOOD_ICON_SCALE * remaining,
      angle: bite % 2 === 0 ? -8 : 8,
      duration: biteMs * 0.5,
      delay: bite * biteMs - biteMs * 0.5,
      ease: 'Sine.easeOut',
    });
  }
  scene.tweens.add({
    targets: icon,
    alpha: 0,
    duration: biteMs * 0.5,
    delay: EATING_DURATION_MS - biteMs * 0.5,
    onComplete: () => icon.destroy(),
  });
}

function findCropToEat(): string | null {
  const { inventory } = gameState;

  const selected = inventory.getSelectedSlot();
  if (selected?.category === 'crop' && inventory.getCount(selected.id) > 0) return selected.id;

  for (let index = 0; index < INVENTORY_SIZE; index++) {
    const slot = inventory.getSlot(index);
    if (slot?.category === 'crop' && inventory.getCount(slot.id) > 0) return slot.id;
  }
  return null;
}
