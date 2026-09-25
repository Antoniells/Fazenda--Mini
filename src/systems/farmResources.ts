import Phaser from 'phaser';
import { farmMap } from '../data/maps/farmMap';
import { TILE_SIZE, GRASS_FLAT_TILE_INDEX, GRASS_FLAT_DARK_TILE_INDEX } from '../data/tiles';
import { PLAYER_START } from '../data/player';
import { DECORATIONS } from '../data/decorations';
import { Player } from '../entities/Player';
import { buildGrowingTree, buildRock, WorldResourceVisual } from './externalMapBuilder';
import { resourceNodeRegistry, ResourceNode, ResourceCaps } from './resourceNodeRegistry';
import { TreeInteractable, RockInteractable } from './resourceInteraction';
import { InteractionRegistry } from './interaction';
import { buildWalkableGrid, WalkableGrid } from './grid';
import { gameState } from './gameState';

/** Chave da Fazenda no `resourceNodeRegistry` — árvores (as do mapa, as plantadas e os brotos que nascem sozinhos) e pedras, tudo no mesmo registro. */
export const FARM_RESOURCES_KEY = 'MainScene:resources';

/**
 * Teto de árvores/pedras da Fazenda ao mesmo tempo. Brotos nascem sozinhos todo dia (`newTreesPerDay`) até o teto —
 * conta as árvores do mapa e as plantadas também, então a Fazenda nunca vira floresta; cortar libera vaga. Pedras
 * NÃO renascem aqui (`maxRocks: 0`): são as do mapa, e mais pedra é coisa da Pedreira.
 */
const FARM_CAPS: ResourceCaps = { maxTrees: 12, maxRocks: 0, newTreesPerDay: [0, 2] };

/** Células (Chebyshev) em volta de pontos de passagem/interação onde nunca nasce broto: uma árvore adulta ali poderia fechar o caminho da casa, da loja, da caixa ou de uma ponte. */
const KEEP_CLEAR_RADIUS = 2;

/**
 * Semeia o registro da Fazenda com os recursos ORIGINAIS do mapa (\`farmMap.treePositions\` e \`rockPositions\`, autorados no editor): todos
 * já adultos/prontos. Chamado no construtor da \`MainScene\` (que roda no boot), como Floresta/Pedreira fazem — chamadas seguintes são no-op.
 */
export function initFarmResourceRegistry(): void {
  const initial: ResourceNode[] = [
    ...farmMap.treePositions.map(([col, row]): ResourceNode => ({ col, row, kind: 'tree', stage: 'mature' })),
    ...farmMap.rockPositions.map(([col, row]): ResourceNode => ({ col, row, kind: 'smallRock', stage: 'mature' })),
  ];
  resourceNodeRegistry.ensureInitialized(FARM_RESOURCES_KEY, initial, FARM_CAPS);
}

let staticGrid: WalkableGrid | null = null;
let farmlandCellKeys: Set<string> | null = null;
let keyPoints: Array<[number, number]> | null = null;

function cellKey(col: number, row: number): string {
  return `${col},${row}`;
}

function getKeyPoints(): Array<[number, number]> {
  if (!keyPoints) {
    keyPoints = [
      farmMap.shippingBinPosition,
      farmMap.shopPosition,
      [farmMap.shopPosition[0] - 1, farmMap.shopPosition[1]],
      farmMap.houseDoorPosition,
      [PLAYER_START.col, PLAYER_START.row],
      ...farmMap.bridges.map((bridge): [number, number] => [bridge.col, bridge.row]),
      ...farmMap.expansions.map((chunk): [number, number] => chunk.signPosition),
    ];
  }
  return keyPoints;
}

/**
 * Esta célula da Fazenda pode receber um broto novo hoje? (Puro dado — a Fazenda pode estar fechada quando o dia vira.)
 * Só grama lisa DENTRO da propriedade original, fora da lavoura, do caminho de terra, de qualquer construção posicionada
 * (Poço/Bancada/Aspersor) e dos pontos de passagem (\`KEEP_CLEAR_RADIUS\`); e livre no grid estático (casa, cerca, água,
 * blocos de colisão). O registro já exclui as células que têm outra árvore/pedra.
 */
export function isFarmCellFreeForResource(col: number, row: number): boolean {
  if (col < 2 || row < 2 || col > farmMap.cols - 3 || row > farmMap.rows - 3) return false;

  staticGrid ??= buildWalkableGrid(farmMap);
  if (!staticGrid.isWalkable(col, row)) return false;

  farmlandCellKeys ??= new Set(farmMap.farmlandArea.map(([c, r]) => cellKey(c, r)));
  if (farmlandCellKeys.has(cellKey(col, row))) return false;

  const gid = farmMap.ground?.[row]?.[col];
  if (gid !== undefined && gid !== GRASS_FLAT_TILE_INDEX && gid !== GRASS_FLAT_DARK_TILE_INDEX) return false;

  for (const [c, r] of getKeyPoints()) {
    if (Math.max(Math.abs(c - col), Math.abs(r - row)) <= KEEP_CLEAR_RADIUS) return false;
  }

  for (const record of gameState.placedDecorations.values()) {
    const footprint = DECORATIONS[record.decorationId]?.footprint ?? { width: 1, height: 1 };
    if (col >= record.col && col < record.col + footprint.width && row >= record.row && row < record.row + footprint.height) return false;
  }

  return true;
}

