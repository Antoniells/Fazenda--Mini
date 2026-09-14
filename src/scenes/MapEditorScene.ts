import Phaser from 'phaser';
import {
  TILE_SIZE,
  GRASS_TILESET_KEY,
  GRASS_TILESET_PATH,
  GRASS_FLAT_TILE_INDEX,
  FENCE_TILESET_KEY,
  FENCE_TILESET_PATH,
  FENCE_EDGE_H_INDEX,
  PINE_TREE_KEY,
  PINE_TREE_PATH,
  PINE_TREE_FRAME_NAME,
  PINE_TREE_FRAME,
  SHIPPING_BIN_KEY,
  SHIPPING_BIN_PATH,
  SHIPPING_BIN_FRAME_NAME,
  SHIPPING_BIN_FRAME,
  SHOP_STAND_KEY,
  SHOP_STAND_PATH,
  SOIL_TILESET_KEY,
  SOIL_TILESET_PATH,
  SOIL_DRY_AUTOTILE,
} from '../data/tiles';
import { WELL } from '../data/decorations';
import { EXTRAS_UI_KEY, EXTRAS_UI_PATH, GLOBAL_CURSOR_CORNER_NAMES, GLOBAL_CURSOR_CORNER_RECTS } from '../data/ui';
import { computeFitScale } from '../ui/slotIcon';
import { exportFarmMapData } from '../systems/mapEditorExport';

/** Escala de exibição — igual ao jogo (`mapBuilder.DISPLAY_SCALE`), pra que as coordenadas exportadas batam 1:1 com `farmMap.ts`. */
const EDITOR_SCALE = 2;
const TILE_PX = TILE_SIZE * EDITOR_SCALE;
/** Espaço de edição visível (Fase "Ferramenta de Level Design") — bem maior que o núcleo atual (40x30), com margem pra crescer. */
const GRID_COLS = 50;
const GRID_ROWS = 50;
/** Velocidade do pan da câmera livre (px de mundo por segundo). */
const CAMERA_PAN_SPEED = 500;

/** Um objeto por célula (mutuamente exclusivos — pintar um substitui o que houver). "Grama" não entra aqui: é a ausência de objeto. */
type ObjectType = 'fence' | 'tree' | 'well' | 'shop' | 'shippingBin';
/** Ferramentas da paleta: os 5 tipos de objeto, mais "grama" (apaga o objeto da célula) e "farmland" (camada independente, ver `farmlandArea`). */
type ToolId = ObjectType | 'grass' | 'farmland';

/** `shop`/`shippingBin` só podem existir em UMA célula por vez, igual a `FarmMapData.shopPosition`/`shippingBinPosition` (posição única, não lista). */
const SINGLETON_TYPES: ReadonlySet<ObjectType> = new Set(['shop', 'shippingBin']);

interface ToolDef {
  id: ToolId;
  label: string;
  textureKey: string;
  frame: string | number;
}

/**
 * `MapEditorScene` — ferramenta de desenvolvimento (Level Design), não uma
 * cena de jogo: sem física, colisão, HUD de jogo ou personagem. Roda no
 * lugar da `MainScene` (trocar a ordem em `config/gameConfig.ts`) só
 * enquanto o mapa está sendo desenhado; o resultado é exportado como texto
 * (tecla P) pra colar em `data/maps/farmMap.ts`.
 *
 * Arquitetura: duas camadas independentes por célula —
 * - `objects` (grama/cerca/árvore/poço/loja/caixa de remessas):
 *   mutuamente exclusivos, "grama" é só a ausência de objeto.
 * - `farmland` (terra arável): um Set independente de células, igual a
 *   `FarmMapData.farmlandArea` — pode coexistir com um objeto na mesma
 *   célula (o jogo real nunca sobrepõe os dois, mas o editor não impede,
 *   pra não complicar a ferramenta com uma regra que o usuário não pediu).
 *
 * Todo ícone (paleta e objetos desenhados no grid) vem de assets reais já
 * usados pelo jogo (`data/tiles.ts`/`data/decorations.ts`) — só o grid de
 * fundo usa `Phaser.GameObjects.Grid` (pedido explícito do usuário), que é
 * uma grade utilitária de linhas, não arte do mundo do jogo.
 */
export class MapEditorScene extends Phaser.Scene {
  private objects = new Map<string, ObjectType>();
  private objectViews = new Map<string, Phaser.GameObjects.Image>();
  private farmland = new Set<string>();
  private farmlandViews = new Map<string, Phaser.GameObjects.Image>();

  private tools: ToolDef[] = [];
  private selectedTool: ToolId = 'grass';
  private paletteIcons = new Map<ToolId, Phaser.GameObjects.Image>();

  private isPaintingLeft = false;
  private isPaintingRight = false;
  private lastPaintedKey: string | null = null;

