import Phaser from 'phaser';
import { playClick } from '../systems/soundEffects';
import {
  INVENTORY_PANEL_KEY,
  INVENTORY_PANEL_FRAME_NAME,
  INVENTORY_PANEL_RECT,
  INVENTORY_PANEL_BORDER,
  INVENTORY_SLOT_FRAME_NAME,
  INVENTORY_SLOT_RECT,
  INVENTORY_LARGE_PANEL_KEY,
  INVENTORY_LARGE_PANEL_FRAME_NAME,
  INVENTORY_LARGE_PANEL_RECT,
  INVENTORY_LARGE_PANEL_BORDER,
  SHOP_BOOK_KEY,
  SHOP_BOOK_FRAME_NAME,
  SHOP_TAB_RIBBONS_KEY,
  CLOSE_TAB_BG_FRAME,
  CLOSE_BUTTON_SHEET_KEY,
  CLOSE_X_ICON_FRAME,
  CLOSE_X_ICON_PRESSED_FRAME,
  DELETE_ICON_FRAME,
  MOVE_ICON_FRAME,
  EXTRAS_UI_KEY,
  GLOBAL_CURSOR_CORNER_NAMES,
  GLOBAL_CURSOR_CORNER_RECTS,
} from '../data/ui';
import { computeFitScale } from './slotIcon';

const BOOK_SCALE = 2.2;
const SLOT_SCALE = 1.7;
const SLOT_GAP = 5;
const ROW_GAP = 16;
/** A página esquerda comporta um grid de 6 colunas x 4 linhas de itens à venda. */
const GRID_COLS = 6;
const GRID_ROWS = 4;
const ITEMS_PER_PAGE = GRID_COLS * GRID_ROWS;
/** Fração da célula (16px nativos) que um ícone "normal" (16x16) preenche. */
const ICON_FILL_RATIO = 0.8;
const ICON_TARGET_PX = 16 * SLOT_SCALE * ICON_FILL_RATIO;
const AFFORDABLE_ALPHA = 1;
const UNAFFORDABLE_ALPHA = 0.45;

/**
 * Abas ("bandeirinhas") na lateral esquerda do livro — arte real de
 * `SHOP_TAB_RIBBONS_KEY` (`UI/Inventory/Extras.png`), uma cor por
 * categoria (ver `ShopTabDefinition.tabFrame`).
 *
 * A bandeirola usa `setOrigin(1, 0.5)` (ancorada pela direita) e nasce em
 * `bookLeft + TAB_BOOK_OVERLAP` — como a origem é a borda direita, ela
 * cresce inteira pra fora (esquerda) a partir desse ponto, com uma pontinha
 * (`TAB_BOOK_OVERLAP` px) encostando por cima da borda do livro. `depth`
 * MAIOR que o do livro (`this.book`) — pedido explícito do usuário — faz a
 * bandeirola desenhar por CIMA da capa (não atrás dela).
 */
const TAB_SCALE = 2.0;
/**
 * O asset nasce "em pé" (retrato: 18 de largura x 25 de altura, ponta
 * entalhada embaixo, como uma bandeirinha pendurada) — rotacionado 90°
 * (`TAB_ROTATION`) pra ficar "deitado" (o lado reto vira a borda que
 * encosta no livro, a ponta entalhada vira a ponta que sai pra fora),
 * como pedido. Depois de rotacionado, o que era ALTURA nativa vira a
 * extensão HORIZONTAL na tela, e o que era LARGURA nativa vira a altura
 * (usada pra empilhar as 3 abas verticalmente).
 */
const TAB_ROTATION = Math.PI / 2;
const TAB_RIBBON_NATIVE_THICKNESS = 18; // largura nativa -> altura (empilhamento) depois de rotacionar
const TAB_DISPLAY_THICKNESS = TAB_RIBBON_NATIVE_THICKNESS * TAB_SCALE;
const TAB_GAP_Y = 8;
/** Quantos px da bandeirola ficam por cima da borda do livro (o resto sai pra fora, à esquerda). */
const TAB_BOOK_OVERLAP = 4;
/** Tamanho-alvo (px de tela) de QUALQUER ícone de aba, não importa o tamanho nativo do asset (semente 16x16, Poço 28x38 etc.) — ver `computeFitScale`. */
const TAB_ICON_TARGET_PX = 28;
/** Centro da porção da bandeirola que fica PRA FORA do livro (não a que fica em cima da capa), pra não desenhar o ícone em cima da borda de madeira. */
const TAB_ICON_OFFSET_X = 2;
const TAB_ICON_OFFSET_Y = -18;
const TAB_SELECTOR_SCALE = 1.5;
const TAB_SELECTOR_PADDING = 2;
type CornerKey = keyof typeof GLOBAL_CURSOR_CORNER_NAMES;
/**
 * Botão de fechar (lado direito): fundo é o "marcador de página" de couro
 * de `Book.png` (`CLOSE_TAB_BG_FRAME`), mesma técnica de ancoragem das
 * abas espelhada (origin pela esquerda). Depth MAIOR que o do livro —
 * pedido explícito do usuário — desenha por CIMA da capa. O ícone "X"
 * (`CLOSE_X_ICON_FRAME`, de `UI/HUD.png`) fica centralizado na parte do
 * marcador que sai pra fora do livro, com depth um pouco maior que o do
 * marcador (só decorativo, pra ficar por cima dele).
 */