/**
 * Ciclo de dias da Fazenda: avança o estágio de toda árvore (broto → muda → adulta) e faz nascer brotos ("bolotas"
 * germinando) em grama livre — chamado na virada de dia por `systems/dayCycle.ts` (dormir) e pela `MainScene` (meia-noite),
 * sem depender de a Fazenda estar aberta.
 */
export function advanceFarmResourcesDay(): void {
  resourceNodeRegistry.advanceDay(FARM_RESOURCES_KEY, farmMap.cols, farmMap.rows, isFarmCellFreeForResource);
}

/**
 * Os recursos colhíveis da Fazenda no mundo (Fase 7 — Coleta de Recursos, agora também na Fazenda): as árvores do mapa, as
 * plantadas pelo jogador e as que brotam sozinhas — cortáveis com o Machado quando adultas — e as pedras, quebráveis com a
 * Picareta. Tudo desenhado a partir do registro (`FARM_RESOURCES_KEY`), que sobrevive a trocas de cena e vai pro save: a cena
 * só reflete o estado (`render`). Árvore adulta e pedra bloqueiam a célula no grid e ganham o `Interactable` de coleta (que também
 * desbloqueia e tira do registro ao colher); broto e muda são andáveis (balançam ao pisar, `rustle`).
 */
export class FarmResources {
  private readonly visuals = new Map<string, { visual: WorldResourceVisual; kind: ResourceNode['kind']; stage: ResourceNode['stage'] }>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly grid: WalkableGrid,
    private readonly interactions: InteractionRegistry,
    private readonly player: Player,
  ) {
    this.render();
  }

  /** Redesenha tudo a partir do registro ATUAL — na criação da cena e depois de uma virada de dia (novos estágios/brotos). */
  render(): void {
    for (const { visual } of this.visuals.values()) {
      visual.sprite.destroy();
      visual.shadow?.destroy();
    }
    this.visuals.clear();

    let rockVariant: 0 | 1 | 2 = 0;
    for (const node of resourceNodeRegistry.getNodes(FARM_RESOURCES_KEY)) {
      const key = cellKey(node.col, node.row);

      if (node.kind === 'tree') {
        const visual = buildGrowingTree(this.scene, TILE_SIZE, node.col, node.row, node.stage, node.species);
        this.visuals.set(key, { visual, kind: node.kind, stage: node.stage });
        if (node.stage === 'mature') {
          this.grid.block(node.col, node.row);
          this.interactions.set(node.col, node.row, new TreeInteractable(this.player, visual, this.grid, this.interactions, FARM_RESOURCES_KEY, node.col, node.row));
        }
        continue;
      }

      const big = node.kind === 'bigRock';
      const visual = buildRock(this.scene, TILE_SIZE, node.col, node.row, rockVariant, big);
      rockVariant = ((rockVariant + 1) % 3) as 0 | 1 | 2;
      this.visuals.set(key, { visual, kind: node.kind, stage: node.stage });
      this.grid.block(node.col, node.row);
      this.interactions.set(node.col, node.row, new RockInteractable(this.player, visual, this.grid, this.interactions, FARM_RESOURCES_KEY, node.col, node.row, big));
    }
  }

  /** O jogador plantou uma bolota: nasce como broto (e cresce com os dias, como os que brotam sozinhos). */
  plant(col: number, row: number): void {
    resourceNodeRegistry.addNode(FARM_RESOURCES_KEY, { col, row, kind: 'tree', stage: 'sprout' });
    const visual = buildGrowingTree(this.scene, TILE_SIZE, col, row, 'sprout');
    this.visuals.set(cellKey(col, row), { visual, kind: 'tree', stage: 'sprout' });
  }

  /** Sprites de todas as árvores (qualquer estágio) — pra transparência de sobreposição (`updateTreeOverlap`) quando o personagem passa atrás delas. */
  getTreeSprites(): Phaser.GameObjects.Image[] {
    return Array.from(this.visuals.values())
      .filter((entry) => entry.kind === 'tree' && entry.visual.sprite.active) // árvore cortada: o sprite foi destruído mas a entrada só sai no próximo `render`
      .map((entry) => entry.visual.sprite);
  }

  /** Broto/muda balançam ao jogador pisar em cima (a adulta e as pedras ficam paradas). */
  rustle(col: number, row: number): void {
    const entry = this.visuals.get(cellKey(col, row));
    if (!entry || entry.kind !== 'tree' || entry.stage === 'mature') return;
    const sprite = entry.visual.sprite;
    if (this.scene.tweens.isTweening(sprite)) return;

    this.scene.tweens.add({
      targets: sprite,
      angle: { from: 0, to: 8 },
      duration: 120,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeInOut',
      onComplete: () => sprite.setAngle(0),
    });
  }
}
