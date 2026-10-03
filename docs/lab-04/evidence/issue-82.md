# Issue #82 role Dashboard evidence — 2026-10-02

Local implementation on `feature/82-role-dashboards`; initial working tree was clean. No commit, push, Issue/Project mutation, independent CI, peer-review acceptance, or final release acceptance is recorded. #83 retains the release/regression gates and the existing final E2E-01 placeholder.

## Implemented contracts

- `GET /api/users/me/dashboard?recentTicketsSize=N`: authenticated Requester only, immutable authenticated requester predicate and non-deleted Tickets; exact four metrics and compact recent DTO.
- `GET /api/dashboard?myActionsSize=N&recentTicketsSize=N&urgentTicketsSize=N`: Staff/Admin only; exact five workload metrics and three compact lists. Protected successes/errors retain the shared `Cache-Control: no-store` policy.
- Optional sizes default to 5 and accept every integer 1–20. Unknown Dashboard query fields, invalid bounds, fractional/non-numeric/non-scalar input are rejected with safe `400 VALIDATION_ERROR`. Existing login and password-change guards remain intact.
- Each endpoint reads counts and lists in one Prisma interactive PostgreSQL `RepeatableRead` transaction. Recent ordering is `updatedAt DESC, id DESC`. Urgent reads two disjoint owner groups, each with query-side `take=N`, then returns the first N rows, with unassigned before assigned and `createdAt ASC, id ASC` within each group.
- My Actions reads top N from each of four disjoint lifecycle groups with the matching event timestamp and `id DESC`, then merges at most 4N rows and returns N. The disjoint groups contain the global top N; the OR assignee/performer predicate does not duplicate rows. This avoids unsupported Prisma CASE ordering and unbounded collection reads. Deleted parent Tickets are excluded; terminal Ticket parents otherwise remain eligible for My Actions.
- `/dashboard` is the guarded home after login/root bootstrap for every role. Dashboard is the first sidebar list item, while Requester Create Ticket remains prominent. Staff/Admin reuse one component. Dashboard tables reuse DataTable with its toolbar/pagination disabled and its existing role-aware row links; size controls offer 5/10/20 and update Dashboard URL state.
- Requester cards reuse My Tickets status URL state; operational cards use existing REST QueryBuilder JSON filters in Queue URL state. Queue now reads/writes those filters so drill-downs reach filtered authoritative API results. Earlier-lab role-home fixtures/assertions intentionally evolve to `/dashboard`; their original list/workflow scenarios remain covered through explicit navigation.
- Timed refresh uses a shared single-flight request across remounts and User/role/query transitions. Timer/manual triggers do not queue or abort work. Hidden documents pause scheduling; visibility return revalidates immediately and restarts the schedule. A new scope's initial load waits for the previous scope's request to finish and ignores its result.
- Successful DTOs stay only in module memory, keyed by User public ID, role, Dashboard URL query and endpoint/list-size state. Fresh cache age <=30 seconds, including exactly 30 seconds, renders immediately; stale cache renders during revalidation. Late responses cannot update/cache an abandoned scope. Same-scope remount can share an active refresh and accept its success without another HTTP request.
- Last Updated retains the original accepted success time. Initial failures use safe ErrorState/Retry; background failures retain DTO/time and a warning with Retry, including while retry is pending. Accepted success clears the warning and swaps data/time. Existing content stays visible during refresh. No persistent Dashboard storage or HTTP browser cache is used. Audit/event table timestamps reuse `ticketDateTime` rather than hiding time of day.

## TDD and regression observations

Valid Red evidence preceded production changes: Requester route returned 404; size 1 still queried size 5; operational endpoint returned 404; authenticated home lacked Dashboard; role cards were absent; timer made no second request; hidden polling continued; fresh/exact-boundary remount lost successful content; same-scope active-refresh remount did not accept completion; pending retry cleared the warning; compact desktop Action links were absent; audit timestamps omitted time; explicit User summary mapping exposed extra synthetic fixture fields.

