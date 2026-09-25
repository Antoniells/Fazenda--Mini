import { ExternalMapScene } from './ExternalMapScene';
import { caveMap } from '../data/maps/caveMap';
import { CAVE_ENTRANCE_KEY, CAVE_ENTRANCE_PATH, TILE_SIZE } from '../data/tiles';
import { buildCaveEntrance } from '../systems/externalMapBuilder';
import { buildMapProps } from '../systems/mapProps';

export const CAVE_SCENE_KEY = 'CaveScene';

/** Destino da ponte Norte (Cavernas) — ver `data/maps/caveMap.ts`. */
export class CaveScene extends ExternalMapScene {
  constructor() {
    const { cols, rows } = caveMap;
    super(CAVE_SCENE_KEY, {
      cols,
      rows,
      areaName: 'Cavernas',
      mapType: 'cave',
      ground: caveMap.ground,
      // Sem cor autorada, o vazio em volta do mapa usa o azul-acinzentado da caverna.
      backgroundColor: caveMap.backgroundColor ?? '#1b2030',
      // Continuidade espacial: a ponte da Fazenda que traz o jogador aqui
      // fica ao NORTE, então a ponte de volta fica ao SUL (lado oposto) —
      // o jogador entra por baixo e anda em direção à entrada da caverna,
      // que fica mais ao norte deste mapa.
      returnDirection: 'south',
      obstacleCells: [caveMap.caveEntrancePosition, ...(caveMap.blockedArea ?? [])],
    });
  }

  protected loadMapAssets(): void {
    this.load.image(CAVE_ENTRANCE_KEY, encodeURI(`/${CAVE_ENTRANCE_PATH}`));
  }

  protected buildMapContent(): void {
    const [col, row] = caveMap.caveEntrancePosition;
    buildCaveEntrance(this, TILE_SIZE, col, row);
    // Props de decoração ambiente (aba "Decoração" do MapEditorScene, pedido explícito) — puramente visuais, sem colisão.
    buildMapProps(this, TILE_SIZE, caveMap.props ?? []);
  }
}
