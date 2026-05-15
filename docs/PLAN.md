# Markdown Reviewer — Plan (Phases 1–3)

This is the implementation plan captured at the start of the project. It
covers the initial vertical slice (Phases 1–3) only. Later phases — Git
sources, diff review, image region annotation, real auth, export, search —
are intentionally out of scope here and noted as "deferred" where they
intersect.

## 1. Repo summary

Green-field repo. No prior code or conventions to honor. Stack chosen per the
preferred-stack rule below.

## 2. Tech stack

- TypeScript on Node 22, Next.js 16 (App Router), React 19, Tailwind v4
- PostgreSQL 16 + Prisma 5 (dev DB runs via Docker Desktop)
- Markdown pipeline: `unified` + `remark-parse` + `remark-gfm` +
  `remark-rehype` + `rehype-sanitize` (strict allowlist) + `rehype-slug` +
  `rehype-autolink-headings` + `rehype-shiki` (server-rendered)
- Validation: `zod`
- Tests: Vitest (unit + component), Playwright (UI), Cucumber
  - Gherkin (`@cucumber/cucumber` with ts-node) for BDD
- Package manager: pnpm 11

## 3. Folder structure

```
app/
  (app)/projects/[projectId]/sources/[sourceId]/page.tsx
  api/
    projects/[projectId]/sources/[sourceId]/tree/route.ts
    projects/[projectId]/sources/[sourceId]/files/route.ts
    projects/[projectId]/sources/[sourceId]/assets/route.ts
    comment-threads/route.ts
    comment-threads/[id]/route.ts
    comments/route.ts
    files/[fileId]/comments/route.ts
  layout.tsx
  globals.css
components/
  AppShell.tsx, FileTree.tsx, MarkdownViewer.tsx,
  CommentPanel.tsx, CommentComposer.tsx, SelectionPopover.tsx
lib/
  markdown/{render,sanitizeSchema,linkResolver}.ts
  sources/{pathSafety,localSource}.ts
  anchors/textAnchor.ts
  db.ts, api/*
prisma/{schema.prisma, seed.ts, migrations/}
demo-content/                  # Phase 3 dataset
features/                      # Gherkin .feature files + steps
tests/{unit, e2e}/
docs/PLAN.md
scripts/reset-db.ts
docker-compose.yml
```

## 4. Database schema (all core entities now)

Modeled now even where Phase 1–3 doesn't write them, so later phases drop in
without migration churn:

`User`, `Project`, `Source` (type LOCAL | GIT), `SourceRevision` (deferred
behavior, modeled now), `FileEntry`, `ReviewSession`, `CommentThread`
(resolved flag + timestamps), `Comment` (author, body, timestamps),
`CommentAnchor` (rich: filePath, sourceId, revisionId, type enum, selectedText,
prefix, suffix, headingPath, charStart/End, image region coords as 0..1
normalized floats, diff side/hunkId/line range).

Phase 1–3 only writes `User`, `Project`, `Source` (LOCAL), `FileEntry`,
`ReviewSession`, `CommentThread`, `Comment`, and `CommentAnchor` rows with
`type = TEXT_SELECTION`.

See `prisma/schema.prisma` (added in Phase 2) for the full definition.

## 5. API routes (Phase 1–3)

- `GET  /api/projects/:id/sources/:sourceId/tree`
- `GET  /api/projects/:id/sources/:sourceId/files?path=…`
- `GET  /api/projects/:id/sources/:sourceId/assets?path=…`
- `POST /api/comment-threads`
- `GET  /api/files/:fileId/comments`
- `POST /api/comments`
- `PATCH /api/comment-threads/:id` (resolve / reopen)

All inputs validated by zod. Path-bearing routes go through
`lib/sources/pathSafety.assertSafe(root, requestedPath)` before any
filesystem access.

## 6. Frontend routes (Phase 1–3)

- `/` projects index (linked from the seeded project)
- `/projects/[projectId]` source picker
- `/projects/[projectId]/sources/[sourceId]?path=…` viewer page
  (tree + reader + comments)

The Phase 1 app shell is an empty three-region layout; the viewer fills it
in Phase 3.

## 7. Test setup

- **Vitest** — `vitest.config.ts`, `jsdom` for component tests, separate
  `markdown_reviewer_test` schema.
- **Playwright** — `tests/e2e/`, single browser by default.
- **Cucumber** — `.feature` files in `features/`, step definitions in
  `features/step_definitions/*.steps.ts` using `@cucumber/cucumber` with
  `ts-node`. World drives Playwright. Run via `pnpm bdd`.

## 8. Open questions (resolved)

1. Postgres availability → **Docker Desktop**, dev DB via `docker-compose.yml`.
2. Package manager → **pnpm** (installed globally via `npm i -g pnpm`).
3. BDD runner → **`@cucumber/cucumber`**.
4. Mock auth → seed one user, store id in `process.env.DEV_USER_ID`, swap the
   resolver behind real auth later without schema change.

## 9. Risks & assumptions

- **Anchor drift** when source content changes. Mitigation: anchors store
  prefix/suffix/selectedText/headingPath/charOffsets so re-anchoring degrades
  gracefully. Later phases tie anchors to `SourceRevision` for precision.
- **Sanitization vs GFM** — default `rehype-sanitize` schema strips
  `input[type=checkbox]` and table-align classes; extended explicitly, with
  unit tests against a known XSS corpus.
- **Duplicate basenames** in different folders — always resolve by full POSIX
  path, never basename.
- **Windows path separators** — POSIX internally; convert at the FS boundary.

## 10. Commit / step order

### Phase 1 — Repo setup

1. `chore: scaffold next.js + ts + tailwind` — scaffolded app, this plan,
   README, `.env.example`, Prettier config.
2. `chore: configure vitest + playwright + cucumber` — configs + one
   intentionally failing smoke per runner + scripts.
3. `feat: app shell layout` — three-region layout + Playwright smoke.

### Phase 2 — DB + models

4. `chore: add prisma + docker-compose postgres` — schema for all core
   entities; initial migration.
5. `feat: seed script` — dev user + project + local source pointing at
   `demo-content/`.
6. `feat: data helpers` — TDD `findFileByPath`, `createCommentThread`,
   `addComment`, `listThreadsForFile`, `setThreadResolved`.

### Phase 3 — Vertical slice

7. `feat: demo content` — README, nested folder, working + broken links,
   table, task list, fenced code, image, missing image, duplicate basenames.
8. `feat(server): path safety + local scanner` — TDD `pathSafety.assertSafe`
   and `localSource.scan/read`.
9. `feat(server): tree + files + assets API` — three GET endpoints.
10. `feat: markdown pipeline` — sanitize/GFM/shiki/slug/autolink.
11. `feat: viewer page` — FileTree, MarkdownViewer, TOC, link rewrite,
    graceful broken-link/missing-image.
12. `feat: text-selection anchors` — `lib/anchors/textAnchor.ts` +
    `SelectionPopover`.
13. `feat: comment threads + comments API` — POST/GET/PATCH.
14. `feat: comment panel + highlights` — right sidebar, in-doc highlights,
    resolve/reopen.
15. `test(bdd): viewer + comments scenarios` — Gherkin features for the six
    flows the prompt enumerates.

## 11. Deferred (not in this scope)

Git source support, diff review, image-region annotation, real auth beyond
the mock dev user, export/reporting, full-text search, advanced permissions.
Schema-level placeholders only.
