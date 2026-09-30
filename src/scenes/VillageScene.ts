import Phaser from 'phaser';
import { ExternalMapScene } from './ExternalMapScene';
import { SHOP_INTERIOR_SCENE_KEY, ShopInteriorEntryData } from './ShopInteriorScene';
import { VILLAGE_ASSETS, VILLAGE_COLS, VILLAGE_ROWS, VILLAGE_WELL, villageBlockedCells, villageDirtZone, structureDoorCell } from '../data/maps/villageMap';
import { TILE_SIZE } from '../data/tiles';
import { DISPLAY_SCALE } from '../systems/mapBuilder';
import { installEnterHoverCursor } from '../systems/gameCursor';
import { isDialogueOpen, isInventoryOpen } from './UIScene';
import { popText } from '../systems/floatingText';
import { villageLayout } from '../data/maps/villageLayout';
import { buildVillage, preloadVillage } from '../systems/villageBuilder';
import { NpcSystem, isWorkingNow, preloadNpcs, workingHoursText } from '../systems/npcSystem';
import { NPCS, VILLAGE_NPC_IDS, NpcId } from '../data/npcs';
import { SHOP_INTERIOR_BY_NPC } from '../data/maps/shopInteriors';
import { updateTreeOverlap } from '../systems/treeOverlap';
import { LightSourceSystem, preloadLightSources } from '../systems/lightSources';
import { VILLAGE_LIGHT_SOURCES } from '../data/lighting';
import { gameState } from '../systems/gameState';
import { isCarpenterBusy } from '../systems/construction';
import { WalkableGrid } from '../systems/grid';
import { Interactable, InteractionRegistry } from '../systems/interaction';
import { shouldStartHorde } from '../systems/horde';
import { playEffect } from '../systems/soundEffects';
import { DOOR_SOUND, WATER_SOUND } from '../data/audio';
import { Player } from '../entities/Player';

export const VILLAGE_SCENE_KEY = 'VillageScene';

const FADE_MS = 300;

/** A porta de uma loja: clicar (ou F) leva o jogador até a rua em frente a ela e, aberta, entra; fechada, avisa o horário. */
class ShopDoorInteractable implements Interactable {
  readonly keyInteractable = true;
  constructor(
    private readonly player: Player,
    readonly approachCell: { col: number; row: number },
    private readonly onEnter: () => void,
  ) {}

  interact(): void {
    if (this.player.isBusy()) return;
    this.onEnter();
  }
}

/** O poço da praça: como o da Fazenda, encher o regador (a animação de buscar água + o respingo e o som); o jogador vai até a rua em frente a ele. */
class VillageWellInteractable implements Interactable {
  readonly keyInteractable = true;
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Player,
    readonly approachCell: { col: number; row: number },
    private readonly splashAt: { x: number; y: number },
  ) {}

  interact(): void {
    if (this.player.isBusy()) return;
    this.player.performAction('well', () => {
      gameState.inventory.refillWateringCan();
      playEffect(this.scene, WATER_SOUND);
      popText(this.scene, this.splashAt.x, this.splashAt.y, 'Regador cheio!', { color: '#9fd8ff', fontSize: 14 });
    });
  }
}

/**
 * Vilarejo: a cidadezinha além da Fazenda, alcançada pela ponte LESTE (estrada aberta desde o começo, sem requisito). Antes era um
 * trecho colado à Fazenda; agora é uma cena própria, longe dela — a viagem tem transição e o dia/noite corre aqui como em qualquer
 * mapa (`ExternalMapScene` faz o relógio e o véu da noite). A ponte de volta fica na parede OESTE, de frente pra rua principal.
 * O layout (casas, praça, ruas) e as colisões vêm de `data/maps/villageMap.ts`. As lojas ficam DENTRO das casas dos donos
 * (`ShopInteriorScene`, um layout por loja): a porta de cada uma abre no expediente do dono.
 */
export class VillageScene extends ExternalMapScene {
  private trees: Phaser.GameObjects.Image[] = [];
  private npcs!: NpcSystem;
  private lightSources!: LightSourceSystem;
  private isEnteringShop = false;

  constructor() {
    super(VILLAGE_SCENE_KEY, {
      cols: VILLAGE_COLS,
      rows: VILLAGE_ROWS,
      areaName: 'Vilarejo',
      // F2 abre o editor do Vilarejo (`MapEditorScene`, `mapType: 'village'`) — o layout editável vem de `data/maps/villageLayout.ts`.
      mapType: 'village',
      // Chão autorado no editor (tiles pintados) quando existir; sem ele, grama procedural + ruas de terra (`dirtZone`, só vale sem `ground`).
      ground: villageLayout.ground,
      backgroundColor: villageLayout.backgroundColor,
      dirtZone: villageDirtZone,
      // A Fazenda a alcança pela ponte LESTE, então a de volta fica a OESTE.
      returnDirection: 'west',
      obstacleCells: villageBlockedCells(),
    });
  }

