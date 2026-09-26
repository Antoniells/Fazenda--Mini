import Phaser from 'phaser';
import {
  VILLAGE_ASSETS,
  VILLAGE_FOUNTAIN_FRAMES,
  VILLAGE_FOUNTAIN_FRAME_MS,
  VILLAGE_PROPS,
  VILLAGE_STRUCTURES,
  VILLAGE_TREES,
  VILLAGE_WELL,
  structureBaseRow,
} from '../data/maps/villageMap';
import { WELL } from '../data/decorations';
import { PINE_TREE_KEY, PINE_TREE_PATH, PINE_TREE_FRAME_NAME, PINE_TREE_FRAME, TILE_SIZE } from '../data/tiles';
import { DISPLAY_SCALE } from './mapBuilder';
import { buildExternalTree, registerFrame } from './externalMapBuilder';
import { buildMapProps } from './mapProps';
import { addBuildingShadows, createGroundShadow } from './shadow';

/** Carrega as artes do vilarejo (casas, banca, chafariz, pinheiro e a arte do poço) — chamado no `preload` da `VillageScene`. */
export function preloadVillage(scene: Phaser.Scene): void {
  for (const asset of Object.values(VILLAGE_ASSETS)) scene.load.image(asset.key, encodeURI(`/${asset.path}`));
  scene.load.image(PINE_TREE_KEY, encodeURI(`/${PINE_TREE_PATH}`));
  scene.load.image(WELL.textureKey, encodeURI(`/${WELL.texturePath}`));
}

/**
 * Desenha o vilarejo (layout em `data/maps/villageMap.ts`): casas, banca e chafariz (animado) — cada uma com a profundidade na BASE
 * das paredes (o jogador passa atrás do telhado e na frente da porta, como na casa dele) —, o poço da praça, os pinheiros e as flores.
 * A colisão NÃO é criada aqui: vem da mesma fonte, em `systems/grid.ts`. Devolve as árvores, pra transparência de sobreposição
 * (`systems/treeOverlap.ts`) valer aqui também.
 */
export function buildVillage(scene: Phaser.Scene): { trees: Phaser.GameObjects.Image[] } {
  const tile = TILE_SIZE * DISPLAY_SCALE;

  for (const structure of VILLAGE_STRUCTURES) {
    const asset = VILLAGE_ASSETS[structure.asset];
    const frameName = 'frame' in asset ? `${asset.key}-frame` : undefined;
    if ('frame' in asset) registerFrame(scene, asset.key, { name: `${asset.key}-frame`, rect: asset.frame });

    const image = scene.add.image(structure.col * tile, structure.row * tile, asset.key, frameName);
    image.setOrigin(0, 0);
    image.setScale(DISPLAY_SCALE);
    image.setDepth((structureBaseRow(structure) + 1) * tile);

    if (structure.asset === 'fountain') animateFountain(scene, image);
    else if (HOUSE_ASSETS.has(structure.asset)) addBuildingShadows(scene, image);  }

  // Poço da praça: mesma arte do Poço construível, ocupando 2x1 células.
  registerFrame(scene, WELL.textureKey, { name: WELL.frameName, rect: WELL.frameRect });
  const well = scene.add.image(VILLAGE_WELL.col * tile + tile, (VILLAGE_WELL.row + 1) * tile, WELL.textureKey, WELL.frameName);
  well.setOrigin(0.5, 1);
  well.setScale(DISPLAY_SCALE);
  well.setDepth(well.y);
  createGroundShadow(scene, well.x, well.y - 4, DISPLAY_SCALE * 1.3, DISPLAY_SCALE * 0.5).setDepth(-0.4);

  registerFrame(scene, PINE_TREE_KEY, { name: PINE_TREE_FRAME_NAME, rect: PINE_TREE_FRAME });
  const trees = VILLAGE_TREES.map(([col, row]) => buildExternalTree(scene, TILE_SIZE, col, row, 'pine'));

  buildMapProps(scene, TILE_SIZE, VILLAGE_PROPS);
  return { trees };
}

/** Estruturas que são CASAS (ganham sombra colada na base da parede, `addBuildingShadows`): a banca e o chafariz não. */
const HOUSE_ASSETS = new Set<string>(['house2', 'house3', 'house7', 'house8']);
/** Chafariz: troca os 4 quadros da folha em loop (o timer se remove sozinho quando a imagem some, com a cena). */
function animateFountain(scene: Phaser.Scene, image: Phaser.GameObjects.Image): void {
  const asset = VILLAGE_ASSETS.fountain;
  for (const frame of VILLAGE_FOUNTAIN_FRAMES) registerFrame(scene, asset.key, frame);
  image.setFrame(VILLAGE_FOUNTAIN_FRAMES[0].name);

  let index = 0;
  const timer = scene.time.addEvent({
    delay: VILLAGE_FOUNTAIN_FRAME_MS,
    loop: true,
    callback: () => {
      if (!image.active) {
        timer.remove();
        return;
      }
      index = (index + 1) % VILLAGE_FOUNTAIN_FRAMES.length;
      image.setFrame(VILLAGE_FOUNTAIN_FRAMES[index].name);
    },
  });
}
