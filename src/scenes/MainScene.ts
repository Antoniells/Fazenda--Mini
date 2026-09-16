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
  PINE_SPROUT_FRAME_NAME,
  PINE_SPROUT_FRAME,
  PINE_YOUNG_FRAME_NAME,
  PINE_YOUNG_FRAME,
  ROCK_KEY,
  ROCK_PATH,
  ROCK_FRAME_1,
  WOOD_KEY,
  WOOD_PATH,
  WOOD_FRAME,
  SOIL_TILESET_KEY,
  SOIL_TILESET_PATH,
  SHIPPING_BIN_KEY,
  SHIPPING_BIN_PATH,
  SHOP_STAND_KEY,
  SHOP_STAND_PATH,
  CONSTRUCTION_SIGN_KEY,
  CONSTRUCTION_SIGN_PATH,
  PLAYER_HOUSE_KEY,
  PLAYER_HOUSE_PATH,
  BRIDGE_KEY,
  BRIDGE_PATH,
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
import { CROPS, CARROT, ALL_CROPS_ICONS_KEY, ALL_CROPS_ICONS_PATH } from '../data/crops';
import { DECORATIONS, WELL, DecorationDefinition } from '../data/decorations';
import { HOE, SICKLE, AXE, PICKAXE, IRON_AXE, GOLD_AXE, IRON_PICKAXE, GOLD_PICKAXE } from '../data/tools';
import {
  INVENTORY_UI_KEY,
  INVENTORY_UI_PATH,
  WATERING_CAN_ICON_KEY,
  WATERING_CAN_ICON_PATH,
  WATERING_CAN_ICON_FRAME_SIZE,
  SHOP_BOOK_KEY,
  SHOP_BOOK_PATH,
  SHOP_BOOK_FRAME_NAME,
  SHOP_BOOK_CONTENT_RECT,
  INVENTORY_PANEL_KEY,
  INVENTORY_PANEL_PATH,
  INVENTORY_LARGE_PANEL_KEY,
  INVENTORY_LARGE_PANEL_PATH,
  EXTRAS_UI_KEY,
  EXTRAS_UI_PATH,
  CLOCK_MONEY_HUD_KEY,
  CLOCK_MONEY_HUD_PATH,
  SHOP_TAB_RIBBONS_KEY,
  SHOP_TAB_RIBBONS_PATH,
  TAB_FRAME_AGRICULTURE,
  TAB_FRAME_TOOLS,
  TAB_FRAME_CONSTRUCTION,
  TAB_FRAME_AGRICULTURE_LIGHT,
  TAB_FRAME_TOOLS_LIGHT,
  TAB_FRAME_CONSTRUCTION_LIGHT,
  CLOSE_TAB_BG_FRAME,
  CLOSE_BUTTON_SHEET_KEY,
  CLOSE_BUTTON_SHEET_PATH,
  CLOSE_X_ICON_FRAME,
  CLOSE_X_ICON_PRESSED_FRAME,
  BACKPACK_ICON_KEY,
  BACKPACK_ICON_PATH,
  FISHING_ROD_ICON_KEY,
  FISHING_ROD_ICON_PATH,
} from '../data/ui';
import { SHADOW_KEY, SHADOW_PATH, SPLASH_KEY, SPLASH_PATH, SPLASH_FRAME_SIZE, LEAF_FALL_KEY, LEAF_FALL_PATH, LEAF_FALL_FRAME_SIZE } from '../data/effects';
import { GRASS_DETAILS_KEY, GRASS_DETAILS_PATH } from '../data/grassDetails';
import { buildFarmGround, buildFenceCorners, buildFarmDecorations, buildShippingBin, buildShopStand, buildPlayerHouse, buildFarmlandFence, DISPLAY_SCALE } from '../systems/mapBuilder';
import { buildDirtZone } from '../systems/dirtPaths';
import { buildGrassDetails, rustleGrassTuft, GrassTuftMap } from '../systems/grassDetails';
import { buildWalkableGrid } from '../systems/grid';
import { PropertyExpansionSystem } from '../systems/propertyExpansion';
import { BridgeSystem } from '../systems/bridgeSystem';
import { TreePlantingSystem, advanceFarmTreesDay } from '../systems/treePlanting';
import { advanceForestDay } from './ForestScene';
import { advanceQuarryDay } from './QuarryScene';
import { ACORN } from '../data/resources';
import { WEAPONS } from '../data/weapons';
import { ARMORS } from '../data/armors';
import { RECIPES } from '../data/recipes';
import { SlotRef, resolveSlotVisual } from '../data/items';
import { updateTreeOverlap } from '../systems/treeOverlap';
import { GameClock, DAY_LENGTH_MS } from '../systems/gameClock';
import { DayNightOverlay } from '../systems/dayNightOverlay';
import { Player } from '../entities/Player';
import { PlayerController } from '../systems/playerController';
import { Farmland } from '../systems/farmland';
import { FarmlandRenderer } from '../systems/farmlandRenderer';
import { Inventory } from '../systems/inventory';
import { InteractionRegistry } from '../systems/interaction';
import { registerFarmlandInteractables } from '../systems/farmlandInteraction';
import { registerShippingBinInteractable } from '../systems/shippingBinInteraction';
import { registerShopInteractable } from '../systems/shopInteraction';
import { registerSleepInteractable } from '../systems/sleepInteraction';
import { TileCursor } from '../systems/tileCursor';
import { DecorationPlacementSystem } from '../systems/decorationPlacement';
import { DebugGridOverlay } from '../systems/debugGridOverlay';
import { PauseMenu } from '../ui/pauseMenu';
import { LockedMessage } from '../ui/lockedMessage';
import { gameState } from '../systems/gameState';
import {
  ensureUIScene,
  HOTBAR_CHANGED_EVENT,
  isInventoryOpen,
  toggleInventoryScreen,
  closeInventoryScreen,
  isCraftingMenuOpen,
  closeCraftingMenu,
} from './UIScene';
import { setupWorldCamera } from '../systems/cameraSetup';
import { ShopMenu, ShopItem, ShopTabDefinition } from '../ui/shopMenu';

