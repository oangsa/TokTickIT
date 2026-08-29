# Lab 2 Test Specification

## 1. Purpose

This document defines the planned verification contract for TokTickIT Lab 2. It is derived from and must remain consistent with:

- `specification.md`
- `api-spec.md`
- `ui-spec.md`

Every Acceptance Criterion `AC-01` through `AC-66` is mapped to at least one planned test or explicit migration/delivery evidence in the traceability matrix at the end of this document.

Historical planning and fix-pass entries in Section 4 are retained for
traceability. The authoritative release snapshot is Section 15.3: every
implementation Issue has its own passing focused close gate, Issue #25's final
regression is reported separately rather than used to defer a feature gate,
and the post-merge `lab2-staging` integration result is recorded separately.

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

`Not Run` in an older chronological entry means that the evidence had not yet
been recorded at that point in the history. The historical executable snapshot
uses `Passed` as the prose form of `Pass`; it did not defer any feature close
gate. Current release-integration status is tracked separately in Section
15.3, where the post-merge staging validation is recorded after the corrected
evidence PR.

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

Visual tests capture screenshot evidence but do not require pixel-perfect screenshot-diff baselines. The Lab Sheet/sample screens are visual-direction references, not pixel-identical implementation templates. Required screen captures are committed under `docs/lab-02/evidence/screenshots/` so reviewers can inspect the working app without rerunning the browser suite.

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
| PostgreSQL integration suite | `server/` | `NODE_ENV=test TEST_DATABASE_URL=<dedicated_lab2_test_postgresql_url> npm test -- tests/lab-02/postgres` | Guarded setup applies the real Prisma migrations to `TEST_DATABASE_URL`; record the sanitized target database name and PG-01–PG-14 results. The suite must fail rather than use `DATABASE_URL`. |
| Backend typecheck/build | `server/` | `npm run build` | Record the TypeScript compilation result. |
| Install frontend dependencies | `client/` | `npm install` | Dependencies install without adding another UI framework or state library. |
| Frontend focused test | `client/` | `npm test -- tests/lab-02/<file>.test.tsx` | Use for the owning Issue's focused UI test gate. |
| Frontend full test suite | `client/` | `npm test` | Record the complete Vitest/React Testing Library result. |
| Frontend typecheck/build | `client/` | `npm run build` | Record the TypeScript and Vite build result. |
| Install pinned repository E2E tooling | repository root after #25 adds the minimal private package | `npm install` | Uses the committed root lockfile and pinned local `@playwright/test`; does not create npm/pnpm workspaces or move application dependencies. |
| Lab 2 E2E/responsive/visual suite | repository root after #25 adds Playwright config | `npm run test:e2e -- e2e/lab-02` | Resolves the locally installed pinned Playwright package and coordinates `client/`, `server/`, PostgreSQL, Chromium, approved viewports, and screenshot capture without implicit download. Required PNGs are written to tracked `docs/lab-02/evidence/screenshots/`; reports, traces, and failure-only captures remain under ignored `artifacts/lab-02/`. |

Do not run migration, seed, reset, or PostgreSQL integration setup against production or the normal development database. Use a disposable or explicitly designated Lab 2 database for fresh-database evidence and the separately guarded `TEST_DATABASE_URL` for PG-01–PG-14.

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
| Issue #21 server focused gate | `npm test -- tests/lab-02/TicketNumber.test.ts tests/lab-02/TicketService.test.ts tests/lab-02/IdempotencyService.test.ts tests/lab-02/tickets.api.test.ts tests/lab-02/create-ticket.api.test.ts tests/lab-02/ticket-idempotency.api.test.ts tests/lab-02/postgres/idempotency.postgres.test.ts tests/lab-02/postgres/transactions.postgres.test.ts` | `server/`; the four API files mock Prisma, the two PostgreSQL files run against `toktickit_lab2_test` | Passed — 8 files, 170 tests. |
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

### 4.5.21 Issue #21 final review fix verification

The following checks were run on 2026-08-25 from the listed package
directories, after the PR #34 final review fixes. They supersede the counts in
Section 4.5.20, which were recorded before the stale-Requester and
`attachmentIds` changes. The same guarded disposable `toktickit_lab2_test`
target was used; the normal development database was never used, migrated,
seeded, or reset.

| Check | Command | Environment / target | Result |
| --- | --- | --- | --- |
| Issue #21 server focused gate | `npm test -- tests/lab-02/TicketNumber.test.ts tests/lab-02/TicketService.test.ts tests/lab-02/IdempotencyService.test.ts tests/lab-02/tickets.api.test.ts tests/lab-02/create-ticket.api.test.ts tests/lab-02/ticket-idempotency.api.test.ts tests/lab-02/postgres/idempotency.postgres.test.ts tests/lab-02/postgres/transactions.postgres.test.ts` | `server/`; the four API files mock Prisma, the two PostgreSQL files run against `toktickit_lab2_test` | Passed — 8 files, 181 tests. |
| Issue #21 client focused gate | `npm test -- tests/lab-02/CreateTicket.test.tsx` | `client/` | Passed — 1 file, 38 tests. |
| CreateTicket + ApplicationShell stale-Requester regression | `npm test -- tests/lab-02/CreateTicket.test.tsx tests/lab-02/ApplicationShell.test.tsx` | `client/` | Passed — 2 files, 96 tests. The three stale previous-Requester completion regressions and the two requester-generation invalidation regressions passed. |
| PostgreSQL integration tests | `npm test -- tests/lab-02/postgres/` | `server/`; `toktickit_lab2_test` | Passed — 4 files, 36 tests. |
| Full server suite | `npm test -- tests/` | `server/`; `toktickit_lab2_test` | Passed — 20 files, 254 tests. |
| Full client suite | `npm test -- tests/` | `client/` | Passed — 6 files, 147 tests. |
| Backend build | `npm run build` | `server/` | Passed — `tsc` completed with no output. |
| Frontend typecheck/build | `npm run build` | `client/` | Passed — TypeScript and the Vite production build. |
| Whitespace check | `git diff --check` | repository root | Passed — no output. |

The stale previous-Requester completion regression is the one this pass was
opened for, so it is called out explicitly: a `POST /api/tickets` started under
Requester A is held unresolved, the Requester is changed to B through the shell
selector, and the original Promise is then settled. All three completion shapes
were covered and all three passed:

- a stale `201` does not navigate to A's `/tickets/:publicId`, does not clear
  B's recovery record, and renders no success state under B;
- a stale transport failure writes no A recovery record and does not overwrite
  B's;
- a stale `400 VALIDATION_ERROR` does not clear B's recovery record, does not
  mark or focus B's fields, and leaves B's Create Ticket form untouched.

Each of the three fails without the fix: replacing the generation comparison in
`RequesterProvider` with a constant `true` reproduces exactly the two reviewed
symptoms — B's record cleared by the stale success and A's record written over
B's by the stale failure.

The mechanism is a runtime Requester generation on the shared requester context
rather than anything local to Create Ticket. `captureRequesterContext()` returns
the current generation together with that generation's `AbortSignal`;
`isRequesterContextCurrent(token)` compares the captured generation against the
live one. Change Requester, the `REQUESTER_CONTEXT_INVALID` recovery, and
selecting a replacement Requester all advance it and abort the outgoing signal.
The generation is never persisted to `sessionStorage`: a token restored after a
reload would claim to be current for a context that no longer exists.

Cancellation is best effort and is deliberately not the safety mechanism. An
abort cannot prove the server did not already commit the Ticket, and the Promise
settles either way, so the generation check is what makes an obsolete completion
inert. The server result stays authoritative and is simply not consumed by the
current session; selecting Requester A again discovers it normally.
`apiFetch` now merges a caller signal with its own 8-second timeout instead of
replacing it, so a requester-scoped request keeps its deadline and also cancels
on a Requester change. The merge is written by hand because the jsdom the client
suite runs under does not implement `AbortSignal.any`, which keeps production and
the tests on the same path.

`attachmentIds` was also corrected in this pass. api-spec Section 8.2 defines it
as an optional array, so an explicit `null` is now a `400 VALIDATION_ERROR` with
`attachmentIds` in `details` and no Ticket transaction, rather than being treated
as `[]`. Omitted and `[]` both remain valid and both keep explicit coverage in
`tests/lab-02/create-ticket.api.test.ts`. The canonicalization rules are
unchanged: at most five values, UUID syntax, lowercase normalization, duplicates
rejected after normalization, and a lexicographically ascending sort.

Deferred follow-up, not changed in this PR: `isDevelopmentOrTest` in
`server/src/env.ts` treats an unset `NODE_ENV` as development/test, which keeps
the `http://localhost:5173` CORS fallback and the unauthenticated
`GET /api/requesters` bootstrap available. A fail-closed reading would treat only
an explicit `development` or `test` as inside that boundary and everything else,
`undefined` included, as outside. Local development in this repository currently
depends on the permissive reading — no tracked environment file sets `NODE_ENV`,
so `npm run dev` runs with it unset — so changing it silently here would break
the documented local workflow and is out of scope for PR #34. Both
`tests/lab-02/cors.api.test.ts` and `tests/lab-02/reference-data.api.test.ts`
already pin the current behavior and would need updating with it.

### 4.5.22 PR #34 final shared requester invalidation verification

The following checks were run on 2026-08-25 from the listed package
directories, against commit
`8c0b772bf39e97848b6f26a78c827df351bce372`, the last commit that changed
application/test code. Subsequent PR commits only update documentation and
repository-local ignore rules, so they do not change the executable tree
covered by these results. They supersede the counts in Section 4.5.21, which
were recorded before the shared requester API boundary was fixed and before
the Ticket DTO query stopped loading Attachment binary data. Section 4.5.21
is left as written; it is the record of the state of the tree at the time it
was run, not of this one. The same guarded disposable `toktickit_lab2_test`
target was used; the normal development database was never used, migrated,
seeded, or reset.

| Check | Command | Environment / target | Result |
| --- | --- | --- | --- |
| Issue #20 affected client requester gate | `npm test -- tests/lab-02/ApplicationShell.test.tsx tests/lab-02/RequesterSelection.test.tsx` | `client/` | Passed — 2 files, 71 tests. |
| CreateTicket + ApplicationShell stale-Requester gate | `npm test -- tests/lab-02/CreateTicket.test.tsx tests/lab-02/ApplicationShell.test.tsx` | `client/` | Passed — 2 files, 99 tests. |
| Issue #21 client focused gate | `npm test -- tests/lab-02/CreateTicket.test.tsx` | `client/` | Passed — 1 file, 38 tests. |
| Issue #21 server focused gate | `npm test -- tests/lab-02/TicketNumber.test.ts tests/lab-02/TicketService.test.ts tests/lab-02/IdempotencyService.test.ts tests/lab-02/tickets.api.test.ts tests/lab-02/create-ticket.api.test.ts tests/lab-02/ticket-idempotency.api.test.ts tests/lab-02/postgres/idempotency.postgres.test.ts tests/lab-02/postgres/transactions.postgres.test.ts` | `server/`; the four API files mock Prisma, the two PostgreSQL files run against `toktickit_lab2_test` | Passed — 8 files, 181 tests. |
| PostgreSQL integration gate | `npm test -- tests/lab-02/postgres/` | `server/`; `toktickit_lab2_test` | Passed — 4 files, 36 tests, no suite skipped. |
| Full server suite | `npm test -- tests/` | `server/`; `toktickit_lab2_test` | Passed — 20 files, 254 tests. |
| Full client suite | `npm test -- tests/` | `client/` | Passed — 6 files, 150 tests. |
| Backend build | `npm run build` | `server/` | Passed — `tsc` completed with no output. |
| Frontend typecheck/build | `npm run build` | `client/` | Passed — TypeScript and the Vite production build. |
| Whitespace check | `git diff --check` | repository root | Passed — no output. |

The client count moved from 147 to 150 because this pass added three
regressions to `tests/lab-02/ApplicationShell.test.tsx`. The server counts are
unchanged from Section 4.5.21: the fix is client-side, and the Ticket DTO query
change that preceded it was already covered by the existing suites, which were
rerun here against the final code rather than re-proved with new tests.

The blocker this pass was opened for is stated explicitly: **a stale
`REQUESTER_CONTEXT_INVALID` response belonging to Requester A can no longer
clear Requester B.** The new regression drives the shared boundary directly —
`useRequesterApi` under the real `RequesterGuard` — because that is the layer
that owns the clear:

1. Requester A is active and starts a requester-scoped request;
2. the request is held unresolved and Requester B is selected;
3. B's own ambiguous-submission recovery record is seeded after the switch;
4. the original Promise is then settled with `400 REQUESTER_CONTEXT_INVALID`.

After the stale response settles: B is still the selected Requester, B is still
in `sessionStorage`, B's recovery record is untouched, the guarded page is still
mounted, and the application has not returned to `/requesters`. The caller still
receives the `InvalidRequesterContextError`; only the context clear is withheld.

The test fails without the fix. Dropping the generation comparison from
`useRequesterApi` — leaving the bare
`if (error instanceof InvalidRequesterContextError) clearRequester()` the review
found — reproduces the reviewed symptom exactly and that one test goes red while
the other 60 in the file stay green.

The stub deliberately ignores its abort signal and settles anyway, so the
regression cannot pass merely because cancellation stopped the mocked Promise.
That is the point of the design: an aborted request may already have reached the
server and been answered, so the AbortController is best-effort cancellation and
the generation token is the correctness boundary. Two further regressions cover
the cancellation side of the same fix — a caller-supplied signal no longer
replaces the requester-context signal, so the request still aborts on a
Requester change, and the caller's own signal still aborts it. With the
`apiFetch` timeout that makes three independent cancellation sources for one
requester-scoped request.

The previously recorded behavior is retained and was rerun here rather than
assumed: a current-generation `REQUESTER_CONTEXT_INVALID` still clears the
stored Requester and returns to `/requesters`; an ordinary `BAD_REQUEST` or
`VALIDATION_ERROR` still clears nothing; and the three stale Create Ticket
completion regressions from Section 4.5.21 — stale `201`, stale ordinary `4xx`,
and stale ambiguous failure — all still pass, so Requester A still cannot
navigate, clear, overwrite, or mark anything belonging to Requester B.

The `attachmentIds` contract from Section 4.5.21 is unchanged and still covered:
omitted and `[]` are valid, an explicit `null` is a `400 VALIDATION_ERROR`, and
the canonicalization rules — at most five, UUID syntax, lowercase, duplicates
rejected after normalization, ascending sort — are unchanged. The Ticket DTO
query change is likewise unchanged and covered by the reran suites: a first
create returns the full TicketDTO, a same-key replay returns the current
TicketDTO, bound Attachment metadata including `ticketPublicId` and `sizeBytes`
is present, and no Attachment binary `data` is loaded or returned to build it.

The `NODE_ENV` reading described at the end of Section 4.5.21 remains a
deliberate non-blocking follow-up and was not changed in this pass.

### 4.5.23 Issue #22 verification evidence

The following checks were run on 2026-08-26 from the listed package
directories. The disposable PostgreSQL password is intentionally redacted. Two
disposable databases on the same throwaway PostgreSQL 16 instance at
`localhost:55432` were used - `toktickit_lab2_test` for `TEST_DATABASE_URL` and
`toktickit_lab1_dev` for `DATABASE_URL`/`DIRECT_URL`, migrated and seeded first,
for the reason given in Section 4.5. The normal development database was never
used, migrated, seeded, or reset; the seed target was confirmed by counting rows
in the disposable database afterwards.

Issue #22 changed no Prisma schema, migration, or seed file. The existing
partial index `ticket (requester_id, created_at DESC, id DESC) WHERE deleted =
false` already matches the ownership predicate and the default ordering, and the
existing `pg_trgm` GIN indexes already cover the case-insensitive search, so no
schema change was required or made.

| Check | Command | Environment / target | Result |
| --- | --- | --- | --- |
| Disposable Lab 1 target migration | `DATABASE_URL=<lab1_dev_url> DIRECT_URL=<same> npx prisma migrate deploy` | Disposable `toktickit_lab1_dev` | Passed — both forward migrations applied. |
| Disposable Lab 1 target seed | `DATABASE_URL=<lab1_dev_url> DIRECT_URL=<same> npm run prisma:seed` | Disposable `toktickit_lab1_dev` | Passed — seeded 4 categories, 7 related systems, and 5 development requesters; a direct row count against the disposable target confirmed 4/7/5. |
| Issue #22 focused gate | `npx vitest run tests/lab-02/QueryBuilder.test.ts tests/lab-02/TicketQueryValidator.test.ts tests/lab-02/my-tickets.api.test.ts tests/lab-02/cors.api.test.ts` | `server/`; Prisma is mocked in both API files, so no database target was involved | Passed — 4 files, 161 tests. |
| Full server suite, single invocation | `NODE_ENV=test DATABASE_URL=<lab1_dev_url> DIRECT_URL=<same> TEST_DATABASE_URL=<lab2_test_url> npm test` | Both disposable databases | Passed — 23 files, 406 tests, including the four guarded PostgreSQL files (`migration-upgrade`, `transactions`, `idempotency`, `testDatabase`), which passed unchanged as expected for an Issue that touched no schema, migration, or seed file. |
| Backend build | `npm run build` | `server/` | Passed — `tsc` completed with no output. |
| Issue #22 client focused gate | `npx vitest run tests/lab-02/MyTickets.test.tsx` | `client/` | Passed — 1 file, 33 tests. |
| Frontend full test suite | `npm test` | `client/` | Passed — 7 files, 183 tests. |
| Frontend typecheck/build | `npm run build` | `client/` | Passed — TypeScript and the Vite production build. |
| Diff hygiene | `git status --short`, `git diff --stat` | repository | Passed — 10 modified files and 9 new paths, all inside `server/src`, `server/tests`, `client/src`, `client/tests`, and `docs/lab-02`. |

Three consequences of this Issue reached files it does not own, and are recorded
here rather than left to look incidental:

- The client fetch doubles in `ApplicationShell.test.tsx`, `CreateTicket.test.tsx`,
  and `RequesterSelection.test.tsx` returned `{ ok, status, json }` with no
  `headers`. My Tickets is the first caller to read a response header, so those
  doubles were completed rather than having production code defend against an
  incomplete fake.
- `CreateTicket.test.tsx` routed by path only, so its `POST /api/tickets`
  fall-through also answered the new list read. It now branches on the method.
- One `getByRole("navigation")` in `ApplicationShell.test.tsx` became ambiguous
  once the list renders its own pagination landmark, and now names the sidebar.

`userEvent` deadlocks under Vitest fake timers — reproduced on a bare `<input>`
with no application code involved — so UI-18 drives the debounce with the change
event it listens to instead. `apiFetch` arms an 8 s `AbortSignal.timeout`, which
is also faked in that block, so no case may advance near it.

Responsive and visual browser coverage and the manual browser smoke were not run
in this pass; the responsive/visual evidence remains assigned to Issue #25.

The counts in the table above are superseded by Section 4.5.24, which records
the tree as it stands after the Issue #22 review fixes.

### 4.5.24 Issue #22 review fix verification

Two review findings were fixed after the Section 4.5.23 pass, so the counts
recorded there no longer describe the tree. This section supersedes them.

1. `MyTickets.tsx` unmounted the pagination controls whenever a settled load
   returned no rows. BR-38 makes a page past the last one a `200` with an empty
   array, so the row count alone cannot separate that from a genuinely empty
   result — only the total can. A shared or restored `?pageNumber=5` therefore
   settled on the no-results state with no control left to correct it, because
   the clamp `Pagination` reports through `onPageChange` needs the component
   mounted to fire. The condition now reads the total instead of the row count,
   which keeps the controls for a rowless page of a non-empty result and still
   hides them for a true empty one.
2. The "sorts Priority semantically" case in `TicketQueryValidator.test.ts`
   claimed in its comment to fail if a migration ever reordered the enum. It
   could not: it asserted only the identity passthrough, which holds whatever
   the migration declares. The premise is now asserted directly against the
   `CREATE TYPE "RequestedPriority"` DDL — the hand-written migration is the
   only authority on the order PostgreSQL will sort by, so neither
   `schema.prisma` nor the generated client is read for it.

Both fixes were confirmed non-vacuous by reverting the change under test and
observing the new case fail: the pagination case failed `expected '5' to be '3'`
against the old condition, and the enum case failed
`expected [ 'HIGH', 'MEDIUM', 'LOW' ] to deeply equal [ 'LOW', 'MEDIUM', 'HIGH' ]`
against a deliberately reordered `CREATE TYPE`. The migration was restored and
`git diff prisma/` is empty.

| Check | Command | Environment / target | Result |
| --- | --- | --- | --- |
| Issue #22 focused gate | `npx vitest run tests/lab-02/QueryBuilder.test.ts tests/lab-02/TicketQueryValidator.test.ts tests/lab-02/my-tickets.api.test.ts tests/lab-02/cors.api.test.ts` | `server/`; Prisma is mocked in both API files, so no database target was involved | Passed — 4 files, 170 tests. |
| Backend build | `npx tsc --noEmit` | `server/` | Passed — no output. |
| Full server suite, non-PostgreSQL | `npm test` | `server/`; no PostgreSQL target configured in this pass | Passed — 19 non-PostgreSQL files, 379 tests; 415 collected across 23 files with the 36 guarded PostgreSQL cases not executed. |
| Issue #22 client focused gate | `npx vitest run tests/lab-02/MyTickets.test.tsx` | `client/` | Passed — 1 file, 36 tests. |
| Frontend full test suite | `npm test` | `client/` | Passed — 7 files, 186 tests. |
| Frontend typecheck | `npx tsc --noEmit` | `client/` | Passed — no output. |

The four guarded PostgreSQL files were **not** re-run in this pass: no
PostgreSQL target was available to it. Both fixes are confined to a client
render condition and a test-only assertion, and neither touches the schema, a
migration, the seed, or any query construction, so the Section 4.5.23 PostgreSQL
result stands unchanged for them. Responsive, visual, and manual browser
coverage likewise remain assigned to Issue #25.

Three review findings were reported and deliberately **not** fixed here:

- `GET /api/tickets` has no PostgreSQL-backed case; every assertion in
  `my-tickets.api.test.ts` is on the arguments handed to a mocked Prisma client.
  Prisma-level semantics — `mode: "insensitive"` against the `CHAR(25)`
  `ticket_number`, `NOTEQUAL` on `NOT NULL` columns, the single
  `Prisma.TicketWhereInput` cast, and the enum sort the fix above pins only at
  the DDL — remain unexecuted. This is coverage the guarded suites should own.
- Search terms are passed to Prisma `contains` unescaped, so `%` and `_` in a
  term act as LIKE wildcards rather than literals. Escaping them is one line in
  `readSearch`, but it changes matching for `filters` `CONTAINS` too and cannot
  be verified without the PostgreSQL coverage above.
- Ticket rows are focusable `<tr>` elements with `aria-label` and no interactive
  role, so assistive technology announces a row rather than an activatable
  control.

The counts in this section are superseded by Section 4.5.26, which records the
tree as it stands after the third Issue #22 review fix pass.

### 4.5.25 Issue #22 second review fix pass

A second outsider review of the Issue #22 change produced five fixes. The counts
below are superseded by Section 4.5.26.

