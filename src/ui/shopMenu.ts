import Phaser from 'phaser';
import {
  INVENTORY_PANEL_KEY,
  INVENTORY_SLOT_FRAME_NAME,
  INVENTORY_SLOT_RECT,
  SHOP_BOOK_KEY,
  SHOP_BOOK_FRAME_NAME,
  SHOP_TAB_RIBBONS_KEY,
  CLOSE_TAB_BG_FRAME,
  CLOSE_BUTTON_SHEET_KEY,
  CLOSE_X_ICON_FRAME,
  CLOSE_X_ICON_PRESSED_FRAME,
} from '../data/ui';
import { computeFitScale } from './slotIcon';

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
const TAB_ACTIVE_SHIFT_X = 15;

/**
 * Botão de fechar (lado direito): fundo é o "marcador de página" de couro
 * de `Book.png` (`CLOSE_TAB_BG_FRAME`), mesma técnica de ancoragem das
 * abas espelhada (origin pela esquerda). Depth MAIOR que o do livro —
 * pedido explícito do usuário — desenha por CIMA da capa. O ícone "X"
 * (`CLOSE_X_ICON_FRAME`, de `UI/button.png`) fica centralizado na parte do
 * marcador que sai pra fora do livro, com depth um pouco maior que o do
 * marcador (só decorativo, pra ficar por cima dele).
 */
const CLOSE_MARK_SCALE = 1.8;
const CLOSE_BOOK_OVERLAP = 30;
// Maior que antes pra ajudar a destacar do marcador de couro por trás — o
// recorte placeholder de `CLOSE_X_ICON_FRAME` (ver `data/ui.ts`) é um
// "selo" marrom/laranja (mesma família de cor do couro), não um X vermelho
// isolado; baixo contraste é esperado até o usuário trocar pela coordenada
// definitiva.
const CLOSE_X_TARGET_PX = 30;
/** Centro da porção visível do marcador (mesma ideia do `TAB_ICON_OFFSET_X`, só que a partir da esquerda). */
const CLOSE_X_OFFSET_X = CLOSE_BOOK_OVERLAP + (CLOSE_TAB_BG_FRAME.rect.width * CLOSE_MARK_SCALE - CLOSE_BOOK_OVERLAP) / 2;

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

/** As 3 categorias da Loja (Fase 8) — preparadas para o upgrade futuro de ferramentas. */
export type ShopCategory = 'agriculture' | 'tools' | 'construction';

/**
 * Formato mínimo que qualquer coisa vendida na Loja precisa ter — sementes
 * (`CropDefinition`) e decorações (`DecorationDefinition`) são formas
 * diferentes na origem dos dados, mas ambas cabem aqui sem o `ShopMenu`
 * precisar saber a diferença entre elas. Quem monta essa lista (`MainScene`)
 * decide o preço de cada uma (`seedPrice` para culturas, `price` para
 * decorações) e a categoria/aba onde aparece.
 */
