/**
 * Referências para os assets de interface (HUD). Igual às outras `data/*`,
 * só descreve onde estão as coisas no asset — nenhuma lógica aqui.
 *
 * O frame de slot vazio foi localizado recortando/ampliando
 * `UI/Inventory/Slots.png` pixel a pixel: o primeiro slot individual (a
 * moldura de madeira com fundo escuro, sem os separadores da barra de 8
 * slots) ocupa esse retângulo no spritesheet original.
 */
export const INVENTORY_UI_KEY = 'ui-inventory-slots';
export const INVENTORY_UI_PATH = 'UI/Inventory/Slots.png';

export const SLOT_FRAME_NAME = 'inventory-slot';
export const SLOT_FRAME_RECT = { x: 4, y: 8, width: 35, height: 26 };

/**
 * Quatro cantinhos de "cursor de seleção" no mesmo spritesheet (linha 1,
 * colunas 8-9), localizados por recorte/zoom — cada um é uma peça em L de
 * 8x8 que, combinada com as outras três, forma uma moldura discreta ao
 * redor de uma célula. Usados pelo `TileCursor` (Fase 9) para destacar o
 * canteiro sob o mouse, em vez de desenhar um quadrado por código.
 */
export const SELECTION_CORNER_NAMES = {
  topLeft: 'selection-corner-tl',
  topRight: 'selection-corner-tr',
  bottomLeft: 'selection-corner-bl',
  bottomRight: 'selection-corner-br',
} as const;

export const SELECTION_CORNER_RECTS = {
  topLeft: { x: 120, y: 6, width: 8, height: 8 },
  topRight: { x: 132, y: 6, width: 8, height: 8 },
  bottomLeft: { x: 120, y: 20, width: 8, height: 8 },
  bottomRight: { x: 132, y: 20, width: 8, height: 8 },
} as const;

/**
 * `UI/Money.png`: spritesheet 16x16 com 6 frames de uma moeda girando
 * (confirmado visualmente — largura plena, estreitando, de perfil,
 * alargando de novo). Usado como ícone animado na `CoinBar`.
 */
export const COIN_ICON_KEY = 'ui-coin';
export const COIN_ICON_PATH = 'UI/Money.png';
export const COIN_ICON_FRAME_SIZE = 16;
export const COIN_SPIN_ANIM_KEY = 'ui-coin-spin';
export const COIN_SPIN_FRAMES = { start: 0, end: 5 };
