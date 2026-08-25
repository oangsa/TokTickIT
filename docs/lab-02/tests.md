# Lab 2 Test Specification

## 1. Purpose

This document defines the planned verification contract for TokTickIT Lab 2. It is derived from and must remain consistent with:

- `specification.md`
- `api-spec.md`
- `ui-spec.md`

Every Acceptance Criterion `AC-01` through `AC-66` is mapped to at least one planned test or explicit migration/delivery evidence in the traceability matrix at the end of this document.

The test plan intentionally separates:

- Unit tests for service/class/utility behavior;
- API tests for HTTP/application behavior;
- PostgreSQL integration tests for real concurrency, uniqueness, and rollback guarantees;
- UI tests for React behavior;
- Responsive tests for layout behavior;
- Visual evidence screenshots;
- End-to-end Requester workflows.

## 2. Test ID and Result Conventions

Test IDs identify the test layer:

```text
UNIT-xx
API-xx
UI-xx
RESP-xx
VIS-xx
E2E-xx
PG-xx
DATA-xx
```

`PG-xx` identifies focused tests against a dedicated real PostgreSQL test database. `DATA-xx` identifies planned schema, migration, seed, or other non-automated delivery evidence. These remain distinct because mocked Unit/API tests do not prove PostgreSQL concurrency, uniqueness, locking, or rollback behavior.

Initial `Final` value:

```text
Not Run
```

After execution, only these final values are used:

```text
Pass
Fail
Blocked
```

A planned test row may correspond to multiple concrete `it(...)` / parameterized cases inside one test file.

## 3. Test Directory and File Organization

Test files are grouped by Lab rather than colocated under source directories.

Paths in this document are package-relative. For example, backend tests live under the backend package's `tests/lab-02/`, and frontend tests live under the frontend package's `tests/lab-02/`.

The Lab 2 handout provides exact delivery filenames in two places. Its required planned-test table names these three exact paths: `server/tests/lab-02/tickets.api.test.ts`, `client/src/.../CreateTicket.test.tsx`, and `e2e/lab-02/create-ticket.spec.ts`. Its separate “Minimum Lab 2 structure” also names `server/tests/lab-02/create-ticket.api.test.ts`, `server/tests/lab-02/my-tickets.api.test.ts`, `server/tests/lab-02/ticket-detail.api.test.ts`, `server/tests/lab-02/attachments.api.test.ts`, the corresponding four client test filenames, and `e2e/lab-02/requester-ticket-flow.spec.ts`. These exact filenames are preserved as real planned files below. The paths in this document normalize the handout's client placeholder to the package-relative `tests/lab-02/CreateTicket.test.tsx`.

Handout-required files own the tests that naturally belong to their area: the valid-ticket delivery case uses `tickets.api.test.ts`, Attachment API coverage uses `attachments.api.test.ts`, the golden-path and ownership evidence uses `requester-ticket-flow.spec.ts`, and the handout's Create Ticket/recovery E2E evidence uses `create-ticket.spec.ts`. Additional modular files remain for unrelated responsibilities or distinct focused behavior; no planned coverage is removed or duplicated merely to reproduce a handout filename.

### 3.1 Backend Unit and API Tests

```text
tests/
└── lab-02/
    ├── DevelopmentRequesterService.test.ts
    ├── CategoryService.test.ts
    ├── RelatedSystemService.test.ts
    ├── TicketNumber.test.ts
    ├── TicketService.test.ts
    ├── TicketQueryValidator.test.ts
    ├── QueryBuilder.test.ts
    ├── IdempotencyService.test.ts
    ├── AttachmentService.test.ts
    ├── MaintenanceService.test.ts
    │
    ├── requester-context.api.test.ts
    ├── reference-data.api.test.ts
    ├── tickets.api.test.ts
    ├── create-ticket.api.test.ts
    ├── ticket-idempotency.api.test.ts
    ├── my-tickets.api.test.ts
    ├── ticket-detail.api.test.ts
    ├── attachments.api.test.ts
    ├── error-contract.api.test.ts
    ├── cors.api.test.ts
    ├── transport-hardening.api.test.ts
    │
    └── postgres/
        ├── attachment-concurrency.postgres.test.ts
        ├── idempotency.postgres.test.ts
        ├── maintenance.postgres.test.ts
        ├── migration-upgrade.postgres.test.ts
        └── transactions.postgres.test.ts
```

`TicketNumber.test.ts` tests the Ticket-number formatting/generation responsibility without requiring the implementation to expose a class specifically named `TicketNumberService` or `TicketNumberGenerator`.

`QueryBuilder.test.ts` tests the reusable global QueryBuilder utility pattern. Resource-specific query whitelisting, typed request normalization, fixed predicates, semantic Priority translation, and pagination do not become hard-coded Ticket rules inside the global QueryBuilder.

### 3.2 Frontend UI Tests

```text
tests/
└── lab-02/
    ├── RequesterSelection.test.tsx
    ├── ApplicationShell.test.tsx
    ├── CreateTicket.test.tsx
    ├── MyTickets.test.tsx
    ├── RequesterTicketDetail.test.tsx
    ├── AttachmentSection.test.tsx
    └── ErrorPage.test.tsx
```

### 3.3 Playwright Tests

```text
e2e/
└── lab-02/
    ├── create-ticket.spec.ts
    ├── requester-ticket-flow.spec.ts
    └── responsive-visual.spec.ts
```

## 4. Tooling and Test Boundaries

### 4.1 Unit Tests

Use Vitest for Unit, API, integration, and UI tests. Playwright is separately approved for E2E, responsive, and visual tests.

Unit tests are grouped by service/class/utility responsibility. A service test file may cover all public operations for that service rather than creating one file per method.

Prisma/data-access dependencies are mocked.

### 4.2 API Tests

API tests use:

```text
Supertest
+ real Express application/router/middleware/controller/service behavior
+ mocked Prisma/data-access boundary
```

These fast Unit/API contract tests use mocked Prisma and do not use a real PostgreSQL database. They remain required and are not replaced by the focused PostgreSQL integration layer below.

Preferred boundary:

```text
HTTP
  -> Express middleware
  -> controller
  -> service
  -> repository / Prisma wrapper
  -> MOCK
```

Do not mock the service directly from the controller unless a test explicitly targets controller isolation.

For `$transaction(callback)` behavior, the Prisma mock invokes the callback with a transaction-client mock. Tests verify application transaction orchestration and all-or-nothing call behavior; they do not claim to prove PostgreSQL ACID semantics.

### 4.2.1 PostgreSQL Integration Tests

Focused PostgreSQL tests under `tests/lab-02/postgres/` use the real Prisma schema/migrations and a dedicated disposable/resettable database supplied only through:

```text
TEST_DATABASE_URL
```

`DATABASE_URL` and Prisma 7's `DIRECT_URL` remain development-database connections. The PostgreSQL integration suite must never fall back to either one. Before any reset/setup, its guard must fail safely unless all of the following hold:

- `NODE_ENV` is `test`;
- `TEST_DATABASE_URL` is present and parses as PostgreSQL;
- the normalized `TEST_DATABASE_URL` is not equal to `DATABASE_URL` or `DIRECT_URL` when either is present;
- the target database name contains an explicit test marker such as `test`; and
- setup can identify the target as the dedicated Lab 2 test database before destructive cleanup.

The tests use genuinely concurrent execution and separate Prisma clients/database connections where required. They verify committed database state directly and may reset only the guarded `TEST_DATABASE_URL` target. A missing/unsafe target fails the suite without mutating either database.

### 4.3 UI Tests

UI tests use:

```text
Vitest
+ React Testing Library
+ @testing-library/user-event
+ MSW
```

MSW represents the network boundary and is used for successful responses, validation errors, 403/404/409/500 behavior, delayed requests, and deterministic failure/recovery scenarios.

Fake timers are preferred for the 400 ms search debounce rather than real waiting.

### 4.4 Responsive / Visual / E2E

Use the repository-root, pinned local `@playwright/test` package and Playwright Chromium for the normal automated Lab 2 run. Do not rely on an implicit `npx` package download.

Required viewports:

```text
Desktop  1440 x 900
Tablet    820 x 1180
Mobile    390 x 844
```

Responsive tests use behavioral/layout assertions.

Visual tests capture screenshot evidence but do not require pixel-perfect screenshot-diff baselines. The Lab Sheet/sample screens are visual-direction references, not pixel-identical implementation templates.

### 4.5 Command Matrix

Run each command from the working directory shown in the `Directory` column.
`server/` and `client/` mean those package roots; `repository root` means the
TokTickIT repository root. Package-relative test paths are resolved from the
listed package directory. Final evidence must record the exact command, date,
environment/database target, and result; these commands are not a claim that
the planned Lab 2 tests already exist or pass.

| Purpose | Directory | Command | Evidence requirement |
| --- | --- | --- | --- |
| Install backend dependencies | `server/` | `npm install` | Dependencies install without changing the approved stack. |
| Apply Prisma migrations | `server/` | `npm run prisma:migrate` | Run against the designated Lab 2 PostgreSQL database using `DATABASE_URL` and `DIRECT_URL`; record migration output. |
| Seed reference data | `server/` | `npm run prisma:seed` | Record the first run and an unchanged repeat run; verify no duplicate rows or audit-timestamp churn. |
| Run bounded maintenance cleanup | `server/` | `npm run maintenance:cleanup` | Record expired Pending/Idempotency counts and safe repeat-run result; production scheduling remains external. |
| Backend focused test | `server/` | `npm test -- tests/lab-02/<file>.test.ts` | Use for the owning Issue's focused test gate. |
| Backend full test suite | `server/` | `npm test` | Record the complete Vitest/Supertest result. |
| PostgreSQL integration suite | `server/` | `NODE_ENV=test TEST_DATABASE_URL=<dedicated_lab2_test_postgresql_url> npm test -- tests/lab-02/postgres` | Guarded setup applies the real Prisma migrations to `TEST_DATABASE_URL`; record the sanitized target database name and PG-01–PG-12 results. The suite must fail rather than use `DATABASE_URL`. |
| Backend typecheck/build | `server/` | `npm run build` | Record the TypeScript compilation result. |
| Install frontend dependencies | `client/` | `npm install` | Dependencies install without adding another UI framework or state library. |
| Frontend focused test | `client/` | `npm test -- tests/lab-02/<file>.test.tsx` | Use for the owning Issue's focused UI test gate. |
| Frontend full test suite | `client/` | `npm test` | Record the complete Vitest/React Testing Library result. |
| Frontend typecheck/build | `client/` | `npm run build` | Record the TypeScript and Vite build result. |
| Install pinned repository E2E tooling | repository root after #25 adds the minimal private package | `npm install` | Uses the committed root lockfile and pinned local `@playwright/test`; does not create npm/pnpm workspaces or move application dependencies. |
| Lab 2 E2E/responsive/visual suite | repository root after #25 adds Playwright config | `npm run test:e2e -- e2e/lab-02` | Resolves the locally installed pinned Playwright package and coordinates `client/`, `server/`, PostgreSQL, Chromium, approved viewports, screenshots, and traces without implicit download. |

Do not run migration, seed, reset, or PostgreSQL integration setup against production or the normal development database. Use a disposable or explicitly designated Lab 2 database for fresh-database evidence and the separately guarded `TEST_DATABASE_URL` for PG-01–PG-12.

The guarded PostgreSQL files and the Lab 1 API tests read different variables:
`tests/lab-02/postgres/*` connect through `TEST_DATABASE_URL`, while
`tests/lab-01/*` exercise the running Express app, which resolves
`DATABASE_URL` in `server/src/prisma.ts`. Two consequences follow.

First, `assertLab2TestDatabase` refuses to run when `TEST_DATABASE_URL` names
the same database as `DATABASE_URL` or `DIRECT_URL`, so the two variables must
name different databases.

Second, the guarded PostgreSQL files create their own fixture rows and leave
them behind (for example `Idempotency Test Category`), while
`tests/lab-01/categories.test.ts` asserts that `GET /api/categories` returns
exactly the four seeded Categories. The Lab 1 API tests therefore cannot share
the disposable Lab 2 database with the guarded suite.

A single `npm test` run is green when `DATABASE_URL`/`DIRECT_URL` name a
migrated and seeded Lab 1 database and `TEST_DATABASE_URL` names a separate
disposable Lab 2 database. To keep every run off the normal development
database, use a second disposable database for `DATABASE_URL`/`DIRECT_URL` and
migrate and seed it first.

### 4.5.1 Issue #18 final verification evidence

The following checks were run on 2026-08-22 from the listed package
directories. The disposable PostgreSQL password is intentionally redacted. Two
disposable databases on the same throwaway PostgreSQL 16 instance at
`localhost:55432` were used - `toktickit_lab2_test` for the guarded Lab 2
suite and `toktickit_lab1_dev` for the Lab 1 application tests, for the reason
given in Section 4.5. The normal development database was never used, migrated,
seeded, or reset.

| Check | Command | Environment / target | Result |
| --- | --- | --- | --- |
| Fresh migration | `NODE_ENV=test TEST_DATABASE_URL=<lab2_test_url> DATABASE_URL=<same> DIRECT_URL=<same> npx prisma migrate deploy` | Disposable `toktickit_lab2_test` | Passed — both forward migrations applied. |
| Prisma drift | `NODE_ENV=test TEST_DATABASE_URL=<lab2_test_url> DATABASE_URL=<same> DIRECT_URL=<same> npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` | Disposable `toktickit_lab2_test` | Passed — empty migration; the `summary` and `description` trigram indexes are represented in `schema.prisma` and are not dropped. |
| Attachment trigger absence | `SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid WHERE c.relname = 'attachment' AND NOT t.tgisinternal;` and `SELECT count(*) FROM pg_proc WHERE proname LIKE 'prevent_bound_attachment%';` | Disposable `toktickit_lab2_test` | Passed — 0 triggers and 0 trigger functions exist on `attachment`; the forward migration never creates one. |
| Issue #18 focused gate | `NODE_ENV=test TEST_DATABASE_URL=<lab2_test_url> npm test -- --run tests/lab-02/CategoryService.test.ts tests/lab-02/RelatedSystemService.test.ts tests/lab-02/postgres/migration-upgrade.postgres.test.ts tests/lab-02/postgres/transactions.postgres.test.ts tests/lab-02/postgres/idempotency.postgres.test.ts` | Disposable `toktickit_lab2_test` | Passed — 5 files, 24 tests. |
| Seed repeatability | `NODE_ENV=test TEST_DATABASE_URL=<lab2_test_url> DATABASE_URL=<same> DIRECT_URL=<same> npm run prisma:seed` (run twice) | Disposable `toktickit_lab2_test` | Passed — both runs completed; the migration-upgrade test verifies identical rows and audit timestamps across reruns. |
| Lab 1 regression | `NODE_ENV=test DATABASE_URL=<lab1_dev_url> DIRECT_URL=<same> TEST_DATABASE_URL=<lab2_test_url> npm test -- --run tests/lab-01/categories.test.ts tests/lab-01/health.test.ts` | Disposable `toktickit_lab1_dev`, migrated and seeded first | Passed — 2 files, 2 tests. |
| Full server suite, single invocation | `NODE_ENV=test DATABASE_URL=<lab1_dev_url> DIRECT_URL=<same> TEST_DATABASE_URL=<lab2_test_url> npm test` | Both disposable databases | Passed — 8 files, 30 tests. |
| Backend validation/build | `npx prisma validate && npm run build` | `server/` | Passed. |
| Frontend build | `npm run build` | `client/` | Passed. |

### 4.5.2 Issue #19 final verification evidence

The following checks were run on 2026-08-22 from `client/`. Issue #19 is
frontend-only: no server file, Prisma schema, migration, or database was
touched, so no database target was involved and the server suite was not run.

| Check | Command | Environment / target | Result |
| --- | --- | --- | --- |
| Baseline before the refactor | `npm test` and `npm run build` | `client/` | Passed — 2 files, 6 tests; build succeeded. |
| Install frontend dependencies | `npm install react-router-dom @fontsource/inter` | `client/` | Passed — `react-router-dom` 7.18.2 provides routing and `@fontsource/inter` 5.3.0 self-hosts the required typeface. Neither is a UI framework or a global state library; Bootstrap 5.3.8 remains the only UI library and no dependency was upgraded. |
| Lab 1 client regression after the move | `npm test -- tests/lab-01` | `client/` | Passed — 2 files, 6 tests. `tests/lab-01/App.test.tsx` continues to mount the Lab 1 `SystemCheck` page directly; the existing assertions remain unchanged. |
| Issue #19 focused gate | `npm test -- tests/lab-02/ApplicationShell.test.tsx` | `client/` | Passed — 1 file, 27 tests. |
| Shared component contract | `npm test -- tests/lab-02/SharedComponents.test.tsx` | `client/` | Passed — 1 file, 21 tests. Covers modal focus management, the windowed pagination control, field label/required/error/counter association and ordering, read-only semantics, busy-button behavior, icon-only names plus tooltips, and the six Attachment state labels. |
| Frontend full test suite | `npm test` | `client/` | Passed — 4 files, 54 tests. |
| Frontend typecheck/build | `npm run build` | `client/` | Passed — `tsc` typechecked every file under `src` and `tests`, and the Vite build succeeded. |
| Contrast spot-check of the new tokens | Manual WCAG 2.1 relative-luminance calculation | `client/src/styles/theme.css` | Passed — disabled Primary button 4.87:1, disabled Destructive 4.82:1, muted text 5.63:1 on white, active navigation 5.97:1 on Pale Green, warning 6.39:1 on white. Bootstrap's `--bs-btn-disabled-opacity` is set to `1` because it otherwise composites a second time and drops the disabled Primary button to 1.8:1. |
| Served-route smoke | `npm run preview -- --port 4173 --strictPort` then `curl` for `/`, `/tickets`, `/error` | `client/` built output | Passed — each route returned `200` through the single-page fallback. This confirms routing is served; it is not visual or responsive evidence, which remains Issue #25 (RESP-01–03, VIS-01–03) and the Section 34 checklist. |

