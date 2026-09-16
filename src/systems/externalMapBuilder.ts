import Phaser from 'phaser';
import {
  PINE_TREE_KEY,
  PINE_TREE_FRAME_NAME,
  PINE_SPROUT_FRAME_NAME,
  PINE_SPROUT_FRAME,
  PINE_YOUNG_FRAME_NAME,
  PINE_YOUNG_FRAME,
  BIRCH_TREE_KEY,
  BIRCH_TREE_FRAME_NAME,
  BIRCH_TREE_FRAME,
  ROCK_KEY,
  ROCK_FRAME_1,
  ROCK_FRAME_2,
  ROCK_BIG_SCALE_MULT,
  ORE_KEY,
  ORE_IRON_FRAME,
  ORE_COAL_FRAME,
  CAVE_ENTRANCE_KEY,
  CAVE_ENTRANCE_FRAME,
  WATER_KEY,
} from '../data/tiles';
import { createGroundShadow } from './shadow';
import { DISPLAY_SCALE } from './mapBuilder';
import { TreeStage } from './resourceNodeRegistry';
import { WalkableGrid } from './grid';
import { hash2D } from './groundVariation';
import { GRASS_DETAILS } from '../data/grassDetails';
import { registerGrassDetailFrames, placeGrassDetail, GrassTuftMap } from './grassDetails';

/** Sprite + sombra (quando houver) de um recurso plantado no mundo — devolvido para quem precisa poder destruir os dois juntos ao colher (ver `systems/resourceInteraction.ts`). */
export interface WorldResourceVisual {
  sprite: Phaser.GameObjects.Image;
  shadow?: Phaser.GameObjects.Image;
}

/**
 * Construtores de decoração compartilhados pelas 4 cenas externas
 * (Floresta/Pedreira/Caverna/Praia — ver `scenes/ExternalMapScene.ts`),
 * mesma técnica (âncora + sombra + depth por Y) já usada em
 * `systems/mapBuilder.ts` pras árvores/objetos estáticos da Fazenda — não
 * reaproveitei as funções de lá porque são específicas de `FarmMapData`
 * (leem `farmMap.treePositions`/etc. diretamente), enquanto aqui cada cena
 * passa suas próprias posições.
 */
const STATIC_SHADOW_DEPTH = -0.4;

/** Exportada: `systems/treePlanting.ts` também precisa registrar os frames de broto/muda pra usar no "fantasma" de plantio, antes de qualquer árvore existir de verdade. */
export function registerFrame(
  scene: Phaser.Scene,
  textureKey: string,
  frame: { name: string; rect: { x: number; y: number; width: number; height: number } },
): void {
  const texture = scene.textures.get(textureKey);
  if (!texture.has(frame.name)) {
    texture.add(frame.name, 0, frame.rect.x, frame.rect.y, frame.rect.width, frame.rect.height);
  }
}

export type TreeSpecies = 'pine' | 'birch';

/** Árvore decorativa (Floresta) — mesma técnica de `mapBuilder.buildFarmDecorations`, generalizada para aceitar qualquer espécie/posição (não só `farmMap.treePositions` com Pinheiro fixo). */
export function buildExternalTree(scene: Phaser.Scene, tileSize: number, col: number, row: number, species: TreeSpecies): Phaser.GameObjects.Image {
  const tile = tileSize * DISPLAY_SCALE;
  const x = col * tile + tile / 2;
  const y = (row + 1) * tile;

  const shadow = createGroundShadow(scene, x, y - 6, DISPLAY_SCALE * 1.5, DISPLAY_SCALE * 0.6);
  shadow.setDepth(STATIC_SHADOW_DEPTH);

let tree: Phaser.GameObjects.Image;
  if (species === 'birch') {
    registerFrame(scene, BIRCH_TREE_KEY, { name: BIRCH_TREE_FRAME_NAME, rect: BIRCH_TREE_FRAME });
    tree = scene.add.image(x, y, BIRCH_TREE_KEY, BIRCH_TREE_FRAME_NAME);
  } else {
    tree = scene.add.image(x, y, PINE_TREE_KEY, PINE_TREE_FRAME_NAME);
  }
  tree.setOrigin(0.5, 1);
  tree.setScale(DISPLAY_SCALE);
  tree.setDepth(tree.y);

  return tree;
}

