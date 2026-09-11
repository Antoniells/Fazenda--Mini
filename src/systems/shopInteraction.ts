import { Interactable, InteractionRegistry } from './interaction';
import { Player } from '../entities/Player';
import { ShopMenu } from '../ui/shopMenu';

/**
 * A Loja: ao interagir, alterna (abre/fecha) o painel de compra de
 * sementes (`ShopMenu`). Não decide preços nem processa a compra em si —
 * isso é responsabilidade de `Inventory` e de cada slot do `ShopMenu` (via
 * o callback `onBuy` passado na criação dele). Mesmo padrão do
 * `PlotInteractable`/`ShippingBinInteractable`: um objeto sólido com
 * interação adjacente (ver `PlayerController`).
 */
export class ShopInteractable implements Interactable {
  constructor(
    private readonly player: Player,
    private readonly shopMenu: ShopMenu,
  ) {}

  interact(): void {
    if (this.player.isBusy()) return;
    this.shopMenu.toggle();
  }
}

/** Registra o `ShopInteractable` na célula onde a banca está posicionada. */
export function registerShopInteractable(
  shopMenu: ShopMenu,
  col: number,
  row: number,
  player: Player,
  registry: InteractionRegistry,
): void {
  registry.set(col, row, new ShopInteractable(player, shopMenu));
}
