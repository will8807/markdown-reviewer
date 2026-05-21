# Comment Workflows — Implementation Plan

Status workflow, filtering, sorting, and replies for review comments.

**Hard rule:** a feature is not shippable until its BDD scenarios *and* unit
tests are implemented and passing. Part 0 (green CI) is a prerequisite for
everything else — new BDD scenarios must land on a green baseline so a
regression is distinguishable from pre-existing breakage.

---

## Part 0 — Triage & fix the failing CI suite (prerequisite)

### Current state (CI run 26067415964, `main`)

- **Unit Tests job: green** (28s).
- **BDD Tests job: red** — 16 of 37 scenarios fail, 15m24s (inflated by 3×
  retries on every failing scenario).

### Root Cause A — SQLite write-lock contention (primary; ~15/16 failures)

**Diagnosis.** The BDD job runs two processes against the *same* SQLite file
`prisma/bdd.db`: the Next.js server (`pnpm start`) and the Cucumber process
(step definitions use the `prisma` client directly for setup/teardown). SQLite
permits a single writer; when both processes write concurrently, one errors:

```
PrismaClientKnownRequestError:
Invalid `prisma.commentThread.deleteMany()` invocation ... Operation has timed out
  at features/step_definitions/comments.steps.ts:12   (the After hook)
```

`lib/db.ts` sets `PRAGMA busy_timeout=10000` fire-and-forget via
`client.$executeRawUnsafe(...)`. `busy_timeout` is **per-connection**; with the
libsql adapter's connection pool it is not guaranteed to apply to every
connection, so a write on an un-pragma'd connection fails immediately instead
of waiting.

**Why it cascades.** The failure surfaces in `After` hooks. A failed `After`
skips teardown → stale rows (`docs-repo` Git source, comment threads) leak into
the next scenario. Cucumber's CI profile then retries; retries run against
polluted state and fail differently — diff panels never render, the ref picker
(`[data-testid="ref-select"]`) never appears, the file tree is empty. The CI
log confirms attempt 1 of "Commenting on a removed line" passes *every test
step* and only the `After` hook fails; attempts 2–3 then fail on the dirty
state. 25 distinct timeout errors across the run.

**Fix direction** (apply in order; stop when the BDD job is green 3 runs
running):

1. **Reliably apply pragmas to every connection.** Ensure both
   `journal_mode=WAL` and `busy_timeout` are set on *each* libsql connection,
   not once on a single pooled connection. Investigate `PrismaLibSql`
   connection-init options; if none exist, construct the libsql client so the
   pragma runs on connect. Raise `busy_timeout` to 30s — 10s is too low under
   CI load.
2. **Clean before, not after.** Move per-scenario cleanup from `After` hooks
   into `Before`/`BeforeAll`. A failed teardown currently leaks state; cleaning
   at the *start* of each scenario makes every run self-correcting regardless
   of how the previous one ended. Make setup steps `upsert` rather than
   `create` so a pre-existing row is tolerated.
3. **If still flaky, move the BDD job's DB to Postgres.** The documented stack
   (`README.md`) is "PostgreSQL + Prisma"; the schema was later switched to
   `provider = "sqlite"`. Postgres handles concurrent multi-process writes
   natively and removes the contention class entirely. Cost: a Postgres
   service container in `ci.yml`, `provider = "postgresql"`, and a migration
   re-baseline.

**Verification.** BDD job green on 3 consecutive runs (the bug is timing-
dependent — a single green run is not proof). Locally: start the server
against a shared `bdd.db` and run `pnpm bdd` concurrently to reproduce before
fixing.

### Root Cause B — path-safety route can be masked by a 404 (hardening)

**Diagnosis.** Scenario "the response is a 400 with a path-safety error"
expects 400 for `../../../etc/passwd`, gets 404. In
`app/api/projects/[projectId]/sources/[sourceId]/files/route.ts` the source DB
lookup (returns 404 when not found) runs **before** the `assertSafe` path
check (returns 400). `assertSafe` itself is correct — verified it throws for
that input — so the 404 means the route's `source.findFirst` returned null.
That is most likely a second-order symptom of Root Cause A (duplicate/stale
source rows, or cross-process read lag under contention).

**Fix direction.** Primarily resolved by fixing Root Cause A. Independently,
harden the route as defense-in-depth: run `assertSafe` on the requested path
immediately after query parsing, **before** the DB lookup, so path validation
can never be masked by an unrelated 404. Add a unit test covering
"traversal path → 400 regardless of source existence". Minor follow-up: GIT
traversal returns 400 while LOCAL traversal returns 403 — unify to 400.

### Root Cause C — CSS parse warnings (benign; low priority)

