/**
 * Camada de interação genérica: qualquer elemento do mundo (terreno,
 * plantação, árvore, animal, construção, NPC...) pode se registrar aqui por
 * célula do grid. Quem lida com clique/movimento (`playerController`) só
 * precisa perguntar "existe algo interativo nesta célula?" — sem conhecer
 * detalhes de agricultura, árvores ou qualquer outro sistema específico.
 */
export interface Interactable {
  interact(): void;
}

export class InteractionRegistry {
  private readonly entries = new Map<string, Interactable>();

  private key(col: number, row: number): string {
    return `${col},${row}`;
  }

  set(col: number, row: number, interactable: Interactable): void {
    this.entries.set(this.key(col, row), interactable);
  }

  get(col: number, row: number): Interactable | undefined {
    return this.entries.get(this.key(col, row));
  }
}
