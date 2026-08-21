# Lab 2 — AI Use and Reflection  (fill this in)

**LLM/agent used:** Codex (GPT-5)

The canonical Lab 2 AI-use record is `docs/lab-02/ai_use.md`, continuing the
Lab 1 and repository `ai_use.md` naming convention. The Lab 2 handout prints
`docs/lab-02/ai-use.md` in its “Minimum Lab 2 structure” and submission
evidence; this pass records that exact course-delivery naming conflict and
keeps only the established underscore filename. No duplicate `ai-use.md` file
is created.

## Selected key prompts
| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | Draft `ai_use.md` and `reviewer.md` for Lab 2 using the Lab 1 format strictly. | Created the two Lab 2 documents with the Lab 1 headings and layout. I initially left placeholders because no Lab 2 AI-use or peer-review history was available. |
| 2 | Fill the Lab 2 AI-use record and add an AGENTS.md rule requiring every user prompt to be recorded there. | Replaced the placeholders with the available Lab 2 prompt history and added the documentation rule. |
| 3 | Scrutinize the Lab 2 changes against Issue #17. | Traced the four engineering-contract documents against the Issue, Lab 2 handout, and test matrix. Found that Issue-specific focused test assignments and close gates are missing. |
| 4 | Fix the review finding and ship it without bulk commits. | Added the per-Issue focused-test ownership and close gates, linked the workflow DoD to them, then prepared one explicitly scoped commit. |
| 5 | Review the Lab 2 contract for partial handout API examples and Pending Attachment preview coverage. | Added an explicit handout-example assumption to `specification.md` and tightened UI-27 in `tests.md` to require Pending and Active preview cases. |
| 6 | Synchronize the frozen Lab 2 contract with the final QueryBuilder boundary and unordered `attachmentIds` idempotency clarifications. | Updated the four Lab 2 contract documents to preserve the generic QueryBuilder/resource-validator/frontend boundary, define the Ticket condition matrix, normalize and sort Attachment IDs while rejecting duplicates, and align the planned tests. No application implementation was started. |
| 7 | Scrutinize the Lab 2 specifications. | Traced the frozen contracts against the Lab 1 baseline and planned verification, confirmed the two final clarifications are synchronized, and reported remaining replay-order, browser-header, database-concurrency, DTO-growth, and ownership-wording risks without changing product behavior. |
| 8 | Apply the approved final Lab 2 consistency decisions without implementing application code. | Updated the four engineering contracts for replay-first idempotency, explicit CORS exposure, guarded real-PostgreSQL tests, `TicketListItemDTO`, and scope-hiding `404` ownership behavior; preserved AC numbering and the approved QueryBuilder/Attachment canonicalization rules. |
| 9 | Resolve scrutiny findings: use `feature/*` → `labX-staging` → `main`, approve Playwright, remove API versioning, and separate Ticket creation from Attachment upload. | Updated repository workflow guidance and all four Lab 2 contracts. Files now stay local until `POST /api/tickets` succeeds, then upload independently through `POST /api/tickets/:publicId/attachments`; removed pending/binding/compensation behavior and changed every Lab 2 route to `/api/...`. |
| 10 | Revert only the rejected Lab 2 initial Attachment workflow redesign while preserving the newer approved decisions. | Restored standalone Pending pre-upload, sorted `attachmentIds`, replay-first idempotency, atomic Ticket/binding, orphan cleanup, compensation, unified lifecycle deletion, and synchronized tests/UI; retained unversioned `/api`, `TicketListItemDTO`, safe requester-scope `404`, CORS, QueryBuilder, Playwright, branch workflow, and guarded PostgreSQL tests. No application code was changed. |
| 11 | Grill every scrutiny finding one decision at a time, then apply the authorized documentation-only changes. | Resolved and synchronized production-oriented boundaries for concurrency, cleanup, migration preservation, synthetic requester data, current-state replay, exact expiry/recovery, file/transport hardening, bounded queries/bodies, database checks/indexes, logging/cache/CORS, pinned test tooling, new AC traceability, and Issue close-gate ownership. No application implementation, GitHub change, commit, or push was performed. |
| 12 | Perform a focused Lab 2 documentation-contract correction: add the authoritative schema, explicit PROCESSING/COMPLETED idempotency claim model and SHA-256 contract, visible generated/context Create fields, automated UI-style assertions, and synchronized traceability without changing application code or reducing approved scope. | Updated the four Lab 2 contracts with exact Prisma/PostgreSQL types, defaults, restrictive foreign keys, checks, indexes, claim-before-mutation ordering, current-state replay tests, Create Ticket read-only generated/context fields, appended AC/test evidence, and the intentionally unresolved stale-PROCESSING crash case. Preserved modular test filenames and all approved API, Pending, DTO, ownership, QueryBuilder, security, and tooling decisions. |
| 13 | Finalize stale PROCESSING recovery as a five-minute lease: fresh same-hash waits, stale same-hash atomically reclaims, different hash conflicts, reclaim resets `processingStartedAt`, and concurrent retries have one reclaim owner; add PostgreSQL concurrency evidence. | Updated the specification, API contract, schema field contract, unit/API/PostgreSQL test plan, AC-65 traceability, and Issue close gate. Added `processingStartedAt` as required TIMESTAMPTZ state, request-time conditional reclaim, exact five-minute boundary, mutable revalidation, no-Failed/no-delete rules, separation from 24-hour Completed expiry, and PG-11 exactly-one-owner/no-duplicate evidence. No application, Prisma schema, migration, dependency, or generated file was changed. |
| 14 | Approve `IDEMPOTENCY-FENCING-A`: retain the lease `processingStartedAt`, lock and verify the claim inside the resource transaction, hold the lock through completion, fence stale old owners before mutation, and add PG-12. | Updated the specification and API transaction ordering so final mutable validation, Ticket creation, Pending binding, and claim completion occur under one locked and exactly verified claim lease. Expanded unit/API evidence and added PG-12 proving an old owner cannot commit after B reclaims. Updated AC-65 and the Ticket-creation close gate; no application, Prisma schema, migration, dependency, or generated file was changed. |
| 15 | Commit the completed Lab 2 engineering-contract work without a bulk commit. | Reviewed the branch, working tree, diffs, contract consistency, and whitespace; staged only the seven explicit in-scope documentation paths and created one scoped documentation commit without pushing. |
| 16 | Reconcile all Lab 2 GitHub Issues against the authoritative contracts in `docs/lab-02/`. | Updated Issues #17–#26 in place to use the final unversioned API, safe ownership behavior, QueryBuilder boundary, per-feature test gates, PostgreSQL/idempotency/Attachment hardening, and AC-01–AC-66 traceability. No Lab 2 application code was implemented. |
| 17 | Confirm whether Issue #28 is still needed after removing API versioning. | Verified that #28 only tracked the abandoned versioned-route migration and closed it as Not planned because the approved Lab 2 contract uses unversioned `/api/...` routes. |
| 18 | Perform a focused Lab 2 documentation consistency and safety correction pass without changing application code or creating a commit. | Inspected the actual Lab 1 Category schema/migration and corrected the four Lab 2 contracts for planned-test lifecycle, exact lease boundaries, canonical UUID ordering, Serializable Attachment-upload retries, Description search transparency, migration evidence, debounce coverage, QueryBuilder responsibility, handout authority, and command working-directory clarity. The then-open `updatedAt` backfill decision was documented for a later approval rather than guessed. No application, Prisma, dependency, generated-file, README, AGENTS.md, GitHub, or commit changes were made. |
| 19 | Perform one final documentation-only Lab 2 contract sync to close the Category migration ambiguity and mark retry-backoff timing implementation-defined. | Updated `specification.md`, `api-spec.md`, and `tests.md` to require in-place Category migration preserving existing `id`, `name`, and `createdAt`, backfilling `isActive = true`, `deleted = false`, deterministic `seed` actors, and `updatedAt = original createdAt`; clarified that exact Serializable retry-backoff milliseconds are not an API contract while the bounded randomized maximum-three-attempt policy and safe `500` exhaustion remain. No application, Prisma, dependency, generated-file, or commit changes were made. |
| 20 | Retrieve the comments and review record from Lab 2 PR #27 and document them using the Lab 1 reviewer-record format. | Retrieved the approved review, ten clarification points, and author reply from PR #27; recorded the feedback and evidence-backed responses in `docs/lab-02/reviewer.md`. No application, Prisma, dependency, generated-file, GitHub, commit, or push changes were made. |
| 21 | Re-audit all Lab 2 Issues against the latest contracts in `docs/lab-02/`. | Scrutinized Issues #17–#26 against the current specification, API, UI, and test contracts; updated #17, #18, #21, #22, #24, and #25 for handout authority, deterministic Category backfill, canonical lowercase UUID sorting, the exact 300-second lease, Description-only search and debounce guidance, and three-total-attempt Serializable upload behavior with safe `500` exhaustion. Confirmed #19, #20, #23, and #26 required no change. No application code was implemented. |
| 22 | Perform a focused documentation-only Lab 2 handout-authority correction pass for required test filenames, canonical AI-use naming, decimal Attachment size, and mandatory icon-only tooltips. | Updated the Lab 2 specification, API/UI contracts, test plan, and this AI-use record for the handout-required filename ownership, `5,000,000`-byte limit and boundaries, and tooltip plus accessible-name evidence. Preserved the approved `/api/...`, DTO, ownership-404, Pending atomic binding, idempotency, Serializable, QueryBuilder, JSON-limit, logging, migration, and index decisions. No application code, schema, migration, dependency, generated file, or commit was created. |

