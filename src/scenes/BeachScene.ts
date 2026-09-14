import { ExternalMapScene } from './ExternalMapScene';
import { beachMap } from '../data/maps/beachMap';
import { WATER_KEY, WATER_PATH, TILE_SIZE } from '../data/tiles';
import { BIOME_TINTS } from '../systems/mapBuilder';
import { buildWaterArea, waterAreaCells } from '../systems/externalMapBuilder';

export const BEACH_SCENE_KEY = 'BeachScene';

/** Destino da ponte Sul (Praia) — ver `data/maps/beachMap.ts`. */
export class BeachScene extends ExternalMapScene {
  constructor() {
    const { cols, rows, oceanArea } = beachMap;
    super(BEACH_SCENE_KEY, {
      cols,
      rows,
      areaName: 'Praia',
      // Mesmo tom de areia já usado na faixa "Praia" dentro da Fazenda.
      groundTint: BIOME_TINTS.beach,
      // Continuidade espacial: a ponte da Fazenda que traz o jogador aqui
      // fica ao SUL, então a ponte de volta fica ao NORTE (lado oposto).
      returnDirection: 'north',
      obstacleCells: waterAreaCells(oceanArea.col0, oceanArea.row0, oceanArea.cols, oceanArea.rows),
    });
  }

  protected loadMapAssets(): void {
    this.load.image(WATER_KEY, encodeURI(`/${WATER_PATH}`));
  }

  protected buildMapContent(): void {
    const { oceanArea } = beachMap;
    buildWaterArea(this, TILE_SIZE, oceanArea.col0, oceanArea.row0, oceanArea.cols, oceanArea.rows);
  }
}