1. **The pagination clamp pushed a history entry.** `MyTickets.tsx` passed the
   same `onPageChange` callback to both a user page change and the correction
   `Pagination` reports for a page past the last one, and that callback pushed.
   A shared or restored `?pageNumber=5` therefore left the out-of-range address
   in history: Back landed on it, the clamp fired again, and it pushed again, so
   the user could never navigate back past that entry. A correction now replaces
   the address it corrects; a Previous/Next/page-number click still pushes.
2. **Both empty states could describe a page that was about to be corrected.**
   The clamp runs in a passive effect, so the render before it committed and
   painted "No tickets found. / Try changing your search or filters." with a
   Clear Filters button, on an address with neither a search nor a filter
   active. The same predicate that decides push-versus-replace now suppresses
   both empty states while a correction is pending. Guarded on
   `totalItems > 0` exactly as `Pagination`'s own clamp is, so a genuinely empty
   result set keeps its true-empty state.
3. **`MAX_PAGE_NUMBER = 1_000_000` contradicted the specification it cited.**
   api-spec Section 9.12 states the rule as `pageNumber >= 1` and makes an
   out-of-range page a `200` with an empty array, so the ceiling answered a
   valid request with a `400`, and `TicketQueryValidator.test.ts` had locked
   that in. The comment justified the bound by integer overflow of `skip`, which
   does not hold at 1,000,000: `skip` is a `number`, PostgreSQL `OFFSET` is
   `bigint`, and `Number.isSafeInteger` already guards the real ceiling. The
   constant is removed. `pageNumber` is now bounded only by the safe-integer
   range, and `ticketListService.ts` skips the row read — running the count
   alone, so `X-Pagination` stays complete — when `(pageNumber - 1) * pageSize`
   leaves that range. The specification did not change; the code moved to it.
4. **Datetime filter values were not actually checked for ISO-8601.**
   `new Date(raw)` alone reads `"5"` as 2001-05-01 and `"Dec 5 2026"` as a date,
   so a `createdAt` filter could silently mean a moment the caller never asked
   for while the rejection message promised ISO-8601. The shape is now checked
   before parsing, and `new Date` still rejects a well-shaped impossible date
   such as `"2026-13-45"`.
5. **`?searchFields=a&searchFields=b` reported one problem as two details.**
   The array was rejected as "supplied at most once" and then again as
   "required when search is supplied", the second of which is not true. Only the
   first is now reported.

Two review findings were deliberately not fixed and are recorded instead, both
carried forward from Section 4.5.24's pass:

- **No PostgreSQL execution coverage of the list read path.** Every assertion in
  `my-tickets.api.test.ts` reads the arguments handed to a mocked
  `ticket.findMany`/`count`. Ownership is proved as "the `where` contains
  `{ requesterId }`", not as "another Requester's rows do not come back", and
  the composed `AND`, `mode: "insensitive"` on `not`, and semantic Priority
  ordering are never executed by an engine. The `postgres/` harness already
  exists; this is the largest remaining unknown in the feature.
- **Unescaped LIKE wildcards in search terms.** `%` and `_` reach PostgreSQL as
  wildcards, so `100%` matches every row containing `100`. Prisma parameterizes
  the value, so this is not injection and no scope predicate is weakened. The
  ceiling and its upgrade path are now marked at `queryBuilder.ts` rather than
  recorded only in `ai-use.md`.

Every new case was confirmed non-vacuous by restoring the pre-fix source and
observing it fail: 8 server cases failed against the previous
`ticketQueryValidator.ts`/`ticketListService.ts`, and the Back case failed
against the previous `MyTickets.tsx`. All three files were restored from a
copy taken before the revert, and the fixed suites pass again.

| Check | Command | Environment / target | Result |
| --- | --- | --- | --- |
| Issue #22 focused gate | `npx vitest run tests/lab-02/QueryBuilder.test.ts tests/lab-02/TicketQueryValidator.test.ts tests/lab-02/my-tickets.api.test.ts tests/lab-02/cors.api.test.ts` | `server/`; Prisma is mocked in both API files, so no database target was involved | Passed — 4 files, 181 tests. |
| Full server suite, non-PostgreSQL | `npx vitest run --exclude 'tests/lab-02/postgres/**'` | `server/` | Passed — 19 files, 390 tests. |
| Backend typecheck | `npx tsc --noEmit` | `server/` | Passed — no output. |
| Backend build | `npm run build` | `server/` | Passed — `tsc` produced no diagnostics. |
| Issue #22 client focused gate | `npx vitest run tests/lab-02/MyTickets.test.tsx` | `client/` | Passed — 1 file, 37 tests. |
| Frontend full test suite | `npm test` | `client/` | Passed — 7 files, 187 tests. |
| Frontend typecheck | `npx tsc --noEmit` | `client/` | Passed — no output. |
| Frontend build | `npm run build` | `client/` | Passed — `tsc && vite build` completed. |
| Guarded PostgreSQL suites | `npm test` | `server/`; no reachable target | Not run — 3 files fail at connection with `password authentication failed for user "lab2_test"` (`28P01`). Pre-existing environmental state, unrelated to these fixes: no schema, migration, seed, or query construction changed. |


### 4.5.26 Issue #22 third review fix pass

A third outsider review produced five fixes. The counts below are superseded by
Section 4.5.27.

1. **An unresolved Requester would have widened the read to every Requester.**
   `routes/tickets.ts` reads `req.requesterId`, which is optional on the Express
   type, and passes it through an `as number` cast. Prisma reads `undefined` in
   a `where` as "predicate not supplied", so `{ requesterId }` would have
   collapsed to `{}` and answered `200` with every Requester's rows, counts, and
   `X-Pagination` -- failing open, with nothing to log. `requireRequesterContext`
   covers this route today and the cast was the only thing hiding the shape from
   the compiler, so the risk was latent rather than live. It is now closed where
   all callers route through it: `listTicketsForRequester` rejects a requesterId
   that is not a positive safe integer before building the `where`, which turns a
   future gap in the guard's cover into a loud `500` instead of a scope leak.
   Contrast the create path, where a missing requesterId already fails loudly on
   the foreign key; only the read path could fail silently.
2. **The pagination footer claimed a result range while the rows were still in
   flight.** `MyTickets.tsx` clears `pagination` before each request and keeps
   the controls mounted so the structure does not jump (ui-spec Section 19.1),
   so the range derived from a zero total painted "Showing 0–0 of 0" underneath
   the skeleton rows and contradicted them. The control is unmounted by its
   caller for a genuinely empty result set, so a zero total inside a rendered
   `Pagination` means a fetch is pending; the range line now yields to a
   height-preserving placeholder in exactly that case.
3. **The range was also an `aria-live` region, so the false zero was
   announced.** Every search pause, sort change, and page click announced
   "Showing 0–0 of 0" and then corrected itself, which reports the loading state
   as an empty result and blurs two states ui-spec Section 19 requires to stay
   distinct. `Pagination` is no longer a live region at all; the page owns one
   announcement, which is the next fix.
4. **The loading announcement was mounted only while loading.** A `role="status"`
   node inserted into the DOM with its text already present is announced
   inconsistently, because assistive technology reports mutations to a region
   already in the accessibility tree -- so the announcement ui-spec Section 29.7
   asks for often never fired, and `MyTickets.test.tsx` asserted the region's
   *absence* after load, locking the shape in. `RequesterSelection.tsx` already
   solves this in the same repository against the same specification section, so
   its pattern was reused rather than re-derived: the region stays mounted and
   only its text changes, and it now carries the result count that the removed
   `Pagination` live region used to announce.
5. **String filter values had no length bound.** `search` has always been capped
   at 200 characters, but a string filter value was unbounded, so only Node's
   request-line limit stood between a hand-built URL and a multi-kilobyte
   `contains` term -- long enough to defeat `ticket_summary_trgm_idx` and
   `ticket_description_trgm_idx` and turn one request into a scan. Values are now
   capped at `MAX_FILTER_VALUE_LENGTH = 2000`, the longest filterable text column
   (`description`); `summary` is 150 and `ticketNumber` is 25, so nothing longer
   could match a row and no legitimate query is lost. Counted in code points, for
   the same reason `readSearch` counts them, and applied to every element of an
   `IN` array because they share one conversion.

The `28P01` connection failure recorded in Sections 4.5.24 and 4.5.25 was not an
unreachable target. The `toktickit-lab2-test-postgres` container was running and
listening on `localhost:55432` throughout; the `TEST_DATABASE_URL` password in
the untracked local `.env.local` had simply drifted from the container's
`POSTGRES_PASSWORD`. Supplying the container's own credential ran all four
guarded suites to a pass. Those earlier sections are left as written -- they
record what each pass observed -- but their "no reachable target" reading was
wrong, and no pass since Issue #18 needed to skip PostgreSQL for the reason it
gave.

This does **not** close the finding below. The harness works; it has no coverage
of the Ticket list read path.

Two review findings were deliberately not fixed and are recorded instead, both
carried forward from Section 4.5.25's pass:

- **No PostgreSQL execution coverage of the list read path.** Still the largest
  remaining unknown in the feature, and now known to be unwritten coverage
  rather than an unavailable target: the four guarded suites pass against a real
  engine, and none of them touches `GET /api/tickets`. Every assertion in
  `my-tickets.api.test.ts` reads the arguments handed to a mocked
  `ticket.findMany`/`count`. AC-21 is proved as "the `where` contains
  `{ requesterId }`", not as "another Requester's rows do not come back", and
  the composed `AND`, `mode: "insensitive"` on `not`, semantic Priority
  ordering, and `contains` against a `CHAR(25)` `ticket_number` are never
  executed by an engine. Fix 1 above narrows the ownership question but does not
  answer it: it proves the predicate cannot be dropped, not that PostgreSQL
  applies it as intended. Writing it is now a matter of adding a suite to a
  working harness.
- **Unescaped LIKE wildcards in search terms.** Unchanged. `%` and `_` reach
  PostgreSQL as wildcards, so `100%` matches every row containing `100`. Prisma
  parameterizes the value, so this is not injection and no scope predicate is
  weakened. The ceiling and its upgrade path stay marked at `queryBuilder.ts`.

One finding was raised and left open as unverified rather than fixed:

- **A disabled fieldset drops keyboard focus on every fetch.**
  `MyTickets.tsx` wraps the pagination controls in `<fieldset disabled={loading}>`
  because ui-spec Section 19.1 requires controls that cannot safely operate
  during a fetch to be disabled. Clicking Next therefore disables the control
  under the user's focus, and the browser blurs to `<body>`. This was reasoned
  from the HTML disabled-fieldset rule, not observed: jsdom does not model it
  faithfully, so no test here can confirm or refute it, and the available fixes
  (`aria-disabled` with guarded handlers, or explicit focus restoration) trade a
  specification-mandated mechanism for a hand-rolled one. Recorded for a pass
  that can verify in a real browser.

Every new case was confirmed non-vacuous by restoring the pre-fix source and
observing it fail: 3 server cases failed against the previous
`ticketListService.ts`/`ticketQueryValidator.ts`, and 2 client cases failed
against the previous `Pagination.tsx`/`MyTickets.tsx`. All four files were
restored from a copy taken before the revert, and the fixed suites pass again.

| Check | Command | Environment / target | Result |
| --- | --- | --- | --- |
| Issue #22 focused gate | `npx vitest run tests/lab-02/QueryBuilder.test.ts tests/lab-02/TicketQueryValidator.test.ts tests/lab-02/my-tickets.api.test.ts tests/lab-02/cors.api.test.ts` | `server/`; Prisma is mocked in both API files, so no database target was involved | Passed — 4 files, 184 tests. |
| Full server suite, non-PostgreSQL | `npx vitest run --exclude 'tests/lab-02/postgres/**'` | `server/` | Passed — 19 files, 393 tests. |
| Backend typecheck | `npx tsc --noEmit` | `server/` | Passed — no output. |
| Backend build | `npm run build` | `server/` | Passed — `tsc` produced no diagnostics. |
| Issue #22 client focused gate | `npx vitest run tests/lab-02/MyTickets.test.tsx` | `client/` | Passed — 1 file, 38 tests. |
| Frontend full test suite | `npm test` | `client/` | Passed — 7 files, 188 tests. |
| Frontend typecheck | `npx tsc --noEmit` | `client/` | Passed — no output. |
| Frontend build | `npm run build` | `client/` | Passed — `tsc && vite build` completed. |
| Guarded PostgreSQL suites | `TEST_DATABASE_URL=... npx vitest run tests/lab-02/postgres` | `server/`; `postgres:16-alpine` in the `toktickit-lab2-test-postgres` container on `localhost:55432` | Passed — 4 files, 36 tests. |


### 4.5.27 Issue #22 PostgreSQL coverage of the list read path

The finding carried unfixed through Sections 4.5.24, 4.5.25, and 4.5.26 is
closed. `tests/lab-02/postgres/my-tickets.postgres.test.ts` (PG-15) executes the
My Tickets read path against a real engine, so the claims that lived entirely on
the Prisma side of the mock boundary are now outcomes rather than argument
assertions. This section supersedes the counts in Section 4.5.26.

The suite drives `listTicketsForRequester` through `parseTicketListQuery`, so
each case exercises the real validator to QueryBuilder to Prisma path. It is
built on a fixture whose rows are designed to be returned wrongly: two
Requesters whose Tickets match each other's search terms and filters, a
logically deleted row that would match an active search, a Ticket on reference
rows that later go inactive and deleted, and forty rows sharing one creation
instant.

What it settles that the mocked suite could not:

- **Ownership as an outcome.** Neither Requester's rows, totals, or pages reach
  the other, including under a search term that matches both. AC-21 no longer
  rests on "the `where` contains `{ requesterId }`".
- **`mode: "insensitive"` actually reaching the comparison**, for `contains` and
  for `not` — the latter typed by Prisma but documented narrowly — and against
  `ticket_number`, which is `CHAR(25)` rather than `TEXT`.
- **Semantic Priority ordering.** Previously pinned by reading
  `CREATE TYPE "RequestedPriority"` out of the migration; now asserted as the
  row order PostgreSQL actually returns. Alphabetically `HIGH < LOW < MEDIUM`,
  so an enum compared as text would put `LOW` second in a descending sort.
- **Description searchable while absent from the projection**, and historical
  Category and Related System names surviving both master rows going inactive
  and logically deleted.
- **Paging** complete and duplicate-free across a wide tie and beyond the final
  page.

Non-vacuity was established per fault rather than in bulk, because removing the
scope predicate fails all eleven cases at once and isolates nothing:

- Removing `{ requesterId }` and `{ deleted: false }` from the base predicate:
  11 of 11 fail.
- Restoring those and setting `caseInsensitive` to `false` in the Ticket
  validator: exactly the 5 case-sensitivity-dependent cases fail, the other 6
  pass — which is what shows the case-insensitivity assertions are carried by
  the flag and not by fixture spelling.

**One claim could not be falsified, and the test says so rather than implying
otherwise.** Deleting the `id DESC` tiebreaker from `readOrder` leaves every
case here passing — first at two tied rows, then again at forty paged in sevens,
which was written specifically to try to break it. PostgreSQL's sort is
deterministic for a given plan, so no fixture can make it choose a different
arrangement of tied rows on demand. The tiebreaker is a guarantee about behavior
PostgreSQL leaves unspecified across plan changes, and that is exactly the shape
of claim a fixture cannot refute. The wide-tie case was therefore rewritten to
assert only what it owns -- the walk is complete and duplicate-free -- with the
measurement recorded in the test itself, and the presence of `id DESC` in the
emitted `orderBy` stays pinned structurally by `my-tickets.api.test.ts`. An
earlier draft of this case asserted an exact row order and claimed to prove the
tiebreaker; it did not, and it was removed rather than kept as a passing test
that argues for something it cannot show.

One review finding remains open, unchanged:

- **Unescaped LIKE wildcards in search terms.** `%` and `_` reach PostgreSQL as
  wildcards, so `100%` matches every row containing `100`. Prisma parameterizes
  the value, so this is not injection and no scope predicate is weakened. It was
  previously blocked on the coverage this section adds and is now verifiable;
  the ceiling and upgrade path stay marked at `queryBuilder.ts`.

The `<fieldset disabled>` keyboard-focus finding from Section 4.5.26 also
remains open and still needs a real browser, which is Issue #25's scope.

| Check | Command | Environment / target | Result |
| --- | --- | --- | --- |
| New PostgreSQL suite | `NODE_ENV=test TEST_DATABASE_URL=<lab2_test_url> npx vitest run tests/lab-02/postgres/my-tickets.postgres.test.ts` | `server/`; `postgres:16-alpine` in the `toktickit-lab2-test-postgres` container on `localhost:55432` | Passed — 11 tests. |
| All guarded PostgreSQL suites | `NODE_ENV=test TEST_DATABASE_URL=<lab2_test_url> npx vitest run tests/lab-02/postgres` | same target | Passed — 5 files, 47 tests. |
| Full server suite, non-PostgreSQL | `npx vitest run --exclude 'tests/lab-02/postgres/**'` | `server/` | Passed — 19 files, 393 tests. |
| Backend typecheck | `npx tsc --noEmit` | `server/` | Passed — no output. |
| Frontend full test suite | `npx vitest run` | `client/` | Passed — 7 files, 188 tests. |

### 4.5.28 Issue #22 fourth review fix pass

A fourth outsider review traced the read path against a live `postgres:16-alpine`
engine with Prisma query logging and `EXPLAIN` on. It produced three defects and
two nits. This section supersedes the counts in Section 4.5.27.

