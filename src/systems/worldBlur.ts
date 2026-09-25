import Phaser from 'phaser';

/** Baixa qualidade (0): efeito leve e barato — não precisa da qualidade média/alta pra um desfoque discreto de fundo. */
const BLUR_QUALITY = 0;
/** Força do desfoque — baixa de propósito ("desfoque leve", pedido explícito do usuário), só o bastante pra destacar a janela em cima. */
const BLUR_STRENGTH = 1.6;

/**
 * Desfoque leve do MUNDO enquanto qualquer janela de UI está aberta (Loja, Inventário, Bancada, Caixa de Remessas, Pausa/
 * Configurações — pedido explícito do usuário: "sempre que qualquer janela de UI for aberta"). Usa o filtro `Blur` nativo do
 * Phaser 4 (`camera.filters.internal`), aplicado só na câmera do MUNDO — a HUD/UI fica em uma câmera à parte
 * (`systems/uiCamera.ts`) que este filtro nunca toca, então painéis e texto continuam nítidos por cima do fundo borrado.
 *
 * Criado uma vez (o filtro fica sempre na lista) e só liga/desliga (`setActive`, barato — não recria nada) a cada frame, em vez
 * de adicionar/remover o filtro toda vez que uma janela abre/fecha.
 */
export class WorldBlur {
  private readonly filter: Phaser.Filters.Blur;

  constructor(camera: Phaser.Cameras.Scene2D.Camera) {
    this.filter = camera.filters.internal.addBlur(BLUR_QUALITY, 2, 2, BLUR_STRENGTH);
    this.filter.active = false;
  }

  setActive(active: boolean): void {
    this.filter.active = active;
  }
}
