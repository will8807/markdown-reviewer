# Markdown Reviewer — Plan (Phases 1–5b)

This is the implementation plan for the project. Phases 1–3 ship the
vertical slice (LOCAL source viewing + comments). Phases 4–5 add Git
sources and unified-diff review with per-line comment anchors. Phase 5b
adds visual image diffing (side-by-side + slider + pixel-diff overlay)
on the compare view. Later phases — image-region annotation (commenting
on a rectangle inside an image), real auth, export, search — remain
deferred and are noted as such where they intersect.

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

## 5. API routes

Phase 1–3 (LOCAL source viewing + comments):

- `GET  /api/projects/:id/sources/:sourceId/tree`
- `GET  /api/projects/:id/sources/:sourceId/files?path=…`
- `GET  /api/projects/:id/sources/:sourceId/assets?path=…`
- `POST /api/comment-threads`
- `GET  /api/files/:fileId/comments`
- `POST /api/comments`
- `PATCH /api/comment-threads/:id` (resolve / reopen)

Phase 4–5 (Git sources + diff review):

- `POST /api/projects/:id/sources` — register a Git source by URL
- `GET  /api/projects/:id/sources/:sourceId/refs` — list branches/tags
  with resolved SHAs
- `POST /api/projects/:id/sources/:sourceId/revisions` — upsert a
  `SourceRevision` for a given ref/SHA (idempotent)
- `GET  /api/projects/:id/sources/:sourceId/tree?ref=…`,
  `/files?ref=…&path=…`, and `/assets?ref=…&path=…` — same as Phase 3
  endpoints but revision-scoped for Git sources
- `GET  /api/projects/:id/sources/:sourceId/compare?base=…&head=…`
  — list changed files between two refs/SHAs (includes image binaries
  with `status` set; no textual hunks for images)
- `GET  /api/projects/:id/sources/:sourceId/compare/file?base=…&head=…&path=…`
  — return unified diff (parsed hunks) for a single text file
- `GET  /api/projects/:id/sources/:sourceId/compare/image?base=…&head=…&path=…`
  — return a generated pixel-diff PNG for a single image, cached on
  disk under `.data/git/<sourceId>/cache/diff/<baseSha>-<headSha>/<path>.png`
- `POST /api/comment-threads` — extended to accept anchors with
  `type=DIFF_HUNK`, `diffSide`, `lineStart`, `lineEnd`, plus base/head
  SHAs for revision-pinning

All inputs validated by zod. Path-bearing routes go through
`lib/sources/pathSafety.assertSafe(root, requestedPath)` before any
filesystem access — including paths inside the Git working directory.
Refs are resolved to SHAs before being persisted on `CommentAnchor`, so
moving branches do not silently re-anchor old threads.

## 6. Frontend routes

Phase 1–3:

- `/` projects index (linked from the seeded project)
- `/projects/[projectId]` source picker (plus "Add Git source" form in
  Phase 4)
- `/projects/[projectId]/sources/[sourceId]?path=…&ref=…` viewer page
  (tree + reader + comments). `ref` is optional and ignored for LOCAL
  sources.

Phase 4–5:

- `/projects/[projectId]/sources/[sourceId]/compare?base=…&head=…&path=…`
  compare view (changed-files list + unified diff for the active file +
  comment panel). Reuses `AppShell` so the layout matches the viewer.

The Phase 1 app shell is an empty three-region layout; the viewer fills it
in Phase 3 and the compare view fills it again in Phase 5.

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

### Phase 4 — Git source support

16. `feat(server): git provider` — wrap `simple-git`. Add
    `lib/sources/gitSource.ts` with `clone(sourceUrl)`, `listRefs()`,
    `resolveRef(ref) → sha`, `checkout(sha) → workingDir`, `readFile(sha,
    path)`. Clones land under `.data/git/<sourceId>/` (gitignored) with
    per-SHA worktrees in `.data/git/<sourceId>/worktrees/<sha>/`.
    `pathSafety.assertSafe(workingDir, requestedPath)` still gates every
    read.
17. `feat(server): refs + revisions API` —
    `GET /api/projects/:id/sources/:sourceId/refs`,
    `POST /…/revisions`. Each successful resolve upserts a
    `SourceRevision { sha }` row. Reuses `localSource.scan` against the
    checked-out working dir to populate `FileEntry` rows per revision.
18. `feat: add Git source + revision picker` — UI on
    `/projects/[projectId]` to register a Git source by URL; viewer page
    gains a ref dropdown that updates `?ref=…` and reuses the existing
    tree/reader components.
19. `test(bdd): git source scenarios` — fixture creates a local bare
    repo with known branches; scenarios cover adding the source, listing
    refs, and viewing a file at a chosen ref.

### Phase 5 — Diff review (unified, per-line anchors)

20. `feat: diff engine` — `lib/diff/computeDiff.ts`. Uses
    `git diff --no-color --unified=3 <base> <head> -- <path>` via
    `simple-git`, parsed with `parse-diff` into `{ file, hunks: [{ header,
    lines: [{ side: 'base' | 'head' | 'context', lineNumber, content }] }]
    }`. Pure module: takes a working dir + two SHAs + optional path,
    returns structured hunks. Unit-tested against fixture diffs (added,
    removed, modified, binary).
