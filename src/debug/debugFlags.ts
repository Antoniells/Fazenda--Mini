/**
 * Chaves do MENU DE HACK (`debug/hackMenu.ts`, F9), lidas por quem precisa reagir a elas. Um módulo sem imports, pra qualquer sistema poder importá-lo sem ciclo.
 * - `godMode`: o jogador não perde vida (`PlayerHealth.takeDamage`).
 * - `timeScale`: multiplica o avanço do relógio do jogo (`systems/worldTime.ts`, `advanceWorldTime`); 1 = normal.
 */
export const debugFlags = {
  godMode: false,
  timeScale: 1,
  /** As lojas do Vilarejo abrem a qualquer hora (`systems/npcSystem.ts`, `isWorkingNow`). */
  shopsAlwaysOpen: false,
  /** Dia (do calendário) em que uma horda comum é forçada, pra testar sem esperar o dia 10 (`systems/horde.ts`, `isHordeToday`); 0 = nenhum. */
  forcedHordeDay: 0,
};
