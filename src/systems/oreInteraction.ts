import { Player } from '../entities/Player';
import { Interactable, InteractionRegistry } from './interaction';
import { WalkableGrid } from './grid';
import { gameState } from './gameState';
import { resourceNodeRegistry } from './resourceNodeRegistry';
import { HarvestableVisual, clearHarvestedNode, playHitReaction } from './resourceInteraction';
import { spawnLoot } from './lootDrops';
import { awardXp, rollDoubleDrop } from './skills';
import { popText } from './floatingText';
import { playEffect, playRandomEffect } from './soundEffects';
import { ROCK_BREAK_SOUND, ROCK_HIT_SOUNDS } from '../data/audio';
import { HITS_TO_BREAK_ORE, ORES, OreKind } from '../data/ores';
import { RESOURCES } from '../data/resources';
import { TOOL_TIER_NAMES, TOOL_TIER_POWER, getToolTierInfo } from '../data/toolProgression';
import Phaser from 'phaser';
import { enchantMultiplier } from './enchanting';

/** O tier da Picareta selecionada (0 = Madeira … 3 = Ouro); `null` se a ferramenta na mão não é uma Picareta. */
function selectedPickaxeTier(): number | null {
  const selected = gameState.inventory.getSelectedSlot();
  if (!selected || selected.category !== 'tool') return null;
  const info = getToolTierInfo(selected.id);
  return info && info.family === 'pickaxe' ? info.tier : null;
}

/**
 * Veio de minério da Pedreira (`data/ores.ts`) — a Picareta o quebra em `HITS_TO_BREAK_ORE` "golpes de madeira" (o tier da Picareta bate mais forte, `TOOL_TIER_POWER`), com a
 * mesma reação das pedras (tremor + flash) e o dano guardado no registro. Cobre e Carvão servem com qualquer Picareta; Ferro e Ouro exigem uma melhor (`OreDefinition.minToolTier`).
 * O minério cai no chão (o jogador o recolhe ao chegar perto) e o veio some do mapa até voltar (`QuarryScene.advanceQuarryDay`). Nas Cavernas o veio é de uma
 * visita só (`sceneKey` null, `systems/caveOres.ts`).
 */
export class OreInteractable implements Interactable {
  /** Progresso até quebrar, em "golpes de madeira" — guardado no registro (a cena recria o objeto a cada entrada e o dano não pode zerar). */
  private hits: number;

  constructor(
    private readonly player: Player,
    private readonly visual: HarvestableVisual,
    private readonly grid: WalkableGrid,
    private readonly interactions: InteractionRegistry,
    /** Onde o veio mora no registro de recursos (a Pedreira: o dano e a quebra persistem). `null` = veio de uma visita só (os andares da Caverna). */
    private readonly sceneKey: string | null,
    private readonly col: number,
    private readonly row: number,
    private readonly kind: OreKind,
    /** Avisado quando o veio quebra (a Caverna registra a primeira Azurita da história). */
    private readonly onBreak?: (kind: OreKind) => void,
  ) {
    this.hits = sceneKey ? (resourceNodeRegistry.getNode(sceneKey, col, row)?.hits ?? 0) : 0;
  }

  interact(): void {
    if (this.player.isBusy()) return;

    const ore = ORES[this.kind];
    const scene = this.visual.sprite.scene;
    const tier = selectedPickaxeTier();
    if (tier === null) {
      popText(scene, this.visual.sprite.x, this.visual.sprite.y - 40, 'Precisa da Picareta', { color: '#ff8a8a', fontSize: 14 });
      return;
    }
    if (tier < ore.minToolTier) {
      popText(scene, this.visual.sprite.x, this.visual.sprite.y - 40, `Precisa da Picareta de ${TOOL_TIER_NAMES[ore.minToolTier]}`, { color: '#ff8a8a', fontSize: 14 });
      return;
    }

    this.player.performAction('pickaxe', () => {
      this.hits += TOOL_TIER_POWER[tier] * enchantMultiplier('pickaxe'); // (Picareta encantada: +20% de força)
      if (this.sceneKey) resourceNodeRegistry.setHits(this.sceneKey, this.col, this.row, this.hits);
      playHitReaction(this.visual.sprite);
      if (this.hits < HITS_TO_BREAK_ORE) {
        playRandomEffect(scene, ROCK_HIT_SOUNDS); // Os mesmos golpes e a mesma quebra da pedra.
        return;
      }

      playEffect(scene, ROCK_BREAK_SOUND);
      const { x, y } = this.visual.sprite;
      const amount = rollDoubleDrop(scene, Phaser.Math.Between(ore.drop[0], ore.drop[1]), x, y - 40);
      scene.cameras.main.shake(110, 0.004);
      awardXp(scene, 'mineSmall', x, y - 16);
      spawnLoot(scene, this.player, x, y, { category: 'resource', id: ore.dropId, amount });
      console.log(`${ore.name} quebrado: +${amount} ${RESOURCES[ore.dropId]?.name ?? ore.dropId}.`);

      if (this.sceneKey) {
        clearHarvestedNode(this.visual, this.grid, this.interactions, this.sceneKey, this.col, this.row);
      } else {
        this.visual.sprite.destroy();
        this.visual.shadow?.destroy();
        this.grid.unblock(this.col, this.row);
        this.interactions.remove(this.col, this.row);
      }
      this.onBreak?.(this.kind);
    });
  }
}
