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

The owner subsequently authorized commit, push and a PR to `lab4-staging` with `Closes #81`. The fetched base equals the branch's pre-publication HEAD. The historical implementation/publication checkpoint covered 28 changed/new files; production code was preserved during those checks. Published PR #88 at `762e11da115736008a8eaabe3b5dd7d1b1ec3058` contains 31 changed files: the 28-file checkpoint plus three additional paths from the later Lab 3 User-administration fixture/evidence follow-up. That follow-up changed four files, one already included in the checkpoint. Earlier no-publication statements and 28-file counts above record historical checkpoints, not the final published PR scope.

Final publication checks executed on this source:

- `cd server && npm test` through the guarded private runner: 90 files / 1,431 tests passed, including all PostgreSQL suites (102.69s).
- `cd client && npm test`: 35 files / 429 tests passed (25.04s).
- `cd server && npm run build` and `cd client && npm run build`: both passed; existing Vite bundle warnings remain. Neither package defines a lint script.
- `npm run test:e2e -- e2e/lab-04/ticket-resolution.spec.ts e2e/lab-03/staff-ticket-flow.spec.ts e2e/lab-03/requester-regression.spec.ts` through the guarded private runner: 18 passed (56.8s), including both E2E-02 roles.
- Read-only Prisma migration status confirmed seven migrations current on disposable `localhost:55433/toktickit_lab3_test`; Docker confirmed a running container with no mounts. All database/browser commands override TEST_DATABASE_URL, DATABASE_URL and DIRECT_URL. No shared database writes.
- `git diff --check`, staged whitespace check and scoped secret-pattern scan passed with no findings.

Sanitized logs: `/tmp/81-publish-server.log`, `/tmp/81-publish-client.log`, `/tmp/81-publish-client-build.log`, `/tmp/81-publish-e2e.log`, `/tmp/81-publish-migration-status.log`. No new Red cycle is claimed for this publication-only task; implementation Red/Green evidence remains above. No peer-review, independent new-head CI or #83 acceptance is claimed. Commit identity and PR URL are reported after publication.

## PR #88 owner-cleanup audit follow-up — 2026-10-02

The supplied final scrutiny review identified User Management as another production Ticket Owner mutation path. `updateUser()` now uses Prisma `updateManyAndReturn` to clear ownership and retrieve only the Ticket IDs actually changed. It appends one `TICKET_UNASSIGNED` with a typed assignment child (previous owner = edited User, new owner = null) and the authenticated Administrator performer for each returned ID, inside the existing Serializable transaction. User edit, session revocation, owner cleanup and all Activity therefore commit or roll back together. No status, Action assignment, REST shape, schema, migration or dependency changes.

Extended the retained Lab 3 PostgreSQL deactivation/demotion cases to verify exact event count/shape/actor, unchanged Ticket status, no events on repeat edits, preservation of another owner's Ticket and preservation of an Action assigned to the deactivated User. Two added PG-10 cases inject a real PostgreSQL foreign-key failure on the second Activity append and verify full equality of the original User, session and both Tickets, zero committed Activity, and successful retry. Existing User API/unit mocks were evolved to the returning Prisma operation. The retained PG-06 deadlock tests observe that same operation to preserve their real lock-cycle scheduling and unchanged loser assertions; they additionally verify the winning owner-cleanup event.

Execution breadcrumbs:

