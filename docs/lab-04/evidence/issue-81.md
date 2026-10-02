# Issue #81 — Ticket workflow and resolution evidence

Branch: `feature/81-ticket-workflow-resolution`. Scope: existing eight statuses and semantic endpoints, Action-based resolution, exact Administrator operational parity, atomic typed Ticket Activity, Requester confirmation/reopen, and workflow UI refresh/recovery. No Dashboard implementation, Action API shape, schema/migration, dependency, authentication redesign, commit, push, or GitHub Issue/PR change.

## Implementation and concurrency

`ticketWorkflowService.ts` rechecks active/non-deleted/non-system actor role inside the transaction. It locks actor and assignment-target Users before the Ticket, retaining User-management lock order. Ticket mutations hold `FOR UPDATE` before reading status/owner/confirmation or resolution counts. Existing Action writes hold `FOR SHARE` on that same Ticket; therefore workflow reads a fresh committed Action set after earlier Action writes finish, and later Action creation rechecks the committed Ticket status. PostgreSQL's default Read Committed transaction plus these locks replaces the previous Serializable snapshot, which could precede an earlier Action commit. Prisma has no row-lock API; all lock SQL uses bound parameters. Existing safe ownership/transition conflict mapping now also recognizes nested PostgreSQL/driver conflict forms.

Mark Resolved accepts current owners only from IN_PROGRESS, WAITING_FOR_REQUESTER or REOPENED. Same-transaction queries require at least one COMPLETED/isMigrated=false Action and no PLANNED/IN_PROGRESS Action. CANCELLED neither counts nor blocks. Requester Looks Resolved leaves RESOLVED, locks before checking confirmation, and writes exactly one childless REQUESTER_RESOLUTION_CONFIRMED event with authenticated Requester actor. Repeats preserve the persisted row and timestamp. Close remains current-owner-only after confirmation. Reopen clears owner/confirmation and preserves Actions.

Claim/assign/reassign/unassign use assignment children (with NEW-to-OPEN status child for first assignment). Priority uses a priority child; semantic status mutations use status children. Requester reopen records a status child under TICKET_REOPENED, as the frozen schema requires. Request Information includes its Public Comment in the same transaction. Failures roll back all writes. Unchanged assignment/priority values add no misleading Activity. Ordinary Comments/Internal Notes/Attachments remain outside Ticket Activity. Existing Activity API has no create/update/delete route; database administrative writes are not a public contract.

Administrator non-owners may Claim unassigned Tickets, change IT Priority and Cancel under Staff source rules. Start/Request Information/Resume/Resolve/Close still require ownership. Non-owner Admin reassignment remains forbidden, preserving the unamended ownership policy. Action work and lookup reuse existing parity.

UI blocks resolution when any loaded Action is Planned/In Progress, including filtered/search results; only a complete unfiltered Action set can prove the completed-work prerequisite. Unknown gates defer to backend authority. Semantic success refreshes Ticket summary and Action/Activity controls. 403/409 offers Refresh Ticket and retry without claiming success. Safe refresh preserves Request Information text and checks pending modal actions against current role/owner/status and the known resolution gate. Refresh failure after committed mutation states that the Ticket was updated and requires refresh. No generic status selector.

## Test-first evidence

- UNIT-04: five rejecting datasets resolved before the gate; after implementation all seven cases pass. The initial wrong-directory command wrote no test and provided no Red evidence.
- API-16: three non-owner Administrator parity cases returned 403 before correction; afterward five initial parity/owner cases passed. Initial sandbox `listen EPERM` was an environment failure; valid Red used approved local socket access.
- PG-10: missing confirmation Activity and missing rollback caused three new confirmation/workflow tests to fail. After Activity implementation the first nine tests passed. Additional coverage now includes every Ticket event family and rollback, Requester cancel/reopen rollback, and stale actor role.
- Transactional actor-role recheck: real persisted Staff-to-Requester change still allowed Start Work before the check; afterward mutation rejects with FORBIDDEN and no Ticket/Activity changes.
- UI-07: seven new regressions failed before UI changes; afterward seven passed, plus affected Staff Ticket Detail and Actions Taken suites (35 tests).
- UI late-response guard: a delayed old Planned Action page overwrote a newer Completed gate before the fix. Request-generation/unmount guard now preserves latest feedback; permanent regression covers both stale response and unmount.
- Supplemental matrices/races were added after the first vertical gate/Activity cycles. They strengthen observable API/database coverage; no separate Red claim for already-correct inherited Action locking or migration behavior.

Fixture corrections: an unsupported `.txt` upload fixture was replaced with an allowed synthetic PDF without changing the inherited Attachment allowlist. Missing followUpRequired and invented migrated performer failed real schema constraints; corrected fixtures preserve truthful migrated shape (no assignee/performer). API envelope expectations use the actual centralized envelope, without inventing a `status` property. A direct administrative DB-update rejection assertion was removed because FR-20/BR-63 freeze append-only normal services/no public write routes, rather than a blanket superuser SQL prohibition. Existing public-route and unchanged-history assertions remain. Lab 3 assertions intentionally superseded by Admin parity and real-Action resolution were evolved; their unchanged transition/authorization/confirmation assertions remain.

