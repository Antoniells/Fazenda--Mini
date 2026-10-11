import { describe, expect, it } from 'vitest';
import { Farmland, describeFarmReport } from '../../src/systems/farmland';
import { cropsOnSale, isInSeason, plantBlockedReason, seasonsLabel, seedSaleSeason, turnSeasonOnFarm } from '../../src/systems/cropSeasons';
import { CROPS } from '../../src/data/crops';
import { SEASON_LENGTH_DAYS, precipitationIn, seasonIdForDay, weedsGrowIn } from '../../src/data/seasons';

/** O 1º dia de cada estação do primeiro ano. */
const FIRST_DAY = {
  spring: 1,
  summer: 1 + SEASON_LENGTH_DAYS,
  autumn: 1 + SEASON_LENGTH_DAYS * 2,
  winter: 1 + SEASON_LENGTH_DAYS * 3,
} as const;

describe('estações na lavoura', () => {
  it('cada cultivo tem estação; os básicos (Cenoura, Batata, Cebola) o ano todo menos no Inverno; nenhum é de Inverno', () => {
    for (const crop of Object.values(CROPS)) {
      expect(crop.seasons.length, crop.id).toBeGreaterThan(0);
      expect(crop.seasons, crop.id).not.toContain('winter');
    }
    for (const id of ['carrot', 'potato', 'onion']) expect(CROPS[id].seasons).toEqual(['spring', 'summer', 'autumn']);
    expect(CROPS['strawberry'].seasons).toEqual(['spring']);
    expect(CROPS['watermelon'].seasons).toEqual(['summer']);
    expect(CROPS['pumpkin'].seasons).toEqual(['autumn']);
    expect(Object.values(CROPS).filter((crop) => isInSeason(crop, 'summer')).length).toBeGreaterThan(10);
  });

  it('plantar fora de época é recusado (com o motivo); no Inverno, nada', () => {
    expect(seasonIdForDay(FIRST_DAY.summer)).toBe('summer');
    expect(plantBlockedReason('strawberry', FIRST_DAY.spring)).toBeNull();
    expect(plantBlockedReason('strawberry', FIRST_DAY.summer)).toBe('Morango: só Primavera');
    expect(plantBlockedReason('carrot', FIRST_DAY.autumn)).toBeNull();
    expect(plantBlockedReason('carrot', FIRST_DAY.winter)).toBe('No Inverno nada cresce');
    expect(seasonsLabel(['spring', 'summer', 'autumn'])).toBe('Primavera, Verão e Outono');
  });

  it('na virada da estação, o que ficou fora de época morre; o resto continua; sem virada, nada acontece', () => {
    const farmland = new Farmland([[0, 0], [1, 0], [2, 0]]);
    for (const [col, crop] of [[0, 'strawberry'], [1, 'carrot'], [2, 'tomato']] as const) {
      farmland.till(col, 0);
      farmland.plant(col, 0, crop);
      farmland.getPlot(col, 0)!.stage = 2;
    }
    expect(turnSeasonOnFarm(farmland, FIRST_DAY.spring + 3)).toBeUndefined();
    const turned = turnSeasonOnFarm(farmland, FIRST_DAY.summer);
    expect(turned).toEqual({ name: 'Verão', died: 1 });
    expect(farmland.getPlot(0, 0)!.state).toBe('dead'); // Morango: só Primavera.
    expect(farmland.getPlot(1, 0)!.state).toBe('growing'); // Cenoura: Verão também.
    expect(farmland.getPlot(2, 0)!.state).toBe('growing'); // Tomate: Verão.
    expect(turnSeasonOnFarm(farmland, FIRST_DAY.autumn)).toEqual({ name: 'Outono', died: 1 }); // O Tomate.
    expect(turnSeasonOnFarm(farmland, FIRST_DAY.winter)).toEqual({ name: 'Inverno', died: 1 }); // A Cenoura.
  });

  it('o "Bom dia" avisa a estação nova e quantas morreram', () => {
    expect(describeFarmReport({ grew: 0, wilted: 0, died: 0, ready: 0, seasonTurned: { name: 'Verão', died: 2 } })).toBe(
      'Chegou o Verão! 2 plantações fora de época morreram (limpe com a Foice).',
    );
    expect(describeFarmReport({ grew: 1, wilted: 0, died: 0, ready: 0, seasonTurned: { name: 'Outono', died: 0 } })).toBe('Chegou o Outono! Na lavoura: 1 cresceu.');
  });

  it('o mato (Capim) não aparece no Outono', () => {
    expect(weedsGrowIn('autumn')).toBe(false);
    expect(weedsGrowIn('spring')).toBe(true);
    expect(weedsGrowIn('summer')).toBe(true);
    expect(weedsGrowIn('winter')).toBe(true);
  });

  it('o vendedor só vende as sementes da estação; no Inverno, já as da Primavera', () => {
    const ids = (day: number): string[] => cropsOnSale(day).map((crop) => crop.id);
    expect(ids(FIRST_DAY.spring)).toContain('strawberry');
    expect(ids(FIRST_DAY.spring)).not.toContain('watermelon');
    expect(ids(FIRST_DAY.summer)).toContain('watermelon');
    expect(ids(FIRST_DAY.summer)).not.toContain('strawberry');
    expect(ids(FIRST_DAY.autumn)).toContain('pumpkin');
    expect(ids(FIRST_DAY.autumn)).toContain('carrot');
    expect(seedSaleSeason(FIRST_DAY.winter)).toBe('spring');
    expect(ids(FIRST_DAY.winter)).toEqual(ids(FIRST_DAY.spring));
    for (const day of [FIRST_DAY.spring, FIRST_DAY.summer, FIRST_DAY.autumn]) {
      expect(cropsOnSale(day).every((crop) => isInSeason(crop, seedSaleSeason(day)))).toBe(true);
    }
  });

  it('no Inverno não chove, neva', () => {
    expect(precipitationIn(seasonIdForDay(FIRST_DAY.winter))).toBe('snow');
    for (const day of [FIRST_DAY.spring, FIRST_DAY.summer, FIRST_DAY.autumn]) expect(precipitationIn(seasonIdForDay(day))).toBe('rain');
  });
});
