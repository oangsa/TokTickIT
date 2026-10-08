# Issue #83 final integration verification

Execution date: 2026-10-07. Branch:
`feature/83-lab4-final-verification-release`, integrated base
`1ee0b17` (PR #89 merge; `origin/lab4-staging`). The worktree was clean before
verification. This record describes the local candidate, not an accepted
staging-to-main release. Independent #83 review, actual #77 final approval and
post-merge staging-head verification remain release blockers; see
[reviewer.md](../reviewer.md). No product defect requiring a source change was
found. No feature endpoint, migration, schema, role, permission or screen changed.

## Environment and safe target preflight

Node 24.18.1; PostgreSQL 16 in a task-owned, volume-free Docker container
`toktickit-issue83-pg`; pinned Playwright 1.60.0 / Chromium 1223. Targets, without
credentials:

| Purpose | Host / database |
|---|---|
| Full server / guarded PG | `127.0.0.1:55483/toktickit_lab3_test` |
| Real browser | `127.0.0.1:55483/toktickit_lab3_browser_final_test` |
| Dedicated PERF-01 | `127.0.0.1:55483/toktickit_lab3_perf_test` |

The actual normal DATABASE_URL and DIRECT_URL baselines were captured privately
before setting NODE_ENV=test, TEST_DATABASE_URL, DATABASE_URL and DIRECT_URL to
each disposable target. No baseline, password, cookie, token or connection
credential is included here. Every Prisma write target was checked first with
`npx --no-install prisma migrate status`; its reported host/database matched the
table. Status initially reported pending committed migrations, then
`npx --no-install prisma migrate deploy` applied all seven migrations. Shared
development/Supabase data was not written. PERF-01 has an additional opt-in and
`_perf_test` suffix guard and resets only its disposable schema.

## Executed commands and results

Use the private guarded environment above. For server tests set
`CORS_ALLOWED_ORIGINS=http://localhost:5173`; Playwright sets its API origin to
`http://127.0.0.1:5173`. These are distinct test contexts. No package defines a
lint script. Existing Prisma/pg parallel-client deprecation warnings were observed;
no dependency change or suppressed warning is claimed. Both builds include TypeScript checking.

| Working directory / exact command | Observed result | Committed output |
|---|---|---|
| server / `npm test` | 1,449 passed; 95 passed files plus one intentionally skipped four-case dedicated PERF file. All normal guarded PG suites executed. | [results](issue-83-results.txt) |
| client / `npm test` | 455 passed, 38 files. | [results](issue-83-results.txt) |
| server / `npm run build` | Pass (`tsc`). | [results](issue-83-results.txt) |
| client / `npm run build` | Pass (`tsc && vite build`); existing 590.94 kB main-chunk warning, not a failure. | [results](issue-83-results.txt) |
| root / `npm run test:e2e` | 110 passed, zero skips (3.8 min). No #83 journey is skipped. | [results](issue-83-results.txt) |
| server / `PERF01_RUN=1 npm test -- tests/lab-04/postgres/performance-smoke.postgres.test.ts` | 4 passed; mandated counts and unchanged 2,000 ms ceiling. | [results](issue-83-results.txt) |
| root / `npm run test:e2e -- e2e/lab-04/release-quality.spec.ts` | 9 passed (three roles × three viewports), real API/PG. | [screenshots](../../../artifacts/lab-04/screenshots/final/manifest.md) |
| server / `npm test -- tests/lab-04/postgres/security-bypass.postgres.test.ts` | 1 passed, real persisted sessions and database. Repeated in full suite. | [results](issue-83-results.txt) |
| client / `npm test -- tests/lab-04/Accessibility.test.tsx` | 11 passed; repeated in full suite. | [results](issue-83-results.txt) |
| root / `git diff --check` | Pass; final scope/credential inspection described below. | This record |

Full-suite file-level summaries in the output record establish reruns of all
#78–#82 focused gates: foundation/schema/migration/seed; Actions/lifecycle/races/
idempotency/Attachment/Activity; CommonForm/Lookup; Ticket workflow/resolution/
reopen/atomicity; Dashboard real snapshot and refresh/cache tests. Mocked API
and UI cases do not stand in for the real PostgreSQL suites.

## Complete migration and recovery acceptance: AC-34–35

`server/tests/lab-04/postgres/migration-upgrade.postgres.test.ts` executed both
transaction rollback and actual Prisma failed-migration recovery. Each fixture
starts at committed Lab 3 schema with two humans, four Tickets (RESOLVED, CLOSED,
CANCELLED, OPEN), one Attachment with preserved bytes, one Public Comment, one
Internal Note, two Ticket-create idempotency records, and their exact IDs,
relations and timestamps. Full row snapshots remain equal after the approved
schema additions/renamed idempotency actor projection are accounted for.

Successful upgrade and recovered/repeated deployment produce exactly one
inactive internal SYSTEM User, four truthful SYSTEM-authored snapshots, two
synthetic COMPLETED Actions only for old RESOLVED/CLOSED, approved historical
timestamps, `isMigrated=true`, null assignee/performer and none for the other
Tickets. Runtime services are then called against these actual migrated rows:
Requester reopen succeeds, migrated-only Mark Resolved fails with
`INVALID_STATUS_TRANSITION`, a real non-migrated Action is created/started/
completed, and resolution succeeds. Synthetic history is unchanged. This is
actual service/PG behavior after recovery, not a mocked transaction or a SQL
eligibility predicate.

The recovery case faults only a disposable copy of migration SQL, observes
P3018 and failed migration status, verifies rollback preserved the fixture,
restores the committed SQL copy, marks the verified rolled-back attempt
`--rolled-back`, retries deploy, inspects checksum/state and repeats deployment.
Committed/applied repository migration files are never rewritten. The frozen
expected results are unchanged. Fresh empty databases also deployed all seven
committed migrations before server/browser execution.

`seed-idempotency.postgres.test.ts` executes seed twice and asserts identical
logical counts: 12 seeded humans, 8 Tickets, 4 named Actions, 2 migrated legacy
Actions, 4 named Activities, 1 SYSTEM User and 1 empty-Ticket Requester. Password
provisioning leaves SYSTEM and already provisioned credentials unchanged.
Preserved Lab 2 persistent Ticket-create idempotency and all its race/replay
regressions also ran in the complete server suite.

#78 supplies foundation preservation/recovery; #79 API-03 supplies visible
`isMigrated` DTOs; #80 UI-04 supplies readable historical display; #81 API-15 /
PG-11 / PG-15 / E2E-02 supplies real resolution exclusion. #83 reconciles and
executes them together here. Complete PG-02, PG-13 and DATA-02 can now be Pass
for this executed local candidate. Historical Blocked statements in feature
checkpoint records remain historically true and are superseded only by this
execution, not by dependency closure.

## Direct API security and recovery

The additional `security-bypass.postgres.test.ts` uses the real Express app,
persisted sessions, signed synthetic tokens and actual PG rows. It checks:

- unauthenticated access, all three roles, own/cross-Requester/cross-Ticket Action
  boundaries, safe indistinguishable 404s and Requester read-only behavior;
- Administrator role alone cannot bypass Ticket Owner or Action authority;
- SYSTEM cannot authenticate even with an explicitly constructed persisted
  session/token and never appears in assignable Lookup;
- Active same-Ticket Attachment preview succeeds; cross-Ticket preview and
  Pending/Removed/cross-Ticket Action associations return safe 404;
- private notes and Ticket/Action Activity are unavailable to Requesters;
- no public Activity POST/PATCH/DELETE route exists; denied/read calls append
  no business Activity, while the one permitted Start appends exactly one;
- no-store and request correlation headers on success/error; no stack, raw
  Prisma, password/refresh hash or database URL in responses;
- requestLog emits only method/route/status/requestId/durationMs/errorCode,
  without bodies, authorization, personal details or private note content.

The existing API/unit/PG regressions cover validation, stale conflicts,
replay-before-stale, exact Ticket/Action identity isolation, transaction rollback,
resolution races and owner cleanup. Client/E2E coverage executes retained-input
retry, invalid transition feedback, background Dashboard failure retaining its
last good data, no re-skeleton/persistent Refreshing indicator, exact 30-second
cache boundary, single-flight/hidden-visible scheduling, late-response isolation
and no Web Storage/service-worker cache. Source inspection found no Dashboard
storage API and no unfinished Action/Dashboard/Lookup product control.

## Performance (PERF-01)

The dedicated job uses 1,000 non-SYSTEM Users, 100,000 Tickets, 300,000 Actions,
500,000 typed Activities and 1,000 Attachment joins containing four-byte payloads.
Static set-based SQL through Prisma prepares the disposable dataset; parent and
typed Activity detail inserts commit together in bounded batches with constraints
enabled. No ordinary unit run generates it. ANALYZE precedes excluded warmup.

All four actual service probes return at most 20 rows per collection, with
page-two Action/Activity pagination. Query-side LIMITs bound primary reads;
Prisma relation hydration uses bounded IN batches (at most 100 placeholders),
not per-row N+1 reads. Fixed SELECT budgets derive from the actual relation graph:
Requester 5, Staff 30, Action 7, Activity 14. Final warmed probes were Requester 11 ms / 5 SELECTs, Staff 96 ms / 30,
Action 10 ms / 7 and Activity 12 ms / 14 (183.14 s including dataset setup).
The final timing/count output is in
[issue-83-results.txt](issue-83-results.txt). Ceiling remained 2,000 ms per warmed
probe. This proves a local gross-regression gate, not a production SLA or an
unexecuted hosted CI performance claim. The Action detail additionally exercises
an Attachment join and asserts its DTO excludes binary data.

## Accessibility and visual checklist (UI-13 / VIS-01)

The real browser `release-quality.spec.ts` executes each role at 1440×900,
820×1180 and 390×844. It captures 69 PNGs under the handout-required committed
`artifacts/lab-04/screenshots/final/` path. Manifest lists every path, dimensions
and SHA-256. Dashboard/Ticket Actions/Action Detail have all three roles;
Create/Edit/Complete/Cancel/Lookup/Ticket Activity/Action Activity have Staff and
Admin. Requester mutation/Activity controls are correctly absent.

| Check | Executed evidence |
|---|---|
| Semantic names, associated errors, disabled field semantics | 11 Accessibility component tests plus existing CommonForm/Lookup suites |
| Card links keyboard reachable, visible focus, readable non-color statuses | component assertions and keyboard Tab/Shift-Tab browser checks |
| Nested Lookup keyboard selection and focus return; Edit Escape focus restoration | real browser tests at all viewports plus existing modal trapping tests |
| Modal bounds and page horizontal scrolling | assertions for every captured screen |
| Reduced motion | browser media emulation, matching preference and computed no-animation/no-sidebar-transition assertions |
| DataTable/Lookup/timeline operations | existing full component/browser suites and real API E2E-01 |
| Console/runtime errors | no pageerror throughout; no console error after successful authenticated bootstrap on captured screens |
| Zen Green, legibility, overlap and required controls | inspected desktop Admin Dashboard/Edit, tablet Admin Lookup/Requester Ticket Actions, mobile Requester Dashboard/Create/Staff Activity PNGs; automated viewport/bounds assertions across all 69 |

The expected anonymous login-bootstrap refresh 401 is excluded from the
post-login console check and is not represented as an authenticated screen
failure. Screenshots contain synthetic identities only and no credentials.
Vertical pages scroll normally; captures of Activity and Actions intentionally
scroll to the section, while dialogs fit within the viewport.

## Changes, failures and scope inspection

E2E-01 now actually claims/opens a Ticket, starts work, creates an Action, selects
an assignee, confirms Start, edits description/Attachment Notes, associates an
existing eligible Attachment, completes, inspects both histories and verifies
Requester read-only detail. Database assertions verify final version/performer,
attachment linkage and exactly expected Activities. The former #83 skip was
removed. Accessibility adds card keyboard/link naming and four textual status
cases. Additional security, dedicated PERF and real visual files supplement
existing tests without removing assertions or changing product behavior.

Observed setup/harness failures were resolved openly: server CORS was initially
127.0.0.1 while frozen tests expect localhost (eight failures, corrected env and
full rerun); performance synthetic Ticket numbers needed 12 digits and UUIDs
needed the public v4 shape; query budgets needed to count legitimate bounded
relation queries; browser selectors needed actual Keep Action text and Lookup
search debounce; keyboard modality needed genuine Tab before focus-visible.
The initial fixture import into Playwright referenced Vitest internals and was
replaced with plain fixture data. A repeated full browser run failed 14 seeded Requester logins because earlier
server reseeding changed the shared ignored seed credential file while the
browser database retained its prior password hashes. A fresh guarded browser
database and no concurrent seed writers remove this setup conflict; no auth
checks or assertions were bypassed. No valid product expectation, dataset size,
ceiling, permission or frozen migration assertion was weakened. No production
Red/Green fix cycle is claimed because no production behavior changed.

Historical Lab 2/3 screenshot recaptures were restored to their original tracked
bytes; generated builds, credentials, reports and recovery copies stay ignored.
Changed-file/staged scope, whitespace, suspicious credential patterns and
frontend secret/storage use are inspected before publication. README now gives
actual setup/run/migrate/seed/test/demo commands; reviewer and selected AI prompt
records describe actual evidence and pending approvals. No fabricated review,
Issue closure, GitHub mutation, release PR or push was part of the initial
verification checkpoint. Authorized feature publication is recorded below.

## AC-to-code-to-test-to-execution matrix

The source/test/lock/config fingerprint in the output record identifies the
validated code independent of documentation commits. The record contains
pre-commit outputs; a final rerun at the commit is reported separately.

Every planned UNIT-01–11, API-01–23, PG-01–16, UI-01–18, RESP-01–03, VIS-01,
E2E-01–03, DATA-01–04, PERF-01 and REG-01–03 is reconciled here and in tests.md.
File-level executions are in issue-83-results.txt; paths below are repository
relative. Pass means local candidate execution; the final review/release gate
is separate.

| AC | Implemented code | Frozen planned Test IDs | Executed evidence / result |
|---|---|---|---|
| AC-01 | `server/src/services/actionTakenService.ts; client/src/modules/Actions/` | UNIT-02, API-01, PG-01, E2E-01 | Local Pass: issue-83-results.txt (server/client/browser). |
| AC-02 | `server/src/services/actionTakenService.ts; client/src/modules/Actions/` | UNIT-02, API-02, UI-02 | Local Pass: issue-83-results.txt (server/client/browser). |
| AC-03 | `server/src/services/actionTakenService.ts; client/src/modules/Actions/` | UNIT-07, API-03 | Local Pass: issue-83-results.txt (server/client/browser). |
| AC-04 | `server/src/services/actionTakenService.ts; client/src/modules/Actions/` | API-04, E2E-01 | Local Pass: issue-83-results.txt (server/client/browser). |
| AC-05 | `server/src/services/actionTakenService.ts; client/src/modules/Actions/` | API-05, UI-01 | Local Pass: issue-83-results.txt (server/client/browser). |
| AC-06 | `server/src/services/actionTakenService.ts; client/src/modules/Actions/` | UNIT-03, UNIT-08, API-06, API-19, PG-04, UI-03 | Local Pass: issue-83-results.txt (server/client/browser). |
| AC-07 | `server/src/services/actionTakenService.ts; client/src/modules/Actions/` | UNIT-01, API-07, UI-04 | Local Pass: issue-83-results.txt (server/client/browser). |
| AC-08 | `server/src/services/actionTakenService.ts; client/src/modules/Actions/` | UNIT-01, API-07, PG-03, E2E-01 | Local Pass: issue-83-results.txt (server/client/browser). |
| AC-09 | `server/src/services/actionTakenService.ts; client/src/modules/Actions/` | UNIT-01–02, API-08, PG-03, E2E-01 | Local Pass: issue-83-results.txt (server/client/browser). |
| AC-10 | `server/src/services/actionTakenService.ts; client/src/modules/Actions/` | UNIT-01–02, API-09, PG-03, E2E-01 | Local Pass: issue-83-results.txt (server/client/browser). |
| AC-11 | `server/src/services/actionTakenService.ts; client/src/modules/Actions/` | UNIT-01, API-10, PG-03, UI-04 | Local Pass: issue-83-results.txt (server/client/browser). |
| AC-12 | `server/src/services/actionTakenService.ts; client/src/modules/Actions/` | API-10, PG-05, UI-05 | Local Pass: issue-83-results.txt (server/client/browser). |
| AC-13 | `server/src/services/actionTakenService.ts; client/src/modules/Actions/` | PG-06 | Local Pass: issue-83-results.txt (server/client/browser). |
| AC-14 | `server/src/services/actionTakenService.ts; client/src/modules/Actions/` | UNIT-10, API-11, PG-07 | Local Pass: issue-83-results.txt (server/client/browser). |
| AC-15 | `server/src/services/actionTakenService.ts; client/src/modules/Actions/` | UNIT-10, API-11, PG-07 | Local Pass: issue-83-results.txt (server/client/browser). |
| AC-16 | `server/src/services/actionTakenService.ts; client/src/modules/Actions/` | API-12, PG-08 | Local Pass: issue-83-results.txt (server/client/browser). |
| AC-17 | `server/src/services/actionTakenService.ts; client/src/modules/Actions/` | API-13, PG-09, E2E-01 | Local Pass: issue-83-results.txt (server/client/browser). |
| AC-18 | `server/src/services/actionTakenService.ts; client/src/modules/Actions/` | API-13, PG-09 | Local Pass: issue-83-results.txt (server/client/browser). |
| AC-19 | `server/src/services/ticketActivityService.ts; client/src/modules/Actions/ActivityTimeline.tsx` | PG-10, E2E-01 | Local Pass: issue-83-results.txt (server/client/browser). |
| AC-20 | `server/src/services/ticketActivityService.ts; client/src/modules/Actions/ActivityTimeline.tsx` | UNIT-09, API-14, PG-10, UI-06, E2E-01 | Local Pass: issue-83-results.txt (server/client/browser). |
| AC-21 | `server/src/services/ticketWorkflowService.ts; client/src/modules/Tickets/` | UNIT-04, API-15, PG-11, E2E-02 | Local Pass: issue-83-results.txt (server/client/browser). |
| AC-22 | `server/src/services/ticketWorkflowService.ts; client/src/modules/Tickets/` | UNIT-04, API-15, PG-11, E2E-02 | Local Pass: issue-83-results.txt (server/client/browser). |
| AC-23 | `server/src/services/ticketWorkflowService.ts; client/src/modules/Tickets/` | UNIT-04, API-15, PG-11, E2E-02 | Local Pass: issue-83-results.txt (server/client/browser). |
| AC-24 | `server/src/services/ticketWorkflowService.ts; client/src/modules/Tickets/` | UNIT-09, API-14, API-16, PG-10, UI-06, E2E-02 | Local Pass: issue-83-results.txt (server/client/browser). |
| AC-25 | `server/src/services/ticketWorkflowService.ts; client/src/modules/Tickets/` | API-16, UI-07, E2E-02 | Local Pass: issue-83-results.txt (server/client/browser). |
| AC-26 | `server/src/services/dashboardService.ts; client/src/modules/Dashboard/` | API-17, PG-12, E2E-03 | Local Pass: issue-83-results.txt (server/client/browser). |
| AC-27 | `server/src/services/dashboardService.ts; client/src/modules/Dashboard/` | API-17, UI-08, E2E-03 | Local Pass: issue-83-results.txt (server/client/browser). |
| AC-28 | `server/src/services/dashboardService.ts; client/src/modules/Dashboard/` | API-18, PG-12, E2E-03 | Local Pass: issue-83-results.txt (server/client/browser). |
| AC-29 | `server/src/services/dashboardService.ts; client/src/modules/Dashboard/` | UNIT-05, API-18, PG-12, UI-09 | Local Pass: issue-83-results.txt (server/client/browser). |
| AC-30 | `server/src/services/dashboardService.ts; client/src/modules/Dashboard/` | PG-12 | Local Pass: issue-83-results.txt (server/client/browser). |
| AC-31 | `server/src/services/dashboardService.ts; client/src/modules/Dashboard/` | UNIT-06, API-17–18, UI-08–09 | Local Pass: issue-83-results.txt (server/client/browser). |
| AC-32 | `server/src/services/dashboardService.ts; client/src/modules/Dashboard/` | API-23, UI-10–11, UI-14–16, E2E-03 | Local Pass: issue-83-results.txt (server/client/browser). |
| AC-33 | `client/src/components/Common/Lookup/; client/src/lookups/actionUserLookup.ts; server/src/services/userService.ts` | UNIT-08, UNIT-11, API-19, API-22, UI-03, UI-12, UI-17–18 | Local Pass: issue-83-results.txt (server/client/browser). |
| AC-34 | `server/prisma/migrations/; server/prisma/seed.ts; server/src/services/actionTakenService.ts; server/src/services/ticketWorkflowService.ts` | API-03, UI-04, PG-02, PG-13, DATA-01–02 | Local Pass: issue-83-results.txt (migration/seed/runtime); migration section above. |
| AC-35 | `server/prisma/migrations/; server/prisma/seed.ts; server/src/services/actionTakenService.ts; server/src/services/ticketWorkflowService.ts` | PG-02, PG-13–14, DATA-02–03 | Local Pass: issue-83-results.txt (migration/seed/runtime); migration section above. |
| AC-36 | `client/src/styles/; client/src/modules/Actions/; client/src/modules/Dashboard/; client/src/components/Common/Lookup/` | UI-12–13, RESP-01–03, VIS-01 | Local Pass: artifacts/lab-04/screenshots/final/manifest.md; accessibility checklist. |
| AC-37 | `server/tests/; client/tests/; e2e/; README.md; docs/lab-04/reviewer.md` | PERF-01, REG-01–03, DATA-04 | Local Pass: issue-83-results.txt (full suites/PERF); reviewer.md (approval pending). |
| AC-38 | `server/src/services/ticketWorkflowService.ts; client/src/modules/Tickets/` | API-15, PG-15 | Local Pass: issue-83-results.txt (server/client/browser). |
| AC-39 | `server/src/services/actionTakenService.ts; client/src/modules/Actions/` | UNIT-10, API-21, PG-07, PG-16 | Local Pass: issue-83-results.txt (server/client/browser). |

AC-37 documentation inspection passes for accurate available evidence, while
release authorization is blocked by the pending review gates. Technical Pass
rows never imply approval, Issue closure or a production performance promise.

## Authorized feature publication — 2026-10-07

The owner requested “Push and open PR to lab4-staging”. Published verified
commit `1cce02aaf89e409d88fa8c57263bce3052770e56` with a normal fast-forward push
and opened [PR #90](https://github.com/oangsa/TokTickIT/pull/90) against
`lab4-staging`. The staging target remained `1ee0b17`; no direct staging write,
force push, merge, Issue closure or release approval occurred.

At that exact committed code head, full server again passed 1,449 tests
(117.43 s), client 455 (24.40 s), all 110 browser cases with zero skips (3.7 min),
both TypeScript/build commands and dedicated PERF-01 four cases (161.36 s
including preparation). Full mandated counts were unchanged. Warmed probes were
6 / 78 / 5 / 7 ms; SELECT counts 5 / 30 / 7 / 14 under the unchanged 2,000 ms
ceiling. The sanitized exact-head output is retained locally at
`artifacts/lab-04/issue-83-final-head-results.txt` (ignored execution artifact);
its source/test/lock/config fingerprint matches the committed output record.
Generated screenshot recaptures were restored to reviewed committed bytes and
all 69 hashes verified. Task-owned PostgreSQL and private baseline exports were
disposed after successful verification.

This publication follow-up changes only the evidence/reviewer/AI-use records.
No new application test execution or production Red/Green cycle is claimed for
these documentation changes. Whitespace, scope, links and credential exposure
are checked before publishing them. Independent #83 peer approval, actual #77
final approval evidence and post-merge staging-head verification remain pending;
PR #90 is a feature review, not the staging-to-main release PR.

## PR #90 visual inspection follow-up — 2026-10-08

Reviewed revision: `74161965341cf2c182f1384c3a9cd6672a1087a9`, confirmed
against the open PR head. Codex inspected every one of the 69 committed PNGs
individually against `ui-spec.md` §§22–23. This is a separate AI visual review
pass, not a human peer approval or a staging-head release acceptance.

| Screenshot group | Roles | Images inspected |
|---|---|---|
| Dashboard | Requester, IT Staff, Administrator | 9 |
| Ticket Actions | Requester, IT Staff, Administrator | 9 |
| Action Detail | Requester, IT Staff, Administrator | 9 |
| Create Action | IT Staff, Administrator | 6 |
| Edit Action | IT Staff, Administrator | 6 |
| User Lookup | IT Staff, Administrator | 6 |
| Complete Action | IT Staff, Administrator | 6 |
| Cancel Action | IT Staff, Administrator | 6 |
| Action Activity | IT Staff, Administrator | 6 |
| Ticket Activity | IT Staff, Administrator | 6 |

Each role/group was inspected at 1440×900, 820×1180 and 390×844. No confirmed
visual blocker was found in the captured content: desktop tables/two-column
Action Detail, tablet stacking, mobile cards, wrapped action buttons, labels,
text, focus outlines and modal controls remain legible without visible overlap
or unintended horizontal clipping. Create/Edit/Complete/Cancel dialogs fit in
the captured viewport. Lookup result emails wrap; the long focused search value
scrolls within its single-line input.

All 69 PNG SHA-256 hashes and IHDR dimensions match the committed
[manifest](../../../artifacts/lab-04/screenshots/final/manifest.md), and local
PNG bytes match the reviewed Git revision. The manifest and screenshots were
already uploaded in PR #90; no image regeneration or replacement was needed.

Limitations: these are viewport captures, not full-page captures. Normal vertical
scrolling omits lower Dashboard lists and portions of Ticket/Action Detail;
Activity captures show separate lower sections. This pass does not establish
visual correctness of content absent from the images, other UI states, live
scroll behavior, or screen-reader behavior. No application tests, builds or
browser sessions were rerun for this documentation follow-up.

The inspection result was published in the PR description and exact read-back
was verified on 2026-10-08. The reviewer can use it to assess the visual hold;
actual independent peer approval remains pending. Splitting the large API security test remains a
non-blocking suggestion. PR #84 review reconciliation and integrated
`lab4-staging` head release gates remain required before final Lab 4 release.
