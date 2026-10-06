import { gameState } from './gameState';
import { Inventory } from './inventory';
import { CROPS } from '../data/crops';
import { scheduleMail } from './mail';

/**
 * ENCOMENDA DE SEMENTES pela Caixa de Correio da Fazenda (o playtest mediu 41-53% do tempo andando, boa parte entre a lavoura e a loja
 * da Lia): clicar na caixa sem carta nova abre o catálogo de sementes dela, pelo MESMO preço da loja. A compra é paga na hora e fica
 * pendente (`gameState.seedOrders`, vai pro save); na virada do dia (`deliverSeedOrders`, chamada por `runDayTurn`) a Lia manda uma
 * carta com as sementes — elas vão pra Bolsa quando o jogador lê a carta (`MailMessage.seeds`, `markMailRead`). O preço é o mesmo; o
 * custo da comodidade é esperar até amanhã.
 */

/** Encomenda 1 semente de `cropId`: paga agora, chega amanhã. `false` (nada cobrado) se a cultura não existe ou faltam moedas. */
export function orderSeed(cropId: string, inventory: Inventory = gameState.inventory): boolean {
  const crop = CROPS[cropId];
  if (!crop || !inventory.spendCoins(crop.seedPrice)) return false;
  gameState.seedOrders[cropId] = (gameState.seedOrders[cropId] ?? 0) + 1;
  return true;
}

/** Quantas sementes estão encomendadas (pagas, ainda não entregues). */
export function pendingSeedOrders(): number {
  return Object.values(gameState.seedOrders).reduce((sum, amount) => sum + amount, 0);
}

/** "10 Sementes de Cenoura e 5 Sementes de Batata". */
function describeSeeds(seeds: Record<string, number>): string {
  const parts = Object.entries(seeds).map(([id, amount]) => `${amount} ${amount === 1 ? 'Semente' : 'Sementes'} de ${CROPS[id]?.name ?? id}`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}` : parts[0];
}

/**
 * Virada do dia: o que foi encomendado ontem chega numa carta da Lia (as sementes vêm junto, ao ler). Seguro chamar sempre — sem
 * encomenda pendente não faz nada. Devolve `true` se mandou carta.
 */
export function deliverSeedOrders(): boolean {
  const seeds = Object.fromEntries(Object.entries(gameState.seedOrders).filter(([, amount]) => amount > 0));
  if (Object.keys(seeds).length === 0) return false;
  const day = gameState.gameClock.getDay();
  scheduleMail({
    id: `seed-order-${day}-${gameState.mail.custom.length}`,
    title: 'Sua encomenda chegou!',
    body: `{nome},\n\nSua encomenda chegou fresquinha: ${describeSeeds(seeds)}. Deixei tudo aqui na caixa.\n\nBom plantio!\n\nLia, dos Insumos`,
    deliverOnDay: day,
    buttonLabel: 'Pegar as sementes',
    seeds,
  });
  gameState.seedOrders = {};
  return true;
}
