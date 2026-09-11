import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { WalkableGrid } from './grid';
import { findPath, GridPoint } from './pathfinding';
import { InteractionRegistry } from './interaction';

/**
 * Alvo pendente de interação: `standCol/standRow` é a célula andável para
 * onde o personagem está indo, `targetCol/targetRow` é a célula onde a
 * interação de fato está registrada. Para uma célula andável e interativa
 * (ex.: um canteiro), as duas são a mesma célula — o jogador para em cima
 * dela. Para uma célula sólida (ex.: a Caixa de Remessas), `standCol/Row`
 * é a célula andável mais próxima do alvo, e o jogador vira de frente para
 * `targetCol/Row` ao chegar, antes de interagir (ver `handleBlockedClick`).
 */
interface PendingInteraction {
  standCol: number;
  standRow: number;
  targetCol: number;
  targetRow: number;
}

/**
 * Liga o input do jogador (teclado e clique no mapa) à entidade `Player`.
 * Teclado move uma célula por vez e cancela qualquer rota em andamento;
 * clique calcula uma rota com A* e entrega ao Player para seguir (isso não
 * muda). Se a célula clicada tiver algo registrado em `InteractionRegistry`
 * (terreno, plantação, etc.), a interação é disparada assim que o
 * personagem chegar lá — ou imediatamente, se ele já estiver na célula.
 *
 * Células sólidas (não andáveis, ex.: a Caixa de Remessas) também podem ter
 * uma interação: nesse caso o personagem não pode pisar nelas, então o
 * clique leva até a célula andável mais próxima entre as 4 vizinhas da
 * célula clicada, e a interação só dispara depois que ele chega lá e vira
 * de frente para o alvo (ver `handleBlockedClick`).
 */
export class PlayerController {
  private readonly player: Player;
  private readonly grid: WalkableGrid;
  private readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private readonly tilePx: number;
  private readonly interactions: InteractionRegistry;
  private pendingInteraction: PendingInteraction | null = null;
  private readonly scene: Phaser.Scene;
  private lastCol: number;
  private lastRow: number;

  constructor(
    scene: Phaser.Scene,
    player: Player,
    grid: WalkableGrid,
    tilePx: number,
    interactions: InteractionRegistry,
  ) {
    this.scene = scene;
    this.player = player;
    this.grid = grid;
    this.tilePx = tilePx;
    this.interactions = interactions;
    this.cursors = scene.input.keyboard!.createCursorKeys();

    this.lastCol = player.col;
    this.lastRow = player.row;

    scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.handlePointerDown(pointer.x, pointer.y);
    });
  }

  private handlePointerDown(x: number, y: number): void {
    if (this.player.isBusy()) return;

    const col = Math.floor(x / this.tilePx);
    const row = Math.floor(y / this.tilePx);

    if (!this.grid.isWalkable(col, row)) {
      this.handleBlockedClick(col, row);
      return;
    }

    if (this.player.col === col && this.player.row === row) {
      this.pendingInteraction = null;
      this.interactions.get(col, row)?.interact();
      return;
    }

    const path = findPath(this.grid, { col: this.player.col, row: this.player.row }, { col, row });
    if (!path || path.length === 0) return;

    this.pendingInteraction = this.interactions.get(col, row)
      ? { standCol: col, standRow: row, targetCol: col, targetRow: row }
      : null;
    this.player.setPath(path);
  }

  /**
   * Clique numa célula sólida (não andável): só faz algo se houver uma
   * interação registrada ali (ex.: a Caixa de Remessas) — do contrário é só
   * um obstáculo comum (árvore, cerca) e o clique não tem efeito, igual a
   * antes. Havendo interação, encontra a célula andável mais próxima do
   * jogador entre as 4 vizinhas da célula clicada e vai até lá; virar de
   * frente para o alvo e disparar `interact()` acontece na chegada (`update`).
   */
  private handleBlockedClick(col: number, row: number): void {
    const interactable = this.interactions.get(col, row);
    if (!interactable) return;

    const stand = this.findNearestWalkableNeighbor(col, row);
    if (!stand) return;

    if (this.player.col === stand.col && this.player.row === stand.row) {
      this.pendingInteraction = null;
      this.player.faceDirection(col - stand.col, row - stand.row);
      interactable.interact();
      return;
    }

    const path = findPath(this.grid, { col: this.player.col, row: this.player.row }, stand);
    if (!path || path.length === 0) return;

    this.pendingInteraction = { standCol: stand.col, standRow: stand.row, targetCol: col, targetRow: row };
    this.player.setPath(path);
  }

  /**
   * Entre as células andáveis ao lado, em cima ou embaixo de (`col`, `row`),
   * devolve a mais próxima do jogador pela distância real de rota (não só
   * Manhattan) — o mapa é pequeno, então rodar o A* até 4 vezes aqui não
   * pesa (mesma lógica de "não precisa de estrutura otimizada" já usada em
   * `pathfinding.ts`). `null` se nenhuma vizinha for andável ou alcançável.
   */
  private findNearestWalkableNeighbor(col: number, row: number): GridPoint | null {
    const candidates: GridPoint[] = [
      { col, row: row - 1 },
      { col, row: row + 1 },
      { col: col - 1, row },
      { col: col + 1, row },
    ].filter((candidate) => this.grid.isWalkable(candidate.col, candidate.row));

    let best: GridPoint | null = null;
    let bestLength = Infinity;
    for (const candidate of candidates) {
      const path = findPath(this.grid, { col: this.player.col, row: this.player.row }, candidate);
      if (!path) continue;
      if (path.length < bestLength) {
        bestLength = path.length;
        best = candidate;
      }
    }
    return best;
  }

  update(time: number, delta: number): void {
    if (!this.player.isBusy()) {
      const dCol = this.cursors.left.isDown ? -1 : this.cursors.right.isDown ? 1 : 0;
      const dRow = this.cursors.up.isDown ? -1 : this.cursors.down.isDown ? 1 : 0;

      if (dCol !== 0 || dRow !== 0) {
        if (!this.player.isMoving()) {
          this.player.clearPath();
          this.pendingInteraction = null;
          // Prioriza um eixo por vez (sem diagonais): vertical antes de horizontal.
          if (dRow !== 0) this.player.tryStep(0, dRow, this.grid.isWalkable.bind(this.grid));
          else this.player.tryStep(dCol, 0, this.grid.isWalkable.bind(this.grid));
        }
      }
    }

    this.player.update(time, delta);

    if (this.player.col !== this.lastCol || this.player.row !== this.lastRow) {
      this.lastCol = this.player.col;
      this.lastRow = this.player.row;
      // Avisa a cena que o jogador pisou em uma nova célula
      this.scene.events.emit('player-stepped', this.lastCol, this.lastRow);
    }
    if (
      !this.player.isBusy() &&
      this.pendingInteraction &&
      !this.player.isMoving() &&
      this.player.col === this.pendingInteraction.standCol &&
      this.player.row === this.pendingInteraction.standRow
    ) {
      const { standCol, standRow, targetCol, targetRow } = this.pendingInteraction;
      this.pendingInteraction = null;
      // Se o alvo é uma célula diferente de onde o jogador parou (caso da
      // célula sólida), vira de frente para ele antes de interagir. Quando
      // são a mesma célula (caso andável, ex.: canteiro), não há nada a
      // virar — mantém o comportamento de sempre.
      if (targetCol !== standCol || targetRow !== standRow) {
        this.player.faceDirection(targetCol - standCol, targetRow - standRow);
      }
      this.interactions.get(targetCol, targetRow)?.interact();
    }
  }
}

