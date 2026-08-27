# TokTickIT

CPE334 Software Engineering — Lab 2 final delivery record.

| Area | Stack |
|---|---|
| Frontend | React + TypeScript + Vite + Bootstrap (`client/`) |
| Backend | Node.js + Express + TypeScript (`server/`) |
| Database | PostgreSQL + Prisma (`server/prisma/`) |
| Testing | Vitest + Supertest; pinned Playwright for approved E2E |

## Prerequisites

- Node.js 20+ and npm
- A running PostgreSQL instance
- Docker, for the disposable PostgreSQL integration/E2E target

## Backend (`server/`)

```bash
cd server
npm ci
cp .env.example .env        # then edit DATABASE_URL and DIRECT_URL
npm run prisma:migrate      # prisma migrate dev
npm run prisma:seed         # tsx prisma/seed.ts
npm run dev                 # http://localhost:3000
npm test                    # vitest run
npm run build               # TypeScript build
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
npm ci
cp .env.example .env        # VITE_API_URL, defaults to http://localhost:3000
npm run dev                 # http://localhost:5173
npm test                    # vitest run
```

### Lab 2 client

Run `npm ci` in `client/` after pulling: Lab 2 adds `react-router-dom`
for routing and `@fontsource/inter` for the required typeface. Bootstrap
remains the only UI library.

| Route | Screen |
|---|---|
| `/` | Redirects to `/requesters` or `/tickets` depending on the stored Requester |
| `/requesters` | Development Requester Selection — loads active Requesters from `GET /api/requesters`, stores the choice in `sessionStorage`, and navigates to `/tickets` |
| `/tickets` | My Tickets — requester-owned search, filters, sorting, and pagination |
| `/tickets/new` | Create Ticket — generated fields, Pending Attachments, idempotent submission |
| `/tickets/:publicId` | Requester Ticket Detail — read-only, requester-scoped, backed by `GET /api/tickets/:publicId` |
| `/error` | Standalone global error page |

The selected Requester is kept in `sessionStorage` as a Lab 2 testing
mechanism; it is not authentication. The Requester Selection screen at
`/requesters` loads the active Development Requesters from
`GET /api/requesters`, stores the choice in `sessionStorage`, and navigates to
`/tickets`, so the requester routes are now reachable through the UI. The
application is drivable end to end from Requester selection through Ticket
creation, My Tickets, and Ticket Detail. Attachment upload, preview, download,
and removal are included in the Issue #24 implementation.

The Requester selector is a development/test fixture mechanism, not
authentication. Seeded identities are synthetic `@example.com` values; the
application is restricted to development/test networks. CORS origin restriction
is browser hardening, not authentication, authorization, or a privacy boundary.

## Lab 2 status

