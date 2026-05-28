# Postgres + Keycloak Authentication Plan

Migrate the app from SQLite/libSQL to Postgres and replace `DEV_USER_ID` with
the current user supplied by an upstream Keycloak/SSO layer. This plan assumes
the app itself does not own login, callback, password, token exchange, or local
session creation. Instead, a trusted reverse proxy, ingress, or platform layer
authenticates the request and injects identity headers.

This plan supersedes the older dev-login/SAML-oriented notes in
`docs/AUTH_PLAN.md`.

Status: proposed.

## Goals

- Use Postgres for local dev, tests, CI, and production.
- Remove libSQL/Turso-specific adapters, PRAGMA setup, and SQLite migration
  assumptions.
- Read the current signed-in user from trusted request headers set by the SSO
  layer.
- Keep Keycloak and browser session handling outside this app.
- Stop trusting client-provided `authorId`; derive authorship from the
  authenticated request identity.
- Keep existing BDD and unit coverage green throughout the migration.

## Non-Goals

- Do not build password auth, OAuth callback routes, token storage, refresh
  handling, or logout orchestration in this app.
- Do not implement SAML or OIDC directly in the app.
- Do not build project-level authorization/roles in the first pass, beyond
  basic "authenticated user can access the app".
- Do not migrate existing production data until the schema and auth flow are
  proven locally and in CI.

## Phase 0 - Decisions And Prep

- Confirm deployment shape:
  - Postgres provider: Docker local, managed production DB, and CI service DB.
  - Which upstream component enforces Keycloak login: ingress, oauth2-proxy,
    Keycloak adapter, API gateway, or hosting platform.
  - Which headers it forwards for the authenticated user.
  - Whether unauthenticated requests reach the app at all, or arrive without
    identity headers.
- Recommended identity contract:
  - `X-Forwarded-User`: stable Keycloak subject, preferred unique identifier.
  - `X-Forwarded-Email`: user email.
  - `X-Forwarded-Name`: display name.
  - Optional `X-Forwarded-Groups`: comma-separated groups for future authz.
- Add an allowlist for trusted proxy IPs or rely on network topology so clients
  cannot forge identity headers directly.
- Add an ADR documenting:
  - Postgres as the only Prisma provider.
  - Keycloak/SSO as an upstream concern.
  - Header-derived identity as the app boundary.

## Phase 1 - Postgres Migration

- Update dependencies:
  - Remove `@libsql/client` and `@prisma/adapter-libsql`.
  - Add the Prisma Postgres driver/adapter required by the current Prisma
    version, or use Prisma's default Postgres connection path if supported.
- Update `prisma/schema.prisma`:
  - Change `datasource db` provider from `sqlite` to `postgresql`.
  - Add explicit `url = env("DATABASE_URL")` if required by the chosen Prisma
    setup.
  - Review indexes for high-traffic lookups:
    - `Source.projectId`
    - `FileEntry.sourceId,path` already unique.
    - `CommentThread.sourceId,fileId,updatedAt`
    - `Comment.threadId,createdAt`
    - `Comment.authorId`
- Replace `lib/db.ts`:
  - Remove PRAGMA/WAL/busy timeout code.
  - Initialize a normal Prisma client with the existing global singleton
    pattern.
  - Keep query logging behavior for development.
- Replace `prisma/seed.ts`:
  - Remove libSQL adapter setup.
  - Keep the demo project/source/user seed, but stop printing `DEV_USER_ID`
    once auth lands.
- Regenerate migrations:
  - Because Prisma migrations are provider-specific, create a clean Postgres
    baseline migration.
  - Preserve existing model names and IDs so tests and route assumptions do not
    churn.
- Update config:
  - `docker-compose.yml` should provide Postgres.
  - `.env.example` should show Postgres `DATABASE_URL` and
    `DATABASE_URL_TEST`.
  - CI should run `prisma migrate deploy` against Postgres.
- Verification:
  - `npx prisma validate`
  - `npx prisma migrate reset && npm run db:seed`
  - DB-backed unit tests.
  - Existing BDD suite against Postgres.

## Phase 2 - User Identity Schema

- Extend Prisma with upstream identity data:
  - `User.externalSubject String? @unique`
  - `User.emailVerified Boolean @default(false)` only if the upstream exposes
    this and the UI needs it.
  - `User.lastLoginAt DateTime?`
- Keep existing `ReviewSession` separate. Rename only in a later cleanup if it
  becomes confusing; avoid broad schema churn now.
- Add tests for upserting and resolving users from trusted identity headers.

## Phase 3 - Current User Core

Add `lib/auth/` as a very small boundary:

- `identity.ts`:
  - Reads request headers using Next's server APIs.
  - Validates the required subject/email headers.
  - Normalizes name/email/groups.
  - Returns `null` if no authenticated identity is present.
- `users.ts`:
  - Upserts `User` by `externalSubject`.
  - Falls back to email only during a controlled migration window, if needed.
  - Updates `name`, `email`, and `lastLoginAt` on each authenticated request.
