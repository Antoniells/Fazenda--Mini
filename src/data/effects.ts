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
 * `Objects/Props/Sprinkler Water.png` (288x32, grade de 32x32; a 9ª célula é vazia): a água do Aspersor sobre o terreno arado (pedido
 * explícito), 2 quadros por ponta — 0-1 ponta pra direita, 2-3 pra esquerda, 4-5 pra cima, 6-7 pra baixo. Vêm em cinza (sem cor), por isso
 * `SPRINKLER_WATER_TINT` (um azul-água, mais saturado que o do respingo original pra não sumir sobre a terra) — mesma técnica de recolorir sprite já usada na poeira da Enxada
 * (`FarmlandRenderer`) e nas quebras (`breakEffect.ts`). Tocados por `systems/sprinklerWater.ts`.
 */
export const SPRINKLER_WATER_KEY = 'fx-sprinkler-water';
export const SPRINKLER_WATER_PATH = 'Objects/Props/Sprinkler Water.png';
export const SPRINKLER_WATER_FRAME_SIZE = 32;
export const SPRINKLER_WATER_TINT = 0x5cc8ff;
// A ponta fina aponta pro aspersor (pra dentro): o terreno à DIREITA dele usa os quadros com a ponta virada pra esquerda, e assim por diante.
export type SprinklerWaterSide = 'right' | 'left' | 'up' | 'down';
export const SPRINKLER_WATER_SIDES: Record<SprinklerWaterSide, { animKey: string; frames: [number, number] }> = {
  right: { animKey: 'fx-sprinkler-water-right', frames: [2, 3] },
  left: { animKey: 'fx-sprinkler-water-left', frames: [0, 1] },
  up: { animKey: 'fx-sprinkler-water-up', frames: [6, 7] },
  down: { animKey: 'fx-sprinkler-water-down', frames: [4, 5] },
};

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

/**
 * `Objects/Props/Water props.png` (64x16): 4 frames de 16x16 com riscos azuis
 * de chuva (gotas em queda) — usados como partículas em `ui/weatherOverlay.ts`.
 */
export const RAIN_KEY = 'fx-rain';
export const RAIN_PATH = 'Objects/Props/Water props.png';
export const RAIN_FRAME_SIZE = 16;
export const RAIN_FRAMES = [0, 1, 2, 3];

/**
 * `Animals/Forest/Bugs/Butterfly/*.png` (112x16): uma espécie por arquivo, 7 frames de 16x16 lado a lado — o ciclo
 * de bater as asas (aberta, de lado, aberta...). Usadas as espécies de uma linha só (as de duas linhas, como a
 * "Common Butterfly", têm uma segunda cor na linha de baixo). As borboletinhas da Fazenda (`systems/butterflies.ts`)
 * sorteiam uma espécie a cada nascimento.
 */
export const BUTTERFLY_FRAME_SIZE = 16;
export const BUTTERFLY_FRAMES = { start: 0, end: 6 };
export const BUTTERFLY_FLAP_FPS = 10;
const BUTTERFLY_DIR = 'Animals/Forest/Bugs/Butterfly';
export const BUTTERFLY_SPECIES = [
  { key: 'fx-butterfly-monarch', animKey: 'fx-butterfly-monarch-flap', path: `${BUTTERFLY_DIR}/Monarch Butterfly.png` },
  { key: 'fx-butterfly-cabbage', animKey: 'fx-butterfly-cabbage-flap', path: `${BUTTERFLY_DIR}/Cabbage White.png` },
  { key: 'fx-butterfly-azure', animKey: 'fx-butterfly-azure-flap', path: `${BUTTERFLY_DIR}/Azure Butterfly.png` },
  { key: 'fx-butterfly-orange-tip', animKey: 'fx-butterfly-orange-tip-flap', path: `${BUTTERFLY_DIR}/Orange Tip.png` },
  { key: 'fx-butterfly-sulphur', animKey: 'fx-butterfly-sulphur-flap', path: `${BUTTERFLY_DIR}/Cloudless Sulphur.png` },
];
