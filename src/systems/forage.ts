import Phaser from 'phaser';
import { FORAGE_DROP, ForageKind, forageKindOfGrassDetail, forageKindOfProp } from '../data/forage';
import { SICKLE_SOUND } from '../data/audio';
import { Player } from '../entities/Player';
import { gameState } from './gameState';
import { Interactable, InteractionRegistry } from './interaction';
import { spawnLoot } from './lootDrops';
import { playEffect } from './soundEffects';
import { GRASS_DETAIL_ID_KEY } from './grassDetails';
import type { PlacedMapProp } from './mapProps';

/**
 * COLETA COM A FOICE (`data/forage.ts`): as plantinhas, flores e cogumelos da grama — da Fazenda e da Floresta — viram coletáveis. Com a
 * Foice na mão, clicar num deles leva o personagem até o lado e corta (a animação da foice, ele encolhe e some, cai 1 Capim / Flor Silvestre /
 * Cogumelo); sem a Foice, a célula se comporta como antes (o clique só anda). O que foi cortado fica em `gameState.forageCut` (vai pro save)
 * até a virada do dia, quando tudo renasce (`systems/dayCycle.ts`).
 *
 * Os enfeites continuam sendo desenhados pelos construtores de sempre (`grassDetails`, `buildWildFoliage`, `buildMapProps`); depois de TODAS as
 * outras interações da cena, a cena chama `attachGrassDetailForage`/`attachMapPropForage`: o que já foi cortado hoje sai, o resto ganha a
 * interação — numa célula que já tem outra (mato, árvore, pedra...), a outra vale e o enfeite fica só de enfeite.
 */

/** Tempo (ms) da animação de corte: a plantinha encolhe e some (o mesmo do mato). */
const CUT_MS = 140;

const cutKey = (sceneKey: string, col: number, row: number): string => `${sceneKey}|${col},${row}`;

export function isForageCut(sceneKey: string, col: number, row: number): boolean {
  return gameState.forageCut.has(cutKey(sceneKey, col, row));
}

function holdingSickle(): boolean {
  const selected = gameState.inventory.getSelectedSlot();
  return selected?.category === 'tool' && selected.id === 'sickle';
}

interface ForageTarget {
  sceneKey: string;
  player: Player;
  interactions: InteractionRegistry;
  col: number;
  row: number;
  image: Phaser.GameObjects.Image;
  kind: ForageKind;
  /** O enfeite saiu (cortado agora ou já cortado hoje): quem guarda referência a ele (o balanço ao pisar) esquece. */
  onGone: () => void;
}

class ForageInteractable implements Interactable {
  readonly interactFromAdjacent = true;
  constructor(private readonly target: ForageTarget) {}

  /** Só com a Foice na mão — sem ela, clicar na plantinha continua só andando. */
  isAvailable(): boolean {
    return holdingSickle();
  }

  interact(): void {
    cut(this.target);
  }
}

function cut(target: ForageTarget): void {
  const { player, image } = target;
  if (player.isBusy() || !image.active) return;
  const scene = image.scene;
  player.performAction(
    'harvest',
    () => {
      const key = cutKey(target.sceneKey, target.col, target.row);
      if (gameState.forageCut.has(key)) return; // Já cortado (clique duplo).
      gameState.forageCut.add(key);
      target.interactions.remove(target.col, target.row);
      target.onGone();
      spawnLoot(scene, player, image.x, image.y, { category: 'resource', id: FORAGE_DROP[target.kind], amount: 1 });
      // Encolhe e some (transformação do próprio sprite, nada desenhado por código).
      scene.tweens.add({
        targets: image,
        alpha: 0,
        scaleX: image.scaleX * 0.6,
        scaleY: image.scaleY * 1.15,
        duration: CUT_MS,
        onComplete: () => image.destroy(),
      });
    },
    () => playEffect(scene, SICKLE_SOUND),
  );
}

/** Um enfeite coletável na célula: já cortado hoje → sai; senão ganha a interação (se a célula ainda não tem outra). */
function makeForageable(target: ForageTarget): void {
  if (isForageCut(target.sceneKey, target.col, target.row)) {
    target.onGone();
    target.image.destroy();
    return;
  }
  if (target.interactions.has(target.col, target.row)) return;
  target.interactions.set(target.col, target.row, new ForageInteractable(target));
}

/**
 * Os detalhes da grama (`"col,row"` → imagem, cada imagem marcada com o id do detalhe — `placeGrassDetail`): os que são plantas viram
 * coletáveis. `rustling` (os que balançam ao pisar) também esquece os que saem.
 */
export function attachGrassDetailForage(
  sceneKey: string,
  player: Player,
  interactions: InteractionRegistry,
  images: Map<string, Phaser.GameObjects.Image>,
  rustling?: Map<string, Phaser.GameObjects.Image>,
): void {
  for (const [key, image] of [...images]) {
    const kind = forageKindOfGrassDetail(String(image.getData(GRASS_DETAIL_ID_KEY) ?? ''));
    if (!kind) continue;
    const [col, row] = key.split(',').map(Number);
    makeForageable({
      sceneKey,
      player,
      interactions,
      col,
      row,
      image,
      kind,
      onGone: () => {
        images.delete(key);
        rustling?.delete(key);
      },
    });
  }
}

/** Os props do editor (`buildMapProps`) que são plantas viram coletáveis. */
export function attachMapPropForage(sceneKey: string, player: Player, interactions: InteractionRegistry, props: PlacedMapProp[]): void {
  for (const { col, row, propId, image } of props) {
    const kind = forageKindOfProp(propId);
    if (!kind) continue;
    makeForageable({ sceneKey, player, interactions, col, row, image, kind, onGone: () => undefined });
  }
}
