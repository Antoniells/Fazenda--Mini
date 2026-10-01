import Phaser from 'phaser';
import { ExternalMapScene, computeArrivalClearance } from './ExternalMapScene';
import { forestMap } from '../data/maps/forestMap';
import { BIRCH_TREE_KEY, BIRCH_TREE_PATH, ROCK_KEY, ROCK_PATH, WATER_KEY, WATER_PATH, TILE_SIZE } from '../data/tiles';
import { LEAF_FALL_KEY, LEAF_FALL_PATH, LEAF_FALL_FRAME_SIZE } from '../data/effects';
import { SLIME_KEY, SLIME_PATH, SLIME_FRAME_SIZE } from '../data/enemies';
import { buildGrowingTree, buildRock, buildWaterArea, waterAreaCells, buildWildFoliage } from '../systems/externalMapBuilder';
import { buildMapProps } from '../systems/mapProps';
import { GrassTuftMap, rustleGrassTuft } from '../systems/grassDetails';
import { resourceNodeRegistry } from '../systems/resourceNodeRegistry';
import { TreeInteractable, RockInteractable } from '../systems/resourceInteraction';
import { updateTreeOverlap } from '../systems/treeOverlap';
import { updateTreeSway } from '../systems/treeSway';
import { stepDirection } from '../systems/foliageSway';
import { SlimeSpawner } from '../systems/slimeSpawner';
import { WalkableGrid } from '../systems/grid';
import { InteractionRegistry } from '../systems/interaction';
import { waterCellsFromGround } from '../systems/waterCells';
import { onPlayerStepped } from '../systems/sceneEvents';
import { Player } from '../entities/Player';
import { isInventoryOpen } from './UIScene';
import { hasMilestone } from '../systems/story';
import { DISPLAY_SCALE } from '../systems/mapBuilder';
import { FOREST_PORTAL, HIDDEN_FOREST_NAME, HIDDEN_FOREST_SCENE_KEY, ROOT_PORTAL, forestPortalCells } from '../data/hiddenForest';

export const FOREST_SCENE_KEY = 'ForestScene';

/** Teto de nós ativos ao mesmo tempo (Fase 7 — respawn diário) — impede a Floresta de lotar de árvores/pedras depois de muitos dias. */
const FOREST_CAPS = { maxTrees: 22, maxRocks: 12 };

/** A ponte de volta da Floresta fica na parede LESTE (a Fazenda a alcança pela oeste, abaixo da Pedreira) — ver `ExternalMapConfig.returnDirection`. */
const FOREST_RETURN_DIRECTION = 'east';
/** Zona de chegada dessa ponte: livre de árvores/pedras sempre (ver `computeArrivalClearance`). */
function forestArrivalCells(): Array<[number, number]> {
  return computeArrivalClearance(FOREST_RETURN_DIRECTION, forestMap.cols, forestMap.rows);
}

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
  const waterCells = new Set(waterCellsFromGround(forestMap.ground).map(([c, r]) => `${c},${r}`));

  const arrivalCells = new Set(forestArrivalCells().map(([c, r]) => `${c},${r}`));
  // O arco da Floresta Oculta (e a célula da frente dele) nunca vira árvore/pedra.
  for (const [c, r] of [...forestPortalCells(), [FOREST_PORTAL.returnSpawn.col, FOREST_PORTAL.returnSpawn.row]]) arrivalCells.add(`${c},${r}`);

  const isCellFree = (col: number, row: number): boolean =>
    !lakeCells.has(`${col},${row}`) && !birchCells.has(`${col},${row}`) && !waterCells.has(`${col},${row}`) && !arrivalCells.has(`${col},${row}`);

  resourceNodeRegistry.advanceDay(FOREST_SCENE_KEY, cols, rows, isCellFree);
}