const CLOSE_MARK_SCALE = 1.8;
const CLOSE_BOOK_OVERLAP = 30;
const CLOSE_X_TARGET_PX = 30;
/** Centro da porção visível do marcador (mesma ideia do `TAB_ICON_OFFSET_X`, só que a partir da esquerda). */
const CLOSE_X_OFFSET_X = CLOSE_BOOK_OVERLAP + (CLOSE_TAB_BG_FRAME.rect.width * CLOSE_MARK_SCALE - CLOSE_BOOK_OVERLAP) / 2;
/** Ajuste fino do "X" dentro do marcador de couro (negativo = esquerda/cima). */
const CLOSE_X_ADJUST_X = -16;
const CLOSE_X_ADJUST_Y = -8;

/**
 * Área de papel em branco de cada página, dentro do frame já recortado do
 * livro (`SHOP_BOOK_FRAME_NAME`, que começa em x=1,y=0 do PNG original) —
 * confirmado pixel a pixel em `Book.png`: página esquerda x=15-115,
 * direita x=125-221, ambas y=4-123, no canvas original (256x288). Sub­traído
 * o deslocamento do recorte (-1 em x) pra virar coordenada local do frame.
 */
const PAGE_RECT = {
  left: { x: 14, width: 100 },
  right: { x: 124, width: 96 },
  top: 4,
  height: 119,
};

/**
 * Página direita (detalhe do item selecionado — mesmo esquema da aba
 * Agricultura do Inventário): painel do ícone grande, painel de texto (nome,
 * descrição, preço) e o botão "Comprar". Todos `NineSlice` de tamanho FIXO
 * (cantos preservados, só o miolo estica).
 */
const DETAIL_ICON_PANEL_WIDTH = 96;
const DETAIL_ICON_PANEL_HEIGHT = 84;
const DETAIL_TEXT_PANEL_WIDTH = 176;
const DETAIL_TEXT_PANEL_HEIGHT = 128;
const DETAIL_GAP = 4;
/** Descrição do item: fonte normal, mínimo legível e altura livre (do fim do nome até logo acima do preço, na caixinha de texto). */
const DETAIL_DESCRIPTION_FONT_PX = 10;
const DETAIL_DESCRIPTION_MIN_FONT_PX = 7;
const DETAIL_DESCRIPTION_MAX_HEIGHT = 63;
/** Com a linha de materiais (ou o motivo do bloqueio) entre a descrição e o preço, a descrição tem menos altura. */
const DETAIL_DESCRIPTION_MAX_HEIGHT_WITH_MATERIALS = 34;
const DETAIL_ICON_TARGET_PX = DETAIL_ICON_PANEL_HEIGHT * 0.55;
const BUY_BUTTON_WIDTH = 96;
const BUY_BUTTON_HEIGHT = 28;
const TEXT_INK = '#4a3524';
const TEXT_SOFT = '#6b5a4a';
const TEXT_PRICE = '#6b3f1f';
const FONT = '"Courier New", Courier, monospace';
const BUY_ENABLED_TINT = 0xffffff;
const BUY_DISABLED_TINT = 0x8f8f8f;

/** As 3 categorias da Loja (Fase 8) — preparadas para o upgrade futuro de ferramentas. */
export type ShopCategory = 'agriculture' | 'tools' | 'construction' | 'animals';

/**
 * Formato mínimo que qualquer coisa vendida na Loja precisa ter — sementes
 * (`CropDefinition`), decorações (`DecorationDefinition`) e receitas
 * (`RecipeDefinition`) são formas diferentes na origem dos dados, mas todas
 * cabem aqui sem o `ShopMenu` precisar saber a diferença entre elas. Quem
 * monta essa lista (`MainScene`) decide nome, descrição, preço de cada uma e
 * a categoria/aba onde aparece.
 */
export interface ShopItem {
  id: string;
  category: ShopCategory;
  /** Nome mostrado no painel de detalhe. */
  name: string;
  /** Texto do painel de detalhe (o que é / o que faz). */
  description: string;
  textureKey: string;
  /** Frame do ícone: número (spritesheet, culturas) ou nome (frame recortado à mão, decorações). */
  iconFrame: number | string;
  price: number;
  /** Materiais que a compra gasta ALÉM das moedas (ex.: as 5 barras de uma ferramenta) — `ShopRequirements.count` diz o quanto o jogador tem. */
  materials?: ShopMaterialCost[];
}

export interface ShopMaterialCost {
  /** Id do recurso (`data/resources.ts`). */
  resourceId: string;
  name: string;
  amount: number;
}

/** O que a loja precisa saber do jogador além das moedas: quanto ele tem de cada material e por que um item não pode ser comprado agora (ex.: falta a ferramenta do tier anterior). */
export interface ShopRequirements {
  count(resourceId: string): number;
  blockedReason?(itemId: string): string | null;
}

/**
 * Ações sobre o que o jogador já tem do item selecionado (só a loja do Marceneiro usa): três ícones ao lado da descrição — mover, cancelar a
 * encomenda e destruir a construção pronta. `available` diz quais valem pro item (some o ícone que não vale); `onAction` executa.
 */
export type ShopActionId = 'move' | 'cancel' | 'destroy';
export interface ShopItemActions {
  available(itemId: string): ShopActionId[];
  onAction(itemId: string, action: ShopActionId): void;
}

