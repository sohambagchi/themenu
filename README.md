# The Menu

Personal food inventory and deterministic meal pairing app built with Next.js + Supabase.

## 1) Environment setup

1. Copy `.env.example` to `.env.local`.
2. In Supabase Dashboard, open `Project Settings -> API`.
3. Fill these values in `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`: project URL
   - `SUPABASE_SERVICE_ROLE_KEY`: used by server routes to read/write inventory
   - `DASHBOARD_USERNAME`: static dashboard login username
   - `DASHBOARD_PASSWORD`: static dashboard login password
   - `DASHBOARD_SESSION_TOKEN`: long random secret used to sign dashboard session cookies
   - `DASHBOARD_OWNER_USER_ID`: an existing `auth.users.id` to own all inventory rows
   - `DASHBOARD_PUBLIC_READ` (optional): set `true`/`1`/`yes` only if you intentionally want unauthenticated inventory reads

By default, viewing inventory now requires login. If you intentionally want public read access,
set `DASHBOARD_PUBLIC_READ=true`.
Login is required for adding new items through Sourcing and Mise en Place.
If you are not logged in, Mise en Place shows an inline username/password prompt on submit.

During cooking/consumption:
- On Pantry, add items to `Tray`, then click `Cooked`.
- On Prepared foods, add items to `Order`, then click `Eat`.
- If you are already logged in, stock updates immediately. If not, a username/password prompt appears.
- Manual +/- stock adjustments require an active dashboard login.

Photo uploads:
- In Mise en Place, use `Upload Photo` (file picker) or `Take Photo` (mobile camera option).
- Uploads require login and currently accept JPEG/PNG/WebP/HEIC/HEIF up to 5 MB.

Security notes:
- Login and inline username/password auth attempts are rate-limited.
- State-changing APIs validate request origin to reduce CSRF risk.

Example:

```bash
cp .env.example .env.local
```

## 2) Database setup

Run `supabase/schema.sql` in the Supabase SQL editor.

If your DB was already initialized from an older schema, run the SQL from:
`supabase/migrations/20260218_add_item_stock_kind.sql`
`supabase/migrations/20260218_create_item_photos_bucket.sql`
`supabase/migrations/20260218_items_type_text_and_ingredients.sql`

## 3) Run locally (Bun)

```bash
bun install
bun run dev
```

Open `http://localhost:3000`.

## 4) Routes

- `/`: Prepared foods inventory
- `/ingredients`: Pantry inventory
- `/sourcing`: Receipt sourcing flow (commits to Pantry inventory only)
- `/mise-en-place`: Add finished items to Prepared inventory
- `/login`: Static username/password entry
- `/api/uploads/image`: authenticated image upload endpoint (used by Mise en Place)
