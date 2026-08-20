-- FoodTrack — databaseschema voor Supabase
-- Uitvoeren in de Supabase SQL-editor (eenmalig).

create table if not exists public.entries (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  ts timestamptz not null,
  raw_text text not null,
  items jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.learned_foods (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  food jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.settings (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id)
);

alter table public.entries enable row level security;
alter table public.learned_foods enable row level security;
alter table public.settings enable row level security;

-- Iedereen ziet en bewerkt uitsluitend zijn eigen rijen.
create policy "eigen entries" on public.entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "eigen producten" on public.learned_foods
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "eigen instellingen" on public.settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
