import { gameState } from './gameState';
import { hasMilestone, reachMilestone } from './story';
import { ENCHANTS, ENCHANT_BAR_ID, ENCHANT_TARGETS, EnchantTarget } from '../data/enchanting';
import { getToolTierInfo } from '../data/toolProgression';
import { WEAPONS } from '../data/weapons';

/**
 * ENCANTAMENTOS (Fase 11): o que já foi encantado (`gameState.enchants`, vai pro save), encantar na Mesa do Mago e os bônus que os
 * outros sistemas leem — força da Picareta/Machado (`resourceInteraction`, `oreInteraction`), dano da Espada (`playerController`) e
 * defesa da Armadura (`getPlayerDefense`).
 */

export function isEnchanted(target: EnchantTarget): boolean {
  return gameState.enchants.includes(target);
}

/** A Mesa de Encantamentos já foi liberada (o Mago confia no jogador — marco `wizardTrust`)? */
export function isEnchantTableUnlocked(): boolean {
  return hasMilestone('wizardTrust');
}

export type EnchantResult = 'done' | 'locked' | 'already' | 'noBars' | 'poor';

/** Por que não dá pra encantar agora (`null` = dá). */
export function enchantBlocker(target: EnchantTarget): EnchantResult | null {
  const enchant = ENCHANTS[target];
  const { inventory } = gameState;
  if (!isEnchantTableUnlocked()) return 'locked';
  if (isEnchanted(target)) return 'already';
  if (inventory.getResourceCount(ENCHANT_BAR_ID) < enchant.bars) return 'noBars';
  if (inventory.getCoins() < enchant.coins) return 'poor';
  return null;
}

/** Encanta (confere tudo antes de cobrar). A Picareta encantada é um marco da história (`enchantedPickaxe`). */
export function enchant(target: EnchantTarget): EnchantResult {
  const blocker = enchantBlocker(target);
  if (blocker) return blocker;
  const enchantDef = ENCHANTS[target];
  gameState.inventory.useResource(ENCHANT_BAR_ID, enchantDef.bars);
  gameState.inventory.spendCoins(enchantDef.coins);
  gameState.enchants.push(target);
  if (target === 'pickaxe') reachMilestone('enchantedPickaxe');
  return 'done';
}

/** Multiplicador do encantamento de uma família (1 = sem encantamento). */
export function enchantMultiplier(target: EnchantTarget): number {
  return isEnchanted(target) ? ENCHANTS[target].multiplier : 1;
}

/** Defesa do jogador: a da armadura vestida, com o encantamento da Armadura. */
export function getPlayerDefense(): number {
  return gameState.inventory.getDefense() * enchantMultiplier('armor');
}

/** Dano de uma espada, com o encantamento da Espada. */
export function swordDamage(weaponId: string): number {
  return (WEAPONS[weaponId]?.damage ?? 0) * enchantMultiplier('sword');
}

/** O jogador está com uma Picareta encantada na mão (a que quebra a barreira do andar 50)? */
export function isEnchantedPickaxeSelected(): boolean {
  const selected = gameState.inventory.getSelectedSlot();
  if (selected?.category !== 'tool') return false;
  return getToolTierInfo(selected.id)?.family === 'pickaxe' && isEnchanted('pickaxe');
}

/** Estado vindo do save, só com alvos que existem. */
export function sanitizeEnchants(data: unknown): EnchantTarget[] {
  if (!Array.isArray(data)) return [];
  return ENCHANT_TARGETS.filter((target) => data.includes(target));
}
