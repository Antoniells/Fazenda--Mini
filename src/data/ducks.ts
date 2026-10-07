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
/** Quantos patos nadam no lago da Floresta. */
export const FOREST_DUCKS = 2;
