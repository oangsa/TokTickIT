# Lab 2 — AI Use and Reflection

**LLM/agent used:** Codex (GPT-5)

This is the canonical Lab 2 AI-use record. It curates ten important prompts
from the prompt history available in the repository and current session; it is
not a transcript.

## Lab 3 CI regression follow-up (2026-09-25)

| Prompt | What I did with the result |
|---|---|
| Diagnose the Lab 3 CI Playwright failures in inherited Lab 2 requester tests. | Updated the inherited E2E tests to authenticate seeded Requesters and use Lab 3 protected endpoints and UI selectors. Preserved Create Ticket recovery, Requester flows, Attachment lifecycle, and responsive coverage. Playwright listed all 60 tests; the full browser suite was not run because no local test database was configured. |

## Lab 3 CI E2E failure repair (2026-09-25)

| Prompt | What I did with the result |
|---|---|
| Diagnose the five failing Lab 2 Requester Playwright cases on the Lab 3 verification branch. | Made the ownership flow sign out Alice before Bob's login; changed pre-submit generated-field checks to read their `<output>` text; restored Attachment action-column space lost to shared table-cell padding. Four focused client suites passed (106 tests), client build passed with existing warnings, and Playwright parsed all 11 affected cases. Browser E2E remains unverified locally because guarded database variables were absent. |

## Current client structure follow-up (2026-09-19)

| Prompt | What I did with the result |
|---|---|
| Redesign client structure using Maintenance Tracking System and AXONS frontend without changing logic or styling. | Prepared a temporary architecture report covering the existing requester screens, attachments, shared controls, and other current client modules. |
| Group components for maintainability using both references. | Revised the report to separate Common controls and Maintain page composition, with domain-owned UI and application layouts. |
| I love v2, proceed. | Applied the approved file moves and import-path changes, including earlier-lab test imports. Preserved test assertions, requester behavior, CSS, and package/config files. All 365 client tests passed before and after; 88 focused tests and 7 mocked-auth browser checks passed; client/server builds passed. Production output is byte-identical to baseline. No commit or push. |