`Parsing CSS source code failed` on `::highlight(comment-thread)` rules. The
CSS Custom Highlight API pseudo-element is unrecognised by the parser in the
build/test pipeline. These are warnings, not test failures. Not a ship
blocker; address only as cleanup.

### Part 0 exit criteria

- BDD Tests job green 3 consecutive runs.
- Unit Tests job still green.
- No `After`-hook teardown failures in the logs.

---

## Design decisions (carried into Parts 1–4)

- **Status is thread-level.** A `CommentThread` is one review item anchored to
  a location; `resolved` is already thread-level. Lifecycle:
  `OPEN → ACCEPTED | REJECTED | DISCUSS → resolved`. `resolved` stays a
  separate boolean, unchanged.
- **Filter by user = participant**: threads where the user authored ≥1
  comment. No schema change; the user list is derived from authors present in
  the loaded threads.
- **Filtering & sorting are client-side** transforms in `CommentPanel` — all
  threads for a file/diff are already loaded into state. The transform logic
  is extracted into pure, unit-tested functions.
- **Reply already has backend support** (`POST /api/comments` → `addComment`).
  It is a UI-only addition.

The only schema change in the whole plan is adding `status`.

---

## Feature 1 — Thread status (Accepted / Rejected / Discuss)

### 1a. Schema + migration

- `prisma/schema.prisma`: add `enum ThreadStatus { OPEN ACCEPTED REJECTED DISCUSS }`;
  add `status ThreadStatus @default(OPEN)` to `CommentThread`.
- `pnpm prisma migrate dev --name add_thread_status` — the default backfills
  existing rows to `OPEN`.

### 1b. Domain + unit tests (TDD)

- `lib/api/threads.ts`: add `setThreadStatus(threadId, status)`. Existing
  `findMany` includes already return all scalar fields, so `status` flows into
  GET responses with no query change.
- `tests/unit/threads.test.ts`: new `describe('setThreadStatus')` — sets each
  value; new threads default to `OPEN`; throws on unknown id.

### 1c. API

- Extend `PATCH /api/comment-threads/[id]` zod schema to
  `{ resolved?: boolean, status?: ThreadStatus }` (at least one required).
  Route updates whichever field is present. Route stays thin — covered by the
  domain unit tests and BDD.

### 1d. UI

- Frontend `Thread` type: add `status`.
- `CommentPanel` thread card: status control (Accepted / Rejected / Discuss
  buttons) + a colour-coded badge for the current status. Click → `PATCH` →
  refresh.

### 1e. BDD

- `features/comments.feature`: "Marking a thread as Accepted" — open a thread,
  click Accepted, assert the badge, assert it persists after reload. Steps in
  `comments.steps.ts`.

**Ship gate:** 1b + 1e green.

---

## Feature 2 — Reply to a comment

### 2a. Domain

None — `addComment` exists and is unit-tested.

### 2b. UI

- `CommentPanel`: per-thread reply composer (textarea + "Reply"), shown on the
  active/expanded thread. Submits `POST /api/comments` with the dev `authorId`
  (already loaded via `/api/me`), then refreshes.

### 2c. BDD

- "Replying to an existing thread" — existing thread, type a reply, submit,
  assert the new comment appears in the thread card.

**Ship gate:** existing `addComment` unit tests + 2c green.

---

## Feature 3 — Filter by status and by user

### 3a. Pure logic + unit tests (TDD)

- New `lib/comments/threadFilters.ts`: `filterThreads(threads, { status?, authorId? })`.
  Status values: `all | open | accepted | rejected | discuss | resolved`
  (`resolved` keys off the boolean). User: thread kept if any comment author
  id matches.
- `tests/unit/threadFilters.test.ts` — pure, no DB.

### 3b. UI

- `CommentPanel` toolbar: status filter (pill buttons) + user filter (select;
  options = distinct comment authors across loaded threads). Apply
  `filterThreads` before render. Frontend `CommentAuthor` type gains `id`
  (the API already returns it).

### 3c. BDD

- "Filter comments by status", "Filter comments by user".

**Ship gate:** 3a + 3c green.

---

## Feature 4 — Sort by date

### 4a. Pure logic + unit tests (TDD)

- Add `sortThreads(threads, 'asc' | 'desc')` to `lib/comments/threadFilters.ts`,
  sorting by `createdAt`. Unit tests for both directions and stability.

### 4b. UI

- `CommentPanel` toolbar: Newest / Oldest toggle.

### 4c. BDD

- "Sort comments by date".

**Ship gate:** 4a + 4c green.

---

## Commit order

0. **Part 0** — fix the BDD suite (Root Cause A, then B). Must be green first.
1. Feature 1 — thread status.
2. Feature 2 — reply.
3. Feature 3 — filter.
4. Feature 4 — sort.

Each of 1–4 is an independent commit that must pass its own TDD + BDD gate
before the next begins.
