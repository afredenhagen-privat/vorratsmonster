import { defineStore } from 'pinia';
import { useUndoStore } from './undoStore.js';

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

    /**
     * Bequemer Helper: zeigt eine 5-Sekunden-Snackbar mit „Rückgängig"-Action
     * UND pusht denselben Undo-Schritt auf den persistenten Undo-Stack
     * (`useUndoStore`). Wenn der User die Snackbar verpasst, kann er später
     * den globalen Undo-Button benutzen.
     *
     * Beim Klick auf „Rückgängig" wird der Eintrag aus dem Stack entfernt
     * (damit er nicht zweimal greifen kann).
     */
    queueUndoable(message, undoFn, description = null) {
      const undo = useUndoStore();
      // Eintrag pushen, ID merken
      const before = undo.stack.length;
      undo.push({ description: description ?? message, undoFn });
      const stackEntry = undo.stack[undo.stack.length - 1];
      this.showSnackbar({
        message,
        action: {
          label: 'Rückgängig',
          handler: async () => {
            // Wenn der Eintrag noch im Stack ist, entfernen + ausführen.
            const idx = undo.stack.findIndex((e) => e.id === stackEntry.id);
            if (idx !== -1) {
              const [entry] = undo.stack.splice(idx, 1);
              await entry.undoFn();
            }
          }
        }
      });
      return stackEntry;
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
