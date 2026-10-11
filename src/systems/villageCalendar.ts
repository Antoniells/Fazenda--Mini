import { SEASON_LENGTH_DAYS, seasonIdForDay, seasonName, type SeasonId } from '../data/seasons';
import { HORDE_START_HOUR, isHordeDay } from '../data/horde';
import { VISITOR_DAY } from '../data/events';

/**
 * O MURAL DO VILAREJO (lógica pura; o quadro é `ui/noticeBoardPanel.ts`): o calendário da estação do dia (os `SEASON_LENGTH_DAYS` dias
 * dela, com o de hoje marcado) e os próximos acontecimentos — noites de horda, começo e último dia de cada estação (na virada, o que
 * não é da estação nova morre) e a visita do dia 8 na Fazenda, enquanto não aconteceu.
 */

/** "da Primavera" / "do Verão" (a Primavera é a única estação feminina). */
function ofSeason(season: SeasonId): string {
  return `${season === 'spring' ? 'da' : 'do'} ${seasonName(season)}`;
}

export interface CalendarOptions {
  /** A visita do dia 8 já aconteceu (não aparece mais no mural). */
  visitorDone?: boolean;
}

/** O que acontece no dia `day` (pode ser nada). */
export function villageEventsOn(day: number, options: CalendarOptions = {}): string[] {
  const events: string[] = [];
  const season = seasonIdForDay(day);
  const seasonDay = ((day - 1) % SEASON_LENGTH_DAYS) + 1;
  if (seasonDay === 1) events.push(`Começo ${ofSeason(season)}`);
  if (day === VISITOR_DAY && !options.visitorDone) events.push('Um visitante passa pela Fazenda');
  if (isHordeDay(day)) events.push(`Noite de horda na Fazenda (${HORDE_START_HOUR}h)`);
  if (seasonDay === SEASON_LENGTH_DAYS) {
    // No Inverno nada cresce: não há o que colher antes da virada.
    events.push(season === 'winter' ? `Último dia ${ofSeason(season)}` : `Último dia ${ofSeason(season)}: colha o que não é ${ofSeason(seasonIdForDay(day + 1))}`);
  }
  return events;
}

export interface CalendarDay {
  day: number;
  /** O dia dentro da estação (1..`SEASON_LENGTH_DAYS`). */
  seasonDay: number;
  isToday: boolean;
  events: string[];
}

export interface VillageCalendar {
  season: SeasonId;
  /** "Primavera — dia 3 de 10". */
  title: string;
  /** Os dias da estação de hoje, em ordem. */
  days: CalendarDay[];
  /** Os próximos acontecimentos (a partir de hoje), até `upcomingCount`: `when` = "Hoje", "Dia 8" (nesta estação) ou "Dia 1 do Verão". */
  upcoming: Array<{ day: number; when: string; text: string }>;
}

export function villageCalendar(today: number, options: CalendarOptions = {}, upcomingCount = 5): VillageCalendar {
  const season = seasonIdForDay(today);
  const seasonDay = ((today - 1) % SEASON_LENGTH_DAYS) + 1;
  const firstDay = today - seasonDay + 1;
  const days: CalendarDay[] = [];
  for (let offset = 0; offset < SEASON_LENGTH_DAYS; offset++) {
    const day = firstDay + offset;
    days.push({ day, seasonDay: offset + 1, isToday: day === today, events: villageEventsOn(day, options) });
  }
  const whenOf = (day: number): string => {
    if (day === today) return 'Hoje';
    const dayInSeason = ((day - 1) % SEASON_LENGTH_DAYS) + 1;
    return seasonIdForDay(day) === season && day - today < SEASON_LENGTH_DAYS ? `Dia ${dayInSeason}` : `Dia ${dayInSeason} ${ofSeason(seasonIdForDay(day))}`;
  };
  const upcoming: Array<{ day: number; when: string; text: string }> = [];
  for (let day = today; upcoming.length < upcomingCount && day < today + SEASON_LENGTH_DAYS * 4; day++) {
    for (const text of villageEventsOn(day, options)) if (upcoming.length < upcomingCount) upcoming.push({ day, when: whenOf(day), text });
  }
  return { season, title: `${seasonName(season)} — dia ${seasonDay} de ${SEASON_LENGTH_DAYS}`, days, upcoming };
}
