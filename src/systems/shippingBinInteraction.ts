import Phaser from 'phaser';
import { CROPS } from '../data/crops';
import { Inventory } from './inventory';
import { InteractionRegistry, Interactable } from './interaction';
import { Player } from '../entities/Player';

/**
 * A Caixa de Remessas: ao interagir, vende de uma vez todas as colheitas do
 * jogador (qualquer item cujo id apareça em `CROPS`), soma o valor pelo
 * `sellPrice` de cada cultura, credita em `Inventory.addCoins` e remove o
 * que foi vendido. Segue o mesmo padrão do `PlotInteractable`: decide tudo
 * a partir do próprio estado (aqui, o conteúdo do inventário), sem que
 * quem chama `interact()` saiba que é uma venda.
 *
 * É um objeto sólido (célula bloqueada em `systems/grid.ts`) — quem decide
 * levar o jogador até uma célula adjacente e disparar `interact()` de lá é
 * o `PlayerController`, não esta classe. Daqui, a interação é idêntica
 * estando o jogador do lado que estiver.
 *
 * Ainda não vende sementes nem tem loja de compra — só o lado de venda do
 * ciclo (plantar → colher → vender), que é o escopo deste passo da Fase 5.
 */
export class ShippingBinInteractable implements Interactable {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly inventory: Inventory,
    private readonly player: Player,
    private readonly anchorX: number,
    private readonly anchorY: number,
  ) {}

  interact(): void {
    if (this.player.isBusy()) return;

    let totalCoins = 0;
    let totalItems = 0;

    for (const crop of Object.values(CROPS)) {
      const amount = this.inventory.takeAll(crop.id);
      if (amount <= 0) continue;
      totalCoins += amount * crop.sellPrice;
      totalItems += amount;
    }

    if (totalItems <= 0) {
      console.log('Nada para vender.');
      return;
    }

    this.inventory.addCoins(totalCoins);
    console.log(
      `Vendido: ${totalItems} ite${totalItems === 1 ? 'm' : 'ns'} por ${totalCoins} moedas (saldo: ${this.inventory.getCoins()}).`,
    );
    this.showFloatingGain(totalCoins);
  }

  /** Texto flutuante temporário (sobe e desaparece) só para dar feedback visual imediato da venda — não guarda estado nem afeta nada além de si mesmo. */
  private showFloatingGain(amount: number): void {
    const text = this.scene.add.text(this.anchorX, this.anchorY, `+${amount}`, {
      fontFamily: 'monospace',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#ffe27a',
      stroke: '#2b1d0e',
      strokeThickness: 4,
    });
    text.setOrigin(0.5, 1);
    text.setDepth(2000);

    this.scene.tweens.add({
      targets: text,
      y: this.anchorY - 28,
      alpha: 0,
      duration: 900,
      ease: 'Cubic.easeOut',
      onComplete: () => text.destroy(),
    });
  }
}

/** Registra o `ShippingBinInteractable` na célula onde a caixa está posicionada. */
export function registerShippingBinInteractable(
  scene: Phaser.Scene,
  bin: Phaser.GameObjects.Image,
  col: number,
  row: number,
  inventory: Inventory,
  player: Player,
  registry: InteractionRegistry,
): void {
  registry.set(col, row, new ShippingBinInteractable(scene, inventory, player, bin.x, bin.y));
}
