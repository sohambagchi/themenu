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
   - `DASHBOARD_SESSION_TOKEN`: long random session token for cookie auth
   - `DASHBOARD_OWNER_USER_ID`: an existing `auth.users.id` to own all inventory rows

Viewing inventory pages does not require login. Login is only required for adding new items
through Sourcing and Mise en Place.

During cooking/consumption:
- On Ingredients, add items to `Tray`, then click `Cooked`.
- On Prepared foods, add items to `Order`, then click `Eat`.
- If you are already logged in, stock updates immediately. If not, a username/password prompt appears.

Example:

```bash
cp .env.example .env.local
```

## 2) Database setup

Run `supabase/schema.sql` in the Supabase SQL editor.

If your DB was already initialized from an older schema, run the SQL from:
`supabase/migrations/20260218_add_item_stock_kind.sql`

## 3) Run locally (Bun)

```bash
bun install
bun run dev
```

Open `http://localhost:3000`.

## 4) Routes

- `/`: Prepared foods inventory
- `/ingredients`: Ingredient inventory
- `/sourcing`: Receipt sourcing flow (commits to Ingredient inventory only)
- `/mise-en-place`: Add finished items to Prepared inventory
- `/login`: Static username/password entry
