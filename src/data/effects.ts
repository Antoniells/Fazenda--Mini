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
 * Sombra de CONSTRUÇÃO (casas): o único quadro 100% liso da mesma folha `Shadow.png` (16x16 de preto a 30% de opacidade, sem borda — no meio do
 * bloco grande da direita). Esticado, vira uma faixa RETA de bordas retas (`systems/shadow.ts` `createBuildingShadow`), colada na base da parede.
 */
export const SHADOW_FLAT_FRAME_NAME = 'fx-shadow-flat';
export const SHADOW_FLAT_FRAME = { x: 144, y: 32, width: 16, height: 16 };

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
 * `Objects/Props/Water props.png` (64x16): 4 quadros de 16x16, cada um com TRÊS riscos azuis de chuva lado a lado. A chuva
 * (`ui/weatherOverlay.ts`) usa cada risco SOZINHO (pedido explícito: gotas de 1 em 1, não em trios): os 12 riscos recortados
 * (varredura pixel a pixel — 1 px de largura, 5 a 8 de altura; o inteiro, o partido e o com pinguinho de cada quadro).
 */
export const RAIN_KEY = 'fx-rain';
export const RAIN_PATH = 'Objects/Props/Water props.png';
export const RAIN_FRAME_SIZE = 16;
const RAIN_STREAK_RECTS: ReadonlyArray<[number, number, number]> = [
  // [x, y, altura] — por quadro: o risco da esquerda, o do meio e o da direita.
  [3, 5, 7], [7, 3, 7], [11, 5, 7],
  [19, 6, 7], [23, 4, 7], [27, 6, 7],
  [35, 6, 8], [39, 4, 8], [43, 6, 8],
  [51, 6, 5], [55, 4, 5], [59, 6, 5],
];
export const RAIN_DROP_FRAMES: ReadonlyArray<{ name: string; rect: { x: number; y: number; width: number; height: number } }> = RAIN_STREAK_RECTS.map(([x, y, height], index) => ({
  name: `fx-rain-drop-${index}`,
  rect: { x, y, width: 1, height },
}));

/**
 * A NEVE (`ui/weatherOverlay.ts`, no Inverno no lugar da chuva): os flocos de `Objects/Tree/Common/Effects/FX Effects Snow Leafs Winter 2.png`
 * (96x48), recortados um a um (varredura pixel a pixel): os 3 brancos de 3x3 e os 6 azul-claros de 2x3/3x2 — as folhinhas vermelhas da folha ficam de fora.
 */
export const SNOW_KEY = 'fx-snow';
export const SNOW_PATH = 'Objects/Tree/Common/Effects/FX Effects Snow Leafs Winter 2.png';
const SNOW_FLAKE_RECTS: ReadonlyArray<[number, number, number, number]> = [
  [37, 9, 3, 3], [69, 9, 3, 3], [7, 11, 3, 3],
  [91, 7, 2, 3], [57, 9, 2, 3], [23, 11, 2, 3],
  [64, 17, 3, 2], [33, 18, 3, 2], [3, 20, 3, 2],
];
export const SNOW_FLAKE_FRAMES: ReadonlyArray<{ name: string; rect: { x: number; y: number; width: number; height: number } }> = SNOW_FLAKE_RECTS.map(([x, y, width, height], index) => ({
  name: `fx-snow-flake-${index}`,
  rect: { x, y, width, height },
}));

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

/**
 * Brilho dos veios das Cavernas (`systems/oreSparkle.ts`, ideia do Terraria): as estrelinhas de `Character/Character/Others/Shine.png`
 * (32x16 — recortes da cruz 3x3 e do ponto de 1px). Cada tipo de veio cintila num ritmo (vezes por segundo, perto da luz do personagem
 * ainda mais) e numa cor — os raros (Ouro, Azurita) chamam mais atenção.
 */
