-- Supabase schema for The Menu
-- Run this in the Supabase SQL editor.

create extension if not exists "pgcrypto";

create type public.item_location as enum ('Freezer', 'Pantry', 'Fridge');
create type public.item_type as enum ('Protein', 'Carb', 'Veg', 'Ferment/Pickle');
create type public.item_stock_kind as enum ('Prepared', 'Ingredient');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  photo_url text,
  quantity integer not null default 0 check (quantity >= 0),
  date_added date not null default current_date,
  stock_kind public.item_stock_kind not null default 'Prepared',
  location public.item_location not null,
  type text not null check (char_length(trim(type)) > 0),
  ingredients text[] not null default '{}',
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index items_user_id_idx on public.items (user_id);
create index items_user_id_stock_kind_idx on public.items (user_id, stock_kind);
create index items_date_added_idx on public.items (date_added);
create index items_tags_gin_idx on public.items using gin (tags);

create trigger items_set_updated_at
before update on public.items
for each row execute function public.set_updated_at();

create table public.pairing_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  trigger_item_type public.item_type,
  trigger_tag text,
  recommended_item_type public.item_type,
  recommended_tag text,
  priority smallint not null default 100,
  reason text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pairing_rules_trigger_check check (
    trigger_item_type is not null or trigger_tag is not null
  ),
  constraint pairing_rules_recommendation_check check (
    recommended_item_type is not null or recommended_tag is not null
  )
);

create index pairing_rules_user_id_idx on public.pairing_rules (user_id);
create index pairing_rules_active_priority_idx
  on public.pairing_rules (is_active, priority);

create trigger pairing_rules_set_updated_at
before update on public.pairing_rules
for each row execute function public.set_updated_at();

-- Row-level security
alter table public.items enable row level security;
alter table public.pairing_rules enable row level security;

create policy "items_select_own"
on public.items
for select
using (auth.uid() = user_id);

create policy "items_insert_own"
on public.items
for insert
with check (auth.uid() = user_id);

create policy "items_update_own"
on public.items
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "items_delete_own"
on public.items
for delete
using (auth.uid() = user_id);

create policy "pairing_rules_select_global_or_own"
on public.pairing_rules
for select
using (user_id is null or auth.uid() = user_id);

create policy "pairing_rules_insert_own"
on public.pairing_rules
for insert
with check (auth.uid() = user_id);

create policy "pairing_rules_update_own"
on public.pairing_rules
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "pairing_rules_delete_own"
on public.pairing_rules
for delete
using (auth.uid() = user_id);

-- Public photo bucket for item images.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'item-photos',
  'item-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

-- Seed deterministic starter rules
insert into public.pairing_rules (
  user_id, trigger_item_type, trigger_tag, recommended_item_type, recommended_tag, priority, reason
)
values
  (null, 'Protein', 'Dry', 'Veg', 'Saucy', 10, 'Balance dry proteins with saucy vegetables.'),
  (null, 'Protein', 'Dry', 'Carb', 'Wet', 20, 'Pair dry proteins with wetter starches.'),
  (null, null, 'Spicy', 'Veg', 'Cooling', 5, 'Cooling side offsets heat.'),
  (null, null, 'Indian', 'Carb', 'Indian', 8, 'Prefer same-cuisine starch first.'),
  (null, null, 'Indian', 'Carb', 'Neutral', 15, 'Fallback to neutral starch if needed.');
