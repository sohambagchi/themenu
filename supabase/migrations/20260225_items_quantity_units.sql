-- Add quantity units and allow fractional inventory quantities.

alter table public.items
alter column quantity type numeric(12,3) using quantity::numeric;

alter table public.items
add column if not exists quantity_unit text not null default '' check (
  quantity_unit in ('', 'lb', 'fl oz', 'oz', 'g', 'kg', 'ml', 'l', 'tbsp', 'cups')
);