### 4.5.3 Issue #19 scrutinize fix pass

A specification-first review of the Issue #19 change surfaced five defects that
were fixed before shipping. All checks below were run on 2026-08-23 from
`client/`; the change remains frontend-only, so no server, Prisma, migration, or
database target was involved.

| Finding | Fix | Evidence |
| --- | --- | --- |
| The open mobile drawer painted over the menu toggle, hiding the only pointer-reachable control that closes it (ui-spec Section 5.2). | `.tt-topbar` takes `position: relative; z-index: 1046` above the drawer's `1045`, and the drawer pads its content below the topbar using the new `--tt-topbar-height` token. | Bootstrap stacking confirmed against `client/node_modules/bootstrap/dist/css/bootstrap.min.css`; visual re-check belongs to Issue #25. |
| The icon-only tooltip was always mounted with `opacity: 0`, so it occupied layout permanently and centred itself off-screen on the left-most control — a clipped label now and page-level horizontal scrolling for any right-edge icon button later (Sections 4, 29.8, 34). | `.tt-tip` first toggled `display` and aligned to the host's inline start. The follow-up in Section 4.5.4 supersedes that sibling implementation with a viewport-positioned body portal; `IconButton` still drops `aria-describedby` because the tooltip repeats the `aria-label`. | `ApplicationShell.test.tsx` and `SharedComponents.test.tsx` assert the accessible name, hover/focus visibility, and body-level `role="tooltip"` placement. |
| The modal's dismiss handler sat on `.modal-backdrop`, which Bootstrap places at `z-index: 1050` beneath the full-viewport `.modal` at `1055`, so it never received a click. | The handler moved to `.modal` with a `target === currentTarget` check on `mousedown`, so a drag out of the dialog does not dismiss it. | `SharedComponents.test.tsx` — "closes on a click outside the dialog but not on a drag out of it". |
| `document.body.classList.add("modal-open")` was a no-op: `grep -c "modal-open" bootstrap.min.css` returns `0` because Bootstrap 5 locks scrolling from JavaScript this component does not use. | The effect sets and restores `document.body.style.overflow` directly. | `SharedComponents.test.tsx` — "locks page scrolling while open and restores it on close". |
| `Uploading` and `Pending` shared one badge treatment, and `.tt-attachment-state--progress` duplicated `.tt-badge--neutral` verbatim (Section 34). | The duplicate class is deleted; `Pending` takes a dashed Secondary Green border matching the established `.tt-readonly` idiom, and `Uploading` keeps the plain neutral badge. | `SharedComponents.test.tsx` — "distinguishes Uploading from Pending by more than the label". |

Two further corrections were folded into the same pass. `ValidationMessage` no
longer carries `role="alert"`: `FormField` already associates it through
`aria-describedby`, which is what Section 29.4 requires, and an assertive live
region would interrupt once per failed field when Section 8.2 validates the whole
form on submit. `FormField` records that the native `required` attribute it sets
for Section 29.3 also arms browser validation, so the Issue #21 form must use
`<form noValidate>` or the browser's own bubble will pre-empt the
field-associated message and first-invalid focus Section 8.2 requires.

| Check | Command | Environment / target | Result |
| --- | --- | --- | --- |
| Frontend full test suite | `npm test` | `client/` | Passed — 4 files, 57 tests (3 added by this pass). |
| Frontend typecheck/build | `npm run build` | `client/` | Passed. |

### 4.5.4 Issue #19 follow-up fix pass

The follow-up fixes were run on 2026-08-23 from `client/`. The implementation
remains frontend-only: no server, Prisma, migration, or database target was
changed.

| Finding | Fix | Evidence |
| --- | --- | --- |
| Bootstrap's default card body/header spacing was `16px` at every breakpoint, not the UI contract's desktop/tablet/mobile rhythm. | Added `--tt-card-pad` values of `24px`, `20px`, and `16px`, and mapped Bootstrap card spacer/cap variables to that token. | `client/src/styles/theme.css`; `npm run build`. |
| A CSS sibling tooltip could be clipped by `.modal-content` or overflow past the viewport edge. | `IconButton` now mounts the tooltip in `document.body`, positions it against the viewport, clamps both inline edges, and flips above controls near the bottom edge. | `ApplicationShell.test.tsx` and `SharedComponents.test.tsx` exercise hover/focus visibility and body-level placement. |

| Check | Command | Environment / target | Result |
| --- | --- | --- | --- |
| Application shell/navigation gate | `npm test -- tests/lab-02/ApplicationShell.test.tsx` | `client/` | Passed — 1 file, 27 tests. |
| Shared component contract | `npm test -- tests/lab-02/SharedComponents.test.tsx` | `client/` | Passed — 1 file, 24 tests. |
| Frontend full test suite | `npm test` | `client/` | Passed — 4 files, 57 tests. |
| Frontend typecheck/build | `npm run build` | `client/` | Passed. |
| Diff hygiene | `git diff --check` | repository | Passed. |

Playwright/responsive/visual browser coverage remains not run in this Issue;
the planned visual and responsive pass remains assigned to Issue #25.

### 4.5.5 Issue #19 review follow-up verification

The follow-up checks were run on 2026-08-23 from `client/`. The malformed
Requester-context regression now verifies that invalid `sessionStorage` values
are removed, and the Lab 1 client tests continue to mount the extracted
`SystemCheck` page directly; they do not exercise a `/system-check` route.

| Check | Command | Result |
| --- | --- | --- |
| Requester-context regression | `npm test -- tests/lab-02/ApplicationShell.test.tsx` | Passed — 1 file, 27 tests. |
| Lab 1 client regression | `npm test -- tests/lab-01/App.test.tsx` | Passed — 1 file, 5 tests. |
| Frontend full test suite | `npm test` | Passed — 4 files, 57 tests. |
| Frontend typecheck/build | `npm run build` | Passed. |
| Diff hygiene | `git diff --check` | Passed. |

### 4.5.6 Issue #19 fix-then-ship verification

The final review fixes were run on 2026-08-23 from `client/`. Mobile drawer
navigation now restores focus to the visible menu toggle, and standalone error
navigation uses the UI contract's secondary Back treatment.

| Check | Command | Result |
| --- | --- | --- |
| Mobile navigation focus regression | `npm test -- tests/lab-02/ApplicationShell.test.tsx` | Passed — 1 file, 27 tests. |
| Frontend full test suite | `npm test` | Passed — 4 files, 57 tests. |
| Frontend typecheck/build | `npm run build` | Passed. |
| Diff hygiene | `git diff --check` | Passed. |

Playwright/responsive/visual browser coverage remains not run in this Issue;
the planned visual and responsive pass remains assigned to Issue #25.

### 4.5.7 Issue #19 form-style fix verification

The remaining shared-control style findings were fixed on 2026-08-23 from
`client/`. Invalid controls retain the Zen Green danger border while focused,
and editable text/select controls expose the contract's visible hover treatment;
disabled, read-only, and invalid controls are excluded from that hover rule.

| Check | Command | Environment / target | Result |
| --- | --- | --- | --- |
| Shared component and shell gate | `npm test -- tests/lab-02/ApplicationShell.test.tsx tests/lab-02/SharedComponents.test.tsx` | `client/` | Passed — 2 files, 51 tests. |
| Frontend full test suite | `npm test` | `client/` | Passed — 4 files, 57 tests. |
| Frontend typecheck/build | `npm run build` | `client/` | Passed. |
| Backend typecheck/build | `npm run build` | `server/` | Passed. |
| Diff hygiene | `git diff --check` | repository | Passed. |

Playwright/responsive/visual browser coverage remains not run in this Issue;
the planned visual and responsive pass remains assigned to Issue #25.

### 4.5.8 Issue #19 scrutinize follow-up verification

The route and focus follow-up checks were run on 2026-08-23 from `client/`.
Navigation active state now uses route-aware matching so `/tickets/new/` does
not activate My Tickets, and changing Requester focuses the new standalone
Requester screen after the shell unmounts.

| Check | Command | Environment / target | Result |
| --- | --- | --- | --- |
| Issue #19 focused shell gate | `npm test -- tests/lab-02/ApplicationShell.test.tsx` | `client/` | Passed — 1 file, 28 tests. |
| Frontend full test suite | `npm test` | `client/` | Passed — 4 files, 58 tests. |
| Frontend typecheck/build | `npm run build` | `client/` | Passed. |
| Backend typecheck/build | `npm run build` | `server/` | Passed. |
| Diff hygiene | `git diff --check` | repository | Passed. |

The public `/system-check` compatibility route remains a contract decision for
the next step: the current Lab 2 API contract requires `X-Requester-Id` for
`GET /api/categories`, while the retained Lab 1 route calls it without that
context. No unauthenticated Lab 2 exception was added implicitly.

### 4.5.9 Issue #19 final route/API contract resolution

The final contract fix was run on 2026-08-23 from the repository. Lab 2 now
exposes only the routes defined by `docs/lab-02/specification.md`; the Lab 1
`SystemCheck` page remains available to its direct Lab 1 client tests without
adding an unauthenticated Lab 2 route or weakening the required
`X-Requester-Id` contract for `GET /api/categories`.

| Check | Command | Environment / target | Result |
| --- | --- | --- | --- |
| Lab 1 client regression | `npm test -- tests/lab-01/App.test.tsx` | `client/` | Passed — 1 file, 5 tests. |
| Issue #19 focused shell gate | `npm test -- tests/lab-02/ApplicationShell.test.tsx` | `client/` | Passed — 1 file, 29 tests, including `/system-check` resolving to the global 404 route. |
| Frontend full test suite | `npm test` | `client/` | Passed — 4 files, 59 tests. |
| Frontend typecheck/build | `npm run build` | `client/` | Passed. |
| Backend typecheck/build | `npm run build` | `server/` | Passed. |
| Backend test suite (attempted) | `npm test` | `server/` | Not passed in this sandbox: the two Lab 1 Supertest cases hit `listen EPERM` on `0.0.0.0`, and three PostgreSQL contract suites failed while resetting the test schema. Three non-PostgreSQL files passed; no server files changed. |
| Diff hygiene | `git diff --check` | repository | Passed. |

Playwright/responsive/visual browser coverage remains assigned to Issue #25.

### 4.5.10 Issue #19 final focus and form-validation follow-up

The final follow-up checks were run on 2026-08-23 from the repository. The
mobile drawer now closes for any in-shell route change, including navigation
that does not originate from the sidebar, and the shared `Form` boundary
defaults to `noValidate` so the field-level validation and first-invalid-focus
contract remains in control. The Lab 1 `SystemCheck` page remains directly
covered without adding `/system-check` to the Lab 2 route contract or weakening
the requester header requirement for `GET /api/categories`.

| Check | Command | Environment / target | Result |
| --- | --- | --- | --- |
| Shell and shared-component focused gate | `npm test -- --run tests/lab-02/ApplicationShell.test.tsx tests/lab-02/SharedComponents.test.tsx` | `client/` | Passed — 2 files, 55 tests. Includes route-change drawer closure, toggle focus restoration, and the shared `Form` `novalidate` contract. |
| Frontend full test suite | `npm test -- --run` | `client/` | Passed — 4 files, 61 tests, including 6 Lab 1 client tests. |
| Frontend typecheck/build | `npm run build` | `client/` | Passed. |
| Backend typecheck/build | `npm run build` | `server/` | Passed; no backend files changed. |
| Diff hygiene | `git diff --check` | repository | Passed. |

Playwright/responsive/visual browser coverage remains assigned to Issue #25.

### 4.5.11 Issue #19 requester-context validation follow-up

The final requester-context fix was run on 2026-08-23 from the repository.
Stored requester IDs now require positive safe integers, preventing a
non-representable JavaScript number from passing the route guard as valid
requester context. The regression also verifies that the unsafe stored value is
removed before the requester route renders.

| Check | Command | Result |
| --- | --- | --- |
| Unsafe requester-context regression | `npm test -- --run tests/lab-02/ApplicationShell.test.tsx` | Passed — 1 file, 31 tests. |
| Frontend full test suite | `npm test -- --run` | Passed — 4 files, 62 tests. |
| Frontend typecheck/build | `npm run build` | Passed. |
| Backend typecheck/build | `npm run build` | Passed; no backend files changed. |
| Diff hygiene | `git diff --check` | Passed. |

Playwright/responsive/visual browser coverage remains assigned to Issue #25.

### 4.5.12 Issue #19 modal-focus and pagination fix pass

A second specification-first review of Issue #19 surfaced three defects in the
shared primitives, all confirmed against the real components before the fix. The
checks below were run on 2026-08-23 from `client/`; the change remains
frontend-only, so no server, Prisma, migration, or database target was involved.

| Finding | Fix | Evidence |
| --- | --- | --- |
| The modal focus trap escaped on `Shift+Tab` whenever focus rested on the dialog container, which is where it parks on open and after any click on non-focusable content. Native `Shift+Tab` then walked backwards past the portal onto the page behind the dimmed, scroll-locked backdrop, breaking the keyboard operability Sections 29.5 and 29.6 require of the preview and removal modals. | The `Tab` handler treats the dialog container as a trap edge alongside the first focusable. Forward `Tab` needs no help because every focusable is a descendant. | `SharedComponents.test.tsx` — "traps Shift+Tab when focus rests on the dialog container". Verified to fail against the pre-fix component. |
| Opening any dialog fired the close control's focus tooltip, because focus moved to the first focusable and that control is the icon-only close button. Every dialog opened with a "Close dialog" label floating under the `×` instead of leaving the reader on the dialog copy. Section 29.8 asks for the tooltip on hover/focus of the control, not as an open animation. | Opening focuses the dialog container itself, which already carries `tabIndex={-1}`. The close control keeps both its accessible name and its hover/focus tooltip. | `SharedComponents.test.tsx` — "labels the dialog by its title and gives the close control a tooltip" now asserts no tooltip on open and the tooltip on hover. Verified to fail against the pre-fix component. |
| `Pagination` derived the displayed range from the caller's raw page number. Narrowing a search or filter shrinks `totalItems` while the caller still holds the old page, producing `Showing 391-25 of 25` with Previous still offering a page that no longer exists. | The component clamps the page number into `[1, pageCount]` once and derives the range, window, disabled state, and `onPageChange` payloads from the clamped value, so callers do not each repeat the clamp. | `SharedComponents.test.tsx` — "clamps a stale page number past the end of a narrowed result set". Verified to fail against the pre-fix component. |

| Check | Command | Environment / target | Result |
| --- | --- | --- | --- |
| Shared component contract | `npm test -- --run tests/lab-02/SharedComponents.test.tsx` | `client/` | Passed — 1 file, 32 tests (3 added by this pass). |
| Regression value check | Same suite against the pre-fix `Modal.tsx` and `Pagination.tsx` | `client/` | 3 failed, 24 passed — each new test fails without its fix. |
| Frontend full test suite | `npm test` | `client/` | Passed — 4 files, 72 tests. |
| Frontend typecheck | `npx tsc --noEmit` | `client/` | Passed. |
| Frontend build | `npm run build` | `client/` | Passed. |
| Diff hygiene | `git diff --check` | repository | Passed. |

Findings accepted without change in this pass: `writeRequesterContext` still
lacks the `try`/`catch` that `readRequesterContext` carries, and will be
hardened when Issue #20 first calls it; `.tt-table-wrap` and `.tt-col-secondary`
remain unused until Issue #22 renders the ticket table; `SystemCheck.tsx` stays
a directly tested Lab 1 page with no Lab 2 route, per Section 4.5.9.

Playwright/responsive/visual browser coverage remains assigned to Issue #25.

### 4.5.13 Issue #19 persistent-sidebar and drawer-containment fix pass

An outsider specification-first review of Issue #19 traced the shell against
Sections 5.1, 5.2, 23, and 34 and surfaced three defects plus one false evidence
row. The checks below were run on 2026-08-23 from `client/`; the change remains
frontend-only, so no server, Prisma, migration, or database target was involved.

| Finding | Fix | Evidence |
| --- | --- | --- |
| The desktop sidebar was not persistent. `.tt-shell` is a grid with the default `align-items: stretch`, so `.tt-sidebar` stretched to the height of the main column and `.tt-sidebar__footer`'s `margin-top: auto` placed Requester and Change Requester at the bottom of the *document* rather than the bottom of the sidebar. Section 5.1 requires a persistent sidebar with that block at its foot, and Section 34 forbids hidden required buttons; once Issue #22 renders a full ticket table, Change Requester and both navigation links sit far below the fold. | `.tt-sidebar` becomes `position: sticky; top: 0; block-size: 100vh; overflow-y: auto` above the 992px breakpoint, so the whole navigation stays on screen at any list length. | Browser-only: jsdom applies no stylesheets. Assigned to Issue #25 in VIS-01–VIS-03 below. |
| The open mobile drawer's backdrop hid the page visually but not from the tab order, so Tab past Change Requester landed on controls behind the dimmed overlay that could be neither seen nor clicked (Section 5.2: the mobile navigation must not obscure required actions). | `.tt-main` carries `inert` while the drawer is open. React 18 has no typed `inert` prop and forwards unknown attributes verbatim, so it is spelled as a string and omitted entirely when closed — `inert="false"` is still inert. | `ApplicationShell.test.tsx` — "takes the page behind the open drawer out of the tab order". Verified to fail against the pre-fix component. |
| `Failed` and `Invalid` rendered as the same badge; only the label separated them, although the same pass had explicitly set a "more than the label" bar for `Uploading` vs `Pending` (Section 34). | `Invalid` adds `.tt-attachment-state--invalid`, taking the dashed border the pending/removed treatments already use for "not real evidence", while `Failed` keeps the solid border of something attempted and retryable (Sections 23.2, 23.3). | `SharedComponents.test.tsx` — "gives every attachment state a treatment of its own, not just a label" and "separates Failed from Invalid by border style, not only by colour". Both verified to fail against the pre-fix component. |
| Section 4.5.12 recorded `git diff --check` as Passed while `client/src/styles/components.css` ended with a blank line, and recorded 27/64 tests for a working tree that held 32/72. | The blank line is removed and both counts are corrected above. Gate results are now re-run immediately before they are written down. | `git diff --check` clean; `npm test` reports 4 files, 74 tests. |

