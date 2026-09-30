import { gameState } from './gameState';
import { STORY_MILESTONES, STORY_PILLARS, StoryMilestoneId, StoryState, createStoryState } from '../data/story';

/**
 * GERENTE DA HISTÓRIA ("Os Três Pilares do Equilíbrio", `data/story.ts`): um único lugar pra registrar e consultar os marcos da jornada
 * — "o jogador já achou o mapa?", "a barreira já caiu?". Cada sistema que cumpre um marco chama `reachMilestone`; quem precisa saber
 * consulta `hasMilestone`. Quem quiser reagir na hora escuta `onMilestoneReached`.
 */

type MilestoneListener = (id: StoryMilestoneId) => void;
const listeners = new Set<MilestoneListener>();

export function hasMilestone(id: StoryMilestoneId): boolean {
  return gameState.story.reached[id] !== undefined;
}

/**
 * O mundo está em paz: o Sábio Coelho despertou (marco `awakening`). Daí em diante não há mais hordas (`systems/horde.ts`) nem monstros
 * (os slimes da Floresta, `systems/slimeSpawner.ts`, e os andares da Caverna, `scenes/CaveFloorScene.ts`); as missões que dependiam das
 * hordas contam como cumpridas (`systems/campaign.ts`).
 */
export function isWorldAtPeace(): boolean {
  return hasMilestone('awakening');
}

/** Registra o marco (no dia de hoje). Repetir é seguro: devolve `true` só na primeira vez. */
export function reachMilestone(id: StoryMilestoneId): boolean {
  if (hasMilestone(id)) return false;
  gameState.story.reached[id] = gameState.gameClock.getDay();
  for (const listener of listeners) listener(id);
  return true;
}

/** Desfaz um marco (só o menu de hack usa, pra testar). */
export function clearMilestone(id: StoryMilestoneId): void {
  delete gameState.story.reached[id];
}

/** Avisa quando um marco é alcançado. Devolve a função que cancela. */
export function onMilestoneReached(listener: MilestoneListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Quantos dos três pilares já foram reunidos. */
export function countPillars(): number {
  return STORY_PILLARS.filter((pillar) => hasMilestone(pillar.milestone)).length;
}

/**
 * Uma linha pro marcador de OBJETIVO do HUD: os pilares reunidos e o próximo passo. `null` antes de a profecia ser lida (a história ainda
 * não começou pro jogador) e depois do fim.
 */
export function describeStoryObjective(): string | null {
  if (!hasMilestone('prophecy')) return null;
  const next = STORY_MILESTONES.find((milestone) => !hasMilestone(milestone.id));
  if (!next) return null;
  return `Os Três Pilares (${countPillars()}/3) — ${next.objective}`;
}

/** Estado vindo do save, só com marcos que existem (um save de uma versão futura/antiga não quebra nada). */
export function sanitizeStoryState(data: Partial<StoryState> | undefined): StoryState {
  const state = createStoryState();
  const known = new Set<string>(STORY_MILESTONES.map((milestone) => milestone.id));
  for (const [id, day] of Object.entries(data?.reached ?? {})) {
    if (known.has(id) && typeof day === 'number') state.reached[id as StoryMilestoneId] = day;
  }
  return state;
}
