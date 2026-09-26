import Phaser from 'phaser';
import {
  INTERIOR_TILES,
  PROP_ART,
  SHOP_INTERIORS,
  interiorTileFrame,
  type InteriorProp,
  type PropArt,
  type ShopInteriorId,
  type ShopInteriorLayout,
} from '../data/maps/shopInteriors';
import { NPCS } from '../data/npcs';
import { TILE_SIZE } from '../data/tiles';
import { SHADOW_KEY, SHADOW_PATH } from '../data/effects';
import { DOOR_SOUND } from '../data/audio';
import { DISPLAY_SCALE } from '../systems/mapBuilder';
import { buildExternalGrid, ExternalMapEntryData } from './ExternalMapScene';
import { Player } from '../entities/Player';
import { PlayerController } from '../systems/playerController';
import { Interactable, InteractionRegistry } from '../systems/interaction';
import { createGroundShadow } from '../systems/shadow';
import { attachFootstepSounds, playEffect } from '../systems/soundEffects';
import { preloadPlayerSprites } from '../systems/playerSprites';
import { gameState } from '../systems/gameState';
import { onPlayerStepped } from '../systems/sceneEvents';
import { installUiCamera } from '../systems/uiCamera';
import { advanceWorldTime } from '../systems/worldTime';
import { shouldStartHorde } from '../systems/horde';
import { DayNightOverlay } from '../systems/dayNightOverlay';
import { WorldBlur } from '../systems/worldBlur';
import { isWorkingNow, preloadNpcs, workingHoursText } from '../systems/npcSystem';
import { talkToNpc } from '../systems/npcDialogue';
import { createVendorShop, VendorId } from '../systems/vendorShops';
import { isCarpenterBusy } from '../systems/construction';
import type { BuildRequest } from '../data/construction';
import { preloadVillageShop } from '../systems/villageShop';
import { registerFrame } from '../systems/externalMapBuilder';
import { ShopMenu } from '../ui/shopMenu';
import { LockedMessage } from '../ui/lockedMessage';
import { ensureUIScene, isDialogueOpen, isInventoryOpen, isFurnaceMenuOpen, toggleInventoryScreen, closeInventoryScreen, closeFurnaceMenu } from './UIScene';

export const SHOP_INTERIOR_SCENE_KEY = 'ShopInteriorScene';
/** A chave da `VillageScene` (repetida aqui em vez de importada: ela importa esta cena — evita a dependência circular). */
const VILLAGE_SCENE_KEY = 'VillageScene';
/** A Fazenda (a escolha de local das encomendas ao Marceneiro abre nela, `systems/buildFlow.ts`). */
const FARM_SCENE_KEY = 'MainScene';

/** O que a Vila manda ao entrar: qual loja, os dados da própria Vila (pra voltar) e a célula da rua em frente à porta (onde o jogador reaparece). */
export interface ShopInteriorEntryData {
  id: ShopInteriorId;
  village: ExternalMapEntryData;
  outsideCell: { col: number; row: number };
}

const FADE_MS = 300;
/** Fração do véu da noite aplicada dentro de casa (ao ar livre é 1): o cômodo tem luz própria, mas escurece com o resto do mundo. */
const INDOOR_NIGHT_INTENSITY = 0.55;
const ROOM_BACKGROUND = '#1b120b';
/** Tamanho máximo do zoom que enquadra o cômodo (cabe inteiro na janela, com folga pra HUD). */
const MAX_ZOOM = 2.6;
const ROOM_FILL_FRACTION = 0.86;
const BACK_WALL_ROWS = 3;

const VENDORS: Partial<Record<string, VendorId>> = { blacksmith: 'blacksmith', supplier: 'supplier', carpenter: 'carpenter' };

/** O balcão / o dono: interagir abre a conversa (com a loja, se ele vende). O jogador atende de frente, na célula ao sul do meio do balcão. */
class KeeperInteractable implements Interactable {
  readonly keyInteractable = true;
  constructor(
    private readonly player: Player,
    readonly approachCell: { col: number; row: number },
    private readonly onTalk: () => void,
  ) {}