  protected loadMapAssets(): void {
    preloadVillage(this);
    preloadNpcs(this, VILLAGE_NPC_IDS);
    preloadLightSources(this);
  }

  protected buildMapContent(ctx: { tilePx: number; grid: WalkableGrid; interactions: InteractionRegistry; player: Player }): void {
    const { interactions, player } = ctx;
    this.isEnteringShop = false; // O Phaser reaproveita esta instância entre `scene.start`.

    // O Phaser reaproveita esta instância entre `scene.start`: recomeça a lista de árvores a cada entrada.
    this.trees = buildVillage(this).trees;

    // Postes de luz: acendem à noite e apagam ao amanhecer (`update`); a base de cada um bloqueia a célula (antes dos moradores, que andam pelo grid).
    this.lightSources = new LightSourceSystem(this, VILLAGE_LIGHT_SOURCES);
    for (const [col, row] of this.lightSources.blockedCells()) ctx.grid.block(col, row);

    this.registerShopDoors(interactions, player);
    this.registerEnterCursor();
    this.registerWell(interactions, player, ctx.tilePx);

    // Moradores: cada um na sua rotina do dia (`data/npcs.ts`); clicar num deles conversa.
    this.npcs = new NpcSystem(this, ctx.grid, player, this.controller, ctx.tilePx, { ids: VILLAGE_NPC_IDS, posts: {} });
  }

  /** A porta de cada casa com loja (a célula sólida da porta, na parede — a rua em frente é a `approachCell`). */
  private registerShopDoors(interactions: InteractionRegistry, player: Player): void {
    for (const npcId of Object.keys(SHOP_INTERIOR_BY_NPC) as NpcId[]) {
      const home = NPCS[npcId].home;
      const front = home ? structureDoorCell(home) : null;
      if (!home || !front) continue;
      // A célula da porta é a da parede logo acima da rua em frente a ela.
      const doorCell = { col: front.col, row: front.row - 1 };
      interactions.set(doorCell.col, doorCell.row, new ShopDoorInteractable(player, front, () => this.enterShop(npcId, front)));
    }
  }

  /** O ponteiro vira a luva sobre as casas em que se pode entrar (as com loja, `SHOP_INTERIOR_BY_NPC`) — a área é a da arte inteira da casa. */
  private registerEnterCursor(): void {
    const tile = TILE_SIZE * DISPLAY_SCALE;
    const areas: Phaser.Geom.Rectangle[] = [];
    for (const npcId of Object.keys(SHOP_INTERIOR_BY_NPC) as NpcId[]) {
      const home = NPCS[npcId].home;
      if (!home) continue;
      const source = this.textures.get(VILLAGE_ASSETS[home.asset].key).getSourceImage();
      areas.push(new Phaser.Geom.Rectangle(home.col * tile, home.row * tile, source.width * DISPLAY_SCALE, source.height * DISPLAY_SCALE));
    }
    installEnterHoverCursor(this, () => areas, () => isDialogueOpen() || isInventoryOpen());
  }

  /** O poço da praça (2x1 células sólidas): clicar em qualquer uma leva o jogador até a rua logo abaixo e enche o regador. */
  private registerWell(interactions: InteractionRegistry, player: Player, tilePx: number): void {
    const { col, row } = VILLAGE_WELL;
    const approach = { col, row: row + 1 };
    const splashAt = { x: (col + 1) * tilePx, y: row * tilePx };
    const well = new VillageWellInteractable(this, player, approach, splashAt);
    interactions.set(col, row, well);
    interactions.set(col + 1, row, well);
  }

  /** Porta clicada: entra se o dono está em expediente; senão avisa o horário. */
  private enterShop(npcId: NpcId, outsideCell: { col: number; row: number }): void {
    if (this.isEnteringShop) return;
    const def = NPCS[npcId];
    const interior = SHOP_INTERIOR_BY_NPC[npcId];
    if (!interior) return;

    if (gameState.horde.active || shouldStartHorde()) {
      this.lockedMessage.show('A HORDA CHEGOU!', 'Não dá pra entrar agora: defenda a Fazenda!');
      return;
    }
    if (npcId === 'carpenter' && isCarpenterBusy()) {
      this.lockedMessage.show('OCUPADO', `${def.name} está construindo na Fazenda. Volte mais tarde.`);
      return;
    }
    if (!isWorkingNow(def, gameState.gameClock.getHours(), gameState.weather.raining)) {
      this.lockedMessage.show('FECHADO', `${def.name} não está atendendo. ${workingHoursText(def)}`);
      return;
    }

    this.isEnteringShop = true;
    playEffect(this, DOOR_SOUND);
    const data: ShopInteriorEntryData = { id: interior, village: this.entryData, outsideCell };
    this.cameras.main.fadeOut(FADE_MS, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(SHOP_INTERIOR_SCENE_KEY, data));
  }

  update(time: number, delta: number): void {
    super.update(time, delta);
    this.npcs.update(time, delta);
    this.lightSources.update(gameState.gameClock.getHours(), time);
    updateTreeOverlap(this.player, this.trees);
  }
}