const ACTION_BUTTON_SIZE = 26;
const ACTION_BUTTON_GAP = 3;
const ACTION_ICON_TARGET_PX = 18;
const ACTION_ORDER: ShopActionId[] = ['move', 'cancel', 'destroy'];
const ACTION_LABELS: Record<ShopActionId, string> = { move: 'Mover', cancel: 'Cancelar', destroy: 'Destruir' };
const ACTION_FRAMES: Record<ShopActionId, string> = { move: MOVE_ICON_FRAME.name, cancel: CLOSE_X_ICON_FRAME.name, destroy: DELETE_ICON_FRAME.name };

interface ShopActionButton {
  background: Phaser.GameObjects.NineSlice;
  icon: Phaser.GameObjects.Image;
}

/** Uma aba da Loja — ícone representativo da categoria (não precisa vir de um item à venda nela, ex.: "Ferramentas" ainda não vende nada). */
export interface ShopTabDefinition {
  category: ShopCategory;
  textureKey: string;
  iconFrame: number | string;
  /** Nome do frame da bandeirola desta categoria em `SHOP_TAB_RIBBONS_KEY` (ver `data/ui.ts`, `TAB_FRAME_*`). */
  tabFrame: string;
  tabFrameHover: string;
}

interface ShopTab {
  category: ShopCategory;
  background: Phaser.GameObjects.Image;
  icon: Phaser.GameObjects.Image;
  /** Posição X de repouso da bandeirola. */
  baseX: number;
  y: number;
}

interface ShopSlot {
  itemId: string;
  price: number;
  frame: Phaser.GameObjects.Image;
  icon: Phaser.GameObjects.Image;
  priceText: Phaser.GameObjects.Text;
}

/**
 * Loja (Fase 8), no mesmo esquema da aba Agricultura do Inventário (pedido
 * explícito): fundo de `UI/Inventory/Book.png` (um livro aberto) com 3
 * categorias (Agricultura/Ferramentas/Construções) nas abas da lateral.
 *
 * Página ESQUERDA = os itens à venda da aba ativa, num grid de slots (6x4,
 * o quadrado individual de `inventory.png`, com o preço embaixo); clicar num
 * slot só SELECIONA o item (cantinhos de destaque ao redor). Página DIREITA
 * = detalhe do item selecionado: ícone grande, nome, descrição e preço, e o
 * botão "Comprar" (é ele que pede a compra — nunca o clique no slot).
 *
 * Puramente visual e de clique: quem decide se a compra é possível é sempre
 * `Inventory`, via o callback `onBuy` passado no construtor — este painel só
 * pede a compra e depois reflete o resultado (`refresh`), nunca decide
 * sozinho. `isOwned` (opcional) diz se um item único (ex.: receita) já foi
 * comprado — o botão vira "Já possui" e fica desativado.
 *
 * Os slots/botões só ficam interativos com a Loja aberta (`setElementsVisible`
 * liga/desliga junto da visibilidade, e cada handler ainda confere
 * `isOpen_`): como usam `setScrollFactor(0)` (posição fixa na tela), sem isso
 * um clique no MUNDO que caísse por baixo dessa região (ex.: o clique que
 * abre a Loja) também dispararia a compra.
 */
export class ShopMenu {
  private readonly book: Phaser.GameObjects.Image;
  private readonly tabs: ShopTab[] = [];
  private readonly tabSelector: Record<CornerKey, Phaser.GameObjects.Image>;
  private readonly gridSelector: Record<CornerKey, Phaser.GameObjects.Image>;
  private readonly slots: ShopSlot[] = [];
  private readonly emptyText: Phaser.GameObjects.Text;
  private readonly closeButton: Phaser.GameObjects.Image;
  private readonly closeButtonMark: Phaser.GameObjects.Image;
  private readonly detailIconPanel: Phaser.GameObjects.NineSlice;
  private readonly detailIcon: Phaser.GameObjects.Image;
  private readonly detailTextPanel: Phaser.GameObjects.NineSlice;
  private readonly detailName: Phaser.GameObjects.Text;
  private readonly detailDescription: Phaser.GameObjects.Text;
  private readonly detailPrice: Phaser.GameObjects.Text;
  /** Materiais exigidos ("Barra de Cobre: 2/5") ou o motivo do bloqueio, entre a descrição e o preço. */
  private readonly detailMaterials: Phaser.GameObjects.Text;
  private readonly buyButton: Phaser.GameObjects.NineSlice;
  private readonly buyLabel: Phaser.GameObjects.Text;
  private readonly actionButtons = new Map<ShopActionId, ShopActionButton>();
  private readonly actionHint: Phaser.GameObjects.Text;
  /** Centro vertical da coluna de ações (o do painel do ícone) — os botões que valem se empilham em volta dele. */
  private actionColumnY = 0;
  private readonly itemsByCategory: Map<ShopCategory, ShopItem[]>;
  private activeCategory: ShopCategory;
  private selectedItemId: string | null = null;
  private isOpen_ = false;
  private lastCoins = 0;

