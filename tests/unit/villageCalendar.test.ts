import { describe, expect, it } from 'vitest';
import { villageCalendar, villageEventsOn } from '../../src/systems/villageCalendar';

describe('mural do Vilarejo: calendário e eventos', () => {
  it('o calendário mostra os 10 dias da estação de hoje, com hoje marcado', () => {
    const calendar = villageCalendar(13);
    expect(calendar.season).toBe('summer');
    expect(calendar.title).toBe('Verão — dia 3 de 10');
    expect(calendar.days.map((day) => day.day)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    expect(calendar.days.filter((day) => day.isToday).map((day) => day.day)).toEqual([13]);
  });

  it('eventos: começo da estação, visita do dia 8, noite de horda e último dia', () => {
    expect(villageEventsOn(1)).toEqual(['Começo da Primavera']);
    expect(villageEventsOn(8)).toEqual(['Um visitante passa pela Fazenda']);
    expect(villageEventsOn(8, { visitorDone: true })).toEqual([]);
    expect(villageEventsOn(10)).toEqual(['Noite de horda na Fazenda (19h)', 'Último dia da Primavera: colha o que não é do Verão']);
    expect(villageEventsOn(11)).toEqual(['Começo do Verão']);
    expect(villageEventsOn(5)).toEqual([]);
    expect(villageEventsOn(40)).toEqual(['Noite de horda na Fazenda (19h)', 'Último dia do Inverno']);
  });

  it('os próximos acontecimentos começam hoje e seguem em ordem', () => {
    const upcoming = villageCalendar(9, { visitorDone: true }).upcoming;
    expect(upcoming[0]).toEqual({ day: 10, when: 'Dia 10', text: 'Noite de horda na Fazenda (19h)' });
    expect(upcoming.find((entry) => entry.day === 11)?.when).toBe('Dia 1 do Verão');
    expect(villageCalendar(10).upcoming[0].when).toBe('Hoje');
    expect(upcoming.map((entry) => entry.day)).toEqual([...upcoming.map((entry) => entry.day)].sort((a, b) => a - b));
    expect(upcoming.length).toBe(5);
  });
});
