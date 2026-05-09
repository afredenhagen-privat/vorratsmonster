import { defineStore } from 'pinia';
import { db } from '../db/database.js';
import { daysUntil } from '../db/schema.js';
import { useSyncStore } from './syncStore.js';

function pushToSync(record) {
  try {
    const sync = useSyncStore();
    sync.queuePush('shelf_life_presets', record);
  } catch {
    /* ignore in test envs */
  }
}

/**
 * Auto-gelernte Standard-Haltbarkeiten pro Item-Name.
 *
 * Strategie: letzter Wert überschreibt (kein Median). YAGNI — kann später
 * verfeinert werden, ohne API-Bruch.
 *
 * Lookup-Key ist `name_lower` (case-insensitiv).
 */
export const useShelfLifeStore = defineStore('shelfLife', {
  state: () => ({
    presets: new Map(),
    loaded: false
  }),

  actions: {
    async load() {
      const rows = await db.shelf_life_presets.toArray();
      this.presets = new Map(rows.map((r) => [r.name_lower, r]));
      this.loaded = true;
    },

    async reload() {
      const rows = await db.shelf_life_presets.toArray();
      this.presets = new Map(rows.map((r) => [r.name_lower, r]));
    },

    /**
     * Berechnet die Tages-Differenz (Anlagedatum → MHD) und persistiert sie
     * als Preset für diesen Namen. Negative Differenzen (= bereits abgelaufen)
     * werden ignoriert, damit ein versehentlicher Eintrag mit MHD in der
     * Vergangenheit nicht das Preset zerstört.
     */
    async upsertFromItem(name, bestBeforeIso, today = new Date()) {
      if (!name) return;
      const days = daysUntil(bestBeforeIso, today);
      if (days < 0) return;
      const key = name.trim().toLowerCase();
      if (!key) return;
      const record = {
        name_lower: key,
        days,
        updated_at: new Date().toISOString()
      };
      await db.shelf_life_presets.put(record);
      this.presets.set(key, record);
      pushToSync(record);
    },

    /** Liefert die hinterlegte Tagezahl oder null. */
    daysFor(name) {
      if (!name) return null;
      const key = name.trim().toLowerCase();
      const rec = this.presets.get(key);
      return rec ? rec.days : null;
    }
  }
});
