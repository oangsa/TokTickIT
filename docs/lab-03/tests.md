# Lab 3 Test Specification

## 1. Purpose

This document defines the **planned verification contract** for TokTickIT Lab 3. It is derived from and must remain consistent with:

- `specification.md`
- `api-spec.md`
- `ui-spec.md`

Every Acceptance Criterion `AC-01` through `AC-66` is mapped to at least one planned automated test or explicit delivery/migration evidence in Section 13.

This file is intentionally written **before or alongside implementation**. Unlike the completed Lab 2 `tests.md`, this initial Lab 3 version does not contain retrospective pass counts, Issue-fix histories, or invented implementation evidence. Every planned test begins as `Not Run`; execution evidence is added only after the corresponding test really exists and runs.

### 1.1 Shared Lab 3 contract anchors

All planned verification in this document uses these exact shared anchors:

```text
UserRole = REQUESTER | IT_STAFF | ADMINISTRATOR

TicketStatus = NEW | OPEN | IN_PROGRESS | WAITING_FOR_REQUESTER |
               RESOLVED | CLOSED | REOPENED | CANCELLED

Access JWT = memory-only browser state
Session authority = active PostgreSQL UserSession and current User/role
Refresh credential = opaque HttpOnly SameSite=Strict cookie with hash-only persistence and rotation
API base path = /api
CommonForm = typed sections/fields + React Hook Form + zodResolver + shared constants + Bootstrap 5 spans + centralized server-error mapping
Visual evidence root = docs/lab-03/evidence/screenshots/
```

These values are normative here and must match `specification.md`, `api-spec.md`, and `ui-spec.md`.

The verification strategy intentionally separates:

- Unit tests for pure/service/utility behavior;
- API tests for HTTP, authentication, authorization, validation, safe errors, and transaction orchestration with mocked data-access boundaries;
- PostgreSQL integration tests for real constraints, migrations, transactions, locking, race behavior, and committed state;
- UI component tests for React behavior and accessibility;
- Responsive browser tests;
- checklist-based visual screenshot evidence;
- end-to-end role workflows; and
- non-automated repository/migration/security evidence where a test runner alone cannot prove the deliverable.

This preserves the Lab 2 testing philosophy while expanding it for Lab 3 authentication, authorization, role separation, Staff workflow, threaded Public Comments, Internal Notes, Administrator User Management, and the CommonForm refactor.


## 2. Test ID and Result Conventions

Test IDs identify the verification layer:

```text
UNIT-xx
API-xx
PG-xx
UI-xx
RESP-xx
VIS-xx
E2E-xx
DATA-xx
```

`PG-xx` is reserved for focused tests against a dedicated real PostgreSQL test database. `DATA-xx` identifies schema, migration, seed, repository, security-inspection, workflow, or other delivery evidence that is not honestly proven by mocked Unit/API tests.

Initial `Final` value:

```text
Not Run
```

After a real execution/evidence pass, only these final values are used:

```text
Pass
Fail
Blocked
```

A single planned row may map to multiple concrete `it(...)`, `it.each(...)`, property/boundary cases, or browser steps inside its owning file. A row is not considered implemented merely because it exists in this document.

Focused ownership tags are mandatory when a planned Lab 3 file contains rows from more than one Issue. Every planned Lab 3 Vitest test title and Playwright test title must contain its Test ID and one primary tag such as `@issue-2`. The tag must match the canonical primary owner in Section 14.1. Focused commands select the owning tag; Issue 7 intentionally runs the complete Lab 3 suites without an Issue tag filter. Legacy Lab 1/Lab 2 regression files may retain their existing titles and are run as explicit regression commands, not as Lab 3 ownership rows. Shared fixtures/helpers do not receive ownership tags and do not count as verification rows.

Time-sensitive authentication tests use an injected/fake clock. They must **not** wait 10 minutes, 8 hours, 30 days, or 90 days in real time.


## 3. Test Directory and File Organization

Tests remain grouped by Lab rather than being colocated with source files.

Paths below are package-relative unless `server/`, `client/`, or repository root is written explicitly.

The Lab 3 handout names exact minimum server, client, and E2E filenames. Those files are preserved as **real planned files**. Additional modular files are allowed where a responsibility deserves focused coverage rather than turning the handout-required files into monoliths.

### 3.1 Backend Unit, API, and PostgreSQL Tests

```text
server/tests/
└── lab-03/
    ├── PasswordService.test.ts
    ├── InitialPasswordGenerator.test.ts
    ├── JwtService.test.ts
    ├── SessionService.test.ts
    ├── LoginRateLimitService.test.ts
    ├── AuthService.test.ts
    ├── AuthorizationService.test.ts
    ├── TicketOwnershipService.test.ts
    ├── TicketWorkflowService.test.ts
    ├── PublicCommentService.test.ts
    ├── InternalNoteService.test.ts
    ├── StaffQueueQueryValidator.test.ts
    ├── UserQueryValidator.test.ts
    ├── UserService.test.ts
    ├── MaintenanceService.test.ts
    ├── QueryBuilderRegression.test.ts
    ├── RequesterRegressionService.test.ts
    │
    ├── auth.api.test.ts
    ├── authorization.api.test.ts
    ├── requester-regression.api.test.ts
    ├── requester-attachments.api.test.ts
    ├── staff-queue.api.test.ts
    ├── staff-ticket-detail.api.test.ts
    ├── comments-notes.api.test.ts
    ├── users-admin.api.test.ts
    ├── auth-transport.api.test.ts
    ├── error-contract.api.test.ts
    │
    └── postgres/
        ├── migration-upgrade.postgres.test.ts
        ├── schema-contract.postgres.test.ts
        ├── auth-session.postgres.test.ts
        ├── rate-limit.postgres.test.ts
        ├── ticket-ownership.postgres.test.ts
        ├── ticket-workflow.postgres.test.ts
        ├── comments-notes.postgres.test.ts
        ├── users-admin.postgres.test.ts
        ├── requester-regression.postgres.test.ts
        └── maintenance.postgres.test.ts
```

The six handout-required server API files are preserved exactly:

```text
auth.api.test.ts
authorization.api.test.ts
staff-queue.api.test.ts
staff-ticket-detail.api.test.ts
comments-notes.api.test.ts
users-admin.api.test.ts
```

### 3.2 Frontend Tests

```text
client/tests/
└── lab-03/
    ├── Login.test.tsx
    ├── ChangePassword.test.tsx
    ├── StaffTicketQueue.test.tsx
    ├── StaffTicketDetail.test.tsx
    ├── UserManagement.test.tsx
    │
    ├── AuthProvider.test.tsx
    ├── ApplicationShellAuth.test.tsx
    ├── RequesterRegression.test.tsx
    ├── PublicComments.test.tsx
    ├── InternalNotes.test.tsx
    ├── UserForm.test.tsx
    ├── CommonForm.test.tsx
    ├── Accessibility.test.tsx
    └── ErrorPageAuth.test.tsx
```

The five handout-required client filenames are present exactly:

```text
Login.test.tsx
ChangePassword.test.tsx
StaffTicketQueue.test.tsx
StaffTicketDetail.test.tsx
UserManagement.test.tsx
```

### 3.3 Playwright Tests

```text
e2e/
└── lab-03/
    ├── authentication.spec.ts
    ├── staff-ticket-flow.spec.ts
    ├── user-administration.spec.ts
    ├── requester-regression.spec.ts
    └── responsive-visual.spec.ts
```

The first three files are the handout-required minimum. The Requester-regression and responsive/visual files are added because Lab 3 explicitly requires Requester regression plus desktop/tablet/mobile evidence.


## 4. Tooling and Test Boundaries

### 4.1 Unit Tests

Use Vitest.

Unit tests isolate service/class/utility responsibilities and mock Prisma/repository/network/clock/crypto collaborators where the test is about application logic rather than the external system.

Do not require a specific class name merely because the test filename describes a responsibility. The implementation may use functions or modules if the same contract is testable.

### 4.2 API Tests

API tests use:

```text
Vitest
+ Supertest
+ real Express application/router/middleware/controller/service behavior
+ mocked Prisma/repository boundary
```

Preferred boundary:

```text
HTTP
  -> CORS / transport middleware
  -> authentication
  -> authorization
  -> route/controller
  -> service / transaction orchestration
  -> repository / Prisma wrapper
  -> MOCK
```

Do not mock authentication/authorization middleware away in a test whose purpose is to prove a protected endpoint.

Mocked API tests prove HTTP and application orchestration. They do **not** claim to prove PostgreSQL isolation, uniqueness, locking, or rollback.

### 4.2.1 PostgreSQL Integration Tests

Focused `PG-xx` tests use the real Prisma schema/migrations and a dedicated disposable/resettable database supplied only through:

```text
TEST_DATABASE_URL
```

Before destructive setup/reset, the suite must fail safely unless all of the following hold:

- `NODE_ENV=test`;
- `TEST_DATABASE_URL` exists and parses as PostgreSQL;
- normalized `TEST_DATABASE_URL` is not the same target as the baseline
  `DATABASE_URL` or baseline `DIRECT_URL` captured before any CLI override;
- target database name contains an explicit test marker such as `test`;
- setup can identify the target as the dedicated Lab 3 test database.

Real race tests use separate Prisma clients/connections and genuinely concurrent operations. They verify committed database state after completion.

The suite never falls back to the normal development database.

### 4.3 UI Tests

UI tests use:

```text
Vitest
+ React Testing Library
+ @testing-library/user-event
+ MSW
```

MSW represents the HTTP boundary for:

- Login/refresh/me/logout;
- validation errors;
- `401`, `403`, `404`, `409`, `429`, `500`;
- delayed responses;
- Ticket/Comment/Note/User collections;
- one-time credential success;
- deterministic conflict/recovery scenarios.

Mock browser primitives as needed for unit-level AuthProvider tests:

```text
navigator.locks
BroadcastChannel
sessionStorage/localStorage spies
```

Tests must prove that the access token is not persisted to Web Storage.

### 4.4 Responsive / Visual / E2E

Use the repository-root pinned local Playwright package and Chromium.

Required viewports:

```text
Desktop  1440 x 900
Tablet    820 x 1180
Mobile    390 x 844
```

Responsive tests use behavioral/layout assertions. Visual tests capture evidence screenshots and use the checklist in Section 12; they do not require pixel-perfect snapshot baselines.

The Lab 3 handout places screenshot evidence under:

```text
docs/lab-03/evidence/screenshots/
```

with authentication, staff-queue, staff-ticket-detail, and user-management subdirectories. This test plan follows that path.

### 4.5 Authentication Time, Crypto, and Concurrency Strategy

Authentication tests must be deterministic.

- Inject or fake the clock for JWT/session/rate-limit/ambiguity-window tests.
- Do not sleep until token/session expiry.
- Unit/API Argon2id tests may use the approved faster test profile while at least one explicit contract test verifies that normal runtime configuration is `32 MiB / timeCost 2 / parallelism 1`.
- Generated initial-password tests inspect shape and one-time handling; they do not assert one fixed random password.
- Token tests assert claims/lifetime/security behavior rather than exact random token text.
- PostgreSQL concurrency tests use separate real connections; mocked `$transaction` tests only prove orchestration.

### 4.6 Existing Lab 2 Regression

Lab 3 is an increment, not a rewrite.

The final Lab 3 verification must run the existing Lab 1/Lab 2 suites. Tests whose old premise is intentionally removed by Lab 3—most importantly the unauthenticated Development Requester selector, requester identity in `sessionStorage`, and `X-Requester-Id` contract—may be replaced/evolved, but the following assertions must retain equivalent or stronger coverage:

