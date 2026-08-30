# Lab 2 — Peer Review Record

**Author:** 67070503477 — GitHub: @oangsa
**Peer reviewer:** 67070503405 — GitHub: @kittipichcha

## Pull Requests I authored (reviewed by my partner)
| PR | Branch | Reviewer verdict |
|----|--------|------------------|
| [#27](https://github.com/oangsa/TokTickIT/pull/27) | feature/17-lab2-engineering-contract | Approved; merged into `lab2-staging` |
| [#31](https://github.com/oangsa/TokTickIT/pull/31) | feature/18-lab2-data-model | Approved; merged into `lab2-staging` |
| [#32](https://github.com/oangsa/TokTickIT/pull/32) | feature/19-zen-green-ui-foundation | Approved; merged into `lab2-staging` |
| [#33](https://github.com/oangsa/TokTickIT/pull/33) | feature/20-requester-context | Approved; merged into `lab2-staging` |
| [#34](https://github.com/oangsa/TokTickIT/pull/34) | feature/21-create-ticket | Approved; merged into `lab2-staging` |
| [#42](https://github.com/oangsa/TokTickIT/pull/42) | feature/22-my-tickets | Approved; merged into `lab2-staging` |
| [#43](https://github.com/oangsa/TokTickIT/pull/43) | feature/23-ticket-detail | Approved; merged into `lab2-staging` |
| [#44](https://github.com/oangsa/TokTickIT/pull/44) | feature/24-attachments | Changes requested; subsequently approved and merged into `lab2-staging` |
| [#45](https://github.com/oangsa/TokTickIT/pull/45) | feature/25-lab2-verification | Approved; merged into `lab2-staging` |
| [#46](https://github.com/oangsa/TokTickIT/pull/46) | feature/26-lab2-release-evidence | Changes requested; merged before approval; post-merge validation recorded; later reverted by #48 |
| [#48](https://github.com/oangsa/TokTickIT/pull/48) | feature/46-revert-lab2-release-evidence | Approved; reverted PR #46 into `lab2-staging` |
| [#49](https://github.com/oangsa/TokTickIT/pull/49) | feature/26-lab2-release-evidence-correction | Peer approved; merged into `lab2-staging` as `df8da1e`; post-merge staging validation passed |
| [#50](https://github.com/oangsa/TokTickIT/pull/50) | feature/26-lab2-postmerge-validation | Documentation-only post-#49 validation record; merged into `lab2-staging` as `314e9c3` |
| [#51](https://github.com/oangsa/TokTickIT/pull/51) | lab2-staging → main | Peer approved; merged into `main` as `5867b7a` |

PR [#30](https://github.com/oangsa/TokTickIT/pull/30) was a closed,
unmerged duplicate for Issue #18 and is not an integration PR.

Reviewer comments I received (@kittipichcha):

- **#27 — Approved review, 2026-08-21** ([formal review](https://github.com/oangsa/TokTickIT/pull/27#pullrequestreview-4994870570)): “Everything can work correctly and pass
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

- **#31 — Approved review, 2026-08-22** ([formal review](https://github.com/oangsa/TokTickIT/pull/31#pullrequestreview-5000426874)): @kittipichcha wrote, “All requirement,
  criteria. issue align with the actual system in the app.” No change request,
  inline comment, or unresolved thread was recorded. The author's only response
  was “Alright, krub” ([comment](https://github.com/oangsa/TokTickIT/pull/31#issuecomment-5381071124)).
  The PR was merged into `lab2-staging` at `0c6e0d4`.

- **#32 — Comment, 2026-08-24** ([comment](https://github.com/oangsa/TokTickIT/pull/32#issuecomment-5398051068)): “Approve no need to change.”

  This was left as a plain pull request comment rather than a GitHub review, so
  PR #32 carries no formal review record; the comment is reproduced verbatim
  above and is the whole of the reviewer's feedback on that pull request.

- **#33 — Approved review, 2026-08-24** ([formal review](https://github.com/oangsa/TokTickIT/pull/33#pullrequestreview-5010470833)): @kittipichcha submitted an approval
  with an empty body. No change request, inline comment, or additional
  conversation comment was recorded. The PR was merged into `lab2-staging`.

- **#34 — Approved review, 2026-08-25** ([formal review](https://github.com/oangsa/TokTickIT/pull/34#pullrequestreview-5019998502)): “Everything can work correctly and
  all test are passed as expected, no collision as I saw.”

  The reviewer raised no change requests. The review carried no inline
  file/line comments and PR #34 received no additional pull request comments,
  so this approval is the whole of the reviewer's feedback on that pull request.

- **#42 — Approved review, 2026-08-26** ([formal review](https://github.com/oangsa/TokTickIT/pull/42#pullrequestreview-5030561424)): “This pr can be approved, no conflict
  as I found and everything is aligned”. No change request or inline comment was
  recorded. The PR was merged into `lab2-staging`.

- **#43 — Approved review, 2026-08-26** ([formal review](https://github.com/oangsa/TokTickIT/pull/43#pullrequestreview-5032385454)): “Approve”

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

- **#45 — Review sequence, 2026-08-27:** @kittipichcha first approved the PR,
  then requested changes with three concrete points: deliver independently
  accessible working-app screenshots at `1440x900`, `820x1180`, and `390x844`;
  make the `tests.md` evidence mechanism accurate; and consider adding
  Playwright CI (non-blocking). The branch added the tracked screenshot links
  and synchronized evidence. The final approval said, “Previously there's a
  conflict between requirement and the issue however I see you have fixed it.”
  PR #45 merged into `lab2-staging` at `6ef7ed4`.

PR #45 conversation audit: the reviewer left one top-level comment asking for
working-app screenshots to be stored in the codebase
([comment](https://github.com/oangsa/TokTickIT/pull/45#issuecomment-5438340928));
the changes-requested and final approval records are linked from the same
conversation ([changes requested](https://github.com/oangsa/TokTickIT/pull/45#pullrequestreview-5040244818),
[approval](https://github.com/oangsa/TokTickIT/pull/45#pullrequestreview-5040465249)).
No inline review comments were recorded.

PR #46 review audit: the reviewer submitted **Changes Requested** on the
documentation/release-evidence PR ([formal review](https://github.com/oangsa/TokTickIT/pull/46#pullrequestreview-5041721622)).
The review confirmed the feature gates, recorded regression evidence, GitHub
CI, builds, documentation, scope, dependencies, and manual Project/Kanban
state as passing; it identified only one blocking item: validate the resulting
`lab2-staging` after PR #46 is merged. The review also marked AC-10 partial and
listed two non-blocking suggestions. My acknowledgement is recorded in the
[PR comment](https://github.com/oangsa/TokTickIT/pull/46#issuecomment-5440368528).

The requested post-merge gate then passed on staging commit
`ed1f107c469e5469c78575f9a0a6c7ee2115404b`; the result is recorded in the
[follow-up PR comment](https://github.com/oangsa/TokTickIT/pull/46#issuecomment-5440572403)
and [Issue #26](https://github.com/oangsa/TokTickIT/issues/26). GitHub retains
the original Changes Requested review as historical evidence; no later approval
submission was recorded on the closed PR.

PR #46 was merged before a peer approval was recorded. That merge did not
resolve the review request; the Changes Requested review and the absence of a
later approval remain historical evidence. The resulting release path was
withdrawn through approved PR #48, rather than being treated as an approved
feature merge.

PR #46 was subsequently reverted through [PR #48](https://github.com/oangsa/TokTickIT/pull/48)
after the release path was withdrawn. @kittipichcha approved the revert
([review](https://github.com/oangsa/TokTickIT/pull/48#pullrequestreview-5042050179));
it merged into `lab2-staging` as `b476a2754fb0510f77512a1a87711daa554255dc`.
The revert changed only PR #46's release documentation, README, `.gitignore`,
and tracked screenshot evidence; no application or Prisma source changed. PR
[#47](https://github.com/oangsa/TokTickIT/pull/47) was closed without merging,
and Issue #26 was reopened for corrected evidence. Corrected evidence was
proposed in [PR #49](https://github.com/oangsa/TokTickIT/pull/49); @kittipichcha
approved it ([formal review](https://github.com/oangsa/TokTickIT/pull/49#pullrequestreview-5042680192))
after the recorded Changes Requested review
([formal review](https://github.com/oangsa/TokTickIT/pull/49#pullrequestreview-5042398457)).
PR #49 merged into `lab2-staging` as
`df8da1e16e8cc31591c14a17c873e6f1195cffbb`. The approval requested fresh
post-merge runtime evidence; that gate passed on the exact resulting staging
tree and is recorded in `tests.md` Section 15.3.

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
- **#31** — no change request was made; the approved data-model PR merged into
  `lab2-staging` after the focused migration/seed/constraint gate.
- **#34** — no response required. The approval requested no changes, so the
  branch was merged into `lab2-staging` as approved with no follow-up edits.
- **#33** — no response required. The empty-body approval requested no changes;
  the requester-context branch was merged as reviewed.
- **#42** — no response required. The reviewer approved the aligned My Tickets
  implementation; its focused validator/query/UI gate was recorded separately.
- **#43** — no response required. The approval requested no changes, so the
  branch was merged into `lab2-staging` as approved with no follow-up edits
  (merge commit `fc92d82`, 2026-08-26).
- **#44** — the changes-requested review's verification blocker was followed by
  a body-less approval on the final PR head. No separate author reply or inline
  discussion was recorded by GitHub; PR #44 was merged after the approval.
- **#45** — the response was the documentation/evidence update on the branch:
  tracked screenshots were made independently accessible and the test-result
  mechanism was synchronized. GitHub recorded no separate author reply; the
  final peer approval preceded the merge.
- **#46** — acknowledged the review, recorded the manually verified
  Project/Kanban state, completed the post-merge `lab2-staging` validation, and
  recorded the result in the PR and Issue #26. It was merged before peer
  approval, then reverted by approved PR #48; the earlier release PR #47 was
  closed.
- **#48** — used a dedicated `feature/46-revert-lab2-release-evidence` branch
  and a peer-reviewed revert commit to restore the pre-#46 staging tree without
  changing application implementation.
- **#49** — reapplied the release records from a dedicated Issue #26 correction
  branch, received a Changes Requested review followed by peer approval, and
  merged into `lab2-staging` as `df8da1e`. The requested fresh staging gate
  passed on that resulting commit; no application implementation changed.
- **#50** — recorded the fresh post-#49 staging gate on a dedicated feature
  branch; @kittipichcha was requested as reviewer, but GitHub exposes no formal
  review submission for this docs-only PR. It merged into `lab2-staging` as
  `314e9c3`.
- **#51** — @kittipichcha approved the single replacement `lab2-staging` →
  `main` release PR on 2026-08-27. The approval had an empty review body and
  no recorded inline or conversation comments. It merged into `main` as
  `5867b7a82dc210234925d7108cd99334a72788cd`.

Author's PR replies:

- **#27:** “Alright krub. I will change and merge directly since you already
  approved.” ([comment](https://github.com/oangsa/TokTickIT/pull/27#issuecomment-5372380201))
- **#31:** “Alright, krub” ([comment](https://github.com/oangsa/TokTickIT/pull/31#issuecomment-5381071124)).

## Pull Requests I reviewed for my partner

Only merged PRs #16–#29 are included. Earlier PRs belong to Lab 1, and
unmerged PRs in this range are excluded.

| PR | Branch | Final review result |
|----|--------|---------------------|
| [#16](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/16) | `doc/lab-02/requirement_and_agent` | Approved; merged into `lab2-staging` |
| [#21](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/21) | `feature/lab2-requester-selection` | Approved; merged into `lab2-staging` |
| [#23](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/23) | `feature/issue-22-remove-health-check` | Approved; merged into `lab2-staging` |
| [#24](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/24) | `docs/governance-amendment-pr23-followups` | No formal review recorded; merged into `lab2-staging` |
| [#25](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/25) | `feature/lab2-ticket-creation` | Approved; merged into `lab2-staging` |
| [#28](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/28) | `feature/lab2-my-tickets` | Approved; merged into `lab2-staging` |
| [#29](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/29) | `feature/lab2-attachments` | Approved; merged into `lab2-staging` |

### PR #16 — docs(lab-02): add requirements, specifications, and agent workflow

#### My review comment 1 — Changes requested

> Review: Request Changes
>
> I reviewed PR #16 against Issue #11, downstream Issues #12–#15, the current repository baseline, and the Lab 2 handout.
>
> The overall documentation/governance structure is heading in the right direction, and the PR stays within the requested documentation-only scope. However, there are still several contract inconsistencies that should be resolved before merging into "lab2-staging", because the downstream implementation issues will otherwise inherit conflicting requirements.
>
> - "tests.md" does not yet provide complete AC-to-test traceability
>
> The handout requires every Acceptance Criterion to map to at least one planned test, and every planned automated test to identify its actual test-file path.
>
> The current "tests.md" mostly lists planned files and groups FR/BR/AC coverage by implementation issue. It does not provide a complete test-by-test traceability matrix.
>
> Some requirements are also missing from the current mapping, including examples such as:
>
> - AC-16
>
> - AC-23
>
> - AC-25
>
> - FR-09
>
> - FR-15
>
> - FR-17
>
> I recommend replacing or extending the current coverage section with a matrix such as:
>
> Test ID | Level | Scenario | Test File Path | FR | BR | AC
>
> For example:
>
> E2E-01 | E2E | Requester creates and later finds ticket | e2e/lab-02/requester-ticket-flow.spec.ts | FR-02, FR-04 | BR-01 | AC-01
>
> This should be completed before implementation begins so downstream issues have a real Test-DD contract.
>
> - AC-16 / inactive requester behavior is currently impossible under the defined requester-context rules
>
> The specification says:
>
> - only active Development Requesters appear in the selector;
>
> - if the requester stored in "sessionStorage" becomes inactive, that requester context is cleared;
>
> - requester-scoped API calls validate that the requester is active.
>
> However, AC-16 says that a ticket owned by a now-inactive Requester should still be viewed by an "active Requester context that owns it."
>
> That state cannot occur because ticket ownership remains fixed to the original requester. If that requester becomes inactive, there is no different active requester who can also own the same ticket.
>
> Issue #14 also carries this behavior forward by requiring an Inactive badge in My Tickets.
>
> Please resolve this into one consistent rule.
>
> Suggested option:
>
> - keep the historical requester foreign key unchanged;
>
> - inactive requesters can no longer establish requester context;
>
> - therefore their old tickets are preserved in the database but are not reachable through the Lab 2 requester-facing flow;
>
> - remove AC-16 and the corresponding My Tickets inactive-owner requirement.
>
> If historical access is intentionally required, then the requester-context/access rules need to be redesigned explicitly.
>
> - "ai_use.md" conflicts with the Lab 2 handout filename
>
> The PR and Issue #11 use:
>
> docs/lab-02/ai_use.md
>
> to match the Lab 1 convention.
>
> However, the Lab 2 handout explicitly shows:
>
> docs/lab-02/ai-use.md
>
> in both:
>
> - the required repository structure; and
>
> - the final PDF evidence section.
>
> The specification itself also refers to "ai-use.md" in the Definition of Done, while the actual file in the PR is "ai_use.md".
>
> This needs one canonical decision before merge.
>
> Unless there is an instructor clarification saying that the Lab 1 underscore convention overrides the Lab 2 handout, I recommend using:
>
> docs/lab-02/ai-use.md
>
> and updating all references consistently in:
>
> - README
>
> - specification
>
> - agent rules
>
> - Issue #11
>
> - any later issues/docs
>
> Do not keep both filenames.
>
> - BR-03a conflicts with the API contract
>
> BR-03a currently says the requester ID is sent:
>
> on every API call via X-Dev-Requester-Id
>
> but the API contract does not follow that rule.
>
> For example:
>
> GET /api/categories
>
> is documented as not requiring the header.
>
> More importantly:
>
> GET /api/dev-requesters
>
> must work before a requester has even been selected, so it cannot require the requester header.
>
> Suggested wording:
>
> The selected requesterId is sent on every requester-scoped API request via X-Dev-Requester-Id.
>
> Bootstrap endpoints such as GET /api/dev-requesters and explicitly public/reference-data endpoints are exempt.
>
> Then make "specification.md", "api-spec.md", Issue #12, and future implementation follow the same rule.
>
> - Freeze the exact Attachment size boundary in bytes
>
> The handout fixes the maximum attachment size at:
>
> 5 MB per file
>
> The current documents use "≤5 MB", but that still allows two different implementations:
>
> 5,000,000 bytes
>
> or:
>
> 5 * 1024 * 1024 = 5,242,880 bytes
>
> This should be frozen now so implementation and tests do not disagree.
>
> Recommended:
>
> MAX_ATTACHMENT_BYTES = 5,000,000
>
> with boundary tests:
>
> 4,999,999 bytes -> accepted
>
> 5,000,000 bytes -> accepted
>
> 5,000,001 bytes -> rejected
>
> - Secondary sorting should be defined explicitly in "api-spec.md"
>
> AC-19 and Issue #14 require stable secondary sorting by:
>
> createdAt DESC
>
> but the API contract currently defines only the requested sort field and direction.
>
> Please document the deterministic ordering explicitly.
>
> For example:
>
> Primary: requested sort field + requested direction
>
> Secondary: createdAt DESC
>
> Tertiary: id DESC
>
> Also define Requested Priority ordering explicitly if it is sortable.
>
> For example:
>
> LOW < MEDIUM < HIGH
>
> rather than relying on alphabetical/database enum ordering.
>
> - "agent.md" should define the worktree policy more explicitly
>
> "agent.md" already covers the important governance requirements well:
>
> - approval gate
>
> - FR/BR/AC mapping
>
> - test-first workflow
>
> - test logging
>
> - AI-use logging
>
> - commit-by-function
>
> - feature branches
>
> - PR approval
>
> - Kanban approval
>
> The branch policy is clear, but the worktree portion is still mostly implicit.
>
> Since Issue #11 explicitly asks for a branch/worktree policy, I suggest adding a few rules such as:
>
> - One active feature branch per worktree.
>
> - Do not reuse a dirty worktree for another issue.
>
> - New worktrees must branch from the current lab2-staging baseline.
>
> - Out-of-scope fixes must use a separate branch/worktree after approval.
>
> - Remove completed worktrees only after their branch is safely merged/preserved.
>
> Existing unresolved Copilot review comments
>
> There are also four existing Copilot comments that are still unresolved and should be addressed:
>
> -
>
> The API status-code table does not list "410 Gone", even though Attachment preview/download use "410".
>
> -
>
> "reviewer.md" still contains "(fill this in)" and angle-bracket placeholder formatting even though the reviewer information has already been filled in.
>
> -
>
> Typo in "agent.md":
>
> doc/requirment_and_agent
>
> should be:
>
> doc/requirement_and_agent
>
> - "GET /api/categories" currently returns a raw array in the existing Lab 1 implementation, but the Lab 2 API contract changes it to:
>
> {
>
> "data": []
>
> }
>
> Either preserve the existing shape or explicitly document that Lab 2 intentionally introduces this response-shape migration and update the implementation/tests accordingly.
>
> What looks good
>
> The following parts are already in good shape:
>
> - README clearly separates the current Lab 1 implementation from the Lab 2 target.
>
> - Setup/run/test commands match the current server/client scripts.
>
> - The PR remains documentation/governance-only with no functional application changes.
>
> - "agent.md" contains the requested approval and traceability controls.
>
> - "ai_use.md" follows the general Lab 1 table/reflection format.
>
> - Issues #12, #13, #14, and #15 all exist and contain explicit FR/BR/AC mappings.
>
> - The PR correctly targets "lab2-staging".
>
> - The Development Requester mechanism is consistently described as a testing mechanism rather than real authentication.
>
> - Server-side ownership enforcement is represented throughout the proposed design.
>
> Verdict
>
> Request Changes
>
> Before merging this requirement baseline, I recommend resolving at minimum:
>
> - Complete AC-to-test-path traceability in "tests.md".
>
> - Resolve the impossible AC-16 inactive-requester state.
>
> - Resolve "ai_use.md" vs "ai-use.md".
>
> - Make requester-header scope consistent.
>
> - Freeze the exact Attachment byte limit.
>
> - Define deterministic secondary sorting.
>
> - Resolve the existing Copilot review threads.
>
> These are worth fixing at the specification stage because Issues #12–#15 will treat these documents as implementation contracts. It will be significantly harder to correct them after code and tests have already been built around conflicting rules.

#### My review comment 2 — Changes requested

> Review: Request Changes
>
> I re-reviewed PR #16 against:
>
> - Issue #11
>
> - downstream Issues #12–#15
>
> - the current repository baseline
>
> - the Lab 2 handout
>
> The PR has improved significantly since the previous review. Several earlier blockers are now resolved, including:
>
> - docs/lab-02/ai-use.md now matches the Lab 2 handout naming
>
> - requester header scope is clarified
>
> - Attachment size is frozen to 5,000,000 bytes
>
> - AC-16 was retired from the main specification
>
> - deterministic sorting is defined
>
> - worktree rules were added
>
> - tests.md now contains a real traceability matrix
>
> - the previous 410 Gone, reviewer placeholder, branch typo, and category response-shape issues were corrected
>
> However, there are still a few contract and traceability inconsistencies that should be fixed before merging into lab2-staging.
>
> 1. Issue #14 still contains the retired AC-16 behavior
>
> The current specification explicitly retires AC-16.
>
> It now states that if a requester becomes inactive:
>
> - the historical requester foreign key remains in the database;
>
> - the inactive requester cannot establish requester context;
>
> - those historical tickets are therefore not reachable through the Lab 2 requester-facing flow.
>
> However, Issue #14 still contains:
>
> Inactive requester badge display on tickets (BR-inactive, AC-16)
>
> and maps:
>
> AC-16
>
> It also still has this acceptance criterion:
>
> Tickets owned by inactive requesters render with "Inactive" badge (AC-16)
>
> This directly conflicts with the current specification and UI spec.
>
> Please update Issue #14 by removing:
>
> AC-16
> Inactive requester badge display
>
> and align its BR/AC mapping with the current specification.
>
> This is important because otherwise the implementation agent following Issue #14 would reintroduce behavior the contract has already removed.
>
> 2. Issue #11 still requires ai_use.md instead of ai-use.md
>
> The PR now correctly uses:
>
> docs/lab-02/ai-use.md
>
> which matches the Lab 2 handout.
>
> README, agent.md, and the actual file have also been updated consistently.
>
> However, Issue #11 still lists:
>
> docs/lab-02/ai_use.md
>
> in both the scope and acceptance criteria.
>
> Please update Issue #11 to:
>
> docs/lab-02/ai-use.md
>
> The content can still follow the Lab 1 format, but the filename should follow the Lab 2 handout.
>
> 3. tests.md still lacks explicit UI-style automated coverage
>
> The Lab 2 handout requires planned testing at these levels:
>
> Unit
> API / Integration
> UI Component
> UI Style
> Responsive
> E2E
>
> The new traceability matrix now covers Unit, API, UI, E2E, and responsive behavior much better, but there is still no explicit planned UI Style automated test.
>
> The handout specifically expects automated checks for things such as:
>
> required CSS classes
> field states
> labels
> required asterisks
> validation messages
> button states
> badge styling
>
> and also Playwright screenshots at desktop, tablet, and mobile sizes.
>
> Please add explicit planned UI-style/visual test rows with actual paths.
>
> For example:
>
> UI-STYLE-01 | UI Style | Editable/read-only/invalid/busy field and button styles | client/src/lab-02-tests/UiStyles.test.tsx
>
> and/or:
>
> VISUAL-01 | Visual | Zen Green screenshots across required screens/viewports | e2e/lab-02/responsive-visual.spec.ts
>
> The exact filenames are a student decision, but UI-style coverage should be represented explicitly in the Test-DD plan.
>
> 4. AC-23 says "any Lab 2 screen", but the responsive planned test covers only Create Ticket
>
> AC-23 currently requires responsive behavior when:
>
> any Lab 2 screen is viewed
>
> The current matrix maps AC-23 only to:
>
> e2e/lab-02/responsive-create-ticket.spec.ts
>
> That proves Create Ticket only.
>
> It does not prove:
>
> - Development Requester Selection
>
> - My Tickets
>
> - Ticket Detail
>
> Please either add responsive tests for each required screen or consolidate them into one suite that explicitly tests every Lab 2 screen at the required viewports.
>
> For example:
>
> e2e/lab-02/responsive-visual.spec.ts
>
> could cover:
>
> Requester Selection
> Create Ticket
> My Tickets
> Ticket Detail
>
> desktop
> tablet
> mobile
>
> 5. BR-17 partial-success behavior needs an explicit UI state and planned test
>
> The specification defines BR-17 as:
>
> Ticket creation succeeds
> → a subsequent Attachment upload fails
> → Ticket is not rolled back
> → Attachment failure is reported separately
> → user can retry the Attachment from Ticket Detail
>
> This is a good decision and satisfies an important handout requirement.
>
> However, the current test matrix does not contain a test that actually proves this workflow.
>
> The existing generic failure test covers:
>
> Ticket create API fails
> → preserve form values
> → manual retry
>
> which is BR-16, not BR-17.
>
> Please add a separate planned scenario such as:
>
> Ticket POST succeeds
> Attachment upload fails
> Ticket still exists
> No duplicate Ticket is created
> User is shown partial-success/error state
> User can retry Attachment from Ticket Detail
>
> The UI spec should also distinguish these two cases clearly.
>
> Case A — Ticket creation fails
>
> No Ticket exists
> Keep form data
> Show inline error
> Allow Submit again
>
> Case B — Ticket creation succeeds but Attachment upload fails
>
> Ticket already exists
> Do not resubmit Ticket
> Show generated Ticket Number
> Report Attachment failure separately
> Provide View Ticket / retry Attachment path
>
> Without this distinction, an implementation could accidentally re-enable the full Submit flow after the Ticket already exists and create a duplicate Ticket.
>
> 6. Some Test-DD matrix mappings are still semantically incorrect
>
> The new matrix is a major improvement, but a few rows should be corrected.
>
> For example:
>
> API-TKT-02
> Inactive/stale Category or Related System rejected
> → AC-01
>
> AC-01 is the valid Ticket-creation success criterion, so it does not describe this failure scenario.
>
> Another example:
>
> API-MY-01
> My Tickets returns only current requester-owned tickets
> → AC-14
>
> AC-14 is specifically requester switching.
>
> Ownership isolation is closer to:
>
> AC-03 / FR-04 / BR-24
>
> Also:
>
> API-ATT-03
> Level: API
> Path: attachment-validation.unit.test.ts
>
> The test level and filename indicate different test types.
>
> Please do one more traceability pass so each row's:
>
> Level
> Scenario
> Path
> FR
> BR
> AC
>
> all describe the same behavior.
>
> The matrix should not map an AC merely because it is related to the same feature area.
>
> 7. AC-09 requires client-side rejection, but the current planned test only proves server/unit validation
>
> AC-09 says that when an oversized file is selected, it should be rejected with a size message.
>
> That is observable frontend behavior.
>
> Currently it maps to:
>
> server/tests/lab-02/attachment-validation.unit.test.ts
>
> The backend boundary test is useful and should remain, especially for:
>
> 4,999,999 -> accepted
> 5,000,000 -> accepted
> 5,000,001 -> rejected
>
> But AC-09 should also map to a frontend test, for example:
>
> client/src/lab-02-tests/AttachmentSection.test.tsx
>
> to prove that selecting the oversized file immediately shows the UI error and prevents upload.
>
> 8. Business Rule IDs should preferably use the required BR-xx numbering format
>
> The handout says Business Rules should be numbered:
>
> BR-01
> BR-02
> BR-03
> ...
>
> The specification still contains identifiers such as:
>
> BR-03a
> BR-Attach-metadata
> BR-Attach-storage
> BR-Attach-preview
> BR-inactive
>
> These are understandable internally, but they do not follow the handout's requested numbered format.
>
> Before implementation begins, I recommend normalizing them into regular IDs such as:
>
> BR-21
> BR-22
> BR-23
> ...
>
> and then updating:
>
> specification.md
> tests.md
> Issues #12–#15
> api-spec.md / ui-spec.md references
>
> accordingly.
>
> This will make the final rubric evidence and traceability much cleaner.
>
> 9. Issue #15 should use the exact 5,000,000 byte limit
>
> The specification, API contract, and tests now correctly freeze the Attachment maximum to:
>
> 5,000,000 bytes
>
> with explicit boundaries:
>
> 4,999,999 accepted
> 5,000,000 accepted
> 5,000,001 rejected
>
> However, Issue #15 still says:
>
> <= 5 MB
> File > 5 MB is rejected
>
> This leaves room for an implementation using:
>
> 5 * 1024 * 1024
>
> instead.
>
> Please update Issue #15 to use the exact contract:
>
> MAX_ATTACHMENT_BYTES = 5,000,000
>
> and preferably include the same boundary values.
>
> 10. agent.md says "append" while the Results Log is required to be newest-first
>
> agent.md currently says to:
>
> append newest result entry
>
> while also requiring the Results Log to be:
>
> newest first
>
> Appending normally places the newest record at the bottom.
>
> Suggested wording:
>
> Insert the newest result entry at the top of the Results Log.
>
> or:
>
> Prepend each completed task result under the Results Log heading.
>
> This avoids future logging order drift.
>
> Resolved from the previous review
>
> The following previous findings now appear resolved:
>
> - ai-use.md naming now matches the Lab 2 handout
>
> - requester header wording now correctly applies to requester-scoped requests
>
> - bootstrap/reference endpoints are explicitly exempt
>
> - Attachment maximum is frozen to 5,000,000 bytes
>
> - byte-boundary tests are defined
>
> - AC-16 is retired from the main specification
>
> - UI no longer requires the inactive-requester badge
>
> - deterministic sorting includes secondary and tertiary tie-breakers
>
> - Requested Priority ordering is defined
>
> - agent.md now includes concrete worktree rules
>
> - GET /api/categories keeps the existing Lab 1 raw-array compatibility
>
> - 410 Gone is included in the API status-code table
>
> - reviewer placeholder text has been removed
>
> - the branch-name typo was corrected
>
> - tests.md now has a real Test-DD traceability matrix
>
> The remaining old Copilot 410 thread is marked outdated; the actual contract has already been corrected, so that thread only needs to be resolved as review housekeeping.
>
> What looks good
>
> The following areas are now in good shape:
>
> - README clearly distinguishes the current Lab 1 implementation from the Lab 2 target.
>
> - The PR remains documentation/governance-only.
>
> - agent.md covers approval gates, FR/BR/AC traceability, test logging, AI-use logging, commit-by-function, worktree policy, PR approval, and Kanban approval.
>
> - Development Requester context is consistently described as a temporary testing mechanism rather than authentication.
>
> - Server-side ownership enforcement is explicitly required.
>
> - Attachment fixed rules now match the handout.
>
> - Test-DD traceability is much stronger than the previous revision.
>
> - ai-use.md has 6–10 selected prompts and a reflection.
>
> - Issues #12–#15 exist and have explicit requirement mappings.
>
> Verdict
>
> Request Changes
>
> The major specification conflicts from the previous review are mostly resolved.
>
> Before approval, I would require at minimum:
>
> - Sync Issues #11, #14, and #15 with the updated baseline.
>
> - Add explicit UI-style and full-screen responsive planned coverage.
>
> - Define and test the BR-17 partial-success Attachment failure flow.
>
> - Correct the remaining Test-DD mapping inconsistencies.
>
> After those are addressed, this PR should be very close to approval.

#### My review comment 3 — Changes requested

> Review: Request Changes
>
> I re-reviewed PR #16 against:
>
> - Issue #11
>
> - downstream Issues #12–#15
>
> - the current PR head
>
> - the Lab 2 handout in the Library
>
> This revision is significantly better than the previous one. The major contract conflicts around ai-use.md, AC-16, Attachment byte limits, responsive coverage, UI-style testing, and the BR-17 partial-success flow have been addressed.
>
> There are still a few consistency and course-delivery gaps that should be fixed before merging into lab2-staging.
>
> 1. agent.md contains contradictory commit policies
>
> The beginning of agent.md says that once a task has been approved and its relevant tests pass, the agent may automatically:
>
> stage
> commit
> push
>
> within the approved scope.
>
> However, Section 6 still says:
>
> Agent may commit only after explicit user approval.
>
> The Standard Task Flow then goes back to automatic commit/push after validation.
>
> These rules describe two different approval models.
>
> Please choose one policy and use it consistently throughout the file.
>
> For example, if task approval is intended to authorize commits within that approved scope:
>
> Approval of the task/plan authorizes the agent to stage, commit, and push
> validated changes that remain within the approved scope.
>
> A separate approval is still required for PR creation and Kanban movement.
>
> Alternatively, if every commit requires a separate approval, remove the autonomous commit/push wording.
>
> The current version is ambiguous for a document whose purpose is to establish strict process controls.
>
> 2. tests.md is still missing the handout-required RequesterTicketDetail.test.tsx
>
> The Lab 2 handout explicitly lists these minimum frontend test files:
>
> CreateTicket.test.tsx
> MyTickets.test.tsx
> RequesterTicketDetail.test.tsx
> AttachmentSection.test.tsx
>
> The current Test-DD matrix includes Ticket Detail API and E2E coverage, but there is still no planned UI component path:
>
> client/src/lab-02-tests/RequesterTicketDetail.test.tsx
>
> Please add explicit Ticket Detail UI component coverage.
>
> At minimum, the planned tests should cover:
>
> read-only Ticket fields
> loading state
> API failure / not-found state
> active Attachment presentation
> removed Attachment presentation
> Preview / Download / Remove controls
> Add Attachment control
>
> This is a required minimum delivery file, so API/E2E coverage should not replace it.
>
> 3. Test-DD should explicitly prove the remaining Business Rules, not only Acceptance Criteria
>
> The handout requires the test plan to contain enough scenarios to prove:
>
> all Business Rules
> and
> all Acceptance Criteria
>
> The current matrix now maps the ACs much more effectively, but several Business Rules still do not have an explicit scenario proving them.
>
> Examples include:
>
> BR-06
> Ticket ownership is fixed at creation and cannot be changed.
>
> BR-10
> Requested Priority is required and defaults to MEDIUM in the UI.
>
> BR-11
> IT Priority and Ticket Owner remain null in Lab 2.
>
> BR-26
> Required Attachment metadata is persisted.
>
> BR-27
> Uploaded files use a generated safe stored filename.
>
> BR-29
> Historical tickets remain preserved when their Requester becomes inactive,
> but are no longer reachable from requester-facing flows.
>
> The plan should also make loading/failure-state evidence more explicit for screens such as My Tickets and Ticket Detail.
>
> This does not require creating a new AC for every BR.
>
> It only requires adding planned test rows that directly prove those rules.
>
> For example:
>
> API-TKT-04 | API | Ticket ownership is assigned from X-Dev-Requester-Id and cannot be changed | ...
> UI-TKT-07  | UI  | Requested Priority defaults to MEDIUM | ...
> API-ATT-07 | API | Stored Attachment metadata and safe generated filename are persisted | ...
> API-REQ-02 | API | Inactive Requester history remains persisted but requester context is rejected | ...
> UI-DETAIL-01 | UI | Ticket Detail loading/failure/read-only states | RequesterTicketDetail.test.tsx | ...
>
> The exact Test IDs are flexible, but the business-rule evidence should be explicit.
>
> 4. Issue #13 and Issue #15 are not fully synchronized with the new AC-26 / AC-27 contract
>
> The specification now defines:
>
> AC-26
> Ticket creation succeeds but Attachment upload fails:
> Ticket persists, no duplicate Ticket is created,
> the Attachment failure is reported separately,
> and retry happens from Ticket Detail.
>
> AC-27
> Inactive/stale Category or Related System:
> server returns 409 and no Ticket is created.
>
> However, Issue #13 currently maps only:
>
> AC-01
> AC-04
> AC-05
> AC-06
> AC-10
> AC-11
>
> even though Issue #13 already contains the acceptance requirement:
>
> Referencing inactive category or related system returns HTTP 409 conflict
>
> That behavior is now explicitly AC-27.
>
> Please add:
>
> AC-27
>
> to Issue #13.
>
> Issue #15 correctly includes AC-26, but its BR mapping does not currently include:
>
> BR-17
>
> even though its acceptance criteria directly reference:
>
> AC-26, BR-17
>
> Please add BR-17 to Issue #15's Business Rule mapping.
>
> Also consider removing BR-17 from Issue #13 if Issue #15 is intended to own the partial-success Attachment behavior. The responsibility should be clear instead of being implicitly shared.
>
> 5. Issues #11–#15 do not yet explicitly cover every work category required by the handout
>
> The handout says the issue decomposition must collectively cover:
>
> specification and test planning
> data design
> APIs
> frontend screens
> automated tests
> E2E testing
> visual inspection
> release integration
>
> The current feature issues cover the user-facing feature areas well, but ownership is still unclear for several required delivery areas:
>
> Prisma / database migrations
> required seed data
> cross-feature E2E verification
> visual verification
> final integration / release verification
>
> This does not necessarily require adding more Issues.
>
> The existing Issues can own those responsibilities explicitly.
>
> For example:
>
> #12
> - DevRequester model
> - active/inactive Requester seed data
> - requester context tests
>
> #13
> - Ticket / Category / RelatedSystem schema increment
> - required Category / RelatedSystem seed data
> - ticket creation API/UI/tests
>
> #15
> - Attachment model/storage fields
> - Attachment API/UI/tests
>
> One issue / close gate
> - cross-feature E2E
> - responsive + visual evidence
> - final integration/release verification
>
> The exact decomposition is a student decision, but the handout-required work should have an identifiable owner before implementation begins.
>
> 6. Make the Ticket Date mapping explicit
>
> The handout requires Create Ticket to capture or display:
>
> Ticket Number
> Ticket Date
> Requester
> Category
> Related System
> Ticket Summary
> Requested Priority
> Description
> Attachments
>
> The current design appears to treat:
>
> Ticket Date = createdAt
>
> which is a reasonable decision.
>
> However, this mapping should be stated explicitly so the frontend and backend cannot interpret Ticket Date differently.
>
> Suggested contract wording:
>
> Ticket Date is the backend-authoritative Ticket.createdAt timestamp.
>
> It is read-only.
>
> The client does not submit or generate Ticket Date.
>
> Before creation, the UI may show a placeholder/current-date presentation,
> but after successful creation the displayed value must come from the persisted
> createdAt returned by the backend.
>
> That avoids accidentally having a frontend-generated date that differs from the stored Ticket timestamp.
>
> Resolved from the previous review
>
> The following previous findings now appear resolved:
>
> -
>
> docs/lab-02/ai-use.md matches the Lab 2 handout filename.
>
> -
>
> Issue #11 is synchronized to ai-use.md.
>
> -
>
> BR IDs were normalized to numbered BR-xx identifiers.
>
> -
>
> AC-16 was retired consistently.
>
> -
>
> Issue #14 no longer requires the inactive-requester badge.
>
> -
>
> Attachment maximum is frozen to exactly 5,000,000 bytes.
>
> -
>
> Issue #15 includes the exact byte boundaries.
>
> -
>
> AC-09 now has both backend boundary testing and client-side rejection coverage.
>
> -
>
> UI Style test rows were added.
>
> -
>
> Visual and responsive coverage now includes all Lab 2 screens.
>
> -
>
> BR-17 distinguishes:
>
> - Case A: Ticket creation failure
>
> - Case B: Ticket created but Attachment upload failure
>
> -
>
> BR-17 now has UI, API, and E2E planned evidence.
>
> -
>
> Sorting includes deterministic secondary and tertiary tie-breakers.
>
> -
>
> agent.md Results Log wording now correctly says to prepend newest entries.
>
> -
>
> Worktree rules are explicitly documented.
>
> -
>
> GET /api/categories remains compatible with the existing Lab 1 raw-array response.
>
> -
>
> 410 Gone is included in the API contract.
>
> -
>
> reviewer.md no longer contains placeholder formatting.
>
> What looks good
>
> The overall baseline is now strong:
>
> - README clearly identifies the Lab 2 target versus the currently implemented Lab 1 baseline.
>
> - The PR remains documentation/governance-only.
>
> - specification.md, api-spec.md, ui-spec.md, and tests.md are substantially aligned.
>
> - Development Requester identity remains explicitly a testing mechanism, not authentication.
>
> - Ownership is enforced server-side.
>
> - Attachment constraints match the handout.
>
> - The Test-DD matrix now includes Unit, API, UI Component, UI Style, Responsive, Visual, and E2E coverage.
>
> - ai-use.md contains 8 selected prompts, which is within the required 6–10 range.
>
> - Issues #12–#15 all exist with explicit FR/BR/AC mappings.
>
> - The PR targets lab2-staging and contains no functional application implementation.
>
> Verdict
>
> Request Changes — close to approval
>
> Before approving, I would require these four areas to be resolved:
>
> - Remove the contradictory commit policy in agent.md.
>
> - Add the required RequesterTicketDetail.test.tsx and remaining BR/loading/failure Test-DD evidence.
>
> - Synchronize Issue #13 / #15 with AC-26, AC-27, and BR-17.
>
> - Explicitly assign ownership for database/seed/E2E/visual/release work across the downstream issues.
>
> After those are corrected, the Lab 2 requirement/governance baseline should be in a strong position to merge into lab2-staging.

#### My review comment 4 — Changes requested

> PR #16 Re-Review — Final Contract / Course-Delivery Pass
>
> Review: Request Changes
>
> I re-reviewed PR #16 at head:
>
> 9acc477d1ffbdc7a94a03a7edd486503e4fc6305
>
> against:
>
> - Issue #11
>
> - downstream Issues #12–#15
>
> - the current repository baseline
>
> - docs/lab-02/specification.md
>
> - docs/lab-02/api-spec.md
>
> - docs/lab-02/ui-spec.md
>
> - docs/lab-02/tests.md
>
> - agent.md
>
> - the Lab 2 handout in the Library
>
> This revision is now very close to approval. Most findings from the earlier review rounds have been addressed correctly.
>
> There are still a few issues that should be resolved before merging the requirement baseline into lab2-staging.
>
> 1. [P1] tests.md still does not use the handout-required Planned-Test Table shape
>
> The Lab 2 handout Section 9.1 explicitly defines the required planned-test table with fields equivalent to:
>
> Test ID
> Type
> Requirement / AC
> What It Tests
> Expected Result
> Automated Test File
> Final
>
> The current tests.md matrix is:
>
> Test ID
> Level
> Scenario
> Test File Path
> FR
> BR
> AC
>
> The FR/BR/AC separation is useful and can remain, but the table currently has no explicit:
>
> Expected Result
> Final
>
> columns.
>
> This matters because the final course submission explicitly requires the rendered Test-DD table to include:
>
> planned-test table
> acceptance-criterion traceability
> actual test-file paths
> final pass status
>
> Suggested fix
>
> Keep the current detailed traceability columns, but extend the table to something like:
>
> | Test ID | Level | Scenario | Expected Result | Test File Path | FR | BR | AC | Final |
>
> During planning:
>
> Final = Planned / Not Run
>
> and after implementation:
>
> Final = Pass / Fail
>
> This preserves the stronger FR/BR/AC traceability already added while satisfying the handout's required evidence format.
>
> 2. [P1] Issue #11 now contains a future implementation/release close gate that conflicts with its own docs-only scope
>
> Issue #11 says its deliverable is:
>
> Documentation and governance baseline only, no functional code changes.
>
> However, its acceptance criteria now also require:
>
> Final close gate verifies cross-feature E2E behavior,
> responsive and visual evidence for every Lab 2 screen,
> clean integration into lab2-staging,
> and release verification before the final PR to main.
>
> Those conditions cannot be satisfied by this documentation-baseline PR because the Lab 2 implementation does not exist yet.
>
> This creates an issue-lifecycle contradiction:
>
> PR #16 completes Issue #11 baseline
>         ↓
> but Issue #11 cannot satisfy its own acceptance criteria
> until Issues #12–#15 and final integration are complete
>
> The handout does require the overall issue decomposition to cover:
>
> E2E testing
> visual inspection
> release integration
>
> but that future work should have a clear downstream owner rather than making the requirement-baseline issue impossible to close.
>
> Suggested fix
>
> Either:
>
> - create a dedicated final integration/release Issue that owns:
>
> cross-feature E2E
> responsive/visual verification
> full regression
> lab2-staging integration
> release PR readiness
>
> or:
>
> - explicitly redefine Issue #11 as a Lab-2-wide umbrella Issue that intentionally remains open until final release.
>
> If Issue #11 is intended to close with PR #16, option 1 is much cleaner.
>
> 3. [P1] The proposed final Category schema silently drops the existing Lab 1 createdAt field
>
> The current repository baseline is:
>
> model Category {
>   id        Int      @id @default(autoincrement())
>   name      String   @unique
>   createdAt DateTime @default(now())
> }
>
> But Section 7 of the proposed Lab 2 specification changes it to:
>
> model Category {
>   id       Int     @id @default(autoincrement())
>   name     String  @unique
>   isActive Boolean @default(true)
>   tickets  Ticket[]
> }
>
> so the existing:
>
> createdAt
>
> field disappears from the documented final design.
>
> The handout describes this work as a database increment and requires the specification to document:
>
> fields and data types
> primary keys
> foreign keys
> nullability
> unique constraints
> indexes
> timestamps
> soft-removal fields
> migration decisions
>
> Issue #13 also describes the work as a schema increment and migration.
>
> Right now the specification gives an implementation agent no instruction about whether Category.createdAt should be:
>
> preserved
> migrated
> or intentionally dropped
>
> Recommended fix
>
> The safest baseline-compatible design is simply to preserve it:
>
> model Category {
>   id        Int      @id @default(autoincrement())
>   name      String   @unique
>   isActive  Boolean  @default(true)
>   createdAt DateTime @default(now())
>   tickets   Ticket[]
> }
>
> If there is a deliberate reason to remove it, that must instead be documented as an explicit migration decision and justified.
>
> For a Lab 2 increment from the existing Lab 1 database, silently dropping an existing timestamp is not a safe contract.
>
> 4. [P1] Test-DD still has a few Business Rules that are referenced but not directly proven by a planned scenario
>
> The test matrix is much stronger now and covers most of the previously missing BRs.
>
> However, the handout requires enough planned scenarios to prove all Business Rules and Acceptance Criteria, not only to place the BR identifier somewhere in the matrix.
>
> A few remaining examples need more explicit coverage.
>
> BR-05 — stale/inactive stored Requester context
>
> The Issue requires:
>
> clear sessionStorage
> redirect to Requester Selection
> show explanatory message
>
> but the current planned tests mainly cover:
>
> missing requester route guard
> API rejection of inactive requester
>
> Please add an explicit UI scenario for the stored requester becoming inactive/invalid.
>
> BR-13 — extension and content-sniffing validation
>
> BR-13 requires both:
>
> extension validation
> AND
> server-side content sniffing
>
> API-ATT-01 currently says only:
>
> Disallowed attachment type rejected server-side
>
> That does not clearly prove the important mismatch cases.
>
> Add explicit cases such as:
>
> allowed extension + invalid content -> rejected
> disallowed extension + otherwise valid content -> rejected
> allowed extension + matching permitted content -> accepted
>
> BR-19 — removal confirmation and reason validation
>
> BR-19 defines:
>
> confirmation required
> removalReason optional
> removalReason <= 200 characters
>
> The current matrix covers soft removal itself but does not explicitly prove:
>
> confirmation UI
> 200-character boundary accepted
> 201-character reason rejected
> cancel confirmation does not remove
>
> These should be represented in AttachmentSection.test.tsx and/or the Attachment API tests.
>
> BR-21 — requester context persistence / header injection
>
> BR-21 defines:
>
> sessionStorage persistence
> X-Dev-Requester-Id on requester-scoped calls
> bootstrap/reference endpoint exemptions
>
> The implementation Issues contain these responsibilities, but Test-DD should have a direct planned scenario proving them rather than relying indirectly on ownership tests.
>
> BR-22 — My Tickets defaults and safe fallback behavior
>
> BR-22 defines:
>
> page=1
> pageSize=10
> max pageSize=50
> sort=createdAt
> order=desc
>
> and the API contract additionally defines safe fallback for invalid list parameters.
>
> The current list tests cover search/filter/sort/pagination generally, but there should be an explicit API scenario for:
>
> omitted parameters -> defaults
> invalid page/pageSize/sort/order -> documented fallback
> pageSize over max -> documented behavior
>
> The exact Test IDs are flexible. The important part is that the planned scenarios prove the rule itself.
>
> 5. [P2] BR-16 is still mapped to generic My Tickets / Ticket Detail failure tests even though BR-16 is specifically a Ticket-creation rule
>
> BR-16 is defined as:
>
> On a ticket-creation API failure,
> preserve entered form values,
> show an inline error,
> do not auto-retry.
>
> But current Test-DD rows such as:
>
> UI-MY-04
> My Tickets loading and API failure states
>
> UI-DETAIL-01
> Ticket Detail loading/failure/not-found states
>
> also map to BR-16.
>
> Those screens do not have the Create Ticket form-retention behavior described by BR-16.
>
> They are covered more accurately by:
>
> FR-17
>
> or by a separate general UI/API failure-handling Business Rule if the same manual-retry convention is intended globally.
>
> Suggested fix
>
> Either remove BR-16 from the non-Create-Ticket rows, or define a separate general error/retry BR and map those tests to it.
>
> This is a traceability cleanup rather than a product-design blocker, but it is worth fixing now because tests.md is intended to become the implementation contract.
>
> Resolved from the previous review rounds
>
> The following earlier findings now appear resolved:
>
> - agent.md commit/push approval policy is internally consistent.
>
> - Results Log entries are explicitly prepended newest-first.
>
> - docs/lab-02/ai-use.md matches the Lab 2 handout filename.
>
> - Issue #11 uses ai-use.md.
>
> - Business Rule IDs are normalized to numbered BR-xx identifiers.
>
> - AC-16 was retired consistently.
>
> - Issue #14 no longer requires the impossible inactive-requester badge behavior.
>
> - Attachment maximum is frozen to exactly 5,000,000 bytes.
>
> - Exact Attachment byte boundaries are planned.
>
> - AC-09 includes client-side and backend coverage.
>
> - UI Style planned tests were added.
>
> - Responsive/visual coverage now targets all required Lab 2 screens.
>
> - RequesterTicketDetail.test.tsx is now explicitly planned.
>
> - BR-06 ownership-at-create coverage was added.
>
> - BR-10 Requested Priority default coverage was added.
>
> - BR-11 null IT Priority / Ticket Owner coverage was added.
>
> - BR-26/BR-27 Attachment metadata/safe filename coverage was added.
>
> - BR-29 inactive-requester historical persistence coverage was added.
>
> - My Tickets loading/failure coverage was added.
>
> - BR-17 Case A vs Case B partial-success behavior is clearly separated.
>
> - AC-26 has UI/API/E2E planned evidence.
>
> - AC-27 is synchronized into Issue #13.
>
> - BR-17 is synchronized into Issue #15.
>
> - Ticket Date is now explicitly defined as backend-authoritative createdAt.
>
> - Issue #12 owns DevRequester schema + requester seeds.
>
> - Issue #13 owns Ticket/Category/RelatedSystem schema + reference seeds.
>
> - Issue #15 owns Attachment schema/storage responsibilities.
>
> - Issue #14/#15 contain cross-feature E2E and visual responsibilities.
>
> - README still clearly separates the current Lab 1 implementation from the Lab 2 target.
>
> - README's current server commands match the existing server/package.json scripts.
>
> - The PR remains documentation/governance-only; no functional application files are changed.
>
> Course-handout alignment summary
>
> At this revision, the baseline is aligned well with the handout on:
>
> Development Requester as testing identity, not authentication
> numbered BRs
> required Create Ticket fields
> Attachment allowed types / size / count / soft removal
> database entities and seed requirements
> ownership behavior
> search/filter/sort/pagination decisions
> UI states and responsive behavior
> accessibility
> Test-DD traceability
> required minimum test filenames
> AI-use filename and 6-10 prompt format
> feature-branch -> lab2-staging -> main workflow
> Product and Process Definition of Done
>
> The main remaining course-format issue is the missing:
>
> Expected Result
> Final
>
> fields in the required Test-DD table.
>
> Verdict
>
> Request Changes — very close to approval
>
> I would require these three items before approval:
>
> - Add Expected Result and Final to the Test-DD planned-test table.
>
> - Resolve the Issue #11 lifecycle contradiction by moving future integration/release verification to a clear downstream owner, or explicitly keeping #11 open as an umbrella Issue.
>
> - Preserve/document the existing Category.createdAt migration decision and add the remaining direct BR test scenarios.
>
> After those are corrected, the requirement/governance baseline should be in a strong position to merge into lab2-staging.
>
> Review status notes
>
> - PR is open and mergeable.
>
> - Current reviewed head: 9acc477d1ffbdc7a94a03a7edd486503e4fc6305.
>
> - The PR currently changes only .gitignore, README, agent.md, and Lab 2 documentation files.
>
> - No GitHub commit status checks are currently attached to this head; for this documentation-only PR I do not treat that alone as a merge blocker.

#### My review comment 5 — Changes requested

> PR #16 Re-Review — Lab 2 Contract / Handout Alignment
>
> Review: Request Changes
>
> I re-reviewed PR #16 at head:
>
> 72e851a6b94b8f81cb10ffad75531cbeb1c35632
>
> against:
>
> - Issue #11
>
> - downstream Issues #12–#15
>
> - the current repository baseline
>
> - README.md
>
> - agent.md
>
> - docs/lab-02/specification.md
>
> - docs/lab-02/api-spec.md
>
> - docs/lab-02/ui-spec.md
>
> - docs/lab-02/tests.md
>
> - docs/lab-02/ai-use.md
>
> - docs/lab-02/reviewer.md
>
> - the official Lab 2 handout
>
> This revision has resolved most of the previous findings. The Test-DD table now has the required Expected Result and Final fields, Category.createdAt is preserved, direct BR test scenarios have been expanded, and the downstream issues are substantially better aligned.
>
> There are still several contract/course-delivery issues that should be fixed before this requirement baseline is merged into lab2-staging.
>
> 2. [P1] Issue #11 still has an acceptance criterion that cannot be completed by this docs-only baseline PR
>
> Issue #11 defines its deliverable as:
>
> Documentation and governance baseline only, no functional code changes.
>
> but its Acceptance Criteria also include:
>
> Final close gate verifies cross-feature E2E behavior,
> responsive and visual evidence for every Lab 2 screen,
> clean integration into lab2-staging,
> and release verification before the final PR to main.
>
> Those conditions depend on future implementation from Issues #12–#15 and final integration work.
>
> Therefore the current lifecycle becomes:
>
> PR #16 finishes the requirement baseline
>         ↓
> Issue #11 still cannot satisfy its own Acceptance Criteria
>         ↓
> Issue #11 must remain open until almost the end of Lab 2
>
> That is inconsistent with the stated role of Issue #11 as the baseline/specification issue.
>
> Recommended fix
>
> Prefer one of these approaches.
>
> Option A — recommended
>
> Keep Issue #11 as the requirement/governance baseline and move the future close gate to a dedicated final integration/release Issue responsible for:
>
> cross-feature E2E
> responsive/visual evidence
> full regression
> lab2-staging integration
> release PR readiness
>
> Option B
>
> Explicitly redefine Issue #11 as a Lab-2-wide umbrella tracking Issue that intentionally remains open until final release.
>
> If PR #16 is expected to complete/close Issue #11, Option A is much cleaner.
>
> 3. [P1] Section 7 still does not explicitly document the required migration decisions
>
> The handout requires specification.md to document:
>
> models
> fields and types
> primary keys
> foreign keys
> nullability
> unique constraints
> indexes
> timestamps
> soft-removal representation
> migration decisions
>
> The current specification now correctly preserves the existing Lab 1 field:
>
> model Category {
>   id        Int      @id @default(autoincrement())
>   name      String   @unique
>   isActive  Boolean  @default(true)
>   createdAt DateTime @default(now())
>   tickets   Ticket[]
> }
>
> which fixes the previous createdAt regression.
>
> However, the specification still mostly shows the final schema shape. It does not explicitly freeze how the existing Lab 1 database is migrated.
>
> This is especially important because the current repository already has:
>
> Category
> - id
> - name
> - createdAt
>
> and existing seeded Category rows.
>
> Please document an explicit migration decision such as
>
> Lab 2 uses a forward migration from the existing Lab 1 schema.
>
> - Existing Category rows are preserved.
> - Existing Category id, name, and createdAt values are not rewritten.
> - Category.isActive is added as NOT NULL with existing rows backfilled to true.
> - DevRequester, RelatedSystem, Ticket, and Attachment are created as new tables.
> - The migration must not reset/drop the Lab 1 database merely to reach the Lab 2 schema.
> - Seed logic remains idempotent and must not duplicate or replace the four existing required Categories.
>
> The tests.md Results Log currently says the Category migration-safe contract was documented, but the specification should contain the actual migration decision rather than only the resulting Prisma model.
>
> 4. [P1] Issues require migration/seed test evidence, but tests.md does not assign those tests an actual file path
>
> Issue #13 currently says:
>
> Unit and API tests pass for validators, ticket generator,
> ownership/defaults, schema migration, seed data,
> and endpoint error/success cases
>
> Issue #12 also owns:
>
> DevRequester schema and migration support
> idempotent requester seed data
>
> However, the current Test-DD matrix does not contain a dedicated planned row/path proving:
>
> schema migration
> existing Category preservation
> idempotent seed behavior
> required seed contents
>
> This leaves the Issue close gate stronger than the authoritative Test-DD contract.
>
> The handout requires every planned automated test to identify an actual test-file path.
>
> Suggested fix
>
> Add explicit planned tests, for example:
>
> DB-01 | Integration
> Fresh database migrates to Lab 2 schema
> server/tests/lab-02/database-migration.integration.test.ts
>
> DB-02 | Integration
> Existing Lab 1 Category rows survive Lab 2 migration with id/name/createdAt preserved
> server/tests/lab-02/database-migration.integration.test.ts
>
> SEED-01 | Integration
> Seed can run twice without duplicate Requesters/Categories/Related Systems
> server/tests/lab-02/seed.integration.test.ts
>
> SEED-02 | Integration
> Seed contains exactly the required four Categories,
> at least six Related Systems,
> at least four active Requesters,
> and at least one inactive Requester
> server/tests/lab-02/seed.integration.test.ts
>
> The exact filenames are flexible.
>
> If migration/seed verification is intentionally manual rather than automated, then Issue #13 should not claim that migration/seed tests must pass.
>
> 5. [P1] API-ATT-08 tries to prove UI confirmation/cancel behavior with an API test
>
> The current Test-DD row says:
>
> API-ATT-08 | API
> Removal confirmation, reason validation, and cancel behavior
>
> with:
>
> server/tests/lab-02/attachments.api.test.ts
>
> and Expected Result:
>
> Confirmation is required,
> a 200-character reason is accepted,
> a 201-character reason is rejected,
> and cancel leaves the attachment active.
>
> The reason-length boundary can be proven by the API.
>
> However:
>
> confirmation dialog
> cancel behavior
>
> are UI behaviors. An API test cannot prove that the confirmation dialog appears or that clicking Cancel does not send the removal request.
>
> BR-19 explicitly says removal requires confirmation in a dialog.
>
> Suggested split
>
> API
>
> API-ATT-08
> removalReason omitted -> accepted
> 200 characters -> accepted
> 201 characters -> rejected
>
> Path:
>
> server/tests/lab-02/attachments.api.test.ts
>
> UI
>
> UI-ATT-04
> Remove opens confirmation dialog
> Cancel closes dialog and sends no DELETE request
> Confirm sends the removal request
>
> Path:
>
> client/src/lab-02-tests/AttachmentSection.test.tsx
>
> This gives BR-19 real UI + API evidence instead of claiming the API test proves the dialog.
>
> 6. [P2] Some AC mappings are still broader than the behavior the test actually proves
>
> The handout requires:
>
> every AC -> at least one planned test
>
> It does not require every BR-only test to be forced onto an AC.
>
> A few rows still attach Acceptance Criteria that do not actually describe the row's expected result.
>
> Examples:
>
> API-REQ-03
>
> Bootstrap/reference endpoints do not require requester headers
> → AC-15
>
> But AC-15 is:
>
> inactive Requester does not appear in selector
>
> The header exemption is BR-21 behavior, not AC-15.
>
> API-TKT-04
>
> Ownership assigned from X-Dev-Requester-Id at creation
> → AC-03
>
> AC-03 tests non-owner Ticket access returning 404.
>
> The creation ownership assignment is primarily BR-06 / BR-21 behavior.
>
> API-TKT-05
>
> IT Priority and Ticket Owner remain null
> → AC-01
>
> AC-01 is valid Ticket creation + generated official number.
>
> This null-default rule is BR-11 evidence and can legitimately use:
>
> Requirement / AC = —
>
> unless an AC is added specifically for it.
>
> API-ATT-07
>
> Attachment metadata + generated safe stored filename
> → AC-07
>
> AC-07 is the invalid-file-type rejection criterion.
>
> Metadata persistence and safe stored naming are BR-26 / BR-27 behavior.
>
> UI-STYLE-01
>
> field/button visual states
> → AC-23
>
> AC-23 is specifically mobile responsive behavior:
>
> stacked fields
> touch-friendly buttons
> no horizontal scroll
>
> The style test is useful, but AC-23 is already properly covered by the responsive/visual tests.
>
> Suggested fix
>
> For BR-only rows, use:
>
> Requirement / AC = —
>
> instead of assigning a loosely related AC.
>
> That produces cleaner traceability and avoids making the matrix look complete by association rather than by behavior.
>
> 7. [P2] ui-spec.md still does not explicitly define all Attachment states requested by the handout checklist
>
> The handout's UI checklist calls for explicit Attachment states including:
>
> active
> uploading
> invalid
> removed
> unavailable
>
> The current UI spec clearly defines:
>
> selected
> invalid
> active
> removed
>
> and defines the Create Ticket partial-success failure state.
>
> However, it does not clearly define a reusable per-Attachment:
>
> Uploading
> Unavailable
>
> presentation.
>
> This matters particularly for the Ticket Detail Add Attachment flow.
>
> Suggested addition
>
> Define something like:
>
> Uploading
> - per-file spinner/progress state
> - upload action disabled for that file while request is in flight
> - no duplicate upload submission
> - filename remains visible
>
> Unavailable
> - metadata remains visible when applicable
> - Preview/Download unavailable
> - clear unavailable/error label
> - retry action only when the contract allows retry
>
> Then include those states in UI component and visual coverage where relevant.
>
> 8. [P2] Attachment requester audit IDs are not modeled as relations or explicitly justified as scalar-only fields
>
> The Attachment schema contains:
>
> uploaderRequesterId Int
> removedByRequesterId Int?
>
> but neither is defined as a Prisma relation / foreign key to DevRequester.
>
> The handout explicitly asks students to determine:
>
> foreign keys
> additional relationships needed for attachment upload/removal metadata
>
> The current schema therefore leaves an unresolved design decision:
>
> Are uploaderRequesterId and removedByRequesterId real FK relationships,
> or intentionally denormalized scalar audit values?
>
> Recommended fix
>
> Either define the relations explicitly, for example conceptually:
>
> Attachment.uploaderRequesterId -> DevRequester.id
> Attachment.removedByRequesterId -> DevRequester.id
>
> with suitable Prisma relation names,
>
> or explicitly justify why the values intentionally remain scalar-only and how referential integrity is guaranteed.
>
> Do not leave this implicit for the coding agent to decide during implementation.
>
> 9. [P3] One outdated Copilot review thread is still unresolved
>
> The old Copilot thread saying the API status table omitted:
>
> 410 Gone
>
> is still unresolved, although it is now outdated and the API contract clearly includes 410.
>
> This is not a product blocker.
>
> It is simply PR-review housekeeping: resolve the outdated thread so the review state accurately reflects the current document.
>
> Resolved from previous review rounds
>
> The following earlier findings now appear resolved:
>
> - The Test-DD table now includes Expected Result and Final.
>
> - The Test-DD table includes actual test-file paths.
>
> - Category.createdAt is preserved in the proposed Lab 2 schema.
>
> - agent.md has one consistent commit/push approval policy.
>
> - Results Log entries are newest-first.
>
> - RequesterTicketDetail.test.tsx is planned.
>
> - UI Style coverage is planned.
>
> - Responsive/visual coverage includes all Lab 2 screens.
>
> - AC-09 includes UI and backend Attachment-size coverage.
>
> - Attachment size is frozen to exactly 5,000,000 bytes.
>
> - BR-13 now has explicit extension/content mismatch test cases.
>
> - BR-05 stale/inactive requester UI behavior has a planned test.
>
> - BR-21 header-exemption/context behavior has planned tests.
>
> - BR-22 default/fallback behavior has a planned test.
>
> - BR-06 ownership-at-create has planned evidence.
>
> - BR-10 Requested Priority default has planned evidence.
>
> - BR-11 requester-created null IT Priority / Ticket Owner has planned evidence.
>
> - BR-26 / BR-27 Attachment metadata and safe filename have planned evidence.
>
> - BR-29 inactive-requester history has planned evidence.
>
> - My Tickets loading/failure states have planned evidence.
>
> - BR-17 partial-success behavior has separate UI/API/E2E evidence.
>
> - AC-26 and AC-27 are represented in the specification/test plan.
>
> - Issue #13 contains AC-27.
>
> - Issue #15 contains BR-17 / AC-26.
>
> - Ticket Date is explicitly backend-authoritative createdAt.
>
> - Issue #12 owns DevRequester migration/seed work.
>
> - Issue #13 owns Ticket/Category/RelatedSystem migration/seed work.
>
> - Issue #15 owns Attachment persistence work.
>
> - ai-use.md uses the correct Lab 2 hyphenated filename.
>
> - reviewer.md records the current PR, reviewer identity, received feedback, responses, and pending approval status.
>
> - README accurately identifies the current implementation as the Lab 1 baseline.
>
> - The PR remains documentation/governance-only.
>
> Handout alignment summary
>
> The current baseline aligns well with the handout on:
>
> Development Requester as testing identity, not authentication
> Create Ticket required information
> numbered FR / BR / AC
> search/filter/sort/pagination
> server-side ownership
> Attachment allowed types, size, count, and soft removal
> safe filename decisions
> Ticket-created / Attachment-failed behavior
> Zen Green UI tokens and responsive breakpoints
> UI Style / Visual / E2E planning
> required minimum API/UI/E2E filenames
> Product + Process Definition of Done
> feature branch -> lab2-staging -> main workflow
> reviewer evidence structure
>
> The remaining course-contract issues are now concentrated around:
>
> AI-use prompt count
> Issue #11 lifecycle ownership
> explicit migration/seed contract + evidence
> Attachment confirmation test classification
> precise traceability
> remaining Attachment UI/data relationship details
>
> Verdict
>
> Request Changes — very close to approval
>
> Before approval, I would require these four items:
>
> - Resolve the Issue #11 docs-only vs final-release close-gate contradiction.
>
> - Explicitly document the migration strategy and align migration/seed test evidence with actual test-file paths.
>
> - Split BR-19 removal confirmation/cancel coverage into the correct UI test instead of claiming an API test proves the dialog.
>
> The remaining P2 items are consistency improvements that should also be cleaned up while the baseline is still documentation-only.
>
> After those corrections, this contract should be in a strong position to merge into lab2-staging.
>
> Review status notes
>
> - PR is open and mergeable.
>
> - Reviewed head: 72e851a6b94b8f81cb10ffad75531cbeb1c35632.
>
> - PR currently changes 9 files, all within documentation/governance scope (.gitignore, README, agent.md, and docs/lab-02/*).
>
> - No commit status checks are currently attached to this head.
>
> - The unresolved 410 Gone Copilot thread is outdated; the underlying API-contract issue has already been fixed.

#### My review comment 6 — Changes requested

> PR #16 Review — Request Changes
>
> Verdict
>
> Request Changes
>
> I re-reviewed PR #16 against:
>
> - the current PR head
>
> - Issue #11
>
> - Issues #12–#15
>
> - Issue #18
>
> - the Lab 2 engineering-contract documents in this repository
>
> - the official Lab 2 handout
>
> This review is intentionally limited to the requirements and contracts of this repository and the Lab 2 handout only.
>
> The baseline is close, but a few contract ambiguities and Test-DD gaps should still be frozen before implementation begins.
>
> 1. [P1] Ticket-list invalid filter behavior is still incomplete
>
> The handout requires the Ticket-list contract to define invalid-parameter behavior.
>
> The API contract already defines fallback behavior for:
>
> page
> pageSize
> sort
> order
>
> but it does not define what happens for invalid filter values such as:
>
> categoryId=abc
> categoryId=<nonexistent id>
> requestedPriority=URGENT
> status=CLOSED
>
> Different implementations could currently choose:
>
> 400 validation error
> ignore the invalid filter
> fall back to no filter
> return an empty list
>
> and all would still appear compatible with the current contract.
>
> Required fix
>
> Freeze the behavior for every filter parameter.
>
> For example:
>
> Malformed categoryId              -> 400 VALIDATION_ERROR
> Unknown but well-formed category  -> choose and document behavior
> Invalid requestedPriority enum    -> 400 VALIDATION_ERROR
> Invalid status enum               -> 400 VALIDATION_ERROR
> Invalid page/pageSize/sort/order   -> documented fallback
>
> Then extend API-MY-06 or add a separate API test row covering those cases.
>
> 2. [P1] Create Ticket reference-ID validation still has ambiguous cases
>
> The Create Ticket contract currently says:
>
> categoryId / relatedSystemId
> must reference an active record
>
> but it does not distinguish these cases:
>
> missing
> non-integer
> negative / invalid numeric value
> well-formed but nonexistent ID
> existing but inactive ID
>
> The implementation should not have to decide these rules during coding.
>
> Required fix
>
> Freeze the error behavior for both categoryId and relatedSystemId.
>
> For example:
>
> missing / malformed / non-integer -> 400 VALIDATION_ERROR
> well-formed but nonexistent       -> choose and document behavior
> existing but inactive             -> 409 Conflict
>
> Also add backend/API test coverage for the selected behavior.
>
> 3. [P1] Summary / Description trimming and exact boundary behavior should be explicit
>
> The Business Rules say Summary and Description are:
>
> required
> trimmed
> length-limited
>
> but the contract does not clearly state:
>
> whether trimming happens before validation
> whether the trimmed value is what gets persisted
> whether whitespace-only input is treated as empty
>
> Required fix
>
> Freeze the normalization rule, for example:
>
> Trim before validation.
> Validate the trimmed value.
> Persist the trimmed value.
> Whitespace-only input is invalid.
>
> The Test-DD plan should also prove the exact boundaries:
>
> Summary:
> 4   -> reject
> 5   -> accept
> 120 -> accept
> 121 -> reject
>
> Description:
> 9    -> reject
> 10   -> accept
> 2000 -> accept
> 2001 -> reject
>
> 4. [P1] Blank/whitespace search behavior affects Empty vs No-Results and is not frozen
>
> The API defines search as a case-insensitive substring.
>
> The UI distinguishes:
>
> Empty
> vs
> No Results
>
> based on whether search/filtering is active.
>
> But the contract does not define what these mean:
>
> ?search=
> ?search=
> ?search=%20laptop%20
>
> This can change which UI state is shown.
>
> Required fix
>
> Define search normalization explicitly.
>
> For example:
>
> Search is trimmed.
> Blank-after-trim search is treated as no search filter.
> Nonblank search uses case-insensitive substring matching.
> Empty vs No-Results uses normalized active filters, not raw query-string presence.
>
> Then add a corresponding My Tickets test.
>
> 5. [P1] Out-of-range pagination behavior is undefined
>
> The contract defines:
>
> page >= 1
> pageSize 1-50
>
> but does not define what happens when the requested page is beyond the available result set.
>
> Example:
>
> totalPages = 3
> GET /api/tickets?page=999
>
> Possible implementations include:
>
> 200 with data=[]
> clamp to page 3
> fallback to page 1
> 400 validation error
>
> Required fix
>
> Choose and document one behavior.
>
> This matters because an out-of-range page returning an empty array must not accidentally be rendered as the normal Empty or No-Results state.
>
> 6. [P1] Requester Selection is specified more completely than it is tested
>
> The UI specification defines the Development Requester Selection screen with:
>
> loading state
> empty state
> API failure + Retry
> Continue disabled before selection
> Continue enabled after selection
> keyboard operability
> sessionStorage requester persistence
> current Requester display
>
> The current Test-DD plan covers route guarding and stale/inactive requester handling, but does not directly prove all of the above states.
>
> Required fix
>
> Add planned UI rows in:
>
> client/src/lab-02-tests/RequesterSelection.test.tsx
>
> for at least:
>
> loading state
> no-active-requesters empty state
> API failure + manual Retry
> Continue disabled before selection
> Continue enabled after selection
> selected requester stored in sessionStorage
> selected requester displayed in the application shell
>
> Also add direct client-side evidence that requester-scoped API calls actually send:
>
> X-Dev-Requester-Id
>
> The server-side header validation alone does not prove that the client injects it.
>
> 7. [P1] Active Category and Related System endpoints do not have direct planned tests
>
> The handout requires API support for retrieving:
>
> active Development Requesters
> active Categories
> active Related Systems
>
> The requester endpoint has direct API coverage, but the Test-DD plan does not currently have equivalent explicit rows for:
>
> GET /api/categories
> GET /api/related-systems
>
> Required fix
>
> Add planned API coverage such as:
>
> API-REF-01
> GET /api/categories returns only active Categories
>
> API-REF-02
> GET /api/related-systems returns only active Related Systems
>
> Also keep the current compatibility decision explicit:
>
> /api/categories       -> existing Lab 1 raw-array response
> /api/related-systems  -> documented { data: [...] } response
>
> 8. [P1] removedByRequesterId is not yet part of the Business Rule / planned soft-remove assertion
>
> The current data model and DELETE API response include:
>
> removedByRequesterId
>
> Issue #15 also expects it to be set during soft removal.
>
> However, BR-18 currently lists only:
>
> isRemoved
> removedAt
> removalReason
>
> and API-ATT-04 does not explicitly assert removedByRequesterId.
>
> This leaves the Business Rule and Test-DD weaker than the schema/API/Issue contract.
>
> Required fix
>
> Update BR-18 to state explicitly:
>
> isRemoved = true
> removedAt = current timestamp
> removedByRequesterId = current X-Dev-Requester-Id
> removalReason = provided value or null
>
> Then update API-ATT-04 to assert removedByRequesterId.
>
> 9. [P1] Multi-file Create Ticket attachment failure behavior is still ambiguous
>
> The Create Ticket UI allows multiple selected files, while Attachment upload is performed per file after the Ticket exists.
>
> The contract correctly defines the high-level partial-success rule:
>
> Ticket remains created
> Attachment failure is reported separately
> Ticket is not recreated
> Retry happens from Ticket Detail
>
> but it does not define what happens when only one file in a multi-file submission fails.
>
> Example:
>
> A.pdf -> success
> B.png -> failure
> C.jpg -> ?
>
> The implementation could either:
>
> stop after the first failure
> continue uploading remaining files
>
> and the current contract does not choose.
>
> Required fix
>
> Freeze one policy.
>
> For example:
>
> Attachments are uploaded sequentially.
> A failed attachment does not roll back successful uploads.
> Remaining files continue to upload.
> Failures are reported per file.
> Failed files can be retried from Ticket Detail.
>
> or choose stop-on-first-failure instead.
>
> Then add one mixed-result planned test proving the selected behavior.
>
> 10. [P1/P2] Removal reason normalization is not fully defined
>
> The contract says:
>
> removalReason is optional
> <= 200 characters
>
> but these cases are still undefined:
>
> { "removalReason": "" }
> { "removalReason": "     " }
> { "removalReason": 123 }
>
> Required fix
>
> Choose and document behavior for:
>
> omitted value
> blank string
> whitespace-only string
> non-string value
> trimmed persisted value
>
> For example:
>
> omitted / blank-after-trim -> null
> non-string                 -> 400 VALIDATION_ERROR
> 1-200 chars after trim     -> accepted
> >200 chars after trim      -> rejected
>
> Update API-ATT-08 accordingly.
>
> 11. [P2] Attachment list ordering is undefined
>
> GET /api/tickets/:ticketNumber/attachments returns active and removed metadata, but no deterministic ordering is specified.
>
> This can make UI rendering and tests unstable.
>
> Suggested fix
>
> Freeze one ordering rule, for example:
>
> uploadedAt asc, id asc
>
> or:
>
> uploadedAt desc, id desc
>
> The exact choice is flexible; it just needs to be deterministic.
>
> 12. [P2] Ticket Number tests should prove the actual BR-01 rule, not only the presence of a number
>
> BR-01 requires the Ticket Number to be:
>
> backend-generated
> unique
> format: TKT-{YYYY}-{6-digit sequence}
>
> API-TKT-01 currently focuses mainly on successful creation and returning a generated number.
>
> Suggested fix
>
> Make the planned test explicitly assert:
>
> matches TKT-{YYYY}-{6 digits}
> generated by backend
> two created Tickets do not share the same Ticket Number
>
> This keeps Test-DD aligned with the Business Rule it maps to.
>
> 13. [P2] BR-02 should be asserted explicitly in the Create Ticket API test
>
> API-TKT-01 maps to BR-02, but the expected result should explicitly verify:
>
> currentStatus === NEW
>
> rather than relying on the BR mapping alone.
>
> 14. [P2] Issue #13 test-type wording is now slightly stale
>
> tests.md now correctly plans:
>
> DB-01 / DB-02       Integration
> SEED-01 / SEED-02   Integration
>
> However, Issue #13 still says:
>
> Unit and API tests pass for ...
> schema migration, seed data, ...
>
> Suggested fix
>
> Change it to:
>
> Planned unit, API, and integration tests pass for validators,
> ticket generation, ownership/defaults, schema migration,
> seed behavior, and endpoint success/error cases.
>
> This keeps Issue #13 aligned with the current Test-DD plan.
>
> 15. [P2] Issue #18 release/PDF sequencing should distinguish pre-merge and final-main evidence
>
> Issue #18 is the correct owner for final integration/release work.
>
> However, its wording currently makes it sound as if the final PDF evidence is complete before the release PR to main is merged.
>
> The handout expects final evidence from the completed final branch, including final passing-test / delivery evidence.
>
> Suggested fix
>
> Split the Issue #18 close gate conceptually into:
>
> Before release merge:
> - feature integration complete
> - planned tests passing
> - responsive/visual evidence captured
> - release PR ready
>
> and:
>
> After merge to main:
> - verify final main branch
> - capture final required test output / history / delivery evidence
> - finalize course PDF
>
> Issue #18 can remain open until the post-merge evidence is completed.
>
> Also update Issue #11 to refer explicitly to:
>
> #18 - Lab 2 Final Integration and Release Verification
>
> instead of only saying "Dedicated integration/release issue".
>
> What is already in good shape
>
> The following areas no longer need changes from the previous review rounds:
>
> - Category.createdAt is preserved.
>
> - Forward Lab 1 -> Lab 2 migration behavior is documented.
>
> - Existing Category rows are preserved.
>
> - Seed idempotency is documented.
>
> - DB migration and seed test paths are planned.
>
> - RequesterTicketDetail.test.tsx is present.
>
> - UI Style coverage is present.
>
> - Responsive/visual coverage includes all Lab 2 screens.
>
> - Attachment size is fixed at exactly 5,000,000 bytes.
>
> - Client and server Attachment size validation are both planned.
>
> - BR-13 content/extension validation is planned.
>
> - BR-19 confirmation and API reason validation are split correctly.
>
> - Attachment Uploading/Invalid/Active/Removed/Unavailable UI states are documented.
>
> - Attachment requester audit relations exist in the data model.
>
> - BR-17 Ticket-created / Attachment-failed partial success is separated from Ticket-create failure.
>
> - Issue #18 now owns final integration/release verification.
>
> - Existing Copilot review threads are resolved.
>
> - The PR remains within documentation/governance scope.
>
> Final Recommendation
>
> Request Changes
>
> Before approval, I would require the author to complete one final contract-freeze pass rather than fixing these one at a time.
>
> At minimum:
>
> - Freeze all Ticket-list invalid filter and pagination behavior.
>
> - Freeze all Create Ticket normalization/reference-validation behavior.
>
> - Complete Requester Selection and reference-data Test-DD coverage.
>
> - Align soft-removal metadata rules/tests with removedByRequesterId.
>
> - Freeze multi-file Attachment partial-failure behavior.
>
> After that pass, the coding agent should no longer need to invent important runtime behavior during implementation.

#### My review comment 7 — Changes requested

> PR #16 Re-Review — Full Contract Consistency Sweep
>
> Review: Request Changes
>
> Reviewed PR #16 at head:
>
> d72b6ac3299457d3c00a407e5dc54927e8f04f6f
>
> against:
>
> - the current PR content
>
> - Issue #11
>
> - Issues #12–#15
>
> - Issue #18
>
> - README.md
>
> - agent.md
>
> - docs/lab-02/specification.md
>
> - docs/lab-02/api-spec.md
>
> - docs/lab-02/ui-spec.md
>
> - docs/lab-02/tests.md
>
> - docs/lab-02/reviewer.md
>
> - the official Lab 2 handout
>
> This review intentionally uses only this repository, its Issues, and the Lab 2 handout. It does not impose design decisions from another project.
>
> Per reviewer instruction, the number of prompts in ai-use.md is not treated as a finding here.
>
> The latest commits resolve most of the previous review comments, but the new contract-freeze additions introduce several cross-document inconsistencies that should be fixed together before implementation begins.
>
> 1. [P1] The specification reintroduced non-numbered Business Rule IDs
>
> The Lab 2 handout explicitly requires Business Rules to be numbered:
>
> BR-01
> BR-02
> BR-03
> ...
>
> The current specification now introduces IDs such as:
>
> BR-23-SEARCH
> BR-23-FILTER-INVALID
> BR-17-MULTI-ATTACH
> BR-23-STATES
>
> These are no longer in the handout-required BR-xx format.
>
> This also creates traceability drift:
>
> - AC-21 / AC-22 still reference BR-23.
>
> - Issue #14 maps BR-23.
>
> - Issue #15 maps BR-17, but not the new BR-17-MULTI-ATTACH.
>
> - Issue #18 claims BR-01..BR-29, which does not include these suffixed rules.
>
> - tests.md maps tests to the new suffixed identifiers.
>
> Required fix
>
> Use one consistent strategy:
>
> - fold the new details into the existing numbered rules (BR-17, BR-23, etc.), or
>
> - assign new normal numeric IDs such as BR-30, BR-31, etc.
>
> Then update:
>
> specification.md
> tests.md
> AC mappings
> Issues #14 / #15 / #18
> api-spec.md / ui-spec.md references where applicable
>
> Do not leave a mix of BR-xx and BR-xx-SUFFIX identifiers.
>
> 2. [P1] page invalid-parameter behavior contradicts itself across the contract
>
> The current API contract says in its normative edge-case matrix:
>
> page: invalid or out-of-range
> -> 200 with empty data array
>
> The query-parameter table repeats:
>
> out-of-range or invalid
> -> 200 with empty data array
>
> However, specification.md says:
>
> Invalid or omitted parameters fall back to safe defaults.
> Out-of-range pages return 200 with empty data.
>
> and tests.md says:
>
> page=0 or negative -> fallback to 1
> page=999 when totalPages=3 -> 200 with empty data
>
> Those are different contracts.
>
> It is also still unclear what these do:
>
> ?page=abc
> ?page=1.5
> ?page=0
> ?page=-1
> ?page=999
>
> Required fix
>
> Define the categories separately and make all documents agree.
>
> For example:
>
> missing              -> default 1
> malformed/non-integer -> choose one behavior
> <= 0                 -> choose one behavior
> valid but > totalPages -> choose one behavior
>
> The exact choices are the student's decision, but specification.md, api-spec.md, and tests.md must give the same answer.
>
> Also define what the UI does when the API returns an out-of-range empty page so that it is not displayed as the normal Empty or No-Results state.
>
> 3. [P1] Empty vs No-Results still has two conflicting definitions inside api-spec.md
>
> The new closed-contract rule correctly says:
>
> search is trimmed
> blank-after-trim means no active search filter
>
> Empty vs No-Results is based on normalized active filters/search,
> not raw query-string presence
>
> However, the Ticket-list response section still says the frontend distinguishes the states by:
>
> whether any search/filter query params were present
>
> Those differ for requests such as:
>
> ?search=
> ?search=
>
> A raw query parameter is present, but the normalized contract says there is no active search filter.
>
> Required fix
>
> Update the old paragraph to use the new canonical rule:
>
> Empty / No-Results is determined by normalized active filters/search,
> not by raw query-parameter presence.
>
> There should be only one definition in the API contract.
>
> 4. [P1] tests.md still leaves negative/zero reference IDs implementation-dependent
>
> The current specification and API edge-case matrix freeze:
>
> categoryId / relatedSystemId <= 0
> -> 400 VALIDATION_ERROR
>
> But the detailed Test-DD section still says:
>
> Negative or zero value
> -> 400 validation error (or 409, depending on DB constraint)
>
> The phrase:
>
> or 409, depending on DB constraint
>
> directly violates the new decision-free contract because it allows the implementation to choose.
>
> Required fix
>
> Remove the alternative and make the test contract match the normative decision exactly.
>
> If the selected rule is:
>
> zero / negative -> 400
>
> then the test must require 400, regardless of the database constraint implementation.
>
> Also update the POST /api/tickets error-case summary: it currently describes 409 only as an inactive reference even though the new validation rules also use 409 for a well-formed nonexistent reference.
>
> 5. [P1] Multi-file partial-success behavior is defined at the wrong test layer and is not aligned with ui-spec.md
>
> The new specification/API rule says:
>
> Files are processed sequentially.
> A failed file does not roll back prior successes.
> Remaining files continue.
> Failures are reported per file.
>
> However, the upload API itself accepts only:
>
> multipart/form-data
> field: file
>
> one file per request.
>
> Therefore the multi-file sequence:
>
> A success
> B failure
> C continues
>
> is primarily client orchestration across multiple API calls, not behavior of one server API call.
>
> But the new planned test is:
>
> API-ATT-11
> server/tests/lab-02/attachments.api.test.ts
>
> An API test can prove that individual upload requests succeed/fail independently, but it cannot prove that the Create Ticket UI:
>
> continues to C after B fails
> reports B per-file
> keeps A/C visible as successful
> offers the correct retry path
>
> ui-spec.md was also not updated with this new mixed-result behavior; it still describes only the generic Case B where "attachment upload fails."
>
> Required fix
>
> Keep server API tests for individual upload behavior, but move the sequential multi-file orchestration evidence to an appropriate:
>
> UI component test
> and/or
> E2E test
>
> and update ui-spec.md to describe the mixed-result state explicitly.
>
> 6. [P1] Valid + invalid pre-submit attachments still have contradictory UI behavior
>
> The handout's required final evidence explicitly asks the student to:
>
> Select one valid and one invalid attachment and explain the result.
>
> The current UI spec says an invalid file:
>
> shows an inline error
> is not submitted
> does not block the others
>
> but it also says:
>
> Submit is disabled if any field is currently invalid.
>
> It is not clear whether an invalid Attachment counts as an invalid form state.
>
> Two implementations are currently possible:
>
> A. invalid attachment blocks Ticket submission until removed
> B. invalid attachment is excluded and the Ticket + valid files may still submit
>
> Required fix
>
> Choose one behavior and state it explicitly.
>
> Then add a UI test for:
>
> one valid file + one invalid file
>
> and add the corresponding screenshot/evidence state.
>
> 7. [P1] The per-endpoint API error contract is still incomplete relative to handout §6.3
>
> The handout requires every capability to document:
>
> successful response
> validation failures
> ownership failures
> missing-resource behavior
> safe unexpected-error behavior
>
> The API contract has a useful global status table, but several endpoints still do not define their applicable errors clearly.
>
> Examples:
>
> Reference endpoints
>
> GET /api/categories
> GET /api/related-systems
> GET /api/dev-requesters
>
> document success but no safe unexpected-error behavior.
>
> Ticket list
>
> GET /api/tickets defines parameter behavior but has no consolidated error section covering:
>
> 422 requester context
> 400 invalid filters
> 409 unavailable reference filter
> 500 unexpected failure
>
> Ticket detail
>
> GET /api/tickets/:ticketNumber explicitly documents only 404, despite also being requester-scoped.
>
> Attachment upload/list/detail actions
>
> Several sections omit some applicable combinations of:
>
> 422 requester context
> 400 validation
> 404 missing/non-owner
> 409 conflict
> 500 unexpected failure
>
> POST /attachments also does not explicitly define what happens when the required file part is missing.
>
> Required fix
>
> This does not need duplicated prose under every endpoint.
>
> A clean solution is to define a normative inherited error matrix, for example:
>
> All requester-scoped endpoints inherit:
> - 422 invalid/missing/inactive requester
> - 500 safe unexpected error
>
> Owned-resource endpoints additionally inherit:
> - 404 missing or non-owned resource, identical shape
>
> and then document only endpoint-specific validation/conflict statuses under each capability.
>
> The important point is that the handout-required error behavior should be complete and unambiguous for every capability.
>
> 8. [P1] Requester Selection Test-DD still misses required post-selection and accessibility behavior
>
> The latest Test-DD additions correctly add:
>
> loading
> empty
> failure + Retry
> sessionStorage
> X-Dev-Requester-Id injection
>
> That resolves most of the previous gap.
>
> However, the handout also explicitly requires after selection:
>
> Requester name shown in the application shell
> Change Requester action available
> requester-specific data reloads on change
>
> and the selector itself must be:
>
> keyboard-accessible
> clearly labeled as Lab 2 testing only, not login
>
> UI-REQ-06 currently proves storage + header injection, but not the selected Requester display.
>
> UI-MY-03 proves switching behavior, but does not explicitly prove the required Change Requester control is present/operable.
>
> E2E-05 is titled as a keyboard-only Create Ticket flow; it does not clearly state that the Requester Selection screen itself is included.
>
> Required fix
>
> Extend RequesterSelection.test.tsx and/or E2E coverage to explicitly prove:
>
> testing-only explanatory text
> Continue disabled before selection
> Continue enabled after selection
> selected Requester name visible after Continue
> Change Requester action exists and works
> selector controls keyboard-operable with visible focus
>
> 9. [P1] The screenshot/evidence plan does not yet satisfy its own Definition of Done or the handout's required Create evidence
>
> The Product DoD says:
>
> Success, validation, loading, empty, no-results, and failure states
> all implemented and screenshotted.
>
> The handout specifically requires Create Ticket screenshots for:
>
> initial
> validation failure
> submitting
> success
> API failure
> invalid attachment
>
> But ui-spec.md currently plans:
>
> create-ticket/
>   initial
>   validation-error
>   submitting
>   success
>   api-failure
>   partial-success-attachment-failure
>
> There is no explicit:
>
> invalid-attachment
>
> screenshot.
>
> The handout also requires evidence of:
>
> selected-user display
> Change Requester action
> loading state
> failure state
>
> for the Development Requester flow.
>
> Additionally, the DoD says loading/failure states are screenshotted, but:
>
> my-tickets/
>
> does not list loading/failure screenshots, and:
>
> ticket-detail/
>
> does not list loading/failure/not-found screenshots.
>
> Required fix
>
> Align the screenshot paths and visual plan with the actual DoD.
>
> At minimum add explicit evidence for:
>
> create-ticket/invalid-attachment
> requester selected/application-shell + Change Requester
> my-tickets/loading
> my-tickets/failure
> ticket-detail/loading
> ticket-detail/failure-or-not-found
>
> if the DoD is going to continue requiring all of those states to be screenshotted.
>
> 10. [P1] The handout-required Attachment transaction/compensation strategy is still not explicitly documented
>
> The handout explicitly says the Attachment rules must define:
>
> the transaction or compensation strategy
>
> The current contract now does a good job defining the user-visible partial-success policy:
>
> Ticket survives Attachment failure.
> Prior successful files stay successful.
> Later files continue.
>
> However, it still does not explicitly state the per-Attachment persistence strategy between:
>
> file storage
> Attachment metadata row
> request failure
>
> For example, the contract does not say what the system guarantees if the physical file operation succeeds but metadata persistence fails, or vice versa.
>
> Required fix
>
> Add a concise transaction/compensation decision to specification.md.
>
> The exact implementation is the student's choice. The review is not prescribing a particular storage design.
>
> The contract only needs to state the intended invariant, for example that a failed Attachment request must not leave the system claiming an Active attachment that cannot be used, and must define how partial storage/metadata work is cleaned up or compensated.
>
> This is specifically required by the Lab 2 handout, not an additional production requirement.
>
> 11. [P1/P2] API-TKT-04 introduces an undocumented request-body behavior
>
> The documented POST /api/tickets body does not include:
>
> requesterId
>
> because ownership comes from:
>
> X-Dev-Requester-Id
>
> However, API-TKT-04 says:
>
> The server assigns ownership from the caller header
> and ignores any client-provided mismatch.
>
> That silently chooses how an undocumented extra requesterId field is handled.
>
> The API contract does not say whether server-managed/unknown fields are:
>
> rejected
> or
> ignored
>
> Required fix
>
> Either:
>
> - document the chosen behavior for client-supplied server-managed fields in api-spec.md, or
>
> - change the test so it proves only that the persisted requester comes from the header without introducing an undocumented request field.
>
> The Test-DD plan should not be the first place where request validation semantics are invented.
>
> 12. [P1/P2] Seed wording can conflict with the migration-preservation rule
>
> The handout requires the seed to include the four required Categories:
>
> Account and Access
> Hardware
> Software
> Network
>
> The migration contract also says:
>
> existing Category rows are preserved
> the seed must not replace/rewrite existing Categories
>
> But the specification/Test-DD currently use wording such as:
>
> exactly the four required Categories
>
> If an existing Lab 1-compatible database contains an additional unrelated Category, "exactly four" can be read as requiring deletion of that row, which conflicts with the preservation rule.
>
> Required fix
>
> Clarify the intended invariant, for example:
>
> The four required Category names must each exist exactly once.
> The seed must not delete unrelated pre-existing Category rows.
>
> This preserves the handout's required seed data without contradicting the forward-migration contract.
>
> 13. [P2] BR-02 is still mapped but not explicitly asserted in the planned Create API test
>
> The specification now explicitly says:
>
> BR-02
> A new Ticket begins with Current Status = New.
> Tests must assert currentStatus === NEW explicitly.
>
> However, API-TKT-01 maps to BR-02 but its expected result currently checks:
>
> successful create
> generated Ticket Number
> format
> uniqueness
>
> without explicitly checking:
>
> currentStatus === "NEW"
>
> Required fix
>
> Add the explicit status assertion to API-TKT-01 or another planned API test.
>
> Mapping a BR ID to a row is not the same as proving the rule.
>
> 14. [P2] The database-index justification does not yet discuss all fields used by My Tickets
>
> The handout requires the data design to consider and document:
>
> which fields are frequently searched, filtered, or sorted
> which indexes are justified
>
> The current design justification discusses:
>
> requesterId
> currentStatus
> createdAt
>
> but My Tickets also uses:
>
> categoryId       filter
> requestedPriority filter/sort
> ticketNumber     search/sort
> summary          search/sort
>
> This does not mean all of those fields must be indexed.
>
> Required fix
>
> Document the decision.
>
> Either add indexes that are justified by the chosen design, or explicitly state why additional indexes are not justified for the expected Lab 2 data volume/query workload.
>
> The handout requires the consideration and justification, not a specific production indexing strategy.
>
> 15. [P2] ui-spec.md includes a Profile menu that conflicts with the new closed-contract rule
>
> The handout requires application navigation to include:
>
> TokTickIT identity
> My Tickets
> Create Ticket
> Development Requester identity
> active-page indication
> responsive navigation
>
> The current UI spec additionally requires:
>
> Profile menu
>
> but no Profile behavior exists in the Lab 2 requirements, and authentication/admin/profile functionality is outside the sprint scope.
>
> The new higher-precedence specification also says the implementation must not invent:
>
> extra UI widgets not called out in the requirement set
>
> Required fix
>
> Remove the Profile menu from the Lab 2 shell unless there is an approved Lab 2 requirement for it.
>
> Do not leave an undefined or dead UI control in a contract that is explicitly described as decision-free.
>
> 16. [P2] GitHub Issue and course-evidence records still have a few stale statements
>
> These are smaller than the contract blockers above, but should be cleaned before approval.
>
> Issue #13
>
> The Test-DD plan now correctly contains:
>
> DB-01 / DB-02       Integration
> SEED-01 / SEED-02   Integration
>
> but Issue #13 still says:
>
> Unit and API tests pass for ...
> schema migration, seed data, ...
>
> Change it to:
>
> unit, API, and integration tests
>
> or equivalent.
>
> Issue #18
>
> Issue #18 currently requires the release PR to be ready with:
>
> PDF evidence complete
>
> but the handout requires final evidence from the final main branch, including final main commit history and complete passing test output from main.
>
> The workflow should distinguish:
>
> pre-merge release readiness
> vs
> post-merge final-main verification / PDF capture
>
> Issue #11
>
> Now that Issue #18 exists, replace the generic:
>
> Dedicated integration/release issue
>
> with the actual:
>
> #18 - Lab 2 Final Integration and Release Verification
>
> for explicit traceability.
>
> reviewer.md
>
> It currently says:
>
> The remaining unresolved Copilot thread is outdated...
>
> but all current Copilot review threads are resolved.
>
> Update the review evidence so it reflects the actual PR state.
>
> tests.md Results Log
>
> The newest log entry says it updated:
>
> AGENT.md
>
> but the repository contract file is:
>
> agent.md
>
> and the latest two commits from the previous reviewed head do not modify agent.md.
>
> The Results Log is course evidence, so it should describe what actually changed rather than recording a file/action that did not occur.
>
> 17. [P3] Attachment-list wording mentions pagination even though the endpoint is not paginated
>
> GET /api/tickets/:ticketNumber/attachments now says the deterministic order is for:
>
> stable pagination and test reproducibility
>
> and API-ATT-09 repeats similar language.
>
> The Attachment-list endpoint itself has no pagination contract.
>
> Suggested fix
>
> Change the wording to something like:
>
> stable display ordering and reproducible tests
>
> unless Attachment pagination is intentionally being added, which would itself need to be specified.
>
> Resolved from the Previous Review
>
> The latest commits correctly resolve many previous findings:
>
> - Ticket-list invalid filter behavior is now substantially specified.
>
> - categoryId / relatedSystemId malformed/nonexistent/inactive cases are mostly frozen.
>
> - Summary/Description trimming and exact boundaries are documented.
>
> - Search trimming is documented.
>
> - Out-of-range pagination now has an intended API behavior.
>
> - Requester Selection loading/empty/failure tests were added.
>
> - Active Category and Related System API tests were added.
>
> - removedByRequesterId is now in BR-18 and planned tests.
>
> - Removal-reason normalization is now documented and tested.
>
> - Attachment-list deterministic ordering is now documented.
>
> - Ticket Number format/uniqueness coverage was expanded.
>
> - Multi-file Attachment partial success now has an explicit intended policy.
>
> - Migration/seed preservation rules remain explicit.
>
> - Attachment uploader/remover relations remain explicit.
>
> - UI Style, responsive, visual, and Ticket Detail component coverage remain planned.
>
> - Issue #18 exists as the final integration/release owner.
>
> - Existing Copilot inline review threads are resolved.
>
> - The PR remains documentation/governance-only and targets lab2-staging.
>
> Final Recommendation
>
> Request Changes
>
> The latest pass is much closer, but I would not approve the baseline yet because the contract currently describes itself as decision-free while still containing several decisions that disagree across specification.md, api-spec.md, ui-spec.md, tests.md, and the downstream Issues.
>
> Before the next review, I recommend doing one final synchronized pass with these priorities:
>
> - normalize all BR IDs and repair Issue/AC/Test-DD mappings;
>
> - resolve the page and Empty/No-Results contradictions;
>
> - align multi-file Attachment behavior across specification, UI, tests, and Issue #15;
>
> - complete the handout-required per-capability API error contract and Attachment compensation decision;
>
> - complete Requester Selection + visual evidence planning;
>
> - clean the remaining Issue/reviewer/results-log evidence drift.
>
> After those are synchronized, the next review should be able to focus on approval rather than discovering another layer of contract ambiguity.

#### My review comment 8 — Changes requested

> PR #16 Re-Review — Remaining Contract and Test-DD Gaps
>
> Review: Request Changes — Close to Approval
>
> Reviewed PR #16 at current head:
>
> e6b135269e9ba2293c53d6292ad367fc7fecde30
>
> against:
>
> - the current PR content
>
> - live GitHub Issues #11–#15 and #18
>
> - the repository's current implementation baseline/tooling
>
> - README.md
>
> - agent.md
>
> - docs/lab-02/specification.md
>
> - docs/lab-02/api-spec.md
>
> - docs/lab-02/ui-spec.md
>
> - docs/lab-02/tests.md
>
> - docs/lab-02/reviewer.md
>
> - the official Lab 2 handout
>
> This review intentionally uses only this repository, its own Issues, and the Lab 2 handout.
>
> Per reviewer instruction, the number of entries in ai-use.md is not treated as a finding.
>
> The latest synchronization commit resolves most of the previous review. The remaining findings below are the items I would still fix before using these documents as the closed implementation contract.
>
> 1. [P1] BR-23 is defined twice, and the two definitions do not mean the same thing
>
> The latest commit correctly removed the suffixed identifiers such as:
>
> BR-23-SEARCH
> BR-23-STATES
>
> but specification.md now contains two separate BR-23 entries.
>
> The first effectively defines:
>
> zero results + no normalized active filters/search -> Empty
> zero results + active filters/search               -> No-Results
>
> The second defines:
>
> Empty      -> Requester has zero tickets ever
> No Results -> filters/search matched zero of an otherwise non-empty list
>
> Those rules differ in this case:
>
> Requester has zero tickets ever
> +
> URL/request contains an active filter
>
> Under the first rule:
>
> No-Results
>
> Under the second rule and AC-21:
>
> Empty
>
> AC-21 specifically says:
>
> Requester has zero tickets ever -> Empty
>
> while AC-22 says No-Results applies when filters/search match zero of an otherwise non-empty list.
>
> Required fix
>
> Keep only one unique BR-23 and freeze the canonical behavior.
>
> If the intended behavior follows AC-21/AC-22, the UI needs a reliable way to distinguish:
>
> zero tickets exist for this requester
> vs.
> tickets exist but the current normalized filters match zero
>
> That may require an explicit API metadata decision or another documented UI/data-loading strategy.
>
> Then synchronize:
>
> specification.md
> api-spec.md
> tests.md
> Issue #14
>
> Do not leave the decision as:
>
> active filters = No-Results
>
> if AC-21 still says zero-tickets-ever must render Empty.
>
> 2. [P1] The Test-DD claim that every BR is proven is still not true
>
> The handout requires the final test plan to identify scenarios needed to prove all Business Rules and Acceptance Criteria.
>
> tests.md currently says:
>
> every FR, BR, and AC must be traceable to at least one planned automated test
>
> and later says that BRs may instead be represented by:
>
> a closed requirement statement
>
> A requirement statement is not test evidence.
>
> There are also concrete BR gaps in the current matrix.
>
> BR-02
>
> The specification explicitly says:
>
> A new Ticket begins with Current Status = New.
> Tests must assert currentStatus === NEW explicitly.
>
> API-TKT-01 maps to BR-02, but its Expected Result currently proves only:
>
> one ticket created
> generated Ticket Number
> format
> uniqueness
>
> It never explicitly asserts:
>
> currentStatus === "NEW"
>
> BR-10
>
> BR-10 requires:
>
> Requested Priority is required
> LOW | MEDIUM | HIGH only
> UI default = MEDIUM
>
> The current planned evidence is only:
>
> UI-TKT-07
>
> which proves the UI default and missing-form behavior.
>
> There is no backend/API test proving:
>
> missing requestedPriority -> 400
> invalid requestedPriority -> 400
> LOW / MEDIUM / HIGH       -> accepted
>
> even though the API contract explicitly requires server-side validation.
>
> BR-25
>
> BR-25 is the Lab 3 transition boundary.
>
> There is no direct test/evidence row for it, while tests.md currently claims every BR maps to automated evidence.
>
> Because BR-25 is partly a future-boundary/process rule, it is reasonable to classify it as a non-runtime/static contract check — but that classification must be explicit instead of silently counting the written BR itself as proof.
>
> Required fix
>
> At minimum:
>
> API-TKT-01
> -> explicitly assert currentStatus === "NEW"
>
> Add API coverage for BR-10.
>
> For BR-25, either:
>
> add an explicit static/scope verification row
>
> or adjust the Test-DD completeness language so it accurately describes how non-executable future-boundary rules are verified.
>
> 3. [P1/P2] The chosen Ticket Number sequence behavior is not fully frozen or tested
>
> The student-defined Ticket Number contract is:
>
> TKT-{YYYY}-{6-digit sequence}
> sequence per calendar year
>
> The planned tests currently prove:
>
> format
> current year
> six digits
> two tickets are different
>
> but the contract still does not clearly answer:
>
> What is the first sequence value of a year?
> Does the sequence increment by exactly 1?
> What happens when the calendar year changes?
> Which authoritative date/timestamp supplies YYYY?
>
> The handout only requires a unique backend-generated number, but once this repository chooses a year-scoped sequence format, those additional semantics become part of its own closed contract.
>
> Required fix
>
> Freeze the intended sequence semantics.
>
> For example, if intended:
>
> first Ticket of each year -> 000001
> next Ticket               -> previous + 1
> new calendar year          -> reset sequence
> YYYY                       -> derived from the same backend-authoritative clock/date basis used for Ticket creation
>
> Then add a focused unit/API scenario that proves the chosen behavior.
>
> No concurrency behavior is being requested here; this is only about the sequence format already chosen by this repository.
>
> 4. [P1] The API has a standard error.code field but no complete error-code contract
>
> api-spec.md defines a standard error body:
>
> {
>   "error": {
>     "code": "...",
>     "message": "..."
>   }
> }
>
> but many error codes are still left for implementation to invent.
>
> Examples include:
>
> 422 invalid requester context
> 404 missing/non-owned Ticket
> 404 missing/non-owned Attachment
> 409 inactive/nonexistent reference
> 410 removed Attachment
> 413 oversized Attachment
> 415 unsupported Attachment
> 500 unexpected error
>
> There is also an inconsistency in the current reference validation wording:
>
> nonexistent reference -> 409 INACTIVE_REFERENCE
> inactive reference    -> 409, code not explicitly frozen
>
> and the POST /api/tickets Error Cases summary still says 409 only for an inactive reference even though the validation matrix also assigns 409 to a nonexistent positive ID.
>
> With the current "decision-free" contract, the coding agent should not have to invent these values.
>
> Required fix
>
> Add one small canonical error-code table.
>
> For example:
>
> status / condition                  code
> 400 field validation               VALIDATION_ERROR
> 404 missing or non-owned resource  <chosen identical code>
> 409 unavailable reference          <chosen code>
> 410 removed attachment             <chosen code>
> 413 oversized file                 <chosen code>
> 415 unsupported file               <chosen code>
> 422 requester context invalid      <chosen code>
> 500 unexpected failure             <chosen code>
>
> The exact names are the student's decision.
>
> For BR-24, missing and non-owned resources must keep the same externally visible 404 shape/code/message if that is the chosen privacy contract.
>
> Also fix the POST /api/tickets 409 summary so it includes both:
>
> nonexistent positive reference
> inactive reference
>
> if both remain 409.
>
> 5. [P1] Attachment safe-storage behavior is still only partially specified
>
> The handout explicitly requires students to define:
>
> safe filename and storage behavior
>
> and fixes this rule:
>
> removed files must not be downloadable or previewed
>
> Issue #15 also explicitly scopes:
>
> secure storage
>
> The current contract now defines:
>
> generated UUID + validated extension
> original filename not used as disk path
> compensation if metadata persistence fails
>
> which is good.
>
> What is still missing is the access/storage boundary.
>
> The specification does not explicitly state whether uploaded files may be exposed through a public/static directory.
>
> If an uploaded file can be fetched directly through something like:
>
> /uploads/<storedFilename>
>
> then a soft-removed attachment could bypass:
>
> GET /api/attachments/:id/download
> GET /api/attachments/:id/preview
>
> and violate the fixed handout rule.
>
> Required fix
>
> Freeze the storage-access invariant.
>
> For example:
>
> Attachment files are not directly/publicly served.
> Preview and download are only available through the requester-owned API endpoints.
> Ownership and isRemoved checks run before file bytes are returned.
>
> The exact storage directory/technology is implementation-owned; the contract only needs to guarantee that direct public access cannot bypass the required lifecycle rules.
>
> 6. [P1] The new Attachment compensation strategy has no planned failure-path evidence
>
> The latest specification now correctly chooses a compensation strategy:
>
> write physical file
> then persist metadata
>
> if metadata persistence fails:
>     delete newly written file
>
> This directly addresses a handout-required Attachment decision.
>
> However, tests.md does not yet contain a scenario proving this new contract.
>
> The handout requires the test plan to cover:
>
> failures
> Attachment lifecycle
>
> and specifically requires the Attachment contract to define its transaction/compensation strategy.
>
> Required fix
>
> Add a planned integration/API failure-path test.
>
> For example:
>
> ATT-PERSIST-01
>
> Given the physical file write succeeds,
> when Attachment metadata persistence fails,
> then the request fails safely,
> no Active Attachment metadata row remains,
> and the newly written physical file is cleaned up.
>
> If the implementation also has a storage-write failure path, document/test the corresponding invariant:
>
> storage write failure -> no Attachment metadata row
>
> The exact test filename is flexible, but it should be an actual planned automated path.
>
> 7. [P1] Direct cross-requester Attachment access is still not explicit in Test-DD
>
> The handout's final evidence explicitly requires proof that direct access to a:
>
> Ticket
> or
> Attachment
>
> belonging to another selected Requester is rejected.
>
> Current tests clearly cover Ticket ownership:
>
> API-TKT-03
> API-MY-01
> E2E-02
>
> Issue #15 also correctly says:
>
> Cross-requester access returns 404 with identical shape.
>
> But the Test-DD matrix does not have an explicit Attachment ownership scenario for:
>
> POST attachment
> GET attachment metadata/list
> GET download
> GET preview
> DELETE attachment
>
> E2E-02 is worded generically around requester/ticket ownership and does not explicitly prove direct non-owned Attachment access.
>
> Required fix
>
> Add one Attachment ownership API matrix/test.
>
> For example:
>
> API-ATT-OWN-01
>
> Requester B attempts operations on Requester A's attachment/ticket:
>
> upload       -> 404
> list         -> 404
> download     -> 404
> preview      -> 404
> soft-remove  -> 404
>
> At minimum, direct download/preview/remove of another Requester's Attachment should be explicit because the handout specifically asks for that evidence.
>
> Also compare the missing-resource and non-owner responses if BR-24 requires them to be externally identical.
>
> 8. [P1] Attachment Test-DD does not yet assert the exact 410 and preview contracts
>
> The API contract and Issue #15 now clearly require:
>
> removed attachment download/preview -> 410 Gone
>
> but API-ATT-05 currently says only:
>
> removed attachments are denied and return error responses
>
> That test could pass with:
>
> 404
> 400
> 409
> 410
>
> even though only 410 matches the current contract.
>
> There is a similar issue with AC-24.
>
> AC-24 requires:
>
> image preview -> image renders
> PDF preview   -> first page renders
>
> but the planned API/E2E wording mostly says:
>
> preview works normally
>
> without explicitly proving the PDF-first-page contract.
>
> Required fix
>
> Tighten the Expected Results.
>
> For example:
>
> active image preview -> 200 image bytes
> active PDF preview   -> 200 rendered first-page image
> removed preview      -> 410
> removed download     -> 410
>
> This makes the test actually prove the status/content behavior it maps to.
>
> 9. [P1/P2] The "max 5 active attachments" rule is not proven after soft removal
>
> The handout fixes the limit as:
>
> maximum active attachments: five per Ticket
>
> The current tests correctly prove:
>
> 5 active -> 6th rejected
>
> but they do not prove that the limit counts active rows rather than all historical Attachment rows.
>
> Because removal is soft, this case matters:
>
> 5 active attachments
> remove 1
> => 4 active + 1 removed
> upload replacement
>
> The replacement should be accepted if the contract truly means "five active".
>
> Required fix
>
> Add one boundary scenario:
>
> 5 active
> soft-remove 1
> upload another valid Attachment
> -> accepted
> -> active count returns to 5
>
> This directly proves the interaction between the two fixed handout rules:
>
> max 5 active
> +
> soft removal
>
> 10. [P2] The newly specified "missing multipart file" validation has no planned test
>
> api-spec.md now explicitly says:
>
> POST /api/tickets/:ticketNumber/attachments
> missing required file part
> -> 400 VALIDATION_ERROR
> -> no metadata or storage created
>
> That closes the API ambiguity, but no Test-DD row currently proves it.
>
> Required fix
>
> Either extend API-ATT-01 or add a small row covering:
>
> multipart request without file
> -> 400
> -> no Attachment row
> -> no stored file
>
> The contract and Test-DD should move together.
>
> 11. [P2] Unavailable Attachment has a visual definition but no state-transition definition
>
> The handout explicitly asks ui-spec.md to define:
>
> active
> uploading
> invalid
> removed
> unavailable
>
> The current UI specification does define how an Unavailable row looks:
>
> metadata stays visible
> Preview/Download disabled
> error label shown
> Retry only when allowed
>
> but it does not define when an Attachment becomes Unavailable.
>
> Possible implementations could interpret it as:
>
> preview request returned 500
> download request returned 500
> stored file missing
> post-create upload failed
> temporary network failure
>
> Those are not the same state.
>
> Required fix
>
> Freeze the trigger and recovery behavior.
>
> For example, explicitly define which API/client condition creates the transient Unavailable presentation and when Retry is available.
>
> Then make UI-DETAIL-01 or a dedicated Attachment UI test prove that state.
>
> The exact trigger is the student's decision; the important point is that the coding agent should not invent it.
>
> 12. [P2] Ticket Detail loading/failure/not-found evidence exists, but the UI behavior is not actually specified
>
> tests.md and the screenshot plan now correctly mention:
>
> Ticket Detail loading
> failure
> not-found
>
> but ui-spec.md Section 5.5 mostly describes the successful View Mode.
>
> It does not state what the user sees for:
>
> initial loading
> 404 missing/non-owned Ticket
> 500/API failure
> manual Retry
> navigation after failure
>
> UI-DETAIL-01 also groups these states into one row without giving precise expected behavior.
>
> Required fix
>
> Add a short Ticket Detail state contract, for example:
>
> Loading:
> - read-only skeleton/panel
>
> 404:
> - safe "Ticket not found" state
> - no leaked ownership information
> - Back to My Tickets action
>
> Unexpected failure:
> - safe error
> - manual Retry
> - no automatic retry
>
> Use whatever UI behavior the student chooses, then align the planned test and screenshot evidence.
>
> 13. [P2] API-MY-08 mixes API normalization with UI Empty/No-Results assertions
>
> API-MY-08 is an API test, but its Expected Result includes:
>
> Empty uses no normalized filters
> No-Results uses normalized active filters
>
> The API does not render either state.
>
> It returns:
>
> data
> pagination
>
> The UI component decides whether to show Empty or No-Results.
>
> This is especially important because Finding #1 shows the Empty/No-Results semantics themselves still need reconciliation.
>
> Required fix
>
> Split responsibility cleanly:
>
> API-MY-08
> -> prove search trimming/blank normalization and returned list metadata
>
> UI-MY-01 / UI-MY-02
> -> prove Empty vs No-Results rendering using the finalized rule
>
> Do not make an API test responsible for a presentation state the API does not return.
>
> 14. [P2] API-MY-06 still uses wording broader than the actual invalid-parameter contract
>
> API-MY-06 says:
>
> invalid values fall back to the safe documented defaults
>
> but not all invalid Ticket-list values do that anymore.
>
> The current contract says:
>
> invalid sort/order/page/pageSize -> fallback/normalized behavior
> malformed categoryId             -> 400
> invalid priority/status          -> 400
> unknown/inactive categoryId      -> 409
>
> API-MY-07 correctly covers the latter group.
>
> Required fix
>
> Narrow API-MY-06 wording to something like:
>
> omitted/defaultable pagination and sort parameters use the documented defaults
>
> and leave filter validation to API-MY-07.
>
> This avoids two Test-DD rows appearing to prescribe different behavior for "invalid values."
>
> 15. [P2] The Results Log does not record the latest completed synchronization task
>
> The latest commit is:
>
> e6b1352
> docs(lab-02): synchronize contract and test evidence
>
> and modifies:
>
> ai-use.md
> api-spec.md
> reviewer.md
> specification.md
> tests.md
> ui-spec.md
>
> However, the newest Results Log entry is still:
>
> 2026-08-23 - Lab 2 decision-free agent contract tightening
>
> There is no new entry recording the current full synchronization pass.
>
> agent.md explicitly requires:
>
> After each completed task, insert the newest result entry at the top
>
> Required fix
>
> Add a newest-first Results Log entry for this completed review-fix task with:
>
> scope
> planned tests/docs changed
> commands run
> pass/fail/skipped counts
> follow-up
>
> This is course/process evidence, so the log should reflect the actual latest completed task.
>
> 16. [P2] agent.md branch example still does not match the actual PR branch
>
> The live PR source branch is:
>
> doc/lab-02/requirement_and_agent
>
> but agent.md currently lists the documentation branch example as:
>
> doc/requirement_and_agent
>
> The branch/worktree policy is part of Issue #11's acceptance criteria.
>
> Suggested fix
>
> Use the actual branch convention:
>
> doc/lab-02/requirement_and_agent
>
> or clearly label the branch list as non-normative examples.
>
> This is small, but the process contract should not disagree with the branch it is currently documenting.
>
> Resolved Since the Previous Review
>
> The latest synchronization pass correctly resolves many earlier findings:
>
> - suffixed BR identifiers such as BR-17-MULTI-ATTACH were removed;
>
> - page missing/malformed/non-positive behavior is now consistent across the main API/spec rules;
>
> - raw-query vs normalized-search semantics were corrected in api-spec.md;
>
> - negative/zero Create reference IDs are now fixed to 400;
>
> - multi-file orchestration was moved from the API test layer to UI evidence;
>
> - valid + invalid pre-submit Attachment behavior is now explicit;
>
> - inherited requester/ownership/unexpected API error behavior was added;
>
> - Requester Selection tests now include selected name, Change Requester, keyboard flow, and header injection;
>
> - screenshot paths now include invalid Attachment, My Tickets loading/failure, and Ticket Detail loading/failure;
>
> - Attachment persistence compensation is now explicitly designed;
>
> - safe seed preservation wording was corrected;
>
> - API-TKT-04 no longer invents a client requesterId request field;
>
> - database index decisions now discuss the required My Tickets workload;
>
> - the undefined Profile menu was removed;
>
> - Issue #13 now says unit/API/integration tests;
>
> - Issue #18 now separates pre-merge release readiness from post-merge final-main evidence;
>
> - Issue #11 now names Issue #18 explicitly;
>
> - reviewer.md correctly says current Copilot review threads are resolved;
>
> - Attachment list ordering wording no longer incorrectly refers to pagination.
>
> Handout Alignment Status
>
> The contract is now strong on:
>
> Development Requester testing context
> Create Ticket fields/validation
> backend-generated Ticket Number
> ownership
> search/filter/sort/pagination
> Empty / No-Results intent
> Attachment fixed size/type/count rules
> soft removal
> safe generated filenames
> multi-file partial success
> migration preservation
> idempotent seed data
> Zen Green states/responsive behavior
> required Test-DD test-file paths
> responsive/visual/E2E planning
> GitHub Issue decomposition
> staged release flow
> final-main evidence ownership
>
> The remaining gaps are concentrated around:
>
> unique BR traceability
> exact Empty/No-Results semantics
> complete BR evidence
> exact API error codes
> Attachment storage/lifecycle failure evidence
> direct Attachment ownership evidence
> precise Attachment status/preview assertions
> a few remaining UI-state/test-layer details
> process evidence logging
>
> Final Verdict
>
> Request Changes — close to approval
>
> I would treat these as the remaining approval blockers:
>
> - merge the duplicate/conflicting BR-23 into one canonical rule;
>
> - make the Test-DD genuinely prove all BRs, especially BR-02 and backend BR-10;
>
> - freeze the error.code contract instead of leaving it to implementation;
>
> - complete safe Attachment storage + compensation evidence;
>
> - add direct cross-requester Attachment tests and exact 410 / preview assertions.
>
> The other P2 findings should be cleaned in the same pass so the next review does not uncover another round of small contract/test mismatches.
>
> After these are synchronized, the baseline should be very close to approval for implementation.

#### My review comment 9 — Changes requested

> PR #16 Re-Review — Current Contract Synchronization Pass
>
> Verdict
>
> Request Changes — very close to approval
>
> Reviewed current PR head:
>
> a3a033e8558ab795885a2913ba16531101914791
>
> against:
>
> - Issue #11
>
> - downstream Issues #12–#15
>
> - Issue #18
>
> - the current PR documents
>
> - the repository's existing Lab 1 baseline where compatibility matters
>
> - the official Lab 2 handout
>
> This review intentionally uses only this repository, its own Issues, and the Lab 2 handout. No design or contract from another project is being applied here.
>
> Per reviewer instruction, the number of prompts in docs/lab-02/ai-use.md is not treated as a finding.
>
> The latest two commits make a substantial improvement. Most of the previous blockers are now resolved, including the BR-23 collision, Ticket Number sequencing, canonical API error codes, Attachment persistence compensation, direct Attachment ownership evidence, exact 410 behavior, and the missing Test-DD scenarios.
>
> The remaining work is mostly a synchronization pass, not a redesign.
>
> 1. [P1] Issue #14 is now stale against the new BR-30 Empty / No-Results contract
>
> The current specification now separates the concerns correctly:
>
> BR-23
> Search/filter normalization and query behavior
>
> BR-30
> Empty vs No-Results presentation using unfilteredTotalItems
>
> The canonical rule is now:
>
> unfilteredTotalItems = 0
> -> Empty
> -> even if a normalized filter/search is active
>
> unfilteredTotalItems > 0
> and filtered totalItems = 0
> -> No-Results
>
> However, Issue #14 still says:
>
> Distinct Empty state ... vs No-Results ... (BR-23)
>
> and its BR mapping still contains:
>
> BR-14, BR-22, BR-23, BR-24, BR-29
>
> without BR-30.
>
> More importantly, its acceptance criteria still say:
>
> Empty state renders when requester has zero tickets
> and no normalized active filters/search
>
> That now conflicts with AC-21 / BR-30, where a Requester with zero ticket history must still see Empty even when a filter is present.
>
> Recommended fix
>
> Update Issue #14 so that:
>
> BR-23 -> search/filter normalization
> BR-30 -> Empty / No-Results state selection
>
> and freeze the same rule used by the specification:
>
> Empty:
> unfilteredTotalItems = 0
>
> No-Results:
> unfilteredTotalItems > 0
> and totalItems = 0
>
> This should be fixed before Issue #14 becomes an implementation prompt, otherwise the Issue and the authoritative specification give different instructions.
>
> 2. [P1] Issue #15 does not yet own the newly added BR-31
>
> The latest specification adds a useful new rule:
>
> BR-31
> Attachment persistence compensation
> +
> Attachment files are not publicly/staticly served
> +
> Download/Preview re-check ownership and isRemoved
>
> The Test-DD plan also now contains:
>
> ATT-PERSIST-01
> server/tests/lab-02/attachment-persistence-compensation.integration.test.ts
>
> This directly addresses the handout requirement to define the Attachment transaction/compensation strategy and safe storage behavior.
>
> However, Issue #15 — the Attachment implementation owner — currently maps:
>
> BR-12
> BR-13
> BR-17
> BR-26
> BR-27
> BR-18
> BR-19
> BR-20
> BR-28
> BR-24
>
> and does not include BR-31.
>
> Its acceptance criteria also do not explicitly mention the newly frozen persistence/access invariant.
>
> Recommended fix
>
> Add:
>
> BR-31
>
> to Issue #15 and include acceptance/evidence for:
>
> metadata persistence failure
> -> newly written physical file is cleaned up
> -> no active Attachment row remains
>
> uploaded files are not exposed through a public/static file route
>
> download/preview bytes are available only through the owned Attachment API path
>
> This does not require changing the chosen storage design; it only makes the Issue match the contract that is already written.
>
> 3. [P1/P2] Issue #18 still stops its Business Rule coverage at BR-29
>
> Issue #18 currently says:
>
> BR-01..BR-29
>
> but the current specification now has:
>
> BR-30
> BR-31
>
> Both are important cross-feature release behaviors:
>
> BR-30 -> Empty / No-Results correctness
> BR-31 -> Attachment persistence/access invariant
>
> Because Issue #18 owns final regression and contract alignment, its current requirement range silently excludes the two newest rules.
>
> Recommended fix
>
> Update the final integration mapping to:
>
> BR-01..BR-31
>
> or list the active rules explicitly.
>
> Also make sure the final regression evidence includes the already-planned tests for BR-30 and BR-31.
>
> 4. [P1] api-spec.md still gives two different rules for duplicate query parameters
>
> The global request parsing section says integer values accept the decimal grammar with no:
>
> duplicate query/header value
>
> but the same section later says:
>
> Duplicate query parameters use the first occurrence only.
>
> tests.md also explicitly freezes:
>
> Duplicate query parameters use the first occurrence.
>
> Those are two different parser contracts.
>
> For example:
>
> ?page=1&page=2
> ?categoryId=1&categoryId=2
>
> cannot simultaneously be:
>
> invalid because duplicate
>
> and:
>
> valid, use the first occurrence
>
> Recommended fix
>
> Separate header and query behavior explicitly.
>
> For example, if the current Test-DD decision is intended:
>
> duplicate X-Dev-Requester-Id header
> -> 422 REQUESTER_CONTEXT_INVALID
>
> duplicate query parameter
> -> use the first occurrence
>
> then state exactly that and remove the phrase implying duplicate query values are invalid.
>
> The exact policy is the student's choice; the important part is that the closed API contract has only one answer.
>
> 5. [P1] The Download Content-Disposition contract contradicts the global safe-filename rule
>
> The global Attachment filename contract now correctly says downloads use:
>
> sanitized ASCII filename fallback
> +
> RFC 5987 UTF-8 filename*
>
> This is also consistent with the safe-filename test plan.
>
> However, Section 9 still says:
>
> Content-Disposition: attachment; filename="<originalFilename>"
>
> These are not equivalent contracts, especially for:
>
> Unicode filenames
> quotes
> control characters
> path separators
>
> Recommended fix
>
> Make the endpoint response section use the same canonical header rule.
>
> For example, describe it conceptually as:
>
> Content-Disposition:
> attachment;
> filename="<sanitized ASCII fallback>";
> filename*=UTF-8''<encoded original display filename>
>
> No new product behavior is needed — this is only aligning the endpoint section with the safe rule already chosen earlier in the same document.
>
> 6. [P1/P2] fields behavior is ambiguous for the special 400 ATTACHMENT_LIMIT_REACHED error
>
> The API contract first says:
>
> fields is present only for 400 validation errors
> and omitted otherwise
>
> but then says:
>
> fields ... is required for every 400 response
>
> The canonical code table contains two kinds of HTTP 400:
>
> 400 VALIDATION_ERROR
> 400 ATTACHMENT_LIMIT_REACHED
>
> That leaves this response undefined:
>
> HTTP 400
> error.code = ATTACHMENT_LIMIT_REACHED
>
> Does error.fields exist?
>
> Recommended fix
>
> Freeze one rule.
>
> A clean option would be:
>
> 400 VALIDATION_ERROR
> -> fields required
>
> 400 ATTACHMENT_LIMIT_REACHED
> -> fields omitted
>
> or explicitly define a fields.file entry if that is preferred.
>
> Then make API-CONTRACT-01 use the exact same rule.
>
> 7. [P2] A few Test-DD mappings still need cleanup after introducing BR-30
>
> The Test-DD matrix is much stronger now, but a few rows still carry old or overly broad mappings.
>
> API-MY-03
>
> This row tests:
>
> Category / Priority / Status filters are conjunctive
>
> but maps:
>
> BR-22
>
> BR-22 is primarily pagination/default behavior.
>
> The actual filter behavior is now under:
>
> BR-23
>
> API-MY-06
>
> This row tests:
>
> page/pageSize/sort/order defaults and fallback
>
> but maps:
>
> FR-05, FR-06, FR-07, FR-08
> AC-17, AC-18, AC-19, AC-20
>
> Search and filtering (FR-05, FR-06, AC-17, AC-18) are not what this row proves.
>
> A tighter mapping would focus on:
>
> FR-07
> FR-08
> BR-22
> AC-19
> AC-20
>
> UI-MY-02
>
> It currently says:
>
> Filters/search with zero matches show No-Results
>
> That wording is now too broad.
>
> Under BR-30, the expected result is No-Results only when:
>
> unfilteredTotalItems > 0
>
> If the Requester has zero ticket history, an active filter still produces Empty, not No-Results.
>
> UI-MY-01
>
> Because AC-21 now explicitly says Empty still applies with an active filter, it would be stronger to state that case directly in the UI test:
>
> unfilteredTotalItems = 0
> with or without an active filter
> -> Empty
>
> Recommended fix
>
> Do one small traceability cleanup so that each row proves exactly the FR/BR/AC identifiers attached to it.
>
> No additional product rules are required.
>
> 8. [P2] Issue #11 still uses an AC range that includes retired AC-16
>
> Issue #11 currently says:
>
> Supports AC-01..AC-27
>
> but the current specification and Test-DD explicitly retire:
>
> AC-16
>
> The active set is effectively:
>
> AC-01..AC-15
> AC-17..AC-27
>
> Recommended fix
>
> Update the Issue #11 mapping to use the active AC set explicitly.
>
> While touching the Issue, it would also be slightly clearer to describe the downstream decomposition as:
>
> #12–#15 feature implementation
> #18 final integration/release verification
>
> because #18 now exists and is already listed later in the Issue.
>
> 9. [P2] One Ticket Number test note still says "current calendar year" instead of "current UTC calendar year"
>
> The current BR-01 and API contract correctly freeze the Ticket Number year to:
>
> UTC calendar year
>
> The Test-DD detail section still contains wording equivalent to:
>
> Year in format must match the current calendar year
>
> and later also mentions a frozen UTC boundary.
>
> That wording is harmless most of the year but becomes ambiguous around a local/UTC year boundary.
>
> Recommended fix
>
> Use:
>
> current UTC calendar year
>
> everywhere the test rule is described.
>
> What Is Now in Good Shape
>
> The latest revision resolves the major issues from the previous review well.
>
> In particular:
>
> - BR-23 is no longer duplicated.
>
> - Empty / No-Results now has a reliable unfilteredTotalItems design.
>
> - BR-30 gives the UI-state rule a unique identifier.
>
> - Ticket Number first-sequence, increment, UTC rollover, concurrency, and exhaustion behavior are frozen.
>
> - BR-02 now has an explicit currentStatus === NEW planned assertion.
>
> - Backend Requested Priority validation is directly planned.
>
> - BR-25 now has an explicit static/scope evidence row.
>
> - API error codes are largely frozen rather than left to implementation.
>
> - Attachment files are explicitly not served through a public/static route.
>
> - BR-31 defines Attachment persistence compensation.
>
> - ATT-PERSIST-01 directly tests metadata-persistence cleanup.
>
> - Cross-requester Attachment upload/list/download/preview/remove is explicitly planned.
>
> - Removed Attachment preview/download now require exact 410 ATTACHMENT_REMOVED.
>
> - Image and PDF-first-page preview behavior is explicitly planned.
>
> - The active-Attachment count after soft removal is tested.
>
> - Missing multipart file is explicitly covered.
>
> - Unavailable Attachment trigger/recovery behavior is now defined.
>
> - Ticket Detail loading / 404 / unexpected-failure states are now frozen.
>
> - API vs UI responsibility for Empty / No-Results evidence is separated.
>
> - The Results Log contains the latest synchronization task.
>
> - agent.md now shows the actual documentation branch in use.
>
> - All previous Copilot inline review threads are resolved.
>
> - The PR remains entirely within documentation/governance scope.
>
> Handout Alignment
>
> The current contract is now strong against the official Lab 2 handout in the areas of:
>
> Development Requester testing context
> Create Ticket required information
> numbered FR / BR / AC
> Ticket defaults and generated values
> validation and normalization
> search / filter / sort / pagination
> Requester ownership
> Attachment type / size / active-count limits
> soft removal
> safe storage naming
> Attachment compensation strategy
> multi-file partial success
> migration preservation
> idempotent seed behavior
> Zen Green UI
> loading / empty / no-results / failure states
> responsive and accessibility rules
> UI Style / Visual / E2E Test-DD coverage
> actual planned test-file paths
> feature branches -> lab2-staging -> release PR
> final-main verification ownership
>
> The remaining findings are primarily cross-document synchronization introduced by the newest contract additions.
>
> Final Recommendation
>
> Request Changes — one synchronized cleanup pass away from approval
>
> I would treat these as the remaining approval blockers:
>
> - synchronize Issues #14, #15, and #18 with BR-30 / BR-31;
>
> - remove the duplicate-query parser contradiction in api-spec.md;
>
> - make the Download Content-Disposition section match the canonical safe-filename rule;
>
> - freeze fields behavior for 400 ATTACHMENT_LIMIT_REACHED;
>
> - align the remaining My Tickets Test-DD rows with the finalized BR-30 semantics.
>
> The other P2 items are small traceability wording cleanups and can be fixed in the same pass.
>
> The core Lab 2 design no longer needs another redesign; the documents are now close enough that the next revision should mainly be about making every Issue/API/test statement point to the same frozen behavior.

#### My review comment 10 — Changes requested

> PR #16 Re-Review — Lab 2 Requirement Baseline / Final Traceability Pass
>
> Verdict
>
> Request Changes — very close to approval
>
> Reviewed current PR head:
>
> 572ec3f33fd023fb1594f59c3d4aa1209927ba65
>
> against:
>
> - Issue #11
>
> - downstream Issues #12–#15
>
> - Issue #18
>
> - the current PR documents
>
> - the repository's existing Lab 1 baseline where compatibility matters
>
> - the official Lab_02_labsheet.pdf
>
> This review intentionally uses only this repository, its own Issues, and the official Lab 2 handout. No design or contract from another project is applied here.
>
> Per reviewer instruction, the number of entries in docs/lab-02/ai-use.md is not treated as a finding.
>
> The latest revision has resolved the major blockers from the previous review rounds. The remaining items are small synchronization/traceability fixes; I do not think the core Lab 2 design needs another redesign.
>
> What is now aligned well
>
> A lot of the earlier contract drift is now fixed correctly:
>
> - PR #16 remains documentation/governance-only and targets lab2-staging.
>
> - README.md clearly separates the currently implemented Lab 1 baseline from the Lab 2 target.
>
> - agent.md now has one consistent explicit approval model for stage/commit/push and contains:
>
> - FR/BR/AC mapping;
>
> - test-first discipline;
>
> - newest-first Test-DD logging;
>
> - AI-use logging;
>
> - commit-by-function guidance;
>
> - branch/worktree rules;
>
> - PR/Kanban approval gates.
>
> - docs/lab-02/ai-use.md uses the Lab 2 filename and follows the expected AI-use/reflection structure.
>
> - Issue #11 now correctly delegates final integration/release verification to Issue #18 instead of making the docs-only baseline wait for the entire implementation.
>
> - Issue #14 now owns BR-30 and uses unfilteredTotalItems for Empty vs No-Results.
>
> - Issue #15 now owns BR-31, including Attachment persistence compensation and the non-public storage-access boundary.
>
> - Issue #18 now covers BR-01..BR-31 and separates pre-merge release readiness from post-merge final-main evidence.
>
> - Ticket Number behavior is frozen, including the UTC-year sequence semantics and concurrency/exhaustion behavior.
>
> - Create Ticket normalization and reference validation are explicit.
>
> - API error codes are canonical rather than implementation-defined.
>
> - Duplicate requester-header vs duplicate query-parameter behavior is now separated consistently.
>
> - Download Content-Disposition now matches the safe filename contract.
>
> - All 400 errors now have a defined fields rule, including ATTACHMENT_LIMIT_REACHED.
>
> - Attachment constraints match the handout:
>
> - JPG/JPEG/PNG/WEBP/PDF;
>
> - MAX_ATTACHMENT_BYTES = 5,000,000;
>
> - maximum five active Attachments;
>
> - soft removal;
>
> - removed files cannot be previewed/downloaded.
>
> - Attachment persistence compensation, safe generated names, ownership checks, no public/static serving, exact 410, PDF-first-page preview, and active-count-after-soft-removal behavior all have planned evidence.
>
> - The migration contract is explicitly forward-only from Lab 1, preserves existing Category values including createdAt, and keeps seed behavior idempotent.
>
> - Requester Selection, Create Ticket, My Tickets, Ticket Detail, UI Style, responsive, visual, keyboard, and E2E coverage all have concrete planned test paths.
>
> - Existing Copilot inline review threads are resolved.
>
> These are substantial improvements.
>
> Remaining Findings
>
> 1. [P1] The My Tickets UI Test-DD rows still do not encode the finalized BR-30 edge case precisely
>
> The specification, UI spec, Issue #14, and ACs now agree on the canonical rule:
>
> unfilteredTotalItems = 0
> -> Empty
> -> even when a normalized filter/search is active
>
> unfilteredTotalItems > 0
> and totalItems = 0
> -> No-Results
>
> API-MY-08 is now correctly limited to API metadata and explicitly checks the important values.
>
> However, the two UI rows that are supposed to prove the presentation behavior still say:
>
> UI-MY-01
> Empty state shown for requester with zero tickets ever
> -> requester with no tickets sees Empty
>
> UI-MY-02
> No-results state shown for active filters yielding zero rows
> -> filters/search with zero matches show No-Results
>
> The second wording is still too broad.
>
> This case is the important boundary:
>
> Requester has zero tickets ever
> +
> an active normalized filter/search
>
> Under BR-30 / AC-21, this must still be:
>
> Empty
>
> not No-Results.
>
> Recommended fix
>
> Make the rows directly prove the finalized rule.
>
> Suggested wording:
>
> UI-MY-01
> Given unfilteredTotalItems = 0, with or without an active normalized
> search/filter, render Empty with the Create Ticket CTA.
>
> UI-MY-02
> Given unfilteredTotalItems > 0 and totalItems = 0 after normalized
> search/filtering, render No-Results with the Clear Filters CTA.
>
> This is important because tests.md is the Test-DD implementation contract. The test row itself should not allow a future implementer to infer the older “active filter always means No-Results” behavior.
>
> 2. [P2] A few My Tickets traceability mappings are still stale/over-broad
>
> The behavior is mostly correct now, but several FR/BR/AC mappings no longer describe exactly what their test row proves.
>
> API-MY-03
>
> Current behavior:
>
> Category/Priority/Status filters are conjunctive
>
> but it maps to:
>
> BR-22
>
> BR-22 is the pagination/default/fallback rule.
>
> The conjunctive search/filter behavior belongs under:
>
> BR-23
>
> API-MY-06
>
> This row proves:
>
> page/pageSize defaults
> sort/order defaults
> fallback for invalid page/pageSize/sort/order
>
> but currently maps broadly to:
>
> FR-05, FR-06, FR-07, FR-08
> AC-17, AC-18, AC-19, AC-20
>
> It does not prove search or filtering.
>
> A tighter mapping would be:
>
> FR-07, FR-08
> BR-22
> AC-19, AC-20
>
> API-MY-07
>
> This row covers invalid filter values and pagination behavior, but currently includes:
>
> FR-05
>
> even though it does not test search behavior.
>
> It would be cleaner to keep the mapping to the behaviors it actually proves, such as:
>
> FR-06, FR-08
> BR-22, BR-23
>
> No new product behavior is needed here — this is only a Test-DD traceability cleanup.
>
> 3. [P2] Issue #11 still includes retired AC-16 in its meta-level AC range
>
> The active specification explicitly says:
>
> AC-01..AC-27, excluding retired AC-16
>
> and tests.md contains an explicit AC Retirement Note for AC-16.
>
> Issue #11, however, still says:
>
> Supports AC-01..AC-27
>
> That technically brings AC-16 back into the baseline Issue's requirement mapping.
>
> This is small, but Issue #11 is specifically the traceability/governance baseline, so its own requirement range should match the authoritative contract.
>
> Recommended fix
>
> Change the mapping to something explicit, for example:
>
> Supports AC-01..AC-15 and AC-17..AC-27
> (AC-16 is retired by the approved Lab 2 contract)
>
> or:
>
> Supports all active ACs; AC-16 is retired.
>
> Acceptance-Criteria Cross-Check for Issue #11
>
> Issue #11 acceptance criterion
>
> Review status
>
> README.md reflects Lab 2 target and current implementation gap
>
> Pass
>
> tests.md aligns to repo tooling and has newest-first Results Log
>
> Pass, with the My Tickets traceability cleanup above
>
> agent.md defines approval, FR/BR/AC mapping, logging, commit strategy, branch/worktree, PR/Kanban, commit/push approval
>
> Pass
>
> docs/lab-02/ai-use.md initialized and maintained in Lab 1-compatible format
>
> Pass
>
> Issues #12–#15 exist with explicit FR/BR/AC criteria
>
> Pass
>
> Migration, seed, UI/API boundary, and traceability decisions are frozen
>
> Substantially Pass; remaining Test-DD mapping cleanup noted above
>
> Documentation/governance only; no functional implementation in this PR
>
> Pass
>
> Final release verification delegated to #18
>
> Pass
>
> Official Lab 2 Handout Alignment
>
> I also cross-checked the current baseline against the official Lab 2 handout.
>
> The current documents now align well with the handout on:
>
> Development Requester as a testing identity, not authentication
> Create Ticket required fields
> backend-generated unique Ticket Number
> Requester ownership
> search / filter / sort / pagination
> empty and no-results states
> Attachment type / size / count fixed rules
> soft removal
> blocked removed preview/download
> Attachment metadata and safe storage decisions
> transaction / compensation strategy
> PostgreSQL data relationships
> forward migration decisions
> idempotent seed requirements
> Zen Green UI
> loading / empty / failure states
> keyboard accessibility
> desktop / tablet / mobile responsive evidence
> Test-DD planned-test table
> actual automated test-file paths
> Unit / API-Integration / UI Component / UI Style / Responsive / E2E coverage
> feature branch -> lab2-staging -> main release flow
> Product Definition of Done
> course-delivery/reviewer evidence ownership
>
> The handout explicitly expects the engineering contract to resolve ambiguous behavior before implementation and requires every AC to map to planned evidence. That is why the remaining My Tickets Test-DD wording/mapping is worth cleaning now even though the product rule itself is already correct.
>
> Final Recommendation
>
> Request Changes — very close to approval
>
> I would ask for one final small synchronization pass:
>
> - make UI-MY-01 / UI-MY-02 explicitly prove the exact BR-30 unfilteredTotalItems semantics;
>
> - clean the stale API-MY-03, API-MY-06, and API-MY-07 FR/BR/AC mappings;
>
> - update Issue #11 so its AC range does not include retired AC-16.
>
> After those are corrected, I would be comfortable treating the Lab 2 requirement/governance baseline as ready for approval and implementation.
>
> The remaining work is traceability cleanup, not another redesign. The core specification/API/UI/Attachment/migration decisions are now in a strong and internally consistent state.

#### My review comment 11 — Approved

> Approved. The Lab 2 documentation/governance baseline is now sufficiently aligned across the specification, API/UI contracts, Test-DD plan, downstream issue structure, and official Lab 2 handout to proceed with implementation. Nice work resolving the review rounds and tightening the contract consistency.

#### Partner's response

> Please be kind to me, all criteria in the lab-02 file is already passed several hour ago.

### PR #21 — Feature/lab2 requester selection

#### My review comment 1 — Changes requested

> PR #21 Review — Request Changes
>
> Reviewed PR: "#21 Feature/lab2 requester selection"
>
> Reviewed head:
>
> 6047700
>
> Baseline used for this review:
>
> - Issue #12 requirements
>
> - "docs/lab-02/specification.md"
>
> - "docs/lab-02/api-spec.md"
>
> - "docs/lab-02/ui-spec.md"
>
> - "docs/lab-02/tests.md"
>
> - Issue #11 process/governance baseline
>
> This review does not introduce external design decisions. It evaluates the PR against the Lab 2 contract already defined in this repository.
>
> Verdict
>
> Request Changes
>
> The main requester-selection flow is substantially implemented, but the PR currently claims more automated-test coverage than the executable tests actually prove.
>
> There are also required test paths and cross-feature tests from Issue #12 that are still missing.
>
> P1 — Restore the exact API test paths required by Issue #12
>
> Issue #12 explicitly requires these files:
>
> server/tests/lab-02/dev-requesters.api.test.ts
>
> server/tests/lab-02/requester-context.api.test.ts
>
> The PR does not contain either file.
>
> Instead, it changes "docs/lab-02/tests.md" so that:
>
> API-REQ-01
>
> API-REQ-02
>
> API-REQ-03
>
> now point to:
>
> server/tests/lab-02/api-contract.api.test.ts
>
> This changes the frozen test contract to match the implementation rather than implementing the exact planned paths required by the issue.
>
> Issue #12 explicitly states:
>
> Use the exact planned paths and IDs from docs/lab-02/tests.md.
>
> and its acceptance criteria require the listed tests to:
>
> exist at the specified paths and pass
>
> Required change
>
> Restore the planned mappings and add:
>
> server/tests/lab-02/dev-requesters.api.test.ts
>
> server/tests/lab-02/requester-context.api.test.ts
>
> with the required test IDs.
>
> "api-contract.api.test.ts" may remain for "API-CONTRACT-01", but it should not replace the explicitly required requester test files.
>
> P1 — "API-CONTRACT-01" is marked Passed without covering its required matrix
>
> "server/tests/lab-02/api-contract.api.test.ts" currently covers useful requester-context cases, including:
>
> missing requester header
>
> abc
>
> 1.0
>
> +1
>
> whitespace-padded values
>
> duplicate requester headers
>
> unknown/inactive requester
>
> safe requester lookup 500
>
> bootstrap endpoints
>
> However, "API-CONTRACT-01" requires substantially more:
>
> duplicate requester headers
>
> malformed route IDs
>
> malformed ticket numbers
>
> malformed JSON
>
> null JSON body
>
> array JSON body
>
> scalar JSON body
>
> wrong Content-Type
>
> duplicate query parameters
>
> safe 500 responses
>
> canonical error object
>
> The current test file does not exercise most of that matrix.
>
> In particular, it does not test:
>
> malformed route IDs
>
> malformed ticket numbers
>
> malformed JSON
>
> null/array/scalar JSON bodies
>
> wrong Content-Type
>
> duplicate query parameters
>
> Despite that, "docs/lab-02/tests.md" changes:
>
> API-CONTRACT-01
>
> from:
>
> Planned
>
> to:
>
> Passed
>
> The test-plan definition says "Passed" means executable evidence exists and passed; it must not be inferred from partial implementation.
>
> Required change
>
> Either:
>
> - implement the complete "API-CONTRACT-01" matrix before marking it "Passed", or
>
> - leave the evidence status as "Implemented" / "Planned" until all required endpoint classes exist and the complete matrix can be executed.
>
> P1 — "API-REQ-02" is marked Passed without proving historical inactive-requester ticket behavior
>
> "API-REQ-02" requires two different guarantees:
>
> - Invalid requester contexts return 422 REQUESTER_CONTEXT_INVALID.
>
> - Historical tickets owned by an inactive requester remain persisted but cannot be reached through requester-facing flows.
>
> The PR currently proves the first part.
>
> For example, "api-contract.api.test.ts" mocks:
>
> service.isActiveDevRequester.mockResolvedValue(false)
>
> and verifies a "422".
>
> But there is no executable test that:
>
> creates/preserves a ticket for a requester
>
> makes that requester inactive
>
> verifies the ticket still exists in the database
>
> tries to access the historical ticket through a requester-facing endpoint
>
> verifies it is unreachable
>
> The current schema in this PR also does not contain the Ticket persistence model needed to prove the historical-record part.
>
> Therefore:
>
> API-REQ-02 = Passed
>
> currently overstates the available evidence.
>
> Required change
>
> Do not mark "API-REQ-02" as "Passed" until the historical persistence and requester-flow unreachability portion is executable and tested.
>
> If that portion depends on a downstream Ticket issue, keep the evidence status accurate rather than treating the reusable requester middleware alone as the complete test.
>
> P1 — "UI-MY-03" does not test My Tickets data but is marked Passed
>
> The new test file:
>
> client/src/lab-02-tests/MyTickets.test.tsx
>
> contains a test named:
>
> clears prior requester data and reloads from new requester scope
>
> However, the test does not load any tickets.
>
> The flow currently proves roughly:
>
> select Ada
>
> Continue
>
> see Ada Lovelace
>
> Change Requester
>
> select Alan
>
> Continue
>
> see Alan Turing
>
> fetchDevRequesters was called twice
>
> There is no:
>
> fetchMyTickets
>
> old requester ticket row
>
> new requester ticket row
>
> requester-scoped ticket request
>
> old list clearing
>
> new My Tickets reload
>
> "UI-MY-03" is specifically defined as:
>
> Switching Requester clears the previous list and reloads the current Requester's tickets.
>
> "BR-14" likewise requires:
>
> clear cached ticket state
>
> reload My Tickets from scratch
>
> Reloading the requester selector list is not evidence that requester-scoped ticket state was cleared.
>
> Required change
>
> "UI-MY-03" should remain "Planned" until My Tickets exists, or the test should use actual requester-scoped ticket data and prove that:
>
> Requester A ticket data is visible
>
> Change Requester occurs
>
> Requester A data is removed
>
> Requester B My Tickets request is sent with the new requester context
>
> Requester B ticket data is loaded from scratch
>
> P1 — Required "E2E-05" is missing
>
> Issue #12 explicitly includes:
>
> E2E-05
>
> for the following flow:
>
> keyboard-only requester selection
>
> Continue
>
> Change Requester
>
> create-ticket flow
>
> visible focus
>
> There are no changed files under the planned Lab 2 E2E area implementing this test.
>
> The unit test in:
>
> RequesterSelection.test.tsx
>
> does not replace the required E2E coverage.
>
> For example, it currently does:
>
> fireEvent.keyDown(continueButton, { key: "Enter" });
>
> fireEvent.click(continueButton);
>
> Because an explicit click immediately follows the key event, this does not prove that keyboard activation itself caused the transition.
>
> It also does not execute the required Create Ticket flow.
>
> The CSS implementation does include useful focus styling:
>
> button:focus-visible,
>
> select:focus-visible,
>
> a:focus-visible
>
> but the required acceptance gate asks for executable keyboard/focus coverage, not styling alone.
>
> Required change
>
> Add the planned "E2E-05" test when the required Create Ticket flow is available.
>
> If Create Ticket is a downstream dependency and cannot yet be exercised, keep the issue/evidence status incomplete instead of claiming all required cross-feature tests pass.
>
> P1 — "API-REQ-03" is marked Passed without covering "GET /api/related-systems"
>
> Issue #12 requires bootstrap/reference endpoints such as:
>
> GET /api/dev-requesters
>
> GET /api/categories
>
> GET /api/related-systems
>
> to work without:
>
> X-Dev-Requester-Id
>
> The current router contains:
>
> GET /api/categories
>
> GET /api/dev-requesters
>
> GET /api/requester-context
>
> but not:
>
> GET /api/related-systems
>
> The "API-REQ-03" test also verifies only:
>
> /api/dev-requesters
>
> /api/categories
>
> Despite that, the matrix marks:
>
> API-REQ-03 = Passed
>
> Required change
>
> Ensure the Lab 2 reference-data contract is represented and verify that "GET /api/related-systems" also works without requester context.
>
> If that endpoint belongs to a downstream dependency and is not implemented yet, do not mark the complete "API-REQ-03" row as Passed.
>
> P2 — Removing the existing Lab 1 health behavior appears unrelated to Issue #12
>
> This PR removes the existing health functionality, including:
>
> GET /api/health
>
> checkHealth()
>
> server/tests/health.test.ts
>
> server/tests/health.integration.test.ts
>
> client health-check behavior/tests
>
> The result log describes this as cleanup of an:
>
> obsolete /api/health endpoint
>
> However, Issue #12 is specifically about Development Requester selection and requester-context switching.
>
> The issue does not instruct this PR to retire the existing Lab 1 health endpoint.
>
> Removing an existing API and its regression tests is therefore broader than the stated requester-selection scope unless another approved Lab 2 contract explicitly retires that behavior.
>
> Required change
>
> Restore the existing health endpoint and its regression coverage unless there is a frozen Lab 2 requirement or separately approved issue that explicitly removes it.
>
> Requester-selection work should not silently redefine unrelated existing behavior.
>
> What is already working well
>
> The core requester-selection implementation has several correct pieces and should be preserved.
>
> Active requester bootstrap
>
> The service filters requesters using:
>
> where: { isActive: true }
>
> and returns a stable requester list.
>
> Testing-only identity wording
>
> The selector explicitly states:
>
> For Lab 2 testing only, not a login screen.
>
> which correctly avoids presenting the mechanism as authentication.
>
> Selector states
>
> The implementation contains:
>
> loading
>
> empty
>
> error
>
> ready
>
> and includes a manual Retry action rather than automatic retry.
>
> Continue behavior
>
> Continue is disabled until the selected ID belongs to the current active requester list.
>
> Session storage
>
> The selected ID is stored through:
>
> sessionStorage
>
> using a dedicated storage key.
>
> Header construction
>
> Requester context is explicitly sent as:
>
> X-Dev-Requester-Id
>
> Requester header parsing
>
> The server correctly rejects formats including:
>
> abc
>
> 1.0
>
> +1
>
> whitespace-padded values
>
> duplicate values
>
> unknown requester IDs
>
> inactive requester IDs
>
> with:
>
> 422 REQUESTER_CONTEXT_INVALID
>
> Stale stored context
>
> When a stored requester no longer appears in the active list, the implementation clears the stored ID and displays an explanatory message.
>
> Application shell
>
> The selected requester name is shown and an operable:
>
> Change Requester
>
> action is present.
>
> Focus styling
>
> The CSS contains visible ":focus-visible" styling for interactive controls.
>
> Required changes before approval
>
> The requester-selection implementation itself is close, but the evidence contract needs another pass.
>
> Before approval:
>
> - Restore the exact API test paths required by Issue #12.
>
> - Do not mark "API-CONTRACT-01" Passed until its complete parsing/error matrix is executable.
>
> - Do not mark "API-REQ-02" Passed without historical inactive-requester ticket persistence/unreachability evidence.
>
> - Do not mark "UI-MY-03" Passed when the test does not exercise My Tickets data.
>
> - Add the required "E2E-05" flow, or leave that cross-feature gate incomplete until its dependencies exist.
>
> - Cover the "/api/related-systems" requester-header exemption before marking "API-REQ-03" complete.
>
> - Restore unrelated Lab 1 health behavior unless its removal is explicitly authorized by the frozen Lab 2 contract.
>
> The main issue is not that the selector is fundamentally broken. The main issue is that "docs/lab-02/tests.md" currently reports several rows as "Passed" even though the tests only prove a subset of the required behavior.
>
> The traceability/evidence status should describe what was actually executed, rather than modifying the frozen test contract to fit the implementation.

#### My review comment 2 — Changes requested

> PR #21 Re-review — Request Changes
>
> Reviewed PR: #21 Feature/lab2 requester selection
>
> Reviewed head:
>
> f43dfd2459286a989197e4ed9d8d01999089a7dc
>
> Baseline used:
>
> - Issue #12
>
> - docs/lab-02/specification.md
>
> - docs/lab-02/api-spec.md
>
> - docs/lab-02/ui-spec.md
>
> - docs/lab-02/tests.md
>
> - Issue #11 governance/process baseline
>
> This review uses only the Lab 2 contract already defined in this repository. It does not introduce external project decisions.
>
> Verdict
>
> Request Changes
>
> This revision fixes an important previous finding: the exact Issue #12 API test files now exist at:
>
> - server/tests/lab-02/dev-requesters.api.test.ts
>
> - server/tests/lab-02/requester-context.api.test.ts
>
> The core requester selector is also substantially implemented.
>
> However, several test rows are still marked Passed even though their required behavior is only partially exercised. The main remaining issue is evidence accuracy rather than the basic selector UI itself.
>
> P1 — API-CONTRACT-01 is still marked Passed without executing the required contract matrix
>
> The new api-contract.api.test.ts adds several useful parsing tests, but it still does not execute the complete API-CONTRACT-01 contract.
>
> The required row covers:
>
> - duplicate requester headers
>
> - malformed route IDs
>
> - malformed ticket numbers
>
> - malformed JSON
>
> - null JSON bodies
>
> - array JSON bodies
>
> - scalar JSON bodies
>
> - wrong Content-Type
>
> - duplicate query parameters using the first occurrence
>
> - safe 500 responses
>
> - canonical error objects
>
> The current implementation still has important gaps.
>
> Missing route/ticket-ID coverage
>
> There are no executable assertions for malformed route IDs or malformed Ticket Numbers.
>
> Non-object JSON coverage is incomplete
>
> The test currently exercises null, but does not independently cover the required:
>
> - array body
>
> - scalar JSON body
>
> Wrong Content-Type assertion accepts failure to implement the contract
>
> The test explicitly allows:
>
> 400 or 404
>
> because there is no POST endpoint available for the test route.
>
> That cannot prove the contract:
>
> wrong Content-Type -> canonical 400
>
> A 404 being accepted by the assertion makes the test pass without proving the required behavior.
>
> Duplicate query parameter test does not prove first-occurrence semantics
>
> The current test calls something equivalent to:
>
> GET /api/dev-requesters?sort=name&sort=id
>
> but only asserts that getActiveDevRequesters() was called.
>
> GET /api/dev-requesters does not consume the sort parameter at all, so this cannot distinguish:
>
> - first value used
>
> - second value used
>
> - both values ignored
>
> The required contract says the first occurrence must win. The test needs an endpoint where the duplicate parameter actually affects parsed behavior and must assert which value reached the application logic.
>
> Required change
>
> Do not mark API-CONTRACT-01 as Passed until every required permutation is executable and actually asserted.
>
> If ticket routes / JSON mutation endpoints are not available yet because they belong to downstream issues, keep this row Implemented or Planned as appropriate.
>
> P1 — API-REQ-02 is still marked Passed even though its own result log admits only partial coverage
>
> API-REQ-02 requires both:
>
> - invalid requester contexts return 422 REQUESTER_CONTEXT_INVALID
>
> - historical tickets owned by an inactive requester remain persisted but cannot be reached through requester-facing flows
>
> The requester-header portion is now covered well.
>
> However, neither requester-context.api.test.ts nor the real-database requester integration test proves the historical Ticket requirement.
>
> The integration test verifies:
>
> - active requesters can establish context
>
> - nonexistent requester IDs return 422
>
> - malformed/missing requester headers return 422
>
> - inactive requesters are excluded from the bootstrap list
>
> It does not:
>
> - create or use an existing Ticket owned by an inactive requester
>
> - verify that Ticket remains persisted after requester deactivation
>
> - attempt requester-facing access to that Ticket
>
> - verify that the historical Ticket cannot be reached
>
> This is especially clear in docs/lab-02/tests.md, whose newest review-fix note says:
>
> “The historical inactive-requester ticket behavior test (API-REQ-02) is partially covered…”
>
> That statement directly conflicts with the matrix row:
>
> API-REQ-02 -> Passed
>
> Required change
>
> Keep API-REQ-02 at a truthful non-Passed evidence state until the BR-29 persistence + unreachability path is executable.
>
> A partially covered requirement cannot be Passed under the test-plan status definition.
>
> P1 — E2E-05 is marked Passed without an E2E test
>
> Issue #12 explicitly requires:
>
> E2E-05
>
> for a keyboard-only flow covering:
>
> - requester selection
>
> - Continue
>
> - Change Requester
>
> - Create Ticket
>
> - visible focus
>
> The planned test path remains:
>
> e2e/lab-02/keyboard-access.spec.ts
>
> but no such file exists in this PR.
>
> Instead, docs/lab-02/tests.md changes the row to reference:
>
> client/src/lab-02-tests/RequesterSelection.test.tsx (keyboard-only Continue test); e2e/lab-02/keyboard-access.spec.ts
>
> and marks the entire E2E row:
>
> Passed
>
> This is not equivalent to the required E2E flow.
>
> The unit test does not cover:
>
> - browser-level keyboard navigation
>
> - Change Requester through the complete flow
>
> - Create Ticket
>
> - browser :focus-visible behavior
>
> - the planned Playwright path
>
> The new keyboard unit test is also susceptible to a false positive
>
> The test manually does:
>
> continueBtn.focus()
>
> followed by synthetic:
>
> keyDown
>
> keyUp
>
> It then checks that "Ada Lovelace" can be found.
>
> But "Ada Lovelace" already exists as an <option> in the requester <select> before Continue succeeds.
>
> Therefore finding that text does not prove that pressing Enter caused the application to leave the selector.
>
> The test should instead assert something that exists only after successful Continue, such as:
>
> - application-shell heading
>
> - Change Requester
>
> - selector no longer present
>
> - requester context API invocation
>
> - sessionStorage persistence
>
> Even after fixing that unit test, it still does not substitute for the required E2E-05.
>
> Required change
>
> Restore:
>
> E2E-05 = Planned
>
> until e2e/lab-02/keyboard-access.spec.ts exists and exercises the entire required keyboard-only flow.
>
> P1 — UI-MY-03 still does not prove that old My Tickets data is cleared
>
> The revised MyTickets.test.tsx is better than the previous version because it now calls:
>
> fetchMyTickets(1)
>
> and then:
>
> fetchMyTickets(3)
>
> after switching Requester.
>
> However, the requirement is stronger:
>
> switching Requester clears the previous list and reloads the current Requester's tickets
>
> The test prepares:
>
> ticketsForAda
>
> and:
>
> ticketsForAlan
>
> but never renders or checks either ticket.
>
> The application also currently does:
>
> void fetchMyTickets(activeRequester.id)
>
> and discards the returned value.
>
> There is no My Tickets state being stored or rendered in App.tsx.
>
> Therefore there is currently no “old list data” that can be observed being cleared.
>
> The test proves:
>
> - requester A causes request A
>
> - requester B causes request B
>
> It does not prove:
>
> - requester A ticket data appears
>
> - old requester ticket data is removed immediately on switch
>
> - stale requester A data cannot remain visible while requester B loads
>
> - requester B data replaces requester A data
>
> Required change
>
> Either:
>
> - keep UI-MY-03 Planned until the actual My Tickets state exists, or
>
> - test the real My Tickets component/state once its owning feature is implemented.
>
> Do not mark the complete UI-MY-03 contract Passed based only on API-call IDs.
>
> P1 — fetchMyTickets() was added to satisfy switching evidence, but the backend route does not exist in this PR
>
> App.tsx now automatically runs:
>
> fetchMyTickets(activeRequester.id)
>
> whenever activeRequester changes.
>
> The API helper sends:
>
> GET /api/tickets
>
> with X-Dev-Requester-Id.
>
> However, the server router in this PR only contains:
>
> - /categories
>
> - /dev-requesters
>
> - /requester-context
>
> There is no:
>
> GET /api/tickets
>
> route.
>
> This means the real application will attempt a requester-scoped request to an endpoint that this branch does not implement.
>
> The promise is also launched with:
>
> void fetchMyTickets(...)
>
> without local error handling.
>
> This appears to have been introduced only to make UI-MY-03 observe requester IDs, even though the actual My Tickets feature remains a downstream planned feature.
>
> Required change
>
> Do not add a runtime My Tickets fetch solely as test evidence before the My Tickets feature exists.
>
> Keep UI-MY-03 planned until its owning feature exists, or implement it in the appropriate downstream issue.
>
> P1 — API-REQ-03 is still marked Passed without the Related Systems reference endpoint
>
> Issue #12 explicitly exempts reference-data endpoints from requester context and gives:
>
> - GET /api/categories
>
> - GET /api/related-systems
>
> as the reference examples.
>
> requester-context.api.test.ts currently verifies only:
>
> - GET /api/dev-requesters
>
> - GET /api/categories
>
> There is no /api/related-systems route in the current router, and API-REF-02 is still separately Planned.
>
> Therefore the complete reference-data exemption has not yet been demonstrated.
>
> Required change
>
> Either:
>
> - test /api/related-systems once the reference endpoint exists, or
>
> - leave API-REQ-03 at a truthful non-Passed status until the full reference-data contract can execute.
>
> P1 — Results Log violates its own “Newest First” rule and contains contradictory evidence
>
> The section is explicitly named:
>
> Results Log (Newest First)
>
> but the current order starts with several:
>
> 2026-08-23
>
> entries and only later contains:
>
> 2026-08-24 - PR #21 review feedback...
>
> The August 24 entry should be above the August 23 entries.
>
> There is also stale contradictory text.
>
> One August 23 entry says:
>
> Dedicated dev-requesters.api.test.ts and requester-context.api.test.ts files required by Issue #12 are not present in this branch.
>
> while the notes in the same historical section now say:
>
> Issue #12 required test files now exist and all tests pass.
>
> Historical results should remain understandable as historical evidence rather than being partially rewritten into contradictory states.
>
> The August 24 entry also says:
>
> Skipped/Disabled: 0
>
> followed immediately by:
>
> DB-dependent integration tests skip when DATABASE_URL is absent.
>
> Those two statements cannot both describe the same run unless DATABASE_URL was definitely present.
>
> Required change
>
> Clean up the Results Log so that:
>
> - newest entries are actually first
>
> - historical entries accurately describe the repository state at the time they were recorded
>
> - skipped counts match the command environment
>
> - partial coverage is not simultaneously represented as Passed
>
> P2 — /api/health removal remains unrelated to Issue #12
>
> The current PR still removes:
>
> - GET /api/health
>
> - backend health service/controller logic
>
> - server/tests/health.test.ts
>
> - server/tests/health.integration.test.ts
>
> - client health-check behavior
>
> The Results Log now says:
>
> Health check removal will be addressed in a separate issue.
>
> That reinforces that health removal is not part of this Issue #12 implementation.
>
> If it belongs to a separate issue, it should not be removed in this PR unless there is already an approved frozen contract explicitly assigning that removal here.
>
> Required change
>
> Restore the unrelated health behavior in this branch, or provide the existing approved contract/issue that explicitly owns its removal in PR #21.
>
> Previous finding that is now resolved
>
> Exact requester API test paths — resolved
>
> The previous review identified that Issue #12 required:
>
> server/tests/lab-02/dev-requesters.api.test.ts
>
> and:
>
> server/tests/lab-02/requester-context.api.test.ts
>
> Those files now exist at the exact planned paths.
>
> docs/lab-02/tests.md also points the requester rows back to those paths rather than redirecting them to api-contract.api.test.ts.
>
> This part is fixed.
>
> Core implementation that looks correct
>
> The underlying selector/context foundation is mostly sound:
>
> - active Requesters are filtered server-side
>
> - testing-only wording is present
>
> - loading state exists
>
> - zero-active-requester state exists
>
> - API failure has manual Retry
>
> - Continue is disabled without a valid selection
>
> - sessionStorage is used for the selected ID
>
> - requester IDs use strict positive-integer formatting
>
> - X-Dev-Requester-Id is explicit
>
> - missing/malformed/duplicate/unknown/inactive context returns canonical 422
>
> - stale stored context is cleared with an explanation
>
> - selected Requester name appears in the shell
>
> - Change Requester clears the stored selection
>
> - :focus-visible styling exists
>
> The remaining blockers are primarily around claiming full evidence before the dependent flows exist.
>
> Required changes before approval
>
> - Complete the full API-CONTRACT-01 matrix or stop marking it Passed.
>
> - Keep API-REQ-02 non-Passed until historical inactive-requester Ticket persistence/unreachability is actually tested.
>
> - Restore E2E-05 to Planned until the required Playwright test and Create Ticket flow exist.
>
> - Fix the keyboard unit test so it cannot pass by finding the requester <option> that was already present.
>
> - Keep UI-MY-03 Planned until actual My Tickets state can be rendered, cleared, and reloaded.
>
> - Remove the premature runtime /api/tickets fetch from this issue, or implement it under the feature that owns My Tickets.
>
> - Do not mark API-REQ-03 complete until all required reference endpoint exemptions can be demonstrated.
>
> - Repair the Results Log ordering and contradictory evidence.
>
> - Keep unrelated health endpoint removal out of this PR unless an approved repository contract explicitly assigns it here.
>
> The main requester-selection implementation is close. The biggest remaining problem is that the traceability matrix currently reports complete evidence for several behaviors whose dependencies and executable tests do not yet exist.

#### My review comment 3 — Changes requested

> PR #21 Re-review — Request Changes
>
> Reviewed PR: #21 Feature/lab2 requester selection
>
> Reviewed head:
>
> 03b6a23e4625a94700c26faf052b35d5a259b181
>
> Baseline used:
>
> - Issue #12
>
> - docs/lab-02/specification.md
>
> - docs/lab-02/api-spec.md
>
> - docs/lab-02/ui-spec.md
>
> - docs/lab-02/tests.md
>
> - Issue #11 governance/process baseline
>
> This review uses only the Lab 2 contract already defined in this repository. It does not introduce external project decisions.
>
> Verdict
>
> Request Changes
>
> This revision improves the requester-selection implementation and documentation significantly.
>
> The previous evidence overclaims for:
>
> - API-REQ-02
>
> - API-REQ-03
>
> - API-CONTRACT-01
>
> - UI-MY-03
>
> - E2E-05
>
> have been corrected back to Planned, and the premature /api/tickets behavior and unrelated health regression remain resolved.
>
> However, the PR still does not satisfy Issue #12 as currently written.
>
> There are three remaining blockers.
>
> P1 — docs/lab-02/tests.md redefines Issue #12 scope instead of satisfying the Issue #12 acceptance contract
>
> The new section:
>
> 5.1 Issue #12 Scope Boundary (Requester Selection only)
>
> states that several required rows belong to downstream issues and therefore remain Planned.
>
> Keeping incomplete rows as Planned is correct from an evidence-truthfulness perspective.
>
> The problem is the conclusion that those rows are therefore outside Issue #12.
>
> Issue #12 itself explicitly lists the following as Required automated tests for this issue:
>
> - API-REQ-01
>
> - API-REQ-02
>
> - API-REQ-03
>
> - API-CONTRACT-01
>
> - UI-REQ-01..07
>
> - UI-MY-03
>
> - E2E-05
>
> Its acceptance criteria also explicitly require:
>
> API, UI, and cross-feature tests listed above exist at the specified paths and pass.
>
> The Objective is equally explicit that:
>
> This issue is complete only when the UI, requester-context API behavior, session handling, and automated tests below are implemented and passing.
>
> Therefore these two statements can both be true:
>
> - API-REQ-02, API-REQ-03, API-CONTRACT-01, UI-MY-03, and E2E-05 should remain Planned because their complete behaviors do not exist yet.
>
> - Issue #12 is therefore not complete yet.
>
> What should not happen is changing tests.md to state that these required Issue #12 acceptance tests are actually owned only by downstream issues.
>
> That changes the Issue contract rather than satisfying it.
>
> Required change
>
> Do not redefine the required Issue #12 rows as outside Issue #12 unless Issue #12 itself is formally updated through the repository's approved governance process.
>
> Until then:
>
> - keep the incomplete rows Planned
>
> - state clearly that Issue #12 remains incomplete because those required cross-feature/dependent acceptance tests cannot yet execute
>
> - do not claim Issue #12 itself is complete
>
> If the intended project decision is that Issue #12 should only deliver the requester-selection foundation and the cross-feature checks should be release/downstream gates, then Issue #12 needs to be amended accordingly rather than changing only tests.md.
>
> P1 — UI-REQ-06 still does not assert the actual X-Dev-Requester-Id network header
>
> UI-REQ-06 is currently marked:
>
> Passed
>
> The row requires:
>
> - selected requester ID is persisted
>
> - X-Dev-Requester-Id is sent
>
> - selected requester name appears in the shell
>
> - Change Requester is operable
>
> The current tests prove most of that.
>
> However, the unmocked API integration test still defines the fetch spy approximately as:
>
> vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
>   ...
> })
>
> It examines the URL but does not capture the second fetch argument.
>
> Therefore it never asserts:
>
> X-Dev-Requester-Id: 1
>
> on the actual /api/requester-context request.
>
> The production implementation currently sends the header correctly, but the test row says that this behavior has executable evidence.
>
> At present the test could continue passing if fetchRequesterContext() accidentally stopped attaching the header, because the mock returns the same successful response based only on the URL.
>
> Required change
>
> Make the integration fetch mock capture:
>
> (input, init)
>
> and inspect:
>
> new Headers(init?.headers)
>
> Then explicitly assert:
>
> headers.get("X-Dev-Requester-Id") === "1"
>
> for the /api/requester-context request.
>
> That would provide real network-boundary evidence for the header portion of UI-REQ-06.
>
> P1 — UI-REQ-07 still does not prove the complete keyboard + visible-focus + Change Requester flow
>
> UI-REQ-07 is also marked:
>
> Passed
>
> Its contract includes:
>
> - testing-only explanation
>
> - Continue disabled before selection
>
> - Continue enabled after selection
>
> - keyboard operation
>
> - visible focus
>
> - selected requester shown after Continue
>
> - Change Requester operable
>
> - Change Requester returns to selection
>
> The revised Continue test is good.
>
> It now uses:
>
> await userEvent.tab();
> await userEvent.keyboard("{Enter}");
>
> and verifies post-selection state through Change Requester, so the earlier false positive is fixed.
>
> But two portions remain unproven.
>
> Change Requester is still activated with a mouse-style click
>
> The switching test still uses:
>
> fireEvent.click(
>   screen.getByRole("button", { name: "Change Requester" })
> );
>
> Issue #12 specifically requires Change Requester to be keyboard-operable.
>
> There is no executable sequence proving:
>
> Continue
> → shell
> → keyboard focus reaches Change Requester
> → Enter/Space activates it
> → selector returns
>
> The test proves focus location, not visible focus
>
> The current assertions include:
>
> expect(document.activeElement).toBe(select);
> expect(document.activeElement).toBe(continueBtn);
>
> These prove which DOM element has focus.
>
> They do not prove that the focus indicator is visible.
>
> The CSS correctly contains a :focus-visible outline, but UI-REQ-07 = Passed claims executable visible-focus coverage.
>
> If browser-visible focus is intentionally deferred to E2E-05, that is reasonable — but then the same behavior should not simultaneously be claimed as already proven by UI-REQ-07.
>
> Required change
>
> Extend the requester-selection UI test to cover the complete keyboard path that exists in this issue:
>
> Requester selector
> → Continue
> → application shell
> → Change Requester
> → Requester selector
>
> using keyboard navigation and Enter/Space activation.
>
> For visible focus, either:
>
> - add appropriate executable evidence at this test layer, or
>
> - keep that part non-Passed and leave browser-level visible-focus verification to E2E-05.
>
> The matrix status must match whichever evidence model the repository chooses.
>
> P2 — README now overstates Issue #12 completion
>
> The updated README says approximately:
>
> The Issue #12 (Requester Selection) rows are implemented and passing; ticket/attachment rows remain Planned.
>
> That wording is not accurate against the current test matrix or Issue #12.
>
> Several rows explicitly required by Issue #12 remain:
>
> Planned
>
> including:
>
> - API-REQ-02
>
> - API-REQ-03
>
> - API-CONTRACT-01
>
> - UI-MY-03
>
> - E2E-05
>
> Therefore the README should distinguish:
>
> Requester-selection foundation rows implemented in this branch
>
> from:
>
> all Issue #12 acceptance rows complete
>
> Those are currently not the same thing.
>
> Required change
>
> Use wording such as:
>
> The requester-selection foundation implemented in this branch is passing its executable test slice. Issue #12 still has required downstream-dependent acceptance rows that remain Planned.
>
> Do not say Issue #12 rows generally are implemented/passing while several required Issue #12 rows remain Planned.
>
> Improvements since the previous review
>
> The latest revision does improve several areas.
>
> Loading state is better aligned with the test plan
>
> The selector now renders a structured loading state with:
>
> - Development Requester label
>
> - skeleton placeholder
>
> - disabled Continue button
>
> rather than only displaying loading text.
>
> This is a better match for UI-REQ-03.
>
> Keyboard Continue test false positive remains fixed
>
> The test now validates state that exists only after Continue succeeds instead of finding a requester name that was already present as an <option>.
>
> Downstream evidence statuses remain truthful
>
> These rows correctly remain Planned:
>
> - API-REQ-02
>
> - API-REQ-03
>
> - API-CONTRACT-01
>
> - UI-MY-03
>
> - E2E-05
>
> They should stay non-Passed until their complete contracts are executable.
>
> Premature My Tickets runtime behavior remains removed
>
> The requester selector no longer calls a nonexistent /api/tickets route simply to manufacture UI-MY-03 evidence.
>
> Lab 1 compatibility remains restored
>
> The existing /api/health / System Overview behavior is retained rather than removed as unrelated Issue #12 cleanup.
>
> Core requester-selection implementation status
>
> The actual requester-selection foundation is in good shape:
>
> - active requester bootstrap exists
>
> - inactive requesters are filtered server-side
>
> - selector is explicitly testing-only
>
> - loading state exists
>
> - empty state exists
>
> - API failure has manual Retry
>
> - Continue is disabled until selection
>
> - stored requester ID uses sessionStorage
>
> - requester ID parsing is strict
>
> - requester-context middleware validates active requester IDs
>
> - canonical 422 REQUESTER_CONTEXT_INVALID behavior exists
>
> - stale context is cleared and explained
>
> - selected requester name appears in the shell
>
> - Change Requester returns to selection
>
> - :focus-visible styling exists
>
> The remaining issues are primarily acceptance/evidence alignment rather than a redesign of the selector.
>
> Required Changes Before Approval
>
> -
>
> Do not redefine required Issue #12 test rows as outside Issue #12 unless Issue #12 itself is formally changed.
>
> -
>
> Clearly state that Issue #12 remains incomplete while its required Planned rows remain unexecuted.
>
> -
>
> Add a network-boundary assertion for X-Dev-Requester-Id before keeping UI-REQ-06 = Passed.
>
> -
>
> Add keyboard activation of Change Requester before keeping the complete keyboard portion of UI-REQ-07 = Passed.
>
> -
>
> Align the visible focus evidence/status between UI-REQ-07 and downstream E2E-05.
>
> -
>
> Correct the README wording so it does not imply all Issue #12 rows are implemented and passing.
>
> -
>
> Re-run the affected test slice and record the actual evidence in docs/lab-02/tests.md.
>
> After these changes, the remaining blocker will primarily be the explicit Issue #12 dependency question: either its required cross-feature rows must eventually pass, or the Issue itself must be formally revised before it can be considered complete.

#### My review comment 4 — Approved

> Review — Approved
>
> Reviewed against the current, formally amended Issue #12 and the repository Lab 2 contracts (specification.md, api-spec.md, ui-spec.md, and tests.md).
>
> The previous blockers are resolved:
>
> - Issue #12 was formally amended rather than redefining scope only in tests.md, and the deferred rows were explicitly reassigned to #13/#14/#18.
>
> - API-REQ-01 now has service-level evidence that the query uses where: { isActive: true }.
>
> - UI-REQ-06 now asserts the real /api/requester-context fetch carries X-Dev-Requester-Id.
>
> - UI-REQ-07 now covers keyboard activation through requester selection, Continue, shell navigation, Change Requester, and return to the selector.
>
> - Browser-rendered visible-focus verification is explicitly deferred to E2E-05 in the integration issue rather than being overclaimed here.
>
> - The premature My Tickets request remains removed, and the unrelated Lab 1 health behavior remains preserved.
>
> - The traceability matrix now keeps downstream-dependent rows Planned instead of claiming incomplete evidence as Passed.
>
> I did not find a remaining blocker or Medium+ correctness issue in the current Issue #12 scope.
>
> Non-blocking follow-ups
>
> - The latest Results Log records the final server/client test runs (49 server / 19 client, 0 failures), but it does not record a fresh git diff --check after the final UI/test edits. The PR diff does not show an obvious whitespace blocker, but please run and log git diff --check before merge / in the next cleanup pass so the acceptance evidence is explicit.
>
> - RequesterSelection.test.tsx still has a test title mentioning "visible focus" even though browser-visible focus is now intentionally deferred to E2E-05; renaming that test to describe focus reachability/keyboard operation would make the evidence wording slightly clearer.
>
> - There is no GitHub Actions run attached to this head, so the current pass counts are repository-recorded local evidence. Adding CI later would strengthen release evidence, but this is not a blocker for this requester-selection PR.
>
> Approved.

#### Partner's responses

> Okay, it looks like I accidentally assign agent to set default status as passed in tests.md

> The issue#12 is overscope making impossible to write a code in the first place so I will edit the issue to align with the real possible codebase and feature.

### PR #23 — Remove all health check system and Lab 1 leftover artifacts

#### My review comment 1 — Changes requested

> Review — Request Changes
>
> The Issue #22 cleanup itself looks good. The health-check server/client code, tests, legacy Lab 1 CSS, and README references have been removed as requested, and I did not find another Medium+ issue in that cleanup.
>
> Medium — agent.md introduces an unrelated governance change
>
> This PR also modifies agent.md by adding a new mandatory Post-Implementation Double-Check Alignment Method.
>
> This is outside the scope of Issue #22, which is specifically about:
>
> - removing the Lab 1 health-check system;
>
> - removing leftover Lab 1 CSS that conflicts with Zen Green;
>
> - updating the README;
>
> - verifying the cleanup.
>
> The agent.md change is not just documentation cleanup. It changes the working agreement for all future issues and states that no commit or PR may proceed until the new verification gate passes.
>
> There is also an immediate inconsistency with the repository at this head. The new rule says:
>
> no test file exists that isn't in tests.md
>
> However, files such as:
>
> server/tests/categories.test.ts
>
> still exist while that exact test path is not represented as a canonical test row in "docs/lab-02/tests.md".
>
> The insertion also breaks the document hierarchy:
>
> ### 3.2 Plan-vs-Act requirement
> ## 4. Post-Implementation Double-Check Alignment Method
> ...
> ### 3.3 Integration & Real Database Test Rules
> ### 3.4 Test Status vs. Issue Scope Rule
> ...
> ## 4. Debug Mantra Skill
>
> So the file now has duplicated "## 4" sections and "3.3" / "3.4" appear underneath the newly inserted Section 4.
>
> Required change
>
> Please revert the "agent.md" change from this PR.
>
> If this new governance process is desired, it should be introduced through a separately scoped governance issue/PR where:
>
> - the rule can be reviewed independently;
> - it can be aligned with the repository's actual test structure;
> - the section numbering can be corrected;
> - any required changes to "tests.md" can be made deliberately.
>
> Once the unrelated "agent.md" change is removed, the Issue #22 implementation otherwise looks approvable from the scope reviewed here.
>
> Non-blocking follow-ups
>
> These do not block this PR after the Medium issue above is addressed:
>
> - "client/src/App.test.tsx" still imports "fireEvent" and "waitFor", but the health-check tests that used them were removed. These unused imports can be cleaned up.
> - There are currently no GitHub status checks/workflow runs visible on this PR head, so the reported test/build results are based on the verification recorded in the Issue/PR rather than independently visible CI evidence.

#### My review comment 2 — Changes requested

> Review — Request Changes
>
> Re-reviewed against the current Issue #22, including the updated allowance for agent.md maintenance.
>
> The previous scope concern about modifying agent.md is no longer applicable. The health-check and Lab 1 cleanup itself looks good, and I did not find another Medium+ issue in that part of the PR.
>
> There are still a few Medium issues in the new agent.md guidance that should be fixed before approval.
>
> 1. Medium — the new mandatory test-alignment gate conflicts with the current repository
>
> The new agent.md rule requires checking that:
>
> no test file exists that isn't in tests.md
>
> However, the current repository still contains test files such as:
>
> server/tests/categories.test.ts
>
> while that exact path is not represented as a canonical test row in "docs/lab-02/tests.md".
>
> Because the new process is described as a mandatory gate that must pass before committing or opening a PR, this makes the rule fail against the repository immediately after it is introduced.
>
> Please either:
>
> - narrow the rule so it applies only to Lab 2 contract tests that are expected to be tracked in "tests.md"; or
> - align "tests.md" and the repository test structure so the requirement is actually satisfiable.
>
> The wording should not require future agents to violate the process simply because legacy/supporting tests intentionally exist outside the Lab 2 matrix.
>
> 2. Medium — "agent.md" section hierarchy is broken
>
> The new section is inserted as:
>
> ### 3.2 Plan-vs-Act requirement
> ## 4. Post-Implementation Double-Check Alignment Method
> ...
> ### 3.3 Integration & Real Database Test Rules
> ### 3.4 Test Status vs. Issue Scope Rule
> ...
> ## 4. Debug Mantra Skill
>
> This leaves "3.3" and "3.4" underneath a new Section 4 and creates two separate "## 4" sections.
>
> Please fix the numbering/hierarchy so the document has one consistent section structure.
>
> 3. Medium — the "agent.md" change is not documented in the PR description
>
> The amended Issue #22 allows "agent.md" maintenance, but requires those changes to be documented in the PR description.
>
> The current PR description documents:
>
> - health-check removal;
> - CSS cleanup;
> - README cleanup;
> - grep/test/build verification.
>
> It does not mention the new mandatory "agent.md" verification process.
>
> Please add a short section to the PR description explaining the "agent.md" change and what problem it is intended to solve.
>
> Health/Lab 1 cleanup
>
> Apart from the "agent.md" issues above, the actual Issue #22 cleanup looks aligned with the requested work:
>
> - server health route, handler, service code, and health tests are removed;
> - client health API/UI/state/tests are removed;
> - ".health-box" and the legacy Lab 1 blue-theme overrides are removed;
> - README no longer documents "/api/health" or the deleted health tests;
> - the remaining UI uses the Lab 2 Zen Green styling.
>
> I did not find another blocker or Medium+ implementation problem in that cleanup.
>
> Non-blocking follow-ups
>
> These do not need to block this PR once the Medium findings above are resolved:
>
> - "client/src/App.test.tsx" still imports "fireEvent" and "waitFor" after the health tests that used them were removed. These unused imports can be cleaned up.
> - There are no GitHub Actions/status checks visible on this PR head, so the reported server/client test and build results are author-recorded verification rather than independently visible CI evidence.
>
> Once the three "agent.md" alignment issues above are fixed, this PR otherwise looks ready for approval.

#### My review comment 3 — Changes requested

> Review — Request Changes
>
> Re-reviewed the latest head against the current Issue #22, including its explicit agent.md maintenance scope.
>
> The health/Lab 1 cleanup itself looks good. The previous agent.md hierarchy problem and overly broad Tests.md cross-reference rule have been corrected, and the unused App.test.tsx imports are also cleaned up.
>
> Medium — the remaining agent.md changes exceed the maintenance scope allowed by Issue #22
>
> Issue #22 explicitly allows agent.md maintenance, but limits it to:
>
> - minor corrections directly related to this issue's scope;
>
> - changes documented in the PR description;
>
> - no unrelated governance changes.
>
> The PR still introduces an entirely new mandatory workflow:
>
> ## 4. Post-Implementation Double-Check Alignment Method

#### My review comment 4 — Approved

> Review — Approved
>
> Reviewed the latest head against the current Issue #22 and the applicable Lab 2 contracts.
>
> The Issue #22 implementation is complete for its required health/Lab 1 cleanup scope:
>
> - Server health handler, service logic, route, and health tests are removed.
>
> - Client health API, state, UI, and related tests are removed.
>
> - .health-box and the conflicting Lab 1 blue-theme CSS are removed.
>
> - README no longer documents /api/health or the removed health tests.
>
> - No relevant health references remain in the client/server source.
>
> - The previous agent.md hierarchy and test-file alignment findings have been corrected.
>
> - The agent.md maintenance is now permitted by the current Issue #22 scope and documented in the PR description.
>
> - The PR records 39 passing server tests with 7 DB-dependent skips and 13 passing client tests, with no failures.
>
> I did not find a blocker or Medium+ correctness issue that prevents the Issue #22 acceptance criteria from being satisfied.
>
> Non-blocking follow-ups
>
> These should be addressed in a subsequent governance/docs cleanup, but they do not need to block this health-cleanup PR:
>
> -
>
> Scope the agent.md API alignment gate to the currently implemented slice.
>
> The new API Spec → Routes check currently says that every documented endpoint must exist. api-spec.md is also the target contract for downstream Lab 2 work, so future/planned Ticket and Attachment endpoints intentionally do not exist yet.
>
> Adjust the rule so it verifies that:
>
> - endpoints claimed as implemented for the current scope exist and match the contract;
>
> - implemented routes are documented; and
>
> - explicitly planned/downstream endpoints are not required to exist yet.
>
> The same current-scope principle should be used for other final-contract cross-reference checks where appropriate.
>
> -
>
> Keep unrelated issue-governance amendments isolated from feature PRs where practical.
>
> The latest documentation changes also record the separate Issue #13/#15 redistribution of UI-TKT-06 and UI-TKT-08. That redistribution does not affect the correctness of Issue #22, but future governance amendments should preferably stay with their owning issue/PR so feature history remains easier to audit.
>
> -
>
> CI evidence is not currently visible on the reviewed head.
>
> The test/build evidence is recorded in the PR, but there are no GitHub status checks or workflow runs visible for this head. Adding CI later would make these verification claims independently reproducible during review.
>
> Approved for Issue #22. The follow-ups above are non-blocking and can be handled separately.

#### Partner's responses

> @oangsa — This PR removes all Lab 1 health check system artifacts. Please review when you have a moment. 🙏

> I will update the issue to include agent.md change or update instead of revert the change, cause it is not make sense to create a new issue whenever we want to update the agent guideline everytime the problem happens. There're many agents.md that need to fix along the way and this agent.md is not related to lab2 I will use this approarch instead. I will edit the issue to allow agent.md to be improved inside every issue.

> Change have been fixed please re review again

> This is needed and related to this pr cause agent always act while do not double check their own task such as something is missing / data is not aligned / there's remaining unused import / test case is not actually passed cause many problems and repetitive task. This is not outside the scope, All issue will gain the effect from this fix including this issue.

> I have edited the issue to accept the improvement of agent.md like this.

### PR #24 — docs: address PR #23 non-blocking follow-ups — scope API gate, add governance isolation rule, update reviewer.md

No formal review comment recorded.

#### Partner's response

> I accidentally merge the previous one before making any change so I''ll change in this pr instead.

### PR #25 — feat: Lab 2 Issue 3 - Ticket Creation Flow

#### My review comment 1 — Changes requested

> Review verdict
>
> Request changes.
>
> I reviewed PR #25 at head commit 33b46ceb5854a51a5f7f6bbf3e8933288a64affb against the Issue 3 objective and the frozen Lab 2 contracts.
>
> Findings
>
> 1. [P1] Ticket-number allocation and Ticket insertion are not in the same transaction
>
> Files:
>
> - server/src/service.ts
>
> - server/src/ticket-number.ts
>
> allocateTicketNumber() commits the sequence update before prisma.ticket.create() runs.
>
> If Ticket insertion fails after number allocation—for example because of a database interruption, foreign-key race, or another insert error—the sequence remains incremented even though no Ticket was created.
>
> This can produce gaps such as:
>
> TKT-2026-000001
> TKT-2026-000003
>
> That violates BR-01, which requires successful Ticket creation to increment by exactly one within a year.
>
> The implementation also uses two different clocks:
>
> - Ticket-number year: new Date().getUTCFullYear() from the Node.js process
>
> - createdAt: PostgreSQL CURRENT_TIMESTAMP
>
> Around a UTC-year boundary, or when application and database clocks differ, a Ticket could receive a number such as TKT-2026-xxxxxx while its persisted createdAt belongs to 2027.
>
> BR-01 requires the Ticket Number year and createdAt to use the same UTC-authoritative clock basis.
>
> Required change
>
> Perform all creation work inside one database transaction:
>
> - Obtain one authoritative database timestamp.
>
> - Derive the UTC year from that timestamp.
>
> - Validate or lock the Category and RelatedSystem records.
>
> - Allocate the yearly sequence using the transaction client.
>
> - Insert the Ticket using the same authoritative timestamp.
>
> - Roll back the sequence allocation if Ticket insertion fails.
>
> The exhaustion path must also avoid committing lastSeq = 1000000 before returning TICKET_SEQUENCE_EXHAUSTED.
>
> 2. [P1] The “View Ticket” action does not open the created Ticket
>
> Files:
>
> - client/src/App.tsx
>
> - client/src/CreateTicket.tsx
>
> - client/src/api.ts
>
> The success panel correctly passes the generated Ticket Number to onViewTicket:
>
> onViewTicket(createdTicketNumber)
>
> However, the callback ignores the Ticket Number:
>
> const handleViewTicket = (ticketNumber: string) => {
>   // For now, just go home — Ticket Detail will be implemented in a later issue
>   setView("home");
> };
>
> Clicking View Ticket therefore returns the user to the welcome screen rather than displaying the Ticket that was just created.
>
> There is also:
>
> - no Ticket Detail view in AppView
>
> - no client function for GET /api/tickets/:ticketNumber
>
> - no create-to-detail UI or E2E test
>
> This does not satisfy the required create-to-detail behavior.
>
> Required change
>
> Add a Ticket Detail state or route that:
>
> - Stores the selected Ticket Number.
>
> - Calls GET /api/tickets/:ticketNumber.
>
> - Sends X-Dev-Requester-Id.
>
> - Displays the owned Ticket detail.
>
> - Handles loading, 404, and unexpected failure states.
>
> Add automated coverage for:
>
> Create Ticket
> → Success panel
> → View Ticket
> → Created Ticket detail displayed
>
> 3. [P1] POST /api/tickets does not enforce the frozen JSON request-parsing contract
>
> Files:
>
> - server/src/app.ts
>
> - server/src/controller.ts
>
> - server/src/service.ts
>
> express.json() skips parsing when the request uses a content type such as text/plain.
>
> That leaves req.body undefined. The handler then passes it into:
>
> createTicket(requesterId, req.body)
>
> validateCreateTicketInput() immediately accesses:
>
> input.categoryId
>
> When input is undefined, this throws a TypeError, which is caught as an unexpected failure and returned as:
>
> {
>   "error": {
>     "code": "INTERNAL_ERROR",
>     "message": "An unexpected error occurred."
>   }
> }
>
> The API contract requires the following to return 400 VALIDATION_ERROR with a fields object:
>
> - wrong content type
>
> - malformed JSON
>
> - null JSON body
>
> - array JSON body
>
> - primitive JSON body
>
> - missing body
>
> Required change
>
> Before calling the service:
>
> - Require Content-Type: application/json.
>
> - Require req.body to be a non-null object.
>
> - Reject arrays and primitive JSON values.
>
> - Return the canonical response:
>
> {
>   "error": {
>     "code": "VALIDATION_ERROR",
>     "message": "Request body must be a JSON object.",
>     "fields": {}
>   }
> }
>
> There is also a lexical-validation problem.
>
> After normal JSON parsing, these values are indistinguishable:
>
> 1
> 1.0
> 1e0
>
> All become the JavaScript number 1.
>
> However, API §0 requires integer fields to accept only the decimal grammar:
>
> 0|[1-9][0-9]*
>
> That explicitly rejects decimal points and exponents.
>
> Number.isInteger() alone cannot enforce that requirement. Exact contract compliance requires preserving or inspecting the original numeric token during parsing.
>
> 4. [P2] Ticket Detail omits removal metadata from embedded attachments
>
> File:
>
> - server/src/service.ts
>
> The Ticket Detail query returns both active and removed attachments, but currently selects only:
>
> id
> originalFilename
> mimeType
> fileSizeBytes
> uploadedAt
> isRemoved
>
> It omits:
>
> removedAt
> removalReason
> removedByRequesterId
>
> The API contract requires the embedded attachment list to include removed entries and their removal metadata.
>
> Without these fields, Ticket Detail cannot display:
>
> - when the attachment was removed
>
> - why it was removed
>
> - which requester removed it
>
> Required change
>
> Add these nullable fields to:
>
> - AttachmentData
>
> - the Prisma select
>
> - the endpoint response
>
> - Ticket Detail API tests
>
> The test should include at least one removed attachment instead of testing only:
>
> {
>   "attachments": []
> }
>
> 5. [P2] The migration omits the required Ticket indexes
>
> Files:
>
> - server/prisma/schema.prisma
>
> - server/prisma/migrations/20260825000000_add_ticket_related_system_attachment/migration.sql
>
> Specification §7 requires the following Ticket indexes:
>
> @@index([requesterId])
> @@index([currentStatus])
> @@index([createdAt])
>
> The current Prisma model does not define them, and the migration creates only the unique index on ticketNumber.
>
> These indexes are important for the upcoming requester-owned Ticket list, status filtering, and created-date sorting.
>
> Required change
>
> Add the following to the Prisma model:
>
> model Ticket {
>   // fields...
>
>   @@index([requesterId])
>   @@index([currentStatus])
>   @@index([createdAt])
> }
>
> Add the corresponding migration statements:
>
> CREATE INDEX "Ticket_requesterId_idx"
> ON "Ticket"("requesterId");
>
> CREATE INDEX "Ticket_currentStatus_idx"
> ON "Ticket"("currentStatus");
>
> CREATE INDEX "Ticket_createdAt_idx"
> ON "Ticket"("createdAt");
>
> Update database-migration.integration.test.ts to assert all three indexes.
>
> 6. [P2] Several tests marked as Passed only verify mocked behavior
>
> Files:
>
> - server/tests/lab-02/create-ticket-normalization.api.test.ts
>
> - server/tests/lab-02/create-ticket.api.test.ts
>
> - server/tests/lab-02/ticket-detail.api.test.ts
>
> - server/tests/lab-02/ticket-number-concurrency.integration.test.ts
>
> - server/tests/lab-02/api-contract.api.test.ts
>
> - client/src/lab-02-tests/CreateTicket.test.tsx
>
> - docs/lab-02/tests.md
>
> Several tests mock the exact behavior they claim to verify.
>
> For example, the normalization tests mock createTicket() and manually instruct it to return a ValidationError:
>
> vi.mocked(service.createTicket).mockRejectedValue(
>   new ValidationError(...)
> );
>
> This verifies only that the controller maps a mocked error to an HTTP response.
>
> It does not execute the real implementation of:
>
> - trimming
>
> - boundary validation
>
> - whitespace-only validation
>
> - persistence of trimmed values
>
> - active reference checks
>
> - inactive reference checks
>
> The Ticket Detail ownership test similarly mocks getTicketByNumber(), so it does not exercise the real ownership query.
>
> Ticket-number test gaps
>
> The concurrency test calls:
>
> allocateTicketNumber(...)
>
> directly and concurrently.
>
> It does not send concurrent requests to:
>
> POST /api/tickets
>
> The two real create requests in the suite are sequential.
>
> The rollover test also passes years such as 2091 and 2092 directly into the allocator. It does not freeze the authoritative creation clock or verify that:
>
> Ticket Number year === persisted createdAt UTC year
>
> Request-parsing test gap
>
> The wrong-content-type test sends a request to:
>
> POST /api/requester-context
>
> That route does not exist, and the test permits either 400 or 404.
>
> Now that POST /api/tickets exists, the parsing contract must be tested against the real JSON endpoint and must require exactly:
>
> 400 VALIDATION_ERROR
>
> Client test gaps
>
> There is no successful submission test that verifies:
>
> - generated Ticket Number is displayed
>
> - persisted createdAt is displayed as Ticket Date
>
> - exact UTC formatting
>
> - View Ticket action works
>
> - create-to-detail navigation works
>
> The busy-state test verifies that the button becomes disabled, but it does not attempt a second submission and confirm that:
>
> expect(api.createTicket).toHaveBeenCalledTimes(1);
>
> Required change
>
> Add tests that execute the real implementation:
>
> - real service validation tests
>
> - real database persistence tests
>
> - real active/inactive reference tests
>
> - real ownership query tests
>
> - concurrent HTTP Ticket creation
>
> - rollback/no sequence gap after insert failure
>
> - frozen UTC year rollover
>
> - wrong-content-type and non-object body tests against POST /api/tickets
>
> - successful UI create flow
>
> - success-panel-to-detail UI/E2E flow
>
> The relevant rows in docs/lab-02/tests.md should not be marked Passed until the actual behavior is exercised.
>
> Additional schema concern
>
> The frozen Specification §7 defines uploaderRequesterId and removedByRequesterId as real foreign keys to DevRequester, using named Prisma relations.
>
> The current Attachment model stores the integer columns but does not define either relation.
>
> The specification also defines:
>
> storedFilename String @unique
>
> The current implementation uses:
>
> storedFilename String
>
> The PR’s own Results Log acknowledges these as schema gaps, but the Issue 3 scope explicitly includes the Attachment schema increment.
>
> These should be corrected in this PR rather than deferred if the schema is expected to match Specification §7.
>
> Expected structure:
>
> model DevRequester {
>   id                  Int          @id @default(autoincrement())
>   name                String
>   email               String       @unique
>   isActive            Boolean      @default(true)
>   createdAt           DateTime     @default(now())
>   tickets             Ticket[]
>   uploadedAttachments Attachment[] @relation("AttachmentUploader")
>   removedAttachments  Attachment[] @relation("AttachmentRemover")
> }
>
> model Attachment {
>   id                    Int           @id @default(autoincrement())
>   ticketId              Int
>   ticket                Ticket        @relation(fields: [ticketId], references: [id])
>   uploaderRequesterId   Int
>   uploaderRequester     DevRequester  @relation(
>     "AttachmentUploader",
>     fields: [uploaderRequesterId],
>     references: [id]
>   )
>   originalFilename      String
>   storedFilename        String        @unique
>   mimeType              String
>   fileSizeBytes         Int
>   uploadedAt            DateTime      @default(now())
>   isRemoved             Boolean       @default(false)
>   removedAt             DateTime?
>   removalReason         String?
>   removedByRequesterId  Int?
>   removedByRequester    DevRequester? @relation(
>     "AttachmentRemover",
>     fields: [removedByRequesterId],
>     references: [id]
>   )
>
>   @@index([ticketId])
> }
>
> Overall assessment
>
> The normal create path contains several good pieces:
>
> - trimmed Summary and Description persistence
>
> - requested-priority validation
>
> - active Related Systems endpoint
>
> - ownership assigned from the requester header
>
> - itPriority and ticketOwnerId remain null
>
> - busy submit state
>
> - form-value preservation after failure
>
> - backend Ticket Detail ownership check
>
> However, the following are merge-blocking contract violations:
>
> - Ticket Number allocation is not atomic with Ticket creation.
>
> - Ticket Number year and createdAt do not share one authoritative clock.
>
> - The View Ticket action does not open Ticket Detail.
>
> - JSON request parsing does not follow the frozen API contract.
>
> Recommendation: Request changes before merge.

#### My review comment 2 — Changes requested

> Re-review verdict
>
> Request changes.
>
> Re-reviewed PR #25 at head 6c170bc0d8d29fcbc368cfbb82bd75fc4d28df2d against Issue #13 and the frozen Lab 2 contracts.
>
> The latest commit resolves most of the previously reported implementation findings:
>
> - Ticket Number allocation and Ticket insertion now share one transaction.
>
> - Ticket Number year and persisted createdAt use one authoritative database timestamp.
>
> - View Ticket now opens Ticket Detail.
>
> - JSON body shape and content type are validated.
>
> - Ticket Detail includes attachment removal metadata.
>
> - Required Ticket indexes and Attachment relations are present.
>
> - Successful create, Ticket Date formatting, View Ticket navigation, and concurrent HTTP creation now have initial test coverage.
>
> The remaining findings below are explicit contract and acceptance-test requirements rather than minor or nit-level follow-ups.
>
> Remaining blockers
>
> 1. [P1] The raw-body integer validator can still be bypassed and can reject valid requests
>
> Files:
>
> - server/src/integer-validation.ts
>
> - server/src/controller.ts
>
> - docs/lab-02/api-spec.md §0
>
> validateIntegerFields() parses the JSON with a reviver, but then locates the original numeric token using a regular expression against the entire raw request body:
>
> const regex = new RegExp(
>   `"${escapedKey}"\\s*:\\s*(-?(?:0|[1-9]\\d*)(?:\\.\\d+)?(?:[eE][+-]?\\d+)?)`,
> );
>
> const match = regex.exec(rawBody);
>
> regex.exec(rawBody) always returns the first textual occurrence of the field name. It does not identify the token belonging to the specific top-level property currently visited by the JSON reviver.
>
> This allows an invalid top-level ID to be hidden by an earlier property with the same name.
>
> For example:
>
> {
>   "ignored": {
>     "categoryId": 1
>   },
>   "categoryId": 1.0,
>   "relatedSystemId": 1,
>   "summary": "Valid summary",
>   "description": "Valid description text",
>   "requestedPriority": "MEDIUM"
> }
>
> The API contract says unknown properties are ignored.
>
> After JSON.parse():
>
> req.body.categoryId === 1
>
> When the validator processes the top-level categoryId, its regular expression finds the earlier nested value:
>
> "categoryId": 1
>
> It therefore treats the request as lexically valid, even though the submitted top-level value was:
>
> "categoryId": 1.0
>
> The inverse can also happen. An invalid ID inside an ignored nested property can cause a valid top-level field to be rejected.
>
> Escaped JSON property names can bypass the lookup as well:
>
> {
>   "category\u0049d": 1.0,
>   "relatedSystemId": 1,
>   "summary": "Valid summary",
>   "description": "Valid description text",
>   "requestedPriority": "MEDIUM"
> }
>
> JSON.parse() decodes category\u0049d to categoryId, but the raw-text regular expression searches only for the literal text:
>
> "categoryId"
>
> It does not find the escaped property name, so the invalid 1.0 token is not rejected.
>
> Required change
>
> Do not locate JSON field tokens using a global regular expression over the whole request body.
>
> Use a JSON tokenizer, AST parser, or lossless-number parser that provides the raw token or source span for the specific top-level members:
>
> categoryId
> relatedSystemId
>
> The validation must:
>
> - Inspect only the effective top-level fields used by req.body.
>
> - Ignore nested occurrences inside unknown properties.
>
> - Correctly handle JSON escape sequences in property names.
>
> - Reject decimal and exponent forms before converting the value to a normal JavaScript number.
>
> Add endpoint tests for at least:
>
> categoryId: 1.0
> categoryId: 1e0
> relatedSystemId: 1.0
> relatedSystemId: 1e0
>
> Also cover:
>
> nested property with the same field name
> escaped top-level property name
> valid top-level field plus invalid ignored nested field
> invalid top-level field plus valid ignored nested field
>
> An invalid effective top-level ID must always return:
>
> {
>   "error": {
>     "code": "VALIDATION_ERROR",
>     "fields": {
>       "categoryId": "..."
>     }
>   }
> }
>
> or the corresponding relatedSystemId field.
>
> 2. [P1] Required production behavior remains mock-only while the corresponding rows are marked Passed
>
> Files:
>
> - server/tests/lab-02/create-ticket-normalization.api.test.ts
>
> - server/tests/lab-02/create-ticket.api.test.ts
>
> - server/tests/lab-02/ticket-detail.api.test.ts
>
> - server/tests/lab-02/create-ticket-reference-validation.integration.test.ts
>
> - docs/lab-02/tests.md
>
> The new real-database reference test is useful, but several acceptance rows still replace the production function they claim to verify.
>
> Examples include:
>
> vi.mocked(service.createTicket).mockRejectedValue(
>   new ValidationError(...)
> );
>
> and:
>
> vi.mocked(service.getTicketByNumber).mockResolvedValue(null);
>
> These tests verify controller response mapping. They do not execute the real implementation of:
>
> - trim-before-validation
>
> - persistence of trimmed Summary and Description
>
> - Summary boundaries 4 / 5 / 120 / 121
>
> - Description boundaries 9 / 10 / 2000 / 2001
>
> - whitespace-only rejection in the production validator
>
> - ownership persisted from X-Dev-Requester-Id
>
> - client-supplied ownership values being ignored
>
> - itPriority remaining null
>
> - ticketOwnerId remaining null
>
> - real Ticket Detail ownership filtering
>
> - non-owner access returning 404 from the actual database query
>
> docs/lab-02/tests.md now explicitly records these rows as mock-only and states:
>
> Real integration tests that exercise the actual createTicket() and
> getTicketByNumber() service functions against a real database should be added
> ... to close this gap before merge.
>
> However, the corresponding matrix rows remain marked:
>
> Passed
>
> That is inconsistent with the Issue #13 acceptance requirement that unit, API, integration, UI, and E2E tests cover the actual validators, persistence, ownership, defaults, and create-to-detail behavior.
>
> Reference integration gap
>
> create-ticket-reference-validation.integration.test.ts verifies the returned status and error code, but it does not compare Ticket counts before and after each rejected request.
>
> For example, it asserts:
>
> expect(res.status).toBe(409);
> expect(res.body.error.code).toBe("INACTIVE_REFERENCE");
>
> but does not prove the acceptance requirement:
>
> create no Ticket
>
> A defect that accidentally inserted a Ticket before returning 409 would not be detected.
>
> Required change
>
> Add database-backed tests that execute the real production implementation.
>
> At minimum, cover the following.
>
> Real normalization and persistence
>
> Create Tickets through the real endpoint or service and query the persisted rows:
>
> "  abcde  " → persisted as "abcde"
> "  1234567890  " → persisted as "1234567890"
>
> Exercise all required boundaries using the real validator:
>
> Summary:     4 rejected
> Summary:     5 accepted
> Summary:   120 accepted
> Summary:   121 rejected
>
> Description:    9 rejected
> Description:   10 accepted
> Description: 2000 accepted
> Description: 2001 rejected
>
> Verify whitespace-only values create no Ticket.
>
> Real ownership and defaults
>
> Submit a request containing an undocumented client ownership field, such as:
>
> {
>   "requesterId": 999,
>   "ticketOwnerId": 999
> }
>
> Then query the persisted Ticket and assert:
>
> requesterId === requester from X-Dev-Requester-Id
> itPriority === null
> ticketOwnerId === null
> currentStatus === NEW
>
> Real Ticket Detail ownership
>
> Create a Ticket for Requester A and call:
>
> GET /api/tickets/:ticketNumber
>
> as both Requester A and Requester B.
>
> Assert:
>
> Requester A → 200 with full Ticket Detail
> Requester B → 404 NOT_FOUND with no Ticket data
>
> Rejected reference persistence
>
> For every inactive and nonexistent reference request:
>
> - Count matching Tickets before the request.
>
> - Send the request.
>
> - Assert 409 INACTIVE_REFERENCE.
>
> - Count matching Tickets afterward.
>
> - Assert the count did not change.
>
> Mock controller tests may remain for focused status-code mapping, but they must not be the sole evidence for production behavior described as Passed.
>
> Update docs/lab-02/tests.md so the Final status accurately represents the available evidence.
>
> 3. [P1] Required cross-feature E2E coverage is still absent, and BR-01 evidence remains incomplete
>
> Files:
>
> - client/src/lab-02-tests/CreateTicket.test.tsx
>
> - server/tests/lab-02/ticket-number-concurrency.integration.test.ts
>
> - docs/lab-02/tests.md
>
> The new client tests cover:
>
> - generated Ticket Number display
>
> - UTC Ticket Date formatting
>
> - View Ticket navigation
>
> - Create Another reset
>
> That is valuable component-level coverage, but both createTicket() and fetchTicketDetail() are mocked.
>
> The repository still has no e2e/ test suite for the required cross-feature real flow:
>
> Requester Selection
> → Create Ticket
> → backend persistence
> → generated Ticket Number and Ticket Date
> → View Ticket
> → owned Ticket Detail
>
> Issue #13 explicitly requires:
>
> Unit, component/UI, API, integration, and cross-feature E2E tests
>
> Therefore, missing E2E coverage is not a minor follow-up for this issue.
>
> BR-01 integration gaps
>
> The new concurrent HTTP test is an improvement, but it asserts only:
>
> all responses are 201
> all Ticket Numbers match the format
> all Ticket Numbers are distinct
>
> It does not assert that the allocated sequences are contiguous.
>
> For example, this incorrect result would pass the current test:
>
> TKT-2026-000100
> TKT-2026-000102
> TKT-2026-000106
>
> even though BR-01 requires each successful allocation within a year to increment by exactly one.
>
> The real create-path tests also do not currently prove:
>
> Ticket Number year === persisted createdAt UTC year
>
> They compare the number against the Node process’s current year rather than comparing it directly with the returned or persisted database timestamp.
>
> The rollover tests call the allocator directly with synthetic years:
>
> allocateTicketNumber(2091)
> allocateTicketNumber(2092)
>
> They do not exercise the real Ticket creation transaction using an authoritative database timestamp around a UTC year boundary.
>
> There is also no test that forces a failure after sequence allocation and verifies transaction rollback:
>
> failed Ticket insertion
> → no Ticket persisted
> → sequence increment rolled back
> → next successful Ticket does not skip a number
>
> docs/lab-02/tests.md describes API-TKT-06 as covering the frozen UTC boundary, exact increment, reset, concurrency, and exhaustion, but the current real create-path assertions do not cover that entire description.
>
> Required change
>
> Add a cross-feature E2E test, for example:
>
> e2e/lab-02/create-to-detail.spec.ts
>
> The test should:
>
> - Start the real client and server.
>
> - Select an active Development Requester.
>
> - Open Create Ticket.
>
> - Submit valid values.
>
> - Verify the generated Ticket Number.
>
> - Verify Ticket Date comes from persisted backend createdAt.
>
> - Click View Ticket.
>
> - Verify the created Ticket Detail is rendered.
>
> - Verify the Ticket is owned by the selected requester.
>
> - Switch requester context and verify the non-owner cannot retrieve it.
>
> Complete the BR-01 integration test by asserting:
>
> all concurrent creates succeed
> all numbers are unique
> sorted sequence numbers are contiguous
> each number's year equals its persisted createdAt UTC year
> the first Ticket in a new UTC year receives 000001
> a failed post-allocation insertion leaves no sequence gap
>
> Update the tests.md status and evidence references accordingly.
>
> Non-blocking follow-ups
>
> These items may be approved with a documented follow-up once the blockers above are resolved.
>
> Follow-up 1: Exact Content-Type parsing
>
> The current check uses:
>
> contentType.toLowerCase().startsWith("application/json")
>
> This also accepts invalid media types such as:
>
> application/json-invalid
>
> Prefer exact media-type parsing while allowing valid parameters such as:
>
> application/json; charset=utf-8
>
> Follow-up 2: Ticket Detail unexpected-failure Retry action
>
> The Ticket Detail failure state currently provides only:
>
> Back to My Tickets
>
> The UI specification calls for a manual Retry action for unexpected network or 500 failures.
>
> Follow-up 3: Active attachment controls
>
> The detail screen lists active and removed attachments, but active attachments currently expose only an Active label.
>
> Preview, Download, Remove, and Add Attachment controls can remain in the downstream attachment issue, but the partial status should be documented consistently so the screen is not described as the fully completed Ticket Detail attachment UI.
>
> Recommendation
>
> Most earlier implementation defects are fixed, but the strict reference-ID contract and the required real integration/E2E evidence remain incomplete.
>
> Request changes before merge.

#### My review comment 3 — Changes requested

> Re-review verdict
>
> Request changes.
>
> Re-reviewed PR #25 at head 9efb220293891a9f0b577d7b0cb473ae5c65bd3e against Issue #13 and the frozen Lab 2 contracts.
>
> The latest commits resolve almost all previously reported findings:
>
> - Ticket-number allocation and Ticket insertion are atomic.
>
> - Ticket Number year and createdAt use one authoritative database timestamp.
>
> - Reference failures create no Ticket.
>
> - Real database tests now cover normalization, ownership, defaults, and Ticket Detail ownership.
>
> - Concurrent HTTP creates are checked for uniqueness, contiguity, and persisted-year agreement.
>
> - Post-allocation rollback is tested.
>
> - The success panel, Ticket Date formatting, View Ticket flow, and Ticket Detail rendering have component-level coverage.
>
> - Exact JSON media-type parsing has been corrected.
>
> - Ticket Detail now has a manual Retry action.
>
> The following remaining findings are not minor or nit-level because they affect valid API requests or an explicit Issue #13 acceptance criterion.
>
> Remaining blockers
>
> 1. [P1] A valid request containing an ignored nested object can return 500 INTERNAL_ERROR
>
> Files:
>
> - server/src/integer-validation.ts
>
> - server/src/controller.ts
>
> The API contract states that unknown JSON properties are ignored.
>
> The custom raw-JSON parser attempts to skip unknown nested objects using this structure:
>
> while (true) {
>   readString();
>   skipWhitespace();
>   pos++;
>   skipValue();
>   skipWhitespace();
>
>   if (rawBody[pos] === ",") pos++;
>   else break;
> }
>
> After consuming a comma inside a nested object, the loop immediately calls readString() again without first calling skipWhitespace().
>
> As a result, this valid request can throw from readString():
>
> {
>   "ignored": {
>     "a": 1,
>     "b": 2
>   },
>   "categoryId": 1,
>   "relatedSystemId": 1,
>   "summary": "Valid summary",
>   "description": "Valid description text",
>   "requestedPriority": "MEDIUM"
> }
>
> Execution inside the ignored object is:
>
> read "a"
> skip value 1
> consume comma
> current character is whitespace/newline
> call readString()
> throw "Expected quote"
>
> The walking phase is not protected by a local error handler. The exception reaches the generic createTicketHandler() catch and produces:
>
> {
>   "error": {
>     "code": "INTERNAL_ERROR",
>     "message": "An unexpected error occurred."
>   }
> }
>
> This violates the contract in two ways:
>
> - The unknown ignored property is not safely ignored.
>
> - A valid request returns 500.
>
> Required change
>
> At minimum, whitespace must be skipped before reading every nested object key:
>
> while (true) {
>   skipWhitespace();
>   readString();
>
>   // ...
> }
>
> The complete custom walk should also be protected so that parser implementation errors cannot turn valid JSON into an unexpected 500.
>
> Add endpoint tests for valid requests containing:
>
> {
>   "ignored": {
>     "a": 1,
>     "b": 2
>   }
> }
>
> and a pretty-printed nested value such as:
>
> {
>   "ignored": {
>     "nested": {
>       "x": 1,
>       "y": 2
>     }
>   }
> }
>
> Also cover an array containing multi-property objects:
>
> {
>   "ignored": [
>     {
>       "a": 1,
>       "b": 2
>     }
>   ]
> }
>
> All must reach normal Ticket validation/creation without returning 500.
>
> 2. [P1] The required cross-feature E2E test is still absent
>
> Files:
>
> - docs/lab-02/tests.md
>
> - repository test structure
>
> Issue #13 explicitly requires:
>
> Unit, component/UI, API, integration, and cross-feature E2E tests
>
> The new component tests successfully cover:
>
> Create Ticket
> → mocked create response
> → success panel
> → View Ticket
> → mocked detail response
> → detail rendering
>
> However, both createTicket() and fetchTicketDetail() are mocked. This is component-level coverage, not cross-feature E2E coverage.
>
> The current repository has no e2e/ test directory or Playwright test implementation, and the E2E rows in docs/lab-02/tests.md remain Planned.
>
> Therefore, the required real flow is still unverified:
>
> real client
> → real server
> → real database
> → requester selection
> → Ticket creation
> → persisted Ticket Number and Ticket Date
> → View Ticket
> → owned Ticket Detail
>
> Required change
>
> Add a cross-feature E2E test, for example:
>
> e2e/lab-02/create-to-detail.spec.ts
>
> The test should:
>
> - Start the real client and server against an isolated test database.
>
> - Select an active Development Requester.
>
> - Navigate to Create Ticket.
>
> - Submit valid Category, Related System, Summary, Description, and Priority values.
>
> - Verify the success panel shows a backend-generated Ticket Number.
>
> - Verify Ticket Date is rendered from backend createdAt.
>
> - Click View Ticket.
>
> - Verify the same Ticket Number, Summary, Description, Category, Related System, Requester, Priority, and status are shown.
>
> - Verify the Ticket exists in the database with the selected requester as owner.
>
> - Attempt retrieval under another requester and verify 404 NOT_FOUND.
>
> The E2E test and result must be recorded in docs/lab-02/tests.md.
>
> If cross-feature E2E is intentionally owned by a later issue, Issue #13’s Acceptance Criteria must be formally amended before this PR can satisfy its current contract.
>
> 3. [P2] The real 5-character Summary boundary test does not use a 5-character Summary
>
> File:
>
> - server/tests/lab-02/create-ticket-real-db.integration.test.ts
>
> The test is named:
>
> "accepts summary with 5 characters after trim"
>
> but sends:
>
> summary: `${TEST_MARKER}5`
>
> TEST_MARKER is:
>
> "INT-TEST-REAL-DB"
>
> Therefore, the submitted Summary is much longer than 5 characters.
>
> The mocked controller test accepts a mocked service result, so it also does not execute the production validator for the exact 5-character accepted boundary.
>
> The Acceptance Criteria explicitly require coverage of:
>
> 4 / 5 / 120 / 121
>
> Required change
>
> Use an actual 5-character value:
>
> summary: "abcde"
>
> Then query the persisted Ticket and verify:
>
> expect(ticket?.summary).toBe("abcde");
>
> Use another unique field or retain the returned Ticket Number for cleanup.
>
> 4. [P2] The real boundary suite leaves an accepted Ticket behind
>
> File:
>
> - server/tests/lab-02/create-ticket-real-db.integration.test.ts
>
> The suite cleanup deletes only Tickets whose Summary contains:
>
> TEST_MARKER
>
> However, the accepted 120-character Summary test creates:
>
> summary: "a".repeat(120)
>
> That Summary does not contain TEST_MARKER, so the Ticket is not deleted by:
>
> await prisma.ticket.deleteMany({
>   where: {
>     summary: {
>       contains: TEST_MARKER,
>     },
>   },
> });
>
> Each test run can leave another Ticket in the shared integration database and advance the yearly Ticket sequence.
>
> Required change
>
> Track every created Ticket ID or Ticket Number and delete those exact rows in cleanup.
>
> For example:
>
> const createdTicketNumbers: string[] = [];
>
> createdTicketNumbers.push(res.body.data.ticketNumber);
>
> afterAll(async () => {
>   await prisma.ticket.deleteMany({
>     where: {
>       ticketNumber: {
>         in: createdTicketNumbers,
>       },
>     },
>   });
> });
>
> This avoids relying on business-field marker strings for cleanup.
>
> Non-blocking follow-ups
>
> The following may be handled after approval once the blockers above are resolved.
>
> Follow-up 1: Duplicate API-TKT-06 matrix entry
>
> docs/lab-02/tests.md currently contains the API-TKT-06 row twice. Remove the duplicate to avoid conflicting future status updates.
>
> Follow-up 2: CI evidence
>
> No GitHub workflow run or status check is visible for this head.
>
> The repository now has substantial database-backed integration coverage, so adding CI with an isolated PostgreSQL service would make the results independently reproducible during review.
>
> Follow-up 3: Standalone allocator exhaustion
>
> The production create path safely rolls back an exhausted sequence inside its transaction.
>
> The standalone test helper path can still update a sequence to 1000000 before throwing when called without an enclosing transaction. Bounding the SQL update would make the allocator safe in all call paths.
>
> Overall assessment
>
> The implementation is now materially stronger and most previous blockers have been resolved.
>
> The remaining blockers are narrowly scoped:
>
> - valid JSON with an ignored multi-property object can produce 500
>
> - the explicitly required cross-feature E2E test is still missing
>
> After those are corrected, the remaining boundary-test and cleanup issues are straightforward.
>
> Recommendation: Request changes before merge.

#### My review comment 4 — Changes requested

> Re-review verdict
>
> Request changes.
>
> Re-reviewed PR #25 at head 8a060d0869c18b9cc95ab5dc3b6b70db755354a9 against the live Issue #13 and the frozen Lab 2 contracts.
>
> The latest commit correctly resolves the previous findings concerning:
>
> - ignored multi-property nested JSON objects
>
> - pretty-printed nested JSON objects
>
> - nested arrays containing objects
>
> - the exact 5-character Summary boundary
>
> - cleanup of created Ticket rows by Ticket Number
>
> - duplicate API-TKT-06 documentation rows
>
> Scope note
>
> The acceptance criteria included in the review request are no longer identical to the live GitHub Issue #13.
>
> On August 26, 2026, Issue #13 was amended so that cross-feature browser E2E is owned by Issue #18. The live Issue #13 now requires:
>
> Unit, component/UI, API, and integration tests
>
> rather than:
>
> Unit, component/UI, API, integration, and cross-feature E2E tests
>
> This review follows the live GitHub issue.
>
> If the acceptance-criteria snapshot supplied in the review request is intended to override the live issue, the missing cross-feature E2E flow remains an additional blocker.
>
> Remaining blockers
>
> 1. [P1] Real-database tests delete Tickets but permanently advance TicketSequence
>
> Files:
>
> - server/tests/lab-02/create-ticket-real-db.integration.test.ts
>
> - server/tests/lab-02/create-ticket-reference-validation.integration.test.ts
>
> - server/tests/lab-02/ticket-number-concurrency.integration.test.ts
>
> - server/src/service.ts
>
> - server/src/ticket-number.ts
>
> The new cleanup correctly tracks and deletes created Ticket rows:
>
> const createdTicketNumbers: string[] = [];
>
> await prisma.ticket.deleteMany({
>   where: {
>     ticketNumber: {
>       in: createdTicketNumbers,
>     },
>   },
> });
>
> However, every successful call to POST /api/tickets also increments the current UTC year's TicketSequence.
>
> Deleting the Ticket row does not roll back or restore that sequence allocation.
>
> create-ticket-real-db.integration.test.ts creates multiple successful Tickets for:
>
> - trimmed Summary persistence
>
> - trimmed Description persistence
>
> - 5-character Summary
>
> - 120-character Summary
>
> - 10-character Description
>
> - 2,000-character Description
>
> - ownership
>
> - default values
>
> - Ticket Detail ownership setup
>
> create-ticket-reference-validation.integration.test.ts also performs a successful create and then deletes only the Ticket.
>
> After the suites complete, the database can contain:
>
> Ticket rows created by the tests: 0
> TicketSequence increment caused by the tests: approximately 10+
>
> This permanently mutates the database and consumes official Ticket Numbers on every test run.
>
> The dedicated ticket-number suite snapshots and restores TicketSequence, but it restores the state observed at the beginning of its own file. It cannot undo allocations leaked by another test file before its snapshot, and later test files can still advance the sequence after it restores.
>
> Why this matters
>
> These integration tests use the configured real DATABASE_URL, not a transactionally isolated in-memory database.
>
> Running the tests against a developer or shared test database therefore changes official allocation state even though the test Ticket rows are removed.
>
> It can also create apparent sequence gaps:
>
> Last persisted real Ticket: TKT-2026-000100
>
> Run integration suite:
>   allocate 000101 through 000110
>   delete all test Tickets
>   leave TicketSequence at 000110
>
> Next real Ticket:
>   TKT-2026-000111
>
> Required change
>
> Use one of these approaches:
>
> Option A — dedicated disposable test database
>
> Run DB integration tests only against an isolated database that is created/reset for the test run and never shared with development data.
>
> Option B — snapshot and restore sequence state
>
> Before the suite creates any Ticket:
>
> const utcYear = new Date().getUTCFullYear();
>
> const originalSequence = await prisma.ticketSequence.findUnique({
>   where: { year: utcYear },
> });
>
> After deleting every created Ticket:
>
> await prisma.ticketSequence.deleteMany({
>   where: { year: utcYear },
> });
>
> if (originalSequence) {
>   await prisma.ticketSequence.create({
>     data: originalSequence,
>   });
> }
>
> Because these files share the same mutable database, keep them serialized and ensure no other suite or process writes Tickets during the snapshot/restore window.
>
> Add a final assertion:
>
> expect(
>   await prisma.ticketSequence.findUnique({
>     where: { year: utcYear },
>   }),
> ).toEqual(originalSequence);
>
> The same protection is required in every real-DB suite that performs successful Ticket creation.
>
> 2. [P1] Well-formed positive IDs outside the supported numeric range do not follow the frozen error matrix
>
> Files:
>
> - server/src/integer-validation.ts
>
> - server/src/service.ts
>
> - server/src/requester-context.ts
>
> - server/prisma/schema.prisma
>
> - docs/lab-02/api-spec.md §0
>
> The raw integer validator accepts any number of decimal digits:
>
> /^(?:0|[1-9]\d*)$/
>
> No upper bound is enforced.
>
> The parsed request is then represented using a JavaScript number:
>
> categoryId: input.categoryId as number
> relatedSystemId: input.relatedSystemId as number
>
> The database fields are Prisma Int values backed by PostgreSQL integer columns.
>
> This creates two incorrect paths.
>
> Reference-ID path
>
> Consider a valid JSON integer consisting of hundreds of digits:
>
> {
>   "categoryId": 1000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000,
>   "relatedSystemId": 1,
>   "summary": "Valid summary",
>   "description": "Valid description text",
>   "requestedPriority": "MEDIUM"
> }
>
> The raw token matches the frozen decimal grammar:
>
> 0|[1-9][0-9]*
>
> It is positive and cannot correspond to an existing Category.
>
> The frozen matrix therefore classifies it as:
>
> 409 INACTIVE_REFERENCE
>
> However, normal JSON parsing converts the value to a JavaScript Number. A sufficiently large value becomes non-finite, and the production validator reaches:
>
> !Number.isInteger(input.categoryId)
>
> It consequently returns:
>
> 400 VALIDATION_ERROR
>
> That contradicts the contract's distinction between:
>
> malformed/non-integer → 400
> well-formed positive but nonexistent → 409
>
> A smaller out-of-range value such as:
>
> 2147483648
>
> is still a JavaScript integer but cannot be represented by the PostgreSQL integer field. It is forwarded to the Prisma lookup without an explicit contract mapping.
>
> Requester-header path
>
> getRequesterIdFromHeaders() validates only the digit grammar:
>
> /^(?:[1-9][0-9]*)$/
>
> and then calls:
>
> return Number(value);
>
> A sufficiently large digit string becomes a non-finite or lossy JavaScript number but is not rejected by getRequesterIdFromHeaders().
>
> It is forwarded to:
>
> isActiveDevRequester(requesterId)
>
> Any Prisma conversion/range error falls into the generic handler:
>
> 500 INTERNAL_ERROR
>
> The requester-context contract requires an unknown or unusable requester ID to return:
>
> 422 REQUESTER_CONTEXT_INVALID
>
> Required change
>
> The API contract needs one deterministic numeric-domain rule.
>
> Contract-preserving option
>
> Parse the exact raw token using BigInt before converting it to number.
>
> For reference IDs:
>
> malformed, signed, decimal, exponent, zero, or negative
> → 400 VALIDATION_ERROR
>
> positive and greater than the maximum representable database ID
> → 409 INACTIVE_REFERENCE
>
> For X-Dev-Requester-Id:
>
> positive but outside the supported requester-ID domain
> → 422 REQUESTER_CONTEXT_INVALID
>
> Only convert to number after confirming the value is representable.
>
> Alternative option
>
> Freeze an explicit maximum ID in api-spec.md and specify that values above it return 400 VALIDATION_ERROR.
>
> This requires a contract amendment because the current frozen matrix does not define that upper bound.
>
> Add endpoint tests for both categoryId and relatedSystemId using:
>
> 2147483647
> 2147483648
> 9007199254740993
> a plain decimal integer large enough to exceed Number.MAX_VALUE
>
> Also add requester-header tests for the same boundary classes.
>
> 3. [P2] The production validator test matrix is still incomplete while its rows are marked Passed
>
> Files:
>
> - server/tests/lab-02/create-ticket-normalization.api.test.ts
>
> - server/tests/lab-02/create-ticket.api.test.ts
>
> - server/tests/lab-02/create-ticket-real-db.integration.test.ts
>
> - docs/lab-02/tests.md
>
> The real-database tests now correctly cover:
>
> - Summary and Description normalization
>
> - Summary and Description boundaries
>
> - whitespace-only values
>
> - ownership
>
> - null defaults
>
> - active/inactive/nonexistent references
>
> - Ticket Detail ownership
>
> However, some production validation behavior remains covered only by tests that mock createTicket().
>
> Missing direct relatedSystemId matrix cases
>
> create-ticket-normalization.api.test.ts covers the following for categoryId:
>
> missing
> non-integer/string
> zero
> negative
> nonexistent
> inactive
>
> For relatedSystemId, it covers only:
>
> missing
> nonexistent
> inactive
>
> There are no direct cases for:
>
> relatedSystemId: "abc"
> relatedSystemId: 1.5
> relatedSystemId: 0
> relatedSystemId: -1
>
> The current tests also program the mocked service to return the desired ValidationError, so these cases would not execute the production validator even if added to that same mocked pattern.
>
> Requested Priority remains mock-only
>
> The tests for:
>
> missing requestedPriority
> invalid requestedPriority
> LOW
> MEDIUM
> HIGH
>
> replace createTicket() with a mock.
>
> They prove controller response mapping but do not prove the real implementation of:
>
> VALID_PRIORITIES.includes(input.requestedPriority)
>
> Why this matters
>
> The live Issue #13 final acceptance criterion requires automated tests to cover validators, and tests.md marks API-TKT-NOR-02 and API-TKT-07 as Passed.
>
> The executable evidence does not yet cover the full production validator matrix described by those rows.
>
> Required change
>
> Extract and export the pure request validator, for example:
>
> export function validateCreateTicketInput(
>   input: CreateTicketInput,
> ): ValidatedCreateTicketInput
>
> Add a unit test that invokes the real validator without Prisma and parameterizes both reference fields:
>
> it.each([
>   ["categoryId", undefined],
>   ["categoryId", "abc"],
>   ["categoryId", 1.5],
>   ["categoryId", 0],
>   ["categoryId", -1],
>   ["relatedSystemId", undefined],
>   ["relatedSystemId", "abc"],
>   ["relatedSystemId", 1.5],
>   ["relatedSystemId", 0],
>   ["relatedSystemId", -1],
> ])(...)
>
> Also test the real priority validator:
>
> missing  → rejected
> URGENT   → rejected
> LOW      → accepted
> MEDIUM   → accepted
> HIGH     → accepted
>
> The controller-level mocked tests may remain, but they should not be the sole evidence for these validator rows.
>
> 4. [P2] A repository-wide review workflow was added outside Issue #13's feature scope
>
> File:
>
> - .agents/skills/review-pr/SKILL.md
>
> The latest commit adds a 114-line auto-triggered PR-review workflow:
>
> name: review-pr
> description: "Use when: reviewing a PR for merge readiness..."
>
> This change is not traceable to any Issue #13 FR, BR, AC, schema requirement, API requirement, UI requirement, or test requirement.
>
> It changes repository-level agent behavior rather than implementing Ticket Creation.
>
> The repository working agreement states that out-of-scope work should use a separate branch/worktree and that new workflow/governance obligations should be isolated from feature implementation.
>
> The new skill also instructs agents to read:
>
> AGENTS.md
>
> but this repository's working agreement is:
>
> agent.md
>
> Therefore, the newly introduced workflow does not even read the actual governance file it claims to validate.
>
> The PR description also does not document this new repository-wide workflow.
>
> Required change
>
> Remove from this feature PR:
>
> .agents/skills/review-pr/SKILL.md
>
> and the associated scratch-file .gitignore change if it exists only for this workflow.
>
> Create a separate governance/tooling PR for the skill.
>
> In that PR:
>
> - Map the skill to the governance issue.
>
> - Change AGENTS.md to agent.md.
>
> - Verify the referenced GitHub tool names exist in the intended agent environment.
>
> - Document the new automatic trigger behavior.
>
> - Test the skill against at least one real PR review.
>
> This is not a formatting nit because the file introduces an automatically triggered repository-wide workflow.
>
> Non-blocking follow-ups
>
> The following may be approved with a later fix after the blockers above are resolved.
>
> Follow-up 1: README contradicts itself about Ticket Detail
>
> The implemented section says:
>
> Create Ticket form + Ticket Detail view
>
> The not-yet-implemented section then says:
>
> My Tickets and Ticket Detail UI
>
> Clarify whether this means:
>
> basic Ticket Detail view implemented
> full attachment-enabled Ticket Detail UI deferred to Issue #15
>
> The repository tree in README should also include newly added files such as:
>
> client/src/format.ts
> server/src/integer-validation.ts
> create-ticket-real-db.integration.test.ts
> integer-validation.api.test.ts
>
> Follow-up 2: CI evidence
>
> No workflow runs or status checks are attached to the current head.
>
> The Results Log records passing local tests, but a GitHub workflow with an isolated PostgreSQL service would make the integration evidence independently reproducible.
>
> Follow-up 3: Reference-activity race
>
> The create transaction reads Category.isActive and RelatedSystem.isActive, but it does not lock either row.
>
> A concurrent deactivation can occur after validation and before Ticket insertion.
>
> There is no reference-management endpoint in the current Lab 2 slice, so this is not an immediate blocker, but row locking or serializable isolation should be considered before reference records become mutable through the application.
>
> Overall assessment
>
> The implementation is now substantially stronger, and all previously reported normal-path defects have been addressed.
>
> The remaining merge blockers are:
>
> - real-DB tests leak yearly TicketSequence state
>
> - very large, well-formed IDs do not have a contract-defined runtime mapping
>
> - some validator rows are marked Passed without executing the complete production validator matrix
>
> - a repository-wide review skill is bundled into an unrelated feature PR
>
> Recommendation: Request changes before merge.

#### My review comment 5 — Changes requested

> Re-review verdict
>
> Request changes.
>
> Re-reviewed PR #25 at head 9d0bb21a1ee60eb86aa5ba73e27b7402b91a1e63 against the live Issue #13 and the frozen Lab 2 contracts.
>
> The latest commits correctly address several previous findings:
>
> - unknown multi-property nested objects no longer trigger the known parser failure
>
> - pretty-printed nested objects and arrays now have parser coverage
>
> - the real 5-character Summary test now submits exactly five characters
>
> - accepted Ticket rows are tracked for cleanup by Ticket Number
>
> - the duplicate API-TKT-06 documentation row was removed
>
> - Ticket Detail unexpected failures now expose a manual Retry action
>
> The PR is materially stronger, but the remaining findings below are not minor or nit-level.
>
> Scope note
>
> The acceptance criteria pasted into this review still require cross-feature E2E coverage.
>
> The live GitHub Issue #13 was amended on August 26, 2026 so that cross-feature E2E is owned by Issue #18. Under the live issue, E2E is not a blocker for PR #25.
>
> If the pasted acceptance-criteria snapshot is intended to override the live issue, the missing real browser create-to-detail E2E flow remains an additional merge blocker.
>
> Remaining blockers
>
> 1. [P1] TicketSequence cleanup is still not applied to the complete real-database test file
>
> Files:
>
> - server/tests/lab-02/create-ticket-real-db.integration.test.ts
>
> - server/tests/lab-02/test-ticket-sequence-cleanup.test.ts
>
> - server/src/prisma.ts
>
> The sequence snapshot and restore are scoped only to:
>
> describe("API-TKT-INT-02: Real normalization and persistence", ...)
>
> That suite snapshots the current-year sequence in its own beforeAll() and restores it in its own afterAll().
>
> However, the same file later contains separate suites:
>
> describe("API-TKT-INT-03: Real ownership and defaults", ...)
> describe("API-TKT-INT-04: Real Ticket Detail ownership enforcement", ...)
>
> Those suites create successful Tickets after the first suite has completed its restore.
>
> Their cleanup deletes Ticket rows:
>
> await prisma.ticket.deleteMany({
>   where: {
>     ticketNumber: {
>       in: createdTicketNumbers,
>     },
>   },
> });
>
> but does not restore TicketSequence.
>
> Therefore, the file can still finish with:
>
> test Ticket rows deleted
> current-year TicketSequence advanced
>
> The newly added:
>
> server/tests/lab-02/test-ticket-sequence-cleanup.test.ts
>
> does not catch this defect. It tests an isolated snapshot/allocate/restore pattern; it does not execute create-ticket-real-db.integration.test.ts and compare the database state before and after that complete file.
>
> There is also a DB-gating bug in the new cleanup test:
>
> const prisma = getPrisma();
>
> runs at module-import time, before:
>
> if (!process.env.DATABASE_URL) return;
>
> getPrisma() throws when DATABASE_URL is absent, so a clean environment cannot skip this integration test safely.
>
> Required change
>
> Move the sequence snapshot and restore to a hook that encloses every Ticket-creating suite in the file.
>
> For example:
>
> let currentYear: number;
> let originalSequence: {
>   year: number;
>   lastSeq: number;
> } | null = null;
>
> beforeAll(async () => {
>   if (!process.env.DATABASE_URL) return;
>
>   const prisma = getPrisma();
>   const rows = await prisma.$queryRaw<Array<{ now: Date }>>`
>     SELECT NOW() AS "now"
>   `;
>
>   currentYear = rows[0]!.now.getUTCFullYear();
>
>   originalSequence = await prisma.ticketSequence.findUnique({
>     where: { year: currentYear },
>   });
> });
>
> afterAll(async () => {
>   if (!process.env.DATABASE_URL) return;
>
>   const prisma = getPrisma();
>
>   await prisma.ticket.deleteMany({
>     where: {
>       ticketNumber: {
>         in: createdTicketNumbers,
>       },
>     },
>   });
>
>   await prisma.ticketSequence.deleteMany({
>     where: { year: currentYear },
>   });
>
>   if (originalSequence) {
>     await prisma.ticketSequence.create({
>       data: originalSequence,
>     });
>   }
>
>   expect(
>     await prisma.ticketSequence.findUnique({
>       where: { year: currentYear },
>     }),
>   ).toEqual(originalSequence);
>
>   await disconnectPrisma();
> });
>
> Alternatively, wrap all three groups in one outer describe() and put the shared hooks there.
>
> For test-ticket-sequence-cleanup.test.ts:
>
> - do not call getPrisma() at module scope
>
> - use itIfDb
>
> - instantiate Prisma only after confirming DATABASE_URL
>
> - verify the actual Ticket-creating suite or remove the standalone simulation
>
> A dedicated disposable test database is safer than rewinding a sequence in a shared development database.
>
> 2. [P1] Large well-formed IDs still do not follow the frozen status-code contract
>
> Files:
>
> - server/src/integer-validation.ts
>
> - server/src/service.ts
>
> - server/src/requester-context.ts
>
> - server/prisma/migrations/20260825000000_add_ticket_related_system_attachment/migration.sql
>
> - docs/lab-02/api-spec.md §0
>
> The raw validator accepts an arbitrary-length digit token:
>
> /^(?:0|[1-9]\d*)$/
>
> It does not enforce an upper bound or preserve the exact integer value after validation.
>
> The normal JSON parser then converts the token to a JavaScript number, and the production validator checks only:
>
> Number.isInteger(input.categoryId)
> Number.isInteger(input.relatedSystemId)
>
> The value is then sent directly into Prisma:
>
> tx.category.findUnique({
>   where: { id: validated.categoryId },
> });
>
> tx.relatedSystem.findUnique({
>   where: { id: validated.relatedSystemId },
> });
>
> The database columns are PostgreSQL INTEGER.
>
> This leaves several unresolved cases.
>
> Case A: database-integer overflow
>
> {
>   "categoryId": 2147483648,
>   "relatedSystemId": 1,
>   "summary": "Valid summary",
>   "description": "Valid description text",
>   "requestedPriority": "MEDIUM"
> }
>
> 2147483648 is:
>
> - a plain positive integer token
>
> - accepted by the raw lexical validator
>
> - accepted by Number.isInteger()
>
> - outside the PostgreSQL INTEGER domain
>
> No application branch maps this condition to the contract-defined:
>
> 409 INACTIVE_REFERENCE
>
> A Prisma/database conversion failure instead falls into the generic:
>
> 500 INTERNAL_ERROR
>
> Case B: JavaScript precision loss
>
> {
>   "categoryId": 9007199254740993,
>   ...
> }
>
> This value cannot be represented exactly as a JavaScript number.
>
> The raw token is valid, but the parsed value can differ from what the client submitted before the database lookup occurs.
>
> Case C: extremely large plain integer
>
> A sufficiently long plain decimal token can become non-finite after normal JSON parsing.
>
> The service then treats it as:
>
> !Number.isInteger(value)
>
> and returns:
>
> 400 VALIDATION_ERROR
>
> The frozen matrix says a well-formed positive but nonexistent reference returns:
>
> 409 INACTIVE_REFERENCE
>
> Requester header has the same domain problem
>
> getRequesterIdFromHeaders() accepts any positive digit string:
>
> /^(?:[1-9][0-9]*)$/
>
> and then performs:
>
> return Number(value);
>
> A very large header can become lossy or non-finite before being passed to Prisma. An unexpected Prisma error is mapped to:
>
> 500 INTERNAL_ERROR
>
> rather than the requester-context contract:
>
> 422 REQUESTER_CONTEXT_INVALID
>
> Required change
>
> Preserve and classify the exact integer token before converting it to number.
>
> A suitable approach is:
>
> const exactValue = BigInt(rawToken);
> const maxDatabaseId = 2147483647n;
>
> For categoryId and relatedSystemId under the current contract:
>
> invalid lexical form / zero / negative
> → 400 VALIDATION_ERROR
>
> positive value greater than the supported database ID domain
> → 409 INACTIVE_REFERENCE
>
> positive representable value that does not exist or is inactive
> → 409 INACTIVE_REFERENCE
>
> For X-Dev-Requester-Id:
>
> invalid lexical form or value outside the supported ID domain
> → 422 REQUESTER_CONTEXT_INVALID
>
> Only convert to number after confirming the value is within the database domain.
>
> Add endpoint tests for both reference fields and the requester header using:
>
> 2147483647
> 2147483648
> 9007199254740993
> a very long plain decimal integer
>
> If out-of-range positive values are intended to return 400 instead, amend the frozen API contract first. The current contract classifies positive nonexistent references as 409.
>
> 3. [P2] Required validator coverage is still partially mocked
>
> Files:
>
> - server/src/service.ts
>
> - server/tests/lab-02/create-ticket-normalization.api.test.ts
>
> - server/tests/lab-02/create-ticket.api.test.ts
>
> - server/tests/lab-02/create-ticket-real-db.integration.test.ts
>
> - docs/lab-02/tests.md
>
> The new real-database suite now covers Summary and Description normalization and boundaries.
>
> However, some validator rows marked Passed still do not execute the production validator.
>
> relatedSystemId matrix is incomplete
>
> The mocked normalization suite covers these Category cases:
>
> missing
> string/non-integer
> zero
> negative
> nonexistent
> inactive
>
> For relatedSystemId, it covers only:
>
> missing
> nonexistent
> inactive
>
> It does not directly cover:
>
> relatedSystemId: "abc"
> relatedSystemId: 1.5
> relatedSystemId: 0
> relatedSystemId: -1
>
> The tests also mock createTicket(), so they verify only controller error mapping.
>
> Requested Priority validation remains mock-only
>
> The tests for:
>
> missing requestedPriority
> requestedPriority: URGENT
> LOW
> MEDIUM
> HIGH
>
> program the mocked createTicket() function to return the desired success or error.
>
> They do not execute:
>
> VALID_PRIORITIES.includes(input.requestedPriority)
>
> in the production validator.
>
> The live Issue #13 explicitly requires Unit tests covering validators.
>
> Required change
>
> Export the pure validator:
>
> export function validateCreateTicketInput(
>   input: CreateTicketInput,
> ): ValidatedCreateTicketInput
>
> Add a unit test invoking the real function:
>
> it.each([
>   ["categoryId", undefined],
>   ["categoryId", "abc"],
>   ["categoryId", 1.5],
>   ["categoryId", 0],
>   ["categoryId", -1],
>
>   ["relatedSystemId", undefined],
>   ["relatedSystemId", "abc"],
>   ["relatedSystemId", 1.5],
>   ["relatedSystemId", 0],
>   ["relatedSystemId", -1],
> ])(...)
>
> Also test production priority validation:
>
> missing → rejected
> URGENT  → rejected
> LOW     → accepted
> MEDIUM  → accepted
> HIGH    → accepted
>
> Keep the mocked controller tests for response mapping, but do not use them as the sole evidence for validator behavior.
>
> Update tests.md references so each Passed row points to the test that executes the real validator.
>
> 4. [P2] Repository-wide governance and debug tooling remain bundled into the Ticket Creation feature PR
>
> Files:
>
> - .agents/skills/review-pr/SKILL.md
>
> - agent.md
>
> - server/debug-integer.cjs
>
> - server/test-edge-cases.js
>
> - PR description
>
> The new review skill is a repository-wide workflow, not part of Ticket Creation.
>
> It also contains conflicting review instructions.
>
> The skill description says it validates acceptance criteria, but its body states:
>
> Do not fetch linked issues or acceptance criteria.
> The review is based solely on the latest request change comment.
>
> The repository's actual agent.md requires the opposite:
>
> Read the governing requirements and the current issue first.
>
> The skill also refers to:
>
> AGENTS.md
>
> while this repository uses:
>
> agent.md
>
> Its behavior would prevent:
>
> - an initial review when no previous change-request review exists
>
> - detecting new acceptance-criteria regressions not mentioned in the latest review
>
> - validating the PR against its linked issue
>
> agent.md also now contains a PR-specific status section:
>
> PR #25 Status Summary
> Status: All P1 blockers resolved, ready for merge
>
> A repository working agreement should not contain temporary self-approval state for one open PR.
>
> The Issue #13 optional-maintenance clause requires every agent.md change to be documented in the PR description. The PR description currently does not document these changes.
>
> The following are also scratch/debug artifacts rather than automated tests:
>
> server/debug-integer.cjs
> server/test-edge-cases.js
>
> They:
>
> - depend on an existing compiled dist directory
>
> - use console output instead of assertions
>
> - are not wired into npm test
>
> - duplicate implementation logic
>
> - are not part of Issue #13 acceptance criteria
>
> Required change
>
> Remove from PR #25:
>
> .agents/skills/review-pr/SKILL.md
> server/debug-integer.cjs
> server/test-edge-cases.js
>
> Remove the PR-specific status section from agent.md.
>
> Create a separate governance/tooling PR for the review skill if it is still desired.
>
> That separate PR should:
>
> - use agent.md, not AGENTS.md
>
> - read the linked issue and governing contracts
>
> - support initial reviews without requiring a previous change request
>
> - avoid limiting review scope to the latest comment
>
> - document and test the automatic trigger behavior
>
> If any agent.md modification remains in PR #25, document it explicitly in the PR description as required by Issue #13.
>
> Non-blocking follow-ups
>
> README status wording
>
> The README currently self-declares:
>
> All P1 blockers resolved, ready for merge
>
> Merge readiness should come from review/status evidence, not a feature branch's README.
>
> It also lists Ticket Detail UI as both implemented and not yet implemented. Clarify:
>
> basic create-to-detail view implemented
> full attachment-enabled Ticket Detail deferred to Issue #15
>
> CI evidence
>
> No GitHub status checks or workflow runs are visible for the current head. The recorded local test counts therefore have not been independently reproduced in the PR.
>
> Reference activity race
>
> Category and Related System activity are checked inside the Ticket transaction, but their rows are not locked. This can be revisited before reference records become mutable through application endpoints.
>
> Overall assessment
>
> The implementation now satisfies most normal Ticket Creation behavior, and the previously identified nested-object parser defects are corrected.
>
> The remaining merge blockers are:
>
> - incomplete TicketSequence restoration and a DB-gating defect in the new cleanup test
>
> - undefined behavior for large, well-formed IDs
>
> - incomplete production-validator test coverage
>
> - repository-wide governance and debug tooling bundled into the feature PR
>
> Recommendation: Request changes before merge.

#### My review comment 6 — Approved

> Review Verdict
>
> Approved
>
> No remaining production-code blocker found. The remaining items are test/evidence hardening and can be completed as follow-up.
>
> Follow-up
>
> - Run the modified real-DB suites together and record the results in docs/lab-02/tests.md.
>
> - Confirm TicketSequence is unchanged before/after the test run.
>
> - Reuse the snapshotted UTC year during sequence cleanup.
>
> - Track created Ticket Numbers immediately after successful creation.
>
> - Strengthen duplicate-submit test to verify createTicket is called exactly once.
>
> - Clean up the remaining README wording around Ticket Detail scope.

#### Partner's response

> I have fixed it now.

### PR #28 — feat: implement My Tickets feature (#14)

#### My review comment 1 — Changes requested

> Review Verdict
>
> Request changes.
>
> Reviewed PR #28 at head 1a70c7dab43831d82356b88fe6b520a00ebbe861 against Issue #14 and the Lab 2 contracts.
>
> Cross-feature E2E remains owned by Issue #18 and is not a blocker for this PR.
>
> Blocking Findings
>
> 1. [P1] My Tickets response does not match the API contract
>
> Files:
>
> - server/src/service.ts
>
> - client/src/api.ts
>
> - docs/lab-02/api-spec.md §5
>
> The My Tickets response is missing:
>
> itPriority
>
> and adds the undocumented field:
>
> requesterId
>
> Add itPriority: string | null to the SQL query, service response, and client type. Remove requesterId unless the API contract is formally amended.
>
> Add an exact response-shape test.
>
> 2. [P1] Search treats % and _ as SQL wildcards
>
> File:
>
> - server/src/service.ts
>
> The current query uses:
>
> ILIKE `%${params.search}%`
>
> A search for % can therefore match every Ticket instead of searching for a literal %.
>
> BR-23 requires case-insensitive literal substring matching.
>
> Escape SQL LIKE metacharacters or use a literal substring operation such as:
>
> POSITION(LOWER($1) IN LOWER(column)) > 0
>
> Add real-database tests for literal:
>
> %
> _
> \
>
> 3. [P1] An older request can overwrite newer My Tickets results
>
> File:
>
> - client/src/MyTickets.tsx
>
> Every search, filter, sort, and page change starts a new asynchronous request.
>
> There is no:
>
> AbortController
> request ID guard
> stale-response check
>
> A slow old request can finish after a newer request and replace the correct results.
>
> Add an abort controller or monotonically increasing request ID. Add a UI test where two requests resolve in reverse order and verify only the newest response is rendered.
>
> 4. [P1] Large finite page values can cause an invalid SQL OFFSET
>
> Files:
>
> - server/src/controller.ts
>
> - server/src/service.ts
>
> The controller rejects only non-finite values.
>
> A very large but finite integer can produce an unsafe or database-invalid value here:
>
> const offset = (params.page - 1) * params.pageSize;
>
> Validate page with a safe numeric-domain check.
>
> After calculating totalPages, return:
>
> {
>   "data": [],
>   "pagination": {
>     "page": 999,
>     "totalPages": 3
>   }
> }
>
> without executing a query with a huge OFFSET when page > totalPages.
>
> Add tests around:
>
> Number.MAX_SAFE_INTEGER
> Number.MAX_SAFE_INTEGER + 1
> very large finite digit strings
>
> 5. [P1] Several Passed test rows do not fully prove their acceptance criteria
>
> Files:
>
> - server/tests/lab-02/my-tickets-real-db.integration.test.ts
>
> - client/src/lab-02-tests/MyTickets.test.tsx
>
> - docs/lab-02/tests.md
>
> Current gaps:
>
> - Summary sorting is tested only with identical Summary values, so the primary Summary sort is not proven.
>
> - Pagination checks only page lengths; returning the same rows for page 1 and page 2 would still pass.
>
> - UI-MY-05 changes Search, whose handler immediately resets page to 1; it does not exercise the intended page=3, totalPages=1 redirect branch.
>
> - The Retry test checks only that the button exists; it does not click Retry or verify that no automatic retry occurred.
>
> Required corrections:
>
> - Test distinct Summary values in ascending and descending order.
>
> - Assert exact, ordered, non-overlapping page slices.
>
> - Directly simulate an out-of-range response for the currently requested page.
>
> - Click Retry and verify exactly one additional request.
>
> - Verify no automatic retry before the button is clicked.
>
> Do not keep affected tests.md rows marked Passed until these paths are actually asserted.
>
> Non-Blocking Follow-ups
>
> - Use bounded/windowed pagination buttons; rendering every page can overflow on mobile.
>
> - Normalize whitespace-only Search on the client so it does not show Clear Filters.
>
> - Store the database UTC year captured during setup and reuse the exact year during cleanup.
>
> - Add CI or commit status checks for the real-database suite.
>
> Recommendation
>
> The implementation has a good overall structure and useful real-database coverage, but the API response contract, literal search behavior, asynchronous UI correctness, safe pagination, and acceptance evidence must be corrected before merge.
>
> Request changes before merge.

#### My review comment 2 — Changes requested

> Re-review Verdict
>
> Request changes.
>
> The five findings from the previous review have been addressed. The remaining blockers are:
>
> 1. [P1] Mobile responsive implementation still violates AC-23
>
> Files:
>
> - client/src/MyTickets.tsx
>
> - client/src/App.css
>
> Current issues:
>
> - Every page number is rendered, with no bounded/windowed pagination.
>
> - .pagination-controls does not wrap and can overflow on mobile.
>
> - .ticket-card-toggle has min-height: 36px, below the required 44px.
>
> - Mobile filter controls are not explicitly stacked vertically.
>
> Required changes
>
> - Use bounded pagination such as 1 … 4 5 6 … 20.
>
> - Add mobile-safe wrapping to .pagination-controls.
>
> - Set the mobile card toggle to at least 44px.
>
> - Stack Search, Category, Priority, and Status controls vertically on mobile.
>
> Final browser screenshots remain deferred to Issue #18, but the responsive implementation itself belongs to Issue #14.
>
> 2. [P1] tests.md still does not accurately map real-database evidence
>
> Files:
>
> - docs/lab-02/tests.md
>
> - server/tests/lab-02/my-tickets-real-db.integration.test.ts
>
> - client/src/lab-02-tests/MyTickets.test.tsx
>
> API-MY-01..08 and API-REQ-02 still cite only mocked controller test files, even though Issue #14 explicitly requires real service/database evidence.
>
> The pagination tests now prove non-overlap, but do not compare the returned pages against exact expected ordered slices.
>
> UI-MY-05 also uses inconsistent mock metadata:
>
> totalItems: 0
> totalPages: 1
>
> Required changes
>
> - Add my-tickets-real-db.integration.test.ts to the relevant matrix rows.
>
> - Use a dedicated pagination requester and compare each returned page with the exact Prisma-ordered expected slice.
>
> - Make UI-MY-05 metadata contract-consistent, for example:
>
> totalItems: 5
> totalPages: 1
>
> - Update the Results Log wording so it matches the assertions actually executed.
>
> 3. [P1] The agent.md change violates the governance-isolation rule
>
> File:
>
> - agent.md
>
> This PR adds a new mandatory workflow rule:
>
> When adding new test rows to tests.md, the initial status must be Planned...
>
> However, agent.md §4.6 requires new mandatory workflows or working-agreement rules to be isolated in a separate governance PR.
>
> Required change
>
> Remove this rule from PR #28 and move it to a dedicated governance PR.
>
> Also separate or revert unrelated frozen-contract edits in api-spec.md, specification.md, and ui-spec.md unless they are explicitly mapped to Issue #14.
>
> Non-blocking Follow-ups
>
> - Normalize Search with search.trim() on the client so whitespace-only input does not show Clear Filters.
>
> - Assert that TicketSequence was restored during integration cleanup.
>
> - Replace the hard-coded allocation year 2026 in test fixtures.
>
> - Add GitHub CI/status checks when available.
>
> Recommendation
>
> The My Tickets backend behavior is now substantially correct, but responsive AC-23 implementation, test-evidence traceability, and governance isolation must be fixed before merge.
>
> Request changes before merge.

#### My review comment 3 — Approved

> Re-review Verdict
>
> Approved with follow-up reminders.
>
> All previously blocking findings are resolved at head 1ffb1d6293d8bca51ff9f97e5f8c90c3c63b2e6c.
>
> Follow-up Reminders
>
> - Assert that TicketSequence is restored after integration-test teardown.
>
> - Replace the hard-coded allocation year 2026 with the captured database UTC year.
>
> - Track created Ticket Numbers immediately after successful fixture creation.
>
> - Update stale commit references in the PR description and tests.md.
>
> - Add or clarify the UI-MY-06 test-matrix row.
>
> - Consider narrowing the broad client/src/**/*.js .gitignore rule.
>
> - Add CI/status checks when available.
>
> Cross-feature E2E and final screenshot verification remain deferred to Issue #18.

#### Partner's responses

No response recorded.
### PR #29 — feat: Issue #15 — Attachment Lifecycle & Ticket Detail

#### My review comment 1 — Changes requested

> Review Summary
>
> Verdict: ❌ Request changes
>
> I reviewed the current PR head (9e5d41c4cdc535480152cc9c434e50ffd3514ef6) against Issue #15 and the frozen API/UI/test requirements.
>
> The PR has several solid implementations (transactional attachment limit enforcement, sequential upload orchestration, secure storage model, etc.), but there are still acceptance-level issues that prevent approval.
>
> Blocking Findings
>
> 1. [P1] Failed attachment retry state is not scoped to its owning ticket/requester
>
> failedAttachments and failedAddAttachment are stored globally inside App.
>
> Current behavior allows this scenario:
>
> - Create Ticket A.
>
> - Attachment B fails.
>
> - Open Ticket C.
>
> - Failed attachment B is still shown.
>
> - Clicking Retry uploads B to Ticket C.
>
> Problems:
>
> - failedAttachments is never cleared unless another failed upload is passed into handleViewTicket().
>
> - Rendering is not filtered by ticketNumber.
>
> - Retry uploads to the current detailTicketNumber instead of the failed item's original ticket.
>
> - failedAddAttachment stores no ticket identity.
>
> - Requester switching also leaves failed attachment state behind.
>
> Required fix
>
> - Scope failed attachment state by requester + ticket.
>
> - Clear or isolate state when navigating between tickets.
>
> - Retry using the failed item's own ticket number.
>
> - Add component tests covering:
>
> - switching between tickets after Case B
>
> - switching requester after Case B
>
> 2. [P1] Upload ownership masking happens after multipart/file validation
>
> Issue #15 requires non-owned tickets to always return the same safe 404 NOT_FOUND.
>
> Currently:
>
> - Multer executes before ownership validation.
>
> - Missing file returns 400.
>
> - Wrong content type returns 400.
>
> - Invalid extension/signature returns 415.
>
> - Oversized upload returns 413.
>
> All of those responses can occur before ownership is checked.
>
> That leaks behavior differences between owned and non-owned tickets.
>
> Required fix
>
> Ownership validation should happen before multipart/file validation while still being revalidated inside the transactional write boundary.
>
> Add real API tests proving non-owned uploads always return the identical 404 regardless of:
>
> - invalid type
>
> - missing file
>
> - oversized file
>
> 3. [P1] Soft removal is not concurrency-safe
>
> removeAttachment() currently performs:
>
> - findUnique()
>
> - check isRemoved
>
> - unconditional update()
>
> Two concurrent DELETE requests can both read:
>
> isRemoved = false
>
> Both updates can then succeed.
>
> Issue #15 explicitly requires:
>
> - first removal → 200
>
> - second removal → 409 CONFLICT
>
> Required fix
>
> Use either:
>
> - row locking
>
> - conditional update (isRemoved = false)
>
> Then add a real DB integration test proving:
>
> - exactly one request succeeds
>
> - exactly one request returns 409
>
> - removal metadata is correct
>
> 4. [P1] Compensation does not cover transaction commit failure
>
> The implementation compensates only when:
>
> attachment.create(...)
>
> throws.
>
> However:
>
> write file
> ↓
> attachment.create succeeds
> ↓
> transaction commit fails
>
> still leaves:
>
> - orphaned physical file
>
> - rolled-back database row
>
> The compensation currently does not cover that path.
>
> Required fix
>
> Cleanup must happen whenever the entire transaction fails after the physical file has been written.
>
> Add an integration test covering a post-insert transaction failure (or equivalent proof).
>
> 5. [P1] Client does not enforce the five-active-attachment limit
>
> Create Ticket currently accepts unlimited valid files.
>
> Example:
>
> 6 selected
> ↓
> shows 6/5
> ↓
> creates ticket
> ↓
> first 5 upload
> ↓
> 6th becomes avoidable Case B failure
>
> Ticket Detail also leaves Add Attachment enabled when already at five active attachments.
>
> Required fix
>
> Client should:
>
> - reject files beyond remaining slots
>
> - enforce limit in Ticket Detail
>
> - disable Add Attachment at five active files
>
> - re-enable after removal
>
> Add tests covering:
>
> - exactly five
>
> - selecting a sixth
>
> - full Ticket Detail
>
> - slot reuse after removal
>
> 6. [P1] Successful upload followed by refresh failure becomes retryable
>
> Current flow:
>
> upload succeeds
> ↓
> fetchTicketDetail fails
> ↓
> catch()
> ↓
> attachment shown as failed
> ↓
> Retry uploads duplicate file
>
> The same issue exists for removal.
>
> Mutation success should never become retryable because a refresh failed.
>
> Required fix
>
> Separate mutation success from refresh failure.
>
> Expected behavior:
>
> - upload succeeds
>
> - refresh fails
>
> - show refresh error
>
> - never offer retry for an already persisted attachment
>
> Add tests for:
>
> - upload success + refresh failure
>
> - remove success + refresh failure
>
> 7. [P1] Feature-level verification boundary is still incomplete
>
> attachments.api.test.ts mocks the attachment service.
>
> Therefore many required behaviors are not actually verified, including:
>
> - ownership enforcement
>
> - storage persistence
>
> - removed access
>
> - second removal
>
> - stored filename persistence
>
> - actual filesystem behavior
>
> The current real DB tests cover:
>
> - upload count concurrency
>
> - insert-failure compensation
>
> - PDF preview requests
>
> but do not fully satisfy the feature-level verification required by Issue #15.
>
> Additional gaps:
>
> - valid PDF preview accepts either 200 or 500
>
> - UI-TKT-08 exact valid+invalid attachment scenario is not proven
>
> - UI-DETAIL-01 is marked Passed without covering the complete state matrix
>
> - accessibility tests claim Escape/focus restore but don't fully assert them
>
> - tests.md contains conflicting execution totals and contradictory attachment size evidence
>
> Required fix
>
> Add real integration coverage for:
>
> - ownership
>
> - removal
>
> - download
>
> - preview
>
> - second removal
>
> - UUID filename persistence
>
> - full compensation behavior
>
> - deterministic PDF preview
>
> - exact UI-TKT-08 flow
>
> - complete Ticket Detail state matrix
>
> Correct tests.md so evidence matches actual implementation.
>
> Minor Follow-ups (Non-blocking)
>
> These can be addressed after the blockers above:
>
> - Upload response contract and implementation disagree about ticketId.
>
> - Validate oversized numeric attachment IDs before Prisma to avoid possible 500.
>
> - Prefer parsing filename* for downloads on the client.
>
> - Show remove errors inside the removal dialog instead of under Add Attachment.
>
> Overall Verdict
>
> This PR contains a substantial amount of good work, especially around transactional upload handling and sequential attachment orchestration.
>
> However, the remaining issues affect:
>
> - data integrity
>
> - ownership guarantees
>
> - concurrency correctness
>
> - duplicate upload prevention
>
> - acceptance-level verification
>
> These are Issue #15 acceptance criteria rather than polish items.
>
> Decision: ❌ Request Changes

#### My review comment 2 — Changes requested

> Re-review Summary
>
> Verdict: ❌ Request changes
>
> Reviewed the current PR head:
>
> eec6d8b9c30a7a620ca8928aed9e286f04bc9363
>
> The latest commits resolve substantial parts of the previous review:
>
> - upload ownership is checked before Multer/file validation
>
> - soft removal uses an atomic conditional update
>
> - filesystem compensation covers failure of the enclosing transaction
>
> - the five-active-attachment limit is enforced in both Create Ticket and Ticket Detail
>
> - failed attachment state is scoped by requester and ticket
>
> - valid PDF preview now deterministically requires 200 image/png
>
> - real-database tests were added for several persistence and concurrency scenarios
>
> However, the following acceptance-level issues remain.
>
> Blocking Findings
>
> 1. [P1] Retrying a failed Ticket Detail upload can still duplicate a persisted attachment
>
> The initial Add Attachment handler correctly separates:
>
> - upload mutation
>
> - Ticket Detail refresh
>
> A successful upload is treated as terminal even when the subsequent refresh fails.
>
> However, the Retry handler for failedAddAttachment still performs both operations in one try/catch:
>
> uploadAttachment succeeds
> ↓
> fetchTicketDetail fails
> ↓
> catch restores failedAddAttachment
> ↓
> Retry remains available
> ↓
> same file can be uploaded again
>
> This can create a duplicate attachment even though the first retry was successfully persisted.
>
> Required fix
>
> Apply the same two-phase mutation handling used by the normal Add Attachment flow:
>
> - Treat a successful retry upload as terminal.
>
> - Permanently clear the failed attachment row after the POST succeeds.
>
> - Run fetchTicketDetail() in a separate refresh-only try/catch.
>
> - A refresh failure may display a detail-refresh error, but must not restore the retry row.
>
> Add a component test proving:
>
> initial upload fails
> → failed row appears
> → Retry upload succeeds
> → Ticket Detail refresh fails
> → failed row remains cleared
> → no second upload can be submitted
>
> 2. [P1] The inherited UI-TKT-08 scenario is still not actually tested
>
> The current Create Ticket test selects:
>
> - one valid file
>
> - one invalid file
>
> and verifies the invalid message and valid-file count.
>
> However, it stops before submitting the form.
>
> The frozen UI-TKT-08 requirement needs executable proof that:
>
> - the invalid file remains visibly invalid
>
> - the invalid file is excluded from submission
>
> - ticket creation still succeeds
>
> - only the valid file is passed to uploadAttachment()
>
> - the invalid file never reaches the upload API
>
> - the ticket is created exactly once
>
> Required fix
>
> Add the exact component test in:
>
> client/src/lab-02-tests/CreateTicket.test.tsx
>
> Expected orchestration:
>
> select valid.jpg + invalid.txt
> → invalid.txt shows inline validation error
> → submit form
> → createTicket called once
> → uploadAttachment called once with valid.jpg
> → uploadAttachment never called with invalid.txt
> → success state shown
>
> Until this exact flow is tested, UI-TKT-08 should not be marked Passed in docs/lab-02/tests.md.
>
> 3. [P1] Feature-level verification remains incomplete and tests.md overstates coverage
>
> Issue #15 requires feature-level tests to verify actual:
>
> - attachment validation
>
> - ownership enforcement
>
> - persistence
>
> - storage
>
> - active/removed behavior
>
> - download/preview access
>
> - removal behavior
>
> - compensation
>
> Mocked controller/service tests are insufficient evidence for these behaviors by themselves.
>
> Several real integration tests have now been added, but important gaps remain.
>
> 3.1 Actual attachment validation matrix is not proven
>
> attachments.api.test.ts mocks uploadAttachment().
>
> attachment-validation.unit.test.ts tests only file-size boundaries.
>
> There is still no real service/API validation matrix proving:
>
> - allowed extension + matching signature → accepted
>
> - allowed extension + wrong signature → 415
>
> - unsupported extension → 415
>
> - no extension → 415
>
> - final extension not allowed → 415
>
> - case-insensitive allowed extension → accepted
>
> - JPG/JPEG/PNG/WEBP/PDF signatures are all handled by the actual implementation
>
> Required fix
>
> Add unit tests against the actual extension/signature functions or real API/service tests that exercise the production validation implementation rather than mocked service responses.
>
> 3.2 Cross-requester ownership is not proven for every attachment endpoint
>
> The new real-database ownership test proves upload masking for:
>
> - valid file
>
> - missing file
>
> - oversized file
>
> - invalid media type
>
> That resolves the upload ownership issue.
>
> However, cross-requester behavior for the following endpoints is still demonstrated only through mocked service returns:
>
> GET /api/tickets/:ticketNumber/attachments
> GET /api/attachments/:attachmentId/download
> GET /api/attachments/:attachmentId/preview
> DELETE /api/attachments/:attachmentId
>
> Required fix
>
> Using a real ticket and real attachment owned by Requester A, prove that Requester B receives the identical safe 404 NOT_FOUND shape for:
>
> - list
>
> - download
>
> - preview
>
> - removal
>
> Also verify:
>
> - no bytes are returned
>
> - attachment metadata is unchanged
>
> - the attachment is not removed
>
> 3.3 UI-DETAIL-01 is marked Passed without proving the complete required matrix
>
> The required Ticket Detail component coverage includes:
>
> - read-only ticket fields
>
> - loading skeleton
>
> - safe not-found/not-owned state
>
> - unexpected failure state
>
> - manual Retry
>
> - active attachment presentation
>
> - removed attachment presentation
>
> - Preview control
>
> - Download control
>
> - Remove control
>
> - Add Attachment control
>
> The current suite covers several attachment states and actions, but does not clearly prove the complete frozen Ticket Detail matrix as one directly traceable feature-level set.
>
> Required fix
>
> Add explicit Ticket Detail component tests for:
>
> - read-only fields
>
> - loading state
>
> - safe 404 state with no ticket data
>
> - unexpected failure state with manual Retry
>
> - active attachment actions
>
> - removed attachment presentation
>
> - successful Preview invocation
>
> - successful Download invocation
>
> - removal confirmation and successful removal
>
> - Add Attachment availability and capacity states
>
> Update docs/lab-02/tests.md so rows are marked Passed only when the required behavior is directly exercised.
>
> Non-blocking Follow-ups
>
> These may be handled as follow-up changes after the blockers are resolved.
>
> Accessibility test assertions
>
> The test named:
>
> closes dialog on Escape
>
> currently closes the dialog by clicking Cancel rather than sending an Escape key event.
>
> The focus-restoration test also confirms that the dialog closes but does not assert:
>
> document.activeElement === originalRemoveButton
>
> Align the tests with the evidence claimed in tests.md.
>
> DELETE body content-type handling
>
> The API contract requires a body with a non-JSON content type to return:
>
> 400 VALIDATION_ERROR
>
> Because express.json() may leave req.body undefined for non-JSON bodies, the current controller can accept a present non-JSON body without detecting it.
>
> Validate the request using headers/raw body presence rather than relying only on req.body.
>
> Attachment ID range validation
>
> Digit-only attachment IDs are converted using Number(rawId) without checking:
>
> - Number.isSafeInteger()
>
> - PostgreSQL INTEGER maximum
>
> Extremely large digit strings may reach Prisma and produce 500 INTERNAL_ERROR instead of the required safe 404 NOT_FOUND.
>
> Download filename parsing
>
> The client regex may select the ASCII filename= value before the RFC 5987 filename*= value.
>
> Prefer filename*, correctly decode UTF-8 names, and strip quoted fallback filenames.
>
> Client upload-result type
>
> The server upload response now includes:
>
> ticketId
>
> and intentionally excludes:
>
> storedFilename
>
> The client type still omits ticketId and declares storedFilename.
>
> Align the TypeScript interface with the actual API contract.
>
> Overall Verdict
>
> The implementation has improved significantly and most of the previous data-integrity and concurrency issues have been resolved.
>
> The remaining blockers concern:
>
> - duplicate uploads after a successful retry
>
> - missing executable proof for UI-TKT-08
>
> - incomplete feature-level validation and ownership evidence
>
> - overstated Ticket Detail test traceability
>
> These are part of Issue #15's explicit acceptance and verification boundary.
>
> Decision: ❌ Request Changes

#### My review comment 3 — Approved

> Re-review Verdict: ✅ Approved
>
> Reviewed the current PR head:
>
> 55aba9d3d194d6510cc0a176759743e159666b05
>
> The previously blocking findings have been addressed.
>
> Key fixes verified:
>
> - Failed attachment retries are now scoped correctly and a successful retry upload is treated as terminal, so a subsequent refresh failure cannot cause a duplicate upload.
>
> - UI-TKT-08 now covers the full valid + invalid attachment submission flow and proves only valid files are uploaded.
>
> - Attachment extension and content-signature validation now exercises the production validation logic.
>
> - Real-DB ownership tests cover list, download, preview, and removal across requesters.
>
> - Ticket Detail component tests now cover loading, safe 404, failure + Retry, read-only fields, active/removed attachments, Preview, Download, Remove, and Add Attachment controls.
>
> - Attachment ID range validation, DELETE body content-type handling, download filename parsing, and the client upload response type have also been corrected.
>
> The implementation now satisfies the Issue #15 feature-level acceptance and verification boundary.
>
> Any remaining nit/minor polish can be handled as follow-up work and does not block this PR.
>
> Decision: ✅ Approve

#### Partner's responses

No response recorded.
