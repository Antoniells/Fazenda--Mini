import { gameState } from './gameState';
import { DAY_LENGTH_MS } from './gameClock';
import { SMELT_MINUTES, SmeltJob, getSmeltingRecipe, recipeForOre, smeltingInputs } from '../data/smelting';
import type { Inventory } from './inventory';

/**
 * A FORNALHA (`data/smelting.ts`): clicar numa Fornalha com o minério bruto na mão (`startSmeltAt`) gasta os materiais AGORA e ela assa por `SMELT_MINUTES` de
 * relógio do jogo — uma leva por Fornalha (`SmeltJob.furnace`); outra Fornalha assa outra leva ao mesmo tempo.
 * O tempo é o do relógio do jogo (dias * 1440 + minutos do dia), então a leva anda em qualquer cena e dormir adianta tudo — nada precisa "rodar". A barra pronta FICA
 * na Fornalha (o ícone dela flutua em cima) até o jogador ir lá e clicar (`startSmeltAt` a entrega antes de qualquer outra coisa). Só as fundições sem Fornalha (saves
 * antigos, ou de uma Fornalha que o Marceneiro tirou do lugar — `releaseFurnace`) vão sozinhas pra Bolsa (`collectFinished`, chamada pela `UIScene` a cada frame).
 * Vai pro save (`gameState.smelting`).
 */

/** Minutos de relógio do jogo desde o dia 1, 00:00. */
export function nowMinutes(): number {
  return (gameState.gameClock.getDay() - 1) * 1440 + gameState.gameClock.getHours() * 60;
}

/** Milissegundos REAIS que faltam pra `minutes` de relógio do jogo passarem (a 1x). */
export function minutesToRealMs(minutes: number): number {
  return (Math.max(0, minutes) / 1440) * DAY_LENGTH_MS;
}

/** Põe uma barra na fila (depois das que já estão lá); devolve a fundição criada. */
export function queueSmelt(recipeId: string): SmeltJob | null {
  if (!getSmeltingRecipe(recipeId)) return null;
  const jobs = gameState.smelting.jobs;
  const start = Math.max(nowMinutes(), ...jobs.map((job) => job.doneAtMinute));
  const job: SmeltJob = { recipeId, doneAtMinute: start + SMELT_MINUTES };
  jobs.push(job);
  return job;
}

/** Tira da fila (e devolve) as barras SEM Fornalha que já ficaram prontas — elas vão direto pra Bolsa. As de uma Fornalha esperam ser buscadas lá. */
export function collectFinished(): SmeltJob[] {
  const now = nowMinutes();
  const isDone = (job: SmeltJob): boolean => job.furnace === undefined && job.doneAtMinute <= now;
  const finished = gameState.smelting.jobs.filter(isDone);
  if (finished.length > 0) gameState.smelting.jobs = gameState.smelting.jobs.filter((job) => !isDone(job));
  return finished;
}

/** Quantas barras desta receita ainda estão na fila, e quantos minutos de jogo faltam pra próxima ficar pronta (0 se nenhuma). */
export function queueStatus(recipeId: string): { count: number; nextInMinutes: number } {
  const now = nowMinutes();
  const mine = gameState.smelting.jobs.filter((job) => job.recipeId === recipeId && job.doneAtMinute > now);
  return { count: mine.length, nextInMinutes: mine.length > 0 ? Math.min(...mine.map((job) => job.doneAtMinute)) - now : 0 };
}

/** Quanto falta (ms reais) pra fila inteira terminar — quanto tempo o fogo da Fornalha fica aceso. 0 se não há nada na fila. */
export function remainingQueueMs(): number {
  const end = Math.max(0, ...gameState.smelting.jobs.map((job) => job.doneAtMinute));
  return end > nowMinutes() ? minutesToRealMs(end - nowMinutes()) : 0;
}

/** A chave de uma Fornalha posicionada (a célula dela). */
export function furnaceKey(col: number, row: number): string {
  return `${col},${row}`;
}