- **Create Ticket:** authenticated Requester ownership; Lab 2 fields and server validation; Pending Attachment lifecycle; busy/retry/discard recovery; idempotency replay; and same-key/different-payload `409 IDEMPOTENCY_CONFLICT`.
- **My Tickets:** authenticated-owner-only non-deleted results; Lab 2 search/filter/sort/page mechanics; loading, empty, no-results, and `X-Pagination` behavior.
- **Ticket Detail:** owned Ticket/Attachment retrieval; malformed, missing, deleted, and cross-owner safe indistinguishable `404 NOT_FOUND` behavior.
- **Attachments:** Pending pre-upload, Active existing-Ticket upload, metadata, preview/download, max-five, retry, collection atomicity, binary-safety headers, and Removed `410 GONE` behavior.
- **Idempotency:** processing/completed claim and expiry behavior remains deterministic; replay does not duplicate a Ticket or Attachment binding.
- **Query mechanics:** `search`, `searchFields`, URL-encoded JSON `filters`, `sort`, `pageNumber`, `pageSize`, direct arrays, and browser-readable `X-Pagination` remain the shared collection contract.
- **Transport and errors:** request correlation, CORS/origin protection, `no-store`, centralized safe error envelopes, redaction, `GONE`, and `IDEMPOTENCY_CONFLICT` remain covered.
- **Maintenance cleanup:** the explicit `npm run maintenance:cleanup` command removes only eligible technical state, is safe to repeat, and does not use an application timer.

No existing test should be deleted merely because it becomes inconvenient after authentication.

### 4.7 Command Matrix

The repository currently provides `npm test`/`npm run build` in the server and client packages and a pinned root Playwright `test:e2e` script. Lab 3 implementation will update package manifests/lockfiles for approved auth/CommonForm dependencies before tests relying on them can pass.

#### PostgreSQL target safety

Every PostgreSQL CLI, seed, maintenance, and integration-test command is
guarded. The only permitted target is a disposable dedicated Lab 3 test
database whose name contains explicit `test` and `lab3` markers. It must be
valid PostgreSQL, used only with `NODE_ENV=test`, and differ from both normal
development targets before any CLI override is applied.

Target variables have distinct meanings:

- `TEST_DATABASE_URL` is the canonical Lab 3 integration-test target.
- The normal `DATABASE_URL` and `DIRECT_URL` values are baseline targets and
  must be captured before any test override for comparison.
- Prisma CLI resolves `DIRECT_URL` first, while the seed and maintenance
  scripts use application `DATABASE_URL`. Every write command therefore
  overrides both to `TEST_DATABASE_URL`; the guard compares the test target
  with the captured baseline values, not with its intentional overrides.

For in-process PostgreSQL tests, do not overwrite baseline `DATABASE_URL` or
`DIRECT_URL`; the guarded test helper connects explicitly through
`TEST_DATABASE_URL`. Before any Prisma write, capture baseline target identity,
verify it differs from the Lab 3 target without printing credentials, then run
this read-only preflight from `server/` and inspect the datasource target:

```bash
LAB3_TEST_DATABASE_URL=<dedicated_lab3_test_url>
LAB3_BASELINE_DATABASE_URL=<normal_database_url>
LAB3_BASELINE_DIRECT_URL=<normal_direct_url>

NODE_ENV=test \
TEST_DATABASE_URL="$LAB3_TEST_DATABASE_URL" \
DATABASE_URL="$LAB3_TEST_DATABASE_URL" \
DIRECT_URL="$LAB3_TEST_DATABASE_URL" \
LAB3_BASELINE_DATABASE_URL="$LAB3_BASELINE_DATABASE_URL" \
LAB3_BASELINE_DIRECT_URL="$LAB3_BASELINE_DIRECT_URL" \
npx --no-install prisma migrate status
```

If the printed target is not the disposable Lab 3 database, stop. The
implementation guard must fail closed when baseline variables are absent,
invalid, equal to the test target, or inconsistent with either explicit
`DATABASE_URL` or `DIRECT_URL` override. Never use a bare
`npm run prisma:seed` or
`npm run maintenance:cleanup`. Run them only with the same captured-baseline,
explicit-override environment:

```bash
NODE_ENV=test \
TEST_DATABASE_URL="$LAB3_TEST_DATABASE_URL" \
DATABASE_URL="$LAB3_TEST_DATABASE_URL" \
DIRECT_URL="$LAB3_TEST_DATABASE_URL" \
LAB3_BASELINE_DATABASE_URL="$LAB3_BASELINE_DATABASE_URL" \
LAB3_BASELINE_DIRECT_URL="$LAB3_BASELINE_DIRECT_URL" \
npx --no-install prisma migrate deploy

NODE_ENV=test \
TEST_DATABASE_URL="$LAB3_TEST_DATABASE_URL" \
DATABASE_URL="$LAB3_TEST_DATABASE_URL" \
DIRECT_URL="$LAB3_TEST_DATABASE_URL" \
LAB3_BASELINE_DATABASE_URL="$LAB3_BASELINE_DATABASE_URL" \
LAB3_BASELINE_DIRECT_URL="$LAB3_BASELINE_DIRECT_URL" \
npm run prisma:seed

NODE_ENV=test \
TEST_DATABASE_URL="$LAB3_TEST_DATABASE_URL" \
DATABASE_URL="$LAB3_TEST_DATABASE_URL" \
DIRECT_URL="$LAB3_TEST_DATABASE_URL" \
LAB3_BASELINE_DATABASE_URL="$LAB3_BASELINE_DATABASE_URL" \
LAB3_BASELINE_DIRECT_URL="$LAB3_BASELINE_DIRECT_URL" \
npm run maintenance:cleanup
```

`npm run prisma:migrate` is development-only (`prisma migrate dev`), is not
release evidence, and requires the same target preflight when used during
implementation. No database reset is permitted.

| Purpose | Directory | Command | Evidence requirement |
| --- | --- | --- | --- |
| Install backend dependencies | `server/` | `npm install` | Uses committed manifest/lockfile; no secret embedded in package scripts. |
| Apply development migration | `server/` | Guarded `NODE_ENV=test ... npm run prisma:migrate` | Development-only schema iteration; never use as release evidence and never target a normal/shared database. |
| Fresh migration evidence | `server/` | Guarded `NODE_ENV=test ... npx --no-install prisma migrate deploy` | Reproduce fresh schema from committed migrations after the read-only `prisma migrate status` preflight. |
| Seed Lab 3 | `server/` | Guarded `NODE_ENV=test ... npm run prisma:seed` | Run twice and record unchanged/idempotent result. |
| Maintenance cleanup | `server/` | Guarded `NODE_ENV=test ... npm run maintenance:cleanup` | Record eligible-count/repeat-run behavior; no application timer implied. |
| Focused backend test | `server/` | `npm test -- tests/lab-03/<file>.test.ts -t '@issue-N'` | Owning Issue close gate; shared files are filtered by primary ownership tag. |
| Required API file | `server/` | `npm test -- tests/lab-03/<required>.api.test.ts` | Handout-required API file executes directly. |
| Full backend suite | `server/` | `npm test` | Lab 1/2/3 server regression result recorded. |
| PostgreSQL integration | `server/` | `NODE_ENV=test TEST_DATABASE_URL=<dedicated_lab3_test_url> npm test -- tests/lab-03/postgres` | Guarded real database only; record sanitized database target and PG results. |
| Backend build/typecheck | `server/` | `npm run build` | TypeScript build passes. |
| Install frontend dependencies | `client/` | `npm install` | Uses committed manifest/lockfile; Bootstrap 5 remains UI framework. |
| Focused frontend test | `client/` | `npm test -- tests/lab-03/<file>.test.tsx -t '@issue-N'` | Owning Issue UI close gate; shared files are filtered by primary ownership tag. |
| Full frontend suite | `client/` | `npm test` | Lab 1/2/3 UI regression result recorded. |
| Frontend build/typecheck | `client/` | `npm run build` | TypeScript + Vite production build passes. |
| Install root E2E tooling | repository root | `npm install` | Uses committed pinned local Playwright package. |
| Lab 3 E2E | repository root | `npm run test:e2e -- e2e/lab-03` | Required auth/staff/admin flows plus requester regression execute with local runner. |
| Lab 3 responsive/visual | repository root | `npm run test:e2e -- e2e/lab-03/responsive-visual.spec.ts` | Exact required viewports and committed `docs/lab-03/evidence/screenshots/` evidence generated/copied. |

Never run reset/migration/seed/PG setup against production or the normal development database merely to produce test evidence.


## 5. Cross-Cutting Test Principles

### 5.1 Reusable QueryBuilder Boundary

The existing QueryBuilder remains a generic expression utility.

```text
resource-specific request
  -> resource validator / normalizer
  -> typed approved query features
  -> shared QueryBuilder
  -> Prisma/repository
```

Lab 3 tests must prove both sides:

- `StaffQueueQueryValidator` and `UserQueryValidator` reject fields/operators/types not approved for that resource;
- QueryBuilder still supports its generic validated vocabulary and does not acquire authorization, role, Requester ownership, Staff Queue default policy, or User-specific business rules.

### 5.2 Authentication Is Not a UI Test

Hiding a button or route is not proof of authorization. Every protected capability has API-level role tests.

### 5.3 PostgreSQL Proof Is Separate From Mocked Transaction Proof

A mocked `$transaction` callback can prove that the service *attempts* one transaction. Only `PG-xx` tests claim real PostgreSQL commit/rollback, locking, uniqueness, or race behavior.

### 5.4 No Secret Snapshotting

Tests must not snapshot/log full access tokens, refresh cookies, generated one-time passwords, password hashes, or database URLs.

When a test needs a generated password/token:

- compare against policy/identity behavior;
- redact it from diagnostics;
- use synthetic fixtures only.

### 5.5 One-Time Password Evidence

A one-time password is allowed to exist in a successful test response/UI assertion long enough to prove the behavior. The test must also prove that later User reads, URL/history state, Web Storage, and safe logs do not retain/reveal it.

### 5.6 Public vs Internal Communication

Public Comment and Internal Note tests deliberately use unique marker text. Requester responses/UI are searched for the Internal marker and must not contain it.


