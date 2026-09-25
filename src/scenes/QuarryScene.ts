import { ExternalMapScene } from './ExternalMapScene';
import { quarryMap } from '../data/maps/quarryMap';
import { ROCK_KEY, ROCK_PATH, ORE_KEY, ORE_PATH, TILE_SIZE } from '../data/tiles';
import { BIOME_TINTS } from '../systems/mapBuilder';
import { buildRock, buildOreDeposit } from '../systems/externalMapBuilder';
import { buildMapProps } from '../systems/mapProps';
import { resourceNodeRegistry } from '../systems/resourceNodeRegistry';
import { RockInteractable } from '../systems/resourceInteraction';
import { WalkableGrid } from '../systems/grid';
import { InteractionRegistry } from '../systems/interaction';
import { Player } from '../entities/Player';

export const QUARRY_SCENE_KEY = 'QuarryScene';

/** Teto de nós ativos ao mesmo tempo (Fase 7 — respawn diário). Sem árvores aqui, só pedras. */
const QUARRY_CAPS = { maxTrees: 0, maxRocks: 42 };

/** Virada de dia da Pedreira (Fase 7) — mesma ideia de `ForestScene.advanceForestDay`, chamada pela `MainScene`. */
export function advanceQuarryDay(): void {
  const { cols, rows, ironOrePositions, coalOrePositions } = quarryMap;
  const oreCells = new Set([...ironOrePositions, ...coalOrePositions].map(([c, r]) => `${c},${r}`));
  const isCellFree = (col: number, row: number): boolean => !oreCells.has(`${col},${row}`);

  resourceNodeRegistry.advanceDay(QUARRY_SCENE_KEY, cols, rows, isCellFree);
}

/** Destino da ponte Oeste (Mineração) — ver `data/maps/quarryMap.ts`. */
export class QuarryScene extends ExternalMapScene {
  constructor() {
    const { cols, rows } = quarryMap;

    resourceNodeRegistry.ensureInitialized(
      QUARRY_SCENE_KEY,
      [
        ...quarryMap.rockPositions.map(([col, row]) => ({ col, row, kind: 'smallRock' as const, stage: 'mature' as const })),
        ...quarryMap.bigRockPositions.map(([col, row]) => ({ col, row, kind: 'bigRock' as const, stage: 'mature' as const })),
      ],
      QUARRY_CAPS,
    );

    super(QUARRY_SCENE_KEY, {
      cols,
      rows,
      areaName: 'Pedreira',
      mapType: 'quarry',
      ground: quarryMap.ground,
      // Sem cor autorada no editor, o vazio em volta do mapa (a janela é maior que ele) usa o tom da própria grama cinza da Pedreira.
      backgroundColor: quarryMap.backgroundColor ?? '#55772f',
      // Mesmo cinza já usado na faixa "Mineração" dentro da Fazenda.
      groundTint: BIOME_TINTS.mining,
      // Continuidade espacial: a ponte da Fazenda que traz o jogador aqui
      // fica a OESTE, então a ponte de volta fica a LESTE (lado oposto).
      returnDirection: 'east',
      obstacleCells: [
        ...quarryMap.ironOrePositions,
        ...quarryMap.coalOrePositions,
        // (as pedras em si bloqueiam em `buildMapContent`, a partir do registro ATUAL — listar aqui deixava parede invisível onde uma pedra já foi quebrada.)
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

    // Minério: só decorativo por ora (ver `data/tiles.ts`), não participa do respawn/coleta.
    for (const [col, row] of quarryMap.ironOrePositions) buildOreDeposit(this, TILE_SIZE, col, row, 'iron');
    for (const [col, row] of quarryMap.coalOrePositions) buildOreDeposit(this, TILE_SIZE, col, row, 'coal');

    let rockVariant: 0 | 1 | 2 = 0;
    for (const node of resourceNodeRegistry.getNodes(QUARRY_SCENE_KEY)) {
      grid.block(node.col, node.row);
      const big = node.kind === 'bigRock';
      const visual = buildRock(this, TILE_SIZE, node.col, node.row, rockVariant, big);
      rockVariant = ((rockVariant + 1) % 3) as 0 | 1 | 2;
      interactions.set(node.col, node.row, new RockInteractable(player, visual, grid, interactions, QUARRY_SCENE_KEY, node.col, node.row, big));
    }

    // Props de decoração ambiente (aba "Decoração" do MapEditorScene, pedido explícito) — puramente visuais, sem colisão.
    buildMapProps(this, TILE_SIZE, quarryMap.props ?? []);
  }
}