export interface ShopItem {
  id: string;
  category: ShopCategory;
  textureKey: string;
  /** Frame do ícone: número (spritesheet, culturas) ou nome (frame recortado à mão, decorações). */
  iconFrame: number | string;
  price: number;
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
  /** Posição X "de repouso" (aba inativa) — a ativa desloca `TAB_ACTIVE_SHIFT_X` a mais pra esquerda. */
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
 * Painel de compra com abas (Fase 8): fundo de `UI/Inventory/Book.png` (um
 * livro aberto), com 3 categorias (Agricultura/Ferramentas/Construções)
 * selecionáveis por ícones no canto superior esquerdo — preparando o
 * terreno para vender upgrades de ferramentas mais pra frente (aba já
 * existe, só sem itens ainda).
 *
 * Os itens são desenhados num GRID (6 colunas x 4 linhas por página, igual
 * à `InventoryScreen`), não numa barra horizontal — cada slot usa a mesma
 * imagem de quadrado individual de `inventory.png`
 * (`INVENTORY_SLOT_FRAME_NAME`) que o Inventário, para manter a
 * consistência visual entre as duas telas. Posição de cada item calculada
 * por módulo/divisão (`col = index % 6`, `row = Math.floor(index / 6)`);
 * passando de 24 itens (uma página cheia), os seguintes migram para o
 * `startX` da página direita. O pool de slots é dimensionado para a maior
 * categoria (reciclado ao trocar de aba, recicla textura/preço em vez de
 * recriar objetos).
 *
 * Fica oculto até `open()`/`toggle()`. Puramente visual e de clique: quem
 * decide se a compra é possível é sempre `Inventory`, via o callback
 * `onBuy` passado no construtor — este painel só pede a compra e depois
 * reflete o resultado (`refresh`), nunca decide sozinho.
 *
 * Bug corrigido (mantido nesta refatoração): os slots (e os ícones das
 * abas) ficavam permanentemente interativos mesmo com a Loja fechada —
 * como usam `setScrollFactor(0)` (posição fixa na tela), um clique no
 * MUNDO que caísse por baixo dessa região (ex.: o clique que abre a Loja)
 * também disparava `onBuy` no mesmo evento. `setElementsVisible` habilita/
 * desabilita (`setInteractive`/`disableInteractive`) cada slot junto da
 * visibilidade, e cada handler ainda confere `isOpen_` como segunda camada
 * de proteção.
 */
export class ShopMenu {
  private readonly book: Phaser.GameObjects.Image;
  private readonly tabs: ShopTab[] = [];
  private readonly slots: ShopSlot[] = [];
  private readonly emptyText: Phaser.GameObjects.Text;
  private readonly closeButton: Phaser.GameObjects.Image;
  private readonly closeButtonMark: Phaser.GameObjects.Image;
  private readonly itemsByCategory: Map<ShopCategory, ShopItem[]>;
  private activeCategory: ShopCategory;
  private isOpen_ = false;
  private lastCoins = 0;

  constructor(scene: Phaser.Scene, tabDefs: ShopTabDefinition[], items: ShopItem[], onBuy: (itemId: string) => void) {
    const texture = scene.textures.get(INVENTORY_PANEL_KEY);
    if (!texture.has(INVENTORY_SLOT_FRAME_NAME)) {
      texture.add(
        INVENTORY_SLOT_FRAME_NAME,
        0,
        INVENTORY_SLOT_RECT.x,
        INVENTORY_SLOT_RECT.y,
        INVENTORY_SLOT_RECT.width,
        INVENTORY_SLOT_RECT.height,
      );
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

    // Abas empilhadas verticalmente na lateral ESQUERDA do livro — ver
    // comentário da constante `TAB_SCALE` acima pra técnica de ancoragem
    // (origin 1,0.5 + depth por cima da capa). Empilhamento incrementa o
    // eixo Y, não o X.
    const tabX = bookLeft + TAB_BOOK_OVERLAP;
    const totalTabsHeight = tabDefs.length * TAB_DISPLAY_THICKNESS + (tabDefs.length - 1) * TAB_GAP_Y;
    let tabY = centerY - totalTabsHeight / 2 + TAB_DISPLAY_THICKNESS / 2;
    const tabDepth = this.book.depth + 1;

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
          this.selectCategory(tabDef.category);
        },
      );

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
// 1. Ao APERTAR o botão: muda para a arte do X clicado
this.closeButton.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      if (!this.isOpen_) return;
      event.stopPropagation();
      
      // 1. Muda a arte instantaneamente
      this.closeButtonMark.setFrame(CLOSE_X_ICON_PRESSED_FRAME.name); 

