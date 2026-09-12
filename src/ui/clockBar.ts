import Phaser from 'phaser';
import { CLOCK_ICON_KEY } from '../data/ui';

const MARGIN_TOP = 16;
const MARGIN_LEFT = 16;
const HUD_HEIGHT = 44;
const HUD_WIDTH = 132;
const ICON_SCALE = 1.6;

/**
 * HUD do relógio (Fase 7 — Sistema de Tempo), canto superior esquerdo —
 * espelhando a `CoinBar` (moedas, canto superior direito) na mesma
 * linguagem visual: fundo semitransparente, ícone fixo (`UI/Clock/Clock.png`,
 * sol/lua num mostrador — sem frames pra animar, ao contrário da moeda) e
 * texto (mesma justificativa da `CoinBar`: não há fonte em pixel art no
 * pacote pra "Dia N" / hora livre).
 */
export class ClockBar {
  private readonly text: Phaser.GameObjects.Text;
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly icon: Phaser.GameObjects.Image;
  private readonly scene: Phaser.Scene;
  private lastLabel: string | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    const leftX = MARGIN_LEFT;
    const topY = MARGIN_TOP;

    this.bg = scene.add.rectangle(leftX, topY, HUD_WIDTH, HUD_HEIGHT, 0x000000, 0.5);
    this.bg.setOrigin(0, 0);
    this.bg.setScrollFactor(0);
    this.bg.setDepth(1000);

    this.icon = scene.add.image(leftX + 24, topY + HUD_HEIGHT / 2, CLOCK_ICON_KEY);
    this.icon.setOrigin(0.5, 0.5);
    this.icon.setScale(ICON_SCALE);
    this.icon.setScrollFactor(0);
    this.icon.setDepth(1001);

    this.text = scene.add.text(leftX + 46, topY + HUD_HEIGHT / 2, '', {
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#ffe9b3',
      stroke: '#2b1d0e',
      strokeThickness: 4,
      align: 'left',
    });
    this.text.setOrigin(0, 0.5);
    this.text.setLineSpacing(2);
    this.text.setScrollFactor(0);
    this.text.setDepth(1001);

    this.playEntrance();
  }

  /** Entrada elástica do HUD, mesma técnica da `CoinBar`/`SeedBar` (Pit Stop de Polimento). */
  private playEntrance(): void {
    this.bg.setScale(0);
    this.icon.setScale(0);
    this.text.setScale(0);

    const entranceTween = { duration: 320, ease: 'Back.easeOut' as const };
    this.scene.tweens.add({ targets: this.bg, scale: 1, ...entranceTween });
    this.scene.tweens.add({ targets: this.icon, scale: ICON_SCALE, ...entranceTween });
    this.scene.tweens.add({ targets: this.text, scale: 1, ...entranceTween });
  }

  /** Atualiza o texto (dia + hora); só redesenha se o rótulo mudar de fato. */
  refresh(day: number, hours: number): void {
    const totalMinutes = Math.floor(hours * 60);
    const hh = String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0');
    const mm = String(totalMinutes % 60).padStart(2, '0');
    const label = `Dia ${day}\n${hh}:${mm}`;

    if (label === this.lastLabel) return;
    this.lastLabel = label;
    this.text.setText(label);
  }
}
