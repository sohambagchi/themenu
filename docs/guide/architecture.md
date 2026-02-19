# Architecture

## Stack
- Framework: Next.js 14 App Router + TypeScript
- UI: React 18 + Tailwind CSS
- Client data layer: TanStack Query
- Backend: Next.js route handlers under `src/app/api/*`
- Data/store: Supabase Postgres + Supabase Storage

## Runtime Topology
- Browser renders page components from `src/app/*`.
- Shared app shell is defined in `src/app/layout.tsx`.
- UI calls API wrappers in `src/lib/inventoryApi.ts`.
- API routes run server-side and use service-role Supabase client from `src/lib/supabase/admin.ts`.
- All inventory rows are scoped to one configured owner: `DASHBOARD_OWNER_USER_ID`.

## Domain Model
- Frontend labels: `Menu`, `Pantry`, `Sourcing`, `Mise en Place`.
- Database stock enum: `Prepared`, `Ingredient`.
- Mapping layer: `src/lib/inventoryLabels.ts`.
  - `Menu <-> Prepared`
  - `Pantry <-> Ingredient`
- API reads accept `inventoryLabel=Menu|Pantry`; legacy `stockKind` is deprecated.

## Data Flow
1. `Dashboard` page chooses a stock bucket (`Menu` or `Pantry`) and fetches items.
2. `inventoryApi.fetchInventoryItems` calls `/api/items` with the selected `inventoryLabel`.
3. `GET /api/items` validates session/public-read policy and maps query label to DB enum.
4. Route queries `public.items` in Supabase and returns normalized item DTOs.
5. Mutations (`adjust`, `consume`, `insert`) invalidate React Query keys to refresh UI.

## Feature Surfaces
- `Menu` (`/`): prepared dishes, photos, ingredients summary, deterministic pairing.
- `Pantry` (`/ingredients`): raw inventory view.
- `Sourcing` (`/sourcing`): OCR-like staging flow to create pantry items.
- `Mise en Place` (`/mise-en-place`): manual prepared-item creation and photo upload.

## Cross-cutting Systems
- Auth/session: HMAC-signed cookie (`themenu_dashboard_session`), static username/password.
- Request hardening: origin validation on state-changing routes.
- Abuse control: in-memory per-IP rate limits for login and inline auth paths.
- UI theme: light/dark mode with CSS variables and localStorage persistence.