| Issue | Status | Where |
|---|---|---|
| 18 — Data model + forward migration + seed | Done | `server/prisma/schema.prisma`, `server/prisma/migrations/`, `server/prisma/seed.ts` |
| 19 — Zen Green shell + UI foundation | Done | `client/src/`, `client/src/components/`, `client/src/requester/` |
| 20 — Requester context + selector | Done | `server/src/middleware/`, `server/src/routes/referenceData.ts`, `client/src/pages/RequesterSelection.tsx`, `client/src/requester/useRequesterApi.ts` |
| 21 — Ticket creation + idempotency | Done | `server/src/routes/tickets.ts`, `server/src/services/createTicketFlow.ts`, `client/src/pages/CreateTicket.tsx` |
| 22 — My Tickets | Done | `server/src/services/ticketListService.ts`, `server/src/services/ticketQueryValidator.ts`, `client/src/pages/MyTickets.tsx` |
| 23 — Ticket Detail | Done | `server/src/routes/tickets.ts`, `server/src/services/ticketService.ts`, `client/src/pages/RequesterTicketDetail.tsx`, `client/src/pages/ErrorPage.tsx` |
| 24 — Attachment lifecycle | Done | `server/src/routes/attachments.ts`, `server/src/services/attachmentService.ts`, `server/src/scripts/maintenanceCleanup.ts`, `client/src/attachments/AttachmentSection.tsx` |
| 25 — final integration/tooling | Done | `package.json`, `playwright.config.ts`, `playwright.global-setup.ts`, `e2e/lab-02/`, tracked screenshot evidence |
| 26 — release evidence | Closed by approved/merged [PR #49](https://github.com/oangsa/TokTickIT/pull/49); post-merge staging gate passed on `df8da1e`; prior release PR [#47](https://github.com/oangsa/TokTickIT/pull/47) remains closed; one replacement release PR to `main` remains | `docs/lab-02/reviewer.md`, `docs/lab-02/ai-use.md`, `docs/lab-02/tests.md`; `feature/26-lab2-postmerge-validation` |

Each implementation Issue has its own `feature/<issue>-<short-name>` branch and
peer-reviewed PR into `lab2-staging`. Focused results are recorded separately
from Issue #25's final regression in `docs/lab-02/tests.md` Section 15.3.

### Issue 20 — Requester context + selector

`GET /api/requesters` is a new endpoint that returns the full
`DevelopmentRequesterDTO` for active, non-deleted Requesters only. It is the
one Lab 2 endpoint exempt from the requester guard, along with `GET
/api/health`. Every other `/api` route now requires a valid `X-Requester-Id`
header: a missing, malformed, non-positive, unknown, inactive, or deleted
context is rejected with a safe `400` carrying the protocol-specific code
`REQUESTER_CONTEXT_INVALID`. The client treats that code, and only that code, as
the signal to clear its stored context and redirect to `/requesters`; an ordinary
application `400` leaves the stored Requester alone.

`GET /api/categories` is now guarded under Lab 2. The unrouted Lab 1
`SystemCheck` page is unaffected because it is not reachable through the Lab 2
router, so its `checkSystem()` call to `/api/categories` is not exercised by any
routed screen.

### Issue 21 — Ticket creation

`GET /api/categories` moves onto the shared reference-data router and returns the
full `CategoryDTO` rather than the Lab 1 `{ id, name }` body; `GET
/api/related-systems` is added alongside it. Both return active, non-deleted rows
only and require requester context.

`POST /api/tickets` creates a Ticket under a persistent idempotency claim scoped
to `(requesterId, Idempotency-Key)`. Nothing touches a Ticket or an Attachment
until the claim row is locked and its status, request hash, and exact
`processingStartedAt` are verified, so an abandoned `PROCESSING` claim can have no
committed mutation. Ticket creation, Attachment binding, and the claim's
transition to `COMPLETED` are one transaction.

The request hash is SHA-256 over a fixed-property-order payload with
`attachmentIds` lowercased, duplicate-rejected, and sorted, so the same logical
request replays as `200` while a different one under the same key is `409
IDEMPOTENCY_CONFLICT`. A `PROCESSING` claim is fresh for 300 seconds and
reclaim-eligible from exactly `processingStartedAt + 300s`.

Create Ticket loads its dropdowns from those reference APIs, shows Ticket Number,
Ticket Date, and Requester as read-only controls, and binds one Idempotency Key
to one normalized payload: an unchanged retry reuses it, any change mints a new
one. An ambiguous `5xx` stores a requester-scoped recovery record in
`sessionStorage` that is only ever resubmitted by an explicit Resume action.

Attachment upload remains Issue 24: the form carries the final prepared Pending
`attachmentIds` that the submission sends, and the backend binds them.

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
without committing it to an environment file. These commands assume a fresh
container and keep the Lab 1 regression database separate from the Lab 2
PostgreSQL target:

```bash
export LAB2_TEST_DB_PASSWORD='<PASSWORD>'
docker compose -f tests/lab-02/postgres/docker-compose.test.yml up -d --wait
export NODE_ENV=test
export TEST_DATABASE_URL="postgresql://lab2_test:${LAB2_TEST_DB_PASSWORD}@localhost:55432/toktickit_lab2_test"
export LAB1_DATABASE_URL="postgresql://lab2_test:${LAB2_TEST_DB_PASSWORD}@localhost:55432/toktickit_lab1_dev"
docker exec toktickit-lab2-test-postgres createdb -U lab2_test --maintenance-db=toktickit_lab2_test toktickit_lab1_dev
DATABASE_URL="$LAB1_DATABASE_URL" DIRECT_URL="$LAB1_DATABASE_URL" npx --no-install prisma migrate deploy
DATABASE_URL="$LAB1_DATABASE_URL" DIRECT_URL="$LAB1_DATABASE_URL" npm run prisma:seed
DATABASE_URL="$TEST_DATABASE_URL" DIRECT_URL="$TEST_DATABASE_URL" npx --no-install prisma migrate deploy
DATABASE_URL="$TEST_DATABASE_URL" DIRECT_URL="$TEST_DATABASE_URL" npm run prisma:seed
DATABASE_URL="$LAB1_DATABASE_URL" DIRECT_URL="$LAB1_DATABASE_URL" TEST_DATABASE_URL="$TEST_DATABASE_URL" npm test -- tests/lab-01/categories.test.ts tests/lab-01/health.test.ts
DATABASE_URL="$LAB1_DATABASE_URL" DIRECT_URL="$LAB1_DATABASE_URL" TEST_DATABASE_URL="$TEST_DATABASE_URL" npm test -- tests/lab-02/postgres
DATABASE_URL="$LAB1_DATABASE_URL" DIRECT_URL="$TEST_DATABASE_URL" TEST_DATABASE_URL="$TEST_DATABASE_URL" npx --no-install prisma migrate status
DATABASE_URL="$LAB1_DATABASE_URL" DIRECT_URL="$TEST_DATABASE_URL" TEST_DATABASE_URL="$TEST_DATABASE_URL" npx --no-install prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
docker compose -f tests/lab-02/postgres/docker-compose.test.yml down -v
```

The migration suite covers both fresh reproduction and populated-Lab-1
preservation; the seed is safe to rerun against the disposable target. The Lab 1
regressions run immediately after the clean migration and seed, before the Lab 2
PostgreSQL suites reset the disposable target. Teardown is last so every command
uses the same guarded database while the normal development database remains
untouched.

### Lab 2 browser verification

The repository root contains a private, non-workspace package for the pinned
Playwright runner. From the repository root, install it with `npm ci` and run
the browser suite only with `NODE_ENV=test` and the dedicated disposable
`TEST_DATABASE_URL`; use the sanitized command in `docs/lab-02/tests.md` and do
not use a production database. The runner starts the client and server, applies
the guarded test migrations/seed, and writes the required responsive/visual
screenshots under the tracked `docs/lab-02/evidence/screenshots/` directories.
The HTML report, traces, and failure-only captures remain under ignored
`artifacts/lab-02/`:

```bash
npm ci
npx --no-install playwright install chromium
NODE_ENV=test TEST_DATABASE_URL='<LAB2_TEST_DATABASE_URL>' DATABASE_URL='<LAB1_DATABASE_URL>' DIRECT_URL='<LAB1_DATABASE_URL>' npm run test:e2e
```

`@playwright/test` is pinned in the root manifest and lockfile; the command uses
the local package and does not implicitly download a runner. The browser binary
install is a separate explicit setup step.

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
│   ├── tests/lab-01/
│   └── tests/lab-02/  # unit, API, and guarded PostgreSQL tests
├── docs/lab-01/       # ai_use.md, reviewer.md, tests.md
├── docs/lab-02/       # four contracts, tests, review, AI-use, evidence
├── e2e/lab-02/        # pinned Playwright E2E/responsive/visual suites
├── package.json       # private root Playwright tooling; no workspaces
├── playwright.config.ts
├── playwright.global-setup.ts
├── .gitignore
└── README.md
```

## Workflow

Each Issue uses its own `feature/*` branch and enters `labX-staging` through a
peer-reviewed Pull Request. After all lab Issues and integration checks are
complete, open one release Pull Request from `labX-staging` to `main`.

Lab 2's merged feature sequence is: #17 → [PR #27](https://github.com/oangsa/TokTickIT/pull/27),
#18 → [PR #31](https://github.com/oangsa/TokTickIT/pull/31), #19 → [PR #32](https://github.com/oangsa/TokTickIT/pull/32),
#20 → [PR #33](https://github.com/oangsa/TokTickIT/pull/33), #21 → [PR #34](https://github.com/oangsa/TokTickIT/pull/34),
#22 → [PR #42](https://github.com/oangsa/TokTickIT/pull/42), #23 → [PR #43](https://github.com/oangsa/TokTickIT/pull/43),
#24 → [PR #44](https://github.com/oangsa/TokTickIT/pull/44), and #25 → [PR #45](https://github.com/oangsa/TokTickIT/pull/45).
PR #30 was a closed, unmerged duplicate for Issue #18 and is not part of the
integration sequence. Issue #26's first evidence PR, [#46](https://github.com/oangsa/TokTickIT/pull/46),
merged before approval and was later reverted by approved PR [#48](https://github.com/oangsa/TokTickIT/pull/48)
to restore the pre-evidence staging baseline. Corrected evidence then entered
`lab2-staging` through peer-reviewed [PR #49](https://github.com/oangsa/TokTickIT/pull/49),
which merged as `df8da1e`; the post-#49 staging checks passed. Previous release
PR [#47](https://github.com/oangsa/TokTickIT/pull/47) is closed and not merged.
Open exactly one replacement release PR from `lab2-staging` to `main` for the
promotion step; do not treat #46 or #47 as the final release PR.

See `AGENTS.md` for the full project constraints.
