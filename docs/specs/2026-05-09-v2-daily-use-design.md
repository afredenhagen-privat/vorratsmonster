# Vorratsmonster v2 — Tägliche Nutzung & Schneller Anlegen

## Context

v1 ist live und im Test. Die naheliegenden Pain-Points im Alltag sind alle Backlog-Punkte, die das tägliche „ich öffne / verbrauche / lagere um"-Gefühl betreffen, plus die wiederkehrende Eingabe-Friktion bei manuellen Einträgen — vor allem das umständliche Date-Picker-Tippen und die Tatsache, dass der OFF-Cache nach 30 Tagen wegläuft und Barcodes ohne OFF-Treffer beim nächsten Scan wieder unbekannt sind.

Dieser Schwung adressiert all das als ein Release, weil die Features auf dasselbe Datenmodell-Update aufsetzen und sich UX-mäßig gegenseitig verstärken.

**Was bewusst draußen bleibt** (eigene Schwünge):
- Push-Notifications (Service-Worker + Permissions, eigenes Thema)
- Supabase-Sync (Auth + Realtime, größter Brocken)
- Statistik / Rezepte / Auto-Einkaufsliste (warten auf echte Datenbasis)
- MHD-Verkürzung beim Anbruch (auf der Roadmap, kommt später)

## Scope dieses Schwungs

