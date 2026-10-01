import { beforeEach, describe, expect, it } from 'vitest';
import { advanceWind, getWind, resetWind, rollWindTarget, windLean } from '../../src/systems/wind';

describe('vento global', () => {
  beforeEach(() => resetWind(0));

  it('o vento anda devagar até o alvo, sem pular', () => {
    resetWind(0, 0.5);
    advanceWind(1000, false);
    expect(getWind()).toBeCloseTo(0.06, 5);
    for (let second = 0; second < 20; second++) advanceWind(1000, false);
    expect(getWind()).toBeCloseTo(0.5, 5); // Chegou e parou no alvo.
  });

  it('na chuva o alvo é forte e pra esquerda (o lado em que a chuva cai)', () => {
    for (const r of [0, 0.5, 0.999]) {
      const target = rollWindTarget(true, () => r);
      expect(target).toBeLessThanOrEqual(-0.55);
      expect(target).toBeGreaterThanOrEqual(-0.95);
    }
  });

  it('começar a chover muda o alvo na hora', () => {
    resetWind(0.3, 0.3);
    advanceWind(16, true, () => 0.5);
    advanceWind(60_000, true, () => 0.5);
    expect(getWind()).toBeLessThan(-0.5);
  });

  it('a onda: vizinhas quase juntas, e o vento inclina tudo pro lado dele', () => {
    const near = Math.abs(windLean(10, 5, 0.4, 0, 3) - windLean(11, 5, 0.4, 0, 3));
    const far = Math.abs(windLean(10, 5, 0.4, 0, 3) - windLean(16, 5, 0.4, 0, 3));
    expect(near).toBeLessThan(far);
    // Média de um ciclo inteiro = só a inclinação do vento.
    let sum = 0;
    for (let step = 0; step < 100; step++) sum += windLean(3, 3, 1, 0.8, step / 100);
    expect(sum / 100).toBeCloseTo(0.48, 2);
  });
});
