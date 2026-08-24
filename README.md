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

The backend also reads two Lab 2 variables from `.env`:

- `CORS_ALLOWED_ORIGINS` — a comma-separated list of **exact** origins (no
  wildcard). The dev default is `http://localhost:5173`.
- `NODE_ENV` — `development`, `test`, or `production`.

A missing or invalid `CORS_ALLOWED_ORIGINS` allowlist fails startup outside
`development` and `test`, so a production boot cannot start with a wildcard or
an empty allowlist.

## Frontend (`client/`)

```bash
cd client
npm install
cp .env.example .env        # VITE_API_URL, defaults to http://localhost:3000
npm run dev                 # http://localhost:5173
npm test                    # vitest run
```

### Lab 2 client

Run `npm install` in `client/` after pulling: Lab 2 adds `react-router-dom`
for routing and `@fontsource/inter` for the required typeface. Bootstrap
remains the only UI library.

| Route | Screen |
|---|---|
| `/` | Redirects to `/requesters` or `/tickets` depending on the stored Requester |
| `/requesters` | Development Requester Selection — loads active Requesters from `GET /api/requesters`, stores the choice in `sessionStorage`, and navigates to `/tickets` |
| `/tickets` | My Tickets (placeholder until Issue 22) |
| `/tickets/new` | Create Ticket (placeholder until Issue 21) |
| `/tickets/:publicId` | Requester Ticket Detail (placeholder until Issue 23) |
| `/error` | Standalone global error page |

The selected Requester is kept in `sessionStorage` as a Lab 2 testing
mechanism; it is not authentication. The Requester Selection screen at
`/requesters` loads the active Development Requesters from
`GET /api/requesters`, stores the choice in `sessionStorage`, and navigates to
`/tickets`, so the requester routes are now reachable through the UI. The
application is drivable end to end up to the screens still owned by Issues
#21, #22, and #23 (Create Ticket, My Tickets, and Ticket Detail remain
placeholders).

## Lab 2 status

| Issue | Status | Where |
|---|---|---|
| 18 — Data model + forward migration + seed | Done | `server/prisma/schema.prisma`, `server/prisma/migrations/`, `server/prisma/seed.ts` |
| 19 — Zen Green shell + UI foundation | Done | `client/src/`, `client/src/components/`, `client/src/requester/` |
| 20 — Requester context + selector | Done | `server/src/middleware/`, `server/src/routes/referenceData.ts`, `client/src/pages/RequesterSelection.tsx`, `client/src/requester/useRequesterApi.ts` |

### Issue 20 — Requester context + selector

`GET /api/requesters` is a new endpoint that returns the full
`DevelopmentRequesterDTO` for active, non-deleted Requesters only. It is the
one Lab 2 endpoint exempt from the requester guard, along with `GET
/api/health`. Every other `/api` route now requires a valid `X-Requester-Id`
header: a missing, malformed, non-positive, unknown, inactive, or deleted
context is rejected with a safe `400` whose `details` name the `X-Requester-Id`
field. The client treats that exact marker as the signal to clear its stored
context and redirect to `/requesters`.

`GET /api/categories` is now guarded under Lab 2 (its Lab 1 `{ id, name }` body
is unchanged). The unrouted Lab 1 `SystemCheck` page is unaffected because it
is not reachable through the Lab 2 router, so its `checkSystem()` call to
`/api/categories` is not exercised by any routed screen.

CORS is configured from `CORS_ALLOWED_ORIGINS` (a comma-separated list of exact
origins; no wildcard) and `NODE_ENV`. A missing or invalid allowlist fails
startup outside `development` and `test`. **CORS origin restriction is browser
hardening — not authentication, authorization, or a privacy boundary.** The
unauthenticated Lab 2 application is restricted to development/test networks
and must not be described as safe for public deployment (AC-50, part of the
DATA-09 evidence).

`client/src/components/` holds the shared conventions Issue 19 established —
form field, button hierarchy, badge, skeleton, empty/error/success state,
modal, pagination, filter chip, and Attachment lifecycle state. They are
covered by `client/tests/lab-02/SharedComponents.test.tsx`; Requester Selection
is the first screen to consume them, and the rest arrive with Issues 21–23.

## Lab 1 status

| Issue | Status | Where |
|---|---|---|
| 2 — API health check | Done | `server/src/app.ts`, `client/src/api.ts`, `client/src/pages/SystemCheck.tsx` |
| 3 — Category model + seed | Done | `server/prisma/schema.prisma`, `server/prisma/migrations/`, `server/prisma/seed.ts` |
| 4 — Category list + UI states | Done | `server/src/app.ts`, `client/src/api.ts`, `client/src/pages/SystemCheck.tsx` |