These additions use only prompts available in the current session; no missing prompt history or review results were reconstructed. Detailed commands and limits are recorded in `docs/lab-03/tests.md`.

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
| current | Revert stale PR #46, close PR #47, reopen Issue #26, then continue Lab 2 release evidence. | Reapplied the preserved evidence work on dedicated branches, explicitly recorded that #46 merged before approval, recorded approved revert #48 and closed #47, and documented the approved/merged correction PR #49. After #49 merged, reran the exact `lab2-staging` release gates: server/client suites and builds, Prisma checks, seed/maintenance, and 12/12 Playwright E2E; application code stayed unchanged. Prepared and merged docs-only follow-up PR #50, then opened the single replacement release PR #51 from `lab2-staging` to `main` for peer review. |
| current (PR #53 follow-up) | Fix the 390×844 Ticket Detail Attachment action wrapping and commit/push if warranted. | Reproduced the wrap, added the minimal 8rem Actions-column reservation plus a Playwright line-count regression, regenerated screenshot evidence, and reran the disposable-database client/server/build/E2E gates. |
| current (PR #51 record) | Update the Lab 2 peer-review record for the release PR. | Recorded @kittipichcha's approval and PR #51's merge into `main` as `5867b7a`; no later PRs were added to the reviewer record. |
| current (reviewer record cleanup) | Keep both peer-review sections, use only merged partner PRs #16–#29, and copy review comments/replies exactly. | Restored the complete authored-PR section and rebuilt the partner-review section with every public formal review body by @oangsa plus the original recorded partner responses; no review comment was invented for PR #24, which has no formal review submission. |
| current (UX flow consolidation) | Simplify the current UX so one outcome has one canonical action: remove the Ticket Number link while keeping row navigation, remove duplicate actions, and turn the Create Ticket recovery action into a retry state on the primary button. | Made Ticket rows keyboard-activatable, removed duplicate no-results and single-selection batch actions, guarded dirty Create Ticket exits through the existing discard modal, and changed ambiguous submission recovery to the primary `Retry Again` action with focused UI tests and contract documentation updates. |
| current (release UX/accessibility fix) | Fix the release-blocking UX and accessibility findings from the design and flow audit. | Added semantic Ticket navigation, drawer focus trapping and focus return, history-safe dirty-form blocking, URL-preserving list/detail navigation, async failure announcements, form metadata, resilient filter selections, and missing image dimensions; updated focused and browser-flow tests. |
| current (continued release gate) | Continue the release fix and close the last verification warning. | Made route focus pathname-aware so list query changes keep keyboard focus, corrected a navigation test fixture that produced an invalid Ticket-row key warning, and reran client tests/builds plus pure server unit tests. |
| current (single-host tunnel) | Make the tunneled app reach the local API from `https://vite.oangsa.com`. | Added a Vite `/api` proxy to local Express, set the ignored local client API base to same-origin, documented the tunnel setup, and verified `/api/health` returned the Express JSON response through the live Cloudflare tunnel. |
| current (card header refinement) | Redesign the current frontend while retaining the same flow and Zen Green theme; increase the card header size. | Increased shared card-title text to 16px while leaving table headers, captions, routes, and interaction behavior unchanged. |
| current (responsive UX redesign) | Redesign the current frontend with the same flow and Zen Green theme, modern-minimal styling, restrained motion, and a mobile fix based on the supplied screenshot. | Kept routes and API behavior unchanged; refreshed shared surfaces, page hierarchy, toolbar/table breakpoints, touch targets, menu motion, and viewport metadata. |
| current (visual feedback pass) | Reduce oversized Geist-like styling, center button text, fill the attachment input treatment, and remove awkward mobile Sort by spacing. | Tightened title/surface emphasis, made buttons explicit flex controls, styled the native file picker surface, and tightened toolbar label spacing while preserving flow and theme. |
| current (attachment fill correction) | Fill the remaining white area of the attachment input shown in the follow-up screenshot. | Changed the complete native file control surface to Pale Green; chooser behavior and “No file chosen” state remain unchanged. |
| current (attachment height correction) | Match the native Choose Files button height to the full file-input control shown in the follow-up screenshot. | Fixed the control at the shared 2.75rem height and matched the chooser padding so its dark hover surface reaches both input edges. |
| current (table hierarchy correction) | Revert Ticket Number to black and make the My Tickets header/table structure read more clearly on mobile and desktop. | Reduced Ticket Number emphasis, added a restrained header band and stronger rule, compacted row spacing, and framed the table without changing data or navigation. |
| current (table spacing correction) | Add more gap, padding, and margin around the My Tickets toolbar and table shown in the follow-up screenshot. | Added toolbar-to-table breathing room, increased table-header padding, and added restrained outer-cell insets so content does not touch the frame without forcing ticket numbers or dates to wrap unnecessarily. |
| current (pagination spacing check) | Check the spacing consistency between pagination number buttons and navigation arrows from the supplied screenshot. | Applied the shared 4px pagination gap and removed Bootstrap's joined-button offset for every DataTable pagination instance, including My Tickets and the Staff/Admin queue. No route or API behavior changed; browser visual evidence was not run. |

| current (shared shell follow-up) | Align `/tickets` with `/admin/tickets`, make the requester list use the shared DataTable shell, and restore the Create Ticket back action. | Removed requester-only DataTable frame/header overrides, kept ticket-specific responsive widths, made the shared search label visible, and added `Back to My Tickets` through PageHeader. Updated Lab 2 regressions and regenerated shared queue visual evidence. Focused/full client tests, client/server builds, and 6 mocked responsive checks passed. |

| current (form header standardization) | Make Create Ticket and Create User headers identical and move repeated page composition toward configuration. | Added shared ManagePage composition with page-owned header configs, standardized both pages on title + description + back link, and kept CommonForm/UserForm behavior unchanged. |

| current (reference table redesign) | Redesign the Data Table; clarified that TokTickIT is the target and maintenance-tracking-system is the reference. | Read the reference Common/DataTable source and adapted toolbar grouping, header typography, row feedback, and pagination spacing using existing Bootstrap and Zen Green tokens. Preserved pre-existing UI edits and query behavior. Focused My Tickets/shared-component tests passed (98 tests); client/server builds passed. Chromium checks with synthetic API fixtures passed at 320, 375, 390, 414, 768, 820, and 1440px with no page overflow; filter dialog opened. Visually inspected desktop and narrow mobile screenshots. Full database-backed E2E was not run. |

| current (pagination reference redesign) | Redesign pagination shown in the screenshot using the same maintenance-tracking-system reference. | Replaced text arrows with accessible first/previous/next/last chevron controls, reused hover/focus tooltips, and aligned compact page buttons with larger touch targets. Added boundary navigation/tooltip tests and updated the UI contract. Focused tests passed (99 tests), client build passed, and mocked-API Chromium checks passed at seven widths from 320–1440px. Full database-backed E2E was not run. |

| current (sidebar reference redesign) | Redesign sidebar. | Applied the same maintenance-tracking-system reference: divided brand header, decorative navigation icons, non-color-only active marker, and a flat Requester footer. Kept routes, primary Create Ticket, navigation guards, and requester switching intact. Updated shell accessibility tests and UI contract. Focused shell/shared tests passed (97 tests; React act warnings emitted); client and server builds passed after correcting a test query option. Mocked-API Chromium checks passed at seven widths from 320–1440px, including Escape/focus restoration, Create Ticket navigation, and requester switching. Full database-backed E2E was not run. |

| current (sidebar edge removal) | Remove the green edge highlight from My Tickets and keep the same background. | Removed the active navigation inset shadow, retained the Pale Green background and semibold text, and synchronized the UI contract. |

| current (priority contrast) | HIGH and MEDIUM priority chips look almost the same color. | Changed the shared medium badge to a lighter green mix with dark green text, keeping HIGH dark and LOW pale; updated the UI contract. |
| current (global Chip standardization) | Standardize Badge/Chip variants and reuse priority/status treatments globally, including the requester and admin queue differences. | Added canonical `Chip` variants (`primary`, `secondary`, `subtle`, `outline`, `destructive`), `PriorityChip`, and `StatusChip`; migrated list, detail, sidebar role, user, comment, note, filter, and Attachment state callers. Kept `Badge.tsx` as a compatibility adapter. Focused client tests passed (133 tests) and client build passed. |
| current (ticket-list chip consistency follow-up) | Make the `/tickets` and `/admin/tickets` priority/status chips use the same styling. | Removed queue-only outline overrides so both lists use shared semantic `PriorityChip`/`StatusChip` defaults, including priority meters; added a queue regression assertion and updated the global styling contract. |
| current (button alignment and icon source) | Explain the visible button-label offset, fix its cause, use Lucide or React Icons for interface icons, and document the rule. | Traced the offset to the reserved idle busy-spinner slot; kept progress width stable while centering labels, replaced hand-drawn/Unicode interface icons with `lucide-react`, and documented the allowed icon libraries in `AGENTS.md`. |
| current (Lab 3 regression compatibility) | Adjust Lab 2 tests for the Lab 3 implementation and require affected earlier-lab tests to evolve with specification changes. | Updated Lab 1/Lab 2 API, service, migration, seed, maintenance, and PostgreSQL regression tests for authenticated User/session transport and the renamed persistence model; added the cross-lab test rule to `AGENTS.md`. |
| current (global styling contract and form skill) | Consolidate Lab 2 and Lab 3 styling and shared-component usage into a global contract; create the project-specific form-engineering skill for future forms. | Expanded docs/generics/styling-contract.md from both UI specs and current components, linked it from this UI spec, and added .agents/skills/form-engineering. Documentation/skill work only; no application behavior changed. |
| current (list and form consistency pass) | Recheck shared DataTable, CommonForm page navigation, icon-only row actions, the unsupported Admin Ticket create link, and control radius consistency. | Moved My Tickets onto the shared DataTable while preserving its URL query contract and responsive states, standardized PageHeader back actions, made automatic row actions icon-only, kept create actions opt-in, and aligned small select radius. Full client regression passed (26 suites, 358 tests); client and server builds passed. Browser visual evidence is not part of this pass. |
| current (review fix) | Fix unsupported My Tickets column sorting and restore the search length guard. | Disabled sorting on display-only Category and Related System columns, restored the shared DataTable's 200-character search limit, and added My Tickets regressions for both behaviors. |

| current (frontend styling consistency audit; fix-then-ship) | Scrutinize whether frontend pages follow shared styling and reuse components, then fix the findings. | Replaced page-local success alerts with `SuccessMessage`, routed generated and Staff Queue filter controls through shared `Select`/`TextInput`, aligned CommonForm helper/counter layout, and extracted the repeated one-time-password display into `OneTimePassword`. Focused client tests and the client build were run; no browser visual verification or commit. |

## Server structure refactor (2026-09-24)

| Prompt | What I did with the result |
|---|---|
| Improve server structure with the architecture skill while preserving Lab 1 structure. | Inspected the current server, Lab 1 directory and route contracts, and later-lab code; produced a temporary HTML report with Attachment and Ticket candidates. Then implemented only the selected structural changes within `server/src/`. |
| Why can't we do both? | Treated both candidates as the requested scope instead of choosing only the top recommendation. |
| Yes, to moving only shared Ticket DTO mapping and Prisma relation selection. | Moved those definitions into `ticketRepresentation.ts`; kept Ticket creation and read behavior in their existing modules. |
| Yes, to moving staff Attachment lookup and 404/410 rules into the Attachment module. | Moved that lookup into `AttachmentService` and shared binary response handling through `http/binary.ts`; kept the existing REST behavior. |
| Yes, to the full behavior-preserving design. | Added staff-binary unit and PostgreSQL regressions. Focused unit (91), Supertest (137), non-PostgreSQL server (946), and guarded PostgreSQL (27) tests passed; server and client builds passed. An earlier full-suite attempt without explicit test overrides failed in 23 PostgreSQL suite hooks because the local target was unavailable and Lab 3 overrides were absent. No commit or push. |

Only prompts in this session are recorded here; unavailable prompt history and review outcomes were not reconstructed.

## Reflection

AI helped me keep a large contract, implementation, test, and delivery record
cross-linked while preserving the required React/Express/Prisma/PostgreSQL
stack. I still made the scope decisions: temporary Requester context is not
authentication, database tests use disposable synthetic targets, and no Lab 3
feature belongs in this submission. This record uses only prompt history
available in the repository/current session; no unavailable history or review
outcome was reconstructed.
