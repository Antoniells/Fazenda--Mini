import Phaser from 'phaser';

/** Azul escuro de "luz de lua", não preto puro — a ideia é enluarecer a cena à noite, não apagá-la. */
const NIGHT_TINT = 0x0b1a3a;

/**
 * Véu de dia/noite (Fase 7 — Sistema de Tempo): um retângulo semitransparente
 * cobrindo a tela inteira, cuja opacidade segue `GameClock.getNightAlpha()`.
 * Mesma técnica já usada no fundo da `CoinBar` (`scene.add.rectangle`) — cor
 * sólida com alpha, não um asset — aqui a cor em si É o efeito (tingir a
 * cena), não uma peça de UI substituindo arte.
 *
 * Cobre o MUNDO (fica abaixo da HUD, que é depth 1000+) mas acompanha a
 * câmera (`scrollFactor(0)`) — sem isso, a expansão de propriedade (Fase 6)
 * faria o véu ficar for a de posição sempre que a câmera rolasse.
 */
export class DayNightOverlay {
  private readonly rect: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene) {
    // fillAlpha 1 (opaco) — a opacidade de verdade é controlada só por
    // `setAlpha` (propriedade do game object), não pelo canal alpha da cor
    // de preenchimento; misturar os dois deixaria o retângulo sempre
    // invisível (alpha final = fillAlpha * alpha do objeto).
    this.rect = scene.add.rectangle(0, 0, scene.scale.width, scene.scale.height, NIGHT_TINT, 1);
    this.rect.setOrigin(0, 0);
    this.rect.setScrollFactor(0);
    this.rect.setDepth(999);
    this.rect.setAlpha(0);
  }

  setNightAlpha(alpha: number): void {
    this.rect.setAlpha(alpha);
  }
}
