import Phaser from 'phaser';
import { Inventory, HOTBAR_SIZE, INVENTORY_SIZE } from '../systems/inventory';
import { resolveSlotVisual } from '../data/items';
import { CROPS, ALL_CROPS_ICONS_KEY, CropDefinition } from '../data/crops';
import { PLAYER_IDLE_KEY, PLAYER_ANIM_FRAMES } from '../data/player';
import {
  INVENTORY_PANEL_KEY,
  INVENTORY_SLOT_FRAME_NAME,
  INVENTORY_SLOT_RECT,
  INVENTORY_SLOT_DARK_FRAME_NAME,
  INVENTORY_SLOT_DARK_RECT,
  INVENTORY_LARGE_PANEL_KEY,
  INVENTORY_LARGE_PANEL_FRAME_NAME,
  INVENTORY_LARGE_PANEL_RECT,
  INVENTORY_LARGE_PANEL_BORDER,
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
/** Reduzido de 16 pra 12 (pedido explícito do usuário) pra caber a 5ª linha do grid sem espremer a página. */
const ROW_GAP = 12;
/** Cada página do livro comporta um grid de 6 colunas x 5 linhas (pedido explícito do usuário — antes eram 4 linhas). */
const GRID_COLS = 6;
const GRID_ROWS = 5;
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

/**
 * Reformulação da Mochila (Fase 9 — Interface, pedido explícito do
 * usuário): a página ESQUERDA sempre mostra o grid cheio de 24 slots (cabe
 * exatamente numa página — `GRID_COLS*GRID_ROWS === INVENTORY_SIZE`, por
 * isso o pool de slots deixou de precisar de uma segunda página). A página
 * DIREITA passou a depender da aba ativa: Mochila mostra o personagem +
 * slots de equipamento, Agricultura mostra o painel de detalhe do item
 * selecionado. `EQUIPMENT_SLOTS` são só os 5 tipos pedidos — sem itens de
 * armadura de verdade no jogo ainda (nenhuma arte de armadura sendo
 * usada/comprável), cada um nasce e fica permanentemente vazio, só a
 * moldura + rótulo indicando o que vai ali no futuro.
 */
type EquipmentSlotType = 'hat' | 'shirt' | 'pants' | 'boots' | 'accessory';
interface EquipmentSlotDefinition {
  type: EquipmentSlotType;
  label: string;
  /** Deslocamento (px, antes da escala do livro) relativo ao centro do personagem na página direita. */
  offsetX: number;
  offsetY: number;
}
const EQUIPMENT_SLOTS: EquipmentSlotDefinition[] = [
  { type: 'hat', label: 'Chapéu', offsetX: 0, offsetY: -52 },
  { type: 'shirt', label: 'Camisa', offsetX: -46, offsetY: -16 },
  { type: 'pants', label: 'Calça', offsetX: 46, offsetY: -16 },
  { type: 'boots', label: 'Botas', offsetX: -30, offsetY: 48 },
  { type: 'accessory', label: 'Acessório', offsetX: 30, offsetY: 48 },
];
/** Menores que antes (pedido explícito do usuário: "colados" ao personagem, não espalhados) — slot e personagem reduzidos pra caber um "boneco de papel" compacto na página direita. */
const EQUIPMENT_SLOT_SCALE = 2.0;
const CHARACTER_SPRITE_SCALE = 3.0;
const EQUIPMENT_LABEL_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: '"Courier New", Courier, monospace',
  fontSize: '8px',
  color: '#4a3524',
  stroke: '#f6e6cf',
  strokeThickness: 2,
};

/**
 * Painel de detalhe da aba Agricultura (diário de descobertas, pedido
 * explícito do usuário — layout de referência: grid de "?" na página
 * esquerda, ícone grande + nome + status na direita ao selecionar).
 *
 * Correção urgente (pedido explícito do usuário): a versão anterior pegava
 * o slot PEQUENO (`INVENTORY_SLOT_FRAME_NAME`, 18x18) e dava `setScale`
 * gigante nele — isso estica os cantos/bordas desenhados junto com o resto,
 * ficando com a decoração toda borrada/deformada. Agora usa
 * `INVENTORY_LARGE_PANEL_*` com `scene.add.nineslice`: largura/altura FIXAS
 * abaixo, cantos preservados (`INVENTORY_LARGE_PANEL_BORDER`), só o miolo
 * estica.
 */
