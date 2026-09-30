import { gameState } from './gameState';
import { DAY_LENGTH_MS } from './gameClock';
import { SMELT_MINUTES, SmeltJob, getSmeltingRecipe } from '../data/smelting';

/**
 * A FILA da Fornalha (`data/smelting.ts`): escolher uma barra na tela dela gasta os materiais AGORA e entra na fila; cada barra leva `SMELT_MINUTES` de relógio do jogo, uma depois da outra.
 * O tempo é o do relógio do jogo (dias * 1440 + minutos do dia), então a fila anda em qualquer cena e dormir adianta tudo — nada precisa "rodar". A barra pronta espera na Fornalha
 * até o jogador abrir a tela dela, quando `collectFinished` a entrega. Vai pro save (`gameState.smelting`).
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

/** Tira da fila (e devolve) as barras que já ficaram prontas. */
export function collectFinished(): SmeltJob[] {
  const now = nowMinutes();
  const finished = gameState.smelting.jobs.filter((job) => job.doneAtMinute <= now);
  if (finished.length > 0) gameState.smelting.jobs = gameState.smelting.jobs.filter((job) => job.doneAtMinute > now);
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
