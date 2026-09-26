import type { ShopItem } from '../ui/shopMenu';
import { IRON_SWORD, GOLD_SWORD, WeaponDefinition } from './weapons';
import { WOOD_ARMOR, IRON_ARMOR, ArmorDefinition } from './armors';
import { COPPER_BAR, GOLD_BAR, IRON, RESOURCES } from './resources';
import { TOOL_BARS_REQUIRED } from './toolShop';

/**
 * Catálogo de armas e armaduras PRONTAS do Ferreiro (junto da aba de Ferramentas, ver `systems/vendorShops.ts`). A loja em si é o interior da forja
 * (`data/maps/shopInteriors.ts`); aqui só dados.
 */

/**
 * CATÁLOGO do Ferreiro: armas e armaduras, compradas com moedas + `TOOL_BARS_REQUIRED` barras do metal (feitas na Fornalha, `data/smelting.ts`) — como as ferramentas (`data/toolShop.ts`).
 * A espada de madeira (inicial, de graça) não é vendida. A armadura de Madeira usa barras de Cobre (não existe barra de madeira): é a entrada da linha.
 */
export interface VillageShopGood {
  kind: 'weapon' | 'armor';
  definition: WeaponDefinition | ArmorDefinition;
  price: number;
  /** Materiais gastos além das moedas (id de `data/resources.ts` e quantidade). */
  materials: Array<{ resourceId: string; amount: number }>;
}

export const VILLAGE_SHOP_GOODS: VillageShopGood[] = [
  { kind: 'weapon', definition: IRON_SWORD, price: 750, materials: [{ resourceId: IRON.id, amount: TOOL_BARS_REQUIRED }] },
  { kind: 'weapon', definition: GOLD_SWORD, price: 1800, materials: [{ resourceId: GOLD_BAR.id, amount: TOOL_BARS_REQUIRED }] },
  { kind: 'armor', definition: WOOD_ARMOR, price: 300, materials: [{ resourceId: COPPER_BAR.id, amount: TOOL_BARS_REQUIRED }] },
  { kind: 'armor', definition: IRON_ARMOR, price: 900, materials: [{ resourceId: IRON.id, amount: TOOL_BARS_REQUIRED }] },
];

/** Aba única do painel (ícone/cor da categoria "Ferramentas") e os itens do catálogo, no formato do `ShopMenu`. */
export const VILLAGE_SHOP_ITEMS: ShopItem[] = VILLAGE_SHOP_GOODS.map(({ kind, definition, price, materials }) => ({
  id: definition.id,
  category: 'tools' as const,
  name: definition.name,
  description:
    kind === 'weapon'
      ? `Dano ${(definition as WeaponDefinition).damage} por golpe. Aperte Espaço com ela na mão pra atacar.`
      : `Defesa ${(definition as ArmorDefinition).defense}: reduz o dano que você leva. Vista-a na aba Armadura do Inventário.`,
  textureKey: definition.textureKey,
  iconFrame: definition.iconFrame,
  price,
  materials: materials.map(({ resourceId, amount }) => ({ resourceId, name: RESOURCES[resourceId].name, amount })),
}));