## Reflection
The first draft preserved the Lab 1 format but did not contain enough evidence
to fill the record. The follow-up made the expected record-keeping explicit:
the AI-use document must be updated as Lab 2 work happens, rather than being
reconstructed at the end. This record contains the Lab 2 prompt history available
in the repository and this session; future prompts will be appended when their
related work is performed. The Issue #17 review also showed that a broad test
matrix is not a substitute for assigning focused tests and close gates to each
implementation Issue.
The latest review added an explicit rule that partial handout API examples are
not wire contracts and tightened the Pending-preview UI test requirement.
The subsequent scrutiny kept the frozen product behavior unchanged and recorded
remaining contract risks for an explicit product/engineering decision.
The final synchronization applied those explicit decisions and retained the
documentation-only boundary.
The previously considered direct-upload-first portion of the latest decision
was subsequently rejected and reverted to the approved Pending pre-upload plus
atomic initial binding architecture. Its unrelated branch-workflow, Playwright,
and unversioned-API decisions remain approved. Only prompt history available in
the repository and current session is recorded here.
The latest decision interview preserved the no-authentication Lab 2 boundary
while converting the scrutiny risks into explicit, testable engineering
contracts. New acceptance criteria were appended without renumbering AC-01
through AC-46, and implementation remains assigned to later feature Issues.
The focused contract-correction pass made the persistence model implementable
without inventing field types or state constraints and established claim
ownership before mutable Ticket/Attachment work. The subsequent final decision
closed the stranded-PROCESSING ambiguity with an exact five-minute request-time
lease and atomic same-hash reclaim. It keeps different-hash conflict semantics,
prohibits persistent FAILED state and stale-row deletion for payload reuse,
requires mutable-state revalidation after reclaim, and keeps the 24-hour
COMPLETED expiry as a separate policy. The planned real-PostgreSQL PG-11 test
now supplies the required concurrent exactly-one-reclaim evidence. The approved
`IDEMPOTENCY-FENCING-A` follow-up closed the slow-original-owner race: exact
lease ownership is checked while the claim row is locked inside the same
resource transaction, and PG-12 proves that a resumed old owner cannot mutate
after another request reclaims the lease.
The latest planning pass synchronized Issues #17–#26 with these contracts while
retaining #25 as a final regression gate rather than a substitute for each
feature Issue's focused tests.
This correction pass used the committed Lab 1 schema and Category migration as
the migration baseline rather than assuming audit/lifecycle columns existed.
It made the planned-test lifecycle explicit, aligned the five-minute lease to
the exact 300-second boundary, clarified canonical UUID ordering and
Serializable retry behavior, and documented the then-open `updatedAt` backfill
decision without inventing a historical value. The final sync now closes that
decision: existing Category rows preserve `id`, `name`, and `createdAt`, use
`isActive = true`, `deleted = false`, and deterministic `seed` actors, and set
`updatedAt` to the preserved original `createdAt`. It also makes retry-backoff
milliseconds intentionally implementation-defined while retaining the small,
bounded, randomized maximum-three-attempt policy and safe `500` exhaustion.
No application code or commit was created.
