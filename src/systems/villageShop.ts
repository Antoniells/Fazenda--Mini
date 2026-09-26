import Phaser from 'phaser';
import { VILLAGE_SHOP_GOODS } from '../data/villageShop';
import { Inventory } from './inventory';
import { HOE } from '../data/tools';

/** Carrega os ícones do catálogo do Ferreiro (armas/armaduras e a enxada da aba) — chamado no `preload` do interior da forja. */
export function preloadVillageShop(scene: Phaser.Scene): void {
  // Ícones das armas/armaduras à venda e da aba (a Fazenda os carrega, mas esta cena não depende disso).
  for (const { definition } of VILLAGE_SHOP_GOODS) {
    scene.load.spritesheet(definition.textureKey, encodeURI(`/${definition.texturePath}`), { frameWidth: 16, frameHeight: 16 });
  }
  scene.load.spritesheet(HOE.textureKey, encodeURI(`/${HOE.texturePath}`), { frameWidth: 16, frameHeight: 16 });
}

/** O Ferreiro já entregou este item ao jogador? (espada: na Bolsa; armadura: idem) — o painel mostra "Já possui". */
export function ownsVillageShopItem(inventory: Inventory, itemId: string): boolean {
  const good = VILLAGE_SHOP_GOODS.find((candidate) => candidate.definition.id === itemId);
  if (!good) return false;
  return good.kind === 'weapon' ? inventory.hasTool(itemId) : inventory.hasArmor(itemId);
}

export type VillagePurchaseResult = 'bought' | 'owned' | 'full' | 'poor' | 'noMaterials' | 'unknown';

/**
 * Compra um item do Ferreiro: item único (não vende duas vezes), exige um slot livre na Bolsa (senão o item se perderia) e só
 * então debita as moedas e as barras e entrega. Devolve o resultado pra quem chama avisar/tocar o som — nada é cobrado em nenhum caso de recusa.
 */
export function purchaseVillageShopItem(inventory: Inventory, itemId: string): VillagePurchaseResult {
  const good = VILLAGE_SHOP_GOODS.find((candidate) => candidate.definition.id === itemId);
  if (!good) return 'unknown';
  if (ownsVillageShopItem(inventory, itemId)) return 'owned';
  if (!inventory.hasFreeSlot()) return 'full';
  if (good.materials.some(({ resourceId, amount }) => inventory.getResourceCount(resourceId) < amount)) return 'noMaterials';
  if (!inventory.spendCoins(good.price)) return 'poor';
  for (const { resourceId, amount } of good.materials) inventory.useResource(resourceId, amount);

  if (good.kind === 'weapon') inventory.unlockTool(itemId);
  else inventory.unlockArmor(itemId);
  return 'bought';
}