  constructor(
    scene: Phaser.Scene,
    tabDefs: ShopTabDefinition[],
    items: ShopItem[],
    private readonly onBuy: (itemId: string) => void,
    private readonly isOwned: (itemId: string) => boolean = () => false,
    private readonly actions?: ShopItemActions,
    private readonly requirements?: ShopRequirements,
  ) {
    const panelTexture = scene.textures.get(INVENTORY_PANEL_KEY);
    for (const [name, rect] of [
      [INVENTORY_SLOT_FRAME_NAME, INVENTORY_SLOT_RECT],
      [INVENTORY_PANEL_FRAME_NAME, INVENTORY_PANEL_RECT],
    ] as const) {
      if (!panelTexture.has(name)) panelTexture.add(name, 0, rect.x, rect.y, rect.width, rect.height);
    }

    // A Loja é criada antes da UIScene (que registraria isto via InventoryScreen) — garante o recorte da moldura grande aqui também.
    const largePanelTexture = scene.textures.get(INVENTORY_LARGE_PANEL_KEY);
    if (!largePanelTexture.has(INVENTORY_LARGE_PANEL_FRAME_NAME)) {
      const rect = INVENTORY_LARGE_PANEL_RECT;
      largePanelTexture.add(INVENTORY_LARGE_PANEL_FRAME_NAME, 0, rect.x, rect.y, rect.width, rect.height);
    }

    this.itemsByCategory = new Map();
    for (const item of items) {
      const list = this.itemsByCategory.get(item.category) ?? [];
      list.push(item);
      this.itemsByCategory.set(item.category, list);
    }
    this.activeCategory = tabDefs[0]?.category ?? 'agriculture';

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

    // Cantinhos de destaque (mesma arte do cursor global): um conjunto pra aba
    // ativa, outro pro item selecionado no grid. Criados UMA vez (antes do
    // loop das abas/slots) — as posições são recalculadas em `renderActiveCategory`.
    const cursorTexture = scene.textures.get(EXTRAS_UI_KEY);
    for (const key of Object.keys(GLOBAL_CURSOR_CORNER_NAMES) as CornerKey[]) {
      const name = GLOBAL_CURSOR_CORNER_NAMES[key];
      if (!cursorTexture.has(name)) {
        const rect = GLOBAL_CURSOR_CORNER_RECTS[key];
        cursorTexture.add(name, 0, rect.x, rect.y, rect.width, rect.height);
      }
    }
    const makeSelector = (scale: number, depth: number): Record<CornerKey, Phaser.GameObjects.Image> => {
      const makeCorner = (key: CornerKey, originX: number, originY: number): Phaser.GameObjects.Image => {
        const corner = scene.add.image(0, 0, EXTRAS_UI_KEY, GLOBAL_CURSOR_CORNER_NAMES[key]);
        corner.setOrigin(originX, originY);
        corner.setScale(scale);
        corner.setScrollFactor(0);
        corner.setDepth(depth);
        return corner;
      };
      return {
        topLeft: makeCorner('topLeft', 0, 0),
        topRight: makeCorner('topRight', 1, 0),
        bottomLeft: makeCorner('bottomLeft', 0, 1),
        bottomRight: makeCorner('bottomRight', 1, 1),
      };
    };

    // Abas empilhadas verticalmente na lateral ESQUERDA do livro — ver
    // comentário da constante `TAB_SCALE` acima pra técnica de ancoragem
    // (origin 1,0.5 + depth por cima da capa). Empilhamento incrementa o
    // eixo Y, não o X.
    const tabX = bookLeft + TAB_BOOK_OVERLAP;
    const totalTabsHeight = tabDefs.length * TAB_DISPLAY_THICKNESS + (tabDefs.length - 1) * TAB_GAP_Y;
    let tabY = centerY - totalTabsHeight / 2 + TAB_DISPLAY_THICKNESS / 2;
    const tabDepth = this.book.depth + 1;

    this.tabSelector = makeSelector(TAB_SELECTOR_SCALE, tabDepth + 2);
    this.gridSelector = makeSelector(SLOT_SCALE, 3003);

    for (const tabDef of tabDefs) {
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
      // Depth estritamente MAIOR que o da bandeirola (não só igual) — com
      // WebGL, dois objetos no mesmo `depth` nem sempre respeitam a ordem
      // de inserção no desenho, então o ícone podia sumir atrás dela.
      icon.setDepth(tabDepth + 1);

      // A interatividade fica na área (maior) da bandeirola, não só no
      // ícone — alvo de clique bem maior, mais fácil de acertar.
      background.setInteractive({ useHandCursor: true });
      background.disableInteractive();
      background.on(
        'pointerdown',
        (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
          if (!this.isOpen_) return;
          event.stopPropagation();
          playClick(scene);
          this.selectCategory(tabDef.category);
        },
      );
      background.on('pointerover', () => {
        if (!this.isOpen_) return;
        background.setTexture(SHOP_TAB_RIBBONS_KEY, tabDef.tabFrameHover);
      });
      background.on('pointerout', () => {
        if (!this.isOpen_) return;
        background.setTexture(SHOP_TAB_RIBBONS_KEY, tabDef.tabFrame);
      });

      this.tabs.push({ category: tabDef.category, background, icon, baseX: tabX, y: tabY });
      tabY += TAB_DISPLAY_THICKNESS + TAB_GAP_Y;
    }

    // Botão de fechar na lateral DIREITA do livro — mesma técnica das abas,
    // espelhada (origin pela esquerda, nasce um pouco pra dentro do livro e
    // cresce pra fora/direita, depth por CIMA da capa).
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
    // Ao APERTAR: troca pra arte do X pressionado e, ~90ms depois, fecha a tela.
    this.closeButton.on(
      'pointerdown',
      (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
        if (!this.isOpen_) return;
        event.stopPropagation();
        playClick(scene);
        this.closeButtonMark.setFrame(CLOSE_X_ICON_PRESSED_FRAME.name);
        setTimeout(() => {
          if (this.isOpen_) {
            this.closeButtonMark.setFrame(CLOSE_X_ICON_FRAME.name);
            this.close();
          }
        }, 90);
      },
    );

    this.closeButtonMark = scene.add.image(
      closeX + CLOSE_X_OFFSET_X + CLOSE_X_ADJUST_X,
      centerY + CLOSE_X_ADJUST_Y,
      CLOSE_BUTTON_SHEET_KEY,
      CLOSE_X_ICON_FRAME.name,
    );
    this.closeButtonMark.setOrigin(0.5, 0.5);
    this.closeButtonMark.setScale(computeFitScale(this.closeButtonMark, CLOSE_X_TARGET_PX));
    this.closeButtonMark.setScrollFactor(0);
    this.closeButtonMark.setDepth(closeDepth + 1);

    // Página ESQUERDA: grid de itens à venda (célula = quadrado individual do
    // Inventário, centralizada dentro da área de papel em branco da página).
    const slotWidth = INVENTORY_SLOT_RECT.width * SLOT_SCALE;
    const slotHeight = INVENTORY_SLOT_RECT.height * SLOT_SCALE;
    const gridWidth = GRID_COLS * slotWidth + (GRID_COLS - 1) * SLOT_GAP;
    const gridHeight = GRID_ROWS * slotHeight + (GRID_ROWS - 1) * ROW_GAP;

    const pageTop = bookTop + PAGE_RECT.top * BOOK_SCALE;
    const pageHeight = PAGE_RECT.height * BOOK_SCALE;
    const startY = pageTop + (pageHeight - gridHeight) / 2 + slotHeight / 2;

    const leftPageWidth = PAGE_RECT.left.width * BOOK_SCALE;
    const leftStartX = bookLeft + PAGE_RECT.left.x * BOOK_SCALE + (leftPageWidth - gridWidth) / 2 + slotWidth / 2;

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
      // Clicar no slot só SELECIONA o item (detalhe na página direita) — comprar é o botão.
      frame.on(
        'pointerdown',
        (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
          if (!this.isOpen_) return;
          event.stopPropagation();
          const slot = this.slots[index];
          if (slot.itemId) {
            playClick(scene);
            this.selectItem(slot.itemId);
          }
        },
      );

      const icon = scene.add.image(x, y, INVENTORY_PANEL_KEY, INVENTORY_SLOT_FRAME_NAME);
      icon.setOrigin(0.5, 0.5);
      icon.setScrollFactor(0);
      icon.setDepth(3002);

      const priceText = scene.add.text(x, y + slotHeight / 2 + 2, '', {
        fontFamily: 'monospace',
        fontSize: '11px',
        fontStyle: 'bold',
        color: TEXT_PRICE,
      });
      priceText.setOrigin(0.5, 0);
      priceText.setScrollFactor(0);
      priceText.setDepth(3002);

      this.slots.push({ itemId: '', price: 0, frame, icon, priceText });
    }

