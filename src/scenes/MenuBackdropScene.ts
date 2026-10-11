import Phaser from 'phaser';
import { applySeasonalGround } from '../systems/seasonalGround';
import {
  CORN,
  FarmerStep,
  MENU_BACKDROP_COLS,
  menuBackdropCell,
  MENU_BACKDROP_ROWS,
  MENU_CHICKENS,
  MENU_CHICKEN_YARD,
  MENU_DUCK_COUNT,
  isMenuDuckWater,
  MENU_FARMER_ROUTE,
  MENU_FARMER_START,
  MENU_FIELD_COLUMNS,
  MENU_HOUSE,
  MENU_PROPS,
  MENU_TREES,
  MENU_WATERFALL,
} from '../data/menuBackdrop';
import {
  OAK_TREE_FRAME_HEIGHT,
  OAK_TREE_FRAME_WIDTH,
  OAK_TREE_KEY,
  OAK_TREE_PATH,
  PINK_OAK_MATURE_FRAME,
  GRASS_FLAT_TILE_INDEX,
  GRASS_TILESET_KEY,
  GRASS_TILESET_PATH,
  PINE_TREE_FRAME,
  PINE_TREE_FRAME_NAME,
  PINE_TREE_KEY,
  PINE_TREE_PATH,
  PLAYER_HOUSE_KEY,
  PLAYER_HOUSE_PATH,
  PROPS_TILESET_KEY,
  PROPS_TILESET_PATH,
  SOIL_TILESET_KEY,
  SOIL_TILESET_PATH,
  TILE_SIZE,
  WATER_KEY,
  WATER_PATH,
  WATER_STYLES,
} from '../data/tiles';
import { SHADOW_KEY, SHADOW_PATH, SPLASH_FRAME_SIZE, SPLASH_KEY, SPLASH_PATH } from '../data/effects';
import { FENCE_SKINS } from '../data/fenceSkins';
import { CROPS } from '../data/crops';
import { getPlayerAssets } from '../data/player';
import { DISPLAY_SCALE, buildGroundChunk } from '../systems/mapBuilder';
import { getGroundPatches } from '../systems/groundPatches';
import { pickDirtBlobTile, type DirtZone } from '../systems/dirtPaths';
import { buildExternalTree, registerFrame } from '../systems/externalMapBuilder';
import { buildMapProps, registerMapPropFrames } from '../systems/mapProps';
import { registerSway } from '../systems/foliageSway';
import { addBuildingShadows, createGroundShadow } from '../systems/shadow';
import { Farmland } from '../systems/farmland';
import { FarmlandRenderer } from '../systems/farmlandRenderer';
import type { FarmMapData } from '../data/maps/farmMap';
import { ButterflyField, preloadButterflies } from '../systems/butterflies';
import { DAY_LENGTH_MS, GameClock } from '../systems/gameClock';
import { Chicken, preloadChickens } from '../entities/Chicken';
import { Player } from '../entities/Player';
import { preloadPlayerSprites } from '../systems/playerSprites';
import { preloadDucks, spawnSwimmingDuck } from '../systems/ducks';
import { findDuckLanes } from '../systems/duckLanes';
import { buildWaterfall, preloadWaterfall } from '../systems/waterfall';

export const MENU_BACKDROP_SCENE_KEY = 'MenuBackdropScene';

/** As telas que mostram este fundo: com nenhuma delas aberta por este tempo (ms), ele se desliga sozinho (o jogo começou). */
const OWNER_SCENE_KEYS = ['MainMenuScene', 'CharacterCreationScene'];
const ORPHAN_STOP_MS = 400;
/** Água (gid do tileset de água plana) e grama no chão autorado do fundo. */
const WATER_GID = 3000;
/** O personagem pronto que faz de fazendeiro no fundo. */
const FARMER_LOOK = 'Alex' as const;
/** Velocidade (px por segundo) do fazendeiro e dos patos. */
const FARMER_SPEED = 70;
const FARMER_SHADOW_LIFT = 13;

