import { defineStore } from 'pinia';

const SNACKBAR_DURATION_MS = 5000;

/**
 * UI-Globalstate: Snackbar-Queue + aktive Filter/Suche.
 * Snackbar wird einzeln angezeigt; ein neuer Eintrag schiebt den
 * vorigen weg.
 */
export const useUiStore = defineStore('ui', {
  state: () => ({
    snackbar: null,
    snackbarTimer: null,
    filterLocation: null,
    filterOpened: false,
    filterBarcode: null,
    searchQuery: ''
  }),

  actions: {
    setLocationFilter(location) {
      this.filterLocation = location;
    },
    setOpenedFilter(b) {
      this.filterOpened = Boolean(b);
    },
    setBarcodeFilter(barcode) {
      this.filterBarcode = barcode || null;
    },
    setSearchQuery(q) {
      this.searchQuery = q;
    },
    clearFilters() {
      this.filterLocation = null;
      this.filterOpened = false;
      this.filterBarcode = null;
      this.searchQuery = '';
    },

    /**
     * Snackbar mit optionalem Action-Button anzeigen.
     * action = { label, handler } — handler wird beim Klick gerufen
     * und blendet den Snackbar dann automatisch aus.
     */
    showSnackbar({ message, action = null, duration = SNACKBAR_DURATION_MS }) {
      this.dismissSnackbar();
      this.snackbar = { message, action };
      this.snackbarTimer = window.setTimeout(() => {
        this.snackbar = null;
        this.snackbarTimer = null;
      }, duration);
    },

    runSnackbarAction() {
      const sb = this.snackbar;
      if (sb && sb.action) {
        sb.action.handler();
      }
      this.dismissSnackbar();
    },

    dismissSnackbar() {
      if (this.snackbarTimer) {
        window.clearTimeout(this.snackbarTimer);
        this.snackbarTimer = null;
      }
      this.snackbar = null;
    }
  }
});
