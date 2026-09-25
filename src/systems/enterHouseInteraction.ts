import { Interactable, InteractionRegistry } from './interaction';
import { Player } from '../entities/Player';

/**
 * Entrar em casa: interagir com a porta da Fazenda dispara `onEnter` (fade
 * out + `scene.start('HouseScene')`, ver `MainScene.enterHouse`). Esta classe
 * não sabe nada de câmera/cena, só decide QUANDO chamar — mesmo padrão dos
 * outros `Interactable` (Caixa de Remessas, Loja): objeto sólido com
 * interação adjacente já cuidada pelo `PlayerController`.
 */
export class EnterHouseInteractable implements Interactable {
  /** Responde à tecla F (`PlayerController.handleInteractKey`), além do clique — pedido explícito do usuário. */
  readonly keyInteractable = true;

  constructor(
    private readonly player: Player,
    private readonly onEnter: () => void,
  ) {}

  interact(): void {
    if (this.player.isBusy()) return;
    this.onEnter();
  }
}

/** Registra a interação de entrar na célula da porta de casa (`farmMap.houseDoorPosition`). */
export function registerEnterHouseInteractable(col: number, row: number, player: Player, onEnter: () => void, registry: InteractionRegistry): void {
  registry.set(col, row, new EnterHouseInteractable(player, onEnter));
}
