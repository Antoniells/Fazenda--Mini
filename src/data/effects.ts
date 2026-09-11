/**
 * Referências para assets de efeitos visuais temporários (Fase 9 antecipada
 * — polimento). Mesmo princípio das outras `data/*`: só descreve onde as
 * coisas estão, nenhuma lógica aqui.
 */

/**
 * `Tileset/Shadow.png` (192x64) é uma folha de sombras "9-slice" (com
 * variações de tamanho para esticar). O canto inferior esquerdo é uma
 * mancha oval simples e autocontida num único tile — confirmado por
 * recorte/zoom — usada como sombra de chão (`systems/shadow.ts`) e, com
 * tingimento marrom, como "poeira" da enxada (`FarmlandRenderer`).
 */
export const SHADOW_KEY = 'fx-shadow';
export const SHADOW_PATH = 'Tileset/Shadow.png';
export const SHADOW_FRAME_NAME = 'fx-shadow-blob';
export const SHADOW_FRAME = { x: 0, y: 48, width: 16, height: 16 };

/**
 * `Objects/Props/Sprash.png` (64x16): respingo d'água já azul, 4 frames de
 * 16x16 (espalha e desaparece) — confirmado visualmente, spritesheet
 * simples em grade, sem precisar de recorte manual.
 */
export const SPLASH_KEY = 'fx-splash';
export const SPLASH_PATH = 'Objects/Props/Sprash.png';
export const SPLASH_FRAME_SIZE = 16;
export const SPLASH_ANIM_KEY = 'fx-splash-anim';
export const SPLASH_FRAMES = { start: 0, end: 3 };
