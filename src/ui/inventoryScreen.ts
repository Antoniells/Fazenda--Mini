import Phaser from 'phaser';
import { Inventory, HOTBAR_SIZE, INVENTORY_SIZE } from '../systems/inventory';
import { resolveSlotVisual } from '../data/items';
import { CROPS, ALL_CROPS_ICONS_KEY } from '../data/crops';
import {
  INVENTORY_PANEL_KEY,
  INVENTORY_SLOT_FRAME_NAME,
  INVENTORY_SLOT_RECT,
  SHOP_BOOK_KEY,
  SHOP_BOOK_FRAME_NAME,
  SHOP_TAB_RIBBONS_KEY,
  TAB_FRAME_TOOLS,
  TAB_FRAME_TOOLS_LIGHT,
  TAB_FRAME_AGRICULTURE,
  TAB_FRAME_AGRICULTURE_LIGHT,
  TAB_FRAME_CONSTRUCTION,
  TAB_FRAME_CONSTRUCTION_LIGHT,
  CLOSE_TAB_BG_FRAME,
  CLOSE_BUTTON_SHEET_KEY,
  CLOSE_X_ICON_FRAME,
  EXTRAS_UI_KEY,
  GLOBAL_CURSOR_CORNER_NAMES,
  GLOBAL_CURSOR_CORNER_RECTS,
  BACKPACK_ICON_KEY,
  BACKPACK_ICON_FRAME,
  FISHING_ROD_ICON_KEY,
  FISHING_ROD_ICON_FRAME,
} from '../data/ui';
import { computeFitScale } from './slotIcon';
import { PointerInputInterceptor } from '../systems/playerController';

type CornerKey = keyof typeof GLOBAL_CURSOR_CORNER_NAMES;

/**
 * Mesmas constantes de geometria/estilo do `ShopMenu` (Fase 8), copiadas de
 * propósito — pedido explícito do usuário ("exatamente o mesmo layout e
 * lógica"). Duplicadas em vez de compartilhadas: o `ShopMenu` já está
 * testado e em uso (comprar), e as duas telas nunca ficam abertas ao mesmo
 * tempo, então uma classe irmã própria evita arriscar uma refatoração no
 * código da Loja só para servir o Inventário.
 */
const BOOK_SCALE = 2.2;
const SLOT_SCALE = 1.7;
const SLOT_GAP = 5;
const ROW_GAP = 16;
/** Cada página do livro comporta um grid de 6 colunas x 4 linhas. */
const GRID_COLS = 6;
const GRID_ROWS = 4;
const ITEMS_PER_PAGE = GRID_COLS * GRID_ROWS;
/** Fração da célula (16px nativos) que um ícone "normal" (16x16) preenche. */
const ICON_FILL_RATIO = 0.8;
const ICON_TARGET_PX = 16 * SLOT_SCALE * ICON_FILL_RATIO;
/** Realce do slot da Hotbar atualmente selecionado, na aba Mochila (mesmo tom já usado antes desta reformulação). */
const SELECTED_HOTBAR_TINT = 0xffe9b3;
const UNSELECTED_TINT = 0xffffff;

const TAB_SCALE = 2.0;
const TAB_ROTATION = Math.PI / 2;
const TAB_RIBBON_NATIVE_THICKNESS = 18;
const TAB_DISPLAY_THICKNESS = TAB_RIBBON_NATIVE_THICKNESS * TAB_SCALE;
const TAB_GAP_Y = 8;
const TAB_BOOK_OVERLAP = 4;
const TAB_ICON_TARGET_PX = 28;
const TAB_ICON_OFFSET_X = 2;
const TAB_ICON_OFFSET_Y = -18;

const TAB_SELECTOR_SCALE = 1.5;
const TAB_SELECTOR_PADDING = 2;

const CLOSE_MARK_SCALE = 1.8;
const CLOSE_BOOK_OVERLAP = 30;
const CLOSE_X_TARGET_PX = 22;
const CLOSE_X_OFFSET_X = CLOSE_BOOK_OVERLAP + (CLOSE_TAB_BG_FRAME.rect.width * CLOSE_MARK_SCALE - CLOSE_BOOK_OVERLAP) / 2;