| Check | Command | Environment / target | Result |
| --- | --- | --- | --- |
| Shell and shared-component gate | `npm test -- --run tests/lab-02/ApplicationShell.test.tsx tests/lab-02/SharedComponents.test.tsx` | `client/` | Passed — 2 files, 68 tests (3 added by this pass). |
| Regression value check | Same suites against the pre-fix `AppShell.tsx` and `AttachmentState.tsx` | `client/` | 3 failed, 65 passed — each new test fails without its fix. |
| Frontend full test suite | `npm test` | `client/` | Passed — 4 files, 74 tests. |
| Frontend typecheck | `npx tsc --noEmit` | `client/` | Passed. |
| Frontend build | `npm run build` | `client/` | Passed. |
| Diff hygiene | `git diff --check` | repository | Passed. |

Findings reviewed and rejected in this pass: gating the Requester Selection
focus move on a `requesterCleared` navigation flag was implemented and reverted.
`clearRequester` commits synchronously while react-router v7 wraps `navigate` in
a transition, so `RequesterGuard`'s own state-less redirect always wins and the
flag never arrives — a probe confirmed `location.state` is `null` on arrival.
The concern was overstated in any case: the `<h1>` sits inside `<main>`, so
focusing that container skips no heading. The unconditional focus move stays.

Findings accepted without change in this pass: `.btn-close` is removed from
`theme.css` as dead — `Modal` uses `IconButton`, and a reintroduced Bootstrap
close button would be an icon-only control with no tooltip (Section 29.8);
`--tt-warning` stays although unused, because Section 3.1 lists it as an
approved token; `Form.tsx` stays a thin `noValidate` wrapper until Issue #21's
forms show whether they share more than that attribute.

The `ui-spec.md` Section 27.1 amendment carried in this branch is a change to
the source of truth, not an implementation detail, and is recorded as such
rather than reviewed alongside the code that depends on it.

Playwright/responsive/visual browser coverage remains assigned to Issue #25.

### 4.6 Deterministic Test Data

Automated tests use deterministic fixtures/mocks. The standard fixture set should include at least:

- active Requester Alice;
- active Requester Bob;
- inactive Requester Eve;
- active and inactive/deleted Category fixtures;
- active and inactive/deleted Related System fixtures;
- Requester-owned Tickets for ownership/list tests;
- valid Pending, Active, Removed, expired, already-bound, and cross-scope Attachment fixtures;
- deterministic timestamps and UUIDs where assertions require exact values.

E2E may use a test-only fixture/reset mechanism or equivalent deterministic test dependency. Test-only reset behavior must not be exposed as a production API.

### 4.5.14 Issue #19 focus-indicator and breakpoint fix pass

A second outsider specification-first review traced the shell and the shared
primitives against the compiled `bootstrap.min.css` cascade rather than against
the source classes alone, and against Sections 4, 5.2, 27.1, 29.6, and 34. The
checks below were run on 2026-08-23 from `client/`; the change is frontend-only
plus one `ui-spec.md` restoration, so no server, Prisma, migration, or database
target was involved.

| Finding | Fix | Evidence |
| --- | --- | --- |
| Icon-only controls had **no** visible focus indicator at all, and no hover feedback either. `.btn:focus-visible` carries `outline: 0` at specificity 0,2,0 and beats the `:focus-visible` outline in `theme.css` at 0,1,0; it then replaces the outline with `box-shadow: var(--bs-btn-focus-box-shadow)`, which resolves `rgba(var(--bs-btn-focus-shadow-rgb), .5)`. Bootstrap defines `--bs-btn-focus-shadow-rgb` only on variant classes, never on `:root` or `.btn`, and `IconButton` renders a bare `btn tt-icon-btn`: the var is undefined, the shadow is invalid at computed-value time, and it computes to `none`. The mobile sidebar toggle, the modal close control, and the filter-chip remove control — the three controls AC-BR-91 names — therefore shipped with no focus ring (Section 29.6: visible focus is mandatory; Section 34). | One rule gives `.btn:focus-visible`, `.nav-link:focus-visible`, and `.page-link:focus` a solid `2px` Secondary Green outline, restoring a single indicator for every control. `.tt-icon-btn` additionally supplies the Pale Green hover pair and its own `--bs-btn-focus-shadow-rgb`. | Browser-only: jsdom applies no stylesheets. Cascade confirmed by grep against `client/node_modules/bootstrap/dist/css/bootstrap.min.css` — `--bs-btn-focus-shadow-rgb` has zero `:root` definitions and is absent from the `.btn` base block. Visual confirmation assigned to Issue #25 (VIS-01–VIS-03). |
| The focus ring itself failed WCAG 2.2 SC 1.4.11. `--tt-focus-ring` at `rgba(11, 122, 70, 0.35)` composites to `rgb(170, 208, 190)` on white — **1.68:1**; Bootstrap's `.btn` ring at alpha `.5` reaches only **2.16:1**. Because Bootstrap zeroes the outline on `.btn`, `.nav-link`, and `.page-link`, that ring was the entire indicator for sidebar navigation and pagination. Form controls were unaffected: `.form-control:focus` also swaps the border to Secondary Green. Section 4.5.6's contrast spot-check measured disabled buttons, muted text, active navigation, and warning — every token except the focus indicator. | The same solid outline rule above. Secondary Green `#0B7A46` measures 5.40:1 on white and 4.87:1 on Pale Green; the translucent ring is now decoration layered on a compliant indicator rather than the indicator itself. | Manual WCAG 2.1 relative-luminance calculation over the composited ring colours and the replacement outline. |
| A drawer left open across the 992px breakpoint froze the desktop page. `open` was never reset on a viewport change, and above the breakpoint `.tt-topbar` and `.tt-backdrop` are both `d-lg-none`: the toggle is `display: none` so it can be neither clicked nor focused, the backdrop is invisible, and `.tt-main` keeps `inert`. A tablet rotating 820 -> 1180 therefore lands on a normal-looking desktop shell whose entire content area silently refuses every click and every Tab. Escape still worked but is not a discoverable recovery (Section 5.2: the navigation must not obscure required actions; Section 34: no hidden required buttons). | `AppShell` subscribes to `matchMedia("(min-width: 992px)")` and closes the drawer on the `change` event. No focus restoration: the toggle is `display: none` at that width, so focusing it would be a no-op. | `ApplicationShell.test.tsx` — "closes the drawer when the viewport crosses into the desktop breakpoint" and "leaves the drawer alone while the viewport stays below the breakpoint". `tests/setup.ts` gains a `matchMedia` implementation resolving `(min-width: Npx)` against `window.innerWidth`, because jsdom ships none and an always-`false` stub would assert nothing. |
| `Pagination`'s clamp report would steal the user's page during a refetch. The effect fired `onPageChange(page)` whenever the clamp moved, and `totalItems: 0` — what a caller renders while a request is in flight — collapses `pageCount` to 1. A user on page 3 would be knocked to page 1 and the page-3 response discarded. No caller exists yet, so this was unexercised; it would have become a live defect the moment Issue #22 wired the component up. | The report is gated on `totalItems > 0`. A genuinely empty result set needs no report either — every page of it is equally empty and the clamped display already reads "Page 1 of 1" — so the report is owed only once a real total contradicts the caller. The internal clamp is unchanged, so the rendered range and the disabled arrows stay correct throughout. | `SharedComponents.test.tsx` — "does not report a clamp while the total is still unresolved". Verified to fail against the pre-fix component. |
| `ui-spec.md` Section 27.1 had been edited by this Issue to bless the implementation: the original "including after reload or direct navigation" was replaced with a paragraph declaring reload-restored state safe and preferred. Under specification-first that inverts the contract direction — the requirement was implementable, and the implementation rewrote its own acceptance criterion instead. | The original sentence is restored and `ErrorPage` implements it: `useNavigationType() === "POP"` identifies the entries that were not produced by a live client-side navigation — the document's own entry, a reload of it, and a history restore — and those fall back to the generic `500` variant regardless of what `location.state` still carries. A real `PUSH`/`REPLACE` into `/error` keeps the status its caller set, so the `404` wildcard route is unaffected. | `ApplicationShell.test.tsx` — "falls back to the generic variant when a %s entry is restored rather than navigated to" for 403/404/500. Verified to fail against the pre-fix component for 403 and 404 (500 was already the fallback). The variant-copy and Back-path tests now arrive through a real navigation via the new `renderErrorVia` helper, matching how the application reaches the route. |
| The `403` variant had no test and no producer; only `404` and `500` were exercised. | `ApplicationShell.test.tsx` covers all three variants' copy plus a rejection table for unrecognised `status` values (`401`, `418`, the string `"404"`, `null`, `"nope"`). | Included in the counts below. |
| Section 4.5.13 rejected gating the Requester Selection focus move because a `location.state` flag never survives the batch — `clearRequester` commits urgently while react-router v7 wraps `navigate` in a transition, so `RequesterGuard`'s state-less redirect wins. That diagnosis is correct and was reproduced in this pass. The mechanism was the problem, not the goal. | `useNavigationType() !== "POP"` asks the same question without passing anything through the router: it is true for Change Requester and for a guard redirect, and false for a cold load or reload of `/requesters`. Focus therefore still follows every client-side screen replacement and no longer moves on the document's own entry, which is the conventional SPA rule. | `ApplicationShell.test.tsx` — "does not steal focus on a first load of the selector" and "moves focus to the selector when the guard redirects a guarded route". The first is verified to fail against the pre-fix component. |

| Check | Command | Environment / target | Result |
| --- | --- | --- | --- |
| Shell and shared-component gate | `npm test -- --run tests/lab-02/ApplicationShell.test.tsx tests/lab-02/SharedComponents.test.tsx` | `client/` | Passed — 2 files, 84 tests (16 added by this pass). |
| Regression value check | Same suites against the pre-fix `AppShell.tsx`, `Pagination.tsx`, `ErrorPage.tsx`, and `RequesterSelection.tsx` | `client/` | 5 failed, 85 passed — each behavioural fix has a test that fails without it. |
| Frontend full test suite | `npm test` | `client/` | Passed — 4 files, 90 tests. |
| Frontend typecheck | `npx tsc --noEmit` | `client/` | Passed. |
| Frontend build | `npm run build` | `client/` | Passed. |
| Diff hygiene | `git diff --check` | repository | Passed. |

The two CSS findings carry no automated evidence by construction: jsdom applies
no stylesheets, so neither the missing focus ring nor its contrast is visible to
Vitest. Both were found by reading the compiled Bootstrap cascade directly and
both remain assigned to Issue #25's VIS-01–VIS-03 for visual confirmation. The
Section 34 checklist item "focus states remain visible" should be verified
against `IconButton` specifically, since that is the control the cascade broke.

Findings raised and accepted without code change in this pass: fifteen shared
components (`Modal`, `Pagination`, `FilterChip`, `AttachmentState`, `Skeleton`,
`ErrorState`, `SuccessMessage`, `Select`, `Textarea`, `TextInput`,
`ReadOnlyField`, `CharacterCounter`, `ValidationMessage`, `Form`, and `Badge`
outside `AttachmentState`) still have no screen consumer and are exercised only
by tests. Section 31 lists them as expected categories, so they are in scope, but
the `Pagination` defect above is precisely what building a non-trivial API against
an imagined caller produces; the props of `Pagination` and `Modal` should be
re-reviewed when Issues #21-#23 actually consume them. Two acceptance criteria
also remain open by design: "My Tickets remains a responsive table" has no table
until Issue #22, and `SystemCheck.tsx` is now unrouted, so Lab 1 *tests* remain
valid while the Lab 1 *screen* is no longer reachable in the application.

### 4.5.15 Issue #19 route-focus and shared ARIA fix pass

A follow-up specification-first review reproduced two remaining issues in the
shared frontend foundation: the selector's page-local `POP` check could not
distinguish the document's first entry from a later browser-history return, and
caller-supplied ARIA attributes could overwrite generated error, counter, and
invalid wiring. The checks below were run on 2026-08-23 from `client/`; no
server, Prisma, migration, or database source changed.

| Finding | Fix | Evidence |
| --- | --- | --- |
| Returning to `/requesters` through browser history restored the page without the focus move required for a replaced screen. | Added a persistent route-focus boundary in `App.tsx` that skips the document's initial entry, focuses standalone page mains after changed location entries, and leaves in-shell drawer focus restoration to `AppShell`. Removed the page-local `useNavigationType()` branch. | `ApplicationShell.test.tsx` — "moves focus to the selector when browser history returns there" plus the existing cold-load, guard-redirect, Change Requester, and drawer-focus regressions. |
| `...rest` could overwrite generated `aria-describedby` and `aria-invalid` attributes on `TextInput`, `Select`, and `Textarea`. | Destructured caller ARIA attributes, merged external descriptions with generated IDs, and made an existing field error win over a caller-supplied invalid value. | `SharedComponents.test.tsx` — "preserves external descriptions without losing generated error wiring" covers all three editable controls, including error, counter, and invalid-state assertions. |

| Check | Command | Environment / target | Result |
| --- | --- | --- | --- |
| Issue #19 focused gate | `npm test -- --run tests/lab-02/ApplicationShell.test.tsx tests/lab-02/SharedComponents.test.tsx` | `client/` | Passed — 2 files, 86 tests. |
| Frontend full test suite | `npm test -- --run` | `client/` | Passed — 4 files, 92 tests. |
| Frontend typecheck/build | `npm run build` | `client/` | Passed — TypeScript and Vite production build. |
| Backend build | `npm run build` | `server/` | Passed. |
| Diff hygiene | `git diff --check` | repository | Passed. |

Responsive and visual browser coverage was intentionally not run for this
follow-up, per the current task direction; it remains assigned to Issue #25.

### 4.5.16 Issue #19 error-route focus and tooltip evidence fix pass

The remaining focused review found that the standalone `/error` page was not a
target for the persistent route-focus boundary, and that the mobile navigation
icon button's keyboard tooltip behavior was implemented but only covered by a
hover test. The checks below were run on 2026-08-23; manual and responsive
browser coverage remains intentionally deferred per the current task direction.

| Finding | Fix | Evidence |
| --- | --- | --- |
| Client-side navigation to `/error` could leave focus on the removed trigger because its standalone `<main>` lacked the focus target used by `RouteFocusManager`. | Added `tabIndex={-1}` to the standalone error main. | `ApplicationShell.test.tsx` — "moves focus to the standalone error page after client-side navigation". |
| The mobile navigation icon button's `IconButton` tooltip was verified for hover but not keyboard focus and blur. | Extended the navigation-toggle test to assert tooltip visibility on focus and removal on blur. | `ApplicationShell.test.tsx` — UI-32/UI-37 accessibility foundation test. |

| Check | Command | Environment / target | Result |
| --- | --- | --- | --- |
| Issue #19 focused gate | `npm test -- --run tests/lab-02/ApplicationShell.test.tsx tests/lab-02/SharedComponents.test.tsx` | `client/` | Passed — 2 files, 87 tests. |
| Frontend full test suite | `npm test -- --run` | `client/` | Passed — 4 files, 93 tests. |
| Frontend typecheck/build | `npm run build` | `client/` | Passed — TypeScript and Vite production build. |
| Backend build | `npm run build` | `server/` | Passed. |
| Diff hygiene | `git diff --check` | repository | Passed. |

### 4.5.17 Issue #19 final review synchronization

A documentation-only synchronization pass aligned the Issue #19 acceptance
wording with the #19/#22/#25 ownership boundary and brought the current UI
traceability and the Lab 2 AI-use counts in line with the tests that already
exist. No application, schema, migration, dependency, or database source
changed, so no database target was involved. The checks below were run on
2026-08-23 from the listed directories.

Scope:

- synchronized Issue #19 acceptance wording with the #19/#22/#25 ownership boundary (shell/responsive foundation under #19, API-backed My Tickets under #22, final Playwright responsive/visual verification under #25);
- synchronized the current UI-05, UI-31, and UI-35 traceability rows with the tests that already exist in `ApplicationShell.test.tsx`;
- corrected the Lab 2 AI-use prompt/table counts;
- no My Tickets feature implementation or final Playwright visual verification was added.

| Check | Command | Environment / target | Result |
| --- | --- | --- | --- |
| Issue #19 focused gate | `npm test -- --run tests/lab-02/ApplicationShell.test.tsx tests/lab-02/SharedComponents.test.tsx` | `client/` | Passed — 2 files, 87 tests. |
| Frontend full test suite | `npm test -- --run` | `client/` | Passed — 4 files, 93 tests. |
| Frontend typecheck/build | `npm run build` | `client/` | Passed — TypeScript and Vite production build. |
| Backend build | `npm run build` | `server/` | Passed. |
| Diff hygiene | `git diff --check` | repository | Passed. |

