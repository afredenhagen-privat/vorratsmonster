import { defineStore } from 'pinia';
import { db } from '../db/database.js';
import { fetchProduct } from '../services/openFoodFacts.js';

/**
 * Eigene persistente Produkt-Datenbank, keyed by Barcode.
 *
 * Lookup-Reihenfolge bei einem Scan:
 *   1. lokale my_products (kein TTL, User-Wahrheit)
 *   2. Open Food Facts API (Fallback)
 *   3. null (Caller zeigt manuelles Form mit Barcode vorausgefüllt)
 *
 * Wichtig: Ein OFF-Treffer wird NICHT automatisch persistiert. Erst wenn
 * der User aus dem Scan einen Vorratseintrag speichert (siehe ItemFormView),
 * ruft der Save-Pfad upsert() auf. Damit bleibt my_products schlank und
 * enthält nur Produkte, die der User auch wirklich nutzt.
 *
 * User-Edits gewinnen: upsert() überschreibt Name/Marke/Bild/Kategorie mit
 * dem, was der User im Form sieht/eingibt — beim nächsten Scan kommt also
 * die User-Version, nicht der OFF-Original-Stand.
 */
export const useProductsStore = defineStore('products', {
  state: () => ({}),

  actions: {
    /**
     * Sucht zuerst lokal, dann OFF. OFF wird genau dann nicht aufgerufen,
     * wenn lokal ein nicht-gelöschter Eintrag existiert.
     */
    async lookup(barcode) {
      if (!barcode) return null;
      const local = await db.my_products.get(barcode);
      if (local && !local.deleted_at) {
        return { ...local, _from: 'local' };
      }
      const off = await fetchProduct(barcode);
      if (!off) return null;
      return { ...off, _from: 'off' };
    },

    /**
     * Legt den Eintrag in my_products an oder überschreibt ihn. Wird beim
     * Save eines Vorratsitems mit Barcode aufgerufen.
     *
     * source: 'user' (manueller Eintrag, der ursprünglich keinen OFF-Treffer
     * hatte) oder 'off' (kam ursprünglich aus OFF). Wird beim Update nur
     * dann überschrieben, wenn explizit übergeben — sonst bleibt der
     * existierende Wert.
     */
    async upsert({ barcode, name, brand = null, image_url = null, category = null, source }) {
      if (!barcode) throw new Error('Barcode ist Pflicht.');
      if (!name || !name.trim()) throw new Error('Name ist Pflicht.');
      const now = new Date().toISOString();
      const existing = await db.my_products.get(barcode);
      const record = {
        barcode,
        name: name.trim(),
        brand,
        image_url,
        category,
        source: source ?? existing?.source ?? 'user',
        created_at: existing?.created_at ?? now,
        updated_at: now,
        deleted_at: null
      };
      await db.my_products.put(record);
      return record;
    }
  }
});