/** Área de papel em branco de cada página — ver comentário idêntico em `ShopMenu`. */
const PAGE_RECT = {
  left: { x: 14, width: 100 },
  right: { x: 124, width: 96 },
  top: 4,
  height: 119,
};

/** As 3 abas do Inventário (pedido explícito): Mochila (equipáveis, com seleção de Hotbar), Pesca (ainda sem mecânica) e Agricultura (colheita, só visualização). */
export type InventoryTabCategory = 'backpack' | 'fishing' | 'agriculture';

interface InventoryTabDefinition {
  category: InventoryTabCategory;
  textureKey: string;
  iconFrame: number | string;
  tabFrame: string;
  tabFrameLight: string;
}

/** Reaproveita as fitas de cor já usadas na Loja (`data/ui.ts`) — verde combina com o sentido real da aba Agricultura; azul/laranja ficam livres para Mochila/Pesca (as duas telas nunca abrem juntas, então não há conflito de identidade visual). */
const TAB_DEFS: InventoryTabDefinition[] = [
  {
    category: 'backpack',
    textureKey: BACKPACK_ICON_KEY,
    iconFrame: BACKPACK_ICON_FRAME.name,
    tabFrame: TAB_FRAME_TOOLS.name,
    tabFrameLight: TAB_FRAME_TOOLS_LIGHT.name,
  },
  {
    category: 'fishing',
    textureKey: FISHING_ROD_ICON_KEY,
    iconFrame: FISHING_ROD_ICON_FRAME.name,
    tabFrame: TAB_FRAME_CONSTRUCTION.name,
    tabFrameLight: TAB_FRAME_CONSTRUCTION_LIGHT.name,
  },
  {
    category: 'agriculture',
    textureKey: ALL_CROPS_ICONS_KEY,
    iconFrame: Object.values(CROPS)[0]?.iconFrameName ?? '',
    tabFrame: TAB_FRAME_AGRICULTURE.name,
    tabFrameLight: TAB_FRAME_AGRICULTURE_LIGHT.name,
  },
];

interface InventoryTab {
  category: InventoryTabCategory;
  background: Phaser.GameObjects.Image;
  icon: Phaser.GameObjects.Image;
  baseX: number;
  y: number;
}

interface InventorySlot {
  frame: Phaser.GameObjects.Image;
  icon: Phaser.GameObjects.Image;
  badgeText: Phaser.GameObjects.Text;
  onClick: (() => void) | null;
}

/** O que um slot do grid mostra, resolvido a partir do `Inventory`/`CROPS` — ver `computeContent`. */
interface InventorySlotContent {
  textureKey: string;
  iconFrame: number | string;
  badge: string;
  tint: number;
  onClick: (() => void) | null;
}

/**
 * Tela de Inventário (Fase 8, tecla E), reformulada para usar exatamente o
 * mesmo layout/lógica visual do `ShopMenu` (pedido explícito): fundo do
 * Livro, abas rotacionadas na lateral esquerda com hover, seletor branco de
 * canto na aba ativa e botão de fechar (marcador de couro + X) na direita.
 *
 * 3 abas: Mochila (os 24 slots físicos de `Inventory` — ferramentas,
 * sementes, decorações e materiais coletados; clicar num dos 8 primeiros
 * troca o slot ativo da Hotbar, mesma regra de antes desta reformulação),
 * Pesca (placeholder "Em breve" — sem mecânica de pesca ainda) e Agricultura
 * (visão só-leitura da colheita: `CROPS` + `inventory.getCount(cropId)`, em
 * vez de depender de um slot físico — corrige o bug relatado de colheitas
 * nunca aparecerem em lugar nenhum, já que `Farmland.harvest` nunca chama
 * `ensureSlotted`, diferente de sementes/decorações/materiais).
 *
 * Instanciada uma única vez pela `UIScene` (persistente entre cenas — ver
 * `scenes/UIScene.ts`), para poder abrir em qualquer mapa (Fazenda ou
 * externo), não só na Fazenda.
 */
