import Phaser from 'phaser';
import { Interactable, InteractionRegistry } from './interaction';
import { WalkableGrid } from './grid';
import { Player } from '../entities/Player';
import { LockedMessage } from '../ui/lockedMessage';
import { gameState } from './gameState';
import { hasMilestone, reachMilestone } from './story';
import { save as saveGame } from './saveManager';
import { popText } from './floatingText';
import { playEffect } from './soundEffects';
import { createGroundShadow } from './shadow';
import { DISPLAY_SCALE } from './mapBuilder';
import { OPEN_LETTER_EVENT, OpenLetterPayload } from './petBox';
import { UNLOCK_SOUND } from '../data/audio';
import { BARRIER_FLOOR, FORGOTTEN_CHEST } from '../data/caveLandmarks';
import { MYSTERIOUS_MAP } from '../data/resources';
import type { Cell } from './caveGenerator';

/** O andar tem a barreira ativa (é o 50 e ela ainda não foi quebrada)? */
export function isBarrierActive(floor: number): boolean {
  return floor === BARRIER_FLOOR && !hasMilestone('barrierBroken');
}

/** Onde fica o baú esquecido: ao lado da escada de descida, na fileira de cima (a área em volta da escada é sempre aberta — `systems/caveGenerator.ts`). */
export function forgottenChestCell(stairsDown: Cell, cols: number): Cell {
  const col = stairsDown.col - 2 >= 1 ? stairsDown.col - 2 : Math.min(cols - 2, stairsDown.col + 2);
  return { col, row: stairsDown.row };
}

export function preloadCaveLandmarks(scene: Phaser.Scene): void {
  if (!scene.textures.exists(FORGOTTEN_CHEST.key)) scene.load.image(FORGOTTEN_CHEST.key, encodeURI(`/${FORGOTTEN_CHEST.path}`));
}

/**
 * A BARREIRA MÁGICA do andar 50 (Fase 11): a escada de descida fica bloqueada (célula sólida) e interagir com ela avisa. Não tem arte —
 * é só o aviso (pedido explícito). Uma picareta encantada na mão (`canBreak`) a estilhaça: o marco `barrierBroken` vale pra sempre e a
 * escada volta a funcionar.
 */
class BarrierInteractable implements Interactable {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly stairs: Cell,
    private readonly grid: WalkableGrid,
    private readonly interactions: InteractionRegistry,
    private readonly message: LockedMessage,
    private readonly canBreak: () => boolean,
    private readonly onBroken: () => void,
  ) {}

  readonly keyInteractable = true;

  interact(): void {
    if (!this.canBreak()) {
      this.message.show('UMA BARREIRA MÁGICA', 'Uma força impenetrável bloqueia a descida. Só uma picareta encantada pode estilhaçá-la.');
      return;
    }
    reachMilestone('barrierBroken');
    this.grid.unblock(this.stairs.col, this.stairs.row);
    this.interactions.remove(this.stairs.col, this.stairs.row);
    this.scene.cameras.main.shake(260, 0.012);
    this.scene.cameras.main.flash(240, 190, 230, 255);
    playEffect(this.scene, UNLOCK_SOUND);
    this.message.show('A BARREIRA SE ESTILHAÇOU!', 'O caminho para as profundezas está aberto.');
    saveGame();
    this.onBroken();
  }
}

/** O BAÚ ESQUECIDO do andar 50: a primeira vez dá o Mapa Misterioso (marco `map`); depois fica aberto e vazio. */
class ForgottenChestInteractable implements Interactable {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly sprite: Phaser.GameObjects.Image,
  ) {}

  readonly keyInteractable = true;

  interact(): void {
    const { x, y } = this.sprite;
    if (hasMilestone('map')) {
      popText(this.scene, x, y - 36, 'O baú está vazio.', { color: '#ffe9b3', fontSize: 13 });
      return;
    }
    if (!gameState.inventory.hasRoomFor({ category: 'resource', id: MYSTERIOUS_MAP.id })) {
      popText(this.scene, x, y - 36, 'Bolsa cheia', { color: '#ff8a8a', fontSize: 14 });
      return;
    }
    gameState.inventory.addResources(MYSTERIOUS_MAP.id, 1);
    reachMilestone('map');
    this.sprite.setFrame(FORGOTTEN_CHEST.open.name);
    playEffect(this.scene, UNLOCK_SOUND);
    saveGame();
    const payload: OpenLetterPayload = {
      title: 'Mapa Misterioso',
      body:
        'Dentro do baú, embrulhado num pano velho, há um mapa desenhado à mão.\n\n' +
        'As linhas levam para fora das Cavernas, até um canto esquecido e silencioso da Floresta, onde um X vermelho marca algo escondido entre as árvores.',
      buttonLabel: 'Guardar',
      heart: false,
      onRead: () => {},
    };
    this.scene.game.events.emit(OPEN_LETTER_EVENT, payload);
  }
}

export interface CaveLandmarkContext {
  scene: Phaser.Scene;
  floor: number;
  tilePx: number;
  stairsDown: Cell;
  chestCell: Cell;
  grid: WalkableGrid;
  interactions: InteractionRegistry;
  player: Player;
  message: LockedMessage;
  /** A picareta na mão pode quebrar a barreira? (a encantada — `systems/enchanting.ts`). */
  canBreakBarrier: () => boolean;
  onBarrierBroken: () => void;
}

/** Monta o que a história põe neste andar (só o 50, por enquanto): a barreira, o baú e o aviso da primeira chegada. */
export function buildCaveLandmarks(ctx: CaveLandmarkContext): void {
  if (ctx.floor !== BARRIER_FLOOR) return;
  const { scene, tilePx, grid, interactions } = ctx;

  if (isBarrierActive(ctx.floor)) {
    grid.block(ctx.stairsDown.col, ctx.stairsDown.row);
    interactions.set(ctx.stairsDown.col, ctx.stairsDown.row, new BarrierInteractable(scene, ctx.stairsDown, grid, interactions, ctx.message, ctx.canBreakBarrier, ctx.onBarrierBroken));
    // Depois do aviso de atalho (o 50 também libera um), que a cena mostra ao abrir.
    if (reachMilestone('barrier')) scene.time.delayedCall(2800, () => ctx.message.show('UMA BARREIRA MÁGICA', 'A descida está bloqueada por uma força impenetrável. Só uma picareta encantada pode quebrá-la.'));
  }

  // O baú esquecido (aberto, se o mapa já foi pego).
  const texture = scene.textures.get(FORGOTTEN_CHEST.key);
  for (const frame of [FORGOTTEN_CHEST.closed, FORGOTTEN_CHEST.open]) {
    if (!texture.has(frame.name)) texture.add(frame.name, 0, frame.rect.x, frame.rect.y, frame.rect.width, frame.rect.height);
  }
  const { col, row } = ctx.chestCell;
  const x = col * tilePx + tilePx / 2;
  const y = (row + 1) * tilePx - 2;
  const sprite = scene.add.image(x, y, FORGOTTEN_CHEST.key, hasMilestone('map') ? FORGOTTEN_CHEST.open.name : FORGOTTEN_CHEST.closed.name);
  sprite.setOrigin(0.5, 1).setScale(DISPLAY_SCALE).setDepth(y);
  createGroundShadow(scene, x, y - 3, DISPLAY_SCALE * 0.8, DISPLAY_SCALE * 0.35).setDepth(y - 0.5);
  grid.block(col, row);
  interactions.set(col, row, new ForgottenChestInteractable(scene, sprite));
}
