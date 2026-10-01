import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { freshGame } from './helpers';
import { CHARACTER_IDS } from '../../src/data/player';
import { playerPortraitStack } from '../../src/data/playerPortrait';
import { NPCS } from '../../src/data/npcs';
import { gameState } from '../../src/systems/gameState';
import { getSlotSummary, save } from '../../src/systems/saveManager';

const assetExists = (path: string): boolean => existsSync(resolve(__dirname, '../../assets', path));

describe('arte em camadas', () => {
  beforeEach(freshGame);

  it('toda camada dos retratos dos personagens existe no pacote', () => {
    for (const id of CHARACTER_IDS) {
      for (const layer of playerPortraitStack(id).layers) expect(assetExists(layer), layer).toBe(true);
    }
  });

  it('toda camada dos retratos montados dos moradores existe no pacote', () => {
    const layered = Object.values(NPCS).filter((npc) => npc.portrait.layers);
    expect(layered.map((npc) => npc.id).sort()).toEqual(['mermaid', 'pirate']);
    for (const npc of layered) {
      for (const layer of npc.portrait.layers!.paths) expect(assetExists(layer), layer).toBe(true);
    }
  });

  it('o resumo do save diz qual é o personagem (pro retrato do cartão)', () => {
    gameState.profile.characterId = 'Tori';
    save(0);
    expect(getSlotSummary(0).characterId).toBe('Tori');
  });
});
