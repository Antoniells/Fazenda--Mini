import Phaser from 'phaser';
import { createGroundShadow } from './shadow';
import { DISPLAY_SCALE } from './mapBuilder';

/** Fragmentos: a arte do objeto é cortada numa grade de `PIECE_COLS` x `PIECE_ROWS` pedaços (recortes do PRÓPRIO sprite, não desenho novo). */
const PIECE_COLS = 3;
const PIECE_ROWS = 3;
/** Tremor antes de estourar: deslocamento (px), duração de cada ida/volta (ms) e repetições; o flash branco cobre o tremor inteiro. */
const SHAKE_PX = 3;
const SHAKE_MS = 40;
const SHAKE_REPEATS = 3;
const FLASH_MS = 90;
/** Voo dos pedaços: distância lateral (px de tela), altura do arremesso, queda e duração (ms). */
const SCATTER_MIN = 14;
const SCATTER_MAX = 40;
const TOSS_UP = 22;
const FALL_DOWN = 26;
const PIECE_MS = 520;
/** Poeira do estouro (mesma mancha de `Shadow.png` da poeira dos passos, em tingimento sólido). */
const DUST_TINT = 0xe9dfc0;
const DUST_COUNT = 3;
const DUST_MS = 460;

/**
 * Animação de QUEBRA de um objeto do mundo (móvel, aspersor, bancada…): o objeto treme e pisca de branco (o golpe), estoura em
 * fragmentos — o sprite é fatiado em uma grade de pedaços que voam pra fora, giram, caem e somem — com uma nuvenzinha de poeira na base.
 * Os pedaços usam a textura/frame do próprio objeto (`setCrop`), então qualquer arte quebra "com a cara dela" sem asset novo.
 *
 * A imagem é destruída aqui no estouro (quem chama NÃO destrói); a lógica do mundo (grid, interação, item devolvido) já terminou antes,
 * então a animação é só visual e pode ser interrompida pelo fim da cena sem consequência (tweens/objetos morrem com ela).
 * `shadow` (opcional) some junto, com fade.
 */
export function playBreakEffect(scene: Phaser.Scene, image: Phaser.GameObjects.Image, shadow?: Phaser.GameObjects.Image): void {
  const baseX = image.x;

  if (shadow) scene.tweens.add({ targets: shadow, alpha: 0, duration: SHAKE_MS * SHAKE_REPEATS * 2 + 120, onComplete: () => shadow.destroy() });

  // Flash branco sólido (tingimento FILL, como no golpe de árvore/pedra) + tremor.
  image.setTint(0xffffff);
  image.setTintMode(Phaser.TintModes.FILL);
  scene.time.delayedCall(FLASH_MS, () => {
    if (!image.active) return;
    image.clearTint();
    image.setTintMode(Phaser.TintModes.MULTIPLY);
  });
  scene.tweens.add({
    targets: image,
    x: baseX + SHAKE_PX,
    duration: SHAKE_MS,
    yoyo: true,
    repeat: SHAKE_REPEATS,
    ease: 'Sine.easeInOut',
    onComplete: () => {
      if (!image.active) return;
      image.x = baseX;
      burst(scene, image);
      image.destroy();
    },
  });
}

function burst(scene: Phaser.Scene, image: Phaser.GameObjects.Image): void {
  const frame = image.frame;
  const frameW = frame.width;
  const frameH = frame.height;
  const pieceW = frameW / PIECE_COLS;
  const pieceH = frameH / PIECE_ROWS;

  for (let row = 0; row < PIECE_ROWS; row++) {
    for (let col = 0; col < PIECE_COLS; col++) {
      // Centro do pedaço no quadro (px de arte) e onde ele está no mundo agora.
      const centerX = col * pieceW + pieceW / 2;
      const centerY = row * pieceH + pieceH / 2;
      const worldX = image.x + (centerX - frameW * image.originX) * image.scaleX;
      const worldY = image.y + (centerY - frameH * image.originY) * image.scaleY;

      const piece = scene.add.image(worldX, worldY, image.texture.key, frame.name);
      piece.setOrigin(centerX / frameW, centerY / frameH); // gira em torno do próprio centro
      piece.setScale(image.scaleX, image.scaleY);
      piece.setCrop(col * pieceW, row * pieceH, pieceW, pieceH);
      piece.setDepth(image.depth + 1);

      // Pra fora a partir do centro do objeto (com um empurrãozinho aleatório), sobe um pouco e cai.
      const outX = centerX - frameW / 2 || Phaser.Math.FloatBetween(-1, 1);
      const direction = Math.sign(outX) || 1;
      const scatter = Phaser.Math.Between(SCATTER_MIN, SCATTER_MAX);
      const lift = (PIECE_ROWS - 1 - row) * 0.5 + Phaser.Math.FloatBetween(0.2, 1); // pedaços de cima voam mais alto
      scene.tweens.add({
        targets: piece,
        x: { value: worldX + direction * scatter + Phaser.Math.Between(-6, 6), duration: PIECE_MS, ease: 'Cubic.easeOut' },
        y: { value: worldY - TOSS_UP * lift + FALL_DOWN, duration: PIECE_MS, ease: 'Back.easeIn', easeParams: [1.4] },
        angle: { value: Phaser.Math.Between(-220, 220), duration: PIECE_MS },
        scale: { value: image.scaleX * 0.6, duration: PIECE_MS },
        alpha: { value: 0, duration: PIECE_MS * 0.6, delay: PIECE_MS * 0.4 },
        onComplete: () => piece.destroy(),
      });
    }
  }

  // Poeira na base do objeto.
  const baseY = image.y + (1 - image.originY) * frameH * image.scaleY;
  for (let i = 0; i < DUST_COUNT; i++) {
    const dust = createGroundShadow(scene, image.x + Phaser.Math.Between(-10, 10), baseY - 4, DISPLAY_SCALE * 0.6, DISPLAY_SCALE * 0.45);
    dust.setTint(DUST_TINT);
    dust.setTintMode(Phaser.TintModes.FILL);
    dust.setAlpha(0.8);
    dust.setDepth(image.depth + 2);
    scene.tweens.add({
      targets: dust,
      x: dust.x + Phaser.Math.Between(-14, 14),
      y: dust.y - Phaser.Math.Between(6, 16),
      scaleX: dust.scaleX * 2.4,
      scaleY: dust.scaleY * 2.4,
      alpha: 0,
      duration: DUST_MS,
      delay: i * 40,
      ease: 'Cubic.easeOut',
      onComplete: () => dust.destroy(),
    });
  }
}