  interact(): void {
    if (this.player.isBusy()) return;
    this.onTalk();
  }
}

/**
 * Interior de uma loja do Vilarejo (`data/maps/shopInteriors.ts`): um cômodo com o layout PRÓPRIO daquela loja — chão e paredes do
 * `Tileset House`, peças de `Objects/Interior`/`Work Benches`, o dono atrás do balcão e a porta. Falar com o dono (clicar no balcão ou nele)
 * abre a conversa; quem vende (`sells`) oferece "Ver a loja" (o painel de `systems/vendorShops.ts`) durante o expediente. Pisar na porta sai de
 * volta pra rua do Vilarejo, em frente à porta. O relógio corre aqui como em qualquer cena; se o expediente acaba com o jogador dentro, a loja
 * fecha e ele é levado pra fora. Mesma "cola" da `HouseScene` (Player, PlayerController, UIScene persistente, véu de dia/noite mais leve).
 */
export class ShopInteriorScene extends Phaser.Scene {
  private layout!: ShopInteriorLayout;
  private entry!: ShopInteriorEntryData;
  private player!: Player;
  private controller!: PlayerController;
  private shop: ShopMenu | null = null;
  private dayNightOverlay!: DayNightOverlay;
  private worldBlur!: WorldBlur;
  private lockedMessage!: LockedMessage;
  private isLeaving = false;
  private keeperSprite!: Phaser.GameObjects.Sprite;

  constructor() {
    super(SHOP_INTERIOR_SCENE_KEY);
  }

  init(data: ShopInteriorEntryData): void {
    this.entry = data;
    this.layout = SHOP_INTERIORS[data.id];
    // A instância da cena é reaproveitada entre `scene.start()`.
    this.isLeaving = false;
    this.shop = null;
  }

  preload(): void {
    // Auto-suficiente: tiles, peças, sombra, o sprite do jogador e do dono, e os ícones do catálogo de armas do Ferreiro.
    this.load.spritesheet(INTERIOR_TILES.key, encodeURI(`/${INTERIOR_TILES.path}`), { frameWidth: INTERIOR_TILES.size, frameHeight: INTERIOR_TILES.size });
    const seen = new Set<string>();
    for (const prop of this.layout.props) {
      const art: PropArt = PROP_ART[prop.art];
      if (seen.has(art.key)) continue;
      seen.add(art.key);
      if (art.anim) this.load.spritesheet(art.key, encodeURI(`/${art.path}`), { frameWidth: 32, frameHeight: 32 });
      else this.load.image(art.key, encodeURI(`/${art.path}`));
    }
    this.load.image(SHADOW_KEY, encodeURI(`/${SHADOW_PATH}`));
    preloadPlayerSprites(this, gameState.profile.characterId);
    preloadNpcs(this, [this.layout.npc]);
    preloadVillageShop(this);
  }