export class InventoryScreen implements PointerInputInterceptor {
  private readonly book: Phaser.GameObjects.Image;
  private readonly tabs: InventoryTab[] = [];
  private readonly tabSelector: Record<CornerKey, Phaser.GameObjects.Image>;
  private readonly slots: InventorySlot[] = [];
  private readonly emptyText: Phaser.GameObjects.Text;
  private readonly closeButton: Phaser.GameObjects.Image;
  private readonly closeButtonMark: Phaser.GameObjects.Image;
  private activeCategory: InventoryTabCategory = 'backpack';
  private isOpen_ = false;

  constructor(scene: Phaser.Scene, private readonly onSelectHotbarSlot: (index: number) => void) {
    const panelTexture = scene.textures.get(INVENTORY_PANEL_KEY);
    if (!panelTexture.has(INVENTORY_SLOT_FRAME_NAME)) {
      panelTexture.add(
        INVENTORY_SLOT_FRAME_NAME,
        0,
        INVENTORY_SLOT_RECT.x,
        INVENTORY_SLOT_RECT.y,
        INVENTORY_SLOT_RECT.width,
        INVENTORY_SLOT_RECT.height,
      );
    }
    const backpackTexture = scene.textures.get(BACKPACK_ICON_KEY);
    if (!backpackTexture.has(BACKPACK_ICON_FRAME.name)) {
      const rect = BACKPACK_ICON_FRAME.rect;
      backpackTexture.add(BACKPACK_ICON_FRAME.name, 0, rect.x, rect.y, rect.width, rect.height);
    }
    const fishingRodTexture = scene.textures.get(FISHING_ROD_ICON_KEY);
    if (!fishingRodTexture.has(FISHING_ROD_ICON_FRAME.name)) {
      const rect = FISHING_ROD_ICON_FRAME.rect;
      fishingRodTexture.add(FISHING_ROD_ICON_FRAME.name, 0, rect.x, rect.y, rect.width, rect.height);
    }

    const centerX = scene.scale.width / 2;
    const centerY = scene.scale.height / 2;

    this.book = scene.add.image(centerX, centerY, SHOP_BOOK_KEY, SHOP_BOOK_FRAME_NAME);
    this.book.setOrigin(0.5, 0.5);
    this.book.setScale(BOOK_SCALE);
    this.book.setScrollFactor(0);
    this.book.setDepth(3000);

    const bookWidth = this.book.displayWidth;
    const bookHeight = this.book.displayHeight;
    const bookLeft = centerX - bookWidth / 2;
    const bookTop = centerY - bookHeight / 2;

    const tabX = bookLeft + TAB_BOOK_OVERLAP;
    const totalTabsHeight = TAB_DEFS.length * TAB_DISPLAY_THICKNESS + (TAB_DEFS.length - 1) * TAB_GAP_Y;
    let tabY = centerY - totalTabsHeight / 2 + TAB_DISPLAY_THICKNESS / 2;
    const tabDepth = this.book.depth + 1;

    for (const tabDef of TAB_DEFS) {
      const background = scene.add.image(tabX, tabY, SHOP_TAB_RIBBONS_KEY, tabDef.tabFrame);
      background.setOrigin(1, 0.5);
      background.setScale(TAB_SCALE);
      background.setRotation(TAB_ROTATION);
      background.setScrollFactor(0);
      background.setDepth(tabDepth);

      const icon = scene.add.image(tabX + TAB_ICON_OFFSET_X, tabY + TAB_ICON_OFFSET_Y, tabDef.textureKey, tabDef.iconFrame);
      icon.setOrigin(0.5, 0.5);
      icon.setScale(computeFitScale(icon, TAB_ICON_TARGET_PX));
      icon.setScrollFactor(0);
      icon.setDepth(tabDepth + 1);

      background.setInteractive({ useHandCursor: true });
      background.disableInteractive();
      background.on(
        'pointerdown',
        (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
          if (!this.isOpen_) return;
          event.stopPropagation();
          this.selectCategory(tabDef.category);
        },
      );
      background.on('pointerover', () => {
        if (!this.isOpen_) return;
        background.setTexture(SHOP_TAB_RIBBONS_KEY, tabDef.tabFrameLight);
      });
      background.on('pointerout', () => {
        if (!this.isOpen_) return;
        background.setTexture(SHOP_TAB_RIBBONS_KEY, tabDef.tabFrame);
      });

      this.tabs.push({ category: tabDef.category, background, icon, baseX: tabX, y: tabY });
      tabY += TAB_DISPLAY_THICKNESS + TAB_GAP_Y;
    }

    const cursorTexture = scene.textures.get(EXTRAS_UI_KEY);
    for (const key of Object.keys(GLOBAL_CURSOR_CORNER_NAMES) as CornerKey[]) {
      const name = GLOBAL_CURSOR_CORNER_NAMES[key];
      if (!cursorTexture.has(name)) {
        const rect = GLOBAL_CURSOR_CORNER_RECTS[key];
        cursorTexture.add(name, 0, rect.x, rect.y, rect.width, rect.height);
      }
    }
    const makeSelectorCorner = (key: CornerKey, originX: number, originY: number): Phaser.GameObjects.Image => {
      const corner = scene.add.image(0, 0, EXTRAS_UI_KEY, GLOBAL_CURSOR_CORNER_NAMES[key]);
      corner.setOrigin(originX, originY);
      corner.setScale(TAB_SELECTOR_SCALE);
      corner.setScrollFactor(0);
      corner.setDepth(tabDepth + 2);
      return corner;
    };
    this.tabSelector = {
      topLeft: makeSelectorCorner('topLeft', 0, 0),
      topRight: makeSelectorCorner('topRight', 1, 0),
      bottomLeft: makeSelectorCorner('bottomLeft', 0, 1),
      bottomRight: makeSelectorCorner('bottomRight', 1, 1),
    };

    const bookRight = bookLeft + bookWidth;
    const closeX = bookRight - CLOSE_BOOK_OVERLAP;
    const closeDepth = this.book.depth + 1;

    this.closeButton = scene.add.image(closeX, centerY, SHOP_BOOK_KEY, CLOSE_TAB_BG_FRAME.name);
    this.closeButton.setOrigin(0, 0.5);
    this.closeButton.setScale(CLOSE_MARK_SCALE);
    this.closeButton.setScrollFactor(0);
    this.closeButton.setDepth(closeDepth);
    this.closeButton.setInteractive({ useHandCursor: true });
    this.closeButton.disableInteractive();
    this.closeButton.on(
      'pointerdown',
      (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
        if (!this.isOpen_) return;
        event.stopPropagation();
        this.close();
      },
    );

    this.closeButtonMark = scene.add.image(closeX + CLOSE_X_OFFSET_X, centerY, CLOSE_BUTTON_SHEET_KEY, CLOSE_X_ICON_FRAME.name);
    this.closeButtonMark.setOrigin(0.5, 0.5);
    this.closeButtonMark.setScale(computeFitScale(this.closeButtonMark, CLOSE_X_TARGET_PX));
    this.closeButtonMark.setScrollFactor(0);
    this.closeButtonMark.setDepth(closeDepth + 1);

    const slotWidth = INVENTORY_SLOT_RECT.width * SLOT_SCALE;
    const slotHeight = INVENTORY_SLOT_RECT.height * SLOT_SCALE;
    const gridWidth = GRID_COLS * slotWidth + (GRID_COLS - 1) * SLOT_GAP;
    const gridHeight = GRID_ROWS * slotHeight + (GRID_ROWS - 1) * ROW_GAP;

    const pageTop = bookTop + PAGE_RECT.top * BOOK_SCALE;
    const pageHeight = PAGE_RECT.height * BOOK_SCALE;
    const startY = pageTop + (pageHeight - gridHeight) / 2 + slotHeight / 2;

    const leftPageWidth = PAGE_RECT.left.width * BOOK_SCALE;
    const rightPageWidth = PAGE_RECT.right.width * BOOK_SCALE;
    const leftStartX = bookLeft + PAGE_RECT.left.x * BOOK_SCALE + (leftPageWidth - gridWidth) / 2 + slotWidth / 2;
    const rightStartX = bookLeft + PAGE_RECT.right.x * BOOK_SCALE + (rightPageWidth - gridWidth) / 2 + slotWidth / 2;

    // Maior categoria é sempre a Mochila (24 slots físicos) — mesma fórmula
    // de dimensionamento do pool do `ShopMenu` (garante as 2 páginas cheias).
    const maxItemsPerCategory = Math.max(INVENTORY_SIZE, Object.keys(CROPS).length);
    const totalSlots = Math.max(ITEMS_PER_PAGE * 2, Math.ceil(maxItemsPerCategory / (ITEMS_PER_PAGE * 2)) * (ITEMS_PER_PAGE * 2));

    for (let index = 0; index < totalSlots; index++) {
      const page = Math.floor(index / ITEMS_PER_PAGE);
      const isLeftPage = page % 2 === 0;

      const indexInPage = index % ITEMS_PER_PAGE;
      const col = indexInPage % GRID_COLS;
      const row = Math.floor(indexInPage / GRID_COLS);

      const pageStartX = isLeftPage ? leftStartX : rightStartX;
      const x = pageStartX + col * (slotWidth + SLOT_GAP);
      const y = startY + row * (slotHeight + ROW_GAP);

      const frame = scene.add.image(x, y, INVENTORY_PANEL_KEY, INVENTORY_SLOT_FRAME_NAME);
      frame.setOrigin(0.5, 0.5);
      frame.setScale(SLOT_SCALE);
      frame.setScrollFactor(0);
      frame.setDepth(3001);

      frame.setInteractive({ useHandCursor: true });
      frame.disableInteractive();
      frame.on(
        'pointerdown',
        (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
          if (!this.isOpen_) return;
          event.stopPropagation();
          this.slots[index].onClick?.();
        },
      );

      const icon = scene.add.image(x, y, INVENTORY_PANEL_KEY, INVENTORY_SLOT_FRAME_NAME);
      icon.setOrigin(0.5, 0.5);
      icon.setScrollFactor(0);
      icon.setDepth(3002);

      const badgeText = scene.add.text(x + slotWidth / 2 - 2, y + slotHeight / 2 - 2, '', {
        fontFamily: 'monospace',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#2b1d0e',
        strokeThickness: 3,
      });
      badgeText.setOrigin(1, 1);
      badgeText.setScrollFactor(0);
      badgeText.setDepth(3002);

      this.slots.push({ frame, icon, badgeText, onClick: null });
    }

    this.emptyText = scene.add.text(centerX, centerY, 'Em breve', {
      fontFamily: 'monospace',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#6b5a4a',
    });
    this.emptyText.setOrigin(0.5, 0.5);
    this.emptyText.setScrollFactor(0);
    this.emptyText.setDepth(3002);

    this.setElementsVisible(false);
  }

