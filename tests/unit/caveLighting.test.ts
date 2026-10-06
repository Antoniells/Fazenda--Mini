import { describe, expect, it } from 'vitest';
import { caveAmbientColor } from '../../src/systems/caveLighting';
import { CAVE_AMBIENT_BOTTOM, CAVE_AMBIENT_TOP } from '../../src/data/lighting';

const brightness = (color: number): number => ((color >> 16) & 0xff) + ((color >> 8) & 0xff) + (color & 0xff);

describe('luz ambiente das Cavernas', () => {
  it('vai do tom do 1º andar ao do último, escurecendo a cada andar', () => {
    expect(caveAmbientColor(1)).toBe(CAVE_AMBIENT_TOP);
    expect(caveAmbientColor(100)).toBe(CAVE_AMBIENT_BOTTOM);
    for (let floor = 2; floor <= 100; floor++) expect(brightness(caveAmbientColor(floor))).toBeLessThanOrEqual(brightness(caveAmbientColor(floor - 1)));
  });

  it('é penumbra, não breu: o fundo ainda tem luz ambiente', () => {
    expect(brightness(caveAmbientColor(100))).toBeGreaterThan(0);
    expect(brightness(caveAmbientColor(100)) / (3 * 255)).toBeGreaterThan(0.15);
  });
});