  create(): void {
    const { cols, rows, doorCol, keeper } = this.layout;
    const tilePx = TILE_SIZE * DISPLAY_SCALE;
    const def = NPCS[this.layout.npc];

    Player.createAnimations(this, gameState.profile.characterId);
    this.buildRoom(tilePx);

    // Colisão: parede do fundo, laterais, frente e as peças; a porta fura a parede da frente.
    const blocked = this.blockedCells();
    const grid = buildExternalGrid(cols, rows, blocked);
    for (let row = 0; row < BACK_WALL_ROWS; row++) for (let col = 0; col < cols; col++) grid.block(col, row);
    grid.unblock(doorCol, rows - 1);

    for (const prop of this.layout.props) this.buildProp(prop, tilePx);
    this.buildKeeper(tilePx);

    this.player = new Player(this, doorCol, rows - 2, tilePx);
    this.player.sprite.setScale(DISPLAY_SCALE);
    this.player.faceDirection(0, -1);

    // O balcão e o dono: clicar em qualquer um abre a conversa.
    const interactions = new InteractionRegistry();
    const approach = { col: this.layout.counter.reduce((sum, [c]) => sum + c, 0) / this.layout.counter.length, row: Math.max(...this.layout.counter.map(([, r]) => r)) + 1 };
    const approachCell = { col: Math.round(approach.col), row: approach.row };
    const talk = new KeeperInteractable(this.player, approachCell, () => this.talkToKeeper());
    for (const [col, row] of this.layout.counter) interactions.set(col, row, talk);
    interactions.set(keeper.col, keeper.row, talk);

    this.controller = new PlayerController(this, this.player, grid, tilePx, interactions);
    this.controller.addInputInterceptor({
      isActive: () => this.isLeaving || isInventoryOpen() || isFurnaceMenuOpen() || isDialogueOpen() || !!this.shop?.isOpen(),
      handleClick: () => {},
    });

    const vendor = VENDORS[def.id];
    if (def.sells && vendor) this.shop = createVendorShop(this, vendor, gameState.inventory, this.player, { startBuild: (request) => this.startBuild(request) });

    attachFootstepSounds(this, () => 'bridge');
    // Pisar na porta = sair; andar fecha a loja.
    onPlayerStepped(this, (col, row) => {
      if (this.shop?.isOpen()) this.shop.close();
      if (col === doorCol && row === rows - 1) this.leave();
    });

    this.frameCamera(tilePx);
    // O painel da loja e os avisos são de TELA (scrollFactor 0): sem a câmera de interface o zoom do cômodo os ampliaria junto (ver `systems/uiCamera.ts`).
    installUiCamera(this);
    this.lockedMessage = new LockedMessage(this);
    ensureUIScene(this);
    this.input.keyboard!.on('keydown-E', () => {
      if (isDialogueOpen()) return;
      if (this.shop?.isOpen()) this.shop.close();
      if (isFurnaceMenuOpen()) closeFurnaceMenu();
      toggleInventoryScreen();
    });
    this.input.keyboard!.on('keydown-ESC', () => {
      if (this.shop?.isOpen()) this.shop.close();
      else if (isInventoryOpen()) closeInventoryScreen();
    });

    this.dayNightOverlay = new DayNightOverlay(this, INDOOR_NIGHT_INTENSITY);
    this.worldBlur = new WorldBlur(this.cameras.main);
    this.cameras.main.fadeIn(FADE_MS, 0, 0, 0);
  }

  /** Câmera parada no centro do cômodo, com o zoom que o enquadra inteiro. */
  private frameCamera(tilePx: number): void {
    const { cols, rows } = this.layout;
    const cam = this.cameras.main;
    const zoom = Math.min(MAX_ZOOM, (this.scale.width * ROOM_FILL_FRACTION) / (cols * tilePx), (this.scale.height * ROOM_FILL_FRACTION) / (rows * tilePx));
    cam.setBackgroundColor(ROOM_BACKGROUND);
    cam.setZoom(zoom);
    cam.centerOn((cols * tilePx) / 2, (rows * tilePx) / 2);
  }