/** Destino da ponte Oeste inferior da Fazenda (abaixo da Pedreira) — ver `data/maps/forestMap.ts`. */
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
        // Bétulas: também cortáveis (pedido explícito) — mesmo registro dos pinheiros, só muda a espécie.
        ...birchTreePositions.map(([col, row]) => ({ col, row, kind: 'tree' as const, stage: 'mature' as const, species: 'birch' as const })),
        ...forestMap.rockPositions.map(([col, row]) => ({ col, row, kind: 'smallRock' as const, stage: 'mature' as const })),
      ],
      FOREST_CAPS,
    );

    super(FOREST_SCENE_KEY, {
      cols,
      rows,
      areaName: 'Floresta',
      mapType: 'forest',
      fishing: 'forestLake', // O lago: pesca com a Vara na margem (`data/fishing.ts`).
      ground: forestMap.ground,
      backgroundColor: forestMap.backgroundColor,
      waterStyle: 'waterGround', // Lago com a folha "Water Ground animations tiles" (margem de terra), não a de areia da Praia.
      // Sem tint: fica com o verde natural da grama (mesmo critério da
      // faixa "Madeireira" dentro da Fazenda, ver `mapBuilder.BIOME_TINTS`).
      // Continuidade espacial: a ponte da Fazenda que traz o jogador aqui
      // fica a OESTE (abaixo da Pedreira), então a ponte de volta fica a LESTE (lado oposto).
      returnDirection: FOREST_RETURN_DIRECTION,
      // Bétulas não entram aqui: como toda árvore colhível, bloqueiam a célula pelo registro (ver `buildMapContent`) — uma bétula já cortada não pode continuar bloqueando ao voltar à cena.
      obstacleCells: [
        ...waterAreaCells(lakeArea.col0, lakeArea.row0, lakeArea.cols, lakeArea.rows),
        ...(forestMap.blockedArea ?? []),
        ],
    });
  }

  protected loadMapAssets(): void {
    if (!this.textures.exists(ROOT_PORTAL.key)) this.load.image(ROOT_PORTAL.key, encodeURI(`/${ROOT_PORTAL.path}`));
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

    // Saves antigos guardam as árvores/pedras do mapa anterior (a ponte de volta ficava a oeste): a cada entrada limpa a zona de chegada
    // nova, pra nenhuma delas fechar a saída da passarela. (Aqui, e não no construtor: o save só é restaurado depois dele.)
    for (const [col, row] of forestArrivalCells()) resourceNodeRegistry.removeNode(FOREST_SCENE_KEY, col, row);

    // O Mapa Misterioso revela o arco de árvores pra Floresta Oculta (antes dele, o canto noroeste é só mato).
    if (hasMilestone('map')) this.buildHiddenPortal(ctx.tilePx, grid);

    const { lakeArea } = forestMap;
    buildWaterArea(this, TILE_SIZE, lakeArea.col0, lakeArea.row0, lakeArea.cols, lakeArea.rows);

    // Props de decoração ambiente (aba "Decoração" do MapEditorScene, pedido explícito) — puramente visuais, sem colisão.
    buildMapProps(this, TILE_SIZE, forestMap.props ?? []);

    // Árvores/pedras colhíveis: sempre a partir do estado ATUAL do registro
    // (não das posições originais do mapa) — reflete o que já foi cortado/
    // quebrado e o que cresceu/respawnou desde a última visita.
    let rockVariant: 0 | 1 | 2 = 0;
for (const node of resourceNodeRegistry.getNodes(FOREST_SCENE_KEY)) {
      // O grid.block incondicional foi removido daqui!

      if (node.kind === 'tree') {
        const visual = buildGrowingTree(this, TILE_SIZE, node.col, node.row, node.stage, node.species);
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
        rockVariant = ((rockVariant + 1) % 3) as 0 | 1 | 2;
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
    this.wildFoliage = buildWildFoliage(this, TILE_SIZE, grid, this.bridgeWalkway);

    // Fase 8 — Combate: Slimes só nascem na Floresta (pedido explícito do
    // usuário) — depois de toda árvore/pedra já bloqueada no grid, mesma
    // razão da folhagem acima (não nasce em cima de obstáculo).
    this.slimeSpawner = new SlimeSpawner(this, TILE_SIZE, forestMap.cols, forestMap.rows, grid, player);
    // Ataque global (pedido explícito do usuário): a tecla/lógica em si
    // agora vive no `PlayerController` (qualquer cena já tem um) — só
    // registra AQUI de onde vêm os inimigos vivos, já que só a Floresta
    // tem `SlimeSpawner` por ora.
    this.controller.setEnemyProvider(() => this.slimeSpawner.getAliveEnemies());
    this.debugGridOverlay.setEnemyProvider(() => this.slimeSpawner.getAliveEnemies()); // DEBUG TEMPORÁRIO

    // Regra padrão (pedido explícito do usuário): tufo/cogumelo balançam ao
    // jogador pisar em cima em QUALQUER cena, não só a Fazenda — mesmo
    // evento/técnica de `MainScene.ts`.
    onPlayerStepped(this, (col, row) => rustleGrassTuft(this, this.wildFoliage, col, row, stepDirection(this, col)));
  }

  /**
   * O ARCO DE ÁRVORES (Fase 11): 3x3 células no canto noroeste; a base do meio é a passagem (pisar nela leva à Floresta Oculta) e o
   * resto é sólido. Árvores/pedras que tenham nascido ali saem do registro. A volta de lá chega logo abaixo do arco, com os dados de
   * entrada desta cena (pra a ponte daqui continuar levando à Fazenda).
   */
  private buildHiddenPortal(tilePx: number, grid: WalkableGrid): void {
    const { cell, returnSpawn } = FOREST_PORTAL;
    for (const [col, row] of [...forestPortalCells(), [returnSpawn.col, returnSpawn.row]]) resourceNodeRegistry.removeNode(FOREST_SCENE_KEY, col, row);
    for (const [col, row] of forestPortalCells()) if (col !== cell.col || row !== cell.row) grid.block(col, row);

    const texture = this.textures.get(ROOT_PORTAL.key);
    const { name, rect } = ROOT_PORTAL.forestFrame;
    if (!texture.has(name)) texture.add(name, 0, rect.x, rect.y, rect.width, rect.height);
    const arch = this.add.image(cell.col * tilePx + tilePx / 2, (cell.row + 1) * tilePx, ROOT_PORTAL.key, name);
    arch.setOrigin(0.5, 1).setScale(DISPLAY_SCALE).setDepth(arch.y);

    onPlayerStepped(this, (col, row) => {
      if (col !== cell.col || row !== cell.row || this.isTransitioning) return;
      this.isTransitioning = true;
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start(HIDDEN_FOREST_SCENE_KEY, { areaName: HIDDEN_FOREST_NAME, returnSceneKey: FOREST_SCENE_KEY, returnSpawn, returnData: this.entryData });
      });
    });
  }

  update(time: number, delta: number): void {
    super.update(time, delta);
    // Mesma transparência de sobreposição das árvores da Fazenda (ver
    // `MainScene.update`) — o personagem fica parcialmente visível ao
    // passar atrás de uma bétula/pinheiro, em vez de sumir de repente.
    updateTreeOverlap(this.player, this.treeVisuals);
    updateTreeSway(this.player, this.treeVisuals);
    // Pausa com o Inventário aberto (mesmo critério do movimento do
    // jogador, ver `ExternalMapScene.update`) — sem isso, um Slime podia
    // continuar perseguindo/encostando no jogador com o menu na tela.
    if (!isInventoryOpen()) this.slimeSpawner.update(time, delta);
  }
}
