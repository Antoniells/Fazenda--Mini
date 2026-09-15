import { WOOD, STONE } from './resources';

/**
 * Espadas (Fase 8 — Progressão): parecidas com `ToolDefinition`
 * (`data/tools.ts` — mesmo slot de categoria `'tool'` no Inventário, mesma
 * convenção de ícone 32x16 com 2 frames idênticos, só o 0 usado), mas com
 * `dano` (usado em `systems/combat.ts` pra saber quanto tirar de um
 * inimigo) e custo de compra — a Espada de Madeira inicial não passa pela
 * Loja (`price: 0`, dada de graça no `Inventory` no início do jogo, como
 * Enxada/Foice), as demais custam moedas + opcionalmente um recurso
 * coletado (`resourceCost`), pedido explícito do usuário.
 *
 * Ícones de `Icons/RPG icons/Weapons and Armor/<tier>/Sword.png` (32x16,
 * 2 frames de 16x16, mesma convenção já usada pelas ferramentas — só o
 * frame 0). Os nomes usam os tiers que o pacote realmente tem (Madeira/
 * Ferro/Ouro) em vez de inventar um tier "Aço" sem asset correspondente.
 */
export interface WeaponDefinition {
  id: string;
  name: string;
  textureKey: string;
  texturePath: string;
  iconFrame: number;
  /** Dano por golpe, usado em `systems/combat.ts`. */
  damage: number;
  /** Preço em moedas na Loja (aba Ferramentas). `0` = não é vendida, é a espada inicial. */
  price: number;
  /** Custo misto (pedido explícito do usuário): além das moedas, exige X unidades de um recurso já existente no `Inventory` (madeira/pedra — nunca um recurso inexistente/incolhível). */
  resourceCost?: { resourceId: string; amount: number };
}

const SWORD_BASE_PATH = 'Icons/RPG icons/Weapons and Armor';

/** Espada inicial (Fase 8) — dada de graça no `Inventory`, mesma convenção da Enxada/Foice/Machado/Picareta. */
export const WOODEN_SWORD: WeaponDefinition = {
  id: 'sword-wood',
  name: 'Espada de Madeira',
  textureKey: 'weapon-sword-wood',
  texturePath: `${SWORD_BASE_PATH}/1. Wood/Sword.png`,
  iconFrame: 0,
  damage: 5,
  price: 0,
};

export const IRON_SWORD: WeaponDefinition = {
  id: 'sword-iron',
  name: 'Espada de Ferro',
  textureKey: 'weapon-sword-iron',
  texturePath: `${SWORD_BASE_PATH}/3. Iron/Sword.png`,
  iconFrame: 0,
  damage: 15,
  price: 500,
  resourceCost: { resourceId: STONE.id, amount: 10 },
};

export const GOLD_SWORD: WeaponDefinition = {
  id: 'sword-gold',
  name: 'Espada de Ouro',
  textureKey: 'weapon-sword-gold',
  texturePath: `${SWORD_BASE_PATH}/4. Gold/Sword.png`,
  iconFrame: 0,
  damage: 30,
  price: 1200,
  resourceCost: { resourceId: WOOD.id, amount: 20 },
};

export const WEAPONS: Record<string, WeaponDefinition> = {
  [WOODEN_SWORD.id]: WOODEN_SWORD,
  [IRON_SWORD.id]: IRON_SWORD,
  [GOLD_SWORD.id]: GOLD_SWORD,
};

/** Só as compráveis (preço > 0) — usada para montar a lista de itens da Loja. */
export const PURCHASABLE_WEAPONS: WeaponDefinition[] = [IRON_SWORD, GOLD_SWORD];
