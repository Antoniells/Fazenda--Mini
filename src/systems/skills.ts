import Phaser from 'phaser';
import { gameState } from './gameState';
import { popText } from './floatingText';
import {
  BASE_MAX_STAMINA,
  SKILL_BONUS,
  XP_REWARDS,
  getSkillDefinition,
  type SkillId,
  type XpSource,
} from '../data/skills';

/**
 * Progressão e RPG (dados em `data/skills.ts`): ganhar XP com as ações do mundo, gastá-lo em habilidades e ler os bônus resultantes. O estado
 * (`gameState.skills`) vai pro save. Os bônus valem NA HORA da compra — nada é "aplicado" a um valor guardado: cada sistema pergunta
 * o bônus atual no momento em que precisa (`getMoveSpeedMultiplier`, `applySellBonus`, `rollDoubleDrop`...).
 */

/** Nível comprado de uma habilidade (0 = ainda não comprada). */
export function getSkillRank(id: SkillId): number {
  return gameState.skills.ranks[id] ?? 0;
}

export function getSkillMaxRank(id: SkillId): number {
  return getSkillDefinition(id)?.costs.length ?? 0;
}

/** XP do próximo nível, ou `null` se já está no máximo. */
export function getNextSkillCost(id: SkillId): number | null {
  const definition = getSkillDefinition(id);
  if (!definition) return null;
  return definition.costs[getSkillRank(id)] ?? null;
}

export type SkillPurchaseResult = 'bought' | 'poor' | 'maxed' | 'unknown';

/** Compra o próximo nível: só desconta o XP quando a compra acontece; qualquer recusa não muda nada. */
export function purchaseSkill(id: SkillId): SkillPurchaseResult {
  const cost = getNextSkillCost(id);
  if (!getSkillDefinition(id)) return 'unknown';
  if (cost === null) return 'maxed';
  if (gameState.skills.xp < cost) return 'poor';

  gameState.skills.xp -= cost;
  gameState.skills.ranks[id] = getSkillRank(id) + 1;
  return 'bought';
}

/** Soma XP (sem nenhum efeito visual). Devolve o quanto foi somado. */
export function addXp(amount: number): number {
  const gained = Math.max(0, Math.floor(amount));
  gameState.skills.xp += gained;
  gameState.skills.totalXp += gained;
  return gained;
}

/**
 * XP de uma ação do mundo: soma na hora (`XP_REWARDS[source]`) e mostra "+N XP" flutuando em (`x`, `y`) da cena — sem posição, só soma.
 * Quem chama é a própria ação (colheita, golpe final numa pedra/árvore, inimigo derrotado, peixe).
 */
export function awardXp(scene: Phaser.Scene | null, source: XpSource, x?: number, y?: number, delay = 0): void {
  const gained = addXp(XP_REWARDS[source]);
  if (scene && gained > 0 && x !== undefined && y !== undefined) {
    popText(scene, x, y, `+${gained} XP`, { color: '#9fe8ff', fontSize: 13, rise: 26, delay });
  }
}

// --- Bônus (leitura) ------------------------------------------------------------------------------------------------------------

/** Multiplicador da velocidade de movimento (1 = normal): `Player` divide a duração do passo por ele. */
export function getMoveSpeedMultiplier(): number {
  return 1 + getSkillRank('swiftFeet') * SKILL_BONUS.swiftFeetPerRank;
}

/** Multiplicador do valor de venda (1 = normal) na Caixa de Remessas. */
export function getSellPriceMultiplier(): number {
  return 1 + getSkillRank('merchant') * SKILL_BONUS.merchantPerRank;
}

/** Aplica o bônus de venda a um TOTAL em moedas (arredonda uma vez só, no total — arredondar por unidade sumiria o bônus em itens baratos). */
export function applySellBonus(baseCoins: number): number {
  return Math.round(baseCoins * getSellPriceMultiplier());
}

/** Chance (0-1) de o drop de uma colheita/coleta vir em dobro. */
export function getDoubleDropChance(): number {
  return getSkillRank('doubleDrop') * SKILL_BONUS.doubleDropPerRank;
}

/**
 * Sorteia o drop duplo: devolve `amount` normal ou `amount * 2` (e, dobrado, avisa "Drop duplo!" em (`x`, `y`) da cena). Uma colheita
 * chama uma vez só e usa o resultado — nada é sorteado por item.
 */
export function rollDoubleDrop(scene: Phaser.Scene | null, amount: number, x?: number, y?: number): number {
  if (Math.random() >= getDoubleDropChance()) return amount;
  if (scene && x !== undefined && y !== undefined) popText(scene, x, y, 'Drop duplo!', { color: '#ffe066', fontSize: 14, rise: 40, delay: 120 });
  return amount * 2;
}

/** Sorte na pesca (0 sem habilidade) — o minigame de pesca lê daqui quando existir. */
export function getFishingLuck(): number {
  return getSkillRank('fishingLuck') * SKILL_BONUS.fishingLuckPerRank;
}

/** Resistência máxima (stamina) — a barra de resistência lê daqui quando existir. */
export function getMaxStamina(): number {
  return BASE_MAX_STAMINA + getSkillRank('stamina') * SKILL_BONUS.staminaPerRank;
}
