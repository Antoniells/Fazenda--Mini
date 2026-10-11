import Phaser from 'phaser';
import type { SeasonId } from '../data/seasons';
import type { TreeSpecies } from '../data/trees';
import { BIRCH_TREE_FRAME, BIRCH_TREE_FRAME_NAME, BIRCH_TREE_KEY, OAK_TREE_FRAMES, OAK_TREE_KEY, PINE_TREE_FRAME, PINE_TREE_FRAME_NAME, PINE_TREE_KEY, PINK_OAK_MATURE_FRAME } from '../data/tiles';
import { currentGroundSeason } from './seasonalGround';

/**
 * AS ÁRVORES DE CADA ESTAÇÃO: as folhas do pacote já trazem a árvore adulta nas cores do ano, lado a lado na mesma linha (conferido por
 * recorte/ampliação):
 * - `Pine Tree.png`: x 96 verde, x 128 com neve → o Pinheiro segue verde no Outono e fica nevado no Inverno.
 * - `Birch Tree.png`: x 96 verde, x 128 vermelha, x 160 branca → a Bétula fica vermelha no Outono e branca no Inverno.
 * - `Cherry Tree.png` (o Carvalho, quadros de 32x48): 6 verde, 4 rosa florida (o Carvalho Rosa), 7 vermelha, 8 branca → os dois carvalhos
 *   ficam vermelhos no Outono e brancos no Inverno; na Primavera e no Verão, cada um com a sua copa.
 * Só a adulta muda (broto e muda são iguais o ano todo). A estação é a do chão da cena (`currentGroundSeason`).
 */

const PINE_SNOW_FRAME = { name: 'pine-tree-snow', rect: { x: 128, y: PINE_TREE_FRAME.y, width: PINE_TREE_FRAME.width, height: PINE_TREE_FRAME.height } };
const BIRCH_AUTUMN_FRAME = { name: 'birch-tree-autumn', rect: { ...BIRCH_TREE_FRAME, x: 128 } };
const BIRCH_WINTER_FRAME = { name: 'birch-tree-winter', rect: { ...BIRCH_TREE_FRAME, x: 160 } };
const OAK_AUTUMN_FRAME = 7;
const OAK_WINTER_FRAME = 8;

function registered(scene: Phaser.Scene, key: string, frame: { name: string; rect: { x: number; y: number; width: number; height: number } }): string {
  const texture = scene.textures.get(key);
  if (!texture.has(frame.name)) texture.add(frame.name, 0, frame.rect.x, frame.rect.y, frame.rect.width, frame.rect.height);
  return frame.name;
}

/** A árvore ADULTA de `species` na estação `season` (padrão: a do chão da cena) — textura e quadro. */
export function seasonalMatureTree(
  scene: Phaser.Scene,
  species: TreeSpecies,
  season: SeasonId = currentGroundSeason(),
): { textureKey: string; frameName: string | number } {
  if (species === 'birch') {
    if (season === 'autumn') return { textureKey: BIRCH_TREE_KEY, frameName: registered(scene, BIRCH_TREE_KEY, BIRCH_AUTUMN_FRAME) };
    if (season === 'winter') return { textureKey: BIRCH_TREE_KEY, frameName: registered(scene, BIRCH_TREE_KEY, BIRCH_WINTER_FRAME) };
    return { textureKey: BIRCH_TREE_KEY, frameName: registered(scene, BIRCH_TREE_KEY, { name: BIRCH_TREE_FRAME_NAME, rect: BIRCH_TREE_FRAME }) };
  }
  if (species === 'oak' || species === 'pink-oak') {
    if (season === 'autumn') return { textureKey: OAK_TREE_KEY, frameName: OAK_AUTUMN_FRAME };
    if (season === 'winter') return { textureKey: OAK_TREE_KEY, frameName: OAK_WINTER_FRAME };
    return { textureKey: OAK_TREE_KEY, frameName: species === 'pink-oak' ? PINK_OAK_MATURE_FRAME : OAK_TREE_FRAMES.mature };
  }
  if (season === 'winter') return { textureKey: PINE_TREE_KEY, frameName: registered(scene, PINE_TREE_KEY, PINE_SNOW_FRAME) };
  return { textureKey: PINE_TREE_KEY, frameName: registered(scene, PINE_TREE_KEY, { name: PINE_TREE_FRAME_NAME, rect: PINE_TREE_FRAME }) };
}
