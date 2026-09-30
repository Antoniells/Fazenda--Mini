import { AZURITE_BAR } from './resources';

/**
 * ENCANTAMENTOS (Fase 11 — a Mesa de Encantamentos do Mago, liberada quando ele ganha confiança no jogador): a Azurita forja magia
 * em ferramentas, armas e armaduras. Cada encantamento vale pra FAMÍLIA inteira (a Picareta encantada continua encantada ao trocar de
 * tier no Ferreiro). Só DADOS; a regra está em `systems/enchanting.ts`.
 *
 * A Picareta encantada é também a única coisa que quebra a barreira mágica do andar 50 das Cavernas (`data/caveLandmarks.ts`).
 */
export type EnchantTarget = 'pickaxe' | 'axe' | 'sword' | 'armor';

export interface EnchantDefinition {
  target: EnchantTarget;
  /** Nome do que é encantado ("Picareta"). */
  name: string;
  /** O efeito, pra mostrar ("+20% de força"). */
  effect: string;
  /** Multiplicador do atributo (força da ferramenta, dano da espada ou defesa da armadura). */
  multiplier: number;
  /** Barras de Azurita e moedas. */
  bars: number;
  coins: number;
}

export const ENCHANT_BAR_ID = AZURITE_BAR.id;

export const ENCHANTS: Record<EnchantTarget, EnchantDefinition> = {
  pickaxe: { target: 'pickaxe', name: 'Picareta', effect: '+20% de força; quebra a barreira mágica', multiplier: 1.2, bars: 2, coins: 300 },
  axe: { target: 'axe', name: 'Machado', effect: '+20% de força', multiplier: 1.2, bars: 2, coins: 300 },
  sword: { target: 'sword', name: 'Espada', effect: '+35% de dano', multiplier: 1.35, bars: 3, coins: 500 },
  armor: { target: 'armor', name: 'Armadura', effect: '+15% de defesa', multiplier: 1.15, bars: 3, coins: 500 },
};

export const ENCHANT_TARGETS = Object.keys(ENCHANTS) as EnchantTarget[];
