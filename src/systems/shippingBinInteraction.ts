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
 * Ao vender, dá um pulo elástico na própria caixa (`popBin`) além do texto
 * flutuante de moedas ganhas — feedback visual (Fase 9 antecipada), não
 * afeta o resultado da venda, que já foi decidido antes.
 */
export class ShippingBinInteractable implements Interactable {
  private readonly binBaseScaleX: number;
  private readonly binBaseScaleY: number;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly bin: Phaser.GameObjects.Image,
    private readonly inventory: Inventory,
    private readonly player: Player,
  ) {
    this.binBaseScaleX = bin.scaleX;
    this.binBaseScaleY = bin.scaleY;
  }

  private get anchorX(): number {
    return this.bin.x;
  }

  private get anchorY(): number {
    return this.bin.y;
  }

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
    this.popBin();
  }

  /** Pulo elástico (achata e estica) na própria caixa — feedback de "recebeu a entrega" ao vender. */
  private popBin(): void {
    this.scene.tweens.killTweensOf(this.bin);
    this.bin.setScale(this.binBaseScaleX, this.binBaseScaleY);

    this.scene.tweens.add({
      targets: this.bin,
      scaleX: this.binBaseScaleX * 1.15,
      scaleY: this.binBaseScaleY * 0.85,
      duration: 110,
      yoyo: true,
      ease: 'Sine.easeInOut',
    });
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
  registry.set(col, row, new ShippingBinInteractable(scene, bin, inventory, player));
}