    // Página DIREITA: painel do ícone grande + painel de texto + botão Comprar
    // (mesmo esquema do detalhe da aba Agricultura, ver `InventoryScreen`).
    const rightPageWidth = PAGE_RECT.right.width * BOOK_SCALE;
    const rightCenterX = bookLeft + PAGE_RECT.right.x * BOOK_SCALE + rightPageWidth / 2;
    const detailTop = pageTop + 4;
    const iconPanelY = detailTop + DETAIL_ICON_PANEL_HEIGHT / 2;
    const textPanelY = detailTop + DETAIL_ICON_PANEL_HEIGHT + DETAIL_GAP + DETAIL_TEXT_PANEL_HEIGHT / 2;
    const buyY = detailTop + DETAIL_ICON_PANEL_HEIGHT + DETAIL_GAP + DETAIL_TEXT_PANEL_HEIGHT + DETAIL_GAP + BUY_BUTTON_HEIGHT / 2;

    const makeLargePanel = (y: number, width: number, height: number): Phaser.GameObjects.NineSlice => {
      const panel = scene.add.nineslice(
        rightCenterX,
        y,
        INVENTORY_LARGE_PANEL_KEY,
        INVENTORY_LARGE_PANEL_FRAME_NAME,
        width,
        height,
        INVENTORY_LARGE_PANEL_BORDER,
        INVENTORY_LARGE_PANEL_BORDER,
        INVENTORY_LARGE_PANEL_BORDER,
        INVENTORY_LARGE_PANEL_BORDER,
      );
      panel.setOrigin(0.5, 0.5);
      panel.setScrollFactor(0);
      panel.setDepth(3001);
      return panel;
    };

    this.detailIconPanel = makeLargePanel(iconPanelY, DETAIL_ICON_PANEL_WIDTH, DETAIL_ICON_PANEL_HEIGHT);
    this.detailIcon = scene.add.image(rightCenterX, iconPanelY, INVENTORY_PANEL_KEY, INVENTORY_SLOT_FRAME_NAME);
    this.detailIcon.setOrigin(0.5, 0.5);
    this.detailIcon.setScrollFactor(0);
    this.detailIcon.setDepth(3002);

