import Phaser from 'phaser';
import { KEEP_ON_WORLD_CAMERA, UI_CAMERA_NAME } from './uiCamera';
import { POP_TEXT_DEPTH } from './floatingText';
import { ambientColorAt, mixColors } from './ambientLight';

const WHITE = 0xffffff;

/** Acima desta distância (px) rolada desde a última vez que o retângulo foi (re)criado, ele é recriado — ver comentário da classe. */
const RECREATE_AFTER_SCROLL_PX = 400;

/**
 * Luz ambiente do dia (Fase 7 — Sistema de Tempo; ciclo de cores do sol): um retângulo cobrindo a tela inteira, pintado com a cor
 * do sol da hora atual (`systems/ambientLight.ts`, chaves em `data/lighting.ts`: manhã dourada, tarde neutra, entardecer
 * alaranjado, noite escura) e desenhado em MULTIPLY — a cena inteira é multiplicada pela cor, como um filtro de luz global (branco
 * = sem efeito). Mesma técnica já usada no fundo da `CoinBar` (`scene.add.rectangle`): a cor em si É o efeito, não uma peça de UI.
 *
 * Cobre o MUNDO (a HUD de verdade está numa câmera à parte — `systems/uiCamera.ts` — e nem olha pra essa profundidade) mas
 * acompanha a câmera (`scrollFactor(0)`) — sem isso, a expansão de propriedade (Fase 6) faria o véu ficar fora de posição sempre
 * que a câmera rolasse.
 *
 * Profundidade: tem que ficar ACIMA de QUALQUER objeto do mundo, senão ele "fura" o véu (fica claro por cima, escuro em volta).
 * Árvore, jogador, decoração etc. usam a própria posição Y como profundidade (`setDepth(sprite.y)`, convenção repetida pelo
 * código todo pra desenhar quem está mais embaixo na frente). `POP_TEXT_DEPTH` (`systems/floatingText.ts`) já é a profundidade
 * combinada como "acima de qualquer objeto do mundo" pros textos flutuantes — o véu fica um a mais que ela, então também
 * escurece esses textos por cima. As fontes de luz (`systems/lightSources.ts`) desenham o brilho ACIMA do véu (`LIGHT_GLOW_DEPTH`).
 *
 * Recriação defensiva: andar aos poucos (o jogo inteiro) nunca tem problema, mas um SALTO grande e instantâneo da câmera (ex.:
 * teletransporte de debug, ou qualquer coisa que reposicione a câmera de uma vez, sem passar pelos quadros intermediários) pode
 * deixar o retângulo "sem efeito" mesmo com posição/tamanho/profundidade certos (reproduzido em teste isolado; recriar o
 * retângulo do zero sempre resolve). Nada no jogo hoje faz esse tipo de salto, mas a rotina se defende sozinha por garantia:
 * sempre que a câmera já rolou mais de `RECREATE_AFTER_SCROLL_PX` desde a última (re)criação, o retângulo é destruído e refeito
 * — barato (é só um retângulo sem textura) e invisível pro jogador (mesma cor/blend/profundidade, sem piscar).
 */
export class DayNightOverlay {
  private rect: Phaser.GameObjects.Rectangle;
  private readonly scene: Phaser.Scene;
  private readonly camera: Phaser.Cameras.Scene2D.Camera;
  private lastColor = WHITE;
  /** Posição da câmera na última (re)criação do retângulo — compara com a atual pra saber se já rolou demais (ver `RECREATE_AFTER_SCROLL_PX`). */
  private lastScrollX = 0;
  private lastScrollY = 0;

  /** `intensity` (0-1): fração do efeito aplicada nesta cena — 1 ao ar livre; menos dentro de casa (lá tem luz de dentro). */
  constructor(
    scene: Phaser.Scene,
    private readonly intensity = 1,
  ) {
    this.scene = scene;
    this.camera = scene.cameras.main;
    this.rect = this.createRect();
  }

  private createRect(): Phaser.GameObjects.Rectangle {
    const rect = this.scene.add.rectangle(0, 0, this.scene.scale.width, this.scene.scale.height, this.lastColor, 1);
    rect.setOrigin(0, 0);
    rect.setScrollFactor(0);
    rect.setDepth(POP_TEXT_DEPTH + 1);
    rect.setBlendMode(Phaser.BlendModes.MULTIPLY);
    rect.setVisible(this.lastColor !== WHITE);
    rect.setData(KEEP_ON_WORLD_CAMERA, true); // Fica na câmera do mundo (o zoom o alarga e ele segue cobrindo a tela).
    // Já nasce ignorado pela câmera de interface: quem o atribui é a varredura do `installUiCamera`, mas ela só roda no início do quadro
    // seguinte — sem isto, no quadro da (re)criação o retângulo era desenhado TAMBÉM por cima da HUD (a tela piscava a cada recriação).
    const uiCamera = this.scene.cameras.getCamera(UI_CAMERA_NAME);
    // ATRIBUI (não soma): todo objeto novo nasce escondido das duas câmeras até a varredura (`installUiCamera`) — o véu precisa aparecer na do mundo já neste quadro, senão a tela clareia por um instante.
    rect.cameraFilter = uiCamera ? uiCamera.id : 0;
    this.lastScrollX = this.camera.scrollX;
    this.lastScrollY = this.camera.scrollY;
    return rect;
  }

  /** Aplica a luz do sol da hora dada (0-24, `GameClock.getHours`) — chamado a cada quadro pela cena. */
  setHours(hours: number): void {
    this.setColor(ambientColorAt(hours));
  }

  /** Aplica uma cor de luz qualquer (as Cavernas usam a penumbra do andar — `systems/caveLighting.ts`), com a mesma fração `intensity`. */
  setColor(color: number): void {
    this.lastColor = mixColors(WHITE, color, this.intensity);
    const scrolled = Math.abs(this.camera.scrollX - this.lastScrollX) + Math.abs(this.camera.scrollY - this.lastScrollY);
    if (scrolled > RECREATE_AFTER_SCROLL_PX) {
      this.rect.destroy();
      this.rect = this.createRect();
    }
    this.rect.setFillStyle(this.lastColor, 1);
    this.rect.setVisible(this.lastColor !== WHITE);
  }
}
