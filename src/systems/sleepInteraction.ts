import { Interactable, InteractionRegistry } from './interaction';
import { Player } from '../entities/Player';

/**
 * Dormir: interagir com a CAMA (dentro de casa, `scenes/HouseScene.ts`)
 * dispara o callback `onSleep` (fade out, avançar pro dia seguinte, curar,
 * salvar, fade in — ver `HouseScene.sleep`/`systems/dayCycle.ts`). Esta
 * classe não sabe nada sobre câmera/relógio/lavoura, só decide QUANDO
 * chamar — mesmo padrão dos outros `Interactable`: objeto sólido com
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

/** Registra a interação de dormir em TODAS as células que a cama ocupa (clicar em qualquer parte dela funciona). */
export function registerSleepInteractable(
  cells: Array<[number, number]>,
  player: Player,
  onSleep: () => void,
  registry: InteractionRegistry,
): void {
  const interactable = new SleepInteractable(player, onSleep);
  for (const [col, row] of cells) registry.set(col, row, interactable);
}
