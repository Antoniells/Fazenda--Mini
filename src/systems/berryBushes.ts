import Phaser from 'phaser';
import {
  BERRIES_PER_HARVEST,
  BERRY_BUSH_FRAME_HEIGHT,
  BERRY_BUSH_FRAME_WIDTH,
  BERRY_BUSH_KEY,
  BERRY_BUSH_PATH,
  FARM_BERRY_BUSHES,
  berryBushFrame,
  berryBushFruitsIn,
  berryBushSeasonFrame,
  daysUntilBerries,
} from '../data/berryBushes';
import { seasonName } from '../data/seasons';
import { currentGroundSeason } from './seasonalGround';
import { BERRY_ICON_KEY, BERRY_ICON_PATH, WILD_BERRY } from '../data/resources';
import { HARVEST_SOUNDS } from '../data/audio';
import { Player } from '../entities/Player';
import { Interactable, InteractionRegistry } from './interaction';
import { WalkableGrid } from './grid';
import { DISPLAY_SCALE } from './mapBuilder';
import { registerSway } from './foliageSway';
import { spawnLoot } from './lootDrops';
import { popText } from './floatingText';
import { playRandomEffect } from './soundEffects';
import { berryBushDays, markBerryBushHarvested } from './berryBushState';

/**
 * Os ARBUSTOS FRUTÍFEROS da Fazenda na cena (`data/berryBushes.ts`; o estado — dias desde a colheita — é `systems/berryBushState.ts`): cada um é um
 * sprite da folha `bushes.png` no quadro do ciclo, numa célula SÓLIDA. Clicar (o personagem vai até o lado): com frutas, elas caem no chão
 * (Frutinhas Silvestres, comestíveis — `WILD_BERRY`), o arbusto sacode e fica liso; sem frutas, avisa em quantos dias elas voltam.
 */

export function preloadBerryBushes(scene: Phaser.Scene): void {
  scene.load.spritesheet(BERRY_BUSH_KEY, encodeURI(`/${BERRY_BUSH_PATH}`), { frameWidth: BERRY_BUSH_FRAME_WIDTH, frameHeight: BERRY_BUSH_FRAME_HEIGHT });
  scene.load.spritesheet(BERRY_ICON_KEY, encodeURI(`/${BERRY_ICON_PATH}`), { frameWidth: 16, frameHeight: 16 });
}

class BerryBushInteractable implements Interactable {
  constructor(
    private readonly player: Player,
    private readonly sprite: Phaser.GameObjects.Sprite,
    private readonly col: number,
    private readonly row: number,
  ) {}

  interact(): void {
    const scene = this.sprite.scene;
    // Outono e Inverno: sem frutas (`BERRY_BUSH_SEASON_FRAMES`).
    const season = currentGroundSeason();
    if (!berryBushFruitsIn(season)) {
      popText(scene, this.sprite.x, this.sprite.y - 56, `Sem frutas no ${seasonName(season)}`, { color: '#ffe9b3', fontSize: 13 });
      return;
    }
    const waitDays = daysUntilBerries(berryBushDays(this.col, this.row));
    if (waitDays > 0) {
      popText(scene, this.sprite.x, this.sprite.y - 56, `Frutas em ${waitDays} dia${waitDays > 1 ? 's' : ''}`, { color: '#ffe9b3', fontSize: 13 });
      return;
    }
    const amount = Phaser.Math.Between(BERRIES_PER_HARVEST[0], BERRIES_PER_HARVEST[1]);
    markBerryBushHarvested(this.col, this.row);
    this.sprite.setFrame(berryBushFrame(0));
    playRandomEffect(scene, HARVEST_SOUNDS);
    // As frutinhas caem no chão ao pé do arbusto (o jogador pega ao chegar perto), e ele dá uma sacudida.
    spawnLoot(scene, this.player, this.sprite.x, this.sprite.y, { category: 'resource', id: WILD_BERRY.id, amount });
    scene.tweens.add({ targets: this.sprite, angle: { from: -4, to: 4 }, duration: 70, yoyo: true, repeat: 2, onComplete: () => this.sprite.setAngle(0) });
  }
}

/** Desenha os arbustos (cada um no quadro do seu dia), bloqueia as células deles e registra o clique. Devolve as células usadas. */
export function buildBerryBushes(scene: Phaser.Scene, tilePx: number, grid: WalkableGrid, interactions: InteractionRegistry, player: Player): Array<[number, number]> {
  for (const [col, row] of FARM_BERRY_BUSHES) {
    // O quadro da estação do chão (`berryBushSeasonFrame`): laranja no Outono, verde-escuro no Inverno, o ciclo nas outras.
    const sprite = scene.add.sprite((col + 0.5) * tilePx, (row + 1) * tilePx, BERRY_BUSH_KEY, berryBushSeasonFrame(berryBushDays(col, row), currentGroundSeason()));
    sprite.setOrigin(0.5, 1).setScale(DISPLAY_SCALE).setDepth(sprite.y);
    registerSway(sprite, 'tree');
    grid.block(col, row);
    interactions.set(col, row, new BerryBushInteractable(player, sprite, col, row));
  }
  return [...FARM_BERRY_BUSHES];
}