1. **A LIKE wildcard in a value was read as pattern syntax, and case-insensitive
   `EQUAL` was therefore not equality.** Prisma parameterizes the value, so `%`
   and `_` inside it were never injection and never weakened the ownership or
   `deleted = false` predicates — but PostgreSQL still read them as wildcards.
   The logged SQL showed the mechanism: `mode: "insensitive"` makes Prisma
   render `equals` as `summary ILIKE $3` rather than `summary = $3`, so an
   exact-match filter silently became a pattern match. Against a seeded pair,
   `EQUAL summary = "battery at 100% capacity"` returned both
   `Battery at 100% capacity` **and** `Battery at 1009 capacity`, and `NOTEQUAL`
   of that value excluded both. Search had the same defect one layer up:
   `search=100%` matched `1009`, and `search=Printer_Room` matched
   `PrinterXRoom`. The condition had been recorded as a deliberate `ponytail:`
   deferral in `queryBuilder.ts`, but the note covered only the widening of
   search and did not name the loss of equality, and no test held it.
   `queryBuilder.ts` now escapes `\`, `%`, and `_` in any string value bound
   into a pattern-rendered condition — `CONTAINS`, `STARTWITH`, and `ENDWITH`
   always, `EQUAL` and `NOTEQUAL` once they carry `mode: "insensitive"` — and
   never for `IN`, which renders as `IN (...)` and would otherwise be made to
   search for a literal backslash. The escape sits in the shared builder rather
   than in `ticketQueryValidator.ts` because which Prisma filter becomes a
   pattern is the builder's own rendering decision; a resource cannot know it
   without duplicating that table, and every future resource inherits the fix.
   Verified by reverting the escape with the new tests in place: all four fail,
   including the PostgreSQL case.
2. **The result announcement could contradict the rendered rows.**
   `readPaginationHeader` returns `null` for an `X-Pagination` header a proxy
   dropped or mangled, and `MyTickets.tsx` announced `${pagination?.totalItems
   ?? 0} tickets` — "0 tickets" over a full page of rows. The header stays the
   authority on the total, and the rows now answer for themselves only in that
   one degraded case.
3. **The first search commit replaced its history entry.** The debounce always
   passed `replace: true`, so moving from `/tickets` to `/tickets?search=abc`
   left no entry behind and Back exited the list instead of clearing the search.
   The first commit now pushes; every subsequent one still replaces, so Back
   does not walk the search letter by letter.

4. **`IN` was case-sensitive on a text field where `EQUAL` was not.** BR-33
   makes every string search/filter condition case-insensitive without
   qualification, and api-spec Section 9.7 lists `IN` in the String row, so this
   was a rule violation rather than a documented wart. Prisma honours `mode` for
   `equals`, `contains`, `startsWith`, `endsWith`, and `not` only and silently
   ignores it for `in`, so the flag could not be emitted: against the same field
   and value, `EQUAL "battery at 100% capacity"` matched while
   `IN ["battery at 100% capacity"]` returned nothing. `buildFilter` now expands
   an insensitive `IN` into the OR of insensitive equality it means, one level
   deep, each branch inheriting the wildcard escape. `buildWhere` still places
   the result as a single `AND` member, so it is a server-side rendering of one
   whitelisted condition and not a nested OR group a client can compose. The
   Requester UI was unaffected throughout: it emits `IN` only for reference and
   enum fields.
5. **`ticket_ticket_number_trgm_idx` could never be used.** The index was
   created on the expression `(ticket_number::text)` because `gin_trgm_ops`
   refuses a `character` column, while Prisma emits `ticket_number ILIKE $1`
   with no cast — and PostgreSQL matches an expression index only against that
   same expression. `EXPLAIN` over 30,000 rows returned `Seq Scan on ticket`
   even under `enable_seqscan = off`, which distinguishes an index the planner
   declined from one it could not use at all; `summary` under the same forcing
   switched to a Bitmap Index Scan, so the two indexes were not equivalent.
   Ticket Numbers are exactly 25 characters by the format `CHECK`, so `CHAR(25)`
   bought nothing that `VARCHAR(25)` does not, and it also carried the
   blank-padding semantics every string comparison had to be reasoned about
   against. The column is now `VARCHAR(25)` and the index sits on the bare
   column, matching `summary` and `description`; `schema.prisma` declares it, so
   the drift where the migration held an index the schema could not express is
   closed as well. The suite now asserts plan reachability rather than index
   existence, since every existing assertion passed while the index was dead.

One finding was reported and deliberately left open:

- **The `X-Pagination` count and the page read are two statements, not one
  snapshot.** A concurrent insert can shift `totalItems` between them. This is
  the pre-existing `ponytail:` note in `ticketListService.ts`, unchanged: the
  fix is to wrap both in `$transaction`, and it is only owed if the count ever
  has to be exact to the row.

| Check | Command | Environment / target | Result |
| --- | --- | --- | --- |
| All guarded PostgreSQL suites | `NODE_ENV=test TEST_DATABASE_URL=<lab2_test_url> npx vitest run tests/lab-02/postgres` | `server/`; `postgres:16-alpine` in the `toktickit-lab2-test-postgres` container on `localhost:55432` | Passed — 5 files, 49 tests. |
| Full server suite, non-PostgreSQL | `npx vitest run --exclude 'tests/lab-02/postgres/**'` | `server/` | Passed — 19 files, 399 tests. |
| Backend typecheck | `npx tsc --noEmit` | `server/` | Passed — no output. |
| Frontend typecheck | `npx tsc --noEmit` | `client/` | Passed — no output. |
| Frontend full test suite | `npx vitest run` | `client/` | Passed — 7 files, 190 tests. |

### 4.5.29 Issue #22 fifth review fix pass

A fifth outsider review traced the read path and the screen end to end and
produced four defects. A follow-up pass then closed every item the four previous
passes had recorded as deliberately open. This section supersedes the counts in
Section 4.5.28.

Review findings:

1. **An impossible calendar day was accepted and silently rolled forward.**
   `ticketQueryValidator.ts` shape-checked a datetime value against an ISO-8601
   pattern and relied on `new Date` to reject anything the pattern let through,
   on the stated assumption that a well-shaped impossible date fails the parse.
   That holds only when the month is out of range: `"2026-13-45"` falls outside
   the ECMAScript grammar and drops to the fallback parser, which answers `NaN`.
   A day out of range for its month stays inside the grammar, so `MakeDay` rolls
   it forward — `"2026-02-30"` parsed to `2026-03-02`, and
   `createdAt GREATER "2026-02-30"` answered `200` with rows two days from the
   ones asked for. The pattern now captures the date parts and `isCalendarDate`
   checks them arithmetically rather than through a second `Date` round trip,
   because `Date.UTC(26, 0, 1)` is 1926 and a four-digit year below 100 would
   fail a comparison it should pass. Both leap-year rules hold: `2024-02-29` and
   `2000-02-29` are accepted, `2026-02-29` and `1900-02-29` are not.
2. **The Created At column contradicted the Ticket Number in the same row.**
   `MyTickets.tsx` rendered `createdAt.slice(0, 10)`, which is the UTC date,
   while the Ticket Number embeds the `Asia/Bangkok` business date (BR-01-03).
   For the seven hours a day the calendars differ, one row read
   `TKT-20260827-...` beside a Created At of `2026-08-26`. It now formats
   through a pinned `en-CA`/`Asia/Bangkok` `Intl.DateTimeFormat`: the same
   `YYYY-MM-DD` shape and the same per-machine and CI stability the slice was
   chosen for, on the calendar the row already commits to.
3. **A dropped `X-Pagination` header picked the wrong empty state and removed
   every pagination control.** `readPaginationHeader` answers `null` for a
   header a proxy stripped or mangled, and the derived zero that stood in for
   the total answered both of the questions the total owns wrong: a Requester
   with no Tickets was shown "No tickets found. Try changing your search or
   filters" over a query they never ran, and a full page of rows lost its
   controls because the mount guard saw a total of zero. Both sites now fall
   back to the row count through one `countless` predicate. `stale` is
   unchanged, so the control still states no range and runs no clamp against a
   total nobody sent.
4. **`query` was an unused dependency of the list effect.** The effect reads only
   `request`, which is derived from it, so depending on both refetched whenever
   an address changed without changing the API request — `/tickets` and
   `/tickets?pageNumber=1` build the same one.

Previously open items, all now closed:

5. **The Lab 2 migration had been edited after it was applied.** The
   `CHAR(25)` → `VARCHAR(25)` change and the trigram index rebuild recorded in
   Section 4.5.28 were made in place in `20260822000000_lab2_data_model`, which
   changes that migration's checksum and fails `prisma migrate deploy` against
   any database that already ran it — the practice AGENTS.md Section 9 forbids
   outright. That migration is restored byte-for-byte to what was applied, and
   the change now lives in the forward migration
   `20260826000000_ticket_number_varchar`, which drops the index, alters the
   column, and recreates the index on the bare column. The index is dropped
   *before* the type change on purpose: `ALTER COLUMN ... TYPE` rebuilds
   dependent indexes at their own definition, which would reproduce the
   `(ticket_number::text)` cast and leave the index exactly as unreachable as
   before. The two-migration chain reaches the same final state, verified by
   applying it to an empty database and reading back `character varying(25)`
   and `gin (ticket_number gin_trgm_ops)`.
6. **The Ticket row was focusable but had no role.** The `<tr>` carried
   `tabIndex={0}`, an `aria-label`, and a hand-rolled Enter/Space handler, so it
   was in the tab order announcing itself as a row rather than as something
   activatable — and a `role` that would fix that cannot go on a `<tr>` without
   breaking the table's own row semantics. The Ticket Number cell now holds a
   real `<Link>`: link role, native Enter activation, a real `href` that can be
   opened in a new tab, and an accessible name containing the visible Ticket
   Number (WCAG 2.5.3). The row keeps `onClick` as a pointer convenience and
   `.tt-row:has(.tt-row-link:focus-visible)` draws the ring. ui-spec Section
   16.2 permits this explicitly — "activatable with Enter/Space where the chosen
   implementation pattern supports it".
7. **A disabled fieldset dropped keyboard focus on every fetch.** The pagination
   controls were wrapped in `<fieldset disabled={loading}>` and the Filters
   button and Sort select carried `disabled={loading}` of their own. Disabling a
   focused control moves focus to `<body>`, and this screen fetches once per
   search pause, so a keyboard user was thrown out of the toolbar every 400 ms
   while typing. The guard is removed rather than replaced with a hand-rolled
   substitute, because it bought nothing: `commitQuery` only writes the URL, the
   list effect discards the superseded response through its `ignore` flag, and
   `pending` already stops `Pagination` from stating a range or acting on a
   clamp computed from a total it is about to replace. This closes the finding
   left open as unverified in Section 4.5.26, without needing the real browser
   Issue #25 owns.
8. **The page read and the count were two statements, not one snapshot.** The
   `ponytail:` deferral in `ticketListService.ts` is now taken: both run inside
   one `$transaction` at `REPEATABLE READ`. The isolation level is the whole
   fix and is asserted by name, because PostgreSQL's default `READ COMMITTED`
   takes a fresh snapshot per statement — a transaction at the default level
   would satisfy a "both are in a transaction" assertion while changing nothing.
   A read-only `REPEATABLE READ` transaction cannot raise a serialization
   failure on PostgreSQL, so this adds no retry path. An unreachable page still
   skips the transaction, since a lone count statement is its own snapshot.

Every new case was confirmed to fail against restored pre-fix source — 5 server
and 3 client for the review findings, then 1 server and 4 client for the
previously open items — before the fixed files were put back.

One item remains open and is recorded rather than fixed:

- **`IN` on a text field is up to 100 `ILIKE` comparisons against no usable
  index.** The `ponytail:` note in `queryBuilder.ts` is unchanged. The `IN`
  cardinality cap, the 20-expression limit, and the caller's own scope predicate
  bound it, and the Requester UI emits `IN` only for reference and enum fields.

| Check | Command | Environment / target | Result |
| --- | --- | --- | --- |
| All guarded PostgreSQL suites | `NODE_ENV=test TEST_DATABASE_URL=<lab2_test_url> npx vitest run tests/lab-02/postgres` | `server/`; `postgres:16-alpine` in the `toktickit-lab2-test-postgres` container on `localhost:55432` | Passed — 5 files, 49 tests. |
| Migration chain applied from empty | `DIRECT_URL=<lab2_test_url> npx prisma migrate deploy` | `server/`; same disposable container | Passed — 3 migrations applied; `ticket_number` reads back `character varying(25)` and the trigram index `gin (ticket_number gin_trgm_ops)`. |
| Full server suite, non-PostgreSQL | `npx vitest run --exclude 'tests/lab-02/postgres/**'` | `server/` | Passed — 19 files, 415 tests. |
| Backend typecheck | `npx tsc --noEmit` | `server/` | Passed — no output. |
| Frontend typecheck | `npx tsc --noEmit` | `client/` | Passed — no output. |
| Frontend full test suite | `npx vitest run` | `client/` | Passed — 7 files, 195 tests. |

### 4.5.30 Issue #22 free-text `IN` cost, the last open item

Section 4.5.29 left one recorded item: an insensitive `IN` on a text field is one
`ILIKE` per value against no usable index. It was measured rather than argued,
and the measurement was worse than the note claimed. On 30,000 seeded rows, one
`IN` of 100 values on `ticket_number`:

| Values | Plan | Time |
| --- | --- | --- |
| 1 | Bitmap Index Scan, trigram | 8.6 ms |
| 5 | BitmapOr over 5 trigram scans | 30 ms |
| 10 | BitmapOr over 10 trigram scans | 54 ms |
| 25 | **Sequential scan** | 454 ms |
| 50 | Sequential scan | 720 ms |
| 100 | Sequential scan | 1,430 ms |
| 100, `enable_seqscan = off` | Sequential-equivalent | 1,405 ms |

The forced row is the important one: this is not a planner misestimate. No plan
exists that makes an OR of 100 `ILIKE` cheap. The equivalent case-sensitive
`IN (...)` over the same values was an Index Scan on `ticket_ticket_number_key`
at **0.194 ms** — roughly 7,400x — and `filters` accepts 20 expressions, so one
authenticated `GET` could buy seconds of server CPU.

The resource closes it from both sides, because both levers are resource
knowledge that `queryBuilder.ts` is not allowed to hold:

1. **`ticketNumber` is folded, not matched insensitively.** The column carries
   `CHECK (ticket_number ~ '^TKT-[0-9]{8}-[0-9A-F]{12}$')`, anchored at both
   ends, so no stored value can hold a lowercase letter. Folding the input to
   uppercase and comparing case-sensitively is therefore *the same match* BR-33
   requires, and it is what turns the condition back into one indexable
   `IN (...)`: **1,430 ms to 0.238 ms** for the same 100 values. The fold applies
   to every condition on the field, so `EQUAL`, `NOTEQUAL`, `CONTAINS`,
   `STARTWITH`, and `ENDWITH` stop rendering as `ILIKE` too. Because uniqueness
   is judged after conversion, two spellings of one Ticket Number are now
   correctly reported as the repeat they are.
2. **Free text keeps its semantics and takes a lower bound.** `summary` and
   `description` have no constrained domain, so folding them would change the
   match. They keep `mode: "insensitive"` and are capped at
   `MAX_FREE_TEXT_IN_VALUES = 10`, chosen off the table above as the last row
   that stays on the trigram index: **6.5 ms**. Reference and enum fields keep
   the full 1-100 range, since they were never the expensive case.

api-spec Sections 9.8 and 9.9 are updated: 9.8 now states the per-field `IN`
bounds and the measurement behind the free-text one, and 9.9 documents the
`ticketNumber` fold and why it is invisible to callers.

The `ponytail:` note in `queryBuilder.ts` is replaced by the measured outcome
rather than deleted, so the expansion still carries its cost and who bounds it.

Test honesty note: the first version of the PostgreSQL plan assertion ran
`EXPLAIN` over hand-written SQL and passed against the unfolded code, because it
only proved that PostgreSQL can index an `IN` — which was never in question. It
was rewritten to capture the SQL **Prisma actually emits** for a real
`listTicketsForRequester` call, which is what the fold changes, and confirmed to
fail against the restored pre-fix validator. A companion case still asserts by
forced `EXPLAIN` that the emitted shape is one the unique index can serve; it is
labelled as the structural half rather than presented as proof of the fix.

| Check | Command | Environment / target | Result |
| --- | --- | --- | --- |
| All guarded PostgreSQL suites | `NODE_ENV=test TEST_DATABASE_URL=<lab2_test_url> npx vitest run tests/lab-02/postgres` | `server/`; `postgres:16-alpine` in the `toktickit-lab2-test-postgres` container on `localhost:55432` | Passed — 5 files, 52 tests. |
| Full server suite, non-PostgreSQL | `npx vitest run --exclude 'tests/lab-02/postgres/**'` | `server/` | Passed — 19 files, 424 tests. |
| Backend typecheck | `npx tsc --noEmit` | `server/` | Passed — no output. |
| Frontend typecheck | `npx tsc --noEmit` | `client/` | Passed — no output. |
| Frontend full test suite | `npx vitest run` | `client/` | Passed — 7 files, 195 tests. |

### 4.5.31 Issue #22 final `IN`-contract alignment verification

The previous pass introduced a 1–10 free-text `IN` ceiling based on query-cost
measurement. That optimization contradicted the formally approved Issue #22
acceptance criterion requiring 1–100 unique typed values for `IN`.

The implementation was therefore realigned to the Issue contract:
`summary` and `description` now accept 1–100 values, while existing
Ticket Number normalization, case-insensitive free-text semantics, wildcard
escaping, requester scoping, typed validation, and bounded pagination remain
unchanged. QueryBuilder remains resource-agnostic; the public cardinality is
owned by `ticketQueryValidator.ts`.

The final boundary evidence proves:

```text
summary IN 100     accepted
summary IN 101     rejected with 400 VALIDATION_ERROR
description IN 100 accepted
description IN 101 rejected with 400 VALIDATION_ERROR
```

The final verification was run against the reviewed tree, with
`git rev-parse HEAD` reporting
`9fb5bb00fba04d72079cbd853a59e641be906a6c` as the verification source SHA.

| Check | Command | Environment / target | Result |
| --- | --- | --- | --- |
| Issue #22 focused server gate | `npx vitest run tests/lab-02/QueryBuilder.test.ts tests/lab-02/TicketQueryValidator.test.ts tests/lab-02/my-tickets.api.test.ts tests/lab-02/cors.api.test.ts` | `server/`; mocked Prisma for API coverage | Passed — 4 files, 221 tests. |
| My Tickets PostgreSQL suite | `NODE_ENV=test TEST_DATABASE_URL=<lab2_test_url> npx vitest run tests/lab-02/postgres/my-tickets.postgres.test.ts` | `server/`; guarded disposable `postgres:16-alpine` target | Passed — 1 file, 16 tests. |
| All guarded PostgreSQL suites | `NODE_ENV=test TEST_DATABASE_URL=<lab2_test_url> npx vitest run tests/lab-02/postgres` | `server/`; same guarded disposable target | Passed — 5 files, 52 tests. |
| Server suite, non-PostgreSQL | `npx vitest run --exclude 'tests/lab-02/postgres/**'` | `server/` | Passed — 19 files, 430 tests. |
| Server typecheck | `npx tsc --noEmit` | `server/` | Passed — no output. |
| Server build | `npm run build` | `server/` | Passed — TypeScript build completed. |
| My Tickets focused client gate | `npx vitest run tests/lab-02/MyTickets.test.tsx` | `client/` | Passed — 1 file, 45 tests. |
| Client full test suite | `npx vitest run` | `client/` | Passed — 7 files, 195 tests. |
| Client typecheck | `npx tsc --noEmit` | `client/` | Passed — no output. |
| Client build | `npm run build` | `client/` | Passed — Vite build completed. |


### 4.5.32 Issue #23 Ticket Detail close gate

`GET /api/tickets/:publicId` and the read-only Ticket Detail screen were added
together with the four files the Issue #23 gate names. Ownership is enforced
inside the Prisma `where` rather than as a check on the answer, so the tests
assert the predicate itself (`{ publicId, requesterId, deleted: false }`) as
well as the response: an out-of-scope Ticket and a missing one produce
byte-identical 404 envelopes, and a malformed identifier is rejected before the
table is read so the `@db.Uuid` cast cannot turn it into a 500.

`ErrorPage.test.tsx` is not new coverage. The global-error suite already existed
inside `ApplicationShell.test.tsx`; it was moved into the file the gate names,
along with its two helpers, so the same assertions run under the required
filename rather than being duplicated. `ApplicationShell.test.tsx` keeps only
its shell-level `/error` checks.

Non-vacuity was established per side rather than in bulk. With
`routes/tickets.ts` and `ticketService.ts` restored to their pre-change state,
5 of the 24 server cases fail — the remaining 19 pass vacuously, because an
unregistered route answers the same centralized 404 the tests expect for a
miss, which is exactly why the 200-path and predicate assertions carry the
proof. With `RequesterTicketDetail.tsx` restored to its Issue #23 placeholder,
all 15 client detail cases fail.

| Check | Command | Environment / target | Result |
| --- | --- | --- | --- |
| Issue #23 focused server gate | `npx vitest run tests/lab-02/ticket-detail.api.test.ts tests/lab-02/transport-hardening.api.test.ts` | `server/`; mocked Prisma | Passed — 2 files, 24 tests. |
| Server suite, non-PostgreSQL | `npx vitest run --exclude 'tests/lab-02/postgres/**'` | `server/` | Passed — 20 files, 444 tests. |
| Server typecheck | `npx tsc --noEmit` | `server/` | Passed — no output. |
| Server build | `npm run build` | `server/` | Passed — TypeScript build completed. |
| Issue #23 focused client gate | `npx vitest run tests/lab-02/RequesterTicketDetail.test.tsx tests/lab-02/ErrorPage.test.tsx` | `client/` | Passed — 2 files, 31 tests. |
| Client full test suite | `npx vitest run` | `client/` | Passed — 9 files, 210 tests. |
| Client typecheck | `npx tsc --noEmit` | `client/` | Passed — no output. |
| Client build | `npm run build` | `client/` | Passed — Vite build completed. |

Nothing in this change touches the schema, a migration, or the seed — the
detail read is a single `findFirst` on the existing `ticket_public_id` unique
index — so no Prisma CLI command was run beyond the `migrate deploy` the
PostgreSQL suites perform against their own disposable target.

### 4.5.33 Issue #23 scrutiny pass and fixes

The change above was then reviewed end to end from outside and six findings
were fixed.

The creation confirmation was read from `location.state` unconditionally, and
`location.state` is persisted in the history entry, so a reload or a Back into
the detail entry re-announced "Ticket TKT-… was created." for a Ticket created
long before. `ErrorPage` already discards restored state through
`useNavigationType() === "POP"`; Ticket Detail now applies the same test, with
a regression case that renders the entry as the router's own initial one.

`Last Updated` and an Attachment's `Uploaded At` were formatted with
`ticketDate`, which exists to keep `createdAt` on the same `Asia/Bangkok`
business calendar the Ticket Number commits to (BR-01-03). Neither field
carries that contract, and date alone renders two audits on one day
identically, so both now use a `ticketDateTime` formatter pinned to the same
locale and time zone with `hourCycle: "h23"`.

Both page-level failure paths pushed `/error`, so Back out of the error screen
returned to the route that had just failed, which failed again and pushed
another entry. Ticket Detail and My Tickets now replace instead; `ErrorPage`
reads `REPLACE` as a live navigation, so the status-specific copy still
resolves.

The detail effect refetched on a `publicId` change without clearing `ticket`,
which would have rendered the previous Ticket's number, summary, and
description under the new identifier until the fetch landed. Unreachable
through the current UI, and closed with one `setTicket(null)`.

`requestLog` built its `route` field from `req.baseUrl` at `finish`. Express
restores `baseUrl` as an error propagates out of the router, so one endpoint
logged `/api/tickets/:publicId` on its `200` and `/tickets/:publicId` on its
`404` — two aggregation keys for the endpoint that answers `404` by design. The
key is now derived from `req.route.path` alone with the service's single mount
prefix restored, and is identical on both outcomes.

Ownership was asserted only as the shape of the `where` handed to a mocked
Prisma client, which passes whether or not the engine applies it.
`ticket-detail.postgres.test.ts` (PG-16) now proves it as an outcome. Its
non-vacuity was checked by widening the predicate to `{ publicId }` and
dropping the Attachment `omit`: 3 of its 5 cases fail.

| Check | Command | Environment / target | Result |
| --- | --- | --- | --- |
| Issue #23 focused server gate | `npx vitest run tests/lab-02/ticket-detail.api.test.ts tests/lab-02/transport-hardening.api.test.ts` | `server/`; mocked Prisma | Passed — 2 files, 24 tests. |
| Ticket Detail PostgreSQL suite | `npx vitest run tests/lab-02/postgres/ticket-detail.postgres.test.ts` | `server/`; `postgres:16-alpine` on the guarded target | Passed — 5 tests. |
| Server suite, all files | `npx vitest run` | `server/`; live PostgreSQL target | Passed — 26 files, 501 tests. |
| Server typecheck | `npx tsc --noEmit` | `server/` | Passed — no output. |
| Issue #23 focused client gate | `npx vitest run tests/lab-02/RequesterTicketDetail.test.tsx tests/lab-02/ErrorPage.test.tsx` | `client/` | Passed — 2 files, 32 tests. |
| Client full test suite | `npx vitest run` | `client/` | Passed — 9 files, 211 tests. |
| Client typecheck | `npx tsc --noEmit` | `client/` | Passed — no output. |

Two review findings were deliberately left standing. The Attachment table ships
its selection checkbox and its preview/download/remove controls inert, which
reads against ui-spec Section 21.3's "required actions must remain usable" — the
behavior is owned by Issue #24 and the labels are what UI-37 assigns to this
Issue, so the controls stay and #24 wires them. Ticket Detail also renders
Created By, Updated By, and Last Updated, which ui-spec Section 20.2 does not
list among its required fields; the Issue's own acceptance criteria name the
audit fields, so they stay visible pending a reviewer's call.

### 4.5.34 Issue #23 second scrutiny pass and fixes

A second outside pass read the change against ui-spec Section 26, which the
first pass had not reached, and four findings were fixed.

The Attachment table applied half of Section 26. A Removed row hid its Remove
control but still rendered Preview and Download, and its `removalReason` — read
from the database, carried through `AttachmentDTO`, and asserted in
`ticket-detail.api.test.ts` — was never rendered at all. Section 26 is explicit
on both halves: a Removed row is not selectable and exposes no Preview, no
Download, and no Remove, and its removal reason is shown as secondary metadata
rather than as a permanently wide column. The row now renders an em dash where
its controls were, drops its selection checkbox, and carries
`Removal reason: …` beneath the file name. This supersedes the standing note in
Section 4.5.33 for Removed rows only: the inert controls on **Active** rows are
still Issue #24's to wire, and the labels UI-37 assigns remain there.

Attachment sizes were formatted with binary divisors labelled `KB`/`MB`, while
the rule the UI states to the user is decimal — ui-spec Section 22.3 fixes the
per-file limit at `5,000,000` bytes and calls it "5 MB". A file at exactly that
limit rendered as `4.8 MB` on a screen promising a maximum of 5 MB. The
formatter now divides by 1000, so the fixtures read `281.3 KB` and `4.1 KB`.

The creation confirmation printed the Ticket Number carried in navigation
state, even though it renders only after the fetch has landed and the
authoritative number is in hand. Navigation state is caller-controlled: it is
now trusted to say that a Ticket was just created, never which one, and the
banner reads `ticket.ticketNumber`. The heading still falls back to the state
value while the fetch is in flight, which is the one moment there is nothing
else to show.

`routeKey` restored its `/api` prefix on any path that merely started with
those four characters, so a future router path such as `/apikeys` would have
been logged without its prefix. The test is now segment-anchored
(`/^\/api(\/|$)/`), and the route key itself gained the coverage the earlier
fix never had: `ticket-detail.api.test.ts` captures the emitted log lines and
asserts the `200` and the `404` produce the identical key.

Non-vacuity was checked per fix rather than in bulk. With the page's Section 26
handling, decimal units, and banner source restored to their pre-fix form, 4 of
the 18 client detail cases fail; with `routeKey` restored to the `req.baseUrl`
form, the new server log case fails.

| Check | Command | Environment / target | Result |
| --- | --- | --- | --- |
| Issue #23 focused server gate | `npx vitest run tests/lab-02/ticket-detail.api.test.ts tests/lab-02/transport-hardening.api.test.ts` | `server/`; mocked Prisma | Passed — 2 files, 25 tests. |
| Server suite, non-PostgreSQL | `npx vitest run --exclude 'tests/lab-02/postgres/**'` | `server/` | Passed — 20 files, 445 tests. |
| Server typecheck | `npx tsc --noEmit` | `server/` | Passed — no output. |
| Server build | `npm run build` | `server/` | Passed — TypeScript build completed. |
| Issue #23 focused client gate | `npx vitest run tests/lab-02/RequesterTicketDetail.test.tsx tests/lab-02/ErrorPage.test.tsx` | `client/` | Passed — 2 files, 34 tests. |
| Client full test suite | `npx vitest run` | `client/` | Passed — 9 files, 213 tests. |
| Client typecheck | `npx tsc --noEmit` | `client/` | Passed — no output. |
| Client build | `npm run build` | `client/` | Passed — Vite build completed. |

The guarded PostgreSQL suites were not re-run in this pass: no target is
reachable from this session, and every fix is client-side apart from the
`routeKey` regex, which no PostgreSQL case exercises. Their last recorded run
is Section 4.5.33. One documentation defect was fixed alongside: the PG-16 row
in Section 7 sat behind a blank line and therefore rendered as literal pipe
text rather than as a row of the table above it.

### 4.5.35 Issue #23 final fix-then-ship pass

The final outside review found that navigation state could claim any loaded
Ticket had just been created: the page narrowed `created` and `ticketNumber`,
but used the number only as a truthy flag. The success message now renders only
when that carried official Ticket Number exactly matches the fetched
`ticket.ticketNumber`. The mismatch regression fails against the previous
implementation.

Issue #23 also exposed disabled selection, Add, Preview, Download, and Remove
controls before Issue #24 supplied their behavior. Besides making read-only UI
look interactive, the three minimum-width icon buttons could not fit inside the
fixed-layout mobile action cell. Issue #23 now renders only Attachment metadata:
File Name, Type, Size, Uploaded At, lifecycle Status, and Removed reason. Type
and Uploaded At remain secondary columns below the `md` breakpoint; selection
and action UI arrives with its real behavior in Issue #24. A regression asserts
that no Attachment button or checkbox is exposed.

Two unrelated changes were removed from this Issue: My Tickets no longer
changes its error navigation history, and the global request logger plus its
Ticket Detail aggregation test returned to their pre-Issue behavior. The
`CreateTicket.test.tsx` API double was also corrected to distinguish the Ticket
collection from `GET /api/tickets/:publicId`; the full client run had exposed
five unhandled date-format errors because the detail request incorrectly
received the list response. Its creation-navigation case now reaches the real
Detail page and asserts the official heading and confirmation.

| Check | Command | Environment / target | Result |
| --- | --- | --- | --- |
| Issue #23 focused server gate | `npx vitest run tests/lab-02/ticket-detail.api.test.ts tests/lab-02/transport-hardening.api.test.ts` | `server/`; mocked Prisma | Passed — 2 files, 24 tests. |
| Server suite, non-PostgreSQL | `npx vitest run --exclude 'tests/lab-02/postgres/**'` | `server/` | Passed — 20 files, 444 tests. |
| Issue #23 focused client gate | `npx vitest run tests/lab-02/RequesterTicketDetail.test.tsx tests/lab-02/ErrorPage.test.tsx` | `client/` | Passed — 2 files, 33 tests. |
| Create-to-Detail integration-focused client gate | `npx vitest run tests/lab-02/CreateTicket.test.tsx tests/lab-02/RequesterTicketDetail.test.tsx tests/lab-02/ErrorPage.test.tsx` | `client/` | Passed — 3 files, 71 tests. |
| Client full test suite | `npx vitest run` | `client/` | Passed — 9 files, 212 tests; existing React key/`act` warnings remain. |
| Server build | `npm run build` | `server/` | Passed — TypeScript build completed. |
| Client build | `npm run build` | `client/` | Passed — TypeScript and Vite build completed. |

No schema, migration, seed, persistence, or REST contract changed. The PG-16
result remains the engine evidence recorded in Section 4.5.33; this pass did not
rerun PostgreSQL because its fixes are presentation, navigation-state, test
double, and scope cleanup only.

### 4.5.36 Issue #23 final review closure

The final review found no application defect. Its PostgreSQL verification
failure reproduced in the isolated PG-16 suite at `resetTestSchema`, before any
migration, Ticket Detail query, or assertion ran. The documented disposable
`toktickit-lab2-test-postgres` container was absent. Starting that container
with the existing untracked synthetic test credential made PG-16 pass, and the
same target then supported a clean full server run. This rules out the Detail
query and test orchestration as causes of the earlier failure.

Responsive and visual browser evidence was not pulled forward. Section 14
assigns the root Playwright tooling and `responsive-visual.spec.ts` to Issue
#25; adding that tooling on the Issue #23 branch would cross the approved Issue
boundary. Issue #23 retains its responsive implementation evidence in the
fixed-layout, wrapping Attachment table and breakpoint-hidden secondary
columns, while RESP-03 and VIS-03 remain honestly `Not Run` until Issue #25.

| Check | Command | Environment / target | Result |
| --- | --- | --- | --- |
| Ticket Detail PostgreSQL suite | `npx vitest run tests/lab-02/postgres/ticket-detail.postgres.test.ts` | `server/`; documented disposable `postgres:16-alpine` target | Passed — 1 file, 5 tests. |
| Full server suite | `npx vitest run` | `server/`; same guarded disposable PostgreSQL target | Passed — 26 files, 501 tests. |
| Issue #23 focused server gate | `npx vitest run tests/lab-02/ticket-detail.api.test.ts tests/lab-02/transport-hardening.api.test.ts` | `server/`; mocked Prisma | Passed — 2 files, 24 tests. |
| Issue #23 focused client gate | `npx vitest run tests/lab-02/RequesterTicketDetail.test.tsx tests/lab-02/ErrorPage.test.tsx` | `client/` | Passed — 2 files, 33 tests. |
| Full client suite | `npx vitest run --silent --reporter=dot` | `client/` | Passed — 9 files, 212 tests. Existing React key/`act` warnings remain unrelated. |
| Server build | `npm run build` | `server/` | Passed — TypeScript build completed. |
| Client build | `npm run build` | `client/` | Passed — TypeScript and Vite build completed. |

No application source, schema, migration, seed, persistence behavior, or REST
contract changed in this closure pass.

### 4.5.37 Issue #23 route-log aggregation fix

The final ship request closed the remaining observability defect. The structured
request logger read `req.baseUrl` only after the response finished. Express
restores that value while a centralized error leaves a mounted router, so Ticket
Detail logged its owned `200` as `/api/tickets/:publicId` and its expected hidden
`404` as `/tickets/:publicId`. One endpoint therefore produced two aggregation
keys based only on outcome.

The logger now normalizes the registered route template itself and never reads
the raw URL. A regression captures an owned hit and a hidden miss and requires
both log records to use `/api/tickets/:publicId`. It failed before the fix with
the exact split above.

| Check | Command | Environment / target | Result |
| --- | --- | --- | --- |
| Issue #23 focused server gate | `npm test -- --run tests/lab-02/ticket-detail.api.test.ts tests/lab-02/transport-hardening.api.test.ts` | `server/`; mocked Prisma | Passed — 2 files, 25 tests. |
| Server suite, non-PostgreSQL | `npm test -- --run --exclude 'tests/lab-02/postgres/**'` | `server/` | Passed — 20 files, 445 tests. |
| Server build | `npm run build` | `server/` | Passed — TypeScript build completed. |
| Issue #23 focused client gate | `npm test -- --run tests/lab-02/RequesterTicketDetail.test.tsx tests/lab-02/ErrorPage.test.tsx` | `client/` | Passed — 2 files, 33 tests. |
| Client build | `npm run build` | `client/` | Passed — TypeScript and Vite build completed. |

PostgreSQL was not rerun because this fix changes logging only; it does not
touch Prisma, SQL, schema, migrations, or persistence behavior.

### 4.5.38 Issue #24 Attachment lifecycle delivery

The six Attachment endpoints, the maintenance CLI, and the shared Attachment
card landed together with their eight close-gate suites.

Three findings are worth recording because each was a real defect the tests
caught rather than a design note.

**Busby's limits are reached, not passed.** `multer`'s `fileSize` and `parts`
counters fail a part when the count *reaches* the limit. Configured at the
contract values, a file of exactly `5,000,000` bytes was refused with `413` and
a request carrying its single `file` part was refused with `LIMIT_PART_COUNT`.
Both bounds are now set one above what they permit, which is the difference
between accepting and refusing a file at the exact contract boundary.

**A write conflict wears several names.** PG-05 failed with the losing upload
escaping as `500` instead of retrying into its `409`. The pg driver adapter
raises a `DriverAdapterError` whose message is only `TransactionWriteConflict`
and whose SQLSTATE `40001` is nested under `cause.originalCode` — not the flat
`code` the retry matcher read. The matcher now walks the wrapped causes and
matches `code`, `originalCode`, and `kind`, and the driver's exact error shape
is pinned as a unit case so it cannot regress quietly. This one is why the
concurrent PostgreSQL test exists: every mocked test passed throughout.

**A busy filename decoder.** Busboy defaults `defParamCharset` to latin1, which
decodes a UTF-8 filename into mojibake and then measures the wrong byte length
against the 255-byte rule. It is set to utf8, and `preservePath` is on so the
backend's own basename extraction — which handles `\` as well as `/` — is the
one that runs.

| Check | Command | Environment / target | Result |
| --- | --- | --- | --- |
| Issue #24 focused server gate | `npm test -- tests/lab-02/AttachmentService.test.ts tests/lab-02/MaintenanceService.test.ts tests/lab-02/attachments.api.test.ts tests/lab-02/transport-hardening.api.test.ts` | `server/`; mocked Prisma | Passed — 4 files, 157 tests. |
| Guarded PostgreSQL suites | `NODE_ENV=test TEST_DATABASE_URL=<lab2 test url> npm test -- tests/lab-02/postgres` | `server/`; disposable `postgres:16-alpine` container on `55432` | Passed — 8 files, 74 tests, including the new `attachment-concurrency` and `maintenance` suites, PG-04 in `transactions`, and the AttachmentService query shapes below. |
| Server suite | `npm test` | `server/` | Passed — 31 files, 663 tests. |
| Server build | `npm run build` | `server/` | Passed — TypeScript build completed. |
| Maintenance CLI | `DATABASE_URL=<lab2 test url> npm run maintenance:cleanup` | `server/`; disposable test container only | Passed — `{"job":"maintenance:cleanup","pendingAttachments":0,"idempotencyRecords":0}`. Run against the disposable container deliberately: the CLI hard-deletes rows, and the default `DATABASE_URL` is the shared database. |
| Issue #24 focused client gate | `npm test -- tests/lab-02/AttachmentSection.test.tsx` | `client/` | Passed — 1 file, 33 tests. |
| Client suite | `npm test` | `client/` | Passed — 10 files, 245 tests. |
| Client build | `npm run build` | `client/` | Passed — TypeScript and Vite build completed. |

One coverage gap was closed after the suites first went green. The metadata
read combines `omit` with `include`, and the inserts use `omit` on a `create`;
every test of them ran against a Prisma double that would accept any shape at
all. `transactions.postgres.test.ts` now executes those calls against the real
engine, along with cross-Requester hiding and the retained binary and reason of
a soft-removed row, so an invalid query shape fails a test rather than a
request.

UI-11 was raised as an apparent contradiction with this Issue's acceptance
criteria and resolved by decision rather than by assumption. The first reading
was that a `5xx` cleanup could destroy committed Ticket evidence; that reading
was wrong on mechanism. The empty reason each item carries is refused for an
Active row, and the batch is all-or-nothing, so a bound row cannot be removed by
this call at all. The real cost is narrower: when the transaction genuinely
failed, the released rows are gone and the stored recovery payload still names
them, so Resume would answer `404`. The decision was to implement UI-11 as
written and treat a confirmed release as terminal — the recovery record is
dropped and the rows offer Retry Upload — because a confirmed release proves the
create never bound them, and a create committing afterwards fails its own
guarded binding and rolls back.

The Create Ticket `x/5` header counts prepared Pending rows. ui-spec Section
21.1 states the count as active/5, which on a screen with no Active rows would
read `0/5` forever and never disable Add, while Section 23.0 caps prepared
Pending at five. Counting Pending there is the only reading under which the cap
is visible before a Ticket exists; the header means "slots used of five" on both
screens.

### 4.5.39 Issue #24 scrutiny fixes

The fix pass removed an undocumented per-Requester Pending quota. BR-79 defers
quota and rate-limiting policy, so Pending creation now performs only the
specified validation and insert instead of issuing an extra count query and
inventing a `409` response. Unit and API regressions assert that the count query
is not made.

Ticket Detail direct uploads now use the same per-file lifecycle rows as Create
Ticket. Each selected file appears immediately as Uploading or Invalid, a
failed request stays visible with Retry and Remove controls, and a successful
request becomes Active while the authoritative collection refreshes. Detail
selection and `x/5` counting remain Active-only.

| Check | Command | Environment / target | Result |
| --- | --- | --- | --- |
| Issue #24 focused server gate | `npm test -- tests/lab-02/AttachmentService.test.ts tests/lab-02/MaintenanceService.test.ts tests/lab-02/attachments.api.test.ts tests/lab-02/transport-hardening.api.test.ts` | `server/`; mocked Prisma | Passed — 4 files, 164 tests. |
| Issue #24 focused client gate | `npm test -- tests/lab-02/AttachmentSection.test.tsx` | `client/` | Passed — 1 file, 43 tests. Existing unrelated React `act(...)` warnings remain in the IconButton coverage. |
| Server build | `npm run build` | `server/` | Passed — TypeScript build completed. |
| Client build | `npm run build` | `client/` | Passed — TypeScript and Vite production build completed. |

The earlier scrutiny pass did not rerun PostgreSQL because
`TEST_DATABASE_URL` was unavailable at that time. Subsequent final verification
reran the required PostgreSQL close gates against the final executable tree
because the AttachmentService persistence/query paths had changed since the
previous PostgreSQL execution.

### 4.5.40 PR #44 final review blocker closure

The Create Ticket discard race was reproduced with a held `POST /api/tickets`.
Before this fix, confirming Discard navigated to `/tickets`, then the old `201`
completion navigated to Ticket Detail. Create Ticket now tracks a submission
generation independent from Requester generation. Confirmed discard increments
that generation before clearing recovery/draft state and navigating; success,
failure, compensation-result, and `finally` side effects require both the
Requester token and submission generation to remain current. Regression tests
cover stale success navigation and stale failure recovery after discard.

The following checks were run against the final executable working tree while
`git rev-parse HEAD` still reported
`05a3172623c76a3d506b3216a947763c0042143b`.

At verification time, the submission-generation fix and its regression tests
were present as uncommitted working-tree changes. Those verified changes were
subsequently committed unchanged as
`5c4d0260dbb43a632f8ed7dd0973ba1591d0fc11`.

No application or test code changed between that verification run and creation
of the final commit.

| Check | Command | Environment / target | Result |
| --- | --- | --- | --- |
| Issue #24 focused server gate | `npm test -- tests/lab-02/AttachmentService.test.ts tests/lab-02/MaintenanceService.test.ts tests/lab-02/attachments.api.test.ts tests/lab-02/transport-hardening.api.test.ts` | `server/`; mocked Prisma | Passed — 4 files, 164 tests. |
| Required PostgreSQL close gate | `NODE_ENV=test TEST_DATABASE_URL=<guarded_lab2_test_url> npm test -- tests/lab-02/postgres` | `server/`; disposable `postgres:16-alpine` in `toktickit-lab2-test-postgres` on `localhost:55432` | Passed — 8 files, 74 tests. Required `attachment-concurrency`, `maintenance`, and `transactions` suites included. |
| Create Ticket + Attachment client gate | `npm test -- tests/lab-02/CreateTicket.test.tsx tests/lab-02/AttachmentSection.test.tsx` | `client/` | Passed — 2 files, 83 tests. Existing unrelated React `act(...)` warnings remain in Attachment icon coverage. |
| Full client suite | `npm test -- --silent --reporter=dot` | `client/` | Passed — 10 files, 257 tests. |
| Full server suite | `NODE_ENV=test TEST_DATABASE_URL=<guarded_lab2_test_url> npm test` | `server/`; same guarded disposable PostgreSQL target | Passed — 31 files, 670 tests. |
| Server build | `npm run build` | `server/` | Passed — TypeScript build completed. |
| Client build | `npm run build` | `client/` | Passed — TypeScript and Vite build completed. |

No REST route, API payload, Prisma schema, migration, or database contract
changed in this blocker pass.

### 4.5.41 PR #44 review verification and test-runner serialization

The PR review's verification blocker was rechecked on 2026-08-27. The PR head
still reported `bb348b570c9129cc914ca9204298a7baa370a616` before this pass. The
first exact PostgreSQL command reproduced a test-harness defect: the existing
`fileParallelism` setting was nested where Vitest 2 ignored it, so PostgreSQL
files reset the shared disposable schema concurrently and 63 of 74 tests were
skipped after setup failures. The isolated Attachment concurrency file and an
explicit `--no-file-parallelism` rerun passed. The fix moves serialization into
the server `npm test` script, making the review's documented commands
deterministic.

The results below are against the current working tree, which includes that
uncommitted test-runner fix. They do not claim that the unchanged PR commit
`bb348b5` passed the exact command before the fix. The two PostgreSQL targets
were disposable databases in the local `postgres:16-alpine` container:
`toktickit_lab2_test` for the guarded integration suite and
`toktickit_lab1_dev` for the full server run. The external development database
was not used, migrated, seeded, or reset.

| Check | Command | Environment / target | Result |
| --- | --- | --- | --- |
| Current PR head | `git rev-parse HEAD` | repository | `bb348b570c9129cc914ca9204298a7baa370a616` before this uncommitted fix pass. |
| Issue #24 focused server gate | `NODE_ENV=test npm test -- tests/lab-02/AttachmentService.test.ts tests/lab-02/MaintenanceService.test.ts tests/lab-02/attachments.api.test.ts tests/lab-02/transport-hardening.api.test.ts` | `server/`; mocked Prisma/API boundary | Passed — 4 files, 164 tests. |
| Required PostgreSQL close gate | `NODE_ENV=test TEST_DATABASE_URL=<guarded_lab2_test_url> npm test -- tests/lab-02/postgres` | `server/`; disposable `postgres:16-alpine`, `toktickit_lab2_test` | Passed — 8 files, 74 tests. The server test script supplies `--no-file-parallelism`. |
| Create Ticket + Attachment client gate | `npm test -- tests/lab-02/CreateTicket.test.tsx tests/lab-02/AttachmentSection.test.tsx` | `client/` | Passed — 2 files, 83 tests. Existing React `act(...)` warnings remain in Attachment icon coverage. |
| Full client suite | `npm test` | `client/` | Passed — 10 files, 257 tests. |
| Full server suite | `NODE_ENV=test DATABASE_URL=<lab1_dev_url> DIRECT_URL=<same> TEST_DATABASE_URL=<lab2_test_url> npm test` | `server/`; two disposable PostgreSQL targets | Passed — 31 files, 670 tests. |
| Server build | `npm run build` | `server/` | Passed — TypeScript build completed. |
| Client build | `npm run build` | `client/` | Passed — TypeScript and Vite production build completed. |

No REST route, API payload, Prisma schema, migration, production database, or
credential changed. GitHub status checks remain unavailable in this local
session. `.github/workflows/lab2-verification.yml` now defines the same focused,
PostgreSQL, full-suite, and build gates with an ephemeral PostgreSQL service;
it must be committed and pushed before GitHub can run it against the PR head
and attach CI evidence.


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
| UNIT-05 | Unit | FR-07–12, BR-01–25, AC-06–12 | TicketService: creation, Pending-Attachment validation/binding, trimming, NEW status, requester/audit derivation, replay-first ordering, collision retry, ownership, and detail. | A new attempt atomically creates the Ticket and binds every referenced Pending row under a guarded `UPDATE` that conflicts rather than rebinding a row a competing create already took; completed same-hash replay returns the existing Ticket without mutable Pending validation; collision retries remain bounded and roll each failed attempt back to its savepoint. | tests/lab-02/TicketService.test.ts | Passed |
| UNIT-06 | Unit | BR-26–43, BR-75, AC-24–30, AC-55 | Ticket query request validator/normalizer: Ticket field whitelist, exact condition matrix, searchFields whitelist/uniqueness, typed number/date/enum/IN conversion, nullable compatibility, query-complexity bounds, invalid rejection, and direct-client boundary. | Only Ticket-approved bounded input reaches QueryBuilder/Prisma; search >200 chars, >20 filters, duplicate search fields, `IN` outside 1–100 unique values, invalid combinations/enums/shapes/conversions fail before data access. | tests/lab-02/TicketQueryValidator.test.ts | Passed |
| UNIT-07 | Unit | BR-28–33, DoD | Global QueryBuilder filter construction for `CONTAINS`, `STARTWITH`, `ENDWITH`, `EQUAL`, `NOTEQUAL`, `GREATER`, `LESSER`, `GREATEROREQUAL`, `LESSEROREQUAL`, `ISNULL`, `ISNOTNULL`, and `IN`. | Representative validated/typed inputs for every approved generic operator produce the expected reusable Prisma filter expression, including both null operators and `IN`; `\`, `%`, and `_` are escaped in every condition Prisma renders as a LIKE/ILIKE pattern and in no other, so a wildcard in a value cannot widen the match; no Ticket field/permission rules are embedded here. | tests/lab-02/QueryBuilder.test.ts | Passed |
| UNIT-08 | Unit | BR-26, BR-30, AC-24 | Global QueryBuilder multi-field search construction after resource validation. | The resource-approved search fields are supplied as validated inputs, are OR-combined, and the search fragment can be AND-combined with resource filters/fixed predicates. | tests/lab-02/QueryBuilder.test.ts | Passed |
| UNIT-09 | Unit | BR-34–35, AC-27–28 | Global QueryBuilder generic order construction plus resource-owned Ticket sort translation. | Generic asc/desc ordering is constructed correctly; Ticket-specific semantic priority ordering remains outside generic hard-coded QueryBuilder domain logic. | tests/lab-02/QueryBuilder.test.ts | Passed |
| UNIT-10 | Unit | BR-18–24, BR-82, AC-11–12, AC-42–43, AC-51–52, AC-65 | IdempotencyService: requester+key scope, exact canonical SHA-256 hashing, fresh/stale `PROCESSING` behavior, fencing ownership, valid state transition, current-state replay, logical expiry boundaries, concurrency, and controlled-failure rules. | Canonical UTF-8 SHA-256 is deterministic 64-character lowercase hex; UUIDs are normalized to canonical lowercase strings, duplicate values fail, and sorting is lexicographically ascending; `[A,B] == [B,A]`, `[A,B] != [A,C]`; fresh means `now < processingStartedAt + 300 seconds`, stale/reclaim-eligible means `now >= processingStartedAt + 300 seconds`, so `4m 59.999s` is fresh and `5m 00.000s` is stale; fresh same hash waits and fresh different hash conflicts; stale same hash conditionally reclaims and resets `processingStartedAt`, stale different hash conflicts without deletion; losing concurrent reclaimers resume wait/replay; exact status/hash/lease ownership passes fencing while any mismatch produces no mutation and resumes resolution; COMPLETED same hash replays and different hash conflicts; valid PROCESSING transitions to COMPLETED; later resource mutations do not change the original hash; 24-hour completed expiry remains independent. | tests/lab-02/IdempotencyService.test.ts | Passed |
| UNIT-11 | Unit | BR-44–50, BR-61–64, BR-77, AC-13–16, AC-56, AC-58 | AttachmentService pre-upload validation: Pending creation, allowed extension/case, exact byte size, cross-platform basename/control/UTF-8-byte validation, MIME derivation, and duplicate original names. | Valid upload creates owned Pending metadata; extension uses validated basename; zero-byte and `5,000,001`-byte files fail; `4,999,999`-byte and `5,000,000`-byte files pass; unsafe/>255-byte names fail; MIME derives from extension. | tests/lab-02/AttachmentService.test.ts | Passed — 12 cases in `AttachmentService.test.ts`: Pending creation with derived metadata, case-insensitive extensions, basenames across `/` and `\\`, CR/LF/NUL and other control characters refused, 255 accepted and 256 refused without truncation, UTF-8 byte counting, `415` for an unsupported extension, and the `0` / `4,999,999` / `5,000,000` / `5,000,001` size boundary. |
| UNIT-12 | Unit | BR-47, BR-50–56, AC-06, AC-17–18, AC-44 | Attachment lifecycle, 24-hour expiry, Ticket binding, deterministic processing, direct existing-Ticket add, and active-five limit. | Pending binds once and becomes Active; expiry targets only unbound Pending; direct existing-Ticket upload creates Active; Removed rows do not count toward five. | tests/lab-02/AttachmentService.test.ts | Passed — the Active insert runs inside one `Serializable` transaction, the count excludes Removed rows, five Active conflicts without inserting, a malformed identifier never reaches the `@db.Uuid` column, and the bounded retry runs at most three attempts for a serialization failure only. |
| UNIT-13 | Unit | BR-59–60, BR-65, AC-20, AC-22 | Attachment metadata/preview/download access rules. | Pending and Active owned binary access is allowed; Removed metadata remains readable but binary access is Gone; unavailable/cross-scope resources map to the same Not Found result. | tests/lab-02/AttachmentService.test.ts | Passed — one ownership predicate covers Pending upload ownership and the owning Ticket for metadata, preview, and download; Removed metadata stays readable while its binary answers `410`; unavailable and malformed identifiers both resolve to the safe `404`. |
| UNIT-14 | Unit | BR-57–59, AC-19, AC-22 | Unified collection deletion and recovery safety. | Pending items hard-delete with ignored reason; Active items soft-remove with valid reason; mixed batch is all-or-nothing; invalid/unavailable/Removed item causes no mutation; Pending cleanup cannot remove Active evidence. | tests/lab-02/AttachmentService.test.ts | Passed — Pending hard-deletes with its reason ignored, Active soft-removes with a trimmed reason and refreshed audit fields, a mixed batch commits in sorted identifier order, and an already Removed, unavailable, or reason-invalid item mutates nothing. A guarded delete that matches no row raises rather than removing Active evidence. |
| UNIT-15 | Unit | BR-22–25, BR-52, AC-43–45 | Create-flow pre-upload, submit gate, compensation, and ambiguous recovery sequencing. | Valid files pre-upload Pending; unresolved intended files block submit until Retry/remove; 4xx retains Pending; 5xx cleanup is race-safe; same-key replay recovers Active bindings without re-upload. | tests/lab-02/TicketService.test.ts | Passed — the submit gate, 4xx retention, and same-key replay recovery are covered by `TicketService.test.ts` and `CreateTicket.test.tsx`; the pre-upload half is now covered by `AttachmentService.test.ts` and `AttachmentSection.test.tsx`, and the compensation half by the confirmed-discard cleanup case in `AttachmentSection.test.tsx`. |
| UNIT-16 | Unit | BR-80–82, AC-48, AC-52 | Maintenance service/CLI orchestration: one cutoff, 100-row batches, repeat-until-empty, expired Pending and completed Idempotency selection, logical-expiry boundary, retry safety, and summary logging. | Only eligible Pending rows and logically expired COMPLETED records are requested for cleanup; reruns are idempotent; exact-expiry completed rows qualify; PROCESSING rows are never selected/deleted/reclaimed because stale reclaim is request-time behavior; no in-process timer or HTTP cleanup route is introduced. | tests/lab-02/MaintenanceService.test.ts | Passed — `MaintenanceService.test.ts` proves one captured cutoff per run, 100-row batches, repeat-until-empty, the lifecycle guard repeated on the delete, `COMPLETED`-only idempotency selection with the exact-expiry boundary, `PROCESSING` never selected, and an idempotent rerun. |

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
| API-20 | API | BR-23–24 | Ambiguous 5xx recovery and compensation safety. | Same-key unchanged retry may recover a committed Ticket; Pending cleanup hard-deletes only still-Pending rows and cannot soft-remove now-Active evidence. | tests/lab-02/ticket-idempotency.api.test.ts | Passed — the same-key unchanged retry recovering a committed Ticket is covered in `ticket-idempotency.api.test.ts`; the Pending-cleanup half is covered by `attachments.api.test.ts` (the guarded hard delete) and by the `AttachmentService.test.ts` case where a row that stopped being Pending raises instead of being deleted. |
| API-21 | API | AC-21 | My Tickets ownership, non-deleted scope, and `TicketListItemDTO` projection. | Only current-requester non-deleted Tickets are returned; every required list field is present; `description`, requester fields, `attachments`, `createdBy`, `updatedBy`, `updatedAt`, and `deleted` are absent. | tests/lab-02/my-tickets.api.test.ts | Passed |
| API-22 | API | AC-24 | Search matching and normalization. | Case-insensitive search, trimming, supplied fields OR together, including a Description-only match even though Description is absent from `TicketListItemDTO`; blank search = no search; searchFields without active search ignored. | tests/lab-02/my-tickets.api.test.ts | Passed |
| API-23 | API | AC-24 | searchFields validation. | Nonblank search without searchFields and unknown/non-whitelisted active search field return 400. | tests/lab-02/my-tickets.api.test.ts | Passed |
| API-24 | API | AC-25 | Valid URL-encoded JSON filters. | Valid filters are parsed/normalized and forwarded as typed expressions. | tests/lab-02/my-tickets.api.test.ts | Passed |
| API-25 | API | AC-26 | Malformed filters JSON / non-array root. | 400 Validation Error before query execution. | tests/lab-02/my-tickets.api.test.ts | Passed |
| API-26 | API | AC-26 | Unsupported filter field. | 400 before repository/Prisma call. | tests/lab-02/my-tickets.api.test.ts | Passed |
| API-27 | API | AC-26 | Disallowed Ticket field/condition combinations. | Direct API requests for every representative disallowed Ticket pairing, including generic-compatible but Ticket-forbidden operators and `ISNULL`/`ISNOTNULL`, return 400 before QueryBuilder/Prisma data-access execution; frontend restrictions are not treated as sufficient validation. | tests/lab-02/my-tickets.api.test.ts | Passed |
| API-28 | API | AC-25–26 | Invalid `IN` values. | Empty/non-array/comma-string `IN` value fails; typed non-empty array accepted. | tests/lab-02/my-tickets.api.test.ts | Passed |
| API-29 | API | AC-24–25 | Search/filter logical composition. | Search fields form one OR group; search group and each filter are AND-combined; multiple filters use AND. | tests/lab-02/my-tickets.api.test.ts | Passed |
| API-30 | API | AC-27–28 | Ticket sorting. | Default `createdAt DESC, id DESC`; approved Ticket Number/Summary directions; semantic Priority order; malformed/unsupported sort returns 400. | tests/lab-02/my-tickets.api.test.ts | Passed |
| API-31 | API | AC-29 | Pagination defaults and valid values. | Defaults page 1/size 10; pageSize 1–100 accepted. | tests/lab-02/my-tickets.api.test.ts | Passed |
| API-32 | API | AC-29 | Invalid pagination values. | pageNumber <1, pageSize outside 1–100, and explicitly blank/invalid parse values return 400. | tests/lab-02/my-tickets.api.test.ts | Passed |
| API-33 | API | AC-30 | Beyond-final-page behavior. | 200 with empty array; not treated as error. | tests/lab-02/my-tickets.api.test.ts | Passed |
| API-34 | API | AC-30 | `X-Pagination` response contract. | Header contains pageNumber/pageSize/totalItems/totalPages/hasPreviousPage/hasNextPage with correct zero-item behavior. | tests/lab-02/my-tickets.api.test.ts | Passed |
| API-35 | API | AC-21 | Owned Ticket Detail. | 200 complete full TicketDTO for current requester's non-deleted Ticket, including Description, Requester, Attachment, and audit/lifecycle fields. | tests/lab-02/ticket-detail.api.test.ts | Passed — the owning Requester receives the full `TicketDTO` with Description, Requester fields, active and Removed Attachment metadata, and audit fields; the stored bytes and the internal row ids stay out of the response. |
| API-36 | API | AC-22 | Ticket outside current Requester scope. | Same centralized 404 as unavailable Ticket; no owner identity or protected resource data. | tests/lab-02/ticket-detail.api.test.ts | Passed — ownership and `deleted = false` are asserted as members of the Prisma `where`, and the out-of-scope answer is byte-identical to the missing-Ticket answer. |
| API-37 | API | AC-23 | Missing, malformed, or logically deleted Ticket route identifier. | Centralized 404 behavior for all three cases. | tests/lab-02/ticket-detail.api.test.ts | Passed — missing, malformed, and logically deleted identifiers all answer the same centralized 404; a malformed identifier is rejected before the table is read, so the `@db.Uuid` cast cannot turn it into a 500. |
| API-38 | API | BR-72–73 | Historical Category/System metadata on existing Ticket. | Full TicketDTO and TicketListItemDTO still return historical Category/System names after the master becomes inactive/logically deleted; such masters remain excluded from new-attempt selection validation. | tests/lab-02/ticket-detail.api.test.ts; tests/lab-02/my-tickets.api.test.ts | Passed — both halves now execute: the `TicketListItemDTO` half in `my-tickets.api.test.ts`, and the full `TicketDTO` half in `ticket-detail.api.test.ts`, where Category and Related System rows marked inactive and deleted still resolve their names and the join is asserted to carry no active/deleted predicate. |
| API-39 | API | AC-13 | Standalone `POST /api/attachments` pre-upload. | Exactly one `file` returns 201 full Pending AttachmentDTO with opaque storage key, `ticketPublicId: null`, deleted false, derived MIME, and audit metadata. | tests/lab-02/attachments.api.test.ts | Passed — `201` with the full Pending `AttachmentDTO`, opaque storage key, `ticketPublicId: null`, derived MIME, and audit metadata; the row id and the stored bytes stay out of the response. |
| API-40 | API | AC-14 | Unsupported Attachment extension. | 415 `UNSUPPORTED_MEDIA_TYPE`; no usable Attachment created. | tests/lab-02/attachments.api.test.ts | Passed — `.exe`, `.txt`, `.zip`, and `.xlsx` each return `415` with the attachment-specific message and create nothing. |
| API-41 | API | AC-15 | Attachment size boundaries. | `4,999,999` and `5,000,000` bytes are accepted when other rules pass; `5,000,001` bytes returns `413 PAYLOAD_TOO_LARGE` and creates no usable Attachment. | tests/lab-02/attachments.api.test.ts | Passed — `4,999,999` and `5,000,000` bytes are accepted with the exact `sizeBytes`; `5,000,001` returns `413` and never reaches the insert. |
| API-42 | API | BR-45 | MIME derived from approved extension. | jpg/jpeg/png/webp/pdf map to backend-approved MIME; multipart MIME is not acceptance authority. | tests/lab-02/attachments.api.test.ts | Passed — every approved extension maps to its MIME, and a multipart `Content-Type` of `application/x-msdownload` on a `.png` is ignored in favour of `image/png`. |
| API-43 | API | AC-17, AC-48 | Pending expiry selection boundary exposed to maintenance orchestration. | Before 24 hours remains ineligible; at expiry becomes eligible; Active/Removed rows are never selected. HTTP upload routes do not expose cleanup. | tests/lab-02/attachments.api.test.ts; tests/lab-02/MaintenanceService.test.ts | Passed — the expiry boundary is proved in `MaintenanceService.test.ts` and `maintenance.postgres.test.ts`; `attachments.api.test.ts` proves no cleanup route is registered. |
| API-44 | API | FR-24, BR-56 | Add valid Attachment to existing owned Ticket. | 201 AttachmentDTO bound directly to requested owned Ticket. | tests/lab-02/attachments.api.test.ts | Passed — `201` with the Attachment bound to the requested owned Ticket, inserted inside the one `Serializable` transaction. |
| API-45 | API | AC-18 | Five-active Attachment limit and replacement after removal. | At five active attachments add returns 409; after one is soft-removed, one replacement upload succeeds. | tests/lab-02/attachments.api.test.ts | Passed — five Active returns `409` without inserting; at four, one replacement succeeds, and the count predicate excludes Removed rows, which is what frees the slot. |
| API-46 | API | AC-22 | Add Attachment to Ticket outside current Requester scope. | Same centralized 404 as unavailable Ticket; no Attachment is bound and no owner/existence detail is disclosed. | tests/lab-02/attachments.api.test.ts | Passed — a Ticket outside scope answers a response byte-identical to the missing-Ticket answer, and binds nothing. |
| API-47 | API | AC-23 | Add Attachment to missing/malformed/deleted Ticket. | 404 using centralized not-found behavior. | tests/lab-02/attachments.api.test.ts | Passed — missing, malformed, and logically deleted all answer the centralized `404`; a malformed identifier is refused before the query runs. |
| API-48 | API | AC-20, AC-22–23 | Attachment metadata lifecycle. | Pending/Active/Removed owned metadata = 200; Pending has null Ticket public ID; bound states identify Ticket; Removed includes reason/deleted; scope/missing/malformed share safe 404. | tests/lab-02/attachments.api.test.ts | Passed — Pending, Active, and Removed each answer `200` with the right Ticket public id, reason, and `deleted` flag; the metadata read omits `data`; scope, missing, and malformed share the one safe `404`. |
| API-49 | API | AC-20, AC-22–23 | Attachment preview lifecycle. | Pending/Active owned = 200 inline binary; owned Removed = 410; scope/missing/malformed share safe 404. | tests/lab-02/attachments.api.test.ts | Passed — Pending and Active answer `200` inline; a Removed owned Attachment answers `410`; scope, missing, and malformed share the safe `404`. |
| API-50 | API | AC-20, AC-22–23 | Attachment download lifecycle. | Pending/Active owned = 200 attachment binary; owned Removed = 410; scope/missing/malformed share safe 404. | tests/lab-02/attachments.api.test.ts | Passed — the same lifecycle with `Content-Disposition: attachment`. |
| API-51 | API | BR-57–58 | Pending Attachment collection cleanup. | 204; owned Pending row and binary are hard-deleted and reason is ignored. | tests/lab-02/attachments.api.test.ts | Passed — `204`, and the owned Pending row is hard-deleted under a `ticketId: null, deleted: false` guard with its reason ignored. |
| API-52 | API | AC-19 | Active Attachment collection removal. | 204; Active row becomes deleted with trimmed reason/audit update while binary/metadata remain retained. | tests/lab-02/attachments.api.test.ts | Passed — `204`, `deleted` set with the trimmed reason and the Requester email as `updatedBy`, and no hard delete issued. |
| API-53 | API | AC-19 | Mixed Pending + Active collection batch. | 204; Pending hard deletion and Active soft removal commit together in deterministic processing order. | tests/lab-02/attachments.api.test.ts | Passed — one transaction, one hard delete and one soft removal, committed together. |
| API-54 | API | AC-19 | Collection all-or-nothing validation. | Any invalid/unavailable/outside-scope/removed/reason-invalid item means no batch item is mutated; unavailable scope uses 404. | tests/lab-02/attachments.api.test.ts | Passed — an out-of-scope item in an otherwise valid batch answers `404` and leaves every other item unmutated. |
| API-55 | API | AC-19 | Per-active-item removal reason validation. | Trimmed reason 3–200 accepted; missing/too-short/too-long active reason returns 400 and no mutation. | tests/lab-02/attachments.api.test.ts | Passed — a trimmed 3-200 reason is accepted; missing, two-character, and 201-character reasons return `400` with no mutation. |
| API-56 | API | BR-57 | Duplicate Attachment IDs in collection. | 400 Validation Error; no mutation. | tests/lab-02/attachments.api.test.ts | Passed — duplicate IDs return `400` even when they differ only in case; nothing is deduplicated. |
| API-57 | API | BR-57 | Empty collection items. | 400 Validation Error; no mutation. | tests/lab-02/attachments.api.test.ts | Passed — an empty, missing, or non-array `items` returns `400` before the transaction opens. |
| API-58 | API | BR-57 | Collection larger than 100 items. | 400 Validation Error; no mutation. | tests/lab-02/attachments.api.test.ts | Passed — 101 items returns `400`; exactly 100 is accepted. |
| API-59 | API | AC-23 | Malformed UUID inside collection JSON. | 400 request validation (distinct from malformed public route 404). | tests/lab-02/attachments.api.test.ts | Passed — a malformed UUID in the body returns `400` naming `items[0].attachmentId`, unlike a malformed route identifier's `404`. |
| API-60 | API | AC-19, AC-22 | Item outside current Requester scope in collection. | Same centralized 404 as unavailable item; entire batch remains unchanged and no owner/existence detail is disclosed. | tests/lab-02/attachments.api.test.ts | Passed — the same centralized `404` as an unavailable item, with the batch unchanged. |
| API-61 | API | AC-19–20 | Already Removed item in collection. | 404 and entire batch remains unchanged. | tests/lab-02/attachments.api.test.ts | Passed — an already Removed item answers `404` and mutates nothing. |
| API-62 | API | AC-39, AC-47 | Centralized error envelope and safe public content. | Representative 400/403/404/409/410/413/415/500 responses contain standard fields; validation details are array; no stack/SQL/Prisma/secrets/binary leakage. | tests/lab-02/error-contract.api.test.ts | Passed |
| API-63 | API | AC-40 | `X-Request-Id` propagation/generation. | Valid incoming UUID is echoed; missing/malformed gets generated UUID; success and error responses include the resolved header. | tests/lab-02/error-contract.api.test.ts | Passed |
| API-64 | API | AC-40 | Request-correlation logging safety using mocked logger/spies. | Logs correlate request ID/method/route/status/safe error info; binary data, secrets, DB URL, and unnecessarily sensitive payload content are not logged. | tests/lab-02/error-contract.api.test.ts | Passed |
| API-65 | API | BR-74 | Ticket deletion route absence and default deletion state. | `DELETE /api/tickets/:publicId` is not registered; a newly created Ticket has `deleted = false`. | tests/lab-02/create-ticket.api.test.ts | Passed |
| API-66 | API | FR-31, BR-40, AC-30, AC-40 | Explicit Lab 2 CORS policy and browser-readable response headers. | Preflight permits `Content-Type`, `X-Requester-Id`, `Idempotency-Key`, and `X-Request-Id`; responses expose both `X-Pagination` and `X-Request-Id`; Ticket-list response includes both readable values. | tests/lab-02/cors.api.test.ts | Passed |
| API-67 | API | BR-16, BR-51, AC-22 | Ticket create references an Attachment outside requester scope. | Same centralized 404 as unavailable; no Ticket or binding is created and owner/existence details are absent. | tests/lab-02/create-ticket.api.test.ts | Passed |
| API-68 | API | AC-55 | Ticket-list query complexity bounds. | Search >200 chars, >20 filters, duplicate searchFields, and `IN` outside 1–100 unique typed values return 400 before QueryBuilder/repository/Prisma. | tests/lab-02/my-tickets.api.test.ts | Passed |
| API-69 | API | AC-47 | Direct-upload Serializable transaction retry mapping. | Active count and insert run in one PostgreSQL `Serializable` transaction; only supported serialization/deadlock transient failures are retried, with a small bounded randomized delay and at most three total attempts including the first; validation `400`, scope/not-found `404`, business-limit `409`, payload-size `413`, unsupported-media `415`, and other ordinary business errors are not retried; a retry that observes five Active rows returns `409`, and contention-only exhaustion returns centralized `500 INTERNAL_SERVER_ERROR`. The test does not assert exact backoff milliseconds and no `503 SERVICE_UNAVAILABLE` variant exists. | tests/lab-02/attachments.api.test.ts | Passed — a transient serialization failure is retried and still answers `201`; a retry observing five Active rows answers `409`; three contended attempts answer the centralized `500` and never a `503`; business `409` and scope `404` are not retried. No backoff duration is asserted. |
| API-70 | API | AC-54, AC-58 | Multipart boundary and binary hardening on both upload/access paths. | Missing/duplicate/unexpected/empty/path-like/control/Unicode/overlong files and exact size boundaries map correctly; binary responses use derived MIME, `nosniff`, safe dual filename parameters, `no-store`, and merged `Vary`. | tests/lab-02/attachments.api.test.ts | Passed — missing, duplicate, unexpected, companion-field, and non-multipart inputs answer `400`; path-like, Unicode, and overlong names behave as specified; binary responses carry the derived MIME, `nosniff`, both filename parameters, `no-store`, and the merged `Vary`. |
| API-71 | API | AC-57 | Exact-origin CORS configuration. | Allowed origin succeeds with required allow/expose headers; disallowed/wildcard origins do not; missing/invalid allowlist fails startup outside development/test; origin-less API calls remain valid. | tests/lab-02/cors.api.test.ts | Passed |
| API-72 | API | AC-58 | JSON parser size/error classification. | A body at the 131,072-byte parser boundary reaches normal parse/downstream handling rather than size rejection; larger returns 413; malformed JSON within limit returns 400 BAD_REQUEST; valid JSON with invalid fields returns 400 VALIDATION_ERROR. | tests/lab-02/transport-hardening.api.test.ts | Passed — the final server rerun proves the exact boundary, 413, malformed-JSON `BAD_REQUEST`, and invalid Ticket body `VALIDATION_ERROR` classification across `transport-hardening.api.test.ts` and the field-validation API suites. Requester-context failures remain separately classified as `REQUESTER_CONTEXT_INVALID` (API-01). |
| API-73 | API | AC-59 | Structured logging allowlist and sensitive-marker exclusion. | Success/failure logs contain required correlation/transport fields; seeded marker values for queries, headers, bodies, names/emails, filenames, DB URLs, SQL, binary, and Prisma metadata never appear. | tests/lab-02/error-contract.api.test.ts | Passed |
| API-74 | API | AC-60 | Cache and variation headers. | Bootstrap, requester-scoped JSON/binary, and representative error responses use no-store; requester-scoped responses merge `Origin, X-Requester-Id` into Vary without clobbering the CORS value; the bootstrap `GET /api/requesters` preserves the CORS `Vary: Origin` and does not add `X-Requester-Id`. | tests/lab-02/transport-hardening.api.test.ts | Passed |
| API-75 | API | AC-50 | Synthetic full Requester DTO boundary. | Bootstrap retains the full DevelopmentRequesterDTO shape using only approved synthetic example identities; documentation/configuration never claim CORS makes it private. | tests/lab-02/reference-data.api.test.ts | Passed |
| API-76 | API | BR-19–24, BR-82, AC-65 | `PROCESSING_LEASE_SECONDS = 300`, request-time reclaim, and old-owner fencing behavior. | Before `processingStartedAt + 300 seconds` same hash waits because `now < STALE_CUTOFF`; at exact equality and afterward same hash atomically reclaims because `now >= STALE_CUTOFF` and resets `processingStartedAt`; different hash returns 409 whether fresh or stale; the stale row is not deleted for new-payload key reuse; a resumed owner with the old lease fails fencing before final mutable validation/mutation and returns to wait/replay; no FAILED state is stored. | tests/lab-02/ticket-idempotency.api.test.ts | Passed |

### 7.1 Planned PostgreSQL Integration Tests

These tests run only against guarded `TEST_DATABASE_URL` and inspect committed state through real Prisma/PostgreSQL behavior.

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
| --- | --- | --- | --- | --- | --- | --- |
| PG-01 | PostgreSQL Integration | BR-19–23, AC-06, AC-11, AC-42, AC-65 | Concurrent same requester/key/same canonical payload with referenced Pending rows, using separate connections. | Unique `(requester_id,key)` permits one PROCESSING owner before mutable validation; exactly one Ticket/COMPLETED operation commits; referenced rows bind once; waiter/replay resolves to the same Ticket under 201/200 semantics. | tests/lab-02/postgres/idempotency.postgres.test.ts | Passed |
| PG-02 | PostgreSQL Integration | BR-20–23, AC-12, AC-42, AC-65 | Concurrent same requester/key/different canonical payload or Attachment set. | Unique claim remains single-owner; contender receives `IDEMPOTENCY_CONFLICT`; no duplicate Ticket, incorrect binding, or incorrect idempotency result commits. | tests/lab-02/postgres/idempotency.postgres.test.ts | Passed |
| PG-03 | PostgreSQL Integration | BR-21–24, BR-52, AC-06, AC-11 | Ticket creation + Pending binding rollback after injected failure once the transaction begins. | No partial Ticket, COMPLETED result, or Attachment binding remains; every referenced row remains Pending and retryable; controlled failure safely removes the owned PROCESSING claim rather than persisting FAILED. | tests/lab-02/postgres/transactions.postgres.test.ts | Passed |
| PG-04 | PostgreSQL Integration | BR-58, AC-19 | Mixed Pending hard-delete + Active soft-remove rollback after transaction work begins. | Injected failure leaves no Pending row/binary deletion and no Active lifecycle/reason/audit mutation committed. | tests/lab-02/postgres/transactions.postgres.test.ts | Passed — a mixed batch failing after its first mutation leaves the Pending row present and unbound and the Active row untouched, proved against a real ROLLBACK rather than a mocked transaction. |
| PG-05 | PostgreSQL Integration | BR-47, BR-76, AC-47 | Two concurrent valid direct uploads to one Ticket currently at four Active Attachments, using separate connections. | Each attempt uses PostgreSQL `Serializable` isolation for the Active count plus insert; supported serialization/deadlock failures may use a small bounded randomized delay for at most three total attempts, while ordinary errors are not retried. Exactly one request commits `201`, exactly one resolves `409`, exactly one new Attachment persists, and final Active count is 5. This PostgreSQL test verifies the observable concurrency result and does not assert exact backoff milliseconds. | tests/lab-02/postgres/attachment-concurrency.postgres.test.ts | Passed — two connections at a Ticket holding four Active Attachments produce exactly one `201`, one `409`, one new row, and a final Active count of five. This test is what caught a write conflict escaping as a `500`: the pg driver adapter reports it as a `DriverAdapterError` whose SQLSTATE is nested under `cause.originalCode`, which the retry matcher did not read. |
| PG-06 | PostgreSQL Integration | BR-80–81, AC-48 | Pending cleanup races Ticket binding using separate connections and bounded SKIP LOCKED selection. | The row is either cleaned while still Pending or bound Active; cleanup never deletes it after Active binding and skips a row currently locked for binding. | tests/lab-02/postgres/maintenance.postgres.test.ts | Passed — an expired unbound row is deleted while a fresh one survives; Active and Removed rows are never selected however old; a row locked by another transaction is skipped and, once Active, is never deleted by a later run; a 105-row backlog clears across batches and reruns clean. |
| PG-07 | PostgreSQL Integration | AC-49 | Upgrade a populated Lab 1 schema through the committed Lab 2 migration using the repository-confirmed baseline. | The existing Category table is migrated in place rather than dropped/recreated; its existing `id`, `name`, and original `createdAt` values survive exactly; existing valid rows receive `isActive = true`, `deleted = false`, `createdBy = seed`, `updatedBy = seed`, and `updatedAt` equal to each row's original preserved `createdAt`; no migration-time or other nondeterministic timestamp is used for that backfill; the resulting schema and idempotent seed are valid. | tests/lab-02/postgres/migration-upgrade.postgres.test.ts | Passed — 5 tests |
| PG-08 | PostgreSQL Integration | AC-56 | Attachment database check constraints and removal-metadata retention. | PostgreSQL rejects invalid lifecycle/reason/name-byte/binary-size/size-metadata combinations, rejects `0` and `5,000,001` bytes, accepts `4,999,999` and `5,000,000` bytes, accepts valid Pending, Active, and Removed rows when `size_bytes = octet_length(data)`, permits Pending cleanup, keeps the Ticket binding and reason across a soft removal, and rejects marking a bound row removed without a valid reason. Transition rules beyond per-row validity are application-owned (Specification Section 7.2.7). | tests/lab-02/postgres/transactions.postgres.test.ts | Passed — 8 tests |
| PG-09 | PostgreSQL Integration | BR-82, AC-52 | Expired-but-not-cleaned requester/key reuse racing idempotency cleanup and another reuse caller. | Old technical row is safely removed/replaced, no false unique-key error occurs, exactly one new logical operation wins, and no duplicate Ticket is created. | tests/lab-02/postgres/idempotency.postgres.test.ts; tests/lab-02/postgres/maintenance.postgres.test.ts | Passed — the expired-row race and safe replacement are covered in `idempotency.postgres.test.ts`; the maintenance half is covered in `maintenance.postgres.test.ts`, including the exact-expiry boundary and `PROCESSING` rows left untouched. |
| PG-10 | PostgreSQL Integration | BR-19–23, AC-64–65 | Idempotency database enum, hash, Processing timestamp, state, expiry, unique-claim, and restrictive-FK constraints. | PostgreSQL accepts valid PROCESSING and COMPLETED rows/transitions with non-null `processing_started_at`; request-time boundary evidence treats `now < processing_started_at + 300 seconds` as fresh and `now >= processing_started_at + 300 seconds` as stale; rejects malformed/non-lowercase/non-64-character current hashes, invalid nullability/state combinations, wrong 24-hour expiry, duplicate requester/key ownership, and forbidden referenced-row deletion. | tests/lab-02/postgres/idempotency.postgres.test.ts | Passed — 5 tests |
| PG-11 | PostgreSQL Integration | BR-19–24, BR-82, AC-65 | Stale same-hash PROCESSING claim with two concurrent retries and referenced Pending Attachments, using separate connections. | `PROCESSING_LEASE_SECONDS = 300`; a claim at `4m 59.999s` is fresh and a claim at `5m 00.000s` is stale/reclaim-eligible. Exactly one conditional update reclaims the stale claim and resets `processing_started_at`; exactly one Ticket and one set of Attachment bindings commit; the other retry refetches and waits/replays normally; no duplicate Ticket or Attachment binding occurs. | tests/lab-02/postgres/idempotency.postgres.test.ts | Passed |
| PG-12 | PostgreSQL Integration | BR-19–24, BR-82, AC-65 | Old-owner fencing after reclaim, using separate connections and the exact retained lease timestamp. | A owns PROCESSING; its lease becomes stale; B atomically reclaims and obtains a new `processing_started_at`; A resumes with the old value and its locked status/hash/timestamp fencing check fails before mutation; B alone performs final validation, creates, binds, and completes; exactly one Ticket and one Attachment-binding set commit. The claim lock blocks reclaim while held. | tests/lab-02/postgres/idempotency.postgres.test.ts | Passed |
| PG-13 | PostgreSQL Integration | BR-21, BR-51, AC-06 | A competing writer binds a referenced Pending Attachment after the create transaction's non-locking Pending read, using separate connections. | The binding `UPDATE` re-checks Pending state under the row lock and affects fewer rows than were read, so the create resolves `409` instead of moving the Attachment off the winning Ticket; no losing Ticket, binding, or COMPLETED result commits and the owned claim is removed. | tests/lab-02/postgres/transactions.postgres.test.ts | Passed |
| PG-14 | PostgreSQL Integration | BR-03, AC-07 | A Ticket Number unique violation followed by a retry inside the same transaction. | The violation puts the transaction into PostgreSQL's aborted state (`25P02`), so each attempt runs inside a savepoint and a failed attempt rolls back to it; the retry then inserts normally and the bounded BR-03 retry is reachable rather than dead. | tests/lab-02/postgres/transactions.postgres.test.ts | Passed |
| PG-15 | PostgreSQL Integration | BR-26–39, BR-72–73, AC-21–30, AC-55 | The My Tickets read path executed by an engine: two Requesters whose rows match each other's search terms and filters, a logically deleted row, a wide `createdAt` tie, and a Ticket on reference rows that later go inactive and deleted. | Ownership holds as an outcome rather than as the presence of a `{ requesterId }` object — neither Requester's rows, totals, or pages reach the other, including under a search that matches both; the deleted row is absent from rows and totals alike; a Ticket matches through Description alone while the DTO omits it; `mode: "insensitive"` reaches the comparison for `contains`, for `not`, and for the `IN` the builder expands into insensitive equality, including against `ticket_number`; Priority sorts by enum declaration order rather than alphabetically; the search OR-group ANDs with every filter; paging is complete and duplicate-free past a wide tie and beyond the final page; a LIKE wildcard carried in a search term or an `EQUAL` value is matched as a literal rather than as pattern syntax, so a case-insensitive `EQUAL` stays equality even though Prisma renders it as `ILIKE`; and historical Category and Related System names survive both master rows going inactive and deleted. | tests/lab-02/postgres/my-tickets.postgres.test.ts | Passed — 13 tests |
| PG-16 | PostgreSQL Integration | BR-72–73, AC-21–23 | The Ticket Detail read executed by an engine: two Requesters, a logically deleted Ticket, one bound Attachment, and Category/Related System rows that are inactive and deleted. | Ownership holds as an outcome rather than as the presence of a `{ requesterId }` object — another Requester's existing, non-deleted Ticket resolves to `null` when asked for by its real identifier, in both directions, and so does the owner's own logically deleted Ticket; the owned read returns the full DTO with its Attachment metadata; historical Category and Related System names still resolve after both master rows go inactive and deleted; and the emitted SQL never selects the Attachment `data` column. | tests/lab-02/postgres/ticket-detail.postgres.test.ts | Passed — 5 tests |

## 8. Planned UI Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
| --- | --- | --- | --- | --- | --- | --- |
| UI-01 | UI | AC-02 | Requester Selection normal/loading/empty/failure states. | Skeleton while loading; active names only; test-not-authentication explanation; no-active and safe failure states provide Retry; Continue disabled until selection. | tests/lab-02/RequesterSelection.test.tsx | Passed |
| UI-02 | UI | AC-03 | Requester selection persistence and navigation. | Selecting requester + Continue stores requester in sessionStorage, shows name in app context, and navigates to `/tickets`. | tests/lab-02/RequesterSelection.test.tsx | Passed |
| UI-03 | UI | FR-03–05 | Application shell/navigation. | Desktop shell shows TokTickIT, My Tickets, Create Ticket, requester name, Change Requester, and active navigation semantics. | tests/lab-02/ApplicationShell.test.tsx | Passed — 10 tests |
| UI-04 | UI | AC-01, AC-05, AC-46 | Requester route guard and invalid-context handling. | No valid stored context redirects requester routes to `/requesters` before requester data renders; a `400` carrying `REQUESTER_CONTEXT_INVALID` clears context/state and redirects; an ordinary application `400` leaves the stored Requester untouched. | tests/lab-02/ApplicationShell.test.tsx | Passed — the route-guard half is covered by `ApplicationShell.test.tsx`; the `REQUESTER_CONTEXT_INVALID` clear and the ordinary-`400` no-clear cases are covered by the `useRequesterApi` cases added in this Issue. |
| UI-05 | UI | AC-04 | Change Requester behavior. | Clears prior requester context/cache/list/detail/draft state, including the requester-scoped ambiguous-submission recovery record in `sessionStorage`, which unmounting the requester subtree does not remove; avoids stale data and returns to selector. | tests/lab-02/ApplicationShell.test.tsx | Passed for Issue #19 foundation — `ApplicationShell.test.tsx` verifies Change Requester clears the stored requester context, the stored recovery record, and stale requester UI, returns to Requester Selection, restores destination focus after requester changes and guarded redirects, preserves normal focus on cold selection-page load, and handles browser-history return focus. Feature-specific Requester Selection behavior remains owned by its downstream issue where applicable. |
| UI-06 | UI | FR-07, AC-66 | Create Ticket required, generated, and Requester-context fields. | Editable Category/System/Priority/Summary/Description/Attachments + Cancel/Submit are present; non-editable Ticket Number/Date state that they are assigned on submission; non-editable Requester shows the selected Development Requester; none is sent as a client-controlled body field; pre-creation Status/public/audit fields remain absent. | tests/lab-02/CreateTicket.test.tsx | Passed — every required, generated, and Requester-context control is covered in `CreateTicket.test.tsx`, and the Attachment controls are covered in `AttachmentSection.test.tsx`. |
| UI-07 | UI | AC-08–10, AC-38 | Create Ticket client validation, counters, labels, first-invalid focus. | Errors not dumped on initial render; submit validates all; field-associated messages/counters/required semantics; invalid client-known form does not call API and focuses first invalid field. | tests/lab-02/CreateTicket.test.tsx | Passed |
| UI-08 | UI | FR-12 | Create Ticket busy submission. | Delayed response causes disabled Submit with spinner while text remains `Submit Ticket`; duplicate click prevented. A context-invalidating `400` is treated as a confirmed non-ambiguous failure, so it discards the stored context and leaves no recovery record instead of offering Resume. | tests/lab-02/CreateTicket.test.tsx | Passed |
| UI-09 | UI | AC-06, AC-16, AC-44 | Initial pre-upload and atomic submit. | Valid selected files pre-upload one-by-one to Pending; Submit remains blocked for Uploading/Failed/Invalid intended files until Retry succeeds or Remove is explicit; final prepared IDs are sent and success navigates to Active Detail. | tests/lab-02/CreateTicket.test.tsx | Passed — `AttachmentSection.test.tsx` covers a valid selection reaching Pending, the exact size boundaries, an unsupported file staying Invalid beside a valid sibling, Retry after a failed upload, the submit gate, and the prepared IDs reaching the create payload. |
| UI-10 | UI | AC-10 | Ticket-create 4xx retention. | Stay on form; text/select values and valid Pending cards/IDs remain; server errors map safely; unchanged logical retry reuses the key. | tests/lab-02/CreateTicket.test.tsx | Passed — staying on the form, retaining text/select values, safe server-error mapping, and same-key unchanged retry are covered in `CreateTicket.test.tsx`; the Pending card/ID retention half is covered in `AttachmentSection.test.tsx`, which also asserts that a 4xx triggers no cleanup and no re-upload. |
| UI-11 | UI | BR-23–24 | Ticket-create unexpected 5xx compensation. | Non-file fields remain; best-effort Pending cleanup uses empty reasons; confirmed deletions show Retry Upload; client never invents an Active-removal reason. | tests/lab-02/CreateTicket.test.tsx | Passed — an ambiguous `5xx` releases every prepared Pending row through `DELETE /api/attachments/collection` with an empty reason per item, and the client never invents an Active-removal reason. The empty reason is the safety mechanism rather than a shortcut: the backend ignores it for a Pending row and refuses it for an Active one, and the batch is all-or-nothing, so a row a committed create already bound cannot be removed. That makes the answer informative. A confirmed release means the rows were still Pending, so the create never bound them and a create committing later fails its guarded binding and rolls back; the rows flip to Retry Upload, the recovery record is dropped rather than left to answer `404` forever, and Submit stays blocked until each released file is retried or removed. A refused release changes nothing and the recovery record stands. Non-file fields survive either way. All four cases fail against the page with the release removed. |
| UI-12 | UI | BR-23–24 | Ambiguous Ticket-create recovery. | Unchanged POST retries with the same key; completed 200 recovers same Ticket and Active Attachments without duplicate, cleanup damage, or re-upload. | tests/lab-02/CreateTicket.test.tsx | Passed — `CreateTicket.test.tsx` proves unchanged same-key retry and completed `200` recovery; `AttachmentSection.test.tsx` proves Active replay rendering and the refused-release safety path; E2E-03 proves the committed Ticket/Attachment identity survives reload with one create and one upload. |
| UI-13 | UI | AC-43 | Frontend Idempotency-Key lifecycle. | First logical submission gets a UUID; unchanged canonical retry and reordered same IDs reuse it; Ticket-field or final Attachment-set change generates a new key. | tests/lab-02/CreateTicket.test.tsx | Passed — including the reordered-set case, asserted against `payloadSignature` because the draft's `attachmentIds` are written by the Issue #24 controls |
| UI-14 | UI | AC-45 | Create Ticket Cancel/discard. | Untouched empty draft cancels directly; dirty and/or known Pending draft requires confirmation; confirm sends best-effort Pending cleanup, clears fields/files, and returns to `/tickets`. | tests/lab-02/CreateTicket.test.tsx | Passed — the direct cancel, the confirmation, Keep editing, and the confirmed discard clearing the draft and recovery record are covered in `CreateTicket.test.tsx`; the best-effort Pending cleanup call, with an empty reason per item, is covered in `AttachmentSection.test.tsx`. |
| UI-15 | UI | AC-33 | My Tickets loading/table/stale-data prevention. | Skeleton rows during load; required table structure; stale previous-requester Tickets never render during context change. | tests/lab-02/MyTickets.test.tsx | Passed |
| UI-16 | UI | AC-34 | My Tickets empty dataset vs no-results states. | Shared EmptyState shows correct distinct copy/actions for true empty dataset and active-query no-results. | tests/lab-02/MyTickets.test.tsx | Passed |
| UI-17 | UI | AC-39 | My Tickets load failure. | Page-level list failure navigates to standalone `/error` with safe state. | tests/lab-02/MyTickets.test.tsx | Passed |
| UI-18 | UI | AC-24 | `SEARCH_DEBOUNCE_MS = 400` search debounce and API query mapping. | Using controlled/fake timers, typing starts the inactivity window and no search request occurs before 400 ms of inactivity; advancing to the exact 400 ms boundary triggers exactly one request with `searchFields=ticketNumber,summary,description`; the new effective search resets `pageNumber` to 1. No real-time sleep is used. | tests/lab-02/MyTickets.test.tsx | Passed |
| UI-19 | UI | AC-31 | Filter modal multi-select draft/apply/cancel/reset. | Category/System/Priority/Status are multi-select; Cancel discards; Reset clears draft only; Apply commits/fetches and page resets to 1. | tests/lab-02/MyTickets.test.tsx | Passed |
| UI-20 | UI | AC-31–32 | Filter count/chips/removal/Clear Filters. | Applied count + removable chips update; chip removal fetches page 1; Clear Filters available whenever query active, clears search/filters, preserves sort. | tests/lab-02/MyTickets.test.tsx | Passed |
| UI-21 | UI | AC-28 | Sort control mapping. | All approved Newest/Oldest/Ticket Number/Summary/Priority options map to exact API sort semantics. | tests/lab-02/MyTickets.test.tsx | Passed |
| UI-22 | UI | AC-29–30 | Pagination/page-size UI and list projection consumption. | Page controls use X-Pagination state; 10/20/30/50/100 choices; navigation/page-size changes fetch correct query; UI renders from TicketListItemDTO without requiring excluded fields. | tests/lab-02/MyTickets.test.tsx | Passed |
| UI-23 | UI | FR-21–23 | Ticket Detail read-only information. | Ticket Number, createdAt-as-Ticket-Date, status, priority, requester name/email, category/system, summary/description render read-only with no edit/status workflow. | tests/lab-02/RequesterTicketDetail.test.tsx | Passed — every required field renders with its value as a `readOnly` control rather than a disabled one, the Ticket Date reads from `createdAt` on the business calendar, and no comment, note, assignment, transition, or deletion control exists on the page. |
| UI-24 | UI | AC-22, AC-39 | Ticket Detail page-load ownership 404, unavailable 404, generic 403, and 500. | Requester-scope failure uses safe 404 without owner/A data; all page-level variants navigate to standalone `/error`; Back targets `/tickets`. | tests/lab-02/RequesterTicketDetail.test.tsx | Passed — 404, 403, 500, and a transport failure each land on the standalone `/error` screen with its own safe copy, no sidebar, no backend text, and Back resolved to `/tickets`. |
| UI-25 | UI | AC-13, AC-15, AC-16, AC-44 | Attachment per-file lifecycle presentation and client size boundaries. | Uploading, Failed/Retry, Invalid, Pending, Active, and Removed are distinct; `4,999,999` and `5,000,000` bytes remain valid, `5,000,001` bytes is Invalid, sibling success may become Pending but unresolved intended files block submit, and referenced Pending becomes Active after create. | tests/lab-02/AttachmentSection.test.tsx | Passed — Uploading to Pending, the `4,999,999` / `5,000,000` / `5,000,001` boundary, Invalid beside a valid sibling, Failed with Retry, and the submit gate releasing once the unresolved row is removed. |
| UI-26 | UI | AC-18 | Attachment `x/5` count and Add behavior. | Count includes only active; Removed excluded; at 5/5 Add disabled; no extra max-limit explanatory paragraph. | tests/lab-02/AttachmentSection.test.tsx | Passed — the count excludes Removed rows, Add is disabled at 5/5, and no maximum-reached paragraph is rendered. On Create Ticket the same counter bounds prepared Pending rows, which is the only reading of ui-spec Section 21.1 under which the limit is visible before a Ticket exists. |
| UI-27 | UI | AC-20, AC-38 | Attachment preview modal. | Pending and Active owned supported image/PDF fixtures open the modal; Download is available; Escape/close works; focus trap/return and accessible modal semantics hold. | tests/lab-02/AttachmentSection.test.tsx | Passed — the modal opens from a fetched Blob, shows the file name and a Download action, closes on Escape, and returns focus to the invoking control. |
| UI-28 | UI | AC-19 | Batch Attachment selection. | Only Active Ticket Detail rows are selectable; selected count and Remove Selected behave correctly; Create Ticket transient/Pending states and Removed rows are not selectable for Active removal. | tests/lab-02/AttachmentSection.test.tsx | Passed — only Active Ticket Detail rows carry a checkbox, the selected count and Remove Selected behave correctly, and a Create Ticket Pending row offers neither. |
| UI-29 | UI | AC-19 | Per-selected-Attachment removal reasons. | One required 3–200 char trimmed reason per selected active file; invalid reason blocks delete request. | tests/lab-02/AttachmentSection.test.tsx | Passed — one required reason per selected file; empty, two-character, and whitespace-only reasons block the request and mark the field invalid, and a valid reason is sent trimmed. |
| UI-30 | UI | AC-19 | Atomic batch-removal UI failure. | Failed all-or-nothing API request leaves all selected rows in previous state; no partial Removed UI. | tests/lab-02/AttachmentSection.test.tsx | Passed — a failed all-or-nothing request leaves both rows Active and the count unchanged, and the failure is rendered inside the dialog the user is still looking at rather than on the card behind it. |
| UI-31 | UI | AC-39 | Global Error page variants. | 403/404/500 safe copy; standalone no sidebar; no backend internals; explicit Back routes `/tickets` rather than browser history. | tests/lab-02/ApplicationShell.test.tsx; tests/lab-02/ErrorPage.test.tsx | Passed — the error-page suite now lives in `ErrorPage.test.tsx`, which verifies the safe 403, 404, and 500 variants, the generic fallback for missing or unsupported route state, and deterministic Back routing; `ApplicationShell.test.tsx` keeps the shell-level checks that `/error` renders standalone with its own `main` landmark. Ticket Detail exercises the same foundation from a real failed page load. |
| UI-32 | UI | AC-38 | Shared accessibility contract across UI suites. | Semantic controls, labels/required/errors, keyboard operability, visible focus, aria-live for meaningful async states, icon accessible names plus mandatory tooltip/hover-focus labels, modal focus management, and non-color-only states. | tests/lab-02/RequesterSelection.test.tsx; tests/lab-02/ApplicationShell.test.tsx; tests/lab-02/SharedComponents.test.tsx; tests/lab-02/CreateTicket.test.tsx; tests/lab-02/MyTickets.test.tsx; tests/lab-02/RequesterTicketDetail.test.tsx; tests/lab-02/AttachmentSection.test.tsx; tests/lab-02/ErrorPage.test.tsx | Passed — the shared primitives and shell landmarks/keyboard behavior in `ApplicationShell.test.tsx` and `SharedComponents.test.tsx`; My Tickets in `MyTickets.test.tsx`; Ticket Detail in `RequesterTicketDetail.test.tsx`; and the Attachment actions, their icon-only accessible names, their focus tooltips, the preview modal's focus management, and the per-reason field labelling and error association in `AttachmentSection.test.tsx`. |
| UI-33 | UI | AC-51–53 | Ambiguous-create recovery persistence and expiry. | Recovery record stores requester/key time/original normalized payload only while ambiguous; reload offers explicit resume without auto-submit; success/failure/discard/switch/expiry clears it; current replay rendering includes later Attachment mutations. | tests/lab-02/CreateTicket.test.tsx | Passed — `CreateTicket.test.tsx` proves requester-scoped persistence, approved fields, no auto-submit, 24-hour expiry, and terminal clearing; API replay tests prove current Attachment reconstruction; E2E-03 proves the persisted recovery record resumes after reload without duplicate creation or re-upload. |
| UI-34 | UI | AC-54 | Requester-header binary fetch and Blob URL lifecycle. | Preview/download checks response before body, sends X-Requester-Id, uses known originalName for download, and revokes URLs on close/replacement/unmount/after download; direct binary navigation is not used. | tests/lab-02/AttachmentSection.test.tsx | Passed — preview and download send `X-Requester-Id`, the response is checked before the body is read (a `410` reads no body and creates no URL), the download filename comes from the DTO, and every object URL is revoked on close and after a download. |
| UI-35 | UI | AC-61 | State-less global-error fallback. | Missing/invalid navigation state renders safe generic 500 copy; arbitrary backend text is ignored; Back chooses `/tickets` with valid Requester context and `/requesters` without it. | tests/lab-02/ApplicationShell.test.tsx; tests/lab-02/ErrorPage.test.tsx | Passed — `ErrorPage.test.tsx` verifies safe 403/404/500 copy, the generic fallback for missing, invalid, and restored (`POP`) state, rejection of caller-controlled backend copy and `backPath`, deterministic Back routing based on Requester context, and route-focus behavior. |
| UI-36 | UI | AC-38, AC-66 | Automated meaningful presentation/state contract across Create Ticket, Ticket Detail, badges, and Attachment states. | Assert only contract-significant semantics/classes: generated Ticket Number/Date and Requester are read-only/disabled; editable vs read-only and invalid/error states differ; required labels/asterisks and associated errors exist; Submit/Cancel hierarchy and disabled/busy Submit are represented; Detail fields remain read-only; priority/status badges retain visible text; Pending/Active/Removed/Invalid/Failed states have approved visual/semantic markers without color-only meaning. | tests/lab-02/CreateTicket.test.tsx; tests/lab-02/RequesterTicketDetail.test.tsx; tests/lab-02/AttachmentSection.test.tsx | Passed — the Ticket Detail half in `RequesterTicketDetail.test.tsx`, and the Attachment upload states in `AttachmentSection.test.tsx`: Uploading, Failed, Invalid, Pending, Active, and Removed each read as visible text, a Removed row keeps its reason and loses every control, and the count excludes Removed rows. |
| UI-37 | UI | BR-91, AC-38, AC-66 | Representative icon-only control labels and tooltips. | Mobile sidebar, Attachment preview/download/remove, close/dismiss, pagination, and filter/search auxiliary icon-only controls expose an accessible programmatic name and observable tooltip/hover-focus text with the expected action wording; assertions verify user-visible semantics and association, not tooltip-library internals. | tests/lab-02/ApplicationShell.test.tsx; tests/lab-02/SharedComponents.test.tsx; tests/lab-02/AttachmentSection.test.tsx; tests/lab-02/MyTickets.test.tsx | Passed — mobile sidebar, modal close, and filter-chip removal controls in `ApplicationShell.test.tsx` and `SharedComponents.test.tsx`; the Attachment preview and remove controls in `AttachmentSection.test.tsx`, where each exposes an accessible name and a tooltip that appears on focus and disappears on blur. Download uses visible text rather than an icon, and pagination likewise. |

## 9. Planned Responsive Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
| --- | --- | --- | --- | --- | --- | --- |
| RESP-01 | Responsive | AC-35–37 | Create Ticket at 1440×900, 820×1180, 390×844. | Desktop/tablet approved column behavior; mobile stack; required controls/counters/actions usable; no page-level horizontal overflow/clipping. | e2e/lab-02/responsive-visual.spec.ts | Passed — 3 browser cases at exactly 1440×900, 820×1180, and 390×844; assertions cover generated/read-only fields, Pending Attachment, desktop columns/mobile stack, no horizontal overflow, and usable Submit/tooltip controls. |
| RESP-02 | Responsive | AC-35–37 | My Tickets responsive table and pagination. | Desktop full columns; mobile keeps Ticket Number/Summary/Priority/Status and hides Category/System/Created At; toolbar/pagination usable; no page-level horizontal overflow. | e2e/lab-02/responsive-visual.spec.ts | Passed — 3 browser cases at exactly 1440×900, 820×1180, and 390×844; assertions cover required/hidden columns, mobile toolbar/drawer focus containment, desktop long-list sticky sidebar with visible Change Requester, pagination, and no horizontal overflow. |
| RESP-03 | Responsive | AC-35–37 | Ticket Detail and Attachments responsive behavior. | Desktop/tablet read-only field layout; mobile stack; attachment table adapts while filename/selection/actions stay readable/operable; no page-level horizontal overflow. | e2e/lab-02/responsive-visual.spec.ts | Passed — 3 browser cases at exactly 1440×900, 820×1180, and 390×844; assertions cover read-only fields, responsive Attachment columns/actions, tooltip focus, and no horizontal overflow. |

## 10. Planned Visual Evidence

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
| --- | --- | --- | --- | --- | --- | --- |
| VIS-01 | Visual | AC-35–38 | Create Ticket screenshot evidence at all required viewports. | Screenshots saved under tracked Create Ticket evidence directory and pass visual checklist; no pixel-perfect baseline requirement. | e2e/lab-02/responsive-visual.spec.ts | Passed — six exact-size captures (three required screen captures plus three Attachment-support captures) exist under `docs/lab-02/evidence/screenshots/create-ticket/`; browser assertions cover Zen Green/read-only/editable/validation/button/badge/Attachment/icon-tooltip checklist items. |
| VIS-02 | Visual | AC-35–38 | My Tickets screenshot evidence at all required viewports. | Screenshots saved under tracked My Tickets evidence directory and pass visual checklist. | e2e/lab-02/responsive-visual.spec.ts | Passed — three exact-size captures exist under `docs/lab-02/evidence/screenshots/my-tickets/`; browser assertions cover the closed mobile drawer's tab exclusion, hover tooltip, desktop long-list sticky sidebar, visible Change Requester, required columns, and no overflow. |
| VIS-03 | Visual | AC-35–38 | Ticket Detail screenshot evidence at all required viewports. | Screenshots saved under tracked Ticket Detail evidence directory and pass visual checklist. | e2e/lab-02/responsive-visual.spec.ts | Passed — six exact-size captures (three required screen captures plus three Attachment-support captures) exist under `docs/lab-02/evidence/screenshots/ticket-detail/`; browser assertions cover Zen Green/read-only fields, responsive Attachment semantics, focus tooltip, and no overflow. |

Required screenshot directories:

```text
docs/lab-02/evidence/screenshots/create-ticket/
docs/lab-02/evidence/screenshots/my-tickets/
docs/lab-02/evidence/screenshots/ticket-detail/
```

Required working-app screenshots are independently accessible in this repository:

These PNGs are mandatory delivery evidence that the application works in a
real browser; unit/API results do not replace them.

| Screen | 1440 × 900 | 820 × 1180 | 390 × 844 |
| --- | --- | --- | --- |
| Create Ticket | [PNG](evidence/screenshots/create-ticket/1440x900.png) | [PNG](evidence/screenshots/create-ticket/820x1180.png) | [PNG](evidence/screenshots/create-ticket/390x844.png) |
| My Tickets | [PNG](evidence/screenshots/my-tickets/1440x900.png) | [PNG](evidence/screenshots/my-tickets/820x1180.png) | [PNG](evidence/screenshots/my-tickets/390x844.png) |
| Ticket Detail | [PNG](evidence/screenshots/ticket-detail/1440x900.png) | [PNG](evidence/screenshots/ticket-detail/820x1180.png) | [PNG](evidence/screenshots/ticket-detail/390x844.png) |

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
| E2E-01 | E2E | AC-02–03, AC-06, AC-13, AC-18–21, AC-24–25, AC-28–32, AC-40, AC-44 | Full Requester golden path. | Select requester → Create Ticket → select/pre-upload files Pending → submit `attachmentIds` → atomic Ticket/all-binding success → Detail files Active → My Tickets/search/filter/sort/page → direct existing-Ticket add/preview/download/remove → Removed evidence. | e2e/lab-02/requester-ticket-flow.spec.ts | Passed — 1 browser test covers requester selection, Create Ticket, Pending-to-Active binding, list/search/filter/sort/page, Detail upload/preview/download, batch removal, and Removed evidence. |
| E2E-02 | E2E | AC-01, AC-04, AC-21–23, AC-39, AC-46 | Cross-requester ownership path. | Requester A creates Ticket; switch to B; direct-open A publicId → backend 404 → safe standalone 404 → Back `/tickets`; no owner identity or A Ticket data appears under B. | e2e/lab-02/requester-ticket-flow.spec.ts | Passed — 1 browser test proves Alice's Ticket is a safe standalone 404 after switching to Bob, with no Alice/marker/sidebar/navigation leakage and deterministic Back to `/tickets`. |
| E2E-03 | E2E | AC-06, AC-11, AC-42–44, AC-53 | Handout Create Ticket recovery evidence across reload. | Pre-upload Pending → create commits but response is ambiguous → reload offers explicit recovery without auto-submit → unchanged same-key retry returns current 200 DTO for the same Ticket → no duplicate, forced re-upload, or Pending revalidation. | e2e/lab-02/create-ticket.spec.ts | Passed — 1 browser test forces an observed 500 after real commit, verifies persisted explicit recovery across reload, one upload, one logical Ticket, and same-key 200 replay to the same active Attachment state. |

The Playwright HTML report, traces, and failure-only captures under
`artifacts/lab-02/` are generated local evidence and intentionally ignored by
Git. The required screenshot PNGs are written directly to the tracked
`docs/lab-02/evidence/screenshots/` directories above. From the repository root,
after installing the pinned runner and Chromium, recreate the screenshots and
local report with the disposable targets documented above:

```bash
NODE_ENV=test TEST_DATABASE_URL=<lab2_url> DATABASE_URL=<lab1_url> DIRECT_URL=<lab1_url> npm run test:e2e
```

Commit the required PNGs with the Lab 2 delivery. Keep only the HTML report,
traces, and failure-only captures in ignored `artifacts/lab-02/`.

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
| #21 — Ticket creation | `server/tests/lab-02/TicketNumber.test.ts`, `server/tests/lab-02/TicketService.test.ts`, `server/tests/lab-02/IdempotencyService.test.ts`, `server/tests/lab-02/tickets.api.test.ts`, `server/tests/lab-02/create-ticket.api.test.ts`, `server/tests/lab-02/ticket-idempotency.api.test.ts`, `server/tests/lab-02/postgres/idempotency.postgres.test.ts`, `server/tests/lab-02/postgres/transactions.postgres.test.ts`, `client/tests/lab-02/CreateTicket.test.tsx` | PROCESSING claim-before-mutation, SHA-256 canonicalization, exact `PROCESSING_LEASE_SECONDS = 300` fresh/stale boundary and atomic reclaim, `IDEMPOTENCY-FENCING-A`, final mutable revalidation under the claim lock, Ticket creation/binding, current-state replay after later mutations, exact logical expiry/expired-row replacement, recovery persistence, conflict behavior, generated/context field UI, and PG-01–PG-03/PG-09–PG-14 pass. |
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
| BR-66 | DATA-01 | Inspect Prisma mappings and committed migration SQL/table definitions for singular `snake_case` PostgreSQL names and camelCase Prisma properties. | Verified — `schema.prisma` maps all six persistent models and their fields to singular `snake_case` PostgreSQL names; fresh PostgreSQL catalog inspection matched the committed mappings. |
| BR-67 | DATA-02 | Inspect every persistent resource model/migration for the four required audit columns, types, nullability, and timestamps. | Verified — all six persistent tables expose non-null `created_by`, `created_at`, `updated_by`, and `updated_at`; Prisma uses `VarChar(255)` and `Timestamptz(3)`, with fresh-catalog confirmation. |
| BR-68 | UNIT-05, API-11, DATA-03 | Assert requester-triggered writes derive audit actors from the Requester email and never from a client-supplied actor value. | Verified — final server suite passed the requester/audit derivation tests; create, Attachment, removal, and idempotency paths derive actors from the resolved Requester or approved `seed`/`system` actor and ignore client-supplied audit fields. |
| BR-69 | DATA-04 | Run the idempotent seed and system-operation smoke checks; verify `seed`/`system` audit actors and unchanged audit timestamps on an unchanged seed rerun. | Verified — fresh migration plus seed completed; a repeated CLI seed on disposable `toktickit_lab1_dev` produced identical complete seeded audit snapshots, including `createdAt`/`updatedAt`; system maintenance smoke returned 0 pending Attachments and 0 expired Idempotency records. |
| BR-70 | UNIT-02, UNIT-03, UNIT-12, API-21, API-37, API-52, DATA-05 | Verify business-resource `deleted` defaults to false, is used by normal visibility/ownership predicates, and is set only by the approved soft-delete lifecycle. | Verified — schema defaults are false; final API/PG suites prove visibility and ownership predicates; Attachment lifecycle tests prove Active soft-removal and Pending hard-delete distinction, with no Ticket delete route. |
| BR-74 | API-65, DATA-06 | Verify no Ticket deletion operation is exposed and new Ticket persistence/output uses `deleted = false`. | Verified — final `create-ticket.api.test.ts` and full server suite prove `DELETE /api/tickets/:publicId` is unregistered and new Tickets persist/output as non-deleted. |
| BR-91 | UI-32, UI-37, VIS-01, VIS-02, VIS-03 | Inspect representative icon-only controls for both accessible programmatic names and visible tooltip/hover-focus labels, including navigation, Attachment, close, pagination, filter/search, mobile-sidebar, and modal controls; verify action wording without relying on icon shape, color, `title` alone, or `aria-label` alone. | Verified — client accessibility suites pass programmatic-name/focus-tooltip assertions; Playwright passes hover/focus tooltip checks for mobile navigation and Attachment preview at all three exact viewports; screenshot checklist reviewed. |
| Migration preservation (AC-49) | PG-07, DATA-07 | Apply the committed migration to both a fresh database and a populated Lab 1 database; verify the existing Category table is altered in place, its `id`, `name`, and `createdAt` values are preserved exactly, and each existing valid row receives `isActive = true`, `deleted = false`, `createdBy = seed`, `updatedBy = seed`, and `updatedAt = original createdAt`. Verify that existing-row `updatedAt` is not derived from migration execution time, `now()`, `CURRENT_TIMESTAMP`, application-start time, or another nondeterministic timestamp. | Passed — PG-07 + fresh deploy/seed smoke |
| Attachment checks/indexes (AC-56, AC-63) | PG-08, DATA-08 | Inspect and exercise the committed Attachment checks - which are the complete database-level Attachment contract, with no triggers - plus the general/partial/unique/trigram/cleanup indexes; verify the size invariant `size_bytes > 0 AND size_bytes <= 5000000 AND size_bytes = octet_length(data)` and record schema evidence without asserting an exact query plan. | Passed — PG-07 schema evidence + PG-08 |
| Synthetic Requester boundary (AC-50) | API-75, DATA-09 | Inspect seed fixtures and bootstrap evidence to confirm every unauthenticated Requester identity is synthetic and deployment documentation prohibits real PII/public exposure. | Passed — verified for Issue #20 on 2026-08-24: every seeded Requester identity in `server/prisma/seed.ts` is synthetic and uses an `@example.com` address, and a live `curl -i http://localhost:3000/api/requesters` against the disposable Lab 1 database returned exactly those four active synthetic identities and no other personal data. `README.md` now states that the CORS origin restriction is browser hardening rather than authentication, authorization, or a privacy boundary, and that the unauthenticated Lab 2 application is restricted to development and test networks and must not be described as safe for public deployment. Re-verified on 2026-08-25 for Issue #21: API-75 is implemented and passing in `tests/lab-02/reference-data.api.test.ts`, which proves the full nine-key `DevelopmentRequesterDTO` shape, the active/non-deleted query, the absent `X-Requester-Id` requirement, and the 404 outside development and test; the five seeded identities in `server/prisma/seed.ts` are all `@example.com`; and `README.md` still states that the CORS origin restriction is browser hardening rather than authentication, authorization, or a privacy boundary. |
| Pinned test tooling (AC-62) | DATA-10 | Inspect root/client manifests and lockfiles: pinned client MSW, minimal private root package, pinned local Playwright, no workspaces/application dependency relocation, and no implicit download in E2E commands. | Verified — client `msw` is pinned to `2.11.5`; private root package pins `@playwright/test` to `1.60.0`; root lockfile has five packages, no workspaces, application dependencies remain in `client/` and `server/`, and `npm run test:e2e -- --list` resolves the local runner without implicit download. |
| Authoritative schema contract (AC-64) | PG-07, PG-08, PG-10, DATA-11 | Inspect Prisma mappings and committed migration SQL against Specification Section 7 for every field type/nullability/default, enum, key, restrictive FK, CHECK, and index; run boundary tests on fresh PostgreSQL without asserting an exact planner choice. | Passed — PG-07, PG-08, PG-10 |

