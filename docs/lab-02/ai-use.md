# Lab 2 — AI Use and Reflection

**LLM/agent used:** Codex (GPT-5)

This is the canonical Lab 2 AI-use record. It curates ten important prompts
from the prompt history available in the repository and current session; it is
not a transcript.

## Selected key prompts (10)

| # | Prompt (summarised) | What I did with the result |
|---|---|---|
| 6 | Synchronize the frozen Lab 2 contract with the QueryBuilder boundary and unordered `attachmentIds` idempotency rules. | Updated `specification.md`, `api-spec.md`, `ui-spec.md`, and `tests.md` so validation, hashing, ownership, and test responsibilities stayed explicit without changing application code. |
| 28 | Implement Issue #18's data model, forward migration, seed, reference services, and guarded PostgreSQL evidence. | Added the Prisma schema/migrations, synthetic idempotent seed, reference services, PostgreSQL guard, disposable Compose target, and focused tests; verified migration, preservation, constraints, and Lab 1 regression behavior. |
| 38 | Apply the Karpathy guidelines while implementing Issue #19's Zen Green shell and reusable UI foundation. | Implemented the React/Vite/Bootstrap shell, route structure, requester context foundation, standalone error page, and shared components; kept downstream Ticket behavior and browser evidence assigned to their own Issues. |
| 54 | Implement Issue #20's Requester context, bootstrap endpoint, selection screen, and API funnel. | Added the Express guard/transport stack, synthetic Requester bootstrap, client context handling, safe invalid-context clearing, and focused server/client evidence. |
| 56 | Implement Issue #21 Ticket creation with fenced persistent idempotency and the Create Ticket screen. | Added the REST create flow, canonical SHA-256 request hash, lease/reclaim/fencing behavior, atomic Attachment binding, generated fields, recovery record, and focused API/PG/UI tests. |
| 58 | Implement Issue #22's requester-owned My Tickets list with validated query composition and pagination. | Added the resource validator, generic QueryBuilder boundary, requester/deleted predicates, `TicketListItemDTO` projection, pagination headers, URL-backed filters, and My Tickets states/tests. |
| 67 | Scrutinize Issue #23 Ticket Detail end to end and fix the findings. | Traced route guard, ownership predicate, DTO mapping, error navigation, date formatting, Attachment metadata, and route logging; fixed the material findings and added API, PostgreSQL, and UI regressions. |
| 72 | Implement Issue #24's Attachment lifecycle and audit it against the Lab 2 contracts. | Added six Attachment endpoints, maintenance cleanup, lifecycle UI, bounded multipart/binary behavior, Serializable retry/concurrency handling, and the owning focused gates. |
| 80 | Complete Issue #25's final Lab 2 safety/regression gate with pinned MSW/Playwright, exact E2E files, responsive evidence, and delivery records. | Added only the approved test tooling/E2E structure, tightened the database guard, reran focused and full checks, captured tracked screenshots, and documented the final evidence without adding Lab 3 authentication or workflow features. |
| current | Revert stale PR #46, close PR #47, reopen Issue #26, then continue Lab 2 release evidence. | Reapplied the preserved evidence work on a new Issue #26 correction branch, updated records for merged PR #48 and closed PR #47, opened correction PR #49, and kept application code unchanged. This documentation-only correction has not rerun application tests. |

## Reflection

AI helped me keep a large contract, implementation, test, and delivery record
cross-linked while preserving the required React/Express/Prisma/PostgreSQL
stack. I still made the scope decisions: temporary Requester context is not
authentication, database tests use disposable synthetic targets, and no Lab 3
feature belongs in this submission. This record uses only prompt history
available in the repository/current session; no unavailable history or review
outcome was reconstructed.
