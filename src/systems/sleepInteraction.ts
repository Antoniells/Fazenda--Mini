import { Interactable, InteractionRegistry } from './interaction';
import { Player } from '../entities/Player';

/**
 * Dormir (Fase 9): interagir com a porta de casa dispara o callback
 * `onSleep` (fade-out, avançar o relógio pro dia seguinte, `farmland.
 * onNewDay()`, fade-in — ver `MainScene.sleep`). Esta classe não sabe nada
 * sobre câmera/relógio/lavoura, só decide QUANDO chamar — mesmo padrão dos
 * outros `Interactable` (Caixa de Remessas, Loja): objeto sólido com
 * interação adjacente já cuidada pelo `PlayerController`.
 */
class SleepInteractable implements Interactable {
  constructor(
    private readonly player: Player,
    private readonly onSleep: () => void,
  ) {}

  interact(): void {
    if (this.player.isBusy()) return;
    this.onSleep();
  }
}

/** Registra a interação de dormir na célula da porta de casa (`farmMap.houseDoorPosition`). */
export function registerSleepInteractable(
  col: number,
  row: number,
  player: Player,
  onSleep: () => void,
  registry: InteractionRegistry,
): void {
  registry.set(col, row, new SleepInteractable(player, onSleep));
}
