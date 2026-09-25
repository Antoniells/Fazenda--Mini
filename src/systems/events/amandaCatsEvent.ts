import Phaser from 'phaser';
import { Pet } from '../../entities/Pet';
import { PET_ROAM } from '../../data/pets';
import { AMANDA_EVENT_ID, AMANDA_CAT_COUNT, AMANDA_RESOLVE_DAY, AMANDA_LETTER, CAT_PET_IDS, isAmandaWithCat } from '../../data/events';
import { preloadPet } from '../petSprites';
import { gameState } from '../gameState';
import { scheduleMail } from '../mail';
import { GridPoint } from '../pathfinding';
import { WorldEventContext, WorldEventDefinition, WorldEventRuntime } from '../eventManager';

/** Até onde (em células) os gatos visitantes nascem em volta do jogador. */
const SPAWN_RADIUS_TILES = 5;

/**
 * Easter egg da Amanda (pedido explícito): quem cria o personagem com o nome "Amanda" e escolhe um gato recebe, quando o pet chega
 * (`unlockPet`), 7 gatos na Fazenda em vez de 1 — o escolhido (o companheiro de sempre, `PetCompanion`) e mais 6 que só "vieram
 * passear" (a mesma classe `Pet`, com as peles dos gatos do catálogo, sem arte nova). No dia `AMANDA_RESOLVE_DAY` os 6 somem e
 * uma carta bem-humorada chega na Caixa de Correio explicando que já tinham dono. A carta é agendada assim que o evento começa
 * (`scheduleMail` — seguro repetir) e fica no save junto com o correio.
 */
class AmandaCatsRuntime implements WorldEventRuntime {
  private readonly cats: Pet[] = [];

  constructor(private readonly context: WorldEventContext) {
    const { scene, grid, tilePx, player, controller } = context;
    scheduleMail(AMANDA_LETTER);

    const cells = this.pickSpawnCells(AMANDA_CAT_COUNT - 1);
    for (const cell of cells) {
      const skin = Phaser.Utils.Array.GetRandom(CAT_PET_IDS);
      const cat = new Pet(scene, skin, player, grid, tilePx, PET_ROAM.farm, undefined, null, cell);
      controller.addWorldClickHandler((x, y) => cat.handleClick(x, y));
      this.cats.push(cat);
    }
  }

  /** Células andáveis e distintas em volta do jogador (perto o bastante pra eles não "teleportarem" pro lado dele). */
  private pickSpawnCells(count: number): GridPoint[] {
    const { grid, player } = this.context;
    const candidates: GridPoint[] = [];
    for (let dRow = -SPAWN_RADIUS_TILES; dRow <= SPAWN_RADIUS_TILES; dRow++) {
      for (let dCol = -SPAWN_RADIUS_TILES; dCol <= SPAWN_RADIUS_TILES; dCol++) {
        if (dCol === 0 && dRow === 0) continue;
        // Acima do jogador costuma ser "atrás" de casa/árvore, onde o gato sumiria atrás da arte: só as células ao lado e abaixo.
        if (dRow < -1) continue;
        const cell = { col: player.col + dCol, row: player.row + dRow };
        if (grid.isWalkable(cell.col, cell.row)) candidates.push(cell);
      }
    }
    Phaser.Utils.Array.Shuffle(candidates);
    return candidates.slice(0, count);
  }

  update(time: number, delta: number): void {
    for (const cat of this.cats) cat.update(time, delta);
  }

  destroy(immediate: boolean): void {
    for (const cat of this.cats) {
      if (immediate) cat.destroy();
      else cat.fadeOutAndDestroy();
    }
    this.cats.length = 0;
  }
}

/** Ativo do momento em que o pet chega até a manhã do dia 10 — só pra Amanda com um gato. */
export const amandaCatsEvent: WorldEventDefinition = {
  id: AMANDA_EVENT_ID,
  preload(scene) {
    // As peles dos visitantes: só quando é a Amanda e ainda dá pra acontecer.
    if (!isAmandaWithCat(gameState.profile) || gameState.gameClock.getDay() >= AMANDA_RESOLVE_DAY) return;
    for (const id of CAT_PET_IDS) preloadPet(scene, id);
  },
  isActive() {
    return isAmandaWithCat(gameState.profile) && gameState.petUnlocked && gameState.gameClock.getDay() < AMANDA_RESOLVE_DAY;
  },
  start: (context) => new AmandaCatsRuntime(context),
};
