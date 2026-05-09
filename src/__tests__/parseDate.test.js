import { describe, it, expect } from 'vitest';
import { parseDate, formatDeDate } from '../utils/parseDate.js';

const today = new Date(2026, 4, 9); // 9. Mai 2026

describe('parseDate – vollständig', () => {
  it('erkennt DD.MM.YYYY', () => {
    expect(parseDate('15.05.2026', today)).toBe('2026-05-15');
  });
  it('erkennt DD.MM.YY (zweistelliges Jahr → 20YY)', () => {
    expect(parseDate('15.05.26', today)).toBe('2026-05-15');
    expect(parseDate('15.5.26', today)).toBe('2026-05-15');
  });
  it('erkennt rein-numerisch DDMMYYYY', () => {
    expect(parseDate('15052026', today)).toBe('2026-05-15');
  });
  it('erkennt rein-numerisch DDMMYY', () => {
    expect(parseDate('150526', today)).toBe('2026-05-15');
  });
  it('akzeptiert / und - als Trenner', () => {
    expect(parseDate('15/05/2026', today)).toBe('2026-05-15');
    expect(parseDate('15-05-2026', today)).toBe('2026-05-15');
  });
  it('akzeptiert trailing Punkt', () => {
    expect(parseDate('15.05.2026.', today)).toBe('2026-05-15');
  });
});

describe('parseDate – Smart-Year (ohne Jahres-Eingabe)', () => {
  it('Tag/Monat in Zukunft → aktuelles Jahr', () => {
    expect(parseDate('15.05', today)).toBe('2026-05-15');
    expect(parseDate('25.05', today)).toBe('2026-05-25');
    expect(parseDate('15.6', today)).toBe('2026-06-15');
  });
  it('Tag/Monat in Vergangenheit → nächstes Jahr', () => {
    expect(parseDate('15.04', today)).toBe('2027-04-15');
    expect(parseDate('08.05', today)).toBe('2027-05-08'); // gestern war 8. Mai
  });
  it('akzeptiert führende Null im Tag/Monat', () => {
    expect(parseDate('05.06', today)).toBe('2026-06-05');
  });
});

describe('parseDate – Smart-Month (nur Tag)', () => {
  it('Tag in Zukunft im aktuellen Monat → aktueller Monat', () => {
    expect(parseDate('15', today)).toBe('2026-05-15');
  });
  it('Tag schon vorbei → nächster Monat', () => {
    expect(parseDate('5', today)).toBe('2026-06-05');
  });
  it('Tag heute → aktueller Monat (nicht Vergangenheit)', () => {
    expect(parseDate('9', today)).toBe('2026-05-09');
  });
  it('Jahres-Wechsel: Dezember + Tag schon vorbei → Januar nächstes Jahr', () => {
    const dec = new Date(2026, 11, 20);
    expect(parseDate('5', dec)).toBe('2027-01-05');
  });
});

describe('parseDate – Validierung', () => {
  it('lehnt ungültige Tage ab', () => {
    expect(parseDate('32.05.2026', today)).toBeNull();
    expect(parseDate('00.05.2026', today)).toBeNull();
  });
  it('lehnt ungültige Monate ab', () => {
    expect(parseDate('15.13.2026', today)).toBeNull();
    expect(parseDate('15.0.2026', today)).toBeNull();
  });
  it('29.02. nur in Schaltjahr', () => {
    expect(parseDate('29.02.2026', today)).toBeNull();
    expect(parseDate('29.02.2024', today)).toBe('2024-02-29');
  });
  it('31.04. ist ungültig', () => {
    expect(parseDate('31.04.2026', today)).toBeNull();
  });
  it('lehnt leeren / nicht-numerischen Input ab', () => {
    expect(parseDate('', today)).toBeNull();
    expect(parseDate('   ', today)).toBeNull();
    expect(parseDate('abc', today)).toBeNull();
    expect(parseDate(null, today)).toBeNull();
  });
  it('lehnt Jahre außerhalb [2000, 2100] ab', () => {
    expect(parseDate('15.05.1999', today)).toBeNull();
    expect(parseDate('15.05.2101', today)).toBeNull();
  });
});

describe('formatDeDate', () => {
  it('formatiert ISO → DD.MM.YYYY', () => {
    expect(formatDeDate('2026-05-15')).toBe('15.05.2026');
  });
  it('liefert leeren String für falsy Input', () => {
    expect(formatDeDate('')).toBe('');
    expect(formatDeDate(null)).toBe('');
  });
});
