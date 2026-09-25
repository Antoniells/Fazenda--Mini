import Phaser from 'phaser';
import { farmMap } from '../data/maps/farmMap';
import { attachFootstepSounds, playEffect } from '../systems/soundEffects';
import { DOOR_SOUND } from '../data/audio';
import { SPEND_MONEY_SOUND } from '../data/audio';
import { ROOSTER_SOUND, ROOSTER_HOURS } from '../data/audio';
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
  ROCK_FRAME_2,
  WOOD_KEY,
  WOOD_PATH,
  WOOD_FRAME,
  IRON_KEY,
  IRON_PATH,
  IRON_FRAME,
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
  WATER_KEY,
  WATER_PATH,
  PROPS_TILESET_KEY,
  PROPS_TILESET_PATH,
} from '../data/tiles';
import { PLAYER_START } from '../data/player';
import { preloadPlayerSprites } from '../systems/playerSprites';
import { preloadPet } from '../systems/petSprites';
import { PetCompanion } from '../systems/petCompanion';
import { PET_ROAM } from '../data/pets';
import { CROPS, CARROT, HARVEST_MAX_YIELD, ALL_CROPS_ICONS_KEY, ALL_CROPS_ICONS_PATH } from '../data/crops';
import { DECORATIONS, WELL, DecorationDefinition, MORNING_ANIMATION_HOURS } from '../data/decorations';
import { HOE, SICKLE, AXE, PICKAXE, HAMMER, HAMMER_PRICE, STONE_AXE, STONE_PICKAXE, IRON_AXE, GOLD_AXE, IRON_PICKAXE, GOLD_PICKAXE } from '../data/tools';
import { getToolTierInfo } from '../data/toolProgression';
import { previousToolName } from '../systems/toolUpgrade';
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
import { SHADOW_KEY, SHADOW_PATH, SPLASH_KEY, SPLASH_PATH, SPLASH_FRAME_SIZE, SPRINKLER_WATER_KEY, SPRINKLER_WATER_PATH, SPRINKLER_WATER_FRAME_SIZE, LEAF_FALL_KEY, LEAF_FALL_PATH, LEAF_FALL_FRAME_SIZE } from '../data/effects';
import { GRASS_DETAILS_KEY, GRASS_DETAILS_PATH } from '../data/grassDetails';
import { buildFarmGround, buildFenceCorners, buildFenceSide, buildShippingBin, buildShopStand, buildPlayerHouse, buildFarmlandFence, DISPLAY_SCALE } from '../systems/mapBuilder';
import { buildMapProps } from '../systems/mapProps';
import { GROUND_TILESETS } from '../systems/groundTilesets';
import { buildDirtZone } from '../systems/dirtPaths';
import { buildGrassDetails, rustleGrassTuft, GrassTuftMap } from '../systems/grassDetails';
import { buildWalkableGrid } from '../systems/grid';
import { PropertyExpansionSystem } from '../systems/propertyExpansion';
import { BridgeSystem } from '../systems/bridgeSystem';
import { TreePlantingSystem } from '../systems/treePlanting';
import { ACORN, RESOURCES } from '../data/resources';
import { WEAPONS } from '../data/weapons';
import { ARMORS } from '../data/armors';
import { RECIPES } from '../data/recipes';
import { SlotRef, resolveSlotVisual } from '../data/items';
import { updateTreeOverlap } from '../systems/treeOverlap';
import { FarmResources, initFarmResourceRegistry } from '../systems/farmResources';
import { GameClock, DAY_LENGTH_MS } from '../systems/gameClock';
import { DayNightOverlay } from '../systems/dayNightOverlay';
import { WorldBlur } from '../systems/worldBlur';
import { Player } from '../entities/Player';
import { PlayerController } from '../systems/playerController';
import { Farmland } from '../systems/farmland';
import { FarmlandRenderer } from '../systems/farmlandRenderer';
import { Inventory } from '../systems/inventory';
import { InteractionRegistry } from '../systems/interaction';
import { registerFarmlandInteractables } from '../systems/farmlandInteraction';
import { registerShippingBinInteractable } from '../systems/shippingBinInteraction';
import { registerShopInteractable } from '../systems/shopInteraction';
import { registerEnterHouseInteractable } from '../systems/enterHouseInteraction';
import { exitToMainMenu } from '../systems/sessionExit';
import { startNextDay, DayTurn } from '../systems/dayCycle';
import { shouldStartHorde } from '../systems/horde';
import { advanceWorldTime, describeNewDay } from '../systems/worldTime';
import { FarmFences } from '../systems/farmFences';
import { SLIME_KEY, SLIME_PATH, SLIME_FRAME_SIZE } from '../data/enemies';
import { attachFootDust, isDirtGround, isGrassGround } from '../systems/grassDust';
import { tutorial } from '../systems/tutorial';
import { onPlayerStepped } from '../systems/sceneEvents';
import { ButterflyField, preloadButterflies } from '../systems/butterflies';
import { HordeDirector } from '../systems/hordeDirector';
import { PetBox, preloadPetBox } from '../systems/petBox';
import { Mailbox, preloadMailbox } from '../systems/mailbox';
import { EventManager, preloadEvents } from '../systems/eventManager';
import { WORLD_EVENTS } from '../systems/events';
import { isPetBoxPending, unlockPet, grantPetBed } from '../systems/petEvent';
import { save as saveGame } from '../systems/saveManager';
import { HOUSE_SCENE_KEY } from './HouseScene';
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
  isChestMenuOpen,
  closeChestMenu,
  isLetterOpen,
  isDialogueOpen,
} from './UIScene';
import type { WakeUpAfterDeath } from '../systems/playerDeath';
import { setupWorldCamera, applyWorldCameraBounds } from '../systems/cameraSetup';
import { ShopMenu, ShopItem, ShopTabDefinition } from '../ui/shopMenu';
import { ShippingBinMenu } from '../ui/shippingBinMenu';
import { registerMapEditorShortcut } from '../systems/mapEditorLauncher';

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
/** Intervalo (ms) entre um respingo e o próximo quando a chuva "varre" a lavoura (ver `playDayTurnSplashes`). */
const RAIN_SWEEP_STEP_MS = 70;
/** Janela (ms) depois de a conversa ser vista aberta em que o ESC ainda vale pra ela, e não pra Pausa. */
const DIALOGUE_ESC_GRACE_MS = 120;
/** Fade (ms) ao entrar em casa. */
const HOUSE_FADE_MS = 300;

