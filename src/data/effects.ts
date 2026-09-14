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

/**
 * `Objects/Tree/Common/Effects/FX Effects Dark Forest leafs 2.png` (96x48):
 * grid uniforme de 16x16, 18 frames (6 colunas x 3 linhas) — folhinhas
 * verde-escuro/acastanhadas caindo e sumindo aos poucos, tom que combina com
 * o Pinheiro (única árvore cortável do jogo). Tocada uma vez a cada golpe de
 * Machado (Fase 9 — mecânica de hits), mesma técnica de `SPLASH_*` acima
 * (spritesheet simples em grade, sem recorte manual).
 */
export const LEAF_FALL_KEY = 'fx-leaf-fall';
export const LEAF_FALL_PATH = 'Objects/Tree/Common/Effects/FX Effects Dark Forest leafs 2.png';
export const LEAF_FALL_FRAME_SIZE = 16;
export const LEAF_FALL_ANIM_KEY = 'fx-leaf-fall-anim';
export const LEAF_FALL_FRAMES = { start: 0, end: 17 };
