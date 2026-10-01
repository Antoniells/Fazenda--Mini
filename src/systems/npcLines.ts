import { NPCS, NpcId, PortraitExpression } from '../data/npcs';
import { NPC_STORY_LINES, NpcLine, NpcStoryBlock } from '../data/npcStoryLines';
import { STORY_MILESTONES } from '../data/story';
import { gameState } from './gameState';

/**
 * O QUE O MORADOR DIZ NA CONVERSA SOLTA e com que cara. Com a história andando (`data/npcStoryLines.ts`), o bloco do marco mais
 * avançado já alcançado entra no sorteio: logo depois do marco (até `FRESH_DAYS` dias) a fala da história é garantida; depois divide
 * espaço com as falas de sempre (`NpcDefinition.chatter`). Sem Phaser: o painel só recebe o retrato já resolvido.
 */

/** Por quantos dias depois do marco o morador só fala dele (a novidade do Vilarejo). */
const FRESH_DAYS = 2;
/** Chance da fala da história, passada a novidade. */
const STORY_LINE_CHANCE = 0.5;

/** O bloco de falas da história que vale agora pro morador (o do marco mais avançado já alcançado), ou `null`. */
export function getStoryBlock(id: NpcId): NpcStoryBlock | null {
  const order = (block: NpcStoryBlock) => STORY_MILESTONES.findIndex((milestone) => milestone.id === block.after);
  const reached = NPC_STORY_LINES[id].filter((block) => gameState.story.reached[block.after] !== undefined);
  if (reached.length === 0) return null;
  return reached.reduce((best, block) => (order(block) > order(best) ? block : best));
}

/**
 * Sorteia a fala solta do morador. `fallback` é o que ele diz quando a história não fala (padrão: o `chatter` dele); `random` (0-1) é
 * injetável pros testes.
 */
export function pickNpcLine(id: NpcId, fallback?: NpcLine[], random: () => number = Math.random): NpcLine {
  const block = getStoryBlock(id);
  const pick = <T>(list: T[]): T => list[Math.min(list.length - 1, Math.floor(random() * list.length))];
  if (block) {
    const reachedDay = gameState.story.reached[block.after] ?? 0;
    const fresh = gameState.gameClock.getDay() - reachedDay < FRESH_DAYS;
    if (fresh || random() < STORY_LINE_CHANCE) return pick(block.lines);
  }
  return fallback && fallback.length > 0 ? pick(fallback) : { text: pick(NPCS[id].chatter) };
}

/** O retrato do morador com a expressão pedida (a que a folha não tem cai no quadro neutro). */
export function getPortrait(id: NpcId, expression: PortraitExpression = 'neutral'): { key: string; frame: { x: number; y: number; width: number; height: number } } {
  const { key, frame, expressions } = NPCS[id].portrait;
  const cell = expression === 'neutral' ? undefined : expressions?.[expression];
  return { key, frame: cell ? { ...frame, x: cell.x, y: cell.y } : frame };
}
