import { defineStore } from 'pinia';

const MAX_STACK_SIZE = 10;

/**
 * LIFO-Stack rückgängig-machbarer Aktionen. Jede mutierende Quick-Action
 * (Verbrauchen, Anbruch, Plus/Minus, Einfrieren, Split) pusht hier einen
 * Eintrag. Ein globaler Undo-Button popt das letzte Element und ruft
 * dessen `undoFn` auf.
 *
 * Wir halten max. 10 Einträge — älteste fallen unten raus. Reicht für
 * gefühlte „letzte Aktionen".
 *
 * Die `undoFn` ist eine Closure auf den Inventory-Store; bei einem
 * App-Reload geht der Stack verloren (das ist okay — frischer Start).
 */
export const useUndoStore = defineStore('undo', {
  state: () => ({
    stack: []
  }),

  getters: {
    count: (state) => state.stack.length,
    topDescription: (state) =>
      state.stack.length ? state.stack[state.stack.length - 1].description : null
  },

  actions: {
    push({ description, undoFn }) {
      if (typeof undoFn !== 'function') {
        throw new Error('undoFn muss eine Funktion sein.');
      }
      this.stack.push({
        id: crypto.randomUUID(),
        description: description ?? 'Aktion',
        undoFn
      });
      while (this.stack.length > MAX_STACK_SIZE) {
        this.stack.shift();
      }
    },

    /**
     * Popt das letzte Element und führt seine undoFn aus.
     * Liefert die Description zurück (oder null wenn leer), damit der
     * Caller eine Bestätigungs-Snackbar anzeigen kann.
     */
    async pop() {
      const entry = this.stack.pop();
      if (!entry) return null;
      try {
        await entry.undoFn();
      } catch (e) {
        // Bei Fehler den Eintrag NICHT zurücklegen — sonst sitzt der User
        // in einer Endlosschleife. Wir loggen und gehen weiter.
        console.error('Undo fehlgeschlagen:', e);
      }
      return entry.description;
    },

    clear() {
      this.stack = [];
    }
  }
});
