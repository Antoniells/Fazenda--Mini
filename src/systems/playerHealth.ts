/**
 * A HUD mostra `HEART_COUNT` corações (cheio/meio/vazio) e a vida máxima é
 * escolhida pra que cada coração valha 10 HP e o meio-coração 5 HP — o dano
 * do Slime (5) tira exatamente meio coração, e comer uma colheita recupera
 * exatamente meio coração (`HALF_HEART_HP`). Mudar um destes números exige
 * pensar nos outros dois juntos (ver `ui/healthHud.ts`, que só deriva deles).
 */
export const HEART_COUNT = 5;
const MAX_HP = 50;
export const HP_PER_HEART = MAX_HP / HEART_COUNT;
export const HALF_HEART_HP = HP_PER_HEART / 2;
/**
 * Armadura equipada (`Inventory.getDefense`): a HUD mostra `ARMOR_ICON_COUNT`
 * ícones (cheio/meio/vazio, `ui/armorHud.ts`), cada um valendo
 * `DEFENSE_PER_ARMOR_ICON` pontos de defesa. Cada ponto tira
 * `DAMAGE_REDUCTION_PER_DEFENSE` do dano recebido (Armadura de Ferro, 6
 * pontos = -30%; Madeira, 2 pontos = -10%) — nunca menos de meio ponto de vida.
 */
export const ARMOR_ICON_COUNT = 5;
export const DEFENSE_PER_ARMOR_ICON = 2;
const DAMAGE_REDUCTION_PER_DEFENSE = 0.05;
const MAX_DAMAGE_REDUCTION = 0.75;

/** Dano depois da defesa, arredondado a meio ponto de vida (a HUD mostra no máximo meio coração de resolução). */
export function reduceDamage(amount: number, defense: number): number {
  const reduction = Math.min(MAX_DAMAGE_REDUCTION, Math.max(0, defense) * DAMAGE_REDUCTION_PER_DEFENSE);
  return Math.max(0.5, Math.round(amount * (1 - reduction) * 2) / 2);
}

/** Janela de invencibilidade (ms) após levar dano de contato — sem isso, ficar encostado num Slime descontaria vida a cada frame. */
const INVINCIBILITY_MS = 600;

/** Formato salvo pelo `SaveManager` (Fase 10 — Persistência) — só o HP: a janela de invencibilidade é um detalhe de combate em tempo real, não faz sentido persistir entre sessões. */
export interface PlayerHealthSaveData {
  hp: number;
}

/**
 * Vida do jogador (Fase 8 — Combate). Perde vida com o ataque dos Slimes
 * (`takeDamage`); recupera comendo uma colheita (`heal`, ver
 * `systems/eating.ts`) ou dormindo (`restoreFull`, ver `MainScene.sleep`).
 * Chegar a 0 dispara `systems/playerDeath.ts`. Guardada em `gameState`
 * (mesma razão do `Inventory`/`GameClock`: precisa sobreviver a trocas de
 * cena).
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

  isDead(): boolean {
    return this.hp <= 0;
  }

  /** Aplica dano de contato de inimigo (reduzido pela `defense` da armadura equipada, ver `reduceDamage`), respeitando a invencibilidade. Devolve `false` (nada aplicado) se ainda estiver na janela de invencibilidade ou se já estiver morto (a morte está sendo tratada — não deve acumular golpes). */
  takeDamage(amount: number, time: number, defense = 0): boolean {
    if (this.isDead()) return false;
    if (time < this.invincibleUntil) return false;
    this.hp = Math.max(0, this.hp - reduceDamage(amount, defense));
    this.invincibleUntil = time + INVINCIBILITY_MS;
    return true;
  }

  /** Recupera vida (nunca passa do máximo). */
  heal(amount: number): void {
    this.hp = Math.min(MAX_HP, this.hp + amount);
  }

  /** Vida cheia — dormir e acordar em casa depois de desmaiar. */
  restoreFull(): void {
    this.hp = MAX_HP;
    this.invincibleUntil = 0;
  }

  serialize(): PlayerHealthSaveData {
    return { hp: this.hp };
  }

  static deserialize(data: PlayerHealthSaveData): PlayerHealth {
    const health = new PlayerHealth();
    // `Math.min`: saves antigos guardavam a vida na escala de 100 HP (antes de serem 5 corações) — nunca passa do máximo atual.
    health.hp = Math.min(MAX_HP, Math.max(0, data.hp));
    return health;
  }
}