  isOpen(): boolean {
    return this.isOpen_;
  }

  /** `PointerInputInterceptor`: enquanto aberta, os cliques nos slots já fazem `stopPropagation` — só existir já evita que o clique vaze para o mundo (mover/interagir). */
  isActive(): boolean {
    return this.isOpen_;
  }

  handleClick(): void {
    // Nada a fazer — ver `isActive()`.
  }

  open(inventory: Inventory): void {
    this.isOpen_ = true;
    this.setElementsVisible(true);
    this.renderActiveCategory(inventory);
  }

  close(): void {
    this.isOpen_ = false;
    this.setElementsVisible(false);
  }

  toggle(inventory: Inventory): void {
    if (this.isOpen_) this.close();
    else this.open(inventory);
  }

  /** Chamado a cada frame enquanto aberta (ver `UIScene.update`) — mantém a aba Mochila e o realce da Hotbar sempre em dia com o `Inventory` ao vivo. */
  refresh(inventory: Inventory): void {
    if (!this.isOpen_) return;
    this.renderActiveCategory(inventory);
  }

  private selectCategory(category: InventoryTabCategory): void {
    if (category === this.activeCategory) return;
    this.activeCategory = category;
  }

  /** Resolve o conteúdo (ícone/quantidade/clique) de cada slot da aba ativa — ver `InventorySlotContent`. */
  private computeContent(inventory: Inventory): InventorySlotContent[] {
    if (this.activeCategory === 'backpack') {
      const selectedIndex = inventory.getSelectedHotbarIndex();
      const content: InventorySlotContent[] = [];
      for (let index = 0; index < INVENTORY_SIZE; index++) {
        const ref = inventory.getSlot(index);
        const visual = ref ? resolveSlotVisual(ref) : null;
        const tint = index === selectedIndex ? SELECTED_HOTBAR_TINT : UNSELECTED_TINT;
        const onClick = index < HOTBAR_SIZE ? () => this.onSelectHotbarSlot(index) : null;

        if (!visual || !ref) {
          content.push({ textureKey: '', iconFrame: '', badge: '', tint, onClick });
          continue;
        }

        let badge = '';
        if (ref.category === 'seed') badge = String(inventory.getSeedCount(ref.id));
        else if (ref.category === 'decoration') badge = String(inventory.getDecorationCount(ref.id));
        else if (ref.category === 'resource') badge = String(inventory.getResourceCount(ref.id));

        content.push({ textureKey: visual.textureKey, iconFrame: visual.iconFrame, badge, tint, onClick });
      }
      return content;
    }

    if (this.activeCategory === 'agriculture') {
      return Object.values(CROPS).map((crop) => ({
        textureKey: ALL_CROPS_ICONS_KEY,
        iconFrame: crop.iconFrameName,
        badge: String(inventory.getCount(crop.id)),
        tint: UNSELECTED_TINT,
        onClick: null,
      }));
    }

    // 'fishing' — sem mecânica ainda, mostra só o texto "Em breve".
    return [];
  }

