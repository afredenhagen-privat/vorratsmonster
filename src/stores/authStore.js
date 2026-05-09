import { defineStore } from 'pinia';
import { supabaseClient, isSyncConfigured } from '../lib/supabase.js';

/**
 * Auth-Store: Wrapper um supabase-js auth.
 *
 * Modi:
 *   - configured + signed-in:  voller Sync möglich
 *   - configured + signed-out: App rein lokal, "Geräte teilen?"-Login möglich
 *   - not configured:          App rein lokal, kein Login angeboten
 *
 * `init()` muss einmal beim Bootstrap aufgerufen werden — registriert
 * den Supabase-Auth-Listener und füllt initial die Session.
 */
export const useAuthStore = defineStore('auth', {
  state: () => ({
    session: null,
    initialized: false,
    sendingMagicLink: false,
    magicLinkSentTo: null,
    error: null
  }),

  getters: {
    configured: () => isSyncConfigured(),
    isSignedIn: (state) => state.session !== null,
    user: (state) => state.session?.user ?? null,
    email: (state) => state.session?.user?.email ?? null,
    userId: (state) => state.session?.user?.id ?? null
  },

  actions: {
    async init() {
      if (this.initialized) return;
      if (!supabaseClient) {
        this.initialized = true;
        return;
      }
      const { data } = await supabaseClient.auth.getSession();
      this.session = data?.session ?? null;
      // Auth-State-Changes (Login, Logout, Token-Refresh, Magic-Link-Callback)
      supabaseClient.auth.onAuthStateChange((_event, session) => {
        this.session = session ?? null;
      });
      this.initialized = true;
    },

    async signInWithMagicLink(email) {
      if (!supabaseClient) throw new Error('Supabase nicht konfiguriert.');
      const trimmed = (email ?? '').trim();
      if (!trimmed) throw new Error('E-Mail ist Pflicht.');
      this.sendingMagicLink = true;
      this.error = null;
      try {
        const { error } = await supabaseClient.auth.signInWithOtp({
          email: trimmed,
          options: {
            // Nach Klick auf den Magic-Link landet der User wieder hier;
            // supabase-js parst den Hash und stellt die Session her.
            emailRedirectTo: window.location.origin + import.meta.env.BASE_URL
          }
        });
        if (error) throw error;
        this.magicLinkSentTo = trimmed;
      } catch (e) {
        this.error = e.message ?? 'Magic-Link konnte nicht gesendet werden.';
        throw e;
      } finally {
        this.sendingMagicLink = false;
      }
    },

    async signOut() {
      if (!supabaseClient) return;
      await supabaseClient.auth.signOut();
      this.session = null;
      this.magicLinkSentTo = null;
    }
  }
});