Responsive and visual browser coverage was intentionally not run for this
documentation pass; it remains assigned to Issue #25.

### 4.5.18 Issue #20 final verification evidence

The following checks were run on 2026-08-24 from the listed package
directories. The disposable PostgreSQL password is intentionally redacted. Two
disposable databases on the same throwaway PostgreSQL 16 instance at
`localhost:55432` were used - `toktickit_lab2_test` for `TEST_DATABASE_URL` and
`toktickit_lab1_dev` for `DATABASE_URL`/`DIRECT_URL`, migrated and seeded first,
for the reason given in Section 4.5. The normal development database was never
used, migrated, seeded, or reset.

| Check | Command | Environment / target | Result |
| --- | --- | --- | --- |
| Disposable Lab 1 target migration | `DATABASE_URL=<lab1_dev_url> DIRECT_URL=<same> npx prisma migrate deploy` | Disposable `toktickit_lab1_dev` | Passed — 2 migrations found, no pending migrations to apply. |
| Disposable Lab 1 target seed | `DATABASE_URL=<lab1_dev_url> DIRECT_URL=<same> npm run prisma:seed` | Disposable `toktickit_lab1_dev` | Passed — seeded 4 categories, 7 related systems, and 5 development requesters. |
| Issue #20 focused gate | `npm test -- tests/lab-02/DevelopmentRequesterService.test.ts tests/lab-02/requester-context.api.test.ts tests/lab-02/reference-data.api.test.ts tests/lab-02/cors.api.test.ts tests/lab-02/error-contract.api.test.ts tests/lab-02/transport-hardening.api.test.ts` | `server/`; Prisma is mocked in every API file, so no database target was involved | Passed — 6 files, 44 tests. |
| Lab 1 regression | `NODE_ENV=test DATABASE_URL=<lab1_dev_url> DIRECT_URL=<same> TEST_DATABASE_URL=<lab2_test_url> npm test -- tests/lab-01/categories.test.ts tests/lab-01/health.test.ts` | Disposable `toktickit_lab1_dev` | Passed — 2 files, 2 tests. `GET /api/categories` still returns exactly the four seeded Categories once the test supplies a valid `X-Requester-Id`, so the guard did not reshape the Lab 1 payload. |
| Full server suite, single invocation | `NODE_ENV=test DATABASE_URL=<lab1_dev_url> DIRECT_URL=<same> TEST_DATABASE_URL=<lab2_test_url> npm test` | Both disposable databases | Passed — 14 files, 74 tests. This invocation also re-ran the guarded PostgreSQL files (`migration-upgrade`, `transactions`, `idempotency`, `testDatabase`) against `toktickit_lab2_test`; they passed unchanged, which is expected because Issue #20 touched no schema, migration, or seed file. |
| Backend build | `npm run build` | `server/` | Passed — `tsc` completed with no output. |
| Issue #20 client focused gate | `npm test -- tests/lab-02/RequesterSelection.test.tsx tests/lab-02/ApplicationShell.test.tsx` | `client/` | Passed — 2 files, 65 tests. |
| Frontend full test suite | `npm test` | `client/` | Passed — 5 files, 106 tests. |
| Frontend typecheck/build | `npm run build` | `client/` | Passed — TypeScript and the Vite production build. |
| Diff hygiene | `git diff --check`, `git status --short`, `git diff --stat` | repository | Passed — no whitespace errors. At the time of the run, before this documentation pass, the tree held 7 modified files and 11 new paths, all inside `server/src`, `server/tests`, `client/src`, `client/tests`, `server/.env.example`, and `README.md`; `docs/lab-02/tests.md` and `docs/lab-02/ai-use.md` were modified afterwards by this section. |
| Manual browser smoke | `npm run dev` in `server/` and in `client/`, then `http://localhost:5173/` driven by hand | Disposable `toktickit_lab1_dev`, Chrome-class browser | Passed — the developer confirmed all five Step 3 behaviors on 2026-08-24: `/` redirected to `/requesters`; the dropdown listed the four active seeded names and `Eve Wilson`, the seeded inactive Requester, was absent; `Continue` stayed disabled until a name was selected; `Continue` navigated to `/tickets` with the chosen name shown in the sidebar; and `Change Requester` returned to `/requesters`. |
| Runtime API smoke | `curl -i` against `/api/requesters`, `/api/categories`, `/api/health` with `npm run dev` running in `server/` (`NODE_ENV=development`, `CORS_ALLOWED_ORIGINS=http://localhost:5173`) and in `client/` | Disposable `toktickit_lab1_dev` | Passed — `/api/requesters` returned `200` with `Cache-Control: no-store` and an `X-Request-Id`, and its body listed exactly the four active seeded Requesters (`Eve Wilson`, the seeded inactive Requester, was absent). `/api/categories` returned `400` `BAD_REQUEST` with the `details` marker `{ "field": "X-Requester-Id", "message": "The requester context is invalid." }`. `/api/health` returned `200` and stayed exempt from the guard. |

The browser half of the Step 3 smoke check was driven **manually by the
developer**, not by automation: this environment has no browser driver and
Playwright remains out of scope for Issue #20. Both dev servers were started
against the disposable Lab 1 database and confirmed listening on
`http://localhost:3000` and `http://localhost:5173`. All five behaviors are also
asserted by `client/tests/lab-02/RequesterSelection.test.tsx` and
`client/tests/lab-02/ApplicationShell.test.tsx`, which passed above, so the
manual pass corroborates the automated coverage rather than replacing it.

Explicitly not run by this Issue:

- no new run of the guarded PostgreSQL suite was performed on its own; it was
  exercised only as part of the single full-server-suite invocation above, and
  Issue #20 changed no schema, migration, or seed file;
- responsive and visual browser evidence (RESP-01-03, VIS-01-03) remains owned
  by Issue #25 and was not produced here;
- no Playwright, MSW, or end-to-end test was added or run.

### 4.5.19 Issue #20 contract-cleanup verification evidence

A contract-cleanup pass on 2026-08-25 closed the remaining Issue #20 gaps:
requester-context failures now carry the protocol-specific code
`REQUESTER_CONTEXT_INVALID` instead of being an ordinary
`BAD_REQUEST`/`VALIDATION_ERROR` marked by a `details` field, the Issue #20 close
gate gained `reference-data.api.test.ts`, and the shared transport ownership plus
the bootstrap/requester-scoped `Vary` split were stated explicitly. The
`details`-marker evidence recorded in Section 4.5.18 describes the superseded
contract and is kept as the historical record of that run.

| Check | Command | Environment / target | Result |
| --- | --- | --- | --- |
| Issue #20 server focused gate | `npm test -- tests/lab-02/DevelopmentRequesterService.test.ts tests/lab-02/requester-context.api.test.ts tests/lab-02/reference-data.api.test.ts tests/lab-02/cors.api.test.ts tests/lab-02/error-contract.api.test.ts tests/lab-02/transport-hardening.api.test.ts` | `server/`; Prisma is mocked in every API file, so no database target was involved | Passed — 6 files, 46 tests. |
| Issue #20 client focused gate | `npm test -- tests/lab-02/RequesterSelection.test.tsx tests/lab-02/ApplicationShell.test.tsx` | `client/` | Passed — 2 files, 66 tests. |
| Full Lab 2 server suite | `npm test -- tests/lab-02/` | `server/` | Passed — 12 files, 74 tests. |
| Full Lab 2 client suite | `npm test -- tests/lab-02/` | `client/` | Passed — 3 files, 101 tests. |
| Backend build | `npm run build` | `server/` | Passed — `tsc` completed with no output. |
| Frontend typecheck/build | `npm run build` | `client/` | Passed — TypeScript and the Vite production build. |

Not re-run in this pass: the guarded PostgreSQL suites, the manual browser smoke
check, and the runtime `curl` smoke check. This pass changed no schema,
migration, seed, or UI-flow behavior; the one runtime change is the error `code`
on requester-context rejections, which the automated gates above assert directly.

### 4.5.20 Issue #21 verification evidence

The following checks were run on 2026-08-25 from the listed package
directories, against the same two disposable databases described in Section 4.5.
The normal development database was never used, migrated, seeded, or reset.

| Check | Command | Environment / target | Result |
| --- | --- | --- | --- |
| Issue #21 server focused gate | `npm test -- tests/lab-02/TicketNumber.test.ts tests/lab-02/TicketService.test.ts tests/lab-02/IdempotencyService.test.ts tests/lab-02/tickets.api.test.ts tests/lab-02/create-ticket.api.test.ts tests/lab-02/ticket-idempotency.api.test.ts tests/lab-02/postgres/idempotency.postgres.test.ts tests/lab-02/postgres/transactions.postgres.test.ts` | `server/`; the four API files mock Prisma, the two PostgreSQL files run against `toktickit_lab2_test` | Passed — 8 files, 166 tests. |
| Issue #21 client focused gate | `npm test -- tests/lab-02/CreateTicket.test.tsx` | `client/` | Passed — 1 file, 33 tests. |
| Full server suite | `npm test -- tests/` | Both disposable databases | Passed — 20 files, 239 tests. |
| Full client suite | `npm test -- tests/` | `client/` | Passed — 6 files, 140 tests. |
| Lab 1 regression | `npm test -- tests/lab-01/` | `server/` and `client/` | Passed — server 2 files / 2 tests, client 2 files / 6 tests. `GET /api/categories` still returns the four seeded Categories in id order once a valid `X-Requester-Id` is supplied; the Lab 1 assertion now checks that identity rather than the exact field set, because Issue #21 widened the body to the full `CategoryDTO`. |
| Backend build | `npm run build` | `server/` | Passed — `tsc` completed with no output. |
| Frontend typecheck/build | `npm run build` | `client/` | Passed — TypeScript and the Vite production build. |

The PostgreSQL concurrency rows (PG-01, PG-02, PG-03, PG-09, PG-11, PG-12) drive
`runCreateTicket`, the same orchestration a real `POST /api/tickets` uses, over
separate `PrismaClient` connections, so the unique-claim race, the conditional
reclaim, and `IDEMPOTENCY-FENCING-A` are decided by PostgreSQL rather than by a
mock. PG-03 injects its failure at the Attachment-binding step, after the claim
is fenced and the Ticket row is inserted, so the rollback under test is a real
rollback of a partially written transaction.

One Issue #21 acceptance bullet combined two halves that Issue #21 cannot close
on its own, so each half was reassigned to the Issue that owns it rather than
left standing as an unmeetable criterion:

- Create Ticket navigates to `/tickets/:publicId` and carries the generated
  Ticket Number to the destination, which is covered here. Rendering that Ticket
  Number and the non-intrusive success confirmation needs Ticket Detail and is
  now an Issue #23 acceptance criterion.
- The untouched-empty direct cancel, the dirty/Pending discard confirmation, and
  the confirmed discard clearing the draft and any recovery record are covered
  here. The best-effort Pending cleanup call through
  `DELETE /api/attachments/collection` needs that endpoint and is now an Issue
  #24 acceptance criterion.

Explicitly not delivered by this Issue:

- the Attachment upload lifecycle, its Create Ticket cards/states/Retry, and
  `DELETE /api/attachments/collection` remain owned by Issue #24. Create Ticket
  carries the final prepared Pending `attachmentIds` and the backend binds them,
  which is the seam that Issue depends on;
- `GET /api/tickets` and `GET /api/tickets/:publicId` remain owned by Issues #22
  and #23, so the Create Ticket success navigation lands on the Issue #23
  placeholder;
- responsive and visual browser evidence (RESP-01-03, VIS-01-03) and all
  Playwright/MSW work remain owned by Issue #25; none was added or run here.

## 5. Reusable QueryBuilder Test Principle

The global QueryBuilder follows the reusable infrastructure/repository utility pattern:

```text
validated / normalized request features
        ↓
resource repository/service
        ├── fixed resource predicates
        ├── QueryBuilder filter expression
        ├── QueryBuilder multi-field search expression
        ├── QueryBuilder order expression
        └── resource-owned pagination
        ↓
Prisma
```

The QueryBuilder is responsible for generic expression construction from already validated and typed inputs. Its approved generic condition capability includes:

```text
CONTAINS
STARTWITH
ENDWITH
EQUAL
NOTEQUAL
GREATER
LESSER
GREATEROREQUAL
LESSEROREQUAL
ISNULL
ISNOTNULL
IN
```

It must not silently authorize arbitrary client field names or contain Ticket-specific ownership/`deleted`/Priority rules. Generic support for an operator does not make that operator valid for every Ticket field.

The Ticket query validator is the authoritative owner of the Ticket field whitelist, the exact field/condition permission matrix, typed conversion, nullable/non-nullable compatibility, enum values, `IN` array shape, and the `ticketNumber`/`summary`/`description` search-field whitelist. It also remains the owner of Ticket-specific requester/`deleted` predicates, semantic Priority ordering, pagination, and other business rules. Resource-specific validation/normalization must happen before untrusted query values reach QueryBuilder/Prisma. Frontend filter restrictions are UX-only; direct API clients must receive `400` for disallowed Ticket combinations before repository/Prisma execution.

For Ticket, the validator permits:

```text
string: ticketNumber, summary, description -> CONTAINS, STARTWITH, ENDWITH, EQUAL, NOTEQUAL, IN
reference/FK: categoryId, relatedSystemId -> EQUAL, NOTEQUAL, IN
enum: requestedPriority, currentStatus -> EQUAL, NOTEQUAL, IN
datetime: createdAt, updatedAt -> EQUAL, NOTEQUAL, GREATER, LESSER, GREATEROREQUAL, LESSEROREQUAL
```

No current Ticket filter field is nullable, so `ISNULL` and `ISNOTNULL` remain generic QueryBuilder test cases but are invalid Ticket filter operations.

For example, the generic QueryBuilder may construct an `ISNULL` expression from
validated internal input, but `summary + ISNULL` is invalid for the Lab 2 Ticket
resource. The Ticket validator must reject it with `400 VALIDATION_ERROR` before
QueryBuilder/Prisma receives the request. Generic QueryBuilder tests must still
cover `ISNULL`, `ISNOTNULL`, and every other approved generic operator.

> **Planned-test lifecycle**
>
> All tests listed below are approved Lab 2 implementation evidence plans unless
> their `Final` value records an actual execution result. `Not Run` means the
> planned test has not yet produced final execution evidence. Each owning
> implementation Issue is responsible for creating or updating its concrete test
> file, implementing its assigned test path, and making the test pass before the
> Issue is considered Done. A test is not implemented merely because its row
> exists in `tests.md`.
>
> Issue #25 reruns the completed system for final cross-feature, responsive,
> visual, and regression verification. It does not replace focused Issue-level
> close-gate tests owned by earlier Issues.

