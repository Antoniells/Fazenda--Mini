import { ExternalMapScene } from './ExternalMapScene';
import { beachMap } from '../data/maps/beachMap';
import { WATER_KEY, WATER_PATH, ROCK_KEY, ROCK_PATH, TILE_SIZE } from '../data/tiles';
import { waterAreaCells, buildRock } from '../systems/externalMapBuilder';
import { groundWithWaterRect } from '../systems/waterCells';
import { buildMapProps } from '../systems/mapProps';
import { beachBlockedCells } from '../data/maps/beachDecor';
import { buildBeach, preloadBeach } from '../systems/beachBuilder';
import { NpcSystem, preloadNpcs } from '../systems/npcSystem';
import { BEACH_NPC_IDS } from '../data/npcs';
import { WalkableGrid } from '../systems/grid';
import { InteractionRegistry } from '../systems/interaction';
import { Player } from '../entities/Player';

export const BEACH_SCENE_KEY = 'BeachScene';

/** Destino da ponte Sul (Praia) — ver `data/maps/beachMap.ts`. */
export class BeachScene extends ExternalMapScene {
  private npcs!: NpcSystem;

  constructor() {
    const { cols, rows, oceanArea } = beachMap;
    super(BEACH_SCENE_KEY, {
      cols,
      rows,
      areaName: 'Praia',
      mapType: 'beach',
      // O retângulo do oceano entra no próprio chão como água (ver `groundWithWaterRect`) — antes era uma textura plana por cima, em outra cor.
      ground: groundWithWaterRect(beachMap.ground, oceanArea),
      backgroundColor: beachMap.backgroundColor,
      // Continuidade espacial: a ponte da Fazenda que traz o jogador aqui
      // fica ao SUL, então a ponte de volta fica ao NORTE (lado oposto).
      returnDirection: 'north',
      obstacleCells: [
        ...waterAreaCells(oceanArea.col0, oceanArea.row0, oceanArea.cols, oceanArea.rows),
        ...(beachMap.rockPositions ?? []),
        ...(beachMap.bigRockPositions ?? []),
        ...(beachMap.blockedArea ?? []),
        // Casinha do pescador, guarda-sóis, barracas, coqueiros… (mesma fonte do desenho: `data/maps/beachDecor.ts`).
        ...beachBlockedCells(),
      ],
    });
  }

  protected loadMapAssets(): void {
    this.load.image(WATER_KEY, encodeURI(`/${WATER_PATH}`));
    this.load.image(ROCK_KEY, encodeURI(`/${ROCK_PATH}`));
    preloadBeach(this);
    preloadNpcs(this, BEACH_NPC_IDS);
  }

  protected buildMapContent(ctx: { tilePx: number; grid: WalkableGrid; interactions: InteractionRegistry; player: Player }): void {
    // Pedras da Praia: puramente obstáculo estático (pedido explícito — só
    // "faltam as pedras na paleta"), sem passar pelo `resourceNodeRegistry`
    // como Floresta/Pedreira — nada de minério pra minerar aqui, só bloqueia
    // a célula (já em `obstacleCells`) e desenha o mesmo asset de Pedra.
    let rockVariant: 0 | 1 | 2 = 0;
    for (const [col, row] of beachMap.rockPositions ?? []) {
      buildRock(this, TILE_SIZE, col, row, rockVariant);
      rockVariant = ((rockVariant + 1) % 3) as 0 | 1 | 2;
    }
    for (const [col, row] of beachMap.bigRockPositions ?? []) {
      buildRock(this, TILE_SIZE, col, row, rockVariant, true);
      rockVariant = rockVariant === 0 ? 1 : 0;
    }

    // Props de decoração ambiente (aba "Decoração" do MapEditorScene, pedido explícito) — puramente visuais, sem colisão.
    buildMapProps(this, TILE_SIZE, beachMap.props ?? []);

    // Casinha do pescador, guarda-sóis, toalhas, barracas da feirinha, coqueiros, moai e canoa.
    buildBeach(this);

    // A sereia Marina mora no mar (aparece de dia): clicar nela leva o jogador até a areia e conversa.
    this.npcs = new NpcSystem(this, ctx.grid, ctx.player, this.controller, ctx.tilePx, { ids: BEACH_NPC_IDS, posts: {} });
  }

  update(time: number, delta: number): void {
    super.update(time, delta);
    this.npcs.update(time, delta);
  }
}
