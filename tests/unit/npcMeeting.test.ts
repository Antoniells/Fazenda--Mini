import { beforeEach, describe, expect, it } from 'vitest';
import { freshGame, memoryStorage } from './helpers';
import { gameState } from '../../src/systems/gameState';
import { talkToNpc } from '../../src/systems/npcDialogue';
import { QUESTS } from '../../src/data/campaign';
import { load, save } from '../../src/systems/saveManager';

/** Uma conversa "de mentira": guarda o texto que o painel mostraria. */
function talk(): string {
  let text = '';
  const scene = { game: { events: { emit: (_event: string, payload: { text: string }) => void (text = payload.text) } } };
  talkToNpc('blacksmith', { scene: scene as never, canOpenShop: () => false, openShop: () => {} });
  return text;
}

describe('apresentação dos moradores', () => {
  beforeEach(() => {
    memoryStorage.clear();
    freshGame();
    gameState.campaign.questIndex = QUESTS.findIndex((quest) => quest.id === 'forge-repairs');
  });

  it('o morador só se apresenta na primeira conversa', () => {
    expect(talk()).toContain('Sou o Bruno');
    const second = talk();
    expect(second).not.toContain('Sou o Bruno');
    expect(second).toContain('Minha forja está caindo aos pedaços');
  });

  it('save antigo (sem a lista) conta todos como já conhecidos; a lista vai pro save', () => {
    talk();
    save(0);
    const key = [...memoryStorage.keys()].pop()!;
    const data = JSON.parse(memoryStorage.get(key)!);
    expect(data.metNpcs).toEqual(['blacksmith']);
    delete data.metNpcs;
    memoryStorage.set(key, JSON.stringify(data));
    expect(load(0)).toBe(true);
    expect(gameState.metNpcs).toContain('pirate');
    expect(talk()).not.toContain('Sou o Bruno');
  });
});