/**
 * Árvore colhível em uma das 3 fases de crescimento (Fase 7 — Coleta de
 * Recursos): broto/muda/adulta reaproveitam a MESMA folha `Pine Tree.png`
 * (ver `PINE_SPROUT_FRAME`/`PINE_YOUNG_FRAME`/`PINE_TREE_FRAME` em
 * `data/tiles.ts`) — só adulta ganha sombra (as fases jovens são pequenas
 * demais pra precisar de uma, mesmo critério visual de qualquer decoração
 * baixa). Usada tanto pelo respawn selvagem (`ForestScene`) quanto por
 * bolotas plantadas na Fazenda (`systems/treePlanting.ts`).
 */
export function buildGrowingTree(scene: Phaser.Scene, tileSize: number, col: number, row: number, stage: TreeStage): WorldResourceVisual {
  registerFrame(scene, PINE_TREE_KEY, { name: PINE_SPROUT_FRAME_NAME, rect: PINE_SPROUT_FRAME });
  registerFrame(scene, PINE_TREE_KEY, { name: PINE_YOUNG_FRAME_NAME, rect: PINE_YOUNG_FRAME });

  const frameName = stage === 'sprout' ? PINE_SPROUT_FRAME_NAME : stage === 'young' ? PINE_YOUNG_FRAME_NAME : PINE_TREE_FRAME_NAME;

  const tile = tileSize * DISPLAY_SCALE;
  const x = col * tile + tile / 2;
  const y = (row + 1) * tile;

  let shadow: Phaser.GameObjects.Image | undefined;
if (stage === 'mature') {
    shadow = createGroundShadow(scene, x, y - 6, DISPLAY_SCALE * 1.5, DISPLAY_SCALE * 0.6);
    shadow.setDepth(STATIC_SHADOW_DEPTH);
  }

  const sprite = scene.add.image(x, y, PINE_TREE_KEY, frameName);
  sprite.setOrigin(0.5, 1);
  sprite.setScale(DISPLAY_SCALE);
  sprite.setDepth(sprite.y);

  return { sprite, shadow };
}

/**
 * Pedra pequena ou rocha grande (`big`, Fase 7 — mesmo asset numa escala
 * maior, ver comentário de `ROCK_BIG_SCALE_MULT` em `data/tiles.ts`) —
 * alterna entre as 2 variações disponíveis (`variant` 0 ou 1) pra não
 * repetir sempre a mesma.
 */
export function buildRock(scene: Phaser.Scene, tileSize: number, col: number, row: number, variant: 0 | 1 = 0, big = false): WorldResourceVisual {
  const frame = variant === 0 ? ROCK_FRAME_1 : ROCK_FRAME_2;
  registerFrame(scene, ROCK_KEY, frame);

  const tile = tileSize * DISPLAY_SCALE;
  const x = col * tile + tile / 2;
  const y = (row + 1) * tile;
  const scale = DISPLAY_SCALE * (big ? ROCK_BIG_SCALE_MULT : 1);

  const shadow = createGroundShadow(scene, x, y, scale * 0.9, scale * 0.4);
  shadow.setDepth(STATIC_SHADOW_DEPTH);

  const sprite = scene.add.image(x, y, ROCK_KEY, frame.name);
  sprite.setOrigin(0.5, 1);
  sprite.setScale(scale);
  sprite.setDepth(sprite.y);

  return { sprite, shadow };
}

export type OreType = 'iron' | 'coal';

/** Veio de minério (Pedreira) — só decorativo por ora (ver comentário de `ORE_KEY` em `data/tiles.ts`), sem mecânica de minerar ainda. */
export function buildOreDeposit(scene: Phaser.Scene, tileSize: number, col: number, row: number, type: OreType): Phaser.GameObjects.Image {
  const frame = type === 'iron' ? ORE_IRON_FRAME : ORE_COAL_FRAME;
  registerFrame(scene, ORE_KEY, frame);

  const tile = tileSize * DISPLAY_SCALE;
  const x = col * tile + tile / 2;
  const y = (row + 1) * tile;

  const ore = scene.add.image(x, y, ORE_KEY, frame.name);
  ore.setOrigin(0.5, 1);
  ore.setScale(DISPLAY_SCALE);
  ore.setDepth(ore.y);

  return ore;
}