## 6. Planned Unit Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
| --- | --- | --- | --- | --- | --- | --- |
| UNIT-01 | Unit | FR-01–06, BR-12–17, AC-02, AC-05, AC-41 | DevelopmentRequesterService: active/non-deleted retrieval and requester-context validation. | Returns only valid active requesters; rejects unknown/inactive/deleted contexts with safe domain errors. | tests/lab-02/DevelopmentRequesterService.test.ts | Passed |
| UNIT-02 | Unit | BR-07, BR-71–73, AC-10 | CategoryService: selectable master behavior and historical lookup behavior. | Active/non-deleted categories are selectable; inactive/deleted categories are rejected for new Ticket creation while historical metadata can still resolve. | tests/lab-02/CategoryService.test.ts | Passed — 3 tests |
| UNIT-03 | Unit | BR-08, BR-71–73, AC-10 | RelatedSystemService: selectable master behavior and historical lookup behavior. | Active/non-deleted systems are selectable; inactive/deleted systems are rejected for new Ticket creation while historical metadata can still resolve. | tests/lab-02/RelatedSystemService.test.ts | Passed — 3 tests |
| UNIT-04 | Unit | BR-01–03, AC-07 | Ticket Number formatting/generation helper: Bangkok date, format, uppercase 12-hex suffix, deterministic injected time/random behavior. | Generated candidate matches `TKT-YYYYMMDD-RRRRRRRRRRRR`; business date uses Asia/Bangkok. Persistence/collision retry is not owned by this helper. | tests/lab-02/TicketNumber.test.ts | Passed |
| UNIT-05 | Unit | FR-07–12, BR-01–25, AC-06–12 | TicketService: creation, Pending-Attachment validation/binding, trimming, NEW status, requester/audit derivation, replay-first ordering, collision retry, ownership, and detail. | A new attempt atomically creates the Ticket and binds every referenced Pending row; completed same-hash replay returns the existing Ticket without mutable Pending validation; collision retries remain bounded. | tests/lab-02/TicketService.test.ts | Passed |
| UNIT-06 | Unit | BR-26–43, BR-75, AC-24–30, AC-55 | Ticket query request validator/normalizer: Ticket field whitelist, exact condition matrix, searchFields whitelist/uniqueness, typed number/date/enum/IN conversion, nullable compatibility, query-complexity bounds, invalid rejection, and direct-client boundary. | Only Ticket-approved bounded input reaches QueryBuilder/Prisma; search >200 chars, >20 filters, duplicate search fields, `IN` outside 1–100 unique values, invalid combinations/enums/shapes/conversions fail before data access. | tests/lab-02/TicketQueryValidator.test.ts | Not Run |
| UNIT-07 | Unit | BR-28–33, DoD | Global QueryBuilder filter construction for `CONTAINS`, `STARTWITH`, `ENDWITH`, `EQUAL`, `NOTEQUAL`, `GREATER`, `LESSER`, `GREATEROREQUAL`, `LESSEROREQUAL`, `ISNULL`, `ISNOTNULL`, and `IN`. | Representative validated/typed inputs for every approved generic operator produce the expected reusable Prisma filter expression, including both null operators and `IN`; no Ticket field/permission rules are embedded here. | tests/lab-02/QueryBuilder.test.ts | Not Run |
| UNIT-08 | Unit | BR-26, BR-30, AC-24 | Global QueryBuilder multi-field search construction after resource validation. | The resource-approved search fields are supplied as validated inputs, are OR-combined, and the search fragment can be AND-combined with resource filters/fixed predicates. | tests/lab-02/QueryBuilder.test.ts | Not Run |
| UNIT-09 | Unit | BR-34–35, AC-27–28 | Global QueryBuilder generic order construction plus resource-owned Ticket sort translation. | Generic asc/desc ordering is constructed correctly; Ticket-specific semantic priority ordering remains outside generic hard-coded QueryBuilder domain logic. | tests/lab-02/QueryBuilder.test.ts | Not Run |
| UNIT-10 | Unit | BR-18–24, BR-82, AC-11–12, AC-42–43, AC-51–52, AC-65 | IdempotencyService: requester+key scope, exact canonical SHA-256 hashing, fresh/stale `PROCESSING` behavior, fencing ownership, valid state transition, current-state replay, logical expiry boundaries, concurrency, and controlled-failure rules. | Canonical UTF-8 SHA-256 is deterministic 64-character lowercase hex; UUIDs are normalized to canonical lowercase strings, duplicate values fail, and sorting is lexicographically ascending; `[A,B] == [B,A]`, `[A,B] != [A,C]`; fresh means `now < processingStartedAt + 300 seconds`, stale/reclaim-eligible means `now >= processingStartedAt + 300 seconds`, so `4m 59.999s` is fresh and `5m 00.000s` is stale; fresh same hash waits and fresh different hash conflicts; stale same hash conditionally reclaims and resets `processingStartedAt`, stale different hash conflicts without deletion; losing concurrent reclaimers resume wait/replay; exact status/hash/lease ownership passes fencing while any mismatch produces no mutation and resumes resolution; COMPLETED same hash replays and different hash conflicts; valid PROCESSING transitions to COMPLETED; later resource mutations do not change the original hash; 24-hour completed expiry remains independent. | tests/lab-02/IdempotencyService.test.ts | Passed |
| UNIT-11 | Unit | BR-44–50, BR-61–64, BR-77, AC-13–16, AC-56, AC-58 | AttachmentService pre-upload validation: Pending creation, allowed extension/case, exact byte size, cross-platform basename/control/UTF-8-byte validation, MIME derivation, and duplicate original names. | Valid upload creates owned Pending metadata; extension uses validated basename; zero-byte and `5,000,001`-byte files fail; `4,999,999`-byte and `5,000,000`-byte files pass; unsafe/>255-byte names fail; MIME derives from extension. | tests/lab-02/AttachmentService.test.ts | Not Run |
| UNIT-12 | Unit | BR-47, BR-50–56, AC-06, AC-17–18, AC-44 | Attachment lifecycle, 24-hour expiry, Ticket binding, deterministic processing, direct existing-Ticket add, and active-five limit. | Pending binds once and becomes Active; expiry targets only unbound Pending; direct existing-Ticket upload creates Active; Removed rows do not count toward five. | tests/lab-02/AttachmentService.test.ts | Not Run |
| UNIT-13 | Unit | BR-59–60, BR-65, AC-20, AC-22 | Attachment metadata/preview/download access rules. | Pending and Active owned binary access is allowed; Removed metadata remains readable but binary access is Gone; unavailable/cross-scope resources map to the same Not Found result. | tests/lab-02/AttachmentService.test.ts | Not Run |
| UNIT-14 | Unit | BR-57–59, AC-19, AC-22 | Unified collection deletion and recovery safety. | Pending items hard-delete with ignored reason; Active items soft-remove with valid reason; mixed batch is all-or-nothing; invalid/unavailable/Removed item causes no mutation; Pending cleanup cannot remove Active evidence. | tests/lab-02/AttachmentService.test.ts | Not Run |
| UNIT-15 | Unit | BR-22–25, BR-52, AC-43–45 | Create-flow pre-upload, submit gate, compensation, and ambiguous recovery sequencing. | Valid files pre-upload Pending; unresolved intended files block submit until Retry/remove; 4xx retains Pending; 5xx cleanup is race-safe; same-key replay recovers Active bindings without re-upload. | tests/lab-02/TicketService.test.ts | Partial — the submit gate, 4xx retention, and same-key replay recovery are covered by `TicketService.test.ts` and `CreateTicket.test.tsx`; the pre-upload and compensation halves need the Attachment upload lifecycle and are owned by Issue #24 |
| UNIT-16 | Unit | BR-80–82, AC-48, AC-52 | Maintenance service/CLI orchestration: one cutoff, 100-row batches, repeat-until-empty, expired Pending and completed Idempotency selection, logical-expiry boundary, retry safety, and summary logging. | Only eligible Pending rows and logically expired COMPLETED records are requested for cleanup; reruns are idempotent; exact-expiry completed rows qualify; PROCESSING rows are never selected/deleted/reclaimed because stale reclaim is request-time behavior; no in-process timer or HTTP cleanup route is introduced. | tests/lab-02/MaintenanceService.test.ts | Not Run |

## 7. Planned API / Integration Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
| --- | --- | --- | --- | --- | --- | --- |
| API-01 | API | AC-05, AC-41, AC-46 | Requester-context middleware and bootstrap exception. | `GET /api/requesters` works without `X-Requester-Id`; every other Lab 2 endpoint rejects missing, malformed, non-positive, unknown, inactive, or deleted context with the safe `400 REQUESTER_CONTEXT_INVALID` envelope and one generic message for all six cases. | tests/lab-02/requester-context.api.test.ts | Passed |
| API-02 | API | AC-02, AC-41 | Retrieve active Development Requesters. | 200 raw array; only active/non-deleted requesters; full DTO shape; no requester header required. | tests/lab-02/reference-data.api.test.ts | Passed |
| API-03 | API | BR-07, BR-71–73 | Retrieve active Categories. | 200 raw array; only active/non-deleted categories; valid requester header required. | tests/lab-02/reference-data.api.test.ts | Passed |
| API-04 | API | BR-08, BR-71–73 | Retrieve active Related Systems. | 200 raw array; only active/non-deleted systems; valid requester header required. | tests/lab-02/reference-data.api.test.ts | Passed |
| API-05 | API | AC-06, AC-07 | Handout delivery smoke case: create valid Ticket with omitted/empty or prepared `attachmentIds`. | 201 full TicketDTO; omitted/empty yields no initial Attachments, while supplied Pending IDs are all bound Active in the Ticket-create transaction; status/requester/Ticket Number are backend-derived. | tests/lab-02/tickets.api.test.ts | Passed |
| API-06 | API | AC-08 | Summary validation boundaries and trimming. | Missing/blank/2/151+ invalid; 3 and 150 valid; safe 400 validation details; invalid Ticket not created. | tests/lab-02/create-ticket.api.test.ts | Passed |
| API-07 | API | AC-09 | Description validation boundaries and trimming. | Missing/blank/9/2001+ invalid; 10 and 2000 valid; safe 400 validation details. | tests/lab-02/create-ticket.api.test.ts | Passed |
| API-08 | API | AC-10 | Category validation. | Missing, malformed, unknown, inactive, or deleted Category fails safely; valid active Category proceeds. | tests/lab-02/create-ticket.api.test.ts | Passed |
| API-09 | API | AC-10 | Related System validation. | Missing, malformed, unknown, inactive, or deleted system fails safely; valid active system proceeds. | tests/lab-02/create-ticket.api.test.ts | Passed |
| API-10 | API | AC-10 | Requested Priority validation. | Missing/unknown values fail; LOW/MEDIUM/HIGH accepted; no default is silently applied. | tests/lab-02/create-ticket.api.test.ts | Passed |
| API-11 | API | FR-28–29, BR-15–17 | Backend-managed Ticket fields / requester derivation. | Client cannot control requester/status/public/audit/deletion/generated values; ownership comes from `X-Requester-Id`. | tests/lab-02/create-ticket.api.test.ts | Passed |
| API-12 | API | BR-18 | Idempotency-Key required UUID validation. | Missing or malformed key returns safe 400 before Ticket creation. | tests/lab-02/ticket-idempotency.api.test.ts | Passed |
| API-13 | API | AC-11, AC-51, AC-65 | Completed same-key/same-canonical-payload replay after bindings and later Attachment mutations. | First request owns PROCESSING, binds Pending rows, transitions COMPLETED, and returns 201; replay returns 200 for the same Ticket identity with current TicketDTO after Pending→Active, later add, and later remove; original hash remains unchanged, mutable Pending validation is not rerun, and no duplicate is created. | tests/lab-02/ticket-idempotency.api.test.ts | Passed |
| API-14 | API | AC-12 | Same requester/key with different Ticket fields or logical Attachment-ID set. | 409 `IDEMPOTENCY_CONFLICT`; no second Ticket or incorrect binding is created. | tests/lab-02/ticket-idempotency.api.test.ts | Passed |
| API-15 | API | BR-21 | Same UUID under different Requesters. | Same Idempotency-Key value is allowed in separate requester scopes. | tests/lab-02/ticket-idempotency.api.test.ts | Passed |
| API-16 | API | BR-18–21, AC-65 | Canonical Ticket request equivalence, SHA-256 output, and validation. | Stable canonical UTF-8 hashing yields deterministic 64-character lowercase hex; UUIDs are normalized to canonical lowercase strings and sorted lexicographically ascending before hashing; `[A,B]` equals `[B,A]`; `[A,C]` differs; duplicate or malformed body IDs return 400 rather than silent deduplication. | tests/lab-02/ticket-idempotency.api.test.ts | Passed |
| API-17 | API | AC-42, AC-65 | Concurrent claim behavior with Pending references. | Exactly one request establishes PROCESSING before mutable validation; a same-hash contender waits/replays, a different-hash contender returns 409, one Ticket workflow completes, and Attachments bind once using 201/200 semantics. | tests/lab-02/ticket-idempotency.api.test.ts | Passed |
| API-18 | API | BR-21–24 | Controlled failed Ticket/binding attempt is not completed. | Confirmed transaction failure leaves no COMPLETED result, Ticket, or partial binding; its owned PROCESSING claim is safely removed rather than changed to FAILED, and unchanged retry may execute again with Pending IDs. An abandoned claim fixture has no committed Ticket or Attachment mutation. | tests/lab-02/ticket-idempotency.api.test.ts | Passed |
| API-19 | API | BR-22, AC-42, AC-65 | Fenced new/reclaimed-attempt final mutable-state validation. | The resource transaction locks the claim, verifies PROCESSING + expected hash + exact retained `processingStartedAt`, and holds the lock through commit/rollback; only a matching owner performs final Category/System/Pending validation and mutation; a mismatch performs no mutation and resumes wait/replay; completed replay bypasses current mutable validation; missing/cross-scope Pending safely 404s, owned non-bindable conflicts, and controlled 4xx is not completed. | tests/lab-02/ticket-idempotency.api.test.ts | Passed |
| API-20 | API | BR-23–24 | Ambiguous 5xx recovery and compensation safety. | Same-key unchanged retry may recover a committed Ticket; Pending cleanup hard-deletes only still-Pending rows and cannot soft-remove now-Active evidence. | tests/lab-02/ticket-idempotency.api.test.ts | Partial — the same-key unchanged retry recovering a committed Ticket is covered; the Pending-cleanup half needs `DELETE /api/attachments/collection` and is owned by Issue #24 |
| API-21 | API | AC-21 | My Tickets ownership, non-deleted scope, and `TicketListItemDTO` projection. | Only current-requester non-deleted Tickets are returned; every required list field is present; `description`, requester fields, `attachments`, `createdBy`, `updatedBy`, `updatedAt`, and `deleted` are absent. | tests/lab-02/my-tickets.api.test.ts | Not Run |
| API-22 | API | AC-24 | Search matching and normalization. | Case-insensitive search, trimming, supplied fields OR together, including a Description-only match even though Description is absent from `TicketListItemDTO`; blank search = no search; searchFields without active search ignored. | tests/lab-02/my-tickets.api.test.ts | Not Run |
| API-23 | API | AC-24 | searchFields validation. | Nonblank search without searchFields and unknown/non-whitelisted active search field return 400. | tests/lab-02/my-tickets.api.test.ts | Not Run |
| API-24 | API | AC-25 | Valid URL-encoded JSON filters. | Valid filters are parsed/normalized and forwarded as typed expressions. | tests/lab-02/my-tickets.api.test.ts | Not Run |
| API-25 | API | AC-26 | Malformed filters JSON / non-array root. | 400 Validation Error before query execution. | tests/lab-02/my-tickets.api.test.ts | Not Run |
| API-26 | API | AC-26 | Unsupported filter field. | 400 before repository/Prisma call. | tests/lab-02/my-tickets.api.test.ts | Not Run |
| API-27 | API | AC-26 | Disallowed Ticket field/condition combinations. | Direct API requests for every representative disallowed Ticket pairing, including generic-compatible but Ticket-forbidden operators and `ISNULL`/`ISNOTNULL`, return 400 before QueryBuilder/Prisma data-access execution; frontend restrictions are not treated as sufficient validation. | tests/lab-02/my-tickets.api.test.ts | Not Run |
| API-28 | API | AC-25–26 | Invalid `IN` values. | Empty/non-array/comma-string `IN` value fails; typed non-empty array accepted. | tests/lab-02/my-tickets.api.test.ts | Not Run |
| API-29 | API | AC-24–25 | Search/filter logical composition. | Search fields form one OR group; search group and each filter are AND-combined; multiple filters use AND. | tests/lab-02/my-tickets.api.test.ts | Not Run |
| API-30 | API | AC-27–28 | Ticket sorting. | Default `createdAt DESC, id DESC`; approved Ticket Number/Summary directions; semantic Priority order; malformed/unsupported sort returns 400. | tests/lab-02/my-tickets.api.test.ts | Not Run |
| API-31 | API | AC-29 | Pagination defaults and valid values. | Defaults page 1/size 10; pageSize 1–100 accepted. | tests/lab-02/my-tickets.api.test.ts | Not Run |
| API-32 | API | AC-29 | Invalid pagination values. | pageNumber <1, pageSize outside 1–100, and explicitly blank/invalid parse values return 400. | tests/lab-02/my-tickets.api.test.ts | Not Run |
| API-33 | API | AC-30 | Beyond-final-page behavior. | 200 with empty array; not treated as error. | tests/lab-02/my-tickets.api.test.ts | Not Run |
| API-34 | API | AC-30 | `X-Pagination` response contract. | Header contains pageNumber/pageSize/totalItems/totalPages/hasPreviousPage/hasNextPage with correct zero-item behavior. | tests/lab-02/my-tickets.api.test.ts | Not Run |
| API-35 | API | AC-21 | Owned Ticket Detail. | 200 complete full TicketDTO for current requester's non-deleted Ticket, including Description, Requester, Attachment, and audit/lifecycle fields. | tests/lab-02/ticket-detail.api.test.ts | Not Run |
| API-36 | API | AC-22 | Ticket outside current Requester scope. | Same centralized 404 as unavailable Ticket; no owner identity or protected resource data. | tests/lab-02/ticket-detail.api.test.ts | Not Run |
| API-37 | API | AC-23 | Missing, malformed, or logically deleted Ticket route identifier. | Centralized 404 behavior for all three cases. | tests/lab-02/ticket-detail.api.test.ts | Not Run |
| API-38 | API | BR-72–73 | Historical Category/System metadata on existing Ticket. | Full TicketDTO and TicketListItemDTO still return historical Category/System names after the master becomes inactive/logically deleted; such masters remain excluded from new-attempt selection validation. | tests/lab-02/ticket-detail.api.test.ts; tests/lab-02/my-tickets.api.test.ts | Not Run |
| API-39 | API | AC-13 | Standalone `POST /api/attachments` pre-upload. | Exactly one `file` returns 201 full Pending AttachmentDTO with opaque storage key, `ticketPublicId: null`, deleted false, derived MIME, and audit metadata. | tests/lab-02/attachments.api.test.ts | Not Run |
| API-40 | API | AC-14 | Unsupported Attachment extension. | 415 `UNSUPPORTED_MEDIA_TYPE`; no usable Attachment created. | tests/lab-02/attachments.api.test.ts | Not Run |
| API-41 | API | AC-15 | Attachment size boundaries. | `4,999,999` and `5,000,000` bytes are accepted when other rules pass; `5,000,001` bytes returns `413 PAYLOAD_TOO_LARGE` and creates no usable Attachment. | tests/lab-02/attachments.api.test.ts | Not Run |
| API-42 | API | BR-45 | MIME derived from approved extension. | jpg/jpeg/png/webp/pdf map to backend-approved MIME; multipart MIME is not acceptance authority. | tests/lab-02/attachments.api.test.ts | Not Run |
| API-43 | API | AC-17, AC-48 | Pending expiry selection boundary exposed to maintenance orchestration. | Before 24 hours remains ineligible; at expiry becomes eligible; Active/Removed rows are never selected. HTTP upload routes do not expose cleanup. | tests/lab-02/attachments.api.test.ts; tests/lab-02/MaintenanceService.test.ts | Not Run |
| API-44 | API | FR-24, BR-56 | Add valid Attachment to existing owned Ticket. | 201 AttachmentDTO bound directly to requested owned Ticket. | tests/lab-02/attachments.api.test.ts | Not Run |
| API-45 | API | AC-18 | Five-active Attachment limit and replacement after removal. | At five active attachments add returns 409; after one is soft-removed, one replacement upload succeeds. | tests/lab-02/attachments.api.test.ts | Not Run |
| API-46 | API | AC-22 | Add Attachment to Ticket outside current Requester scope. | Same centralized 404 as unavailable Ticket; no Attachment is bound and no owner/existence detail is disclosed. | tests/lab-02/attachments.api.test.ts | Not Run |
| API-47 | API | AC-23 | Add Attachment to missing/malformed/deleted Ticket. | 404 using centralized not-found behavior. | tests/lab-02/attachments.api.test.ts | Not Run |
| API-48 | API | AC-20, AC-22–23 | Attachment metadata lifecycle. | Pending/Active/Removed owned metadata = 200; Pending has null Ticket public ID; bound states identify Ticket; Removed includes reason/deleted; scope/missing/malformed share safe 404. | tests/lab-02/attachments.api.test.ts | Not Run |
| API-49 | API | AC-20, AC-22–23 | Attachment preview lifecycle. | Pending/Active owned = 200 inline binary; owned Removed = 410; scope/missing/malformed share safe 404. | tests/lab-02/attachments.api.test.ts | Not Run |
| API-50 | API | AC-20, AC-22–23 | Attachment download lifecycle. | Pending/Active owned = 200 attachment binary; owned Removed = 410; scope/missing/malformed share safe 404. | tests/lab-02/attachments.api.test.ts | Not Run |
| API-51 | API | BR-57–58 | Pending Attachment collection cleanup. | 204; owned Pending row and binary are hard-deleted and reason is ignored. | tests/lab-02/attachments.api.test.ts | Not Run |
| API-52 | API | AC-19 | Active Attachment collection removal. | 204; Active row becomes deleted with trimmed reason/audit update while binary/metadata remain retained. | tests/lab-02/attachments.api.test.ts | Not Run |
| API-53 | API | AC-19 | Mixed Pending + Active collection batch. | 204; Pending hard deletion and Active soft removal commit together in deterministic processing order. | tests/lab-02/attachments.api.test.ts | Not Run |
| API-54 | API | AC-19 | Collection all-or-nothing validation. | Any invalid/unavailable/outside-scope/removed/reason-invalid item means no batch item is mutated; unavailable scope uses 404. | tests/lab-02/attachments.api.test.ts | Not Run |
| API-55 | API | AC-19 | Per-active-item removal reason validation. | Trimmed reason 3–200 accepted; missing/too-short/too-long active reason returns 400 and no mutation. | tests/lab-02/attachments.api.test.ts | Not Run |
| API-56 | API | BR-57 | Duplicate Attachment IDs in collection. | 400 Validation Error; no mutation. | tests/lab-02/attachments.api.test.ts | Not Run |
| API-57 | API | BR-57 | Empty collection items. | 400 Validation Error; no mutation. | tests/lab-02/attachments.api.test.ts | Not Run |
| API-58 | API | BR-57 | Collection larger than 100 items. | 400 Validation Error; no mutation. | tests/lab-02/attachments.api.test.ts | Not Run |
| API-59 | API | AC-23 | Malformed UUID inside collection JSON. | 400 request validation (distinct from malformed public route 404). | tests/lab-02/attachments.api.test.ts | Not Run |
| API-60 | API | AC-19, AC-22 | Item outside current Requester scope in collection. | Same centralized 404 as unavailable item; entire batch remains unchanged and no owner/existence detail is disclosed. | tests/lab-02/attachments.api.test.ts | Not Run |
| API-61 | API | AC-19–20 | Already Removed item in collection. | 404 and entire batch remains unchanged. | tests/lab-02/attachments.api.test.ts | Not Run |
| API-62 | API | AC-39, AC-47 | Centralized error envelope and safe public content. | Representative 400/403/404/409/410/413/415/500 responses contain standard fields; validation details are array; no stack/SQL/Prisma/secrets/binary leakage. | tests/lab-02/error-contract.api.test.ts | Passed |
| API-63 | API | AC-40 | `X-Request-Id` propagation/generation. | Valid incoming UUID is echoed; missing/malformed gets generated UUID; success and error responses include the resolved header. | tests/lab-02/error-contract.api.test.ts | Passed |
| API-64 | API | AC-40 | Request-correlation logging safety using mocked logger/spies. | Logs correlate request ID/method/route/status/safe error info; binary data, secrets, DB URL, and unnecessarily sensitive payload content are not logged. | tests/lab-02/error-contract.api.test.ts | Passed |
| API-65 | API | BR-74 | Ticket deletion route absence and default deletion state. | `DELETE /api/tickets/:publicId` is not registered; a newly created Ticket has `deleted = false`. | tests/lab-02/create-ticket.api.test.ts | Passed |
| API-66 | API | FR-31, BR-40, AC-30, AC-40 | Explicit Lab 2 CORS policy and browser-readable response headers. | Preflight permits `Content-Type`, `X-Requester-Id`, `Idempotency-Key`, and `X-Request-Id`; responses expose both `X-Pagination` and `X-Request-Id`; Ticket-list response includes both readable values. | tests/lab-02/cors.api.test.ts | Partial — the header policy and preflight header list are covered by `cors.api.test.ts`; the Ticket-list `X-Pagination` value needs `GET /api/tickets` and is owned by Issue #22. |
| API-67 | API | BR-16, BR-51, AC-22 | Ticket create references an Attachment outside requester scope. | Same centralized 404 as unavailable; no Ticket or binding is created and owner/existence details are absent. | tests/lab-02/create-ticket.api.test.ts | Passed |
| API-68 | API | AC-55 | Ticket-list query complexity bounds. | Search >200 chars, >20 filters, duplicate searchFields, and `IN` outside 1–100 unique typed values return 400 before QueryBuilder/repository/Prisma. | tests/lab-02/my-tickets.api.test.ts | Not Run |
| API-69 | API | AC-47 | Direct-upload Serializable transaction retry mapping. | Active count and insert run in one PostgreSQL `Serializable` transaction; only supported serialization/deadlock transient failures are retried, with a small bounded randomized delay and at most three total attempts including the first; validation `400`, scope/not-found `404`, business-limit `409`, payload-size `413`, unsupported-media `415`, and other ordinary business errors are not retried; a retry that observes five Active rows returns `409`, and contention-only exhaustion returns centralized `500 INTERNAL_SERVER_ERROR`. The test does not assert exact backoff milliseconds and no `503 SERVICE_UNAVAILABLE` variant exists. | tests/lab-02/attachments.api.test.ts | Not Run |
| API-70 | API | AC-54, AC-58 | Multipart boundary and binary hardening on both upload/access paths. | Missing/duplicate/unexpected/empty/path-like/control/Unicode/overlong files and exact size boundaries map correctly; binary responses use derived MIME, `nosniff`, safe dual filename parameters, `no-store`, and merged `Vary`. | tests/lab-02/attachments.api.test.ts | Not Run |
| API-71 | API | AC-57 | Exact-origin CORS configuration. | Allowed origin succeeds with required allow/expose headers; disallowed/wildcard origins do not; missing/invalid allowlist fails startup outside development/test; origin-less API calls remain valid. | tests/lab-02/cors.api.test.ts | Passed |
| API-72 | API | AC-58 | JSON parser size/error classification. | A body at the 131,072-byte parser boundary reaches normal parse/downstream handling rather than size rejection; larger returns 413; malformed JSON within limit returns 400 BAD_REQUEST; valid JSON with invalid fields returns 400 VALIDATION_ERROR. | tests/lab-02/transport-hardening.api.test.ts | Partial — the 131,072-byte boundary (proved by the body reaching the requester guard rather than being size-rejected), the 413, and the malformed-JSON `BAD_REQUEST` are covered by `transport-hardening.api.test.ts`; the request-body field `VALIDATION_ERROR` needs a field-validating endpoint and is owned by Issue #21. Requester-context failures are deliberately not this row: they carry `REQUESTER_CONTEXT_INVALID` (API-01) so the client can tell them apart from an ordinary application 400. |
| API-73 | API | AC-59 | Structured logging allowlist and sensitive-marker exclusion. | Success/failure logs contain required correlation/transport fields; seeded marker values for queries, headers, bodies, names/emails, filenames, DB URLs, SQL, binary, and Prisma metadata never appear. | tests/lab-02/error-contract.api.test.ts | Passed |
| API-74 | API | AC-60 | Cache and variation headers. | Bootstrap, requester-scoped JSON/binary, and representative error responses use no-store; requester-scoped responses merge `Origin, X-Requester-Id` into Vary without clobbering the CORS value; the bootstrap `GET /api/requesters` preserves the CORS `Vary: Origin` and does not add `X-Requester-Id`. | tests/lab-02/transport-hardening.api.test.ts | Passed |
| API-75 | API | AC-50 | Synthetic full Requester DTO boundary. | Bootstrap retains the full DevelopmentRequesterDTO shape using only approved synthetic example identities; documentation/configuration never claim CORS makes it private. | tests/lab-02/reference-data.api.test.ts | Not Run |
| API-76 | API | BR-19–24, BR-82, AC-65 | `PROCESSING_LEASE_SECONDS = 300`, request-time reclaim, and old-owner fencing behavior. | Before `processingStartedAt + 300 seconds` same hash waits because `now < STALE_CUTOFF`; at exact equality and afterward same hash atomically reclaims because `now >= STALE_CUTOFF` and resets `processingStartedAt`; different hash returns 409 whether fresh or stale; the stale row is not deleted for new-payload key reuse; a resumed owner with the old lease fails fencing before final mutable validation/mutation and returns to wait/replay; no FAILED state is stored. | tests/lab-02/ticket-idempotency.api.test.ts | Passed |