### 15.2 Issue #25 Final Verification — 2026-08-27

This is the final safety/regression gate after the #18–#24 focused close gates.
All database work below used the local disposable `postgres:16-alpine`
container `toktickit-lab2-test-postgres` on `127.0.0.1:55432`. Sanitized targets:
`toktickit_lab1_dev` for Lab 1 application tests and
`toktickit_lab2_test` for guarded Lab 2 PostgreSQL tests/E2E. Passwords are
redacted; no Supabase or production target was migrated, seeded, reset, or
queried.

#### Commands and results

| Check | Exact command shape (credentials redacted) | Result |
| --- | --- | --- |
| Lab 1 server tests | `cd server && NODE_ENV=test DATABASE_URL=<lab1_url> DIRECT_URL=<lab1_url> TEST_DATABASE_URL=<lab2_url> npm test -- tests/lab-01` | Passed — 2 files, 2 tests. |
| Lab 1 client tests | `cd client && npm test -- tests/lab-01` | Passed — 2 files, 6 tests. |
| Full server regression | `cd server && NODE_ENV=test DATABASE_URL=<lab1_url> DIRECT_URL=<lab1_url> TEST_DATABASE_URL=<lab2_url> npm test -- --silent` | Passed — 31 files, 674 tests; no skipped tests. Includes all Lab 1, Unit/API, and guarded PostgreSQL files. |
| Full client regression | `cd client && npm test` | Passed — 10 files, 258 tests; no skipped tests. |
| Server build/typecheck | `cd server && npm run build` | Passed — TypeScript build. |
| Client build/typecheck | `cd client && npm run build` | Passed — TypeScript and Vite production build. |
| PostgreSQL guard test | `cd server && NODE_ENV=test DATABASE_URL=<lab1_url> DIRECT_URL=<lab1_url> TEST_DATABASE_URL=<lab2_url> npm test -- tests/lab-02/postgres/testDatabase.test.ts` | Passed — 1 file, 8 tests; no skipped tests. |
| Guarded PostgreSQL suite | `cd server && NODE_ENV=test DATABASE_URL=<lab1_url> DIRECT_URL=<lab1_url> TEST_DATABASE_URL=<lab2_url> npm test -- tests/lab-02/postgres` | Passed — 8 files, 78 tests; no skipped tests; real migrations, connections, transactions, constraints, and concurrency. |
| Prisma validation | `cd server && NODE_ENV=test DATABASE_URL=<lab1_url> DIRECT_URL=<lab2_url> TEST_DATABASE_URL=<lab2_url> npx --no-install prisma validate` | Passed — schema valid. |
| Prisma migration status | `cd server && NODE_ENV=test DATABASE_URL=<lab1_url> DIRECT_URL=<lab2_url> TEST_DATABASE_URL=<lab2_url> npx --no-install prisma migrate status` | Passed — explicitly reported `toktickit_lab2_test` at `127.0.0.1:55432`; schema up to date; 3 migrations found. |
| Prisma drift | `cd server && NODE_ENV=test DATABASE_URL=<lab1_url> DIRECT_URL=<lab2_url> TEST_DATABASE_URL=<lab2_url> npx --no-install prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` | Passed — empty migration. |
| Fresh migration/seed | `docker exec toktickit-lab2-test-postgres createdb -U lab2_test --maintenance-db=toktickit_lab2_test toktickit_lab2_fresh`; `cd server && NODE_ENV=test DATABASE_URL=<fresh_url> DIRECT_URL=<fresh_url> TEST_DATABASE_URL=<lab2_url> npx --no-install prisma migrate deploy`; same environment `npm run prisma:seed` | Passed — all 3 migrations applied to the empty disposable target; seed created 4 Categories, 7 Related Systems, and 5 synthetic Requesters. |
| Seed idempotency | `cd server && NODE_ENV=test DATABASE_URL=<lab1_url> DIRECT_URL=<lab1_url> TEST_DATABASE_URL=<lab2_url> npm run prisma:seed` twice, with read-only before/after catalog snapshots | Passed — repeated seeded audit snapshot was byte-identical; `seed` actors and timestamps were unchanged. |
| Maintenance smoke | `cd server && NODE_ENV=test DATABASE_URL=<lab2_url> DIRECT_URL=<lab2_url> TEST_DATABASE_URL=<lab2_url> npm run maintenance:cleanup` | Passed — disposable-target result `pendingAttachments: 0`, `idempotencyRecords: 0`; no HTTP cleanup route exists. |
| Pinned E2E test listing | `NODE_ENV=test TEST_DATABASE_URL=<lab2_url> DATABASE_URL=<lab1_url> DIRECT_URL=<lab1_url> npm run test:e2e -- --list` | Passed — exact 12 planned tests listed from the local pinned runner; no implicit Playwright download. |
| Pinned E2E/responsive/visual | `NODE_ENV=test TEST_DATABASE_URL=<lab2_url> DATABASE_URL=<lab1_url> DIRECT_URL=<lab1_url> npm run test:e2e` | Passed — 12 tests, 12 passed, 19.4s; 3 E2E tests plus 9 exact viewport tests. |