Green checks passed after the corresponding minimal changes. Unit helpers were subsequently covered alongside their API boundary; PostgreSQL tests independently verify the already implemented endpoint behavior, rather than treating mock predicates as DB proof. Initial Supertest execution hit sandbox `listen EPERM`; approved local-listener execution established the real route Red/Green. Failed fixtures/compilation/environment errors were not counted as Red evidence.

Browser harness corrections: install the Playwright clock before application timers are created; remount the same URL scope via browser Back; measure all card layout offsets in one browser turn rather than separately sampling the page-enter/hover transforms. The real browser desktop-link failure received a permanent UI regression and an existing DataTable configuration fix. No assertions were removed and no new skips were added.

## Executed validation

Commands below were executed with the repository's installed dependencies. PostgreSQL and real-server browser commands used a dedicated fresh database inside the existing disposable Lab 3 test container, with captured development baselines and all five guard variables set. Both `DATABASE_URL` and `DIRECT_URL` were explicitly the test target. Read-only `prisma migrate status` confirmed `127.0.0.1:55433`, the dedicated `toktickit_lab3_dashboard_test_<suffix>` database, seven migrations, and schema up to date. Existing databases were not reset/dropped and shared Supabase was not written.

| Command | Observed result |
|---|---|
| `npm --prefix server test -- tests/lab-04/DashboardQueryValidator.test.ts tests/lab-04/requester-dashboard.api.test.ts tests/lab-04/staff-dashboard.api.test.ts` | 3 files / 11 tests passed: UNIT-05–06, API-17–18, API-23. |
| `npm test -- --exclude '**/postgres/**'` in `server/` | 65 files / 1,270 tests passed. This excludes guarded PostgreSQL suites; it is not a full database regression claim. |
| `npm test -- tests/lab-04/postgres/dashboards.postgres.test.ts` in `server/`, guarded fresh target | 1 file / 4 tests passed: PG-12 empty/nonzero fixture comparison and separate Requester/operational concurrent-write snapshot proofs. |
| `npm --prefix client test -- tests/lab-04/RequesterDashboard.test.tsx tests/lab-04/StaffDashboard.test.tsx tests/lab-04/DashboardRefresh.test.tsx` | 3 files / 14 tests passed: UI-08–11, UI-14–16, Dashboard accessibility/role paths and audit times. |
| `npm test` in `client/` | 38 files / 443 tests passed, including evolved earlier-lab home/error tests and existing DataTable/Queue consumers. |
| `ISSUE_3_UI_ONLY=1 npm run test:e2e -- e2e/lab-04/responsive-visual.spec.ts --grep 'RESP-0[12]'` | 9 tests passed: Requester, Staff, Administrator at 1440x900, 820x1180, 390x844, each with zero/nonzero captures. |
| `npm run test:e2e -- e2e/lab-04/dashboards.spec.ts e2e/lab-04/actions-taken-flow.spec.ts e2e/lab-04/ticket-resolution.spec.ts e2e/lab-03/authentication.spec.ts`, guarded target | 12 tests passed / 1 pre-existing #83-owned skip. Includes E2E-03, every Dashboard metric drill, compact Ticket/Action navigation, size choices, cache/visibility/refresh failure recovery, and affected auth/workflow regressions. |
| `npm --prefix client run build` | TypeScript and Vite production build passed. Existing dependency annotation and chunk-size warnings remain. |
| `npm --prefix server run build` | Server/application/test TypeScript build passed. |
| `git diff --check` | Passed. Neither application package defines a lint script; no lint tool/dependency was added. |

The fake-timer/deferred suite includes 29,999/30,000/30,001 ms cache ages, skipped pending ticks, disabled manual refresh, un-aborted requests, initial/background failures, retained warnings during retry, visibility return during an active request, independent User/role/URL scopes, abandoned late responses, shared remount flights, and absence of persistent storage writes.

## Independent DB comparison

