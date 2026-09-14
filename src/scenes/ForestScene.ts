import Phaser from 'phaser';
import { ExternalMapScene } from './ExternalMapScene';
import { forestMap } from '../data/maps/forestMap';
import { BIRCH_TREE_KEY, BIRCH_TREE_PATH, ROCK_KEY, ROCK_PATH, WATER_KEY, WATER_PATH, TILE_SIZE } from '../data/tiles';
import { LEAF_FALL_KEY, LEAF_FALL_PATH, LEAF_FALL_FRAME_SIZE } from '../data/effects';
import { buildExternalTree, buildGrowingTree, buildRock, buildWaterArea, waterAreaCells, buildWildFoliage } from '../systems/externalMapBuilder';
import { resourceNodeRegistry } from '../systems/resourceNodeRegistry';
import { TreeInteractable, RockInteractable } from '../systems/resourceInteraction';
import { updateTreeOverlap } from '../systems/treeOverlap';
import { WalkableGrid } from '../systems/grid';
import { InteractionRegistry } from '../systems/interaction';
import { Player } from '../entities/Player';

export const FOREST_SCENE_KEY = 'ForestScene';

/** Teto de nós ativos ao mesmo tempo (Fase 7 — respawn diário) — impede a Floresta de lotar de árvores/pedras depois de muitos dias. */
const FOREST_CAPS = { maxTrees: 10, maxRocks: 6 };

/**
 * Virada de dia da Floresta (Fase 7 — "gancho de virada de dia"): chamado
 * pela `MainScene` (não pela própria cena — ela pode estar fechada no
 * momento) nos mesmos pontos que já disparam a virada de dia. Só sabe
 * fazer a pergunta "essa célula está livre pra crescer algo?" a partir dos
 * dados ESTÁTICOS do mapa (borda, lago, bétulas, ponte) — os nós
 * dinâmicos (árvores/pedras já existentes) o próprio `resourceNodeRegistry`
 * já exclui sozinho.
 */
export function advanceForestDay(): void {
  const { cols, rows, lakeArea, birchTreePositions } = forestMap;
  const lakeCells = new Set(waterAreaCells(lakeArea.col0, lakeArea.row0, lakeArea.cols, lakeArea.rows).map(([c, r]) => `${c},${r}`));
  const birchCells = new Set(birchTreePositions.map(([c, r]) => `${c},${r}`));

  const isCellFree = (col: number, row: number): boolean =>
    !lakeCells.has(`${col},${row}`) && !birchCells.has(`${col},${row}`);

  resourceNodeRegistry.advanceDay(FOREST_SCENE_KEY, cols, rows, isCellFree);
}

/** Destino da ponte Leste (Madeireira) — ver `data/maps/forestMap.ts`. */
export class ForestScene extends ExternalMapScene {
  /** Bétulas decorativas + árvores de pinheiro (qualquer estágio) — usadas pela transparência de sobreposição (`updateTreeOverlap`), mesma técnica da `MainScene` (Fazenda). */
  private readonly treeVisuals: Phaser.GameObjects.Image[] = [];

  constructor() {
    const { cols, rows, lakeArea, birchTreePositions } = forestMap;

    // Primeira vez nesta sessão: semeia o registro com as posições originais
    // do mapa (árvores já adultas, pedras já prontas — só o respawn futuro
    // nasce como broto). Chamadas seguintes (voltar à cena) são no-op.
    resourceNodeRegistry.ensureInitialized(
      FOREST_SCENE_KEY,
      [
        ...forestMap.pineTreePositions.map(([col, row]) => ({ col, row, kind: 'tree' as const, stage: 'mature' as const })),
        ...forestMap.rockPositions.map(([col, row]) => ({ col, row, kind: 'smallRock' as const, stage: 'mature' as const })),
      ],
      FOREST_CAPS,
    );

    super(FOREST_SCENE_KEY, {
      cols,
      rows,
      areaName: 'Floresta',
      // Sem tint: fica com o verde natural da grama (mesmo critério da
      // faixa "Madeireira" dentro da Fazenda, ver `mapBuilder.BIOME_TINTS`).
      // Continuidade espacial: a ponte da Fazenda que traz o jogador aqui
      // fica a LESTE, então a ponte de volta fica a OESTE (lado oposto).
      returnDirection: 'west',
      obstacleCells: [
        ...birchTreePositions,
        ...waterAreaCells(lakeArea.col0, lakeArea.row0, lakeArea.cols, lakeArea.rows),
        ...resourceNodeRegistry.getNodes(FOREST_SCENE_KEY).map((node): [number, number] => [node.col, node.row]),
      ],
    });
  }