## 6. Planned Unit Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
| --- | --- | --- | --- | --- | --- | --- |
| UNIT-01 | Unit | BR-11–14, AC-04–05 | Password policy and Argon2id service: exact 8–128 code-point boundary, no trimming, uppercase/lowercase/digit/non-whitespace-symbol rules, same-as-current rejection, runtime vs injected test hash profile. | Valid boundaries pass; invalid composition/length fails; encoded Argon2id hashes verify and plaintext is never returned. | tests/lab-03/PasswordService.test.ts | Not Run |
| UNIT-02 | Unit | BR-34–36, AC-48, AC-53 | Initial-password generator: cryptographically secure 16-character output with uppercase, lowercase, digit, and symbol coverage. | Generated values satisfy the approved policy and are returned only by the calling one-time credential workflow. | tests/lab-03/InitialPasswordGenerator.test.ts | Not Run |
| UNIT-03 | Unit | BR-15–17, AC-01, AC-07, AC-13 | JWT service: HS256 signing/verification, `sub/sid/jti/iat/exp` claims, 10-minute lifetime, invalid signature/expiry behavior. | Only approved claims are emitted; invalid/expired tokens fail with safe domain errors; role is not treated as token authority. | tests/lab-03/JwtService.test.ts | Not Run |
| UNIT-04 | Unit | BR-18–24, AC-06–08, AC-10–11 | Session service: refresh hashing/rotation, previous-token ambiguity window, restricted/full lifetimes, Remember Me deadlines, revocation and logout semantics. | Boundary behavior is deterministic at exact expiry/ambiguity times; refresh plaintext is not persisted; revoked/expired sessions cannot continue. | tests/lab-03/SessionService.test.ts | Not Run |
| UNIT-05 | Unit | BR-09–10, AC-12 | Login rate limiter: `(normalizedEmail, IP)` and global-IP windows, exact thresholds, block duration, successful-login pair reset. | 5th/6th pair boundary and 30th/31st IP boundary behave exactly as specified without revealing account existence. | tests/lab-03/LoginRateLimitService.test.ts | Not Run |
| UNIT-06 | Unit | FR-01–12, BR-01–10, BR-24–29, AC-01–05 | Auth service orchestration: valid Login, dummy verify for unknown email, inactive/deleted/wrong-password equivalence, restricted-session creation, password change, session revocation. | Auth workflow produces the correct safe domain result and calls persistence/crypto/session collaborators in the approved order. | tests/lab-03/AuthService.test.ts | Not Run |
| UNIT-07 | Unit | FR-13–FR-16, FR-18, AC-15–16 | Authenticated Requester authorization policy. | Requester scope comes from auth context; foreign requester input cannot expand scope; unavailable/cross-owner resources resolve to the safe 404 policy. | tests/lab-03/AuthorizationService.test.ts | Not Run |
| UNIT-08 | Unit | BR-49–55, AC-19–24 | Ticket ownership service: Claim, eligible target validation, expected-owner compare, reassignment/unassignment, Admin-owner rules. | Unassigned Claim/assign and owner changes produce the correct domain mutations/conflicts; inactive/Requester owner targets fail. | tests/lab-03/TicketOwnershipService.test.ts | Not Run |
| UNIT-09 | Unit | BR-57–58, BR-60, BR-64–67, AC-26, AC-29–30, AC-33 | Staff Ticket workflow transition matrix and confirmation preconditions independent of HTTP. | Every Staff-owned allowed state/action pair resolves to the approved next state; every disallowed pair yields `INVALID_STATUS_TRANSITION`; Cancelled is terminal. | tests/lab-03/TicketWorkflowService.test.ts | Not Run |
| UNIT-10 | Unit | BR-65–66, AC-27 | Request Information orchestration. | Required Public Comment and status mutation are requested as one transaction; induced failure cannot report partial success. | tests/lab-03/TicketWorkflowService.test.ts | Not Run |
| UNIT-11 | Unit | BR-68, BR-70–75, AC-34–38 | Public Comment validation, root/reply projection, bounded depth, depth-2 flattening, exact reply-target metadata, ordering and preview calculation. | Comments remain escaped/plain-text data; roots/replies order correctly; replies never exceed visual depth 2; no edit/delete behavior exists. | tests/lab-03/PublicCommentService.test.ts | Not Run |
| UNIT-12 | Unit | BR-69–71, BR-76–77, AC-39–40 | Internal Note validation/projection and authorization-aware create/read service behavior. | Flat append-only notes respect 1–4000 trimmed length; Requester never receives note content; Admin non-owner cannot create. | tests/lab-03/InternalNoteService.test.ts | Not Run |
| UNIT-13 | Unit | BR-78–86, AC-41–46 | Staff Queue query validator: searchable/filterable/sortable whitelist, typed conversion, Created Date range, defaults, terminal-filter semantics. | Only approved queue fields/operators/types reach QueryBuilder; operational default ordering is constructed correctly. | tests/lab-03/StaffQueueQueryValidator.test.ts | Not Run |
| UNIT-14 | Unit | BR-78–82, AC-47 | Administrator User-list query validator: name/email search, `role` EQUAL filter, approved sort fields, and page defaults. | Only the exact User collection query surface is accepted; invalid fields/conditions/cardinality fail before data access and default name ordering is deterministic. | tests/lab-03/UserQueryValidator.test.ts | Not Run |
| UNIT-15 | Unit | BR-32–46, AC-48–53 | Administrator User service: create/edit/reset, duplicate email mapping, self-safety, last-admin safety requests, session revocation and owner-unassignment orchestration. | Valid changes produce the planned transactional work; unsafe self/last-admin operations fail before success is reported. | tests/lab-03/UserService.test.ts | Not Run |
| UNIT-16 | Unit | FR-66, AC-66 | Maintenance service: expired/revoked session and expired rate-limit selection, bounded repeat-until-empty cleanup, safe rerun. | Only eligible technical rows are selected; live sessions are never targeted; repeated run is idempotent. | tests/lab-03/MaintenanceService.test.ts | Not Run |
| UNIT-17 | Unit | FR-64, BR-78–80, AC-41–46 | Existing reusable QueryBuilder regression plus new Queue validated inputs. | Generic builder constructs approved search/filter/order expressions from already typed input without learning Ticket authorization rules. | tests/lab-02/QueryBuilder.test.ts; tests/lab-03/QueryBuilderRegression.test.ts | Not Run |
| UNIT-18 | Unit | FR-14–FR-16, FR-18, AC-15, AC-17 | Authenticated Requester service boundary: identity-scoped Ticket operations and preservation of Lab 2 idempotency/Attachment orchestration. | Requester identity is derived from auth context; no supplied requester ID changes scope; existing create/list/detail/Attachment behavior remains callable. | tests/lab-03/RequesterRegressionService.test.ts | Not Run |

## 7. Planned API / Integration Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
| --- | --- | --- | --- | --- | --- | --- |
| API-01 | API | AC-01 | Valid active User Login. | `200`; refresh cookie issued; body contains only access token and expiry; server session is created through mocked persistence boundary. | tests/lab-03/auth.api.test.ts | Not Run |
| API-02 | API | AC-02 | Unknown email, inactive/deleted User, and wrong password. | All cases return identical `401 AUTHENTICATION_FAILED` message/body shape; no account-state detail leaks. | tests/lab-03/auth.api.test.ts | Not Run |
| API-03 | API | AC-03 | Initial-password Login and restricted current-user access. | `/auth/me` reports `PASSWORD_CHANGE_REQUIRED`; normal protected business endpoint returns `403 PASSWORD_CHANGE_REQUIRED`. | tests/lab-03/auth.api.test.ts | Not Run |
| API-04 | API | AC-04 | Mandatory password-change request, validation, and terminal restricted-session behavior. | Valid new password returns `204`, clears/revokes restricted session, and subsequent old session access fails until new Login. | tests/lab-03/auth.api.test.ts | Not Run |
| API-05 | API | AC-05 | Normal Change Password including wrong current password and successful all-session revocation. | Wrong current password is safe; successful change returns `204`, revokes sessions and requires Login. | tests/lab-03/auth.api.test.ts | Not Run |
| API-06 | API | AC-06 | Restricted, non-Remember, and Remember expiry boundaries with injected clock. | Exact 15-minute, 8-hour, 30-day idle, and 90-day absolute boundaries match contract without real-time sleeps. | tests/lab-03/auth.api.test.ts | Not Run |
| API-07 | API | AC-07 | Refresh success and rotation. | Cookie token rotates; response contains new access token; old current hash becomes previous hash through service boundary. | tests/lab-03/auth.api.test.ts | Not Run |
| API-08 | API | AC-08 | Previous refresh-token reuse immediately before/at/after the 30-second ambiguity deadline. | At or before the deadline, the locked session performs exactly one fresh rotation without revocation and returns that rotation's credentials; after the deadline, or after the token is no longer current/previous, it revokes and returns `401 SESSION_INVALID`. | tests/lab-03/auth.api.test.ts | Not Run |
| API-09 | API | AC-10 | Logout with missing/expired bearer but valid refresh session; repeat Logout. | Current session is revoked, cookie cleared, and repeat call remains `204`. | tests/lab-03/auth.api.test.ts | Not Run |
| API-10 | API | AC-11 | Logout All with a FULL authenticated session. | All active target sessions are revoked; current cookie is cleared; prior tokens no longer authorize requests. | tests/lab-03/auth.api.test.ts | Not Run |
| API-11 | API | AC-12 | Layered Login rate-limit response and `Retry-After`. | Pair/global thresholds return safe `429 RATE_LIMITED` without confirming account existence. | tests/lab-03/auth.api.test.ts | Not Run |
| API-12 | API | AC-13 | Missing, malformed, invalid-signature, expired access token and revoked authoritative session. | Protected endpoints return the approved `401` family without protected data. | tests/lab-03/authorization.api.test.ts | Not Run |
| API-13 | API | AC-14 | Direct role authorization across Requester, IT Staff, Admin non-owner, and Admin owner. | Forbidden role/capability calls return `403` even if the corresponding UI could be bypassed. | tests/lab-03/authorization.api.test.ts | Not Run |
| API-14 | API | AC-15 | Requester Ticket create/list request attempts to provide another requester identity in headers/query/body. | Backend scope remains authenticated User; foreign requester input cannot change ownership and unsupported ownership fields are rejected with `400 VALIDATION_ERROR`. | tests/lab-03/authorization.api.test.ts; tests/lab-03/requester-regression.api.test.ts | Not Run |
| API-15 | API | AC-16 | Requester direct-open of another Requester's Ticket/Attachment and malformed/missing public IDs. | All unavailable/cross-owner cases use the same safe `404 NOT_FOUND` without owner/existence leakage. | tests/lab-03/authorization.api.test.ts | Not Run |
| API-16 | API | AC-17 | Authenticated Requester Create Ticket/list/detail/idempotent replay regression. | Lab 2 Ticket request validation, canonical idempotency, direct DTO behavior, search/filter/sort/page, and current-state replay continue under auth. | tests/lab-03/requester-regression.api.test.ts | Not Run |
| API-17 | API | AC-17 | Authenticated Requester Attachment regression. | Pending pre-upload, existing-Ticket Active upload, metadata, preview/download, max-five limit, removal, Removed binary behavior, and collection atomicity remain. | tests/lab-03/requester-attachments.api.test.ts | Not Run |
| API-18 | API | AC-19 | Claim unassigned NEW Ticket. | Owner becomes caller and NEW becomes OPEN in one application transaction; already-owned Ticket conflicts. | tests/lab-03/staff-ticket-detail.api.test.ts | Not Run |
| API-19 | API | AC-20 | Expected-owner compare on Claim/reassign race. | One current-state mutation succeeds; stale expected owner returns `409 OWNERSHIP_CONFLICT` and current state is not overwritten. | tests/lab-03/staff-ticket-detail.api.test.ts | Not Run |
| API-20 | API | AC-21 | Assign/reassign owner eligibility. | Only active IT Staff/Admin targets accepted; inactive/Requester/missing targets rejected safely. | tests/lab-03/staff-ticket-detail.api.test.ts | Not Run |
| API-21 | API | AC-22 | Unassign a non-NEW owned Ticket. | Owner becomes null while current status remains unchanged. | tests/lab-03/staff-ticket-detail.api.test.ts | Not Run |
| API-22 | API | AC-23 | Non-owner IT Staff attempts Start Work, Request Information, Resume, Resolve, Close. | Each owner-only operation is rejected without mutation while read/comment/reassignment permissions remain separately testable. | tests/lab-03/authorization.api.test.ts; tests/lab-03/staff-ticket-detail.api.test.ts | Not Run |
| API-23 | API | AC-24 | Administrator Ticket operation matrix before and after explicit assignment as owner. | Admin non-owner is read/comment/note-read only; assigned Admin gains approved owner operations but Claim remains forbidden. | tests/lab-03/authorization.api.test.ts | Not Run |
| API-24 | API | AC-25 | Change IT Priority as authorized actor. | IT Priority changes; Requested Priority remains exactly unchanged; invalid enum/unauthorized actor rejected. | tests/lab-03/staff-ticket-detail.api.test.ts | Not Run |
| API-25 | API | AC-26 | Parameterized semantic status-transition matrix. | Every BR-58 allowed action succeeds only from the approved states; all invalid state/action pairs return `409 INVALID_STATUS_TRANSITION`. | tests/lab-03/staff-ticket-detail.api.test.ts | Not Run |
| API-26 | API | AC-27 | Request Information with required message and mocked transaction callback. | Comment insert and `WAITING_FOR_REQUESTER` transition are orchestrated together; failure causes no partial success at application boundary. | tests/lab-03/staff-ticket-detail.api.test.ts; tests/lab-03/comments-notes.api.test.ts | Not Run |
| API-27 | API | AC-28 | Requester posts Public Comment while Ticket is Waiting. | Comment is appended and status remains `WAITING_FOR_REQUESTER`; no automatic Resume occurs. | tests/lab-03/comments-notes.api.test.ts | Not Run |
| API-28 | API | AC-29 | Owner Mark Resolved. | Approved state moves to `RESOLVED` and previous Requester resolution-confirmation value is cleared. | tests/lab-03/staff-ticket-detail.api.test.ts | Not Run |
| API-29 | API | AC-30 | Close before and after Requester confirmation. | Close without confirmation returns transition conflict; confirmed RESOLVED Ticket may close by current owner. | tests/lab-03/staff-ticket-detail.api.test.ts | Not Run |
| API-30 | API | AC-31 | Requester Problem Still Exists from RESOLVED and CLOSED. | Both produce `REOPENED`, owner null, confirmation null, priorities unchanged. | tests/lab-03/staff-ticket-detail.api.test.ts; tests/lab-03/requester-regression.api.test.ts | Not Run |
| API-31 | API | AC-32 | Requester Cancel boundary. | Own NEW/OPEN may cancel; all other statuses and other Requester's Ticket are rejected appropriately. | tests/lab-03/requester-regression.api.test.ts | Not Run |
| API-32 | API | AC-33 | Attempt every lifecycle action from CANCELLED. | Every mutation is rejected; Ticket remains CANCELLED. | tests/lab-03/staff-ticket-detail.api.test.ts | Not Run |
| API-33 | API | AC-34 | Create root Public Comment validation and backend author/time. | 1 and 2000 trimmed chars accepted; empty/whitespace/2001 rejected; client author/time fields cannot override backend. | tests/lab-03/comments-notes.api.test.ts | Not Run |
| API-34 | API | AC-35 | Retrieve root Public Comments. | Defaults to 10 newest-first roots; each root reports total replyCount and at most three oldest-first preview replies. | tests/lab-03/comments-notes.api.test.ts | Not Run |
| API-35 | API | AC-36 | Retrieve additional replies. | Default page size 5, oldest-first, correct `X-Pagination`, valid beyond-final page returns empty array. | tests/lab-03/comments-notes.api.test.ts | Not Run |
| API-36 | API | AC-37 | Create replies at target depth 0/1/2. | Depth remains bounded to 2; reply-to-depth-2 stores structural parent correctly and returns exact clicked target metadata. | tests/lab-03/comments-notes.api.test.ts | Not Run |
| API-37 | API | AC-38 | Append-only Public Comment contract and unsafe content serialization. | No edit/delete route is exposed; HTML/Markdown-like content returns as ordinary text data rather than server-rendered markup. | tests/lab-03/comments-notes.api.test.ts | Not Run |
| API-38 | API | AC-39 | Internal Note read authorization. | IT Staff/Admin read permitted; Requester receives `403` and response contains no note content/existence detail. | tests/lab-03/comments-notes.api.test.ts; tests/lab-03/authorization.api.test.ts | Not Run |
| API-39 | API | AC-40 | Internal Note create validation and Admin-owner rule. | IT Staff and Admin owner can create 1–4000 trimmed content; Admin non-owner/Requester cannot; notes remain flat. | tests/lab-03/comments-notes.api.test.ts | Not Run |
| API-40 | API | AC-41 | Staff Queue multi-field search and AND-with-filter semantics. | Approved four fields form one OR group; ownership is not requester-scoped; search group combines with filters through AND. | tests/lab-03/staff-queue.api.test.ts | Not Run |
| API-41 | API | AC-42 | Staff Queue filter matrix including Created Date range. | Status, IT Priority, owner, category, requested priority, related system and date bounds are typed/validated before repository execution. | tests/lab-03/staff-queue.api.test.ts | Not Run |
| API-42 | API | AC-43 | No explicit Queue sort. | Repository/service receives unassigned-first, semantic IT Priority high-to-low, oldest-first and deterministic tie-break ordering. | tests/lab-03/staff-queue.api.test.ts | Not Run |
| API-43 | API | AC-44 | Queue explicit terminal-status query. | API can return CLOSED/CANCELLED when explicitly requested; it does not make them permanently undiscoverable. | tests/lab-03/staff-queue.api.test.ts | Not Run |
| API-44 | API | AC-45 | Staff Queue pagination boundaries and browser-readable metadata. | Queue page sizes 1 and 100 are accepted; 0/101 are rejected; beyond-final valid page is `200 []` with valid `X-Pagination`. | tests/lab-03/staff-queue.api.test.ts | Not Run |
| API-45 | API | AC-46 | Invalid search/filter/sort/query field/operator/type/cardinality. | `400 VALIDATION_ERROR` occurs before QueryBuilder/Prisma data-access execution. | tests/lab-03/staff-queue.api.test.ts | Not Run |
| API-46 | API | AC-47 | Administrator User list name/email search, `role` filter, approved sort, and pagination. | Returns only safe User list DTO fields with deterministic name-first order; invalid User query combinations return `400 VALIDATION_ERROR` before data access. | tests/lab-03/users-admin.api.test.ts | Not Run |
| API-47 | API | AC-48 | Create User with default/explicit activation and one role. | `201` compound one-time response; User must-change flag true; generated password has required shape; plaintext is not part of User DTO. | tests/lab-03/users-admin.api.test.ts | Not Run |
| API-48 | API | AC-49 | Case-insensitive duplicate User email on create/edit. | Returns `409 DUPLICATE_EMAIL`; no second User or partial edit is reported. | tests/lab-03/users-admin.api.test.ts | Not Run |
| API-49 | API | AC-50 | Edit User and required side effects. | Name-only edit is simple; email/role/deactivation invokes all-session revocation and required Ticket unassignment in one service transaction. | tests/lab-03/users-admin.api.test.ts | Not Run |
| API-50 | API | AC-51 | Administrator self-safety. | Self-deactivation, self-role change, and self initial-password reset are rejected; permitted self name/email path remains separately defined. | tests/lab-03/users-admin.api.test.ts | Not Run |
| API-51 | API | AC-52 | Last active Administrator protection. | Demotion/deactivation of last active Admin returns conflict; another active Admin makes otherwise valid target operation possible. | tests/lab-03/users-admin.api.test.ts | Not Run |
| API-52 | API | AC-53 | Set new initial password for another User. | Returns one generated password, sets must-change, revokes all target sessions; password value is not included in later GET User. | tests/lab-03/users-admin.api.test.ts | Not Run |
| API-53 | API | AC-54 | Non-Administrator calls every User Management route. | All reads/writes are `403 FORBIDDEN`; no User list/detail/security data is returned. | tests/lab-03/authorization.api.test.ts; tests/lab-03/users-admin.api.test.ts | Not Run |
| API-54 | API | AC-64 | CORS, cookie-origin check, no-store, request correlation, centralized safe errors and logging redaction. | Credentialed approved origin works; disallowed cookie mutation origin fails; approved headers exposed; logs/errors omit secrets, credentials, note content and DB internals. | tests/lab-03/auth-transport.api.test.ts; tests/lab-03/error-contract.api.test.ts | Not Run |
| API-55 | API | AC-17, AC-24, AC-64 | Staff/Admin existing Attachment metadata/preview/download read routes. | Authorized Ticket readers can read existing evidence; Removed binary remains Gone; no Staff/Admin Attachment write route exists; safe failures leak no cross-owner/requester detail. | tests/lab-03/staff-ticket-detail.api.test.ts | Not Run |

