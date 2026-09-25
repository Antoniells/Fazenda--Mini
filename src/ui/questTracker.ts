import Phaser from 'phaser';

const MARGIN_LEFT = 20;
const TOP = 92;
const FONT = '"Courier New", Courier, monospace';
const WRAP_WIDTH = 360;

/**
 * Marcador de OBJETIVO no canto superior esquerdo (abaixo dos corações e da armadura): o rótulo "Objetivo" e uma linha com a missão
 * atual e o que falta (`systems/campaign.ts` `describeObjective`). Só texto com contorno, no mesmo estilo dos avisos do jogo — some
 * sozinho quando não há objetivo (campanha completa) e enquanto o tutorial roda. Vive na `UIScene`.
 */
export class QuestTracker {
  private readonly label: Phaser.GameObjects.Text;
  private readonly text: Phaser.GameObjects.Text;
  private lastValue: string | null = null;

  constructor(scene: Phaser.Scene) {
    this.label = scene.add.text(MARGIN_LEFT, TOP, 'OBJETIVO', { fontFamily: FONT, fontSize: '11px', fontStyle: 'bold', color: '#ffd27a', stroke: '#2b1d0e', strokeThickness: 3 });
    this.label.setOrigin(0, 0).setScrollFactor(0).setDepth(1000);
    this.text = scene.add.text(MARGIN_LEFT, TOP + 15, '', { fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: '#ffe9b3', stroke: '#2b1d0e', strokeThickness: 3, wordWrap: { width: WRAP_WIDTH }, lineSpacing: 2 });
    this.text.setOrigin(0, 0).setScrollFactor(0).setDepth(1000);
    this.refresh(null);
  }

  /** `null` esconde o marcador. Só redesenha quando o texto muda. */
  refresh(objective: string | null): void {
    if (objective === this.lastValue) return;
    this.lastValue = objective;
    const visible = objective !== null;
    this.label.setVisible(visible);
    this.text.setVisible(visible);
    if (visible) this.text.setText(objective);
  }
}