/**
 * O FUNDO ANIMADO DO MENU INICIAL (pedido explícito): uma fazendinha viva, montada com as peças do próprio jogo, no lugar da imagem parada
 * (`UI/Menu/menu_bg.jpg`) — a mesma composição dela (`data/menuBackdrop.ts`). É uma CENA PRÓPRIA, desenhada por baixo do menu e da criação
 * de personagem (`showMenuBackdrop`): a profundidade de mundo (árvores, personagem, galinhas pela altura) não briga com a do menu, e o fundo
 * continua andando entre uma tela e outra. Se desliga sozinho quando nenhuma das duas está aberta (o jogo começou).
 *
 * O que se mexe: o rio e a cachoeira (as animações da água), o vento nas árvores, nas plantas e as folhas caindo (`systems/foliageSway.ts`,
 * sozinho), os patos nadando, as galinhas no galinheiro (`entities/Chicken.ts`), as borboletas (`systems/butterflies.ts`) e o fazendeiro, que
 * sai de casa, rega a lavoura e volta. Não lê nem escreve o save.
 */
export class MenuBackdropScene extends Phaser.Scene {
  private chickens: Chicken[] = [];
  private butterflies: ButterflyField | null = null;
  private orphanSince: number | null = null;
  /** A lavoura (a mesma da Fazenda): o fazendeiro molha a terra que rega, e ela seca quando ele volta pra casa. */
  private farmland!: Farmland;
  private farmlandRenderer!: FarmlandRenderer;

  constructor() {
    super(MENU_BACKDROP_SCENE_KEY);
  }

  preload(): void {
    // Os mesmos formatos que a Fazenda usa pra estas chaves (a textura é do jogo inteiro: o 1º formato carregado é o que fica).
    const sheet16 = { frameWidth: TILE_SIZE, frameHeight: TILE_SIZE };
    this.load.image(GRASS_TILESET_KEY, encodeURI(`/${GRASS_TILESET_PATH}`));
    this.load.image(WATER_KEY, encodeURI(`/${WATER_PATH}`));
    this.load.spritesheet(SOIL_TILESET_KEY, encodeURI(`/${SOIL_TILESET_PATH}`), sheet16);
    const water = WATER_STYLES.waterGround;
    this.load.spritesheet(water.textureKey, encodeURI(`/${water.path}`), sheet16);
    for (const crop of Object.values(CROPS)) this.load.spritesheet(crop.textureKey, encodeURI(`/${crop.texturePath}`), { ...sheet16, frameHeight: crop.frameHeight ?? sheet16.frameHeight });
    const wood = FENCE_SKINS[1];
    this.load.spritesheet(wood.textureKey, encodeURI(`/${wood.texturePath}`), sheet16);
    this.load.image(PINE_TREE_KEY, encodeURI(`/${PINE_TREE_PATH}`));
    this.load.image(PLAYER_HOUSE_KEY, encodeURI(`/${PLAYER_HOUSE_PATH}`));
    this.load.image(PROPS_TILESET_KEY, encodeURI(`/${PROPS_TILESET_PATH}`));
    this.load.image(SHADOW_KEY, encodeURI(`/${SHADOW_PATH}`));
    this.load.spritesheet(SPLASH_KEY, encodeURI(`/${SPLASH_PATH}`), { frameWidth: SPLASH_FRAME_SIZE, frameHeight: SPLASH_FRAME_SIZE });
    // Só do fundo (chaves próprias).
    this.load.spritesheet(OAK_TREE_KEY, encodeURI(`/${OAK_TREE_PATH}`), { frameWidth: OAK_TREE_FRAME_WIDTH, frameHeight: OAK_TREE_FRAME_HEIGHT });
    this.load.spritesheet(CORN.key, encodeURI(`/${CORN.path}`), { frameWidth: CORN.frameWidth, frameHeight: CORN.frameHeight });
    preloadWaterfall(this);
    preloadDucks(this);
    preloadChickens(this);
    preloadButterflies(this);
    preloadPlayerSprites(this, FARMER_LOOK);
  }

