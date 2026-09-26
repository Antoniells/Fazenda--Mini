import Phaser from 'phaser';
import { SHADOW_KEY, SHADOW_FRAME_NAME, SHADOW_FRAME, SHADOW_FLAT_FRAME_NAME, SHADOW_FLAT_FRAME } from '../data/effects';

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

/** Altura (px de mundo) da faixa de sombra de uma casa, contada a partir da base da parede pra baixo. */
const BUILDING_SHADOW_HEIGHT_PX = 12;
/** Pixel com alfa acima disto (0-255) conta como parede na leitura da base da arte. */
const WALL_ALPHA_MIN = 40;
/** Diferença (px nativos) de base entre colunas vizinhas a partir da qual começa OUTRO trecho (degrau da casa: ala mais recuada, alpendre...). */
const BASE_STEP_PX = 2;
/** Trechos mais estreitos que isto (px nativos) — um pilar, a ponta de um beiral — não ganham sombra própria. */
const MIN_SEGMENT_PX = 12;

/**
 * Sombras ao pé de uma casa (pedido explícito): faixas RETAS, de bordas retas, COLADAS na base da parede — a borda de cima de cada faixa é exatamente
 * a última linha opaca da arte. Casas não têm a base toda na mesma linha (a ala do fundo, o alpendre), então a arte da imagem é LIDA coluna a coluna
 * (a última linha opaca de cada uma, `textures.getPixelAlpha`) e cada trecho de base contínua ganha a sua faixa: uma casa reta tem uma só, uma em L tem duas,
 * cada qual rente à própria base. É o quadro liso de `Tileset/Shadow.png` (`SHADOW_FLAT_FRAME`) esticado: sem cantos arredondados nem ondulação.
 * `image` tem que estar ancorada no canto superior esquerdo (origem 0,0) e sem rotação; as faixas ficam abaixo de tudo o que é ordenado por Y.
 */
export function addBuildingShadows(scene: Phaser.Scene, image: Phaser.GameObjects.Image): Phaser.GameObjects.Image[] {
  const texture = scene.textures.get(SHADOW_KEY);
  if (!texture.has(SHADOW_FLAT_FRAME_NAME)) {
    texture.add(SHADOW_FLAT_FRAME_NAME, 0, SHADOW_FLAT_FRAME.x, SHADOW_FLAT_FRAME.y, SHADOW_FLAT_FRAME.width, SHADOW_FLAT_FRAME.height);
  }

  const { key } = image.texture;
  const frameName = image.frame.name;
  const width = image.frame.width;
  const height = image.frame.height;

  // Última linha opaca de cada coluna (-1 = coluna vazia).
  const base: number[] = [];
  for (let x = 0; x < width; x++) {
    let last = -1;
    for (let y = height - 1; y >= 0; y--) {
      if (scene.textures.getPixelAlpha(x, y, key, frameName) > WALL_ALPHA_MIN) {
        last = y;
        break;
      }
    }
    base.push(last);
  }

  // Trechos de base contínua (colunas vizinhas com a mesma linha, ± `BASE_STEP_PX`).
  const shadows: Phaser.GameObjects.Image[] = [];
  const scaleX = image.scaleX;
  const scaleY = image.scaleY;
  let start = 0;
  const flush = (from: number, to: number): void => {
    if (to - from + 1 < MIN_SEGMENT_PX || base[from] < 0) return;
    let baseRow = 0;
    for (let x = from; x <= to; x++) baseRow = Math.max(baseRow, base[x]);
    const shadow = scene.add.image(image.x + ((from + to + 1) / 2) * scaleX, image.y + baseRow * scaleY, SHADOW_KEY, SHADOW_FLAT_FRAME_NAME);
    shadow.setOrigin(0.5, 0);
    shadow.setScale(((to - from + 1) * scaleX) / SHADOW_FLAT_FRAME.width, BUILDING_SHADOW_HEIGHT_PX / SHADOW_FLAT_FRAME.height);
    shadow.setDepth(-0.4);
    shadows.push(shadow);
  };
  for (let x = 1; x <= width; x++) {
    if (x < width && base[x] >= 0 && base[start] >= 0 && Math.abs(base[x] - base[x - 1]) <= BASE_STEP_PX) continue;
    flush(start, x - 1);
    start = x;
  }
  return shadows;
}
