import Phaser from 'phaser';
import { FarmMapData } from '../data/maps/farmMap';
import { GRASS_DETAILS_KEY, GRASS_DETAILS, GrassDetailDefinition } from '../data/grassDetails';
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
/** Profundidade fixa dos detalhes "achatados" (cogumelo/pedrinha/florzinha): acima do chão (-1) e do caminho de terra (mesma camada), abaixo de tudo ordenado por Y (personagem, árvores). */
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

/** Registra (uma vez, idempotente) os frames recortados de `GRASS_DETAILS` que ainda não existem na textura — reaproveitado tanto pela Fazenda quanto por `systems/externalMapBuilder.ts` (Floresta). */
export function registerGrassDetailFrames(scene: Phaser.Scene, details: GrassDetailDefinition[] = GRASS_DETAILS): void {
  const texture = scene.textures.get(GRASS_DETAILS_KEY);
  for (const detail of details) {
    if (texture.has(detail.frameName)) continue;
    const { x, y, width, height } = detail.frameRect;
    texture.add(detail.frameName, 0, x, y, width, height);
  }
}

function cellKey(col: number, row: number): string {
  return `${col},${row}`;
}

/**
 * Detalhes que ganham profundidade dinâmica + podem balançar ao jogador
 * pisar em cima — tufo de grama e cogumelo (pedido explícito do usuário:
 * "regra padrão" pra qualquer moita/cogumelo do jogo, não só a Fazenda).
 * Pedrinha/florzinha continuam "achatadas" no chão, só decoração.
 */
export const RUSTLING_DETAIL_IDS: readonly string[] = ['tuft', 'mushroom'];

/** Célula por célula que teve um detalhe "alto" colocado (tufo/cogumelo) — usado para tocar o balanço (`rustleGrassTuft`) quando o jogador pisa em cima. */
export type GrassTuftMap = Map<string, Phaser.GameObjects.Image>;

/**
 * Desenha UM detalhe de grama na célula (col, row) — tufo/cogumelo
 * (`RUSTLING_DETAIL_IDS`) ganham `origin(0.5, 1)` + profundidade dinâmica
 * (`setDepth(y)`, MESMA convenção do personagem/plantação, ancorados na
 * base da célula como um objeto "em pé") e são guardados em `rustling` para
 * poder balançar depois (`rustleGrassTuft`); os demais (pedrinha/florzinha)
 * continuam achatados no centro da célula, profundidade fixa, só decoração.
 * Função compartilhada — usada tanto por `buildGrassDetails` (Fazenda)
 * quanto por `systems/externalMapBuilder.ts` (`buildWildFoliage`, Floresta),
 * pra "moita/cogumelo" se comportar igual em qualquer cena do jogo.
 */
export function placeGrassDetail(
  scene: Phaser.Scene,
  tile: number,
  col: number,
  row: number,
  detail: GrassDetailDefinition,
  rustling: GrassTuftMap,
): void {
  const isRustling = RUSTLING_DETAIL_IDS.includes(detail.id);
  const x = col * tile + tile / 2;
  const y = isRustling ? (row + 1) * tile : row * tile + tile / 2;

  const image = scene.add.image(x, y, GRASS_DETAILS_KEY, detail.frameName);
  image.setScale(DISPLAY_SCALE);

  if (isRustling) {
    image.setOrigin(0.5, 1);
    image.setDepth(y);
    rustling.set(cellKey(col, row), image);
  } else {
    image.setOrigin(0.5, 0.5);
    image.setDepth(DETAIL_DEPTH);
  }
}

/**
 * Espalha os detalhes pelo núcleo da propriedade (`map.cols` x `map.rows`).
 * Chamado uma vez, junto com o resto do cenário estático — ver
 * `placeGrassDetail` pra saber quais ganham profundidade dinâmica/balanço.
 */
export function buildGrassDetails(scene: Phaser.Scene, map: FarmMapData, dirtZone: DirtZone): GrassTuftMap {
  registerGrassDetailFrames(scene);

  const exclude = buildExcludeSet(map);
  const tile = map.tileSize * DISPLAY_SCALE;
  const rustling: GrassTuftMap = new Map();

  for (let row = 0; row < map.rows; row++) {
    for (let col = 0; col < map.cols; col++) {
      const key = cellKey(col, row);
      if (exclude.has(key) || dirtZone.has(col, row)) continue;

      // Offset diferente do usado em `groundVariation`/`dirtPaths` na mesma
      // célula, pra não correlacionar com a variação de tom da grama nem
      // com as manchas de terra (senão os padrões "andariam juntos").
      if (hash2D(col * 733 + 41, row * 977 + 83) >= DETAIL_CHANCE) continue;

      const detailIndex = Math.floor(hash2D(col, row) * GRASS_DETAILS.length) % GRASS_DETAILS.length;
      placeGrassDetail(scene, tile, col, row, GRASS_DETAILS[detailIndex], rustling);
    }
  }

  return rustling;
}

/**
 * Balanço do tufo de grama ao jogador pisar em cima (pedido explícito do
 * usuário) — tween IDÊNTICO ao de `FarmlandRenderer.rustleCrop` (mesmo
 * ângulo/duração/easing), só que lendo de `GrassTuftMap` em vez do mapa de
 * plantações. Chamado direto do listener de `'player-stepped'` (ver
 * `MainScene`) — `Map.get` é O(1), então não pesa checar a cada passo.
 */
export function rustleGrassTuft(scene: Phaser.Scene, tufts: GrassTuftMap, col: number, row: number): void {
  const image = tufts.get(cellKey(col, row));
  if (!image || scene.tweens.isTweening(image)) return;

  scene.tweens.add({
    targets: image,
    angle: { from: 0, to: 8 },
    duration: 120,
    yoyo: true,
    repeat: 1,
    ease: 'Sine.easeInOut',
    onComplete: () => image.setAngle(0),
  });
}
