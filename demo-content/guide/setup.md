# Setup Guide

## Prerequisites

| Tool        | Minimum version | Notes                         |
| ----------- | --------------- | ----------------------------- |
| Node.js     | 22              | Required for native TS strips |
| pnpm        | 11              | Install via `npm i -g pnpm`   |
| Docker      | 24              | Runs the Postgres container   |
| PostgreSQL  | 16 (via Docker) | `docker-compose up -d`        |

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Copy environment config
cp .env.example .env
# Edit .env — fill in DATABASE_URL

# 3. Start the database
docker-compose up -d

# 4. Run migrations and seed
pnpm prisma migrate deploy
pnpm db:seed

# 5. Start the dev server
pnpm dev
```

## Environment Variables

| Variable          | Description                              |
| ----------------- | ---------------------------------------- |
| `DATABASE_URL`    | Postgres connection string (dev)         |
| `DATABASE_URL_TEST` | Separate test schema connection string |
| `DEV_USER_ID`     | Printed by the seed script; paste here  |

## Task Checklist

- [ ] Docker running
- [ ] `.env` populated
- [ ] `pnpm db:seed` completed — copy the printed `DEV_USER_ID`
- [ ] App loads at http://localhost:3000

## Related

- [Back to Guide](README.md)
- [Advanced Topics](../advanced.md)
- [Broken cross-folder link](../nonexistent-in-root.md)
