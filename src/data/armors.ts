/**
 * Armaduras (Fase 8 — Crafting): mesmo padrão de `data/weapons.ts`, mas
 * numa categoria de slot própria (`SlotCategory: 'armor'`, ver
 * `data/items.ts`) em vez de reaproveitar `'tool'` — diferente de espadas
 * (que ocupam o mesmo slot equipável das ferramentas), uma armadura nunca
 * é "selecionada" na Hotbar, é equipada à parte (paperdoll do Inventário).
 *
 * Só existem comprando no Ferreiro (`data/villageShop.ts`) — por isso não têm `price` aqui, essa economia
 * mora inteira no catálogo dele.
 *
 * Ícone reaproveita `Chestplate.png` de cada tier em
 * `Icons/RPG icons/Weapons and Armor/<tier>/` (mesma folha 32x16, 2 frames
 * de 16x16 idênticos, só o frame 0 — mesma convenção já conferida pixel a
 * pixel para Espada/Machado/Picareta). O pacote não tem uma pasta "Couro":
 * o tier mais baixo disponível é "1. Wood", então a primeira armadura usa
 * esse nome (Armadura de Madeira) em vez de inventar um nome que não bate
 * com o ícone de verdade (ver CLAUDE.md — nunca criar arte via código,
 * incluindo descasar nome e visual real do asset).
 */
export interface ArmorDefinition {
  id: string;
  name: string;
  textureKey: string;
  texturePath: string;
  iconFrame: number;
  /** Redução de dano ao ser atingido — ainda não consumido por `systems/combat.ts` (isso é trabalho de uma fase futura), só a identidade do item por enquanto. */
  defense: number;
}

const ARMOR_BASE_PATH = 'Icons/RPG icons/Weapons and Armor';

export const WOOD_ARMOR: ArmorDefinition = {
  id: 'armor-wood',
  name: 'Armadura de Madeira',
  textureKey: 'armor-chestplate-wood',
  texturePath: `${ARMOR_BASE_PATH}/1. Wood/Chestplate.png`,
  iconFrame: 0,
  defense: 2,
};

export const IRON_ARMOR: ArmorDefinition = {
  id: 'armor-iron',
  name: 'Armadura de Ferro',
  textureKey: 'armor-chestplate-iron',
  texturePath: `${ARMOR_BASE_PATH}/3. Iron/Chestplate.png`,
  iconFrame: 0,
  defense: 6,
};

export const ARMORS: Record<string, ArmorDefinition> = {
  [WOOD_ARMOR.id]: WOOD_ARMOR,
  [IRON_ARMOR.id]: IRON_ARMOR,
};