export class MainScene extends Phaser.Scene {
  private player!: Player;
  private controller!: PlayerController;
  /** Só existe depois de o pet ser desbloqueado (evento da caixa, `systems/petEvent.ts`). */
  private petCompanion?: PetCompanion;
  /** Cria o pet (uma vez) — chamado ao carregar a cena com o pet já liberado e ao ler a carta da caixa. */
  private spawnPetCompanion!: () => void;
  private farmFences!: FarmFences;
  /** Hordas (a cada 10 dias): inimigos, alvos e fim do evento — `systems/hordeDirector.ts`. */
  private hordeDirector!: HordeDirector;
  private butterflies!: ButterflyField;
  /** Pinheiros decorativos do vilarejo — entram na transparência de sobreposição junto com as árvores da Fazenda. */
  /** DEBUG TEMPORÁRIO — ver `systems/debugGridOverlay.ts`. */
  private debugGridOverlay!: DebugGridOverlay;
  /** Árvores (do mapa, plantadas e brotos que nascem sozinhos) e pedras da Fazenda — colhíveis, ver `systems/farmResources.ts`. */
  private farmResources!: FarmResources;
  private grassTufts!: GrassTuftMap;
  private farmland!: Farmland;
  private farmlandRenderer!: FarmlandRenderer;
  private inventory!: Inventory;
  private shopMenu!: ShopMenu;
  private shippingBinMenu!: ShippingBinMenu;
  private mailbox!: Mailbox;
  private eventManager!: EventManager;
  /** Último instante em que a conversa estava aberta (`update`) — ver o ESC em `create`. */
  private dialogueSeenOpenAt = -Infinity;
  private decorationPlacement!: DecorationPlacementSystem;
  private treePlanting!: TreePlantingSystem;
  private gameClock!: GameClock;
  private dayNightOverlay!: DayNightOverlay;
  private worldBlur!: WorldBlur;
  private pauseMenu!: PauseMenu;
  private lockedMessage!: LockedMessage;
  /** Trava enquanto o fade de entrada na casa roda (evita `scene.start` duas vezes). */
  private isEnteringHouse = false;
  private spawnOverride: { col: number; row: number } | null = null;
  /** Só preenchido quando a Fazenda abre porque o jogador desmaiou (ver `systems/playerDeath.ts`) — mostra o aviso e faz a tela clarear em vez de aparecer de repente. */
  private wakeUpNotice: WakeUpAfterDeath | null = null;

  constructor() {
    super('MainScene');
    // Semeia o registro dos recursos da Fazenda (roda no boot, como Floresta/Pedreira) — antes de qualquer save ser carregado.
    initFarmResourceRegistry();
  }