## Runtime exclusion handoff to #83

`ticket-resolution.postgres.test.ts` covers all seven real datasets, both legacy source statuses with preserved synthetic history, parent-lock races in both creation orders, and concurrent completion/cancellation. `migration-upgrade.postgres.test.ts` additionally executes the actual committed migration/recovery against representative pre-Lab-4 RESOLVED and CLOSED fixtures. Only after all existing data-preservation assertions does it reopen each migrated Ticket, reject synthetic-only resolution, complete a real Action through normal services, resolve successfully, and assert migrated rows unchanged. This distinguishes true migration proof from hand-created migrated-marker fixtures.

API-15 checks Staff/Admin owners across all three eligible source statuses and seven datasets, plus legacy reopen sequences. API-16 covers non-owner restrictions and advisory confirmation/Close. E2E-02 covers Staff and Administrator owners through real UI/API/PostgreSQL, including open-work rejection, completed plus cancelled work, Requester confirmation narrative, and owner Close. Screenshot attachments are included in the Playwright report.

#83 must reconcile this contribution with #78 migration/recovery, #79 API visibility, and #80 historical display under complete AC-34–35 and PG-02/PG-13/DATA-02. Those complete rows remain Blocked; they are not promoted by #81 alone. E2E-01 remains #83-owned: use the delivered Claim/status/assignment/priority Activity alongside Action events and verify Requester read-only visibility. No reverse dependency on #83, Issue closure, peer review, or final-release acceptance is claimed.

## Execution environment

All PostgreSQL/browser runs use the existing guarded private runner (`/tmp/lab4-review-run.mjs`), which captures actual baseline URLs without printing them, overrides TEST_DATABASE_URL/DATABASE_URL/DIRECT_URL together, and sanitizes logs. Docker inspection confirmed the running disposable `toktickit-lab3-test-postgres` container on localhost:55433, database `toktickit_lab3_test`, with zero persistent mounts. Read-only Prisma migration status confirmed all seven migrations current before writes. Existing cross-lab PostgreSQL suites reset only this guarded disposable target as part of their established fixtures; migration recovery uses isolated temporary schemas. No shared database was written or reset. Browser audit fixtures remain on the disposable target to preserve append-only history; selection assertions use fixture public IDs because historical synthetic names may repeat.

## Final validation

Observed commands (private runner supplies the guarded environment for server/database/browser commands):

```text
server: npm test
90 files / 1,431 tests passed; all Labs 1–4 retained, including PostgreSQL.
client: npm test
35 files / 422 tests passed on final UI source.
server: npm run build
Passed TypeScript, including src/prisma/tests; rerun after stronger PG-10 service assertions.
client: npm run build
Passed TypeScript (src/tests) + Vite on final UI source.
root: npm run test:e2e -- e2e/lab-04/ticket-resolution.spec.ts e2e/lab-03/staff-ticket-flow.spec.ts e2e/lab-03/requester-regression.spec.ts
18 passed (52.9s); E2E-02 two roles plus 16 affected Lab 3 regressions.
root: npm run test:e2e -- e2e/lab-04/ticket-resolution.spec.ts
Final UI rerun: 2 passed (21.9s), two report screenshot attachments.
server: npm test -- tests/lab-04/postgres/ticket-activity.postgres.test.ts
Final strengthened PG-10: 21 passed, including actual Comment/Note/Attachment creation services.
server: npm test -- tests/lab-04/postgres/ticket-resolution.postgres.test.ts tests/lab-04/postgres/migration-upgrade.postgres.test.ts
Covered by the full server run; latest focused run also passed 13 resolution tests and 2 actual migration/recovery tests.
git diff --check
Passed. Scoped secret-pattern scan: no findings. All 28 changed/new files are in scope.
```

The supplemental PG run initially rejected the unsupported upload fixture; after correction the complete 21-test PG-10 file passed. No full-suite rerun is claimed after this test-only strengthening; the affected full PG-10 suite and server TypeScript build were rerun. No additional production changes followed final client/browser validation.

Local sanitized logs: `/tmp/81-full-server-final.log`, `/tmp/81-full-client-final.log`, `/tmp/81-pg10-final.log`, `/tmp/81-pg-final.log`, `/tmp/81-e2e02-final.log`, `/tmp/81-e2e02-latest.log`, `/tmp/81-server-build-latest.log`, `/tmp/81-client-build-final.log`. Latest report: `artifacts/lab-03/playwright-report/index.html` (legacy directory name; contains both Lab 4 E2E-02 cases and attached screenshots). Logs/screenshots are local artifacts, not independently reproduced CI.

UNIT-04/API-15/API-16/PG-10/PG-11/PG-15/UI-07/E2E-02 final state: **Pass**. Complete PG-02/PG-13/DATA-02 remain **Blocked** under #83; E2E-01 remains **Not Run** under #83. No full Lab 4 release, Dashboard, broad responsive-suite, peer-review or CI acceptance claim. Working tree initially clean, now 28 scoped files changed/new and unstaged. No commit or push was authorized or performed. No secret findings, new schema/migration, dependencies or later-lab scope.