  create(): void {
    applySeasonalGround(this, 'summer'); // O fundo do menu é sempre a fazendinha de Verão (o jogo pode ter deixado o chão em outra estação).
    this.chickens = [];
    this.orphanSince = null;
    this.cameras.main.setBackgroundColor('#7ec433');
    const tile = TILE_SIZE * DISPLAY_SCALE;

    this.buildGround();
    this.buildField(tile);
    this.buildWaterfall(tile);
    this.buildDucks(tile);
    this.buildHouse(tile);
    this.buildChickenYard(tile);
    this.buildTrees(tile);
    registerMapPropFrames(this);
    buildMapProps(this, TILE_SIZE, [...MENU_PROPS]);
    this.buildFarmer(tile);

    // Borboletas sempre de dia (um relógio parado ao meio-dia, só pra elas), em qualquer grama.
    const noon = GameClock.deserialize({ day: 1, dayProgressMs: (12 / 24) * DAY_LENGTH_MS });
    this.butterflies = new ButterflyField(this, noon, tile, (col, row) => this.cellAt(col, row) === '.');
  }

  update(time: number, delta: number): void {
    for (const chicken of this.chickens) chicken.update(time, delta);
    this.butterflies?.update(delta);

    // Sem menu nem criação de personagem abertos (o jogo começou): desliga.
    const owned = OWNER_SCENE_KEYS.some((key) => this.scene.isActive(key) || this.scene.isSleeping(key));
    if (owned) this.orphanSince = null;
    else if (this.orphanSince === null) this.orphanSince = time;
    else if (time - this.orphanSince > ORPHAN_STOP_MS) this.scene.stop();
  }

  /** O caractere da célula no mapa (fora dele, o da beira — o chão continua além da tela). */
  private cellAt(col: number, row: number): string {
    return menuBackdropCell(col, row);
  }

  /**
   * O chão: grama, o rio (autotile animado com a margem de terra) e os caminhos de terra. Sem as manchas de grama escura do chão do
   * jogo: elas saem do ruído em coordenadas do mundo e, numa tela só, viravam blocos grandes de contorno em escada no meio do fundo.
   */
  private buildGround(): void {
    const dirt: DirtZone = { has: (col, row) => this.cellAt(col, row) === 'd' };
    const ground: number[][] = [];
    for (let row = 0; row < MENU_BACKDROP_ROWS; row++) {
      const line: number[] = [];
      for (let col = 0; col < MENU_BACKDROP_COLS; col++) {
        const cell = this.cellAt(col, row);
        line.push(cell === 'w' ? WATER_GID : cell === 'd' ? pickDirtBlobTile(dirt, col, row) : GRASS_FLAT_TILE_INDEX);
      }
      ground.push(line);
    }
    const layer = buildGroundChunk(this, TILE_SIZE, 0, 0, MENU_BACKDROP_COLS, MENU_BACKDROP_ROWS, undefined, undefined, ground, 'waterGround');
    getGroundPatches(layer)?.destroy();
  }

  /** A lavoura: a terra arada da própria Fazenda (`FarmlandRenderer`) com as culturas maduras, e o milho de enfeite nas últimas colunas. */
  private buildField(tile: number): void {
    const cells: Array<[number, number]> = [];
    for (let row = 0; row < MENU_BACKDROP_ROWS; row++) for (let col = 0; col < MENU_BACKDROP_COLS; col++) if (this.cellAt(col, row) === 't') cells.push([col, row]);
    const farmland = new Farmland(cells);
    for (const [col, row] of cells) {
      farmland.till(col, row);
      const crop = MENU_FIELD_COLUMNS.find((column) => column.col === col)?.crop;
      if (crop && crop !== 'corn' && farmland.plant(col, row, crop)) {
        const plot = farmland.getPlot(col, row)!;
        plot.stage = CROPS[crop].growthFrames.length - 1;
      } else if (crop === 'corn') {
        const corn = this.add.image((col + 0.5) * tile, (row + 1) * tile - 2, CORN.key, CORN.ripeFrame).setOrigin(0.5, 1).setScale(DISPLAY_SCALE);
        corn.setDepth(corn.y);
        registerSway(corn, 'crop');
      }
    }
    const map = { tileSize: TILE_SIZE, farmlandArea: cells } as unknown as FarmMapData;
    this.farmland = farmland;
    this.farmlandRenderer = new FarmlandRenderer(this, map);
    this.farmlandRenderer.renderAll(farmland);
  }

