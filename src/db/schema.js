/**
 * Schema-Referenz für die `items`-Tabelle.
 *
 * Dexie speichert nur die im stores()-Schema deklarierten Indizes;
 * die übrigen Felder sind freie Properties. Dieses Modul dokumentiert
 * den vollständigen Eintrag und liefert eine Factory für neue Items,
 * damit Defaults (Timestamps, UUID, Soft-Delete-Flag) immer konsistent
 * gesetzt werden.
 *
 * Lagerorte sind v1 fix; Erweiterung später ohne Schema-Änderung möglich.
 */

export const LOCATIONS = Object.freeze(['fridge', 'freezer', 'pantry']);

export const LOCATION_LABELS = Object.freeze({
  fridge: 'Kühlschrank',
  freezer: 'Gefrier',
  pantry: 'Vorrat'
});

export function newItem({
  barcode = null,
  name,
  brand = null,
  image_url = null,
  category = null,
  quantity = 1,
  best_before,
  location,
  is_opened = false,
  opened_at = null
}) {
  if (!name || !name.trim()) {
    throw new Error('name ist Pflicht.');
  }
  if (!best_before) {
    throw new Error('best_before ist Pflicht (ISO-Date).');
  }
  if (!LOCATIONS.includes(location)) {
    throw new Error(`location "${location}" ist ungültig.`);
  }
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    barcode,
    name: name.trim(),
    brand,
    image_url,
    category,
    quantity: Number(quantity) || 1,
    best_before,
    location,
    is_opened: Boolean(is_opened),
    opened_at,
    created_at: now,
    updated_at: now,
    deleted_at: null
  };
}

/**
 * Berechnet die Ampel-Stufe für ein MHD relativ zu einem Stichtag (Default = jetzt).
 * Schwellen: rot ≤ 2 Tage / abgelaufen, gelb ≤ 7 Tage, grün > 7 Tage.
 *
 * Vergleich rein auf Kalendertag-Basis (kein Zeitanteil), damit keine
 * Timezone-Drift zwischen `new Date()` und ISO-Date-String entsteht.
 */
export function expiryLevel(bestBeforeIso, now = new Date()) {
  const days = daysUntil(bestBeforeIso, now);
  if (days <= 2) return 'red';
  if (days <= 7) return 'yellow';
  return 'green';
}

export function daysUntil(bestBeforeIso, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const [y, m, d] = bestBeforeIso.split('-').map(Number);
  const bb = new Date(y, m - 1, d);
  return Math.round((bb - today) / (1000 * 60 * 60 * 24));
}
