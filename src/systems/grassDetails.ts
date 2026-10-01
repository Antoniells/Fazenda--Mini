import Phaser from 'phaser';
import { FarmMapData } from '../data/maps/farmMap';
import { GRASS_DETAILS_KEY, GRASS_DETAILS, GRASS_BLADE_DETAILS, WILD_GRASS_DETAIL, GrassDetailDefinition } from '../data/grassDetails';
import { GRASS_FLAT_TILE_INDEX, GRASS_FLAT_DARK_TILE_INDEX } from '../data/tiles';
import { hash2D } from './groundVariation';
import { DirtZone } from './dirtPaths';
import { DISPLAY_SCALE } from './mapBuilder';
import { pushPlant, registerSway } from './foliageSway';

/**
 * Detalhes soltos de grama (tufo, cogumelo, pedrinha, florzinha) — melhoria
 * puramente visual: espalhados de forma determinística (mesma célula do
 * mapa = sempre o mesmo resultado, igual às outras melhorias de chão desta
 * fase) pela grama do núcleo, evitando lavoura, caminho de terra, casa,
 * loja, caixa de remessas e árvores. Sem colisão nem interação — o jogador
 * simplesmente anda por cima, igual grama comum.
 */
const DETAIL_CHANCE = 0.05;
/** Chance (por célula livre, em outra camada de sorteio) de nascer um dos 3 tufos de lâminas finas (`GRASS_BLADE_DETAILS`). */
const BLADE_CHANCE = 0.04;
/** Profundidade fixa dos detalhes "achatados" (cogumelo/pedrinha/florzinha): acima do chão (-1) e do caminho de terra (mesma camada), abaixo de tudo ordenado por Y (personagem, árvores). */
const DETAIL_DEPTH = -0.6;

/**
 * IDs numéricos de tile (`FarmMapData.ground[row][col]`, GID do
 * `GRASS_TILESET_KEY` — ver `MapEditorScene.GROUND_TILESETS`) que contam
 * como "Grama de verdade" pra fins de espalhar detalhe — os dois únicos
 * índices que `systems/groundVariation.pickGroundTileVariant` de fato gera
 * (tom claro/escuro da grama plana). Qualquer outro valor pintado no editor
 * na MESMA camada de chão — piso/solo (`SOIL_TILESET_KEY`, GID 2000+),
 * água (`WATER_KEY`, GID 3000+), ou até outro tile do próprio tileset de
 * grama que não seja um desses dois (ex.: as peças de caminho de terra,
 * `data/tiles.ts` `DIRT_BLOB_*`) — NÃO deve receber tufo/cogumelo/pedrinha/
 * florzinha por cima.
 */
export const GRASS_TILE_IDS: readonly number[] = [GRASS_FLAT_TILE_INDEX, GRASS_FLAT_DARK_TILE_INDEX];

/**
 * `map.ground` é opcional (ver doc do campo em `data/maps/farmMap.ts`): sem
 * ele autorado, o chão desta célula é sempre gerado por
 * `pickGroundTileVariant`/`pickDirtBlobTile` — o caminho de terra já é
 * filtrado à parte por `dirtZone.has(...)` em `buildGrassDetails`, então
 * "sem dado autorado" significa sempre grama de verdade aqui.
 */