The final executable guard coverage rejects `NODE_ENV != test`, missing
`TEST_DATABASE_URL` without falling back to `DATABASE_URL`, a non-PostgreSQL
`TEST_DATABASE_URL`, the same database as `DATABASE_URL`, the same database as
`DIRECT_URL`, a missing explicit test marker, a database not identifiable as
the dedicated Lab 2 target, and a reset target that differs from the guarded
`TEST_DATABASE_URL`.

#### #18–#24 focused close-gate evidence

Each owning gate passed before the final full regression above. The final run
also reran every listed path.

| Issue | Focused result |
| --- | --- |
| #18 Data model/seed | Server 5 files/44 tests, including migration-upgrade, transactions, and idempotency PostgreSQL coverage. |
| #19 UI foundation | Client 1 file/45 tests (`ApplicationShell.test.tsx`). |
| #20 Requester context | Server 6 files/64 tests; client 2 files/56 tests. |
| #21 Ticket creation | Server 8 files/187 tests, including idempotency/transaction PostgreSQL coverage; client 1 file/40 tests. |
| #22 My Tickets | Server 4 files/221 tests; client 1 file/45 tests. `TicketQueryValidator.test.ts` covers field/condition/type/complexity rejection before QueryBuilder/Prisma, while `QueryBuilder.test.ts` covers every generic condition including `ISNULL`, `ISNOTNULL`, `IN`, OR search, and ordering. |
| #23 Ticket Detail | Server 2 files/29 tests; client 2 files/33 tests. |
| #24 Attachment lifecycle | Server 7 files/195 tests, including direct-upload Serializable retry/concurrency and maintenance PostgreSQL coverage; client 1 file/43 tests. |

