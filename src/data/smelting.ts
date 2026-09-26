import { COPPER_ORE, IRON_ORE, GOLD_ORE, COAL, COPPER_BAR, IRON, GOLD_BAR } from './resources';

/**
 * A FORNALHA (`data/decorations.ts` FURNACE, construída pelo Marceneiro): funde minério bruto em barra. Toda barra de qualquer metal custa a mesma coisa — `SMELT_ORE_AMOUNT`
 * minérios brutos + `SMELT_COAL_AMOUNT` Carvões — e sai UMA (`SmeltingRecipe`). Quem gasta e entrega é `UIScene.smelt`; a tela é `ui/furnaceMenu.ts`.
 */
export const SMELT_ORE_AMOUNT = 5;
export const SMELT_COAL_AMOUNT = 3;

export interface SmeltingRecipe {
  id: string;
  /** Minério bruto consumido (`data/resources.ts`), `SMELT_ORE_AMOUNT` unidades. */
  oreId: string;
  /** Barra produzida (1 por fundição). */
  barId: string;
}

export const SMELTING_RECIPES: SmeltingRecipe[] = [
  { id: 'smelt-copper', oreId: COPPER_ORE.id, barId: COPPER_BAR.id },
  { id: 'smelt-iron', oreId: IRON_ORE.id, barId: IRON.id },
  { id: 'smelt-gold', oreId: GOLD_ORE.id, barId: GOLD_BAR.id },
];

/** O carvão que toda fundição gasta. */
export const SMELT_FUEL_ID = COAL.id;

export function getSmeltingRecipe(id: string): SmeltingRecipe | undefined {
  return SMELTING_RECIPES.find((recipe) => recipe.id === id);
}