- Red: `cd server && npm test -- tests/lab-03/postgres/users-admin.postgres.test.ts -t 'commits user deactivation'` through the guarded runner failed with `expected [] to have a length of 1 but got +0` after the existing owner cleanup succeeded. The same focused regression passed after the minimal production change. Logs: `/tmp/88-unassignment-red.log`, `/tmp/88-unassignment-green.log`.
- Supplemental test fixtures initially failed because required Action fields/public Ticket ID were missing and the synthetic session hash was too short. Fixtures were corrected to the actual schema; these failures are not behavior Red evidence.
- `cd server && npm test -- tests/lab-03/postgres/users-admin.postgres.test.ts tests/lab-03/users-admin.api.test.ts tests/lab-04/postgres/action-lifecycle.postgres.test.ts` through the guarded runner passed 3 files / 36 tests. Log: `/tmp/88-owner-tests.log`.
- The first full server run passed 1,428 tests and failed five: three stale User-service mocks and two race gates still observing `updateMany`. After adapting only the affected mocks/query observation, `cd server && npm test -- tests/lab-03/UserService.test.ts tests/lab-04/postgres/action-concurrency.postgres.test.ts` passed 2 files / 17 tests with both real deadlock orderings intact. Log: `/tmp/88-inherited-tests.log`.
- `cd client && npm test` passed 35 files / 429 tests. Both `cd server && npm run build` and `cd client && npm run build` passed, including TypeScript checks; existing Vite bundle warnings remain. Neither package defines a lint script. Logs: `/tmp/88-client-final.log`, `/tmp/88-server-build.log`, `/tmp/88-client-build.log`.
- Final `cd server && npm test` through the guarded runner passed 90 files / 1,433 tests, including all PostgreSQL suites (96.90s). Log: `/tmp/88-server-final.log`.
- `npm run test:e2e -- e2e/lab-04/ticket-resolution.spec.ts e2e/lab-03/user-administration.spec.ts e2e/lab-03/staff-ticket-flow.spec.ts e2e/lab-03/requester-regression.spec.ts` through the guarded runner passed 22 tests (1.2m), including both E2E-02 roles and affected User/Staff/Requester flows. Log: `/tmp/88-e2e-final.log`. These are local guarded results, not independent new-head CI.
- Final `git diff --check` and changed-file credential-pattern inspection passed with no findings. Nine local files are modified; five add paths to the published PR's 31-file scope, yielding 36 paths if this follow-up is published against the same base. No unrelated or pre-existing local edits were present.

Docker inspection reconfirmed a running disposable localhost:55433 PostgreSQL container with no mounts; read-only Prisma migration status reported the intended `toktickit_lab3_test` target and seven current migrations before writes. All database runs override TEST_DATABASE_URL, DATABASE_URL and DIRECT_URL together through the existing guarded private runner; no shared database writes. Log: `/tmp/88-migration-preflight.log`.

Read-only GitHub inspection confirmed PR #88 still publishes `762e11da115736008a8eaabe3b5dd7d1b1ec3058` with 31 changed files and that Issue #81 still has stale Scope/DoD checks and test states. A proposed Issue body is prepared in `/tmp/88-issue81-proposed.md`; no GitHub write, commit, push, merge, peer-review approval or #83 acceptance is recorded. The audit fix remains additional local work; the 31-file published count does not include this follow-up. E2E-01 and complete AC-34–35 / PG-02 / PG-13 / DATA-02 retain #83 ownership and their existing states.

Subsequent authorization: the owner instructed “go ahead” with the prepared Issue update. Verified the live body had not changed since preparation, applied `/tmp/88-issue81-proposed.md` to [Issue #81](https://github.com/oangsa/TokTickIT/issues/81), and verified exact body read-back. The six Scope checks, three DoD checks and eight owned test rows now reflect the local evidence; the body explicitly preserves the unpublished audit-fix caveat, no independent new-head CI/peer-review claim, and all #83-owned gates. Earlier stale/draft/no-GitHub-write wording records the pre-authorization checkpoint. No commit, push, merge or Issue closure was authorized or performed. This step changes documentation/GitHub evidence only; application tests were not rerun.

## Audit-fix publication checks — 2026-10-02

The owner subsequently authorized commit and push of this nine-file follow-up on `feature/81-ticket-workflow-resolution`. Existing production changes were preserved. Current publication checks passed:

- Guarded `cd server && npm test`: 90 files / 1,433 tests, including PostgreSQL suites (109.81s).
- `cd client && npm test`: 35 files / 429 tests.
- `npm run build` in both application packages: TypeScript and builds passed; existing Vite chunk-size warning remains. Neither package defines a lint script.
- Guarded `npm --prefix .. run test:e2e -- e2e/lab-04/ticket-resolution.spec.ts e2e/lab-03/user-administration.spec.ts e2e/lab-03/staff-ticket-flow.spec.ts e2e/lab-03/requester-regression.spec.ts` from `server/`: 22 passed (1.2m).
- Read-only migration preflight confirmed seven current migrations on disposable `127.0.0.1:55433/toktickit_lab3_test`; Docker confirmed no mounts. The private runner overrides all three database URLs; no shared database writes.
- Diff whitespace and credential-pattern checks found no issues. Remote feature HEAD matched local pre-commit `762e11d`.

Logs: `/tmp/88-push-server.log`, `/tmp/88-push-client.log`, `/tmp/88-push-server-build.log`, `/tmp/88-push-client-build.log`, `/tmp/88-push-e2e.log`, `/tmp/88-push-migration-status.log`. Prior Red/Green evidence remains above; no new implementation cycle is claimed. Earlier unpublished/no-commit statements describe previous checkpoints. Commit/push outcome is reported after execution; no merge, live Issue edit, independent CI, peer-review approval or #83 acceptance is claimed.
