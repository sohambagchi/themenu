# Security Guide

## Auth model
- Static credentials stored in env:
  - `DASHBOARD_USERNAME`
  - `DASHBOARD_PASSWORD`
- Session cookie:
  - Name: `themenu_dashboard_session`
  - Signed via HMAC-SHA256 using `DASHBOARD_SESSION_TOKEN`
  - TTL: 12 hours
  - Flags: `HttpOnly`, `SameSite=Strict`, `Secure` in production

## Access controls
- Read access to inventory is gated unless `DASHBOARD_PUBLIC_READ=true`.
- Mutating actions require either:
  - active dashboard session, or
  - inline credentials for specific endpoints (`/api/items`, `/api/items/consume`)

## CSRF and origin checks
- State-changing endpoints call `isAllowedRequestOrigin`.
- Requests with an `Origin` header must match request URL protocol+host.

## Rate limiting
- In-memory keyed counters in `src/lib/rateLimit.ts`.
- Current policies:
  - login: 12 attempts / 10 min (`dashboard-login`)
  - inline add auth: 20 attempts / 10 min (`inline-item-auth`)
  - inline consume auth: 20 attempts / 10 min (`inline-consume-auth`)

## File upload hardening
- Server-side size cap and MIME detection from magic bytes.
- Claimed MIME must be compatible with detected MIME.

## Response hardening headers
Defined globally in `next.config.mjs`:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(self), microphone=(), geolocation=()`
