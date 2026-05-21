# Authentication — Implementation Plan

Replace the mock `DEV_USER_ID` user with a real login page. Dev mode accepts
any username with the password `"password"`. The login flow is built behind a
provider abstraction so SAML SSO can be added later without reworking session
handling or route protection.

**Status:** Backlogged — not yet scheduled. Logged from a planning session on
2026-05-21.

**Hard rule:** a feature is not shippable until its BDD scenarios *and* unit
tests are implemented and passing. This plan is sequenced tests-first: feature
files and failing unit tests land before implementation.

---

## Design decisions

### Session storage: database table

Sessions are stored in a new `AuthSession` table. The cookie holds only an
opaque `cuid` (unguessable, HttpOnly) — no signing secret, no new dependency.

This was chosen over a signed cookie or `jose` JWT because it fits future SAML
SSO best: SAML Single Logout (SLO) and IdP-driven revocation require
server-side session state that can actually be deleted, and a DB row is the
natural home for IdP metadata (`SessionIndex`, `NameID`) when SAML lands.

### The SSO seam: provider abstraction

An `AuthProvider` interface is the seam that makes SAML "just work" later:
`DevAuthProvider` (real) and `SamlAuthProvider` (stub) both authenticate a user;
the login route then calls a provider-agnostic `createSession(userId)`. Adding
SAML means implementing one provider — session handling and route protection
are untouched.

### Route protection: proxy + layout guard

Next.js 16.2.6 renamed the `middleware` file convention to **`proxy`**.
`proxy.ts` does a fast *optimistic* check (is a session cookie present?);
`app/(app)/layout.tsx` plus the data-access layer do the real DB verification.
This is the documented Next.js pattern (optimistic pre-filter + verification
close to the data).

### No `User` schema change

Dev mode upserts a `User` by username (`email`/`name` from the username). The
literal `"password"` lives only in `DevAuthProvider`. No password column.

---

## Phase 0 — Tests first (BDD/TDD, red)

- `features/auth.feature` — scenarios:
  - Dev login with valid credentials succeeds.
  - Dev login rejects the wrong password.
  - Dev login rejects an empty username.
  - An unauthenticated visitor is redirected to the login page.
  - An authenticated user visiting `/` is sent to `/projects`.
  - Logging out returns to the login page.
  - SSO sign-in is shown as "coming soon" when SAML is not configured.
- `features/step_definitions/auth.steps.ts` — step definitions for the above.
- `tests/unit/auth/devProvider.test.ts` — pure: accepts any non-empty username
  with password `"password"`; rejects wrong/empty password; rejects empty
  username.
- `tests/unit/auth/config.test.ts` — pure: provider selection from
  `AUTH_PROVIDER`.
- `tests/unit/auth/session.test.ts` — DB-backed (pattern of
  `tests/unit/threads.test.ts`): `createSession` persists a row; `verifySession`
  returns the user for a valid id and `null` for an unknown/expired id;
  `destroySession` deletes the row.

## Phase 1 — Auth core (`lib/auth/`)

- `providers/types.ts` — `AuthProvider`, `AuthResult`, `AuthError`.
- `providers/dev.ts` — `DevAuthProvider`: validates `password === 'password'`
  and a non-empty username; upserts the `User`.
- `providers/saml.ts` — `SamlAuthProvider` stub: `authenticate()` throws
  `AuthError('saml_not_configured')`, with documented TODOs for SP/IdP
  metadata, the ACS endpoint, and `RelayState`.
- `config.ts` — `getAuthProvider()` / `getEnabledProviders()` from
  `AUTH_PROVIDER` (default `dev`).
- `session.ts` — `createSession(userId, provider)`, `verifySession()`,
  `destroySession()`.
- `dal.ts` — `getCurrentUser()`, React `cache`-wrapped: reads the cookie,
  queries the session, checks `expiresAt`.
- `prisma/schema.prisma` — new `AuthSession` model (`id`, `userId`, `provider`,
  `expiresAt`, `createdAt`; cascade on user). The relation field on `User` must
  be named `authSessions` to avoid colliding with the existing
  `sessions ReviewSession[]`. Generate and apply the migration.

## Phase 2 — API routes

- `app/api/auth/login/route.ts` — `POST {username,password}` (zod-validated) →
  provider → `createSession` → set HttpOnly cookie → `200`; `401` on bad
  credentials.
- `app/api/auth/logout/route.ts` — `POST` → `destroySession` + clear cookie.
- `app/api/auth/saml/login/route.ts` and `callback/route.ts` — `501 Not
  Implemented` stubs that reserve the ACS path.
- `app/api/me/route.ts` — switch from `DEV_USER_ID` to `getCurrentUser()`;
  keep the `{ userId }` response shape that `CommentPanel` already consumes.

## Phase 3 — Pages & layout refactor

- `app/layout.tsx` — slim to `html`/`body` only.
- `app/(auth)/layout.tsx` + `app/(auth)/page.tsx` — login screen at `/`: a
  server component reads enabled providers and renders a client `LoginForm`
  (username/password → `fetch` login → `router.push('/projects')`; the SSO
  button is disabled "coming soon" when SAML is off). Redirects to `/projects`
  if already authenticated.
- `app/(app)/layout.tsx` — renders `AppShell`; calls `getCurrentUser()` and
  `redirect('/')` if null (the real guard against a stale cookie).
- `git mv app/projects → app/(app)/projects` (route groups do not change URLs);
  new `app/(app)/projects/page.tsx` is the project list moved from the old
  `app/page.tsx`.
- `proxy.ts` — optimistic gate: no `session` cookie on a protected path →
  redirect `/`; cookie present on `/` → redirect `/projects`. The `matcher`
  excludes `/api`, `_next`, and static assets.
- `LogoutButton.tsx` — a small client component added to `AppShell`
  (user name + Logout).

## Phase 4 — Wire BDD + config

- `features/support/hooks.ts` — add a `Before({ tags: 'not @auth' })` hook that
  dev-logs-in via `POST /api/auth/login` so the Playwright context carries a
  session. Every existing scenario keeps passing the wall with zero per-feature
  edits; `auth.feature` is tagged `@auth` to opt out. Add stale `AuthSession`
  cleanup.
- `.env.example` — add `AUTH_PROVIDER` (optional); remove `DEV_USER_ID`.
- `.github/workflows/ci.yml` — drop the `DEV_USER_ID` plumbing from the BDD job.

## Phase 5 — Verify

`npm test` (unit green), `npm run bdd` (all scenarios green),
`npx tsc --noEmit`, and a manual browser pass: login success/failure,
logout, redirect when logged-out, redirect away from `/` when logged-in.

---

## Out of scope (follow-up)

The comment-write endpoints (`/api/comments`, etc.) still take `authorId` from
the client. With real sessions the correct hardening is to derive the author
server-side from `getCurrentUser()`. Recommended as a focused follow-up rather
than folded into this feature.
