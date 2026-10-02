# Issue #80 — Actions Taken UI and global Lookup review evidence

## Initial implementation scope and contract (2026-10-01)

Feature branch: `feature/80-actions-taken-ui-global-lookup`. The implementation began with a clean working tree. This file records feature evidence; final release review belongs to #83. Publication permissions in historical checkpoints are not a current repository status.

Outcome: Requester, IT Staff and Administrator Ticket Detail include Actions Taken after Attachments and before Public Comments. Three AppShell/RoleGuard Action Detail routes expose role-appropriate views, create/edit, separate confirmed assignment, lifecycle operations, associated evidence and Staff/Admin timelines. Backend authorization remains authoritative.

Included: frontend DTOs/API adapters, definition-driven reusable Lookup, CommonForm integration, existing DataTable/Modal/Bootstrap/Zen Green composition, bounded owner lookup compatibility, focused component/browser tests and documentation. Excluded: backend mutations/schema/migrations, Staff/Admin upload, Dashboard, Ticket resolution gate, generic Activity infrastructure, final integrated release verification. Risk: high because presentation spans role privacy, concurrency, idempotency and evidence associations; frozen mutation/database contracts remain unchanged; a narrow additive read-contract correction is recorded below.

Authority: [specification](../specification.md), [API contract](../api-spec.md), [UI contract](../ui-spec.md), [planned tests](../tests.md), and [global styling contract](../../generics/styling-contract.md). The requested [maintenance-tracking-system reference](https://github.com/oangsa/maintenance-tracking-system) was read through its LookupField, ListPickerModal, department definition and query constants. Only the separation of reusable UI and resource definitions was adapted; TokTickIT owns its table, styling, collection grammar and safe failures.

## Implementation evidence

- `client/src/components/Common/Lookup/` owns definition-driven LookupField/LookupModal/types. `client/src/lookups/userLookup.ts` owns User columns, eligibility-endpoint adapter and ID/display mapping. Shared DataTable supplies search, filters, sort, paging, page size, retry and mobile cards; Select remains explicit and keyboard accessible.
- `client/src/collections/fetchCollection.ts` consumes direct DTO arrays and requires validated `X-Pagination`. Existing Ticket-owner selection reads bounded pages of 100 until complete, preserving the ownership mutation policy and access beyond page one.
- `client/src/constants/forms/action.ts` plus CommonForm/useManagedForm supply create/edit/completion/cancellation validation. Create defaults the current actor but allows clearing assignment. Edit excludes assignment. Same-Ticket Active attachment associations are selected through the global modal; removed/Pending/cross-Ticket evidence cannot be selected. Attachment Notes remain independent.
- `client/src/modules/Actions/` implements ActionsTaken, ActionFilters, ActionForm, ActionAssigneeSelection, ActionDetail, ActionLifecycleModal, AttachmentSelection, ActivityTimeline and typed DTOs. Lifecycle controls are Detail-only; terminal Actions hide mutations. Expected versions accompany mutations. UUID idempotency keys persist through unchanged create/lifecycle retries; changed inputs create a new logical key. Busy refs and disabled controls prevent local repeat submissions.
- Stale conflicts preserve draft/selection and require explicit reload. Form/lifecycle recovery refreshes canonical Ticket ownership as well as the Action where applicable. Invalid assignment reopens/refetches eligibility. Reload never resets entered form values. Create/edit dirty close uses NavigationGuard and a discard dialog.
- Requester uses own-Ticket read routes, has no mutation controls and never requests internal Activity. Staff/Admin timeline uses typed domain events; Action history is oldest-first, ten per request, Load More. Ticket history supports All/Ticket Workflow/Assignment/Priority/Actions Taken. Migration snapshots describe recorded values without reconstructed transitions; ordinary Action references do not invent assignment changes.
- Shared Modal isolates covered dialogs and restores focus; Bootstrap scrollable dialogs fit mobile. CommonForm IDs are unique across simultaneously mounted forms. Action layouts stack below desktop; long values wrap without page-level horizontal scroll. No Action data is placed in Web Storage.

## TDD and regressions

Observed missing-behavior Red → Green slices covered global managed selection, User collection mapping, create/edit fields and stale drafts, attachment eligibility/dirty close, confirmed assignment, timelines, role-safe Detail/lifecycle, Actions list queries/section placement, second-page owner access, nested focus isolation, simultaneous form labels, stale Ticket eligibility/ownership recovery, removable filter chips, mobile Lookup cards, and truthful audit snapshots. Compilation/fixture/assertion corrections were not counted as valid Red evidence. Browser failure exposed over-height mobile forms; adding Bootstrap scrollable dialogs made the same check pass.

Additional passing coverage checks unchanged retry keys versus changed-input keys, pending repeat-click suppression, server field errors, disabled Lookup clear/select, invalid User recovery, terminal rows across all roles, safe 403/404 routing, Requester no-Activity reads and failed Load More recovery.

Earlier Lab 2 attachment and Lab 3 CommonForm/StaffTicketDetail tests retain their behavioral assertions. Their API fixtures now support the new bounded read consumers. The StaffTicketDetail suite adds a real second-page owner selection regression. Earlier responsive owner fixtures now expose email and standard pagination headers.

## Local verification (2026-10-01)

| Evidence | Observed result | Command/source |
|---|---|---|
| Full client regression | 34 files / 401 tests pass | `npm run test --prefix client` |
| UI-01–06, UI-12, UI-17–18 contributions | 8 files / 35 focused tests pass; inherited CommonForm 7 tests also pass | `client/tests/lab-04/` plus inherited CommonForm regression |
| RESP-03 and feature keyboard/focus inspection | 9 role/viewport combinations pass | `ISSUE_3_UI_ONLY=1 npm run test:e2e -- e2e/lab-04/responsive-visual.spec.ts --output artifacts/lab-04/playwright` |
| Real frozen-API UI smoke | 1 passed; final integrated case deliberately skipped | `e2e/lab-04/actions-taken-flow.spec.ts` |
| Frozen Lab 4 server regression | 18 files / 267 tests pass, including guarded PostgreSQL cases | From `server/`: `node /tmp/toktickit-79-check.mjs ./node_modules/.bin/vitest run tests/lab-04 --no-file-parallelism` |
| Frontend build/type check | Pass | `npm run build --prefix client` |
| Backend build/type check | Pass | `npm run build --prefix server` |
| Diff whitespace | Pass | `git diff --check` |
| Lint | No lint script configured in either application | Inspected actual package scripts; no substitute lint claim |
| E2E-01 final integrated gate | **Not Run** | #83 executes after #81 supplies workflow Activity |

Real smoke used the guarded disposable `toktickit-lab3-test-postgres` container on `127.0.0.1:55433`, database `toktickit_lab3_test`, with zero persistent mounts. A private runner captures baseline identities, overrides both DATABASE_URL and DIRECT_URL, validates the target and sanitizes credentials from logs. Read-only Prisma status confirmed seven migrations already current before verification. No shared database migration or reset occurred. Synthetic browser fixture audit records intentionally remain on this disposable target because Activity is append-only.

The smoke authenticates synthetic Staff and Requester accounts, creates an Action through CommonForm with existing Active same-Ticket evidence, starts after confirmation, completes atomically, observes terminal read-only controls and readable Activity, then verifies Requester result/evidence visibility without Activity or mutation controls. It is a scoped real-server integration smoke, **not** E2E-01 completion.

Browser screenshots are local ignored artifacts under `artifacts/lab-04/screenshots/`: `actions-taken/`, `action-create-edit/`, `assignee-selection/`, `action-detail/`, `ticket-activity/`. Each filename identifies role and viewport: 1440×900, 820×1180, 390×844. Tests exercise all three roles, modal fit, no horizontal page overflow, Lookup Shift+Tab/Escape/focus restoration, and Requester read-only/no internal reads. Visual inspection checked mobile Lookup Select placement and form fit. Screenshot artifacts are not committed automatically.

Known tool warnings: inherited React test act warnings, Rollup Zod annotation/large-chunk warnings, Node FORCE_COLOR warnings and Prisma adapter concurrent-query deprecation warnings. These did not fail checks; no unrelated dependency/tooling changes were made. Existing frozen `tests.md` planning rows remain unchanged. UI-13 and the integrated workflow gate remain #83 responsibilities. No CI publication, peer-review approval, Issue closure, commit or push is claimed.

## Scrutiny corrections — 2026-10-02

Two local findings were reproduced and corrected without changing the frozen REST or database contracts:

- Create/Edit and Complete previously validated a retained Follow-Up Note's length even when Follow-Up Required was false and the field was hidden. Both schemas now apply the required/length rules only while Follow-Up is required. Draft text survives toggling; disabled Follow-Up submits null as the API requires. Permanent Create/Edit and Complete regressions verify that an enabled 2,001-character note is rejected, toggling retains its text, and disabling Follow-Up allows submission.
- Lifecycle Reload latest previously refreshed Ticket ownership only inside the modal. The callback now supplies both refreshed resources to Action Detail. Permanent 403/409 recovery regressions retain entered Result, disable the current completion form after ownership loss, then verify that closing it leaves Complete/Edit/Cancel hidden while the generally permitted Reassign control remains enabled.

Observed Red/Green: both Create/Edit cases failed before the form-schema correction and passed afterward; the Complete case failed before its schema correction and passed afterward; both 403/409 cases failed before the parent-state correction and passed afterward. An initial mock-isolation failure and unsupported Testing Library `exact` option were corrected as test setup/type issues, not counted as Red evidence. Final review checked both schema consumers and the lifecycle callback's only caller; no unrelated edits or backend authorization changes were introduced.

| Check | Result | Command |
|---|---|---|
| Full client regression, including all 40 Lab 4 tests | 34 files / 406 tests passed | `npm run test --prefix client` |
| Final affected tests | 2 files / 18 tests passed | `npm run test --prefix client -- tests/lab-04/ActionDetail.test.tsx tests/lab-04/ActionForm.test.tsx` |
| Responsive/keyboard/Requester read-only checks | 9 cases passed | `ISSUE_3_UI_ONLY=1 npm run test:e2e -- e2e/lab-04/responsive-visual.spec.ts --output /tmp/toktickit-80-fix-playwright` |
| Frontend build/type check | Passed | `npm run build --prefix client` |
| Backend build/type check | Passed | `npm run build --prefix server` |
| Diff whitespace | Passed | `git diff --check` |

Responsive screenshots were refreshed under the existing ignored `artifacts/lab-04/screenshots/` directories at all three approved viewports. Browser checks used mocked APIs; the real-server smoke and backend test suite were not rerun for these frontend corrections. No lint script is configured. E2E-01 remains **Not Run**, owned by #83 after #81; prior real-server evidence above remains its original dated record. Pre-existing working-tree changes were preserved. No commit, push, GitHub change, shared database operation or final release claim.

## PR #87 corrective work — 2026-10-02

The supplied review and fix request authorize a narrow #79 read-contract follow-up. List/detail now expose creatorPublicId; list rendering uses that identity, assignee and Ticket Owner directly. Detail requests occur only when opening a mutation, never to determine row Edit visibility. Two bounded filter-users routes return distinct Ticket-referenced assignees/performers (ID/name/role), using repeatable-read User count/page queries with Prisma relation predicates. This includes historical inactive/deleted/demoted references across all Action pages. Requester route validates own non-deleted Ticket; assignment Lookup eligibility and mutation authorization remain unchanged. API §7.1.1 records the explicit additions. No schema/migration, dependency or #81 workflow changes.

Lab 3 RESP-04 failed exactly as reported: broad alert locator resolved to Internal Note plus Actions/Activity errors caused by missing fixture endpoints. Healthy empty collection mocks remove those errors; assertion scopes the privacy alert and explicitly rejects load errors. Full inherited responsive suite passes without losing original assertions. Newly generated inherited screenshots were copied to ignored artifacts/lab-04/screenshots/lab-03-regression; committed historical screenshots remain intact.

### Observed Red/Green evidence

- Existing RESP-04 reproduced strict-mode failure before fixture correction; all three viewports passed afterward. Initial sandbox EPERM prevented webserver startup; allowed localhost/Chromium rerun supplied actual reproduction.
- API list regressions failed twice (Staff and Requester) because creatorPublicId was missing; both passed after projection addition.
- Creator UI regression failed with no Edit while detail requests were unavailable; passed after removing probes. Permanent 1-row and 100-row coverage now confirms one collection request per page, including exposed page-size changes. A stale DOM reference in the expanded test was corrected; this test setup failure is not production Red evidence.
- Historical-user API regressions failed twice with 404 before static routes/service were added; both passed afterward. UI regressions failed for Requester (partial select) and Staff/Admin (assignment Lookup); all three passed with Ticket-scoped definitions.
- Additional API coverage verifies authentication, role, ownership, rejected reference/query fields, safe DTO projection, page bounds and empty-page behavior. Real PostgreSQL coverage verifies distinct references, paging/search, deactivation/deletion/demotion and cross-Ticket isolation. Those expanded checks are validation of the API-first slice, not separate missing-behavior Red claims.

### Executed local validation

| Check | Result | Command |
|---|---|---|
| Full client regression | 34 files / 411 tests passed | `npm test --prefix client` |
| #80 focused component/accessibility evidence | 8 files / 45 tests passed | `npm test --prefix client -- tests/lab-04` |
| Full server regression with guarded disposable PostgreSQL | 88 files / 1,342 tests passed | From server/: `node /tmp/toktickit-79-check.mjs ./node_modules/.bin/vitest run --no-file-parallelism` |
| Action API regression | 129 tests passed | From server/: `npm test -- tests/lab-04/actions-taken.api.test.ts` |
| Historical-user PostgreSQL regression | 1 test passed | Guarded wrapper plus `vitest run tests/lab-04/postgres/action-filter-users.postgres.test.ts --no-file-parallelism` |
| Lab 3 inherited responsive suite | 30 passed, including all three reported RESP-04 cases | `ISSUE_3_UI_ONLY=1 npm run test:e2e -- e2e/lab-03/responsive-visual.spec.ts` |
| Lab 4 Actions/Lookup responsive and keyboard/focus | 9 passed; all three roles at 1440/820/390 | `ISSUE_3_UI_ONLY=1 npm run test:e2e -- e2e/lab-04/responsive-visual.spec.ts --output artifacts/lab-04/playwright` |
| Real API/UI integration smoke | 1 passed; integrated E2E-01 deliberately skipped | From server/: guarded wrapper plus `../node_modules/.bin/playwright test --config ../playwright.config.ts e2e/lab-04/actions-taken-flow.spec.ts --output ../artifacts/lab-04/playwright-real` |
| Frontend type check/build | Passed | `npm run build --prefix client` |
| Backend type check/build | Passed | `npm run build --prefix server` |
| Diff whitespace | Passed | `git diff --check` |
| Lint | No configured lint script in either package | Actual package.json inspection |

The local wrapper reads captured server baselines, confirms the existing disposable toktickit-lab3-test-postgres container is running without persistent mounts, and overrides TEST_DATABASE_URL, DATABASE_URL and DIRECT_URL to that local target. No shared database was targeted. Raw execution logs are local /tmp artifacts; results above are repository-recorded local evidence, not product CI or peer-review acceptance. Initial client build exposed a test generic-inference error, corrected before final passing build. An overlapping browser command encountered the already-used localhost port; sequential rerun passed all 30 cases. Existing Vite bundle-size and pg deprecation warnings remain; no dependency/build changes were introduced.

Responsive screenshots include historical-user filter selection for every role/viewport under ignored artifacts/lab-04/screenshots/action-filters. The 390px Requester filter screenshot was visually inspected: fields, Lookup/clear controls, switches and Cancel/Apply fit the dialog without clipping.

UI-01–06, UI-12, UI-17–18 and RESP-03 are Pass in tests.md using this evidence. UI-13 and integrated E2E-01 remain Not Run with #83 after #81. Final reviewer.md remains a #83 placeholder. Historical Lab 2 AI-use is restored exactly to the pre-#80 parent; compatibility maintenance belongs in Lab 4 AI-use. No commit, push, merge, Issue closure or final release acceptance is claimed.

### GitHub evidence synchronization

Updated live Issue #80 scope/DoD and only its ten UI/RESP test states using the executed evidence above. Issue remains open, with local corrective files explicitly uncommitted/unpushed and peer review pending. Updated PR #87 to distinguish published 1b476d9 evidence from local corrective validation and replaced premature automatic closure with Related #80. Both saved bodies were fetched and compared exactly to their submitted body files. No product CI result was inferred from Project Automation. Final file review, whitespace and secret-pattern inspection covered all 21 changed/new files; staging remains empty.

### Publication authorization

The subsequent prompt authorizes committing and pushing these reviewed corrective files on feature/80-actions-taken-ui-global-lookup. Reuse the unchanged passing execution evidence above; no new application tests or final release acceptance is claimed. Earlier local/uncommitted wording records pre-publication checkpoints. Issue #80 remains open pending peer review; UI-13 and integrated E2E-01 remain with #83.

## PR #87 Role-sort review follow-up — 2026-10-02

Baseline was exactly `48ecb6a58ece6f56ef48d56e98767dd580a643c4`, on the #80 feature branch with a clean working tree. The reported Role-sort rejection did **not** reproduce: the existing assignable-user parser explicitly passed `["name", "email", "role"]` to the shared User parser. New API regressions for both route prefixes, both references and both Role directions passed before production changes. Source tracing and those successful requests disprove the review's default-name/email-parser premise at this head.

The remaining parser problem was its indirect email rejection and misleading validation feedback. A permanent API test first failed because `sort=email:asc` returned the generic `The value is invalid.` instead of identifying the resource's allowed name/role fields. Filter-users now passes exactly `["name", "role"]` through the existing strict parser; shared validation messages derive their field list from that allowlist. The separate assignment Lookup retains name/email/role sorting. No route, DTO, authorization, mutation, schema, migration or dependency changed.

New UI regressions open both Assigned To and Performed By Lookups for Requester, Staff and Admin, click Role twice, verify role:asc/role:desc requests and reordered rows without a load alert. Real PostgreSQL coverage checks both references and directions across two pages, including demoted/deleted history and same-role publicId ASC ties. These positive behaviors already worked; they are regression coverage, not claimed missing-behavior Red results. Initial sandbox port denial and a UI test's incorrect button locator were setup failures, not Red evidence.

The specification's #80 review amendment now explicitly replaces the earlier frontend-only/frozen-API objective and impact wording for creatorPublicId and the two Ticket-scoped read routes only. The opening evidence paragraph preserves frozen mutation/database boundaries while acknowledging that read amendment. This repository review basis is the updated source for subsequent reviews; the supplied historical review text and GitHub Issue/PR were not edited.

Observed checks in this follow-up:

- Focused API Red: 1 validation-message failure, 2 positive Role-sort tests passed, 129 unrelated tests excluded by the test-name filter. After the fix, `npm test --prefix server -- tests/lab-04/actions-taken.api.test.ts tests/lab-04/AssignableUserQueryValidator.test.ts tests/lab-04/assignable-users.api.test.ts` passed 3 files / 173 tests.
- `npm test --prefix client -- tests/lab-04/ActionsTaken.test.tsx`: 14 passed. `npm test --prefix client`: 34 files / 414 passed.
- From `server/`, `node /tmp/toktickit-79-check.mjs ./node_modules/.bin/vitest run --no-file-parallelism`: 88 files / 1,346 passed, including 2 historical-user PostgreSQL tests at their final location in `tests/lab-04/postgres/action-filter-users.postgres.test.ts`. The existing wrapper checked the disposable local container and overrode TEST_DATABASE_URL, DATABASE_URL and DIRECT_URL; no shared database was targeted.
- `npm run build --prefix client` and `npm run build --prefix server`: passed, including TypeScript checks. `git diff --check`: passed. Neither application configures a lint script.

Raw logs remain local under `/tmp/87-*`. Evidence is locally reproduced, not GitHub product CI or peer-review approval. Browser/responsive and real UI/API smoke were not rerun for this parser/documentation follow-up; UI-13 and integrated E2E-01 remain Not Run under #83. Existing Vite bundle-size and pg deprecation warnings remain. No secrets or unrelated changes were found in the reviewed diff. Changes remain unstaged/uncommitted; no commit, push, merge or Issue closure was requested.

The subsequent `commit and push` prompt authorizes publication of this nine-file follow-up on the existing #80 feature branch. The completed test/build evidence above is reused; only this authorization record changed afterward. Earlier uncommitted/unpushed wording records the pre-publication checkpoint. No merge, Issue closure, peer-review approval or final release acceptance is authorized by publication.

## PR #87 review-basis and evidence synchronization — 2026-10-02

The supplied scrutiny review distinguishes its historical frontend-only/frozen-API contract from the amended live Issue/specification. Explicit acceptance of the narrow read exception was requested from the repository owner; it is not inferred from this feature branch's amendment. Pending that answer, this task changes evidence only and makes no new contract-approval or peer-acceptance claim.

Updated PR #87 and Issue #80 verification summaries to the already recorded Role-sort follow-up: client 34 files / 414 tests, guarded server 88 files / 1,346 tests, focused query/API 3 files / 173 tests, both builds and diff whitespace passed. Removed stale corrective-commit pinning from the top-level summaries. Earlier responsive and real UI/API smoke results remain explicitly historical, not rerun results. Saved GitHub bodies were fetched and compared exactly with their submitted body files; both resources remain open and the production head remains `2196e2c2fb44b3c84f571f2271e2196936d90937`.

The review's CI limitation is now outdated. Independently inspected [Lab 3 Global Verification run 36975082134](https://github.com/oangsa/TokTickIT/actions/runs/36975082134) succeeded at that production head. Downloaded logs confirm client 34 files / 414 tests and server 88 files / 1,346 tests passed, including Lab 4 Actions and historical-user PostgreSQL coverage despite legacy Lab 3 step names. Both application builds, committed diff whitespace and final guarded migration status passed; Lab 3 Playwright reported 80 passed / 1 skipped. The separate focused 173-test result remains recorded local evidence. Project Automation is not used as product-test evidence; UI-13 and integrated E2E-01 remain Not Run under #83 after #81.

This documentation/metadata task adds no tests or production behavior and requires no artificial Red/Green cycle. Application suites and builds were not rerun locally; prior local results and the inspected CI run are identified separately. No API, Prisma/schema/migration, dependency, mutation authorization, eligibility or workflow changes; no merge, Issue closure or review submission. This task has no explicit commit/push instruction, so its documentation changes remain uncommitted.

The subsequent `commit and push` prompt authorizes publication of these two reviewed documentation files on the existing #80 feature branch. Earlier uncommitted wording records the pre-publication checkpoint. Recorded local results and independently inspected CI remain evidence for the preceding production head; no new application run is claimed. Publication does not resolve the pending explicit read-contract acceptance or authorize merge, Issue closure or peer-review approval.

### Explicit owner acceptance of the amended review basis — 2026-10-02

The owner answered the pending question: “Accept amended read contract (recommended).” PR #87 is assessed against the amended Issue #80/Lab 4 contract, explicitly permitting only creatorPublicId in Action list/detail DTOs and bounded Ticket-scoped filter-users read routes. No mutation authorization, assignment eligibility, schema/migration or Ticket-workflow changes are permitted by this exception. This external acceptance resolves the contract-basis blocker; earlier pending-answer wording records the pre-acceptance checkpoint.

Recorded acceptance in specification.md and the live PR/Issue review-basis summaries. Existing evidence synchronization remains valid; no production code, test behavior or API contract was newly changed. Application tests/builds were not rerun for this documentation-only follow-up. Publication continues under the user's existing commit/push authorization. Peer review and #83 integrated verification remain outstanding; no merge, Issue closure or review submission is claimed.
