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
 * Quatro cantinhos de "cursor de seleção" no mesmo spritesheet, cada um
 * uma peça em L que, combinada com as outras três, forma uma moldura
 * discreta ao redor de uma célula. Usados pelo `TileCursor` para destacar
 * o canteiro sob o mouse, em vez de desenhar um quadrado por código.
 *
 * Os retângulos abaixo são os limites reais dos pixels não-transparentes
 * de cada cantinho (confirmados varrendo o PNG pixel a pixel, não
 * estimados visualmente): cada peça é 4x4, não 8x8 como uma primeira
 * inspeção visual sugeria — a diferença eram só pixels transparentes ao
 * redor. Os dois da esquerda (topLeft/bottomLeft) começam em x=119; usar
 * x=120 (um pixel a mais) cortava a coluna mais à esquerda da peça, que é
 * exatamente o defeito visual relatado.
 */
export const SELECTION_CORNER_NAMES = {
  topLeft: 'selection-corner-tl',
  topRight: 'selection-corner-tr',
  bottomLeft: 'selection-corner-bl',
  bottomRight: 'selection-corner-br',
} as const;

export const SELECTION_CORNER_RECTS = {
  topLeft: { x: 119, y: 6, width: 4, height: 4 },
  topRight: { x: 133, y: 6, width: 4, height: 4 },
  bottomLeft: { x: 119, y: 20, width: 4, height: 4 },
  bottomRight: { x: 133, y: 20, width: 4, height: 4 },
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

/** `UI/Clock/Clock.png`: ícone único (32x32, sol/lua num mostrador), sem frames. Usado na `ClockBar` (Fase 7 — Sistema de Tempo). */
export const CLOCK_ICON_KEY = 'ui-clock';
export const CLOCK_ICON_PATH = 'UI/Clock/Clock.png';