  init(data?: { spawnPoint?: { col: number; row: number }; wokeUpAfterDeath?: WakeUpAfterDeath }): void {
    this.spawnOverride = data?.spawnPoint ?? null;
    this.isEnteringHouse = false;
    this.wakeUpNotice = data?.wokeUpAfterDeath ?? null;
    // Desmaiou NA HORDA (`systems/playerDeath.ts` já encerrou o evento sem bônus): o dia avança (relógio 06:00, lavoura, clima, mundo).
    if (this.wakeUpNotice?.hordeDefeat) startNextDay();
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
    // Só usado se `farmMap.ground` tiver algum GID pintado com o tileset de
    // Água no `MapEditorScene` (ver `systems/groundTilesets.ts`) — sem isso
    // o tileset falharia ao registrar (textura inexistente) e essas células
    // ficariam em branco.
    this.load.image(WATER_KEY, encodeURI(`/${WATER_PATH}`));
    // Qualquer tileset de chão ALÉM de Grama/Solo/Água (importado no editor
    // e colado em `GROUND_TILESETS`, pedido explícito — "deixa essa etapa
    // mais automática"): carregado sozinho a partir do array, sem precisar
    // de mais uma linha de `load.image` aqui a cada novo tileset. Grama/
    // Água ficam com as linhas acima (mais o comentário já existente); Solo
    // fica de fora deste loop de propósito — precisa do `load.spritesheet`
    // acima (frames NUMÉRICOS do autotile de terra arável, ver
    // `SOIL_DRY_AUTOTILE`/`data/tiles.ts`), não um `load.image` genérico.
    for (const tileset of GROUND_TILESETS) {
      if (tileset.id === 'grass' || tileset.id === 'soil' || tileset.id === 'water') continue;
      this.load.image(tileset.textureKey, encodeURI(`/${tileset.path}`));
    }
    this.load.image(PROPS_TILESET_KEY, encodeURI(`/${PROPS_TILESET_PATH}`));

    // Sprite do personagem escolhido no save (`profile.characterId` já foi definido por `load`/`startNewGame` antes desta cena começar).
    preloadPlayerSprites(this, gameState.profile.characterId);
    preloadPet(this, gameState.profile.petId);
    preloadPetBox(this);
    preloadMailbox(this);
    preloadEvents(this, WORLD_EVENTS);
    // Sprite do Slime: os inimigos da horda (`entities/Raider.ts`) usam a mesma arte — a Floresta carrega por conta própria, a Fazenda também precisa.
    this.load.spritesheet(SLIME_KEY, encodeURI(`/${SLIME_PATH}`), { frameWidth: SLIME_FRAME_SIZE, frameHeight: SLIME_FRAME_SIZE });
    preloadButterflies(this);

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
    this.load.spritesheet(HAMMER.textureKey, encodeURI(`/${HAMMER.texturePath}`), {
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
    for (const tool of [STONE_AXE, STONE_PICKAXE, IRON_AXE, GOLD_AXE, IRON_PICKAXE, GOLD_PICKAXE]) {
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
    this.load.image(IRON_KEY, encodeURI(`/${IRON_PATH}`));
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
    this.load.spritesheet(SPRINKLER_WATER_KEY, encodeURI(`/${SPRINKLER_WATER_PATH}`), {
      frameWidth: SPRINKLER_WATER_FRAME_SIZE,
      frameHeight: SPRINKLER_WATER_FRAME_SIZE,
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

    // Garante o frame do ícone de "Pedra" (`data/resources.ts` `STONE`) mesmo sem nenhuma pedra desenhada no mundo ainda.
    const rockTexture = this.textures.get(ROCK_KEY);
    if (!rockTexture.has(ROCK_FRAME_2.name)) {
      rockTexture.add(ROCK_FRAME_2.name, 0, ROCK_FRAME_2.rect.x, ROCK_FRAME_2.rect.y, ROCK_FRAME_2.rect.width, ROCK_FRAME_2.rect.height);
    }

    const woodTexture = this.textures.get(WOOD_KEY);
    if (!woodTexture.has(WOOD_FRAME.name)) {
      woodTexture.add(WOOD_FRAME.name, 0, WOOD_FRAME.rect.x, WOOD_FRAME.rect.y, WOOD_FRAME.rect.width, WOOD_FRAME.rect.height);
    }

    const ironTexture = this.textures.get(IRON_KEY);
    if (!ironTexture.has(IRON_FRAME.name)) {
      ironTexture.add(IRON_FRAME.name, 0, IRON_FRAME.rect.x, IRON_FRAME.rect.y, IRON_FRAME.rect.width, IRON_FRAME.rect.height);
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
      // Frames extras da animação (ex.: aspersor girando), do mesmo spritesheet.
      for (const { name, rect } of decoration.animationFrames ?? []) {
        if (!texture.has(name)) texture.add(name, 0, rect.x, rect.y, rect.width, rect.height);
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
      // Fruto colhido E saquinho de semente (pedido explícito, item 4) — dois frames por cultura agora, não um só.
      if (!cropIconsTexture.has(crop.cropFrameName)) {
        cropIconsTexture.add(
          crop.cropFrameName,
          0,
          crop.cropFrameRect.x,
          crop.cropFrameRect.y,
          crop.cropFrameRect.width,
          crop.cropFrameRect.height,
        );
      }
      if (!cropIconsTexture.has(crop.seedFrameName)) {
        cropIconsTexture.add(
          crop.seedFrameName,
          0,
          crop.seedFrameRect.x,
          crop.seedFrameRect.y,
          crop.seedFrameRect.width,
          crop.seedFrameRect.height,
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
    // Cor de fundo autorada no MapEditorScene (Sidebar → Cor de Fundo) —
    // opcional, sem ela mantém a cor padrão do Phaser (preto).
    if (farmMap.backgroundColor) this.cameras.main.setBackgroundColor(farmMap.backgroundColor);
    buildFenceCorners(this, farmMap);

    this.grassTufts = buildGrassDetails(this, farmMap, buildDirtZone(farmMap));

    const shippingBin = buildShippingBin(this, farmMap);
    buildShopStand(this, farmMap);
    buildPlayerHouse(this, farmMap);
    const fenceImages = buildFarmlandFence(this, farmMap);
    // Props de decoração ambiente autorados no MapEditorScene (aba
    // Decoração, pedido explícito) — puramente visuais, sem colisão.
    buildMapProps(this, farmMap.tileSize, farmMap.props ?? []);

    const grid = buildWalkableGrid(farmMap);
    const tilePx = farmMap.tileSize * DISPLAY_SCALE;
    Player.createAnimations(this, gameState.profile.characterId);

    const spawn = this.spawnOverride ?? PLAYER_START;
    this.player = new Player(this, spawn.col, spawn.row, tilePx);
    this.player.sprite.setScale(DISPLAY_SCALE);

    // A câmera só mostra a Fazenda e os trechos de expansão JÁ liberados (o que fica atrás de uma parede trancada não aparece — como no
    // lado leste, onde a ponte leva ao Vilarejo); comprar um trecho amplia os limites (`applyFarmCameraBounds`).
    const initialBounds = this.computeFarmCameraBounds();
    setupWorldCamera(this, this.player.sprite, initialBounds.width, initialBounds.height, initialBounds.x, initialBounds.y);

    // Bug corrigido (Scene Persistence) — `gameState.farmland` é uma
    // REFERÊNCIA ao único `Farmland` da sessão (ver `systems/gameState.ts`),
    // nunca uma instância nova: antes disso, voltar de uma ponte recriava
    // `MainScene` do zero e com ela um `Farmland` vazio, perdendo toda terra
    // arada/plantação. `farmlandRenderer.renderAll` (chamado todo frame em
    // `update()`, mas também aqui pra já nascer correto no 1º frame) lê esse
    // estado (possivelmente não-vazio) e desenha imediatamente.
    this.farmland = gameState.farmland;
    this.farmlandRenderer = new FarmlandRenderer(this, farmMap);
    this.farmlandRenderer.renderAll(this.farmland);

    this.inventory = gameState.inventory;

    const interactions = new InteractionRegistry();
    // As cercas da lavoura viram alvo da horda (têm vida e, ao cair, ficam destruídas até o Martelo) — mesmas imagens/células que já bloqueiam no grid.
    this.farmFences = new FarmFences(this, grid, fenceImages, interactions, this.player);
    // Árvores e pedras da Fazenda: desenhadas do registro (o que já foi cortado/quebrado/nasceu), bloqueiam o grid e ganham a coleta.
    this.farmResources = new FarmResources(this, grid, interactions, this.player);
    registerFarmlandInteractables(farmMap, this.farmland, this.farmlandRenderer, this.inventory, this.player, interactions);
    this.shippingBinMenu = registerShippingBinInteractable(
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
        iconFrame: CARROT.seedFrameName,
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
        name: `Semente de ${crop.name}`,
        description: `Cresce em ${crop.growthFrames.length - 1} dias (regue todo dia). Rende de 1 a ${HARVEST_MAX_YIELD} por colheita (com sorte!), vendida a ${crop.sellPrice} moedas cada.`,
        textureKey: ALL_CROPS_ICONS_KEY,
        // Saquinho de semente (pedido explícito, item 4) — a Loja vende sementes, não o fruto colhido.
        iconFrame: crop.seedFrameName,
        price: crop.seedPrice,
      })),
      ...Object.values(DECORATIONS).filter((decoration) => !decoration.notForSale).map((decoration) => ({
        id: decoration.id,
        category: 'construction' as const,
        name: decoration.name,
        description: decoration.description,
        textureKey: decoration.textureKey,
        iconFrame: decoration.frameName,
        price: decoration.price,
      })),
      // Martelo: compra DIRETA em moedas (conserta as cercas destruídas pela horda) — única ferramenta pronta que a aba vende.
      {
        id: HAMMER.id,
        category: 'tools' as const,
        name: HAMMER.name,
        description: 'Conserta cercas destruídas pelos ataques. Com o Martelo na mão, clique na cerca quebrada.',
        textureKey: HAMMER.textureKey,
        iconFrame: HAMMER.iconFrame,
        price: HAMMER_PRICE,
      },
      // Aba "Ferramentas" agora vende Receitas (Fase 8 — Crafting), não mais
      // ferramentas/armas prontas: pedido explícito do usuário pra substituir
      // a compra direta pelo fluxo Receita (moedas, na Loja) + fabricação
      // (recursos, na Bancada de Trabalho — ver `data/recipes.ts`). Preço é
      // só em moedas (`recipe.price`) — nunca `resourceCost`, os recursos são
      // gastos na hora de fabricar, não na hora de comprar a receita.
      ...Object.values(RECIPES).map((recipe) => {
        const itemVisual = resolveSlotVisual({ category: recipe.category === 'armor' ? 'armor' : 'tool', id: recipe.itemId });
        const ingredients = recipe.ingredients.map((ingredient) => `${ingredient.amount} ${RESOURCES[ingredient.resourceId]?.name ?? ingredient.resourceId}`).join(', ');
        return {
          id: recipe.id,
          category: 'tools' as const,
          name: `Receita: ${itemVisual?.name ?? recipe.itemId}`,
          description: getToolTierInfo(recipe.itemId)?.tier
            ? `Upgrade: na Bancada de Trabalho, substitui ${previousToolName(recipe.itemId)} no mesmo slot. Ingredientes: ${ingredients}.`
            : `Aprenda a fabricar na Bancada de Trabalho. Ingredientes: ${ingredients || 'nenhum'}.`,
          textureKey: itemVisual?.textureKey ?? '',
          iconFrame: itemVisual?.iconFrame ?? 0,
          price: recipe.price,
        };
      }),
    ];

    this.shopMenu = new ShopMenu(
      this,
      shopTabs,
      shopItems,
      (itemId) => this.buyShopItem(itemId),
      // Receitas e o Martelo são compras únicas: depois de aprendida/comprado, o botão vira "Já possui".
      (itemId) => (!!RECIPES[itemId] && this.inventory.hasRecipe(itemId)) || (itemId === HAMMER.id && this.inventory.hasTool(HAMMER.id)),
    );
    registerShopInteractable(this.shopMenu, farmMap.shopPosition[0], farmMap.shopPosition[1], this.player, interactions);
    registerShopInteractable(this.shopMenu, farmMap.shopPosition[0]-1, farmMap.shopPosition[1], this.player, interactions);

    // A porta agora ENTRA na casa (`HouseScene`); dormir é na cama lá dentro.
    registerEnterHouseInteractable(
      farmMap.houseDoorPosition[0],
      farmMap.houseDoorPosition[1],
      this.player,
      () => this.enterHouse(),
      interactions,
    );

    new PropertyExpansionSystem(this, farmMap, grid, this.inventory, interactions, () => this.applyFarmCameraBounds());
    // Lado LESTE: não é um trecho de expansão (o Vilarejo virou uma cena, alcançada pela ponte leste de `farmMap.bridges`), então a
    // cerca da propriedade desse lado é desenhada aqui, de forma permanente.
    buildFenceSide(this, farmMap, 'east');

    const lockedMessage = new LockedMessage(this);
    this.lockedMessage = lockedMessage;
    new BridgeSystem(this, farmMap, grid, this.inventory, interactions, lockedMessage);

    // Quem já tinha o pet antes da caminha existir a recebe agora (uma vez): posicione dentro de casa.
    if (grantPetBed()) lockedMessage.show('CAMINHA DO BICHINHO', 'Um presente pro seu bichinho: está na Bolsa. Posicione-a dentro de casa.');

    // Evento do pet: a caixa em frente à casa (3º sono). Ler a carta desbloqueia o pet, que passa a existir em todas as cenas.
    if (isPetBoxPending()) {
      const box: PetBox = new PetBox(this, tilePx, grid, interactions, this.player, () => {
        unlockPet();
        saveGame();
        box.destroy();
        this.spawnPetCompanion();
        lockedMessage.show('UM NOVO AMIGO', gameState.petBedGiven ? 'Ele agora mora na sua fazenda e trouxe uma caminha: veja na Bolsa e posicione dentro de casa.' : 'O animalzinho agora mora na sua fazenda.');
      });
    }

    // Caixa de Correio: cartas agendadas (`data/mail.ts`) chegam nos dias delas; um papel flutua em cima enquanto há carta não lida.
    this.mailbox = new Mailbox(this, tilePx, grid, interactions, this.player);

    if (this.wakeUpNotice) {
      const { coinsLost, hordeDefeat } = this.wakeUpNotice;
      this.wakeUpNotice = null;
      this.cameras.main.fadeIn(700, 0, 0, 0);
      if (hordeDefeat) {
        const kept = hordeDefeat.drops.length > 0 ? `Você guardou: ${hordeDefeat.drops.join(', ')}.` : 'Você não abateu nenhum inimigo.';
        lockedMessage.show('A HORDA VENCEU', `O dia avançou. ${coinsLost > 0 ? `Você perdeu ${coinsLost} moedas. ` : ''}${kept}`);
      } else {
        lockedMessage.show('VOCÊ DESMAIOU', coinsLost > 0 ? `Você acordou em casa e perdeu ${coinsLost} moedas.` : 'Você acordou em casa.');
      }
    }

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
      (col, row) => this.farmFences.hasFenceAt(col, row),
    );
    // Bug corrigido (Scene Persistence) — recria as construções (Poço,
    // Bancada, etc.) que o jogador já tinha colocado em uma sessão anterior
    // desta MESMA aba (`gameState.placedDecorations`), já que os
    // `Phaser.GameObjects.Image` da vez passada morreram junto com a cena
    // antiga e o `DecorationPlacementSystem` acima sempre nasce vazio.
    this.decorationPlacement.restorePlacements();

    this.treePlanting = new TreePlantingSystem(this, farmMap, tilePx, grid, this.inventory, this.farmResources, (col, row) => this.farmFences.hasFenceAt(col, row));

    new TileCursor(this, tilePx, grid, farmMap.farmlandArea);

    this.pauseMenu = new PauseMenu(this, { onExitToMenu: () => this.exitToMainMenu() });

    this.controller = new PlayerController(this, this.player, grid, tilePx, interactions);
    // O Phaser REAPROVEITA esta instância de cena a cada `scene.start` (ex.: voltar da casa) e os campos da classe sobrevivem — sem zerar, o pet da vez anterior
    // (já destruído junto com a cena) ficava aqui e a guarda de `spawnPetCompanion` impedia de criar outro: o pet "entrava em casa e não saía mais".
    this.petCompanion = undefined;
    // Pet companheiro (só depois de desbloqueado): nasce ao lado do jogador (é assim que acompanha em cada troca de cena) e, na Fazenda, vagueia solto.
    this.spawnPetCompanion = (): void => {
      if (!this.petCompanion) this.petCompanion = new PetCompanion(this, this.player, this.controller, grid, tilePx, PET_ROAM.farm);
    };
    if (gameState.petUnlocked) this.spawnPetCompanion();

    // Eventos do mundo por dia (o visitante do dia 8, os gatos da Amanda…): `systems/eventManager.ts`.
    this.eventManager = new EventManager({ scene: this, grid, tilePx, player: this.player, controller: this.controller, interactions }, WORLD_EVENTS);

    // Hordas: a cada 10 dias, à noite. Os inimigos entram no PlayerController (colisão com o jogador e golpe de espada).
    this.hordeDirector = new HordeDirector(this, grid, tilePx, this.farmland, this.farmlandRenderer, this.farmFences, this.player, lockedMessage);
    this.controller.setEnemyProvider(() => this.hordeDirector.getAliveEnemies());
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
      isActive: () => this.isEnteringHouse || isLetterOpen(),
      handleClick: () => {},
    });

    // Baú da Fazenda aberto (o Baú também pode ficar fora de casa): o clique é só dele.
    this.controller.addInputInterceptor({
      isActive: () => isChestMenuOpen(),
      handleClick: () => {},
    });

    // Conversa aberta (o visitante do dia 8): o clique é só dela.
    this.controller.addInputInterceptor({
      isActive: () => isDialogueOpen(),
      handleClick: () => {},
    });

    // Menu da Caixa de Remessas aberto: o clique é só dele (mesma ideia do Inventário/Bancada).
    this.controller.addInputInterceptor({
      isActive: () => this.shippingBinMenu.isOpen(),
      handleClick: () => {},
    });

    // Loja aberta: o clique é só dela — antes disso faltava (dava pra andar/interagir com o cenário por trás dela), pedido
    // explícito do usuário junto com o desfoque de fundo (ver `this.worldBlur` mais abaixo).
    this.controller.addInputInterceptor({
      isActive: () => this.shopMenu.isOpen(),
      handleClick: () => {},
    });

    this.controller.addInputInterceptor({
      isActive: () => this.pauseMenu.isOpen(),
      handleClick: () => {},
    });

    this.input.keyboard!.on('keydown-B', () => {
      if (!tutorial.allows({ kind: 'menu' })) return;
      const decoration = this.resolveSelectedDecoration();
      if (!decoration) return;
      this.closeShopMenus();
      this.decorationPlacement.toggle(decoration);
    });
    registerMapEditorShortcut(this, 'farm');
    this.input.keyboard!.on('keydown-ESC', () => {
      if (isLetterOpen()) return; // A carta só fecha pelo botão (o pet só é liberado depois da leitura).
      // O ESC que fecha a conversa (a `UIScene` trata dele) não pode abrir a Pausa junto: a conversa já pode ter fechado neste mesmo frame.
      if (isDialogueOpen() || this.time.now - this.dialogueSeenOpenAt < DIALOGUE_ESC_GRACE_MS) return;
      if (isChestMenuOpen()) {
        closeChestMenu();
        return;
      }
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
        this.closeShopMenus();
        return;
      }
      if (this.shippingBinMenu.isOpen()) {
        this.shippingBinMenu.close();
        return;
      }
      if (this.isEnteringHouse) return;
      this.pauseMenu.toggle();
    });

    this.input.keyboard!.on('keydown-E', () => {
      if (!tutorial.allows({ kind: 'menu' })) return; // Tutorial: nada de Inventário até terminar.
      if (isChestMenuOpen()) return; // O baú já mostra a bolsa; E não abre outra tela por cima.
      this.closeShopMenus();
      if (this.shippingBinMenu.isOpen()) this.shippingBinMenu.close();
      if (isCraftingMenuOpen()) closeCraftingMenu();
      this.decorationPlacement.cancel();
      toggleInventoryScreen();
    });

    const bridgeCells = new Set(farmMap.bridges.map((bridge) => `${bridge.col},${bridge.row}`));
    attachFootstepSounds(this, (col, row) => (bridgeCells.has(`${col},${row}`) ? 'bridge' : 'grass'));

    // "Grama" pro nascimento das borboletas: o GID autorado da célula é grama plana, e não é ponte nem lavoura já arada/plantada.
    const isGrassCell = (col: number, row: number): boolean => {
      if (bridgeCells.has(`${col},${row}`)) return false;
      if (!isGrassGround(farmMap.ground, col, row)) return false;
      const plot = this.farmland.getPlot(col, row);
      return !plot || plot.state === 'untilled';
    };
    // "Terra" pra poeira dos pés: o caminho de terra da Fazenda (GID autorado que não é grama nem água) e os canteiros já arados/plantados — nunca a grama nem a ponte.
    const isDirtCell = (col: number, row: number): boolean => {
      if (bridgeCells.has(`${col},${row}`)) return false;
      const plot = this.farmland.getPlot(col, row);
      if (plot && plot.state !== 'untilled') return true;
      return isDirtGround(farmMap.ground, col, row);
    };
    attachFootDust(this, this.player, tilePx, isDirtCell);
    this.butterflies = new ButterflyField(this, gameState.gameClock, tilePx, isGrassCell);

    onPlayerStepped(this, (col, row) => {
      tutorial.notify({ kind: 'move' });
      this.farmlandRenderer.rustleCrop(col, row);
      rustleGrassTuft(this, this.grassTufts, col, row);
      this.farmResources.rustle(col, row); // <-- Faz os brotos e mudas balançarem
      
      this.closeShopMenus();
    });

    this.gameClock = gameState.gameClock;
    this.dayNightOverlay = new DayNightOverlay(this);
    this.worldBlur = new WorldBlur(this.cameras.main);

    ensureUIScene(this);

    const onHotbarChanged = (index: number): void => this.handleHotbarChanged(index);
    this.game.events.on(HOTBAR_CHANGED_EVENT, onHotbarChanged);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(HOTBAR_CHANGED_EVENT, onHotbarChanged);
    });

    this.setupDebugTimeSkip();
    this.setupDebugAddCoins();

    // Tutorial de novos jogadores (partida nova): começa, ou retoma se a Fazenda reabriu no meio — no-op se já concluído.
    tutorial.begin();
  }