  /** Reposiciona as abas/seletor (fixo, sem "puxar" a ativa pra fora — só o seletor branco indica qual está ativa) e redesenha o grid com o conteúdo da categoria ativa. */
  private renderActiveCategory(inventory: Inventory): void {
    for (const tab of this.tabs) {
      tab.background.setPosition(tab.baseX, tab.y);
      tab.icon.setPosition(tab.baseX + TAB_ICON_OFFSET_X, tab.y + TAB_ICON_OFFSET_Y);
    }
    this.positionTabSelector();

    const content = this.computeContent(inventory);

    this.slots.forEach((slot, index) => {
      const entry: InventorySlotContent | undefined = content[index];
      slot.onClick = entry?.onClick ?? null;
      slot.frame.setTint(entry ? entry.tint : UNSELECTED_TINT);

      if (!entry || !entry.textureKey) {
        slot.icon.setVisible(false);
        slot.badgeText.setVisible(false);
        return;
      }

      slot.icon.setTexture(entry.textureKey, entry.iconFrame);
      slot.icon.setScale(computeFitScale(slot.icon, ICON_TARGET_PX));
      slot.icon.setVisible(true);
      slot.badgeText.setText(entry.badge);
      slot.badgeText.setVisible(!!entry.badge);
    });

    this.emptyText.setVisible(content.length === 0);
  }

