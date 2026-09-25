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
import { SLIME_HIT_SOUND } from './audio';
export const SLIME_FRAME_SIZE = 32;

export const SLIME_KEY = 'enemy-slime-green';
export const SLIME_PATH = 'Enemy/Slimes/Green/Slime.png';

export const SLIME_IDLE_ANIM_KEY = 'enemy-slime-idle';
export const SLIME_IDLE_FRAMES = { start: 0, end: 3 };

export const SLIME_DEATH_ANIM_KEY = 'enemy-slime-death';
export const SLIME_DEATH_FRAMES = { start: 36, end: 39 };

/**
 * Ataque do Slime (linha 3 da folha, frames 12-15, conferido por zoom): é
 * um ciclo de pulo — frame 12 = corpo agachado (usado parado durante a
 * preparação do golpe), 13-14 = no ar, 15 = aterrissagem achatada (o frame
 * final fica congelado durante a recuperação, ver `entities/Slime.ts`).
 */
export const SLIME_ATTACK_ANIM_KEY = 'enemy-slime-attack';
export const SLIME_ATTACK_WINDUP_FRAME = 12;
export const SLIME_ATTACK_FRAMES = { start: 13, end: 15 };

/**
 * Atributos do Slime (Fase 8 — Combate, pedido explícito do usuário).
 * `contactDamage` é o dano do golpe quando ele ACERTA o jogador (o nome vem
 * de quando o dano era por encostar — ver `entities/Slime.ts`).
 */
export const SLIME_STATS = {
  maxHp: 25,
  contactDamage: 5,
  moveSpeed: 40,
  hitSound: SLIME_HIT_SOUND,
};
