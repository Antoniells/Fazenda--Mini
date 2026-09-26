import {
  AMBIENT_KEYFRAMES,
  LIGHTS_OFF_END_HOUR,
  LIGHTS_OFF_START_HOUR,
  LIGHTS_ON_END_HOUR,
  LIGHTS_ON_START_HOUR,
} from '../data/lighting';

const WHITE = 0xffffff;

function lerpChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

/** Mistura duas cores 0xRRGGBB (t = 0 → `from`, 1 → `to`). */
export function mixColors(from: number, to: number, t: number): number {
  const r = lerpChannel((from >> 16) & 0xff, (to >> 16) & 0xff, t);
  const g = lerpChannel((from >> 8) & 0xff, (to >> 8) & 0xff, t);
  const b = lerpChannel(from & 0xff, to & 0xff, t);
  return (r << 16) | (g << 8) | b;
}

/** Cor da luz do sol na hora dada (0-24): interpolação entre as chaves de `AMBIENT_KEYFRAMES`. */
export function ambientColorAt(hours: number): number {
  const h = ((hours % 24) + 24) % 24;
  for (let i = 1; i < AMBIENT_KEYFRAMES.length; i++) {
    const next = AMBIENT_KEYFRAMES[i];
    if (h > next.hour) continue;
    const prev = AMBIENT_KEYFRAMES[i - 1];
    const span = next.hour - prev.hour;
    return span <= 0 ? next.color : mixColors(prev.color, next.color, (h - prev.hour) / span);
  }
  return WHITE;
}

/**
 * Intensidade (0-1) das fontes de luz na hora dada: 0 de dia, 1 à noite, com rampa ao anoitecer (`LIGHTS_ON_*`) e ao amanhecer
 * (`LIGHTS_OFF_*`). É o que liga/desliga postes e tochas — uma só regra, usada por todos.
 */
export function lightIntensityAt(hours: number): number {
  const h = ((hours % 24) + 24) % 24;
  if (h >= LIGHTS_ON_END_HOUR || h < LIGHTS_OFF_START_HOUR) return 1;
  if (h >= LIGHTS_ON_START_HOUR) return (h - LIGHTS_ON_START_HOUR) / (LIGHTS_ON_END_HOUR - LIGHTS_ON_START_HOUR);
  if (h < LIGHTS_OFF_END_HOUR) return 1 - (h - LIGHTS_OFF_START_HOUR) / (LIGHTS_OFF_END_HOUR - LIGHTS_OFF_START_HOUR);
  return 0;
}
