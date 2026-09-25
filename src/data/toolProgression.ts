import type { ToolId } from './tools';

/**
 * Progressão LINEAR de ferramentas: Madeira > Pedra > Ferro > Ouro. Cada família (Machado, Picareta) é uma
 * lista ordenada de ids de `data/tools.ts`; o tier N só pode ser fabricado por quem TEM o tier N-1, e o item
 * novo SUBSTITUI o anterior no mesmo slot do Inventário (`Inventory.upgradeTool`) — nunca vira um item extra.
 * Adicionar outra família (Enxada, Foice…) é uma linha em `TOOL_PROGRESSION` + os 4 `ToolDefinition`s.
 */
export type ToolFamily = 'axe' | 'pickaxe';

export const TOOL_TIER_NAMES = ['Madeira', 'Pedra', 'Ferro', 'Ouro'] as const;

export const TOOL_PROGRESSION: Record<ToolFamily, readonly ToolId[]> = {
  axe: ['axe', 'axe-stone', 'axe-iron', 'axe-gold'],
  pickaxe: ['pickaxe', 'pickaxe-stone', 'pickaxe-iron', 'pickaxe-gold'],
};

/**
 * Força de cada tier por golpe: um golpe conta `power` "golpes de madeira". Árvore (8) e pedra (4) caem quando o
 * total chega ao alvo — Machado: Madeira 8 golpes, Pedra 6, Ferro 4, Ouro 2; Picareta: 4 / 3 / 2 / 1.
 */
export const TOOL_TIER_POWER = [1, 1.5, 2, 4] as const;

export interface ToolTierInfo {
  family: ToolFamily;
  /** 0 = Madeira … 3 = Ouro. */
  tier: number;
}

/** A que família/tier pertence esta ferramenta? `null` = não faz parte de nenhuma progressão (Enxada, Foice, Regador, espadas). */
export function getToolTierInfo(toolId: string): ToolTierInfo | null {
  for (const family of Object.keys(TOOL_PROGRESSION) as ToolFamily[]) {
    const tier = TOOL_PROGRESSION[family].indexOf(toolId as ToolId);
    if (tier !== -1) return { family, tier };
  }
  return null;
}

/** O tier anterior da mesma família (o que o upgrade destrói); `null` se for o primeiro tier ou não houver progressão. */
export function getPreviousToolId(toolId: string): ToolId | null {
  const info = getToolTierInfo(toolId);
  if (!info || info.tier === 0) return null;
  return TOOL_PROGRESSION[info.family][info.tier - 1];
}

/** Ferramenta da família `family` (qualquer tier)? Usado pelas interações (Machado corta árvore, Picareta quebra pedra). */
export function isToolOfFamily(toolId: string, family: ToolFamily): boolean {
  return getToolTierInfo(toolId)?.family === family;
}