const DETAIL_ICON_PANEL_WIDTH = 100;
const DETAIL_ICON_PANEL_HEIGHT = 100;
const DETAIL_TEXT_PANEL_WIDTH = 100;
const DETAIL_TEXT_PANEL_HEIGHT = 72;
const DETAIL_PANEL_GAP = 10;
/** Ícone (a arte em si, não a moldura) preenchendo a maior parte do painel de ícone, com folga pra não encostar na borda. */
const DETAIL_ICON_TARGET_PX = DETAIL_ICON_PANEL_WIDTH * 0.55;
const DETAIL_NAME_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: '"Courier New", Courier, monospace',
  fontSize: '13px',
  fontStyle: 'bold',
  color: '#4a3524',
  align: 'center',
};
const DETAIL_STATUS_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: '"Courier New", Courier, monospace',
  fontSize: '10px',
  color: '#6b5a4a',
  align: 'center',
  wordWrap: { width: DETAIL_TEXT_PANEL_WIDTH - 16 },
};
const QUESTION_MARK_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '16px',
  fontStyle: 'bold',
  color: '#4a3524',
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
  /** "?" central (Fase 9 — diário de descobertas), visível só num slot de Agricultura ainda não descoberto — ver `QUESTION_MARK_STYLE`. */
  questionMark: Phaser.GameObjects.Text;
  /** Posição fixa do slot (a mesma sempre — o que muda de frame a frame é o CONTEÚDO nela, nunca a célula). Usada pra resetar o ícone de volta no lugar certo a cada render, já que o drag o move temporariamente. */
  x: number;
  y: number;
  onClick: (() => void) | null;
}

/** O que um slot do grid mostra, resolvido a partir do `Inventory`/`CROPS` — ver `computeContent`. */
interface InventorySlotContent {
  textureKey: string;
  iconFrame: number | string;
  badge: string;
  tint: number;
  onClick: (() => void) | null;
  /** Só relevante na aba Agricultura (Fase 9 — diário de descobertas): mostra "?" em vez do ícone quando `false`. `true` em qualquer outra aba (não afeta o comportamento de antes). */
  discovered: boolean;
  /** Índice do slot que pode ser arrastado para OUTRO (Fase 9 — drag and drop, pedido explícito do usuário) — só a Mochila usa isso; `undefined` desativa o arrasto (Agricultura é só leitura). */
  slotIndex?: number;
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
  /** Referência viva do `Inventory` sendo mostrado — guardada pra o `dragend` (disparado fora do fluxo normal de `refresh`) poder chamar `swapSlots` sem precisar receber o inventário de novo. */
  private currentInventory: Inventory | null = null;
  /** Slot que está sendo arrastado no momento (Fase 9 — drag and drop), `null` quando não há arrasto em andamento. */
  private dragSourceIndex: number | null = null;

  // Página direita da aba Mochila (Fase 9 — personagem + equipamento).
  private readonly characterSprite: Phaser.GameObjects.Image;
  private readonly equipmentSlots: Array<{ frame: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text }> = [];

