import { createClient } from '@supabase/supabase-js';

/**
 * Supabase-Client-Singleton.
 *
 * URL und anon-Key kommen aus ENV-Variablen — siehe docs/supabase-setup.md.
 * Anon-Key ist „public" (RLS schützt die Daten), kein Geheimnis.
 *
 * Wenn die ENV-Variablen fehlen (z.B. lokales Setup ohne .env.local),
 * fällt die App graceful auf den Lokal-Only-Modus zurück: `client` ist
 * dann null, und `isSyncConfigured()` liefert false. Der Sync-Layer
 * macht dann gar nichts.
 *
 * VITE_SYNC_ENABLED=false (optional) deaktiviert den Sync auch bei
 * vorhandener Config — Notfall-Schalter, falls am Backend was kaputt ist.
 */

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const enabled = import.meta.env.VITE_SYNC_ENABLED !== 'false';

export const supabaseClient =
  enabled && url && key
    ? createClient(url, key, {
        auth: {
          // Magic-Link kommt mit Hash-Fragment in der URL zurück; supabase-js
          // parst das automatisch und persistiert die Session in localStorage.
          detectSessionInUrl: true,
          persistSession: true,
          autoRefreshToken: true
        }
      })
    : null;

export function isSyncConfigured() {
  return supabaseClient !== null;
}
