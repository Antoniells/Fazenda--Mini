import { CROPS, type CropDefinition } from '../data/crops';
import { seasonIdForDay, seasonName, type SeasonId } from '../data/seasons';
import type { Farmland } from './farmland';

/**
 * AS ESTAÇÕES NA LAVOURA (lógica pura, no estilo do Stardew): cada cultivo só é plantado nas estações dele (`CropDefinition.seasons`);
 * no Inverno nada cresce (nenhum cultivo é de inverno); e quando a estação vira, toda plantação que não é da estação nova morre — a
 * germinada fica seca (limpa com a Foice), a semente ainda dormente some.
 */

/** Dá pra plantar este cultivo nesta estação? */
export function isInSeason(crop: Pick<CropDefinition, 'seasons'>, season: SeasonId): boolean {
  return crop.seasons.includes(season);
}

/** "Primavera", "Primavera e Verão", "Primavera, Verão e Outono". */
export function seasonsLabel(seasons: readonly SeasonId[]): string {
  const names = seasons.map(seasonName);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}` : (names[0] ?? '');
}

/** De que estação são as sementes à venda no dia `day`: a do dia; no Inverno (nada cresce), já as da Primavera, pra preparar o plantio. */
export function seedSaleSeason(day: number): SeasonId {
  const season = seasonIdForDay(day);
  return season === 'winter' ? 'spring' : season;
}

/** Os cultivos cujas sementes estão à venda no dia `day` (só os da estação, `seedSaleSeason`). */
export function cropsOnSale(day: number): CropDefinition[] {
  const season = seedSaleSeason(day);
  return Object.values(CROPS).filter((crop) => isInSeason(crop, season));
}

/** Por que não dá pra plantar `cropId` no dia `day` (o aviso curto sobre o personagem), ou `null` se dá. */
export function plantBlockedReason(cropId: string, day: number): string | null {
  const crop = CROPS[cropId];
  if (!crop) return null;
  const season = seasonIdForDay(day);
  if (isInSeason(crop, season)) return null;
  if (season === 'winter') return 'No Inverno nada cresce';
  return `${crop.name}: só ${seasonsLabel(crop.seasons)}`;
}

/**
 * A virada do dia `day` (o anterior foi `day - 1`): se a estação mudou, as plantações fora de época morrem. Devolve o nome da estação
 * nova e quantas morreram, ou `undefined` se a estação não mudou.
 */
export function turnSeasonOnFarm(farmland: Pick<Farmland, 'killOutOfSeason'>, day: number): { name: string; died: number } | undefined {
  const season = seasonIdForDay(day);
  if (day <= 1 || seasonIdForDay(day - 1) === season) return undefined;
  const died = farmland.killOutOfSeason((cropId) => {
    const crop = CROPS[cropId];
    return !crop || isInSeason(crop, season);
  });
  return { name: seasonName(season), died };
}
