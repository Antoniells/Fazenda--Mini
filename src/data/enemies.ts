/**
 * Referências do sprite do Slime (Fase 8 — Combate, primeiro inimigo).
 * `Enemy/Slimes/Green/Slime.png` (128x384): grid uniforme de 32x32, 4
 * colunas x 12 linhas — analisado visualmente por recorte/zoom (mesma
 * técnica já usada pras outras folhas de animação do projeto):
 * - linha 0 (frames 0-3): "respirar"/pulsar parado — usada tanto pro idle
 *   quanto pro vagar/perseguir (não há uma folha de "andar" separada
 *   claramente distinta o bastante pra valer a pena isolar; o mesmo ciclo
 *   de pulso já transmite movimento o bastante num slime).
 * - linha 9 (frames 36-39): sequência de derrota — corpo normal → machucado
 *   → achatado → estilhaçado em partículas, 4 frames já prontos pra tocar
 *   uma vez só ao morrer.
 */
export const SLIME_FRAME_SIZE = 32;

export const SLIME_KEY = 'enemy-slime-green';
export const SLIME_PATH = 'Enemy/Slimes/Green/Slime.png';

export const SLIME_IDLE_ANIM_KEY = 'enemy-slime-idle';
export const SLIME_IDLE_FRAMES = { start: 0, end: 3 };

export const SLIME_DEATH_ANIM_KEY = 'enemy-slime-death';
export const SLIME_DEATH_FRAMES = { start: 36, end: 39 };

/** Atributos do Slime (Fase 8 — Combate, pedido explícito do usuário). */
export const SLIME_STATS = {
  maxHp: 25,
  contactDamage: 5,
  moveSpeed: 40,
};