  private hoverCorners!: Record<keyof typeof GLOBAL_CURSOR_CORNER_NAMES, Phaser.GameObjects.Image>;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { up: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key; left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key };

  constructor() {
    super('MapEditorScene');
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
    this.load.image(SHIPPING_BIN_KEY, encodeURI(`/${SHIPPING_BIN_PATH}`));
    this.load.image(SHOP_STAND_KEY, encodeURI(`/${SHOP_STAND_PATH}`));
    this.load.image(WELL.textureKey, encodeURI(`/${WELL.texturePath}`));
    this.load.image(EXTRAS_UI_KEY, encodeURI(`/${EXTRAS_UI_PATH}`));
  }

  create(): void {
    this.registerFrames();
    this.buildTools();

    this.drawGrid();
    this.setupCamera();
    this.setupPalette();
    this.setupHoverCursor();
    this.setupPaintInput();
    this.setupExportShortcut();
  }

  update(_time: number, delta: number): void {
    this.panCamera(delta);
  }

  // --- Setup -----------------------------------------------------------

  /** Recorta os frames únicos usados aqui, exatamente como `MainScene.create` faz para o jogo de verdade. */
  private registerFrames(): void {
    const pineTexture = this.textures.get(PINE_TREE_KEY);
    if (!pineTexture.has(PINE_TREE_FRAME_NAME)) {
      pineTexture.add(PINE_TREE_FRAME_NAME, 0, PINE_TREE_FRAME.x, PINE_TREE_FRAME.y, PINE_TREE_FRAME.width, PINE_TREE_FRAME.height);
    }

    const binTexture = this.textures.get(SHIPPING_BIN_KEY);
    if (!binTexture.has(SHIPPING_BIN_FRAME_NAME)) {
      binTexture.add(SHIPPING_BIN_FRAME_NAME, 0, SHIPPING_BIN_FRAME.x, SHIPPING_BIN_FRAME.y, SHIPPING_BIN_FRAME.width, SHIPPING_BIN_FRAME.height);
    }

    const wellTexture = this.textures.get(WELL.textureKey);
    if (!wellTexture.has(WELL.frameName)) {
      wellTexture.add(WELL.frameName, 0, WELL.frameRect.x, WELL.frameRect.y, WELL.frameRect.width, WELL.frameRect.height);
    }

    const grassTexture = this.textures.get(GRASS_TILESET_KEY);
    if (!grassTexture.has('editor-grass-flat')) {
      const cols = 24; // largura real do spritesheet (384px / 16px) — mesma conta de `data/tiles.ts`.
      const col = GRASS_FLAT_TILE_INDEX % cols;
      const row = Math.floor(GRASS_FLAT_TILE_INDEX / cols);
      grassTexture.add('editor-grass-flat', 0, col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }

  private buildTools(): void {
    this.tools = [
      { id: 'grass', label: 'Grama', textureKey: GRASS_TILESET_KEY, frame: 'editor-grass-flat' },
      { id: 'fence', label: 'Cerca', textureKey: FENCE_TILESET_KEY, frame: FENCE_EDGE_H_INDEX },
      { id: 'tree', label: 'Árvore', textureKey: PINE_TREE_KEY, frame: PINE_TREE_FRAME_NAME },
      { id: 'well', label: 'Poço', textureKey: WELL.textureKey, frame: WELL.frameName },
      { id: 'shop', label: 'Loja', textureKey: SHOP_STAND_KEY, frame: 0 },
      { id: 'shippingBin', label: 'Caixa de Remessas', textureKey: SHIPPING_BIN_KEY, frame: SHIPPING_BIN_FRAME_NAME },
      { id: 'farmland', label: 'Terra Arável', textureKey: SOIL_TILESET_KEY, frame: SOIL_DRY_AUTOTILE.center },
    ];
  }

  /** Grade utilitária de fundo (não é arte do mundo do jogo, ver comentário da classe). */
  private drawGrid(): void {
    const width = GRID_COLS * TILE_PX;
    const height = GRID_ROWS * TILE_PX;

    const grid = this.add.grid(0, 0, width, height, TILE_PX, TILE_PX, 0x3a5f3a, 0.25, 0xffffff, 0.15);
    grid.setOrigin(0, 0);
    grid.setDepth(-10);
  }

  private setupCamera(): void {
    const cam = this.cameras.main;
    cam.setBackgroundColor('#1e1e1e');
    // Sem `setBounds`/`startFollow`: câmera totalmente livre, controlada só pelo teclado (ver `panCamera`).
    cam.centerOn((GRID_COLS * TILE_PX) / 2, (GRID_ROWS * TILE_PX) / 2);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    }) as typeof this.wasd;
  }