/** Entrada de caverna/mina (Caverna) — estrutura única e maior, ancorada pela base como os demais objetos estáticos. */
export function buildCaveEntrance(scene: Phaser.Scene, tileSize: number, col: number, row: number): Phaser.GameObjects.Image {
  registerFrame(scene, CAVE_ENTRANCE_KEY, CAVE_ENTRANCE_FRAME);

  const tile = tileSize * DISPLAY_SCALE;
  const x = col * tile + tile / 2;
  const y = (row + 1) * tile;

  const entrance = scene.add.image(x, y, CAVE_ENTRANCE_KEY, CAVE_ENTRANCE_FRAME.name);
  entrance.setOrigin(0.5, 1);
  entrance.setScale(DISPLAY_SCALE);
  entrance.setDepth(entrance.y);

  return entrance;
}

/**
 * Área retangular de água plana (pequeno lago da Floresta, mar da Praia) —
 * um único `TileSprite` repetindo `WATER_KEY` (16x16, sem frames), mais
 * simples que montar um tilemap só pra isso (ver comentário de `WATER_KEY`
 * em `data/tiles.ts`: sem borda especial de praia/lago por ora).
 */
export function buildWaterArea(scene: Phaser.Scene, tileSize: number, col0: number, row0: number, cols: number, rows: number): Phaser.GameObjects.TileSprite {
  const tile = tileSize * DISPLAY_SCALE;
  const width = cols * tile;
  const height = rows * tile;
  const x = col0 * tile;
  const y = row0 * tile;

  const water = scene.add.tileSprite(x, y, width, height, WATER_KEY);
  water.setOrigin(0, 0);
  // Tile nativo é 16px — o TileSprite precisa saber disso pra repetir na
  // escala certa (senão repetiria o tile de 16px cru, minúsculo demais).
  water.setTileScale(DISPLAY_SCALE, DISPLAY_SCALE);
  water.setDepth(-0.5);

  return water;
}

/** Fração de células andáveis que ganham um detalhe — mesma chance de `systems/grassDetails.ts` (Fazenda). */
const WILD_FOLIAGE_CHANCE = 0.05;
/** Só cogumelo/flor/tufo (pedido explícito: "cogumelos e plantinhas selvagens") — sem a pedrinha, que confundiria com as pedras de verdade colhíveis da Floresta. */
const WILD_FOLIAGE_IDS = ['mushroom', 'flower', 'tuft'];

/**
 * Espalha cogumelos/plantinhas selvagens (Fase 9 — polimento visual) pelas
 * células ANDÁVEIS de uma cena externa (Floresta) — mesma técnica
 * determinística de `systems/grassDetails.ts` (mesma célula sempre gera o
 * mesmo resultado), reaproveitando os MESMOS assets já recortados
 * (`GRASS_DETAILS`) e a MESMA função `placeGrassDetail` da Fazenda — regra
 * padrão pedida pelo usuário: tufo/cogumelo ganham profundidade dinâmica
 * (Y-sorting) + balançam ao jogador pisar em cima em QUALQUER cena do jogo,
 * não só a Fazenda (ver `GrassTuftMap`/`rustleGrassTuft`). Decidido a partir
 * do `WalkableGrid` da cena (já exclui borda/água/árvores/pedras/ponte) em
 * vez dos dados específicos da Fazenda. Chamado no FIM de `buildMapContent`,
 * depois de todo obstáculo já ter bloqueado sua célula no grid.
 */
export function buildWildFoliage(scene: Phaser.Scene, tileSize: number, grid: WalkableGrid): GrassTuftMap {
  const details = GRASS_DETAILS.filter((detail) => WILD_FOLIAGE_IDS.includes(detail.id));
  registerGrassDetailFrames(scene, details);

  const tile = tileSize * DISPLAY_SCALE;
  const rustling: GrassTuftMap = new Map();

  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      if (!grid.isWalkable(col, row)) continue;
      // Offset diferente do usado em qualquer outra decisão hash na mesma
      // célula, pra não correlacionar com variação de chão/outros sistemas.
      if (hash2D(col * 911 + 271, row * 1013 + 349) >= WILD_FOLIAGE_CHANCE) continue;

      const detailIndex = Math.floor(hash2D(col, row) * details.length) % details.length;
      placeGrassDetail(scene, tile, col, row, details[detailIndex], rustling);
    }
  }

  return rustling;
}

/** Bloco de células (col,row) cobertas por uma área de água — pra bloquear no `WalkableGrid` (não dá pra andar sobre a água). */
export function waterAreaCells(col0: number, row0: number, cols: number, rows: number): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  for (let row = row0; row < row0 + rows; row++) {
    for (let col = col0; col < col0 + cols; col++) {
      cells.push([col, row]);
    }
  }
  return cells;
}