  /** Chão de todas as células, fundo de 3 fileiras (painel + faixa), laterais e a fileira da frente — tudo do `Tileset House`. */
  private buildRoom(tilePx: number): void {
    const { cols, rows, floor, wall, doorCol } = this.layout;
    const put = (col: number, row: number, tileCol: number, tileRow: number, depth: number, flipX = false): void => {
      const tile = this.add.image(col * tilePx, row * tilePx, INTERIOR_TILES.key, interiorTileFrame(tileCol, tileRow));
      tile.setOrigin(0, 0).setScale(DISPLAY_SCALE).setDepth(depth).setFlipX(flipX);
    };

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) put(col, row, floor.col, floor.row, -2);
    }

    const mid = wall + 1;
    const backTiles = [6, 7, 5]; // Painel (topo), painel (base) e a faixa ornamentada, de cima pra baixo.
    for (let col = 0; col < cols; col++) {
      backTiles.forEach((tileRow, row) => put(col, row, mid, tileRow, -1));
    }
    for (let row = BACK_WALL_ROWS; row < rows - 1; row++) {
      put(0, row, wall, 7, -1);
      put(cols - 1, row, wall, 7, -1, true);
    }
    for (let col = 0; col < cols; col++) {
      if (col === doorCol) continue; // A porta: sem parede, só o chão.
      put(col, rows - 1, mid, 11, -1);
    }
  }

  /** Células bloqueadas: a parede da frente (sem a porta), as laterais e as pegadas das peças. */
  private blockedCells(): Array<[number, number]> {
    const { cols, rows, keeper } = this.layout;
    const cells: Array<[number, number]> = [];
    for (let row = 0; row < rows; row++) {
      cells.push([0, row], [cols - 1, row]);
    }
    for (let col = 0; col < cols; col++) cells.push([col, rows - 1]);
    for (const prop of this.layout.props) {
      if (prop.decor) continue;
      const w = prop.w ?? 1;
      const h = prop.h ?? 1;
      const relative = prop.blocks ?? Array.from({ length: w }, (_, dx) => [dx, h - 1] as [number, number]);
      for (const [dx, dy] of relative) cells.push([prop.col + dx, prop.row + dy]);
    }
    cells.push([keeper.col, keeper.row]);
    return cells;
  }

  private buildProp(prop: InteriorProp, tilePx: number): void {
    const art = PROP_ART[prop.art] as PropArt;
    const w = prop.w ?? 1;
    const h = prop.h ?? 1;
    const x = (prop.col + w / 2) * tilePx;
    const bottom = (prop.row + h) * tilePx;
    const lift = prop.lift ?? 0;

    let sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
    if (art.anim) {
      const animKey = `${art.key}-loop`;
      if (!this.anims.exists(animKey)) {
        this.anims.create({ key: animKey, frames: art.anim.frames.map((frame) => ({ key: art.key, frame })), frameRate: 1000 / art.anim.frameMs, repeat: -1 });
      }
      const animated = this.add.sprite(x, bottom - lift, art.key, art.anim.frames[0]);
      animated.setOrigin(0.5, art.anim.contentBottom / 32);
      animated.play(animKey);
      sprite = animated;
    } else {
      const frameName = `${art.key}-${prop.art}`;
      registerFrame(this, art.key, { name: frameName, rect: { x: art.frame.x, y: art.frame.y, width: art.frame.w, height: art.frame.h } });
      sprite = this.add.image(x, bottom - lift, art.key, frameName);
      sprite.setOrigin(0.5, 1);
    }
    sprite.setScale(DISPLAY_SCALE);
    // Enfeites em cima de outra peça desenham logo acima dela; o resto ordena pela base.
    sprite.setDepth(prop.decor ? bottom + 0.5 : bottom);

    if (!prop.decor) {
      const shadow = createGroundShadow(this, x, bottom - 3, DISPLAY_SCALE * Math.max(0.8, w * 0.8), DISPLAY_SCALE * 0.4);
      shadow.setDepth(-0.4);
    }
  }

  /** O dono, de frente, atrás do balcão (repouso animado; profundidade abaixo do balcão, que cobre o corpo dele). */
  private buildKeeper(tilePx: number): void {
    const def = NPCS[this.layout.npc];
    const { keeper } = this.layout;
    const idleAnim = `${def.sprite.idleKey}-down`;
    if (!this.anims.exists(idleAnim)) {
      this.anims.create({ key: idleAnim, frames: this.anims.generateFrameNumbers(def.sprite.idleKey, { start: 0, end: def.sprite.idleFrames - 1 }), frameRate: 3, repeat: -1 });
    }
    const x = keeper.col * tilePx + tilePx / 2;
    const y = (keeper.row + 1) * tilePx;
    this.keeperSprite = this.add.sprite(x, y, def.sprite.idleKey, 0);
    this.keeperSprite.setOrigin(0.5, 1).setScale(DISPLAY_SCALE).setDepth(y - 0.2);
    this.keeperSprite.play(idleAnim);
    createGroundShadow(this, x, y - 3, DISPLAY_SCALE * 0.7, DISPLAY_SCALE * 0.3).setDepth(-0.4);
  }

  private talkToKeeper(): void {
    const def = NPCS[this.layout.npc];
    this.player.faceDirection(0, -1);
    talkToNpc(def.id, {
      scene: this,
      canOpenShop: () => !!this.shop && isWorkingNow(def, gameState.gameClock.getHours(), false) && !this.isKeeperAway(),
      openShop: () => this.shop?.open(),
    });
  }

  update(time: number, delta: number): void {
    const menuOpen = isInventoryOpen() || isFurnaceMenuOpen() || isDialogueOpen() || !!this.shop?.isOpen();
    if (!this.isLeaving && !menuOpen) this.controller.update(time, delta);

    // A horda chegou com o jogador aqui dentro: ele é posto pra fora (a Fazenda precisa de defesa).
    if (!this.isLeaving && (gameState.horde.active || shouldStartHorde())) {
      this.lockedMessage.show('A HORDA CHEGOU!', 'Volte para a Fazenda e defenda-a!');
      this.leave();
    }

    if (!this.isLeaving) advanceWorldTime(delta, false);

    // O expediente acabou com o jogador dentro: a loja fecha e ele é levado pra rua.
    const def = NPCS[this.layout.npc];
    if (!this.isLeaving && !isWorkingNow(def, gameState.gameClock.getHours(), false)) {
      this.lockedMessage.show('A LOJA FECHOU', workingHoursText(def));
      this.leave();
    }

    // O Tomás saiu pra construir na Fazenda (começa a obra com o jogador aqui dentro): a loja fecha.
    if (!this.isLeaving && this.isKeeperAway()) {
      this.lockedMessage.show('OCUPADO', `${def.name} saiu pra construir na Fazenda.`);
      this.leave();
    }

    if (this.shop?.isOpen()) this.shop.refresh(gameState.inventory.getCoins());
    this.dayNightOverlay.setHours(gameState.gameClock.getHours());
    this.worldBlur.setActive(menuOpen);
  }

  /** O dono está fora, ocupado numa obra (só o Marceneiro). */
  private isKeeperAway(): boolean {
    return this.layout.npc === 'carpenter' && isCarpenterBusy();
  }

  /** Comprar/mover/cancelar/destruir uma estrutura: a Fazenda abre pra o jogador escolher o local, e volta pra cá ao terminar (`systems/buildFlow.ts`). */
  private startBuild(request: Omit<BuildRequest, 'returnTo'>): void {
    if (this.isLeaving) return;
    this.isLeaving = true;
    if (this.shop?.isOpen()) this.shop.close();
    const buildRequest: BuildRequest = { ...request, returnTo: { sceneKey: SHOP_INTERIOR_SCENE_KEY, data: this.entry } };
    this.cameras.main.fadeOut(FADE_MS, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(FARM_SCENE_KEY, { spawnPoint: this.entry.village.returnSpawn, buildRequest });
    });
  }

  /** Sai pela porta: fade out e volta pra rua do Vilarejo, na célula em frente à porta da loja. */
  private leave(): void {
    if (this.isLeaving) return;
    this.isLeaving = true;
    if (this.shop?.isOpen()) this.shop.close();
    playEffect(this, DOOR_SOUND);
    this.cameras.main.fadeOut(FADE_MS, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(VILLAGE_SCENE_KEY, { ...this.entry.village, spawnPoint: this.entry.outsideCell });
    });
  }
}
