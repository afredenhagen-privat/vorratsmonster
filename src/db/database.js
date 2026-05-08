import Dexie from 'dexie';

/**
 * Vorratsmonster-Datenbank.
 *
 * Stores:
 *   items          – jeder Eintrag = 1 Packung (oder Charge mit gleicher MHD).
 *   products_cache – gecachte Open-Food-Facts-Antworten, key = barcode.
 *
 * Sync-Vorbereitung:
 *   - id ist UUID (string), nicht Auto-Increment, damit Records später
 *     1:1 in Supabase wandern können ohne ID-Konflikte.
 *   - created_at / updated_at als ISO-Strings auf jedem Item.
 *   - deleted_at statt Hard-Delete → ermöglicht Undo + Last-Write-Wins-Sync.
 */
export const db = new Dexie('vorratsmonster-db');

db.version(1).stores({
  items: 'id, barcode, name, best_before, location, deleted_at, updated_at',
  products_cache: 'barcode, fetched_at'
});

export async function initDatabase() {
  if (!db.isOpen()) {
    await db.open();
  }
  return db;
}

/** Alle Daten löschen (für Tests + ggf. Restore). */
export async function clearAllData() {
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      await table.clear();
    }
  });
}