export const SPARKLE_KEY = 'fx-sparkle';
export const SPARKLE_PATH = 'Character/Character/Others/Shine.png';
export const SPARKLE_CROSS_FRAME = { name: 'fx-sparkle-cross', rect: { x: 7, y: 3, width: 3, height: 3 } };
export const SPARKLE_DOT_FRAME = { name: 'fx-sparkle-dot', rect: { x: 24, y: 4, width: 1, height: 1 } };
export const ORE_SPARKLE: Record<'copper' | 'coal' | 'iron' | 'gold' | 'azurite', { perSecond: number; color: number }> = {
  coal: { perSecond: 0.04, color: 0xd6d6e6 },
  copper: { perSecond: 0.09, color: 0xffc89a },
  iron: { perSecond: 0.1, color: 0xeef2fa },
  gold: { perSecond: 0.2, color: 0xffe27a },
  azurite: { perSecond: 0.32, color: 0x9ef0ff },
};

/**
 * Folhas que caem das árvores (`systems/fallingLeaves.ts`, ideia do Terraria — mais folhas quanto mais vento): pétalas soltas de
 * `Crops/Fruits Tree/Old/Fruits/Spring/Leafs.png` (48x32, a "chuva" de pétalas da cerejeira), tingidas de VERDE em preenchimento sólido
 * (pedido explícito: folhas verdes — com 3x4 px o sombreado nem aparece, e o tom multiplicado sobre o rosa ficaria barrento).
 */
export const LEAF_KEY = 'fx-leaf';
export const LEAF_PATH = 'Crops/Fruits Tree/Old/Fruits/Spring/Leafs.png';
export const LEAF_FRAMES = [
  { name: 'fx-leaf-1', rect: { x: 6, y: 16, width: 3, height: 4 } },
  { name: 'fx-leaf-2', rect: { x: 10, y: 22, width: 3, height: 4 } },
  { name: 'fx-leaf-3', rect: { x: 32, y: 24, width: 3, height: 4 } },
];
// Verdes claros e amarelados: destacam da grama e da copa (verdes escuros somem no chão).
export const LEAF_GREENS = [0xa6d86a, 0xbfe27c, 0x8fcb5c, 0xd2e889];

/**
 * A CACHOEIRA (`Tileset/Spring Waterfall.png`, 512 x 128): a 1ª fileira são 8 quadros de 64 x 64 (= 4 x 4 células) da água caindo por um
 * paredão de terra, com grama dos lados e espuma embaixo — a água entra pela borda DE CIMA do quadro, então ela fica encostada na borda norte
 * do mapa, com a água logo abaixo. Usada no rio do fundo do menu e no lago da Floresta (`systems/waterfall.ts`).
 */
export const WATERFALL_KEY = 'waterfall';
export const WATERFALL_PATH = 'Tileset/Spring Waterfall.png';
export const WATERFALL_FRAME_SIZE = 64;
export const WATERFALL_FRAMES = 8;
export const WATERFALL_FPS = 8;

/**
 * ROCHAS NA ÁGUA (`Objects/Exterior/Beach/Stones.png` e `Stones 2.png`): a mesma rocha em 4 quadros, só a ondinha azul-clara em volta da
 * base mexendo (66 a 104 pixels de diferença entre os quadros — varredura pixel a pixel) — uma pequena (32 x 32) e uma grande (48 x 32).
 * Enfeite do lago da Floresta (`systems/waterRocks.ts`).
 */
export const WATER_ROCKS = {
  small: { key: 'water-rock-small', path: 'Objects/Exterior/Beach/Stones.png', frameWidth: 32, frameHeight: 32 },
  big: { key: 'water-rock-big', path: 'Objects/Exterior/Beach/Stones 2.png', frameWidth: 48, frameHeight: 32 },
} as const;
export type WaterRockSize = keyof typeof WATER_ROCKS;
export const WATER_ROCK_FRAMES = 4;
export const WATER_ROCK_FPS = 4;
