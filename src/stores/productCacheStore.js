import { defineStore } from 'pinia';
import { db } from '../db/database.js';
import { fetchProduct } from '../services/openFoodFacts.js';

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Cached Open-Food-Facts-Lookups. Erst Cache prüfen, dann API.
 * Bei API-Fehler (Netz weg / 404) wird kein Eintrag im Cache abgelegt,
 * aber der Caller bekommt null zurück und kann den manuellen Pfad gehen.
 */
export const useProductCacheStore = defineStore('productCache', {
  state: () => ({}),

  actions: {
    async lookup(barcode) {
      if (!barcode) return null;
      const cached = await db.products_cache.get(barcode);
      if (cached && !isExpired(cached.fetched_at)) {
        return cached;
      }
      const fresh = await fetchProduct(barcode);
      if (!fresh) return null;
      const record = { ...fresh, fetched_at: new Date().toISOString() };
      await db.products_cache.put(record);
      return record;
    }
  }
});

function isExpired(fetchedAtIso) {
  const t = Date.parse(fetchedAtIso);
  if (Number.isNaN(t)) return true;
  return Date.now() - t > CACHE_TTL_MS;
}