  private positionTabSelector(): void {
    const activeTab = this.tabs.find((tab) => tab.category === this.activeCategory);
    if (!activeTab) return;

    const bounds = activeTab.background.getBounds();
    const left = bounds.left - TAB_SELECTOR_PADDING;
    const top = bounds.top - TAB_SELECTOR_PADDING;
    const right = bounds.right + TAB_SELECTOR_PADDING;
    const bottom = bounds.bottom + TAB_SELECTOR_PADDING;

    this.tabSelector.topLeft.setPosition(left, top);
    this.tabSelector.topRight.setPosition(right, top);
    this.tabSelector.bottomLeft.setPosition(left, bottom);
    this.tabSelector.bottomRight.setPosition(right, bottom);
  }

  private setElementsVisible(visible: boolean): void {
    this.book.setVisible(visible);
    for (const tab of this.tabs) {
      tab.background.setVisible(visible);
      tab.icon.setVisible(visible);
      if (visible) tab.background.setInteractive();
      else tab.background.disableInteractive();
    }
    for (const corner of Object.values(this.tabSelector)) corner.setVisible(visible);

    this.closeButton.setVisible(visible);
    if (visible) this.closeButton.setInteractive();
    else this.closeButton.disableInteractive();
    this.closeButtonMark.setVisible(visible);

    for (const slot of this.slots) {
      slot.frame.setVisible(visible);
      const slotVisible = visible && slot.icon.visible;
      slot.icon.setVisible(slotVisible);
      slot.badgeText.setVisible(visible && slot.badgeText.visible);

      if (visible && slot.onClick) slot.frame.setInteractive();
      else slot.frame.disableInteractive();
    }
    this.emptyText.setVisible(visible && this.emptyText.visible);
  }
}