#### Playwright ownership and screenshot evidence

The exact planned files exist and own the following cases:

- `e2e/lab-02/requester-ticket-flow.spec.ts`: E2E-01 golden path and E2E-02 cross-requester isolation;
- `e2e/lab-02/create-ticket.spec.ts`: E2E-03 ambiguous-create recovery across reload;
- `e2e/lab-02/responsive-visual.spec.ts`: RESP-01–03 and VIS-01–03 at exactly `1440x900`, `820x1180`, and `390x844`.

Required captures exist at exact viewport dimensions under the tracked evidence
directories:

- `docs/lab-02/evidence/screenshots/create-ticket/`: `1440x900.png`, `820x1180.png`, `390x844.png`, plus Attachment-support captures;
- `docs/lab-02/evidence/screenshots/my-tickets/`: `1440x900.png`, `820x1180.png`, `390x844.png`;
- `docs/lab-02/evidence/screenshots/ticket-detail/`: `1440x900.png`, `820x1180.png`, `390x844.png`, plus Attachment-support captures.

`file` verified every capture is exactly its named viewport. The checklist
passed through the browser assertions and capture review: Zen Green tokens;
editable versus read-only controls; generated/context fields; validation
semantics; button hierarchy; visible status/priority badges; Attachment
Pending/Active/Removed treatment; no clipping, overlap, hidden required action,
or page-level horizontal overflow; keyboard-visible focus; non-color-only
meaning; and readable Attachment names. Representative icon-only controls have
both accessible names and observable hover/focus tooltips. VIS-02 additionally
proves closed mobile drawer descendants are not focusable and a long desktop
list leaves the sticky sidebar and Change Requester visible.

