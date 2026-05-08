# Vorratsmonster

Persönliche Vorrats- und MHD-Tracking-PWA für Android. Barcode scannen → Open Food Facts liefert Produktdaten → Menge + MHD eingeben → lokal in IndexedDB ablegen. Liste sortiert nach Ablaufdatum mit Ampel-Badge.

## Stack

- Vue 3 + Vite + Pinia + Vue Router
- Dexie (IndexedDB)
- Tailwind CSS
- vite-plugin-pwa
- Vitest + happy-dom + fake-indexeddb

## Lokal entwickeln

```bash
npm install
npm run icons     # generiert public/icons/* (einmalig genug)
npm run dev       # http://localhost:5173
npm test          # Vitest
npm run build     # Production-Bundle nach dist/
```

Auf Android testen: `npm run dev -- --host`, dann `http://<lokale-IP>:5173` im Chrome öffnen.

## Architektur

- `src/db/database.js` — Dexie-Schema (`items`, `products_cache`)
- `src/stores/inventoryStore.js` — Repository-Pattern, alle CRUD-Operationen
- `src/stores/productCacheStore.js` — Open-Food-Facts-Lookup mit 30-Tage-Cache
- `src/stores/uiStore.js` — Snackbar-Queue, Filter, Suchquery
- `src/services/openFoodFacts.js` — API-Wrapper (`https://world.openfoodfacts.org/api/v2/product/<barcode>.json`)
- `src/views/` — InventoryListView, ScannerView, ItemFormView, ItemDetailView
- `src/components/` — ExpiryBadge, NameAutocomplete, UndoSnackbar

Components fassen Dexie nie direkt an — alles geht durch Stores. Damit lässt sich der Store später durch einen Supabase-Sync-Wrapper austauschen, ohne die UI anzufassen.

## Sync-Bereitschaft

Datenmodell ist auf späteres Multi-Device-Sharing vorbereitet:
- UUIDs (`crypto.randomUUID()`) statt Auto-Increment
- `created_at` / `updated_at` als ISO-Timestamps
- `deleted_at` als Soft-Delete-Flag (Last-Write-Wins-Sync)

## Deploy

Push auf `main` triggert den GitHub-Actions-Workflow `.github/workflows/deploy.yml` (Tests → Icons → Build → SPA-Fallback → Pages-Deploy).
