import Phaser from 'phaser';
import { ExternalMapScene } from './ExternalMapScene';
import { caveMap } from '../data/maps/caveMap';
import { CAVE_ENTRANCE_KEY, CAVE_ENTRANCE_PATH, TILE_SIZE } from '../data/tiles';
import { buildCaveEntrance } from '../systems/externalMapBuilder';
import { buildMapProps } from '../systems/mapProps';
import { Interactable, InteractionRegistry } from '../systems/interaction';
import { Player } from '../entities/Player';
import { WalkableGrid } from '../systems/grid';
import { gameState } from '../systems/gameState';
import { CAVE_MAX_FLOOR, unlockedCheckpoints } from '../data/caveFloors';
import { CAVE_FLOOR_SCENE_KEY, CaveFloorEntryData } from './CaveFloorScene';
import { DialoguePayload, OPEN_DIALOGUE_EVENT } from '../ui/dialoguePanel';

export const CAVE_SCENE_KEY = 'CaveScene';

/** A entrada da caverna: clicar (ou F) leva o jogador até a frente dela e abre a escolha do andar. */
class CaveEntranceInteractable implements Interactable {
  readonly keyInteractable = true;
  constructor(
    private readonly player: Player,
    readonly approachCell: { col: number; row: number },
    private readonly onOpen: () => void,
  ) {}

  interact(): void {
    if (this.player.isBusy()) return;
    this.onOpen();
  }
}

/** As células que a escadaria da entrada ocupa: a do meio e uma de cada lado (a arte tem ~2 células de largura). */
function entranceCells(): Array<[number, number]> {
  const [col, row] = caveMap.caveEntrancePosition;
  return [[col - 1, row], [col, row], [col + 1, row]];
}

/** Quantos atalhos aparecem na escolha do andar (os mais fundos já alcançados). */
const MAX_FLOOR_CHOICES = 5;

/**
 * Destino da ponte Norte (Cavernas) — ver `data/maps/caveMap.ts`. É só a ENTRADA (superfície): a caverna de verdade são os 100 andares de `CaveFloorScene`,
 * alcançados pela entrada (andar 1, ou um atalho de 5 em 5 andares até o mais fundo já visitado, `gameState.cave.deepest`).
 */
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
      obstacleCells: [...entranceCells(), ...(caveMap.blockedArea ?? [])],
    });
  }

  protected loadMapAssets(): void {
    this.load.image(CAVE_ENTRANCE_KEY, encodeURI(`/${CAVE_ENTRANCE_PATH}`));
  }

  protected buildMapContent(ctx: { tilePx: number; grid: WalkableGrid; interactions: InteractionRegistry; player: Player }): void {
    const [col, row] = caveMap.caveEntrancePosition;
    buildCaveEntrance(this, TILE_SIZE, col, row);
    const entrance = new CaveEntranceInteractable(ctx.player, { col, row: row + 1 }, () => this.openFloorChoice());
    for (const [entranceCol, entranceRow] of entranceCells()) ctx.interactions.set(entranceCol, entranceRow, entrance);
    // Props de decoração ambiente (aba "Decoração" do MapEditorScene, pedido explícito) — puramente visuais, sem colisão.
    buildMapProps(this, TILE_SIZE, caveMap.props ?? []);
  }

  /** A escolha do andar: o 1 e os atalhos de 5 em 5 já liberados (os mais fundos, no máximo MAX_FLOOR_CHOICES). */
  private openFloorChoice(): void {
    const deepest = gameState.cave.deepest;
    const floors = unlockedCheckpoints(deepest).slice(-MAX_FLOOR_CHOICES);
    const payload: DialoguePayload = {
      speaker: 'Entrada da Caverna',
      subtitle: deepest > 0 ? `Mais fundo alcançado: andar ${deepest} de ${CAVE_MAX_FLOOR}` : `${CAVE_MAX_FLOOR} andares de escuridão`,
      text: 'Uma escadaria desce pra dentro da terra. Quanto mais fundo, mais inimigos — e mais fortes. A cada 5 andares você libera um atalho aqui na entrada.',
      actions: floors.map((floor) => ({ label: floor === 1 ? 'Descer (andar 1)' : `Atalho: andar ${floor}`, onSelect: () => this.descend(floor) })),
    };
    this.game.events.emit(OPEN_DIALOGUE_EVENT, payload);
  }

  private descend(floor: number): void {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    const data: CaveFloorEntryData = { floor, from: 'above', surface: this.entryData };
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(CAVE_FLOOR_SCENE_KEY, data));
  }
}