  private panCamera(delta: number): void {
    const distance = (CAMERA_PAN_SPEED * delta) / 1000;
    const cam = this.cameras.main;

    const left = this.cursors.left.isDown || this.wasd.left.isDown;
    const right = this.cursors.right.isDown || this.wasd.right.isDown;
    const up = this.cursors.up.isDown || this.wasd.up.isDown;
    const down = this.cursors.down.isDown || this.wasd.down.isDown;

    if (left) cam.scrollX -= distance;
    if (right) cam.scrollX += distance;
    if (up) cam.scrollY -= distance;
    if (down) cam.scrollY += distance;
  }

  // --- Paleta ------------------------------------------------------------

  private setupPalette(): void {
    const startY = 40;
    const rowHeight = 44;
    const iconX = 34;
    const targetIconPx = 28;

    this.tools.forEach((tool, index) => {
      const y = startY + index * rowHeight;

      const icon = this.add.image(iconX, y, tool.textureKey, tool.frame);
      icon.setScrollFactor(0);
      icon.setDepth(2001);
      icon.setScale(computeFitScale(icon, targetIconPx));
      this.paletteIcons.set(tool.id, icon);

      const label = this.add.text(iconX + 26, y, tool.label, {
        fontFamily: 'monospace',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
      });
      label.setOrigin(0, 0.5);
      label.setScrollFactor(0);
      label.setDepth(2001);

      const hitZone = this.add.zone(0, y, 220, rowHeight);
      hitZone.setOrigin(0, 0.5);
      hitZone.setScrollFactor(0);
      hitZone.setDepth(2000);
      hitZone.setInteractive({ useHandCursor: true });
      hitZone.on('pointerdown', (_pointer: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        this.selectTool(tool.id);
      });
    });

    this.selectTool(this.selectedTool);
  }

  private selectTool(id: ToolId): void {
    this.selectedTool = id;
    for (const [toolId, icon] of this.paletteIcons) {
      const isSelected = toolId === id;
      icon.setAlpha(isSelected ? 1 : 0.55);
      icon.setTint(isSelected ? 0xffffff : 0xaaaaaa);
    }
  }

  // --- Cursor de destaque na célula sob o mouse ---------------------------

