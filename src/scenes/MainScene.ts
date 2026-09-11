import Phaser from 'phaser';
import { farmMap } from '../data/maps/farmMap';
import {
  GRASS_TILESET_KEY,
  GRASS_TILESET_PATH,
  FENCE_TILESET_KEY,
  FENCE_TILESET_PATH,
  TILE_SIZE,
  PINE_TREE_KEY,
  PINE_TREE_PATH,
  PINE_TREE_FRAME_NAME,
  PINE_TREE_FRAME,
  SOIL_TILESET_KEY,
  SOIL_TILESET_PATH,
} from '../data/tiles';
import {
  PLAYER_IDLE_KEY,
  PLAYER_IDLE_PATH,
  PLAYER_WALK_KEY,
  PLAYER_WALK_PATH,
  PLAYER_FRAME_SIZE,
  PLAYER_START,
  PLAYER_ACTIONS,
} from '../data/player';
import { CROPS } from '../data/crops';
import { INVENTORY_UI_KEY, INVENTORY_UI_PATH } from '../data/ui';
import { buildFarmGround, buildFarmFence, buildFarmDecorations, DISPLAY_SCALE } from '../systems/mapBuilder';
import { buildWalkableGrid } from '../systems/grid';
import { updateTreeOverlap } from '../systems/treeOverlap';
import { Player } from '../entities/Player';
import { PlayerController } from '../systems/playerController';
import { Farmland } from '../systems/farmland';
import { FarmlandRenderer } from '../systems/farmlandRenderer';
import { Inventory } from '../systems/inventory';
import { InteractionRegistry } from '../systems/interaction';
import { registerFarmlandInteractables } from '../systems/farmlandInteraction';
import { SeedBar } from '../ui/seedBar';

/**
 * Cena principal: monta a propriedade da fazenda (Fase 2), o personagem
 * jogável com movimentação/clique/pathfinding (Fase 3) e a agricultura —
 * terrenos cultiváveis, arar, plantar, crescimento, regar e colher (Fase 4).
 */
/** Avanço de relógio (ms) aplicado pela tecla de debug T — só para acelerar testes de crescimento/morte por sede, não é mecânica de jogo. */
const DEBUG_TIME_SKIP_MS = 5000;

export class MainScene extends Phaser.Scene {
  private player!: Player;
  private controller!: PlayerController;
  private trees!: Phaser.GameObjects.Image[];
  private farmland!: Farmland;
  private farmlandRenderer!: FarmlandRenderer;
  private inventory!: Inventory;
  private seedBar!: SeedBar;

  constructor() {
    super('MainScene');
  }

  preload(): void {
    this.load.image(GRASS_TILESET_KEY, encodeURI(`/${GRASS_TILESET_PATH}`));
    this.load.spritesheet(FENCE_TILESET_KEY, encodeURI(`/${FENCE_TILESET_PATH}`), {
      frameWidth: TILE_SIZE,
      frameHeight: TILE_SIZE,
    });
    this.load.image(PINE_TREE_KEY, encodeURI(`/${PINE_TREE_PATH}`));
    this.load.spritesheet(SOIL_TILESET_KEY, encodeURI(`/${SOIL_TILESET_PATH}`), {
      frameWidth: TILE_SIZE,
      frameHeight: TILE_SIZE,
    });

    this.load.spritesheet(PLAYER_IDLE_KEY, encodeURI(`/${PLAYER_IDLE_PATH}`), {
      frameWidth: PLAYER_FRAME_SIZE,
      frameHeight: PLAYER_FRAME_SIZE,
    });
    this.load.spritesheet(PLAYER_WALK_KEY, encodeURI(`/${PLAYER_WALK_PATH}`), {
      frameWidth: PLAYER_FRAME_SIZE,
      frameHeight: PLAYER_FRAME_SIZE,
    });
    for (const spec of Object.values(PLAYER_ACTIONS)) {
      this.load.spritesheet(spec.key, encodeURI(`/${spec.path}`), {
        frameWidth: PLAYER_FRAME_SIZE,
        frameHeight: PLAYER_FRAME_SIZE,
      });
    }

    for (const crop of Object.values(CROPS)) {
      this.load.spritesheet(crop.textureKey, encodeURI(`/${crop.texturePath}`), {
        frameWidth: TILE_SIZE,
        frameHeight: TILE_SIZE,
      });
    }

    this.load.image(INVENTORY_UI_KEY, encodeURI(`/${INVENTORY_UI_PATH}`));
  }

  create(): void {
    this.textures
      .get(PINE_TREE_KEY)
      .add(
        PINE_TREE_FRAME_NAME,
        0,
        PINE_TREE_FRAME.x,
        PINE_TREE_FRAME.y,
        PINE_TREE_FRAME.width,
        PINE_TREE_FRAME.height,
      );

    buildFarmGround(this, farmMap);
    buildFarmFence(this, farmMap);
    this.trees = buildFarmDecorations(this, farmMap);

    const grid = buildWalkableGrid(farmMap);
    const tilePx = farmMap.tileSize * DISPLAY_SCALE;

    Player.createAnimations(this);
    this.player = new Player(this, PLAYER_START.col, PLAYER_START.row, tilePx);
    this.player.sprite.setScale(DISPLAY_SCALE);

    this.farmland = new Farmland(farmMap.farmlandArea);
    this.farmlandRenderer = new FarmlandRenderer(this, farmMap);
    this.inventory = new Inventory();
    const interactions = new InteractionRegistry();
    registerFarmlandInteractables(farmMap, this.farmland, this.farmlandRenderer, this.inventory, this.player, interactions);

    this.controller = new PlayerController(this, this.player, grid, tilePx, interactions);

    this.events.on('player-stepped', (col: number, row: number) => {
      // Sempre que o player pisar em uma nova célula, tenta animar a plantinha
      this.farmlandRenderer.rustleCrop(col, row);
    });

    this.seedBar = new SeedBar(this, Object.values(CROPS));
    this.seedBar.refresh(this.inventory.getSelectedSeedId());

    this.setupSeedSelection();
    this.setupDebugTimeSkip();
  }

  /** Teclas 1/2/3 trocam a semente ativa no inventário, na ordem em que aparecem em `CROPS`. */
  private setupSeedSelection(): void {
    const seedIds = Object.keys(CROPS);
    const keys: Array<[string, number]> = [
      ['keydown-ONE', 0],
      ['keydown-TWO', 1],
      ['keydown-THREE', 2],
    ];
    for (const [event, index] of keys) {
      this.input.keyboard!.on(event, () => {
        const cropId = seedIds[index];
        if (cropId && this.inventory.selectSeed(cropId)) {
          console.log(`Semente selecionada: ${CROPS[cropId].name}`);
          this.seedBar.refresh(cropId);
        }
      });
    }
  }

  /** Tecla T (debug): adianta o relógio da agricultura para acelerar testes — não é mecânica de jogo. */
  private setupDebugTimeSkip(): void {
    this.input.keyboard!.on('keydown-T', () => {
      this.farmland.update(DEBUG_TIME_SKIP_MS);
      this.farmlandRenderer.renderAll(this.farmland);
    });
  }

  update(time: number, delta: number): void {
    this.controller.update(time, delta);
    updateTreeOverlap(this.player, this.trees);

    this.farmland.update(delta);
    this.farmlandRenderer.renderAll(this.farmland);
  }
  
}
