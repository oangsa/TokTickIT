# Lab 2 — AI Use and Reflection  (fill this in)

**LLM/agent used:** Codex (GPT-5)

The canonical Lab 2 AI-use record is `docs/lab-02/ai-use.md`, as required by
the Lab 2 handout. Lab 1 retains its historical `docs/lab-01/ai_use.md`
filename; this distinction is intentional. This handout-facing record selects
9 important prompts from the 22-prompt Lab 2 history available in the
repository and current session.

## Selected key prompts (9)
| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 6 | Synchronize the frozen Lab 2 contract with the final QueryBuilder boundary and unordered `attachmentIds` idempotency clarifications. | Updated the four Lab 2 contract documents to preserve the generic QueryBuilder/resource-validator/frontend boundary, define the Ticket condition matrix, normalize and sort Attachment IDs while rejecting duplicates, and align the planned tests. Reviewed the result as documentation-only work; no application implementation was started. |
| 10 | Revert only the rejected Lab 2 initial Attachment workflow redesign while preserving the newer approved decisions. | Restored standalone Pending pre-upload, sorted `attachmentIds`, replay-first idempotency, atomic Ticket/binding, orphan cleanup, compensation, unified lifecycle deletion, and synchronized tests/UI. Reviewed the change against the frozen `/api`, DTO, ownership-404, CORS, QueryBuilder, Playwright, and guarded-PostgreSQL decisions; no application code was changed. |
| 12 | Perform a focused Lab 2 documentation-contract correction: add the authoritative schema, explicit PROCESSING/COMPLETED idempotency claim model and SHA-256 contract, visible generated/context Create fields, automated UI-style assertions, and synchronized traceability without changing application code or reducing approved scope. | Updated the four contracts with exact Prisma/PostgreSQL types, defaults, restrictive FKs, checks, indexes, claim-before-mutation ordering, current-state replay tests, Create Ticket read-only generated/context fields, and AC/test evidence. Preserved modular test filenames and the approved API, Attachment, ownership, and tooling decisions. |
| 13 | Finalize stale PROCESSING recovery as a five-minute lease: fresh same-hash waits, stale same-hash atomically reclaims, different hash conflicts, reclaim resets `processingStartedAt`, and concurrent retries have one reclaim owner; add PostgreSQL concurrency evidence. | Updated the specification, API contract, schema field contract, unit/API/PostgreSQL test plan, AC-65 traceability, and Issue close gate with the exact 300-second boundary and PG-11 evidence. Reviewed the result as a contract synchronization; no application, schema, migration, dependency, or generated-file change was made. |
| 14 | Approve `IDEMPOTENCY-FENCING-A`: retain the lease `processingStartedAt`, lock and verify the claim inside the resource transaction, hold the lock through completion, fence stale old owners before mutation, and add PG-12. | Updated specification/API transaction ordering, unit/API evidence, PG-12, AC-65, and the Ticket-creation close gate so a stale old owner cannot mutate after reclaim. Reviewed the transaction ordering and preserved the no-FAILED-state decision without changing application or database source files. |
| 19 | Perform one final documentation-only Lab 2 contract sync to close the Category migration ambiguity and mark retry-backoff timing implementation-defined. | Updated the specification, API contract, and tests to require in-place Category migration preserving `id`, `name`, and `createdAt`, deterministic backfill actors, and `updatedAt = original createdAt`; kept the bounded randomized maximum-three-attempt Serializable policy while making exact backoff milliseconds implementation-defined. |
| 21 | Re-audit all Lab 2 Issues against the latest contracts in `docs/lab-02/`. | Traced Issues #17–#26 against the current specification, API, UI, and test plan; updated only the Issues with verified drift, including #21, #24, and #25. Kept Issue-level focused gates separate from #25 final regression evidence and made no application-code changes. |
| 22 | Perform a focused documentation-only Lab 2 handout-authority correction pass for required test filenames, canonical AI-use naming, decimal Attachment size, and mandatory icon-only tooltips. | Updated the Lab 2 contracts and test plan for handout-required test ownership, the decimal Attachment limit and boundaries, and tooltip plus accessible-name evidence. This record preserves the prompt as historical activity while the current pass applies the superseding handout filename correction. |
| 23 (current) | Perform a final Lab 2 course-delivery consistency pass: rename the AI-use deliverable to `docs/lab-02/ai-use.md`, curate 6–10 selected prompts, and synchronize Issues #21, #24, and #25 to `tests.md`. | Used the handout and current `tests.md` as authority; renamed and curated this deliverable, then applied focused Issue edits for Ticket test ownership and the 12-hex Ticket Number suffix, the 5,000,000-byte Attachment limit and `attachments.api.test.ts`, and the current E2E file ownership. Verified no application, schema, migration, dependency, generated-file, or commit changes were made. |

## Reflection
The full Lab 2 history is retained in the conversation/repository context, but
the handout-facing deliverable intentionally selects nine representative
interactions rather than reproducing every wording correction. The selection
covers specification and API contracts, UI behavior, schema and migration
decisions, Attachment lifecycle, idempotency/concurrency, test traceability,
and course-delivery compliance. Every retained item corresponds to an actual
AI-assisted activity available in the repository or current session; no prior
prompt history outside that context was reconstructed.

The Lab 2 filename follows the handout's explicit `ai-use.md` requirement,
while Lab 1's historical `ai_use.md` remains unchanged. The selected records
also show the review boundary used throughout Lab 2: documentation and Issue
contracts were synchronized against the authoritative specification and
`tests.md`, while application implementation decisions were not silently
changed during these consistency passes.
