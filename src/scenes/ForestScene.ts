import Phaser from 'phaser';
import { ExternalMapScene } from './ExternalMapScene';
import { forestMap } from '../data/maps/forestMap';
import { BIRCH_TREE_KEY, BIRCH_TREE_PATH, ROCK_KEY, ROCK_PATH, WATER_KEY, WATER_PATH, TILE_SIZE } from '../data/tiles';
import { LEAF_FALL_KEY, LEAF_FALL_PATH, LEAF_FALL_FRAME_SIZE } from '../data/effects';
import { SLIME_KEY, SLIME_PATH, SLIME_FRAME_SIZE } from '../data/enemies';
import { buildExternalTree, buildGrowingTree, buildRock, buildWaterArea, waterAreaCells, buildWildFoliage } from '../systems/externalMapBuilder';
import { GrassTuftMap, rustleGrassTuft } from '../systems/grassDetails';
import { resourceNodeRegistry } from '../systems/resourceNodeRegistry';
import { TreeInteractable, RockInteractable } from '../systems/resourceInteraction';
import { updateTreeOverlap } from '../systems/treeOverlap';
import { SlimeSpawner } from '../systems/slimeSpawner';
import { WalkableGrid } from '../systems/grid';
import { InteractionRegistry } from '../systems/interaction';
import { Player } from '../entities/Player';
import { isInventoryOpen } from './UIScene';

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
  /** Fase 8 — Combate: os únicos inimigos do jogo nascem aqui, pedido explícito do usuário. */
  private slimeSpawner!: SlimeSpawner;
  /** Tufo/cogumelo selvagens plantados por `buildWildFoliage` — regra padrão (mesma da Fazenda): balançam ao jogador pisar em cima, ver `rustleGrassTuft`. */
  private wildFoliage!: GrassTuftMap;

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
    // Fase 8 — Combate: sprite do Slime, único inimigo do jogo por ora.
    this.load.spritesheet(SLIME_KEY, encodeURI(`/${SLIME_PATH}`), {
      frameWidth: SLIME_FRAME_SIZE,
      frameHeight: SLIME_FRAME_SIZE,
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
      // O grid.block incondicional foi removido daqui!

      if (node.kind === 'tree') {
        const visual = buildGrowingTree(this, TILE_SIZE, node.col, node.row, node.stage);
        this.treeVisuals.push(visual.sprite);

        if (node.stage === 'mature') {
          // Bloqueia e torna interagível SÓ se a árvore for madura
          grid.block(node.col, node.row);
          interactions.set(
            node.col,
            node.row,
            new TreeInteractable(player, visual, grid, interactions, FOREST_SCENE_KEY, node.col, node.row),
          );
        } else {
          // Se for Broto ou Muda: Não bloqueia a passagem e adiciona na lista 
          // do 'wildFoliage' para balançar automaticamente quando pisar!
          this.wildFoliage.set(`${node.col},${node.row}`, visual.sprite);
        }
      } else {
        // Pedras continuam bloqueando a passagem normalmente
        grid.block(node.col, node.row);
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
    this.wildFoliage = buildWildFoliage(this, TILE_SIZE, grid);

    // Fase 8 — Combate: Slimes só nascem na Floresta (pedido explícito do
    // usuário) — depois de toda árvore/pedra já bloqueada no grid, mesma
    // razão da folhagem acima (não nasce em cima de obstáculo).
    this.slimeSpawner = new SlimeSpawner(this, TILE_SIZE, forestMap.cols, forestMap.rows, grid);
    // Ataque global (pedido explícito do usuário): a tecla/lógica em si
    // agora vive no `PlayerController` (qualquer cena já tem um) — só
    // registra AQUI de onde vêm os inimigos vivos, já que só a Floresta
    // tem `SlimeSpawner` por ora.
    this.controller.setEnemyProvider(() => this.slimeSpawner.getAliveEnemies());
    this.debugGridOverlay.setEnemyProvider(() => this.slimeSpawner.getAliveEnemies()); // DEBUG TEMPORÁRIO

    // Regra padrão (pedido explícito do usuário): tufo/cogumelo balançam ao
    // jogador pisar em cima em QUALQUER cena, não só a Fazenda — mesmo
    // evento/técnica de `MainScene.ts`.
    this.events.on('player-stepped', (col: number, row: number) => rustleGrassTuft(this, this.wildFoliage, col, row));
  }

  update(time: number, delta: number): void {
    super.update(time, delta);
    // Mesma transparência de sobreposição das árvores da Fazenda (ver
    // `MainScene.update`) — o personagem fica parcialmente visível ao
    // passar atrás de uma bétula/pinheiro, em vez de sumir de repente.
    updateTreeOverlap(this.player, this.treeVisuals);
    // Pausa com o Inventário aberto (mesmo critério do movimento do
    // jogador, ver `ExternalMapScene.update`) — sem isso, um Slime podia
    // continuar perseguindo/encostando no jogador com o menu na tela.
    if (!isInventoryOpen()) this.slimeSpawner.update(time, delta, this.player);
  }
}