### 7.1 Planned PostgreSQL Integration Tests

These tests run only against guarded `TEST_DATABASE_URL` and inspect committed state through real Prisma/PostgreSQL behavior.

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
| --- | --- | --- | --- | --- | --- | --- |
| PG-01 | PostgreSQL Integration | AC-65 | Upgrade a populated Lab 2 database through the committed Lab 3 migration. | Existing DevelopmentRequester numeric IDs become User IDs; Ticket Requester ownership, Category/System/Ticket/Attachment/idempotency rows and public Ticket identities are preserved exactly. | tests/lab-03/postgres/migration-upgrade.postgres.test.ts | Not Run |
| PG-02 | PostgreSQL Integration | AC-64, AC-65 | Fresh Lab 3 schema/migration contract. | User/session/rate-limit/comment/note tables, enums, unique keys, restrictive FKs, Ticket owner/priority/status fields, indexes and `citext` extension/column are present with approved nullability/defaults. | tests/lab-03/postgres/schema-contract.postgres.test.ts | Not Run |
| PG-03 | PostgreSQL Integration | AC-49 | Case-insensitive email unique constraint under real PostgreSQL including concurrent insert/update. | Only one case-insensitive email identity persists; losing transaction maps to duplicate-email behavior. | tests/lab-03/postgres/users-admin.postgres.test.ts | Not Run |
| PG-04 | PostgreSQL Integration | AC-01, AC-48, AC-53, AC-64 | Persisted password/session security representation. | User rows contain encoded Argon2id hashes rather than fixture plaintext; session rows contain refresh hashes and no refresh plaintext column/value. | tests/lab-03/postgres/auth-session.postgres.test.ts | Not Run |
| PG-05 | PostgreSQL Integration | AC-06–08, AC-10–11 | Real session state across expiry, rotation, previous-token window and revocation. | Row-locked session timestamps/hash transitions enforce the approved deadlines; one valid previous-token reuse rotates without revocation; all-session revocation makes every session inactive. | tests/lab-03/postgres/auth-session.postgres.test.ts | Not Run |
| PG-06 | PostgreSQL Integration | AC-12 | Concurrent failed Login bucket increments for email/IP and global IP. | Threshold counters do not lose updates under concurrent attempts; blockedUntil/window behavior remains deterministic. | tests/lab-03/postgres/rate-limit.postgres.test.ts | Not Run |
| PG-07 | PostgreSQL Integration | AC-19, AC-20 | Two separate connections Claim the same unassigned NEW Ticket concurrently. | Exactly one owner wins, Ticket ends OPEN with one owner, losing request observes conflict; no split owner/status commit occurs. | tests/lab-03/postgres/ticket-ownership.postgres.test.ts | Not Run |
| PG-08 | PostgreSQL Integration | AC-20–22 | Concurrent expected-owner reassign/unassign mutations. | Stale expected-owner writer cannot overwrite winner; valid unassign preserves status; only active eligible owner is persisted. | tests/lab-03/postgres/ticket-ownership.postgres.test.ts | Not Run |
| PG-09 | PostgreSQL Integration | AC-19 | Assign previously unassigned NEW Ticket through the owner-update path. | Owner assignment and NEW→OPEN commit atomically or neither commits. | tests/lab-03/postgres/ticket-ownership.postgres.test.ts | Not Run |
| PG-10 | PostgreSQL Integration | AC-27 | Request Information real transaction with induced comment or Ticket-update failure. | Public Comment and WAITING status both commit or both roll back. | tests/lab-03/postgres/ticket-workflow.postgres.test.ts | Not Run |
| PG-11 | PostgreSQL Integration | AC-31 | Requester Reopen transaction from RESOLVED/CLOSED. | REOPENED, owner null, confirmation null commit together; priorities remain unchanged. | tests/lab-03/postgres/ticket-workflow.postgres.test.ts | Not Run |
| PG-12 | PostgreSQL Integration | AC-52 | Two Administrators concurrently attempt changes that could remove the final active Administrator. | Database/application transaction locking prevents zero active Administrators; at least one operation conflicts/rolls back. | tests/lab-03/postgres/users-admin.postgres.test.ts | Not Run |
| PG-13 | PostgreSQL Integration | AC-50 | Email/role/deactivation edit transaction with active sessions and owned Tickets. | Required User change, session revocation and owner unassignment commit together; induced failure rolls all related changes back. | tests/lab-03/postgres/users-admin.postgres.test.ts | Not Run |
| PG-14 | PostgreSQL Integration | AC-35–37 | Public Comment thread persistence/order using real relational data. | Root/reply indexes and relationships retrieve newest roots, oldest replies, previews, page boundaries and flattened depth-2 reply targets without broken FK state. | tests/lab-03/postgres/comments-notes.postgres.test.ts | Not Run |
| PG-15 | PostgreSQL Integration | AC-40 | Internal Note persistence and restrictive author/Ticket relationships. | Valid flat notes persist with author/time relation; historical note evidence is not cascade-deleted by User/Ticket lifecycle operations. | tests/lab-03/postgres/comments-notes.postgres.test.ts | Not Run |
| PG-16 | PostgreSQL Integration | AC-17, AC-65 | Authenticated migrated Requester uses existing Ticket/Attachment/idempotency data on real PostgreSQL. | Migrated User owns the same Tickets; existing idempotent replay/Attachment lifecycle remains valid after FK evolution. | tests/lab-03/postgres/requester-regression.postgres.test.ts | Not Run |
| PG-17 | PostgreSQL Integration | AC-66 | Maintenance cleanup against live/expired/revoked session and rate-limit fixtures. | Only eligible technical rows are removed; active valid sessions survive; repeat cleanup changes nothing. | tests/lab-03/postgres/maintenance.postgres.test.ts | Not Run |