### 7.1 Planned PostgreSQL Integration Tests

These tests run only against guarded `TEST_DATABASE_URL` and inspect committed state through real Prisma/PostgreSQL behavior.

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
| --- | --- | --- | --- | --- | --- | --- |
| PG-01 | PostgreSQL Integration | BR-19–23, AC-06, AC-11, AC-42, AC-65 | Concurrent same requester/key/same canonical payload with referenced Pending rows, using separate connections. | Unique `(requester_id,key)` permits one PROCESSING owner before mutable validation; exactly one Ticket/COMPLETED operation commits; referenced rows bind once; waiter/replay resolves to the same Ticket under 201/200 semantics. | tests/lab-02/postgres/idempotency.postgres.test.ts | Passed |
| PG-02 | PostgreSQL Integration | BR-20–23, AC-12, AC-42, AC-65 | Concurrent same requester/key/different canonical payload or Attachment set. | Unique claim remains single-owner; contender receives `IDEMPOTENCY_CONFLICT`; no duplicate Ticket, incorrect binding, or incorrect idempotency result commits. | tests/lab-02/postgres/idempotency.postgres.test.ts | Passed |
| PG-03 | PostgreSQL Integration | BR-21–24, BR-52, AC-06, AC-11 | Ticket creation + Pending binding rollback after injected failure once the transaction begins. | No partial Ticket, COMPLETED result, or Attachment binding remains; every referenced row remains Pending and retryable; controlled failure safely removes the owned PROCESSING claim rather than persisting FAILED. | tests/lab-02/postgres/transactions.postgres.test.ts | Passed |
| PG-04 | PostgreSQL Integration | BR-58, AC-19 | Mixed Pending hard-delete + Active soft-remove rollback after transaction work begins. | Injected failure leaves no Pending row/binary deletion and no Active lifecycle/reason/audit mutation committed. | tests/lab-02/postgres/transactions.postgres.test.ts | Not Run |
| PG-05 | PostgreSQL Integration | BR-47, BR-76, AC-47 | Two concurrent valid direct uploads to one Ticket currently at four Active Attachments, using separate connections. | Each attempt uses PostgreSQL `Serializable` isolation for the Active count plus insert; supported serialization/deadlock failures may use a small bounded randomized delay for at most three total attempts, while ordinary errors are not retried. Exactly one request commits `201`, exactly one resolves `409`, exactly one new Attachment persists, and final Active count is 5. This PostgreSQL test verifies the observable concurrency result and does not assert exact backoff milliseconds. | tests/lab-02/postgres/attachment-concurrency.postgres.test.ts | Not Run |
| PG-06 | PostgreSQL Integration | BR-80–81, AC-48 | Pending cleanup races Ticket binding using separate connections and bounded SKIP LOCKED selection. | The row is either cleaned while still Pending or bound Active; cleanup never deletes it after Active binding and skips a row currently locked for binding. | tests/lab-02/postgres/maintenance.postgres.test.ts | Not Run |
| PG-07 | PostgreSQL Integration | AC-49 | Upgrade a populated Lab 1 schema through the committed Lab 2 migration using the repository-confirmed baseline. | The existing Category table is migrated in place rather than dropped/recreated; its existing `id`, `name`, and original `createdAt` values survive exactly; existing valid rows receive `isActive = true`, `deleted = false`, `createdBy = seed`, `updatedBy = seed`, and `updatedAt` equal to each row's original preserved `createdAt`; no migration-time or other nondeterministic timestamp is used for that backfill; the resulting schema and idempotent seed are valid. | tests/lab-02/postgres/migration-upgrade.postgres.test.ts | Passed — 5 tests |
| PG-08 | PostgreSQL Integration | AC-56 | Attachment database check constraints and removal-metadata retention. | PostgreSQL rejects invalid lifecycle/reason/name-byte/binary-size/size-metadata combinations, rejects `0` and `5,000,001` bytes, accepts `4,999,999` and `5,000,000` bytes, accepts valid Pending, Active, and Removed rows when `size_bytes = octet_length(data)`, permits Pending cleanup, keeps the Ticket binding and reason across a soft removal, and rejects marking a bound row removed without a valid reason. Transition rules beyond per-row validity are application-owned (Specification Section 7.2.7). | tests/lab-02/postgres/transactions.postgres.test.ts | Passed — 8 tests |
| PG-09 | PostgreSQL Integration | BR-82, AC-52 | Expired-but-not-cleaned requester/key reuse racing idempotency cleanup and another reuse caller. | Old technical row is safely removed/replaced, no false unique-key error occurs, exactly one new logical operation wins, and no duplicate Ticket is created. | tests/lab-02/postgres/idempotency.postgres.test.ts; tests/lab-02/postgres/maintenance.postgres.test.ts | Partial — the expired-row race and safe replacement are covered in `idempotency.postgres.test.ts`; the maintenance-CLI half is owned by Issue #24 |
| PG-10 | PostgreSQL Integration | BR-19–23, AC-64–65 | Idempotency database enum, hash, Processing timestamp, state, expiry, unique-claim, and restrictive-FK constraints. | PostgreSQL accepts valid PROCESSING and COMPLETED rows/transitions with non-null `processing_started_at`; request-time boundary evidence treats `now < processing_started_at + 300 seconds` as fresh and `now >= processing_started_at + 300 seconds` as stale; rejects malformed/non-lowercase/non-64-character current hashes, invalid nullability/state combinations, wrong 24-hour expiry, duplicate requester/key ownership, and forbidden referenced-row deletion. | tests/lab-02/postgres/idempotency.postgres.test.ts | Passed — 5 tests |
| PG-11 | PostgreSQL Integration | BR-19–24, BR-82, AC-65 | Stale same-hash PROCESSING claim with two concurrent retries and referenced Pending Attachments, using separate connections. | `PROCESSING_LEASE_SECONDS = 300`; a claim at `4m 59.999s` is fresh and a claim at `5m 00.000s` is stale/reclaim-eligible. Exactly one conditional update reclaims the stale claim and resets `processing_started_at`; exactly one Ticket and one set of Attachment bindings commit; the other retry refetches and waits/replays normally; no duplicate Ticket or Attachment binding occurs. | tests/lab-02/postgres/idempotency.postgres.test.ts | Passed |
| PG-12 | PostgreSQL Integration | BR-19–24, BR-82, AC-65 | Old-owner fencing after reclaim, using separate connections and the exact retained lease timestamp. | A owns PROCESSING; its lease becomes stale; B atomically reclaims and obtains a new `processing_started_at`; A resumes with the old value and its locked status/hash/timestamp fencing check fails before mutation; B alone performs final validation, creates, binds, and completes; exactly one Ticket and one Attachment-binding set commit. The claim lock blocks reclaim while held. | tests/lab-02/postgres/idempotency.postgres.test.ts | Passed |

