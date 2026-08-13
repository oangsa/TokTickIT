# TokTickIT

CPE334 Software Engineering — Lab 1.

| Area | Stack |
|---|---|
| Frontend | React + TypeScript + Vite + Bootstrap (`client/`) |
| Backend | Node.js + Express + TypeScript (`server/`) |
| Database | PostgreSQL + Prisma (`server/prisma/`) |
| Testing | Vitest + Supertest |

## Prerequisites

- Node.js 20+ and npm
- A running PostgreSQL instance

## Backend (`server/`)

```bash
cd server
npm install
cp .env.example .env        # then edit DATABASE_URL and DIRECT_URL
npm run prisma:migrate      # prisma migrate dev
npm run prisma:seed         # tsx prisma/seed.ts
npm run dev                 # http://localhost:3000
npm test                    # vitest run
```

## Frontend (`client/`)

```bash
cd client
npm install
cp .env.example .env        # VITE_API_URL, defaults to http://localhost:3000
npm run dev                 # http://localhost:5173
npm test                    # vitest run
```

## Lab 1 status

| Issue | Status | Where |
|---|---|---|
| 2 — API health check | Done | `server/src/app.ts`, `client/src/api.ts`, `client/src/App.tsx` |
| 3 — Category model + seed | Done | `server/prisma/schema.prisma`, `server/prisma/migrations/`, `server/prisma/seed.ts` |
| 4 — Category list + UI states | Done | `server/src/app.ts`, `client/src/api.ts`, `client/src/App.tsx` |

### Issue 2 — API health check

```text
GET /api/health  ->  200  {"status":"ok","service":"TokTickIT API"}
```

The client calls it from `checkSystem()` in `client/src/api.ts`; **Check System**
on the React page shows `Backend status: Online`, or `Offline` with the reason
when the request fails. Covered by `server/tests/lab-01/health.test.ts`
(Supertest). Evidence in `docs/lab-01/tests.md`.

### Issue 3 — Category model + seed

`Category` (`id`, unique `name`, `createdAt`) lives in `server/prisma/schema.prisma`
and is created by migration `20260808064543_add_category`. `npm run prisma:seed`
upserts the four categories on the unique `name`, so re-running it never
duplicates rows:

```text
Account and Access, Hardware, Software, Network
```

`DIRECT_URL` in `.env` is the non-pooled connection `prisma migrate` uses; on a
plain local PostgreSQL it is the same value as `DATABASE_URL`. Prisma 7 reads it
from `server/prisma.config.ts` rather than from `schema.prisma`, and the running
app connects separately through the `@prisma/adapter-pg` driver adapter in
`server/src/prisma.ts`. Real credentials stay out of git — only `.env.example` is
tracked. Evidence in `docs/lab-01/tests.md`.

### Issue 4 — Category list + UI states

```text
GET /api/categories  ->  200  [{"id":1,"name":"Account and Access"}, …]
```

The route reads the table with `prisma.category.findMany` and returns `{ id, name }`
ordered by `id`, so the list is stable between calls; a database failure answers
`500 {"error":"Could not load categories."}` and keeps the details in the server
log. `checkSystem()` fetches it after the health check, and **Check System**
renders the returned names as a Bootstrap list group under the Online alert —
`Loading…` on the disabled button while the two requests are in flight,
`No categories yet.` when the table is empty, and the Offline alert with no list
when either request fails. Covered by
`server/tests/lab-01/categories.test.ts` (Supertest, needs a seeded database) and
four cases in `client/tests/lab-01/App.test.tsx` (Vitest). Evidence in
`docs/lab-01/tests.md`.

## Repository structure

```text
toktickit/
├── client/            # React + TypeScript + Vite + Bootstrap
│   ├── src/
│   └── tests/lab-01/
├── server/
│   ├── prisma.config.ts  # Prisma 7 config: schema path, seed, migrate URL
│   ├── prisma/        # schema + migrations + seed
│   ├── src/           # Express application
│   └── tests/lab-01/
├── docs/lab-01/       # ai_use.md, reviewer.md, tests.md
├── .gitignore
└── README.md
```

## Workflow

`main` / `dev` / feature branches, Pull Requests, peer review.
See `AGENTS.md` for the full project constraints.