## 8. Planned UI Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
| --- | --- | --- | --- | --- | --- | --- |
| UI-01 | UI | AC-18 | AuthProvider cold load/reload bootstrap. | Protected shell/content does not render before refresh + `/auth/me`; no Login or stale-role flash; final state routes correctly. | tests/lab-03/AuthProvider.test.tsx | Not Run |
| UI-02 | UI | AC-01 | Login form normal/busy/success behavior. | Email/password/Remember Me render; valid submit sends correct body; busy prevents repeat; success follows `/auth/me` role routing. | tests/lab-03/Login.test.tsx | Not Run |
| UI-03 | UI | AC-02, AC-12 | Login validation, generic failure and rate-limit feedback. | Unknown/inactive/wrong-password response renders same safe message; 429 shows safe retry guidance; typed values/secret handling remain appropriate. | tests/lab-03/Login.test.tsx | Not Run |
| UI-04 | UI | AC-03, AC-04 | Mandatory Change Password UI. | Restricted User sees only New/Confirm fields and password guidance; invalid input blocks request; success clears auth and routes Login. | tests/lab-03/ChangePassword.test.tsx | Not Run |
| UI-05 | UI | AC-05 | Normal Change Password UI. | Current/New/Confirm fields render; mismatch/current-error behavior is local; successful change ends current auth and returns Login. | tests/lab-03/ChangePassword.test.tsx | Not Run |
| UI-06 | UI | AC-10, AC-11, AC-14 | Authenticated AppShell identity/role navigation and Logout controls. | Name/role shown; only permitted destinations render; Logout/Logout All state clears appropriately; role meaning has visible text. | tests/lab-03/ApplicationShellAuth.test.tsx | Not Run |
| UI-07 | UI | AC-13, AC-14 | Anonymous and wrong-role route guards. | Protected content never renders before redirect/error; wrong role uses standalone safe 403. | tests/lab-03/ApplicationShellAuth.test.tsx | Not Run |
| UI-08 | UI | AC-07, AC-09, AC-18 | Central API refresh handling and same-origin tab coordination using mocked `navigator.locks`/`BroadcastChannel`. | Concurrent expired-token calls use one refresh, retry originals once, broadcast updated/session-ended state, and never persist access token in Web Storage. | tests/lab-03/AuthProvider.test.tsx | Not Run |
| UI-09 | UI | AC-15, AC-17 | Requester Create Ticket regression after CommonForm/auth migration. | Authenticated Requester shown read-only; no Change Requester; Lab 2 fields/counters/Pending upload/idempotent submit/recovery/discard behavior remains. | tests/lab-03/RequesterRegression.test.tsx; tests/lab-02/CreateTicket.test.tsx | Not Run |
| UI-10 | UI | AC-17 | Requester My Tickets regression. | Existing search/filter/sort/page/empty/no-results/skeleton behavior remains under auth and no stale Development Requester controls appear. | tests/lab-03/RequesterRegression.test.tsx; tests/lab-02/MyTickets.test.tsx | Not Run |
| UI-11 | UI | AC-16, AC-17 | Requester Ticket Detail/Attachment regression and safe 404. | Owned data/Attachment behavior remains; cross-owner unavailable result uses safe standalone 404 without other-owner detail. | tests/lab-03/RequesterRegression.test.tsx; tests/lab-02/RequesterTicketDetail.test.tsx | Not Run |
| UI-12 | UI | AC-31–32 | Requester reopen and Cancel action visibility/confirmation. | Reopen explains unassignment; Cancel appears only for own NEW/OPEN Tickets; other statuses remain unavailable. | tests/lab-03/RequesterRegression.test.tsx | Not Run |
| UI-13 | UI | AC-41–45 | Staff Ticket Queue loading/normal/empty/no-results and default operational presentation. | Six desktop data columns/metadata render, terminal statuses are initially filtered, owner/unassigned/status/priority visible, pagination metadata displayed. | tests/lab-03/StaffTicketQueue.test.tsx | Not Run |
| UI-14 | UI | AC-41–46 | Queue search/filter/modal/chips/sort/page interactions. | Friendly controls map to approved query contract; filter drafts cancel/apply correctly; clear filters works; invalid failure remains safe. | tests/lab-03/StaffTicketQueue.test.tsx | Not Run |
| UI-15 | UI | AC-23–25 | Staff/Admin Ticket Detail grouping and role-dependent editability. | Requester-submitted values read-only; Owner/IT Priority/workflow controls reflect IT Staff vs Admin non-owner vs Admin owner permissions. | tests/lab-03/StaffTicketDetail.test.tsx | Not Run |
| UI-16 | UI | AC-19, AC-20 | Claim and ownership conflict UI. | Unassigned Staff sees Claim without confirm; busy prevents duplicate; 409 displays Reload Ticket recovery and does not fake ownership. | tests/lab-03/StaffTicketDetail.test.tsx | Not Run |
| UI-17 | UI | AC-21, AC-22 | Owner lookup/reassign/unassign UI. | Only eligible candidates presented from fixture; reassign-away/unassign confirmations show side effects; unassign result preserves status. | tests/lab-03/StaffTicketDetail.test.tsx | Not Run |
| UI-18 | UI | AC-25 | IT Priority edit/local saving behavior. | Authorized edit sends only IT Priority, Requested Priority remains read-only, local busy/success/error states are correct. | tests/lab-03/StaffTicketDetail.test.tsx | Not Run |
| UI-19 | UI | AC-26 | Semantic status-action visibility across all statuses. | No generic status select exists; only actions permitted by current status/ownership render as enabled controls. | tests/lab-03/StaffTicketDetail.test.tsx | Not Run |
| UI-20 | UI | AC-27 | Request Information required-message form. | Modal/form validates Public Comment content, submits once, closes on success and reflects WAITING plus new public message. | tests/lab-03/StaffTicketDetail.test.tsx | Not Run |
| UI-21 | UI | AC-28 | Waiting Ticket after Requester comment. | New Public Comment renders while status remains Waiting; no automatic Resume is implied and owner Resume Work remains explicit. | tests/lab-03/StaffTicketDetail.test.tsx | Not Run |
| UI-22 | UI | AC-29–30 | Staff Mark Resolved and Close gating UI. | Mark Resolved exposes Requester confirmation; Close is hidden/disabled until confirmation and only succeeds from the approved state. | tests/lab-03/StaffTicketDetail.test.tsx | Not Run |
| UI-23 | UI | AC-34, AC-35 | Public Comment root composer and lazy root list. | Create validation/busy/error works; root order/new item state correct; Load More adds root pages without destroying loaded threads. | tests/lab-03/PublicComments.test.tsx | Not Run |
| UI-24 | UI | AC-36–38 | Reply preview/View More/depth-2 reply-target presentation. | Replies expand by page; visual depth capped; `@Name` comes from metadata; no edit/delete; markup-like content renders as text. | tests/lab-03/PublicComments.test.tsx | Not Run |
| UI-25 | UI | AC-39, AC-40, AC-63 | Internal Notes tab, privacy warning, read/create permissions and validation. | Requester has no notes UI; Admin non-owner read-only; Staff/Admin owner composer available; public/private surfaces are unmistakably distinct. | tests/lab-03/StaffTicketDetail.test.tsx; tests/lab-03/InternalNotes.test.tsx | Not Run |
| UI-26 | UI | AC-47 | User Management list/search/role-filter/pagination UI. | Required columns render; query controls update collection; empty/no-results/loading/failure states remain simple and usable. | tests/lab-03/UserManagement.test.tsx | Not Run |
| UI-27 | UI | AC-48, AC-49, AC-56 | Create User CommonForm and one-time password state. | Fields/default Active submit correctly; duplicate email maps to field; success replaces form with one-time password/Copy/Done and avoids persisted route state. | tests/lab-03/UserManagement.test.tsx; tests/lab-03/UserForm.test.tsx | Not Run |
| UI-28 | UI | AC-50–52 | Edit User fields, safety controls and session-impact confirmations. | Name/email/role/status behavior matches target; self/last-admin unsafe controls unavailable; backend conflict still handled safely. | tests/lab-03/UserManagement.test.tsx; tests/lab-03/UserForm.test.tsx | Not Run |
| UI-29 | UI | AC-53 | Set New Initial Password UI. | Confirmation states sign-out/must-change impact; success reveals password exactly once with Copy; later User fetch does not restore it. | tests/lab-03/UserManagement.test.tsx | Not Run |
| UI-30 | UI | AC-54 | Non-Admin User Management route guard. | Requester/IT Staff never render User list/form before standalone 403; direct API denial remains separately covered. | tests/lab-03/ApplicationShellAuth.test.tsx | Not Run |
| UI-31 | UI | AC-55 | Dirty Create/Edit User NavigationGuard. | Untouched form leaves directly; dirty Cancel/sidebar/back asks confirmation; Keep Editing preserves values; Discard clears and leaves. | tests/lab-03/UserForm.test.tsx | Not Run |
| UI-32 | UI | AC-57 | CommonForm built-in field rendering and semantic span mapping. | All approved field discriminants render correct semantic controls; full/half/third/quarter map to approved Bootstrap responsive classes. | tests/lab-03/CommonForm.test.tsx | Not Run |
| UI-33 | UI | AC-58 | React Hook Form + Zod validation integration. | Invalid submit makes no API callback, field errors associate correctly and first invalid control receives focus; valid normalized values submit. | tests/lab-03/CommonForm.test.tsx | Not Run |
| UI-34 | UI | AC-59 | Generic centralized server-validation error mapping. | Known `details[].field` becomes RHF field error; unknown field/code remains form-level safe message without clobbering values. | tests/lab-03/CommonForm.test.tsx | Not Run |
| UI-35 | UI | AC-60 | Ticket specialized AttachmentSection through CommonForm custom field. | Renderer hosts feature component without taking over Pending/Active/retry/cleanup/idempotency state; field layout remains valid. | tests/lab-03/CommonForm.test.tsx; tests/lab-03/RequesterRegression.test.tsx | Not Run |
| UI-36 | UI | AC-62 | Keyboard/focus/icon-only accessibility across new components. | Role nav, password visibility, lookup, confirmations, queue rows/cards, comment Reply, pagination and Copy are keyboard operable with visible focus and names/tooltips. | tests/lab-03/Accessibility.test.tsx | Not Run |
| UI-37 | UI | AC-38, AC-64 | Safe rendering and secret/non-public-content UI boundaries. | Comment markup remains text; Internal Notes absent for Requester; password hash/token never render; one-time plaintext does not survive navigation/reload. | tests/lab-03/PublicComments.test.tsx; tests/lab-03/UserManagement.test.tsx; tests/lab-03/AuthProvider.test.tsx | Not Run |
| UI-38 | UI | AC-14, AC-16, AC-64 | Standalone error variants and role-aware Back targets. | Safe 403/404/500 copy, no role sidebar, no arbitrary backend copy, deterministic role home Back. | tests/lab-03/ErrorPageAuth.test.tsx | Not Run |

