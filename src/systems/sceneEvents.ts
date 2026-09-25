import Phaser from 'phaser';

/** Evento de cena emitido por `PlayerController` a cada célula nova que o jogador pisa (col, row). */
export const PLAYER_STEPPED_EVENT = 'player-stepped';

/**
 * Escuta "o jogador pisou numa célula" e SAI sozinho quando a cena fecha. O Phaser reaproveita a MESMA instância de cena a cada
 * `scene.start` e NÃO limpa os listeners que o próprio jogo pendurou em `scene.events` (só os dos plugins) — então um `events.on` solto
 * no `create` se acumula a cada reinício: depois de 3 idas e vindas da casa a Fazenda tinha 11 ouvintes onde devia ter 5 (ponte
 * cruzada várias vezes, tutorial contando passo em dobro, sistemas velhos reagindo a objetos já destruídos). Todo ouvinte de
 * `player-stepped` passa por aqui.
 */
export function onPlayerStepped(scene: Phaser.Scene, handler: (col: number, row: number) => void): void {
  scene.events.on(PLAYER_STEPPED_EVENT, handler);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(PLAYER_STEPPED_EVENT, handler));
}
