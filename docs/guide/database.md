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
  - `quantity numeric(12,3) >= 0` (supports fractions)
  - `quantity_unit text` (`'', lb, fl oz, oz, g, kg, ml, l, tbsp, cups`)
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

### `public.sourcing_conversion_rules`
- Purpose: deterministic hash-table for receipt token conversion confirmed in Sourcing Staging
- Key columns:
  - `id uuid pk`
  - `source text` (current source: `walmart`)
  - `token_key text`
  - `token_hash text` (unique with source)
  - `canonical_name text`
  - `canonical_quantity_unit text`
  - `canonical_type text`
  - `canonical_location enum('Freezer','Pantry','Fridge')`
  - `canonical_tags text[]`
  - `embedded_multiplier_override int nullable >= 1`
  - `is_active bool`
  - `created_at`, `updated_at`
- Indexes:
  - unique `(source, token_hash)`
  - `(source, is_active)`

## Triggers/functions
- `public.set_updated_at()` updates `updated_at` on write
- Trigger attached to `items`, `pairing_rules`, and `sourcing_conversion_rules`

## RLS
- `items`: select/insert/update/delete only for `auth.uid() = user_id`
- `pairing_rules`: select global or own rows; write own rows only
- `sourcing_conversion_rules`: authenticated-role read/write; API route enforces origin/session rules

## Storage
- Bucket: `item-photos`
- Public: true
- Size cap: 5 MB
- MIME allowlist: jpeg/png/webp/heic/heif

## Migration notes
- `20260218_add_item_stock_kind.sql`: adds stock bucket enum + column
- `20260218_create_item_photos_bucket.sql`: creates upload bucket
- `20260218_items_type_text_and_ingredients.sql`: converts `type` to text and adds `ingredients`
- `20260225_sourcing_conversion_rules.sql`: adds deterministic receipt conversion hash-table
- `20260225_items_quantity_units.sql`: adds quantity units and fractional quantity support
