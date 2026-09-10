/**
 * Estrutura mínima para guardar o resultado de colheitas. Não é o sistema
 * de inventário completo (isso pertence à Fase 5 — Economia); serve apenas
 * para a agricultura ter um destino simples e testável para o que é
 * colhido, sem ficar acoplada a um inventário maior que ainda não existe.
 */
export class Inventory {
  private readonly items = new Map<string, number>();

  add(itemId: string, amount: number): void {
    this.items.set(itemId, this.getCount(itemId) + amount);
  }

  getCount(itemId: string): number {
    return this.items.get(itemId) ?? 0;
  }
}