/** A leva que esta Fornalha ainda está assando, ou `undefined` se ela não está assando. */
export function activeSmeltAt(furnace: string): SmeltJob | undefined {
  const now = nowMinutes();
  return gameState.smelting.jobs.find((job) => job.furnace === furnace && job.doneAtMinute > now);
}

/** A barra (id do recurso) pronta esperando na Fornalha `furnace`, ou `null` — o que flutua em cima dela. */
export function readyBarAt(furnace: string): string | null {
  const now = nowMinutes();
  const job = gameState.smelting.jobs.find((candidate) => candidate.furnace === furnace && candidate.doneAtMinute <= now);
  return job ? (getSmeltingRecipe(job.recipeId)?.barId ?? null) : null;
}

/** A Fornalha saiu do lugar (o Marceneiro a moveu/destruiu): o que ela assava não se perde — vira fundição sem Fornalha e vai sozinho pra Bolsa ao ficar pronto. */
export function releaseFurnace(furnace: string): void {
  for (const job of gameState.smelting.jobs) if (job.furnace === furnace) delete job.furnace;
}

/** Quanto falta (ms reais) pra esta Fornalha terminar — quanto tempo o fogo dela fica aceso. 0 se ela está livre. */
export function remainingSmeltMsAt(furnace: string): number {
  const job = activeSmeltAt(furnace);
  return job ? minutesToRealMs(job.doneAtMinute - nowMinutes()) : 0;
}

export type SmeltStartResult =
  | { kind: 'collected'; barId: string }
  | { kind: 'started'; recipeId: string; barId: string }
  | { kind: 'busy'; barId: string; minutesLeft: number }
  | { kind: 'notOre' }
  | { kind: 'missing'; oreId: string; oreAmount: number; fuelId: string; fuelAmount: number };

/**
 * Clicou na Fornalha `furnace` segurando `heldResourceId` (o recurso do slot selecionado, ou `null`): com uma barra pronta esperando, ela vai pra Bolsa (e só
 * isso); assando, nada muda; com um minério bruto e os materiais (`smeltingInputs`), eles são gastos e a leva começa a assar (`SMELT_MINUTES`). Nada é gasto numa recusa.
 */
export function startSmeltAt(furnace: string, heldResourceId: string | null, inventory: Pick<Inventory, 'getResourceCount' | 'useResource' | 'addResources'>): SmeltStartResult {
  const now = nowMinutes();
  const ready = gameState.smelting.jobs.find((job) => job.furnace === furnace && job.doneAtMinute <= now);
  if (ready) {
    gameState.smelting.jobs = gameState.smelting.jobs.filter((job) => job !== ready);
    const barId = getSmeltingRecipe(ready.recipeId)?.barId;
    if (barId) {
      inventory.addResources(barId, 1);
      return { kind: 'collected', barId };
    }
  }
  const active = activeSmeltAt(furnace);
  if (active) return { kind: 'busy', barId: getSmeltingRecipe(active.recipeId)?.barId ?? '', minutesLeft: active.doneAtMinute - nowMinutes() };
  const recipe = heldResourceId ? recipeForOre(heldResourceId) : undefined;
  if (!recipe) return { kind: 'notOre' };
  const inputs = smeltingInputs(recipe);
  if (inventory.getResourceCount(inputs.oreId) < inputs.oreAmount || inventory.getResourceCount(inputs.fuelId) < inputs.fuelAmount) return { kind: 'missing', ...inputs };
  inventory.useResource(inputs.oreId, inputs.oreAmount);
  inventory.useResource(inputs.fuelId, inputs.fuelAmount);
  gameState.smelting.jobs.push({ recipeId: recipe.id, doneAtMinute: nowMinutes() + SMELT_MINUTES, furnace });
  return { kind: 'started', recipeId: recipe.id, barId: recipe.barId };
}