## 8. Planned UI Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
| --- | --- | --- | --- | --- | --- | --- |
| UI-01 | UI | AC-02 | Requester Selection normal/loading/empty/failure states. | Skeleton while loading; active names only; test-not-authentication explanation; no-active and safe failure states provide Retry; Continue disabled until selection. | tests/lab-02/RequesterSelection.test.tsx | Passed |
| UI-02 | UI | AC-03 | Requester selection persistence and navigation. | Selecting requester + Continue stores requester in sessionStorage, shows name in app context, and navigates to `/tickets`. | tests/lab-02/RequesterSelection.test.tsx | Passed |
| UI-03 | UI | FR-03–05 | Application shell/navigation. | Desktop shell shows TokTickIT, My Tickets, Create Ticket, requester name, Change Requester, and active navigation semantics. | tests/lab-02/ApplicationShell.test.tsx | Passed — 10 tests |
| UI-04 | UI | AC-01, AC-05, AC-46 | Requester route guard and invalid-context handling. | No valid stored context redirects requester routes to `/requesters` before requester data renders; a `400` carrying `REQUESTER_CONTEXT_INVALID` clears context/state and redirects; an ordinary application `400` leaves the stored Requester untouched. | tests/lab-02/ApplicationShell.test.tsx | Passed — the route-guard half is covered by `ApplicationShell.test.tsx`; the `REQUESTER_CONTEXT_INVALID` clear and the ordinary-`400` no-clear cases are covered by the `useRequesterApi` cases added in this Issue. |
| UI-05 | UI | AC-04 | Change Requester behavior. | Clears prior requester context/cache/list/detail/draft state, avoids stale data, and returns to selector. | tests/lab-02/ApplicationShell.test.tsx | Passed for Issue #19 foundation — `ApplicationShell.test.tsx` verifies Change Requester clears the stored requester context and stale requester UI, returns to Requester Selection, restores destination focus after requester changes and guarded redirects, preserves normal focus on cold selection-page load, and handles browser-history return focus. Feature-specific Requester Selection behavior remains owned by its downstream issue where applicable. |
| UI-06 | UI | FR-07, AC-66 | Create Ticket required, generated, and Requester-context fields. | Editable Category/System/Priority/Summary/Description/Attachments + Cancel/Submit are present; non-editable Ticket Number/Date state that they are assigned on submission; non-editable Requester shows the selected Development Requester; none is sent as a client-controlled body field; pre-creation Status/public/audit fields remain absent. | tests/lab-02/CreateTicket.test.tsx | Partial — every required, generated, and Requester-context control is covered; the Attachment controls are the Issue #24 seam |
| UI-07 | UI | AC-08–10, AC-38 | Create Ticket client validation, counters, labels, first-invalid focus. | Errors not dumped on initial render; submit validates all; field-associated messages/counters/required semantics; invalid client-known form does not call API and focuses first invalid field. | tests/lab-02/CreateTicket.test.tsx | Passed |
| UI-08 | UI | FR-12 | Create Ticket busy submission. | Delayed response causes disabled Submit with spinner while text remains `Submit Ticket`; duplicate click prevented. | tests/lab-02/CreateTicket.test.tsx | Passed |
| UI-09 | UI | AC-06, AC-16, AC-44 | Initial pre-upload and atomic submit. | Valid selected files pre-upload one-by-one to Pending; Submit remains blocked for Uploading/Failed/Invalid intended files until Retry succeeds or Remove is explicit; final prepared IDs are sent and success navigates to Active Detail. | tests/lab-02/CreateTicket.test.tsx | Not Run |
| UI-10 | UI | AC-10 | Ticket-create 4xx retention. | Stay on form; text/select values and valid Pending cards/IDs remain; server errors map safely; unchanged logical retry reuses the key. | tests/lab-02/CreateTicket.test.tsx | Partial — staying on the form, retaining text/select values, safe server-error mapping, and same-key unchanged retry are covered; the Pending card/ID retention half needs the Attachment controls owned by Issue #24 |
| UI-11 | UI | BR-23–24 | Ticket-create unexpected 5xx compensation. | Non-file fields remain; best-effort Pending cleanup uses empty reasons; confirmed deletions show Retry Upload; client never invents an Active-removal reason. | tests/lab-02/CreateTicket.test.tsx | Not Run |
| UI-12 | UI | BR-23–24 | Ambiguous Ticket-create recovery. | Unchanged POST retries with the same key; completed 200 recovers same Ticket and Active Attachments without duplicate, cleanup damage, or re-upload. | tests/lab-02/CreateTicket.test.tsx | Partial — the unchanged same-key retry and the completed `200` recovering the same Ticket without a duplicate are covered; the Active-Attachment, cleanup-damage, and no-re-upload halves are owned by Issue #24 |
| UI-13 | UI | AC-43 | Frontend Idempotency-Key lifecycle. | First logical submission gets a UUID; unchanged canonical retry and reordered same IDs reuse it; Ticket-field or final Attachment-set change generates a new key. | tests/lab-02/CreateTicket.test.tsx | Passed — including the reordered-set case, asserted against `payloadSignature` because the draft's `attachmentIds` are written by the Issue #24 controls |
| UI-14 | UI | AC-45 | Create Ticket Cancel/discard. | Untouched empty draft cancels directly; dirty and/or known Pending draft requires confirmation; confirm sends best-effort Pending cleanup, clears fields/files, and returns to `/tickets`. | tests/lab-02/CreateTicket.test.tsx | Partial — the direct cancel, the confirmation, Keep editing, and the confirmed discard clearing the draft and recovery record are covered; the best-effort Pending cleanup call is owned by Issue #24 |
| UI-15 | UI | AC-33 | My Tickets loading/table/stale-data prevention. | Skeleton rows during load; required table structure; stale previous-requester Tickets never render during context change. | tests/lab-02/MyTickets.test.tsx | Not Run |
| UI-16 | UI | AC-34 | My Tickets empty dataset vs no-results states. | Shared EmptyState shows correct distinct copy/actions for true empty dataset and active-query no-results. | tests/lab-02/MyTickets.test.tsx | Not Run |
| UI-17 | UI | AC-39 | My Tickets load failure. | Page-level list failure navigates to standalone `/error` with safe state. | tests/lab-02/MyTickets.test.tsx | Not Run |
| UI-18 | UI | AC-24 | `SEARCH_DEBOUNCE_MS = 400` search debounce and API query mapping. | Using controlled/fake timers, typing starts the inactivity window and no search request occurs before 400 ms of inactivity; advancing to the exact 400 ms boundary triggers exactly one request with `searchFields=ticketNumber,summary,description`; the new effective search resets `pageNumber` to 1. No real-time sleep is used. | tests/lab-02/MyTickets.test.tsx | Not Run |
| UI-19 | UI | AC-31 | Filter modal multi-select draft/apply/cancel/reset. | Category/System/Priority/Status are multi-select; Cancel discards; Reset clears draft only; Apply commits/fetches and page resets to 1. | tests/lab-02/MyTickets.test.tsx | Not Run |
| UI-20 | UI | AC-31–32 | Filter count/chips/removal/Clear Filters. | Applied count + removable chips update; chip removal fetches page 1; Clear Filters available whenever query active, clears search/filters, preserves sort. | tests/lab-02/MyTickets.test.tsx | Not Run |
| UI-21 | UI | AC-28 | Sort control mapping. | All approved Newest/Oldest/Ticket Number/Summary/Priority options map to exact API sort semantics. | tests/lab-02/MyTickets.test.tsx | Not Run |
| UI-22 | UI | AC-29–30 | Pagination/page-size UI and list projection consumption. | Page controls use X-Pagination state; 10/20/30/50/100 choices; navigation/page-size changes fetch correct query; UI renders from TicketListItemDTO without requiring excluded fields. | tests/lab-02/MyTickets.test.tsx | Not Run |
| UI-23 | UI | FR-21–23 | Ticket Detail read-only information. | Ticket Number, createdAt-as-Ticket-Date, status, priority, requester name/email, category/system, summary/description render read-only with no edit/status workflow. | tests/lab-02/RequesterTicketDetail.test.tsx | Not Run |
| UI-24 | UI | AC-22, AC-39 | Ticket Detail page-load ownership 404, unavailable 404, generic 403, and 500. | Requester-scope failure uses safe 404 without owner/A data; all page-level variants navigate to standalone `/error`; Back targets `/tickets`. | tests/lab-02/RequesterTicketDetail.test.tsx | Not Run |
| UI-25 | UI | AC-13, AC-15, AC-16, AC-44 | Attachment per-file lifecycle presentation and client size boundaries. | Uploading, Failed/Retry, Invalid, Pending, Active, and Removed are distinct; `4,999,999` and `5,000,000` bytes remain valid, `5,000,001` bytes is Invalid, sibling success may become Pending but unresolved intended files block submit, and referenced Pending becomes Active after create. | tests/lab-02/AttachmentSection.test.tsx | Not Run |
| UI-26 | UI | AC-18 | Attachment `x/5` count and Add behavior. | Count includes only active; Removed excluded; at 5/5 Add disabled; no extra max-limit explanatory paragraph. | tests/lab-02/AttachmentSection.test.tsx | Not Run |
| UI-27 | UI | AC-20, AC-38 | Attachment preview modal. | Pending and Active owned supported image/PDF fixtures open the modal; Download is available; Escape/close works; focus trap/return and accessible modal semantics hold. | tests/lab-02/AttachmentSection.test.tsx | Not Run |
| UI-28 | UI | AC-19 | Batch Attachment selection. | Only Active Ticket Detail rows are selectable; selected count and Remove Selected behave correctly; Create Ticket transient/Pending states and Removed rows are not selectable for Active removal. | tests/lab-02/AttachmentSection.test.tsx | Not Run |
| UI-29 | UI | AC-19 | Per-selected-Attachment removal reasons. | One required 3–200 char trimmed reason per selected active file; invalid reason blocks delete request. | tests/lab-02/AttachmentSection.test.tsx | Not Run |
| UI-30 | UI | AC-19 | Atomic batch-removal UI failure. | Failed all-or-nothing API request leaves all selected rows in previous state; no partial Removed UI. | tests/lab-02/AttachmentSection.test.tsx | Not Run |
| UI-31 | UI | AC-39 | Global Error page variants. | 403/404/500 safe copy; standalone no sidebar; no backend internals; explicit Back routes `/tickets` rather than browser history. | tests/lab-02/ApplicationShell.test.tsx; tests/lab-02/ErrorPage.test.tsx | Passed for shared error foundation — `ApplicationShell.test.tsx` verifies safe 403, 404, and 500 variants, generic fallback for missing or unsupported route state, and safe standalone `/error` rendering without the application shell. Feature-specific paths may exercise the same shared error foundation in later issues. |
| UI-32 | UI | AC-38 | Shared accessibility contract across UI suites. | Semantic controls, labels/required/errors, keyboard operability, visible focus, aria-live for meaningful async states, icon accessible names plus mandatory tooltip/hover-focus labels, modal focus management, and non-color-only states. | tests/lab-02/RequesterSelection.test.tsx; tests/lab-02/ApplicationShell.test.tsx; tests/lab-02/SharedComponents.test.tsx; tests/lab-02/CreateTicket.test.tsx; tests/lab-02/MyTickets.test.tsx; tests/lab-02/RequesterTicketDetail.test.tsx; tests/lab-02/AttachmentSection.test.tsx; tests/lab-02/ErrorPage.test.tsx | Partial — the shared primitives and shell landmarks/keyboard behavior pass in `ApplicationShell.test.tsx` and `SharedComponents.test.tsx`. Per-screen coverage follows the screens in Issues #20–#23. |
| UI-33 | UI | AC-51–53 | Ambiguous-create recovery persistence and expiry. | Recovery record stores requester/key time/original normalized payload only while ambiguous; reload offers explicit resume without auto-submit; success/failure/discard/switch/expiry clears it; current replay rendering includes later Attachment mutations. | tests/lab-02/CreateTicket.test.tsx | Partial — the requester-scoped record, the approved field set, the explicit no-auto-submit resume, the 24-hour deadline, and clearing on success/failure/discard/switch are covered; the later-Attachment replay rendering is owned by Issue #24 |
| UI-34 | UI | AC-54 | Requester-header binary fetch and Blob URL lifecycle. | Preview/download checks response before body, sends X-Requester-Id, uses known originalName for download, and revokes URLs on close/replacement/unmount/after download; direct binary navigation is not used. | tests/lab-02/AttachmentSection.test.tsx | Not Run |
| UI-35 | UI | AC-61 | State-less global-error fallback. | Missing/invalid navigation state renders safe generic 500 copy; arbitrary backend text is ignored; Back chooses `/tickets` with valid Requester context and `/requesters` without it. | tests/lab-02/ApplicationShell.test.tsx; tests/lab-02/ErrorPage.test.tsx | Passed — global-error regression coverage verifies safe 403/404/500 copy, generic fallback for missing/invalid/restored state, rejection of caller-controlled backend copy and `backPath`, deterministic Back routing based on Requester context, and route-focus behavior. |
| UI-36 | UI | AC-38, AC-66 | Automated meaningful presentation/state contract across Create Ticket, Ticket Detail, badges, and Attachment states. | Assert only contract-significant semantics/classes: generated Ticket Number/Date and Requester are read-only/disabled; editable vs read-only and invalid/error states differ; required labels/asterisks and associated errors exist; Submit/Cancel hierarchy and disabled/busy Submit are represented; Detail fields remain read-only; priority/status badges retain visible text; Pending/Active/Removed/Invalid/Failed states have approved visual/semantic markers without color-only meaning. | tests/lab-02/CreateTicket.test.tsx; tests/lab-02/RequesterTicketDetail.test.tsx; tests/lab-02/AttachmentSection.test.tsx | Not Run |
| UI-37 | UI | BR-91, AC-38, AC-66 | Representative icon-only control labels and tooltips. | Mobile sidebar, Attachment preview/download/remove, close/dismiss, pagination, and filter/search auxiliary icon-only controls expose an accessible programmatic name and observable tooltip/hover-focus text with the expected action wording; assertions verify user-visible semantics and association, not tooltip-library internals. | tests/lab-02/ApplicationShell.test.tsx; tests/lab-02/SharedComponents.test.tsx; tests/lab-02/AttachmentSection.test.tsx; tests/lab-02/MyTickets.test.tsx; tests/lab-02/RequesterTicketDetail.test.tsx | Partial — the mobile sidebar toggle, the modal close control, and the filter-chip remove control assert both an accessible name and an associated visible tooltip. Attachment preview/download/remove follow in Issue #23. Pagination introduces no icon-only control: both arrows carry visible text. |

## 9. Planned Responsive Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
| --- | --- | --- | --- | --- | --- | --- |
| RESP-01 | Responsive | AC-35–37 | Create Ticket at 1440×900, 820×1180, 390×844. | Desktop/tablet approved column behavior; mobile stack; required controls/counters/actions usable; no page-level horizontal overflow/clipping. | e2e/lab-02/responsive-visual.spec.ts | Not Run |
| RESP-02 | Responsive | AC-35–37 | My Tickets responsive table and pagination. | Desktop full columns; mobile keeps Ticket Number/Summary/Priority/Status and hides Category/System/Created At; toolbar/pagination usable; no page-level horizontal overflow. | e2e/lab-02/responsive-visual.spec.ts | Not Run |
| RESP-03 | Responsive | AC-35–37 | Ticket Detail and Attachments responsive behavior. | Desktop/tablet read-only field layout; mobile stack; attachment table adapts while filename/selection/actions stay readable/operable; no page-level horizontal overflow. | e2e/lab-02/responsive-visual.spec.ts | Not Run |

## 10. Planned Visual Evidence

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
| --- | --- | --- | --- | --- | --- | --- |
| VIS-01 | Visual | AC-35–38 | Create Ticket screenshot evidence at all required viewports. | Screenshots saved under approved Create Ticket artifact directory and pass visual checklist; no pixel-perfect baseline requirement. | e2e/lab-02/responsive-visual.spec.ts | Not Run |
| VIS-02 | Visual | AC-35–38 | My Tickets screenshot evidence at all required viewports. | Screenshots saved under approved My Tickets artifact directory and pass visual checklist. | e2e/lab-02/responsive-visual.spec.ts | Not Run — must also assert that the closed mobile drawer's navigation links and Change Requester are out of the tab order, and that on a ticket list long enough to scroll the desktop sidebar stays fixed with Change Requester visible. Both guarantees are CSS-only (`.tt-sidebar { visibility: hidden }` below 992px; `position: sticky` above it) and jsdom applies no stylesheets, so `ApplicationShell.test.tsx` cannot see a regression in either. |
| VIS-03 | Visual | AC-35–38 | Ticket Detail screenshot evidence at all required viewports. | Screenshots saved under approved Ticket Detail artifact directory and pass visual checklist. | e2e/lab-02/responsive-visual.spec.ts | Not Run |

Required screenshot directories:

```text
artifacts/lab-02/screenshots/create-ticket/
artifacts/lab-02/screenshots/my-tickets/
artifacts/lab-02/screenshots/ticket-detail/
```

Useful additional supporting screenshots may include:

- filter modal;
- Create Ticket validation state;
- Removed Attachment state;
- Attachment preview modal;
- global error page.

These additional screenshots are supporting evidence unless the implementation team promotes them to required visual cases.

## 11. Planned End-to-End Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
| --- | --- | --- | --- | --- | --- | --- |
| E2E-01 | E2E | AC-02–03, AC-06, AC-13, AC-18–21, AC-24–25, AC-28–32, AC-40, AC-44 | Full Requester golden path. | Select requester → Create Ticket → select/pre-upload files Pending → submit `attachmentIds` → atomic Ticket/all-binding success → Detail files Active → My Tickets/search/filter/sort/page → direct existing-Ticket add/preview/download/remove → Removed evidence. | e2e/lab-02/requester-ticket-flow.spec.ts | Not Run |
| E2E-02 | E2E | AC-01, AC-04, AC-21–23, AC-39, AC-46 | Cross-requester ownership path. | Requester A creates Ticket; switch to B; direct-open A publicId → backend 404 → safe standalone 404 → Back `/tickets`; no owner identity or A Ticket data appears under B. | e2e/lab-02/requester-ticket-flow.spec.ts | Not Run |
| E2E-03 | E2E | AC-06, AC-11, AC-42–44, AC-53 | Handout Create Ticket recovery evidence across reload. | Pre-upload Pending → create commits but response is ambiguous → reload offers explicit recovery without auto-submit → unchanged same-key retry returns current 200 DTO for the same Ticket → no duplicate, forced re-upload, or Pending revalidation. | e2e/lab-02/create-ticket.spec.ts | Not Run |

