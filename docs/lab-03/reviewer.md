# Lab 3 — Peer Review Record  (fill this in)

**Author:** 67070503477 — GitHub: @oangsa
**Peer reviewer:** 67070503405 — GitHub: @kittipichcha

## Pull Requests I authored (reviewed by my partner)

| PR | Branch | Reviewer verdict |
|----|--------|------------------|
| [#67](https://github.com/oangsa/TokTickIT/pull/67) | feature/60-lab3-data-auth-backend | Approved after changes requested; merged |
| [#68](https://github.com/oangsa/TokTickIT/pull/68) | feature/61-commonform-auth-frontend | Approved after changes requested; merged |
| [#69](https://github.com/oangsa/TokTickIT/pull/69) | feature/62-requester-auth-migration | Approved 2026-09-25 after earlier changes requested; merged |
| [#70](https://github.com/oangsa/TokTickIT/pull/70) | feature/63-staff-queue-ticket-workflow | Approved; merged |
| [#71](https://github.com/oangsa/TokTickIT/pull/71) | feature/64-communication-admin-users | Approved after review comments; merged |
| [#72](https://github.com/oangsa/TokTickIT/pull/72)–[#74](https://github.com/oangsa/TokTickIT/pull/74) | Later shared refactor/fix branches | Merged; no recorded GitHub reviews as of 2026-09-26 |
| [#75](https://github.com/oangsa/TokTickIT/pull/75) | feature/65-lab3-final-verification-release | Approved with minor documentation condition 2026-09-26; open, not merged |

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

Partner: 67070503405 — GitHub: @kittipichcha. Reviews below are recorded in the
partner repository's GitHub history.

| PR | Branch | Review outcome |
|----|--------|----------------|
| [#44](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/44) — Sprint 3 engineering contract | `feature/issue-34-sprint-3-contract` | Changes requested twice; approved 2026-09-11; merged |
| [#45](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/45) — align Ticket summary/description limits | `feature/issue-34-sprint-3-contract` | Approved 2026-09-15; merged |
| [#46](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/46) — Issue #35 identity, migration, authentication | `feature/issue-35-identity-db-migration-auth` | Changes requested through review rounds; approved 2026-09-19; merged |
| [#47](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/47) — Issue #37 authorization and Requester migration | `feature/issue-37-authorization-requester-migration` | Changes requested; approved 2026-09-21; merged |
| [#48](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/48) — Issue #41 Administrator User Management | `feature/issue-41-admin-user-management` | Changes requested through review rounds; approved 2026-09-25; merged |
| [#49](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/49) — Issue #38 Staff Ticket Operations | `feature/issue-38-staff-ticket-operations` | Changes requested through review rounds; approved 2026-09-24; merged |

### Review findings and partner responses

- **PR #44 — Requirement freeze.** Requested explicit migrated-Requester initial-password behavior and tests, a concrete database contract, frozen Queue query/session rules, meaningful AC-to-test mappings, and an exact password policy. The later revision documented the decisions and aligned the specifications and planned tests; approved after re-review.
- **PR #45 — Ticket text limits.** Reviewed the follow-up aligning Ticket summary and description limits with `api-spec.md`; approved with `lgtm!`.
- **PR #46 — Identity, migration, authentication.** Requested atomic and resumable migrations, populated Lab 2 data-preservation checks, canonical client API-error parsing and Ticket-number allocation, safe idempotent seeding, and correct migration-resume identity checks. Later rounds also covered CSRF recovery, logout failure handling, Attachment ownership, `itPriority`, and `/me` error states. Approved after the fixes and review evidence were updated. Review rounds found a credential-bearing database URL in earlier committed logs; later evidence was sanitized. This record does not attest to credential rotation or Git-history cleanup.
- **PR #47 — Authorization cutover.** Verified session-derived Requester identity, ownership-safe `404` behavior, and removal of the Development Requester selector/header/routes. Requested My Tickets status filters, sort keys, invalid-query behavior, and matching regression coverage; approved after follow-up.
- **PR #48 — Administrator User Management.** Requested role-appropriate entry/navigation, correct last-active-Administrator safeguards under concurrency, self-reset and password-change state synchronization, accessible modal behavior, mobile layout, success feedback, and Issue #41 scope separation from Staff work. Follow-up reviews verified those findings resolved. The final review concerned stale `mustChangePassword` state; approval followed on 2026-09-25.
- **PR #49 — Staff Ticket Operations.** Requested role-aware navigation, Attachment visibility, Queue pagination and responsive behavior, keyboard/focus handling, safe mutation success despite refresh failures, explicit error/retry states, accessible field-error associations, and complete transition/authorization test coverage. Approved after follow-up reviews addressed the findings. Approval included follow-up notes to refresh reported test totals and leave final Lab 3 E2E/release verification to Issue #42.

Review evidence was read from GitHub PR descriptions, submitted reviews, and discussion. Test counts in those reviews were author-reported unless explicitly stated otherwise; I did not independently rerun the partner branches' suites as part of these reviews.


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

GitHub shows feature PRs #67–#71 merged into `lab3-staging` with recorded approvals, including the subsequent `APPROVED` review for #69 from @kittipichcha at 2026-09-25 07:15:07 UTC. PRs #72–#74 were merged without recorded GitHub reviews. PR #75 remains open and unmerged at head `69671ea9321ae1c57ebbecc49faf635475cd78fb`; @kittipichcha submitted an `APPROVED` review on 2026-09-26 03:04:56 UTC with a minor condition to refresh this reviewer record with current-head evidence before merge. The required reviewed-integration claim remains unproven for #72–#74. No `lab3-staging` to `main` release PR exists.

Proposed release PR title: **Lab 3: authenticated requester, staff workflow, administrator management, and verification**.

Proposed release PR body (prepare only; refresh results after Issue 7 merges):

> ## Scope
>
> Merge `lab3-staging` into `main` after Issues 2–7 and feature PRs #67–#71. Lab 3 adds server-authoritative authentication/roles, authenticated Requester flows, Staff Queue and Ticket workflow, Public Comments/Internal Notes, and Administrator User Management.
>
> ## Verification
>
> Guarded disposable PostgreSQL: fresh migration and populated Lab 2 upgrade passed; seed was idempotent; cleanup was repeatable and preserved business rows. Server 1,052/1,052 and client 365/365 tests passed; both builds passed. Lab 3 Playwright passed 58/58, including 30 responsive cases; complete Playwright passed 70/70 locally. Screenshots: `docs/lab-03/evidence/screenshots/`.
>
> ## Review before release
>
> PR #75 is approved at head `69671ea9321ae1c57ebbecc49faf635475cd78fb`; GitHub's Lab 3 Global Verification run #93 succeeded on that head. Refresh this record before merging. PRs #72–#74 still have no recorded reviews; document their disposition before claiming the reviewed-integration workflow complete. Rerun integration checks on merged `lab3-staging` before opening the release PR.

**PR #75 review response and current-head evidence (2026-09-26).** The changes described below are committed at head `69671ea9321ae1c57ebbecc49faf635475cd78fb`. GitHub recorded @kittipichcha's `APPROVED` review at 2026-09-26 03:04:56 UTC with a minor condition to update this reviewer record with the real current SHA and CI results before merge. The requested state is recorded here; this documentation update remains uncommitted locally.

On that head, [Lab 3 Global Verification run #93](https://github.com/oangsa/TokTickIT/actions/runs/36158575024) completed successfully: server job passed migration checks, provisioning, seed and cleanup, all Lab 3 Playwright suites, full server regression, and server build; client job passed full client regression and client build. [Project Automation run #256](https://github.com/oangsa/TokTickIT/actions/runs/36158574988) also succeeded. Job summaries expose no test counts, so none are attributed to this SHA. Earlier guarded local counts (Playwright 70/70, server 1,052/1,052, client 365/365, and both builds) remain recorded as prior local-run evidence; earlier GitHub runs [36128542774](https://github.com/oangsa/TokTickIT/actions/runs/36128542774) and [36128538609](https://github.com/oangsa/TokTickIT/actions/runs/36128538609) passed at `c556d37` before the current head. PR #75 remains open and unmerged. PRs #72–#74 still have no formal reviews. GitGuardian's `requester-auth.ts` alert points to a runtime-generated value and ignored local handoff; reviewed evidence found no committed real password in that occurrence.

## Exact GitHub review submissions — Lab 3

This archive reproduces formal GitHub review bodies for the six partner PRs and the nine PRs I authored. Wording is copied verbatim. CRLF line endings are normalized; Markdown hard-break spaces are represented with `<br>`. GitHub returned three rich-text bodies as HTML; only their outer document/fragment wrappers were removed. One synthetic CI-only JWT signing value is redacted to avoid copying a secret-shaped value into repository documentation. Empty review bodies are marked as empty. GitHub returned no inline review threads for these PRs.

### Reviews I submitted for my partner

#### [PR #44 — Sprint 3 engineering contract](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/44)

<details>
<summary>2026-09-10T12:43:41Z — CHANGES_REQUESTED by @oangsa</summary>

# PR #44 Review — Sprint 3 Engineering Contract

**Verdict: Request Changes**

I reviewed this PR against the authoritative Lab 3 handout only. I did **not** compare it against implementation decisions from another team's TokTickIT project.

Overall, the PR is structurally strong. It includes the expected Lab 3 documentation, numbered FR/BR requirements, an authorization matrix, status-transition matrix, API/UI specifications, and `tests.md`.

The handout also intentionally leaves some implementation choices to each team. Because of that, choices such as bcrypt, session cookies, Administrator/IT Staff overlap, or the exact status-transition matrix are not problems by themselves as long as they are explicitly documented and internally consistent.

However, I found the following issues that should be resolved before this contract is considered frozen.

## 1. Blocking — Existing Requester initial-password migration behavior is not explicit

The Lab 3 handout requires the team to document **and test how existing Lab 2 Development Requesters receive initial passwords**.

The current specification says that existing Requesters receive initial passwords through the:

> "approved local-lab behavior"

but it does not actually define what that behavior is.

The migration tests currently cover:

- `DevRequester -> User` migration
- preservation of Ticket ownership
- preservation of existing Categories, Related Systems, Tickets, and Attachments

but there is no migration/regression test proving that a migrated Requester:

1. receives an initial password,
2. can authenticate using that initial password, and
3. is forced to change it before entering the normal application.

### Suggested change

Freeze the exact initial-password migration behavior and add migration/regression coverage for it.

---

## 2. Blocking — Concrete database design is not fully frozen

The Lab 3 handout requires the contract to determine:

- fields,
- data types,
- foreign keys,
- indexes,
- enums or reference tables,
- timestamps,
- activation state,
- password-change state,
- and migration strategy.

The current Data Changes section mostly defines conceptual relationships, for example:

- one User has one role,
- a Ticket may have an owner,
- Comments and Notes have authors,
- passwords use bcrypt.

Those are useful, but downstream implementation still needs to decide the actual schema.

For a requirement-freeze issue, the coding agent should not need to invent things such as:

- exact `User` fields,
- Comment/Note fields,
- Ticket ownership fields,
- IT Priority field representation,
- FK behavior,
- uniqueness constraints,
- indexes,
- timestamps,
- delete/update behavior.

### Suggested change

Add a concrete data-model contract defining the relevant models, fields, types, relationships, constraints, indexes, enums, and migration behavior.

---

## 3. Blocking — IT Staff Queue query behavior still contains placeholders

The handout requires the team to explicitly decide:

- searchable fields,
- filterable fields,
- sortable fields,
- default ordering,
- page size,
- pagination metadata,
- and invalid-query behavior.

In `api-spec.md`, `/api/staff/queue` still contains descriptions such as:

> `search` — searchable fields

and:

> `sort` — sortable fields

without defining the actual fields.

There is also an inconsistency with `tests.md`.

`tests.md` states that invalid query parameters should result in:

> "Safe defaults applied"

but that behavior is not clearly frozen in the API contract.

### Suggested change

Explicitly define:

- what `search` searches,
- allowed filters,
- allowed sort fields,
- default sort,
- valid page sizes,
- and whether invalid parameters are rejected or replaced with defaults.

Then align `tests.md` with that API decision.

---

## 4. Blocking — Session expiration is intentionally left undecided

The handout requires the authentication/session contract to define session or token:

- storage,
- expiration,
- logout invalidation,
- CSRF behavior,
- and safe errors.

The current contract defines a server-side session and requires a bounded idle timeout, but leaves the actual timeout value as a later:

> repository/environment configuration decision

This means two implementations could use completely different expiration policies and both still claim compliance.

For a frozen engineering contract, the expiration behavior should already be decided.

### Suggested change

Choose and document the concrete session expiration behavior, for example:

- idle timeout,
- whether there is an absolute timeout,
- what happens on expiration,
- and whether activity refreshes the session.

Then add corresponding planned tests.

---

## 5. Blocking — Some AC-to-test mappings are not meaningful

The contract technically maps every AC to at least one planned test, but several mappings do not actually test the acceptance criterion they reference.

For example:

`AC-20` is about:

> a non-Administrator requesting a user-management endpoint and receiving a forbidden response.

However, the following tests are also mapped to `AC-20`:

- `UI-STYLE-01`
- `VISUAL-01`
- `A11Y-01`

These test:

- Zen Green styling,
- responsive layouts,
- accessibility,
- keyboard/focus behavior.

They do not verify non-Administrator User Management authorization.

A similar issue appears with:

`SEED-01 -> AC-16`

where `SEED-01` tests seed idempotency, but `AC-16` is about an Administrator creating a user with an initial password.

### Suggested change

Add dedicated Acceptance Criteria for requirements such as:

- responsive behavior,
- accessibility,
- Zen Green consistency,
- seed idempotency,
- migration preservation,
- initial-password migration behavior.

Then map each planned test to an AC that it actually verifies.

---

# Items I Would Not Request Changes For

## Administrator and IT Staff overlap

I would **not** flag the authorization matrix simply because Administrators can perform IT Staff Ticket operations.

The handout says Administrator and IT Staff responsibilities should remain conceptually separate, but it explicitly allows overlap when the approved authorization matrix permits it.

The handout also allows a Ticket Owner to be an active:

- IT Staff user, or
- Administrator user.

So this team's explicit authorization decision is defensible.

---

## Exact Ticket status transitions

I would also **not** request changes merely because this team's transition matrix differs from another implementation.

The Lab 3 handout intentionally requires each team to define:

- permitted transitions,
- permitted roles,
- confirmation behavior,
- validation behavior,
- and forbidden transitions.

This PR provides such a matrix, so the exact choices are team-specific implementation decisions unless they contradict a mandatory handout rule.

---

# Final Review

**Request Changes**

The documentation is close and has a good overall structure, but I would not consider the Requirement Freeze Gate satisfied yet.

The main remaining issues are:

1. Existing Requester initial-password migration behavior is not explicitly defined or tested.
2. The concrete database contract is incomplete.
3. IT Staff Queue query behavior still contains unresolved placeholders.
4. Session expiration remains an implementation-time decision instead of a frozen requirement.
5. AC-to-test traceability contains mappings that do not actually verify the referenced Acceptance Criteria.

These should be resolved before dependent Lab 3 implementation issues begin.

</details>

<details>
<summary>2026-09-11T02:53:19Z — CHANGES_REQUESTED by @oangsa</summary>

## Review against the authoritative Lab 3 handout

I reviewed this PR against the Lab 3 handout and the Issue #34 freeze-gate requirements only. This review does **not** compare it against another team's implementation decisions.

The latest revision resolves the earlier gaps around the concrete data model, queue query semantics, session expiration, AC/test traceability, and migration test coverage. The overall Spec DD structure is now close to complete.

I still see two blocking requirement-freeze issues:

### 1. Password policy is referenced but never actually defined

`BR-10` says an initial password must satisfy the documented password rules "(length and composition)", while `api-spec.md` repeatedly validates `newPassword` / `initialPassword` using "satisfies password rules" and `tests.md` plans `API-AUTH-07` for password boundaries.

However, the contract does not state the actual:

- minimum length,
- maximum length,
- required character composition,
- or any other password validation boundaries.

The Lab 3 handout requires password handling to be completed as Business Rules, the Change Password UI to show password rules and validation, and the REST contract to define validation.

Since this Issue is the requirement freeze, the coding agent should not have to invent the password policy later.

**Please freeze the exact password policy in the engineering contract and make `specification.md`, `api-spec.md`, `ui-spec.md`, and `tests.md` agree on it.**

---

### 2. Existing-Requester initial-password derivation is still deferred to implementation

Section 9.2 now says each migrated Requester receives a deterministic password derived from email/name, but the actual derivation is only said to be:

> "documented in the seed module"

That still leaves the downstream migration implementation to choose the formula.

The handout explicitly requires the team to document and test how existing Requesters receive initial passwords, and Issue #34 requires that migration behavior to be explicit before implementation begins.

A frozen Spec DD should therefore define the exact local-lab derivation/generation rule, or another exact approved mechanism, in the contract itself rather than making the seed implementation the source of truth.

**Please move/freeze that rule in the specification and keep the migration tests aligned with it.**

---

Once those two decisions are explicit and internally consistent, I do not currently see another handout-level blocker.

Team-specific choices such as:

- bcrypt,
- the session-cookie approach,
- the approved Administrator/IT Staff overlap,
- and the chosen status-transition matrix

are acceptable because the handout leaves those choices to the team's approved engineering contract.

</details>

<details>
<summary>2026-09-11T04:28:19Z — APPROVED by @oangsa</summary>

## Re-review against the authoritative Lab 3 handout

I re-reviewed the latest head against the Lab 3 handout and Issue #34 freeze-gate requirements only; this does **not** compare the project against another team's implementation decisions.

The two remaining blockers from my previous review are now resolved:

- The password policy is explicitly frozen in `BR-10` (12–128 characters, required uppercase/lowercase/digit/special-character composition, whitespace/not-trimmed behavior) and is reflected in the UI and planned boundary tests.
- The existing-Requester initial-password migration mechanism is now explicitly frozen in the specification, including the deterministic derivation formula, `mustChangePassword` behavior, and dedicated migration tests.

The earlier freeze-gate gaps are also now covered: concrete data model/relationships/indexes, queue query semantics, session expiration, Lab 2 data preservation, selector/client-identity removal, authorization and status matrices, exact API/UI contracts, dedicated migration/seed/responsive/accessibility ACs, and AC→planned-test traceability.

I do not see a remaining handout-level blocker.

Team-specific decisions such as bcrypt, session cookies, the approved Administrator/IT Staff overlap, concurrency behavior, and the selected status-transition matrix are explicitly documented choices in areas where the handout permits the team to decide.

**Approved.**

</details>

#### [PR #45 — Ticket summary/description limit alignment](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/45)

<details>
<summary>2026-09-15T05:36:59Z — APPROVED by @oangsa</summary>

lgtm!

</details>

#### [PR #46 — Issue #35 identity, migration, and authentication](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/46)

<details>
<summary>2026-09-17T17:00:29Z — CHANGES_REQUESTED by @oangsa</summary>

*Request changes before merging this increment.** The refreshed PR has substantially better provenance: an evidence bundle at the new head, explicit ownership of E2E by #42, a justification and grep gate for the temporary DM-17 compatibility layer, a truthful pending-human-review entry, and an additional session-fixation regression assertion. The new seed-scoping change also addresses the earlier Lab 2 test-cleanup collision.

However, **all five substantive code findings from the previous review remain at this head**. Two are migration/data-preservation issues; one is a deterministic frontend error-handling bug; and two concern seed integrity. The committed test counts and scratch migration proof are valuable evidence for what they actually exercised, but do not prove the failure/recovery and data-preservation scenarios detailed below.

### What changed since the prior review

| Prior concern | New status | Source/evidence |
|---|---|---|
| No review-grade execution bundle | **Addressed as an artifact:** dedicated run logs, migration execution, build outputs, compliance map, and Lab 2 adaptation audit are now committed. | [`artifacts/lab-03/issue-35/`](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/tree/311ce7174da019355d28b46ecb4dca9485477e29/artifacts/lab-03/issue-35) |
| Database tests might have been skipped | **Addressed for recorded run:** `db-mig-execution.txt` displays all five DB-MIG cases executed and passed. Independent replay was not performed in this review. | [`db-mig-execution.txt`](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/311ce7174da019355d28b46ecb4dca9485477e29/artifacts/lab-03/issue-35/db-mig-execution.txt) |
| #35 missing E2E-01 | **Clarified ownership, not a #35 code defect:** #42 explicitly owns creation of frozen `e2e/lab-03/authentication.spec.ts`. E2E remains pending. | [PR #46 description](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/46) |
| Legacy `removedByRequesterId` response key | **Authorized temporary compatibility:** DM-17 declares the exact legacy layer, non-deployable until #37 deletes it. Do not demand its removal inside #35 without changing the agreed integration sequence. | [`integration-gate.md`](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/311ce7174da019355d28b46ecb4dca9485477e29/artifacts/lab-03/migration/integration-gate.md) |
| Seed unexpectedly references test-created categories | **Fixed:** lookups now filter to the seed's category and system names. | [`server/prisma/seed.ts`](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/311ce7174da019355d28b46ecb4dca9485477e29/server/prisma/seed.ts) |
| Migration atomicity/recovery, DB-MIG-02 preservation assertions, API error parsing, ticket numbering, seed overwrites | **Still present**; see findings below. | Current-head source links in each finding. |

---

## Finding 1 — [P1] A failed Phase C or post-backfill check leaves the migration outside its documented resumable states

**File:** [`server/src/migrate-lab3.ts`](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/311ce7174da019355d28b46ecb4dca9485477e29/server/src/migrate-lab3.ts)<br>
**Relevant functions:** `applyTrackedMigrationOutOfBand`, `stage1Preflight`, `runLab3Migration`, `postBackfillVerification`.

The migration runner invokes `psql "..." -v ON_ERROR_STOP=1 -f "...migration.sql"`. `ON_ERROR_STOP` stops execution after an error; it does **not** wrap all statements in a transaction. If a statement in Phase C fails after preceding statements have committed, Phase C is not recorded with `migrate resolve`, yet some of its DDL may already be applied. The next orchestrator invocation does not recognize this as a legal state.

There is also a separate, reachable recovery gap **even if Phase C becomes atomic**: `runBackfill()` commits its transaction, *then* `postBackfillVerification()` runs. If verification throws (for example, an existing `Attachment.isRemoved`/`removedAt` mismatch), the database contains the new `User` rows while `DevRequester` still exists. `stage1Preflight()` explicitly rejects any Phase-A-applied state with a nonempty `User` table. Retrying cannot resume, despite the prominent recovery/runbook language.

**Requested changes:**

1. Apply each SQL migration file atomically (`psql --single-transaction -v ON_ERROR_STOP=1 ...`, or an equivalent verified method), and confirm Prisma history is recorded only after the whole file succeeds.
2. Validate known pre-existing attachment invariants **before committing** the backfill, or implement a separately specified and tested post-backfill resume state. A failed check must not leave the operator with only an unsupported state.
3. Inject a late Phase C failure and a post-backfill verification failure in isolated populated fixtures. Assert both data preservation and a documented recovery path; never hand-edit `_prisma_migrations`.
4. Keep the permitted collision-abort behavior (Phase A applied, no backfill) intact; it is a different and already evidenced scenario.

**Why the existing green logs do not close it:** The logged collision/recovery test fails **before** backfill. The scratch-DB proof covers a successful Phase C, not a late Phase C failure.

---

## Finding 2 — [P1] DB-MIG-01/02 test names overstate what they assert about preserved Lab 2 records

**File:** [`server/tests/lab-03/migration.integration.test.ts`](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/311ce7174da019355d28b46ecb4dca9485477e29/server/tests/lab-03/migration.integration.test.ts)<br>
**Frozen obligation:** existing Categories, Related Systems, Tickets, Attachments and their requester ownership/relationships survive the migration.

`DB-MIG-01` checks at least five Requesters and spot-checks Ada's ID and Edsger's inactive state. It does not compare *every* legacy requester against a saved pre-migration snapshot. `DB-MIG-02` checks column names, selected native timestamp types, hash lengths, `isRemoved` consistency, final Attachment columns and `appearsResolved` nullability. It does not check pre/post Ticket or Attachment row identities, uploader/remover identities, linked Category/RelatedSystem IDs, or preserved values.

A migration that discarded an existing Ticket or Attachment while leaving the final schema and seed intact could still satisfy these assertions. The code's `postBackfillVerification` checks some row counts/FKs but also does not compare each original row's complete relationships; these checks are not a replacement for the frozen data-preservation test.

**Requested changes:**

1. Create an **isolated Lab-2-shaped fixture** containing multiple requesters, tickets and attachments, including a soft-removed attachment; capture its complete pre-migration snapshot.
2. Run the **real** `migrate:lab3` orchestrator on that fixture and assert the exact sets of Ticket/Attachment IDs and relevant values/relationships remain, including `requesterId`, Category/RelatedSystem FKs, `uploaderRequesterId → uploaderUserId`, and `removedByRequesterId → removedByUserId`.
3. Compare **every** legacy requester ID/name/email/active state with the corresponding User; keep supplemental native-type and schema checks.
4. In `DB-MIG-02`, check the expected number and identity of `timestamptz` columns rather than merely `tzCols.length > 0`, which would pass if a required column were omitted from the query result.

**Evidence distinction:** `db-mig-execution.txt` genuinely shows DB-MIG-01..05 passing. The gap is in the **assertion coverage**, not the presence of a passing test run.

---

## Finding 3 — [P1] The shared frontend parser throws before its canonical error body is parsed

**File:** [`client/src/api-client.ts`](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/311ce7174da019355d28b46ecb4dca9485477e29/client/src/api-client.ts)<br>
**Relevant code:** `parseApiError` and its four callers (`login`, `fetchMe`, `logout`, `changePassword`).

`parseApiError(response, fallback)` constructs an `Error`, kicks off `response.json().then(...)` without awaiting it, and immediately returns the error. Callers immediately `throw` it. The caught `message` and `code` can still be fallback/undefined at the moment the UI handles the error. This is deterministic timing misuse, regardless of whether a happy-path UI test passes. It undermines shared canonical error handling and can hide meaningful validation messages in the Change Password UI.

**Requested change:** Make the helper asynchronous and await parsing before constructing/returning the error. Have all callers use `throw await parseApiError(response, fallback)`. Keep a safe fallback for non-JSON responses, and preserve `status`, `code`, `message` (and preferably `fields`) in the parsed result. Add a test that immediately catches a real `400 VALIDATION_ERROR` and sees the correct code/message/fields with no microtask delay or retry.

A suitable shape is:

```ts
export async function parseApiError(response: Response, fallback: string) {
  const err = new Error(fallback) as Error & {
    status?: number;
    code?: string;
    fields?: Record<string, string>;
  };
  err.status = response.status;
  try {
    const body = (await response.json()) as ApiErrorBody;
    err.message = body.error?.message ?? fallback;
    err.code = body.error?.code;
    err.fields = body.error?.fields;
  } catch {
    // Retain the safe fallback.
  }
  return err;
}
```

---

## Finding 4 — [P2] Seed creates Ticket numbers that conflict with the existing six-digit allocator

**File:** [`server/prisma/seed.ts`](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/311ce7174da019355d28b46ecb4dca9485477e29/server/prisma/seed.ts)<br>
**Baseline allocator:** [`server/src/ticket-number.ts`](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/311ce7174da019355d28b46ecb4dca9485477e29/server/src/ticket-number.ts).

The seed independently increments `TicketSequence` and formats `TKT-${year}-${String(seq.lastSeq).padStart(4, '0')}`. The existing authoritative allocator uses six digits (`padStart(6, '0')`) and guards the maximum yearly sequence. This creates two competing numbering implementations and seeded tickets with a different format.

**Requested change:** Allocate seed Ticket numbers using `allocateTicketNumberWithClient` inside the Ticket-creation transaction rather than maintaining a second sequence implementation. Assert the canonical six-digit format, uniqueness and repeat-run stability in `SEED-01`. Avoid changing existing Ticket numbers when rerunning the seed.

---

## Finding 5 — [P2] Idempotent seed still mutates existing accounts and can attach new notes to unrelated Tickets

**File:** [`server/prisma/seed.ts`](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/311ce7174da019355d28b46ecb4dca9485477e29/server/prisma/seed.ts)<br>
**Test:** [`server/tests/lab-03/seed.integration.test.ts`](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/311ce7174da019355d28b46ecb4dca9485477e29/server/tests/lab-03/seed.integration.test.ts).

`upsertUser()` uses `update: { name, isActive, role }`. Re-running the seed after an Administrator deactivates or changes a User's role restores the hard-coded seed state, potentially reactivating an account or undoing a role change. The test checks only counts after two runs; those counts cannot detect a changed account's state or password.

The ticket re-use key is `findFirst({ where: { summary, requesterId } })`, not an explicit seed identity. An independently created Ticket with the same summary/requester could be mistaken for a seed Ticket and receive seed Comments or Internal Notes if none already exist. This conflicts with the objective to preserve existing records and avoid unexpected modifications.

**Requested changes:**

- Treat existing seeded Users as immutable on repeat runs, or explicitly scope the reset behavior to a separately invoked **development reset** command. Assert `role`, `isActive`, `passwordHash`, and `mustChangePassword` remain unchanged on an ordinary re-seed.
- Identify seed Tickets by a seed-specific stable identity/marker or other safely documented deterministic key; do not assume a real Ticket is seed-owned solely from `summary + requesterId`.
- Use seed-specific checks for Comments/Notes; `count === 0` is not enough to determine whether an existing note belongs to the seed.
- Expand `SEED-01` to compare required population, statuses, priorities, assigned/unassigned Tickets, and the exact state after two runs, not only coarse table counts.

---

## Supplementary checks worth adding (not additional blockers by themselves)

- **Authentication-state tests:** verify a role change and activation change through DB/current-User logic take effect on the *same* session's next protected request. `session.ts` implements a fresh DB lookup, but the test suite should demonstrate it.
- **Password derivation determinism:** the frozen `DB-MIG-03` row includes repeating the migration/seed and getting the same derived initial password. Current test compares one calculated password with one hash; expand with two fresh-snapshot runs or another reliable deterministic derivation check that cannot be satisfied by a hard-coded password.
- **Evidence logs:** `server-vitest.txt` reports 368 passed / 30 files and `db-mig-execution.txt` visibly shows all five migration tests ran. These are recorded results from the PR author, **not independently reproduced** in this review. A separate CI run or reviewer-owned reproduction is appropriate before declaring the whole suite independently verified.
- **Intermediate deployment boundary:** the retained `X-Dev-Requester-Id` routes are an explicitly agreed, non-deployable DM-17 compatibility layer. Verify #37 removes them before any public deployment. They are not, by themselves, a new #35 violation.
- **E2E ownership:** frozen E2E-01 belongs to #42, and its exact test path is `e2e/lab-03/authentication.spec.ts`. Do not introduce an invented `auth-flow.spec.ts` or mark E2E-01 Passed in #35.

## Requested author checklist

- [ ] Atomic SQL-file application and tested post-backfill/Phase-C failure recovery.
- [ ] Real pre/post populated-Lab-2 preservation assertions for DB-MIG-01/02.
- [ ] Awaited canonical error parsing plus immediate-catch client regression test.
- [ ] One canonical Ticket-number allocator used by seed and app.
- [ ] Seed reruns preserve existing account state and cannot claim unrelated tickets/notes.
- [ ] Regenerate the evidence bundle **after** fixes at the final head SHA and update `tests.md` only for genuinely exercised rows.

## Disposition and limitations

**Review disposition: Request changes (recommendation only).** PR #46 was open and unmerged when inspected. This Markdown file is a draft review for the user to post if desired; no review, comment, approval, or code change was submitted to GitHub. GitHub's reported `mergeable` status is a mechanical mergeability signal, not a correctness assessment. No test suite was executed locally in this review.

</details>

<details>
<summary>2026-09-18T10:34:04Z — CHANGES_REQUESTED by @oangsa</summary>

he updated PR addresses the five findings from the preceding review: migration-file atomicity and recovery, populated-data preservation tests, asynchronous canonical API error parsing, canonical Ticket-number allocation, and non-destructive User seeding. Its committed evidence reports **383 passing server tests** and **113 passing client tests**. These results were read from the repository's committed evidence; I did **not** independently run the suites.

Three further issues remain. Two affect the correctness of migration recovery and authenticated client operation; the third affects logout failure handling.

## Findings

### 1. [P1] Matching User counts do not establish that backfill completed

**File:** [`server/src/migrate-lab3.ts`](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/e1d2a0ea9db2474b6e83e662dcf02da7c892df15/server/src/migrate-lab3.ts) — `stage1Preflight()`

The resume branch treats `actualUsers === legacy.length` as evidence that the full `DevRequester` → `User` backfill has already completed. It then skips the collision scan and backfill and proceeds to Phase C, which drops `DevRequester`.

Equal row counts do not prove that the Users correspond to the legacy Requesters. For example, a Phase-A-applied database could contain one legacy Requester and one unrelated User with a matching ID. If there are no Attachments, the count-based check could accept that state and redirect a Ticket's requester relationship to the wrong User. The current failure-injection tests cover a genuinely completed backfill, not a misleading state with equal counts.

**Requested change:** Before resuming directly into Phase C, verify the exact legacy-to-User mapping and migrated relationship values, or use a trustworthy, transactionally recorded completed-backfill checkpoint. Add a negative migration test in which the counts match but identity details differ; the orchestrator must stop without dropping the legacy table.

### 2. [P1] Existing sessions cannot recover a CSRF token in a new tab

**Files:** [`server/src/auth.controller.ts`](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/e1d2a0ea9db2474b6e83e662dcf02da7c892df15/server/src/auth.controller.ts), [`client/src/api-client.ts`](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/e1d2a0ea9db2474b6e83e662dcf02da7c892df15/client/src/api-client.ts)

Login issues the session-bound `X-CSRF-Token` header, but `GET /api/auth/me` returns only the User data. The client keeps the token in tab-scoped `sessionStorage` and attempts to capture a CSRF token from `/me` responses. A newly opened tab can therefore have a valid session cookie but no token. Its authentication check succeeds, while Change Password, Logout, and other protected mutations fail with `403 FORBIDDEN`.

**Requested change:** Include the existing session-bound CSRF token in the `/me` response header. Add a test that restores an authenticated session with a valid cookie but empty client-side token storage, then successfully executes a CSRF-protected request. Ensure the token is not regenerated unnecessarily for an already-authenticated session.

### 3. [P2] A failed logout is presented as successful

**File:** [`client/src/AuthGate.tsx`](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/e1d2a0ea9db2474b6e83e662dcf02da7c892df15/client/src/AuthGate.tsx) — `handleLogout()`

`handleLogout()` clears the User and navigates to the Login screen in a `finally` block, even when the logout request fails. If the network request or server-side invalidation fails, the session can remain valid although the UI appears to have logged out.

**Requested change:** Switch to the Login state only after the server confirms successful logout. On failure, retain the authenticated state, display a safe inline error, and do not automatically retry. Add a UI test for a rejected logout request.

## Review disposition

**Request changes** for the three findings above. The previous five substantive findings appear addressed in the updated implementation and test additions; they should not be repeated as unresolved problems.

**Verification and submission status:** This is a source-and-evidence review, not an independently executed test run. An attempt to submit the review directly to GitHub returned `403 Resource not accessible by integration`; **no GitHub review or comment was posted**.


</details>

<details>
<summary>2026-09-18T15:16:15Z — CHANGES_REQUESTED by @oangsa</summary>

## What changed since the prior review

The PR adds `verifyBackfillIdentity()` to check ID/email/role on recovery, reissues the existing session-bound CSRF token on `/api/auth/me`, and preserves the authenticated shell while displaying an inline error when logout fails. The new integration/UI tests exercise these paths. These three prior findings should not be repeated as if no remediation occurred.

The committed author-run logs report **385 passing server tests / 30 files** and **116 passing client tests / 12 files**. These are *repository evidence*, not tests independently executed by this reviewer. No individual commit statuses were returned by the queried combined-status endpoint.

## Findings

### 1. [P0] Credential-bearing database URL is committed in execution logs

**Files:**
- [`artifacts/lab-03/issue-35/server-vitest.txt`](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/24d59a28c644eb70941f92840ba2b695b60d8843/artifacts/lab-03/issue-35/server-vitest.txt)
- [`artifacts/lab-03/issue-35/db-mig-execution.txt`](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/24d59a28c644eb70941f92840ba2b695b60d8843/artifacts/lab-03/issue-35/db-mig-execution.txt)
- Root cause: [`server/src/migrate-lab3.ts`](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/24d59a28c644eb70941f92840ba2b695b60d8843/server/src/migrate-lab3.ts), `applyTrackedMigrationOutOfBand()` / `run()`.

Both committed test logs include a failed `psql` command with a **full PostgreSQL connection URL containing a password**. The runner constructs a command with the credential-bearing `DATABASE_URL`; a command failure reports that command verbatim, and the resulting error is copied into committed evidence. This violates the issue's requirement not to commit real secrets. The credential is not reproduced in this review.

**Required:** Treat the password as exposed. Rotate/revoke it if active, and rotate any other system credentials where reused; remove or redact the sensitive logs and coordinate Git-history/retention cleanup with repository maintainers, since a new commit alone cannot erase earlier versions. Change subprocess invocation and error handling to avoid placing passwords in command-line arguments or exception strings (for example, a password-free connection string plus an appropriately scoped `PGPASSWORD` environment variable, with sanitization of errors). Regenerate sanitized evidence and check all artifacts and history for additional copies. Add a regression check that generated logs cannot contain credential-bearing DB URLs.

### 2. [P1] Migration resume verifies only part of the frozen legacy-to-User mapping

**File:** [`server/src/migrate-lab3.ts`](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/24d59a28c644eb70941f92840ba2b695b60d8843/server/src/migrate-lab3.ts), `verifyBackfillIdentity()` / `stage1Preflight()`.

`verifyBackfillIdentity()` checks matching `id`, normalized `email`, and role `REQUESTER`, then returns `backfill-complete` and skips the backfill. The frozen migration also requires preserved `name` and `isActive`, a bcrypt hash for the deterministic initial password, and `mustChangePassword = true`. Thus, a Phase-A-applied database containing an unrelated or incomplete User with matching ID/email/role but different name, activation, or password state can pass this guard and proceed to Phase C, which drops the legacy table. `DB-MIG-06` only exercises a User with a **different ID/email** and does not catch this case.

**Required:** Validate a complete one-to-one mapping before permitting the Phase-C-only resume: name (per frozen normalization), activation, mandatory-password-change flag, and bcrypt verification of the deterministic initial password, plus the Attachment uploader/remover shadow IDs and other backfill invariants. Alternatively, use a robust, transactionally recorded and validated backfill-completion checkpoint. Add a negative fixture where count, ID, email and role all match but one required property differs; Phase C must remain unapplied and `DevRequester` must remain intact. Also retain a positive Phase-C-failure → resume test.

### 3. [P2] New Ticket creation leaves `itPriority` null

**Files:** [`server/src/service.ts`](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/24d59a28c644eb70941f92840ba2b695b60d8843/server/src/service.ts), `createTicket()`; [`server/prisma/schema.prisma`](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/24d59a28c644eb70941f92840ba2b695b60d8843/server/prisma/schema.prisma), `Ticket`.

The current Ticket-create transaction sets `requestedPriority` but not `itPriority`; Prisma has `itPriority Priority?` without a default. Therefore a newly created Ticket receives `NULL`, although frozen `specification.md` §9.3 states that `itPriority` **initially copies `requestedPriority`**. Backfilling existing Tickets during migration is not sufficient for future creates.

**Required:** Set `itPriority: validated.requestedPriority` in the creation transaction (or implement an equally dependable database-level rule consistent with the frozen schema). Verify the persisted value for LOW, MEDIUM and HIGH, including that a later authorized IT edit does not mutate `requestedPriority`.

### 4. [P2] Failed `/me` requests are indistinguishable from expired sessions in the shell

**File:** [`client/src/AuthGate.tsx`](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/24d59a28c644eb70941f92840ba2b695b60d8843/client/src/AuthGate.tsx).

The mount-time `fetchMe().catch(() => setState('login'))` renders Login on **every** error, including network failure and HTTP 500 while the user's session remains valid. The logout failure UI has been fixed separately, but the session-restoration path still misrepresents temporary API failure as unauthenticated and offers no explicit retry.

**Required:** Route only `401 UNAUTHENTICATED` to Login (and handle other documented authentication states as applicable). On network/5xx failures, display a safe error and an explicit Retry action; do not automatically retry. Add tests for genuine 401 versus a rejected request/500 and preserve existing successful `/me` CSRF capture behavior.

## Scope and verification notes

- The explicitly non-deployable DM-17 legacy compatibility layer remains owned by #37; it is not itself a newly raised #35 defect. Do not deploy it as fully authenticated application routes.
- The frozen E2E files are assigned to #42; do not mark E2E-01 passed in this PR based on unit or integration tests alone.
- After fixes, regenerate **sanitized** DB, server, and client test evidence, run schema validation and builds, and update `docs/lab-03/tests.md`, `docs/lab-03/ai-use.md`, `docs/lab-03/reviewer.md`, and the evidence manifest. Match evidence to the final implementation SHA.
- The GitHub `mergeable` flag is mechanical mergeability, not a security or correctness review.

**Verification limitation:** Repository code and committed logs were inspected through the connected GitHub integration; no code was checked out or tests executed independently. An attempt to submit this specific review to GitHub returned `403 Resource not accessible by integration`, so no **new** review was submitted by this attempt.

</details>

<details>
<summary>2026-09-19T07:03:07Z — CHANGES_REQUESTED by @oangsa</summary>

Three issues still need attention:

P1 — Exposed database credential: The current logs are clean, but the project’s own documentation confirms that the credential remains in earlier Git history and that rotation is still required. (Evidence README
)

P1 — Attachment ownership on migration resume: The resume check does not verify that the new uploader and remover IDs exactly match their legacy counterparts. Phase C subsequently drops those legacy columns. (Migration runner
)

P2 — Initial Ticket priority: Normal Ticket creation still omits itPriority, rather than initializing it from requestedPriority as required. (Ticket service
)

</details>

<details>
<summary>2026-09-19T11:46:44Z — CHANGES_REQUESTED by @oangsa</summary>

Two findings to address

1. P1 — The history rewrite has disrupted the PR’s base. GitHub reports the PR as not mergeable. Comparing its head with the agreed lab3-staging baseline shows diverged histories—306 commits ahead and 272 behind—and a substantially expanded diff containing historical Lab 1 and Lab 2 files. Rebuild the feature branch from the unchanged lab3-staging tip, transplant only the intended #35 changes, and confirm that the resulting PR is mergeable and has a focused diff. Preserve the credential cleanup without rewriting the shared base branch. Inspect the comparison
.

2. P1 — Migration resume can skip the User ID-sequence repair. In runBackfill(), the explicit-ID User inserts commit before the setval() call. If execution stops between those operations, the next run recognizes the backfill as complete and skips runBackfill()—including its sequence repair. Phase C can then finish with a sequence that generates IDs already assigned to migrated Requesters. Make sequence synchronization part of the resume path as well, and add a test that interrupts migration immediately after backfill commit, resumes it, and successfully creates a User with an automatically generated ID. [Inspect runBackfill() and the resume branch](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/b346860335f3df2db7d4c628e6c38b14b5c9fc42/server/src/migrate-lab3.ts)

</details>

<details>
<summary>2026-09-19T15:57:11Z — APPROVED by @oangsa</summary>

LGTM!

</details>

#### [PR #47 — Issue #37 authorization and Requester migration](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/47)

<details>
<summary>2026-09-20T14:32:36Z — CHANGES_REQUESTED by @oangsa</summary>

## Summary

The core authorization cutover appears implemented against Issue #37 and the frozen Lab 3 contracts:

- Ticket creation and My Tickets derive requester identity from the authenticated session rather than a client-supplied requester ID.
- Requesters receive `404 NOT_FOUND` for another user's Ticket or Attachment; IT Staff and Administrators have shared read access, but cannot mutate Attachments.
- The temporary Development Requester selector, identity header, and associated routes have been removed.

**Code references:** [Route definitions](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/06d59e7d820d3ca32a1ae8313a12f24699f4a6eb/server/src/module.ts) · [Authorization middleware](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/06d59e7d820d3ca32a1ae8313a12f24699f4a6eb/server/src/authorization.ts)

## Finding — P2: My Tickets diverges from the frozen Lab 3 filtering and sorting contract

The backend accepts only `status=NEW`; a valid status such as `OPEN` returns `400 VALIDATION_ERROR`. The frontend likewise offers only **New** as a status-filter option. The backend recognizes `sort=requestedPriority` but not the documented `sort=status` or `sort=priority`. Some invalid filter values return `400` even though API spec §8 specifies safe defaults for invalid query values.

The current `API-REQ-02` tests do not cover these contract mismatches.

**References:** [API spec §8](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/06d59e7d820d3ca32a1ae8313a12f24699f4a6eb/docs/lab-03/api-spec.md) · [Backend handler](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/06d59e7d820d3ca32a1ae8313a12f24699f4a6eb/server/src/controller.ts) · [Frontend My Tickets](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/06d59e7d820d3ca32a1ae8313a12f24699f4a6eb/client/src/MyTickets.tsx)

### Suggested correction

1. Support the frozen set of Ticket statuses in the backend filter and frontend dropdown.
2. Align accepted sort keys and their meaning with API spec §8, including `status` and `priority`.
3. Apply the specified safe-default behavior for invalid query values, consistently with the frozen contract.
4. Extend `API-REQ-02` with valid non-`NEW` status filtering, documented sort keys, and invalid-query fallback tests.

## Contract clarification — mismatched client-supplied requester identity

The Issue #37 checklist says a mismatched client-supplied `requesterId` must be **rejected**. The implementation instead **ignores** it, creates the Ticket, and assigns ownership to the authenticated user. This prevents identity spoofing and is consistent with the frozen API convention that unknown JSON properties are ignored, but it does not literally meet the checklist's wording. Clarify which behavior the acceptance test requires; do not change it without reconciling the frozen contract.

**Reference:** [Authorization API test](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/06d59e7d820d3ca32a1ae8313a12f24699f4a6eb/server/tests/lab-03/authorization.api.test.ts)

## Verification and scope

The committed evidence reports **424 server tests, 117 client tests, and 156 Lab 2 E2E tests passing**. These results were inspected, **not independently re-run**.

Staff Queue, Administrator endpoints, and Lab 3 E2E tests assigned to downstream issues are not counted as missing Issue #37 work.

**Reference:** [Cutover verification record](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/06d59e7d820d3ca32a1ae8313a12f24699f4a6eb/artifacts/lab-03/regression/cutover-gate.md)

</details>

<details>
<summary>2026-09-21T05:33:29Z — APPROVED by @oangsa</summary>

LGTM!

</details>

#### [PR #48 — Issue #41 Administrator User Management](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/48)

<details>
<summary>2026-09-22T14:36:58Z — CHANGES_REQUESTED by @oangsa</summary>

## Findings

### P1 — Administrator lands on Requester-only My Tickets

**Location:** [`client/src/App.tsx`](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/813c1fcfe8345398c49fec565c4a26dbafe47354/client/src/App.tsx).

`App` initializes `view` to `"home"` for **every** authenticated role and renders `<MyTickets />` when that view is active. Its My Tickets and Create Ticket navigation links are also shown unconditionally; only the newly added User Management link checks for `ADMINISTRATOR`. On a fresh Administrator login, the initial Requester-only `/api/tickets` call returns `403`, although User Management is accessible if the Administrator manually selects its link. This conflicts with the role-specific navigation and authorized-screen requirements in [`ui-spec.md` §5.3](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/813c1fcfe8345398c49fec565c4a26dbafe47354/docs/lab-03/ui-spec.md).

**Requested change:** Choose a role-appropriate initial view (Administrator → User Management for this PR's available screens); hide or guard Requester-only navigation and rendering for Administrators and IT Staff; test a fresh Administrator login and navigation. This is a UX and integration failure, not a server-side authorization bypass.

### P2 — Inactive Administrator cannot be demoted when only one active Administrator remains

**Location:** [`server/src/admin-service.ts`, `updateUser()`](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/813c1fcfe8345398c49fec565c4a26dbafe47354/server/src/admin-service.ts).

The `demotes` condition checks `role !== "ADMINISTRATOR" && target.role === "ADMINISTRATOR"` **without checking `target.isActive`**. With one active Administrator A and another **inactive** Administrator B, PATCHing B's role to `IT_STAFF` enters the Serializable guard; `activeAdmins <= 1` produces `409 CONFLICT`. Yet B is not counted among active Administrators, so this operation cannot remove the last active Administrator. BR-28's safeguard is being applied to a harmless edit.

**Requested change:** Apply the active-Administrator count guard only when the target was active and the patch would reduce the count. Keep the Serializable count/write for genuinely count-reducing operations. Add a regression test: one active Administrator, one inactive Administrator; changing the inactive user's role succeeds and the active Administrator count stays one.

### P2 — Permitted self-demotion leaves the client using a stale Administrator identity

**Locations:** [`AdminUserManagement.submitEdit()`](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/813c1fcfe8345398c49fec565c4a26dbafe47354/client/src/AdminUserManagement.tsx), [`AuthGate.tsx`](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/813c1fcfe8345398c49fec565c4a26dbafe47354/client/src/AuthGate.tsx), and [`App.tsx`](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/813c1fcfe8345398c49fec565c4a26dbafe47354/client/src/App.tsx).

BR-34 explicitly allows a non-last Administrator to change their own role. After such a successful PATCH, `submitEdit()` reloads the **user list only**. `AuthGate` retains the login-/mount-time `user`, and `App` uses that stale role to keep displaying Administrator navigation and User Management. The server's fresh-User authorization correctly rejects further administrator calls with `403`, but the client remains on a screen it can no longer use and displays an outdated role.

**Requested change:** After updating the signed-in user's own role, refresh the shared authenticated user (e.g. via `/api/auth/me`) and route to a screen allowed for the new role. Add a UI test covering the successful BR-34 self-demotion and subsequent navigation. Do not weaken the backend's fresh-User role checks.

### P2 — Create, Edit, and Reset Password dialogs do not implement keyboard-modal behavior

**Locations:** [`client/src/AdminUserManagement.tsx`](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/813c1fcfe8345398c49fec565c4a26dbafe47354/client/src/AdminUserManagement.tsx) and [`ui-spec.md` §8](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/813c1fcfe8345398c49fec565c4a26dbafe47354/docs/lab-03/ui-spec.md).

The three dialogs supply `role="dialog"` and `aria-modal="true"`, but their implementation has no initial focus handling, Tab/Shift+Tab focus containment, Escape dismissal, or focus restoration to the invoking control. Setting `aria-modal` alone does not provide these behaviors. The component suite covers submission and errors but not dialog keyboard interaction.

**Requested change:** Use a shared accessible modal mechanism or implement focus entry, trapping, Escape, and focus restoration for all three dialogs; add keyboard tests.

## Verified scope and evidence

The four documented paths are registered behind `requireAuth`, `requirePasswordChanged`, and `requireRole(["ADMINISTRATOR"])`, with CSRF on all three mutations: [`server/src/module.ts`](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/813c1fcfe8345398c49fec565c4a26dbafe47354/server/src/module.ts). The service reuses password hashing/policy, normalizes email, handles duplicate-email database races, selects DTOs without password hashes, and performs a Serializable last-active-Administrator guard with bounded retries: [`server/src/admin-service.ts`](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/813c1fcfe8345398c49fec565c4a26dbafe47354/server/src/admin-service.ts). The [`API test suite`](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/813c1fcfe8345398c49fec565c4a26dbafe47354/server/tests/lab-03/users-admin.api.test.ts) includes duplicate email, self-deactivation, last-admin guard, concurrent demotions, role restrictions, and the initial-password change path.

The [committed execution-evidence index](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/813c1fcfe8345398c49fec565c4a26dbafe47354/artifacts/lab-03/issue-41/README.md) reports **467 server tests** and **130 client tests** passing and reports successful builds and a browser pass. Those runs were **not independently reproduced in this review**. The integration E2E `E2E-03` is documented as belonging to Issue #42 and is not treated as a #41 blocker.

</details>

<details>
<summary>2026-09-24T13:58:45Z — CHANGES_REQUESTED by @oangsa</summary>

# PR #48 — Updated Review

**PR:** https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/48<br>
**Reviewed head:** `d18464aab35bb99dafc2cd5edcd1b1d9725decb3`<br>
**Review disposition:** Request changes

This is a fresh review of the current head against the supplied Issue #41 objective and the frozen Administrator User Management contract.

The four findings from the previous review are resolved:

- role-specific application entry/navigation is now enforced;
- an already-inactive Administrator can be demoted without incorrectly triggering the last-active-Administrator guard;
- successful self-demotion updates the shared authenticated identity so Administrator-only navigation disappears;
- Create / Edit / Reset Password now use a shared modal with initial focus, Tab/Shift+Tab trapping, Escape dismissal, and focus restoration.

The core CRUD/API surface is otherwise well aligned with the Administrator User Management requirements.

## Remaining Findings

### 1. [High] PR #48 currently contains the entire unrelated Issue #38 Staff workflow

**Scope:**
- `client/src/StaffTicketQueue.tsx`
- `client/src/StaffTicketDetail.tsx`
- `client/src/CommentThread.tsx`
- `client/src/InternalNoteThread.tsx`
- `server/src/staff-controller.ts`
- `server/src/ticket-status.ts`
- Issue #38 API/UI tests
- `artifacts/lab-03/issue-38-*`
- multiple Issue #38 specification/API/UI documentation changes

Issue #41 is explicitly scoped as:

> intentionally minimal Administrator User Management

and the objective only requires the four `/api/admin/users...` operations plus their Administrator UI.

However, the current PR is still based on:

```text
lab3-staging @ c2dede51
```

and its GitHub diff now contains **69 changed files**, including essentially all of the separate Issue #38 Staff Ticket Operations implementation.

That means merging PR #48 does not merely merge Administrator User Management. It also lands:

- Staff Queue;
- Staff Ticket Detail;
- Public Comments / Internal Notes;
- Staff status workflow;
- Staff attachments;
- Staff owner lookup;
- Issue #38 tests and evidence.

PR #49 exists separately for that scope, so the current PR dependency graph is no longer isolated.

This is not only a review-size problem. The unrelated code is executable application code, not harmless documentation. For example, the Staff Ticket Detail currently included in PR #48 still contains the Public Comment stale-refresh path:

```ts
const refreshed = await fetchStaffTicketDetail(ticketNumber);
setDetail(refreshed);
```

which bypasses the newer guarded Detail-refresh mechanism and was independently identified during PR #49 review.

So merging #48 would also merge unresolved code outside Issue #41.

**Requested change:** Restore PR #48 to an Issue #41-only diff.

Preferred approaches:

1. rebase/cherry-pick the Administrator User Management work onto a clean current `lab3-staging`; or
2. if Issue #38 is intentionally merged into `lab3-staging` first, rebase #48 afterward so the already-landed Staff changes disappear from this PR's diff.

The final PR #48 diff should contain Administrator User Management and only genuinely required dependency/integration changes.

The PR description currently states:

> No scope contamination

but that is not true for the current GitHub diff.

---

### 2. [High] BR-28 can still be violated because the target's Administrator state is classified outside the Serializable transaction

**File:** `server/src/admin-service.ts`

The current implementation correctly improved the previous guard:

```ts
const deactivatesAdmin =
  isActive === false &&
  target.isActive === true &&
  target.role === "ADMINISTRATOR";

const demotes =
  role !== undefined &&
  role !== "ADMINISTRATOR" &&
  target.role === "ADMINISTRATOR" &&
  target.isActive === true;
```

This correctly avoids blocking edits to an Administrator who is already inactive.

The problem is that `target.role` and `target.isActive` are read **before** deciding whether to enter the Serializable transaction:

```ts
const target = await prisma.user.findUnique(...);

// classification based on this snapshot

const touchesLastAdminInvariant = deactivatesAdmin || demotes;

if (!touchesLastAdminInvariant) {
  return await prisma.user.update(...);
}
```

Therefore an operation classified as "cannot affect the invariant" may become invariant-affecting before its unguarded write executes.

#### Example race

Start with:

```text
A = active Administrator
B = inactive Administrator
```

Only A currently counts as an active Administrator.

Then:

```text
R1: PATCH B role -> IT_STAFF
    reads B while inactive
    => touchesLastAdminInvariant = false
    => will use the unguarded update path
    => pause before write

R2: PATCH B isActive -> true
    B becomes an active Administrator

Now active Administrators = A + B

R3: PATCH A role -> IT_STAFF
    Serializable transaction sees 2 active Administrators
    => allowed
    => A becomes IT_STAFF

Now B is the only active Administrator

R1 resumes:
    its previously-classified unguarded update changes B's role to IT_STAFF
```

Final state:

```text
A = IT_STAFF
B = IT_STAFF
active Administrator count = 0
```

All individual operations were accepted, but BR-28 says:

> The system must never remove or deactivate the last active Administrator.

The existing concurrent-demotion test does not cover this case because `testSeams.beforeLastAdminWrite` is only reached after the request has already been classified into the guarded path.

**Requested change:** Do not determine whether a potentially count-reducing update needs protection from a stale pre-transaction snapshot.

For a patch containing either:

```text
role -> non-Administrator
or
isActive -> false
```

enter the Serializable transaction and re-read the target **inside that transaction**.

Then determine from the transactional target state whether the operation currently removes an active Administrator, perform the active-admin count check if necessary, and perform the write within that same transaction.

Add a concurrency regression that forces the stale-classification interleaving described above and verifies that the final active Administrator count can never reach zero.

---

### 3. [Medium] Resetting the signed-in Administrator's own initial password leaves the authenticated client state stale

**Files:**
- `client/src/AdminUserManagement.tsx`
- `client/src/AuthGate.tsx`
- `server/src/session.ts`

The UI allows **Reset Password** for every user row, including the signed-in Administrator.

The backend also permits this.

After a successful reset:

```ts
data: {
  passwordHash,
  mustChangePassword: true,
}
```

The frozen authentication layer re-reads the current User row on every protected request, and:

```ts
requirePasswordChanged
```

will reject the Administrator's next normal application request with:

```text
401 PASSWORD_CHANGE_REQUIRED
```

However, `submitReset()` only does:

```ts
setResetSuccess(
  "Initial password set. The user must change it at next login."
);
setResetPassword("");
```

It does not notify `AuthGate` when:

```ts
resetTarget.id === currentUser.id
```

so the client continues holding:

```text
mustChangePassword: false
state: "authenticated"
```

and continues showing User Management.

The next list/search/edit operation is then rejected by the server, but the client does not transition into the Change Password flow.

This is the same general stale-authentication-state class that was fixed for self-demotion, but the initial-password path still has it.

**Requested change:** Handle self-reset explicitly.

For example, when the current Administrator resets their own initial password:

```ts
onUserUpdated({
  ...currentUser,
  mustChangePassword: true,
});
```

and make `AuthGate` transition to:

```text
change-password
```

when the refreshed/shared authenticated User has `mustChangePassword === true`.

Alternatively, re-fetch `/api/auth/me` after a self-reset and use that response as the shared authenticated state.

Do not invent a prohibition against resetting one's own password unless that behavior is explicitly added to the frozen contract.

Add a UI/integration regression covering:

```text
Administrator resets own initial password
→ mustChangePassword becomes true
→ normal Admin screen is no longer available
→ Change Password flow is presented
```

---

### 4. [Medium] Administrator User Management does not implement the frozen mobile card responsive rule

**Files:**
- `client/src/AdminUserManagement.tsx`
- `client/src/App.css`
- `client/src/lab-03-tests/UserManagement.test.tsx`
- `docs/lab-03/ui-spec.md` §7

The global frozen responsive rules state:

```text
Desktop >=992px  → Full table layouts
Tablet 768–991px → Condensed tables
Mobile <768px    → Card layouts
```

`AdminUserManagement` always renders:

```tsx
<div className="tickets-table-wrapper">
  <table className="tickets-table">
    ...
  </table>
</div>
```

There is no Administrator mobile-card representation.

The generic mobile media rule changes toolbar layout and control heights, but it does not replace or transform the User Management table.

Additionally:

```css
.tickets-table-wrapper {
  overflow-x: hidden;
}
```

so a table that cannot fit the mobile viewport is clipped rather than being made accessible through horizontal scrolling.

The Administrator table contains:

- Name
- Email
- Role
- Status
- Edit / Reset Password actions

which is precisely the sort of multi-column content the frozen mobile card rule is intended to avoid.

The User Management component tests also contain no viewport/card/responsive assertions.

A committed mobile screenshot is useful evidence, but it does not change the source-level fact that the UI remains a table below 768px.

**Requested change:** Add a mobile representation for User Management, analogous to the other Lab 3 responsive lists:

```text
one User per card
Name
Email
Role
Status
Edit
Reset Password
```

Retain the table for desktop/tablet as appropriate.

Add a focused responsive/component assertion and leave final real-browser `E2E-03` / release-level responsive evidence to Issue #42.

---

### 5. [Medium] Create and Edit have no explicit success feedback required by §5.8

**File:** `client/src/AdminUserManagement.tsx`

The frozen Administrator UI contract requires:

> Clear validation, success, forbidden, and safe API-failure feedback.

Reset Password provides explicit success feedback:

```tsx
{resetSuccess && (
  <p className="notice" role="status">
    {resetSuccess}
  </p>
)}
```

Create and Edit do not.

Create currently does:

```ts
await apiJson(...);
setCreateOpen(false);
setCreateForm(EMPTY_FORM);
await loadUsers();
```

Edit similarly closes the dialog and reloads the list.

A changed table row is useful visual confirmation, but it is not the explicit success feedback required by §5.8, and it is especially weak if the current search/filter means the created or edited User is no longer visible after reload.

**Requested change:** Provide explicit non-error success feedback after successful Create and Edit, for example:

```text
User created successfully.
User updated successfully.
```

Prefer a `role="status"` / live-region notice that does not steal focus.

Add UI tests confirming that successful create/edit produce that feedback, while failed requests preserve the form and do not display false success.

---

### 6. [Medium / Contract] §26 now claims partial-update semantics come from `specification.md` decision 20, but decision 20 is unrelated

**Files:**
- `docs/lab-03/api-spec.md` §26
- `docs/lab-03/specification.md` §13

The frozen base version of §26 did **not** contain a partial-update-semantics paragraph.

PR #48 adds:

```md
**Partial-update semantics:** This endpoint uses partial-update semantics as specified in
`specification.md` §13, decision 20. Omitted fields are left unchanged; an empty/no-op body
returns `200 OK` with the current row; unknown properties, including `passwordHash`, are
ignored.
```

However, current `specification.md` decision **20** is:

```md
20. Eligible Ticket-owner lookup endpoint (Issue #38 ...)
```

It defines:

```text
GET /api/staff/owners
```

and has nothing to do with Administrator PATCH semantics.

So the new normative statement has a broken source of authority.

More importantly, this task was explicitly defined against a **frozen contract**. The PR should not silently turn an implementation choice into a frozen rule by editing the contract that it is supposed to implement.

**Requested change:** Reconcile this explicitly.

Either:

1. if partial PATCH / no-op / unknown-property behavior was formally approved, record it as a correctly numbered and clearly authorized contract amendment, then reference that actual decision; or
2. remove the unsupported normative addition from the frozen API document and avoid claiming that decision 20 defines this behavior.

The implementation itself may still use ordinary partial-PATCH semantics, but the documentation must not cite an unrelated Issue #38 decision as frozen authority.

---

## Previous Review Findings Verified Resolved

### Role-specific navigation

Administrator now starts on the Staff Queue according to the current §5.3 contract and receives:

```text
Ticket Queue
User Management
```

without Requester-only My Tickets/Create Ticket navigation.

IT Staff and Requester navigation remain separated.

### Inactive Administrator edit

The last-active-Administrator check now correctly requires:

```ts
target.isActive === true
```

before an Administrator demotion/deactivation is treated as count-reducing.

This resolves the previous false `409` for an already-inactive Administrator.

### Successful self-demotion

A successful self-edit publishes the returned name/email/role into the shared authenticated User:

```ts
onUserUpdated(...)
```

and role-based App view gating removes Administrator-only User Management after demotion.

### Modal keyboard behavior

The shared `Modal.tsx` now provides:

- initial focus;
- Tab wrap;
- Shift+Tab wrap;
- Escape dismissal;
- focus restoration;
- mutation protection while busy.

Create, Edit, and Reset Password have focused keyboard tests.

## Backend Contract Areas Verified

The current Administrator implementation covers:

- `GET /api/admin/users`;
- case-insensitive name/email substring search;
- optional exact role filter;
- unrecognized role → no filter / never 400;
- `POST /api/admin/users`;
- unique normalized email;
- one scalar Role;
- activation state;
- frozen password-policy reuse;
- bcrypt password storage;
- `mustChangePassword = true`;
- `PATCH /api/admin/users/:userId`;
- name/email/role/activation changes;
- duplicate-email pre-check and `P2002` race handling;
- self-deactivation rejection;
- last-active-Administrator deactivation/demotion checks;
- permitted non-last self-demotion;
- nonexistent User 404;
- `POST /initial-password`;
- reset password policy;
- `mustChangePassword = true`;
- Administrator-only role gates;
- CSRF on all three mutations;
- no User delete endpoint;
- no bulk/import/export/role-history/department/profile functionality.

## Test / Evidence Note

The latest Issue #41 evidence index records verification at implementation SHA:

```text
c8568cc
```

with:

- focused App/UserManagement/AuthGate: **37 passed**
- focused Administrator API: **38 passed**
- Staff client integration: **68 passed**
- Staff server integration: **93 passed**
- full client suite: **229 passed / 17 files**
- full server suite: **577 passed / 39 files**
- TypeScript checks: passed
- client/server builds: passed
- `git diff --check`: passed

The current PR head `d18464aa` is two commits ahead of that source SHA; those later commits modify evidence/documentation rather than the Administrator implementation.

No GitHub commit statuses or PR-triggered workflow runs were returned for current head `d18464aa`, so these remain repository-recorded local results rather than independently confirmed CI.

The PR description is also stale: it still reports the older **467 server / 130 client** totals rather than the current **577 / 229** evidence.

`E2E-03` remains explicitly assigned to Issue #42 and is not treated here as a missing Issue #41 implementation.

## Conclusion

**Request changes.**

The original four PR #48 findings have been addressed, and the normal Administrator CRUD paths are in good shape.

The two material blockers are:

1. PR #48 currently contains a large, separate Issue #38 implementation instead of remaining an intentionally minimal Issue #41 PR.
2. The BR-28 invariant is still vulnerable to a concurrent stale-classification race because the target's active-Administrator state is read outside the Serializable transaction.

The remaining corrections concern self-reset authentication state, mobile responsiveness, explicit success feedback, and frozen-contract documentation integrity.

I would re-review after the branch is scope-cleaned and the BR-28 transaction boundary is corrected.

</details>

<details>
<summary>2026-09-24T15:36:15Z — CHANGES_REQUESTED by @oangsa</summary>

# PR #48 — Re-review

**PR:** https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/48<br>
**Reviewed head:** `b61e2362760d55058798047a34d1611429a34f78`<br>
**Base:** `lab3-staging @ bde221fc4bce5cbc6889cfd5c2c5cb1e3a1c371d`<br>
**Disposition:** Request changes

I re-reviewed the current head against the supplied Issue #41 objective and frozen Administrator User Management contract.

Two major findings from the previous review are now resolved:

- **Scope contamination is resolved.** PR #48 is now a 33-file diff and no longer includes the separate Staff Queue / Staff Detail implementation as PR-owned source changes.
- **The BR-28 stale-classification race is resolved.** Role/activation mutations now re-read the target, classify the operation, check the active-Administrator count, and write inside the same Serializable transaction. The new regression exercises the previously reported inactive→active race.

The normal Administrator API paths and the 10 required safety rules are otherwise in good shape.

## Remaining Findings

### 1. [Medium] Resetting the signed-in Administrator's own initial password leaves the authenticated UI in an invalid state

**Files:**
- `client/src/AdminUserManagement.tsx`
- `client/src/AuthGate.tsx`

`POST /api/admin/users/:userId/initial-password` correctly sets:

```text
mustChangePassword = true
```

and BR-02 says:

> A user marked as requiring a password change cannot enter the normal application until a new valid password is saved.

The authentication middleware also re-reads the current User on every protected request, so after an Administrator resets **their own** initial password, their current session immediately becomes subject to `PASSWORD_CHANGE_REQUIRED` on normal application endpoints.

However, `submitReset()` only does:

```ts
setResetSuccess("Initial password set. The user must change it at next login.");
setResetPassword("");
```

It does not update the shared authenticated User when:

```ts
resetTarget.id === currentUser.id
```

and `AuthGate.handleUserUpdated()` currently only:

```ts
setUser(nextUser);
```

without transitioning to the `change-password` state.

The client therefore continues displaying User Management even though the server will reject its next protected application request with:

```text
401 PASSWORD_CHANGE_REQUIRED
```

A page reload eventually recovers because `fetchMe()` sees `mustChangePassword = true`, but the live UI should not require a reload to synchronize with the authoritative account state.

**Requested change:** After a successful self-reset, propagate:

```ts
mustChangePassword: true
```

to the shared authenticated user and transition `AuthGate` to the Change Password flow.

For example, `handleUserUpdated()` can derive the state from the new user:

```ts
setUser(nextUser);
setState(nextUser.mustChangePassword ? "change-password" : "authenticated");
```

Add a regression covering:

```text
Administrator resets own initial password
→ mustChangePassword becomes true
→ normal application disappears
→ Change Password screen is shown
```

---

### 2. [Medium] Administrator User Management still does not implement the frozen mobile card layout

**Files:**
- `client/src/AdminUserManagement.tsx`
- `client/src/App.css`
- `client/src/lab-03-tests/UserManagement.test.tsx`

The frozen responsive rules specify:

```text
Desktop >=992px  → Full table layouts
Tablet 768–991px → Condensed tables
Mobile <768px    → Card layouts
```

User Management always renders the same table:

```tsx
<div className="tickets-table-wrapper">
  <table className="tickets-table">
```

There is no mobile User card representation.

The mobile CSS only changes the toolbar/control layout. It does not replace the User Management table.

This is especially problematic because the common wrapper now has:

```css
.tickets-table-wrapper {
  overflow-x: hidden;
}
```

so content that does not fit the viewport is clipped rather than scrollable.

The table includes:

```text
Name
Email
Role
Status
Edit
Reset Password
```

which is not a suitable five-column mobile layout.

There is also no User Management responsive/card test in `UserManagement.test.tsx`.

**Requested change:** Render one User per card below 768px with all required information and actions:

```text
Name
Email
Role
Status
Edit
Reset Password
```

Keep the table representation for larger breakpoints.

Add a focused test verifying the mobile representation exists and retains all required fields/actions.

---

### 3. [Medium] Create and Edit still have no explicit success feedback required by §5.8

**File:** `client/src/AdminUserManagement.tsx`

The frozen §5.8 contract explicitly requires:

> Clear validation, success, forbidden, and safe API-failure feedback.

Reset Password satisfies this with:

```tsx
{resetSuccess && (
  <p className="notice" role="status">
    {resetSuccess}
  </p>
)}
```

Create and Edit do not.

Create currently succeeds by:

```ts
setCreateOpen(false);
setCreateForm(EMPTY_FORM);
await loadUsers();
```

and Edit similarly closes the dialog and reloads the list.

There is no explicit success announcement such as:

```text
User created successfully.
User updated successfully.
```

A table refresh is not equivalent to clear success feedback, especially when a search or role filter causes the newly created/modified User to disappear from the current result set.

**Requested change:** Add a non-error live/status message following successful Create and Edit.

For example:

```tsx
<p role="status" className="notice">
  User created successfully.
</p>
```

and equivalent feedback for Edit.

Add tests verifying:

- successful create → success feedback;
- successful edit → success feedback;
- failed create/edit → no false-success feedback;
- failed mutation continues preserving entered form data.

---

### 4. [Medium / Contract] §26 still cites an unrelated decision as authority for new PATCH semantics

**Files:**
- `docs/lab-03/api-spec.md` §26
- `docs/lab-03/specification.md` §13

PR #48 adds this to the frozen API contract:

```md
**Partial-update semantics:** This endpoint uses partial-update semantics as specified in
`specification.md` §13, decision 20. Omitted fields are left unchanged; an empty/no-op body
returns `200 OK` with the current row; unknown properties, including `passwordHash`, are
ignored.
```

But current `specification.md` decision **20** is:

```text
Eligible Ticket-owner lookup endpoint
GET /api/staff/owners
```

It has no relationship to Administrator PATCH behavior.

The citation is therefore factually incorrect.

Also, the base version of the frozen §26 contract did not contain this paragraph; PR #48 is introducing additional normative semantics into the document it is supposed to implement.

The implementation behavior itself is reasonable, and the generic API contract already says unknown JSON properties are ignored. The problem is presenting the additional no-op/partial-update behavior as a frozen rule sourced from an unrelated decision.

**Requested change:** Either:

1. point to an actual approved contract decision that defines these semantics; or
2. remove the unsupported `decision 20` claim and avoid describing the implementation choice as frozen contractual behavior.

Do not leave the current incorrect cross-reference.

---

## BR-28 Fix Verified

The previous concurrency blocker is materially corrected.

Role or activation mutations now enter the Serializable path:

```ts
if (role === undefined && isActive === undefined) {
  // only name/email can use the simple write path
}
```

and the target is re-read inside the transaction:

```ts
const currentTarget = await tx.user.findUnique(...)
```

Only then does the service determine:

```ts
const deactivatesAdmin = ...
const demotes = ...
```

and count active Administrators before the write.

This closes the stale pre-transaction classification hole from the previous review.

The new regression forces the reported sequence:

```text
B read inactive
→ B concurrently activated
→ A concurrently demoted
→ stale B demotion resumes
```

and now expects:

```text
409 CONFLICT
final active Administrator count = 1
```

That directly exercises the earlier defect rather than merely adding a nominal test.

## Core Contract Areas Verified

The current implementation covers the required backend surface:

- `GET /api/admin/users`
- name/email case-insensitive substring search
- optional role filter
- unknown role filter → no filter / never 400
- `POST /api/admin/users`
- normalized unique email
- one scalar role
- activation state
- frozen password policy
- bcrypt password storage
- `mustChangePassword = true`
- `PATCH /api/admin/users/:userId`
- name/email/role/activation editing
- duplicate email on create/edit → 409
- invalid role → 400
- self-deactivation → 409
- last-active-Administrator deactivation → 409
- last-active-Administrator demotion → 409
- non-last self-demotion permitted
- nonexistent edit/reset target → 404
- `POST /initial-password`
- Administrator-only authorization
- CSRF on all mutations
- no delete/bulk/import/export/history/department/profile functionality.

The previous modal-accessibility findings are also resolved through the shared `Modal` implementation and focused keyboard tests.

## Evidence

Repository evidence for the latest server implementation SHA `49c9c1a` records:

```text
Admin API:     39 passed
Full server:   578 passed / 39 files / 0 skipped
Server build:  passed
git diff check: passed
```

The full server evidence file does contain the final successful `578 passed` summary.

Earlier integrated client evidence records:

```text
229 passed / 17 files / 0 skipped
```

The current PR head `b61e236` is two commits after `49c9c1a`; those commits only update tests/evidence/docs, not the server implementation.

There are currently no GitHub commit statuses or pull-request workflow runs attached to `b61e236`, so these are repository-recorded local executions rather than independently reproduced CI results.

The PR description is also still stale: it advertises **467 server / 130 client** tests while the newer evidence records **578 / 229**.

`E2E-03` remains assigned to Issue #42 and is not treated as an Issue #41 blocker here.

## Conclusion

**Request changes.**

The two previous major blockers—scope contamination and the BR-28 concurrency race—are fixed.

The remaining work is now concentrated in the Administrator UI/contract layer:

1. synchronize the authenticated state after resetting your own initial password;
2. implement the required mobile card layout;
3. provide explicit Create/Edit success feedback;
4. correct the invalid frozen-contract `decision 20` reference.

After those are addressed, this PR should be much closer to approval.

</details>

<details>
<summary>2026-09-24T16:55:26Z — CHANGES_REQUESTED by @oangsa</summary>

# PR #48 — Re-review

**PR:** https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/48<br>
**Reviewed head:** `85a26eae35f3f3c2e65c4af8ae8fdc14dcb5e6c9`<br>
**Base:** `lab3-staging @ bde221fc4bce5cbc6889cfd5c2c5cb1e3a1c371d`<br>
**Disposition:** Request changes

The four findings from the previous review are now resolved:

- self-reset immediately moves the current Administrator into the Change Password flow;
- User Management now has a separate mobile card representation with all required fields/actions;
- Create and Edit now provide explicit `role="status"` success feedback;
- the incorrect `specification.md` decision-20 attribution was removed from API §26.

The BR-28 concurrency correction also remains intact, and PR #48 remains scope-clean relative to the current `lab3-staging`.

I found one remaining state-synchronization issue.

## Remaining Finding

### [Medium] Completing the forced password change leaves `mustChangePassword` stale in `AuthGate`

**Files:**
- `client/src/AuthGate.tsx`
- `client/src/ChangePassword.tsx`
- `client/src/lab-03-tests/AuthGate.test.tsx`

The new self-reset flow correctly does:

```ts
onUserUpdated({
  ...currentUser,
  mustChangePassword: true,
});
```

and `AuthGate` correctly responds with:

```ts
function handleUserUpdated(nextUser: AuthUser) {
  setUser(nextUser);
  setState(
    nextUser.mustChangePassword
      ? "change-password"
      : "authenticated",
  );
}
```

So after an Administrator resets their own initial password, the normal application disappears and the Change Password screen is shown. This fixes the previous finding.

However, after the password is successfully changed, `AuthGate` currently does only:

```ts
function handlePasswordChanged() {
  setState("authenticated");
}
```

It does **not** update the cached authenticated User from:

```ts
mustChangePassword: true
```

back to:

```ts
mustChangePassword: false
```

The server state is correct because the Change Password API clears the flag, but the client keeps an outdated authenticated identity.

### Why this matters

The user can enter the application after changing their password because `state` is manually switched to `"authenticated"`.

But `user.mustChangePassword` is still `true`.

Later, if User Management publishes another authenticated-user update—for example, the Administrator edits their own name/email/role—it starts from the stale `currentUser`:

```ts
onUserUpdated({
  ...currentUser,
  name: result.data.name,
  email: result.data.email,
  role: result.data.role,
});
```

That object still carries:

```ts
mustChangePassword: true
```

and `AuthGate.handleUserUpdated()` will incorrectly send the user back to the Change Password screen even though they already completed the required password change.

So the flow can become:

```text
self-reset
→ Change Password
→ successful password change
→ application
→ edit own profile
→ incorrectly forced back to Change Password
```

This is a stale client-authentication-state bug.

## Requested Change

When the password-change flow succeeds, synchronize the cached authenticated User as well as the screen state.

For example:

```ts
function handlePasswordChanged() {
  setUser((current) =>
    current
      ? { ...current, mustChangePassword: false }
      : current,
  );
  setState("authenticated");
}
```

Alternatively, re-fetch `/api/auth/me` after a successful password change and use that response as the new authenticated User.

The important requirement is:

```text
successful password change
→ cached mustChangePassword = false
→ authenticated application
```

### Regression test

Extend the AuthGate regression so it verifies the complete lifecycle rather than only entering the Change Password screen:

```text
authenticated Administrator
→ self-reset publishes mustChangePassword=true
→ Change Password screen appears
→ password change succeeds
→ application returns
→ subsequent ordinary identity update
→ application remains authenticated
```

At minimum, verify that after `onChanged()`:

```ts
mustChangePassword === false
```

is reflected in the identity passed to the application.

---

## Previous Findings Verified Resolved

### Self-reset

`AdminUserManagement.submitReset()` now detects:

```ts
resetTarget.id === currentUser.id
```

and publishes:

```ts
mustChangePassword: true
```

to `AuthGate`.

`AuthGate.handleUserUpdated()` switches immediately to the Change Password flow.

Focused coverage is present for both the User Management publication and AuthGate transition.

### Mobile responsive representation

User Management now provides two explicit structures:

```tsx
<div className="tickets-table-wrapper desktop-only admin-users-desktop">
```

and:

```tsx
<div
  className="tickets-cards mobile-only admin-user-cards"
  aria-label="Users"
>
```

Each mobile User card exposes:

- Name
- Email
- Role
- Status
- Edit
- Reset Password

The component test now verifies that the separate mobile structure exists and contains the required information/actions.

Final real-browser responsive evidence remains appropriately deferred to Issue #42.

### Create / Edit success feedback

Successful Create now produces:

```text
User created successfully.
```

and successful Edit produces:

```text
User updated successfully.
```

through a `role="status"` notice.

The tests verify both success announcements and also verify that failure cases do not produce false success.

### API §26 contract attribution

The unsupported paragraph claiming that partial PATCH semantics came from:

```text
specification.md §13 decision 20
```

has been removed.

Decision 20 remains correctly scoped to the Staff-owner lookup and is no longer misrepresented as Administrator PATCH authority.

---

## Backend / Safety Rules Verified

The current implementation continues to satisfy the supplied Issue #41 safety rules:

1. duplicate email on create → `409`
2. duplicate email on edit → `409`
3. invalid role rejected
4. self-deactivation rejected
5. last active Administrator deactivation rejected
6. last active Administrator demotion rejected
7. non-Administrator access → `403`
8. exactly one scalar role per User
9. non-last Administrator self-demotion permitted
10. edit/reset nonexistent User → `404`

The BR-28 race fix remains correct:

- role/activation mutations enter the Serializable path;
- the target is re-read inside the transaction;
- active-Administrator classification uses that transactional state;
- the count check and write occur in the same transaction;
- `API-ADM-12` exercises the previously reported inactive→active stale-state interleaving.

## Scope

The previous scope-contamination problem remains resolved.

The current PR changed-file set is limited to Issue #41 implementation, tests, supporting shell/modal integration, documentation, and Issue #41 evidence. The separate Staff implementation is no longer being introduced by this PR relative to the current base.

## Verification Evidence

Latest committed evidence records:

- focused client: **41 passed / 3 files**
- full client: **233 passed / 17 files / 0 skipped**
- Administrator API: **39 passed**
- full server: **578 passed / 39 files / 0 skipped**
- client/server type checks: passed
- client/server production builds: passed
- `git diff --check`: passed

The tested client implementation SHA is:

```text
05b03516087d537944cbfe0f8020dca805abd347
```

Current head `85a26eae` is one later evidence/documentation reconciliation commit.

There are no GitHub commit statuses or PR-triggered workflow runs attached to the current head, so the above remains repository-recorded local verification rather than independently confirmed CI.

The mobile screenshot is explicitly documented as stale and is not being claimed as current browser evidence. Final browser-responsive verification and `E2E-03` remain owned by Issue #42.

## Conclusion

**Request changes for one remaining state-synchronization bug.**

All four findings from the previous review are fixed.

The only remaining blocker I found is that a successful forced password change does not clear `mustChangePassword` from `AuthGate`'s cached User, which can incorrectly force the Administrator back into Change Password after a later self-update.

**After this one item is fixed and the affected regression tests remain green, I would approve PR #48 from the Issue #41 scope.**

</details>

<details>
<summary>2026-09-25T06:30:36Z — APPROVED by @oangsa</summary>

LGTM!

</details>

#### [PR #49 — Issue #38 Staff Ticket Operations](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/49)

<details>
<summary>2026-09-22T14:24:54Z — CHANGES_REQUESTED by @oangsa</summary>

## Findings

### P1 — Staff and Administrator users land on the Requester-only screen

**Source:** [`client/src/App.tsx`](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/bded1558285ec1ad092bf5e17a8d22d91517271b/client/src/App.tsx)

`App` initializes `view` to `"home"` for every role and renders the `home` (My Tickets) and `create-ticket` branches without guarding them by role. On a fresh IT Staff or Administrator login, the application therefore opens My Tickets, whose API is correctly restricted to Requesters and returns `403`. The Staff Queue is only reached after an explicit navigation action. This disrupts the required Staff operational entry flow.

**Requested change:** Initialize the default view from the authenticated user's role (`staff-queue` for IT Staff/Administrator, Requester home otherwise), prevent Staff/Admin from rendering Requester-only views, and add tests for initial login and role-specific navigation for both staff roles. Keep authorization enforcement on the server.

### P1 — Staff Ticket Detail does not expose existing Attachments

**Sources:** [`server/src/service.ts`](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/bded1558285ec1ad092bf5e17a8d22d91517271b/server/src/service.ts) · [`client/src/StaffTicketDetail.tsx`](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/bded1558285ec1ad092bf5e17a8d22d91517271b/client/src/StaffTicketDetail.tsx) · [`docs/lab-03/ui-spec.md` §5.7](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/bded1558285ec1ad092bf5e17a8d22d91517271b/docs/lab-03/ui-spec.md)

`getStaffTicketDetail()` returns Ticket details, Public Comments, and Internal Notes without an Attachment collection; the Staff Ticket Detail component likewise has no attachment list or preview/download controls. The issue and UI contract require staff to be able to view existing Attachments while prohibiting staff-side upload and removal.

**Requested change:** Display a read-only attachment section in Staff Ticket Detail using the existing authorized list, preview, and download APIs. Preserve the Staff/Admin view-only authorization boundary and test list/preview/download availability, removed or unavailable files, and absence of mutation controls.

### P2 — Staff Queue page-size handling conflicts with the documented clamp rule

**Sources:** [`server/src/service.ts` (`parseQueueQuery`)](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/bded1558285ec1ad092bf5e17a8d22d91517271b/server/src/service.ts) · [`docs/lab-03/api-spec.md` §15](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/bded1558285ec1ad092bf5e17a8d22d91517271b/docs/lab-03/api-spec.md) · [`server/tests/lab-03/staff-queue.api.test.ts`](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/bded1558285ec1ad092bf5e17a8d22d91517271b/server/tests/lab-03/staff-queue.api.test.ts)

The frozen API spec says an out-of-range `pageSize` is clamped to the nearest bound within 1–50. `parseQueueQuery()` instead defaults an out-of-range value to 10; the test currently expects 10 for `pageSize=999`. Thus the parser and test agree with each other but not with the stated API contract.

**Requested change:** Clamp valid numeric out-of-range page sizes to 1 or 50; retain the documented safe fallback for malformed inputs. Add boundary tests (including `0`, `51`, `999`, and malformed text). If the intended behavior is actually the default of 10, reconcile the frozen specification explicitly rather than silently changing its meaning.

### P2 — Status confirmation modal misses specified keyboard and focus behavior

**Sources:** [`client/src/StaffTicketDetail.tsx`](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/bded1558285ec1ad092bf5e17a8d22d91517271b/client/src/StaffTicketDetail.tsx) · [`docs/lab-03/ui-spec.md` §8](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/bded1558285ec1ad092bf5e17a8d22d91517271b/docs/lab-03/ui-spec.md)

The confirmation modal for transitions to Resolved, Closed, and Cancelled exposes dialog semantics but does not implement initial focus placement, a Tab/Shift+Tab focus trap, Escape dismissal, or restoration of focus to the invoking control. These behaviors are required by the UI accessibility specification.

**Requested change:** Implement those four behaviors and add keyboard tests covering open, traversal, Escape/cancel, confirmation, and focus restoration; preserve the rule that the API is called only after confirmation.

## Contract clarification — who may change the status of an assigned Ticket?

**Sources:** [`server/src/service.ts` (`applyStatusTransition`)](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/bded1558285ec1ad092bf5e17a8d22d91517271b/server/src/service.ts) · [`docs/lab-03/specification.md` §§6–7](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/bded1558285ec1ad092bf5e17a8d22d91517271b/docs/lab-03/specification.md) · [`docs/lab-03/api-spec.md` §19](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/bded1558285ec1ad092bf5e17a8d22d91517271b/docs/lab-03/api-spec.md)

The service rejects a status change unless `ticketOwnerId === actingUserId`. The frozen text explicitly requires the Ticket to *have an owner* before status changes, and grants Staff/Administrators the status operation; it does not expressly state that the acting staff member must personally be the owner. The current behavior would force a colleague to reassign the Ticket before changing its status.

**Requested clarification:** Confirm whether the rule is “Ticket must be assigned to any eligible owner” or “actor must be the assigned owner.” Document that choice in the contract and cover an assigned-to-another-staff-member case. This is a contract ambiguity, not an independently established defect.

## Verified scope and evidence limitations

The inspected code includes the Staff Queue, eligible-owner lookup, Staff Ticket Detail operations, Public Comments, Internal Notes, and Requester resolution indication. The PR description reports **516 passing server tests and 153 passing client tests**, but these were **not independently run** as part of this review. E2E-02, VISUAL-02, and final integration/release evidence are explicitly deferred to Issue #42 and are not separately treated as #38 implementation defects.

</details>

<details>
<summary>2026-09-23T03:16:37Z — CHANGES_REQUESTED by @oangsa</summary>

# PR #49 — Updated Review

**PR:** https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/49<br>
**Reviewed head:** `3390f489`<br>
**Review disposition:** Request changes

The latest commits address several earlier findings: role-specific landing and navigation, read-only attachments on Staff Ticket Detail, `pageSize` clamping, cross-owner status changes, and modal keyboard handling. Those issues should not be carried forward as unresolved.

## Remaining Findings

### 1. [High] Staff Queue still lacks the required condensed tablet layout

**Files:**
- `client/src/StaffTicketQueue.tsx`
- `client/src/App.css`
- `docs/lab-03/ui-spec.md` §5.6

The Queue renders the same ten-column table at every viewport width of 768px and above. The application container is capped at 760px, and the table wrapper allows horizontal scrolling. There is no tablet-specific condensed representation.

This does not meet §5.6, which requires a condensed table at 768–991px and prohibits horizontal overflow or an unreadable mega-grid.

**Requested change:** Condense or combine secondary columns at tablet widths while keeping all required information accessible. Verify the rendered layout at representative desktop, tablet, and mobile widths. Existing component tests establish that fields are present in the DOM, not that the layout fits.

### 2. [Medium] Status controls remain enabled for unassigned Tickets

**File:** `client/src/StaffTicketDetail.tsx`

The component derives available transition buttons from `currentStatus` and disables them only while an action is pending. An unassigned `NEW` Ticket therefore offers an enabled **Open** action, even though the backend correctly requires ownership and will return `409 CONFLICT`.

**Requested change:** Disable status-transition controls when `ticketOwnerId === null` and explain that the Ticket must first be claimed or assigned. Retain the backend's claim-before-status-change validation. Add a UI test for this state.

### 3. [Medium] Confirming a status change can lose keyboard focus

**Files:**
- `client/src/StaffTicketDetail.tsx`
- `client/src/lab-03-tests/StaffTicketDetail.test.tsx`

The modal now handles initial focus, Tab/Shift+Tab, Escape, and focus restoration on dismissal. However, `performTransition()` calls `load()` before closing the modal. `load()` temporarily replaces the entire Detail screen with a loading skeleton, potentially unmounting the transition button saved as the focus-restoration target.

When the modal closes, its restoration logic may attempt to focus a detached element.

**Requested change:** Coordinate modal dismissal and refetch so focus returns to a currently mounted control. Add a test that confirms a transition with a delayed refetch and checks the final focused element. The existing restoration test covers Escape, not this confirmation path.

### 4. [Medium] API tests do not cover every status-transition pair

**File:** `server/tests/lab-03/staff-ticket-detail.api.test.ts`

The suite covers the principal workflow, cross-owner Staff/Admin changes, and selected forbidden transitions. It does not establish the objective's explicit requirement to test **every permitted transition and every forbidden transition**.

**Requested change:** Add table-driven coverage for all eight source statuses against all eight target statuses. Assert success for every permitted pair. For every forbidden pair, assert `409 CONFLICT` and verify that the persisted status remains unchanged. Include each permitted cancellation path.

### 5. [Medium] Forbidden Queue access is presented as a generic API failure

**Files:**
- `client/src/StaffTicketQueue.tsx`
- `docs/lab-03/ui-spec.md` §5.6

The Queue implements `loading`, `loaded`, `empty`, `no-results`, and `error` states, but it has no distinct forbidden state. A `403` therefore produces the ordinary failure message and Retry action, although §5.6 explicitly requires forbidden feedback.

**Requested change:** Handle API errors with `status === 403` as an access-denied state, distinct from network or server failures. Add a frontend test for the forbidden response.

## Test and Release Evidence

The updated `docs/lab-03/tests.md` reports:

- Server: **531 passed, 0 skipped**
- Client: **174 passed, 0 skipped**
- Server and client builds: **successful**

These are repository-reported results; I did not independently execute the test suites. No CI status or workflow run was returned for the reviewed head.

E2E-02 and final responsive/visual evidence remain deferred to Issue #42 and should not yet be described as verified for this commit.

## Conclusion

**Request changes**, primarily because the required condensed tablet Queue layout remains unimplemented. The other findings concern focused UI behavior and test coverage; they do not require redesigning the Staff API.

</details>

<details>
<summary>2026-09-23T17:08:33Z — CHANGES_REQUESTED by @oangsa</summary>

# PR #49 — Updated Review

**PR:** https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/49<br>
**Reviewed head:** `a56a34ae3d8a49320140754755d3939987540c39`<br>
**Review disposition:** Request changes

The latest commits address several findings from the previous review:

- status-transition controls are now disabled while a Ticket is unassigned;
- confirmed-transition refetches preserve the mounted Detail screen so focus can be restored safely;
- the Queue now distinguishes `403 FORBIDDEN` from ordinary API failures;
- tablet header/body column visibility is aligned;
- the backend suite now executes all 8×8 status source/target combinations.

Those findings should not be carried forward in their previous form.

## Remaining Findings

### 1. [High] Staff Queue responsive implementation still does not satisfy the no-overflow / information-access requirement

**Files:**
- `client/src/StaffTicketQueue.tsx`
- `client/src/App.css`
- `client/src/StaffTicketDetail.tsx`
- `docs/lab-03/ui-spec.md` §5.6

The latest change adds `.tablet-secondary` and hides Category, Requested Priority, Created, and Last Updated at 768–991px. That fixes the previous header/body mismatch, but it does not fully satisfy the responsive contract.

`App.css` still contains:

```css
.app-container { max-width: 760px; ... }
.tickets-table-wrapper { overflow-x: auto; }
```

and there is no wider `.staff-queue` override.

At desktop widths the Queue therefore still places the full table inside a container capped at 760px, with horizontal scrolling explicitly enabled. This conflicts with §5.6, which states that the implementation must not create horizontal overflow or an unreadable mega-grid.

There is also a tablet information-access problem. `Last Updated` is hidden using `.tablet-secondary`, but Staff Ticket Detail currently displays `Created` and does not display `detail.updatedAt`. Therefore Last Updated is not accessible through Detail after being removed from the tablet table.

The current tablet test only verifies that header and body cells have matching `tablet-secondary` classes. It does not establish that:

- the table fits at 768–991px;
- desktop avoids horizontal overflow;
- hidden required information remains accessible elsewhere.

**Requested change:** Give Staff Queue an appropriate desktop width / column strategy rather than relying on horizontal scrolling. For tablet, either condense secondary information into visible cells or ensure every hidden required value is available in Detail, including Last Updated.

---

### 2. [High] A Requester Public Comment can be successfully created but reported as failed, allowing an accidental duplicate

**Files:**
- `client/src/App.tsx`
- `client/src/CommentThread.tsx`

Requester Ticket Detail currently wires Public Comments as:

```ts
onPost={async (content) => {
  await postTicketComment(ticketDetail.ticketNumber, content);
  const data = await fetchTicketDetail(ticketDetail.ticketNumber);
  setTicketDetail(data);
}}
```

`CommentThread` treats any rejection from `onPost()` as a failed Comment submission and deliberately preserves the entered text for retry.

This creates an unsafe partial-success path:

1. `POST /comments` succeeds and persists the append-only Comment.
2. The following Ticket Detail refresh fails.
3. `onPost()` rejects.
4. The UI reports that posting failed and preserves the Comment text.
5. The user retries.
6. A duplicate append-only Comment is created.

Because Comments cannot be edited or deleted under BR-21, this is particularly problematic.

The Requester "Problem Appears Resolved" action has the same mutation-vs-refresh issue: a successful POST followed by a failed refresh is presented as if the update itself failed.

**Requested change:** Separate mutation success from refresh success. Once `postTicketComment()` returns successfully, treat the Comment creation as successful regardless of a subsequent refresh failure. For example, append the returned Comment locally and handle refresh failure separately.

Apply the same pattern to the appears-resolved control.

Add a frontend test covering:

```text
POST succeeds → refresh GET fails
```

and verify that the UI does not encourage a duplicate mutation.

---

### 3. [Medium] Staff Ticket Detail does not implement distinct Not Found / Forbidden / Unexpected Failure states

**Files:**
- `client/src/StaffTicketDetail.tsx`
- `client/src/lab-03-tests/StaffTicketDetail.test.tsx`
- `docs/lab-03/ui-spec.md` §5.7

The frozen UI contract requires Staff Ticket Detail screen-level states for:

- Loading
- Not found (404)
- Forbidden (403)
- Unexpected failure

`StaffTicketDetail` currently stores only an error string:

```ts
catch (err) {
  setError(err instanceof Error ? err.message : "Failed to load ticket detail.");
}
```

Every failure is then shown through the same generic error block with both **Back to Queue** and **Retry**.

As a result:

- `403 FORBIDDEN` looks like a retryable API failure;
- `404 NOT_FOUND` is not distinguished from network/500 failures;
- unauthorized state is not explicitly represented.

The frontend tests also use only a generic `Error("Not found")`, with no specific 403/404 coverage.

**Requested change:** Preserve `ApiError.status` and render distinct 403, 404, and unexpected-failure states. Add focused tests for each state.

---

### 4. [Medium] The new 8×8 status-matrix test is circular and does not independently prove the frozen matrix

**Files:**
- `server/src/ticket-status.ts`
- `server/src/service.ts`
- `server/tests/lab-03/staff-ticket-detail.api.test.ts`
- `docs/lab-03/specification.md` §7

The new `API-STAFF-11` test executes every source/target status pair, which is useful. However, the expected outcome is calculated using:

```ts
const permitted = isTransitionAllowed(fromStatus, targetStatus);
```

That is the same shared transition implementation used by production code.

Therefore, if `ticket-status.ts` is changed incorrectly, both:

- the API behavior; and
- the test's expected result

change together, and the 8×8 test may still pass while violating the frozen §7 matrix.

**Requested change:** Keep the endpoint-wide 8×8 test, but make its expectation independent of `isTransitionAllowed()`. Define the frozen matrix literally in the test, or add a separate unit test comparing the shared transition module against a literal §7 expectation.

The suite should independently prove:

1. the shared transition module matches the frozen contract;
2. the API follows that module.

---

### 5. [Medium] Staff Queue filter controls violate the frozen accessibility requirement for associated labels

**Files:**
- `client/src/StaffTicketQueue.tsx`
- `docs/lab-03/ui-spec.md` §8

The accessibility contract explicitly requires:

> All form controls have associated `<label>` elements (not placeholder-only labeling).

The Queue currently uses only `aria-label`:

```tsx
<input
  type="search"
  placeholder="Search ticket number or summary..."
  aria-label="Search tickets"
/>

<select aria-label="Filter by status">...</select>
<select aria-label="Filter by IT priority">...</select>
<select aria-label="Filter by owner">...</select>
```

`aria-label` provides an accessible name, but it does not satisfy the project's explicitly frozen `<label>` requirement.

**Requested change:** Add associated `<label htmlFor="...">` elements for Search, Status, IT Priority, and Owner. They may be visually hidden if necessary.

---

### 6. [Medium] `UI-QUE-01` is marked Passed for behavior that its test file does not currently test

**Files:**
- `docs/lab-03/tests.md`
- `client/src/lab-03-tests/StaffTicketQueue.test.tsx`

The `UI-QUE-01` row currently claims:

> Search/filter/sort/pagination ...

and the Issue objective explicitly requires frontend tests for sorting, pagination, loading, and responsive behavior.

The current Queue test file covers:

- rendering;
- search;
- status / priority / owner filters;
- combined filters;
- Clear Filters;
- empty / no-results;
- API failure;
- forbidden;
- required information;
- mobile card content;
- tablet secondary-column class alignment.

It does not contain an actual sorting interaction test, pagination interaction test, or loading-state test.

The presence of pagination fixture metadata is not equivalent to exercising Previous/Next behavior.

**Requested change:** Add tests that:

- activate a sortable header and verify `sort`, `order`, and page reset;
- use Next / Previous and verify the requested page;
- verify pagination boundary disabled states;
- verify the loading state.

Then keep `UI-QUE-01` marked Passed based on executed coverage.

## Test / Evidence Note

The latest `docs/lab-03/tests.md` records:

- focused client suite: **52 passed, 0 skipped**
- focused server suite: **41 passed, 0 skipped**
- server suite excluding migration harness: **514 passed across 37 files**
- client/server builds: successful

The PR description still contains the older **516 server / 153 client** result block, so the PR body is stale relative to the current head.

No GitHub commit status checks or workflow runs were returned for current head `a56a34ae`, so the repository-recorded local results were not independently confirmed by CI during this review.

E2E-02, VISUAL-02, and the final release/evidence matrix remain deferred to #42 and are not treated here as Issue #38 implementation defects.

## Conclusion

**Request changes.**

The previous review findings were substantially addressed, but the current head still has:

- a Queue responsiveness / information-access gap;
- an unsafe Requester Comment partial-success path;
- missing Staff Detail error-state distinctions;
- circular full-matrix verification;
- accessibility-label noncompliance;
- frontend Queue test claims that exceed the actual assertions.

These are focused corrections and do not require redesigning the backend Staff workflow.

</details>

<details>
<summary>2026-09-24T02:35:54Z — CHANGES_REQUESTED by @oangsa</summary>

# PR #49 — Updated Review

**PR:** https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/49<br>
**Reviewed head:** `aff9a0f6681adee0b43421e2071b466f5e899ac8`<br>
**Review disposition:** Request changes

This is a fresh review of the current head.

The six findings from the previous review have been substantially addressed:

- Staff Queue now has a wider desktop container, tablet condensation, and Last Updated is available in Staff Detail.
- Requester and Staff Public Comment flows commit the returned Comment locally before attempting a refresh, and Appears Resolved does the same with its returned state.
- Staff Detail now distinguishes `403`, `404`, and unexpected failures.
- The full 8×8 status test now uses a literal expected matrix rather than production `isTransitionAllowed()`.
- Queue search/status/priority/owner controls now have associated `<label>` elements.
- Queue tests now exercise sorting, pagination, and loading.

Those findings should not be carried forward in their previous form.

## Remaining Findings

### 1. [Medium] Successful Staff mutations other than Public Comments still depend on a follow-up GET to represent success

**Files:**
- `client/src/StaffTicketDetail.tsx`
- `client/src/InternalNoteThread.tsx`

Public Comments now correctly separate mutation success from refresh success:

```ts
const createdComment = await postTicketComment(ticketNumber, content);

setDetail((current) =>
  current
    ? { ...current, publicComments: [...current.publicComments, createdComment] }
    : current,
);

try {
  const refreshed = await fetchStaffTicketDetail(ticketNumber);
  setDetail(refreshed);
} catch (refreshErr) {
  setActionError(...);
}
```

However, the same pattern has not been applied consistently to the other Staff operations.

Internal Notes still use:

```ts
onPost={async (content) => {
  await postInternalNote(ticketNumber, content);
  await load();
}}
```

`load()` catches its own fetch error and sets the whole Staff Detail into the unexpected-failure state. Therefore this sequence is possible:

1. `POST /notes` succeeds and the append-only Internal Note is persisted.
2. The follow-up Staff Detail GET fails.
3. The note compose box treats `onPost()` as completed and clears its text.
4. The Detail screen switches to the generic unexpected-failure state.
5. The successfully created Note is not committed to local state or shown to the user.

Ownership, IT Priority, and Status have the same general dependency on a subsequent `load()` / `load(true)` after their mutation succeeds.

This does not create the duplicate-comment problem from the previous review, but it still does not cleanly represent **mutation success vs refresh failure**, despite the objective requiring controls to correctly represent success and API failure.

**Requested change:** Use the successful mutation response as the authoritative local success result before performing an optional refresh.

For example:

- Internal Note: append the returned Note locally;
- owner change: update local `ticketOwnerId`;
- IT Priority: update local `itPriority`;
- status transition: update local `currentStatus`.

Then perform the refresh separately. If that refresh fails, preserve the successful local mutation and show a non-destructive warning such as "Updated successfully, but refresh failed."

Add at least a focused Internal Note partial-success test, because Notes are append-only.

---

### 2. [Medium] Failure of the eligible-owner lookup silently removes required Queue/Detail functionality

**Files:**
- `client/src/StaffTicketQueue.tsx`
- `client/src/StaffTicketDetail.tsx`
- `docs/lab-03/ui-spec.md` §5.6–§5.7

Both screens load the eligible-owner set from `GET /api/staff/owners`.

On Staff Detail:

```ts
try {
  const result = await fetchAssignableOwners();
  if (!cancelled) setOwners(result);
} catch {
  if (!cancelled) setOwners([]);
}
```

The failure is completely silent.

The Queue behaves similarly. Its test explicitly verifies that when the owner lookup fails, the Queue remains usable and the owner filter simply remains present with no owners.

Graceful degradation is reasonable, but the required owner-dependent functionality has actually become unavailable:

- Queue can no longer filter by a specific owner.
- Detail can no longer assign/reassign to another eligible owner.
- The user receives no indication that this happened because an API dependency failed.
- There is no retry mechanism for that dependency.

This is especially important on Staff Detail because §5.7 explicitly requires the selector to support assigning/reassigning to any eligible owner.

**Requested change:** Preserve the rest of each screen, but represent the degraded owner lookup explicitly.

For example:

- show an inline "Unable to load eligible owners" message;
- provide a Retry action;
- disable the owner selector while unavailable with an explanation;
- retain "Claim / Reassign to me" because that action does not require the owner list.

Add frontend coverage for the owner-lookup failure state on Staff Detail as well as Queue.

---

### 3. [Medium] Comment and Internal Note error messages are not associated with their textarea via `aria-describedby`

**Files:**
- `client/src/CommentThread.tsx`
- `client/src/InternalNoteThread.tsx`
- `docs/lab-03/ui-spec.md` §8

The frozen accessibility contract states:

> Error messages are associated to their field via `aria-describedby`.

Both compose components currently render their textarea as:

```tsx
<textarea
  id="comment-input"
  ...
  aria-invalid={content.length > 0 && !isValid}
/>
```

and later render the API error independently:

```tsx
{error && (
  <p className="field-error" role="alert">
    {error}
  </p>
)}
```

`InternalNoteThread` uses the same pattern.

The error `<p>` has no stable `id`, and the textarea has no `aria-describedby`, so an assistive technology user is not given the required programmatic association between the field and its error.

**Requested change:** Give each error element an ID and reference it from the relevant textarea, for example:

```tsx
<textarea
  id="comment-input"
  aria-describedby={error ? "comment-input-error" : undefined}
/>

{error && (
  <p id="comment-input-error" className="field-error" role="alert">
    {error}
  </p>
)}
```

Do the equivalent for Internal Notes and add a focused accessibility assertion.

---

### 4. [Medium] Client-side Comment/Note `maxLength` is stricter than the frozen "after trim" validation rule

**Files:**
- `client/src/CommentThread.tsx`
- `client/src/InternalNoteThread.tsx`
- `server/src/service.ts`
- `docs/lab-03/api-spec.md` §20, §22

The frozen rule is:

> content must be 1–2,000 characters **after trim**

The backend implements that correctly:

```ts
const trimmed = raw.trim();

if (trimmed.length > MAX_COMMENT_LENGTH) {
  throw new ValidationError(...);
}
```

The backend unit suite even verifies that exactly 2,000 content characters surrounded by whitespace are accepted after trimming.

The frontend, however, sets:

```tsx
maxLength={MAX_COMMENT_LENGTH}
```

directly on both textareas.

That restricts the **raw input** to 2,000 characters before trimming. For example, this is valid according to the frozen backend rule:

```text
" " + 2000 valid characters + " "
```

because its trimmed length is exactly 2,000.

The browser textarea prevents that input because its raw length is 2,002.

The frontend therefore implements a stricter validation contract than the API.

**Requested change:** Do not use a raw 2,000-character HTML `maxLength` as the authoritative rule. Allow the raw input and determine validity from:

```ts
content.trim().length
```

so the client matches the frozen 1–2,000-after-trim semantics.

Add frontend boundary tests for:

- one character after trim;
- exactly 2,000 after trim;
- exactly 2,000 surrounded by whitespace;
- 2,001 after trim;
- whitespace-only input.

---

### 5. [Medium / Test Gap] The original Requester Comment partial-success regression still has no direct frontend test

**Files:**
- `client/src/App.tsx`
- `client/src/App.test.tsx`
- `client/src/lab-03-tests/StaffTicketDetail.test.tsx`

The implementation of the Requester Comment path has been corrected:

```ts
const createdComment = await postTicketComment(...);

setTicketDetail((current) =>
  current
    ? {
        ...current,
        publicComments: [...(current.publicComments ?? []), createdComment],
      }
    : current,
);

try {
  const data = await fetchTicketDetail(...);
  setTicketDetail(data);
} catch (refreshErr) {
  setDetailError(...);
}
```

However, the regression test added for:

```text
POST succeeds → follow-up GET fails
```

exists for the **Staff** Public Comment path in `StaffTicketDetail.test.tsx`.

`App.test.tsx` adds the corresponding partial-success regression for **Appears Resolved**, but not for the Requester Public Comment path that originally exhibited the duplicate-risk condition.

The implementation appears corrected, but the exact regression is not protected from reintroduction.

**Requested change:** Add a Requester Ticket Detail test that:

1. loads an owned Ticket;
2. posts a Public Comment successfully;
3. makes the following `fetchTicketDetail()` reject;
4. verifies the returned Comment remains visible;
5. verifies the compose input is cleared as a successful mutation;
6. verifies `postTicketComment()` was called exactly once;
7. verifies the refresh warning is distinguishable from "Comment failed."

---

## Evidence Note — the reported 129 responsive Playwright tests do not exercise the Staff Queue

The current `docs/lab-03/tests.md` reports:

> responsive Playwright regression passed 129 tests across desktop/tablet/mobile

That execution is useful regression evidence, but the inspected suite is:

`e2e/lab-02/responsive-visual.spec.ts`

and its authenticated fixture is explicitly:

```ts
const AUTH_USER = {
  ...
  role: "REQUESTER",
};
```

The responsive cases in that suite exercise Lab 2 / Requester surfaces such as:

- Login
- My Tickets
- Create Ticket
- Requester Ticket Detail
- attachment controls
- Requester mobile navigation

They do not exercise the new Staff Queue or Staff Ticket Detail.

Accordingly, the 129-test run should not be treated as browser-level proof of the Staff Queue's desktop/tablet/mobile layout.

The Queue implementation itself has improved substantially:

```css
.staff-queue { max-width: 1440px; }
.tickets-table-wrapper { overflow-x: hidden; }

@media (min-width: 768px) and (max-width: 991px) {
  .tickets-table .tablet-secondary { display: none; }
}
```

and `Last Updated` is now available in Staff Detail.

So I am **not** carrying the previous responsive implementation defect forward based on source inspection alone.

However, the existing `UI-QUE-03` jsdom test only verifies `.tablet-secondary` class assignment. It cannot prove that the real rendered Staff Queue has no clipping or overflow.

Because final `VISUAL-02` / Lab 3 E2E is explicitly owned by #42, I would treat this as an **evidence limitation rather than a separate #38 implementation blocker**. The PR description should simply avoid presenting the 129 Requester regression tests as Staff Queue responsive verification.

## Current Verification Evidence

The repository currently records:

- focused client App / Queue / Staff Detail: **69 passed**
- full client suite: **187 passed across 14 files**
- focused Staff Detail API: **41 passed**
- server suite excluding migration harness: **514 passed across 37 files**
- existing Lab 2 responsive regression: **129 passed**
- client build: passed
- server build: passed
- `git diff --check`: passed

The migration harness remains explicitly recorded as environment-limited rather than Passed.

No GitHub commit statuses or PR-triggered workflow runs were returned for current head `aff9a0f6681adee0b43421e2071b466f5e899ac8`, so the recorded local executions were not independently confirmed by CI during this review.

E2E-02 and the final Lab 3 visual/release evidence remain assigned to #42 and are not treated here as missing Issue #38 implementation.

## Conclusion

**Request changes.**

The major backend workflow now aligns closely with the supplied Issue #38 contract, and the previous six review findings have largely been resolved.

The remaining changes are focused on:

- preserving successful Staff mutations when a follow-up refresh fails;
- representing eligible-owner lookup failures instead of silently removing required functionality;
- completing the frozen Comment/Note accessibility contract;
- aligning client validation exactly with the 2,000-after-trim rule;
- adding the missing Requester Public Comment partial-success regression test.

No backend redesign is required.

</details>

<details>
<summary>2026-09-24T07:48:32Z — CHANGES_REQUESTED by @oangsa</summary>

# PR #49 — Updated Review

**PR:** https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/49<br>
**Reviewed head:** `bb66b813e22e0aa6a1e97fe772744c81bd1d6d91`<br>
**Review disposition:** Request changes

The five findings from the previous review have been addressed:

- successful Staff owner / priority / status / note mutations are committed locally before best-effort refresh;
- Queue and Staff Detail explicitly represent eligible-owner lookup failure and provide Retry;
- Public Comment and Internal Note posting errors are associated with their textareas via `aria-describedby`;
- frontend Comment/Note validation now uses the frozen 1–2,000 **after trim** rule instead of raw `maxLength`;
- Requester Public Comment now has direct `POST succeeds → refresh GET fails` regression coverage.

The major API and workflow requirements in Parts A–C otherwise remain aligned with the supplied Issue #38 contract.

## Remaining Findings

### 1. [Medium] Confirmed status transitions still do not guarantee focus lands on a mounted, focusable control

**Files:**
- `client/src/StaffTicketDetail.tsx`
- `client/src/lab-03-tests/StaffTicketDetail.test.tsx`
- `docs/lab-03/ui-spec.md` §8

The frozen accessibility rule currently says:

> After a confirmed status transition and refetch, focus restoration must land on a currently mounted, focusable control.

The confirmation implementation remembers the invoking transition button and focuses it as the modal closes:

```ts
const invokingControl = lastFocusedRef.current;
invokingControl?.focus();
lastFocusedRef.current = null;
queueMicrotask(() => invokingControl?.focus());

const result = await applyStatusTransition(ticketNumber, target);

setDetail((current) =>
  current ? { ...current, currentStatus: result.currentStatus } : current
);
```

The problem is that the successful local status update changes the set of permitted transition buttons. The original invoking button is normally removed from the DOM.

Examples:

- `IN_PROGRESS → RESOLVED`: the **Resolved** button disappears.
- `RESOLVED → CLOSED`: the **Closed** button disappears.
- `NEW → CANCELLED`: all transition controls disappear because Cancelled is terminal.

There is no subsequent focus operation targeting a surviving control after that render. Focusing the old element before the status update therefore does not satisfy the requirement that the **final** focus target remain mounted and focusable.

The current regression test was also weakened to:

```ts
expect(document.activeElement?.isConnected).toBe(true);
```

That is insufficient. `document.body` is connected and would make this assertion pass even though keyboard focus has effectively been lost from the application's interactive controls.

**Requested change:** After a successful confirmed transition, explicitly move focus to a stable surviving control, for example:

- the Back to Queue link;
- a deliberately focusable Status/Actions heading or region; or
- the first valid new transition action, when one exists.

Then make the test assert the exact intended target, or at minimum verify:

```ts
expect(document.activeElement).not.toBe(document.body);
expect(document.activeElement).toBe(/* known surviving focusable element */);
```

Keep the existing Escape/Cancel behavior that restores focus to the original invoking button when no status mutation occurs.

Current source:
- `StaffTicketDetail.tsx`: https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/bb66b813e22e0aa6a1e97fe772744c81bd1d6d91/client/src/StaffTicketDetail.tsx
- focused test: https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/bb66b813e22e0aa6a1e97fe772744c81bd1d6d91/client/src/lab-03-tests/StaffTicketDetail.test.tsx
- frozen accessibility rule: https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/bb66b813e22e0aa6a1e97fe772744c81bd1d6d91/docs/lab-03/ui-spec.md

---

### 2. [Medium] Eligible-owner lookup errors are visible but are not associated with the affected select controls via `aria-describedby`

**Files:**
- `client/src/StaffTicketQueue.tsx`
- `client/src/StaffTicketDetail.tsx`
- `docs/lab-03/ui-spec.md` §8

The previous functional problem is fixed: an owner lookup failure is no longer silent.

Queue now shows:

```tsx
<select
  id="queue-owner"
  disabled={ownerLoadState !== "loaded"}
  ...
/>

{ownerLoadState === "error" && (
  <div className="field-error" role="alert">
    <span>
      Unable to load eligible owners. Owner filtering is unavailable.
    </span>
    <button ...>Retry</button>
  </div>
)}
```

Staff Detail uses the equivalent pattern for `#owner-select`.

However, the frozen accessibility contract states:

> Error messages are associated to their field via `aria-describedby`.

The newly added owner errors have no stable ID, and neither select references the error.

This means the Comment/Note association from the previous finding is now correct, but the new owner-field failure state does not satisfy the same rule.

**Requested change:** Give the explanatory owner-error text a stable ID and conditionally associate it with the select.

For example:

```tsx
<select
  id="queue-owner"
  aria-describedby={
    ownerLoadState === "error"
      ? "queue-owner-error"
      : undefined
  }
/>

<div id="queue-owner-error" ...>
  Unable to load eligible owners. Owner filtering is unavailable.
</div>
```

Do the equivalent for Staff Detail and add focused assertions that:

1. the failed state references the error ID;
2. Retry succeeds;
3. the stale `aria-describedby` reference disappears after recovery.

Current source:
- Queue: https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/bb66b813e22e0aa6a1e97fe772744c81bd1d6d91/client/src/StaffTicketQueue.tsx
- Detail: https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/blob/bb66b813e22e0aa6a1e97fe772744c81bd1d6d91/client/src/StaffTicketDetail.tsx

## What I verified as resolved

The current implementation now covers the important Issue #38 requirements that were previously problematic:

- Queue search, AND-combined status/IT-priority/owner filters, approved sorting, pagination and safe invalid-query behavior.
- Staff/Admin Queue authorization and distinct forbidden state.
- desktop/tablet/mobile Queue representations in component/CSS implementation, with final browser-level Lab 3 responsive evidence correctly deferred to #42.
- Staff Detail owner claim/assign/reassign and eligible-owner enforcement.
- Requested Priority remains separate from IT Priority.
- claim-before-status-change with `409` for unowned Tickets.
- literal independent 8×8 status-matrix verification.
- cross-owner Staff/Admin status changes per the frozen authorization interpretation.
- confirmation for Resolved / Closed / Cancelled.
- Public Comments and Internal Notes with visibility separation and append-only behavior.
- backend-derived authors/timestamps and 1–2,000-after-trim validation.
- React text rendering for safe comment/note display.
- Requester Appears Resolved indication without formal status mutation.
- read-only Staff attachments with preview/download and no Staff upload/remove operation.
- no `Actions Taken by IT Staff` implementation.

## Test / Evidence Note

The current committed remediation evidence records:

- focused client remediation: **86 passed / 5 files**
- full client suite: **204 passed / 16 files**
- full server suite: **533 passed / 38 files**
- migration harness: completed successfully
- client/server builds: passed

However, the PR description still says **85 focused / 203 full-client**, so the PR body is one test behind the current committed evidence.

Also, no GitHub commit status checks or PR-triggered workflow runs were returned for head `bb66b813`, so these results are repository-recorded local evidence rather than independently confirmed CI.

Lab 3 `E2E-02` and final responsive/release evidence remain owned by #42 and are appropriately not claimed by this PR.

## Conclusion

**Request changes.**

The functional Staff Ticket Operations workflow is now substantially complete. I found no remaining backend workflow blocker in the reviewed scope.

The remaining corrections are narrowly focused on the frozen accessibility contract:

1. restore confirmed-transition focus to a control that actually survives the status update;
2. associate the new owner-lookup field errors with their selects via `aria-describedby`.

After those two items and their focused tests are addressed, I would re-review rather than carry forward the earlier findings.

One small documentation cleanup is also worth doing: update the PR body from **85/203** to the current committed **86/204** test counts.


</details>

<details>
<summary>2026-09-24T09:03:15Z — CHANGES_REQUESTED by @oangsa</summary>

# PR #49 — Updated Review

**PR:** https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/49<br>
**Reviewed head:** `674ea4f293de6866f54dec9aad4bc5eecb4e4e48`<br>
**Review disposition:** Request changes

This is a fresh review of the current PR head against the supplied Issue #38 objective and the frozen Lab 3 contract.

The two findings from the previous review are now resolved:

- confirmed status transitions move focus to the mounted **Back to Queue** control after successful status mutation, including refresh-failure cases;
- Queue and Staff Detail owner-lookup errors are now associated with their respective `<select>` controls through conditional `aria-describedby`, and Retry removes the stale association.

The previously resolved Queue, ownership, mutation-success, Comment/Note validation, status-matrix, responsive implementation, error-state, attachment, and modal findings also remain fixed.

I did not find a remaining functional backend or Staff workflow defect in the reviewed implementation.

## Remaining Findings

### 1. [Medium / Test Gap] `GET /api/tickets/:ticketNumber/comments` does not directly verify IT Staff and Administrator visibility

**Files:**
- `server/tests/lab-03/comments-notes.api.test.ts`
- `server/src/authorization.ts`
- `server/src/service.ts`
- `docs/lab-03/api-spec.md` §21

The frozen contract states:

> Public Comments are visible to Requester, IT Staff, and Administrator.

and §21 explicitly allows:

```text
GET /api/tickets/:ticketNumber/comments
Requester (owned) or IT Staff/Administrator
```

The implementation appears correct.

`requireTicketReadAccess` explicitly allows Staff roles through:

```ts
if (STAFF_ROLES.includes(role)) {
  next();
  return;
}
```

and `listComments()` resolves Staff/Admin access independently of Requester ownership.

However, the API test suite currently directly verifies:

- owned Requester `GET /comments` → 200;
- non-owner Requester `GET /comments` → 404;
- IT Staff `POST /comments` → 201;
- Administrator `POST /comments` → 201.

It does **not** directly exercise:

```text
IT Staff GET /comments → 200
Administrator GET /comments → 200
```

Staff Detail has supplementary coverage showing that Public Comments are included for IT Staff, but that is a different endpoint (`GET /api/staff/tickets/:ticketNumber`) and does not establish the authorization behavior of §21 itself.

The Issue #38 test requirements explicitly include **Public Comment visibility**, so the direct read authorization should be covered.

**Requested change:** Add §21 integration cases for both Staff roles, for example:

```ts
itIfDb("IT Staff reads Public Comments on any ticket -> 200", async () => {
  const res = await withSession(
    request(app).get(`/api/tickets/${ownedTicketNumber}/comments`),
    staff,
  );

  expect(res.status).toBe(200);
  expect(Array.isArray(res.body.data)).toBe(true);
});

itIfDb("Administrator reads Public Comments on any ticket -> 200", async () => {
  const res = await withSession(
    request(app).get(`/api/tickets/${ownedTicketNumber}/comments`),
    admin,
  );

  expect(res.status).toBe(200);
  expect(Array.isArray(res.body.data)).toBe(true);
});
```

This is a **test-completeness finding**, not an identified authorization defect in the current implementation.

---

### 2. [Medium / Test Gap] BR-24 safe rendering is implemented but not directly tested

**Files:**
- `client/src/CommentThread.tsx`
- `client/src/InternalNoteThread.tsx`
- `client/src/lab-03-tests/CommentThread.test.tsx`
- `client/src/lab-03-tests/InternalNoteThread.test.tsx`
- `docs/lab-03/specification.md` BR-24

BR-24 requires:

> Comment and Note content is rendered safely (no raw HTML execution).

The current components appear safe because Comment and Note content is rendered as ordinary React text children:

```tsx
<p className="comment-content">{comment.content}</p>
```

There is no `dangerouslySetInnerHTML`.

However, the focused Comment/Note tests currently cover:

- API-error `aria-describedby`;
- one-character / whitespace validation;
- exactly 2,000 trimmed characters;
- 2,000 characters surrounded by whitespace;
- 2,001-character rejection.

There is no direct BR-24 regression proving that HTML-like input is displayed as text rather than interpreted as DOM.

The Issue #38 test requirements explicitly call out **safe rendering**.

**Requested change:** Add a rendering test for both Public Comments and Internal Notes using hostile-looking content, for example:

```tsx
const content = `<img src=x onerror="window.__pwned=true">`;

render(
  <CommentThread
    comments={[
      {
        id: 1,
        content,
        authorId: 5,
        createdAt: "2026-09-10T00:00:00Z",
      },
    ]}
    onPost={vi.fn()}
  />
);

expect(screen.getByText(content)).toBeTruthy();
expect(document.querySelector(".comment-content img")).toBeNull();
```

Do the equivalent for `InternalNoteThread`.

This is also a **test gap rather than a current XSS defect**; the present React rendering strategy is appropriate.

---

### 3. [Medium / Test Gap] Issue #38 backend endpoints do not exercise the required unexpected-failure containment path

**Files:**
- `server/tests/lab-03/staff-queue.api.test.ts`
- `server/tests/lab-03/staff-ticket-detail.api.test.ts`
- `server/tests/lab-03/comments-notes.api.test.ts`
- `server/src/staff-controller.ts`

The Issue #38 test requirements explicitly include:

> safe failures

The API suites thoroughly exercise expected failures such as:

- `400 VALIDATION_ERROR`;
- `403 FORBIDDEN`;
- `404 NOT_FOUND`;
- `409 CONFLICT`;
- ownership masking;
- missing CSRF;
- invalid owner;
- invalid status;
- forbidden status transitions.

However, the three Issue #38 API suites do not currently exercise an unexpected service/database failure resulting in the canonical:

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred."
  }
}
```

There are no Issue #38 cases forcing a backend dependency to fail and then asserting:

1. HTTP `500`;
2. canonical safe error body;
3. no stack/database/internal details leaked;
4. the server remains usable afterward.

`staff-controller.ts` does wrap the handlers through `respondWithError()`, so the implementation follows the expected failure-handling architecture. The missing part is contract verification for the newly added endpoint family.

**Requested change:** Add representative unexpected-failure containment coverage for the Issue #38 endpoints.

This does not necessarily require injecting a failure into every single route independently. A focused set covering the new controller paths would be sufficient, for example:

- Queue read failure;
- Staff Detail or Staff mutation failure;
- Public Comment / Internal Note failure.

Assert canonical `500 INTERNAL_ERROR` output and perform a subsequent healthy request to confirm containment.

---

## What I Verified as Resolved / Implemented

The current head satisfies the previously identified implementation requirements for:

- `GET /api/staff/queue` search across Ticket Number / Summary;
- status, IT Priority, and owner filters combined with AND;
- approved Queue sort fields and order;
- pagination and metadata;
- safe invalid Queue parameters and `pageSize` clamping;
- Staff/Admin Queue authorization;
- Queue loading, empty, no-results, forbidden, and API-failure states;
- explicit Queue filter labels;
- desktop table, tablet condensation, and mobile card implementation;
- eligible-owner lookup degradation and Retry;
- Staff/Admin Public Comment creation;
- Requester-owned Comment access and cross-owner 404 masking;
- append-only Public Comments / Internal Notes;
- backend-derived authors and timestamps;
- empty / whitespace / over-limit validation;
- exact 1–2,000-after-trim semantics;
- Internal Note Requester 403 restrictions;
- Requester Appears Resolved indication without formal status mutation;
- Staff Detail retrieval with Comments, Notes, Attachments, and resolution indication;
- owner claim, assignment, and reassignment;
- active Staff/Admin owner validation;
- Requester / inactive / nonexistent owner rejection;
- last-write-wins ownership semantics without racing-client conflict;
- Requested Priority and IT Priority separation;
- Staff-only IT Priority mutation;
- claim-before-status-change;
- cross-owner Staff/Admin status changes;
- literal independent 8×8 status-matrix API verification;
- forbidden-transition 409 with persisted state unchanged;
- Resolved / Closed / Cancelled confirmation;
- confirmation focus trap, Escape, Cancel, and post-success focus placement;
- Staff attachment view / preview / download behavior;
- absence of Staff attachment mutation controls;
- no Lab 4 `Actions Taken by IT Staff` implementation.

## Test / Evidence Status

The current repository records:

- accessibility-focused client follow-up: **67 passed / 2 files**
- full client suite: **205 passed / 16 files**
- full server suite: **533 passed / 38 files**
- migration harness: passed
- client build: passed
- server build: passed
- `git diff --check`: passed

PR #49 is currently open and GitHub reports it as mergeable.

No commit-status checks or PR-triggered workflow runs were returned for head:

`674ea4f293de6866f54dec9aad4bc5eecb4e4e48`

so the test results above remain repository-recorded local execution evidence rather than independently confirmed GitHub CI.

`E2E-02`, final Lab 3 responsive/browser accessibility verification, and release evidence remain explicitly owned by Issue #42, so I am not treating their absence from PR #49 as an Issue #38 defect.

## Conclusion

**Request changes for test completeness.**

I found **no remaining material implementation defect** in the Issue #38 Staff Ticket Operations workflow at the reviewed head.

The remaining work is limited to three explicit contract-verification gaps:

1. directly test Staff and Administrator reads through Public Comments §21;
2. directly test BR-24 safe rendering for Comments and Internal Notes;
3. exercise canonical unexpected backend failure containment for the new Issue #38 endpoint family.

These should require focused tests rather than another redesign of the implementation.

</details>

<details>
<summary>2026-09-24T11:43:10Z — APPROVED by @oangsa</summary>

## Approved with follow-up notes

The Issue #38 implementation and required verification coverage are substantially complete.

The previously identified contract and test gaps have been addressed, including:

- Staff/Admin Public Comment read coverage
- BR-24 safe-rendering coverage
- unexpected backend failure containment
- status-transition accessibility
- owner lookup accessibility
- full status-matrix verification
- Queue responsive and error-state behavior

### Follow-up notes

The following items are documentation/evidence cleanup and do not block this PR:

- Update the PR description to reflect the latest test totals: **208 client / 539 server**.
- For final Issue #42 release evidence, rerun the authoritative verification against a committed source SHA so the tested tree is reproducible.
- Final Lab 3 E2E, browser-responsive, accessibility, and release evidence remains owned by Issue #42.

</details>

### Reviews my partner submitted on my PRs

#### [PR #67 — feat: add lab 3 issue 2 auth foundation](https://github.com/oangsa/TokTickIT/pull/67)

<details>
<summary>2026-09-13T13:14:57Z — CHANGES_REQUESTED by @kittipichcha</summary>

<p>I reviewed PR #67 against the <strong>review-pr skill you supplied</strong>, the Lab 3 handout, Issue #60, the PR's actual diff/current head, tests, CI evidence, and repository documentation.</p><h2>Verdict</h2><p>⚠️ <strong>Changes Requested</strong></p><p>The PR is substantially stronger than a typical foundation PR: the current head is <code inline="">999c801</code>, GitHub reports it mergeable, the Issue 2 CI workflow passed, and the focused authentication/PostgreSQL verification is documented.</p><p>However, I would <strong>not approve it yet</strong> because there is at least one material issue in the migration/security boundary that should be fixed before merging.</p><hr><h1>Executive Summary</h1><p>PR #67 is intended to implement <strong>Lab 3 Issue #60: data model + authentication/session foundation</strong>, targeting <code inline="">lab3-staging</code>. The PR explicitly leaves browser AuthProvider and later domain features to Issues 3–6.</p><p>The implementation has several strong points:</p><ul><li><p>forward migration from <code inline="">DevelopmentRequester</code> → <code inline="">User</code>;</p></li><li><p>preservation of numeric ownership IDs and Lab 2 data;</p></li><li><p>PostgreSQL-backed sessions;</p></li><li><p>opaque refresh tokens with hash-only persistence;</p></li><li><p>access JWT + server-side session authority;</p></li><li><p>restricted initial-password sessions;</p></li><li><p>password hashing;</p></li><li><p>rate limiting;</p></li><li><p>logout/session revocation;</p></li><li><p>guarded disposable PostgreSQL testing;</p></li><li><p>extensive migration and PostgreSQL tests;</p></li><li><p>successful CI on the current head.</p></li></ul><p>The main problem is <strong>the migration itself temporarily assigns the same fixed password hash to every migrated User</strong>:</p><pre><code class="language-sql">ADD COLUMN password_hash VARCHAR(255) NOT NULL DEFAULT
'$argon2id$v=19$m=32768,p=1,t=2$8st3brONIgPOpNbrZLZmCw$...';</code></pre><p>The subsequent seed process replaces those hashes with generated credentials, but the migration is itself part of the production data transition. The migration should not establish a shared/default credential for every existing account. The Lab 3 contract explicitly requires generated initial passwords and says initial passwords must not be persisted/logged in plaintext. Issue #60 also makes the authentication/data migration itself part of the acceptance boundary.</p><p>This is not merely cosmetic: <strong>the migration creates a common authentication secret for all migrated users before seed remediation occurs.</strong></p><hr><h1>Ground-Truth Requirement Verification</h1><p>The Lab 3 handout establishes that:</p><ul><li><p>existing Lab 2 Requesters must migrate to real Users while preserving Ticket ownership;</p></li><li><p>Users need secure passwords;</p></li><li><p>initial passwords must be handled explicitly;</p></li><li><p>passwords must never be stored in plaintext;</p></li><li><p>authentication must use real Users;</p></li><li><p>backend authorization is mandatory;</p></li><li><p>PostgreSQL data must be evolved without discarding existing Ticket/Attachment data.</p></li></ul><p>Issue #60 then makes the migration/auth foundation concrete, including preservation of IDs/foreign keys, generated initial passwords, Argon2id, sessions, refresh rotation, restricted first-login sessions, and safe authentication behavior.</p><h3>Overall</h3>
Area | Status
-- | --
User model | ✅ PASS
Role model | ✅ PASS
Ticket ownership schema | ✅ PASS
IT Priority/status foundation | ✅ PASS
Public Comment/Internal Note schema | ✅ PASS
Migration preservation | ✅ PASS based on current PG evidence
Password hashing | ✅ PASS
Authentication service | ✅ PASS
Session persistence | ✅ PASS
Refresh rotation | ✅ PASS
Rate limiting | ✅ PASS
Migration credential handling | 🔴 BLOCKING
Issue 2 focused tests | ✅ PASS
Browser AuthProvider | N/A — later Issue
Staff/User Management UI | N/A — later Issues

<p>The PostgreSQL reviewer evidence specifically reports coverage for session rotation, previous-token deadlines, expiry, revocation, logout, logout-all, and concurrent rate-limit updates.</p><hr><h1>Security / Authorization Review</h1><p>This is one of the stronger parts of the PR.</p><p>The architecture correctly separates:</p><pre><code class="language-text">Access JWT
    ↓
session ID
    ↓
PostgreSQL UserSession
    ↓
current User
    ↓
current role / active state</code></pre><p>rather than trusting a JWT role claim indefinitely.</p><p>The <code inline="">AuthService.context()</code> implementation checks:</p><ul><li><p>valid session ID;</p></li><li><p>active session;</p></li><li><p>current User;</p></li><li><p>matching public User ID;</p></li><li><p>active User;</p></li><li><p>non-deleted User.</p></li></ul><p>That is consistent with the Lab 3 requirement that backend state remains authoritative.</p><p>The PR also removes the Lab 2 <code inline="">X-Requester-Id</code> identity mechanism and evolves the Ticket/Attachment ownership relationships to <code inline="">User</code>.</p><p>The populated migration test verifies the actual foreign keys after migration, including:</p><ul><li><p>Ticket → User;</p></li><li><p>Attachment → User;</p></li><li><p>IdempotencyRecord → User.</p></li></ul><p>That is strong evidence.</p><hr><h1>Test and <code inline="">tests.md</code> Review</h1><p>The test strategy is well structured.</p><p>The Lab 3 test specification explicitly distinguishes:</p><ul><li><p>Unit;</p></li><li><p>API;</p></li><li><p>PostgreSQL;</p></li><li><p>UI;</p></li><li><p>responsive;</p></li><li><p>visual;</p></li><li><p>E2E;</p></li><li><p>migration/data evidence.</p></li></ul><p>It also explicitly warns that planned rows are not evidence of execution.</p><p>For this PR, the relevant Issue 2 tests are actually executed rather than merely planned.</p><p>The current GitHub Actions run for head <code inline="">999c801</code> completed successfully.</p><p>The PR reports:</p><ul><li><p>46 focused Issue 2 unit/API tests;</p></li><li><p>7 PostgreSQL tests;</p></li><li><p>720 full server regression tests;</p></li><li><p>296 full client regression tests;</p></li><li><p>server build;</p></li><li><p>client build;</p></li><li><p>migration status/deploy;</p></li><li><p>repeated seed;</p></li><li><p>repeated maintenance.</p></li></ul><p>That is good.</p><h3>Important qualification</h3><p>Some API tests use mocked Prisma. That is acceptable because the repository's own test specification explicitly assigns PostgreSQL tests responsibility for persistence, locking, migration, uniqueness, and database-state behavior.</p><p>So I would <strong>not demand additional redundant API tests merely because the API suite uses mocks</strong>.</p><hr><h1>Regression Review</h1><p>The PR does a particularly good job here.</p><p>The migration regression test constructs an actual Lab 2-style populated database and verifies:</p><ul><li><p>original User/requester IDs;</p></li><li><p>Ticket IDs;</p></li><li><p>Ticket public IDs;</p></li><li><p>Ticket numbers;</p></li><li><p>Attachment IDs/storage keys;</p></li><li><p>pending/active/removed Attachment state;</p></li><li><p>Idempotency records;</p></li><li><p>foreign-key relationships;</p></li><li><p>requested priority;</p></li><li><p>migrated IT priority.</p></li></ul><p>That is exactly the type of evidence your review skill requires.</p><p>The PR also reports the complete Lab 1–3 server regression passing at 720 tests.</p><p>I therefore find <strong>no separate Lab 2 regression blocker</strong> at this stage.</p><hr><h1>Scope / Future-Lab Review</h1><p>I do <strong>not</strong> recommend blocking this PR because the full Lab 3 specification mentions later features.</p><p>The specification is deliberately the Sprint 3 contract, while the PR itself explicitly limits implementation to Issue 2.</p><p>The actual implementation does not appear to implement the Staff Queue, Staff Ticket Detail, or User Management UI in this PR.</p><p>So:</p><p><strong>Issue 2 foundation → appropriate.</strong></p><p>The reusable data-model seams for later Issues 3–6 are also explicitly part of Issue #60's scope.</p><hr><h1>Documentation Review</h1><p>Generally strong.</p><p>The PR updates:</p><ul><li><p><code inline="">AGENTS.md</code>;</p></li><li><p><code inline="">README.md</code>;</p></li><li><p><code inline="">docs/lab-03/specification.md</code>;</p></li><li><p><code inline="">docs/lab-03/tests.md</code>;</p></li><li><p><code inline="">docs/lab-03/reviewer.md</code>;</p></li><li><p><code inline="">docs/lab-03/ai_use.md</code>.</p></li></ul><p>The specification explicitly states that the handout remains normative and that the engineering contract cannot weaken an explicit handout requirement without approval.</p><p>That aligns very well with your review skill.</p><p>The <code inline="">reviewer.md</code> evidence also records the actual disposable PostgreSQL verification rather than claiming generic "tests passed."</p><hr><h1>Evidence / Release Verification</h1><h3>Verified</h3><ul><li><p>PR targets <code inline="">lab3-staging</code> — ✅</p></li><li><p>Current head identified — <code inline="">999c801</code> — ✅</p></li><li><p>CI workflow successful — ✅</p></li><li><p>Issue 2 focused tests — ✅</p></li><li><p>PostgreSQL tests — ✅</p></li><li><p>Full server regression — ✅</p></li><li><p>Client regression — ✅</p></li><li><p>Builds — ✅</p></li><li><p>Migration status/deploy — ✅</p></li><li><p>Seed twice — ✅</p></li><li><p>Maintenance twice — ✅</p></li><li><p><code inline="">git diff --check</code> — ✅</p></li><li><p>Security scan current head — ✅</p></li></ul><p>GitHub's current workflow result independently reports the Lab 3 Issue 2 verification workflow as successful.</p><h3>Not yet relevant to this PR</h3><p>The following belong to later Lab 3 Issues:</p><ul><li><p>Browser AuthProvider;</p></li><li><p>Login UI;</p></li><li><p>Staff Queue;</p></li><li><p>Staff Ticket Detail;</p></li><li><p>User Management UI;</p></li><li><p>Lab 3 E2E role workflows.</p></li></ul><p>Those should not block Issue #60 unless the issue/contract explicitly makes them prerequisites.</p><hr><h1>Verification Performed</h1><p>I independently checked:</p><ol><li><p>PR #67 metadata and current head.</p></li><li><p>PR description and claimed scope.</p></li><li><p>Issue #60 acceptance criteria.</p></li><li><p>Lab 3 handout requirements.</p></li><li><p>PR changed-file inventory.</p></li><li><p>Prisma schema.</p></li><li><p>Forward migration SQL.</p></li><li><p>Seed/provisioning logic.</p></li><li><p>Authentication service.</p></li><li><p>Authentication routes.</p></li><li><p>Session/refresh implementation.</p></li><li><p>Issue 2 API tests.</p></li><li><p>Populated PostgreSQL migration test.</p></li><li><p>Lab 3 test specification.</p></li><li><p><code inline="">reviewer.md</code>.</p></li><li><p>Current GitHub Actions result.</p></li><li><p>PR comments/security scan.</p></li><li><p>Lab 2 regression claims.</p></li></ol><p>I did <strong>not</strong> treat <code inline="">reviewer.md</code>, tests.md, PR claims, or GitHub issue state as proof by themselves.</p><hr><h1>Required Next Steps</h1><h3>1. Fix B-01 before merge</h3><p>Remove the shared usable password hash from:</p><pre><code class="language-text">server/prisma/migrations/20260913000000_lab3_auth_foundation/migration.sql</code></pre><p>Use an approach where migrated accounts cannot share a migration-defined credential.</p><h3>2. Strengthen migration security coverage</h3><p>Add a PostgreSQL test proving the migration does not leave migrated Users with a common usable credential.</p><h3>3. Re-run the Issue 2 gate</h3><p>At minimum:</p><pre><code class="language-bash">cd server

# guarded Lab 3 PostgreSQL target
npx prisma migrate status
npx prisma migrate deploy

npm test -- \
  tests/lab-03/PasswordService.test.ts \
  tests/lab-03/InitialPasswordGenerator.test.ts \
  tests/lab-03/JwtService.test.ts \
  tests/lab-03/SessionService.test.ts \
  tests/lab-03/LoginRateLimitService.test.ts \
  tests/lab-03/AuthService.test.ts \
  tests/lab-03/MaintenanceService.test.ts \
  tests/lab-03/databaseTargetGuard.test.ts \
  tests/lab-03/auth.api.test.ts \
  tests/lab-03/authorization.api.test.ts \
  tests/lab-03/auth-transport.api.test.ts \
  tests/lab-03/error-contract.api.test.ts \
  -t '@issue-2'

npm test
npm run build</code></pre><p>Then rerun the guarded PostgreSQL suites.</p><h3>4. Update <code inline="">reviewer.md</code> only with the new real evidence</h3><p>Do not mark the migration-security case passed until the new test has actually executed.</p><hr><h2>Bottom line</h2><p><strong>PR #67 is close.</strong> I would <strong>not reject the overall architecture</strong>; the authentication/session foundation, migration-preservation strategy, PostgreSQL verification, and regression discipline are quite strong.</p><p>The one material issue I would require before approval is the <strong>shared password hash introduced directly by the migration</strong>. Once that is replaced with a migration-safe initial-password provisioning strategy and the corresponding PostgreSQL regression is demonstrated, I would expect this PR to be in good shape for human approval.</p>

</details>

<details>
<summary>2026-09-13T15:22:05Z — APPROVED by @kittipichcha</summary>

_GitHub recorded an empty review body._

</details>

#### [PR #68 — feat: add CommonForm and authenticated frontend foundation](https://github.com/oangsa/TokTickIT/pull/68)

<details>
<summary>2026-09-14T14:10:31Z — CHANGES_REQUESTED by @kittipichcha</summary>

Test-count inconsistency in the documentation.
PR description: 27 focused / 323 full
reviewer.md: 28 focused / 324 full

I did not find a material implementation defect in the CommonForm/authentication foundation itself, nor a material security/architecture violation.

</details>

<details>
<summary>2026-09-14T14:56:39Z — APPROVED by @kittipichcha</summary>

_GitHub recorded an empty review body._

</details>

#### [PR #69 — feat: migrate requester flows to authenticated users](https://github.com/oangsa/TokTickIT/pull/69)

<details>
<summary>2026-09-16T08:15:22Z — CHANGES_REQUESTED by @kittipichcha</summary>

## Blocking Finding
B-01 — GitGuardian secret-detection finding remains unresolved

GitHub's PR page currently reports:

GitGuardian uncovered 2 secrets following the scan.

Both findings point to:

e2e/lab-03/requester-regression.spec.ts

and commits:

3b7f95b
2f6acd9

GitGuardian categorizes them as Generic Password findings.

The PR author subsequently added a comment in tests.md saying a different historical GitGuardian incident was determined to be a false positive, but that does not resolve the two findings currently displayed on PR #69. The current PR page still reports the two findings.

Why I consider this Blocking

The Lab 3 handout explicitly requires that seeded credentials are for local development only and that real passwords/secrets must not be placed in the repository.

The PR's E2E file does have a good design in one respect:

const TEMPORARY_PASSWORD = `E2e-${randomUUID()}!`;

so the temporary password itself is dynamically generated.

However, the GitGuardian result means there is still an auditable security finding attached to the PR. The PR needs to establish whether these are:

1. genuine credentials,
2. synthetic test fixtures,
3. generated credentials incorrectly detected by GitGuardian, or
historical-only findings that have been properly invalidated/cleared.

Tell me whether which case it is, and resolve the issue if it is the real password

</details>

<details>
<summary>2026-09-25T07:15:07Z — APPROVED by @kittipichcha</summary>

_GitHub recorded an empty review body._

</details>

#### [PR #70 — feat: implement staff ticket queue, ownership, and semantic workflow](https://github.com/oangsa/TokTickIT/pull/70)

<details>
<summary>2026-09-17T07:02:21Z — APPROVED by @kittipichcha</summary>

_GitHub recorded an empty review body._

</details>

#### [PR #71 — feat: add ticket communication and administrator user management](https://github.com/oangsa/TokTickIT/pull/71)

<details>
<summary>2026-09-17T13:54:16Z — COMMENTED by @kittipichcha</summary>

<p>Yes. The important distinction is:</p><p><strong>I am not saying PR #71's implementation is broken.</strong><br>The blocker is that the PR does not yet prove that it satisfied the <strong>specific verification requirement attached to Issue #64</strong>.</p><h3>Think of it this way</h3><p>Issue #64 says, essentially:</p><blockquote><p>Before this issue is considered Done, run the <strong>Issue #64-specific test set</strong> using <code inline="">@issue-6</code> and record the actual passing results in <code inline="">docs/lab-03/tests.md</code>.</p></blockquote><p>That is an acceptance requirement, not merely a suggestion.</p><p>The PR currently has this situation:</p>
Question | PR #71
-- | --
Does the implementation appear to work? | Yes
Do the full server tests pass? | Yes
Do the full client tests pass? | Yes
Does the current-head CI pass? | Yes
Are Public Comments implemented? | Yes
Are Internal Notes implemented? | Yes
Is Admin User Management implemented? | Yes
Is there an obvious authorization bypass? | No
Is the GitGuardian finding a real secret? | No
Was the exact Issue #64 @issue-6 verification gate demonstrated? | No

<p>That's why I called it a blocker.</p><h3>Why don't the passing tests automatically satisfy it?</h3><p>Because the current CI is running <strong>different focused gates</strong>.</p><p>The current workflow successfully runs things like:</p><ul><li><p>Issue 2 focused unit/API tests</p></li><li><p>Issue 2 PostgreSQL tests</p></li><li><p>Issue 4 Playwright gate</p></li><li><p>full server regression</p></li><li><p>full client regression</p></li><li><p>build</p></li></ul><p>Those passing results are valuable evidence.</p><p>But Issue #64 specifically requires the <strong>Issue #64 / <code inline="">@issue-6</code> focused matrix</strong>, covering the communication and Administrator User Management functionality.</p><p>So the logical chain is:</p><pre><code class="language-text">Issue #64 requirement
        ↓
"Run the Issue #64 focused verification (@issue-6)"
        ↓
Was that exact gate run?
        ↓
       NO
        ↓
Requirement not yet proven</code></pre><p>It is <strong>not</strong>:</p><pre><code class="language-text">Tests failed
   ↓
Code is broken
   ↓
BLOCK</code></pre><p>That is why this is an <strong>evidence/acceptance blocker</strong>, rather than an implementation bug.</p><h3>A concrete example</h3><p>Imagine Issue #64 says:</p><blockquote><p>Run these 10 specific tests before Done.</p></blockquote><p>And the PR proves:</p><blockquote><p>We ran 1,300 other tests and they all passed.</p></blockquote><p>That's very strong evidence that the software works.</p><p>But if nobody can show that the <strong>10 required tests</strong> were actually executed, you can't truthfully mark the Issue #64 acceptance criterion as satisfied.</p><p>You don't necessarily need to rerun everything. You need to establish:</p><blockquote><p><strong>These exact Issue #64 tests were executed against the current PR head, and they passed.</strong></p></blockquote><h3>What would remove the blocker?</h3><p>You don't necessarily need to change the implementation.</p><p>Run the exact Issue #64 focused commands specified in the issue/<code inline="">docs/lab-03/tests.md</code>, using the current PR head:</p><pre><code class="language-text">3b4be4c</code></pre><p>Then record the <strong>actual results</strong> in:</p><pre><code class="language-text">docs/lab-03/tests.md</code></pre><p>with the required <code inline="">@issue-6</code> traceability.</p><p>Ideally the CI should also have a clearly identifiable Issue #64 gate, rather than relying on the current Issue 2/4 gates.</p><hr><h3>So, in plain English</h3><p><strong>PR #71 currently looks like the code is working.</strong></p><p>The reason I marked it <strong>Changes Requested</strong> is:</p><blockquote><p><strong>The PR has not yet shown the exact evidence that Issue #64 requires before the issue can be considered complete.</strong></p></blockquote><p>If you run the required <code inline="">@issue-6</code> verification and it passes, <strong>I would not currently expect another material blocker from the implementation based on the review we did.</strong></p><p>So this is a relatively narrow fix: <strong>prove the required Issue #64 verification, not rewrite the feature.</strong></p>

</details>

<details>
<summary>2026-09-18T12:50:33Z — APPROVED by @kittipichcha</summary>

_GitHub recorded an empty review body._

</details>

#### [PR #75 — test: complete Lab 3 final verification](https://github.com/oangsa/TokTickIT/pull/75)

<details>
<summary>2026-09-25T15:32:08Z — CHANGES_REQUESTED by @kittipichcha</summary>

<h2>Verdict</h2><p><strong>⚠️ Changes Requested</strong></p><p>Using your <code inline="">review-pr</code> rules—where requirement/contract contradictions, missing mandatory evidence, security failures, and false completion claims are material blockers —together with the <code inline="">scrutinize</code> end-to-end trace approach, I would <strong>not merge PR #75 yet</strong>.</p><p>I found <strong>3 clear blockers</strong>. The current CI itself is healthy; the blockers are contract/security compliance, incomplete required E2E proof, and inaccurate/incomplete release evidence.</p><h2>Executive Summary</h2><p>PR #75 is trying to finalize Issue #65: rerun global verification, repair inherited browser tests, complete responsive evidence, and prepare Lab 3 for release.</p><p>The overall approach is reasonable. In particular, the User Management mobile fix correctly reuses the existing <code inline="">DataTable.renderMobileCard</code> extension point instead of inventing another responsive table implementation. From the <code inline="">scrutinize</code> perspective, that is already the smaller existing abstraction.</p><p>Current-head GitHub Actions also passed:</p>
Gate | Current result
-- | --
Lab 3 Global Verification / server | ✅ Success
Full Lab 3 Playwright step | ✅ Success
Full server regression | ✅ Success
Server build | ✅ Success
Client full regression | ✅ Success
Client build | ✅ Success

<hr><h1>Blocking Findings</h1><h3>B-01 — Committed JWT signing secret contradicts BR-31</h3><p><strong>Severity:</strong> Blocking — requirement/contract contradiction.</p><p><strong>Evidence:</strong> <code inline="">.github/workflows/lab3-issue2-verification.yml:152</code> currently contains:</p><p><code inline="">JWT_SECRET: [REDACTED: synthetic CI-only JWT signing value]</code></p><p>This value is intentionally synthetic and CI-only, so I do <strong>not</strong> consider it a compromised production credential. But that does not resolve the contract problem: it is still a JWT signing secret committed directly to the repository.</p><p>The handout explicitly requires authentication secrets not to be committed. The frozen repo contract, BR-31, states the same thing without a test-secret exception.</p><p><strong>Required fix:</strong> generate an ephemeral secret during the workflow or supply it through CI environment/secret configuration rather than committing the value. For example, generate a sufficiently random temporary JWT secret in an earlier workflow step and export it to <code inline="">GITHUB_ENV</code>.</p><p>Then rerun the complete Global Verification workflow.</p><hr><h3>B-02 — Required Issue #65 E2E acceptance coverage is incomplete</h3><p><strong>Severity:</strong> Blocking — explicit AC failure / missing required validation.</p><p>Issue #65 does not merely say these behaviors need some lower-level test. It explicitly assigns them to named E2E files.</p><p>The current <code inline="">e2e/lab-03/requester-regression.spec.ts</code> traces:</p><p><code inline="">login → Create Ticket → Attachment → Ticket Detail → Cancel → My Tickets → Bob cross-requester 404</code></p><p>That is real coverage, but it does <strong>not</strong> directly exercise the required:</p><ul><li><p>ambiguous/idempotent Create Ticket recovery;</p></li><li><p>Problem Appears Resolved;</p></li><li><p>Reopen.</p></li></ul><p>There happens to be inherited Lab 2 browser recovery coverage elsewhere after this PR's compatibility repair. That helps regression confidence, but it does not satisfy Issue #65's explicit requirement that <code inline="">e2e/lab-03/requester-regression.spec.ts</code> prove the stated Lab 3 flow.</p><p>The same issue exists elsewhere:</p><p><code inline="">staff-ticket-flow.spec.ts</code> covers search, sort, filter, Claim, Start Work, priority, Resolve, Close, Request Information and Admin unassign. It does not fully demonstrate the Issue #65 race/reassignment/pagination/default-order set.</p><p><code inline="">user-administration.spec.ts</code> covers substantial real behavior—search/filter, create, duplicate email, editing, reset initial password, mandatory password change, own-admin protections, and non-admin denial—but not all of the expressly required E2E evidence such as explicit pagination, copy/no-storage behavior, last-active-Administrator protection, and owner-unassignment behavior.</p><p>Most importantly, <strong>the PR's own <code inline="">docs/lab-03/reviewer.md</code> acknowledges these exact gaps</strong>:</p><blockquote><p>Requester browser coverage omits direct idempotency/recovery and Looks Resolved/Reopen paths; Staff browser coverage omits some race/page/assignment combinations; User Administration browser coverage omits explicit pagination, copy/no-storage, last-active-Administrator, and owner-unassignment paths.</p></blockquote><p>Under your review skill, test names or lower-level passing tests cannot launder missing required E2E proof.</p><p><strong>Required fix:</strong> add the smallest browser assertions necessary to the specifically required Lab 3 E2E specs. Do not duplicate all API tests—only demonstrate the acceptance flows Issue #65 explicitly assigns to E2E.</p><p>Then rerun the full browser suite and update <code inline="">tests.md</code>/<code inline="">reviewer.md</code> with the new actual counts.</p><hr><h3>B-03 — Final release evidence is currently stale and its review claim is not synchronized</h3><p><strong>Severity:</strong> Blocking — documentation/evidence failure.</p><p>Current <code inline="">docs/lab-03/reviewer.md</code> says:</p><blockquote><p>PR #69 ... GitHub still records changes requested, with no recorded approval.</p></blockquote><p>That is no longer true.</p><p>I independently queried PR #69. It currently has:</p><ul><li><p>the earlier <code inline="">CHANGES_REQUESTED</code> review; <strong>and</strong></p></li><li><p>a subsequent <strong><code inline="">APPROVED</code> review from <code inline="">kittipichcha</code>, submitted 2026-09-25 07:15:07 UTC</strong>.</p></li></ul><p>So the current verification document is now stale. It also says:</p><blockquote><p>This Issue 7 branch has no PR or peer review yet.</p></blockquote><p>PR <strong>#75 now exists</strong>, so that sentence also no longer describes current project state.</p><p><code inline="">tests.md</code> similarly carries the earlier blocked review status.</p><p>Additionally, PRs <strong>#72, #73, and #74 were merged into <code inline="">lab3-staging</code> with no recorded GitHub reviews</strong>. Because those PRs changed substantial shared frontend/backend code that is part of the release baseline, the final claim that staging followed the required peer-reviewed integration flow is not yet independently demonstrated. The Lab submission explicitly expects review/approval evidence as part of Git workflow evidence.</p><p><strong>Required fix:</strong> refresh both <code inline="">reviewer.md</code> and <code inline="">tests.md</code> against actual current GitHub state:</p><ul><li><p>record PR #69 as approved after the earlier requested changes;</p></li><li><p>record PR #75 and its eventual review outcome;</p></li><li><p>stop saying Issue #65 work is uncommitted/no PR;</p></li><li><p>resolve/document the review disposition for merged PRs #72–#74 rather than presenting the overall reviewed-integration requirement as completed;</p></li><li><p>update DATA-11 accordingly.</p></li></ul><p>This is documentation cleanup, but it is blocking here because <strong>truthful final verification evidence is itself an Issue #65 acceptance criterion</strong>.</p><hr><h1>Non-Blocking Findings</h1><h3>GitGuardian alert on <code inline="">e2e/helpers/requester-auth.ts</code></h3><p>I do <strong>not</strong> consider the current GitGuardian finding a genuine leaked password.</p><p>GitGuardian points at commit <code inline="">5f33e087...</code> in <code inline="">e2e/helpers/requester-auth.ts</code>. Tracing the flagged area shows:</p><pre><code class="language-ts">const currentPassword = `E2e-${randomUUID()}!`;</code></pre><p>That is generated at runtime, not a fixed credential. The seeded initial password is read from the ignored local credential handoff file:</p><p><code inline="">server/.local/lab3-seed-credentials.json</code></p><p>So this particular alert looks like a <strong>Generic Password false positive</strong>, not an exposed real password.</p><p>It should still be explicitly dispositioned/documented, particularly because Issue #65 requires secret inspection, but I would <strong>not block solely on this GitGuardian incident</strong>.</p><p>The JWT workflow value in B-01 is a different problem: that one is genuinely a literal committed signing configuration and directly contradicts BR-31.</p><hr><h1>Real-World Edge-Case Review</h1><p>The code paths I traced cover meaningful real-world cases well: cross-requester isolation, password-change recovery, multi-session logout-all, safe authentication failure, responsive clipping, User Management duplicate email, Administrator self-protection, Request Information state transitions, and private Internal Notes.</p><p>I did not find a new realistic implementation defect from those paths beyond the missing required browser proof already captured in B-02.</p><hr><h1>Security / Authorization Review</h1><p>Current coverage gives good evidence for several boundaries:</p><p><code inline="">authentication.spec.ts</code> verifies no Web Storage auth state, refresh bootstrap, Remember Me cookie behavior, role guarding, and logout-all revocation.</p><p><code inline="">requester-regression.spec.ts</code> verifies another Requester cannot open Alice's Ticket and that requester identity is not client-supplied.</p><p><code inline="">staff-ticket-flow.spec.ts</code> and communication tests verify role-specific operational behavior and Requester exclusion from Internal Notes.</p><p>The main security-contract defect I found is therefore <strong>configuration provenance</strong>, not an auth bypass: the committed workflow JWT secret violates the frozen secret-management rule.</p><hr><h1>Test and tests.md Review</h1><p>Current-head CI is real execution evidence, not just documentation:</p><ul><li><p>server workflow: success;</p></li><li><p>client workflow: success;</p></li><li><p>all Lab 3 Playwright step: success;</p></li><li><p>complete server regression: success;</p></li><li><p>both builds: success.</p></li></ul><p>Therefore, I would <strong>not</strong> repeat the old claim that “the full browser suite remains unverified.” That limitation was true locally at commit <code inline="">5f33e08</code>, but subsequent current-head CI executed it.</p><p>The remaining problem is <strong>coverage semantics</strong>, not execution: all tests can pass while Issue #65 still asks for browser scenarios that are not represented.</p><hr><h1>Regression Review</h1><p>The PR specifically repaired inherited Lab 2 Playwright tests that still relied on <code inline="">/api/requesters</code> and <code inline="">X-Requester-Id</code>.</p><p>The replacement path is sensible:</p><p><code inline="">seeded Requester → real login → bearer-authenticated setup → /api/users/me/... → current authenticated UI</code></p><p>This preserves the Lab 2 behavioral regression while evolving the identity mechanism as Lab 3 requires. The handout requires Lab 2 Requester functionality to continue under authenticated identity.</p><p>No blocking regression defect found from this repair.</p><hr><h1>Scope / Future-Lab Review</h1><p>I found no material later-lab functionality introduced by PR #75.</p><p>The mobile User Management card is a direct response to required responsive usability, not an unnecessary redesign. Lab 3 requires all major screens to remain usable at desktop, tablet, and mobile sizes, and the final evidence explicitly checks clipping, overlap, and horizontal overflow.</p><hr><h1>Documentation Review</h1><p><code inline="">README.md</code>, <code inline="">tests.md</code>, and <code inline="">reviewer.md</code> generally explain the repaired verification setup well.</p><p>The material documentation defect is <strong>freshness/truthfulness</strong>, not structure: PR #69's approval status and PR #75's existence changed after the recorded snapshot, while the files still present the old state as current.</p><p>Because this PR is itself the final-verification/evidence issue, that cannot simply be left for later.</p><hr><h1>Evidence / Release Verification</h1><p>The screenshot set appears structurally complete for the requested screen families and exact viewport sizes, and CI successfully executes the corresponding responsive suite.</p><p>The remaining release gates are:</p><ol><li><p>remove the committed JWT signing secret;</p></li><li><p>fill the expressly required Lab 3 E2E gaps;</p></li><li><p>refresh peer-review/release documentation against current GitHub state.</p></li></ol><p>I would not require unrelated cosmetic cleanup or additional redundant tests.</p><hr><h1>Verification Performed</h1><p>I inspected the current PR metadata/diff, Issue #65, changed filenames, PR comments, review threads, GitHub workflow result/jobs, the Lab 3 handout, your <code inline="">review-pr</code> skill, the external <code inline="">scrutinize</code> skill, current E2E files, User Management implementation/tests, workflow configuration, <code inline="">tests.md</code>, <code inline="">reviewer.md</code>, and the review state of PRs #69/#72/#73/#74.</p><p>I also traced the GitGuardian occurrence back to commit <code inline="">5f33e087...</code> instead of assuming that a scanner warning automatically means a real credential leak.</p><hr><h1>Required Next Steps</h1><ol><li><p><strong>Fix B-01:</strong> remove the literal workflow <code inline="">JWT_SECRET</code>; generate/inject an ephemeral CI value instead.</p></li><li><p><strong>Fix B-02:</strong> add only the missing Issue #65-mandated E2E scenarios to the appropriate Lab 3 specs, then rerun full Playwright.</p></li><li><p><strong>Fix B-03:</strong> refresh <code inline="">reviewer.md</code> and <code inline="">tests.md</code> with the real current review/PR state, including PR #69's actual approval and PR #75.</p></li><li><p>Resolve/document the peer-review status of #72–#74 before claiming the staged integration/reviewer requirement complete.</p></li><li><p>Rerun <code inline="">Lab 3 Global Verification</code> on the final commit and record that exact final SHA/results.</p></li></ol><p><strong>Scrutinize verdict: <code inline="">fix-then-ship</code>.</strong> The architecture of this PR does not need rework; the largest issue is that it currently declares final verification while explicit Issue #65 E2E obligations are still knowingly incomplete.</p>

</details>

<details>
<summary>2026-09-26T03:04:56Z — APPROVED by @kittipichcha</summary>

I approve with minor condition please update the reviewer.md
[P1] Release evidence still says current changes are uncommitted and final CI is pending — [[docs/lab-03/reviewer.md:120](https://github.com/oangsa/TokTickIT/blob/69671ea9321ae1c57ebbecc49faf635475cd78fb/docs/lab-03/reviewer.md#L120)](https://github.com/oangsa/TokTickIT/blob/69671ea9321ae1c57ebbecc49faf635475cd78fb/docs/lab-03/reviewer.md#L120)

That statement is false on current head `69671ea`: the “address review findings” changes are committed, and current-head `server` and `client` checks succeeded. This PR is final-verification evidence, so refresh the record with the real SHA and CI results before merge.

::code-comment{title="[P1] Refresh final-head evidence" body="This says the review fixes are uncommitted and final-head CI is pending, but they are present in current commit 69671ea and its server/client checks succeeded. Update this release-evidence record to the actual SHA and results before merge." file="docs/lab-03/reviewer.md" start=120 priority=1}

Thermo-nuclear review: no separate structural blocker. Authentication logic is centralized in the new helper, User Management reuses the existing `DataTable` mobile-card seam, and no changed source file crosses the 1k-line threshold.

</details>

#### PRs with no submitted GitHub review

- [PR #72](https://github.com/oangsa/TokTickIT/pull/72), [PR #73](https://github.com/oangsa/TokTickIT/pull/73), and [PR #74](https://github.com/oangsa/TokTickIT/pull/74) were merged without a formal GitHub review submission.
