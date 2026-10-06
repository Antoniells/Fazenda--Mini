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

/**
 * Registra a interação de entrar na célula da porta de casa (`farmMap.houseDoorPosition`, os degraus que se pisam) e também na de
 * cima, na parede — é ali que o DESENHO da porta fica, e clicar nele não fazia nada (o playtest clicou na porta e só depois achou o
 * degrau). Sendo sólida, o clique nela leva o jogador até os degraus e entra (`PlayerController.handleBlockedClick`).
 */
export function registerEnterHouseInteractable(col: number, row: number, player: Player, onEnter: () => void, registry: InteractionRegistry): void {
  const enter = new EnterHouseInteractable(player, onEnter);
  registry.set(col, row, enter);
  if (!registry.get(col, row - 1)) registry.set(col, row - 1, enter);
}
