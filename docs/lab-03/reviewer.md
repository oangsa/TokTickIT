# Lab 3 — Peer Review Record  (fill this in)

**Author:** 67070503477 — GitHub: @oangsa
**Peer reviewer:** 67070503405 — GitHub: @kittipichcha

## Pull Requests I authored (reviewed by my partner)

| PR | Branch | Reviewer verdict |
|----|--------|------------------|
| [#67](https://github.com/oangsa/TokTickIT/pull/67) | feature/60-lab3-data-auth-backend | _Record my partner's verdict_ |
| _Pending_ | feature/61-commonform-auth-frontend | _Record my partner's verdict_ |

Reviewer comments I received (@kittipichcha):

- _Add the comments from my partner's GitHub review here._

How I responded:

- _Record the changes or replies made for each review comment here._

## Pull Requests I reviewed for my partner

### feature/<partner-branch>

My comment:

_Add my review findings and approval/request-changes decision here._

Partner's response:

_Add my partner's response here._

## Author implementation evidence (not peer-review feedback)

The sections below record implementation and verification facts only. They are
not a substitute for the peer-review record above and do not claim a review
verdict that has not been recorded.

### Issue 2 implementation review

Implemented Lab 3 data/auth foundation on `feature/60-lab3-data-auth-backend`.

- `npm run build`: passed after rework.
- Exact focused Issue 2 gate: 12 files, 47 tests passed with `@issue-2` when local server binding was allowed.
- Prisma generate, validation, and schema-to-empty migration inspection: passed; generated output no longer contains `DevelopmentRequester`.
- Development-mode Prisma migration status: rejected before datasource access because Lab 3 target safety requires `NODE_ENV=test`.
- A separate tmpfs-backed Docker PostgreSQL target was created at `127.0.0.1:55433` for `toktickit_lab3_test`. Baseline `DATABASE_URL` and `DIRECT_URL` identities were captured without recording their values; guarded status and deploy accepted only the explicit Lab 3 target overrides.
- Four committed migrations deployed successfully to the disposable target. Seed ran twice with the same non-secret result (`categories:4`, `relatedSystems:7`, `users:10`, `tickets:6`), and maintenance cleanup ran twice with no remaining technical rows.
- The real PostgreSQL Issue 2 gate passed: 5 suites, 7 tests. It covers persisted session rotation, previous-token deadlines, expiry, revocation, logout, all-session revocation, and concurrent rate-limit updates against the guarded target. It first exposed Prisma's inability to deserialize the `void` result from `pg_advisory_xact_lock`; the rate-limit lock now returns a scalar sentinel through a CTE, and the rerun passed.
- The current PG gate fails closed before tests run when the required explicit target overrides/baselines are absent.
- Current-head inspection found no production credentials or plaintext refresh/password credentials logged by implementation. GitGuardian incident `37228452` was reviewed and dispositioned as a false positive caused by a synthetic invalid-password fixture in historical test-only commit `d8691ba`; GitGuardian checks now pass, so DATA-04 is Pass.
- The migration no longer assigns a shared usable password hash. It writes a unique fail-closed marker for each migrated User; the guarded provisioning command generates one cryptographically secure 16-character password per User, stores only normal Argon2id hashes in PostgreSQL, and writes the operator handoff to an ignored `0600` local file without logging credentials.
- The populated PostgreSQL migration regression passed for marker uniqueness, marker fail-closed behavior, per-User Argon2id verification, name-derived-password rejection, and idempotent rerun.

## Issue 3 implementation review

Implemented on the current Issue 3 feature branch:

- Shared typed CommonForm architecture under `client/src/forms/` and `client/src/components/CommonForm.tsx`, using React Hook Form with `zodResolver`, semantic Bootstrap spans, standard actions, dirty-state exposure, first-invalid focus, and centralized safe server-field mapping.
- Shared form constants under `client/src/constants/forms/{index,auth,ticket,user}.ts`.
- In-memory auth transport and AuthProvider states (`BOOTSTRAPPING`, `ANONYMOUS`, `PASSWORD_CHANGE_REQUIRED`, `AUTHENTICATED`) with `/api/auth/refresh`, `/api/auth/me`, bounded auth requests, same- and independent-realm single-flight refresh, `navigator.locks`, and ephemeral bearer `BroadcastChannel("toktickit-auth")` coordination without Web Storage persistence.
- Login, restricted/full Change Password, role guards, temporary protected destination screens for later Issue-owned domains, role-aware AppShell navigation, logout, mobile drawer behavior, and standalone safe 403/404/500 error routing.
- Focused UI coverage: `client/tests/lab-03/` — 7 files, 28 tests passed with `@issue-3`.
- Full client regression: 17 files, 324 tests passed. The seven legacy Lab 2
  imports use a test-only route harness so production `App` keeps the Issue 3
  authenticated route map.
- Client production build passed.
- Exact Issue 3 Playwright gate passed: 22 tests covering authentication safe
  failures plus Login, Change Password, and Requester/IT Staff/Administrator
  shell checks at all three required viewports. The mocked Issue 3 browser
  command explicitly sets `ISSUE_3_UI_ONLY=1`; database-backed suites remain
  guarded by default.
- Current-head counts are 28 focused UI tests and 324 full client tests; these
  supersede the older 27/323 counts in the PR description.
