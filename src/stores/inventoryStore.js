import { defineStore } from 'pinia';
import { db } from '../db/database.js';
import { newItem, LOCATIONS } from '../db/schema.js';

/**
 * Zentraler Store für Vorrats-Items.
 *
 * Components greifen NIE direkt auf db zu, immer durch diesen Store.
 * Dadurch lässt sich die Implementierung später durch einen
 * Supabase-Sync-Wrapper austauschen, ohne UI/Views zu refactorn.
 *
 * Sortierung der Liste: best_before ASC.
 */
export const useInventoryStore = defineStore('inventory', {
  state: () => ({
    items: [],
    loaded: false
  }),

  getters: {
    /** Aktive Items (nicht soft-deleted), bereits sortiert. */
    active: (state) => state.items.filter((i) => i.deleted_at === null),

    byId: (state) => (id) => state.items.find((i) => i.id === id),

    /**
     * Distinkte Namen aus früheren MANUELLEN Einträgen für Autocomplete.
     * Gewichtung: zuletzt verwendet zuerst.
     */
    distinctManualNames: (state) => {
      const seen = new Map();
      const sorted = [...state.items]
        .filter((i) => i.barcode === null)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      for (const i of sorted) {
        const key = i.name.toLowerCase();
        if (!seen.has(key)) seen.set(key, i.name);
      }
      return Array.from(seen.values());
    }
  },

  actions: {
    async load() {
      const rows = await db.items.toArray();
      this.items = sortByExpiry(rows);
      this.loaded = true;
    },

    /**
     * Volltext-/Filter-Pipeline. Nimmt aktive Items und wendet optional
     * Such- und Lagerortfilter an. Reihenfolge bleibt sortiert.
     */
    filtered({ query = '', location = null } = {}) {
      const q = query.trim().toLowerCase();
      return this.active.filter((i) => {
        if (location && i.location !== location) return false;
        if (q && !i.name.toLowerCase().includes(q)) return false;
        return true;
      });
    },

    /** Neues Item anlegen aus den Form-Feldern. */
    async create(input) {
      const record = newItem(input);
      await db.items.add(record);
      this.items.push(record);
      this._resort();
      return record;
    },

    /** Felder eines bestehenden Items überschreiben. */
    async update(id, patch) {
      const target = this.byId(id);
      if (!target) throw new Error('Item nicht gefunden.');
      const safePatch = pickPatch(patch);
      if (Object.keys(safePatch).length === 0) return target;
      safePatch.updated_at = new Date().toISOString();
      await db.items.update(id, safePatch);
      Object.assign(target, safePatch);
      this._resort();
      return target;
    },

    /**
     * Soft-Delete: setzt deleted_at. Für Undo-Snackbar gedacht.
     * Liefert den ursprünglichen Eintrag zurück, damit die UI ihn
     * für „Rückgängig" zwischenspeichern kann.
     */
    async softDelete(id) {
      const target = this.byId(id);
      if (!target) throw new Error('Item nicht gefunden.');
      const now = new Date().toISOString();
      await db.items.update(id, { deleted_at: now, updated_at: now });
      target.deleted_at = now;
      target.updated_at = now;
      return target;
    },

    /** Soft-Delete rückgängig machen. */
    async restore(id) {
      const target = this.byId(id);
      if (!target) throw new Error('Item nicht gefunden.');
      const now = new Date().toISOString();
      await db.items.update(id, { deleted_at: null, updated_at: now });
      target.deleted_at = null;
      target.updated_at = now;
      this._resort();
      return target;
    },

    _resort() {
      this.items = sortByExpiry(this.items);
    }
  }
});

const ALLOWED_PATCH_KEYS = [
  'barcode',
  'name',
  'brand',
  'image_url',
  'category',
  'quantity',
  'best_before',
  'location',
  'is_opened',
  'opened_at'
];

function pickPatch(patch) {
  const out = {};
  for (const k of ALLOWED_PATCH_KEYS) {
    if (patch[k] === undefined) continue;
    if (k === 'name') {
      const trimmed = String(patch.name).trim();
      if (!trimmed) throw new Error('Name darf nicht leer sein.');
      out.name = trimmed;
    } else if (k === 'location') {
      if (!LOCATIONS.includes(patch.location)) {
        throw new Error(`location "${patch.location}" ist ungültig.`);
      }
      out.location = patch.location;
    } else if (k === 'quantity') {
      out.quantity = Number(patch.quantity) || 1;
    } else {
      out[k] = patch[k];
    }
  }
  return out;
}

export function sortByExpiry(rows) {
  return [...rows].sort((a, b) => {
    if (a.best_before !== b.best_before) {
      return a.best_before < b.best_before ? -1 : 1;
    }
    return a.name.localeCompare(b.name, 'de');
  });
}
