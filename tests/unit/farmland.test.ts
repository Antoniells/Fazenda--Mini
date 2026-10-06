import { describe, expect, it } from 'vitest';
import { DRY_DAYS_TO_DIE, Farmland, describeFarmReport } from '../../src/systems/farmland';
import { CARROT } from '../../src/data/crops';

/** Uma lavoura de 1 célula com uma cenoura plantada. */
function plantedCarrot(): Farmland {
  const farmland = new Farmland([[0, 0]]);
  farmland.till(0, 0);
  farmland.plant(0, 0, CARROT.id);
  return farmland;
}

describe('rega e murcha', () => {
  it('a semente nunca regada fica dormente (não morre)', () => {
    const farmland = plantedCarrot();
    for (let day = 0; day < 5; day++) farmland.onNewDay();
    expect(farmland.getPlot(0, 0)!.state).toBe('growing');
    expect(farmland.getPlot(0, 0)!.stage).toBe(0);
  });

  it('germinada e sem água: murcha no 1º dia, morre no 2º seguido — antes morria no 1º', () => {
    const farmland = plantedCarrot();
    farmland.water(0, 0);
    expect(farmland.onNewDay().grew).toBe(1);
    const plot = farmland.getPlot(0, 0)!;

    const first = farmland.onNewDay();
    expect(first.wilted).toBe(1);
    expect(plot.state).toBe('growing');
    expect(plot.stage).toBe(1); // Murcha não cresce.
    expect(farmland.isWilted(plot)).toBe(true);

    expect(DRY_DAYS_TO_DIE).toBe(2);
    expect(farmland.onNewDay().died).toBe(1);
    expect(plot.state).toBe('dead');
  });

  it('regar a murcha salva e zera a contagem', () => {
    const farmland = plantedCarrot();
    farmland.water(0, 0);
    farmland.onNewDay();
    farmland.onNewDay(); // Murchou.
    farmland.water(0, 0);
    const plot = farmland.getPlot(0, 0)!;
    expect(farmland.isWilted(plot)).toBe(false);
    farmland.onNewDay();
    expect(plot.dryDays).toBe(0);
    farmland.onNewDay(); // Murcha de novo, mas não morre: a conta recomeçou.
    expect(plot.state).toBe('growing');
  });

  it('pronta pra colher não morre sem água', () => {
    const farmland = plantedCarrot();
    const last = CARROT.growthFrames.length - 1;
    for (let day = 0; day < last; day++) {
      farmland.water(0, 0);
      farmland.onNewDay();
    }
    expect(farmland.isReady(farmland.getPlot(0, 0)!)).toBe(true);
    for (let day = 0; day < 4; day++) expect(farmland.onNewDay().ready).toBe(1);
    expect(farmland.getPlot(0, 0)!.state).toBe('growing');
  });
});

describe('o "Bom dia" da lavoura', () => {
  it('resume prontas, cresceram, murchas e mortas; nada a dizer = null', () => {
    expect(describeFarmReport({ grew: 0, wilted: 0, died: 0, ready: 0 })).toBeNull();
    const text = describeFarmReport({ grew: 3, wilted: 2, died: 1, ready: 1 })!;
    expect(text).toContain('1 pronta pra colher');
    expect(text).toContain('3 cresceram');
    expect(text).toContain('2 murchas sem água');
    expect(text).toContain('1 morreu sem água');
  });
});
