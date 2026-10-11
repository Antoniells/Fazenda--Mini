import Phaser from 'phaser';
import { BEEHIVE_RECT_IN_FRAME, BEES_FRAME_COUNT, BEES_FRAME_SIZE, BEES_KEY, BEES_PATH, BEES_PER_HIVE, PINE_BEEHIVE_FRAME } from '../data/beehives';
import { HONEY_ICON_KEY, HONEY_ICON_PATH } from '../data/resources';
import { PINE_TREE_FRAME, PINE_TREE_FRAME_NAME, PINE_TREE_KEY, PINE_TREE_PATH } from '../data/tiles';
import { DISPLAY_SCALE } from './mapBuilder';

/**
 * O DESENHO DAS COLMEIAS (`data/beehives.ts`): a árvore adulta com colmeia e as abelhas voando em volta dela.
 *
 * O Pinheiro usa o quadro dele com colmeia, que já vem na folha. As outras espécies ganham uma TEXTURA COMPOSTA, montada uma vez por
 * quadro: a árvore delas com a colmeia do pinheiro por cima — recortada só nos pixels que diferem do pinheiro comum (nada desenhado, só
 * recorte e composição da arte real). Assim a árvore com colmeia é um sprite só: balança, fica transparente atrás do personagem e
 * treme no golpe como qualquer outra.
 */

const BEES_ANIM_KEY = 'bees-fly';
const HIVE_OVERLAY_KEY = 'beehive-overlay';

export function preloadBeehives(scene: Phaser.Scene): void {
  if (!scene.textures.exists(PINE_TREE_KEY)) scene.load.image(PINE_TREE_KEY, encodeURI(`/${PINE_TREE_PATH}`));
  if (!scene.textures.exists(BEES_KEY)) scene.load.spritesheet(BEES_KEY, encodeURI(`/${BEES_PATH}`), { frameWidth: BEES_FRAME_SIZE, frameHeight: BEES_FRAME_SIZE });
  if (!scene.textures.exists(HONEY_ICON_KEY)) scene.load.spritesheet(HONEY_ICON_KEY, encodeURI(`/${HONEY_ICON_PATH}`), { frameWidth: 16, frameHeight: 16 });
}

/** A colmeia sozinha, recortada do pinheiro com colmeia: os pixels iguais aos do pinheiro comum (as agulhas em volta) ficam transparentes. */
function hiveOverlay(scene: Phaser.Scene): HTMLCanvasElement {
  const existing = scene.textures.exists(HIVE_OVERLAY_KEY) ? (scene.textures.get(HIVE_OVERLAY_KEY) as Phaser.Textures.CanvasTexture) : null;
  if (existing) return existing.getCanvas();

  const { x, y, width, height } = BEEHIVE_RECT_IN_FRAME;
  const source = scene.textures.get(PINE_TREE_KEY).getSourceImage() as HTMLImageElement;
  const overlay = scene.textures.createCanvas(HIVE_OVERLAY_KEY, width, height)!;
  const context = overlay.getContext();
  context.drawImage(source, PINE_BEEHIVE_FRAME.rect.x + x, PINE_BEEHIVE_FRAME.rect.y + y, width, height, 0, 0, width, height);
  const plain = document.createElement('canvas');
  plain.width = width;
  plain.height = height;
  const plainContext = plain.getContext('2d')!;
  plainContext.drawImage(source, PINE_TREE_FRAME.x + x, PINE_TREE_FRAME.y + y, width, height, 0, 0, width, height);

  const hive = context.getImageData(0, 0, width, height);
  const pine = plainContext.getImageData(0, 0, width, height).data;
  for (let index = 0; index < hive.data.length; index += 4) {
    const same = hive.data[index] === pine[index] && hive.data[index + 1] === pine[index + 1] && hive.data[index + 2] === pine[index + 2] && hive.data[index + 3] === pine[index + 3];
    if (same) hive.data[index + 3] = 0;
  }
  context.putImageData(hive, 0, 0);
  overlay.refresh();
  return overlay.getCanvas();
}

