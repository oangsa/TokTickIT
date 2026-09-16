# Lab 3 — Peer Review Record  (fill this in)

**Author:** 67070503477 — GitHub: @oangsa
**Peer reviewer:** 67070503405 — GitHub: @kittipichcha

## Issue 5 implementation self-check — 2026-09-16

Branch: `feature/63-staff-queue-ticket-workflow`. No peer verdict claimed.
Queue, assignable User lookup, Staff Detail/attachment reads, ownership and
semantic workflow changes have local test/build evidence recorded in
`tests.md` Section 14.2. No Prisma schema/migration change. The lookup does
not grant assignment rights; authoritative owner checks remain transactional.

Issue 6 must inject its Public Comment writer before Request Information can
succeed in production. Current behavior fails safely without changing status.
E2E-04 and all primary Issue 5-owned verification rows are fully executed and
reconciled to Pass under the clarified contract in tests.md Section 14.2.
Independent peer review remains pending upon pull request submission.

## Pull Requests I authored (reviewed by my partner)

| PR | Branch | Reviewer verdict |
|----|--------|------------------|
| [#67](https://github.com/oangsa/TokTickIT/pull/67) | feature/60-lab3-data-auth-backend | _Record my partner's verdict_ |
| _Pending_ | feature/61-commonform-auth-frontend | _Record my partner's verdict_ |
| [#70](https://github.com/oangsa/TokTickIT/pull/70) | feature/63-staff-queue-ticket-workflow | Request Changes |

Reviewer comments I received (@kittipichcha):

- [P1] A cancelled Ticket can still be claimed through the API: Claim on CANCELLED (and CLOSED) must be rejected with 409 INVALID_STATUS_TRANSITION before mutating ownership or status.
- [P1] Issue 5 close gate inconsistency: Clarify cross-issue boundary between Issue 5 and Issue 6 for Request Information. Issue 5 verifies safe pre-integration failure and injected transaction seam; production browser integration belongs to Issue 6.

How I responded:

- Enforced rejection of Claim and owner mutation on CANCELLED and CLOSED tickets with 409 `INVALID_STATUS_TRANSITION` in `ticketWorkflowService.ts` before ownership updates. Added unit, API, and PostgreSQL regression tests verifying owner and status remain unchanged.
- Clarified cross-issue contract in `specification.md`, `api-spec.md`, and `tests.md`: Issue 5 E2E-04 covers workflow actions with safe pre-integration 500 failure; production Request Information browser comment persistence is assigned to Issue 6 (E2E-06). Updated UI-20 test and description to verify form validation, submission, modal close, and state update to WAITING_FOR_REQUESTER.

## Pull Requests I reviewed for my partner

### feature/<partner-branch>

My comment:

_Add my review findings and approval/request-changes decision here._

Partner's response:

_Add my partner's response here._
