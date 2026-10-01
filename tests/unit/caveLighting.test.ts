import { describe, expect, it } from 'vitest';
import { cavePenumbraColor } from '../../src/systems/caveLighting';
import { CAVE_PENUMBRA_BOTTOM, CAVE_PENUMBRA_TOP } from '../../src/data/lighting';

const brightness = (color: number): number => ((color >> 16) & 0xff) + ((color >> 8) & 0xff) + (color & 0xff);

describe('penumbra das Cavernas', () => {
  it('vai do tom do 1º andar ao do último, escurecendo a cada andar', () => {
    expect(cavePenumbraColor(1)).toBe(CAVE_PENUMBRA_TOP);
    expect(cavePenumbraColor(100)).toBe(CAVE_PENUMBRA_BOTTOM);
    for (let floor = 2; floor <= 100; floor++) expect(brightness(cavePenumbraColor(floor))).toBeLessThanOrEqual(brightness(cavePenumbraColor(floor - 1)));
  });

  it('é penumbra, não breu: nem o fundo fica abaixo de ~35% de luz', () => {
    expect(brightness(cavePenumbraColor(100)) / (3 * 255)).toBeGreaterThan(0.35);
  });
});
