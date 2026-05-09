import { defineStore } from 'pinia';
import { db } from '../db/database.js';
import { supabaseClient, isSyncConfigured } from '../lib/supabase.js';
import { useAuthStore } from './authStore.js';

const LAST_SYNC_KEY_PREFIX = 'vm_last_sync_';

const TABLES = ['items', 'my_products', 'shelf_life_presets'];

/**
 * Liefert den Schlüssel-Wert eines Records für die jeweilige Tabelle.
 * items.id, my_products.barcode, shelf_life_presets.name_lower.
 */
function recordKey(table, record) {
  if (table === 'items') return record.id;
  if (table === 'my_products') return record.barcode;
  if (table === 'shelf_life_presets') return record.name_lower;
  throw new Error(`Unbekannte Tabelle: ${table}`);
}

/**
 * Bringt einen Record für den Cloud-Upsert in die richtige Form: user_id
 * setzen, lokale-only-Felder filtern.
 */
function recordForCloud(record, userId) {
  // Sicherheit: deleted_at darf null oder ISO sein, andere Felder werden
  // 1:1 durchgereicht. Supabase kümmert sich um Spalten-Validierung.
  return { ...record, user_id: userId };
}

/**
 * Entfernt user_id für die lokale Dexie-Speicherung — lokal kennen wir
 * keine User-ID-Spalte.
 */
function recordForLocal(record) {
  const { user_id: _drop, ...rest } = record;
  return rest;
}

/**
 * Last-Write-Wins-Merge eines Cloud-Records in die lokale Dexie-Tabelle.
 * Liefert true zurück, wenn die lokale Version überschrieben wurde —
 * wichtig für die Anzeige zu sagen "die UI muss neu lesen".
 */
export async function mergeIntoDexie(table, cloudRecord) {
  const localTable = db[table];
  const key = recordKey(table, cloudRecord);
  const local = await localTable.get(key);
  const localUpdated = local?.updated_at ?? '';
  const cloudUpdated = cloudRecord.updated_at ?? '';
  if (cloudUpdated > localUpdated) {
    await localTable.put(recordForLocal(cloudRecord));
    return true;
  }
  return false;
}

