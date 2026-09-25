import Phaser from 'phaser';
import { KEEP_ON_WORLD_CAMERA } from './uiCamera';
import { POP_TEXT_DEPTH } from './floatingText';

/** Azul escuro de "luz de lua", não preto puro — a ideia é enluarecer a cena à noite, não apagá-la. */
const NIGHT_TINT = 0x0b1a3a;

/** Acima desta distância (px) rolada desde a última vez que o retângulo foi (re)criado, ele é recriado — ver comentário da classe. */
const RECREATE_AFTER_SCROLL_PX = 400;

/**
 * Véu de dia/noite (Fase 7 — Sistema de Tempo): um retângulo semitransparente
 * cobrindo a tela inteira, cuja opacidade segue `GameClock.getNightAlpha()`.
 * Mesma técnica já usada no fundo da `CoinBar` (`scene.add.rectangle`) — cor
 * sólida com alpha, não um asset — aqui a cor em si É o efeito (tingir a
 * cena), não uma peça de UI substituindo arte.
 *
 * Cobre o MUNDO (a HUD de verdade está numa câmera à parte — `systems/uiCamera.ts` — e nem olha pra essa profundidade) mas
 * acompanha a câmera (`scrollFactor(0)`) — sem isso, a expansão de propriedade (Fase 6) faria o véu ficar fora de posição sempre
 * que a câmera rolasse.
 *
 * Profundidade: tem que ficar ACIMA de QUALQUER objeto do mundo, senão ele "fura" o véu (fica claro por cima, escuro em volta).
 * Árvore, jogador, decoração etc. usam a própria posição Y como profundidade (`setDepth(sprite.y)`, convenção repetida pelo
 * código todo pra desenhar quem está mais embaixo na frente). `POP_TEXT_DEPTH` (`systems/floatingText.ts`) já é a profundidade
 * combinada como "acima de qualquer objeto do mundo" pros textos flutuantes — o véu fica um a mais que ela, então também
 * escurece esses textos por cima.
 *
 * Recriação defensiva: andar aos poucos (o jogo inteiro) nunca tem problema, mas um SALTO grande e instantâneo da câmera (ex.:
 * teletransporte de debug, ou qualquer coisa que reposicione a câmera de uma vez, sem passar pelos quadros intermediários) pode
 * deixar o retângulo "sem efeito" mesmo com posição/tamanho/profundidade certos (reproduzido em teste isolado; recriar o
 * retângulo do zero sempre resolve). Nada no jogo hoje faz esse tipo de salto, mas a rotina se defende sozinha por garantia:
 * sempre que a câmera já rolou mais de `RECREATE_AFTER_SCROLL_PX` desde a última (re)criação, o retângulo é destruído e refeito
 * — barato (é só um retângulo sem textura) e invisível pro jogador (mesma cor/alpha/profundidade, sem piscar).
 */
export class DayNightOverlay {
  private rect: Phaser.GameObjects.Rectangle;
  private readonly scene: Phaser.Scene;
  private readonly camera: Phaser.Cameras.Scene2D.Camera;
  private lastAlpha = 0;
  /** Posição da câmera na última (re)criação do retângulo — compara com a atual pra saber se já rolou demais (ver `RECREATE_AFTER_SCROLL_PX`). */
  private lastScrollX = 0;
  private lastScrollY = 0;

  /** `intensity` (0-1): fração do escurecimento aplicada nesta cena — 1 ao ar livre; menos dentro de casa (lá tem luz de dentro). */
  constructor(
    scene: Phaser.Scene,
    private readonly intensity = 1,
  ) {
    this.scene = scene;
    this.camera = scene.cameras.main;
    this.rect = this.createRect();
  }

  private createRect(): Phaser.GameObjects.Rectangle {
    // fillAlpha 1 (opaco) — a opacidade de verdade é controlada só por
    // `setAlpha` (propriedade do game object), não pelo canal alpha da cor
    // de preenchimento; misturar os dois deixaria o retângulo sempre
    // invisível (alpha final = fillAlpha * alpha do objeto).
    const rect = this.scene.add.rectangle(0, 0, this.scene.scale.width, this.scene.scale.height, NIGHT_TINT, 1);
    rect.setOrigin(0, 0);
    rect.setScrollFactor(0);
    rect.setDepth(POP_TEXT_DEPTH + 1);
    rect.setAlpha(this.lastAlpha);
    rect.setData(KEEP_ON_WORLD_CAMERA, true); // Fica na câmera do mundo (o zoom o alarga e ele segue cobrindo a tela).
    this.lastScrollX = this.camera.scrollX;
    this.lastScrollY = this.camera.scrollY;
    return rect;
  }

  setNightAlpha(alpha: number): void {
    this.lastAlpha = alpha * this.intensity;
    const scrolled = Math.abs(this.camera.scrollX - this.lastScrollX) + Math.abs(this.camera.scrollY - this.lastScrollY);
    if (scrolled > RECREATE_AFTER_SCROLL_PX) {
      this.rect.destroy();
      this.rect = this.createRect();
    }
    this.rect.setAlpha(this.lastAlpha);
  }
}