#### Final traceability and limitations

All planned Unit/API/UI rows in Sections 6–8, RESP/VIS/E2E rows in Sections
9–11, and DATA-01–DATA-11 in Section 15.1 now have final passing results.
Section 13 therefore maps `AC-01` through `AC-66` to passing automated tests or
verified delivery evidence; mocked tests are not being used as PostgreSQL
proof. Fresh migration, populated-Lab-1 Category preservation, exact
Attachment invariant, required indexes/extension, max-five Serializable
outcomes, idempotency fencing/expiry, audit actor/timestamp behavior, and
maintenance evidence are covered by the guarded PostgreSQL/catalog checks.

No REST endpoint or application dependency was changed by Issue #25. The only
application-adjacent change is the PostgreSQL test-database guard tightening;
MSW is client test-only, and Playwright is a private root package with no
workspace or application-dependency relocation. `rg` found no skipped/only/todo
test declarations in `server/tests`, `client/tests`, or `e2e`.

Known limitations recorded honestly: client tests still emit pre-existing React
`act`/list-key warnings while passing; the client dependency install reported
six npm audit findings and no unrelated upgrade/audit fix was applied; and
visual verification is checklist-based rather than pixel-baseline comparison,
as permitted by the handout.

### 15.3 Issue #26 Release-Evidence Revalidation — 2026-08-27

