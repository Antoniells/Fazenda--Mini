import Phaser from 'phaser';
import { ambientColorAt, mixColors } from './ambientLight';
import { enableWorldLighting } from './sceneLighting';

const WHITE = 0xffffff;

/** Cor `base` multiplicada pela luz `light` (canal a canal, como o Phaser faz com os objetos iluminados). */
export function multiplyColor(base: number, light: number): number {
  const channel = (shift: number): number => Math.round((((base >> shift) & 0xff) * ((light >> shift) & 0xff)) / 255);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

/**
 * Luz do SOL na superfície (Fase 7 — ciclo de cores do sol; Fase 11 — iluminação nativa do Phaser 4): a cor do sol da hora atual
 * (`systems/ambientLight.ts`, chaves em `data/lighting.ts`: manhã dourada, tarde neutra, entardecer alaranjado, noite escura) é a LUZ
 * AMBIENTE da cena — a cor de cada objeto do mundo é multiplicada por ela (de dia, igual ao véu em MULTIPLY de antes) e as luzes de
 * verdade (postes e tochas, `systems/lightSources.ts`) somam por cima: à noite elas iluminam a rua em vez de só brilhar sobre um véu.
 * Quem liga a luz em cada objeto do mundo (e deixa de fora interface, textos e brilhos) é `systems/sceneLighting.ts`.
 *
 * Mantém o nome e a interface de antes (`new DayNightOverlay(cena, intensidade)` + `setHours` a cada quadro), usados pelas cenas.
 */
export class DayNightOverlay {
  /**
   * A cor de fundo da câmera da cena (lida na 1ª vez, já com a que a cena escolheu): o fundo não é um objeto, então a luz não o atinge
   * sozinha — sem isto ele ficava sempre na cor do meio-dia e aparecia nas frestas das peças (a borda de terra da Fazenda clara de
   * dia, uma linha verde acesa ao lado do alpendre do Vilarejo à noite). `null` = ainda não lida; `-1` = fundo transparente (não mexe).
   */
  private baseBackground: number | null = null;

  /** `intensity` (0-1): fração do efeito aplicada nesta cena — 1 ao ar livre; menos dentro de casa (lá tem luz de dentro). */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly intensity = 1,
  ) {
    enableWorldLighting(scene);
  }

  /** Aplica a luz do sol da hora dada (0-24, `GameClock.getHours`) — chamado a cada quadro pela cena. */
  setHours(hours: number): void {
    this.setColor(ambientColorAt(hours));
  }

  /** Aplica uma cor de luz qualquer como ambiente, com a mesma fração `intensity`. */
  setColor(color: number): void {
    const ambient = mixColors(WHITE, color, this.intensity);
    this.scene.lights.setAmbientColor(ambient);

    // O fundo da câmera recebe a mesma luz do sol que o resto do mundo.
    const camera = this.scene.cameras.main;
    if (this.baseBackground === null) this.baseBackground = camera.backgroundColor.alpha > 0 ? camera.backgroundColor.color : -1;
    if (this.baseBackground >= 0) camera.setBackgroundColor(multiplyColor(this.baseBackground, ambient));
  }
}
