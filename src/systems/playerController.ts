import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { WalkableGrid } from './grid';
import { findPath } from './pathfinding';
import { InteractionRegistry } from './interaction';

/**
 * Liga o input do jogador (teclado e clique no mapa) à entidade `Player`.
 * Teclado move uma célula por vez e cancela qualquer rota em andamento;
 * clique calcula uma rota com A* e entrega ao Player para seguir (isso não
 * muda). Se a célula clicada tiver algo registrado em `InteractionRegistry`
 * (terreno, plantação, etc.), a interação é disparada assim que o
 * personagem chegar lá — ou imediatamente, se ele já estiver na célula.
 */
export class PlayerController {
  private readonly player: Player;
  private readonly grid: WalkableGrid;
  private readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private readonly tilePx: number;
  private readonly interactions: InteractionRegistry;
  private pendingInteractionTarget: { col: number; row: number } | null = null;

  constructor(
    scene: Phaser.Scene,
    player: Player,
    grid: WalkableGrid,
    tilePx: number,
    interactions: InteractionRegistry,
  ) {
    this.player = player;
    this.grid = grid;
    this.tilePx = tilePx;
    this.interactions = interactions;
    this.cursors = scene.input.keyboard!.createCursorKeys();

    scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.handlePointerDown(pointer.x, pointer.y);
    });
  }

  private handlePointerDown(x: number, y: number): void {
    if (this.player.isBusy()) return;

    const col = Math.floor(x / this.tilePx);
    const row = Math.floor(y / this.tilePx);

    if (!this.grid.isWalkable(col, row)) return;

    if (this.player.col === col && this.player.row === row) {
      this.pendingInteractionTarget = null;
      this.interactions.get(col, row)?.interact();
      return;
    }

    const path = findPath(this.grid, { col: this.player.col, row: this.player.row }, { col, row });
    if (!path || path.length === 0) return;

    this.pendingInteractionTarget = this.interactions.get(col, row) ? { col, row } : null;
    this.player.setPath(path);
  }

  update(time: number, delta: number): void {
    if (!this.player.isBusy()) {
      const dCol = this.cursors.left.isDown ? -1 : this.cursors.right.isDown ? 1 : 0;
      const dRow = this.cursors.up.isDown ? -1 : this.cursors.down.isDown ? 1 : 0;

      if (dCol !== 0 || dRow !== 0) {
        if (!this.player.isMoving()) {
          this.player.clearPath();
          this.pendingInteractionTarget = null;
          // Prioriza um eixo por vez (sem diagonais): vertical antes de horizontal.
          if (dRow !== 0) this.player.tryStep(0, dRow, this.grid.isWalkable.bind(this.grid));
          else this.player.tryStep(dCol, 0, this.grid.isWalkable.bind(this.grid));
        }
      }
    }

    this.player.update(time, delta);

    if (
      !this.player.isBusy() &&
      this.pendingInteractionTarget &&
      !this.player.isMoving() &&
      this.player.col === this.pendingInteractionTarget.col &&
      this.player.row === this.pendingInteractionTarget.row
    ) {
      const { col, row } = this.pendingInteractionTarget;
      this.pendingInteractionTarget = null;
      this.interactions.get(col, row)?.interact();
    }
  }
}
