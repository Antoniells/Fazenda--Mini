import { CROPS, CropDefinition, rollHarvestAmount } from '../data/crops';

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

/** Formato salvo pelo `SaveManager` (Fase 10 — Persistência) — um `Plot` completo por célula cultivável. */
export type PlotSaveData = Plot;

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
  /**
   * Células em que a enxada NÃO age (hoje: onde há um aspersor posicionado — `DecorationPlacementSystem`).
   * Regra do grid da lavoura, não da ferramenta: vale pra qualquer origem de `till`. Estado transitório
   * (não vai pro save): a cena recria as travas a partir das construções posicionadas ao abrir.
   */
  private readonly tillLocked = new Set<string>();

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

  /** Trava/destrava a célula pra enxada (ver `tillLocked`). */
  setTillLocked(col: number, row: number, locked: boolean): void {
    if (locked) this.tillLocked.add(plotKey(col, row));
    else this.tillLocked.delete(plotKey(col, row));
  }

  isTillLocked(col: number, row: number): boolean {
    return this.tillLocked.has(plotKey(col, row));
  }

  /**
   * Terreno cultivável, ainda não arado -> arado. Recusa célula travada (aspersor em cima — `setTillLocked`).
   * `raining`: em dia de chuva a terra recém-arada já nasce molhada (a chuva cai nela), como o solo colhido em `harvest`.
   */
  till(col: number, row: number, raining = false): boolean {
    const plot = this.getPlot(col, row);
    if (!plot || plot.state !== 'untilled') return false;
    if (this.isTillLocked(col, row)) return false;
    plot.state = 'tilled';
    plot.wateredToday = raining;
    return true;
  }

  /**
   * Terreno arado e VAZIO -> terra normal de novo (a Picareta desfaz o arado). Recusa canteiro com semente/planta (`growing`/`dead`) —
   * esses não são "só arados"; o solo volta seco (a rega vale só pra plantação).
   */
  untill(col: number, row: number): boolean {
    const plot = this.getPlot(col, row);
    if (!plot || plot.state !== 'tilled') return false;
    plot.state = 'untilled';
    plot.cropId = null;
    plot.stage = 0;
    plot.wateredToday = false;
    return true;
  }

  /** Terreno arado e vazio -> plantado com a cultura informada. A semente fica dormente (nem morre, nem germina) até ser regada — só então passa a exigir rega diária pra não morrer (ver `onNewDay`). */
  plant(col: number, row: number, cropId: string, raining = false): boolean {
    const plot = this.getPlot(col, row);
    if (!plot || plot.state !== 'tilled') return false;
    if (!CROPS[cropId]) return false;

    plot.state = 'growing';
    plot.cropId = cropId;
    plot.stage = 0;
    plot.wateredToday = raining; // Chovendo, a semente já está molhada (a chuva cai nela).
    return true;
  }

  /** Regar marca a célula como regada hoje — necessário pra sobreviver à próxima virada de dia e avançar de estágio. */
  water(col: number, row: number): boolean {
    const plot = this.getPlot(col, row);
    if (!plot || plot.state !== 'growing') return false;
    plot.wateredToday = true;
    return true;
  }

  /** Rega TODAS as plantações — e a terra arada vazia, que a chuva também molha — de uma vez (chuva, ver `systems/weather.ts`); devolve as regadas agora (as já regadas hoje não contam). */
  waterAll(): Plot[] {
    const watered: Plot[] = [];
    for (const plot of this.plots.values()) {
      if ((plot.state === 'growing' || plot.state === 'tilled') && !plot.wateredToday) {
        plot.wateredToday = true;
        watered.push(plot);
      }
    }
    return watered;
  }

  /** Tem algo plantado vivo (semente ou planta) nesta célula? — alvo das plantações da horda. */
  hasLiveCrop(col: number, row: number): boolean {
    return this.getPlot(col, row)?.state === 'growing';
  }

  /**
   * A horda pisoteou a plantação: a planta germinada morre (fica `dead`, dá pra limpar com a Foice como qualquer plantação
   * seca); a semente ainda dormente simplesmente some (o canteiro volta a `tilled`). Devolve `true` se destruiu algo.
   */
  destroyCrop(col: number, row: number): boolean {
    const plot = this.getPlot(col, row);
    if (!plot || plot.state !== 'growing') return false;
    if (plot.stage > 0) {
      plot.state = 'dead';
    } else {
      plot.state = 'tilled';
      plot.cropId = null;
    }
    plot.wateredToday = false;
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

  /**
   * Colhe uma plantação pronta: libera o terreno (volta a arado) e devolve o resultado — quem chama decide o que fazer com a colheita (hoje ela cai no chão, ver `systems/lootDrops.ts`).
   * `raining`: em dia de chuva o solo colhido CONTINUA molhado (a chuva segue caindo nele); fora da chuva ele volta a seco, como sempre.
   */
  harvest(col: number, row: number, raining = false): { cropId: string; amount: number } | null {
    const plot = this.getPlot(col, row);
    if (!plot || !this.isReady(plot)) return null;
    const crop = this.getCrop(plot);
    if (!crop) return null;

    plot.state = 'tilled';
    plot.cropId = null;
    plot.stage = 0;
    plot.wateredToday = raining;

    return { cropId: crop.id, amount: rollHarvestAmount(crop.yieldAmount) };
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
        plot.wateredToday = false; // O solo colhido na chuva (`harvest`) seca na virada do dia.
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

  serialize(): PlotSaveData[] {
    return this.getAllPlots().map((plot) => ({ ...plot }));
  }

  /**
   * Reconstrói a partir de `serialize()` — as próprias células salvas já
   * definem a área cultivável (não precisa de `farmMap.farmlandArea` de
   * novo), então um save continua válido mesmo que a área da lavoura mude
   * num mapa editado depois.
   */
  static deserialize(data: PlotSaveData[], raining = false): Farmland {
    const farmland = new Farmland(data.map((plot): [number, number] => [plot.col, plot.row]));
    for (const saved of data) {
      const plot = farmland.getPlot(saved.col, saved.row);
      if (!plot) continue;
      plot.state = saved.state;
      plot.cropId = saved.cropId;
      plot.stage = saved.stage;
      // Solo arado e vazio só está molhado se estiver chovendo (saves antigos deixavam a flag ligada depois de colher).
      plot.wateredToday = saved.state === 'tilled' ? saved.wateredToday && raining : saved.wateredToday;
    }
    return farmland;
  }
}
