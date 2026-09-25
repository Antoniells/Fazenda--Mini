import Phaser from 'phaser';
import { Inventory } from './inventory';
import { InteractionRegistry, Interactable } from './interaction';
import { Player } from '../entities/Player';
import { ShippingBinMenu } from '../ui/shippingBinMenu';

/**
 * A Caixa de Remessas: ao interagir, abre o menu de venda (`ShippingBinMenu`,
 * estilo Stardew Valley) — o jogador escolhe na Bolsa o que colocar na caixa
 * e só o botão "Vender" fecha a conta. Esta classe só abre/fecha o menu (o
 * mesmo padrão do `ShopInteractable`); quem calcula o valor e mexe no
 * `Inventory` é o próprio menu, que avisa o resultado por `onSold`.
 *
 * É um objeto sólido (célula bloqueada em `systems/grid.ts`) — quem decide
 * levar o jogador até uma célula adjacente e disparar `interact()` de lá é
 * o `PlayerController`, não esta classe.
 *
 * Ao vender, dá um pulo elástico na própria caixa (`popBin`) além do texto
 * flutuante de moedas ganhas — feedback visual (Fase 9 antecipada), não
 * afeta o resultado da venda, que já foi decidido antes.
 */
export class ShippingBinInteractable implements Interactable {
  /** Responde à tecla F (`PlayerController.handleInteractKey`), além do clique — pedido explícito do usuário. */
  readonly keyInteractable = true;

  private readonly binBaseScaleX: number;
  private readonly binBaseScaleY: number;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly bin: Phaser.GameObjects.Image,
    private readonly player: Player,
    private readonly menu: ShippingBinMenu,
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
    this.menu.toggle();
  }

  /** Feedback da venda (chamado pelo menu via `onSold`): moedas flutuando + pulo da caixa. */
  celebrateSale(totalCoins: number): void {
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

/** Registra o `ShippingBinInteractable` na célula da caixa e devolve o menu (a cena fecha com ESC e trava o movimento enquanto aberto). */
export function registerShippingBinInteractable(
  scene: Phaser.Scene,
  bin: Phaser.GameObjects.Image,
  col: number,
  row: number,
  inventory: Inventory,
  player: Player,
  registry: InteractionRegistry,
): ShippingBinMenu {
  let interactable: ShippingBinInteractable | null = null;
  const menu = new ShippingBinMenu(scene, inventory, (totalCoins) => {
    interactable?.celebrateSale(totalCoins);
  });
  interactable = new ShippingBinInteractable(scene, bin, player, menu);
  registry.set(col, row, interactable);
  return menu;
}
