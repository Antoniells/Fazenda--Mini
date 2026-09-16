import { WOOD, STONE } from './resources';
import { IRON_AXE, GOLD_AXE, IRON_PICKAXE, GOLD_PICKAXE } from './tools';
import { IRON_SWORD, GOLD_SWORD } from './weapons';
import { WOOD_ARMOR, IRON_ARMOR } from './armors';

/** Um material + quantidade exigidos pra fabricar — sempre um `id` já existente em `data/resources.ts` (nunca colheita/semente). */
export interface RecipeIngredient {
  resourceId: string;
  amount: number;
}

/**
 * Receita (Fase 8 — Crafting/Bancada de Trabalho): o novo caminho pra obter
 * ferramentas de progressão, espadas e armaduras — pedido explícito do
 * usuário substituindo a compra direta na Loja. Duas etapas separadas, cada
 * uma com seu próprio custo: `price` é pago em moedas UMA vez, na Loja, só
 * pra desbloquear a receita (fica marcada em `gameState`, mesmo conceito já
 * usado pelas pontes — ver `systems/bridgeSystem.ts`); `ingredients` são os
 * recursos coletados (`data/resources.ts`) gastos TODA vez que o jogador
 * fabrica o item na Bancada, depois de já ter a receita.
 *
 * `category` classifica a receita pra UI (que aba da Bancada ela aparece),
 * não confundir com `SlotCategory` (`data/items.ts`) — tanto `'tool'`
 * quanto `'weapon'` resultam num item de `SlotCategory: 'tool'` (mesma
 * convenção que já fazia Espada dividir slot com Machado/Picareta), só
 * `'armor'` usa a nova categoria própria.
 */
export interface RecipeDefinition {
  id: string;
  /** Id do item gerado ao fabricar — sempre um id de `data/tools.ts`, `data/weapons.ts` ou `data/armors.ts`, conforme `category`. */
  itemId: string;
  category: 'tool' | 'weapon' | 'armor';
  /** Preço em moedas pra comprar a receita na Loja (pago uma vez só). */
  price: number;
  ingredients: RecipeIngredient[];
}

/**
 * Ferramentas de progressão (Machado/Picareta): sem preço/custo anterior
 * pra herdar (diferente das Espadas, são as primeiras receitas dessas
 * ferramentas), então usa a mesma escala de moedas/recursos já validada
 * pelas Espadas de mesmo tier (ver `RECIPE_SWORD_IRON`/`RECIPE_SWORD_GOLD`
 * abaixo) — tier Ferro mais barato que Ouro, custo em Pedra (tema de
 * mineração) com um pouco de Madeira.
 */
export const RECIPE_AXE_IRON: RecipeDefinition = {
  id: 'recipe-axe-iron',
  itemId: IRON_AXE.id,
  category: 'tool',
  price: 500,
  ingredients: [
    { resourceId: STONE.id, amount: 10 },
    { resourceId: WOOD.id, amount: 5 },
  ],
};

export const RECIPE_AXE_GOLD: RecipeDefinition = {
  id: 'recipe-axe-gold',
  itemId: GOLD_AXE.id,
  category: 'tool',
  price: 1200,
  ingredients: [
    { resourceId: STONE.id, amount: 15 },
    { resourceId: WOOD.id, amount: 20 },
  ],
};

export const RECIPE_PICKAXE_IRON: RecipeDefinition = {
  id: 'recipe-pickaxe-iron',
  itemId: IRON_PICKAXE.id,
  category: 'tool',
  price: 500,
  ingredients: [
    { resourceId: STONE.id, amount: 12 },
    { resourceId: WOOD.id, amount: 3 },
  ],
};

export const RECIPE_PICKAXE_GOLD: RecipeDefinition = {
  id: 'recipe-pickaxe-gold',
  itemId: GOLD_PICKAXE.id,
  category: 'tool',
  price: 1200,
  ingredients: [
    { resourceId: STONE.id, amount: 20 },
    { resourceId: WOOD.id, amount: 15 },
  ],
};

/**
 * Espadas: `price`/`ingredients` migrados diretamente de
 * `WeaponDefinition.price`/`resourceCost` (`data/weapons.ts`) — mesmo
 * balanceamento já em uso hoje pela compra direta na Loja, só realocado
 * pra a Receita em vez de inventar números novos. `data/weapons.ts` não foi
 * alterado (a Loja ainda vende Espada direto por enquanto) — a troca de
 * fluxo de compra é um passo futuro, fora do escopo deste "Passo 1".
 */
export const RECIPE_SWORD_IRON: RecipeDefinition = {
  id: 'recipe-sword-iron',
  itemId: IRON_SWORD.id,
  category: 'weapon',
  price: IRON_SWORD.price,
  ingredients: IRON_SWORD.resourceCost ? [{ resourceId: IRON_SWORD.resourceCost.resourceId, amount: IRON_SWORD.resourceCost.amount }] : [],
};

export const RECIPE_SWORD_GOLD: RecipeDefinition = {
  id: 'recipe-sword-gold',
  itemId: GOLD_SWORD.id,
  category: 'weapon',
  price: GOLD_SWORD.price,
  ingredients: GOLD_SWORD.resourceCost ? [{ resourceId: GOLD_SWORD.resourceCost.resourceId, amount: GOLD_SWORD.resourceCost.amount }] : [],
};

/** Armaduras: primeira vez que esses itens existem no jogo, sem custo anterior pra herdar — mesma escala de moedas/recursos dos outros tiers Madeira/Ferro acima. */
export const RECIPE_ARMOR_WOOD: RecipeDefinition = {
  id: 'recipe-armor-wood',
  itemId: WOOD_ARMOR.id,
  category: 'armor',
  price: 200,
  ingredients: [{ resourceId: WOOD.id, amount: 15 }],
};

export const RECIPE_ARMOR_IRON: RecipeDefinition = {
  id: 'recipe-armor-iron',
  itemId: IRON_ARMOR.id,
  category: 'armor',
  price: 600,
  ingredients: [
    { resourceId: STONE.id, amount: 15 },
    { resourceId: WOOD.id, amount: 5 },
  ],
};

export const RECIPES: Record<string, RecipeDefinition> = {
  [RECIPE_AXE_IRON.id]: RECIPE_AXE_IRON,
  [RECIPE_AXE_GOLD.id]: RECIPE_AXE_GOLD,
  [RECIPE_PICKAXE_IRON.id]: RECIPE_PICKAXE_IRON,
  [RECIPE_PICKAXE_GOLD.id]: RECIPE_PICKAXE_GOLD,
  [RECIPE_SWORD_IRON.id]: RECIPE_SWORD_IRON,
  [RECIPE_SWORD_GOLD.id]: RECIPE_SWORD_GOLD,
  [RECIPE_ARMOR_WOOD.id]: RECIPE_ARMOR_WOOD,
  [RECIPE_ARMOR_IRON.id]: RECIPE_ARMOR_IRON,
};