Earlier checkpoints: full client 35 files/421 tests passed; server and client builds passed; no package defines a lint command. Existing Vite size/annotation and pg concurrent-query deprecation warnings remain. First broad server run found stale fixtures/premises, then four corrected Lab 3 suites passed (30 tests). First browser run passed 14 and failed four: duplicate name selector, development-server restart during Claim, and two incorrect Cancel control labels. These failures are retained as historical evidence, not silently reported as Pass.

## Scrutinize UI follow-up — 2026-10-02

The requested review reproduced two UI defects: filtering visible open Actions discarded the blocking gate, and Refresh Ticket re-enabled pending modal submission after ownership/status or Action prerequisites changed. The user then requested `fix`.

Seven permanent UI-07 regressions were added in three Red/Green cycles at the existing Ticket Detail/API boundary: filtered PLANNED/IN_PROGRESS rows (two cases), Staff/Admin Request Information retry after ownership/source-status changes (four cases), and pending Mark Resolved confirmation after refreshed open work (one case). Each cycle failed on an enabled control before its production fix, then passed. An initial IN_PROGRESS filter-chip selector incorrectly replaced the underscore; the selector was corrected and both filter cases reproduced the defect before the fix. Disabled Request Information also rejects forced form submission without a second mutation; the entered draft remains intact. Existing valid refresh/retry coverage remains green.

The fix reuses the existing role/owner/status action calculation in one local mutation guard, shared by the buttons and actual submit path. Pending dialogs display why submission is unavailable without resetting drafts. Any visible open Action blocks resolution; filtered/incomplete terminal-only data still cannot prove a complete valid gate. No REST, backend, Prisma, dependency or styling changes were needed for this follow-up.

Observed validation on the corrected UI:

- `cd client && npm test -- tests/lab-04/TicketWorkflow.test.tsx tests/lab-04/ActionsTaken.test.tsx tests/lab-03/StaffTicketDetail.test.tsx`: 3 files / 43 tests passed.
- `cd client && npm test`: 35 files / 429 tests passed, including the seven new regressions.
- `cd client && npm run build`: TypeScript and Vite passed. Existing React act warnings in inherited tests and Vite annotation/bundle-size warnings remain.
- `npm run test:e2e -- e2e/lab-04/ticket-resolution.spec.ts e2e/lab-03/staff-ticket-flow.spec.ts` through the existing guarded private runner: 14 passed (45.0s), including both E2E-02 roles and 12 affected Lab 3 workflows. Docker inspection reconfirmed the running disposable localhost:55433 container with no mounts; the runner overrides TEST_DATABASE_URL/DATABASE_URL/DIRECT_URL and redacts credentials. Sanitized log: `/tmp/81-fix-e2e.log`. The local Playwright report contains these 14 cases; this is not independent CI evidence.

This follow-up preserves the 28 pre-existing changed/new files and modifies only the two reviewed UI sources, TicketWorkflow tests and Lab 4 records. No backend suite rerun is claimed after the UI-only fixes; earlier review independently passed 279 focused backend/API/PostgreSQL tests, including complete PG-10 and migrated reopen/race evidence. No commit/push, GitHub change, peer-review approval or #83 acceptance was authorized or recorded.

## Publication gate — 2026-10-02

The owner subsequently authorized commit, push and a PR to `lab4-staging` with `Closes #81`. The fetched base equals the branch's pre-publication HEAD. All 28 existing changed/new files belong to #81; production code was preserved during publication checks. Earlier no-publication statements above record prior checkpoints.

Final publication checks executed on this source:

- `cd server && npm test` through the guarded private runner: 90 files / 1,431 tests passed, including all PostgreSQL suites (102.69s).
- `cd client && npm test`: 35 files / 429 tests passed (25.04s).
- `cd server && npm run build` and `cd client && npm run build`: both passed; existing Vite bundle warnings remain. Neither package defines a lint script.
- `npm run test:e2e -- e2e/lab-04/ticket-resolution.spec.ts e2e/lab-03/staff-ticket-flow.spec.ts e2e/lab-03/requester-regression.spec.ts` through the guarded private runner: 18 passed (56.8s), including both E2E-02 roles.
- Read-only Prisma migration status confirmed seven migrations current on disposable `localhost:55433/toktickit_lab3_test`; Docker confirmed a running container with no mounts. All database/browser commands override TEST_DATABASE_URL, DATABASE_URL and DIRECT_URL. No shared database writes.
- `git diff --check`, staged whitespace check and scoped secret-pattern scan passed with no findings.

Sanitized logs: `/tmp/81-publish-server.log`, `/tmp/81-publish-client.log`, `/tmp/81-publish-client-build.log`, `/tmp/81-publish-e2e.log`, `/tmp/81-publish-migration-status.log`. No new Red cycle is claimed for this publication-only task; implementation Red/Green evidence remains above. No peer-review, independent new-head CI or #83 acceptance is claimed. Commit identity and PR URL are reported after publication.
