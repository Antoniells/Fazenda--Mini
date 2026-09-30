import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { WalkableGrid } from './grid';
import { Interactable, InteractionRegistry } from './interaction';
import { FishingSession } from './fishingSession';
import { isRodSelected } from './fishing';
import type { FishingLocation } from '../data/fishing';

/** Água da margem: só vale como ponto de pesca com a Vara na mão (sem ela, clicar na água não faz nada, como sempre). */
class FishingSpotInteractable implements Interactable {
  constructor(private readonly spots: FishingSpots) {}

  isAvailable(): boolean {
    return isRodSelected();
  }

  /** F encarando a água também pesca. */
  readonly keyInteractable = true;

  interact(): void {
    this.spots.tryFish();
  }
}

/**
 * PONTOS DE PESCA de uma cena (Fase 11 — pesca): toda célula de água com terra andável ao lado vira um ponto (a interação por célula,
 * `InteractionRegistry`) — o clique leva o jogador até a margem, virado pra água, e aí começa a pescaria (`FishingSession`). Cada cena
 * com água de pesca cria um destes (`ExternalMapConfig.fishing`) e o chama no `update`.
 */
export class FishingSpots {
  private session: FishingSession | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Player,
    private readonly tilePx: number,
    private readonly location: FishingLocation,
    grid: WalkableGrid,
    interactions: InteractionRegistry,
    waterCells: Array<[number, number]>,
  ) {
    const spot = new FishingSpotInteractable(this);
    for (const [col, row] of waterCells) {
      if (interactions.has(col, row)) continue; // Algo já mora ali (não disputa a célula).
      const shore = [
        [col + 1, row],
        [col - 1, row],
        [col, row + 1],
        [col, row - 1],
      ].some(([c, r]) => grid.isWalkable(c, r));
      if (shore) interactions.set(col, row, spot);
    }
  }

  isFishing(): boolean {
    return this.session !== null;
  }

  tryFish(): void {
    if (this.session || !isRodSelected()) return;
    const session = new FishingSession(this.scene, this.player, this.location, this.tilePx);
    if (session.start()) this.session = session;
  }

  update(delta: number): void {
    if (!this.session) return;
    this.session.update(delta);
    if (this.session.isDone()) this.session = null;
  }
}
