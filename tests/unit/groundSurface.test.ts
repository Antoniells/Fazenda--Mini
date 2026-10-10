import { describe, expect, it } from 'vitest';
import { classifyGroundColor } from '../../src/systems/groundSurface';
import { STEP_DIRT_SOUNDS, STEP_GRASS_SOUNDS, STEP_STONE_SOUNDS, ALL_SOUND_EFFECTS } from '../../src/data/audio';

describe('o chão pela cor (o som dos passos)', () => {
  it('verde é grama, laranja/marrom é terra, cinza ou azulado é pedra', () => {
    expect(classifyGroundColor(126, 196, 51)).toBe('grass'); // a grama do jogo
    expect(classifyGroundColor(228, 158, 88)).toBe('dirt'); // o caminho de terra
    expect(classifyGroundColor(196, 160, 120)).toBe('dirt'); // areia/terra clara
    expect(classifyGroundColor(140, 140, 150)).toBe('stone'); // pedra cinza
    expect(classifyGroundColor(90, 100, 160)).toBe('stone'); // pedra azulada da caverna
  });

  it('cada chão tem os seus passos carregados (a terra usa o mesmo passo das pontes, o de pedra)', () => {
    const loaded = new Set(ALL_SOUND_EFFECTS.map((effect) => effect.key));
    for (const sound of [...STEP_GRASS_SOUNDS, ...STEP_DIRT_SOUNDS, ...STEP_STONE_SOUNDS]) expect(loaded.has(sound.key), sound.key).toBe(true);
    expect(STEP_DIRT_SOUNDS).toBe(STEP_STONE_SOUNDS);
  });
});
