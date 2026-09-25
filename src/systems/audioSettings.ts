import { getStorageAdapter } from './saveManager';

/**
 * Volume das músicas e dos efeitos (Configurações). Cada um é um NÍVEL
 * inteiro de 0 a `VOLUME_LEVELS` (10 segmentos na tela de ajustes; 10 = 100%
 * do volume calibrado em `data/audio.ts`). Vale pro jogo todo, não por save
 * — mas mora no mesmo armazenamento dos saves (`getStorageAdapter`), então
 * quando o adaptador de `fs` do executável entrar, os ajustes vão junto.
 *
 * Ninguém guarda cópia do valor: `playEffect` e `dayMusic` leem
 * `getEffectsVolume()`/`getMusicVolume()` na hora de usar, então mexer no
 * ajuste vale imediatamente (inclusive pra música que já está tocando).
 */
export const VOLUME_LEVELS = 10;

const SETTINGS_KEY = 'mini-fazenda-settings';

interface AudioSettingsData {
  musicLevel: number;
  effectsLevel: number;
}

const DEFAULTS: AudioSettingsData = { musicLevel: VOLUME_LEVELS, effectsLevel: VOLUME_LEVELS };

let current: AudioSettingsData | null = null;

function clampLevel(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(VOLUME_LEVELS, Math.max(0, Math.round(value)));
}

/** Lê do armazenamento na primeira vez (dado ausente/corrompido cai nos padrões, nunca quebra). */
function settings(): AudioSettingsData {
  if (current) return current;
  current = { ...DEFAULTS };
  const raw = getStorageAdapter().read(SETTINGS_KEY);
  if (raw) {
    try {
      const data = JSON.parse(raw) as Partial<AudioSettingsData>;
      current = {
        musicLevel: clampLevel(data.musicLevel, DEFAULTS.musicLevel),
        effectsLevel: clampLevel(data.effectsLevel, DEFAULTS.effectsLevel),
      };
    } catch (error) {
      console.error('audioSettings: ajustes salvos corrompidos — usando os padrões.', error);
    }
  }
  return current;
}

function persist(): void {
  getStorageAdapter().write(SETTINGS_KEY, JSON.stringify(settings()));
}

export function getMusicLevel(): number {
  return settings().musicLevel;
}

export function getEffectsLevel(): number {
  return settings().effectsLevel;
}

export function setMusicLevel(level: number): void {
  settings().musicLevel = clampLevel(level, DEFAULTS.musicLevel);
  persist();
}

export function setEffectsLevel(level: number): void {
  settings().effectsLevel = clampLevel(level, DEFAULTS.effectsLevel);
  persist();
}

/** Multiplicador 0-1 aplicado ao volume base de cada música. */
export function getMusicVolume(): number {
  return getMusicLevel() / VOLUME_LEVELS;
}

/** Multiplicador 0-1 aplicado ao volume base de cada efeito. */
export function getEffectsVolume(): number {
  return getEffectsLevel() / VOLUME_LEVELS;
}
