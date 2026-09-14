import { CROPS, CropDefinition } from '../data/crops';
import { Inventory } from './inventory';

export type PlotState = 'untilled' | 'tilled' | 'growing' | 'dead';

/** Chance de uma célula arada (`tilled`) e vazia voltar a `untilled` na virada do dia — ver `onNewDay`. */
const TILLED_DECAY_CHANCE = 0.3;

export interface Plot {
  readonly col: number;
  readonly row: number;
  state: PlotState;
  cropId: string | null;
  /**
   * Índice em `crop.growthFrames` — avança no máximo 1 por virada de dia
   * (`onNewDay`), nunca durante o dia (pedido explícito): uma semente
   * plantada não germina nem cresce "ao vivo", só quando o dia muda.
   */
  stage: number;
  /**
   * Foi regada desde a última virada de dia? Resetada pra `false` a cada
   * `onNewDay` (exige regar de novo no dia seguinte). Sem rega, uma
   * plantação já germinada (`stage > 0`) morre na virada seguinte — mas a
   * semente em si (`stage === 0`) só fica dormente, não morre (ver
   * `onNewDay`). Recém-plantada começa `false`: plantar sozinho não conta
   * como regar.
   */
  wateredToday: boolean;
}

function plotKey(col: number, row: number): string {
  return `${col},${row}`;
}

/**
 * Estado e regras da agricultura.
 * - Crescimento: por DIA, não por tempo real decorrido — `stage` só avança
 *   (no máximo 1) dentro de `onNewDay`.
 * - Rega: precisa acontecer todo dia (`water` marca `wateredToday`), mas só
 *   depois de germinada. Na virada do dia (`onNewDay`), quem foi regada
 *   avança 1 estágio e volta a precisar de rega no novo dia; quem não foi
 *   regada e já germinou (`stage > 0`) morre; a semente ainda não germinada
 *   (`stage === 0`) sem água só fica dormente, não morre.
 *
 * Sem nenhuma dependência do Phaser — a renderização fica em
 * `systems/farmlandRenderer.ts`.
 */
export class Farmland {
  private readonly plots = new Map<string, Plot>();

  constructor(cultivableCells: Array<[number, number]>) {
    for (const [col, row] of cultivableCells) {
      this.plots.set(plotKey(col, row), {
        col,
        row,
        state: 'untilled',
        cropId: null,
        stage: 0,
        wateredToday: false,
      });
    }
  }

  /** É uma célula cultivável (faz parte da área de agricultura)? */
  isCultivable(col: number, row: number): boolean {
    return this.plots.has(plotKey(col, row));
  }

  /**
   * Está arada (ou além — plantada/morta, que continuam com o solo arado
   * visível)? Usado pelo `FarmlandRenderer` pra decidir a borda do autotile
   * de solo a partir dos 4 vizinhos — uma célula fora do grid (não
   * cultivável) conta como "não arada", pra a borda também reagir
   * corretamente contra grama comum, não só contra outra célula de terra
   * arável vazia.
   */
  isTilled(col: number, row: number): boolean {
    const plot = this.getPlot(col, row);
    return !!plot && plot.state !== 'untilled';
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

  /** Foi regada hoje? Usado pelo renderizador pra decidir solo seco/molhado — mesma condição que rege o crescimento em `onNewDay`. */
  isWatered(plot: Plot): boolean {
    return plot.wateredToday;
  }

  /** Terreno cultivável, ainda não arado -> arado. */
  till(col: number, row: number): boolean {
    const plot = this.getPlot(col, row);
    if (!plot || plot.state !== 'untilled') return false;
    plot.state = 'tilled';
    return true;
  }

  /** Terreno arado e vazio -> plantado com a cultura informada. A semente fica dormente (nem morre, nem germina) até ser regada — só então passa a exigir rega diária pra não morrer (ver `onNewDay`). */
  plant(col: number, row: number, cropId: string): boolean {
    const plot = this.getPlot(col, row);
    if (!plot || plot.state !== 'tilled') return false;
    if (!CROPS[cropId]) return false;

    plot.state = 'growing';
    plot.cropId = cropId;
    plot.stage = 0;
    plot.wateredToday = false;
    return true;
  }

  /** Regar marca a célula como regada hoje — necessário pra sobreviver à próxima virada de dia e avançar de estágio. */
  water(col: number, row: number): boolean {
    const plot = this.getPlot(col, row);
    if (!plot || plot.state !== 'growing') return false;
    plot.wateredToday = true;
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

  /**
   * Chamado pela `MainScene` quando o `GameClock` sinaliza a virada do dia
   * (Fase 9) — o único momento em que o estado da lavoura muda por conta
   * própria:
   * - Terra arada mas vazia (`tilled`, sem semente) tem `TILLED_DECAY_CHANCE`
   *   de chance de voltar a `untilled` — sem isso, arar seria permanente e
   *   a enxada perderia utilidade depois do primeiro dia.
   * - Terra plantada (`growing`): se foi regada hoje, avança 1 estágio (até
   *   o máximo de `crop.growthFrames`) e volta a precisar de rega no novo
   *   dia; se NÃO foi regada, morre (`state` vira `'dead'`) — MAS só a
   *   partir do estágio de germinação (`stage > 0`); a semente em si
   *   (`stage === 0`, ainda não germinada) fica dormente sem água, não
   *   morre — a rega diária só passa a ser obrigatória depois de germinar.
   */
  onNewDay(): void {
    for (const plot of this.plots.values()) {
      if (plot.state === 'tilled') {
        if (Math.random() < TILLED_DECAY_CHANCE) plot.state = 'untilled';
        continue;
      }

      if (plot.state !== 'growing') continue;
      const crop = this.getCrop(plot);
      if (!crop) continue;

      if (plot.wateredToday) {
        plot.stage = Math.min(crop.growthFrames.length - 1, plot.stage + 1);
        plot.wateredToday = false;
        continue;
      }

      // Não foi regada hoje. Só morre se já tiver germinado (stage > 0,
      // além da semente recém-plantada) — pedido explícito: a semente em
      // si (stage 0) não morre com o passar dos dias, só fica dormente até
      // ser regada e germinar.
      if (plot.stage > 0) plot.state = 'dead';
    }
  }

  getAllPlots(): Plot[] {
    return Array.from(this.plots.values());
  }
}
