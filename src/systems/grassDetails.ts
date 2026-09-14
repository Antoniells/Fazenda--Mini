import Phaser from 'phaser';
import { FarmMapData } from '../data/maps/farmMap';
import { GRASS_DETAILS_KEY, GRASS_DETAILS } from '../data/grassDetails';
import { hash2D } from './groundVariation';
import { DirtZone } from './dirtPaths';
import { DISPLAY_SCALE } from './mapBuilder';

/**
 * Detalhes soltos de grama (tufo, cogumelo, pedrinha, florzinha) — melhoria
 * puramente visual: espalhados de forma determinística (mesma célula do
 * mapa = sempre o mesmo resultado, igual às outras melhorias de chão desta
 * fase) pela grama do núcleo, evitando lavoura, caminho de terra, casa,
 * loja, caixa de remessas e árvores. Sem colisão nem interação — o jogador
 * simplesmente anda por cima, igual grama comum.
 */
const DETAIL_CHANCE = 0.05;
/** Profundidade fixa: acima do chão (-1) e do caminho de terra (mesma camada), abaixo de tudo ordenado por Y (personagem, árvores). */
const DETAIL_DEPTH = -0.6;

function buildExcludeSet(map: FarmMapData): Set<string> {
  const exclude = new Set<string>();
  for (const [col, row] of map.farmlandArea) exclude.add(`${col},${row}`);
  for (let row = map.housePosition.row0; row < map.housePosition.row0 + map.housePosition.rows; row++) {
    for (let col = map.housePosition.col0; col < map.housePosition.col0 + map.housePosition.cols; col++) {
      exclude.add(`${col},${row}`);
    }
  }
  exclude.add(`${map.shopPosition[0]},${map.shopPosition[1]}`);
  exclude.add(`${map.shippingBinPosition[0]},${map.shippingBinPosition[1]}`);
  for (const [col, row] of map.treePositions) exclude.add(`${col},${row}`);
  return exclude;
}

function registerFrames(scene: Phaser.Scene): void {
  const texture = scene.textures.get(GRASS_DETAILS_KEY);
  for (const detail of GRASS_DETAILS) {
    if (texture.has(detail.frameName)) continue;
    const { x, y, width, height } = detail.frameRect;
    texture.add(detail.frameName, 0, x, y, width, height);
  }
}

/**
 * Espalha os detalhes pelo núcleo da propriedade (`map.cols` x `map.rows`).
 * Chamado uma vez, junto com o resto do cenário estático — devolve as
 * imagens criadas só por simetria com `buildFarmDecorations`/etc, embora
 * ninguém precise mexer nelas depois (não têm estado próprio).
 */
export function buildGrassDetails(scene: Phaser.Scene, map: FarmMapData, dirtZone: DirtZone): Phaser.GameObjects.Image[] {
  registerFrames(scene);

  const exclude = buildExcludeSet(map);
  const tile = map.tileSize * DISPLAY_SCALE;
  const created: Phaser.GameObjects.Image[] = [];

  for (let row = 0; row < map.rows; row++) {
    for (let col = 0; col < map.cols; col++) {
      const key = `${col},${row}`;
      if (exclude.has(key) || dirtZone.has(col, row)) continue;

      // Offset diferente do usado em `groundVariation`/`dirtPaths` na mesma
      // célula, pra não correlacionar com a variação de tom da grama nem
      // com as manchas de terra (senão os padrões "andariam juntos").
      if (hash2D(col * 733 + 41, row * 977 + 83) >= DETAIL_CHANCE) continue;

      const detailIndex = Math.floor(hash2D(col, row) * GRASS_DETAILS.length) % GRASS_DETAILS.length;
      const detail = GRASS_DETAILS[detailIndex];

      const x = col * tile + tile / 2;
      const y = row * tile + tile / 2;
      const image = scene.add.image(x, y, GRASS_DETAILS_KEY, detail.frameName);
      image.setOrigin(0.5, 0.5);
      image.setScale(DISPLAY_SCALE);
      image.setDepth(DETAIL_DEPTH);
      created.push(image);
    }
  }

  return created;
}
