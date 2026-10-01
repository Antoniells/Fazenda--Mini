import type { CharacterId } from './player';

/**
 * RETRATO DO PERSONAGEM, montado das camadas do pacote (`Character/Character/Portrait/PNG`, folha 320x192 = 5x3 quadros de 64x64; o
 * 1º quadro é o rosto neutro) por `systems/layeredArt.ts` — ideia do stardew.me. Os 5 personagens prontos (`Pre-made`) não trazem
 * retrato: as peças abaixo foram escolhidas pra parecer com cada um (cabelo, cor dos olhos, roupa, pele). A ordem é a do Aseprite do
 * pacote, de baixo pra cima: pele, cabelo, olhos, roupa, acessório, orelha. Usado nos cartões de save e na criação de personagem.
 */

const DIR = 'Character/Character/Portrait/PNG';
export const PLAYER_PORTRAIT_SIZE = { width: 320, height: 192 };
/** O rosto neutro (1º quadro). */
export const PLAYER_PORTRAIT_FACE = { name: 'player-portrait-face', x: 0, y: 0, width: 64, height: 64 };

const PARTS: Record<CharacterId, string[]> = {
  Alex: ['Skins/Male/1', 'Hair/Sebastian/Blonde', 'Eyes/Blue', 'Clothers/Male/Blue', 'Skins/Ears/Human/1'],
  Josh: ['Skins/Male/1', 'Hair/Josh/Black', 'Eyes/Blue', 'Clothers/Male/Blue', 'Skins/Ears/Human/1'],
  Lyria: ['Skins/Female/1', 'Hair/Lyria/Brown', 'Eyes/Brown', 'Clothers/Female/Red', 'Skins/Ears/Human/1'],
  Manu: ['Skins/Female/3', 'Hair/Standart/Black', 'Eyes/Black', 'Clothers/Female/Pink', 'Acc/Cow', 'Skins/Ears/Human/3'],
  Tori: ['Skins/Female/1', 'Hair/Silvermist/Ginger', 'Eyes/Green', 'Clothers/Female/Purple', 'Skins/Ears/Human/1'],
};

export function playerPortraitKey(id: CharacterId): string {
  return `player-portrait-${id.toLowerCase()}`;
}

/** O que `preloadLayerStack` precisa pra montar o retrato do personagem `id`. */
export function playerPortraitStack(id: CharacterId): { key: string; width: number; height: number; layers: string[] } {
  return { key: playerPortraitKey(id), ...PLAYER_PORTRAIT_SIZE, layers: PARTS[id].map((part) => `${DIR}/${part}.png`) };
}
