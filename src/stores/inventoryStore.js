import { defineStore } from 'pinia';
import { db } from '../db/database.js';
import { newItem, LOCATIONS } from '../db/schema.js';
import { useSyncStore } from './syncStore.js';

function pushToSync(record) {
  // Lazy import des Stores, weil syncStore selbst auth+supabase importiert.
  // Bei Lokal-Only-Modus (kein Login) ist queuePush ein no-op.
  try {
    const sync = useSyncStore();
    sync.queuePush('items', record);
  } catch {
    /* Pinia evtl. nicht initialisiert — z.B. in Tests. Ignorieren. */
  }
}

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
     * Such-, Lagerort-, Anbruch- und Barcode-Filter an. Reihenfolge bleibt
     * sortiert.
     */
    filtered({
      query = '',
      location = null,
      opened = false,
      barcode = null
    } = {}) {
      const q = query.trim().toLowerCase();
      return this.active.filter((i) => {
        if (location && i.location !== location) return false;
        if (opened && !i.is_opened) return false;
        if (barcode && i.barcode !== barcode) return false;
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
      pushToSync(record);
      return record;
    },

    /**
     * Reload aus Dexie. Wird vom Sync-Store nach Realtime-Änderungen
     * aufgerufen, damit die UI den frischen Stand zeigt.
     */
    async reload() {
      const rows = await db.items.toArray();
      this.items = sortByExpiry(rows);
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
      pushToSync(target);
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
      pushToSync(target);
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
      pushToSync(target);
      return target;
    },

    /**
     * Anbruch-Toggle.
     *
     * Logik:
     *   - Wenn das Item ungeöffnet ist UND quantity > 1: SPLIT.
     *     Original wird auf quantity - 1 reduziert, ein neuer Eintrag mit
     *     quantity = 1 und is_opened = true entsteht. Begründung: Anbruch
     *     ist eine Property einer einzelnen Packung, nicht der ganzen Charge.
     *   - Sonst: einfacher Flag-Toggle.
     *
     * Ergebnis:
     *   { kind: 'toggled', item }              – Standard-Toggle
     *   { kind: 'split', original, splitItem } – ein Stück abgelöst und
     *                                              angebrochen markiert
     */
    async toggleOpened(id) {
      const target = this.byId(id);
      if (!target) throw new Error('Item nicht gefunden.');
      const now = new Date().toISOString();

      if (!target.is_opened && target.quantity > 1) {
        const newQty = target.quantity - 1;
        await db.items.update(id, { quantity: newQty, updated_at: now });
        target.quantity = newQty;
        target.updated_at = now;

        const splitRecord = newItem({
          barcode: target.barcode,
          name: target.name,
          brand: target.brand,
          image_url: target.image_url,
          category: target.category,
          quantity: 1,
          best_before: target.best_before,
          location: target.location,
          is_opened: true
        });
        // newItem() erlaubt is_opened, setzt opened_at aber selbst nicht.
        splitRecord.opened_at = now;
        await db.items.add(splitRecord);
        this.items.push(splitRecord);
        this._resort();
        pushToSync(target);
        pushToSync(splitRecord);
        return { kind: 'split', original: target, splitItem: splitRecord };
      }

      const next = !target.is_opened;
      const patch = {
        is_opened: next,
        opened_at: next ? now : null,
        updated_at: now
      };
      await db.items.update(id, patch);
      Object.assign(target, patch);
      pushToSync(target);
      return { kind: 'toggled', item: target };
    },

    /**
     * Inverse von toggleOpened mit Split-Result. Hard-deleted das Split-Item
     * und addiert seine Menge auf das Original zurück.
     */
    async undoSplit(originalId, splitItemId) {
      const original = this.byId(originalId);
      const splitItem = this.byId(splitItemId);
      if (!original || !splitItem) {
        throw new Error('Original oder Split-Item nicht gefunden.');
      }
      // Cloud-seitig kennen wir kein Hard-Delete für Sync — wir machen den
      // Split-Eintrag soft-deletet (setzt deleted_at), Cloud bekommt das
      // mit, lokal löschen wir hart aus der UI.
      const now = new Date().toISOString();
      const tombstone = { ...splitItem, deleted_at: now, updated_at: now };
      await db.items.delete(splitItemId);
      this.items = this.items.filter((i) => i.id !== splitItemId);
      // Trotzdem an die Cloud schicken (mit deleted_at), damit Geräte B
      // den Split-Eintrag auch verschwinden lässt.
      pushToSync(tombstone);

      const newQty = original.quantity + splitItem.quantity;
      await db.items.update(originalId, {
        quantity: newQty,
        updated_at: now
      });
      original.quantity = newQty;
      original.updated_at = now;
      this._resort();
      pushToSync(original);
    },

    /**
     * Setzt is_opened/opened_at gezielt (für Undo).
     */
    async setOpened(id, isOpened, openedAt = null) {
      const target = this.byId(id);
      if (!target) throw new Error('Item nicht gefunden.');
      const now = new Date().toISOString();
      const patch = {
        is_opened: Boolean(isOpened),
        opened_at: isOpened ? openedAt ?? now : null,
        updated_at: now
      };
      await db.items.update(id, patch);
      Object.assign(target, patch);
      pushToSync(target);
      return target;
    },

    /**
     * Inkrementiert/dekrementiert die Menge. Erreicht der neue Wert 0,
     * wird statt der Mengenänderung ein Soft-Delete ausgeführt — das
     * passt zum gewünschten UX-Flow „letztes Stück verbraucht".
     *
     * Liefert ein Result-Objekt:
     *   { kind: 'updated', item }  – Menge wurde geändert
     *   { kind: 'deleted', item }  – Item wurde soft-deleted (Caller zeigt Undo-Snackbar)
     */
    async setQuantity(id, delta) {
      const target = this.byId(id);
      if (!target) throw new Error('Item nicht gefunden.');
      const next = Math.max(0, (target.quantity ?? 1) + delta);
      if (next === 0) {
        await this.softDelete(id);
        return { kind: 'deleted', item: target };
      }
      const now = new Date().toISOString();
      await db.items.update(id, { quantity: next, updated_at: now });
      target.quantity = next;
      target.updated_at = now;
      pushToSync(target);
      return { kind: 'updated', item: target };
    },

    /**
     * Einfrieren: location → 'freezer', best_before um +6 Monate verlängern.
     * Liefert den vorherigen Zustand als Snapshot zurück, damit eine Undo-
     * Snackbar das Item per restoreSnapshot zurückrollen kann.
     */
    async freeze(id) {
      const target = this.byId(id);
      if (!target) throw new Error('Item nicht gefunden.');
      const snapshot = {
        location: target.location,
        best_before: target.best_before
      };
      const newBestBefore = addMonthsToIsoDate(target.best_before, 6);
      const now = new Date().toISOString();
      const patch = {
        location: 'freezer',
        best_before: newBestBefore,
        updated_at: now
      };
      await db.items.update(id, patch);
      Object.assign(target, patch);
      this._resort();
      pushToSync(target);
      return { item: target, snapshot };
    },

    /** Snapshot zurückspielen (für Undo nach freeze). */
    async restoreSnapshot(id, snapshot) {
      const target = this.byId(id);
      if (!target) throw new Error('Item nicht gefunden.');
      const now = new Date().toISOString();
      const patch = { ...snapshot, updated_at: now };
      await db.items.update(id, patch);
      Object.assign(target, patch);
      this._resort();
      pushToSync(target);
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

/**
 * Verschiebt ein ISO-Date um eine Anzahl Monate. Wenn der Zieltag im neuen
 * Monat nicht existiert (z.B. 31.01 + 1 Monat), springt JavaScript's Date
 * automatisch in den nächsten Monat — wir lassen das genau so, das ist die
 * pragmatischste Variante für unseren Use-Case (Einfrieren).
 */
export function addMonthsToIsoDate(iso, months) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1 + months, d);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}
