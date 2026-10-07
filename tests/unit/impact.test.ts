import { afterEach, describe, expect, it, vi } from 'vitest';
import { hitstop, hitstopMs, impact, slowMotion, traumaFor } from '../../src/systems/impact';

/** Uma cena "de mentira" com o que o pacote de impacto usa: o `step` (que registra o delta que chegou), a câmera e os tweens. */
function fakeScene() {
  const deltas: number[] = [];
  const shakes: Array<[number, number]> = [];
  const sys = { step: (_time: number, delta: number) => void deltas.push(delta), events: { on: () => {} } };
  const camera = { shake: (duration: number, intensity: number) => void shakes.push([duration, intensity]), followOffset: { x: 0, y: 0 }, setFollowOffset: () => {} };
  const scene = { sys, cameras: { main: camera }, tweens: { add: () => ({ stop: () => {} }) }, textures: { exists: () => false } };
  return { scene: scene as never, sys, deltas, shakes };
}

describe('pacote de impacto (ideia do hitstop)', () => {
  afterEach(() => vi.useRealTimers());

  it('a força decide o congelamento e o trauma, na faixa que funciona a 60 fps', () => {
    expect(hitstopMs(0.1)).toBeCloseTo(39);
    expect(hitstopMs(0.45)).toBeCloseTo(70.5);
    expect(hitstopMs(0.9)).toBeCloseTo(111);
    expect(hitstopMs(1)).toBeLessThanOrEqual(120); // Mais que ~0,2 s parece travada, não impacto.
    expect(traumaFor(0.9)).toBeGreaterThan(traumaFor(0.45));
  });

  it('congelada, a cena pula o passo (lógica, tweens, timers); depois volta a andar', () => {
    vi.useFakeTimers({ toFake: ['performance'] });
    const { scene, sys, deltas } = fakeScene();
    hitstop(scene, 100);
    sys.step(0, 16);
    vi.advanceTimersByTime(50);
    sys.step(0, 16);
    expect(deltas).toEqual([]);
    vi.advanceTimersByTime(60);
    sys.step(0, 16);
    expect(deltas).toEqual([16]);
  });

  it('em câmera lenta o delta chega multiplicado, e volta ao normal no fim', () => {
    vi.useFakeTimers({ toFake: ['performance'] });
    const { scene, sys, deltas } = fakeScene();
    slowMotion(scene, 900, 0.35);
    sys.step(0, 20);
    vi.advanceTimersByTime(1000);
    sys.step(0, 20);
    expect(deltas[0]).toBeCloseTo(7);
    expect(deltas[1]).toBe(20);
  });

  it('golpes seguidos somam trauma: o tremor do segundo é mais forte', () => {
    const { scene, shakes } = fakeScene();
    impact(scene, { strength: 0.45, noHitstop: true });
    impact(scene, { strength: 0.45, noHitstop: true });
    expect(shakes[1][1]).toBeGreaterThan(shakes[0][1]);
  });
});