- `dal.ts`:
  - `getCurrentUser()` for server components and route handlers.
  - React `cache` wrapped so a request upserts/loads the user once.
- `errors.ts`:
  - typed unauthenticated/invalid-header errors for route handlers.

Security rules:

- Never accept identity from client-side JavaScript payloads.
- Only trust headers when the app is deployed behind the trusted SSO layer.
- In local dev, allow a clearly named override such as `DEV_AUTH_EMAIL` or a
  `x-dev-user` header only when `NODE_ENV !== "production"`.

## Phase 4 - Routes And UI

- Update auth-adjacent routes:
  - `GET /api/me`: return authenticated user data from `getCurrentUser()`.
  - Optional `GET /api/auth/login`: redirect to a configurable upstream SSO
    start URL, if the proxy/platform exposes one.
  - Optional `POST /api/auth/logout`: redirect to a configurable upstream logout
    URL, if the proxy/platform exposes one. Otherwise omit logout from the app.
- Route protection:
  - If unauthenticated requests can reach the app, `proxy.ts` or protected
    layouts should redirect to the upstream login URL when identity headers are
    missing.
  - If the upstream blocks unauthenticated traffic, app-level guards can simply
    render a clear "authentication headers missing" error for misconfiguration.
  - Mutation routes must call `getCurrentUser()` and reject missing identity.
- UI:
  - Logged-out `/` page is only needed if unauthenticated traffic reaches the
    app.
  - Authenticated users land on the current source/project landing experience.
  - Top bar shows user name/email.
  - Logout button is shown only if an upstream logout URL is configured.

## Phase 5 - Remove DEV_USER_ID And Trust Boundaries

- Replace `process.env.DEV_USER_ID` usage in:
  - `app/page.tsx`
  - `app/api/me/route.ts`
  - comment/activity components that depend on `/api/me`.
- Harden write endpoints:
  - `/api/comments`: ignore client `authorId`; use `getCurrentUser().id`.
  - `/api/comments/[commentId]`: only the authenticated author can edit.
  - comment-thread mutations: require authenticated user.
  - compare thread/comment routes: require authenticated user.
- Update client payloads to stop sending `authorId`.
- Keep response shapes stable where possible so UI churn stays small.

## Phase 6 - Tests First Coverage

- Unit tests:
  - Postgres Prisma client config does not use libSQL.
  - Header identity normalization handles valid and missing headers.
  - User upsert maps upstream subject/email/name to `User`.
  - Comment routes derive author from `getCurrentUser()`.
- BDD scenarios:
  - Request with trusted user headers shows that user in the top bar.
  - Missing identity headers are rejected or redirected, depending on deployment
    decision.
  - Existing viewer/comment flows run while authenticated.
  - Editing someone else's comment is rejected.
- Test harness:
  - For most BDD scenarios, inject test identity headers into the Playwright
    browser context.
  - Keep one or two smoke scenarios around missing/invalid identity headers.

## Phase 7 - Data Migration Strategy

- For dev/test:
  - Reset and reseed Postgres.
- For any existing SQLite data that must be preserved:
  - Freeze writes.
  - Export SQLite rows in dependency order.
  - Import into Postgres with IDs preserved.
  - Validate counts and foreign keys.
  - Run smoke tests against migrated data.
- Add a one-off migration script only if real data exists. If not, prefer a
  clean Postgres seed.

## Phase 8 - Deployment

- Add required env vars:
  - `DATABASE_URL`
  - `AUTH_TRUSTED_HEADER_SUBJECT`
  - `AUTH_TRUSTED_HEADER_EMAIL`
  - `AUTH_TRUSTED_HEADER_NAME`
  - optional `AUTH_LOGIN_URL`
  - optional `AUTH_LOGOUT_URL`
- Keycloak/upstream setup:
  - Keycloak remains configured outside the app.
  - The proxy/ingress must enforce authentication before forwarding protected
    routes.
  - The proxy/ingress must strip incoming identity headers from the client and
    set its own trusted identity headers.
- Production checklist:
  - `prisma migrate deploy`
  - health check can reach Postgres.
  - request through SSO reaches app with identity headers.
  - direct request without trusted headers is blocked by network/proxy or app
    guard.
  - mutation routes reject logged-out requests.

## Suggested Work Breakdown

1. Postgres infrastructure and Prisma conversion.
2. User identity schema and header parsing primitives.
3. Current-user DAL and `/api/me`.
4. App route protection and UI wiring.
5. Comment author hardening.
6. BDD/CI updates.
7. Production migration/deployment checklist.

## Open Questions

- Is there existing SQLite data that must be migrated, or can Postgres start
  from a fresh seed?
- Which upstream component will authenticate against Keycloak and inject the
  identity headers?
- What exact header names will it provide?
- Should local development use injected dev headers, a local SSO proxy, or both?
- Do we need role/group mapping from Keycloak now, or only authentication?
- Should the app expose a logout link, and if so, what upstream logout URL
  should it use?
- What should happen if the upstream email changes for an existing subject?
