# The Menu

Personal food inventory and deterministic meal pairing app built with Next.js + Supabase.

## 1) Environment setup

1. Copy `.env.example` to `.env.local`.
2. In Supabase Dashboard, open `Project Settings -> API`.
3. Fill these values in `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`: project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: anon public key
   - `SUPABASE_SERVICE_ROLE_KEY` (optional): service role key for trusted server-side jobs/routes

Example:

```bash
cp .env.example .env.local
```

## 2) Database setup

Run `supabase/schema.sql` in the Supabase SQL editor.

## 3) Run locally (Bun)

```bash
bun install
bun run dev
```

Open `http://localhost:3000`.
