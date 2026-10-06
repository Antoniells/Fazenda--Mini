/**
 * REGADORES por tier (Madeira > Cobre > Ferro > Ouro — a família `water` de `data/toolProgression.ts`, vendida pelo Ferreiro como o
 * Machado e a Picareta, `data/toolShop.ts`). Cada tier leva mais água e os dois últimos regam mais de uma terra por vez: a lavoura
 * grande deixa de ser uma manhã inteira de cliques (o playtest mediu 4h43 de jogo pra regar 66 pés com o de Madeira).
 *
 * Cada terra regada gasta 1 carga — a área só economiza cliques e caminhada, não água. Só DADOS e funções puras: quem rega é
 * `systems/farmlandInteraction.ts`, quem guarda as cargas é `Inventory`.
 */

/** `single`: só a terra clicada. `row`: ela e as duas dos lados (3 em linha). `square`: o bloco 3x3 em volta dela. */
export type WateringReach = 'single' | 'row' | 'square';

export interface WateringCanTier {
  capacity: number;
  reach: WateringReach;
}

/** Índice = tier (0 = Madeira … 3 = Ouro). */
export const WATERING_CAN_TIERS: readonly WateringCanTier[] = [
  { capacity: 10, reach: 'single' },
  { capacity: 25, reach: 'single' },
  { capacity: 40, reach: 'row' },
  { capacity: 70, reach: 'square' },
];

/** Cargas do regador deste tier (sem regador nenhum, o de Madeira). */
export function wateringCanCapacity(tier: number): number {
  return (WATERING_CAN_TIERS[tier] ?? WATERING_CAN_TIERS[0]).capacity;
}

/** As terras que um clique em (`col`, `row`) rega, a clicada primeiro (é ela que recebe a água se as cargas acabarem no meio). */
export function wateringCells(tier: number, col: number, row: number): Array<[number, number]> {
  const reach = (WATERING_CAN_TIERS[tier] ?? WATERING_CAN_TIERS[0]).reach;
  const cells: Array<[number, number]> = [[col, row]];
  if (reach === 'row') cells.push([col - 1, row], [col + 1, row]);
  if (reach === 'square') {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (dc !== 0 || dr !== 0) cells.push([col + dc, row + dr]);
  }
  return cells;
}

/** O que a loja diz do regador deste tier ("Leva 40 cargas e rega 3 terras em linha."). */
export function describeWateringCan(tier: number): string {
  const { capacity, reach } = WATERING_CAN_TIERS[tier] ?? WATERING_CAN_TIERS[0];
  const area = reach === 'row' ? ' e rega 3 terras em linha (a clicada e as dos lados)' : reach === 'square' ? ' e rega 9 terras de uma vez (3x3)' : '';
  return `Leva ${capacity} cargas de água${area}.`;
}