  /** Aspersores: a animação toca UMA vez por dia, de manhã (`MORNING_ANIMATION_HOURS`) — o dia já tocado fica em `gameState.sprinklerAnimDay`, então trocar de cena não repete. */
  private playSprinklerMorning(): void {
    const hours = this.gameClock.getHours();
    const day = this.gameClock.getDay();
    if (hours < MORNING_ANIMATION_HOURS.from || hours >= MORNING_ANIMATION_HOURS.to || gameState.sprinklerAnimDay === day) return;
    gameState.sprinklerAnimDay = day;
    this.decorationPlacement.playMorningAnimations();
  }

  /** O galo canta UMA vez por dia, ao amanhecer (`ROOSTER_HOURS`) — mesmo esquema do aspersor acima. */
  private playRoosterMorning(): void {
    const hours = this.gameClock.getHours();
    const day = this.gameClock.getDay();
    if (hours < ROOSTER_HOURS.from || hours >= ROOSTER_HOURS.to || gameState.roosterSoundDay === day) return;
    gameState.roosterSoundDay = day;
    playEffect(this, ROOSTER_SOUND);
  }

  /** Retângulo (em px) que a câmera pode mostrar: o núcleo da Fazenda mais os trechos de expansão já liberados. */
  private computeFarmCameraBounds(): { x: number; y: number; width: number; height: number } {
    const tilePx = farmMap.tileSize * DISPLAY_SCALE;
    let minCol = 0;
    let minRow = 0;
    let maxCol = farmMap.cols - 1;
    let maxRow = farmMap.rows - 1;
    for (const chunk of farmMap.expansions) {
      if (!chunk.startsUnlocked && !gameState.unlockedExpansions.has(chunk.direction)) continue;
      minCol = Math.min(minCol, chunk.col0);
      minRow = Math.min(minRow, chunk.row0);
      maxCol = Math.max(maxCol, chunk.col0 + chunk.cols - 1);
      maxRow = Math.max(maxRow, chunk.row0 + chunk.rows - 1);
    }
    return { x: minCol * tilePx, y: minRow * tilePx, width: (maxCol - minCol + 1) * tilePx, height: (maxRow - minRow + 1) * tilePx };
  }

