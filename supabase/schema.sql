-- Vorratsmonster v3 — Supabase-Schema
--
-- Einmalig im Supabase-SQL-Editor ausführen. Idempotent: bestehende
-- Tabellen/Policies werden vorher gedroppt (wir laufen das sehr selten,
-- bei Schema-Änderungen wird das Skript hier aktualisiert und neu
-- ausgeführt — Datenverlust ist nur initial unkritisch).
--
-- Architektur-Entscheidung: ein Account besitzt alle Daten. Kein
-- Haushalts-/Membership-Modell. Ein zweites Gerät loggt sich mit
-- derselben E-Mail ein und sieht damit dieselbe DB.

-- =========================
-- items
-- =========================
create table if not exists public.items (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  barcode text,
  name text not null,
  brand text,
  image_url text,
  category text,
  quantity integer not null default 1,
  best_before date not null,
  location text not null check (location in ('fridge', 'freezer', 'pantry')),
  is_opened boolean not null default false,
  opened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists idx_items_user on public.items(user_id);
create index if not exists idx_items_user_updated on public.items(user_id, updated_at);

-- =========================
-- my_products (eigene Produkt-DB, keyed by Barcode)
-- =========================
create table if not exists public.my_products (
  user_id uuid not null references auth.users(id) on delete cascade,
  barcode text not null,
  name text not null,
  brand text,
  image_url text,
  category text,
  source text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, barcode)
);
create index if not exists idx_my_products_updated on public.my_products(user_id, updated_at);

-- =========================
-- shelf_life_presets (auto-gelernte Standard-Haltbarkeiten)
-- =========================
create table if not exists public.shelf_life_presets (
  user_id uuid not null references auth.users(id) on delete cascade,
  name_lower text not null,
  days integer not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, name_lower)
);
create index if not exists idx_shelf_life_updated on public.shelf_life_presets(user_id, updated_at);

-- =========================
-- Row Level Security: jeder User sieht nur eigene Daten
-- =========================
alter table public.items enable row level security;
alter table public.my_products enable row level security;
alter table public.shelf_life_presets enable row level security;

drop policy if exists "items_owner" on public.items;
create policy "items_owner" on public.items
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "my_products_owner" on public.my_products;
create policy "my_products_owner" on public.my_products
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "shelf_life_presets_owner" on public.shelf_life_presets;
create policy "shelf_life_presets_owner" on public.shelf_life_presets
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =========================
-- Realtime aktivieren für alle drei Tabellen
-- =========================
alter publication supabase_realtime add table public.items;
alter publication supabase_realtime add table public.my_products;
alter publication supabase_realtime add table public.shelf_life_presets;
