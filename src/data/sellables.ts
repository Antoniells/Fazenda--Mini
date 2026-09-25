import { CROPS, ALL_CROPS_ICONS_KEY } from './crops';
import { RESOURCES } from './resources';
import type { Inventory } from '../systems/inventory';

/**
 * O que a Caixa de Remessas aceita (`ui/shippingBinMenu.ts`): as colheitas
 * da lavoura (`CROPS`, `sellPrice`) e os materiais que têm preço de venda
 * (`RESOURCES`, `sellPrice` opcional — hoje madeira, pedra e gosma de Slime;
 * a bolota fica de fora, é semente de árvore). Uma lista única e uniforme
 * (`Sellable`), pra o menu não precisar saber de onde cada item vem: só
 * conta (`count`), tira (`take`) e mostra (ícone/nome/preço).
 */
export interface Sellable {
  /** Chave única `categoria:id` (uma colheita e um material nunca colidem, mesmo com o mesmo id). */
  key: string;
  name: string;
  price: number;
  textureKey: string;
  iconFrame: number | string;
  /** Quantas unidades o jogador tem na Bolsa agora. */
  count: (inventory: Inventory) => number;
  /** Tira até `amount` unidades da Bolsa e devolve quantas saíram de fato. */
  take: (inventory: Inventory, amount: number) => number;
}

export function getSellables(): Sellable[] {
  const crops: Sellable[] = Object.values(CROPS).map((crop) => ({
    key: `crop:${crop.id}`,
    name: crop.name,
    price: crop.sellPrice,
    textureKey: ALL_CROPS_ICONS_KEY,
    iconFrame: crop.cropFrameName,
    count: (inventory) => inventory.getCount(crop.id),
    take: (inventory, amount) => inventory.takeCrop(crop.id, amount),
  }));

  const resources: Sellable[] = Object.values(RESOURCES)
    .filter((resource) => (resource.sellPrice ?? 0) > 0)
    .map((resource) => ({
      key: `resource:${resource.id}`,
      name: resource.name,
      price: resource.sellPrice!,
      textureKey: resource.textureKey,
      iconFrame: resource.frameName,
      count: (inventory) => inventory.getResourceCount(resource.id),
      take: (inventory, amount) => inventory.takeResource(resource.id, amount),
    }));

  return [...crops, ...resources];
}
