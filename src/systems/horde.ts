import { gameState } from './gameState';
import { HORDE_START_HOUR, HORDE_DAWN_HOUR, isHordeDay, hordeNumberForDay, hordeSize, hordeReward, HordeState } from '../data/horde';
import { RESOURCES } from '../data/resources';
import { FINAL_HORDE_NUMBER } from '../data/campaign';
import { debugFlags } from '../debug/debugFlags';
import { isWorldAtPeace } from './story';

/** É noite de horda hoje? As de 10 em 10 dias OU a Noite Final que o jogador marcou (`campaign.finalNightDay`). */
export function isHordeToday(day: number): boolean {
  if (isWorldAtPeace()) return false; // Depois do fim da história, as hordas acabaram.
  return isHordeDay(day) || gameState.campaign.finalNightDay === day || debugFlags.forcedHordeDay === day;
}

/** Número da horda do dia: a Noite Final é sempre a `FINAL_HORDE_NUMBER` (a mais forte); as demais seguem o calendário. */
function hordeNumberOfDay(day: number): number {
  return gameState.campaign.finalNightDay === day ? FINAL_HORDE_NUMBER : Math.max(1, hordeNumberForDay(day)); // (a forçada pelo menu de hack antes do dia 10 é a 1)
}

/** A horda em andamento é a Noite Final? (marcada pra este dia e a noite já começou) */
export function isFinalNightActive(): boolean {
  return gameState.horde.active && gameState.campaign.finalNightDay === gameState.horde.lastHordeDay;
}

/** Passou da hora de a horda começar (a partir das 19:00) hoje, e ela ainda não rolou? */
export function shouldStartHorde(): boolean {
  const { horde, gameClock } = gameState;
  if (horde.active) return false;
  const day = gameClock.getDay();
  return isHordeToday(day) && horde.lastHordeDay !== day && gameClock.getHours() >= HORDE_START_HOUR;
}

/** Amanheceu? (06:00–19:00) — fim da noite da horda. */
export function isDawn(): boolean {
  const hours = gameState.gameClock.getHours();
  return hours >= HORDE_DAWN_HOUR && hours < HORDE_START_HOUR;
}

export function startHorde(): HordeState {
  const day = gameState.gameClock.getDay();
  const number = hordeNumberOfDay(day);
  gameState.horde = { active: true, number, total: hordeSize(number), killed: 0, drops: {}, lastHordeDay: day };
  return gameState.horde;
}

/** Um inimigo da horda morreu: conta a morte e guarda o drop no pool (entregue no fim). */
export function registerHordeKill(resourceId: string, amount: number): void {
  const { horde } = gameState;
  horde.killed += 1;
  horde.drops[resourceId] = (horde.drops[resourceId] ?? 0) + amount;
}

export interface HordeSummary {
  /** Linhas prontas pra mostrar ("12 Madeira"), na ordem: drops dos inimigos e depois o bônus. */
  lines: string[];
  /** Era a Noite Final e o jogador a venceu: a campanha se completou (a cena mostra o epílogo). */
  finalNightWon?: boolean;
}

function describe(resourceId: string, amount: number): string {
  return `${amount} ${RESOURCES[resourceId]?.name ?? resourceId}`;
}

/** Entrega o pool de drops ao Inventário e zera. Devolve o que foi entregue. */
function deliverDrops(): Array<{ id: string; amount: number }> {
  const delivered: Array<{ id: string; amount: number }> = [];
  for (const [id, amount] of Object.entries(gameState.horde.drops)) {
    if (amount <= 0) continue;
    gameState.inventory.addResources(id, amount);
    delivered.push({ id, amount });
  }
  gameState.horde.drops = {};
  return delivered;
}

/** Sobreviveu à noite: drops dos inimigos + BÔNUS (moedas, madeira, pedra e minério de ferro). Encerra o evento. */
export function finishHordeVictory(): HordeSummary {
  const number = gameState.horde.number;
  const wasFinalNight = isFinalNightActive();
  const reward = hordeReward(number);
  const delivered = deliverDrops();

  gameState.inventory.addCoins(reward.coins);
  gameState.inventory.addResources('wood', reward.wood);
  gameState.inventory.addResources('stone', reward.stone);
  gameState.inventory.addResources('iron-ore', reward.ironOre); // Minério BRUTO: a barra sai da Fornalha.
  gameState.horde.active = false;
  gameState.campaign.hordesWon += 1;

  return {
    finalNightWon: wasFinalNight,
    lines: [
      ...delivered.map(({ id, amount }) => describe(id, amount)),
      `${reward.coins} moedas`,
      describe('wood', reward.wood),
      describe('stone', reward.stone),
      describe('iron-ore', reward.ironOre),
    ],
  };
}

/** O jogador morreu: encerra o evento SEM bônus, entregando só os drops dos inimigos que ele já abateu. (Quem chama avança o dia.) */
export function finishHordeDefeat(): HordeSummary {
  const delivered = deliverDrops();
  // A Noite Final perdida (desmaio, ou o dia amanheceu com o jogador longe) não vale: o jogador tem que marcá-la de novo com o Alberto.
  if (isFinalNightActive()) gameState.campaign.finalNightDay = null;
  gameState.horde.active = false;
  return { lines: delivered.map(({ id, amount }) => describe(id, amount)) };
}

/**
 * Por que NÃO dá pra dormir agora (`null` = pode): dormir pularia a horda. Bloqueia durante a horda e, no dia dela, até
 * ela acontecer (senão bastava tirar um cochilo às 10h pra passar o dia 10 sem a noite de ataque).
 */
export function getSleepBlockReason(): string | null {
  const { horde, gameClock } = gameState;
  if (horde.active) return 'Uma horda está atacando a fazenda! Só dá pra dormir depois dela.';
  const day = gameClock.getDay();
  if (isHordeToday(day) && horde.lastHordeDay !== day && gameClock.getHours() >= HORDE_DAWN_HOUR) {
    return 'Hoje à noite vem uma horda! Só dá pra dormir depois dela.';
  }
  return null;
}
