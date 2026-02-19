# API Guide

Base: Next.js route handlers under `src/app/api/*`.

## Auth routes

### `POST /api/dashboard-auth/login`
- Body: `multipart/form-data` with `username`, `password`, optional `next`
- Behavior:
  - Validates origin
  - Rate-limits by IP (`dashboard-login`)
  - Verifies static credentials
  - Sets `themenu_dashboard_session` cookie (12h)
  - Redirects to `next` (or `/`)

### `POST /api/dashboard-auth/logout`
- Behavior: clears session cookie and redirects to `/login`

### `GET /api/dashboard-auth/session`
- Response: `{ authed: boolean }`

## Inventory routes

### `GET /api/items`
- Query:
  - Required: `inventoryLabel=Menu|Pantry`
  - Legacy: `stockKind` is deprecated and returns `410`
- Auth:
  - If `DASHBOARD_PUBLIC_READ` is false, valid session is required
- Response: `{ items: Item[] }` (quantity > 0 only)

### `POST /api/items`
- Body JSON:
  - `{ items: NewItemInput[], username?, password? }`
- Auth:
  - Session OR inline credentials (rate-limited under `inline-item-auth`)
- Validation:
  - Max 100 items
  - Requires `inventoryLabel` inside each item payload
  - Sending legacy `stockKind` without `inventoryLabel` returns a deprecation error
  - Validates name/type/location/date/quantity/photo/tags/ingredients
- Response: `{ ok: true }` on success

### `POST /api/items/adjust`
- Body JSON: `{ id: string, delta: number }`
- Auth: session required
- Behavior: updates quantity, deletes row if result reaches zero

### `POST /api/items/consume`
- Body JSON: `{ operations: [{id, quantity}], username?, password? }`
- Auth: session OR inline credentials (rate-limited under `inline-consume-auth`)
- Behavior: merges duplicate item IDs, decrements stock, deletes when zero
- Response: `{ ok: true, updated: number }`

## Upload route

### `POST /api/uploads/image`
- Body: `multipart/form-data` with `file`
- Auth: session required
- Limits:
  - 1 byte to 5 MB
  - JPEG/PNG/WebP/HEIC/HEIF only
  - MIME is validated using file-signature sniffing
- Storage target: `item-photos` bucket
- Response: `{ url, path }`

## Error patterns
- `400`: invalid payload/query values
- `401`: auth required/invalid
- `403`: invalid request origin
- `429`: rate limit exceeded (`Retry-After` header)
- `500`: env/config/db/storage failures
