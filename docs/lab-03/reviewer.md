# Lab 3 — Peer Review Record  (fill this in)

**Author:** 67070503477 — GitHub: @oangsa
**Peer reviewer:** 67070503405 — GitHub: @kittipichcha

## Pull Requests I authored (reviewed by my partner)

| PR | Branch | Reviewer verdict |
|----|--------|------------------|
| [#67](https://github.com/oangsa/TokTickIT/pull/67) | feature/60-lab3-data-auth-backend | _Record my partner's verdict_ |
| _Pending_ | feature/61-commonform-auth-frontend | _Record my partner's verdict_ |
| [#70](https://github.com/oangsa/TokTickIT/pull/70) | feature/63-staff-queue-ticket-workflow | Request Changes |
| [#71](https://github.com/oangsa/TokTickIT/pull/71) | feature/64-communication-admin-users | Request Changes (verification only) |

Reviewer comments I received (@kittipichcha):

- [P1] A cancelled Ticket can still be claimed through the API: Claim on CANCELLED (and CLOSED) must be rejected with 409 INVALID_STATUS_TRANSITION before mutating ownership or status.
- [P1] Issue 5 close gate inconsistency: Clarify cross-issue boundary between Issue 5 and Issue 6 for Request Information. Issue 5 verifies safe pre-integration failure and injected transaction seam; production browser integration belongs to Issue 6.
- [PR #71] Case-only email edits fail to revoke sessions: Detect changes to persisted email including capitalization, and use same comparison for Edit User self-logout confirmation.
- [PR #71] Very large collection pages can reach Prisma with oversized offsets: User, root-comment, reply, and Internal Note reads return empty page after counting without issuing out-of-range findMany() call.
- [PR #71] Multiple role filters accepted: User-list validator permits at most one role-filter expression.
- [PR #71] GitGuardian alert on test fixtures: Explicit false-positive disposition for synthetic test fixtures in Git history.
- [PR #71] Close-gate verification on final head: Run exact Issue 6 commands from Section 14.2 against e0bfeab including database-backed browser gate.

How I responded:

- Enforced rejection of Claim and owner mutation on CANCELLED and CLOSED tickets with 409 `INVALID_STATUS_TRANSITION` in `ticketWorkflowService.ts` before ownership updates. Added unit, API, and PostgreSQL regression tests verifying owner and status remain unchanged.
- Clarified cross-issue contract in `specification.md`, `api-spec.md`, and `tests.md`: Issue 5 E2E-04 covers workflow actions with safe pre-integration 500 failure; production Request Information browser comment persistence is assigned to Issue 6 (E2E-06). Updated UI-20 test and description to verify form validation, submission, modal close, and state update to WAITING_FOR_REQUESTER.
- Enforced session revocation on case-only email changes in `userService.ts` and synced Edit User confirmation/self-logout in `EditUser.tsx` with unit and UI regressions.
- Guarded User, root-comment, reply, and Internal Note collection queries to return `200 []` and accurate `X-Pagination` metadata when requested page exceeds total count without issuing findMany().
- Restricted User query validator to at most one role filter, returning `400` otherwise, and documented rule in API spec.
- Replaced synthetic password-like test literals in `UserForm.test.tsx` with explicit placeholders and formally dispositioned historical occurrences as false positives for synthetic test fixtures (no real secrets or credential leaks).
- Executed exact Section 14.2 Issue 6 close-gate commands against final head `e0bfeab`: server focused suite with PostgreSQL (9 files, 110 passed, 9 skipped), client focused suite (5 files, 40 passed, 12 skipped), server build, client build, and database-backed Playwright browser gate (3 files, 12 passed: RESP-04, RESP-05, E2E-05, E2E-06 against disposable Docker PostgreSQL target `toktickit_lab3_test`). Appended full execution evidence to `docs/lab-03/tests.md`.

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