  /** Um trecho foi comprado: amplia os limites da câmera pra incluí-lo. */
  private applyFarmCameraBounds(): void {
    const bounds = this.computeFarmCameraBounds();
    applyWorldCameraBounds(this, bounds.width, bounds.height, bounds.x, bounds.y);
  }

  /** Fecha a loja da Fazenda — andar/menus/Esc a fecham. */
  private closeShopMenus(): void {
    if (this.shopMenu.isOpen()) this.shopMenu.close();
  }

  private buyShopItem(itemId: string): void {
    const coinsBefore = this.inventory.getCoins();

    if (CROPS[itemId]) this.buySeed(itemId);
    else if (DECORATIONS[itemId]) this.buyDecoration(itemId);
    else if (RECIPES[itemId]) this.buyRecipe(itemId);
    else if (itemId === HAMMER.id) this.buyHammer();

    // Só toca se a compra realmente aconteceu (saldo caiu) — sem moedas ou receita já desbloqueada ficam em silêncio.
    if (this.inventory.getCoins() < coinsBefore) playEffect(this, SPEND_MONEY_SOUND);

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

  /** Compra o Martelo: desconta `HAMMER_PRICE` moedas e o entrega já num slot da Bolsa (compra única). */
  private buyHammer(): void {
    if (this.inventory.hasTool(HAMMER.id)) {
      console.log('Você já tem o Martelo.');
      return;
    }
    if (this.inventory.spendCoins(HAMMER_PRICE)) {
      this.inventory.unlockTool(HAMMER.id);
      console.log(`Comprado: Martelo por ${HAMMER_PRICE} moedas (saldo: ${this.inventory.getCoins()}).`);
    } else {
      console.log(`Moedas insuficientes para comprar o Martelo (precisa de ${HAMMER_PRICE}).`);
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
    const decoration = slot?.category === 'decoration' ? DECORATIONS[slot.id] : undefined;
    // Móveis (`placement: 'house'`) só se posicionam dentro da casa (`HouseScene`), nunca na Fazenda — exceto os `outdoor` (o Baú).
    return decoration?.placement === 'house' && !decoration.outdoor ? undefined : decoration;
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

  /**
   * Rega automática da manhã, na virada do dia: o sorteio do clima (15% de chuva rega a lavoura toda, `systems/weather.ts`) e os
   * aspersores (`systems/sprinklers.ts`) já rodaram em `runDayTurn`; aqui só "varre" com respingos as plantações regadas pela chuva,
   * da esquerda pra direita — a água dos aspersores é outra (sprite sobre o terreno arado, `systems/sprinklerWater.ts`, tocado de manhã por
   * `playSprinklerMorning`). `startDelayMs` adia a animação pra depois do fade-in do sono.
   */
  private playDayTurnSplashes({ rained, sprayed }: DayTurn, startDelayMs = 0): void {
    if (rained.length > 0) console.log(`Está chovendo! ${rained.length} plantação(ões) regada(s) pela chuva.`);
    if (sprayed.length > 0) console.log(`Aspersores regaram ${sprayed.length} plantação(ões).`);
    if (rained.length === 0) return;

    rained
      .sort((a, b) => a.col - b.col || a.row - b.row)
      .forEach((plot, index) => {
        this.time.delayedCall(startDelayMs + index * RAIN_SWEEP_STEP_MS, () => this.farmlandRenderer.spawnWaterSplash(plot.col, plot.row));
      });
  }

  /** "Sair para o Menu Principal" (Pausa): salva e volta ao menu — ver `systems/sessionExit.ts`. */
  private exitToMainMenu(): void {
    exitToMainMenu(this);
  }

  /** Porta de casa: fade out e vai pro interior (`HouseScene`) — dormir é na cama de lá. */
  private enterHouse(): void {
    if (this.isEnteringHouse) return;
    // Com a horda em andamento (ou prestes a começar) não dá pra se esconder em casa: o jogador tem que defender a Fazenda.
    if (gameState.horde.active || shouldStartHorde()) {
      this.lockedMessage.show('A HORDA CHEGOU!', 'Não dá pra entrar em casa agora: defenda a Fazenda!');
      return;
    }
    this.isEnteringHouse = true;
    playEffect(this, DOOR_SOUND);
    this.cameras.main.fadeOut(HOUSE_FADE_MS, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(HOUSE_SCENE_KEY));
  }

  private isInputLocked(): boolean {
    return (
      isInventoryOpen() ||
      isCraftingMenuOpen() ||
      isLetterOpen() ||
      isDialogueOpen() ||
      isChestMenuOpen() ||
      this.isEnteringHouse ||
      this.pauseMenu.isOpen() ||
      this.shippingBinMenu.isOpen() ||
      this.shopMenu.isOpen()
    );
  }

  private setupDebugTimeSkip(): void {
    this.input.keyboard!.on('keydown-T', () => {
      const { dayTurn } = advanceWorldTime(DEBUG_TIME_SKIP_MS, true);
      if (dayTurn) {
        this.playDayTurnSplashes(dayTurn);
        this.farmResources.render(); // Novos estágios/brotos da virada de dia.
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
    if (!this.isEnteringHouse && !this.pauseMenu.isOpen()) this.petCompanion?.update(time, delta);
    if (!this.pauseMenu.isOpen()) this.eventManager.update(time, delta);
    if (isDialogueOpen()) this.dialogueSeenOpenAt = time;

    // Pedido explícito do usuário: árvores plantadas pelo jogador (bolota)
    // não ficavam semitransparentes ao personagem passar atrás delas,
    // porque só as árvores ESTÁTICAS do mapa (`this.trees`) entravam nessa
    // checagem — combina as duas fontes.
    updateTreeOverlap(this.player, this.farmResources.getTreeSprites());
    this.decorationPlacement.updateOcclusion();
    this.mailbox.update();
    this.debugGridOverlay.update(); // DEBUG TEMPORÁRIO — remover junto com `systems/debugGridOverlay.ts` quando não precisar mais.
    this.farmlandRenderer.renderAll(this.farmland);

    if (!this.isEnteringHouse && !this.pauseMenu.isOpen()) {
      const { dayTurn } = advanceWorldTime(delta, true);
      if (dayTurn) {
        this.playDayTurnSplashes(dayTurn);
        this.farmResources.render(); // Novos estágios/brotos da virada de dia.
        console.log(`Dia ${this.gameClock.getDay()} começou.`);
        // Faixa de novo dia (como o Stardew): número do dia + o clima de hoje.
        const { title, subtitle } = describeNewDay();
        this.lockedMessage.show(title, subtitle);
      }
      if (!isLetterOpen()) this.hordeDirector.update(time, delta);
      this.butterflies.update(delta);
      this.playSprinklerMorning();
      this.playRoosterMorning();
    }
    
    this.dayNightOverlay.setNightAlpha(this.gameClock.getNightAlpha());
    this.worldBlur.setActive(this.isInputLocked());

    if (this.shopMenu.isOpen()) this.shopMenu.refresh(this.inventory.getCoins());
  }
}