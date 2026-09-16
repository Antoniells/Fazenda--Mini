import Phaser from 'phaser';
import {
  INVENTORY_PANEL_KEY,
  INVENTORY_SLOT_FRAME_NAME,
  INVENTORY_SLOT_RECT,
  SHOP_BOOK_KEY,
  SHOP_BOOK_FRAME_NAME,
  CLOSE_TAB_BG_FRAME,
  CLOSE_BUTTON_SHEET_KEY,
  CLOSE_X_ICON_FRAME,
  CLOSE_X_ICON_PRESSED_FRAME,
} from '../data/ui';
import { computeFitScale } from './slotIcon';
import { Inventory } from '../systems/inventory';
import { RECIPES, RecipeDefinition } from '../data/recipes';
import { RESOURCES } from '../data/resources';
import { resolveSlotVisual } from '../data/items';

const BOOK_SCALE = 2.2;
const SLOT_SCALE = 1.7;
const SLOT_GAP = 5;
const ROW_GAP = 16;
/** Mesma grade da Loja/Inventário (Fase 8 — Crafting): 6 colunas x 4 linhas por página. */
const GRID_COLS = 6;
const GRID_ROWS = 4;
const ITEMS_PER_PAGE = GRID_COLS * GRID_ROWS;
const ICON_FILL_RATIO = 0.8;
const ICON_TARGET_PX = 16 * SLOT_SCALE * ICON_FILL_RATIO;
const AFFORDABLE_ALPHA = 1;
const UNAFFORDABLE_ALPHA = 0.45;

/** Mesmo recorte de página (esquerda/direita) já pixel-verificado em `ShopMenu` — mesmo asset (`Book.png`), mesmo layout. */
const PAGE_RECT = {
  left: { x: 14, width: 100 },
  right: { x: 124, width: 96 },
  top: 4,
  height: 119,
};

const CLOSE_MARK_SCALE = 1.8;
const CLOSE_BOOK_OVERLAP = 30;
const CLOSE_X_TARGET_PX = 30;
const CLOSE_X_OFFSET_X = CLOSE_BOOK_OVERLAP + (CLOSE_TAB_BG_FRAME.rect.width * CLOSE_MARK_SCALE - CLOSE_BOOK_OVERLAP) / 2;

interface CraftingSlot {
  recipeId: string;
  ingredients: RecipeDefinition['ingredients'];
  frame: Phaser.GameObjects.Image;
  icon: Phaser.GameObjects.Image;
  ingredientsText: Phaser.GameObjects.Text;
}

/**
 * Bancada de Trabalho (Fase 8 — Crafting): mesmo layout/lógica visual do
 * `ShopMenu` (fundo de `Book.png`, grid de slots com o mesmo quadrado do
 * Inventário, botão de fechar) — pedido explícito do usuário pra manter a
 * consistência visual entre as 3 telas de livro do jogo. Sem abas (só
 * existe uma "categoria": as receitas já desbloqueadas), e a segunda linha
 * de cada slot mostra os INGREDIENTES exigidos (`RecipeDefinition.ingredients`,
 * ex. "10 Madeira") em vez de preço em moedas — fabricar não custa moedas,
 * só o que já foi gasto na hora de comprar a receita na Loja
 * (`Inventory.unlockRecipe`, ver `data/recipes.ts`).
 *
 * Puramente visual e de clique, igual ao `ShopMenu`: quem decide se a
 * fabricação é válida e efetivamente debita os recursos/dá o item é sempre
 * quem passa o callback `onCraft` (`UIScene`, ver `toggleCraftingMenu`) —
 * este painel só pede a fabricação e depois reflete o resultado (`refresh`).
 */
export class CraftingMenu {
  private readonly book: Phaser.GameObjects.Image;
  private readonly slots: CraftingSlot[] = [];
  private readonly emptyText: Phaser.GameObjects.Text;
  private readonly closeButton: Phaser.GameObjects.Image;
  private readonly closeButtonMark: Phaser.GameObjects.Image;
  private isOpen_ = false;