## 12. Visual Inspection Checklist

For each required screen and viewport verify:

- Zen Green tokens and professional internal-application hierarchy are consistent;
- no clipped labels;
- no overlapping validation/helper text;
- no hidden required actions;
- no unintended page-level horizontal scrolling;
- editable and read-only fields are visually distinct;
- Create Ticket generated Ticket Number/Date and selected Requester controls are visible and non-editable;
- required markers remain visible;
- focus states remain visible;
- busy buttons preserve layout and retain action text;
- Summary and Description remain usable;
- My Tickets table shows the required columns for that viewport;
- status/priority meaning does not depend on color alone;
- every icon-only control has a visible tooltip/equivalent hover-focus label in addition to its accessible programmatic name;
- true-empty and no-results content are distinguishable;
- Attachment filenames remain readable;
- Uploading, Failed, Invalid, Pending, Active, and Removed states are distinguishable;
- Removed Attachment actions are unavailable;
- batch selection and removal reasons remain understandable;
- modal controls are keyboard reachable;
- standalone error page has no requester sidebar;
- requester-workflow Back action targets `/tickets`.

## 13. Acceptance-Criteria Traceability Matrix

Every Acceptance Criterion maps to one or more planned tests.

| Acceptance Criterion | Planned Tests |
| --- | --- |
| AC-01 | UI-04, E2E-02 |
| AC-02 | API-02, UI-01, E2E-01 |
| AC-03 | UI-02, E2E-01 |
| AC-04 | UI-05, E2E-02 |
| AC-05 | UNIT-01, API-01, UI-04 |
| AC-06 | UNIT-05, UNIT-10, API-05, API-16, UI-09, PG-01, PG-03, E2E-01 |
| AC-07 | UNIT-04, UNIT-05, API-05 |
| AC-08 | API-06, UI-07 |
| AC-09 | API-07, UI-07 |
| AC-10 | UNIT-02, UNIT-03, API-08, API-09, API-10, UI-07, UI-10 |
| AC-11 | UNIT-10, API-13, PG-01, E2E-03 |
| AC-12 | UNIT-10, API-14, API-16, PG-02 |
| AC-13 | UNIT-11, API-39, UI-09, UI-25, E2E-01 |
| AC-14 | UNIT-11, API-40 |
| AC-15 | UNIT-11, API-41, UI-25 |
| AC-16 | UNIT-11, UI-09, UI-25, E2E-01 |
| AC-17 | UNIT-12, API-43 |
| AC-18 | UNIT-12, API-45, UI-26, E2E-01 |
| AC-19 | UNIT-14, API-52, API-53, API-54, API-55, API-60, API-61, UI-28, UI-29, UI-30, PG-04, E2E-01 |
| AC-20 | UNIT-13, API-48, API-49, API-50, UI-27, E2E-01 |
| AC-21 | API-21, API-35, E2E-01, E2E-02 |
| AC-22 | UNIT-13, UNIT-14, API-36, API-46, API-48, API-49, API-50, API-60, API-67, UI-24, E2E-02 |
| AC-23 | API-37, API-47, API-48, API-49, API-50, API-59, E2E-02 |
| AC-24 | UNIT-06, UNIT-08, API-22, API-23, UI-18, E2E-01 |
| AC-25 | UNIT-06, UNIT-07, API-24, API-28, API-29, UI-19, UI-20, E2E-01 |
| AC-26 | UNIT-06, API-25, API-26, API-27, API-28 |
| AC-27 | UNIT-09, API-30 |
| AC-28 | UNIT-09, API-30, UI-21, E2E-01 |
| AC-29 | API-31, API-32, UI-22 |
| AC-30 | API-33, API-34, API-66, UI-22, E2E-01 |
| AC-31 | UI-19, UI-20, E2E-01 |
| AC-32 | UI-20, E2E-01 |
| AC-33 | UI-05, UI-15 |
| AC-34 | UI-16 |
| AC-35 | RESP-01, RESP-02, RESP-03, VIS-01, VIS-02, VIS-03 |
| AC-36 | RESP-01, RESP-02, RESP-03, VIS-01, VIS-02, VIS-03 |
| AC-37 | RESP-01, RESP-02, RESP-03, VIS-01, VIS-02, VIS-03 |
| AC-38 | UI-07, UI-27, UI-32, UI-37, VIS-01, VIS-02, VIS-03 |
| AC-39 | API-62, UI-17, UI-24, UI-31, E2E-02 |
| AC-40 | API-63, API-64, API-66, E2E-01 |
| AC-41 | UNIT-01, API-01, API-02 |
| AC-42 | UNIT-10, API-17, PG-01, E2E-03 |
| AC-43 | UNIT-10, UNIT-15, API-13, API-20, UI-12, UI-13, E2E-03 |
| AC-44 | UNIT-12, UNIT-15, UI-09, UI-25, E2E-01, E2E-03 |
| AC-45 | UNIT-15, UI-14 |
| AC-46 | API-01, UI-04, E2E-02 |
| AC-47 | API-69, PG-05 |
| AC-48 | UNIT-16, API-43, PG-06 |
| AC-49 | PG-07, DATA-07 |
| AC-50 | API-75, DATA-09 |
| AC-51 | UNIT-10, API-13, UI-33 |
| AC-52 | UNIT-10, UNIT-16, PG-09, UI-33 |
| AC-53 | UI-33, E2E-03 |
| AC-54 | API-70, API-74, UI-34 |
| AC-55 | UNIT-06, API-68 |
| AC-56 | UNIT-11, PG-08, DATA-08 |
| AC-57 | API-71 |
| AC-58 | UNIT-11, API-70, API-72 |
| AC-59 | API-73 |
| AC-60 | API-70, API-74 |
| AC-61 | UI-35 |
| AC-62 | DATA-10, E2E-01, E2E-02, E2E-03, RESP-01, RESP-02, RESP-03 |
| AC-63 | DATA-08 |
| AC-64 | PG-07, PG-08, PG-10, DATA-11 |
| AC-65 | UNIT-10, API-13, API-16, API-17, API-19, API-76, PG-01, PG-02, PG-10, PG-11, PG-12 |
| AC-66 | UI-06, UI-07, UI-08, UI-23, UI-25, UI-36, UI-37 |

## 14. Implementation-Issue Test Ownership and Close Gates

Feature-specific tests must be written and passing before the corresponding
Issue is closed. Issue #25 reruns these tests as final regression coverage; it
does not defer or replace a feature Issue's own close gate.

| Issue | Focused test paths required before close | Close gate |
| --- | --- | --- |
| #18 — Data model and seed | `server/tests/lab-02/CategoryService.test.ts`, `server/tests/lab-02/RelatedSystemService.test.ts`, `server/tests/lab-02/postgres/migration-upgrade.postgres.test.ts`, `server/tests/lab-02/postgres/transactions.postgres.test.ts`, `server/tests/lab-02/postgres/idempotency.postgres.test.ts`, fresh migration/seed smoke check | Forward-only populated-Lab-1 preservation, authoritative field types/nullability/defaults, restrictive FKs, checks/indexes, PROCESSING/COMPLETED state constraints, synthetic seed, and idempotent seed evidence pass without breaking Lab 1 checks. |
| #19 — UI foundation | `client/tests/lab-02/ApplicationShell.test.tsx` | Shell, routes, navigation, responsive/focus foundations, and Lab 1 client checks pass. |
| #20 — Requester context | `server/tests/lab-02/DevelopmentRequesterService.test.ts`, `server/tests/lab-02/requester-context.api.test.ts`, `server/tests/lab-02/reference-data.api.test.ts`, `server/tests/lab-02/cors.api.test.ts`, `server/tests/lab-02/error-contract.api.test.ts`, `server/tests/lab-02/transport-hardening.api.test.ts`, `client/tests/lab-02/RequesterSelection.test.tsx`, `client/tests/lab-02/ApplicationShell.test.tsx` | Synthetic full bootstrap DTO array (`reference-data.api.test.ts` owns the `GET /api/requesters` response contract: `200` raw array, full `DevelopmentRequesterDTO`, active and non-deleted only, no `X-Requester-Id` required, synthetic identities only), safe `400 REQUESTER_CONTEXT_INVALID` context validation with no ordinary `400` clearing the Requester, shared transport foundation (`X-Request-Id` generation/propagation, centralized safe error handling, exact-origin CORS, `Cache-Control`/`Vary`, structured-logging allowlist, JSON parser hardening), route guard, and the shared requester-switch/invalidation mechanism and its registration seam pass. Downstream Issues keep their own feature-specific clearing gates. |
| #21 — Ticket creation | `server/tests/lab-02/TicketNumber.test.ts`, `server/tests/lab-02/TicketService.test.ts`, `server/tests/lab-02/IdempotencyService.test.ts`, `server/tests/lab-02/tickets.api.test.ts`, `server/tests/lab-02/create-ticket.api.test.ts`, `server/tests/lab-02/ticket-idempotency.api.test.ts`, `server/tests/lab-02/postgres/idempotency.postgres.test.ts`, `server/tests/lab-02/postgres/transactions.postgres.test.ts`, `client/tests/lab-02/CreateTicket.test.tsx` | PROCESSING claim-before-mutation, SHA-256 canonicalization, exact `PROCESSING_LEASE_SECONDS = 300` fresh/stale boundary and atomic reclaim, `IDEMPOTENCY-FENCING-A`, final mutable revalidation under the claim lock, Ticket creation/binding, current-state replay after later mutations, exact logical expiry/expired-row replacement, recovery persistence, conflict behavior, generated/context field UI, and PG-01–PG-03/PG-09–PG-12 pass. |
| #22 — My Tickets | `server/tests/lab-02/TicketQueryValidator.test.ts`, `server/tests/lab-02/QueryBuilder.test.ts`, `server/tests/lab-02/my-tickets.api.test.ts`, `server/tests/lab-02/cors.api.test.ts`, `client/tests/lab-02/MyTickets.test.tsx` | Bounded query validation, generic QueryBuilder boundary, `TicketListItemDTO`, CORS-readable pagination, and My Tickets tests pass. |
| #23 — Ticket Detail | `server/tests/lab-02/ticket-detail.api.test.ts`, `server/tests/lab-02/transport-hardening.api.test.ts`, `client/tests/lab-02/RequesterTicketDetail.test.tsx`, `client/tests/lab-02/ErrorPage.test.tsx` | Ownership, missing-resource, no-store/Vary, read-only detail, and safe state-less standalone-error tests pass. |
| #24 — Attachment lifecycle | `server/tests/lab-02/AttachmentService.test.ts`, `server/tests/lab-02/MaintenanceService.test.ts`, `server/tests/lab-02/attachments.api.test.ts`, `server/tests/lab-02/transport-hardening.api.test.ts`, `server/tests/lab-02/postgres/attachment-concurrency.postgres.test.ts`, `server/tests/lab-02/postgres/maintenance.postgres.test.ts`, `server/tests/lab-02/postgres/transactions.postgres.test.ts`, `client/tests/lab-02/AttachmentSection.test.tsx` | Attachment lifecycle, exact multipart/binary bounds, serializable max-five, cleanup CLI/race safety, database checks, scope hiding, Blob URL cleanup, and atomic deletion tests pass. |
| #25 — Integration/tooling | Root pinned Playwright manifest/config/lockfile, client pinned MSW, `e2e/lab-02/requester-ticket-flow.spec.ts`, `e2e/lab-02/create-ticket.spec.ts`, `e2e/lab-02/responsive-visual.spec.ts`, responsive/visual evidence | Local pinned tooling coordinates client/server/test PostgreSQL; all focused suites rerun and approved E2E/viewports pass without implicit runner download. |

Issue #19 scope boundary: this close gate covers the reusable route, shell,
navigation, responsive/focus foundation, and shared controls only. `SystemCheck`
remains directly covered by the Lab 1 component tests; `/system-check` is not a
Lab 2 route because the Lab 2 categories contract requires `X-Requester-Id`.
Requester selection, ticket creation, the responsive My Tickets table, and
ticket detail behavior remain owned by Issues #20–#23. Issue #25 owns the final
browser responsive and visual reruns.

## 15. Non-Automated Delivery Evidence

Mocked Unit/API tests remain fast contract/application evidence and must not be described as proof of PostgreSQL ACID, locking, uniqueness, or concurrency. PG-01–PG-12 provide the focused real-database evidence; the following schema/delivery evidence remains separately required:

- committed Prisma migrations exist;
- a fresh PostgreSQL database can be reproduced from migrations plus the idempotent seed;
- PostgreSQL-specific `pg_trgm` extension/index migration SQL is committed;
- required uniqueness/index definitions are present;
- setup, migration, seed, run, and test commands are documented;
- client/server build and typecheck commands pass;
- no required planned test is skipped, disabled, or commented out;
- logs and public responses remain free of secrets, database URLs, Attachment binary data, raw SQL, and unsafe stack details.

### 15.1 Explicit Business-Rule Evidence

The following rules previously had only generic Definition-of-Done wording. Each now has an explicit proof ID and final-result slot.

| Rule | Evidence IDs | Required proof | Final |
| --- | --- | --- | --- |
| BR-66 | DATA-01 | Inspect Prisma mappings and committed migration SQL/table definitions for singular `snake_case` PostgreSQL names and camelCase Prisma properties. | Not Run |
| BR-67 | DATA-02 | Inspect every persistent resource model/migration for the four required audit columns, types, nullability, and timestamps. | Not Run |
| BR-68 | UNIT-05, API-11, DATA-03 | Assert requester-triggered writes derive audit actors from the Requester email and never from a client-supplied actor value. | Not Run |
| BR-69 | DATA-04 | Run the idempotent seed and system-operation smoke checks; verify `seed`/`system` audit actors and unchanged audit timestamps on an unchanged seed rerun. | Not Run |
| BR-70 | UNIT-02, UNIT-03, UNIT-12, API-21, API-37, API-52, DATA-05 | Verify business-resource `deleted` defaults to false, is used by normal visibility/ownership predicates, and is set only by the approved soft-delete lifecycle. | Not Run |
| BR-74 | API-65, DATA-06 | Verify no Ticket deletion operation is exposed and new Ticket persistence/output uses `deleted = false`. | Not Run |
| BR-91 | UI-32, UI-37, VIS-01, VIS-02, VIS-03 | Inspect representative icon-only controls for both accessible programmatic names and visible tooltip/hover-focus labels, including navigation, Attachment, close, pagination, filter/search, mobile-sidebar, and modal controls; verify action wording without relying on icon shape, color, `title` alone, or `aria-label` alone. | Not Run |
| Migration preservation (AC-49) | PG-07, DATA-07 | Apply the committed migration to both a fresh database and a populated Lab 1 database; verify the existing Category table is altered in place, its `id`, `name`, and `createdAt` values are preserved exactly, and each existing valid row receives `isActive = true`, `deleted = false`, `createdBy = seed`, `updatedBy = seed`, and `updatedAt = original createdAt`. Verify that existing-row `updatedAt` is not derived from migration execution time, `now()`, `CURRENT_TIMESTAMP`, application-start time, or another nondeterministic timestamp. | Passed — PG-07 + fresh deploy/seed smoke |
| Attachment checks/indexes (AC-56, AC-63) | PG-08, DATA-08 | Inspect and exercise the committed Attachment checks - which are the complete database-level Attachment contract, with no triggers - plus the general/partial/unique/trigram/cleanup indexes; verify the size invariant `size_bytes > 0 AND size_bytes <= 5000000 AND size_bytes = octet_length(data)` and record schema evidence without asserting an exact query plan. | Passed — PG-07 schema evidence + PG-08 |
| Synthetic Requester boundary (AC-50) | API-75, DATA-09 | Inspect seed fixtures and bootstrap evidence to confirm every unauthenticated Requester identity is synthetic and deployment documentation prohibits real PII/public exposure. | Partial — verified for Issue #20 on 2026-08-24: every seeded Requester identity in `server/prisma/seed.ts` is synthetic and uses an `@example.com` address, and a live `curl -i http://localhost:3000/api/requesters` against the disposable Lab 1 database returned exactly those four active synthetic identities and no other personal data. `README.md` now states that the CORS origin restriction is browser hardening rather than authentication, authorization, or a privacy boundary, and that the unauthenticated Lab 2 application is restricted to development and test networks and must not be described as safe for public deployment. API-75 itself is not yet implemented and remains outside Issue #20. |
| Pinned test tooling (AC-62) | DATA-10 | Inspect root/client manifests and lockfiles: pinned client MSW, minimal private root package, pinned local Playwright, no workspaces/application dependency relocation, and no implicit download in E2E commands. | Not Run |
| Authoritative schema contract (AC-64) | PG-07, PG-08, PG-10, DATA-11 | Inspect Prisma mappings and committed migration SQL against Specification Section 7 for every field type/nullability/default, enum, key, restrictive FK, CHECK, and index; run boundary tests on fresh PostgreSQL without asserting an exact planner choice. | Passed — PG-07, PG-08, PG-10 |

## 16. Completion Rule

Lab 2 testing is complete only when:

1. every required planned automated test has a final result;
2. every `AC-01` through `AC-66` remains covered by at least one passing test or verified explicit delivery-evidence item;
3. required responsive and screenshot evidence has been captured;
4. required E2E flows pass;
5. all non-automated delivery evidence above is verified;
6. `tests.md`, `specification.md`, `api-spec.md`, and `ui-spec.md` remain mutually consistent.

If implementation architecture changes but externally observable behavior does not, filenames/class names may be updated to match the final code while preserving the same test responsibilities and AC traceability.
