import Phaser from 'phaser';
import { BuildRequest, BuildTarget, DESTROY_REFUND_RATE } from '../data/construction';
import { DECORATIONS, DecorationDefinition } from '../data/decorations';
import { SPEND_MONEY_SOUND, SELL_SOUND, OBJECT_BREAK_SOUND } from '../data/audio';
import { PointerInputInterceptor } from './playerController';
import { DecorationPlacementSystem } from './decorationPlacement';
import { ConstructionSiteSystem } from './constructionSites';
import {
  cancelOrder,
  destroyBuilt,
  findOrder,
  getBuiltAt,
  getOrders,
  moveBuilt,
  moveOrder,
  placeOrder,
  targetsFor,
} from './construction';
import { popText } from './floatingText';
import { playEffect } from './soundEffects';

const BANNER_DEPTH = 6000;
const TEXT_FONT = '"Courier New", Courier, monospace';
const HIGHLIGHT_COLOR = 0xffe27a;
/** Depois de concluir (encomenda, mudança, cancelamento...) espera um instante pra o jogador ver o resultado antes de voltar à loja. */
const EXIT_DELAY_MS = 1000;

/**
 * A Fazenda aberta a partir da loja do Marceneiro (`BuildRequest`): mostra a propriedade inteira e deixa o jogador escolher — onde
 * construir uma estrutura nova (o dinheiro só sai ao confirmar o local), qual encomenda/construção mudar de lugar, cancelar (devolve tudo)
 * ou destruir (devolve 80%). Concluída (ou cancelada no ESC), devolve o controle pra cena que abriu (`onExit`) — a loja.
 *
 * Dois passos: escolher o ALVO (só quando havia mais de uma candidata; as candidatas ganham contorno) e, no mover/encomendar, escolher o
 * LOCAL (o fantasma do `DecorationPlacementSystem`). Como interceptador de clique ele só age enquanto escolhe o alvo.
 */