  // Página direita da aba Agricultura (Fase 9 — diário de descobertas).
  // `NineSlice` (correção urgente pedida pelo usuário — ver doc de
  // `DETAIL_ICON_PANEL_WIDTH`): tamanho FIXO, cantos preservados.
  private readonly detailIconPanel: Phaser.GameObjects.NineSlice;
  private readonly detailTextPanel: Phaser.GameObjects.NineSlice;
  private readonly detailIcon: Phaser.GameObjects.Image;
  private readonly detailQuestionMark: Phaser.GameObjects.Text;
  private readonly detailName: Phaser.GameObjects.Text;
  private readonly detailStatus: Phaser.GameObjects.Text;
  private selectedCropId: string | null = null;
  /** Cantinhos de destaque (mesma técnica de `tabSelector`) ao redor do slot selecionado no grid da Agricultura — referência visual pedida pelo usuário. */
  private readonly gridSelector: Record<CornerKey, Phaser.GameObjects.Image>;

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
    if (!panelTexture.has(INVENTORY_SLOT_DARK_FRAME_NAME)) {
      panelTexture.add(
        INVENTORY_SLOT_DARK_FRAME_NAME,
        0,
        INVENTORY_SLOT_DARK_RECT.x,
        INVENTORY_SLOT_DARK_RECT.y,
        INVENTORY_SLOT_DARK_RECT.width,
        INVENTORY_SLOT_DARK_RECT.height,
      );
    }
    const largePanelTexture = scene.textures.get(INVENTORY_LARGE_PANEL_KEY);
    if (!largePanelTexture.has(INVENTORY_LARGE_PANEL_FRAME_NAME)) {
      largePanelTexture.add(
        INVENTORY_LARGE_PANEL_FRAME_NAME,
        0,
        INVENTORY_LARGE_PANEL_RECT.x,
        INVENTORY_LARGE_PANEL_RECT.y,
        INVENTORY_LARGE_PANEL_RECT.width,
        INVENTORY_LARGE_PANEL_RECT.height,
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
    const leftStartX = bookLeft + PAGE_RECT.left.x * BOOK_SCALE + (leftPageWidth - gridWidth) / 2 + slotWidth / 2;

    // Reformulação (Fase 9): o grid inteiro cabe numa página só — 6x4 = 24 =
    // `INVENTORY_SIZE` exatamente —, então o pool de slots agora vive só na
    // página ESQUERDA, sempre; a direita virou conteúdo próprio por aba (ver
    // personagem+equipamento/painel de detalhe abaixo), em vez de uma
    // segunda leva do mesmo grid.
    for (let index = 0; index < ITEMS_PER_PAGE; index++) {
      const col = index % GRID_COLS;
      const row = Math.floor(index / GRID_COLS);

      const x = leftStartX + col * (slotWidth + SLOT_GAP);
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

      // Drag and drop (Fase 9, pedido explícito do usuário): só o ÍCONE é
      // arrastável (o `frame` embaixo continua cuidando do clique-pra-
      // selecionar-Hotbar, igual antes) — só fica interativo/arrastável
      // quando a aba Mochila está ativa E o slot tem algo dentro
      // (`renderActiveCategory` decide isso a cada frame).
      icon.setInteractive({ useHandCursor: true });
      icon.disableInteractive();
      scene.input.setDraggable(icon, true);
      icon.on('dragstart', () => {
        this.dragSourceIndex = index;
        icon.setDepth(3500);
      });
      icon.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
        icon.setPosition(dragX, dragY);
      });
      icon.on('dragend', () => {
        const sourceIndex = this.dragSourceIndex;
        this.dragSourceIndex = null;
        icon.setDepth(3002);
        if (sourceIndex === null || !this.currentInventory) return;

        const targetIndex = this.slots.findIndex((slot) => Phaser.Geom.Rectangle.Contains(slot.frame.getBounds(), icon.x, icon.y));
        if (targetIndex !== -1 && targetIndex !== sourceIndex) {
          this.currentInventory.swapSlots(sourceIndex, targetIndex);
        }
        // Sempre reposiciona na célula fixa — se o swap não aconteceu (alvo
        // inválido ou solto fora de qualquer slot), volta pro lugar de
        // origem; se aconteceu, `renderActiveCategory` (chamado todo frame
        // por `UIScene.update`) já redesenha o conteúdo novo no lugar certo
        // no próximo frame de qualquer forma.
        icon.setPosition(this.slots[index].x, this.slots[index].y);
      });

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

      const questionMark = scene.add.text(x, y, '?', QUESTION_MARK_STYLE);
      questionMark.setOrigin(0.5, 0.5);
      questionMark.setScrollFactor(0);
      questionMark.setDepth(3002);
      questionMark.setVisible(false);

      this.slots.push({ frame, icon, badgeText, questionMark, x, y, onClick: null });
    }

    // Página direita — Mochila: personagem parado (mesmo frame usado como
    // pose de repouso no mundo) cercado pelos 5 slots de equipamento.
    const rightPageWidth = PAGE_RECT.right.width * BOOK_SCALE;
    const rightCenterX = bookLeft + PAGE_RECT.right.x * BOOK_SCALE + rightPageWidth / 2;
    const rightCenterY = bookTop + PAGE_RECT.top * BOOK_SCALE + pageHeight / 2;

    this.characterSprite = scene.add.image(rightCenterX, rightCenterY, PLAYER_IDLE_KEY, PLAYER_ANIM_FRAMES.idleDown.start);
    this.characterSprite.setOrigin(0.5, 0.5);
    this.characterSprite.setScale(CHARACTER_SPRITE_SCALE);
    this.characterSprite.setScrollFactor(0);
    this.characterSprite.setDepth(3001);

