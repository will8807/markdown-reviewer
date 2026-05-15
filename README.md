# Markdown Reviewer

Full-stack web app for viewing, navigating, diffing, and peer-reviewing
Markdown files. Source roots can be local folders (Phase 1–3) or Git repos
(later). Users browse and render files, compare two sources, and leave
persistent peer-review comments anchored to text selections, headings, blocks,
images, and diff regions.

> **Status:** Phase 1–3 in progress. See [`docs/PLAN.md`](docs/PLAN.md).

## Stack

- TypeScript, Next.js 16 (App Router), React 19, Tailwind v4
- PostgreSQL + Prisma
- Markdown: `unified` + `remark-gfm` + `rehype-sanitize` + `rehype-shiki` +
  `rehype-slug` + `rehype-autolink-headings`
- Tests: Vitest (unit), Playwright (UI), Cucumber + Gherkin (BDD)

## Prerequisites

- Node 22+
- pnpm 11+ (`npm i -g pnpm` if not installed)
- Docker Desktop (for the dev Postgres — see `docker-compose.yml` once added in
  Phase 2)

## Local development

```bash
# 1. Install deps
pnpm install

# 2. Copy and edit env
cp .env.example .env
# (fill in DEV_USER_ID after the first seed run; see Phase 2)

# 3. Start Postgres
docker compose up -d db

# 4. Migrate + seed (added in Phase 2)
pnpm prisma migrate dev
pnpm db:seed

# 5. Run the dev server
pnpm dev
```

The app runs on http://localhost:3000.

## Tests

```bash
pnpm test         # vitest unit tests
pnpm test:e2e     # playwright UI specs
pnpm bdd          # cucumber gherkin scenarios
```

## Repo conventions

- All file paths inside the app are POSIX (`/`); Windows separators are
  normalized at the filesystem boundary.
- Markdown is **untrusted input**: never bypass the `rehype-sanitize` schema.
- No host filesystem details ever leak to the client. Source roots are
  configured server-side and every request path is validated against the
  configured root.
- TDD for backend/domain logic; BDD for user-facing flows.

See [`docs/PLAN.md`](docs/PLAN.md) for the full plan and step-by-step commit
order.
