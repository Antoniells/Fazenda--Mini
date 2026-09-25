import Phaser from 'phaser';
import { WalkableGrid } from './grid';
import { Interactable, InteractionRegistry } from './interaction';
import { gameState } from './gameState';
import { playEffect, playRandomEffect } from './soundEffects';
import { popText } from './floatingText';
import { Player } from '../entities/Player';
import { FENCE_HP } from '../data/horde';
import { FENCE_BROKEN_INDEX } from '../data/tiles';
import { HAMMER } from '../data/tools';
import { AXE_HIT_SOUNDS, OBJECT_BREAK_SOUND, HAMMER_SOUND } from '../data/audio';

interface FenceCell {
  image: Phaser.GameObjects.Image;
  hp: number;
  destroyed: boolean;
  /** Quadro da cerca INTEIRA, guardado pra restaurar depois do estado "destruída" (o quadro quebrado é só `FENCE_BROKEN_INDEX`). */
  intactFrame: string | number;
}

/** Cerca destruída: só o Martelo conserta. Célula ANDÁVEL (o inimigo e o jogador passam), mas o clique leva o jogador até um vizinho e o golpe acontece de lá. */
class BrokenFenceInteractable implements Interactable {
  readonly interactFromAdjacent = true;

  constructor(
    private readonly fences: FarmFences,
    private readonly player: Player,
    private readonly col: number,
    private readonly row: number,
  ) {}

  interact(): void {
    if (this.player.isBusy()) return;

    const selected = gameState.inventory.getSelectedSlot();
    if (selected?.category !== 'tool' || selected.id !== HAMMER.id) {
      console.log('Cerca destruída — selecione o Martelo pra consertar.');
      popText(this.player.sprite.scene, this.player.sprite.x, this.player.sprite.y - 44, 'Precisa do Martelo', { fontSize: 13 });
      return;
    }

    // Mesma animação de golpe da Picareta (não há uma animação própria de martelo).
    this.player.performAction('pickaxe', () => this.fences.repair(this.col, this.row));
  }
}

/**
 * As cercas da lavoura como ALVO da horda: cada célula de cerca (as mesmas imagens que `buildFarmlandFence` desenha e que o
 * `WalkableGrid` já bloqueia) ganha vida (`FENCE_HP`). Levar dano racha/avermelha a cerca; a última pancada a DESTRÓI: o quadro
 * vira a cerca quebrada (`FENCE_BROKEN_INDEX`), a célula é liberada no grid (o inimigo passa) e ela fica registrada em
 * `gameState.destroyedFences` (vai pro save e sobrevive a trocas de cena). Cerca destruída NÃO se conserta sozinha: só o
 * Martelo (`repair`) a devolve ao estado normal — reconstrói o quadro, recupera a vida e volta a bloquear a célula.
 */