/**
 * A textura da árvore adulta COM colmeia: o quadro do pinheiro que já tem uma; nas outras, a composição (criada uma vez por quadro).
 * `textureKey`/`frameName` = a árvore adulta normal daquela espécie.
 */
export function beehiveTreeTexture(scene: Phaser.Scene, textureKey: string, frameName: string | number): { textureKey: string; frameName: string | number } {
  // O pinheiro verde de sempre já tem o quadro com colmeia na folha; os outros (inclusive o pinheiro nevado) ganham a composição.
  if (textureKey === PINE_TREE_KEY && frameName === PINE_TREE_FRAME_NAME) {
    const texture = scene.textures.get(PINE_TREE_KEY);
    const { name, rect } = PINE_BEEHIVE_FRAME;
    if (!texture.has(name)) texture.add(name, 0, rect.x, rect.y, rect.width, rect.height);
    return { textureKey: PINE_TREE_KEY, frameName: name };
  }

  const key = `${textureKey}:${frameName}:beehive`;
  if (!scene.textures.exists(key)) {
    const frame = scene.textures.getFrame(textureKey, frameName);
    const composite = scene.textures.createCanvas(key, frame.cutWidth, frame.cutHeight)!;
    const context = composite.getContext();
    context.drawImage(frame.source.image as HTMLImageElement, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight, 0, 0, frame.cutWidth, frame.cutHeight);
    context.drawImage(hiveOverlay(scene), BEEHIVE_RECT_IN_FRAME.x, BEEHIVE_RECT_IN_FRAME.y);
    composite.refresh();
  }
  return { textureKey: key, frameName: '__BASE' };
}

/**
 * As abelhas voando em volta da colmeia de uma árvore (`tree`: o sprite da árvore, origem nos pés): cada uma bate as asas e vai e
 * volta num pedacinho de céu em volta da colmeia, em ritmos diferentes. Devolvidas pra serem destruídas junto com a árvore.
 */
export function spawnBees(scene: Phaser.Scene, tree: Phaser.GameObjects.Image): Phaser.GameObjects.Sprite[] {
  if (!scene.textures.exists(BEES_KEY)) return [];
  if (!scene.anims.exists(BEES_ANIM_KEY)) {
    scene.anims.create({ key: BEES_ANIM_KEY, frames: scene.anims.generateFrameNumbers(BEES_KEY, { start: 0, end: BEES_FRAME_COUNT - 1 }), frameRate: 12, repeat: -1 });
  }
  // O centro da colmeia no mundo: o quadro (32x48) tem origem embaixo, no meio.
  const frameWidth = tree.frame.cutWidth;
  const frameHeight = tree.frame.cutHeight;
  const hiveX = tree.x + (BEEHIVE_RECT_IN_FRAME.x + BEEHIVE_RECT_IN_FRAME.width / 2 - frameWidth / 2) * DISPLAY_SCALE;
  const hiveY = tree.y - (frameHeight - BEEHIVE_RECT_IN_FRAME.y - BEEHIVE_RECT_IN_FRAME.height / 2) * DISPLAY_SCALE;

  const bees: Phaser.GameObjects.Sprite[] = [];
  for (let index = 0; index < BEES_PER_HIVE; index++) {
    const bee = scene.add.sprite(hiveX, hiveY, BEES_KEY, 0).setScale(DISPLAY_SCALE * 0.75).setDepth(tree.depth + 1);
    bee.play({ key: BEES_ANIM_KEY, startFrame: index % BEES_FRAME_COUNT });
    const reach = 14 + index * 6;
    scene.tweens.add({ targets: bee, x: { from: hiveX - reach, to: hiveX + reach }, duration: 900 + index * 350, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: index * 200, onYoyo: () => bee.setFlipX(!bee.flipX) });
    scene.tweens.add({ targets: bee, y: { from: hiveY - 10, to: hiveY + 8 }, duration: 640 + index * 210, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    bees.push(bee);
  }
  return bees;
}
