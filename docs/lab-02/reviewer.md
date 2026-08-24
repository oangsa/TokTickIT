# Lab 2 — Peer Review Record

**Author:** 67070503477 — GitHub: @oangsa
**Peer reviewer:** 67070503405 — GitHub: @kittipichcha

## Pull Requests I authored (reviewed by my partner)
| PR | Branch | Reviewer verdict |
|----|--------|------------------|
| [#27](https://github.com/oangsa/TokTickIT/pull/27) | feature/17-lab2-engineering-contract | Approved; PR remains open |
| [#32](https://github.com/oangsa/TokTickIT/pull/32) | feature/19-zen-green-ui-foundation | Approved; merged into `lab2-staging` |

Reviewer comments I received (@kittipichcha):

- **#27 — Approved review, 2026-08-21:** “Everything can work correctly and pass
  the criteria but there is a few note and ambiguity.” The review identified the
  following ten points:

  1. **Test execution status ambiguity** — `tests.md` showed `Not Run`, but did
     not clearly say whether the tests were planned or already implemented. The
     reviewer requested a prominent note assigning focused test implementation
     to Issues #18–#24 and clarifying that Issue #25 is final regression coverage,
     not a replacement for those close gates.
  2. **Idempotency five-minute lease boundary** — the reviewer requested one
     authoritative comparison: fresh when `now < STALE_CUTOFF`, stale/reclaim-
     eligible when `now >= STALE_CUTOFF`, with an atomic conditional reclaim.
  3. **Attachment ID sorting** — the reviewer requested the canonical ordering
     algorithm, specifically lowercase UUID string lexicographic order, so
     implementations compute the same idempotency hash.
  4. **Serializable Attachment-upload enforcement** — the reviewer requested
     explicit PostgreSQL `Serializable` transaction behavior, retry details, and
     exhaustion mapping. The review suggested a bounded exponential schedule and
     `503 SERVICE_UNAVAILABLE` as possible implementation choices.
  5. **Description search transparency** — the reviewer requested an explicit
     statement that a Ticket can match on Description alone even though
     `TicketListItemDTO` omits Description, plus user-facing search guidance.
  6. **Lab 1 Category migration preservation** — the reviewer requested explicit
     existing-row lifecycle and audit backfill values, including whether
     `isActive` should be `true`, `deleted` should be `false`, and how audit
     actors and timestamps should be handled.
  7. **UI search debounce coverage** — the reviewer noted that the required
     `400 ms` debounce had no dedicated planned UI test and suggested adding one
     for the timing boundary, query mapping, and page reset.
  8. **QueryBuilder responsibility boundary** — the reviewer requested a clear
     distinction between generic operator construction and the Ticket validator's
     field/condition whitelist, including rejection of `summary + ISNULL` before
     QueryBuilder/Prisma execution.
  9. **Handout versus contract authority** — the reviewer requested clearer
     guidance that handout examples and screenshots may be illustrative while the
     approved engineering-contract documents define the implementation target.
  10. **Test command documentation** — the reviewer requested clearer command
      discovery/documentation guidance for the `server/` and `client/` commands
      and their execution evidence.

- **#32 — Comment, 2026-08-24:** “Approve no need to change.”

  This was left as a plain pull request comment rather than a GitHub review, so
  PR #32 carries no formal review record; the comment is reproduced verbatim
  above and is the whole of the reviewer's feedback on that pull request.

How I responded:

- **#27, test status** — `tests.md` now states that the rows are approved planned
  evidence, `Not Run` means final execution evidence has not yet been recorded,
  each owning Issue must implement and pass its focused tests, and Issue #25 is
  final integration/regression coverage rather than a substitute for focused
  close gates.
- **#27, lease boundary** — the contract uses
  `PROCESSING_LEASE_SECONDS = 300`; fresh means `now < processingStartedAt +
  300 seconds`, stale/reclaim-eligible begins at `now >=` that cutoff, and
  reclaim is atomic and fenced.
- **#27, Attachment ID sorting** — validated UUIDs are canonicalized to
  lowercase, duplicates are rejected, and the remaining values are sorted in
  ascending lexicographic string order before UTF-8/SHA-256 hashing.
- **#27, Serializable upload retry** — the contract requires PostgreSQL
  `Serializable` isolation for the Active-count-plus-insert transaction. Only
  supported serialization/deadlock transient failures may retry, with a small,
  bounded, randomized delay and at most three total attempts. Exact milliseconds
  are intentionally implementation-defined; business failures are not retried,
  contention-only exhaustion returns safe `500 INTERNAL_SERVER_ERROR`, and no
  `503` variant is part of the approved contract.
- **#27, Description search** — `api-spec.md`, `specification.md`, and the UI
  contract state that Description-only matches are valid even though Description
  is omitted from `TicketListItemDTO`; the UI search guidance names ticket
  number, summary, and Description.
- **#27, Category migration** — the final approved contract requires in-place
  migration preserving existing `id`, `name`, and `createdAt` exactly; existing
  rows receive `isActive = true`, `deleted = false`, deterministic `seed` for
  both `createdBy` and `updatedBy`, and `updatedAt = original createdAt`. This
  intentionally supersedes the review's illustrative `migration` actor and
  unchanged-`updatedAt` suggestion.
- **#27, debounce** — the existing UI test ID was tightened rather than adding
  a new ID: `UI-18` verifies controlled/fake-timer behavior at the exact `400 ms`
  boundary, the approved `searchFields`, and reset to page 1.
- **#27, QueryBuilder** — the contract now makes QueryBuilder a generic
  expression-construction utility and assigns Ticket field/condition/type
  validation to the Ticket validator before QueryBuilder or Prisma execution.
- **#27, handout authority** — `api-spec.md` and the specification now state
  that explicit handout MUST requirements remain mandatory, while partial or
  illustrative examples/screenshots are interpreted within the approved
  engineering-contract boundary.
- **#27, command documentation** — `tests.md` identifies the required working
  directory for each command and the evidence that implementation must record.
  No separate application dependency or architecture change was introduced.

Author's PR reply:

> “Alright krub. I will change and merge directly since you already approved.”

## Pull Requests I reviewed for my partner

### No partner Lab 2 pull request reviewed yet
My comment:
No review comment recorded yet.

Partner's response:
No response recorded yet.
