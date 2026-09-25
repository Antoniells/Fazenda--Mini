import Phaser from 'phaser';

export interface PopTextOptions {
  color?: string;
  fontSize?: number;
  /** Quanto o texto sobe (px de mundo, ou de tela com `screenFixed`) antes de sumir. */
  rise?: number;
  duration?: number;
  /** Atraso (ms) antes de aparecer — pra empilhar vários sem sobrepor. */
  delay?: number;
  /** Fixo na TELA (`scrollFactor(0)`, x/y viram coordenadas de tela) em vez de seguir o mundo — avisos ancorados na UI, ex.:
   * "Regador Vazio" em cima da Hotbar (`systems/farmlandInteraction.ts`, `ui/hotbar.ts` `hotbarTopCenter`). */
  screenFixed?: boolean;
}

/** Acima de qualquer objeto do mundo (ordenados por Y, ~0-1500 na Fazenda/mapas externos) e abaixo dos HUDs (`UIScene`) — exportada porque o véu da noite (`systems/dayNightOverlay.ts`) precisa ficar ainda acima, pra escurecer o texto também. */
export const POP_TEXT_DEPTH = 5000;

/**
 * Texto flutuante ("juice" de números de dano, itens coletados...): nasce com
 * um pulinho de escala, sobe e some — como os números de dano do Terraria e
 * os "+1 Madeira" do Stardew. É só um `Phaser.Text` temporário que se
 * destrói sozinho; nunca guarda estado nem afeta o jogo.
 */
export function popText(scene: Phaser.Scene, x: number, y: number, content: string, options: PopTextOptions = {}): void {
  const { color = '#fff2a8', fontSize = 16, rise = 34, duration = 750, delay = 0, screenFixed = false } = options;

  const text = scene.add.text(x, y, content, {
    fontFamily: 'monospace',
    fontSize: `${fontSize}px`,
    fontStyle: 'bold',
    color,
    stroke: '#2b1d0e',
    strokeThickness: 4,
  });
  text.setOrigin(0.5, 1);
  text.setDepth(POP_TEXT_DEPTH);
  text.setAlpha(0);
  if (screenFixed) text.setScrollFactor(0);

  scene.tweens.add({
    targets: text,
    alpha: 1,
    scale: { from: 0.4, to: 1 },
    duration: 110,
    delay,
    ease: 'Back.easeOut',
    onComplete: () => {
      scene.tweens.add({
        targets: text,
        y: y - rise,
        alpha: 0,
        duration,
        ease: 'Cubic.easeOut',
        onComplete: () => text.destroy(),
      });
    },
  });
}