  /** O fazendeiro regou da célula (`col`, `row`) olhando pra cima: a terra da frente e as dos lados ficam molhadas, com o respingo. */
  private waterInFront(col: number, row: number): void {
    for (const dc of [-1, 0, 1]) {
      const plot = this.farmland.getPlot(col + dc, row - 1);
      if (!plot) continue;
      plot.wateredToday = true;
      if (plot.state === 'growing') this.farmland.water(plot.col, plot.row);
      this.farmlandRenderer.renderPlot(this.farmland, plot);
      this.farmlandRenderer.spawnWaterSplash(plot.col, plot.row);
    }
  }

  /** De volta em casa: a lavoura seca de novo (pra o fazendeiro ter o que regar na próxima volta). */
  private dryField(): void {
    for (const plot of this.farmland.getAllPlots()) plot.wateredToday = false;
    this.farmlandRenderer.renderAll(this.farmland);
  }

  /** A cachoeira no alto do rio (`systems/waterfall.ts`, a mesma do lago da Floresta). */
  private buildWaterfall(tile: number): void {
    buildWaterfall(this, tile, MENU_WATERFALL.col, MENU_WATERFALL.row);
  }

  /** Patos nadando no rio: vão e voltam na sua raia (`systems/ducks.ts`, o mesmo do lago da Floresta), sem passar pela cachoeira. */
  private buildDucks(tile: number): void {
    findDuckLanes(isMenuDuckWater, MENU_BACKDROP_COLS, MENU_BACKDROP_ROWS, MENU_DUCK_COUNT).forEach((lane, index) => spawnSwimmingDuck(this, tile, lane, index));
  }

  /** A casa (com as sombras na base, como na Fazenda). */
  private buildHouse(tile: number): void {
    const house = this.add.image(MENU_HOUSE.col * tile + MENU_HOUSE.offsetX, MENU_HOUSE.row * tile, PLAYER_HOUSE_KEY, '__BASE').setOrigin(0, 0).setScale(DISPLAY_SCALE);
    house.setDepth(house.y + house.displayHeight - tile);
    addBuildingShadows(this, house);
  }

  /** O galinheiro: cerca de madeira em volta e as galinhas soltas dentro. */
  private buildChickenYard(tile: number): void {
    const { col0, row0, col1, row1 } = MENU_CHICKEN_YARD;
    const skin = FENCE_SKINS[1];
    const piece = (col: number, row: number, frame: number): void => {
      const image = this.add.image(col * tile, row * tile, skin.textureKey, frame).setOrigin(0, 0).setScale(DISPLAY_SCALE);
      image.setDepth((row + 1) * tile);
    };
    for (let col = col0; col <= col1; col++) {
      piece(col, row0, col === col0 ? skin.topLeft : col === col1 ? skin.topRight : skin.edgeTop);
      piece(col, row1, col === col0 ? skin.bottomLeft : col === col1 ? skin.bottomRight : skin.edgeBottom);
    }
    for (let row = row0 + 1; row < row1; row++) {
      piece(col0, row, skin.edgeLeft);
      piece(col1, row, skin.edgeRight);
    }

    const world = {
      tilePx: tile,
      canStand: (col: number, row: number): boolean => col > col0 && col < col1 && row > row0 && row < row1,
    };
    for (let index = 0; index < MENU_CHICKENS; index++) {
      const homeCol = col0 + 2 + index * 2;
      const homeRow = row0 + 1 + (index % 2) * 2;
      this.chickens.push(new Chicken(this, world, 'menu', index, index, homeCol, homeRow, false));
    }
  }

