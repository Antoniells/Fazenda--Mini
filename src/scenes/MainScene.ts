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
  SHIPPING_BIN_KEY,
  SHIPPING_BIN_PATH,
  SHOP_STAND_KEY,
  SHOP_STAND_PATH,
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
import { DECORATIONS, WELL } from '../data/decorations';
import { INVENTORY_UI_KEY, INVENTORY_UI_PATH, COIN_ICON_KEY, COIN_ICON_PATH, COIN_ICON_FRAME_SIZE } from '../data/ui';
import { SHADOW_KEY, SHADOW_PATH, SPLASH_KEY, SPLASH_PATH, SPLASH_FRAME_SIZE } from '../data/effects';
import { buildFarmGround, buildFarmFence, buildFarmDecorations, buildShippingBin, buildShopStand, DISPLAY_SCALE } from '../systems/mapBuilder';
import { buildWalkableGrid } from '../systems/grid';
import { updateTreeOverlap } from '../systems/treeOverlap';
import { Player } from '../entities/Player';
import { PlayerController } from '../systems/playerController';
import { Farmland } from '../systems/farmland';
import { FarmlandRenderer } from '../systems/farmlandRenderer';
import { Inventory } from '../systems/inventory';
import { InteractionRegistry } from '../systems/interaction';
import { registerFarmlandInteractables } from '../systems/farmlandInteraction';
import { registerShippingBinInteractable } from '../systems/shippingBinInteraction';
import { registerShopInteractable } from '../systems/shopInteraction';
import { TileCursor } from '../systems/tileCursor';
import { DecorationPlacementSystem } from '../systems/decorationPlacement';
import { SeedBar } from '../ui/seedBar';
import { CoinBar } from '../ui/coinBar';
import { ShopMenu, ShopItem } from '../ui/shopMenu';