## 9. Planned Responsive Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
| --- | --- | --- | --- | --- | --- | --- |
| RESP-01 | Responsive | AC-61–62 | Login and Change Password at 1440×900, 820×1180, 390×844. | Centered/constrained desktop/tablet and full-width mobile card; guidance/actions readable; keyboard focus/touch targets usable; no horizontal overflow. | e2e/lab-03/responsive-visual.spec.ts | Not Run |
| RESP-02 | Responsive | AC-61–62 | Requester Create/My Tickets/Ticket Detail regression at all required viewports. | Lab 2 responsive form/table/detail/Attachment behavior remains after CommonForm/auth migration with no selector remnants or clipping. | e2e/lab-03/responsive-visual.spec.ts | Not Run |
| RESP-03 | Responsive | AC-61–62 | IT Staff Queue at all required viewports. | Desktop six-column table; tablet/mobile stacked cards; search/filter/page actions usable; no mega-grid or page overflow. | e2e/lab-03/responsive-visual.spec.ts | Not Run |
| RESP-04 | Responsive | AC-61–63 | Staff/Admin Ticket Detail including comments/notes at all required viewports. | Cards/actions wrap safely; owner lookup works; depth-2 comments stay readable; Internal warning remains visible; no overflow. | e2e/lab-03/responsive-visual.spec.ts | Not Run |
| RESP-05 | Responsive | AC-61–62 | User Management list/Create/Edit at all required viewports. | Required User data/actions remain discoverable; forms collapse to single-column mobile; one-time password panel fits without clipping. | e2e/lab-03/responsive-visual.spec.ts | Not Run |
| RESP-06 | Responsive | AC-61–62 | Authenticated AppShell/drawer for all roles. | Desktop/sidebar and mobile drawer show correct role navigation; focus containment/restoration and Logout/password actions remain reachable. | e2e/lab-03/responsive-visual.spec.ts | Not Run |

## 10. Planned Visual Evidence

Visual evidence is checklist-based and complements automated behavioral assertions. It is not a pixel-perfect golden-image contract.

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
| --- | --- | --- | --- | --- | --- | --- |
| VIS-01 | Visual | AC-61–62 | Authentication screenshot evidence. | Login, invalid/safe state, mandatory Change Password and authenticated shell captures match Zen Green/checklist at required viewports. | e2e/lab-03/responsive-visual.spec.ts | Not Run |
| VIS-02 | Visual | AC-61–62 | Requester regression screenshot evidence. | Create Ticket, My Tickets and Requester Detail remain consistent with Lab 2 while showing authenticated identity/new actions. | e2e/lab-03/responsive-visual.spec.ts | Not Run |
| VIS-03 | Visual | AC-61–62 | Staff Queue screenshot evidence. | Operational hierarchy, badges, owner state, filters, table/cards, empty/no-results remain readable and consistent. | e2e/lab-03/responsive-visual.spec.ts | Not Run |
| VIS-04 | Visual | AC-61–63 | Staff/Admin Ticket Detail screenshot evidence. | Workflow actions, owner/IT Priority, Public Comments, Internal Notes and private warning are visually clear and not confused. | e2e/lab-03/responsive-visual.spec.ts | Not Run |
| VIS-05 | Visual | AC-61–62 | User Management screenshot evidence. | List, Create/Edit, safety confirmation and one-time password state remain Zen Green, responsive, and readable. | e2e/lab-03/responsive-visual.spec.ts | Not Run |
| VIS-06 | Visual | AC-14, AC-16, AC-61 | Standalone forbidden/not-found screenshot evidence. | Safe 403/404 variants have no authenticated sidebar or protected leaked data and retain role-aware Back action. | e2e/lab-03/responsive-visual.spec.ts | Not Run |

### 10.1 Screenshot Paths

Required/primary tracked evidence:

```text
docs/lab-03/evidence/screenshots/authentication/
docs/lab-03/evidence/screenshots/staff-queue/
docs/lab-03/evidence/screenshots/staff-ticket-detail/
docs/lab-03/evidence/screenshots/user-management/
```

Requester regression screenshots may be placed under an additional:

```text
docs/lab-03/evidence/screenshots/requester/
```

if useful for final evidence.

Each major required screen should have desktop/tablet/mobile captures where the handout or final visual-evidence checklist requires them.


## 11. Planned End-to-End Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
| --- | --- | --- | --- | --- | --- | --- |
| E2E-01 | E2E | AC-01–05, AC-10, AC-13, AC-18 | Authentication and first-login golden path. | Initial-password User signs in → restricted screen only → invalid/valid password change → forced fresh Login → role shell → Logout → protected direct access blocked; no auth flash on refresh restore. | e2e/lab-03/authentication.spec.ts | Not Run |
| E2E-02 | E2E | AC-02, AC-12, AC-14 | Invalid/inactive Login, rate-limit-safe feedback and role navigation denial. | Unknown/wrong/inactive cases use safe copy; deterministic fixture can reach rate limit; wrong-role URL/API remains forbidden without protected data. | e2e/lab-03/authentication.spec.ts | Not Run |
| E2E-03 | E2E | AC-15–17, AC-31–32 | Authenticated Requester regression golden path. | Requester creates Ticket with Pending Attachment → Active binding → My Tickets/detail/Attachment operations → permitted Cancel or separate ownership-safe reopen fixture; another Requester cannot open resource. Public Comment/thread coverage belongs to E2E-06. | e2e/lab-03/requester-regression.spec.ts | Not Run |
| E2E-04 | E2E | AC-19–27, AC-29–30, AC-33, AC-41–46 | IT Staff Queue and workflow golden path. | Queue search/filter/sort/page → unassigned Ticket → Claim/Open → Start → Request Information/Waiting transaction → explicit Resume fixture → Resolve → confirmed Close; terminal and permission boundaries remain correct. Public Comment thread/Note detail coverage belongs to E2E-06. | e2e/lab-03/staff-ticket-flow.spec.ts | Not Run |
| E2E-05 | E2E | AC-47–56 | Administrator User Management golden path. | List/search/filter/page → Create User → copy one-time password → duplicate validation → Edit → role/activation safety → reset initial password → target forced change on next Login. | e2e/lab-03/user-administration.spec.ts | Not Run |
| E2E-06 | E2E | AC-14, AC-16, AC-23–24, AC-28, AC-34–40, AC-54, AC-63–64 | Direct authorization and communication-boundary regression with real browser auth contexts. | Requester cannot Internal Notes/staff/admin APIs; non-owner Staff owner-only action denied; Admin non-owner vs owner differs; cross-Requester uses 404; Public Comment/reply and Internal Note visibility/creation boundaries remain correct; no protected data appears in response/UI. | e2e/lab-03/staff-ticket-flow.spec.ts; e2e/lab-03/user-administration.spec.ts | Not Run |

## 12. Visual Inspection Checklist

For every required screen and viewport, verify:

- Zen Green tokens and professional internal-application hierarchy remain consistent with Lab 2;
- Bootstrap 5 responsive layout remains the UI framework/layout foundation;
- Inter/system typography is consistent;
- authenticated User name and role are visible in the normal shell;
- role-specific navigation does not present unauthorized destinations;
- no Development Requester selector or Change Requester control remains;
- no clipped labels or overlapping validation;
- no hidden required buttons/actions;
- no unintended page-level horizontal scrolling;
- editable and read-only fields are visibly distinct;
- required markers and associated validation messages remain visible;
- busy buttons preserve their action label and layout;
- Login failure copy does not reveal unknown/inactive/wrong-password distinction;
- password guidance fits at all viewports;
- Staff Queue desktop is not an unreadable mega-grid;
- Staff Queue mobile/tablet cards preserve Ticket Number, Summary, IT Priority, Status, Owner, and useful metadata;
- Status, Requested Priority, IT Priority, Role, and ownership state always contain visible text;
- `Unassigned` is explicit rather than represented by an empty cell;
- semantic lifecycle actions are understandable without a generic status dropdown;
- owner lookup/reassign/unassign actions are reachable and confirmations state their side effects;
- Public Comments and Internal Notes are unmistakably different;
- the Internal Notes private-warning remains visible;
- Requester never sees Internal Note content or controls;
- comment depth 2 remains readable on mobile;
- reply target `@Name` is understandable and does not create excessive indentation;
- Load More / View More Comments/Replies remain operable;
- one-time initial password warning is prominent and Copy action is reachable;
- plaintext one-time password is not retained after leaving/reloading the success state;
- Create/Edit User remains intentionally simple;
- self/last-Admin unsafe controls do not misleadingly appear as successful actions;
- destructive/security confirmations have explicit action labels;
- visible focus exists for keyboard users;
- opening/closing modals manages focus correctly;
- icon-only controls have accessible names plus visible hover/focus labels;
- AuthProvider bootstrap produces no Login/protected-role flash;
- standalone `/error` page has no authenticated sidebar;
- safe 403/404 pages do not reveal protected resource data;
- role-aware Back action points to a safe role destination.


## 13. Acceptance-Criteria Traceability Matrix

Every Acceptance Criterion maps to one or more planned tests/evidence IDs. This matrix must be updated if the specification renumbers or changes an AC.

| Acceptance Criterion | Planned Tests / Evidence |
| --- | --- |
| AC-01 | UNIT-03, UNIT-06, API-01, PG-04, UI-02, E2E-01 |
| AC-02 | UNIT-06, API-02, UI-03, E2E-01, E2E-02 |
| AC-03 | UNIT-06, API-03, UI-04, E2E-01 |
| AC-04 | UNIT-01, UNIT-06, API-04, UI-04, E2E-01 |
| AC-05 | UNIT-01, UNIT-06, API-05, UI-05, E2E-01 |
| AC-06 | UNIT-04, API-06, PG-05 |
| AC-07 | UNIT-03, UNIT-04, API-07, PG-05, UI-08 |
| AC-08 | UNIT-04, API-08, PG-05 |
| AC-09 | UI-08 |
| AC-10 | UNIT-04, API-09, PG-05, UI-06, E2E-01 |
| AC-11 | UNIT-04, API-10, PG-05, UI-06 |
| AC-12 | UNIT-05, API-11, PG-06, UI-03, E2E-02 |
| AC-13 | UNIT-03, UNIT-07, API-12, UI-07, E2E-01 |
| AC-14 | API-13, UI-06, UI-07, UI-38, VIS-06, E2E-02, E2E-06 |
| AC-15 | UNIT-18, API-14, UI-09, E2E-03 |
| AC-16 | API-15, UI-11, UI-38, VIS-06, E2E-03, E2E-06 |
| AC-17 | UNIT-18, API-16, API-17, API-55, PG-16, UI-09, UI-10, UI-11, E2E-03, DATA-05, DATA-06 |
| AC-18 | UI-01, UI-08, E2E-01 |
| AC-19 | UNIT-08, API-18, PG-07, PG-09, UI-16, E2E-04 |
| AC-20 | UNIT-08, API-19, PG-07, PG-08, UI-16, E2E-04 |
| AC-21 | UNIT-08, API-20, PG-08, UI-17, E2E-04 |
| AC-22 | UNIT-08, API-21, PG-08, UI-17, E2E-04 |
| AC-23 | UNIT-08, API-22, UI-15, E2E-04, E2E-06 |
| AC-24 | UNIT-08, API-23, API-55, UI-15, E2E-04, E2E-06 |
| AC-25 | API-24, UI-15, UI-18, E2E-04 |
| AC-26 | UNIT-09, API-25, UI-19, E2E-04 |
| AC-27 | UNIT-10, API-26, PG-10, UI-20, E2E-04 |
| AC-28 | API-27, UI-21, E2E-06 |
| AC-29 | UNIT-09, API-28, UI-22, E2E-04 |
| AC-30 | UNIT-09, API-29, UI-22, E2E-04 |
| AC-31 | API-30, PG-11, UI-12, E2E-03 |
| AC-32 | API-31, UI-12, E2E-03 |
| AC-33 | UNIT-09, API-32, E2E-04 |
| AC-34 | UNIT-11, API-33, UI-23, E2E-06 |
| AC-35 | UNIT-11, API-34, PG-14, UI-23, E2E-06 |
| AC-36 | UNIT-11, API-35, PG-14, UI-24, E2E-06 |
| AC-37 | UNIT-11, API-36, PG-14, UI-24, E2E-06 |
| AC-38 | UNIT-11, API-37, UI-24, UI-37, E2E-06 |
| AC-39 | UNIT-12, API-38, UI-25, E2E-06 |
| AC-40 | UNIT-12, API-39, PG-15, UI-25, E2E-06 |
| AC-41 | UNIT-13, UNIT-17, API-40, UI-13, UI-14, E2E-04 |
| AC-42 | UNIT-13, UNIT-17, API-41, UI-13, UI-14, E2E-04 |
| AC-43 | UNIT-13, UNIT-17, API-42, UI-13, UI-14, E2E-04 |
| AC-44 | UNIT-13, UNIT-17, API-43, UI-13, UI-14, E2E-04 |
| AC-45 | UNIT-13, UNIT-17, API-44, UI-13, UI-14, E2E-04 |
| AC-46 | UNIT-13, UNIT-17, API-45, UI-14, E2E-04 |
| AC-47 | UNIT-14, API-46, UI-26, E2E-05 |
| AC-48 | UNIT-02, UNIT-15, API-47, PG-04, UI-27, E2E-05 |
| AC-49 | UNIT-15, API-48, PG-03, UI-27, E2E-05 |
| AC-50 | UNIT-15, API-49, PG-13, UI-28, E2E-05 |
| AC-51 | UNIT-15, API-50, UI-28, E2E-05 |
| AC-52 | UNIT-15, API-51, PG-12, UI-28, E2E-05 |
| AC-53 | UNIT-02, UNIT-15, API-52, PG-04, UI-29, E2E-05 |
| AC-54 | API-53, UI-30, E2E-05, E2E-06 |
| AC-55 | UI-31, E2E-05 |
| AC-56 | UI-27, E2E-05 |
| AC-57 | UI-32, DATA-07 |
| AC-58 | UI-33, DATA-07 |
| AC-59 | UI-34, DATA-07 |
| AC-60 | UI-35, DATA-07 |
| AC-61 | RESP-01, RESP-02, RESP-03, RESP-04, RESP-05, RESP-06, VIS-01, VIS-02, VIS-03, VIS-04, VIS-05, VIS-06, DATA-08 |
| AC-62 | UI-36, RESP-01, RESP-02, RESP-03, RESP-04, RESP-05, RESP-06, VIS-01, VIS-02, VIS-03, VIS-04, VIS-05, DATA-08 |
| AC-63 | UI-25, RESP-04, VIS-04, E2E-06, DATA-08 |
| AC-64 | API-54, API-55, PG-02, PG-04, UI-37, UI-38, E2E-06, DATA-04 |
| AC-65 | PG-01, PG-02, PG-16, DATA-02, DATA-03 |
| AC-66 | UNIT-16, PG-17, DATA-10 |

