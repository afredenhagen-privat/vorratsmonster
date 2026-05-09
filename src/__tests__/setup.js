import 'fake-indexeddb/auto';

// Supabase-Realtime erwartet beim Modul-Init einen globalen WebSocket.
// In happy-dom/Node ist keiner da → wir stubben einen No-Op-Constructor,
// damit createClient() nicht crasht. Die Tests interagieren eh nicht
// mit Realtime — bei Bedarf wird er separat gemockt.
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = class WebSocketStub {
    constructor() {
      this.readyState = 0;
    }
    send() {}
    close() {}
    addEventListener() {}
    removeEventListener() {}
    dispatchEvent() {
      return true;
    }
  };
}