export class BuildFlow implements PointerInputInterceptor {
  private readonly decoration: DecorationDefinition;
  private step: 'target' | 'site' | 'done' = 'done';
  private moveTarget: BuildTarget | null = null;
  private readonly highlight: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly request: BuildRequest,
    private readonly placement: DecorationPlacementSystem,
    private readonly sites: ConstructionSiteSystem,
    private readonly tilePx: number,
    /** Enquadra a Fazenda inteira (a câmera é da cena). */
    showWholeFarm: () => void,
    private readonly onExit: () => void,
  ) {
    this.decoration = DECORATIONS[request.decorationId];
    showWholeFarm();

    this.highlight = scene.add.graphics();
    this.highlight.setDepth(BANNER_DEPTH - 1);

    const width = scene.scale.width;
    const style = { fontFamily: TEXT_FONT, fontStyle: 'bold', color: '#fff2a8', stroke: '#2b1d0e', strokeThickness: 5, align: 'center' };
    this.title = scene.add.text(width / 2, 22, '', { ...style, fontSize: '20px' }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(BANNER_DEPTH);
    this.hint = scene.add.text(width / 2, 50, 'Clique no local · ESC volta à loja', { ...style, fontSize: '13px', color: '#ffffff', strokeThickness: 4 }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(BANNER_DEPTH);

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.highlight.destroy();
      this.title.destroy();
      this.hint.destroy();
    });
    this.begin();
  }

  isActive(): boolean {
    return this.step !== 'done';
  }

  /** ESC: volta à loja sem mudar nada. */
  cancel(): void {
    if (this.step === 'done') return;
    this.finish(0);
  }

  private begin(): void {
    const { mode, target } = this.request;
    if (mode === 'order') {
      this.askSite(`Onde construir: ${this.decoration.name} (${this.decoration.price} moedas)`);
      return;
    }
    if (target) {
      this.chooseTarget(target);
      return;
    }
    const candidates = targetsFor(this.request.decorationId, mode);
    if (candidates.length === 0) {
      this.finish(0);
      return;
    }
    if (candidates.length === 1) {
      this.chooseTarget(candidates[0]);
      return;
    }
    this.step = 'target';
    const verb = mode === 'move' ? 'mover' : mode === 'cancel' ? 'cancelar' : 'destruir';
    this.title.setText(`Qual ${this.decoration.name} você quer ${verb}?`);
    this.hint.setText(mode === 'destroy' ? `Devolve ${Math.round(DESTROY_REFUND_RATE * 100)}% do valor · ESC volta à loja` : 'Clique na construção · ESC volta à loja');
    this.drawHighlights(candidates);
  }

  /** O jogador escolheu o alvo (ou só havia um): cancelar/destruir agem já; mover pede o novo local. */
  private chooseTarget(target: BuildTarget): void {
    this.highlight.clear();
    const { mode } = this.request;
    if (mode === 'move') {
      this.moveTarget = target;
      this.askSite(`Novo local: ${this.decoration.name}`);
      return;
    }
    if (mode === 'cancel' && target.kind === 'order') {
      const order = findOrder(target.id);
      const refunded = cancelOrder(target.id);
      this.sites.remove(target.id);
      playEffect(this.scene, SELL_SOUND);
      if (order) popText(this.scene, order.col * this.tilePx + this.tilePx, order.row * this.tilePx, `+${refunded} moedas`, { color: '#b8f5a0', fontSize: 16 });
      this.finish(EXIT_DELAY_MS);
      return;
    }
    if (mode === 'destroy' && target.kind === 'built') {
      const result = destroyBuilt(target.col, target.row);
      if (result === 'locked') {
        popText(this.scene, target.col * this.tilePx + this.tilePx, target.row * this.tilePx, 'Tem galinhas aí dentro', { color: '#ff8a8a', fontSize: 15 });
        this.finish(EXIT_DELAY_MS);
        return;
      }
      if (result !== null) {
        this.placement.removeAt(target.col, target.row, false, true, false);
        playEffect(this.scene, SELL_SOUND);
        popText(this.scene, target.col * this.tilePx + this.tilePx, target.row * this.tilePx, `+${result} moedas`, { color: '#b8f5a0', fontSize: 16 });
      }
      this.finish(EXIT_DELAY_MS);
      return;
    }
    this.finish(0);
  }

  private askSite(title: string): void {
    this.step = 'site';
    this.title.setText(title);
    this.hint.setText('Clique num local livre · ESC volta à loja');
    this.placement.startPicking(this.decoration, { onPick: (col, row) => this.siteChosen(col, row) });
  }

  private siteChosen(col: number, row: number): void {
    const { mode } = this.request;
    if (mode === 'order') {
      const order = placeOrder(this.decoration, col, row);
      if (!order) {
        popText(this.scene, col * this.tilePx, row * this.tilePx, 'Moedas insuficientes', { color: '#ff8a8a', fontSize: 15 });
        this.finish(EXIT_DELAY_MS);
        return;
      }
      this.sites.add(order);
      playEffect(this.scene, SPEND_MONEY_SOUND);
      popText(this.scene, col * this.tilePx + this.tilePx, row * this.tilePx, 'Encomendado! O Tomás começa amanhã', { color: '#b8f5a0', fontSize: 15 });
      this.finish(EXIT_DELAY_MS);
      return;
    }

    const target = this.moveTarget;
    if (target?.kind === 'order') {
      if (moveOrder(target.id, col, row)) {
        this.sites.remove(target.id);
        const order = findOrder(target.id);
        if (order) this.sites.add(order);
      }
    } else if (target?.kind === 'built') {
      const oldRecord = getBuiltAt(target.col, target.row);
      const result = moveBuilt(target.col, target.row, col, row);
      if (result === 'locked') {
        popText(this.scene, target.col * this.tilePx + this.tilePx, target.row * this.tilePx, 'Tem galinhas aí dentro', { color: '#ff8a8a', fontSize: 15 });
      } else if (result && oldRecord) {
        this.placement.removeAt(target.col, target.row, false, false, false);
        const moved = getOrders()[getOrders().length - 1];
        if (moved) this.sites.add(moved);
      }
    }
    playEffect(this.scene, OBJECT_BREAK_SOUND);
    popText(this.scene, col * this.tilePx + this.tilePx, row * this.tilePx, 'Mudança marcada! O Tomás refaz amanhã', { color: '#b8f5a0', fontSize: 15 });
    this.finish(EXIT_DELAY_MS);
  }

  private drawHighlights(targets: BuildTarget[]): void {
    this.highlight.clear();
    // A Fazenda inteira está com zoom baixo: a espessura acompanha, senão o contorno some.
    this.highlight.lineStyle(Math.max(3, 3 / this.scene.cameras.main.zoom), HIGHLIGHT_COLOR, 1);
    for (const rect of targets.map((target) => this.footprintOf(target))) {
      if (rect) this.highlight.strokeRect(rect.x, rect.y, rect.width, rect.height);
    }
  }

  private footprintOf(target: BuildTarget): Phaser.Geom.Rectangle | null {
    const { width, height } = this.decoration.footprint;
    const anchor = target.kind === 'order' ? findOrder(target.id) : target;
    if (!anchor) return null;
    return new Phaser.Geom.Rectangle(anchor.col * this.tilePx - 2, anchor.row * this.tilePx - 2, width * this.tilePx + 4, height * this.tilePx + 4);
  }

  /** Interceptador de clique: enquanto escolhe o alvo, o clique numa candidata a seleciona (e nada mais reage). */
  handleClick(x: number, y: number): void {
    const { mode } = this.request;
    if (this.step !== 'target' || mode === 'order') return;
    const hit = targetsFor(this.request.decorationId, mode).find((target) => this.footprintOf(target)?.contains(x, y));
    if (hit) this.chooseTarget(hit);
  }

  private finish(delayMs: number): void {
    this.step = 'done';
    this.placement.endPicking();
    this.highlight.clear();
    if (delayMs > 0) this.scene.time.delayedCall(delayMs, () => this.onExit());
    else this.onExit();
  }
}
