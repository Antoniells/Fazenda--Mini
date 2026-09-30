import { COPPER_ORE, IRON_ORE, GOLD_ORE, COAL, COPPER_BAR, IRON, GOLD_BAR, AZURITE_ORE, AZURITE_BAR } from './resources';

/**
 * A FORNALHA (`data/decorations.ts` FURNACE, construída pelo Marceneiro): funde minério bruto em barra. Toda barra de qualquer metal custa a mesma coisa — `SMELT_ORE_AMOUNT`
 * minérios brutos + `SMELT_COAL_AMOUNT` Carvões — e sai UMA (`SmeltingRecipe`). Quem gasta e entrega é `UIScene.smelt`; a tela é `ui/furnaceMenu.ts`.
 */
export const SMELT_ORE_AMOUNT = 5;
export const SMELT_COAL_AMOUNT = 3;

/** Quanto tempo (minutos do relógio do jogo) cada barra leva na Fornalha: 30 min = ~15 s de jogo (o dia de 24 h dura 12 min reais). As barras entram numa fila, uma depois da outra. */
export const SMELT_MINUTES = 30;

/** Uma barra sendo fundida: pronta quando o relógio do jogo (dias * 1440 + minutos do dia) chega em `doneAtMinute`. Quem tem a fila é `systems/smelting.ts`. */
export interface SmeltJob {
  recipeId: string;
  doneAtMinute: number;
}

/** Vai pro save: a fila de fundição. */
export interface SmeltState {
  jobs: SmeltJob[];
}

export function createSmeltState(): SmeltState {
  return { jobs: [] };
}

export interface SmeltingRecipe {
  id: string;
  /** Minério bruto consumido (`data/resources.ts`), `SMELT_ORE_AMOUNT` unidades. */
  oreId: string;
  /** Barra produzida (1 por fundição). */
  barId: string;
  /** O 2º ingrediente, quando não é o carvão de sempre (a Azurita se funde com Barra de Ouro). */
  fuel?: { id: string; amount: number };
}

export const SMELTING_RECIPES: SmeltingRecipe[] = [
  { id: 'smelt-copper', oreId: COPPER_ORE.id, barId: COPPER_BAR.id },
  { id: 'smelt-iron', oreId: IRON_ORE.id, barId: IRON.id },
  { id: 'smelt-gold', oreId: GOLD_ORE.id, barId: GOLD_BAR.id },
  // A "mesclagem do ouro com a azurita": 5 Azuritas Brutas + 1 Barra de Ouro (sem carvão).
  { id: 'smelt-azurite', oreId: AZURITE_ORE.id, barId: AZURITE_BAR.id, fuel: { id: GOLD_BAR.id, amount: 1 } },
];

/** O carvão que toda fundição gasta (menos as que têm `fuel` próprio). */
export const SMELT_FUEL_ID = COAL.id;

/** O que uma fundição gasta: o minério e o 2º ingrediente (carvão, ou o `fuel` da receita). */
export function smeltingInputs(recipe: SmeltingRecipe): { oreId: string; oreAmount: number; fuelId: string; fuelAmount: number } {
  return { oreId: recipe.oreId, oreAmount: SMELT_ORE_AMOUNT, fuelId: recipe.fuel?.id ?? SMELT_FUEL_ID, fuelAmount: recipe.fuel?.amount ?? SMELT_COAL_AMOUNT };
}

export function getSmeltingRecipe(id: string): SmeltingRecipe | undefined {
  return SMELTING_RECIPES.find((recipe) => recipe.id === id);
}
