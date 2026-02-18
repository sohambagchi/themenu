-- Allow custom item types and store ingredient lists for prepared foods.

alter table public.items
alter column type type text using type::text;

alter table public.items
add column if not exists ingredients text[] not null default '{}';

alter table public.items
drop constraint if exists items_type_not_empty;

alter table public.items
add constraint items_type_not_empty check (char_length(trim(type)) > 0);