/**
 * Cena principal: monta a propriedade da fazenda (Fase 2), o personagem
 * jogável com movimentação/clique/pathfinding (Fase 3), a agricultura —
 * terrenos cultiváveis, arar, plantar, crescimento, regar e colher (Fase 4)
 * — a economia: moedas, venda na Caixa de Remessas e compra na Loja (Fase
 * 5) — construções/decoração posicionáveis livremente e expansão de
 * propriedade (Fase 6) — e o relógio interno com ciclo dia/noite (Fase 7,
 * primeiro item — "Sistema de Tempo").
 */
const DEBUG_TIME_SKIP_MS = DAY_LENGTH_MS;
const DEBUG_ADD_COINS_AMOUNT = 1000;
const SLEEP_FADE_MS = 600;

export class MainScene extends Phaser.Scene {
  private player!: Player;
  private controller!: PlayerController;
  /** DEBUG TEMPORÁRIO — ver `systems/debugGridOverlay.ts`. */
  private debugGridOverlay!: DebugGridOverlay;
  private trees!: Phaser.GameObjects.Image[];
  private grassTufts!: GrassTuftMap;
  private farmland!: Farmland;
  private farmlandRenderer!: FarmlandRenderer;
  private inventory!: Inventory;
  private shopMenu!: ShopMenu;
  private decorationPlacement!: DecorationPlacementSystem;
  private treePlanting!: TreePlantingSystem;
  private gameClock!: GameClock;
  private dayNightOverlay!: DayNightOverlay;
  private pauseMenu!: PauseMenu;
  private isSleeping = false;
  private spawnOverride: { col: number; row: number } | null = null;

  constructor() {
    super('MainScene');
  }

