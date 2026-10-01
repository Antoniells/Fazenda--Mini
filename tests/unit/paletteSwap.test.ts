import { describe, expect, it } from 'vitest';
import { recoloredKey, toGold } from '../../src/systems/paletteSwap';
import { GOLDEN_CARROT, GOLDEN_CARROT_SEED } from '../../src/data/resources';
import { ALL_CROPS_ICONS_KEY, CARROT } from '../../src/data/crops';

const lum = ([r, g, b]: [number, number, number]): number => (Math.max(r, g, b) + Math.min(r, g, b)) / 2;

describe('troca de paleta (Cenoura Dourada)', () => {
  it('o laranja da cenoura vira ouro, mantendo o claro claro e o escuro escuro', () => {
    const dark = toGold(160, 64, 20)!;
    const light = toGold(255, 150, 60)!;
    expect(dark).not.toBeNull();
    expect(light).not.toBeNull();
    expect(lum(light)).toBeGreaterThan(lum(dark));
    // Ouro: vermelho > verde > azul, com o verde bem mais alto que no laranja original.
    expect(light[0]).toBeGreaterThanOrEqual(light[1]);
    expect(light[1]).toBeGreaterThan(light[2]);
    expect(light[1]).toBeGreaterThan(150);
  });

  it('folha verde, contorno escuro e papel claro ficam como estão', () => {
    expect(toGold(70, 150, 60)).toBeNull();
    expect(toGold(30, 20, 25)).toBeNull();
    expect(toGold(235, 225, 205)).toBeNull();
  });

  it('os ícones da Cenoura e da semente apontam pras texturas douradas que a Fazenda cria', () => {
    expect(GOLDEN_CARROT.textureKey).toBe(recoloredKey('golden', ALL_CROPS_ICONS_KEY, CARROT.cropFrameName));
    expect(GOLDEN_CARROT_SEED.textureKey).toBe(recoloredKey('golden', ALL_CROPS_ICONS_KEY, CARROT.seedFrameName));
  });
});
