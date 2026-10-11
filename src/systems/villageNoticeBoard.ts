import Phaser from 'phaser';
import { SHOP_SIGN_BOARD, VILLAGE_NOTICE_BOARD } from '../data/villageSigns';
import { TILE_SIZE } from '../data/tiles';
import { DISPLAY_SCALE } from './mapBuilder';
import { registerFrame } from './externalMapBuilder';
import { createGroundShadow } from './shadow';
import type { Interactable, InteractionRegistry } from './interaction';
import type { WalkableGrid } from './grid';
import type { Player } from '../entities/Player';

/** Evento GLOBAL (`game.events`): o mural foi clicado — a `UIScene` abre o quadro com o calendário do dia (`ui/noticeBoardPanel.ts`). */
export const OPEN_NOTICE_BOARD_EVENT = 'open-notice-board';

/** As duas células das pernas do mural (as únicas que bloqueiam). */
export function noticeBoardBlockedCells(): Array<[number, number]> {
  const { col, row } = VILLAGE_NOTICE_BOARD.legs;
  return [
    [col, row],
    [col + 1, row],
  ];
}

class NoticeBoardInteractable implements Interactable {
  readonly keyInteractable = true;
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Player,
    readonly approachCell: { col: number; row: number },
  ) {}

  interact(): void {
    if (this.player.isBusy()) return;
    this.scene.game.events.emit(OPEN_NOTICE_BOARD_EVENT);
  }
}

/**
 * Desenha o mural do Vilarejo (o quadro com papéis do pacote, na mesma escala do mapa, com a sombra das placas) e o deixa clicável pelas
 * pernas: o jogador vai até a rua logo abaixo e o quadro abre. As células das pernas já vêm bloqueadas no grid (`noticeBoardBlockedCells`).
 */
export function buildNoticeBoard(scene: Phaser.Scene, interactions: InteractionRegistry, grid: WalkableGrid, player: Player): void {
  const tile = TILE_SIZE * DISPLAY_SCALE;
  const { col, row } = VILLAGE_NOTICE_BOARD.legs;
  registerFrame(scene, SHOP_SIGN_BOARD.key, VILLAGE_NOTICE_BOARD.frame);
  const depth = (row + 1) * tile;
  createGroundShadow(scene, col * tile + tile, (row + 1) * tile - 3, DISPLAY_SCALE * 1.4, DISPLAY_SCALE * 0.45).setDepth(depth - 0.1);
  scene.add.image(col * tile, (row - 1) * tile, SHOP_SIGN_BOARD.key, VILLAGE_NOTICE_BOARD.frame.name).setOrigin(0, 0).setScale(DISPLAY_SCALE).setDepth(depth);
  const interactable = new NoticeBoardInteractable(scene, player, { col, row: row + 1 });
  for (const [cellCol, cellRow] of noticeBoardBlockedCells()) {
    grid.block(cellCol, cellRow);
    interactions.set(cellCol, cellRow, interactable);
  }
}
