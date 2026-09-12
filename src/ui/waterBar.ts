import Phaser from 'phaser';
import { WATERING_CAN_ICON_KEY } from '../data/ui';

const MARGIN_BOTTOM = 20;
const MARGIN_LEFT = 16;
const ICON_SCALE = 1.6;
const BAR_WIDTH = 74;
const BAR_HEIGHT = 12;
const BAR_GAP = 10;

/** Azul (regador com água) e vermelho (quase vazio — mesmo aviso visual de "acabando" usado em barras de recurso). */
const FULL_COLOR = 0x4aa3ff;
const LOW_COLOR = 0xe0544a;
/** Abaixo dessa fração do total, a barra fica vermelha — aviso de que uma viagem ao Poço está próxima. */
const LOW_THRESHOLD = 0.25;

/**
 * Barra de água do regador (Fase 7): quantas regadas restam antes de
 * precisar reabastecer no Poço (`DecorationPlacementSystem.refillWateringCan`).
 * Canto inferior esquerdo — mesma linguagem visual da `CoinBar`/`ClockBar`
 * (fundo semitransparente, ícone fixo), mas com uma barra de preenchimento
 * em vez de texto: o pedido era justamente poder ver "cheio ou vazio" de
 * relance, não um número.
 *
 * A barra em si é dois retângulos sólidos (trilho + preenchimento) — mesma
 * técnica já usada no fundo da `CoinBar` e no véu de dia/noite
 * (`DayNightOverlay`): cor sólida com alpha, não um asset substituindo arte.
 */
export class WaterBar {
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly icon: Phaser.GameObjects.Image;
  private readonly track: Phaser.GameObjects.Rectangle;
  private readonly fill: Phaser.GameObjects.Rectangle;
  private readonly scene: Phaser.Scene;
  private lastCharges: number | null = null;

  constructor(scene: Phaser.Scene, capacity: number) {
    this.scene = scene;

    const leftX = MARGIN_LEFT;
    const bottomY = scene.scale.height - MARGIN_BOTTOM;
    const hudHeight = 40;
    const topY = bottomY - hudHeight;
    const hudWidth = MARGIN_LEFT + 24 + BAR_GAP + BAR_WIDTH + 10;

    this.bg = scene.add.rectangle(leftX, topY, hudWidth, hudHeight, 0x000000, 0.5);
    this.bg.setOrigin(0, 0);
    this.bg.setScrollFactor(0);
    this.bg.setDepth(1000);

    const centerY = topY + hudHeight / 2;

    this.icon = scene.add.image(leftX + 20, centerY, WATERING_CAN_ICON_KEY, 0);
    this.icon.setOrigin(0.5, 0.5);
    this.icon.setScale(ICON_SCALE);
    this.icon.setScrollFactor(0);
    this.icon.setDepth(1001);

    const trackX = leftX + 20 + 18 + BAR_GAP - 10;

    this.track = scene.add.rectangle(trackX, centerY, BAR_WIDTH, BAR_HEIGHT, 0x1a1208, 0.8);
    this.track.setOrigin(0, 0.5);
    this.track.setScrollFactor(0);
    this.track.setDepth(1001);

    this.fill = scene.add.rectangle(trackX, centerY, BAR_WIDTH, BAR_HEIGHT, FULL_COLOR, 1);
    this.fill.setOrigin(0, 0.5);
    this.fill.setScrollFactor(0);
    this.fill.setDepth(1002);

    this.refresh(capacity, capacity);
    this.playEntrance();
  }

  /** Entrada elástica do HUD, mesma técnica da `CoinBar`/`ClockBar` (Pit Stop de Polimento). */
  private playEntrance(): void {
    this.bg.setScale(0);
    this.icon.setScale(0);
    this.track.setScale(0);
    this.fill.setScale(0);

    const entranceTween = { duration: 320, ease: 'Back.easeOut' as const };
    this.scene.tweens.add({ targets: this.bg, scale: 1, ...entranceTween });
    this.scene.tweens.add({ targets: this.icon, scale: ICON_SCALE, ...entranceTween });
    this.scene.tweens.add({ targets: this.track, scale: 1, ...entranceTween });
    this.scene.tweens.add({ targets: this.fill, scale: 1, ...entranceTween });
  }

  /** Atualiza o preenchimento da barra; só redesenha se as cargas mudarem de fato. */
  refresh(charges: number, capacity: number): void {
    if (charges === this.lastCharges) return;
    this.lastCharges = charges;

    const ratio = capacity > 0 ? Phaser.Math.Clamp(charges / capacity, 0, 1) : 0;
    this.fill.width = BAR_WIDTH * ratio;
    this.fill.fillColor = ratio <= LOW_THRESHOLD ? LOW_COLOR : FULL_COLOR;
  }
}