    // Ações (mover/cancelar/destruir): uma coluna de 3 ícones colada ao lado direito do painel do ícone.
    const hudTexture = scene.textures.get(CLOSE_BUTTON_SHEET_KEY);
    for (const frame of [MOVE_ICON_FRAME, CLOSE_X_ICON_FRAME, DELETE_ICON_FRAME]) {
      if (!hudTexture.has(frame.name)) hudTexture.add(frame.name, 0, frame.rect.x, frame.rect.y, frame.rect.width, frame.rect.height);
    }
    const actionX = rightCenterX + DETAIL_ICON_PANEL_WIDTH / 2 + 6 + ACTION_BUTTON_SIZE / 2;
    this.actionColumnY = iconPanelY;
    ACTION_ORDER.forEach((action) => {
      const y = iconPanelY;
      const background = scene.add.nineslice(
        actionX,
        y,
        INVENTORY_PANEL_KEY,
        INVENTORY_PANEL_FRAME_NAME,
        ACTION_BUTTON_SIZE,
        ACTION_BUTTON_SIZE,
        INVENTORY_PANEL_BORDER,
        INVENTORY_PANEL_BORDER,
        INVENTORY_PANEL_BORDER,
        INVENTORY_PANEL_BORDER,
      );
      background.setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(3001);
      const icon = scene.add.image(actionX, y, CLOSE_BUTTON_SHEET_KEY, ACTION_FRAMES[action]);
      icon.setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(3002);
      icon.setScale(computeFitScale(icon, ACTION_ICON_TARGET_PX));
      background.setInteractive({ useHandCursor: true });
      background.disableInteractive();
      background.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
        if (!this.isOpen_ || !this.selectedItemId) return;
        event.stopPropagation();
        playClick(scene);
        this.actions?.onAction(this.selectedItemId, action);
      });
      background.on('pointerover', () => {
        if (!this.isOpen_) return;
        background.setTint(0xffe9b3);
        this.actionHint.setText(ACTION_LABELS[action]).setVisible(true);
      });
      background.on('pointerout', () => {
        background.clearTint();
        this.actionHint.setVisible(false);
      });
      this.actionButtons.set(action, { background, icon });
    });
    this.actionHint = scene.add.text(rightCenterX, iconPanelY + DETAIL_ICON_PANEL_HEIGHT / 2 - 12, '', {
      fontFamily: FONT,
      fontSize: '11px',
      fontStyle: 'bold',
      color: TEXT_INK,
    });
    this.actionHint.setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(3003).setVisible(false);

    this.detailTextPanel = makeLargePanel(textPanelY, DETAIL_TEXT_PANEL_WIDTH, DETAIL_TEXT_PANEL_HEIGHT);
    const textTop = textPanelY - DETAIL_TEXT_PANEL_HEIGHT / 2;
    const textWrapWidth = DETAIL_TEXT_PANEL_WIDTH - INVENTORY_LARGE_PANEL_BORDER * 2 + 8;

    this.detailName = scene.add.text(rightCenterX, textTop + 22, '', {
      fontFamily: FONT,
      fontSize: '13px',
      fontStyle: 'bold',
      color: TEXT_INK,
      align: 'center',
      wordWrap: { width: textWrapWidth },
    });
    this.detailName.setOrigin(0.5, 0.5);
    this.detailName.setScrollFactor(0);
    this.detailName.setDepth(3002);

    this.detailDescription = scene.add.text(rightCenterX, textTop + 38, '', {
      fontFamily: FONT,
      fontSize: '10px',
      color: TEXT_SOFT,
      align: 'center',
      wordWrap: { width: textWrapWidth },
    });
    this.detailDescription.setOrigin(0.5, 0);
    this.detailDescription.setScrollFactor(0);
    this.detailDescription.setDepth(3002);

    this.detailMaterials = scene.add.text(rightCenterX, textTop + DETAIL_TEXT_PANEL_HEIGHT - 30, '', {
      fontFamily: FONT,
      fontSize: '11px',
      fontStyle: 'bold',
      color: TEXT_PRICE,
      align: 'center',
      wordWrap: { width: textWrapWidth },
    });
    this.detailMaterials.setOrigin(0.5, 1); // Ancorado embaixo (logo acima do preço): se quebrar em 2 linhas, cresce pra cima.
    this.detailMaterials.setScrollFactor(0);
    this.detailMaterials.setDepth(3002);

    this.detailPrice = scene.add.text(rightCenterX, textTop + DETAIL_TEXT_PANEL_HEIGHT - 20, '', {
      fontFamily: FONT,
      fontSize: '12px',
      fontStyle: 'bold',
      color: TEXT_PRICE,
      align: 'center',
    });
    this.detailPrice.setOrigin(0.5, 0.5);
    this.detailPrice.setScrollFactor(0);
    this.detailPrice.setDepth(3002);

    this.buyButton = scene.add.nineslice(
      rightCenterX,
      buyY,
      INVENTORY_PANEL_KEY,
      INVENTORY_PANEL_FRAME_NAME,
      BUY_BUTTON_WIDTH,
      BUY_BUTTON_HEIGHT,
      INVENTORY_PANEL_BORDER,
      INVENTORY_PANEL_BORDER,
      INVENTORY_PANEL_BORDER,
      INVENTORY_PANEL_BORDER,
    );
    this.buyButton.setOrigin(0.5, 0.5);
    this.buyButton.setScrollFactor(0);
    this.buyButton.setDepth(3001);
    this.buyButton.setInteractive({ useHandCursor: true });
    this.buyButton.disableInteractive();
    this.buyButton.on(
      'pointerdown',
      (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
        if (!this.isOpen_) return;
        event.stopPropagation();
        if (!this.canBuySelected()) return;
        playClick(scene);
        scene.tweens.add({ targets: [this.buyButton, this.buyLabel], scale: 0.94, duration: 60, yoyo: true });
        this.onBuy(this.selectedItemId!);
      },
    );

    this.buyLabel = scene.add.text(rightCenterX, buyY, 'Comprar', {
      fontFamily: FONT,
      fontSize: '13px',
      fontStyle: 'bold',
      color: TEXT_INK,
    });
    this.buyLabel.setOrigin(0.5, 0.5);
    this.buyLabel.setScrollFactor(0);
    this.buyLabel.setDepth(3002);

    this.emptyText = scene.add.text(bookLeft + PAGE_RECT.left.x * BOOK_SCALE + leftPageWidth / 2, centerY, 'Em breve', {
      fontFamily: 'monospace',
      fontSize: '16px',
      fontStyle: 'bold',
      color: TEXT_SOFT,
    });
    this.emptyText.setOrigin(0.5, 0.5);
    this.emptyText.setScrollFactor(0);
    this.emptyText.setDepth(3002);

    this.selectFirstOfCategory();
    this.renderActiveCategory();
    this.setElementsVisible(false);
  }

  isOpen(): boolean {
    return this.isOpen_;
  }

  open(): void {
    this.isOpen_ = true;
    this.renderActiveCategory();
    this.setElementsVisible(true);
  }

  close(): void {
    this.isOpen_ = false;
    this.setElementsVisible(false);
  }

  toggle(): void {
    if (this.isOpen_) this.close();
    else this.open();
  }

  /** Reflete o saldo: escurece os itens que o jogador não pode pagar e liga/desliga o botão Comprar. */
  refresh(coins: number): void {
    this.lastCoins = coins;
    for (const slot of this.slots) {
      if (!slot.itemId) continue;
      const item = this.currentItems().find((candidate) => candidate.id === slot.itemId);
      slot.icon.setAlpha(item && this.canAfford(item) ? AFFORDABLE_ALPHA : UNAFFORDABLE_ALPHA);
    }
    this.renderDetail();
  }

  private currentItems(): ShopItem[] {
    return this.itemsByCategory.get(this.activeCategory) ?? [];
  }

  private selectedItem(): ShopItem | undefined {
    return this.currentItems().find((item) => item.id === this.selectedItemId);
  }

  /** Tem moedas E materiais pra este item, e nada o bloqueia (ex.: falta o tier anterior da ferramenta)? */
  private canAfford(item: ShopItem): boolean {
    if (this.lastCoins < item.price) return false;
    if (this.requirements?.blockedReason?.(item.id)) return false;
    return (item.materials ?? []).every((material) => (this.requirements?.count(material.resourceId) ?? 0) >= material.amount);
  }

  /** Dá pra comprar o item selecionado agora? (tem saldo/materiais e ainda não possui, no caso de itens únicos). */
  private canBuySelected(): boolean {
    const item = this.selectedItem();
    return !!item && this.canAfford(item) && !this.isOwned(item.id);
  }

  /** Troca a aba ativa, seleciona o 1º item dela e redesenha. */
  private selectCategory(category: ShopCategory): void {
    if (category === this.activeCategory) return;
    this.activeCategory = category;
    this.selectFirstOfCategory();
    this.renderActiveCategory();
    this.refresh(this.lastCoins);
  }

  private selectFirstOfCategory(): void {
    this.selectedItemId = this.currentItems()[0]?.id ?? null;
  }

  private selectItem(itemId: string): void {
    this.selectedItemId = itemId;
    this.positionGridSelector();
    this.renderDetail();
  }

  /** Redesenha o pool de slots com os itens da categoria ativa — sobra fica vazia/invisível; sem itens, mostra "Em breve". */
  private renderActiveCategory(): void {
    const items = this.currentItems();

    for (const tab of this.tabs) {
      tab.background.setPosition(tab.baseX, tab.y);
      tab.icon.setPosition(tab.baseX + TAB_ICON_OFFSET_X, tab.y + TAB_ICON_OFFSET_Y);
    }
    this.positionTabSelector();

    this.slots.forEach((slot, index) => {
      const item = items[index];
      if (!item) {
        slot.itemId = '';
        slot.price = 0;
        slot.icon.setVisible(false);
        slot.priceText.setVisible(false);
        return;
      }

      slot.itemId = item.id;
      slot.price = item.price;
      slot.icon.setTexture(item.textureKey, item.iconFrame);
      // Ícones de origens diferentes (semente, decoração) têm tamanhos
      // nativos bem diferentes (ex.: o Poço, 28x38 vs 16x16 padrão) — sem
      // isso o Poço vazava pra fora do slot.
      slot.icon.setScale(computeFitScale(slot.icon, ICON_TARGET_PX));
      slot.priceText.setText(`${item.price}`);
      slot.icon.setVisible(this.isOpen_);
      slot.priceText.setVisible(this.isOpen_);
      if (this.isOpen_) slot.frame.setInteractive();
    });
    for (const slot of this.slots) {
      if (!slot.itemId) slot.frame.disableInteractive();
    }

    this.emptyText.setVisible(this.isOpen_ && items.length === 0);
    this.positionGridSelector();
    this.renderDetail();
  }

  /** Página direita: ícone grande, nome, descrição, preço e estado do botão do item selecionado. */
  /**
   * Mostra a descrição sem vazar da caixinha: parte da fonte normal e vai reduzindo 1px até o texto caber na altura livre (entre o nome e
   * o preço) ou chegar ao mínimo legível (`DETAIL_DESCRIPTION_MIN_FONT_PX`). Descrições curtas continuam no tamanho de sempre.
   */
  private fitDescription(text: string, maxHeight: number): void {
    this.detailDescription.setText(text);
    let size = DETAIL_DESCRIPTION_FONT_PX;
    this.detailDescription.setFontSize(size);
    while (this.detailDescription.height > maxHeight && size > DETAIL_DESCRIPTION_MIN_FONT_PX) {
      size -= 1;
      this.detailDescription.setFontSize(size);
    }
  }

  private renderDetail(): void {
    const item = this.selectedItem();
    const showDetail = this.isOpen_ && !!item;

    this.detailIconPanel.setVisible(this.isOpen_);
    this.detailTextPanel.setVisible(this.isOpen_);
    this.buyButton.setVisible(showDetail);
    this.buyLabel.setVisible(showDetail);
    this.detailIcon.setVisible(showDetail);
    this.detailName.setVisible(showDetail);
    this.detailDescription.setVisible(showDetail);
    this.detailPrice.setVisible(showDetail);
    this.detailMaterials.setVisible(false);

    // Ações do item (só a loja do Marceneiro): mostra só os ícones que valem agora.
    const available = showDetail && this.actions && item ? this.actions.available(item.id) : [];
    const shown = ACTION_ORDER.filter((action) => available.includes(action));
    for (const [action, button] of this.actionButtons) {
      const on = shown.includes(action);
      if (on) {
        const y = this.actionColumnY + (shown.indexOf(action) - (shown.length - 1) / 2) * (ACTION_BUTTON_SIZE + ACTION_BUTTON_GAP);
        button.background.setY(y);
        button.icon.setY(y);
      }
      button.background.setVisible(on);
      button.icon.setVisible(on);
      if (on) button.background.setInteractive();
      else button.background.disableInteractive();
    }
    // A dica do ícone sob o mouse some quando esse ícone deixa de valer (ex.: acabou de destruir a última construção).
    if (this.actionHint.visible && !available.some((action) => ACTION_LABELS[action] === this.actionHint.text)) this.actionHint.setVisible(false);
    if (!item) return;

    this.detailIcon.setTexture(item.textureKey, item.iconFrame);
    this.detailIcon.setScale(computeFitScale(this.detailIcon, DETAIL_ICON_TARGET_PX));
    this.detailName.setText(item.name);
    const owned = this.isOwned(item.id);
    // Entre a descrição e o preço: o motivo de não poder comprar (ex.: "Precisa: Machado de Madeira") ou os materiais exigidos com o que o jogador tem ("5 Barra de Cobre (2/5)"), vermelho se falta.
    const blocked = owned ? null : this.requirements?.blockedReason?.(item.id) ?? null;
    const materials = owned ? [] : item.materials ?? [];
    const hasMaterialsLine = !!blocked || materials.length > 0;
    this.fitDescription(item.description, hasMaterialsLine ? DETAIL_DESCRIPTION_MAX_HEIGHT_WITH_MATERIALS : DETAIL_DESCRIPTION_MAX_HEIGHT);
    if (blocked) {
      this.detailMaterials.setText(blocked).setColor('#a8322d');
    } else if (materials.length > 0) {
      const lines = materials.map((material) => `${material.name}: ${Math.min(this.requirements?.count(material.resourceId) ?? 0, 999)}/${material.amount}`);
      const missing = materials.some((material) => (this.requirements?.count(material.resourceId) ?? 0) < material.amount);
      this.detailMaterials.setText(lines.join('\n')).setColor(missing ? '#a8322d' : '#2f6b2f');
    }
    this.detailMaterials.setVisible(showDetail && hasMaterialsLine);

    const affordable = this.canAfford(item);
    this.detailPrice.setText(owned ? 'Já possui' : `Preço: ${item.price} moedas`);
    this.detailPrice.setColor(owned || this.lastCoins >= item.price ? TEXT_PRICE : '#a8322d');

    const enabled = !owned && affordable;
    this.buyLabel.setText(owned ? 'Já possui' : 'Comprar');
    this.buyButton.setTint(enabled ? BUY_ENABLED_TINT : BUY_DISABLED_TINT);
    this.buyLabel.setAlpha(enabled ? 1 : 0.6);
    if (this.isOpen_ && enabled) this.buyButton.setInteractive();
    else this.buyButton.disableInteractive();
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

  /** Cantinhos de destaque ao redor do slot do item selecionado (somem se não houver seleção ou a Loja estiver fechada). */
  private positionGridSelector(): void {
    const slot = this.slots.find((candidate) => candidate.itemId && candidate.itemId === this.selectedItemId);
    for (const corner of Object.values(this.gridSelector)) corner.setVisible(this.isOpen_ && !!slot);
    if (!slot) return;

    const bounds = slot.frame.getBounds();
    const left = bounds.left - TAB_SELECTOR_PADDING;
    const top = bounds.top - TAB_SELECTOR_PADDING;
    const right = bounds.right + TAB_SELECTOR_PADDING;
    const bottom = bounds.bottom + TAB_SELECTOR_PADDING;

    this.gridSelector.topLeft.setPosition(left, top);
    this.gridSelector.topRight.setPosition(right, top);
    this.gridSelector.bottomLeft.setPosition(left, bottom);
    this.gridSelector.bottomRight.setPosition(right, bottom);
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
      const slotVisible = visible && !!slot.itemId;
      slot.frame.setVisible(visible); // O fundo sempre aparece
      slot.icon.setVisible(slotVisible);
      slot.priceText.setVisible(slotVisible);

      // Só permite interagir (clicar) se tiver item dentro!
      if (visible && slot.itemId) slot.frame.setInteractive();
      else slot.frame.disableInteractive();
    }
    this.emptyText.setVisible(visible && this.currentItems().length === 0);

    this.positionGridSelector();
    this.renderDetail();
  }
}