      // 2. O relógio nativo do sistema (setTimeout) conta 100ms e fecha a tela!
      setTimeout(() => {
        if (this.isOpen_) {
          this.closeButtonMark.setFrame(CLOSE_X_ICON_FRAME.name); 
          this.close(); 
        }
      }, 90);
    });

    const ajusteX = -16; // Valores negativos puxam para a esquerda
    const ajusteY = -8;  // Valores negativos sobem, positivos descem
    
    this.closeButtonMark = scene.add.image(
      closeX + CLOSE_X_OFFSET_X + ajusteX, 
      centerY + ajusteY, 
      CLOSE_BUTTON_SHEET_KEY, 
      CLOSE_X_ICON_FRAME.name
    );
    
    this.closeButtonMark.setOrigin(0.5, 0.5);
    this.closeButtonMark.setScale(computeFitScale(this.closeButtonMark, CLOSE_X_TARGET_PX));
    this.closeButtonMark.setScrollFactor(0);
    this.closeButtonMark.setDepth(closeDepth + 1);

    // Geometria do grid: célula = quadrado individual do Inventário,
    // centralizada dentro da área de papel em branco de cada página.
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

    // NOVO: Garantir que sempre crie slots suficientes para preencher as duas páginas do livro (48 slots),
    // ou mais se você tiver muitos itens à venda.
    const maxItemsPerCategory = Math.max(1, ...Array.from(this.itemsByCategory.values(), (list) => list.length));
    const totalSlots = Math.max(ITEMS_PER_PAGE * 2, Math.ceil(maxItemsPerCategory / (ITEMS_PER_PAGE * 2)) * (ITEMS_PER_PAGE * 2));

    for (let index = 0; index < totalSlots; index++) {
      // Descobre se o slot deve ser desenhado na página da Esquerda ou da Direita
      const page = Math.floor(index / ITEMS_PER_PAGE);
      const isLeftPage = page % 2 === 0;
      
      const indexInPage = index % ITEMS_PER_PAGE;
      const col = indexInPage % GRID_COLS;
      const row = Math.floor(indexInPage / GRID_COLS);

      // Aplica a posição inicial correta dependendo da página
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
          const slot = this.slots[index];
          if (slot.itemId) onBuy(slot.itemId);
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
        color: '#6b3f1f',
      });
      priceText.setOrigin(0.5, 0);
      priceText.setScrollFactor(0);
      priceText.setDepth(3002);

      this.slots.push({ itemId: '', price: 0, frame, icon, priceText });
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

    this.renderActiveCategory();
    this.setElementsVisible(false);
  }

  isOpen(): boolean {
    return this.isOpen_;
  }

  open(): void {
    this.isOpen_ = true;
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

  /** Escurece os ícones dos itens que o jogador não tem saldo para comprar no momento. */
  refresh(coins: number): void {
    this.lastCoins = coins;
    for (const slot of this.slots) {
      if (!slot.itemId) continue;
      const affordable = coins >= slot.price;
      slot.icon.setAlpha(affordable ? AFFORDABLE_ALPHA : UNAFFORDABLE_ALPHA);
    }
  }

  /** Troca a aba ativa e redesenha os slots com os itens dela. */
  private selectCategory(category: ShopCategory): void {
    if (category === this.activeCategory) return;
    this.activeCategory = category;
    this.renderActiveCategory();
    this.refresh(this.lastCoins);
  }

  /** Redesenha o pool de slots com os itens da categoria ativa — sobra fica vazia/invisível; sem itens, mostra "Em breve". */
  private renderActiveCategory(): void {
    const items = this.itemsByCategory.get(this.activeCategory) ?? [];

    // Aba ativa: "puxada" pra fora (mais pra esquerda) em relação às inativas.
    for (const tab of this.tabs) {
      const x = tab.category === this.activeCategory ? tab.baseX - TAB_ACTIVE_SHIFT_X : tab.baseX;
      tab.background.setPosition(x, tab.y);
      tab.icon.setPosition(x + TAB_ICON_OFFSET_X, tab.y + TAB_ICON_OFFSET_Y);
    }

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
      slot.icon.setVisible(true);
      slot.priceText.setVisible(true);
    });

    this.emptyText.setVisible(items.length === 0);
  }

private setElementsVisible(visible: boolean): void {
    this.book.setVisible(visible);
    for (const tab of this.tabs) {
      tab.background.setVisible(visible);
      tab.icon.setVisible(visible);
      if (visible) tab.background.setInteractive();
      else tab.background.disableInteractive();
    }

    this.closeButton.setVisible(visible);
    if (visible) this.closeButton.setInteractive();
    else this.closeButton.disableInteractive();
    this.closeButtonMark.setVisible(visible);

    for (const slot of this.slots) {
      const slotVisible = visible && !!slot.itemId;
      slot.frame.setVisible(visible); // O fundo sempre aparece
      slot.icon.setVisible(slotVisible);
      slot.priceText.setVisible(slotVisible);
      
      // NOVO: Só permite interagir (clicar) se tiver item dentro!
      if (visible && slot.itemId) slot.frame.setInteractive();
      else slot.frame.disableInteractive();
    }
    this.emptyText.setVisible(visible && (this.itemsByCategory.get(this.activeCategory)?.length ?? 0) === 0);
  }
}