  constructor(scene: Phaser.Scene, onCraft: (recipeId: string) => void) {
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

    // Botão de fechar na lateral direita — mesma técnica/asset do `ShopMenu`.
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

    // Geometria do grid — idêntica ao `ShopMenu` (mesmo quadrado de slot,
    // mesmas duas páginas do livro).
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

    // Duas páginas cheias sempre alocadas (48 slots), igual ao `ShopMenu` —
    // hoje só 8 receitas existem (`data/recipes.ts`), mas o grid não muda
    // de tamanho se mais forem adicionadas depois.
    const totalSlots = ITEMS_PER_PAGE * 2;

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
          const slot = this.slots[index];
          if (slot.recipeId) onCraft(slot.recipeId);
        },
      );

      const icon = scene.add.image(x, y, INVENTORY_PANEL_KEY, INVENTORY_SLOT_FRAME_NAME);
      icon.setOrigin(0.5, 0.5);
      icon.setScrollFactor(0);
      icon.setDepth(3002);

      const ingredientsText = scene.add.text(x, y + slotHeight / 2 + 2, '', {
        fontFamily: 'monospace',
        fontSize: '9px',
        fontStyle: 'bold',
        color: '#6b3f1f',
        align: 'center',
      });
      ingredientsText.setOrigin(0.5, 0);
      ingredientsText.setScrollFactor(0);
      ingredientsText.setDepth(3002);

      this.slots.push({ recipeId: '', ingredients: [], frame, icon, ingredientsText });
    }

    this.emptyText = scene.add.text(centerX, centerY, 'Nenhuma receita ainda', {
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

  open(inventory: Inventory): void {
    this.isOpen_ = true;
    this.refresh(inventory);
    this.setElementsVisible(true);
  }

  close(): void {
    this.isOpen_ = false;
    this.setElementsVisible(false);
  }

  toggle(inventory: Inventory): void {
    if (this.isOpen_) this.close();
    else this.open(inventory);
  }

  /**
   * Redesenha o grid com as receitas atualmente desbloqueadas
   * (`Inventory.hasRecipe`, uma por uma sobre `data/recipes.ts` — o
   * `Inventory` guarda só um `Set` de ids desbloqueados, não uma lista
   * pronta pra UI) e escurece (`UNAFFORDABLE_ALPHA`) as que faltam recurso
   * no estoque agora. Chamado ao abrir e depois de cada fabricação.
   */
  refresh(inventory: Inventory): void {
    const unlockedRecipes = Object.values(RECIPES).filter((recipe) => inventory.hasRecipe(recipe.id));

    this.slots.forEach((slot, index) => {
      const recipe = unlockedRecipes[index];
      if (!recipe) {
        slot.recipeId = '';
        slot.ingredients = [];
        slot.icon.setVisible(false);
        slot.ingredientsText.setVisible(false);
        return;
      }

      const itemVisual = resolveSlotVisual({ category: recipe.category === 'armor' ? 'armor' : 'tool', id: recipe.itemId });

      slot.recipeId = recipe.id;
      slot.ingredients = recipe.ingredients;
      if (itemVisual) {
        slot.icon.setTexture(itemVisual.textureKey, itemVisual.iconFrame);
        slot.icon.setScale(computeFitScale(slot.icon, ICON_TARGET_PX));
      }

      const ingredientsLabel = recipe.ingredients
        .map((ingredient) => `${ingredient.amount} ${RESOURCES[ingredient.resourceId]?.name ?? ingredient.resourceId}`)
        .join('\n');
      slot.ingredientsText.setFontSize(recipe.ingredients.length > 1 ? 9 : 11);
      slot.ingredientsText.setText(ingredientsLabel);

      const canAfford = recipe.ingredients.every((ingredient) => inventory.getResourceCount(ingredient.resourceId) >= ingredient.amount);
      slot.icon.setAlpha(canAfford ? AFFORDABLE_ALPHA : UNAFFORDABLE_ALPHA);

      slot.icon.setVisible(true);
      slot.ingredientsText.setVisible(true);
    });

    if (this.isOpen_) {
      for (const slot of this.slots) {
        const slotVisible = !!slot.recipeId;
        slot.icon.setVisible(slotVisible);
        slot.ingredientsText.setVisible(slotVisible);
        if (slotVisible) slot.frame.setInteractive();
        else slot.frame.disableInteractive();
      }
      this.emptyText.setVisible(unlockedRecipes.length === 0);
    }
  }

  private setElementsVisible(visible: boolean): void {
    this.book.setVisible(visible);

    this.closeButton.setVisible(visible);
    if (visible) this.closeButton.setInteractive();
    else this.closeButton.disableInteractive();
    this.closeButtonMark.setVisible(visible);

    for (const slot of this.slots) {
      const slotVisible = visible && !!slot.recipeId;
      slot.frame.setVisible(visible);
      slot.icon.setVisible(slotVisible);
      slot.ingredientsText.setVisible(slotVisible);

      if (visible && slot.recipeId) slot.frame.setInteractive();
      else slot.frame.disableInteractive();
    }

    const hasAnyRecipe = this.slots.some((slot) => !!slot.recipeId);
    this.emptyText.setVisible(visible && !hasAnyRecipe);
  }
}
