# Database Guide

## Source of truth
- Primary schema: `supabase/schema.sql`
- Incremental migrations: `supabase/migrations/*.sql`

## Core tables

### `public.items`
- Purpose: inventory rows for both Menu and Pantry buckets
- Key columns:
  - `id uuid pk`
  - `user_id uuid` (owned by auth user)
  - `name text`
  - `photo_url text`
  - `quantity int >= 0`
  - `date_added date`
  - `stock_kind enum('Prepared','Ingredient')`
  - `location enum('Freezer','Pantry','Fridge')`
  - `type text`
  - `ingredients text[]`
  - `tags text[]`
  - `created_at`, `updated_at`
- Indexes:
  - `(user_id)`
  - `(user_id, stock_kind)`
  - `(date_added)`
  - `GIN(tags)`

### `public.pairing_rules`
- Purpose: deterministic pairing rules (global or per user)
- Includes trigger/recommended type/tag, priority, reason, active flag

## Triggers/functions
- `public.set_updated_at()` updates `updated_at` on write
- Trigger attached to both `items` and `pairing_rules`

## RLS
- `items`: select/insert/update/delete only for `auth.uid() = user_id`
- `pairing_rules`: select global or own rows; write own rows only

## Storage
- Bucket: `item-photos`
- Public: true
- Size cap: 5 MB
- MIME allowlist: jpeg/png/webp/heic/heif

## Migration notes
- `20260218_add_item_stock_kind.sql`: adds stock bucket enum + column
- `20260218_create_item_photos_bucket.sql`: creates upload bucket
- `20260218_items_type_text_and_ingredients.sql`: converts `type` to text and adds `ingredients`
