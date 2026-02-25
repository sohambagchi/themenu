-- Deterministic sourcing conversion hash-table used by receipt parsing in Sourcing.

create table if not exists public.sourcing_conversion_rules (
  id uuid primary key default gen_random_uuid(),
  source text not null check (char_length(trim(source)) > 0),
  token_key text not null check (char_length(trim(token_key)) > 0),
  token_hash text not null check (char_length(trim(token_hash)) > 0),
  canonical_name text not null check (char_length(trim(canonical_name)) > 0),
  canonical_quantity_unit text not null default '' check (
    canonical_quantity_unit in ('', 'lb', 'fl oz', 'oz', 'g', 'kg', 'ml', 'l', 'tbsp', 'cups')
  ),
  canonical_type text not null check (char_length(trim(canonical_type)) > 0),
  canonical_location public.item_location not null default 'Pantry',
  canonical_tags text[] not null default '{}',
  embedded_multiplier_override integer check (
    embedded_multiplier_override is null or embedded_multiplier_override >= 1
  ),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, token_hash)
);

alter table public.sourcing_conversion_rules
add column if not exists canonical_quantity_unit text not null default '' check (
  canonical_quantity_unit in ('', 'lb', 'fl oz', 'oz', 'g', 'kg', 'ml', 'l', 'tbsp', 'cups')
);

create index if not exists sourcing_conversion_rules_source_active_idx
  on public.sourcing_conversion_rules (source, is_active);

drop trigger if exists sourcing_conversion_rules_set_updated_at on public.sourcing_conversion_rules;
create trigger sourcing_conversion_rules_set_updated_at
before update on public.sourcing_conversion_rules
for each row execute function public.set_updated_at();

alter table public.sourcing_conversion_rules enable row level security;

drop policy if exists "sourcing_conversion_rules_select_authenticated"
on public.sourcing_conversion_rules;
create policy "sourcing_conversion_rules_select_authenticated"
on public.sourcing_conversion_rules
for select
using (auth.role() = 'authenticated');

drop policy if exists "sourcing_conversion_rules_insert_authenticated"
on public.sourcing_conversion_rules;
create policy "sourcing_conversion_rules_insert_authenticated"
on public.sourcing_conversion_rules
for insert
with check (auth.role() = 'authenticated');

drop policy if exists "sourcing_conversion_rules_update_authenticated"
on public.sourcing_conversion_rules;
create policy "sourcing_conversion_rules_update_authenticated"
on public.sourcing_conversion_rules
for update
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "sourcing_conversion_rules_delete_authenticated"
on public.sourcing_conversion_rules;
create policy "sourcing_conversion_rules_delete_authenticated"
on public.sourcing_conversion_rules
for delete
using (auth.role() = 'authenticated');
