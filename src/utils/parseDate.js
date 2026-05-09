/**
 * parseDate – tippt der User "15.05" oder "15052026" oder "15.5.26", liefere
 * einen ISO-Date-String "YYYY-MM-DD" oder null.
 *
 * Formate (alle akzeptiert):
 *   "15"           → Tag im aktuellen Monat (Smart-Year/Smart-Month)
 *   "15.5" / "15.05" / "15.5." / "15.05."
 *                  → Tag + Monat ohne Jahr (Smart-Year)
 *   "15.5.26" / "15.05.26" / "15.05.2026"
 *                  → vollständig
 *   "15052026" / "1552026" (8 oder 7 Ziffern) → vollständig
 *   "150526" (6 Ziffern) → DDMMYY
 *
 * Smart-Year:
 *   Liegt das resultierende Datum in der Vergangenheit (vor `today`),
 *   verschiebt sich das Jahr um +1. So muss bei einer Konserve, die im
 *   Mai 2027 abläuft, am 09.05.2026 nur "15.05" getippt werden.
 *
 * Smart-Month: Bei reiner Tag-Eingabe ("15"):
 *   Tag im aktuellen Monat; falls schon vorbei → nächster Monat.
 *
 * Validierung: Es werden echte Kalendertage geprüft (29.02. nur in
 * Schaltjahren, 31.04. ist ungültig usw.).
 *
 * Nicht akzeptiert: leerer/whitespace-only Input → null.
 *                   Anderssprachige Trennzeichen werden auf "." normalisiert.
 */
export function parseDate(input, today = new Date()) {
  if (input === null || input === undefined) return null;
  const raw = String(input).trim();
  if (!raw) return null;

  // Trennzeichen normalisieren: "/", "-", "," → "."
  const normalized = raw.replace(/[\/\-,]/g, '.').replace(/\s+/g, '');

  // Trailing-Punkt erlauben ("15.05." → "15.05")
  const cleaned = normalized.replace(/\.+$/, '');

  // Variante A: Punkt-getrennt
  if (cleaned.includes('.')) {
    const parts = cleaned.split('.').filter(Boolean);
    if (parts.length === 1) return tryDayOnly(parts[0], today);
    if (parts.length === 2) return tryDayMonth(parts[0], parts[1], today);
    if (parts.length === 3) return tryDayMonthYear(parts[0], parts[1], parts[2]);
    return null;
  }

  // Variante B: rein numerisch ohne Trenner
  if (!/^\d+$/.test(cleaned)) return null;

  // 1-2 Ziffern → Tag only
  if (cleaned.length <= 2) return tryDayOnly(cleaned, today);

  // 3-4 Ziffern → DDMM (1-2 für Tag, 1-2 für Monat) — ambiguous, wir nehmen
  // immer letzte 2 Stellen als Monat, der Rest als Tag.
  if (cleaned.length === 3 || cleaned.length === 4) {
    const day = cleaned.slice(0, -2);
    const month = cleaned.slice(-2);
    return tryDayMonth(day, month, today);
  }

  // 6 Ziffern → DDMMYY
  if (cleaned.length === 6) {
    return tryDayMonthYear(cleaned.slice(0, 2), cleaned.slice(2, 4), cleaned.slice(4));
  }

  // 7 Ziffern → DMMYYYY (1 Tag, 2 Monat, 4 Jahr) — ambiguous; wir nehmen die
  // letzten 4 Stellen als Jahr, davor 2 als Monat, Rest als Tag.
  if (cleaned.length === 7) {
    return tryDayMonthYear(
      cleaned.slice(0, -6),
      cleaned.slice(-6, -4),
      cleaned.slice(-4)
    );
  }

  // 8 Ziffern → DDMMYYYY
  if (cleaned.length === 8) {
    return tryDayMonthYear(cleaned.slice(0, 2), cleaned.slice(2, 4), cleaned.slice(4));
  }

  return null;
}

function tryDayOnly(dayStr, today) {
  const day = Number(dayStr);
  if (!Number.isInteger(day) || day < 1 || day > 31) return null;
  const y = today.getFullYear();
  let m = today.getMonth(); // 0-based
  // Tag schon vorbei → nächster Monat (Smart-Month)
  if (day < today.getDate()) {
    m += 1;
  }
  let year = y;
  if (m > 11) {
    year += 1;
    m = 0;
  }
  if (!isValidDate(year, m + 1, day)) return null;
  return formatIso(year, m + 1, day);
}

function tryDayMonth(dayStr, monthStr, today) {
  const day = Number(dayStr);
  const month = Number(monthStr);
  if (!Number.isInteger(day) || !Number.isInteger(month)) return null;
  if (month < 1 || month > 12) return null;
  let year = today.getFullYear();
  if (!isValidDate(year, month, day)) return null;
  // Smart-Year: in der Vergangenheit → nächstes Jahr
  if (isPast(year, month, day, today)) {
    year += 1;
  }
  if (!isValidDate(year, month, day)) return null;
  return formatIso(year, month, day);
}

function tryDayMonthYear(dayStr, monthStr, yearStr) {
  const day = Number(dayStr);
  const month = Number(monthStr);
  let year = Number(yearStr);
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) {
    return null;
  }
  // 2-stelliges Jahr → 2000 + YY
  if (yearStr.length === 2) year = 2000 + year;
  if (year < 2000 || year > 2100) return null;
  if (month < 1 || month > 12) return null;
  if (!isValidDate(year, month, day)) return null;
  return formatIso(year, month, day);
}

function isValidDate(year, month, day) {
  // Date-Konstruktor "korrigiert" ungültige Tage (32.05 → 01.06). Wir
  // konstruieren und vergleichen die Komponenten zurück.
  if (day < 1 || day > 31) return false;
  const d = new Date(year, month - 1, day);
  return (
    d.getFullYear() === year &&
    d.getMonth() === month - 1 &&
    d.getDate() === day
  );
}

function isPast(year, month, day, today) {
  const candidate = new Date(year, month - 1, day);
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return candidate < t;
}

function formatIso(year, month, day) {
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

/** Inverse: ISO → "DD.MM.YYYY" für die Anzeige. */
export function formatDeDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}