    for (const def of EQUIPMENT_SLOTS) {
      const ex = rightCenterX + def.offsetX * (BOOK_SCALE / 2);
      const ey = rightCenterY + def.offsetY * (BOOK_SCALE / 2);

      const frame = scene.add.image(ex, ey, INVENTORY_PANEL_KEY, INVENTORY_SLOT_FRAME_NAME);
      frame.setOrigin(0.5, 0.5);
      frame.setScale(EQUIPMENT_SLOT_SCALE);
      frame.setScrollFactor(0);
      frame.setDepth(3002);

      const label = scene.add.text(ex, ey + (INVENTORY_SLOT_RECT.height * EQUIPMENT_SLOT_SCALE) / 2 + 2, def.label, EQUIPMENT_LABEL_STYLE);
      label.setOrigin(0.5, 0);
      label.setScrollFactor(0);
      label.setDepth(3002);

      this.equipmentSlots.push({ frame, label });
    }

    // Página direita — Agricultura: painel de detalhe do item selecionado
    // no grid da esquerda (layout de referência do usuário: ícone grande +
    // nome + status "Descoberto"/"Ainda não descoberto"). Correção urgente
    // pedida pelo usuário: `NineSlice` com tamanho FIXO em vez de `Image` +
    // `setScale` gigante — os cantos ornamentados do painel nunca esticam,
    // só o miolo (ver `INVENTORY_LARGE_PANEL_BORDER`).
    const detailIconY = rightCenterY - (DETAIL_TEXT_PANEL_HEIGHT + DETAIL_PANEL_GAP) / 2;
    const detailTextY = detailIconY + DETAIL_ICON_PANEL_HEIGHT / 2 + DETAIL_PANEL_GAP + DETAIL_TEXT_PANEL_HEIGHT / 2;

    this.detailIconPanel = scene.add.nineslice(
      rightCenterX,
      detailIconY,
      INVENTORY_LARGE_PANEL_KEY,
      INVENTORY_LARGE_PANEL_FRAME_NAME,
      DETAIL_ICON_PANEL_WIDTH,
      DETAIL_ICON_PANEL_HEIGHT,
      INVENTORY_LARGE_PANEL_BORDER,
      INVENTORY_LARGE_PANEL_BORDER,
      INVENTORY_LARGE_PANEL_BORDER,
      INVENTORY_LARGE_PANEL_BORDER,
    );
    this.detailIconPanel.setOrigin(0.5, 0.5);
    this.detailIconPanel.setScrollFactor(0);
    this.detailIconPanel.setDepth(3001);

    this.detailIcon = scene.add.image(rightCenterX, detailIconY, ALL_CROPS_ICONS_KEY, '');
    this.detailIcon.setOrigin(0.5, 0.5);
    this.detailIcon.setScrollFactor(0);
    this.detailIcon.setDepth(3002);

    this.detailQuestionMark = scene.add.text(rightCenterX, detailIconY, '???', {
      ...QUESTION_MARK_STYLE,
      fontSize: '22px',
    });
    this.detailQuestionMark.setOrigin(0.5, 0.5);
    this.detailQuestionMark.setScrollFactor(0);
    this.detailQuestionMark.setDepth(3002);

    this.detailTextPanel = scene.add.nineslice(
      rightCenterX,
      detailTextY,
      INVENTORY_LARGE_PANEL_KEY,
      INVENTORY_LARGE_PANEL_FRAME_NAME,
      DETAIL_TEXT_PANEL_WIDTH,
      DETAIL_TEXT_PANEL_HEIGHT,
      INVENTORY_LARGE_PANEL_BORDER,
      INVENTORY_LARGE_PANEL_BORDER,
      INVENTORY_LARGE_PANEL_BORDER,
      INVENTORY_LARGE_PANEL_BORDER,
    );
    this.detailTextPanel.setOrigin(0.5, 0.5);
    this.detailTextPanel.setScrollFactor(0);
    this.detailTextPanel.setDepth(3001);

    this.detailName = scene.add.text(rightCenterX, detailTextY - 14, '', DETAIL_NAME_STYLE);
    this.detailName.setOrigin(0.5, 0.5);
    this.detailName.setScrollFactor(0);
    this.detailName.setDepth(3002);

    this.detailStatus = scene.add.text(rightCenterX, detailTextY + 10, '', DETAIL_STATUS_STYLE);
    this.detailStatus.setOrigin(0.5, 0.5);
    this.detailStatus.setScrollFactor(0);
    this.detailStatus.setDepth(3002);