function isGrassTile(map: FarmMapData, col: number, row: number): boolean {
  const tileId = map.ground?.[row]?.[col];
  return tileId === undefined || GRASS_TILE_IDS.includes(tileId);
}

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
export function registerGrassDetailFrames(scene: Phaser.Scene, details: GrassDetailDefinition[] = [...GRASS_DETAILS, ...GRASS_BLADE_DETAILS, WILD_GRASS_DETAIL]): void {
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

/** Os detalhes desenhados por cena (uma imagem por célula) e o mapa de "balançáveis" a que pertencem — pra poder tirar os que ficam sob uma construção (`removeGrassDetailsAt`). */
interface DetailEntry {
  images: Map<string, Phaser.GameObjects.Image>;
  rustling: GrassTuftMap;
}
const detailRegistry = new WeakMap<Phaser.Scene, DetailEntry>();

function entryFor(scene: Phaser.Scene, rustling: GrassTuftMap): DetailEntry {
  let entry = detailRegistry.get(scene);
  if (!entry || entry.rustling !== rustling) {
    entry = { images: new Map(), rustling };
    detailRegistry.set(scene, entry);
  }
  return entry;
}

/** Tira (destrói) os detalhes de grama — tufos, lâminas, cogumelos, flores, pedrinhas — das células dadas: o que estava debaixo de uma construção que acabou de ser posta. */
export function removeGrassDetailsAt(scene: Phaser.Scene, cells: Array<{ col: number; row: number }>): void {
  const entry = detailRegistry.get(scene);
  if (!entry) return;
  for (const { col, row } of cells) {
    const key = cellKey(col, row);
    entry.images.get(key)?.destroy();
    entry.images.delete(key);
    entry.rustling.delete(key);
  }
}

/**
 * Detalhes que ganham profundidade dinâmica + podem balançar ao jogador
 * pisar em cima — tufo de grama e cogumelo (pedido explícito do usuário:
 * "regra padrão" pra qualquer moita/cogumelo do jogo, não só a Fazenda).
 * Pedrinha/florzinha continuam "achatadas" no chão, só decoração.
 */
export const RUSTLING_DETAIL_IDS: readonly string[] = ['tuft', 'mushroom', ...GRASS_BLADE_DETAILS.map((detail) => detail.id)];

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
  entryFor(scene, rustling).images.set(cellKey(col, row), image);

  if (isRustling) {
    image.setOrigin(0.5, 1);
    image.setDepth(y);
    rustling.set(cellKey(col, row), image);
    registerSway(image, 'grass');
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
export function buildGrassDetails(scene: Phaser.Scene, map: FarmMapData, dirtZone: DirtZone, extraExclude: ReadonlySet<string> = new Set()): GrassTuftMap {
  registerGrassDetailFrames(scene);

  const exclude = buildExcludeSet(map);
  for (const key of extraExclude) exclude.add(key); // Sob construções (e obras) da Fazenda não nasce planta.
  const tile = map.tileSize * DISPLAY_SCALE;
  const rustling: GrassTuftMap = new Map();
  detailRegistry.set(scene, { images: new Map(), rustling });
  const placed = new Set<string>();

  for (let row = 0; row < map.rows; row++) {
    for (let col = 0; col < map.cols; col++) {
      const key = cellKey(col, row);
      if (exclude.has(key) || dirtZone.has(col, row) || !isGrassTile(map, col, row)) continue;

      // Offset diferente do usado em `groundVariation`/`dirtPaths` na mesma
      // célula, pra não correlacionar com a variação de tom da grama nem
      // com as manchas de terra (senão os padrões "andariam juntos").
      if (hash2D(col * 733 + 41, row * 977 + 83) >= DETAIL_CHANCE) continue;

      const detailIndex = Math.floor(hash2D(col, row) * GRASS_DETAILS.length) % GRASS_DETAILS.length;
      placeGrassDetail(scene, tile, col, row, GRASS_DETAILS[detailIndex], rustling);
      placed.add(key);
    }
  }

  // Segunda camada: os tufos de lâminas finas, sorteados à parte (não mexem em onde caem os detalhes de cima) e nunca em cima de um deles.
  for (let row = 0; row < map.rows; row++) {
    for (let col = 0; col < map.cols; col++) {
      const key = cellKey(col, row);
      if (placed.has(key) || exclude.has(key) || dirtZone.has(col, row) || !isGrassTile(map, col, row)) continue;
      if (hash2D(col * 419 + 17, row * 613 + 29) >= BLADE_CHANCE) continue;

      const bladeIndex = Math.floor(hash2D(col * 271 + 5, row * 337 + 11) * GRASS_BLADE_DETAILS.length) % GRASS_BLADE_DETAILS.length;
      placeGrassDetail(scene, tile, col, row, GRASS_BLADE_DETAILS[bladeIndex], rustling);
    }
  }

  return rustling;
}

/**
 * Balanço do tufo de grama ao jogador pisar em cima (pedido explícito do
 * usuário) — o mesmo empurrão de `FarmlandRenderer.rustleCrop` (`pushPlant`:
 * pende pro lado do passo, `direction`), só que lendo de `GrassTuftMap` em
 * vez do mapa de plantações. Chamado direto do listener de `'player-stepped'` (ver
 * `MainScene`) — `Map.get` é O(1), então não pesa checar a cada passo.
 */
export function rustleGrassTuft(_scene: Phaser.Scene, tufts: GrassTuftMap, col: number, row: number, direction = 1): void {
  const image = tufts.get(cellKey(col, row));
  if (image) pushPlant(image, direction); // Pende pro lado em que o personagem anda (`systems/foliageSway.ts`).
}