  private setupHoverCursor(): void {
    const texture = this.textures.get(EXTRAS_UI_KEY);
    for (const key of Object.keys(GLOBAL_CURSOR_CORNER_NAMES) as Array<keyof typeof GLOBAL_CURSOR_CORNER_NAMES>) {
      const name = GLOBAL_CURSOR_CORNER_NAMES[key];
      if (!texture.has(name)) {
        const rect = GLOBAL_CURSOR_CORNER_RECTS[key];
        texture.add(name, 0, rect.x, rect.y, rect.width, rect.height);
      }
    }

    const makeCorner = (key: keyof typeof GLOBAL_CURSOR_CORNER_NAMES, originX: number, originY: number) => {
      const corner = this.add.image(0, 0, EXTRAS_UI_KEY, GLOBAL_CURSOR_CORNER_NAMES[key]);
      corner.setOrigin(originX, originY);
      corner.setDepth(-1);
      return corner;
    };

    this.hoverCorners = {
      topLeft: makeCorner('topLeft', 0, 0),
      topRight: makeCorner('topRight', 1, 0),
      bottomLeft: makeCorner('bottomLeft', 0, 1),
      bottomRight: makeCorner('bottomRight', 1, 1),
    };

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const { col, row } = this.pointerToCell(pointer);
      if (!this.inBounds(col, row)) return;

      const left = col * TILE_PX;
      const top = row * TILE_PX;
      const right = left + TILE_PX;
      const bottom = top + TILE_PX;

      this.hoverCorners.topLeft.setPosition(left, top);
      this.hoverCorners.topRight.setPosition(right, top);
      this.hoverCorners.bottomLeft.setPosition(left, bottom);
      this.hoverCorners.bottomRight.setPosition(right, bottom);
    });
  }

  // --- Pintura -------------------------------------------------------------

  private setupPaintInput(): void {
    this.input.mouse?.disableContextMenu();

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown()) this.isPaintingLeft = true;
      if (pointer.rightButtonDown()) this.isPaintingRight = true;
      this.lastPaintedKey = null;
      this.applyPointerAction(pointer);
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isPaintingLeft || this.isPaintingRight) this.applyPointerAction(pointer);
    });

    this.input.on('pointerup', () => {
      this.isPaintingLeft = false;
      this.isPaintingRight = false;
      this.lastPaintedKey = null;
    });
  }

  private applyPointerAction(pointer: Phaser.Input.Pointer): void {
    const { col, row } = this.pointerToCell(pointer);
    if (!this.inBounds(col, row)) return;

    const key = `${col},${row}`;
    if (key === this.lastPaintedKey) return;
    this.lastPaintedKey = key;

    if (this.isPaintingLeft) this.paintAt(col, row);
    else if (this.isPaintingRight) this.eraseAt(col, row);
  }

  private paintAt(col: number, row: number): void {
    if (this.selectedTool === 'grass') {
      this.clearObjectAt(col, row);
    } else if (this.selectedTool === 'farmland') {
      this.setFarmlandAt(col, row, true);
    } else {
      this.setObjectAt(col, row, this.selectedTool);
    }
  }

  private eraseAt(col: number, row: number): void {
    this.clearObjectAt(col, row);
    this.setFarmlandAt(col, row, false);
  }

  private setObjectAt(col: number, row: number, type: ObjectType): void {
    const key = `${col},${row}`;

    // Loja/Caixa de Remessas: só uma célula por vez (`FarmMapData` guarda posição única, não lista).
    if (SINGLETON_TYPES.has(type)) {
      for (const [existingKey, existingType] of this.objects) {
        if (existingType === type && existingKey !== key) {
          this.objects.delete(existingKey);
          this.objectViews.get(existingKey)?.destroy();
          this.objectViews.delete(existingKey);
        }
      }
    }

    this.objectViews.get(key)?.destroy();
    this.objects.set(key, type);

    const tool = this.tools.find((t) => t.id === type)!;
    const x = col * TILE_PX + TILE_PX / 2;
    const y = row * TILE_PX + TILE_PX / 2;
    const view = this.add.image(x, y, tool.textureKey, tool.frame);
    // Objetos maiores que 1 tile (Poço, Loja) são só um preview centralizado
    // na célula — o editor não simula footprint/colisão (pedido explícito
    // do usuário), então não há necessidade de recortar ou reescalar por tipo.
    view.setScale(EDITOR_SCALE);
    view.setDepth(1);
    this.objectViews.set(key, view);
  }

  private clearObjectAt(col: number, row: number): void {
    const key = `${col},${row}`;
    if (!this.objects.has(key)) return;
    this.objects.delete(key);
    this.objectViews.get(key)?.destroy();
    this.objectViews.delete(key);
  }

  private setFarmlandAt(col: number, row: number, on: boolean): void {
    const key = `${col},${row}`;

    if (on) {
      if (this.farmland.has(key)) return;
      this.farmland.add(key);
      const x = col * TILE_PX + TILE_PX / 2;
      const y = row * TILE_PX + TILE_PX / 2;
      const view = this.add.image(x, y, SOIL_TILESET_KEY, SOIL_DRY_AUTOTILE.center);
      view.setScale(EDITOR_SCALE);
      view.setDepth(0);
      this.farmlandViews.set(key, view);
    } else {
      if (!this.farmland.has(key)) return;
      this.farmland.delete(key);
      this.farmlandViews.get(key)?.destroy();
      this.farmlandViews.delete(key);
    }
  }

  // --- Exportação ----------------------------------------------------------

  private setupExportShortcut(): void {
    this.input.keyboard!.on('keydown-P', () => this.exportMap());
  }

  private exportMap(): void {
    const treePositions: Array<[number, number]> = [];
    const fencePositions: Array<[number, number]> = [];
    let shopPosition: [number, number] | null = null;
    let shippingBinPosition: [number, number] | null = null;

    for (const [key, type] of this.objects) {
      const [col, row] = key.split(',').map(Number);
      if (type === 'tree') treePositions.push([col, row]);
      else if (type === 'fence') fencePositions.push([col, row]);
      else if (type === 'shop') shopPosition = [col, row];
      else if (type === 'shippingBin') shippingBinPosition = [col, row];
      // 'well' não é exportado: não existe campo de posição fixa em
      // `FarmMapData` pra decorações (elas nascem do inventário/loja em
      // jogo, ver `data/decorations.ts`) — fora do escopo desta ferramenta.
    }

    const farmlandArea: Array<[number, number]> = Array.from(this.farmland).map((key) => {
      const [col, row] = key.split(',').map(Number);
      return [col, row] as [number, number];
    });

    const text = exportFarmMapData({
      cols: GRID_COLS,
      rows: GRID_ROWS,
      treePositions,
      farmlandArea,
      fencePositions,
      shopPosition,
      shippingBinPosition,
    });

    // eslint-disable-next-line no-console
    console.log(text);
  }

  // --- Utilidades -----------------------------------------------------------

  private pointerToCell(pointer: Phaser.Input.Pointer): { col: number; row: number } {
    return {
      col: Math.floor(pointer.worldX / TILE_PX),
      row: Math.floor(pointer.worldY / TILE_PX),
    };
  }

  private inBounds(col: number, row: number): boolean {
    return col >= 0 && row >= 0 && col < GRID_COLS && row < GRID_ROWS;
  }
}