export class FarmFences {
  private readonly cells = new Map<string, FenceCell>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly grid: WalkableGrid,
    images: Map<string, Phaser.GameObjects.Image>,
    private readonly interactions: InteractionRegistry,
    private readonly player: Player,
  ) {
    for (const [cellKey, image] of images) {
      this.cells.set(cellKey, { image, hp: FENCE_HP, destroyed: false, intactFrame: image.frame.name });
    }
    // Cercas que a horda já derrubou em outra sessão/cena: a cena nova as recria já destruídas.
    for (const cellKey of gameState.destroyedFences) {
      const cell = this.cells.get(cellKey);
      if (cell) this.applyDestroyed(cellKey, cell, false);
    }
  }

  private key(col: number, row: number): string {
    return `${col},${row}`;
  }

  private parse(cellKey: string): { col: number; row: number } {
    const [col, row] = cellKey.split(',').map(Number);
    return { col, row };
  }

  /** Esta célula é (ou era) uma cerca da lavoura — de pé OU destruída? Usado pra não permitir plantar/construir em cima. */
  hasFenceAt(col: number, row: number): boolean {
    return this.cells.has(this.key(col, row));
  }

  /** Há uma cerca INTACTA (ou só machucada) nesta célula? */
  isFence(col: number, row: number): boolean {
    const cell = this.cells.get(this.key(col, row));
    return !!cell && !cell.destroyed;
  }

  /** Há uma cerca DESTRUÍDA nesta célula, esperando o Martelo? */
  isDestroyed(col: number, row: number): boolean {
    return this.cells.get(this.key(col, row))?.destroyed === true;
  }

  /** Aplica dano à cerca; devolve `true` se ela foi destruída. */
  damage(col: number, row: number, amount = 1): boolean {
    const cellKey = this.key(col, row);
    const cell = this.cells.get(cellKey);
    if (!cell || cell.destroyed) return false;

    cell.hp -= amount;
    const image = cell.image;

    if (cell.hp > 0) {
      // Machucada: avermelha e dá uma sacudida curta.
      image.setTint(0xff9a8a);
      playRandomEffect(this.scene, AXE_HIT_SOUNDS); // Golpe do invasor na cerca.
      this.scene.tweens.add({ targets: image, x: image.x + 2, duration: 40, yoyo: true, repeat: 2 });
      return false;
    }

    this.applyDestroyed(cellKey, cell, true);
    return true;
  }

  /** Estado "destruída": quadro quebrado, célula andável, registrada pra persistir e pra receber o conserto. `animate`: um "estalo" curto (só na hora do ataque). */
  private applyDestroyed(cellKey: string, cell: FenceCell, animate: boolean): void {
    const { col, row } = this.parse(cellKey);
    cell.destroyed = true;
    cell.hp = 0;
    cell.image.clearTint();
    cell.image.setFrame(FENCE_BROKEN_INDEX);
    this.grid.unblock(col, row);
    gameState.destroyedFences.add(cellKey);
    this.interactions.set(col, row, new BrokenFenceInteractable(this, this.player, col, row));

    if (animate) {
      playEffect(this.scene, OBJECT_BREAK_SOUND);
      this.bump(cell.image, 160);
    }
  }

  /** O Martelo conserta uma cerca destruída: quadro inteiro de volta, vida cheia, célula bloqueada de novo. Devolve `true` se havia o que consertar. */
  repair(col: number, row: number): boolean {
    const cellKey = this.key(col, row);
    const cell = this.cells.get(cellKey);
    if (!cell || !cell.destroyed) return false;

    cell.destroyed = false;
    cell.hp = FENCE_HP;
    cell.image.clearTint();
    cell.image.setFrame(cell.intactFrame);
    this.grid.block(col, row);
    this.interactions.remove(col, row);
    gameState.destroyedFences.delete(cellKey);

    playEffect(this.scene, HAMMER_SOUND);
    this.bump(cell.image, 180);
    popText(this.scene, cell.image.x + cell.image.displayWidth / 2, cell.image.y, 'Cerca consertada', { fontSize: 13 });
    return true;
  }

  /** "Pulinho" de escala da imagem (estalo ao quebrar / ao consertar). */
  private bump(image: Phaser.GameObjects.Image, duration: number): void {
    const base = image.scaleX;
    this.scene.tweens.add({ targets: image, scale: { from: base * 1.15, to: base }, duration, ease: 'Back.easeOut' });
  }

  /** Conserta as cercas MACHUCADAS (as que aguentaram) ao fim da horda — as destruídas continuam esperando o Martelo. */
  healDamaged(): void {
    for (const cell of this.cells.values()) {
      if (cell.destroyed) continue;
      cell.hp = FENCE_HP;
      cell.image.clearTint();
    }
  }

  /** Quantas cercas ainda de pé. */
  intactCount(): number {
    let count = 0;
    for (const cell of this.cells.values()) if (!cell.destroyed) count++;
    return count;
  }

  /** Quantas cercas destruídas esperando conserto. */
  destroyedCount(): number {
    return this.cells.size - this.intactCount();
  }
}
