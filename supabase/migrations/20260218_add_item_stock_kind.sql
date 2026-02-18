-- Migration for existing databases:
-- Split inventory into Prepared vs Ingredient buckets.

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'item_stock_kind'
      and n.nspname = 'public'
  ) then
    create type public.item_stock_kind as enum ('Prepared', 'Ingredient');
  end if;
end $$;

alter table public.items
add column if not exists stock_kind public.item_stock_kind not null default 'Prepared';

create index if not exists items_user_id_stock_kind_idx on public.items (user_id, stock_kind);