### Issue 2 — API health check

```text
GET /api/health  ->  200  {"status":"ok","service":"TokTickIT API"}
```

The client calls it from `checkSystem()` in `client/src/api.ts`; **Check System**
shows `Backend status: Online`, or `Backend status: Offline` when the request
fails. Since the Lab 2 shell landed, this screen lives in
`client/src/pages/SystemCheck.tsx` and is no longer the application's landing
route; its Lab 1 tests continue to exercise it directly. Covered by `server/tests/lab-01/health.test.ts`
(Supertest). Evidence in `docs/lab-01/tests.md`.

### Issue 3 — Category model + seed

`Category` (`id`, unique `name`, `isActive`, `deleted`, `createdBy`, `createdAt`,
`updatedBy`, `updatedAt`) lives in `server/prisma/schema.prisma`. The Lab 1
`20260808064543_add_category` migration creates the initial table; the forward
Lab 2 migration `20260822000000_lab2_data_model` alters that table in place and
preserves existing identities and creation timestamps. `npm run prisma:seed`
upserts the four categories on the unique `name`, so re-running it never
duplicates rows or changes audit timestamps:

```text
Account and Access, Hardware, Software, Network
```

`DIRECT_URL` in `.env` is the non-pooled connection `prisma migrate` uses; on a
plain local PostgreSQL it is the same value as `DATABASE_URL`. Prisma 7 reads it
from `server/prisma.config.ts` rather than from `schema.prisma`, and the running
app connects separately through the `@prisma/adapter-pg` driver adapter in
`server/src/prisma.ts`. Real credentials stay out of git — only `.env.example` is
tracked. Evidence in `docs/lab-01/tests.md`.

### Lab 2 PostgreSQL integration tests

The Lab 2 persistence suites use only a disposable PostgreSQL target. They
never fall back to the normal development `DATABASE_URL`, and their guard
requires `NODE_ENV=test`, a PostgreSQL `TEST_DATABASE_URL`, and an explicit
test marker in the target database name.

From `server/`, start the disposable target with a local-only synthetic password
without committing it to an environment file:

```bash
export LAB2_TEST_DB_PASSWORD='<PASSWORD>'
docker compose -f tests/lab-02/postgres/docker-compose.test.yml up -d --wait
export NODE_ENV=test
export TEST_DATABASE_URL="postgresql://lab2_test:${LAB2_TEST_DB_PASSWORD}@localhost:55432/toktickit_lab2_test"
DATABASE_URL="$TEST_DATABASE_URL" DIRECT_URL="$TEST_DATABASE_URL" npx prisma migrate deploy
DATABASE_URL="$TEST_DATABASE_URL" DIRECT_URL="$TEST_DATABASE_URL" npm run prisma:seed
DATABASE_URL="$TEST_DATABASE_URL" DIRECT_URL="$TEST_DATABASE_URL" npm test -- tests/lab-01/categories.test.ts tests/lab-01/health.test.ts
npm test -- tests/lab-02/postgres/migration-upgrade.postgres.test.ts tests/lab-02/postgres/transactions.postgres.test.ts tests/lab-02/postgres/idempotency.postgres.test.ts
docker compose -f tests/lab-02/postgres/docker-compose.test.yml down -v
```

The migration suite covers both fresh reproduction and populated-Lab-1
preservation; the seed is safe to rerun against the disposable target. The Lab 1
regressions run immediately after the clean migration and seed, before the Lab 2
PostgreSQL suites reset the disposable target. Teardown is last so every command
uses the same guarded database while the normal development database remains
untouched.

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
when either request fails. Both fetches carry `AbortSignal.timeout(8000)`: a
backend that refuses the connection fails fast on its own, but one that accepts
the socket and never answers would otherwise leave the button on `Loading…`
indefinitely. Covered by `server/tests/lab-01/categories.test.ts` (Supertest,
needs a seeded database), four cases in `client/tests/lab-01/App.test.tsx` and
the timeout case in `client/tests/lab-01/api.test.tsx` (Vitest). Evidence in
`docs/lab-01/tests.md`.

## Repository structure

```text
toktickit/
├── client/            # React + TypeScript + Vite + Bootstrap
│   ├── src/
│   │   ├── components/   # shared UI components
│   │   ├── pages/        # routed screens
│   │   ├── requester/    # Lab 2 requester context and route guard
│   │   └── styles/       # Zen Green tokens and shell styling
│   ├── tests/lab-01/
│   └── tests/lab-02/
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

Each Issue uses its own `feature/*` branch and enters `labX-staging` through a
peer-reviewed Pull Request. After all lab Issues and integration checks are
complete, open one release Pull Request from `labX-staging` to `main`.
See `AGENTS.md` for the full project constraints.
