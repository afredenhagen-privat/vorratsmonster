import Dexie from 'dexie';

/**
 * Vorratsmonster-Datenbank.
 *
 * Stores:
 *   items              – jeder Eintrag = 1 Packung (oder Charge mit gleicher MHD).
 *   my_products        – persistente eigene Produkt-DB, keyed by barcode.
 *                        Wird beim Speichern eines Vorratseintrags mit Barcode
 *                        gefüllt, kein TTL. User-Edits gewinnen.
 *   shelf_life_presets – auto-gelernte Standard-Haltbarkeiten pro Name.
 *
 * Sync-Vorbereitung (gilt für alle drei Tabellen):
 *   - stabile IDs (UUID bei items, barcode bei my_products, name_lower bei
 *     shelf_life_presets) für konfliktfreie Sync-Migration.
 *   - created_at / updated_at als ISO-Strings.
 *   - deleted_at statt Hard-Delete → Last-Write-Wins-Sync.
 *
 * v1 → v2-Migration:
 *   - products_cache wird gedroppt (war nur 30-Tage-Cache, kein Datenverlust).
 *   - Bestehende items mit Barcode werden in my_products übernommen, damit
 *     ein erneuter Scan nach dem Update sofort offline funktioniert.
 */
export const db = new Dexie('vorratsmonster-db');

db.version(1).stores({
  items: 'id, barcode, name, best_before, location, deleted_at, updated_at',
  products_cache: 'barcode, fetched_at'
});

db.version(2)
  .stores({
    items: 'id, barcode, name, best_before, location, deleted_at, updated_at',
    products_cache: null, // Tabelle droppen
    my_products: 'barcode, source, updated_at, deleted_at',
    shelf_life_presets: 'name_lower, updated_at'
  })
  .upgrade(async (tx) => {
    const items = await tx.table('items').toArray();
    const seen = new Set();
    const now = new Date().toISOString();
    for (const i of items) {
      if (!i.barcode || seen.has(i.barcode)) continue;
      seen.add(i.barcode);
      await tx.table('my_products').put({
        barcode: i.barcode,
        name: i.name,
        brand: i.brand ?? null,
        image_url: i.image_url ?? null,
        category: i.category ?? null,
        source: 'off',
        created_at: i.created_at ?? now,
        updated_at: now,
        deleted_at: null
      });
    }
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
