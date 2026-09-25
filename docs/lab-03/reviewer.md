# Lab 3 — Peer Review Record  (fill this in)

**Author:** 67070503477 — GitHub: @oangsa
**Peer reviewer:** 67070503405 — GitHub: @kittipichcha

## Pull Requests I authored (reviewed by my partner)

| PR | Branch | Reviewer verdict |
|----|--------|------------------|
| [#67](https://github.com/oangsa/TokTickIT/pull/67) | feature/60-lab3-data-auth-backend | Approved after changes requested; merged |
| [#68](https://github.com/oangsa/TokTickIT/pull/68) | feature/61-commonform-auth-frontend | Approved after changes requested; merged |
| [#69](https://github.com/oangsa/TokTickIT/pull/69) | feature/62-requester-auth-migration | Intended approval per author clarification; GitHub still records changes requested, then merge |
| [#70](https://github.com/oangsa/TokTickIT/pull/70) | feature/63-staff-queue-ticket-workflow | Approved; merged |
| [#71](https://github.com/oangsa/TokTickIT/pull/71) | feature/64-communication-admin-users | Approved after review comments; merged |

Reviewer comments I received (@kittipichcha):

- [P1] A cancelled Ticket can still be claimed through the API: Claim on CANCELLED (and CLOSED) must be rejected with 409 INVALID_STATUS_TRANSITION before mutating ownership or status.
- [P1] Issue 5 close gate inconsistency: Clarify cross-issue boundary between Issue 5 and Issue 6 for Request Information. Issue 5 verifies safe pre-integration failure and injected transaction seam; production browser integration belongs to Issue 6.
- [PR #71] Case-only email edits fail to revoke sessions: Detect changes to persisted email including capitalization, and use same comparison for Edit User self-logout confirmation.
- [PR #71] Very large collection pages can reach Prisma with oversized offsets: User, root-comment, reply, and Internal Note reads return empty page after counting without issuing out-of-range findMany() call.
- [PR #71] Multiple role filters accepted: User-list validator permits at most one role-filter expression.
- [PR #71] GitGuardian alert on test fixtures: Explicit false-positive disposition for synthetic test fixtures in Git history.
- [PR #71] Close-gate verification on final head: Run exact Issue 6 commands from Section 14.2 against e0bfeab including database-backed browser gate.
- [PR #71] Unbounded Public Comment preview retrieval: GET /api/tickets/:publicId/comments must return at most three oldest-first previews per root without fetching and hydrating every reply record into application memory.
- [PR #71] Canonical Issue 6 browser gate blocked on default ports: Run exact documented default-port @issue-6 Playwright selection against final implementation with dedicated test database and free ports 3000 and 5173.

How I responded:

- Enforced rejection of Claim and owner mutation on CANCELLED and CLOSED tickets with 409 `INVALID_STATUS_TRANSITION` in `ticketWorkflowService.ts` before ownership updates. Added unit, API, and PostgreSQL regression tests verifying owner and status remain unchanged.
- Clarified cross-issue contract in `specification.md`, `api-spec.md`, and `tests.md`: Issue 5 E2E-04 covers workflow actions with safe pre-integration 500 failure; production Request Information browser comment persistence is assigned to Issue 6 (E2E-06). Updated UI-20 test and description to verify form validation, submission, modal close, and state update to WAITING_FOR_REQUESTER.
- Enforced session revocation on case-only email changes in `userService.ts` and synced Edit User confirmation/self-logout in `EditUser.tsx` with unit and UI regressions.
- Guarded User, root-comment, reply, and Internal Note collection queries to return `200 []` and accurate `X-Pagination` metadata when requested page exceeds total count without issuing findMany().
- Restricted User query validator to at most one role filter, returning `400` otherwise, and documented rule in API spec.
- Replaced synthetic password-like test literals in `UserForm.test.tsx` with explicit placeholders and formally dispositioned historical occurrences as false positives for synthetic test fixtures (no real secrets or credential leaks).
- Executed exact Section 14.2 Issue 6 close-gate commands against final head `e0bfeab`: server focused suite with PostgreSQL (9 files, 110 passed, 9 skipped), client focused suite (5 files, 40 passed, 12 skipped), server build, client build, and database-backed Playwright browser gate (3 files, 12 passed: RESP-04, RESP-05, E2E-05, E2E-06 against disposable Docker PostgreSQL target `toktickit_lab3_test`). Appended full execution evidence to `docs/lab-03/tests.md`.
- Replaced fetch-every-reply preview path in `getRootComments` with a single parameterized `Prisma.sql` ranking query (`ROW_NUMBER()` / `COUNT(*)` over root partition) selecting ranks 1–3, hydrating at most 3 records per root. Added 20-reply mixed-depth real PostgreSQL test proving bounded hydration via SQL placeholder counting, plus unit/API coverage asserting hydrated IDs match the 3 oldest previews per root.
- Confirmed ports 3000 and 5173 free and ran the exact documented Section 14.2 `@issue-6` browser selection without configuration changes (Option A) on disposable container `toktickit-lab3-verify`; all 12 tests passed (E2E-05, E2E-06, RESP-04, RESP-05). Recorded evidence in `docs/lab-03/tests.md`.

## Pull Requests I reviewed for my partner

### feature/<partner-branch>

My comment:

_Add my review findings and approval/request-changes decision here._

Partner's response:

_Add my partner's response here._


## Issue #64 acceptance-evidence follow-up (2026-09-17)

The supplied review requested exact `@issue-6` verification on `3b4be4c`.
Those Section 14.2 gates were executed locally: server 110 passed (including all
11 PostgreSQL tests), client 40 passed, browser 12 passed, and both builds passed.
Nine server and twelve client tests were excluded by the requested name filter.
See the current-head execution record in tests.md for isolation and limitations.
This is verification evidence, not a new independent code review or peer approval;
no GitHub review or GitGuardian disposition was performed in this session.

## Issue 7 final-verification record — 2026-09-25

**Branch and target.** Verification began on clean `feature/65-lab3-final-verification-release` at `9343095`, which matched `lab3-staging`. The disposable Docker `postgres:16-alpine` tmpfs target was `127.0.0.1:55433/toktickit_lab3_test`. Original `DATABASE_URL` and `DIRECT_URL` identities were captured privately and confirmed different from this target. Database commands used `NODE_ENV=test`, `TEST_DATABASE_URL`, explicit `DATABASE_URL`/`DIRECT_URL` overrides, and both baseline guards through a private `/tmp/toktickit-lab3-run.cjs` wrapper. No URL, password, or token was written into repository evidence. No reset or destructive migration was run.

### Command results

Commands below used the guard wrapper for PostgreSQL access and Playwright's API server. All are current-session runs; initial failures and their corrections are listed below.

| Command / selection | Result |
|---|---|
| `npm test` in `server/` | 68 files, 1,052 passed, including PostgreSQL; exit 0. |
| `npm test -- tests/lab-03` in `server/` | 38 files, 384 passed; exit 0. |
| `npm test -- tests/lab-01 tests/lab-02` in `server/` | 30 files, 668 passed; exit 0. |
| `npm test` in `client/` | 26 files, 365 passed; exit 0. |
| `npm test -- tests/lab-03` in `client/` | 16 files, 115 passed; exit 0. |
| `npm test -- tests/lab-01 tests/lab-02` in `client/` | 10 files, 250 passed; exit 0. |
| `npm run build` in `server/` | TypeScript passed; exit 0. |
| `npm run build` in `client/` | TypeScript and Vite passed; exit 0. Existing Zod annotation and 500 kB chunk warnings remain. |
| `npm run test:e2e -- e2e/lab-03` | 48 passed; exit 0. Includes live PostgreSQL Remember Me/refresh/logout-all and all five Lab 3 spec files. |
| `npm run test:e2e -- e2e/lab-03/responsive-visual.spec.ts` | 30 passed; exit 0, using 1440×900, 820×1180, and 390×844. |

Section 14.2 focused reruns: Issue 2 server unit/API 47 passed (4 excluded by tag), PostgreSQL 7 passed; Issue 3 client 30 passed (3 excluded), UI-only browser 25 passed with one deliberate skip for the new live-DB test; Issue 4 server 29 passed (10 excluded), client 5 passed, browser 4 passed; Issue 5 server 211 passed (25 excluded), client 18 passed (1 excluded), browser 6 passed; Issue 6 server 118 passed (9 excluded), client 45 passed (12 excluded), browser 12 passed. Tag exclusions were planned ownership filtering, not failing tests hidden from the complete runs.

### Migration, seed, cleanup, preservation

Read-only `prisma migrate status` identified four pending migrations on the fresh local target. Guarded `prisma migrate deploy` applied all four; later status reported the schema up to date. The real PostgreSQL `migration-upgrade.postgres.test.ts` passed with populated Lab 2 category, related-system, requester/User numeric IDs, ticket and public IDs, attachments, and idempotency records preserved. Guarded migrated-password provisioning reported `provisioned:0` on the fresh seeded target. Two initial seed runs and two post-suite seed runs each reported `categories:4`, `relatedSystems:7`, `users:10`, `tickets:6` for seed-owned rows. Initial cleanup runs removed zero eligible rows; post-suite cleanup removed four eligible sessions, then zero on repeat. An extra repeat also removed zero. Aggregate business rows before and after that repeat remained `5 categories / 8 related systems / 13 users / 9 tickets`; totals include synthetic test-created records. PostgreSQL maintenance tests also passed. These results show cleanup did not remove business rows on the disposable target.

### Visual, accessibility, and privacy review

Thirty-three PNGs are present under `docs/lab-03/evidence/screenshots/`: 9 authentication (Login, Change Password, safe 403), 6 Staff Queue, 9 Staff Ticket Detail (unassigned, Public Comments, Internal Notes), and 9 User Management (list, create, edit). Captures disable entry animations. The scripted responsive cases assert no page-level horizontal overflow at all three required viewports; representative screenshots from each screen family were opened and checked for readable labels, distinct comments/notes, role-safe error copy, visible controls, and unclipped mobile content. A visual defect found during review—User Management's mobile table hiding Status/actions inside horizontal scrolling—was fixed with the existing DataTable mobile-card option and rerun at all three sizes. Client accessibility tests and E2E shell focus checks passed; no separate automated axe audit was run.

Transport/source inspection found server-authoritative User/session/role context, no active `X-Requester-Id` or Development Requester selector in production paths, allowlisted request/error logs, `no-store`, exact-origin CORS, HttpOnly SameSite=Strict refresh cookie, and exposed `X-Pagination`/`X-Request-Id`. The client still stores approved ambiguous Create Ticket recovery payload in `sessionStorage`; it does not store requester identity or access tokens. New browser checks found empty Web Storage during authentication and verified logout-all revoked two sessions. Source/documentation scans found no database URL, real credential, bearer token, or private key in changed text; reviewed screenshots contain synthetic `.test` identities and no one-time passwords. Ignored local Playwright failure traces were not committed. External GitGuardian review was not rerun.

### Review findings and release PR preparation

The first full browser run had five failures: three Administrator responsive cases lacked an `/api/admin/users` mock, and two Staff E2E selectors expected old `Sort` and `WAITING_FOR_REQUESTER` UI text. All five passed targeted rerun; complete browser rerun passed. A subsequent responsive run exposed a test strict-mode collision after mobile cards were added; the locator was scoped to the visible card/table, then focused and complete runs passed. The new live auth test initially queried the cookie at `/` despite its `/api/auth` path; corrected lookup passed.

GitHub shows feature PRs #67–#71 merged into `lab3-staging`. PRs #67, #68, #70, and #71 have recorded approvals. The author clarified on 2026-09-25 that PR #69's changes-requested verdict was a mistake and approval was intended. A fresh GitHub review query still shows only `CHANGES_REQUESTED`, with no recorded approval; the peer reviewer must correct the GitHub record for a documented approval claim. Later refactor/fix PRs #72–#74 show no recorded reviews in the queried GitHub review list. This Issue 7 branch has no PR or peer review yet. The required reviewed integration claim therefore remains unproven. No `lab3-staging` to `main` release PR exists or was created here.

Proposed release PR title: **Lab 3: authenticated requester, staff workflow, administrator management, and verification**.

Proposed release PR body (prepare only; refresh results after Issue 7 merges):

> ## Scope
>
> Merge `lab3-staging` into `main` after Issues 2–7 and feature PRs #67–#71. Lab 3 adds server-authoritative authentication/roles, authenticated Requester flows, Staff Queue and Ticket workflow, Public Comments/Internal Notes, and Administrator User Management.
>
> ## Verification
>
> Guarded disposable PostgreSQL: fresh migration and populated Lab 2 upgrade passed; seed was idempotent; cleanup was repeatable and preserved business rows. Server 1,052/1,052 and client 365/365 tests passed; both builds passed. Lab 3 Playwright passed 48/48, including 30 responsive cases. Screenshots: `docs/lab-03/evidence/screenshots/`.
>
> ## Review before release
>
> Review Issue 7 evidence and the owner-specific E2E gaps recorded in `docs/lab-03/reviewer.md`. PR #69's author says its changes-requested verdict was mistaken and approval was intended; GitHub still lacks the corrected approval. Later PRs #72–#74 have no recorded reviews. Confirm the required peer-review disposition and rerun integration checks on merged `lab3-staging` before opening this PR.

**Coverage limits.** Existing E2E files do not individually demonstrate every action listed in Issue 7's acceptance text. Requester browser coverage omits direct idempotency/recovery and Looks Resolved/Reopen paths; Staff browser coverage omits some race/page/assignment combinations; User Administration browser coverage omits explicit pagination, copy/no-storage, last-active-Administrator, and owner-unassignment paths. Corresponding unit/API/PostgreSQL tests passed where implemented, but those do not turn the missing browser assertions into E2E proof. These gaps belong to the focused owners (Issues 4–6) before a final release claim. No commit, push, branch switch, or release PR was made; Issue 7 work remains uncommitted for review.