The isolated empty fixture has all Requester and operational metrics zero and every list empty. The nonzero fixture explicitly includes an assigned HIGH-priority RESOLVED Ticket in workload counts/lists, spans all eight Ticket statuses, both owner groups, different Requesters, deleted parents, HIGH/LOW IT Priority, every Action lifecycle, both matching Action ownership predicates, and timestamp ties.

| Fixture role | Expected metrics | Compact list comparison |
|---|---|---|
| Requester | Active 6; Waiting 1; Resolved 1; Closed 1 | Own recent top 7 exactly matches independent SQL `updated_at DESC,id DESC LIMIT 7`, including own terminal Tickets. Foreign/deleted rows excluded. |
| Staff | Unassigned 4; My Assigned 4; In Progress 1; Waiting 2; High 5 | Non-terminal recent 8; urgent HIGH 5; My Actions top 20 of 22 eligible unique rows. Every ID and Action event timestamp matches independent SQL, including CASE ordering and deterministic ties. |
| Administrator | Unassigned 4; My Assigned 0; In Progress 1; Waiting 2; High 5 | Same recent/urgent sets; zero My Actions for this fixture. Same shared service/DTO. |

Smaller independent bounds (Actions 1, recent 2, urgent 3) preserve metrics and match prefixes of the independently verified larger lists. Concurrent-write tests intercept after the first actual count, verify `SHOW transaction_isolation` is `repeatable read`, commit a Ticket status/priority/summary change through a second real Prisma client, and assert the entire in-flight DTO equals the before-write snapshot. A subsequent Dashboard request sees the committed change and increments Waiting by one.

## Local artifacts and remaining gates

- [Verification logs](../../../artifacts/lab-04/verification/): final API, PostgreSQL, client/server regression, browser and build output, with credential-bearing URLs redacted.
- [Screenshots](../../../artifacts/lab-04/screenshots/): `requester-dashboard/`, `staff-dashboard/`, `admin-dashboard/`, `dashboard-tables/`, `dashboard-zero/`, `dashboard-drill-downs/`. Includes all required viewport sizes, every Requester/operational metric drill, Ticket/Action detail and background failure.
- [Real-server browser HTML report](../../../artifacts/lab-04/dashboard-e2e-report/) preserved separately from the existing Playwright report output path.

Artifacts are generated local evidence and remain git-ignored. The whole #83 database/browser/release matrix, independent new-head CI, VIS-01/UI-13 beyond Dashboard contributions, and peer review were not claimed here. No schema/migration/dependency/deployment change or production latency/SLA claim was introduced. Changed-file inspection found no real credentials or production data; fixtures use synthetic example.test identities. All feature/test/documentation changes remain uncommitted for review.

## Scrutiny fixes — 2026-10-02

The supplied review request and subsequent `fix` exposed two gaps: a pending request could be accepted after leaving its User/role/URL context and returning to the same scope string; initial loading rendered four stacked placeholders without role-specific metric/table layout.

Two test-first cycles in `DashboardRefresh.test.tsx` established valid Red results before production fixes. Three independent URL/User/role round-trip cases rendered the abandoned count 99, failing late-response rejection. A permanent obsolete flag now retires a flight on a context change, even when that scope returns. Initialization waits for its completion without aborting or overlapping requests, then fetches the current scope. Same-scope remount sharing remains covered and passing. These regressions also verify that the abandoned success does not create Last Updated, and that only the current accepted success is reused on remount.

Three role-loading cases failed because the Dashboard metrics group was absent. Requester and shared Staff/Admin now supply a common role-specific skeleton layout with four/five labeled metric cards and one/three table sections. Headers reuse the actual compact-list columns; skeleton rows follow the bounded selected size, and mobile/tablet cards use the same desktop breakpoint as DataTable. Successful content is still retained during background refresh. The loading regressions verify default top-five rows, disabled Refresh and replacement on success.

Validation executed for these fixes:

