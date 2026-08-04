# Lab 01 — AI Use

Record every use of an AI assistant for Lab 01 here. Do not record work that
did not happen.

## Entry 1 — Project foundation scaffolding

- **Date:** 2026-08-04
- **Tool:** Claude Code (Claude Opus 5)
- **Branch:** `feature/1-project-foundation`
- **Task given to the assistant:** Initialize the Lab 01 foundation (issue #1) —
  Vite + React + TypeScript client with Bootstrap, Express + TypeScript server,
  Prisma configured for PostgreSQL, Vitest + Supertest, `.gitignore`,
  `.env.example`, and README setup instructions.
- **What the assistant produced:**
  - `client/` scaffold (`npm create vite@latest -- --template react-ts`),
    Bootstrap installed and imported in `client/src/main.tsx`, starter demo
    content replaced by a minimal Bootstrap page in `client/src/App.tsx`.
  - `server/src/app.ts`, `server/src/server.ts`, `server/tsconfig.json`,
    `server/package.json` scripts.
  - `server/prisma/schema.prisma` and `server/prisma.config.ts` via
    `npx prisma init --datasource-provider postgresql`.
  - `server/tests/lab-01/app.test.ts` (Vitest + Supertest).
  - Root `.gitignore`, `server/.env.example`, root `README.md`.
- **What was changed or rejected:** a `GET /health` endpoint and its test were
  removed — issue #1 does not ask for any route in Lab 01.
- **Verification performed by the author:** the commands in the README were run;
  frontend build, backend type-check/build, `npm test`, `prisma generate`, and
  `prisma migrate status` against the configured PostgreSQL database all
  succeeded.

## Template for further entries

- **Date:**
- **Tool:**
- **Task given to the assistant:**
- **What the assistant produced:**
- **What was changed or rejected:**
- **Verification performed by the author:**
