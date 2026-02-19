# Extensibility Guide

## Naming conventions
- UI labels are canonical for user-facing domains: `Menu`, `Pantry`.
- Database values remain: `Prepared`, `Ingredient`.
- Always convert via `src/lib/inventoryLabels.ts` instead of duplicating conditionals.

## Adding a new API route
1. Create route in `src/app/api/<feature>/route.ts`.
2. Enforce `isAllowedRequestOrigin` for state-changing methods.
3. Add auth checks through `requireDashboardSession` or inline credential strategy.
4. Validate and normalize payloads in a dedicated `src/lib/*Validation.ts` helper.
5. Use `getSupabaseAdminClient()` and owner scoping with `getDashboardOwnerUserId()`.

## Adding a new inventory attribute
1. Add DB column + migration.
2. Extend `DbItemRow`, `Item`, and `NewItemInput` in `src/lib/types.ts`.
3. Update mapper functions in `src/app/api/items/route.ts`.
4. Validate in `src/lib/itemValidation.ts`.
5. Render/edit in relevant components.

## Adding frontend pages/panels
- Add route under `src/app/*/page.tsx`.
- Add nav entry in `src/components/header-nav.tsx`.
- Keep data access in `src/lib/inventoryApi.ts`.
- Prefer React Query for cache + mutation invalidation.

## Pairing logic changes
- Rules currently live in `src/lib/recommendationEngine.ts`.
- Keep scoring deterministic and side-effect free.
- If moving to DB-driven rules, reuse `pairing_rules` table and keep fallback behavior explicit.

## Testing workflow notes
- Current repo has no committed ESLint config, so `next lint` may prompt interactively.
- Use `bunx tsc --noEmit` for non-interactive type checks in CI-like shell sessions.
- Record test runs in `.testing/<timestamp>.log`.
