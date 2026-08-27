# Lab 2 — Peer Review Record

**Author:** 67070503477 — GitHub: @oangsa
**Peer reviewer:** 67070503405 — GitHub: @kittipichcha

## Pull Requests I authored (reviewed by my partner)
| PR | Branch | Reviewer verdict |
|----|--------|------------------|
| [#27](https://github.com/oangsa/TokTickIT/pull/27) | feature/17-lab2-engineering-contract | Approved; PR remains open |
| [#32](https://github.com/oangsa/TokTickIT/pull/32) | feature/19-zen-green-ui-foundation | Approved; merged into `lab2-staging` |
| [#34](https://github.com/oangsa/TokTickIT/pull/34) | feature/21-create-ticket | Approved; merged into `lab2-staging` |
| [#43](https://github.com/oangsa/TokTickIT/pull/43) | feature/23-ticket-detail | Approved; merged into `lab2-staging` |
| [#44](https://github.com/oangsa/TokTickIT/pull/44) | feature/24-attachments | Changes requested; subsequently approved and merged into `lab2-staging` |

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

- **#34 — Approved review, 2026-08-25:** “Everything can work correctly and
  all test are passed as expected, no collision as I saw.”

  The reviewer raised no change requests. The review carried no inline
  file/line comments and PR #34 received no additional pull request comments,
  so this approval is the whole of the reviewer's feedback on that pull request.

- **#43 — Approved review, 2026-08-26:** “Approve”

  The review body is that single word and is reproduced verbatim above. The
  review carried no inline file/line comments, PR #43 received no additional
  pull request comments, and no changes were requested, so this approval is the
  whole of the reviewer's feedback on that pull request.

- **#44 — Changes-requested review, 2026-08-27 06:48:20 UTC** ([formal
  review](https://github.com/oangsa/TokTickIT/pull/44#pullrequestreview-5037983203))
  by @kittipichcha for `feat: add attachment lifecycle`:

  - Verdict: **Changes Requested**.
  - Overall assessment: the implementation appeared aligned with all 15 Issue
    #24 acceptance criteria; all 8 required focused test files were present;
    scope, dependencies, documentation, and the required technology stack were
    considered in scope/aligned.
  - Acceptance-criteria results (all marked pass, with the UI criterion also
    carrying the verification caveat below):

    1. Pending pre-upload and direct Active upload, with exactly one `file`.
    2. Multipart bounds and missing, duplicate, unexpected, and empty-file
       handling.
    3. Filename basename extraction, control-character checks, UTF-8 byte
       limit, and extension handling.
    4. MIME derivation and the exact 5,000,000-byte size limit.
    5. Five-Active limit, Serializable transaction, and bounded retry.
    6. Atomic Pending Attachment binding during Ticket creation.
    7. Pending/Active/Removed metadata and binary lifecycle behavior.
    8. Cross-requester and malformed-ID-safe 404 behavior.
    9. Binary response headers.
    10. Client preview/download requests, requester header, and Blob cleanup.
    11. Collection deletion of 1–100 items, whole-batch validation, and reason
        rules.
    12. Pending-only, best-effort Create Ticket discard cleanup.
    13. Pending hard-delete, Active soft-remove, and Removed 404 behavior.
    14. Maintenance CLI, bounded batches, `SKIP LOCKED`, and no HTTP cleanup
        route.
    15. UI lifecycle, accessibility, and responsive behavior, subject to final
        runtime verification.

  - **Blocking issue — independently verifiable final verification evidence was
    missing.** The review noted that the PR description reported successful
    local checks, but the current head
    `bb348b570c9129cc914ca9204298a7baa370a616` had no application test/build
    status checks on GitHub. The only associated successful workflow was
    **Project Automation**, which did not establish that the application test
    and build suites passed. The reviewer required the focused server gate,
    guarded PostgreSQL suite, focused client gate, full server/client suites,
    and both builds to be rerun against the current PR head and recorded with
    exact commands, date, sanitized environment/database target, counts, and
    result; CI checks were recommended so the evidence would be independently
    visible.

  - The review recorded the following as self-reported, not independently
    GitHub-verified: Issue #24 focused server gate — 4 files/164 tests;
    guarded PostgreSQL gate — 8 files/74 tests; Create Ticket + Attachment
    client gate — 2 files/83 tests; full client suite — 10 files/257 tests;
    full server suite — 31 files/670 tests; server build — passed; client build
    — passed.

  - **Non-blocking suggestions:** split the approximately 836-line
    `AttachmentSection.tsx` into smaller components/hooks; add direct tests for
    `AttachmentPreviewModal` and download behavior; and add automated CI for the
    Issue #24 close gate.

  - Final recommendation: request changes for the verification blocker. The
    reviewer stated that the implementation itself looked ready for approval
    once current-head verification evidence was established.

- **#44 — Approved review, 2026-08-27 07:42:38 UTC** ([formal
  review](https://github.com/oangsa/TokTickIT/pull/44#pullrequestreview-5038379320))
  by @kittipichcha on commit
  `1c46337741f8a6c2de8d65d07e21757d31d7b111`:

  - Verdict: **Approved**.
  - Review body: empty; GitHub records the approval but no written message or
    additional requested changes.

PR #44 conversation audit: the GitHub API returned **0 general pull-request
comments** and **0 inline review comments** (including no inline reply
threads). Therefore, the two formal reviews above are the complete review and
comment record. PR #44 was merged into `lab2-staging` at 2026-08-27 07:43:39
UTC; its final head was `1c46337741f8a6c2de8d65d07e21757d31d7b111` and its merge
commit was `dbbb2a5f49c98c39520fee6f93f0015e5da562d1`.

Sources checked: [PR #44](https://github.com/oangsa/TokTickIT/pull/44), [formal
reviews API](https://api.github.com/repos/oangsa/TokTickIT/pulls/44/reviews),
[conversation comments API](https://api.github.com/repos/oangsa/TokTickIT/issues/44/comments),
and [inline review comments API](https://api.github.com/repos/oangsa/TokTickIT/pulls/44/comments).

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
- **#34** — no response required. The approval requested no changes, so the
  branch was merged into `lab2-staging` as approved with no follow-up edits.
- **#43** — no response required. The approval requested no changes, so the
  branch was merged into `lab2-staging` as approved with no follow-up edits
  (merge commit `fc92d82`, 2026-08-26).
- **#44** — the changes-requested review's verification blocker was followed by
  a body-less approval on the final PR head. No separate author reply or inline
  discussion was recorded by GitHub; PR #44 was merged after the approval.

Author's PR reply:

> “Alright krub. I will change and merge directly since you already approved.”

## Pull Requests I reviewed for my partner

### No partner Lab 2 pull request reviewed yet
My comment:
No review comment recorded yet.

Partner's response:
No response recorded yet.
