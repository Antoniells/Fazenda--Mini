import type { PlayerActionKey } from './player';

/**
 * FOME (`systems/hunger.ts`): uma barra de SACIEDADE de 0 a `MAX_SATIETY`. Trabalhar e lutar cansam — cada ação de `TIRING_ACTIONS` gasta
 * `ACTION_SATIETY_COST`; comer enche (`FOOD_SATIETY`). Com a barra vazia o personagem passa fome: perde `STARVE_DAMAGE` de vida a cada
 * `STARVE_INTERVAL_MS` de jogo (pode até desmaiar), até comer. Dormir não enche a barra — só comida. Bem alimentado (acima de
 * `REGEN_SATIETY_THRESHOLD`), a vida volta aos poucos e a barra cai junto (`REGEN_*`).
 */
export const MAX_SATIETY = 100;

/** As ações que cansam: atacar (espada), arar (enxada), regar, golpe de machado e golpe de picareta. */
export const TIRING_ACTIONS: readonly PlayerActionKey[] = ['sword', 'hoe', 'water', 'axe', 'pickaxe'];
export const ACTION_SATIETY_COST = 1;

/** Quanto cada comida enche: colheita da lavoura e material comestível (por id; ausente = `DEFAULT_FOOD_SATIETY`). */
export const CROP_SATIETY = 25;
export const DEFAULT_FOOD_SATIETY = 15;
export const FOOD_SATIETY: Readonly<Record<string, number>> = {
  'wild-berry': 15,
};

/** Barra vazia: meio coração (`HALF_HEART_HP` em `systems/playerHealth.ts`) a cada tanto de jogo rodando (menus abertos não contam). */
export const STARVE_INTERVAL_MS = 15_000;

/** Abaixo disto o personagem "está com fome" (o aviso aparece uma vez ao cruzar). */
export const HUNGRY_THRESHOLD = 20;

/** Ao acordar depois de desmaiar (por fome ou por luta), a barra volta pelo menos a isto — senão o jogador desmaiaria de novo em seguida. */
export const SATIETY_AFTER_FAINT = 40;

/**
 * Bem alimentado, a vida volta sozinha: com a barra ACIMA disto (metade) e a vida abaixo do máximo, a cada `REGEN_INTERVAL_MS` de jogo
 * rodando o personagem recupera `REGEN_HP` e gasta `REGEN_SATIETY_COST` da barra — curar cansa, então a barra desce até a metade e para.
 * Da barra cheia dá pra recuperar a vida inteira (50) em pouco mais de 3 minutos.
 */
export const REGEN_SATIETY_THRESHOLD = MAX_SATIETY / 2;
export const REGEN_INTERVAL_MS = 4_000;
export const REGEN_HP = 1;
export const REGEN_SATIETY_COST = 1;