## 13.1 Canonical FR/BR/AC Traceability

This is the canonical requirement ownership matrix. Ranges are inclusive. Every
FR-01 through FR-66, BR-01 through BR-95, and AC-01 through AC-66 appears in
exactly one primary-owner row below. Issue 7 owns final evidence and reruns; it
does not replace the implementation owner’s focused gate.

| Primary Issue | Implementation owner and API/UI seam | FR IDs | BR IDs | AC IDs | Primary verification artifacts |
| --- | --- | --- | --- | --- | --- |
| Issue 2 | User/session/auth backend: /api/auth/*, auth middleware, User/UserSession/LoginRateLimit Prisma models, migration/seed/maintenance, centralized transport/error middleware. | FR-01–FR-12; FR-61–FR-63; FR-65–FR-66 | BR-01–BR-02; BR-06–BR-32 | AC-01–AC-14; AC-64–AC-66 | UNIT-01–UNIT-06; UNIT-16; API-01–API-13; API-54; PG-01–PG-02; PG-04–PG-06; PG-17; DATA-02–DATA-04; DATA-10 |
| Issue 3 | AuthProvider and authenticated shell: /api/auth/refresh and /api/auth/me consumers, route guards, CommonForm, useManagedForm, shared form constants, Bootstrap layout. | FR-50–FR-60 | BR-87–BR-95 | AC-18; AC-57–AC-62 | UI-01–UI-08; UI-32–UI-36; UI-38; RESP-01; RESP-06; E2E-01–E2E-02; DATA-07 |
| Issue 4 | Authenticated Requester scope: /api/users/me/tickets and /api/users/me/attachments consumers, Create Ticket, My Tickets, base Ticket Detail, ownership-safe 404, resolution/reopen/cancel UI. Public Comment behavior is consumed later through the Issue 6 communication seam. | FR-13–FR-18 | BR-03; BR-05; BR-59; BR-61–BR-63 | AC-15–AC-17; AC-31–AC-32 | UNIT-07; UNIT-18; API-14–API-17; API-30–API-31; PG-11; PG-16; UI-09–UI-12; RESP-02; E2E-03; DATA-05–DATA-06 |
| Issue 5 | Staff Queue and Ticket workflow: /api/tickets queue/detail, ownership and semantic lifecycle actions, existing Staff/Admin Attachment reads, QueryBuilder boundary, and queue/detail workflow UI. | FR-19–FR-34; FR-64 | BR-47–BR-58; BR-60; BR-64–BR-67; BR-78–BR-81; BR-83–BR-86 | AC-19–AC-27; AC-29–AC-30; AC-33; AC-41–AC-46 | UNIT-08–UNIT-10; UNIT-13; UNIT-17; API-18–API-26; API-28–API-29; API-32; API-40–API-45; API-55; PG-07–PG-10; UI-13–UI-20; UI-22; RESP-03; E2E-04 |
| Issue 6 | Public Comments integrated into Requester/Staff Detail, Internal Notes, and Administrator User Management under /api/admin/users. Consumes Issue 4’s Requester Detail seam and Issue 5’s Staff Ticket Detail seam. | FR-35–FR-49 | BR-04; BR-33–BR-46; BR-68–BR-77; BR-82 | AC-28; AC-34–AC-40; AC-47–AC-56; AC-63 | UNIT-11–UNIT-12; UNIT-14–UNIT-15; API-27; API-33–API-39; API-46–API-53; PG-03; PG-12–PG-15; UI-21; UI-23–UI-31; UI-37; RESP-04–RESP-05; E2E-05–E2E-06 |

Issue 1 (#59) is documentation-only: it records this contract, the review
record, DATA-01, and DATA-09. It neither performs nor claims product
implementation, schema migration, branch creation, Pull Request activity, or
test execution. The required working-branch rule is recorded below as delivery
plan, not as completed workflow evidence.

## 14. Implementation-Issue Test Ownership and Close Gates

Feature-specific tests must be written and passing before the corresponding
implementation Issue is closed. The seven-Issue plan is fixed:

| Issue | Scope | Depends on | Focused close gate before Done |
| --- | --- | --- | --- |
| Issue 1 (#59) | Lab 3 engineering contract and delivery plan only. | Lab 2 contract | Four contract documents, canonical traceability, safe command matrix, and DATA-01/DATA-09 planning review. No product implementation. |
| Issue 2 | Authoritative User model, migration, auth/session backend, rate limiting, transport, seed, and maintenance. | Issue 1 | Its owned UNIT/API/PG/DATA rows; guarded PostgreSQL migration/seed/cleanup; server build. |
| Issue 3 | AuthProvider, Login, Change Password, authenticated shell/guards, CommonForm foundation. | Issue 2 | Its owned UI rows; client build; required auth and shell Playwright E2E/responsive evidence. |
| Issue 4 | Authenticated Requester scope and Lab 2 Create Ticket/My Tickets/Ticket Detail/Attachment regression. | Issues 2–3 | Its owned UNIT/API/PG/UI/DATA rows; requester regression; required requester Playwright E2E/responsive evidence. Public Comment implementation is not required to close this Issue. |
| Issue 5 | IT Staff Queue, ownership, priority, semantic Ticket workflow, existing Staff/Admin Attachment reads, and base Staff Ticket Detail seam. | Issues 2–3 | Its owned UNIT/API/PG/UI rows; queue/workflow checks; required Queue/workflow Playwright E2E and responsive evidence. |
| Issue 6 | Consumes Issue 4 Requester Ticket Detail and Issue 5 Staff Ticket Detail seams for Public Comments, Internal Notes, and Administrator User Management. | Issues 2–5 | Its owned UNIT/API/PG/UI rows; required Staff Detail/Admin Playwright E2E/responsive evidence. |
| Issue 7 | Final rerun, evidence snapshot, staging/release verification. | Issues 2–6 | Rerun all completed suites and record truthful results; it cannot replace any earlier focused gate. |

Dependency DAG:

~~~text
Issue 1
   |
   v
Issue 2 -----> Issue 3
   |             |
   +-----------> Issue 4
   +-----------> Issue 5 -----> Issue 6
                                  |
                                  v
                           Issue 7 final gate
~~~

Concrete cross-Issue seams:

- Issue 2 exposes the authoritative User, UserSession, authentication,
  authorization-context, and safe transport backend.
- Issue 3 consumes Issue 2 for AuthProvider, Login/Change Password, shell,
  route guards, and CommonForm consumers.
- Issue 4 consumes Issues 2–3 for authenticated Requester scope and regression.
- Issue 5 owns the shared Staff Queue, ownership, priority, semantic workflow,
  existing Staff/Admin Attachment reads, and base Staff Ticket Detail seam.
- Issue 6 consumes Issue 4’s Requester Ticket Detail seam and Issue 5’s Staff
  Ticket Detail seam for Public Comments, Internal Notes, and administration.
- Issue 7 consumes all implementation outputs and performs release reruns only.

Every implementation branch uses
feature/<actual-issue-number>-<short-kebab-name>. Issue 1 is the current
feature/59-lab3-engineering-contract branch; Issue 2–6 branch numbers and names
must come from their actual approved GitHub Issues, not invented planning keys.

### 14.1 Canonical primary test ownership

The following is the only primary ownership mapping. Ranges are inclusive. A
test ID appears in one primary row only. Issue 7’s rerun list below is not a
second owner.

| Primary Issue | Primary owned test IDs |
| --- | --- |
| Issue 1 | DATA-01, DATA-09 |
| Issue 2 | UNIT-01–UNIT-06; UNIT-16; API-01–API-13; API-54; PG-01–PG-02; PG-04–PG-06; PG-17; DATA-02–DATA-04; DATA-10 |
| Issue 3 | UI-01–UI-08; UI-32–UI-36; UI-38; RESP-01; RESP-06; E2E-01–E2E-02; DATA-07 |
| Issue 4 | UNIT-07; UNIT-18; API-14–API-17; API-30–API-31; PG-11; PG-16; UI-09–UI-12; RESP-02; E2E-03; DATA-05–DATA-06 |
| Issue 5 | UNIT-08–UNIT-10; UNIT-13; UNIT-17; API-18–API-26; API-28–API-29; API-32; API-40–API-45; API-55; PG-07–PG-10; UI-13–UI-20; UI-22; RESP-03; E2E-04 |
| Issue 6 | UNIT-11–UNIT-12; UNIT-14–UNIT-15; API-27; API-33–API-39; API-46–API-53; PG-03; PG-12–PG-15; UI-21; UI-23–UI-31; UI-37; RESP-04–RESP-05; E2E-05–E2E-06 |
| Issue 7 | VIS-01–VIS-06; DATA-08; DATA-11 — final evidence ownership only |

Completeness check for primary ownership:

~~~text
UNIT-01–UNIT-18
API-01–API-55
PG-01–PG-17
UI-01–UI-38
RESP-01–RESP-06
VIS-01–VIS-06
E2E-01–E2E-06
DATA-01–DATA-11
~~~

### 14.2 Focused close-gate commands

Commands below are named against the repository scripts and planned Lab 3
paths. They are required gates, not claims that the tests have already run.
Every focused test title must carry the owning `@issue-N` tag from Section 2;
unfiltered shared files do not close an Issue.

Issue 2:

~~~bash
cd server
npm test -- tests/lab-03/PasswordService.test.ts tests/lab-03/InitialPasswordGenerator.test.ts tests/lab-03/JwtService.test.ts tests/lab-03/SessionService.test.ts tests/lab-03/LoginRateLimitService.test.ts tests/lab-03/AuthService.test.ts tests/lab-03/MaintenanceService.test.ts tests/lab-03/auth.api.test.ts tests/lab-03/authorization.api.test.ts tests/lab-03/auth-transport.api.test.ts tests/lab-03/error-contract.api.test.ts -t '@issue-2'
NODE_ENV=test TEST_DATABASE_URL=<dedicated_lab3_test_url> npm test -- tests/lab-03/postgres/migration-upgrade.postgres.test.ts tests/lab-03/postgres/schema-contract.postgres.test.ts tests/lab-03/postgres/auth-session.postgres.test.ts tests/lab-03/postgres/rate-limit.postgres.test.ts tests/lab-03/postgres/maintenance.postgres.test.ts -t '@issue-2'
npm run build
~~~

Issue 2 also runs the guarded migration deployment, `npm run prisma:seed` twice,
and `npm run maintenance:cleanup` twice from Section 4.7, recording DATA-02,
DATA-03, DATA-10, and the sanitized target. The Issue 2 implementation must
make seed and maintenance fail closed when `NODE_ENV=test`,
`TEST_DATABASE_URL`, the captured baseline targets, or the explicit
`DATABASE_URL = TEST_DATABASE_URL` and `DIRECT_URL = TEST_DATABASE_URL`
overrides are absent, invalid, or inconsistent. Baseline variables are
operator-local safety inputs and must never be written to evidence.

Issue 3:

~~~bash
cd client
npm install
npm test -- tests/lab-03/AuthProvider.test.tsx tests/lab-03/Login.test.tsx tests/lab-03/ChangePassword.test.tsx tests/lab-03/ApplicationShellAuth.test.tsx tests/lab-03/CommonForm.test.tsx tests/lab-03/Accessibility.test.tsx tests/lab-03/ErrorPageAuth.test.tsx -t '@issue-3'
npm run build
cd ..
npm run test:e2e -- --grep '@issue-3' e2e/lab-03/authentication.spec.ts e2e/lab-03/responsive-visual.spec.ts
~~~

Issue 4:

~~~bash
cd server
NODE_ENV=test TEST_DATABASE_URL=<dedicated_lab3_test_url> npm test -- tests/lab-03/AuthorizationService.test.ts tests/lab-03/RequesterRegressionService.test.ts tests/lab-03/authorization.api.test.ts tests/lab-03/requester-regression.api.test.ts tests/lab-03/requester-attachments.api.test.ts tests/lab-03/postgres/requester-regression.postgres.test.ts tests/lab-03/postgres/ticket-workflow.postgres.test.ts -t '@issue-4'
NODE_ENV=test TEST_DATABASE_URL=<dedicated_lab3_test_url> npm test -- tests/lab-01 tests/lab-02
cd ../client
npm test -- tests/lab-03/RequesterRegression.test.tsx -t '@issue-4'
npm test -- tests/lab-02/CreateTicket.test.tsx tests/lab-02/MyTickets.test.tsx tests/lab-02/RequesterTicketDetail.test.tsx
npm test -- tests/lab-01 tests/lab-02
npm run build
cd ..
npm run build --prefix server
npm run test:e2e -- --grep '@issue-4' e2e/lab-03/requester-regression.spec.ts e2e/lab-03/responsive-visual.spec.ts
~~~

Issue 5:

~~~bash
cd server
NODE_ENV=test TEST_DATABASE_URL=<dedicated_lab3_test_url> npm test -- tests/lab-03/TicketOwnershipService.test.ts tests/lab-03/TicketWorkflowService.test.ts tests/lab-03/StaffQueueQueryValidator.test.ts tests/lab-03/QueryBuilderRegression.test.ts tests/lab-02/QueryBuilder.test.ts tests/lab-03/staff-ticket-detail.api.test.ts tests/lab-03/comments-notes.api.test.ts tests/lab-03/staff-queue.api.test.ts tests/lab-03/postgres/ticket-ownership.postgres.test.ts tests/lab-03/postgres/ticket-workflow.postgres.test.ts -t '@issue-5'
cd ../client
npm test -- tests/lab-03/StaffTicketQueue.test.tsx tests/lab-03/StaffTicketDetail.test.tsx -t '@issue-5'
npm run build
cd ..
npm run build --prefix server
npm run test:e2e -- --grep '@issue-5' e2e/lab-03/staff-ticket-flow.spec.ts e2e/lab-03/responsive-visual.spec.ts
~~~

Issue 6:

~~~bash
cd server
NODE_ENV=test TEST_DATABASE_URL=<dedicated_lab3_test_url> npm test -- tests/lab-03/PublicCommentService.test.ts tests/lab-03/InternalNoteService.test.ts tests/lab-03/UserQueryValidator.test.ts tests/lab-03/UserService.test.ts tests/lab-03/comments-notes.api.test.ts tests/lab-03/users-admin.api.test.ts tests/lab-03/authorization.api.test.ts tests/lab-03/postgres/users-admin.postgres.test.ts tests/lab-03/postgres/comments-notes.postgres.test.ts -t '@issue-6'
cd ../client
npm test -- tests/lab-03/PublicComments.test.tsx tests/lab-03/InternalNotes.test.tsx tests/lab-03/UserManagement.test.tsx tests/lab-03/UserForm.test.tsx tests/lab-03/StaffTicketDetail.test.tsx -t '@issue-6'
npm run build
cd ..
npm run build --prefix server
npm run test:e2e -- --grep '@issue-6' e2e/lab-03/staff-ticket-flow.spec.ts e2e/lab-03/user-administration.spec.ts e2e/lab-03/responsive-visual.spec.ts
~~~

The PostgreSQL commands in the Issue 2 gate use the captured-baseline preflight
and explicit `DATABASE_URL = TEST_DATABASE_URL` plus
`DIRECT_URL = TEST_DATABASE_URL` overrides in Section 4.7. The same guard
applies to PG-03 and PG-12–PG-16 in Issue 6. A focused gate is closed
only after its listed tests, required build, and required browser evidence
pass; “when available” is not a valid substitute.

### 14.3 Issue 7 final rerun/release gate

Issue 7 performs these as explicit reruns:

~~~text
RERUN UNIT-01–UNIT-18
RERUN API-01–API-55
RERUN PG-01–PG-17
RERUN UI-01–UI-38
RERUN RESP-01–RESP-06
RERUN E2E-01–E2E-06
RERUN DATA-02–DATA-07 and DATA-10
~~~

Issue 7 also owns the first/final visual evidence rows VIS-01–VIS-06, DATA-08,
and DATA-11. These are final evidence ownership, not replacements for focused
Issue 2–6 gates.

After all focused gates pass on lab3-staging, Issue 7 runs and records:

~~~bash
(cd server && NODE_ENV=test TEST_DATABASE_URL=<dedicated_lab3_test_url> npm test)
(cd client && npm test)
(cd server && npm run build)
(cd client && npm run build)
npm run test:e2e -- e2e/lab-03
npm run test:e2e -- e2e/lab-03/responsive-visual.spec.ts
~~~

On the guarded disposable PostgreSQL target, Issue 7 repeats migration status
preflight, committed migration deployment, npm run prisma:seed twice, and npm
run maintenance:cleanup twice. It records sanitized target identity, counts,
exit results, screenshot paths under docs/lab-03/evidence/screenshots/, and any
blocked/skipped result. It then verifies the lab3-staging review/PR history and
the single release PR to main. No direct main/lab3-staging development and no
database reset are permitted.


## 15. Non-Automated Delivery Evidence

Mocked Unit/API tests must not be described as proof of real PostgreSQL constraints/concurrency, Git history, screenshots, secret hygiene, or course workflow. The following evidence remains separately required.

| Evidence ID | Type | Requirement / AC | Required Proof | Expected Result / Final |
| --- | --- | --- | --- | --- |
| DATA-01 | Delivery | Handout Spec DD | Required `docs/lab-03/` files exist before main implementation work and remain mutually consistent. | Rendered specification/tests/ui/api documents are committed; reviewer/ai_use files are added through the Lab workflow. | Not Run |
| DATA-02 | Migration | AC-65 | Committed migration upgrades populated Lab 2 and fresh schema. | Migration SQL/Prisma history is committed; no drop/recreate shortcut discards Ticket/Attachment history. | Not Run |
| DATA-03 | Seed | AC-65 | Idempotent synthetic Lab 3 seed. | At least required Requester/IT Staff/Admin accounts plus realistic tickets/comments/notes exist; unchanged rerun makes no duplicates. | Not Run |
| DATA-04 | Security | AC-64 | Secrets and credential-storage inspection. | No real secret, JWT signing secret, refresh plaintext, password plaintext/hash exposure, DB URL, or one-time password is committed/logged in prohibited locations. | Not Run |
| DATA-05 | Regression | AC-17 | Full Lab 1/Lab 2 automated regression alongside Lab 3. | Existing Lab 1/Lab 2 server/client tests pass or are deliberately evolved with equivalent/new coverage where authentication changes the old contract. | Not Run |
| DATA-06 | Repository | AC-17 | Removal of temporary Requester identity mechanism. | No active `/requesters` route, Change Requester action, `X-Requester-Id` client injection, or sessionStorage requester identity remains in Lab 3 app paths. | Not Run |
| DATA-07 | Tooling | AC-57–60 | Package manifests/lockfiles contain the approved form/auth/test dependencies without introducing another UI framework. | Bootstrap 5 remains UI framework; RHF/Zod/auth libraries are pinned through committed lockfiles; root Playwright remains local/pinned. | Not Run |
| DATA-08 | Visual | AC-61–63 | Required screenshot artifact directories and exact viewport evidence exist. | Tracked evidence exists under `docs/lab-03/evidence/screenshots/` and is readable and passes Section 12 checklist. | Not Run |
| DATA-09 | Test DD | All AC | Handout-required Lab 3 test filenames exist as real files, with additional modular tests allowed. | Required server/client/E2E filenames are present and execute; every AC has planned and final traceability. | Not Run |
| DATA-10 | Maintenance | AC-66 | Documented maintenance command and safe repeat-run evidence. | Command targets only eligible session/rate-limit technical state and can be repeated safely. | Not Run |
| DATA-11 | Workflow | DoD | Feature branches/PRs/focused close gates follow Lab 3 staging flow. | No implementation Issue is marked Done before its owned focused tests pass; final release regression does not replace feature gates. | Not Run |

### 15.1 Explicit Security and Exclusion Evidence

The following items deserve explicit review because their absence is part of the Lab 3 contract:

| Contract item | Evidence | Final |
| --- | --- | --- |
| No `X-Requester-Id` identity mechanism in Lab 3 app traffic | DATA-06 + API-14 + browser network/E2E inspection | Not Run |
| No self-registration endpoint/UI | route inventory + authorization/API tests | Not Run |
| No User delete endpoint/UI | route inventory + User Management UI/API tests | Not Run |
| No Public Comment edit/delete | API-37 + UI-24 | Not Run |
| No Internal Note edit/delete | API-39 + UI-25 | Not Run |
| No Staff/Admin Attachment upload/removal | API-55 + route inventory | Not Run |
| No access JWT in localStorage/sessionStorage | UI-08 + E2E auth storage inspection | Not Run |
| No refresh plaintext in database | PG-04 | Not Run |
| No password plaintext in database | PG-04 + DATA-04 | Not Run |
| No one-time initial password in later User GET/history/Web Storage/logs | API-52 + UI-27/UI-29/UI-37 + DATA-04 | Not Run |
| No role trust solely from JWT | UNIT-07 + API-13 + session/user-state tests | Not Run |
| No zero-active-Administrator state under concurrency | API-51 + PG-12 | Not Run |

### 15.2 Final Release Snapshot Placeholder

Do not fill this section until the implementation/release integration actually runs.

Final release evidence must eventually record:

- final `main` commit SHA;
- exact date/time of verification;
- sanitized PostgreSQL test targets;
- backend full-suite count/result;
- frontend full-suite count/result;
- PostgreSQL integration count/result;
- Playwright E2E/responsive/visual result;
- client/server build result;
- migration + repeated seed result;
- maintenance repeat-run result;
- required screenshot paths;
- any blocked/skipped test and why.

A release is not considered green if a required test is skipped/disabled merely to obtain a passing summary.
