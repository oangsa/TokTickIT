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
cp .env.example .env        # then edit DATABASE_URL
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
| 3 — Category model + seed | Open | `server/prisma/schema.prisma`, `server/prisma/seed.ts` |
| 4 — Category list + UI states | Open | `server/src/app.ts`, `client/src/api.ts`, `client/src/App.tsx` |

Each open item is marked `TODO(Issue N)` at the exact site it belongs. Tests for
Issues 3–4 are stubbed as `it.todo` / `describe.todo` in `server/tests/lab-01/`
and `client/tests/lab-01/`.

### Issue 2 — API health check

```text
GET /api/health  ->  200  {"status":"ok","service":"TokTickIT API"}
```

The client calls it from `checkSystem()` in `client/src/api.ts`; **Check System**
on the React page shows `Backend status: Online`, or `Offline` with the reason
when the request fails. Covered by `server/tests/lab-01/health.test.ts`
(Supertest). Evidence in `docs/lab-01/tests.md`.

## Repository structure

```text
toktickit/
├── client/            # React + TypeScript + Vite + Bootstrap
│   ├── src/
│   └── tests/lab-01/
├── server/
│   ├── prisma/        # schema + seed
│   ├── src/           # Express application
│   └── tests/lab-01/
├── docs/lab-01/       # ai_use.md, reviewer.md, tests.md
├── .gitignore
└── README.md
```

## Workflow

`main` / `dev` / feature branches, Pull Requests, peer review.
See `AGENTS.md` for the full project constraints.
