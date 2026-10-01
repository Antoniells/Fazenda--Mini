import Phaser from 'phaser';
import { GRASS_DETAILS_KEY, WILD_GRASS_DETAIL } from '../data/grassDetails';
import { WILD_GRASS } from '../data/resources';
import { SICKLE_SOUND } from '../data/audio';
import { Player } from '../entities/Player';
import { gameState } from './gameState';
import { Interactable, InteractionRegistry } from './interaction';
import { resourceNodeRegistry } from './resourceNodeRegistry';
import { registerGrassDetailFrames } from './grassDetails';
import { DISPLAY_SCALE } from './mapBuilder';
import { createGroundShadow } from './shadow';
import { registerSway } from './foliageSway';
import { spawnLoot } from './lootDrops';
import { rollDoubleDrop } from './skills';
import { popText } from './floatingText';
import { playEffect } from './soundEffects';
import { tutorial } from './tutorial';

/**
 * O MATO da Fazenda (`ResourceNode.kind === 'weed'`, a moita folhosa de `ALL props seasons.png`): colhido com a FOICE (um golpe), solta 1-2
 * Capim (`WILD_GRASS`, vendável). Nasce sozinho pela grama da propriedade a cada virada de dia (`FARM_CAPS`, `systems/farmResources.ts`) — DENTRO da
 * lavoura só existe o do tutorial (`FarmResources.ensureTutorialWeed`): o mato de fora nunca invade o canteiro.
 *
 * Fora da lavoura o mato é uma célula andável que só se colhe "de fora" (`interactFromAdjacent`); dentro dela a célula já pertence ao canteiro
 * (`PlotInteractable`, que chama `cutWeedAt` antes de qualquer ação de terra) — a enxada não ara embaixo do mato.
 */

interface WeedVisual {
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  sceneKey: string;
  /** Só o mato de FORA da lavoura registra um `Interactable` próprio (que sai junto com ele). */
  ownInteraction: { interactions: InteractionRegistry } | null;
}

const key = (col: number, row: number): string => `${col},${row}`;
const weeds = new Map<string, WeedVisual>();

/** Tempo (ms) da animação de corte: a moita encolhe e some. */
const CUT_MS = 140;

/** Esquece todo o mato desenhado (a cena vai redesenhar tudo do registro) — os sprites são destruídos por quem os criou (`FarmResources.render`). */
export function clearWeedVisuals(): void {
  weeds.clear();
}

export function hasWeedAt(col: number, row: number): boolean {
  return weeds.has(key(col, row));
}

/** Tira o mato de (col, row) SEM colher (nada cai): ele estava debaixo de uma construção nova. Sai do registro (persistente) mesmo se a cena não o estiver desenhando. */
export function removeWeedAt(col: number, row: number, sceneKey: string): void {
  const weed = weeds.get(key(col, row));
  if (weed) {
    weeds.delete(key(col, row));
    weed.ownInteraction?.interactions.remove(col, row);
    weed.sprite.destroy();
    weed.shadow.destroy();
  }
  if (resourceNodeRegistry.getNode(sceneKey, col, row)?.kind === 'weed') resourceNodeRegistry.removeNode(sceneKey, col, row);
}

/** Um mato fora da lavoura: o jogador clica nele e vai até ao lado pra cortar. */
class WeedInteractable implements Interactable {
  readonly interactFromAdjacent = true;
  constructor(
    private readonly player: Player,
    private readonly col: number,
    private readonly row: number,
  ) {}

  interact(): void {
    cutWeedAt(this.player, this.col, this.row);
  }
}

/** Desenha o mato da célula (col, row). `inFarmland`: dentro da lavoura (quem interage é o canteiro) ou fora (interação própria). */
export function buildWeed(
  scene: Phaser.Scene,
  tilePx: number,
  player: Player,
  interactions: InteractionRegistry,
  sceneKey: string,
  col: number,
  row: number,
  inFarmland: boolean,
): { sprite: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image } {
  registerGrassDetailFrames(scene);
  const x = col * tilePx + tilePx / 2;
  const y = (row + 1) * tilePx;

  const shadow = createGroundShadow(scene, x, y - 3, DISPLAY_SCALE * 0.8, DISPLAY_SCALE * 0.35);
  shadow.setDepth(y - 0.1);
  const sprite = scene.add.image(x, y, GRASS_DETAILS_KEY, WILD_GRASS_DETAIL.frameName);
  sprite.setOrigin(0.5, 1).setScale(DISPLAY_SCALE).setDepth(y);
  registerSway(sprite, 'grass');

  let ownInteraction: WeedVisual['ownInteraction'] = null;
  if (!inFarmland) {
    interactions.set(col, row, new WeedInteractable(player, col, row));
    ownInteraction = { interactions };
  }
  weeds.set(key(col, row), { sprite, shadow, sceneKey, ownInteraction });
  return { sprite, shadow };
}

/**
 * O jogador clicou no mato de (col, row): com a Foice na mão, corta (animação da foice, some, solta Capim); sem ela, avisa. Devolve `true` se havia mato
 * ali (o clique foi dele), `false` se a célula não tem mato.
 */
export function cutWeedAt(player: Player, col: number, row: number): boolean {
  const weed = weeds.get(key(col, row));
  if (!weed) return false;
  if (player.isBusy()) return true;

  const scene = weed.sprite.scene;
  const selected = gameState.inventory.getSelectedSlot();
  if (selected?.category !== 'tool' || selected.id !== 'sickle') {
    popText(scene, weed.sprite.x, weed.sprite.y - 30, 'Precisa da Foice', { color: '#ff8a8a', fontSize: 14 });
    return true;
  }

  // O som toca no começo do golpe (como o da espada), não no instante do impacto.
  player.performAction(
    'harvest',
    () => {
      if (!weeds.delete(key(col, row))) return; // Já cortado (clique duplo).
      const { x, y } = weed.sprite;
      const amount = rollDoubleDrop(scene, Phaser.Math.Between(1, 2), x, y - 28);
      spawnLoot(scene, player, x, y, { category: 'resource', id: WILD_GRASS.id, amount });

      resourceNodeRegistry.removeNode(weed.sceneKey, col, row);
      weed.ownInteraction?.interactions.remove(col, row);
      // A moita encolhe e some (transformação do próprio sprite, nada desenhado por código).
      scene.tweens.add({
        targets: [weed.sprite, weed.shadow],
        alpha: 0,
        scaleX: weed.sprite.scaleX * 0.6,
        scaleY: weed.sprite.scaleY * 1.15,
        duration: CUT_MS,
        onComplete: () => {
          weed.sprite.destroy();
          weed.shadow.destroy();
        },
      });
      tutorial.notify({ kind: 'act', action: 'cut' });
    },
    () => playEffect(scene, SICKLE_SOUND),
  );
  return true;
}