21. `feat(server): compare API` —
    `GET /…/compare?base=…&head=…` returns a list of changed files
    (`{ path, status: 'added'|'removed'|'modified'|'renamed', additions,
    deletions }`).
    `GET /…/compare/file?base=…&head=…&path=…` returns the structured
    hunks for one file. Refs are resolved to SHAs server-side before the
    diff runs; clients always see SHAs in the response.
22. `feat: compare route shell` — new page at
    `/projects/[projectId]/sources/[sourceId]/compare`. Left rail =
    changed-files list (`<DiffFileList>`); main = unified diff for the
    active file (`<UnifiedDiff>`); right = comment panel (reused). Base
    and head are URL search params; switching either reloads via
    `router.replace` and refetches.
23. `feat: unified diff renderer` — `<UnifiedDiff>` renders one row per
    diff line with `data-testid="diff-line"`, `data-side` ('base' /
    'head' / 'context'), and `data-line-number`. Hover surfaces a
    "Comment on this line" gutter button. Added/removed lines get
    semantic background classes; the row's text content is the raw line
    so existing Playwright-style selectors work.
24. `feat: per-line diff anchors` — extend the `POST /comment-threads`
    handler and `lib/anchors/*` to accept
    `{ type: 'DIFF_HUNK', filePath, diffSide, lineStart, lineEnd,
    baseSha, headSha, selectedText }`. The base+head SHAs are also
    written to `CommentAnchor.revisionId` (head side) so later
    re-anchoring has the precise revision. Reads in the compare view
    filter threads by `(filePath, baseSha, headSha)`.
25. `feat: comment indicators on diff` — each line that has at least one
    open thread gets a `data-has-comment` marker; clicking the marker
    scrolls the right-pane panel to the corresponding thread. Existing
    `CommentPanel` is reused as-is; threads on diff anchors render the
    quoted line as `selectedText`.
26. `test(bdd): diff scenarios` — Gherkin feature covering compare-view
    listing, unified-diff rendering for added / removed / modified
    files, per-line commenting, persistence of diff threads across page
    reloads, and ref-switching behavior.

### Phase 5b — Visual image diff

Visual deltas only — pixel-level comparison so reviewers can see what
changed. No metadata surfacing (dimensions, EXIF, filesize), and no
region-level annotation (still deferred). Comments on image diffs are
out of scope for 5b; they arrive with the broader image-region
annotation phase.

27. `feat(server): asset endpoint takes ref` — extend
    `GET /api/projects/:id/sources/:sourceId/assets` with an optional
    `?ref=…` param. Resolves ref → SHA via the Git provider and reads
    the file from the per-SHA worktree. `pathSafety.assertSafe` still
    gates the read. LOCAL sources ignore `ref`. Image MIME type is
    inferred from extension; the server never trusts a client-supplied
    content type.
28. `feat: image diff renderer` — `<ImageDiff>` component. The compare
    page's main pane picks `<ImageDiff>` over `<UnifiedDiff>` when the
    changed file's extension is in the image allowlist (`.png`, `.jpg`,
    `.jpeg`, `.gif`, `.webp`, `.svg`). Modes (toggle in the local
    toolbar): **side-by-side** (default), **slider** (swipe overlay
    with a draggable divider), **onion-skin** (head fades over base
    with an opacity slider). Added files show only head; removed
    files show only base. `data-testid="image-diff"` and `data-mode`
    drive BDD assertions.
29. `feat: pixel-diff overlay` —
    `GET /…/compare/image?base=…&head=…&path=…` renders a diff PNG
    server-side using `pixelmatch` over `pngjs`-decoded buffers (SVGs
    are rasterized first via `sharp` so the renderer is uniform).
    Output is cached on disk by `(baseSha, headSha, path)` and served
    with a long max-age. `<ImageDiff>` gains a "Pixel diff" toggle
    that overlays the generated PNG on the head image.
30. `feat: changed-files list shows image previews` — image rows in the
    left rail show a small `head`-side thumbnail (and a tiny base
    thumbnail for modified, with an `→` between them) so reviewers can
    triage without opening every file. Falls back to a generic icon for
    formats `sharp` can't decode.
31. `test(bdd): image diff scenarios` — Gherkin feature covering
    modified / added / removed images, mode switching (side-by-side /
    slider / onion-skin), pixel-diff toggle, SVG handling, and the
    case where one side is missing.

## 11. Deferred (not in this scope)

Image-region annotation (commenting on a rectangle inside an image,
including image-diff comments), real auth beyond the mock dev user,
export/reporting, full-text search, advanced permissions, side-by-side
text-diff layout, anchor re-mapping when a thread's head SHA falls
behind the current head, image *metadata* surfacing (dimensions, EXIF,
filesize) in the diff UI. Schema-level placeholders for these remain.
