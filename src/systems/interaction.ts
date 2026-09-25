/**
 * Camada de interação genérica: qualquer elemento do mundo (terreno,
 * plantação, árvore, animal, construção, NPC...) pode se registrar aqui por
 * célula do grid. Quem lida com clique/movimento (`playerController`) só
 * precisa perguntar "existe algo interativo nesta célula?" — sem conhecer
 * detalhes de agricultura, árvores ou qualquer outro sistema específico.
 */
export interface Interactable {
  interact(): void;
  /**
   * Esta interação também responde à tecla de interação (F — `PlayerController.handleInteractKey`), testando a célula que o
   * personagem está ENCARANDO (não a célula dele, já que são sempre objetos sólidos ao lado) — pedido explícito do usuário, hoje
   * só a Loja, a Caixa de Remessas e a porta de casa (`ShopInteractable`/`ShippingBinInteractable`/`EnterHouseInteractable`).
   * Ausente/`false` = só clique, como antes.
   */
  keyInteractable?: boolean;
  /**
   * Célula ANDÁVEL que só deve ser usada "de fora": clicar nela leva o jogador até uma célula vizinha (como numa célula sólida)
   * e interage de lá, em vez de fazê-lo pisar em cima — ex.: a cerca destruída, que o Martelo conserta e volta a bloquear.
   */
  interactFromAdjacent?: boolean;
  /**
   * Célula ANDÁVEL de onde atender esta interação (célula sólida cuja vizinhança está toda fechada — ex.: o balcão da loja, encostado
   * na parede da casa): o clique leva o jogador até ela em vez de procurar a vizinha mais próxima. Ignorada se não for andável.
   */
  approachCell?: { col: number; row: number };
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

  /** Desregistra a interação de uma célula (ex.: uma decoração removida — Fase 6). */
  remove(col: number, row: number): void {
    this.entries.delete(this.key(col, row));
  }
}