    const makeGridSelectorCorner = (key: CornerKey, originX: number, originY: number): Phaser.GameObjects.Image => {
      const corner = scene.add.image(0, 0, EXTRAS_UI_KEY, GLOBAL_CURSOR_CORNER_NAMES[key]);
      corner.setOrigin(originX, originY);
      corner.setScale(SLOT_SCALE);
      corner.setScrollFactor(0);
      corner.setDepth(3003);
      return corner;
    };
    this.gridSelector = {
      topLeft: makeGridSelectorCorner('topLeft', 0, 0),
      topRight: makeGridSelectorCorner('topRight', 1, 0),
      bottomLeft: makeGridSelectorCorner('bottomLeft', 0, 1),
      bottomRight: makeGridSelectorCorner('bottomRight', 1, 1),
    };

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
    this.currentInventory = inventory;
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
    this.currentInventory = inventory;
    this.renderActiveCategory(inventory);
  }

  private selectCategory(category: InventoryTabCategory): void {
    if (category === this.activeCategory) return;
    this.activeCategory = category;
  }

  /** Clicado num slot do grid da Agricultura (pedido explícito do usuário: clicar mostra o detalhe na página direita, descoberto ou não). */
  private selectCropDetail(cropId: string): void {
    this.selectedCropId = cropId;
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
          content.push({ textureKey: '', iconFrame: '', badge: '', tint, onClick, discovered: true, slotIndex: index });
          continue;
        }

        let badge = '';
        if (ref.category === 'seed') badge = String(inventory.getSeedCount(ref.id));
        else if (ref.category === 'decoration') badge = String(inventory.getDecorationCount(ref.id));
        else if (ref.category === 'resource') badge = String(inventory.getResourceCount(ref.id));

        content.push({ textureKey: visual.textureKey, iconFrame: visual.iconFrame, badge, tint, onClick, discovered: true, slotIndex: index });
      }
      return content;
    }

    if (this.activeCategory === 'agriculture') {
      // Diário de descobertas (Fase 9, pedido explícito do usuário):
      // `Inventory.hasHarvested` nunca esquece — mesmo se o jogador vender
      // toda a colheita depois, a cultura continua "descoberta".
      return Object.values(CROPS).map((crop) => {
        const discovered = inventory.hasHarvested(crop.id);
        return {
          textureKey: ALL_CROPS_ICONS_KEY,
          iconFrame: crop.iconFrameName,
          badge: discovered ? String(inventory.getCount(crop.id)) : '',
          tint: UNSELECTED_TINT,
          onClick: () => this.selectCropDetail(crop.id),
          discovered,
        };
      });
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
    const isBackpack = this.activeCategory === 'backpack';
    const isAgriculture = this.activeCategory === 'agriculture';

    this.slots.forEach((slot, index) => {
      const entry: InventorySlotContent | undefined = content[index];
      slot.onClick = entry?.onClick ?? null;

      // Slot "não descoberto" (Fase 9): troca pra textura do slot ESCURO de
      // verdade (`INVENTORY_SLOT_DARK_FRAME_NAME`) em vez de tingir o slot
      // creme — pedido explícito do usuário, mesma folha `inventory.png`,
      // só a fileira de cima em vez da de baixo.
      const isDark = isAgriculture && !!entry && !entry.discovered;
      slot.frame.setTexture(INVENTORY_PANEL_KEY, isDark ? INVENTORY_SLOT_DARK_FRAME_NAME : INVENTORY_SLOT_FRAME_NAME);
      slot.frame.setTint(entry ? entry.tint : UNSELECTED_TINT);
      // O drag pode ter movido o ícone pra fora da célula — sempre volta
      // pro lugar fixo antes de decidir o que mostrar nele (ver `dragend`).
      slot.icon.setPosition(slot.x, slot.y);

      const draggable = isBackpack && !!entry?.textureKey;
      if (draggable) slot.icon.setInteractive();
      else slot.icon.disableInteractive();

      if (!entry || !entry.textureKey || isDark) {
        slot.icon.setVisible(false);
        slot.badgeText.setVisible(false);
        slot.questionMark.setVisible(isDark);
        return;
      }

      slot.icon.setTexture(entry.textureKey, entry.iconFrame);
      slot.icon.setScale(computeFitScale(slot.icon, ICON_TARGET_PX));
      slot.icon.setVisible(true);
      slot.badgeText.setText(entry.badge);
      slot.badgeText.setVisible(!!entry.badge);
      slot.questionMark.setVisible(false);
    });

    this.emptyText.setVisible(content.length === 0);

    this.characterSprite.setVisible(isBackpack);
    for (const equipmentSlot of this.equipmentSlots) {
      equipmentSlot.frame.setVisible(isBackpack);
      equipmentSlot.label.setVisible(isBackpack);
    }

    this.renderAgricultureDetail(inventory, isAgriculture);
  }

  /** Painel de detalhe da página direita da Agricultura (Fase 9) — ver doc da classe/`EQUIPMENT_SLOTS`. */
  private renderAgricultureDetail(inventory: Inventory, visible: boolean): void {
    this.detailIconPanel.setVisible(visible);
    this.detailTextPanel.setVisible(visible);
    this.detailName.setVisible(visible);
    this.detailStatus.setVisible(visible);
    for (const corner of Object.values(this.gridSelector)) corner.setVisible(visible && this.selectedCropId !== null);

    if (!visible) {
      this.detailIcon.setVisible(false);
      this.detailQuestionMark.setVisible(false);
      return;
    }

    const crop: CropDefinition | undefined = this.selectedCropId ? CROPS[this.selectedCropId] : undefined;
    if (!crop) {
      this.detailIcon.setVisible(false);
      this.detailQuestionMark.setVisible(true);
      this.detailName.setText('');
      this.detailStatus.setText('Selecione um item.');
      return;
    }

    const discovered = inventory.hasHarvested(crop.id);
    if (discovered) {
      this.detailIcon.setTexture(ALL_CROPS_ICONS_KEY, crop.iconFrameName);
      this.detailIcon.setScale(computeFitScale(this.detailIcon, DETAIL_ICON_TARGET_PX));
      this.detailIcon.setVisible(true);
      this.detailQuestionMark.setVisible(false);
      this.detailName.setText(crop.name);
      this.detailStatus.setText(`Colhido: ${inventory.getCount(crop.id)}`);
    } else {
      this.detailIcon.setVisible(false);
      this.detailQuestionMark.setVisible(true);
      this.detailName.setText('???');
      this.detailStatus.setText('Ainda não descoberto.');
    }

    // Cantinhos de destaque ao redor do slot selecionado no grid esquerdo.
    const selectedIndex = Object.values(CROPS).findIndex((c) => c.id === this.selectedCropId);
    const selectedSlot = selectedIndex !== -1 ? this.slots[selectedIndex] : null;
    if (selectedSlot) {
      const bounds = selectedSlot.frame.getBounds();
      const left = bounds.left - TAB_SELECTOR_PADDING;
      const top = bounds.top - TAB_SELECTOR_PADDING;
      const right = bounds.right + TAB_SELECTOR_PADDING;
      const bottom = bounds.bottom + TAB_SELECTOR_PADDING;
      this.gridSelector.topLeft.setPosition(left, top);
      this.gridSelector.topRight.setPosition(right, top);
      this.gridSelector.bottomLeft.setPosition(left, bottom);
      this.gridSelector.bottomRight.setPosition(right, bottom);
    }
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
      slot.questionMark.setVisible(visible && slot.questionMark.visible);

      if (visible && slot.onClick) slot.frame.setInteractive();
      else slot.frame.disableInteractive();
      // Arrasto (Fase 9): nunca deixa um ícone arrastável escutando depois
      // que a tela fecha — `renderActiveCategory` reativa certo no próximo
      // `open`/`refresh`.
      if (!visible) slot.icon.disableInteractive();
    }
    this.emptyText.setVisible(visible && this.emptyText.visible);

    // Página direita — Mochila (Fase 9): visibilidade real decidida por
    // `renderActiveCategory` (depende da aba ativa); fechar a tela some com
    // tudo incondicionalmente, igual ao resto.
    this.characterSprite.setVisible(visible && this.characterSprite.visible);
    for (const equipmentSlot of this.equipmentSlots) {
      equipmentSlot.frame.setVisible(visible && equipmentSlot.frame.visible);
      equipmentSlot.label.setVisible(visible && equipmentSlot.label.visible);
    }

    // Página direita — Agricultura (Fase 9): mesma ideia.
    this.detailIconPanel.setVisible(visible && this.detailIconPanel.visible);
    this.detailTextPanel.setVisible(visible && this.detailTextPanel.visible);
    this.detailIcon.setVisible(visible && this.detailIcon.visible);
    this.detailQuestionMark.setVisible(visible && this.detailQuestionMark.visible);
    this.detailName.setVisible(visible && this.detailName.visible);
    this.detailStatus.setVisible(visible && this.detailStatus.visible);
    for (const corner of Object.values(this.gridSelector)) corner.setVisible(visible && corner.visible);
  }
}