PR [#49](https://github.com/oangsa/TokTickIT/pull/49) was approved and merged
into `lab2-staging` as `df8da1e16e8cc31591c14a17c873e6f1195cffbb`. Its merge
tree was verified equal to PR #49's head
`dff9f4d9304cef8c3de6b2073d8c818b9c0d1b94`; the application, Prisma schema,
migrations, dependencies, and test sources remain unchanged. The fresh
post-merge checks below ran against that exact staging tree. The follow-up
record entered `lab2-staging` through merged [PR #50](https://github.com/oangsa/TokTickIT/pull/50)
as `314e9c3bcac73f072e3d77276c7f1381574c5ba8`; its docs-only merge did not
alter application behavior. The final staging baseline is now promoted by open
release [PR #51](https://github.com/oangsa/TokTickIT/pull/51), which is not
merged.

The corrected evidence sequence is [#46](https://github.com/oangsa/TokTickIT/pull/46)
(historical merge before approval), approved revert [#48](https://github.com/oangsa/TokTickIT/pull/48),
closed unmerged [#47](https://github.com/oangsa/TokTickIT/pull/47), and approved
corrected [#49](https://github.com/oangsa/TokTickIT/pull/49). Issue #26 is now
closed/completed by PR #49's `Closes #26` relation; its closure boundary treats
the replacement `lab2-staging` → `main` release PR as a separate promotion
gate. No Supabase, production database, real credentials, PII, or binary
Attachment data was used.

All PostgreSQL work used the disposable `postgres:16-alpine` container
`toktickit-lab2-test-postgres` at `127.0.0.1:55432`. The redacted targets were
`toktickit_lab1_dev` for Lab 1/application tests and `toktickit_lab2_test` for
guarded Lab 2 PostgreSQL tests and E2E.

#### Independent feature close gates

These results are separate. Each gate passed before its Issue was marked Done;
Issue #25 is not being used to defer any of them.

| Issue | Focused command/result | Final status |
| --- | --- | --- |
| #18 — Data model and seed | `cd server && NODE_ENV=test DATABASE_URL=<lab1_url> DIRECT_URL=<lab1_url> TEST_DATABASE_URL=<lab2_url> npm test -- tests/lab-02/CategoryService.test.ts tests/lab-02/RelatedSystemService.test.ts tests/lab-02/postgres/migration-upgrade.postgres.test.ts tests/lab-02/postgres/transactions.postgres.test.ts tests/lab-02/postgres/idempotency.postgres.test.ts` — 5 files, 44 tests | Passed |
| #19 — UI foundation | `cd client && npm test -- tests/lab-02/ApplicationShell.test.tsx` — 1 file, 45 tests | Passed |
| #20 — Requester context | Server six-file gate from Section 14 — 6 files, 64 tests; client `cd client && npm test -- tests/lab-02/RequesterSelection.test.tsx tests/lab-02/ApplicationShell.test.tsx` — 2 files, 56 tests | Passed |
| #21 — Ticket creation | Server eight-file gate from Section 14 — 8 files, 187 tests; client `cd client && npm test -- tests/lab-02/CreateTicket.test.tsx` — 1 file, 40 tests | Passed |
| #22 — My Tickets | Server four-file gate from Section 14 — 4 files, 221 tests; client `cd client && npm test -- tests/lab-02/MyTickets.test.tsx` — 1 file, 45 tests | Passed |
| #23 — Ticket Detail | Server `ticket-detail.api.test.ts` + `transport-hardening.api.test.ts` — 2 files, 29 tests; client `RequesterTicketDetail.test.tsx` + `ErrorPage.test.tsx` — 2 files, 33 tests | Passed |
| #24 — Attachment lifecycle | Server seven-file gate from Section 14 — 7 files, 195 tests; client `cd client && npm test -- tests/lab-02/AttachmentSection.test.tsx` — 1 file, 43 tests | Passed |

The full command paths for the summarized gates are the authoritative paths in
Section 14 and include the exact handout-required filenames plus the approved
modular tests. No focused gate was skipped or marked Done with deferred feature
tests.

#### Issue #25 final regression result

| Check | Result |
| --- | --- |
| Full server regression | `cd server && NODE_ENV=test DATABASE_URL=<lab1_url> DIRECT_URL=<lab1_url> TEST_DATABASE_URL=<lab2_url> npm test -- --silent` — 31 files, 674 tests, 0 skipped; includes Lab 1, Unit/API, and all guarded PostgreSQL suites |
| Full client regression | `cd client && npm test -- --silent` — 10 files, 258 tests, 0 skipped |
| Lab 1 regression | Included in the full suites; dedicated prior gate remains 2 server tests and 6 client tests |
| PostgreSQL guard | Included in full server run; `testDatabase.test.ts` is 1 file, 8 tests |
| Server build | `cd server && npm run build` — passed |
| Client build | `cd client && npm run build` — passed |
| Prisma validation/status/drift | `prisma validate` passed; status explicitly named `toktickit_lab2_test` at `127.0.0.1:55432` and reported up to date; diff reported an empty migration |
| Seed/maintenance | Seed rerun passed; maintenance returned `pendingAttachments: 0`, `idempotencyRecords: 0` |
| Pinned E2E/responsive/visual | `NODE_ENV=test TEST_DATABASE_URL=<lab2_url> DATABASE_URL=<lab1_url> DIRECT_URL=<lab1_url> npm run test:e2e` — 12 tests, 12 passed in 18.8s: three E2E flows plus nine exact viewport cases |

#### Fresh post-PR #49 `lab2-staging` integration gate

The following checks were rerun on the exact merged staging commit
`df8da1e16e8cc31591c14a17c873e6f1195cffbb` after PR #49 merged. They are the
current AC-10 release-integration result; the focused Issue #18–#24 gates and
the Issue #25 regression above remain separately identified.

| Check | Fresh result |
| --- | --- |
| Server regression | `cd server && NODE_ENV=test DATABASE_URL=<lab1_url> DIRECT_URL=<lab1_url> TEST_DATABASE_URL=<lab2_url> npm test -- --silent` — **Pass**, 31 files, 674 tests, 0 skipped |
| Client regression | `cd client && npm test -- --silent` — **Pass**, 10 files, 258 tests, 0 skipped |
| Server build | `cd server && npm run build` — **Pass** |
| Client build | `cd client && npm run build` — **Pass** |
| Prisma schema | `cd server && NODE_ENV=test DATABASE_URL=<lab2_url> DIRECT_URL=<lab2_url> TEST_DATABASE_URL=<lab2_url> npx --no-install prisma validate` — **Pass**, schema valid |
| Prisma migration status | `cd server && NODE_ENV=test DATABASE_URL=<lab2_url> DIRECT_URL=<lab2_url> TEST_DATABASE_URL=<lab2_url> npx --no-install prisma migrate status` — **Pass**, datasource explicitly named `toktickit_lab2_test` at `127.0.0.1:55432`; 3 migrations found and schema up to date |
| Prisma drift | `cd server && NODE_ENV=test DATABASE_URL=<lab2_url> DIRECT_URL=<lab2_url> TEST_DATABASE_URL=<lab2_url> npx --no-install prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` — **Pass**, empty migration |
| Seed repeat | `cd server && NODE_ENV=test DATABASE_URL=<lab2_url> DIRECT_URL=<lab2_url> TEST_DATABASE_URL=<lab2_url> npm run prisma:seed` — **Pass**, 4 Categories, 7 Related Systems, and 5 synthetic Requesters |
| Maintenance smoke | `cd server && NODE_ENV=test DATABASE_URL=<lab2_url> DIRECT_URL=<lab2_url> TEST_DATABASE_URL=<lab2_url> npm run maintenance:cleanup` — **Pass**, `pendingAttachments: 0`, `idempotencyRecords: 0` |
| Pinned Playwright E2E/responsive/visual | `NODE_ENV=test TEST_DATABASE_URL=<lab2_url> DATABASE_URL=<lab1_url> DIRECT_URL=<lab1_url> npm run test:e2e` — **Pass**, 12/12 in 19.5s: three E2E flows plus nine exact viewport cases at `1440x900`, `820x1180`, and `390x844` |
| Tracked screenshots | Playwright regenerated the 14 snapshots during the run; they were restored to the committed staging baseline. No screenshot diff is included in this evidence update. |

The local PostgreSQL container was disposable and was removed after validation.
The merged staging commit also passed GitHub's **Lab 2 Verification** workflow
([run 42](https://github.com/oangsa/TokTickIT/actions/runs/33091755715)); its
server and client jobs both passed. **Project Automation** also passed on the
merge event ([run 144](https://github.com/oangsa/TokTickIT/actions/runs/33091755449))
and successfully processed the merged PR's linked Issue #26 closure. The
connected API does not expose the ProjectV2 Status field, so the exact card
field remains a manual-only limitation; GitHub records Issue #26 as closed with
reason `completed`. After docs PR #50 merged, the final staging branch also
passed GitHub's Lab 2 Verification workflow
([run](https://github.com/oangsa/TokTickIT/actions/runs/33094908664)); its server
and client jobs passed before release PR #51 was opened.

PR #45's GitHub **Lab 2 Verification** run independently passed for its final
head: [workflow run 16](https://github.com/oangsa/TokTickIT/actions/runs/33068961531)
on [PR #45](https://github.com/oangsa/TokTickIT/pull/45) passed the server and
client jobs. That workflow does not run Playwright; the 12/12 browser result
above is the local pinned-runner evidence. The tracked screenshot set remains
under `docs/lab-02/evidence/screenshots/`, with exact `1440x900`, `820x1180`,
and `390x844` dimensions checked by `file`; generated reports/traces remain
under ignored `artifacts/lab-02/`.

#### Release limitations and boundaries

- GitHub CI proves server/client gates for PR #45; local disposable-target
  execution proves E2E and screenshot capture. No CI E2E job is claimed.
- Client tests retain pre-existing React `act`/list-key warnings while passing.
- The dependency install reported six audit findings; no unrelated dependency
  upgrade was added.
- Visual review is checklist-based, not pixel-baseline comparison.
- Lab 2 remains unauthenticated and development/test-network-only. The five
  seeded Requesters are synthetic `@example.com` fixtures; the selector and
  `X-Requester-Id` are not authentication or a privacy boundary.
- Lab 3 authentication, staff workflow, and other later-lab features are not
  included.

#### Reversion baseline validation — 2026-08-27

Approved PR #48 merged into `lab2-staging` at
`b476a2754fb0510f77512a1a87711daa554255dc`. The resulting staging tree was
verified identical to pre-#46 application baseline `6ef7ed4`; the revert changed
release documentation/evidence only. The previously recorded executable gate
therefore remains applicable to the application tree, but no new application
test run is claimed for this correction branch.

The previously recorded executable gate produced the following results on this
unchanged application tree:

| Check | Result |
| --- | --- |
| Server regression | 31 files, 674 tests passed; includes Lab 1 and guarded PostgreSQL suites |
| Client regression | 10 files, 258 tests passed |
| Server/client builds | Passed |
| Prisma validation/status/drift | Valid schema; Lab 2 database up to date; empty migration drift |
| Seed/maintenance | Idempotent seed passed; cleanup returned zero pending Attachments and idempotency records |
| Playwright | 12/12 passed in 19.0s at `1440x900`, `820x1180`, and `390x844` |
| Project/Kanban | Reviewer manual verification: correct |

The original PR #46 Changes Requested review and its post-merge validation
remain preserved as historical evidence; PR #46 merged before peer approval.
PR #48's approval and merge restored the pre-#46 baseline. PR #49 then
reapplied the corrected evidence, was peer-approved, and merged into staging;
the fresh post-#49 validation is recorded above. Docs PR #50 then merged the
validation record into staging. Issue #26 is closed by its documented closure
boundary, and replacement release PR [#51](https://github.com/oangsa/TokTickIT/pull/51)
is the single separate `lab2-staging` → `main` promotion step; it remains open
and unmerged pending peer approval.

### 15.4 PR #53 UI-polish verification and evidence regeneration — 2026-08-29

PR [#53](https://github.com/oangsa/TokTickIT/pull/53) (`refactor/ui-polish` into
`lab2-staging`) is a visual-polish pass over the Lab 2 Requester UI. It changes
no server source, Prisma schema, migration, or seed, and no API contract. Its
original submission left two items open: the committed screenshots still showed
the previous design, and the E2E filter step had been rewritten for the new
checkbox dropdown without being executed. Both are closed by this run.

All PostgreSQL work used the disposable `postgres:16-alpine` container
`toktickit-lab2-test-postgres` at `127.0.0.1:55432`, started from
`server/tests/lab-02/postgres/docker-compose.test.yml` with tmpfs storage and a
local-only synthetic password. The redacted targets were `toktickit_lab1_dev`
for Lab 1/application tests and `toktickit_lab2_test` for the guarded Lab 2
PostgreSQL suites and E2E. No Supabase, production database, real credentials,
PII, or binary Attachment data was used.

#### Executable gate

| Check | Command | Result |
| --- | --- | --- |
| Server regression | `cd server && NODE_ENV=test DATABASE_URL=<lab1_url> DIRECT_URL=<lab1_url> TEST_DATABASE_URL=<lab2_url> npm test` | **Pass** — 31 files, 674 tests, 0 skipped |
| Client regression | `cd client && npm test` | **Pass** — 10 files, 289 tests, 0 skipped |
| Client type check | `cd client && npx tsc --noEmit` | **Pass** — no diagnostics |
| Server build | `cd server && npm run build` | **Pass** |
| Client build | `cd client && npm run build` | **Pass** |
| Migrations and seed | `prisma migrate deploy` and `npm run prisma:seed` against both disposable databases | **Pass** — all migrations applied; seed reported 4 Categories, 7 Related Systems, 5 Development Requesters on each target |
| Pinned E2E/responsive/visual | `NODE_ENV=test TEST_DATABASE_URL=<lab2_url> npm run test:e2e` (Playwright 1.60.0) | **Pass** — 12 tests, 12 passed in 16.4 s: three E2E flows plus nine exact viewport cases |

The E2E run includes `E2E-01`, whose Category filter step now opens the checkbox
dropdown, ticks `Network`, and closes it before applying. That step was the
unverified item in the PR description; it passes against the real API and
database.

#### Client coverage added for the PR's UI changes

The branch's client suite grew from 258 cases on `lab2-staging` to 289: four
came with the PR's own commits, and the twenty-seven below were added in this
pass so every behaviour-bearing UI change carries a test.

| Area | Cases | Test file |
| --- | --- | --- |
| `MultiSelect` toggle labelling, tick/untick, option-order summary, outside-pointer dismissal | 4 | `tests/lab-02/SharedComponents.test.tsx` |
| Ordinal Badge meter: segments filled to level, `aria-hidden`, no meter without a level | 4 | `tests/lab-02/SharedComponents.test.tsx` |
| Visually hidden field label keeps the accessible name | 2 | `tests/lab-02/SharedComponents.test.tsx` |
| Pagination groups the summary counts but not the page buttons | 1 | `tests/lab-02/SharedComponents.test.tsx` |
| Filters control surface state, hidden search label and its input attributes, row Priority meter | 4 | `tests/lab-02/MyTickets.test.tsx` |
| Row Download busy state, `formatSize` units and trailing `.0`, the 413 limit message | 4 | `tests/lab-02/AttachmentSection.test.tsx` |
| Sidebar primary action placement and active swap, decorative brand mark | 3 | `tests/lab-02/ApplicationShell.test.tsx` |
| Ticket Information card region, control names and autofill opt-out | 2 | `tests/lab-02/CreateTicket.test.tsx` |
| Ticket Detail eyebrow above the ticket-number heading | 1 | `tests/lab-02/RequesterTicketDetail.test.tsx` |
| Requester Selection panel contents, decorative brand mark | 2 | `tests/lab-02/RequesterSelection.test.tsx` |

The new cases were checked against deliberate regressions rather than accepted
on a green run: eight source mutations (outside-click listener removed, meter
suppressed, `aria-busy` dropped, trailing `.0` restored, count grouping removed,
`visually-hidden` removed, applied-filter class removed) produced twelve
failures in exactly the intended cases, and the mutations were reverted before
the recorded run.

Purely presentational changes with no jsdom surface are not unit-tested and rest
on the browser assertions and the captures below: table column widths and
`table-layout`, outer-cell padding, toolbar layout, meter colours, the modal
container's focus outline, the list footer rule, page-stack spacing, the
`theme-color` meta tag, and responsive column hiding.

#### Regenerated visual evidence

All fifteen committed PNGs under `docs/lab-02/evidence/screenshots/` were
rebuilt by the same passing Playwright run and now show the current design:

| Screen | Captures |
| --- | --- |
| Create Ticket | `1440x900`, `820x1180`, `390x844`, each with an `-attachments` companion |
| My Tickets | `1440x900`, `820x1180`, `390x844` |
| Ticket Detail | `1440x900`, `820x1180`, `390x844`, each with an `-attachments` companion |

The captures carry the polish pass: the ticket-stub brand mark, the sidebar
`+ Create Ticket` primary action above the navigation list, uppercase
micro-labels on card titles, column headers and the Requester caption, the
three-segment Requested Priority meter, the hidden search label with its
magnifier, and Filters and Sort by together at the end of the toolbar row.

#### Closed observation

At 390 × 844 on Ticket Detail the Attachment row actions wrapped onto two lines:
the Select column made the Actions column narrower than on Create Ticket, and
`.tt-row-actions` kept `flex-wrap: wrap` for the download failure alert. The
Actions column now reserves `8rem`, enough for the three icon controls and their
gaps, while the existing wrap remains available for a download failure message.

The responsive E2E case now checks that every action button in the row has the
same rendered top coordinate. Before the fix it failed only at 390 × 844 with
`Expected: 1 / Received: 2`; after the fix all three Ticket Detail viewports
passed and the regenerated 390 × 844 capture shows one line.

| Check | Command | Result |
| --- | --- | --- |
| Ticket Detail responsive regression | `NODE_ENV=test TEST_DATABASE_URL=<lab2_url> npm run test:e2e -- e2e/lab-02/responsive-visual.spec.ts -g 'Ticket Detail and Attachments'` | **Pass** — 3 tests, 3 passed at `1440x900`, `820x1180`, and `390x844` |

## 16. Completion Rule

Lab 2 testing is complete only when:

1. every required planned automated test has a final result;
2. every `AC-01` through `AC-66` remains covered by at least one passing test or verified explicit delivery-evidence item;
3. required responsive and screenshot evidence has been captured;
4. required E2E flows pass;
5. all non-automated delivery evidence above is verified;
6. `tests.md`, `specification.md`, `api-spec.md`, and `ui-spec.md` remain mutually consistent.

If implementation architecture changes but externally observable behavior does not, filenames/class names may be updated to match the final code while preserving the same test responsibilities and AC traceability.
