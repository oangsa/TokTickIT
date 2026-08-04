# TokTickIT

This project is for CPE334 Software Engineer Course Lab.

| Area | Stack |
|---|---|
| Frontend | React + TypeScript + Vite + Bootstrap (`client/`) |
| Backend | Node.js + Express + TypeScript (`server/`) |
| Database | PostgreSQL + Prisma (`server/prisma/`) |
| Testing | Vitest + Supertest (`server/tests/`) |

## Prerequisites

- Node.js 20+ and npm
- A running PostgreSQL instance

## Frontend (`client/`)

```bash
cd client
npm install
npm run dev      # dev server
npm run build    # type-check (tsc -b) + production build
npm run lint
```

## Backend (`server/`)

```bash
cd server
npm install
npm run dev        # tsx watch, http://localhost:3000
npm run build      # tsc -> dist/
npm start          # run the build
npm run typecheck  # type-checks src/ and tests/
```

Lab 01 defines no routes yet — the server only starts.

## PostgreSQL environment

`DATABASE_URL` is read from `server/.env` (loaded by `server/prisma.config.ts`).
Set `DIRECT_URL` as well when `DATABASE_URL` points at a connection pooler;
Prisma migrations use it. `.env` is git-ignored — never commit real credentials.

```bash
cd server
cp .env.example .env    # then edit DATABASE_URL
```

## Prisma

```bash
cd server
npm run prisma:generate    # generate Prisma Client
npx prisma migrate status  # non-destructive connectivity check
```

Add migrations with `npx prisma migrate dev` once the schema defines models.
Do not run `prisma migrate reset` against a database with data.

Prisma 7 needs a driver adapter at runtime — `server/src/db.ts` exports the
configured `prisma` client (`@prisma/adapter-pg` over `DATABASE_URL`). Import
that instead of constructing `PrismaClient` yourself.

## Tests

```bash
cd server
npm test          # vitest run
npm run test:watch
```

The Prisma connectivity test is skipped when `DATABASE_URL` is unset, so
`npm test` works on a fresh clone without a database.

## Repository structure

```text
toktickit/
├── client/            # React + TypeScript + Vite + Bootstrap
├── server/
│   ├── prisma/        # Prisma schema
│   ├── src/           # Express application
│   └── tests/lab-01/  # Lab 01 tests
├── docs/lab-01/       # ai_use.md, reviewer.md
├── .gitignore
└── README.md
```

## Workflow

`main` / `dev` / feature branches, Pull Requests, peer review.
See `AGENTS.md` for the full project constraints.
