import { CROPS, CropDefinition } from '../data/crops';
import { Inventory } from './inventory';

export type PlotState = 'untilled' | 'tilled' | 'growing' | 'dead';

export interface Plot {
  readonly col: number;
  readonly row: number;
  state: PlotState;
  cropId: string | null;
  /** Índice em `crop.growthFrames`, derivado do tempo decorrido — nunca da rega. */
  stage: number;
  /** Momento (no relógio do `Farmland`) em que a semente foi plantada. */
  plantedAt: number;
  /** Momento (no relógio do `Farmland`) da última rega. */
  lastWateredAt: number;
}

function plotKey(col: number, row: number): string {
  return `${col},${row}`;
}

/**
 * Estado e regras da agricultura. Duas responsabilidades deliberadamente
 * separadas, como pedido:
 * - Crescimento: função só do tempo decorrido desde o plantio
 *   (`plantedAt`) contra `crop.totalGrowthMs`. Regar não acelera nem é
 *   necessário para o estágio avançar.
 * - Hidratação: função só do tempo desde a última rega
 *   (`lastWateredAt`). Se esse tempo passar de `crop.maxTimeWithoutWaterMs`,
 *   a plantação morre — mas isso não afeta o cálculo de estágio, que já
 *   parou de importar nesse ponto porque o estado deixou de ser `growing`.
 *
 * Um relógio interno (`clockMs`, incrementado a cada `update`) é usado em
 * vez de um contador que reinicia do zero, para que `plantedAt`/
 * `lastWateredAt` sejam "momentos" (como pedido) e não durações já
 * decorridas — isso deixa a estrutura pronta para um futuro sistema de
 * salvar/restaurar (salvar os momentos e o relógio, sem reescrever nada
 * aqui), mesmo que esse sistema não exista ainda.
 *
 * Sem nenhuma dependência do Phaser — a renderização fica em
 * `systems/farmlandRenderer.ts`.
 */
export class Farmland {
  private readonly plots = new Map<string, Plot>();
  private clockMs = 0;

  constructor(cultivableCells: Array<[number, number]>) {
    for (const [col, row] of cultivableCells) {
      this.plots.set(plotKey(col, row), {
        col,
        row,
        state: 'untilled',
        cropId: null,
        stage: 0,
        plantedAt: 0,
        lastWateredAt: 0,
      });
    }
  }

  /** É uma célula cultivável (faz parte da área de agricultura)? */
  isCultivable(col: number, row: number): boolean {
    return this.plots.has(plotKey(col, row));
  }

  getPlot(col: number, row: number): Plot | undefined {
    return this.plots.get(plotKey(col, row));
  }

  private getCrop(plot: Plot): CropDefinition | null {
    return plot.cropId ? CROPS[plot.cropId] ?? null : null;
  }

  isReady(plot: Plot): boolean {
    const crop = this.getCrop(plot);
    return !!crop && plot.state === 'growing' && plot.stage >= crop.growthFrames.length - 1;
  }

  /** Tempo (ms) desde a última rega — usado pelo renderizador para decidir solo seco/molhado. */
  timeSinceWatered(plot: Plot): number {
    return this.clockMs - plot.lastWateredAt;
  }

  /** Terreno cultivável, ainda não arado -> arado. */
  till(col: number, row: number): boolean {
    const plot = this.getPlot(col, row);
    if (!plot || plot.state !== 'untilled') return false;
    plot.state = 'tilled';
    return true;
  }

  /** Terreno arado e vazio -> plantado com a cultura informada. Começa a contar crescimento e hidratação. */
  plant(col: number, row: number, cropId: string): boolean {
    const plot = this.getPlot(col, row);
    if (!plot || plot.state !== 'tilled') return false;
    if (!CROPS[cropId]) return false;
    plot.state = 'growing';
    plot.cropId = cropId;
    plot.stage = 0;
    plot.plantedAt = this.clockMs;
    plot.lastWateredAt = this.clockMs; // recém-plantada conta como regada agora.
    return true;
  }

  /** Regar apenas renova a hidratação — não afeta o crescimento. */
  water(col: number, row: number): boolean {
    const plot = this.getPlot(col, row);
    if (!plot || plot.state !== 'growing') return false;
    plot.lastWateredAt = this.clockMs;
    return true;
  }

  /** Remove uma plantação morta, liberando o terreno (arado) para novo plantio. */
  clearDead(col: number, row: number): boolean {
    const plot = this.getPlot(col, row);
    if (!plot || plot.state !== 'dead') return false;
    plot.state = 'tilled';
    plot.cropId = null;
    plot.stage = 0;
    return true;
  }

  /** Colhe uma plantação pronta: libera o terreno (volta a arado) e devolve o resultado. */
  harvest(col: number, row: number, inventory: Inventory): { cropId: string; amount: number } | null {
    const plot = this.getPlot(col, row);
    if (!plot || !this.isReady(plot)) return null;
    const crop = this.getCrop(plot);
    if (!crop) return null;

    inventory.add(crop.id, crop.yieldAmount);

    plot.state = 'tilled';
    plot.cropId = null;
    plot.stage = 0;

    return { cropId: crop.id, amount: crop.yieldAmount };
  }

  /** Avança o relógio, o crescimento (por tempo) e verifica hidratação (morte por falta de rega). */
  update(deltaMs: number): void {
    this.clockMs += deltaMs;

    for (const plot of this.plots.values()) {
      if (plot.state !== 'growing') continue;
      const crop = this.getCrop(plot);
      if (!crop) continue;

      if (this.timeSinceWatered(plot) > crop.maxTimeWithoutWaterMs) {
        plot.state = 'dead';
        continue;
      }

      const growthElapsedMs = this.clockMs - plot.plantedAt;
      const stepMs = crop.totalGrowthMs / (crop.growthFrames.length - 1);
      plot.stage = Math.min(crop.growthFrames.length - 1, Math.floor(growthElapsedMs / stepMs));
    }
  }

  getAllPlots(): Plot[] {
    return Array.from(this.plots.values());
  }
}
