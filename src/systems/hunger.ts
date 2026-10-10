import {
  ACTION_SATIETY_COST,
  CROP_SATIETY,
  DEFAULT_FOOD_SATIETY,
  FOOD_SATIETY,
  HUNGRY_THRESHOLD,
  MAX_SATIETY,
  REGEN_INTERVAL_MS,
  REGEN_SATIETY_COST,
  REGEN_SATIETY_THRESHOLD,
  STARVE_INTERVAL_MS,
  TIRING_ACTIONS,
} from '../data/hunger';
import type { PlayerActionKey } from '../data/player';
import type { SlotRef } from '../data/items';

/**
 * A FOME do personagem (`data/hunger.ts`): a saciedade (0 a `MAX_SATIETY`) e o relógio da fome com a barra vazia. Sem Phaser — guardada em
 * `gameState.hunger` e no save; quem gasta é o `Player.performAction` (as ações que cansam), quem enche é o comer (`systems/eating.ts`) e
 * quem aplica o dano da fome e a vida que volta bem alimentado é o `PlayerController` (`tick`/`tickRegen`, só com o jogo rodando).
 */
export class Hunger {
  private satiety = MAX_SATIETY;
  /** Tempo (ms de jogo rodando) passado com a barra vazia desde o último dano de fome. */
  private starvingMs = 0;
  /** Tempo (ms de jogo rodando) passado bem alimentado e ferido desde a última recuperação de vida. */
  private regenMs = 0;

  getSatiety(): number {
    return this.satiety;
  }

  isFull(): boolean {
    return this.satiety >= MAX_SATIETY;
  }

  isStarving(): boolean {
    return this.satiety <= 0;
  }

  /** Está com fome (abaixo de `HUNGRY_THRESHOLD`)? */
  isHungry(): boolean {
    return this.satiety < HUNGRY_THRESHOLD;
  }

  /** A ação cansa? Gasta a saciedade dela. Devolve `true` se acabou de CRUZAR pra "com fome" (o aviso aparece uma vez). */
  spendFor(action: PlayerActionKey): boolean {
    if (!TIRING_ACTIONS.includes(action)) return false;
    const wasHungry = this.isHungry();
    this.satiety = Math.max(0, this.satiety - ACTION_SATIETY_COST);
    return !wasHungry && this.isHungry();
  }

  /** Comeu: enche (nunca passa do máximo) e zera o relógio da fome. */
  eat(amount: number): void {
    this.satiety = Math.min(MAX_SATIETY, this.satiety + amount);
    this.starvingMs = 0;
  }

  /** Garante pelo menos `minimum` (ao acordar depois de desmaiar). */
  restoreAtLeast(minimum: number): void {
    this.satiety = Math.max(this.satiety, Math.min(MAX_SATIETY, minimum));
    this.starvingMs = 0;
  }

  /** O jogo andou `deltaMs` (sem menu aberto): com a barra vazia, conta o tempo e devolve `true` quando é hora de mais um dano de fome. */
  tick(deltaMs: number): boolean {
    if (!this.isStarving()) {
      this.starvingMs = 0;
      return false;
    }
    this.starvingMs += deltaMs;
    if (this.starvingMs < STARVE_INTERVAL_MS) return false;
    this.starvingMs -= STARVE_INTERVAL_MS;
    return true;
  }

  /** Está bem alimentado a ponto de a vida voltar sozinha (acima de `REGEN_SATIETY_THRESHOLD`)? */
  canRegenerate(): boolean {
    return this.satiety > REGEN_SATIETY_THRESHOLD;
  }

  /**
   * O jogo andou `deltaMs` (sem menu aberto) com a vida abaixo do máximo (`hurt`): bem alimentado, conta o tempo e devolve `true` quando é
   * hora de recuperar vida — e já gasta a saciedade dessa recuperação. Sem ferimento ou sem comida bastante, o relógio zera.
   */
  tickRegen(deltaMs: number, hurt: boolean): boolean {
    if (!hurt || !this.canRegenerate()) {
      this.regenMs = 0;
      return false;
    }
    this.regenMs += deltaMs;
    if (this.regenMs < REGEN_INTERVAL_MS) return false;
    this.regenMs -= REGEN_INTERVAL_MS;
    this.satiety = Math.max(0, this.satiety - REGEN_SATIETY_COST);
    return true;
  }

  serialize(): number {
    return this.satiety;
  }

  static deserialize(satiety: number | undefined): Hunger {
    const hunger = new Hunger();
    if (typeof satiety === 'number' && Number.isFinite(satiety)) hunger.satiety = Math.max(0, Math.min(MAX_SATIETY, satiety));
    return hunger;
  }
}

/** Quanto esta comida enche. */
export function satietyOf(food: SlotRef): number {
  if (food.category === 'crop') return CROP_SATIETY;
  return FOOD_SATIETY[food.id] ?? DEFAULT_FOOD_SATIETY;
}
