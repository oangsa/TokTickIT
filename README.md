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

The scaffold is in place; Issues 2–4 are unimplemented on purpose. Each open
item is marked `TODO(Issue N)` at the exact site it belongs:

| Issue | Where |
|---|---|
| 2 — API health check | `server/src/app.ts`, `client/src/api.ts` |
| 3 — Category model + seed | `server/prisma/schema.prisma`, `server/prisma/seed.ts` |
| 4 — Category list + UI states | `server/src/app.ts`, `client/src/api.ts`, `client/src/App.tsx` |

Tests for Issues 2–4 are stubbed as `it.todo` / `describe.todo` in
`server/tests/lab-01/` and `client/tests/lab-01/`. `GET /api/health` and the
heading render test are worked examples — study them, then write the rest.

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
