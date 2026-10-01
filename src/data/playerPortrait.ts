import type { CharacterId } from './player';
import { APPEARANCE_PRESETS, characterPortraitKey, portraitLayers, type PlayerAppearance } from './playerAppearance';

/**
 * RETRATO DO PERSONAGEM, montado das camadas do pacote (`Character/Character/Portrait/PNG`, folha 320x192 = 5x3 quadros de 64x64; o
 * 1º quadro é o rosto neutro) com as MESMAS peças da aparência (`data/playerAppearance.ts`). Personagem personalizado: as peças escolhidas
 * na Criação de Personagem (`characterPortraitKey`, montado por `systems/characterComposer.ts`). Personagem pronto (saves de antes da
 * personalização): as peças do modelo dele (`APPEARANCE_PRESETS`). Usado nos cartões de save e na criação de personagem.
 */

export const PLAYER_PORTRAIT_SIZE = { width: 320, height: 192 };
/** O rosto neutro (1º quadro). */
export const PLAYER_PORTRAIT_FACE = { name: 'player-portrait-face', x: 0, y: 0, width: 64, height: 64 };

/** Chave do retrato do personagem pronto `id` (as peças do modelo dele). */
export function playerPortraitKey(id: CharacterId): string {
  return `player-portrait-${id.toLowerCase()}`;
}

/** O que `preloadLayerStack` precisa pra montar o retrato do personagem pronto `id`. */
export function playerPortraitStack(id: CharacterId): { key: string; width: number; height: number; layers: string[] } {
  return { key: playerPortraitKey(id), ...PLAYER_PORTRAIT_SIZE, layers: portraitLayers(APPEARANCE_PRESETS[id]) };
}

/** A chave do retrato de quem tem (ou não) aparência montada. */
export function portraitKeyFor(characterId: CharacterId, appearance?: PlayerAppearance): string {
  return appearance ? characterPortraitKey(appearance) : playerPortraitKey(characterId);
}
