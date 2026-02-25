# Codebase Map

## Top-level
- `src/app/`: App Router pages and API route handlers
- `src/components/`: UI components/panels
- `src/lib/`: domain, validation, auth, API wrappers, utilities
- `supabase/`: schema + migrations

## File Responsibilities

### App pages
- `src/app/layout.tsx`: global shell, fonts, nav, cookie-based auth state
- `src/app/page.tsx`: Menu page (`Dashboard` with prepared stock)
- `src/app/ingredients/page.tsx`: Pantry page (`Dashboard` with ingredient stock)
- `src/app/sourcing/page.tsx`: Sourcing panel
- `src/app/mise-en-place/page.tsx`: Mise en Place panel
- `src/app/staging/page.tsx`: redirect legacy route to `/sourcing`
- `src/app/login/page.tsx`: static credential login form

### API routes
- `src/app/api/items/route.ts`: list/insert inventory items
- `src/app/api/items/adjust/route.ts`: authenticated quantity delta updates
- `src/app/api/items/consume/route.ts`: batch consume and delete-on-zero (fractional-safe)
- `src/app/api/sourcing/conversions/route.ts`: deterministic conversion rule lookup + upsert
- `src/app/api/sourcing/pdf-text/route.ts`: Walmart PDF upload and JS text extraction
- `src/app/api/uploads/image/route.ts`: authenticated image upload with MIME sniffing
- `src/app/api/dashboard-auth/login/route.ts`: create session cookie
- `src/app/api/dashboard-auth/logout/route.ts`: clear session cookie
- `src/app/api/dashboard-auth/session/route.ts`: session status probe

### Core UI components
- `src/components/header-nav.tsx`: responsive nav + login/logout + theme toggle
- `src/components/dashboard.tsx`: core Menu/Pantry inventory UI, filters, pairings, unit-aware actions
- `src/components/staging-panel.tsx`: OCR/PDF parsing + correction + pantry commit
- `src/components/mise-en-place-panel.tsx`: prepared item creation + upload + unit-aware quantity input
- `src/components/styled-select.tsx`: custom select/dropdown primitive
- `src/components/providers.tsx`: React Query client provider
- `src/components/theme-toggle.tsx`: dark/light switch

### Library modules
- `src/lib/types.ts`: shared domain/data types
- `src/lib/inventoryLabels.ts`: Menu/Pantry <-> Prepared/Ingredient mapping
- `src/lib/inventoryApi.ts`: browser API wrappers
- `src/lib/itemValidation.ts`: POST `/api/items` payload normalization
- `src/lib/recommendationEngine.ts`: deterministic pairing scoring
- `src/lib/staging.ts`: deterministic receipt parser + tokenization/hash helpers
- `src/lib/sourcingApi.ts`: browser wrappers for sourcing conversion rules API
- `src/lib/quantity.ts`: quantity unit constants + fraction parsing + formatting
- `src/lib/walmartPdf.ts`: JS-only Walmart PDF text extraction (no shell binary)
- `src/lib/dashboardAuth.ts`: credentials, session signing/verification
- `src/lib/origin.ts`: same-origin validator
- `src/lib/requestMeta.ts`: client IP extraction
- `src/lib/rateLimit.ts`: in-memory rate-limit store
- `src/lib/date.ts`: days-aged helper
- `src/lib/supabase/admin.ts`: singleton service-role client

### Database
- `supabase/schema.sql`: full schema + indexes + policies + bucket + seeds
- `supabase/migrations/*`: additive migration history

## Logic Flow (happy path)
1. User loads page.
2. Page component renders panel.
3. Panel calls `inventoryApi` wrapper.
4. Wrapper calls route handler.
5. Route validates auth/origin/rate limits as needed.
6. Route reads/writes Supabase.
7. Mutation success invalidates query cache and UI re-renders.
