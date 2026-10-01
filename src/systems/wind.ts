import { gameState } from './gameState';

/**
 * VENTO GLOBAL: uma força só (-1 a 1; positivo = sopra pra direita) que muda devagar — de tempos em tempos sorteia-se um vento ALVO e o
 * vento atual vai até ele aos poucos. Na chuva sopra forte e pra esquerda (o mesmo lado em que a chuva de `ui/weatherOverlay.ts` cai).
 * Quem usa: o balanço da vegetação (`systems/foliageSway.ts`) e a deriva das borboletas. Só estado de visual: não vai pro save.
 */

/** De quanto em quanto tempo (ms reais) o vento muda de ideia. */
const RETARGET_MS = { min: 20_000, max: 60_000 };
/** Quanto o vento atual anda em direção ao alvo, por segundo. */
const APPROACH_PER_SECOND = 0.06;
/** Vento comum: brisa na maior parte do tempo, às vezes uma ventania. */
const BREEZE = 0.35;
const GUST = 0.75;
const GUST_CHANCE = 0.25;
/** Na chuva: a força fica nesta faixa (pra esquerda). */
const RAIN_WIND = { min: 0.55, max: 0.95 };

interface WindState {
  current: number;
  target: number;
  /** Tempo (ms acumulado) em que o alvo muda de novo. */
  nextRetargetMs: number;
  elapsedMs: number;
  /** O alvo foi sorteado com chuva? Se o tempo mudou, sorteia de novo na hora. */
  rainyTarget: boolean;
  /** Relógio da onda (s): anda mais rápido com mais vento — acumulado, pra a onda acelerar sem dar saltos. */
  waveSeconds: number;
}

const state: WindState = { current: 0.2, target: 0.2, nextRetargetMs: 0, elapsedMs: 0, rainyTarget: false, waveSeconds: 0 };

/** Sorteia o próximo vento alvo. */
export function rollWindTarget(raining: boolean, random: () => number = Math.random): number {
  if (raining) return -(RAIN_WIND.min + random() * (RAIN_WIND.max - RAIN_WIND.min));
  const range = random() < GUST_CHANCE ? GUST : BREEZE;
  return (random() * 2 - 1) * range;
}

/** Avança o vento `deltaMs` (chamado uma vez por quadro). */
export function advanceWind(deltaMs: number, raining: boolean = gameState.weather.raining, random: () => number = Math.random): void {
  state.elapsedMs += deltaMs;
  // Começou (ou parou) de chover: muda o alvo na hora.
  if (state.elapsedMs >= state.nextRetargetMs || raining !== state.rainyTarget) {
    state.target = rollWindTarget(raining, random);
    state.rainyTarget = raining;
    state.nextRetargetMs = state.elapsedMs + RETARGET_MS.min + random() * (RETARGET_MS.max - RETARGET_MS.min);
  }
  const step = APPROACH_PER_SECOND * (deltaMs / 1000);
  const gap = state.target - state.current;
  state.current += Math.abs(gap) <= step ? gap : Math.sign(gap) * step;
  state.waveSeconds += (deltaMs / 1000) * (1 + 0.5 * Math.abs(state.current));
}

/** O vento agora (-1 a 1). */
export function getWind(): number {
  return state.current;
}

/** Só pros testes: põe o vento num estado conhecido. */
export function resetWind(current = 0, target = current): void {
  Object.assign(state, { current, target, nextRetargetMs: Number.POSITIVE_INFINITY, elapsedMs: 0, rainyTarget: false, waveSeconds: 0 });
}

/**
 * Quanto uma planta na célula (col, row) pende agora, de -1,5 a 1,5 (vezes os graus de cada tipo): um vai-e-vem que atravessa o mapa
 * como uma ONDA (a fase anda com a coluna, então vizinhas balançam quase juntas e a onda "corre" pelo campo) somado à inclinação do vento.
 * Mais vento = vai-e-vem mais largo e mais rápido (o relógio da onda acelera); sem vento ainda sobra um balanço leve.
 */
export function windLean(col: number, row: number, cyclesPerSecond = 0.35, wind: number = state.current, waveSeconds: number = state.waveSeconds): number {
  const strength = Math.abs(wind);
  const phase = waveSeconds * Math.PI * 2 * cyclesPerSecond + col * 0.5 + row * 0.2;
  return 0.5 * Math.cos(phase) * (0.4 + strength) + wind * 0.6;
}
