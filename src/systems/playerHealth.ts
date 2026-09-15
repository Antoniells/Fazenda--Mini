const MAX_HP = 100;
/** Janela de invencibilidade (ms) após levar dano de contato — sem isso, ficar encostado num Slime descontaria vida a cada frame. */
const INVINCIBILITY_MS = 600;

/**
 * Vida do jogador (Fase 8 — Combate, consequência mínima e necessária de
 * "dano ao encostar no player" pedido pelo usuário — sem alguma vida pra
 * descontar, o dano de contato não teria efeito nenhum). Deliberadamente
 * simples: sem barra de vida na UI nem "game over" ainda (não pedido
 * explicitamente) — só um contador com feedback por `console.log`, pronto
 * pra uma UI de verdade ser construída em cima depois, se/quando pedido.
 * Guardada em `gameState` (mesma razão do `Inventory`/`GameClock`: precisa
 * sobreviver a trocas de cena).
 */
export class PlayerHealth {
  private hp = MAX_HP;
  private invincibleUntil = 0;

  getHp(): number {
    return this.hp;
  }

  getMaxHp(): number {
    return MAX_HP;
  }

  /** Aplica dano de contato de inimigo, respeitando a invencibilidade. Devolve `false` (nada aplicado) se ainda estiver na janela de invencibilidade. */
  takeDamage(amount: number, time: number): boolean {
    if (time < this.invincibleUntil) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.invincibleUntil = time + INVINCIBILITY_MS;
    return true;
  }
}
