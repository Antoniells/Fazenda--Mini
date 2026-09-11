import { CROPS, DEFAULT_CROP_ID } from '../data/crops';

/**
 * Estrutura mínima para guardar o resultado de colheitas e qual semente o
 * jogador tem selecionada para plantar. Não é o sistema de inventário
 * completo (isso pertence à Fase 5 — Economia); serve apenas para a
 * agricultura ter um destino simples e testável para o que é colhido, sem
 * ficar acoplada a um inventário maior que ainda não existe.
 */
export class Inventory {
  private readonly items = new Map<string, number>();
  private selectedSeedId: string = DEFAULT_CROP_ID;

  add(itemId: string, amount: number): void {
    this.items.set(itemId, this.getCount(itemId) + amount);
  }

  getCount(itemId: string): number {
    return this.items.get(itemId) ?? 0;
  }

  /** Semente atualmente ativa — usada por `PlotInteractable` ao plantar. */
  getSelectedSeedId(): string {
    return this.selectedSeedId;
  }

  /** Troca a semente ativa. Ignora ids que não correspondem a uma cultura conhecida. */
  selectSeed(cropId: string): boolean {
    if (!CROPS[cropId]) return false;
    this.selectedSeedId = cropId;
    return true;
  }
}
