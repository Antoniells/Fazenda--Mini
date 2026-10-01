import Phaser from 'phaser';
import { gameState } from './gameState';
import { spawnLoot } from './lootDrops';
import { rollDoubleDrop } from './skills';
import { popText } from './floatingText';
import { Player } from '../entities/Player';
import {
  CHICKEN_COOP_ID,
  CHICKEN_PRICE,
  CHICKEN_VARIANTS,
  COOP_CAPACITY,
  COOP_MAX_EGGS,
  CHICKEN_FEED_ID,
  EGGS_PER_CHICKEN_PER_DAY,
  EGG_TIERS,
  FEEDER_CAPACITY,
  MAX_AFFECTION,
  eggTierForCare,
  type ChickenRecord,
  type CoopState,
} from '../data/animals';
import { CHICKEN_COOP } from '../data/decorations';

/**
 * Animais da fazenda (`data/animals.ts`): quem mora em qual galinheiro, compra de galinhas e a produção diária de ovos. Só ESTADO
 * (`gameState.animals`, vai pro save) — o desenho das galinhas é do `systems/chickenFlock.ts`.
 */

export function coopKey(col: number, row: number): string {
  return `${col},${row}`;
}

export interface PlacedCoop {
  key: string;
  col: number;
  row: number;
}

/** Os galinheiros posicionados na Fazenda agora (lidos do registro persistente de construções). */
export function getPlacedCoops(): PlacedCoop[] {
  const coops: PlacedCoop[] = [];
  for (const record of gameState.placedDecorations.values()) {
    if (record.decorationId === CHICKEN_COOP_ID) coops.push({ key: coopKey(record.col, record.row), col: record.col, row: record.row });
  }
  return coops;
}

/** Uma galinha nova: a cor é sorteada AGORA e fica pra sempre (antes ela mudava a cada vez que a Fazenda era recriada, ex.: ao dormir). */
function newBird(): ChickenRecord {
  return { variant: Math.floor(Math.random() * CHICKEN_VARIANTS.length), affection: 0, pettedDay: 0 };
}

/**
 * Estado (galinhas/ovos) de um galinheiro — criado vazio na primeira consulta e sempre NORMALIZADO: `birds` tem um registro por galinha (saves antigos
 * só tinham a contagem: ganham cor e carinho zerado) e `eggTiers` reparte os ovos guardados por qualidade (os antigos viram ovos comuns).
 */
export function getCoopState(key: string): CoopState {
  const state = (gameState.animals.coops[key] ??= { chickens: 0, eggs: 0 });
  const birds = (state.birds ??= []);
  while (birds.length < state.chickens) birds.push(newBird());
  birds.length = state.chickens;
  const tiers = state.eggTiers;
  if (!tiers || tiers.length !== EGG_TIERS.length || tiers.reduce((sum, n) => sum + n, 0) !== state.eggs) {
    state.eggTiers = EGG_TIERS.map((_, index) => (index === 0 ? state.eggs : 0));
  }
  return state;
}

export function getTotalChickens(): number {
  return getPlacedCoops().reduce((sum, coop) => sum + getCoopState(coop.key).chickens, 0);
}

export type ChickenPurchaseResult = 'bought' | 'noCoop' | 'full' | 'poor';

/**
 * Compra uma galinha: exige um galinheiro com vaga (senão nada é cobrado) e moedas. Ela vai pro primeiro galinheiro com espaço; o
 * `ChickenFlock` a faz aparecer na Fazenda.
 */
export function buyChicken(): ChickenPurchaseResult {
  const coops = getPlacedCoops();
  if (coops.length === 0) return 'noCoop';
  const home = coops.find((coop) => getCoopState(coop.key).chickens < COOP_CAPACITY);
  if (!home) return 'full';
  if (!gameState.inventory.spendCoins(CHICKEN_PRICE)) return 'poor';

  getCoopState(home.key).chickens += 1;
  getCoopState(home.key); // Normaliza: a galinha nova ganha o registro (cor sorteada agora).
  return 'bought';
}

/**
 * Virada de dia (o relógio JÁ está no dia novo): cada galinha come 1 Capim do comedouro, se tiver, e põe seu ovo no galinheiro — de
 * qualidade conforme o carinho acumulado e o cuidado do dia que passou (`eggTierForCare`: carinho nesse dia + comida), até
 * `COOP_MAX_EGGS` guardados. Devolve o total posto.
 */