- `npm --prefix client test -- tests/lab-04/DashboardRefresh.test.tsx`: 14 tests passed after the flight fix, including the three new round-trip regressions and existing same-scope remount checks.
- `npm --prefix client test -- tests/lab-04/DashboardRefresh.test.tsx tests/lab-04/RequesterDashboard.test.tsx tests/lab-04/StaffDashboard.test.tsx`: 3 files / 20 tests passed after both fixes.
- `npm --prefix client test`: 38 files / 449 tests passed.
- `ISSUE_3_UI_ONLY=1 npm run test:e2e -- e2e/lab-04/responsive-visual.spec.ts --grep 'RESP-0[12]'`: 18 mocked browser tests passed. Nine new delayed-response loading cases and nine existing zero/nonzero cases cover Requester, Staff and Administrator at 1440x900, 820x1180 and 390x844. All loading cases verify no page overflow and successful replacement; screenshots are under `artifacts/lab-04/screenshots/dashboard-loading/`. Staff desktop and Requester mobile captures were visually inspected.
- `npm --prefix client run build` and `npm --prefix server run build`: passed. Existing client dependency-annotation/chunk-size warnings remain.
- `git diff --check`: passed. Neither package defines a lint script.

No backend endpoint, Prisma model, database, dependency or persistent-storage changes were made in this follow-up. PostgreSQL and real-API E2E suites were not rerun for these client fixes; prior feature evidence above remains historical. Pre-existing work is preserved. No commit, push, GitHub edit, independent CI, peer-review acceptance or #83 release acceptance is claimed.

## Compact-table sorting fix — 2026-10-03

The current-session scrutiny found that Dashboard column headers inherited DataTable's sortable default. Clicking a header updated its arrow and `aria-sort`, but DataTable rendered externally supplied rows in unchanged server order. A temporary review reproduction confirmed `Zulu, Alpha` remained unchanged while Summary announced ascending order; that probe was removed.

The authorized fix uses the existing `sortable: false` column option in the shared Dashboard `CompactTable` wrapper. This removes sorting controls for Requester Recently Updated and all three Staff/Admin tables while preserving backend-defined top-N order. DataTable's other consumers, REST APIs and Prisma behavior are unchanged.

Permanent coverage adds a Requester nonzero two-row case and extends both operational-role cases to verify headers have no sorting announcement or keyboard tab stop, including after clicking. The Requester test also checks that the supplied `Zulu, Alpha` order remains unchanged. An initial Requester test run caught the loading skeleton rather than successful content; that test synchronization error was corrected before recording Red. The next run failed all three role checks on unexpected `aria-sort="none"`, establishing valid Red before production changes.

Executed Green/final checks:

- `npm --prefix client test -- tests/lab-04/RequesterDashboard.test.tsx tests/lab-04/StaffDashboard.test.tsx tests/lab-04/DashboardRefresh.test.tsx tests/lab-03/DataTable.test.tsx`: 4 files / 32 tests passed.
- `npm --prefix client test`: 38 files / 450 tests passed. Existing React act warnings remain in unrelated tests.
- `npm --prefix client run build`: TypeScript/Vite passed with existing dependency annotation and chunk-size warnings.
- `npm --prefix server run build`: passed.
- `git diff --check`: passed.

No package defines a lint script. PostgreSQL, browser and screenshot suites were not rerun for this localized header change. Existing uncommitted work remains intact; no commit, push, GitHub mutation or release acceptance is claimed.

## PG-12 fixture isolation fix — 2026-10-03

The supplied CI output reported two failures: the empty database contained one Ticket and the operational Unassigned count was five instead of four. PG-12 uses global database counts, while `actionDatabase()` deploys migrations and adds fixtures without removing rows left by earlier suites. Randomized users isolate Requester counts but cannot isolate operational totals.

Reproduction used a newly created disposable `toktickit_lab3_dashboard_debug_test` database in the local test container, with explicit `TEST_DATABASE_URL`, `DATABASE_URL`, `DIRECT_URL` overrides and distinct captured baseline targets. The unchanged focused suite passed all four tests on its first run. Repeating the exact command without clearing fixtures failed the same two assertions: 13 Tickets instead of zero and 10 Unassigned instead of four. This rules out a dashboard query defect and demonstrates dependence on prior database contents.

