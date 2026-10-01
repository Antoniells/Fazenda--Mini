import { beforeEach, describe, expect, it } from 'vitest';
import { freshGame } from './helpers';
import { gameState } from '../../src/systems/gameState';
import { getPortrait, getStoryBlock, pickNpcLine } from '../../src/systems/npcLines';
import { NPCS } from '../../src/data/npcs';
import { NPC_STORY_LINES } from '../../src/data/npcStoryLines';
import { STORY_MILESTONES, StoryMilestoneId } from '../../src/data/story';

/** Marca o marco como alcançado `daysAgo` dias atrás. */
function reachedDaysAgo(id: StoryMilestoneId, daysAgo: number): void {
  gameState.story.reached[id] = gameState.gameClock.getDay() - daysAgo;
}

describe('falas dos moradores pela história', () => {
  beforeEach(freshGame);

  it('sem história, só a conversa de sempre', () => {
    expect(getStoryBlock('blacksmith')).toBeNull();
    const line = pickNpcLine('blacksmith', undefined, () => 0);
    expect(NPCS.blacksmith.chatter).toContain(line.text);
  });

  it('vale o bloco do marco mais avançado já alcançado', () => {
    reachedDaysAgo('prophecy', 10);
    reachedDaysAgo('azurite', 5);
    expect(getStoryBlock('blacksmith')?.after).toBe('azurite');
    reachedDaysAgo('hiddenForest', 1);
    expect(getStoryBlock('blacksmith')?.after).toBe('hiddenForest');
  });

  it('logo depois do marco a fala da história é garantida', () => {
    reachedDaysAgo('azurite', 0);
    const line = pickNpcLine('blacksmith', undefined, () => 0.99);
    expect(line.text).toContain('Azurita');
    expect(line.expression).toBeDefined();
  });

  it('passada a novidade, a história divide espaço com a conversa de sempre', () => {
    reachedDaysAgo('azurite', 10);
    expect(pickNpcLine('blacksmith', undefined, () => 0.1).text).toContain('Azurita');
    expect(NPCS.blacksmith.chatter).toContain(pickNpcLine('blacksmith', undefined, () => 0.9).text);
  });

  it('a lista reserva substitui a conversa de sempre', () => {
    const line = pickNpcLine('pirate', [{ text: 'obrigado!', expression: 'happy' }], () => 0);
    expect(line).toEqual({ text: 'obrigado!', expression: 'happy' });
  });

  it('retrato: a expressão que a folha não tem cai no quadro neutro', () => {
    expect(getPortrait('blacksmith', 'surprised').frame).toMatchObject({ x: 128, y: 0, width: 64, height: 64 });
    expect(getPortrait('pirate', 'surprised').frame).toEqual(NPCS.pirate.portrait.frame);
    expect(getPortrait('banker').frame).toEqual(NPCS.banker.portrait.frame);
  });

  it('os dados só usam marcos que existem e nenhum bloco vazio', () => {
    const ids = new Set(STORY_MILESTONES.map((milestone) => milestone.id));
    for (const blocks of Object.values(NPC_STORY_LINES)) {
      for (const block of blocks) {
        expect(ids.has(block.after)).toBe(true);
        expect(block.lines.length).toBeGreaterThan(0);
      }
    }
  });
});
