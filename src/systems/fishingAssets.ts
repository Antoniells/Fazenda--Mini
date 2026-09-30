import Phaser from 'phaser';
import { FISH, FISHING_UI, fishTextureKey } from '../data/fishing';
import { FISHING_ROD } from '../data/tools';
import { INTERACT_BUBBLE_FRAME, INTERACT_BUBBLE_KEY, INTERACT_BUBBLE_PATH } from '../data/events';

/** Ícones (folhas 16x16) e folhas de UI da pesca. Pula o que já está no cache (a Fazenda carrega tudo; as cenas de pesca repetem por garantia). */
export function preloadFishingAssets(scene: Phaser.Scene): void {
  const sheet = (key: string, path: string): void => {
    if (!scene.textures.exists(key)) scene.load.spritesheet(key, encodeURI(`/${path}`), { frameWidth: 16, frameHeight: 16 });
  };
  for (const fish of FISH) sheet(fishTextureKey(fish), fish.iconPath);
  sheet(FISHING_ROD.textureKey, FISHING_ROD.texturePath);
  if (!scene.textures.exists(FISHING_UI.barsKey)) scene.load.image(FISHING_UI.barsKey, encodeURI(`/${FISHING_UI.barsPath}`));
  if (!scene.textures.exists(INTERACT_BUBBLE_KEY)) scene.load.image(INTERACT_BUBBLE_KEY, encodeURI(`/${INTERACT_BUBBLE_PATH}`));
}

/** Recortes do minijogo (trilha, faixa, marcador, estrelas) e o balão "!" — idempotente, depois do `preload`. */
export function registerFishingFrames(scene: Phaser.Scene): void {
  const bars = scene.textures.get(FISHING_UI.barsKey);
  for (const frame of [FISHING_UI.track, FISHING_UI.zone, FISHING_UI.marker, FISHING_UI.starFull, FISHING_UI.starEmpty]) {
    if (!bars.has(frame.name)) bars.add(frame.name, 0, frame.rect.x, frame.rect.y, frame.rect.width, frame.rect.height);
  }
  const bubbles = scene.textures.get(INTERACT_BUBBLE_KEY);
  const { name, rect } = INTERACT_BUBBLE_FRAME;
  if (!bubbles.has(name)) bubbles.add(name, 0, rect.x, rect.y, rect.width, rect.height);
}