The suite now calls the existing `resetTestSchema(assertLab3TestDatabase())` before `actionDatabase()`. The Lab 3 guard verifies test mode, explicit matching overrides, dedicated lab3/test database markers and a target distinct from both baselines before schema reset. The existing sequential server test script prevents file-level concurrency. The reset is confined to the guarded disposable target; production endpoints, dashboard calculations, Prisma schema and migrations are unchanged. All existing metric, independent SQL, ordering, bound, deduplication and concurrent snapshot assertions remain intact; no expectations were weakened and no new tests were needed.

After the setup fix, the same four regression tests passed on the already contaminated target. Both `npm --prefix server run build` and `npm --prefix client run build` passed; existing client annotation/chunk warnings remain. Neither package defines a lint script. Broader validation results follow below.

Final validation: guarded `npm test` from `server/` passed 94 files / 1,448 tests, including all PostgreSQL suites and PG-12 after preceding suites. `git diff --check` passed. Client/browser tests were not rerun for this test-setup-only change. No commit, push, GitHub edit, independent CI, peer-review or release acceptance is claimed.

## Published Head / CI Verification — 2026-10-03

Published PR #89 head: `5c193ad2a7d96f124f3fb7c69a019025b458dbcc` on `feature/82-role-dashboards`, targeting `lab4-staging`.

[GitHub Actions run 37092458934](https://github.com/oangsa/TokTickIT/actions/runs/37092458934) completed successfully for this exact SHA. Both job statuses, their build/whitespace steps, and the test logs were inspected during this evidence synchronization:

- Server: 94 files / 1,448 tests passed, including all four corrected PG-12 Dashboard PostgreSQL tests after preceding PostgreSQL suites.
- Client: 38 files / 450 tests passed.
- Browser: 102 discovered, 101 passed / 1 skipped. Lab 4 E2E-03 and the 18 Dashboard RESP-01–02 cases passed. The sole skip is `E2E-01 final integrated Ticket/Action workflow — #83 after #81 Activity integration`.
- Server TypeScript build and client TypeScript/Vite build: passed.
- Committed-diff whitespace: `git diff --check HEAD^ HEAD` passed.

Completed #82-owned evidence: UNIT-05–06, API-17–18, API-23, PG-12, UI-08–11, UI-14–16, RESP-01–02, and E2E-03. Historical local Red/Green, zero/nonzero SQL comparisons, concurrent-write proof, drill-down and screenshot evidence above remain unchanged.

This verifies #82-owned acceptance evidence; #83 retains final integrated workflow, whole-release regression/visual/accessibility acceptance, and release gates. CI success does not claim peer-review acceptance, merge, or Issue closure.

This documentation-only follow-up records existing CI execution; application tests and builds were not rerun locally and no new Red/Green cycle was needed. No application, API, Prisma, database, dependency or deployment changes were made. The local evidence and AI-use updates remain uncommitted; no commit or push was authorized.

Authorized GitHub synchronization completed: [Issue #82](https://github.com/oangsa/TokTickIT/issues/82) now has nine Scope and three supported Definition-of-Done checks complete and all 16 owned test rows marked Pass; [PR #89](https://github.com/oangsa/TokTickIT/pull/89) now records the exact published-head CI results above. Both bodies were confirmed unchanged before editing and verified by exact read-back afterward. Both remain open, the PR head remains the verified SHA, and no #83 record or release gate was modified.

Subsequent `commit, push` authorization covers only these evidence and AI-use documents. The no-publication statements above describe the earlier synchronization checkpoint. CI results remain attributed to `5c193ad2a7d96f124f3fb7c69a019025b458dbcc`; they do not claim verification of the subsequent documentation commit. No application tests or builds were rerun for this documentation-only publication.