export function layEggs(): number {
  let laid = 0;
  const endedDay = gameState.gameClock.getDay() - 1;
  for (const coop of getPlacedCoops()) {
    const state = getCoopState(coop.key);
    for (const bird of state.birds ?? []) {
      const fed = (state.feed ?? 0) > 0;
      if (fed) state.feed! -= 1;
      const tier = eggTierForCare(bird.affection, fed, bird.pettedDay === endedDay);
      for (let n = 0; n < EGGS_PER_CHICKEN_PER_DAY; n++) {
        if (state.eggs >= COOP_MAX_EGGS) break;
        state.eggTiers![tier] += 1;
        state.eggs += 1;
        laid += 1;
      }
    }
  }
  return laid;
}

/** `petted` = +1 de carinho; `max` = carinho no máximo, mas o carinho de HOJE conta (ela fica feliz); `already` = já ganhou hoje. */
export type PetResult = 'petted' | 'already' | 'max';

/**
 * Dá carinho à galinha `index` do galinheiro `key` — UM por dia (`pettedDay`). Até `MAX_AFFECTION` cada carinho soma (e sobe a qualidade dos
 * ovos dela quando cruza um degrau de `EGG_TIERS`); no máximo, o carinho do dia continua valendo pra felicidade (`eggTierForCare`).
 */
export function petChicken(key: string, index: number): { result: PetResult; affection: number } {
  const bird = getCoopState(key).birds?.[index];
  if (!bird) return { result: 'already', affection: 0 };
  const today = gameState.gameClock.getDay();
  if (bird.pettedDay === today) return { result: 'already', affection: bird.affection };
  bird.pettedDay = today;
  if (bird.affection >= MAX_AFFECTION) return { result: 'max', affection: bird.affection };
  bird.affection += 1;
  return { result: 'petted', affection: bird.affection };
}

/** Enche o comedouro do galinheiro `key` com o Capim da Bolsa (até `FEEDER_CAPACITY`). Devolve quanto entrou e quanto ficou lá. */
export function fillFeeder(key: string): { added: number; feed: number } {
  const state = getCoopState(key);
  const feed = state.feed ?? 0;
  const added = Math.min(FEEDER_CAPACITY - feed, gameState.inventory.getResourceCount(CHICKEN_FEED_ID));
  if (added > 0) {
    gameState.inventory.useResource(CHICKEN_FEED_ID, added);
    state.feed = feed + added;
  }
  return { added: Math.max(0, added), feed: state.feed ?? 0 };
}
/** O galinheiro pode ser quebrado/recolhido? Só sem galinhas (não há como "devolvê-las"). */
export function canRemoveCoop(key: string): boolean {
  return getCoopState(key).chickens === 0;
}

/** O galinheiro saiu do mundo: esquece o estado dele (só chega aqui vazio de galinhas). */
export function discardCoop(key: string): void {
  delete gameState.animals.coops[key];
}

/**
 * O jogador clicou no galinheiro: o comedouro é enchido com o Capim da Bolsa (`fillFeeder`), os ovos guardados caem no chão à frente da
 * porta (mesmo loot das colheitas — o jogador os pega ao chegar perto) e o drop duplo da habilidade Mãos de Ouro pode dobrá-los. Sem ovos,
 * só avisa.
 */
export function collectCoopEggs(scene: Phaser.Scene, player: Player, col: number, row: number, tilePx: number): void {
  const key = coopKey(col, row);
  const state = getCoopState(key);
  const x = (col + CHICKEN_COOP.footprint.width - 0.5) * tilePx;
  const y = (row + CHICKEN_COOP.footprint.height) * tilePx + tilePx * 0.4;

  if (state.chickens > 0) {
    const { added, feed } = fillFeeder(key);
    const text = added > 0 ? `Comedouro: +${added} Capim (${feed}/${FEEDER_CAPACITY})` : feed > 0 ? `Comedouro: ${feed} Capim` : 'Comedouro vazio: traga Capim (Foice no mato)';
    popText(scene, x, y - 52, text, { color: feed > 0 ? '#b8f5a0' : '#ffb07a', fontSize: 12 });
  }

  if (state.eggs <= 0) {
    popText(scene, x, y - 30, state.chickens > 0 ? 'Sem ovos por enquanto' : 'Compre galinhas na Loja', { color: '#fff2a8', fontSize: 13 });
    return;
  }

  // Um sorteio de drop duplo pro lote todo (vale pra cada qualidade); cada qualidade cai como o recurso dela.
  const total = state.eggs;
  const multiplier = rollDoubleDrop(scene, total, x, y - 40) / total;
  state.eggTiers!.forEach((count, tier) => {
    if (count > 0) spawnLoot(scene, player, x, y, { category: 'resource', id: EGG_TIERS[tier].resourceId, amount: count * multiplier });
  });
  console.log(`Galinheiro: ${total * multiplier} ovo(s) caíram no chão.`);
  state.eggs = 0;
  state.eggTiers = EGG_TIERS.map(() => 0);
}