### Bündel A — Tägliche Nutzung
1. **Anbruch markieren** — Toggle im Detail-View + Wisch-Geste in der Liste. Setzt `is_opened=true` und `opened_at=now`. **MHD bleibt unangetastet** (das ist explizit Roadmap, nicht v2).
2. **Plus/Minus direkt in der Liste** — kleine `−` / `+` Buttons rechts am Listeneintrag. `−` bei `quantity=1` löst Soft-Delete + Undo aus (gleicher Flow wie heutiges „Verbrauchen"). `+` erhöht ohne Bestätigung.
3. **Filter „Angebrochen"** — neuer Chip in der Filter-Leiste, zeigt nur Einträge mit `is_opened=true`.
4. **Einfrieren-Aktion** — im Detail-View Button „Einfrieren" (nur sichtbar wenn `location !== 'freezer'`). Wechselt `location='freezer'` und verlängert `best_before` automatisch um **+6 Monate**, ohne Rückfrage.

### Bündel B — Schneller Anlegen
5. **Standard-Haltbarkeiten (auto-gelernt)** — neue Tabelle `shelf_life_presets`. Beim Speichern eines manuellen Eintrags wird die MHD-Differenz (in Tagen ab Anlage-Datum) als Preset für diesen Namen gespeichert/überschrieben. Beim nächsten manuellen Anlegen mit demselben Namen wird das MHD-Feld auf `today + days` vorbelegt (überschreibbar). Kein Settings-UI nötig — läuft transparent im Hintergrund.
6. **Scansuche als Filter** — in der InventoryListView ein Scan-Icon-Button neben dem Suchfeld. Tap öffnet den Scanner im **Filter-Modus**: erkannter Barcode wird als Filter-Chip „Barcode: 1234…" gesetzt, Liste zeigt nur Einträge mit diesem Barcode. Filter-Chip ist via X entfernbar. Gleiche Scanner-Komponente wie heute, anderer Modus (Query-Param `?mode=filter`).
7. **Eigene Produkt-Datenbank** — `products_cache` (TTL-Cache) wird ersetzt durch eine **persistente eigene Produkt-DB** `my_products`. Lookup-Reihenfolge bei einem Barcode-Scan:
   1. **Lokale `my_products`** zuerst — User-Daten, kein TTL.
   2. **Open Food Facts** als Fallback, wenn lokal nichts da.
   3. Wenn beide leer → manuelles Form mit Barcode vorausgefüllt.

   Befüllung: Ein Barcode landet in `my_products` **erst dann**, wenn der User aus dem Scan einen Vorratseintrag speichert. Reines Schauen füllt die DB nicht zu. **User-Edits gewinnen** — wenn der User Name/Marke/Bild beim Anlegen ändert, wird die geänderte Version persistiert und beim nächsten Scan angezeigt.

   Sync-fähig vorbereitet (`updated_at`, `deleted_at`); langfristig wird `my_products` zwischen Geräten synchronisiert.

8. **Datums-Direkteingabe** — neue Komponente `DateInput.vue` ersetzt das nackte `<input type="date">`. Akzeptiert numerische Eingaben:
   - `15` → 15. aktueller Monat (oder nächster, wenn 15. schon vorbei)
   - `15.05` / `15.5` → 15. Mai (Smart-Year-Logik, s.u.)
   - `15.05.26` / `15.05.2026` → exakt
   - `15052026` → 15.05.2026 (8 Ziffern, ohne Trenner)

   **Smart-Year-Logik** ohne Jahr-Eingabe: nimm das aktuelle Jahr; falls das resultierende Datum in der Vergangenheit liegt, nimm das nächste Jahr. Beispiel am 20.05.2026: Eingabe „15.05" wird `2027-05-15`, Eingabe „25.05" wird `2026-05-25`.

   Eingabe wird live geparst, bei gültigem Ergebnis als Pille im Eingabefeld dargestellt („**15.05.2026**"). Daneben ein 📅-Button als Fallback, der den nativen Date-Picker öffnet (Hidden `<input type="date">`).

## Datenmodell-Änderungen

### `items` — keine Schema-Änderung nötig
Felder `is_opened` und `opened_at` sind seit v1 im Schema, werden jetzt aktiv genutzt.

### `my_products` — neue Tabelle (ersetzt `products_cache`)
```js
{
  barcode: string,           // Primary Key
  name: string,
  brand: string | null,
  image_url: string | null,
  category: string | null,
  source: 'user' | 'off',    // wo's herkommt (für ggf. Refresh-Aktionen später)
  created_at: string,        // ISO
  updated_at: string,        // ISO
  deleted_at: string | null  // Soft-Delete (Sync-Vorbereitung)
}
```

### `shelf_life_presets` — neue Tabelle
```js
{
  name_lower: string,   // Primary Key, z.B. "kartoffeln"
  days: number,         // typische Haltbarkeit ab Anlagedatum
  updated_at: string    // ISO
}
```
Strategie für `days`: einfach **letzter Wert** überschreibt (kein Median). YAGNI — wir können später auf Median wechseln, wenn's stört.

Sync-Bereitschaft: alle drei Tabellen (`items`, `my_products`, `shelf_life_presets`) folgen jetzt derselben Konvention (`updated_at` + soft-delete) und sind beim späteren Supabase-Sync ohne Schema-Anpassung mitnehmbar.

### Dexie-Migration `version(2)` mit Daten-Übernahme
```js
db.version(2).stores({
  items: 'id, barcode, name, best_before, location, deleted_at, updated_at',
  my_products: 'barcode, source, updated_at, deleted_at',
  shelf_life_presets: 'name_lower, updated_at'
  // products_cache wird gedroppt — temporärer Cache, kein Datenverlust
}).upgrade(async (tx) => {
  // Bestehende Items mit Barcode in my_products ziehen, damit der User
  // beim ersten Scan nach dem Update sofort lokal Treffer hat.
  const items = await tx.table('items').toArray();
  const seen = new Set();
  for (const i of items) {
    if (!i.barcode || seen.has(i.barcode)) continue;
    seen.add(i.barcode);
    const now = new Date().toISOString();
    await tx.table('my_products').put({
      barcode: i.barcode,
      name: i.name,
      brand: i.brand,
      image_url: i.image_url,
      category: i.category,
      source: 'off',
      created_at: i.created_at ?? now,
      updated_at: now,
      deleted_at: null
    });
  }
});
```

## UI-Änderungen im Detail

### `InventoryListView.vue`
- Suchfeld-Zeile: Suchfeld nimmt `flex-1`, daneben kleiner runder Icon-Button **📷** → `router.push('/scan?mode=filter')`
- Filter-Chips-Leiste bekommt einen weiteren Chip **„Angebrochen"**, exklusiv mit Lagerort-Chip (oder zusätzlich? → **zusätzlich**: Kombination ist erlaubt, z.B. „Kühlschrank + Angebrochen").
  - State: `ui.filterOpened: boolean`
- Aktiver Barcode-Filter wird als entfernbarer Chip **„Barcode: 1234567890123 ✕"** angezeigt
  - State: `ui.filterBarcode: string | null`
- Listeneintrag erweitert: rechts neben Ampel-Badge zwei kleine Buttons `−` und `+`. Layout: bei sehr engem Screen (320px) eventuell Ampel unter dem Namen statt rechts daneben.
- Wisch-Geste rechts → Anbruch-Toggle (touch-only). Implementierung: `@touchstart` / `@touchmove` / `@touchend` mit Schwellenwert ~80px. Beim Auslösen kurz Feedback („angebrochen markiert" Snackbar mit Undo).

### `ItemDetailView.vue`
- Neuer Abschnitt: **Status** mit Toggle „Angebrochen" (Chip-Style, klickbar). Setzt `is_opened` und `opened_at` über `inventory.toggleOpened(id)`.
- Neuer Button **„Einfrieren"** (sichtbar wenn `location !== 'freezer'`), zwischen „Bearbeiten" und „Verbrauchen". Action: ruft `inventory.freeze(id)` → `location='freezer'`, `best_before = best_before + 6 Monate`. Snackbar bestätigt mit Undo (nutzt vorhandenen Snackbar-Mechanismus, `restore` als Inverse mit Vorher-Werten).

### `ScannerView.vue`
- Neuer Prop / Query `mode: 'add' | 'filter'` (Default `'add'`, bestehender Flow).
- Im `filter`-Modus: erkannter Barcode → `router.replace('/?...')` plus `ui.setBarcodeFilter(code)` statt Form öffnen.
- Manueller Fallback im Filter-Modus zeigt zusätzlich: „Du suchst was Manuelles? Tippe einfach den Namen ins Suchfeld."

### `ItemFormView.vue`
- **Date-Picker durch `DateInput.vue` ersetzen** für das MHD-Feld.
- Beim Speichern eines manuellen Eintrags: nach `inventory.create()` zusätzlich `shelfLifePresets.upsert(name, daysFromToday)`.
- Im Autocomplete-Pick: wenn der gewählte Name ein Preset hat, MHD-Feld auf `today + days` vorbelegen — aber nur, wenn der User das Feld nicht selbst geändert hat (Heuristik: noch auf Default `today + 7`).
- **Beim Speichern eines Eintrags mit Barcode** zusätzlich `productsStore.upsert({ barcode, name, brand, image_url, category, source })` aufrufen — `source = 'off'` wenn beim Anlegen ein OFF/lokaler Treffer war, sonst `'user'`. User-Edits gewinnen, also der gespeicherte Stand entspricht dem Form-State.

### Neue Komponente `DateInput.vue`
```vue
<script setup>
const props = defineProps({ modelValue: String })
const emit = defineEmits(['update:modelValue'])

// rawText: was der User tippt
// parseDate(rawText) → ISO-String oder null
// Bei jedem Input: parsen, wenn ok → emit
// Native Picker via hidden <input type="date"> + 📅-Button
</script>
```

`parseDate(input)` (in `src/utils/parseDate.js`, isolierte Pure-Funktion mit eigener Test-Suite):
- Akzeptiert: `15` · `15.5` · `15.05` · `15.5.26` · `15.05.2026` · `15052026` · `1552026` (4 Ziffern Jahr, kurze Tag/Monat)
- Bei fehlendem Jahr: aktuelles Jahr wenn Datum heute oder später, sonst nächstes Jahr (Smart-Year)
- Bei zweistelligem Jahr `YY` → `2000 + YY`
- Validiert reale Kalendertage (29.02. nur in Schaltjahr)
- Liefert ISO-Date-String (`YYYY-MM-DD`) oder `null`

## Stores

### `useInventoryStore` — neue Actions
- `toggleOpened(id)` — flippt `is_opened`, setzt/clear `opened_at`, aktualisiert `updated_at`. Snackbar mit Undo.
- `setQuantity(id, delta)` — `quantity = max(0, quantity + delta)`. Wenn neu = 0 → softDelete + Undo. Sonst nur quantity-Update + `updated_at`.
- `freeze(id)` — Transaktion: `location='freezer'`, `best_before = best_before + 6 Monate` (in Monaten via `setMonth`). Vorherigen Zustand merken und in Snackbar-Undo verwenden.

### `useShelfLifeStore` — neuer Store
```js
state: { presets: Map<name_lower, { days, updated_at }> }
actions: {
  load(),                       // einmal aus Dexie
  upsertFromItem(name, mhdIso), // berechnet days = mhd - today, persistiert
  daysFor(name)                 // liefert days oder null
}
```

### `useProductsStore` — ersetzt `useProductCacheStore`
```js
state: {} // läuft direkt gegen Dexie, kein Cache nötig
actions: {
  // Lookup-Reihenfolge: lokal → OFF → null
  async lookup(barcode) {
    const local = await db.my_products.get(barcode)
    if (local && !local.deleted_at) return local
    const off = await fetchProduct(barcode)
    return off  // NICHT automatisch persistieren — erst beim Save
  },
  // Wird beim Speichern eines Items mit Barcode aufgerufen.
  // Persistiert oder überschreibt den Eintrag in my_products.
  async upsert({ barcode, name, brand, image_url, category, source }) { ... }
}
```

### `useUiStore` — Filter erweitern
- `filterOpened: boolean`
- `filterBarcode: string | null`
- `setOpenedFilter(b)`, `setBarcodeFilter(s)`

`inventoryStore.filtered({ query, location, opened, barcode })` filtert entsprechend.

## Tests (Vitest)

Neue/erweiterte Test-Cases:
- `inventoryStore.test.js`:
  - `toggleOpened` setzt/cleart `is_opened` und `opened_at`
  - `setQuantity` mit positivem delta erhöht; mit negativem auf 0 → soft-deletes
  - `freeze` setzt location und schiebt MHD um genau 6 Monate
  - `filtered({ opened: true })` liefert nur angebrochene
  - `filtered({ barcode: '...' })` liefert nur Einträge mit dem Barcode
- `shelfLifeStore.test.js` (neu):
  - `upsertFromItem('Kartoffeln', '2026-05-23')` mit today=2026-05-09 → `days=14`
  - Zweiter `upsertFromItem`-Aufruf überschreibt Wert
  - `daysFor('kartoffeln')` ist case-insensitiv (Lookup über `name_lower`)
- `productsStore.test.js` (neu):
  - `lookup(barcode)` gibt lokalen Eintrag, wenn vorhanden — **OFF wird gar nicht gefragt** (Mock prüft das)
  - `lookup(barcode)` ohne lokalen Eintrag fällt auf OFF zurück
  - `upsert(...)` mit `source='user'` legt neuen Eintrag an, Update-Aufruf überschreibt Felder und setzt `updated_at` neu
  - `upsert(...)` setzt `deleted_at=null` (z.B. wenn der User ein zuvor gelöschtes Produkt wieder anlegt)
- `parseDate.test.js` (neu, viele Edge-Cases):
  - `15.05.2026` → `2026-05-15`
  - `15.05.26` → `2026-05-15`
  - `15.05` am 2026-05-09 → `2026-05-15` (Smart-Year, gleiches Jahr)
  - `15.05` am 2026-05-20 → `2027-05-15` (Smart-Year, nächstes Jahr)
  - `15052026` → `2026-05-15`
  - `15.5.26` → `2026-05-15` (einstelliger Monat erlaubt)
  - `29.02.2026` → null (kein Schaltjahr); `29.02.2024` → ok
  - `32.05.2026` / `15.13.2026` → null
  - leere/nicht-numerische Eingabe → null
- Migration `version(1)→version(2)`: Items mit Barcode landen in `my_products`, `products_cache` ist weg, `shelf_life_presets` ist da.

## Implementierungs-Reihenfolge

1. **Datenmodell:** Dexie-Migration `version(2)` + neue Tabellen + Upgrade-Funktion. Tests für Migration.
2. **`parseDate` Pure-Funktion + Tests** (kleinster isolierter Brocken, viele Edge-Cases).
3. **`useShelfLifeStore`** + Tests.
4. **`useProductsStore`** (ersetzt `useProductCacheStore`) + Tests.
5. **`useInventoryStore`-Erweiterung:** `toggleOpened`, `setQuantity`, `freeze` + erweiterte `filtered()` + Tests.
6. **`useUiStore`-Erweiterung:** `filterOpened`, `filterBarcode` + Tests.
7. **`DateInput.vue`** Komponente, läuft gegen `parseDate`.
8. **`ItemFormView.vue`:** DateInput einbauen, Preset-Vorbelegung, Preset-Upsert, `productsStore.upsert` beim Save mit Barcode.
9. **`InventoryListView.vue`:** Plus/Minus-Buttons, Angebrochen-Filter-Chip, Barcode-Filter-Chip, Scan-Icon neben Suche.
10. **`ScannerView.vue`:** `mode`-Param (`add` / `filter`).
11. **`ItemDetailView.vue`:** Anbruch-Toggle, Einfrieren-Button.
12. **`useSwipe` Composable + Wisch-Geste in der Liste** (touch-only, auf Desktop inaktiv).
13. **Smoke-Test im Browser-Preview**, dann Commit + Push (Workflow deployt automatisch).

## Verifikation (manuelle End-to-End-Tests)

Nach `npm test` grün, Build sauber, Dev-Server läuft:
1. **Anbruch via Detail:** Item öffnen → Toggle „Angebrochen" → Detail zeigt Anbruch-Markierung → Liste zeigt visuelle Markierung (z.B. kleiner Punkt)
2. **Anbruch via Wisch:** auf Touch-Screen ein Listeneintrag nach rechts wischen → wird angebrochen, Snackbar mit Undo
3. **Plus/Minus:** Item mit Menge 3 → `−` drücken → Menge 2; nochmal bis 0 → Soft-Delete + Undo-Snackbar
4. **Filter Angebrochen:** Chip aktivieren → nur angebrochene Items sichtbar; mit Lagerort-Chip kombinierbar
5. **Einfrieren:** Item im Kühlschrank, MHD 2026-05-15 → „Einfrieren" → Lagerort=Gefrier, MHD=2026-11-15
6. **Scansuche:** Scan-Icon neben Suche → bekannten Barcode scannen → Liste zeigt nur Einträge mit diesem Barcode, Filter-Chip „Barcode: …" sichtbar → ✕ entfernt Filter
7. **Preset auto-gelernt:** Manuellen Eintrag „Kartoffeln" mit MHD in 14 Tagen anlegen. Zweiten manuellen Eintrag „Kartoffeln" anfangen → Autocomplete pickt → MHD-Feld zeigt today+14
8. **Lokale Produkt-DB Treffer:** Barcode 1234 zum ersten Mal scannen → OFF-Lookup → Form vorausgefüllt → Speichern. Barcode 1234 erneut scannen → diesmal **kein Netzwerkruf** (im DevTools sichtbar), Form aus `my_products` vorausgefüllt.
9. **OFF-unbekannt + lokal anlegen:** Random-Barcode scannen → OFF-404 → leeres Form → Name eintippen + Speichern → erneut scannen → Form ist mit eingegebenem Namen vorausgefüllt (komplett offline funktional).
10. **User-Edit gewinnt:** Bekanntes Produkt scannen → Name im Form ändern → Speichern → erneut scannen → Form zeigt geänderten Namen (nicht OFF-Original).
11. **DateInput Direkteingabe:** „15.05.26" tippen → Form zeigt Pille „15.05.2026", MHD wird übernommen. „15.05" am 2026-05-09 → ergibt 2026-05-15. „15.05" am 2026-05-20 → ergibt 2027-05-15.
12. **DateInput Picker-Fallback:** 📅-Button tippen → nativer Date-Picker öffnet sich → Auswahl füllt Eingabefeld als formatierte Pille.
13. **Migration v1→v2:** Mit bestehender v1-Datenbank im Browser App neu laden → keine Fehler, alte Items intakt, alle Items mit Barcode sind in `my_products` aufgetaucht.

## Kritische Dateien

| Datei | Was passiert |
|---|---|
| `src/db/database.js` | `version(2).stores({...})` mit Migrations-Upgrade |
| `src/stores/inventoryStore.js` | `toggleOpened` / `setQuantity` / `freeze` ergänzen, `filtered` erweitern |
| `src/stores/shelfLifeStore.js` | **neu** |
| `src/stores/productsStore.js` | **neu** — ersetzt `productCacheStore.js` (alte Datei löschen) |
| `src/stores/uiStore.js` | `filterOpened`, `filterBarcode` ergänzen |
| `src/utils/parseDate.js` | **neu** (Pure-Funktion) |
| `src/components/DateInput.vue` | **neu** (Date-Eingabe mit Live-Parser + Native-Picker-Fallback) |
| `src/components/InventoryItem.vue` | **ggf. neu** (Listenelement extrahieren, Wisch + Plus/Minus) |
| `src/composables/useSwipe.js` | **neu** (Touch-Geste-Helper) |
| `src/views/InventoryListView.vue` | Plus/Minus, neue Filter-Chips, Scan-Icon |
| `src/views/ScannerView.vue` | `mode`-Param + Filter-Pfad |
| `src/views/ItemDetailView.vue` | Anbruch-Toggle, Einfrieren-Button |
| `src/views/ItemFormView.vue` | DateInput, Preset-Vorbelegung, Preset-Upsert, `productsStore.upsert` beim Save |
| `src/__tests__/*.test.js` | Tests pro Feature ergänzen, `parseDate.test.js` und `productsStore.test.js` neu |
