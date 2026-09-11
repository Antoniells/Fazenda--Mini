import Phaser from 'phaser';
import { SHADOW_KEY, SHADOW_FRAME_NAME, SHADOW_FRAME } from '../data/effects';

const SHADOW_ALPHA = 0.32;
const SHADOW_TINT = 0x152014;

/**
 * Cria uma sombra simples (mancha oval) sob um objeto — mesma mancha de
 * `Tileset/Shadow.png` reaproveitada em todo lugar; a diferença entre
 * "sombra de personagem" e "sombra de árvore/objeto" é só a escala. O
 * tingimento escuro e a opacidade reduzida são transformações sobre o
 * sprite existente (mesma técnica já usada para a plantação morta e os
 * destaques de UI) — nunca uma forma nova desenhada por código.
 */
export function createGroundShadow(
  scene: Phaser.Scene,
  x: number,
  y: number,
  scaleX: number,
  scaleY: number,
): Phaser.GameObjects.Image {
  const texture = scene.textures.get(SHADOW_KEY);
  if (!texture.has(SHADOW_FRAME_NAME)) {
    texture.add(SHADOW_FRAME_NAME, 0, SHADOW_FRAME.x, SHADOW_FRAME.y, SHADOW_FRAME.width, SHADOW_FRAME.height);
  }

  const shadow = scene.add.image(x, y, SHADOW_KEY, SHADOW_FRAME_NAME);
  shadow.setOrigin(0.5, 0.5);
  shadow.setScale(scaleX, scaleY);
  shadow.setTint(SHADOW_TINT);
  shadow.setAlpha(SHADOW_ALPHA);
  return shadow;
}
