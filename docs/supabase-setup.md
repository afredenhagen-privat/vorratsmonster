# Supabase-Setup (1× manuell)

Vorratsmonster nutzt Supabase als Backend für den Sync zwischen Geräten. Diese Schritte musst du **einmalig** durchführen, bevor der Sync funktioniert.

Die App funktioniert **auch ohne** Supabase weiterhin als reine Offline-PWA. Sync ist optional.

---

## 1. Projekt anlegen

1. Bei [supabase.com](https://supabase.com) einloggen (GitHub-Account `afredenhagen-privat` oder eigene E-Mail).
2. „New Project" → Organisation wählen → Project-Name `vorratsmonster`.
3. **Database Password** generieren (irrelevant für uns, da wir per JS-Client + RLS arbeiten — speichern aber für später).
4. **Region** auf `Central EU (Frankfurt)` setzen — niedrigste Latenz von Deutschland aus.
5. Plan: **Free**. Reicht völlig (500 MB DB, unlimited API requests, 2 concurrent realtime connections — passt für 2 Geräte).
6. Auf „Create new project" klicken — Dauer ca. 1-2 Minuten.

## 2. Schema rollen

1. Im Projekt-Dashboard links auf **SQL Editor** klicken.
2. Auf **New Query** klicken.
3. Den kompletten Inhalt von [`supabase/schema.sql`](../supabase/schema.sql) reinkopieren.
4. **Run** klicken (Ctrl+Enter). Du solltest „Success. No rows returned" sehen.

Damit sind die drei Tabellen `items`, `my_products`, `shelf_life_presets` mit Indizes, RLS-Policies und Realtime-Subscriptions aktiv.

## 3. Auth konfigurieren

1. Links auf **Authentication** → **Providers** klicken.
2. **Email** ist standardmäßig aktiv. Stelle sicher, dass:
   - **Enable Email Provider** = ON
   - **Confirm email** = OFF (für Magic-Link nicht zwingend nötig — vereinfacht Test)
   - **Secure email change** = ON
   - **Secure password change** = ON (egal, wir nutzen kein Passwort)
3. Links auf **Authentication** → **URL Configuration**:
   - **Site URL** → `https://afredenhagen-privat.github.io/vorratsmonster/`
   - **Redirect URLs** (kannst mehrere haben):
     - `https://afredenhagen-privat.github.io/vorratsmonster/`
     - `http://localhost:5174/` (für lokale Entwicklung)
4. **Save** klicken.

## 4. URL und Anon-Key kopieren

1. Links auf **Project Settings** (das Zahnrad-Icon unten links).
2. **API** auswählen.
3. Kopiere:
   - **Project URL** (sieht aus wie `https://abcdefgh1234.supabase.co`)
   - **anon public key** (sehr langer JWT-String, fängt mit `eyJ...` an)

> ⚠️ Der **anon public key** darf öffentlich sein — RLS schützt deine Daten. Der **service role key** dagegen NIEMALS in die App, der bypassed RLS und gibt Vollzugriff. Den brauchen wir nicht.

> 🚨 **Die Project URL ist die NACKTE Domain**, also `https://abcd1234.supabase.co` — **OHNE** `/rest/v1` am Ende. Im Dashboard wird manchmal eine API URL mit `/rest/v1` angezeigt; die ist falsch für unseren Use-Case. Falls du dich vertippst, normalisiert der Code das inzwischen automatisch und gibt eine Konsolen-Warnung aus, aber sauber ist es so wie oben.

## 5. ENV-Variablen setzen

### Lokal (für `npm run dev`)

Im Repo-Root eine Datei `.env.local` anlegen (NICHT committen — `.gitignore` schließt sie aus):

```
VITE_SUPABASE_URL=https://abcdefgh1234.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...langer...JWT
```

### GitHub Actions (für Production-Build)

1. Im Repo auf [github.com/afredenhagen-privat/vorratsmonster](https://github.com/afredenhagen-privat/vorratsmonster) einloggen.
2. **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
3. Zwei Secrets anlegen:
   - Name: `VITE_SUPABASE_URL`, Wert: deine Project URL
   - Name: `VITE_SUPABASE_ANON_KEY`, Wert: dein anon key

Der Deploy-Workflow liest die Secrets beim Build — sie landen ins Bundle, aber das ist OK (siehe RLS oben).

## 6. Fertig — was jetzt?

Sobald du das durch hast, sag Bescheid: ich fange dann mit der Code-Implementierung an. Beim ersten Login auf `/login` schickt dir Supabase einen Magic-Link an deine E-Mail; nach dem Klick bist du eingeloggt und der Initial-Upload schiebt deine bestehenden lokalen Daten in die Cloud-DB.

## Im laufenden Betrieb

- **Daten anschauen:** Supabase-Dashboard → **Table Editor** → Tabelle wählen
- **Auth-User anschauen:** Authentication → Users
- **Logs:** Logs → Postgres / Auth / Edge Functions
- **Schema-Änderung später:** Skript in `supabase/schema.sql` aktualisieren, im SQL-Editor neu ausführen — die `if not exists` und `drop policy if exists` machen das idempotent
