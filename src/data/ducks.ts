/**
 * Os PATOS que nadam nas águas do mundo (`systems/ducks.ts`): o rio do fundo do menu e o lago da Floresta. Só enfeite — não
 * bloqueiam, não interagem. Arte: `Animals/Farm/Ducks/Duck Mallad.png` (4 x 14 quadros de 16 x 16); a 9ª fileira (quadros 32-35) é
 * o pato de lado nadando, com a linha d'água. Na folha ele OLHA PRA ESQUERDA: nadando pra direita, o quadro vai espelhado.
 */
export const DUCK_KEY = 'duck-mallard';
export const DUCK_PATH = 'Animals/Farm/Ducks/Duck Mallad.png';
export const DUCK_FRAME_SIZE = 16;
export const DUCK_SWIM_FRAMES = { start: 32, end: 35 } as const;
export const DUCK_SWIM_FRAME_RATE = 4;
/** Velocidade de nado (px de tela por segundo) e a pausa em cada ponta antes de dar a volta (ms). */
export const DUCK_SWIM_SPEED = 18;
export const DUCK_TURN_PAUSE_MS = 1200;
/**
 * Os patos do lago da Floresta (`DuckPond` em `systems/ducks.ts`) VÃO E VÊM: no máximo `FOREST_DUCKS` (um por raia); ao chegar na Floresta
 * cada raia tem `DUCK_PRESENT_CHANCE` de já ter um pato (0 a 3 patos), e de tempos em tempos (`DUCK_CHANGE_MS`) um pato some aos poucos na
 * água ou um novo aparece (`DUCK_FADE_MS`). Nunca de noite nem na chuva — começou a anoitecer ou a chover, os que estão lá somem.
 */
export const FOREST_DUCKS = 3;
export const DUCK_PRESENT_CHANCE = 0.5;
export const DUCK_CHANGE_MS = { min: 20_000, max: 45_000 };
export const DUCK_FADE_MS = 1500;
