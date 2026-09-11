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