  init(data?: { spawnPoint?: { col: number; row: number } }): void {
    this.spawnOverride = data?.spawnPoint ?? null;
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
        frameWidth: spec.frameSize,
        frameHeight: spec.frameSize,
      });
    }

    for (const crop of Object.values(CROPS)) {
      this.load.spritesheet(crop.textureKey, encodeURI(`/${crop.texturePath}`), {
        frameWidth: TILE_SIZE,
        frameHeight: TILE_SIZE,
      });
    }

    this.load.image(ALL_CROPS_ICONS_KEY, encodeURI(`/${ALL_CROPS_ICONS_PATH}`));
    this.load.image(INVENTORY_UI_KEY, encodeURI(`/${INVENTORY_UI_PATH}`));
    this.load.image(CLOCK_MONEY_HUD_KEY, encodeURI(`/${CLOCK_MONEY_HUD_PATH}`));
    this.load.spritesheet(WATERING_CAN_ICON_KEY, encodeURI(`/${WATERING_CAN_ICON_PATH}`), {
      frameWidth: WATERING_CAN_ICON_FRAME_SIZE,
      frameHeight: WATERING_CAN_ICON_FRAME_SIZE,
    });
    this.load.spritesheet(HOE.textureKey, encodeURI(`/${HOE.texturePath}`), {
      frameWidth: WATERING_CAN_ICON_FRAME_SIZE,
      frameHeight: WATERING_CAN_ICON_FRAME_SIZE,
    });
    this.load.spritesheet(SICKLE.textureKey, encodeURI(`/${SICKLE.texturePath}`), {
      frameWidth: WATERING_CAN_ICON_FRAME_SIZE,
      frameHeight: WATERING_CAN_ICON_FRAME_SIZE,
    });
    this.load.spritesheet(AXE.textureKey, encodeURI(`/${AXE.texturePath}`), {
      frameWidth: WATERING_CAN_ICON_FRAME_SIZE,
      frameHeight: WATERING_CAN_ICON_FRAME_SIZE,
    });
    this.load.spritesheet(PICKAXE.textureKey, encodeURI(`/${PICKAXE.texturePath}`), {
      frameWidth: WATERING_CAN_ICON_FRAME_SIZE,
      frameHeight: WATERING_CAN_ICON_FRAME_SIZE,
    });

    for (const weapon of Object.values(WEAPONS)) {
      this.load.spritesheet(weapon.textureKey, encodeURI(`/${weapon.texturePath}`), {
        frameWidth: WATERING_CAN_ICON_FRAME_SIZE,
        frameHeight: WATERING_CAN_ICON_FRAME_SIZE,
      });
    }

    // Ferramentas de progressão e armaduras (Fase 8 — Crafting): só se obtêm
    // fabricando na Bancada depois de comprar a Receita na Loja, mas o
    // ícone precisa estar carregado desde já pra aparecer na aba de
    // Receitas (ver `shopItems` abaixo).
    for (const tool of [IRON_AXE, GOLD_AXE, IRON_PICKAXE, GOLD_PICKAXE]) {
      this.load.spritesheet(tool.textureKey, encodeURI(`/${tool.texturePath}`), {
        frameWidth: WATERING_CAN_ICON_FRAME_SIZE,
        frameHeight: WATERING_CAN_ICON_FRAME_SIZE,
      });
    }
    for (const armor of Object.values(ARMORS)) {
      this.load.spritesheet(armor.textureKey, encodeURI(`/${armor.texturePath}`), {
        frameWidth: WATERING_CAN_ICON_FRAME_SIZE,
        frameHeight: WATERING_CAN_ICON_FRAME_SIZE,
      });
    }

    this.load.image(WOOD_KEY, encodeURI(`/${WOOD_PATH}`));
    this.load.image(ROCK_KEY, encodeURI(`/${ROCK_PATH}`));
    this.load.image(SHOP_BOOK_KEY, encodeURI(`/${SHOP_BOOK_PATH}`));
    this.load.image(INVENTORY_PANEL_KEY, encodeURI(`/${INVENTORY_PANEL_PATH}`));
    this.load.image(INVENTORY_LARGE_PANEL_KEY, encodeURI(`/${INVENTORY_LARGE_PANEL_PATH}`));
    this.load.image(EXTRAS_UI_KEY, encodeURI(`/${EXTRAS_UI_PATH}`));
    this.load.image(SHOP_TAB_RIBBONS_KEY, encodeURI(`/${SHOP_TAB_RIBBONS_PATH}`));
    this.load.image(CLOSE_BUTTON_SHEET_KEY, encodeURI(`/${CLOSE_BUTTON_SHEET_PATH}`));
    this.load.image(BACKPACK_ICON_KEY, encodeURI(`/${BACKPACK_ICON_PATH}`));
    this.load.image(FISHING_ROD_ICON_KEY, encodeURI(`/${FISHING_ROD_ICON_PATH}`));
    this.load.image(SHIPPING_BIN_KEY, encodeURI(`/${SHIPPING_BIN_PATH}`));
    this.load.image(SHOP_STAND_KEY, encodeURI(`/${SHOP_STAND_PATH}`));
    this.load.image(GRASS_DETAILS_KEY, encodeURI(`/${GRASS_DETAILS_PATH}`));
    this.load.image(CONSTRUCTION_SIGN_KEY, encodeURI(`/${CONSTRUCTION_SIGN_PATH}`));
    this.load.image(PLAYER_HOUSE_KEY, encodeURI(`/${PLAYER_HOUSE_PATH}`));
    this.load.image(BRIDGE_KEY, encodeURI(`/${BRIDGE_PATH}`));
    this.load.image(SHADOW_KEY, encodeURI(`/${SHADOW_PATH}`));

    this.load.spritesheet(SPLASH_KEY, encodeURI(`/${SPLASH_PATH}`), {
      frameWidth: SPLASH_FRAME_SIZE,
      frameHeight: SPLASH_FRAME_SIZE,
    });
    this.load.spritesheet(LEAF_FALL_KEY, encodeURI(`/${LEAF_FALL_PATH}`), {
      frameWidth: LEAF_FALL_FRAME_SIZE,
      frameHeight: LEAF_FALL_FRAME_SIZE,
    });

    for (const decoration of Object.values(DECORATIONS)) {
      this.load.image(decoration.textureKey, encodeURI(`/${decoration.texturePath}`));
    }
  }

  create(): void {
    const pineTexture = this.textures.get(PINE_TREE_KEY);
    pineTexture.add(PINE_TREE_FRAME_NAME, 0, PINE_TREE_FRAME.x, PINE_TREE_FRAME.y, PINE_TREE_FRAME.width, PINE_TREE_FRAME.height);
    
    if (!pineTexture.has(PINE_SPROUT_FRAME_NAME)) {
      pineTexture.add(PINE_SPROUT_FRAME_NAME, 0, PINE_SPROUT_FRAME.x, PINE_SPROUT_FRAME.y, PINE_SPROUT_FRAME.width, PINE_SPROUT_FRAME.height);
    }
    if (!pineTexture.has(PINE_YOUNG_FRAME_NAME)) {
      pineTexture.add(PINE_YOUNG_FRAME_NAME, 0, PINE_YOUNG_FRAME.x, PINE_YOUNG_FRAME.y, PINE_YOUNG_FRAME.width, PINE_YOUNG_FRAME.height);
    }

    const rockTexture = this.textures.get(ROCK_KEY);
    if (!rockTexture.has(ROCK_FRAME_1.name)) {
      rockTexture.add(ROCK_FRAME_1.name, 0, ROCK_FRAME_1.rect.x, ROCK_FRAME_1.rect.y, ROCK_FRAME_1.rect.width, ROCK_FRAME_1.rect.height);
    }

    const woodTexture = this.textures.get(WOOD_KEY);
    if (!woodTexture.has(WOOD_FRAME.name)) {
      woodTexture.add(WOOD_FRAME.name, 0, WOOD_FRAME.rect.x, WOOD_FRAME.rect.y, WOOD_FRAME.rect.width, WOOD_FRAME.rect.height);
    }

    for (const decoration of Object.values(DECORATIONS)) {
      const texture = this.textures.get(decoration.textureKey);
      if (!texture.has(decoration.frameName)) {
        texture.add(
          decoration.frameName,
          0,
          decoration.frameRect.x,
          decoration.frameRect.y,
          decoration.frameRect.width,
          decoration.frameRect.height,
        );
      }
    }

    const tabRibbonsTexture = this.textures.get(SHOP_TAB_RIBBONS_KEY);
    for (const ribbon of [
      TAB_FRAME_AGRICULTURE,
      TAB_FRAME_TOOLS,
      TAB_FRAME_CONSTRUCTION,
      TAB_FRAME_AGRICULTURE_LIGHT,
      TAB_FRAME_TOOLS_LIGHT,
      TAB_FRAME_CONSTRUCTION_LIGHT,
    ]) {
      if (!tabRibbonsTexture.has(ribbon.name)) {
        tabRibbonsTexture.add(ribbon.name, 0, ribbon.rect.x, ribbon.rect.y, ribbon.rect.width, ribbon.rect.height);
      }
    }

    const closeButtonSheetTexture = this.textures.get(CLOSE_BUTTON_SHEET_KEY);
    if (!closeButtonSheetTexture.has(CLOSE_X_ICON_FRAME.name)) {
      closeButtonSheetTexture.add(
        CLOSE_X_ICON_FRAME.name,
        0,
        CLOSE_X_ICON_FRAME.rect.x,
        CLOSE_X_ICON_FRAME.rect.y,
        CLOSE_X_ICON_FRAME.rect.width,
        CLOSE_X_ICON_FRAME.rect.height,
        
      );
      
    }
    if (!closeButtonSheetTexture.has(CLOSE_X_ICON_PRESSED_FRAME.name)) {
      closeButtonSheetTexture.add(
        CLOSE_X_ICON_PRESSED_FRAME.name,
        0,
        CLOSE_X_ICON_PRESSED_FRAME.rect.x,
        CLOSE_X_ICON_PRESSED_FRAME.rect.y,
        CLOSE_X_ICON_PRESSED_FRAME.rect.width,
        CLOSE_X_ICON_PRESSED_FRAME.rect.height,
      );
    }

    

    const cropIconsTexture = this.textures.get(ALL_CROPS_ICONS_KEY);
    for (const crop of Object.values(CROPS)) {
      if (!cropIconsTexture.has(crop.iconFrameName)) {
        cropIconsTexture.add(
          crop.iconFrameName,
          0,
          crop.iconFrameRect.x,
          crop.iconFrameRect.y,
          crop.iconFrameRect.width,
          crop.iconFrameRect.height,
        );
      }
    }

    const bookTexture = this.textures.get(SHOP_BOOK_KEY);
    if (!bookTexture.has(SHOP_BOOK_FRAME_NAME)) {
      bookTexture.add(
        SHOP_BOOK_FRAME_NAME,
        0,
        SHOP_BOOK_CONTENT_RECT.x,
        SHOP_BOOK_CONTENT_RECT.y,
        SHOP_BOOK_CONTENT_RECT.width,
        SHOP_BOOK_CONTENT_RECT.height,
      );
    }
    if (!bookTexture.has(CLOSE_TAB_BG_FRAME.name)) {
      bookTexture.add(
        CLOSE_TAB_BG_FRAME.name,
        0,
        CLOSE_TAB_BG_FRAME.rect.x,
        CLOSE_TAB_BG_FRAME.rect.y,
        CLOSE_TAB_BG_FRAME.rect.width,
        CLOSE_TAB_BG_FRAME.rect.height,
      );
    }

    buildFarmGround(this, farmMap);
    buildFenceCorners(this, farmMap);

    this.grassTufts = buildGrassDetails(this, farmMap, buildDirtZone(farmMap));
    this.trees = buildFarmDecorations(this, farmMap);

    const shippingBin = buildShippingBin(this, farmMap);
    buildShopStand(this, farmMap);
    buildPlayerHouse(this, farmMap);
    buildFarmlandFence(this, farmMap);

    const grid = buildWalkableGrid(farmMap);
    const tilePx = farmMap.tileSize * DISPLAY_SCALE;

    Player.createAnimations(this);

    const spawn = this.spawnOverride ?? PLAYER_START;
    this.player = new Player(this, spawn.col, spawn.row, tilePx);
    this.player.sprite.setScale(DISPLAY_SCALE);

    const worldBounds = farmMap.expansions.reduce(
      (bounds, chunk) => ({
        minCol: Math.min(bounds.minCol, chunk.col0),
        minRow: Math.min(bounds.minRow, chunk.row0),
        maxCol: Math.max(bounds.maxCol, chunk.col0 + chunk.cols - 1),
        maxRow: Math.max(bounds.maxRow, chunk.row0 + chunk.rows - 1),
      }),
      { minCol: 0, minRow: 0, maxCol: farmMap.cols - 1, maxRow: farmMap.rows - 1 },
    );
    
    setupWorldCamera(
      this,
      this.player.sprite,
      (worldBounds.maxCol - worldBounds.minCol + 1) * tilePx,
      (worldBounds.maxRow - worldBounds.minRow + 1) * tilePx,
      worldBounds.minCol * tilePx,
      worldBounds.minRow * tilePx,
    );

    this.farmland = new Farmland(farmMap.farmlandArea);
    this.farmlandRenderer = new FarmlandRenderer(this, farmMap);

    this.inventory = gameState.inventory;

    const interactions = new InteractionRegistry();
    registerFarmlandInteractables(farmMap, this.farmland, this.farmlandRenderer, this.inventory, this.player, interactions);
    registerShippingBinInteractable(
      this,
      shippingBin,
      farmMap.shippingBinPosition[0],
      farmMap.shippingBinPosition[1],
      this.inventory,
      this.player,
      interactions,
    );

    const shopTabs: ShopTabDefinition[] = [
      {
        category: 'agriculture',
        textureKey: ALL_CROPS_ICONS_KEY,
        iconFrame: CARROT.iconFrameName,
        tabFrame: TAB_FRAME_AGRICULTURE.name,
        tabFrameHover: TAB_FRAME_AGRICULTURE_LIGHT.name,
      },
      // Categoria interna continua 'tools' (id usado por `ShopCategory`,
      // sem texto visível na aba — só ícone/cor), mas o conteúdo agora é a
      // aba de Receitas (Fase 8 — Crafting, ver `shopItems` abaixo).
      {
        category: 'tools',
        textureKey: HOE.textureKey,
        iconFrame: HOE.iconFrame,
        tabFrame: TAB_FRAME_TOOLS.name,
        tabFrameHover: TAB_FRAME_TOOLS_LIGHT.name,
      },
      {
        category: 'construction',
        textureKey: WELL.textureKey,
        iconFrame: WELL.frameName,
        tabFrame: TAB_FRAME_CONSTRUCTION.name,
        tabFrameHover: TAB_FRAME_CONSTRUCTION_LIGHT.name,
      },
    ];

    const shopItems: ShopItem[] = [
      ...Object.values(CROPS).map((crop) => ({
        id: crop.id,
        category: 'agriculture' as const,
        textureKey: ALL_CROPS_ICONS_KEY,
        iconFrame: crop.iconFrameName,
        price: crop.seedPrice,
      })),
      ...Object.values(DECORATIONS).map((decoration) => ({
        id: decoration.id,
        category: 'construction' as const,
        textureKey: decoration.textureKey,
        iconFrame: decoration.frameName,
        price: decoration.price,
      })),
      // Aba "Ferramentas" agora vende Receitas (Fase 8 — Crafting), não mais
      // ferramentas/armas prontas: pedido explícito do usuário pra substituir
      // a compra direta pelo fluxo Receita (moedas, na Loja) + fabricação
      // (recursos, na Bancada de Trabalho — ver `data/recipes.ts`). Preço é
      // só em moedas (`recipe.price`) — nunca `resourceCost`, os recursos são
      // gastos na hora de fabricar, não na hora de comprar a receita.
      ...Object.values(RECIPES).map((recipe) => {
        const itemVisual = resolveSlotVisual({ category: recipe.category === 'armor' ? 'armor' : 'tool', id: recipe.itemId });
        return {
          id: recipe.id,
          category: 'tools' as const,
          textureKey: itemVisual?.textureKey ?? '',
          iconFrame: itemVisual?.iconFrame ?? 0,
          price: recipe.price,
        };
      }),
    ];

    this.shopMenu = new ShopMenu(this, shopTabs, shopItems, (itemId) => this.buyShopItem(itemId));
    registerShopInteractable(this.shopMenu, farmMap.shopPosition[0], farmMap.shopPosition[1], this.player, interactions);
    registerShopInteractable(this.shopMenu, farmMap.shopPosition[0]-1, farmMap.shopPosition[1], this.player, interactions);

    registerSleepInteractable(
      farmMap.houseDoorPosition[0],
      farmMap.houseDoorPosition[1],
      this.player,
      () => this.sleep(),
      interactions,
    );

    new PropertyExpansionSystem(this, farmMap, grid, this.inventory, interactions);

    const lockedMessage = new LockedMessage(this);
    new BridgeSystem(this, farmMap, grid, this.inventory, interactions, lockedMessage);

    this.decorationPlacement = new DecorationPlacementSystem(
      this,
      farmMap,
      tilePx,
      grid,
      this.inventory,
      interactions,
      this.player,
      this.farmlandRenderer,
      WELL,
    );

    this.treePlanting = new TreePlantingSystem(this, farmMap, tilePx, grid, this.inventory, interactions, this.player);

    new TileCursor(this, tilePx, grid, farmMap.farmlandArea);

    this.pauseMenu = new PauseMenu(this);

    this.controller = new PlayerController(this, this.player, grid, tilePx, interactions);
    this.debugGridOverlay = new DebugGridOverlay(this, grid, tilePx, this.player); // DEBUG TEMPORÁRIO
    this.controller.addInputInterceptor(this.decorationPlacement);
    this.controller.addInputInterceptor(this.treePlanting);

    this.controller.addInputInterceptor({
      isActive: () => isInventoryOpen(),
      handleClick: () => {},
    });

    this.controller.addInputInterceptor({
      isActive: () => isCraftingMenuOpen(),
      handleClick: () => {},
    });

    this.controller.addInputInterceptor({
      isActive: () => this.isSleeping,
      handleClick: () => {},
    });

    this.controller.addInputInterceptor({
      isActive: () => this.pauseMenu.isOpen(),
      handleClick: () => {},
    });

    this.input.keyboard!.on('keydown-B', () => {
      const decoration = this.resolveSelectedDecoration();
      if (!decoration) return;
      if (this.shopMenu.isOpen()) this.shopMenu.close();
      this.decorationPlacement.toggle(decoration);
    });
this.input.keyboard?.on('keydown-F2', () => {
      console.log('Abrindo o Editor de Mapas...');
      // Troque 'MapEditorScene' pela chave exata que você encontrou no Passo 1, se for diferente
      this.scene.start('MapEditorScene'); 
      return;
    })
    this.input.keyboard!.on('keydown-ESC', () => {
      if (this.decorationPlacement.isActive()) {
        this.decorationPlacement.cancel();
        return;
      }
      if (isInventoryOpen()) {
        closeInventoryScreen();
        return;
      }
      if (isCraftingMenuOpen()) {
        closeCraftingMenu();
        return;
      }
      if (this.shopMenu.isOpen()) {
        this.shopMenu.close();
        return;
      }
      if (this.isSleeping) return;
      this.pauseMenu.toggle();
    });

    this.input.keyboard!.on('keydown-E', () => {
      if (this.shopMenu.isOpen()) this.shopMenu.close();
      if (isCraftingMenuOpen()) closeCraftingMenu();
      this.decorationPlacement.cancel();
      toggleInventoryScreen();
    });

    this.events.on('player-stepped', (col: number, row: number) => {
      this.farmlandRenderer.rustleCrop(col, row);
      rustleGrassTuft(this, this.grassTufts, col, row);
      this.treePlanting.rustle(col, row); // <-- Faz as mudas plantadas balançarem
      
      if (this.shopMenu.isOpen()) this.shopMenu.close();
    });

    this.gameClock = gameState.gameClock;
    this.dayNightOverlay = new DayNightOverlay(this);

    ensureUIScene(this);

    const onHotbarChanged = (index: number): void => this.handleHotbarChanged(index);
    this.game.events.on(HOTBAR_CHANGED_EVENT, onHotbarChanged);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(HOTBAR_CHANGED_EVENT, onHotbarChanged);
    });

    this.setupDebugTimeSkip();
    this.setupDebugAddCoins();
  }

  private buyShopItem(itemId: string): void {
    if (CROPS[itemId]) this.buySeed(itemId);
    else if (DECORATIONS[itemId]) this.buyDecoration(itemId);
    else if (RECIPES[itemId]) this.buyRecipe(itemId);

    this.shopMenu.refresh(this.inventory.getCoins());
  }

  private buySeed(cropId: string): void {
    const crop = CROPS[cropId];
    if (!crop) return;

    if (this.inventory.spendCoins(crop.seedPrice)) {
      this.inventory.addSeeds(cropId, 1);
      console.log(`Comprado: 1 semente de ${crop.name} por ${crop.seedPrice} moedas (saldo: ${this.inventory.getCoins()}).`);
    } else {
      console.log(`Moedas insuficientes para comprar semente de ${crop.name} (precisa de ${crop.seedPrice}).`);
    }
  }

  private buyDecoration(decorationId: string): void {
    const decoration = DECORATIONS[decorationId];
    if (!decoration) return;

    if (this.inventory.spendCoins(decoration.price)) {
      this.inventory.addDecorations(decorationId, 1);
      console.log(
        `Comprado: 1 ${decoration.name} por ${decoration.price} moedas (saldo: ${this.inventory.getCoins()}). Tecla B para posicionar.`,
      );
    } else {
      console.log(`Moedas insuficientes para comprar ${decoration.name} (precisa de ${decoration.price}).`);
    }
  }

  /**
   * Compra a Receita (Fase 8 — Crafting), não o item em si: só debita
   * moedas (`recipe.price`) e marca em `Inventory.unlockRecipe` — os
   * `ingredients` (recursos) só são gastos depois, ao fabricar de verdade
   * na Bancada de Trabalho. Substitui `buySword`/compra direta de arma.
   */
  private buyRecipe(recipeId: string): void {
    const recipe = RECIPES[recipeId];
    if (!recipe) return;

    if (this.inventory.hasRecipe(recipeId)) {
      console.log('Receita já desbloqueada.');
      return;
    }

    const itemVisual = resolveSlotVisual({ category: recipe.category === 'armor' ? 'armor' : 'tool', id: recipe.itemId });
    const itemName = itemVisual?.name ?? recipe.itemId;

    if (this.inventory.spendCoins(recipe.price)) {
      this.inventory.unlockRecipe(recipeId);
      console.log(`Receita desbloqueada: ${itemName} (saldo: ${this.inventory.getCoins()}). Fabrique na Bancada de Trabalho.`);
    } else {
      console.log(`Moedas insuficientes para a receita de ${itemName} (precisa de ${recipe.price}).`);
    }
  }

  /** Decoração do slot informado, se for da categoria `'decoration'` — usado tanto pelo atalho de teclado (B) quanto pela troca automática ao selecionar o slot (`handleHotbarChanged`), nenhum dos dois preso a uma decoração específica (Fase 9, antes só funcionava pro Poço). */
  private resolveSelectedDecoration(slot: SlotRef | null = this.inventory.getSelectedSlot()): DecorationDefinition | undefined {
    return slot?.category === 'decoration' ? DECORATIONS[slot.id] : undefined;
  }

  private handleHotbarChanged(_index: number): void {
    const selectedSlot = this.inventory.getSelectedSlot();
    const decoration = this.resolveSelectedDecoration(selectedSlot);

    if (decoration) {
      if (!this.decorationPlacement.isActive()) {
        this.decorationPlacement.toggle(decoration);
      }
    } else {
      this.decorationPlacement.cancel();
    }

    if (selectedSlot && selectedSlot.category === 'resource' && selectedSlot.id === ACORN.id) {
      if (!this.treePlanting.isActive()) this.treePlanting.toggle();
    } else {
      this.treePlanting.cancel();
    }
  }

  private sleep(): void {
    if (this.isSleeping) return;
    this.isSleeping = true;

    this.cameras.main.fadeOut(SLEEP_FADE_MS, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.gameClock.advanceToNextMorning();
      this.farmland.onNewDay();
      this.farmlandRenderer.renderAll(this.farmland);
      this.dayNightOverlay.setNightAlpha(this.gameClock.getNightAlpha());
      
      this.advanceWorldResourcesDay();

      console.log(`Dia ${this.gameClock.getDay()} começou (dormiu).`);

      this.cameras.main.fadeIn(SLEEP_FADE_MS, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () => {
        this.isSleeping = false;
      });
    });
  }

  private advanceWorldResourcesDay(): void {
    advanceForestDay();
    advanceQuarryDay();
    advanceFarmTreesDay();
    this.treePlanting.refreshAfterDayChange();
  }

  private isInputLocked(): boolean {
    return isInventoryOpen() || isCraftingMenuOpen() || this.isSleeping || this.pauseMenu.isOpen();
  }

  private setupDebugTimeSkip(): void {
    this.input.keyboard!.on('keydown-T', () => {
      const newDay = this.gameClock.update(DEBUG_TIME_SKIP_MS);
      if (newDay) {
        this.farmland.onNewDay();
        this.advanceWorldResourcesDay();
      }
      this.farmlandRenderer.renderAll(this.farmland);
    });
  }

  private setupDebugAddCoins(): void {
    const addDebugCoins = (): void => {
      this.inventory.addCoins(DEBUG_ADD_COINS_AMOUNT);
      console.log(`[debug] +${DEBUG_ADD_COINS_AMOUNT} moedas (saldo: ${this.inventory.getCoins()}).`);
    };
    
    this.input.keyboard!.on('keydown-PLUS', addDebugCoins);
    this.input.keyboard!.on('keydown-NUMPAD_ADD', addDebugCoins);
  }

  update(time: number, delta: number): void {
    if (!this.isInputLocked()) this.controller.update(time, delta);

    // Pedido explícito do usuário: árvores plantadas pelo jogador (bolota)
    // não ficavam semitransparentes ao personagem passar atrás delas,
    // porque só as árvores ESTÁTICAS do mapa (`this.trees`) entravam nessa
    // checagem — combina as duas fontes.
    const allTrees = [...this.trees, ...this.treePlanting.getPlantedTrees()];
    updateTreeOverlap(this.player, allTrees);
    this.decorationPlacement.updateOcclusion();
    this.debugGridOverlay.update(); // DEBUG TEMPORÁRIO — remover junto com `systems/debugGridOverlay.ts` quando não precisar mais.
    this.farmlandRenderer.renderAll(this.farmland);

    if (!this.isSleeping && !this.pauseMenu.isOpen()) {
      const newDay = this.gameClock.update(delta);
      if (newDay) {
        this.farmland.onNewDay();
        this.advanceWorldResourcesDay();
        console.log(`Dia ${this.gameClock.getDay()} começou.`);
      }
    }
    
    this.dayNightOverlay.setNightAlpha(this.gameClock.getNightAlpha());

    if (this.shopMenu.isOpen()) this.shopMenu.refresh(this.inventory.getCoins());
  }
}