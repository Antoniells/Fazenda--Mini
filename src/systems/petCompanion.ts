import Phaser from 'phaser';
import { Pet } from '../entities/Pet';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { PlayerController } from './playerController';
import { WalkableGrid } from './grid';
import { GridPoint } from './pathfinding';
import { PLAYER_ATTACKED_EVENT } from './combat';
import { gameState } from './gameState';
import { PetRoamConfig } from '../data/pets';

/**
 * Liga o pet companheiro (`gameState.profile.petId`, escolhido na Criação de
 * Personagem) a UMA cena: cria o `Pet` ao lado do jogador, faz o clique nele
 * virar carinho (em vez de "andar até aqui"), escuta quando um inimigo agride
 * o jogador (`PLAYER_ATTACKED_EVENT`, emitido pela cena) pra ele revidar, e
 * limpa tudo quando a cena fecha.
 *
 * É assim que o pet acompanha o jogador em TODAS as trocas de cena: o `Pet` é
 * uma entidade da cena (sprites morrem junto com ela), então toda cena que
 * tem jogador — Fazenda, as 4 áreas e a Casa — cria o seu `PetCompanion` logo
 * depois do jogador e do grid prontos, e o pet nasce na célula livre ao lado
 * dele. A escolha em si vive no `gameState` e no save, nunca na cena.
 */
export class PetCompanion {
  readonly pet: Pet;

  constructor(
    scene: Phaser.Scene,
    player: Player,
    controller: PlayerController,
    grid: WalkableGrid,
    tilePx: number,
    roam: PetRoamConfig,
    isCellAllowed?: (col: number, row: number) => boolean,
    /** Células que a caminha ocupa agora (`HouseScene`, único lugar que tem uma) — `undefined` em qualquer outra cena. */
    bedCells?: () => GridPoint[],
  ) {
    this.pet = new Pet(scene, gameState.profile.petId, player, grid, tilePx, roam, isCellAllowed, bedCells);

    controller.addWorldClickHandler((x, y) => this.pet.handleClick(x, y));

    const onPlayerAttacked = (attacker: Enemy): void => this.pet.addAggressor(attacker);
    scene.events.on(PLAYER_ATTACKED_EVENT, onPlayerAttacked);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(PLAYER_ATTACKED_EVENT, onPlayerAttacked));
  }

  update(time: number, delta: number): void {
    this.pet.update(time, delta);
  }
}