export const useSyncStore = defineStore('sync', {
  state: () => ({
    initialized: false,
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    pending: 0,
    pulling: false,
    pushing: false,
    initialUploadDone: false,
    realtimeChannels: [],
    onlineHandler: null,
    offlineHandler: null,
    // updated_at-Werte unserer letzten Eigen-Pushes pro key+table.
    // Realtime-Echo wird daran erkannt: payload.new.updated_at == eigenes
    // letztes Push → ignorieren.
    echoSet: new Set()
  }),

  getters: {
    configured: () => isSyncConfigured(),
    statusKind: (state) => {
      if (!isSyncConfigured()) return 'local';
      const auth = useAuthStore();
      if (!auth.isSignedIn) return 'signed-out';
      if (!state.online) return 'offline';
      if (state.pending > 0 || state.pushing || state.pulling) return 'syncing';
      return 'synced';
    }
  },

  actions: {
    /**
     * Bootstrap. Wird aus App.vue nach auth.init() aufgerufen.
     * Installiert Online/Offline-Listener; Pull/Realtime werden erst
     * gestartet, wenn ein User eingeloggt ist (siehe `onSignIn`).
     */
    async init() {
      if (this.initialized) return;
      this.initialized = true;
      this.pending = await db.sync_queue.count();
      if (typeof window !== 'undefined') {
        this.onlineHandler = () => {
          this.online = true;
          this.flush().catch(() => {});
        };
        this.offlineHandler = () => {
          this.online = false;
        };
        window.addEventListener('online', this.onlineHandler);
        window.addEventListener('offline', this.offlineHandler);
      }
    },

    /**
     * Wird von App.vue aufgerufen, wenn auth.session existiert.
     * Idempotent.
     */
    async onSignIn() {
      if (!isSyncConfigured()) return;
      const auth = useAuthStore();
      if (!auth.isSignedIn) return;

      // Initial-Upload (genau einmal pro Gerät+User-Kombi)
      const flagKey = `vm_initial_uploaded_${auth.userId}`;
      if (!localStorage.getItem(flagKey)) {
        await this.runInitialUpload();
        localStorage.setItem(flagKey, '1');
        this.initialUploadDone = true;
      }

      // Frische Pull-Runde, dann Realtime starten
      await this.pullAll();
      this.attachRealtime();
      // Falls noch was in der Queue hängt → flushen
      this.flush().catch(() => {});
    },

    /**
     * Wird beim Logout aufgerufen — Realtime stoppen, Queue/Echo aufräumen.
     */
    async onSignOut() {
      this.detachRealtime();
      this.echoSet.clear();
      // Pending-Queue belassen — wenn der User sich wieder einloggt,
      // werden die Mutations nachgereicht. Bei „komplett ausloggen,
      // Konto wechseln" könnte das doof sein, aber für unseren Use-Case
      // (1 Konto, 2 Geräte) ist das die richtige Default-Wahl.
    },

    // ====================================================================
    // PUSH
    // ====================================================================

    /**
     * Wird aus den Domain-Stores aufgerufen nach jedem mutierenden Schritt.
     * Speichert den Record in der Queue und versucht direkt zu flushen.
     */
    async queuePush(table, record) {
      if (!isSyncConfigured()) return;
      const auth = useAuthStore();
      if (!auth.isSignedIn) return; // Lokal-Only-Modus, nichts zu tun

      const key = recordKey(table, record);
      // Vorhandene Queue-Einträge für denselben (table, key) ersetzen,
      // damit wir nur den neuesten Stand pushen.
      await db.sync_queue
        .where({ table_name: table, key: String(key) })
        .delete();
      await db.sync_queue.add({
        id: crypto.randomUUID(),
        table_name: table,
        key: String(key),
        record: { ...record },
        created_at: new Date().toISOString()
      });
      this.pending = await db.sync_queue.count();
      // Wenn online: sofort flushen (fire and forget)
      if (this.online) {
        this.flush().catch(() => {});
      }
    },

    /**
     * Versucht alle Queue-Einträge zur Cloud zu pushen.
     */
    async flush() {
      if (!isSyncConfigured()) return;
      if (this.pushing) return;
      const auth = useAuthStore();
      if (!auth.isSignedIn || !this.online) return;

      this.pushing = true;
      try {
        // Eigene Snapshot, damit wir während des Pushes keine Race haben
        const queue = await db.sync_queue.orderBy('created_at').toArray();
        for (const entry of queue) {
          try {
            const cloudRecord = recordForCloud(entry.record, auth.userId);
            const { error } = await supabaseClient
              .from(entry.table_name)
              .upsert(cloudRecord);
            if (error) throw error;
            // Echo-Marker: bei nächstem Realtime-Event mit gleichem
            // updated_at überspringen
            this.markEcho(entry.table_name, entry.key, cloudRecord.updated_at);
            await db.sync_queue.delete(entry.id);
          } catch {
            // Bei Fehler: Eintrag in der Queue lassen, beim nächsten Online
            // probieren wir's wieder. Wir brechen die Schleife ab, damit
            // bei einem permanenten Fehler nicht ALLE Einträge knallen.
            break;
          }
        }
      } finally {
        this.pending = await db.sync_queue.count();
        this.pushing = false;
      }
    },

    // ====================================================================
    // PULL
    // ====================================================================

    /**
     * Pullt alle drei Tabellen seit dem letzten Sync-Stempel.
     */
    async pullAll() {
      if (!isSyncConfigured()) return;
      const auth = useAuthStore();
      if (!auth.isSignedIn) return;
      this.pulling = true;
      try {
        for (const table of TABLES) {
          await this.pullTable(table, auth.userId);
        }
      } finally {
        this.pulling = false;
      }
    },

    async pullTable(table, userId) {
      const stamp = localStorage.getItem(LAST_SYNC_KEY_PREFIX + table) ?? '1970-01-01T00:00:00Z';
      const { data, error } = await supabaseClient
        .from(table)
        .select('*')
        .eq('user_id', userId)
        .gt('updated_at', stamp)
        .order('updated_at', { ascending: true });
      if (error) {
        console.warn('Pull-Fehler', table, error);
        return;
      }
      let maxUpdated = stamp;
      for (const row of data ?? []) {
        await mergeIntoDexie(table, row);
        if (row.updated_at > maxUpdated) maxUpdated = row.updated_at;
      }
      if (maxUpdated !== stamp) {
        localStorage.setItem(LAST_SYNC_KEY_PREFIX + table, maxUpdated);
      }
    },

    // ====================================================================
    // REALTIME
    // ====================================================================

    attachRealtime() {
      if (!isSyncConfigured()) return;
      const auth = useAuthStore();
      if (!auth.isSignedIn) return;
      this.detachRealtime(); // alte abräumen, falls vorhanden

      for (const table of TABLES) {
        const channel = supabaseClient
          .channel(`vm_${table}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table,
              filter: `user_id=eq.${auth.userId}`
            },
            (payload) => this.onRealtimeChange(table, payload)
          )
          .subscribe();
        this.realtimeChannels.push(channel);
      }
    },

    detachRealtime() {
      for (const ch of this.realtimeChannels) {
        try {
          ch.unsubscribe();
        } catch {
          /* ignore */
        }
      }
      this.realtimeChannels = [];
    },

    async onRealtimeChange(table, payload) {
      const row = payload.new ?? payload.old;
      if (!row) return;
      const key = recordKey(table, row);
      // Echo-Vermeidung: wenn das Event den `updated_at` einer eigenen Mutation hat → ignorieren
      const echoKey = `${table}:${key}:${row.updated_at}`;
      if (this.echoSet.has(echoKey)) {
        this.echoSet.delete(echoKey);
        return;
      }
      await mergeIntoDexie(table, row);
      // Stamp aktualisieren
      const stampKey = LAST_SYNC_KEY_PREFIX + table;
      const oldStamp = localStorage.getItem(stampKey) ?? '';
      if (row.updated_at > oldStamp) {
        localStorage.setItem(stampKey, row.updated_at);
      }
      // UI signalisieren: relevante Stores neu laden. Wir machen das nicht
      // hier (Vermeidung von zirkulären Imports), sondern lassen die
      // Domain-Stores einen reload() bauen, der gegen Dexie liest. Trick:
      // wir notifizieren über einen Custom-Event.
      window.dispatchEvent(
        new CustomEvent('vm:remote-change', { detail: { table, key } })
      );
    },

    markEcho(table, key, updatedAt) {
      this.echoSet.add(`${table}:${key}:${updatedAt}`);
      // Set wachsen wir nicht ins Unendliche — alte rauswerfen wenn > 200
      if (this.echoSet.size > 200) {
        const arr = Array.from(this.echoSet);
        this.echoSet = new Set(arr.slice(-100));
      }
    },

    // ====================================================================
    // INITIAL-UPLOAD
    // ====================================================================

    /**
     * Beim ersten Login auf diesem Gerät: alle bereits lokal vorhandenen
     * Daten in die Cloud pushen. Cloud-Daten haben bei Konflikt Vorrang
     * via mergeIntoDexie (das wir im pullAll aufrufen).
     */
    async runInitialUpload() {
      if (!isSyncConfigured()) return;
      const auth = useAuthStore();
      if (!auth.isSignedIn) return;

      for (const table of TABLES) {
        const rows = await db[table].toArray();
        if (!rows.length) continue;
        const cloudRows = rows.map((r) => recordForCloud(r, auth.userId));
        // In Batches von 100 hochladen, damit wir kein Riesenpaket schicken
        for (let i = 0; i < cloudRows.length; i += 100) {
          const slice = cloudRows.slice(i, i + 100);
          const { error } = await supabaseClient.from(table).upsert(slice);
          if (error) {
            console.warn('Initial-Upload-Fehler', table, error);
            break;
          }
          for (const cr of slice) {
            this.markEcho(table, recordKey(table, cr), cr.updated_at);
          }
        }
      }
    }
  }
});
