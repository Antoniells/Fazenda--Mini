import { Inventory } from './inventory';
import { RecipeDefinition } from '../data/recipes';
import { getToolTierInfo, getPreviousToolId, TOOL_TIER_NAMES } from '../data/toolProgression';
import { TOOLS, ToolId } from '../data/tools';

/**
 * Por que uma receita de FERRAMENTA de progressão não pode ser fabricada agora (`null` = pode, ou não é uma
 * progressão): `'owned'` — o jogador já tem esse tier (ou um maior); `'needsPrevious'` — falta o tier anterior na
 * Bolsa (a progressão é linear: Madeira > Pedra > Ferro > Ouro, sem pular). Compartilhado pela Bancada (que mostra
 * o motivo) e por quem de fato fabrica (`UIScene.craftItem`) — a regra vive num lugar só.
 */
export type ToolUpgradeBlock = 'owned' | 'needsPrevious';

export function getToolUpgradeBlock(inventory: Inventory, recipe: RecipeDefinition): ToolUpgradeBlock | null {
  if (recipe.category !== 'tool') return null;
  const info = getToolTierInfo(recipe.itemId);
  const previousId = getPreviousToolId(recipe.itemId);
  if (!info || !previousId) return null;

  if (inventory.getToolTier(info.family) >= info.tier) return 'owned';
  if (inventory.getToolTier(info.family) < info.tier - 1) return 'needsPrevious';
  return null;
}

/** Nome do tier de uma ferramenta ("Madeira"/"Pedra"/"Ferro"/"Ouro"), pra textos de UI. */
export function toolTierName(toolId: string): string {
  const info = getToolTierInfo(toolId);
  return info ? TOOL_TIER_NAMES[info.tier] : '';
}

/** Nome da ferramenta do tier anterior ("Machado de Pedra"), pra dizer "Precisa de …". */
export function previousToolName(toolId: string): string {
  const previousId = getPreviousToolId(toolId);
  return previousId ? TOOLS[previousId as ToolId].name : '';
}