/**
 * Cena principal: monta a propriedade da fazenda (Fase 2), o personagem
 * jogável com movimentação/clique/pathfinding (Fase 3), a agricultura —
 * terrenos cultiváveis, arar, plantar, crescimento, regar e colher (Fase 4)
 * — a economia: moedas, venda na Caixa de Remessas e compra na Loja (Fase
 * 5) — e construções/decoração posicionáveis livremente (Fase 6).
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
  private coinBar!: CoinBar;
  private shopMenu!: ShopMenu;
  private decorationPlacement!: DecorationPlacementSystem;

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
    this.load.spritesheet(COIN_ICON_KEY, encodeURI(`/${COIN_ICON_PATH}`), {
      frameWidth: COIN_ICON_FRAME_SIZE,
      frameHeight: COIN_ICON_FRAME_SIZE,
    });

    this.load.image(SHIPPING_BIN_KEY, encodeURI(`/${SHIPPING_BIN_PATH}`));
    this.load.image(SHOP_STAND_KEY, encodeURI(`/${SHOP_STAND_PATH}`));

    this.load.image(SHADOW_KEY, encodeURI(`/${SHADOW_PATH}`));
    this.load.spritesheet(SPLASH_KEY, encodeURI(`/${SPLASH_PATH}`), {
      frameWidth: SPLASH_FRAME_SIZE,
      frameHeight: SPLASH_FRAME_SIZE,
    });

    for (const decoration of Object.values(DECORATIONS)) {
      this.load.image(decoration.textureKey, encodeURI(`/${decoration.texturePath}`));
    }
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

    buildFarmGround(this, farmMap);
    buildFarmFence(this, farmMap);
    this.trees = buildFarmDecorations(this, farmMap);
    const shippingBin = buildShippingBin(this, farmMap);
    buildShopStand(this, farmMap);

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
    registerShippingBinInteractable(
      this,
      shippingBin,
      farmMap.shippingBinPosition[0],
      farmMap.shippingBinPosition[1],
      this.inventory,
      this.player,
      interactions,
    );

    // A Loja vende sementes e decorações no mesmo painel — CropDefinition e
    // DecorationDefinition são formas diferentes na origem, então cada uma
    // é adaptada para o formato mínimo que o ShopMenu entende (`ShopItem`).
    const shopItems: ShopItem[] = [
      ...Object.values(CROPS).map((crop) => ({
        id: crop.id,
        textureKey: crop.textureKey,
        iconFrame: crop.iconFrame,
        price: crop.seedPrice,
      })),
      ...Object.values(DECORATIONS).map((decoration) => ({
        id: decoration.id,
        textureKey: decoration.textureKey,
        iconFrame: decoration.frameName,
        price: decoration.price,
      })),
    ];
    this.shopMenu = new ShopMenu(this, shopItems, (itemId) => this.buyShopItem(itemId));
    registerShopInteractable(this.shopMenu, farmMap.shopPosition[0], farmMap.shopPosition[1], this.player, interactions);

    this.decorationPlacement = new DecorationPlacementSystem(
      this,
      farmMap,
      tilePx,
      grid,
      this.inventory,
      interactions,
      this.player,
      WELL,
    );

    // Fica registrado nos listeners de input da própria cena — não precisa
    // ser guardado como campo, só criado uma vez.
    new TileCursor(this, farmMap, tilePx);

    this.controller = new PlayerController(this, this.player, grid, tilePx, interactions);
    this.controller.setInputInterceptor(this.decorationPlacement);

    this.input.keyboard!.on('keydown-B', () => {
      if (this.shopMenu.isOpen()) this.shopMenu.close();
      this.decorationPlacement.toggle(WELL);
    });
    this.input.keyboard!.on('keydown-ESC', () => this.decorationPlacement.cancel());

    this.events.on('player-stepped', (col: number, row: number) => {
      // Sempre que o player pisar em uma nova célula, tenta animar a plantinha
      this.farmlandRenderer.rustleCrop(col, row);
      // Andar embora fecha a loja, igual a afastar-se de um balcão — evita
      // deixar o painel aberto "preso" na tela enquanto o jogador vagueia.
      if (this.shopMenu.isOpen()) this.shopMenu.close();
    });

    this.seedBar = new SeedBar(this, Object.values(CROPS), (cropId) => this.selectSeed(cropId));
    this.seedBar.refresh(this.inventory.getSelectedSeedId());
    this.seedBar.refreshStock((cropId) => this.inventory.getSeedCount(cropId));

    this.coinBar = new CoinBar(this);
    this.coinBar.refresh(this.inventory.getCoins());

    this.setupSeedSelection();
    this.setupDebugTimeSkip();
  }

  /**
   * Roteia a compra de um slot da Loja: sementes e decorações vêm de
   * fontes de dados diferentes (`CROPS`/`DECORATIONS`), então cada uma tem
   * sua própria checagem de preço/estoque — este método só decide qual
   * das duas o `itemId` clicado é.
   */
  private buyShopItem(itemId: string): void {
    if (CROPS[itemId]) this.buySeed(itemId);
    else if (DECORATIONS[itemId]) this.buyDecoration(itemId);

    this.shopMenu.refresh(this.inventory.getCoins());
  }

  /** Tenta comprar 1 semente da cultura. */
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

  /** Tenta comprar 1 unidade de uma decoração/construção. */
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

  /** Troca a semente ativa (chamado pelas teclas 1/2/3 e pelo clique na barra de sementes). */
  private selectSeed(cropId: string): void {
    if (this.inventory.selectSeed(cropId)) {
      console.log(`Semente selecionada: ${CROPS[cropId].name}`);
      this.seedBar.refresh(cropId);
    }
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
        if (cropId) this.selectSeed(cropId);
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
    this.decorationPlacement.updateOcclusion();

    this.farmland.update(delta);
    this.farmlandRenderer.renderAll(this.farmland);

    // Atualiza a cada frame em vez de só onde `coins`/estoque de sementes
    // mudam (venda na Caixa de Remessas, compra na Loja, plantio) — evita
    // depender de lembrar de sincronizar a UI em cada lugar que mexer
    // nesses valores. Barato: CoinBar e SeedBar só redesenham texto quando
    // o valor muda de fato.
    this.coinBar.refresh(this.inventory.getCoins());
    this.seedBar.refreshStock((cropId) => this.inventory.getSeedCount(cropId));

    // A Loja só precisa refletir o saldo enquanto está aberta (o jogador
    // não pode estar em dois lugares ao mesmo tempo, então nada muda o
    // saldo enquanto ela está fechada).
    if (this.shopMenu.isOpen()) this.shopMenu.refresh(this.inventory.getCoins());
  }
}
