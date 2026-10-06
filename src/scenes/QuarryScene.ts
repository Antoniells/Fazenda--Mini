import { ExternalMapScene, computeArrivalClearance } from './ExternalMapScene';
import { quarryMap } from '../data/maps/quarryMap';
import { ROCK_KEY, ROCK_PATH, ORE_KEY, ORE_PATH, TILE_SIZE } from '../data/tiles';
import { buildRock, buildOreDeposit } from '../systems/externalMapBuilder';
import { buildMapProps } from '../systems/mapProps';
import { resourceNodeRegistry } from '../systems/resourceNodeRegistry';
import { RockInteractable } from '../systems/resourceInteraction';
import { OreInteractable } from '../systems/oreInteraction';
import { ORE_RESPAWN_CHANCE, getQuarryVeins } from '../data/ores';
import { WalkableGrid } from '../systems/grid';
import { InteractionRegistry } from '../systems/interaction';
import { Player } from '../entities/Player';

export const QUARRY_SCENE_KEY = 'QuarryScene';

/** Saturação do chão da Pedreira (0 = cinza total, 1 = grama verde natural). */
const QUARRY_GROUND_SATURATION = 0.1;
/** Tint do chão da Pedreira: bem mais claro que o da faixa Mineração da Fazenda (`BIOME_TINTS.mining`) — o cinza vem da dessaturação, não de escurecer. */
const QUARRY_GROUND_TINT = 0xdddddd;

/** Teto de nós ativos ao mesmo tempo (Fase 7 — respawn diário). Sem árvores aqui, só pedras. */
const QUARRY_CAPS = { maxTrees: 0, maxRocks: 42 };

/** A ponte de volta da Pedreira fica na parede LESTE (a Fazenda a alcança pela oeste) — ver `ExternalMapConfig.returnDirection`. */
const QUARRY_RETURN_DIRECTION = 'east';
/** Zona de chegada dessa ponte: livre de pedras sempre (ver `computeArrivalClearance`), como a da Floresta. */
function quarryArrivalCells(): Set<string> {
  return new Set(computeArrivalClearance(QUARRY_RETURN_DIRECTION, quarryMap.cols, quarryMap.rows).map(([col, row]) => `${col},${row}`));
}

/** Virada de dia da Pedreira (Fase 7) — mesma ideia de `ForestScene.advanceForestDay`, chamada pela `MainScene`. */
export function advanceQuarryDay(): void {
  const { cols, rows } = quarryMap;
  // Pedras novas nunca nascem no lugar de um veio (mesmo quebrado): é onde ele volta. Nem na chegada da ponte (fecharia a passarela).
  const oreCells = new Set(getQuarryVeins().map(({ col, row }) => `${col},${row}`));
  const arrivalCells = quarryArrivalCells();
  const isCellFree = (col: number, row: number): boolean => !oreCells.has(`${col},${row}`) && !arrivalCells.has(`${col},${row}`);

  resourceNodeRegistry.advanceDay(QUARRY_SCENE_KEY, cols, rows, isCellFree);
  resourceNodeRegistry.respawnInitial(QUARRY_SCENE_KEY, 'ore', ORE_RESPAWN_CHANCE); // Os veios quebrados voltam ao lugar de origem, aos poucos.
}

/** Destino da ponte Oeste (Mineração) — ver `data/maps/quarryMap.ts`. Pedras (Picareta) e veios de cobre/carvão/ferro/ouro (`data/ores.ts`). */
export class QuarryScene extends ExternalMapScene {
  constructor() {
    const { cols, rows } = quarryMap;
    const arrivalCells = quarryArrivalCells();
    const outsideArrival = ([col, row]: [number, number]): boolean => !arrivalCells.has(`${col},${row}`);

    resourceNodeRegistry.ensureInitialized(
      QUARRY_SCENE_KEY,
      [
        ...quarryMap.rockPositions.filter(outsideArrival).map(([col, row]) => ({ col, row, kind: 'smallRock' as const, stage: 'mature' as const })),
        ...quarryMap.bigRockPositions.filter(outsideArrival).map(([col, row]) => ({ col, row, kind: 'bigRock' as const, stage: 'mature' as const })),
        ...getQuarryVeins().map(({ kind, col, row }) => ({ col, row, kind: 'ore' as const, ore: kind, stage: 'mature' as const })),
      ],
      QUARRY_CAPS,
    );

    super(QUARRY_SCENE_KEY, {
      cols,
      rows,
      areaName: 'Pedreira',
      mapType: 'quarry',
      ground: quarryMap.ground,
      // Sem cor autorada no editor, o vazio em volta do mapa (a janela é maior que ele) usa o tom do chão cinza da Pedreira (medido na tela: #6c7265).
      backgroundColor: quarryMap.backgroundColor ?? '#6c7265',
      groundTint: QUARRY_GROUND_TINT,
      // Chão bem mais cinza (pedido explícito): a grama quase sem cor, de pedra/cascalho, em vez do verde apenas escurecido.
      groundSaturation: QUARRY_GROUND_SATURATION,
      // Continuidade espacial: a ponte da Fazenda que traz o jogador aqui
      // fica a OESTE, então a ponte de volta fica a LESTE (lado oposto).
      returnDirection: QUARRY_RETURN_DIRECTION,
      obstacleCells: [
        // (as pedras e os veios de minério bloqueiam em `buildMapContent`, a partir do registro ATUAL — listar aqui deixava parede invisível onde um já foi quebrado.)
        ...(quarryMap.blockedArea ?? []),
      ],
    });
  }

  protected loadMapAssets(): void {
    this.load.image(ROCK_KEY, encodeURI(`/${ROCK_PATH}`));
    this.load.image(ORE_KEY, encodeURI(`/${ORE_PATH}`));
  }

  protected buildMapContent(ctx: { tilePx: number; grid: WalkableGrid; interactions: InteractionRegistry; player: Player }): void {
    const { grid, interactions, player } = ctx;

    // Saves antigos (e o mapa original, que tinha uma pedra grande na passarela) podem ter pedra na zona de chegada da ponte: a cada
    // entrada ela é limpa, como na Floresta. (Aqui, e não no construtor: o save só é restaurado depois dele.)
    for (const cell of quarryArrivalCells()) {
      const [col, row] = cell.split(',').map(Number);
      resourceNodeRegistry.removeNode(QUARRY_SCENE_KEY, col, row);
    }

    let rockVariant: 0 | 1 | 2 = 0;
    for (const node of resourceNodeRegistry.getNodes(QUARRY_SCENE_KEY)) {
      grid.block(node.col, node.row);
      // Veio de minério (cobre, carvão, ferro, ouro): minerado com a Picareta (`systems/oreInteraction.ts`).
      if (node.kind === 'ore' && node.ore) {
        const sprite = buildOreDeposit(this, TILE_SIZE, node.col, node.row, node.ore);
        interactions.set(node.col, node.row, new OreInteractable(player, { sprite }, grid, interactions, QUARRY_SCENE_KEY, node.col, node.row, node.ore));
        continue;
      }
      const big = node.kind === 'bigRock';
      const visual = buildRock(this, TILE_SIZE, node.col, node.row, rockVariant, big);
      rockVariant = ((rockVariant + 1) % 3) as 0 | 1 | 2;
      interactions.set(node.col, node.row, new RockInteractable(player, visual, grid, interactions, QUARRY_SCENE_KEY, node.col, node.row, big));
    }

    // Props de decoração ambiente (aba "Decoração" do MapEditorScene, pedido explícito) — puramente visuais, sem colisão.
    buildMapProps(this, TILE_SIZE, quarryMap.props ?? []);
  }
}