  /** Pinheiros (a mesma árvore da Fazenda) e Carvalhos Rosa floridos, todos no vento. */
  private buildTrees(tile: number): void {
    registerFrame(this, PINE_TREE_KEY, { name: PINE_TREE_FRAME_NAME, rect: PINE_TREE_FRAME });
    for (const tree of MENU_TREES) {
      if (tree.kind === 'pine') {
        buildExternalTree(this, TILE_SIZE, tree.col, tree.row, 'pine');
        continue;
      }
      const x = (tree.col + 0.5) * tile;
      const y = (tree.row + 1) * tile;
      createGroundShadow(this, x, y - 6, DISPLAY_SCALE * 1.5, DISPLAY_SCALE * 0.6).setDepth(-0.4);
      const pinkOak = this.add.image(x, y, OAK_TREE_KEY, PINK_OAK_MATURE_FRAME).setOrigin(0.5, 1).setScale(DISPLAY_SCALE);
      pinkOak.setDepth(pinkOak.y);
      registerSway(pinkOak, 'tree');
    }
  }

  /** O fazendeiro: sai de casa, rega a lavoura e volta — a rota de `MENU_FARMER_ROUTE`, em loop. */
  private buildFarmer(tile: number): void {
    Player.createAnimations(this, FARMER_LOOK);
    const assets = getPlayerAssets(FARMER_LOOK);
    const anchor = (col: number, row: number): { x: number; y: number } => ({ x: (col + 0.5) * tile, y: (row + 1) * tile });
    const start = anchor(MENU_FARMER_START.col, MENU_FARMER_START.row);
    const farmer = this.add.sprite(start.x, start.y, assets.idleKey, 0).setOrigin(0.5, 1).setScale(DISPLAY_SCALE);
    // A sombra do jogador de verdade (`entities/Player.ts`): 13 px acima da base do quadro — o pé fica no alto do quadro, não na beira.
    const shadow = createGroundShadow(this, start.x, start.y - FARMER_SHADOW_LIFT, DISPLAY_SCALE * 1.1, DISPLAY_SCALE * 0.5);
    const follow = (): void => {
      farmer.setDepth(farmer.y);
      shadow.setPosition(farmer.x, farmer.y - FARMER_SHADOW_LIFT).setDepth(farmer.y - 0.1);
    };
    follow();

    let index = 0;
    const next = (): void => {
      if (!farmer.active) return;
      const step: FarmerStep = MENU_FARMER_ROUTE[index];
      index = (index + 1) % MENU_FARMER_ROUTE.length;
      if ('wait' in step) {
        farmer.play(`${assets.animPrefix}-idle-down`, true);
        if (index === 0) this.dryField(); // A última parada (em casa): a lavoura seca enquanto ele descansa.
        this.time.delayedCall(step.wait, next);
        return;
      }
      if ('water' in step) {
        farmer.setFlipX(false).play(`${assets.actions.water.key}-up`);
        const cell = { col: Math.floor(farmer.x / tile), row: Math.floor((farmer.y - 1) / tile) };
        this.time.delayedCall(400, () => this.waterInFront(cell.col, cell.row)); // A água cai no meio do movimento do regador.
        farmer.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.time.delayedCall(250, next));
        return;
      }
      const target = anchor(step.col, step.row);
      const dx = target.x - farmer.x;
      const dy = target.y - farmer.y;
      const distance = Math.hypot(dx, dy);
      if (distance === 0) {
        next();
        return;
      }
      const direction = Math.abs(dx) > Math.abs(dy) ? 'side' : dy < 0 ? 'up' : 'down';
      farmer.setFlipX(direction === 'side' && dx < 0).play(`${assets.animPrefix}-walk-${direction}`, true);
      this.tweens.add({ targets: farmer, x: target.x, y: target.y, duration: (distance / FARMER_SPEED) * 1000, onUpdate: follow, onComplete: next });
    };
    this.time.delayedCall(1200, next);
  }
}

/** Liga o fundo animado por baixo de `scene` (o menu ou a criação de personagem): abre se não estiver aberto e manda pro fundo da pilha. */
export function showMenuBackdrop(scene: Phaser.Scene): void {
  const manager = scene.scene;
  if (!manager.isActive(MENU_BACKDROP_SCENE_KEY)) manager.launch(MENU_BACKDROP_SCENE_KEY);
  manager.sendToBack(MENU_BACKDROP_SCENE_KEY);
}