  protected loadMapAssets(): void {
    this.load.image(BIRCH_TREE_KEY, encodeURI(`/${BIRCH_TREE_PATH}`));
    this.load.image(ROCK_KEY, encodeURI(`/${ROCK_PATH}`));
    this.load.image(WATER_KEY, encodeURI(`/${WATER_PATH}`));
    // Fase 9 — mecânica de hits: folhas caindo a cada golpe de Machado.
    this.load.spritesheet(LEAF_FALL_KEY, encodeURI(`/${LEAF_FALL_PATH}`), {
      frameWidth: LEAF_FALL_FRAME_SIZE,
      frameHeight: LEAF_FALL_FRAME_SIZE,
    });
  }

  protected buildMapContent(ctx: { tilePx: number; grid: WalkableGrid; interactions: InteractionRegistry; player: Player }): void {
    const { grid, interactions, player } = ctx;

    // Bétulas: só decoração fixa, nunca colhível (ver comentário de
    // `data/tiles.ts` sobre não ter estágios de crescimento próprios).
    for (const [col, row] of forestMap.birchTreePositions) {
      this.treeVisuals.push(buildExternalTree(this, TILE_SIZE, col, row, 'birch'));
    }

    const { lakeArea } = forestMap;
    buildWaterArea(this, TILE_SIZE, lakeArea.col0, lakeArea.row0, lakeArea.cols, lakeArea.rows);

    // Árvores/pedras colhíveis: sempre a partir do estado ATUAL do registro
    // (não das posições originais do mapa) — reflete o que já foi cortado/
    // quebrado e o que cresceu/respawnou desde a última visita.
    let rockVariant: 0 | 1 = 0;
    for (const node of resourceNodeRegistry.getNodes(FOREST_SCENE_KEY)) {
      grid.block(node.col, node.row);

      if (node.kind === 'tree') {
        const visual = buildGrowingTree(this, TILE_SIZE, node.col, node.row, node.stage);
        this.treeVisuals.push(visual.sprite);
        // Só árvore MADURA é cortável — broto/muda ainda não têm interação.
        if (node.stage === 'mature') {
          interactions.set(
            node.col,
            node.row,
            new TreeInteractable(player, visual, grid, interactions, FOREST_SCENE_KEY, node.col, node.row),
          );
        }
      } else {
        const visual = buildRock(this, TILE_SIZE, node.col, node.row, rockVariant, node.kind === 'bigRock');
        rockVariant = rockVariant === 0 ? 1 : 0;
        interactions.set(
          node.col,
          node.row,
          new RockInteractable(player, visual, grid, interactions, FOREST_SCENE_KEY, node.col, node.row, node.kind === 'bigRock'),
        );
      }
    }

    // Cogumelos/plantinhas selvagens (Fase 9 — polimento visual): por
    // último, já com toda árvore/pedra/água bloqueada no grid, pra nunca
    // nascer em cima de um obstáculo.
    buildWildFoliage(this, TILE_SIZE, grid);
  }

  update(time: number, delta: number): void {
    super.update(time, delta);
    // Mesma transparência de sobreposição das árvores da Fazenda (ver
    // `MainScene.update`) — o personagem fica parcialmente visível ao
    // passar atrás de uma bétula/pinheiro, em vez de sumir de repente.
    updateTreeOverlap(this.player, this.treeVisuals);
  }
}
