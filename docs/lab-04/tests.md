# Lab 4 Test Specification

## 1. Purpose

This document defines the planned verification contract for TokTickIT Lab 4. It is derived from and must remain consistent with:

- `specification.md`
- `api-spec.md`
- `ui-spec.md`

Every Acceptance Criterion `AC-01` through `AC-39` maps to at least one planned automated test or explicit delivery evidence.

This file is written before or alongside implementation. Planned rows begin as:

```text
Not Run
```

Only real execution may change Final to:

```text
Pass
Fail
Blocked
```

Lab 4 verification separates:

- Unit tests for validators, lifecycle calculation, query normalization, and pure UI helpers;
- API tests for HTTP, authentication, authorization, validation, safe errors, and service orchestration;
- PostgreSQL integration tests for migration, real constraints, transactions, idempotency, isolation, races, atomic Activity, and Dashboard snapshot truth;
- UI component tests for React behavior, DataTable, CommonForm, global Lookup, assignee selection, Dashboard auto-refresh/cache, feedback, focus, and authorization presentation;
- responsive/visual browser evidence;
- end-to-end role workflows;
- complete Labs 1–3 regression; and
- a dedicated non-SLA large-data performance smoke.

## 2. Shared Contract Anchors

```text
UserRole =
  REQUESTER | IT_STAFF | ADMINISTRATOR

TicketStatus =
  NEW | OPEN | IN_PROGRESS | WAITING_FOR_REQUESTER |
  RESOLVED | CLOSED | REOPENED | CANCELLED

ActionTakenStatus =
  PLANNED | IN_PROGRESS | COMPLETED | CANCELLED

Action version =
  positive integer, optimistic expectedVersion on mutation

Dashboard API list bounds =
  integer 1..20

Dashboard UI sizes =
  5 | 10 | 20

Visual evidence =
  Desktop 1440x900
  Tablet   820x1180
  Mobile   390x844

Global tabular UI =
  existing reusable DataTable

Business Activity =
  explicitly approved narrow append-only TicketActivity design

Technical request logging =
  existing requestLog.ts; not TicketActivity
```

## 3. Test ID and Result Conventions

```text
UNIT-xx  unit/service/query validator
API-xx   HTTP/API behavior
PG-xx    real PostgreSQL integration/concurrency/migration
UI-xx    React component/accessibility behavior
RESP-xx  responsive browser behavior
VIS-xx   screenshot/manual visual evidence
E2E-xx   full browser workflow
DATA-xx  schema/migration/seed/repository evidence
PERF-xx  non-SLA performance smoke
REG-xx   earlier-lab regression gate
```

A planned row may represent multiple concrete parameterized assertions inside one test file.

Mocked API tests do not claim to prove PostgreSQL uniqueness, isolation, lock behavior, commit/rollback, or races. Those claims require `PG-xx`.

## 4. Required File Organization

The Lab 4 handout names the following minimum files. They must exist as real test files:

```text
server/tests/lab-04/
├── actions-taken.api.test.ts
├── ticket-workflow.api.test.ts
├── requester-dashboard.api.test.ts
└── staff-dashboard.api.test.ts

client/tests/lab-04/
├── StaffDashboard.test.tsx
├── RequesterDashboard.test.tsx
├── ActionsTaken.test.tsx
└── TicketWorkflow.test.tsx

e2e/lab-04/
├── actions-taken-flow.spec.ts
├── ticket-resolution.spec.ts
└── dashboards.spec.ts
```

The approved expanded structure is:

```text
server/tests/lab-04/
├── ActionTakenService.test.ts
├── ActionTakenQueryValidator.test.ts
├── DashboardQueryValidator.test.ts
├── staffTicketReadService.test.ts
├── AssignableUserQueryValidator.test.ts
├── ActivityRepresentation.test.ts
│
├── actions-taken.api.test.ts
├── ticket-workflow.api.test.ts
├── requester-dashboard.api.test.ts
├── staff-dashboard.api.test.ts
├── ticket-activity.api.test.ts
├── assignable-users.api.test.ts
├── action-attachments.api.test.ts
├── error-contract.api.test.ts
│
└── postgres/
    ├── schema-contract.postgres.test.ts
    ├── migration-upgrade.postgres.test.ts
    ├── action-lifecycle.postgres.test.ts
    ├── action-concurrency.postgres.test.ts
    ├── action-idempotency.postgres.test.ts
    ├── action-attachments.postgres.test.ts
    ├── ticket-activity.postgres.test.ts
    ├── ticket-resolution.postgres.test.ts
    ├── dashboards.postgres.test.ts
    ├── seed-idempotency.postgres.test.ts
    └── performance-smoke.postgres.test.ts

client/tests/lab-04/
├── StaffDashboard.test.tsx
├── RequesterDashboard.test.tsx
├── ActionsTaken.test.tsx
├── TicketWorkflow.test.tsx
├── ActionForm.test.tsx
├── ActionDetail.test.tsx
├── ActivityTimeline.test.tsx
├── ActionAssigneeSelection.test.tsx
├── LookupField.test.tsx
├── LookupModal.test.tsx
├── DashboardRefresh.test.tsx
└── Accessibility.test.tsx

e2e/lab-04/
├── actions-taken-flow.spec.ts
├── ticket-resolution.spec.ts
├── dashboards.spec.ts
└── responsive-visual.spec.ts
```

## 5. Tooling and Test Boundaries

### 5.1 Unit

Use Vitest.

Mock Prisma/repository collaborators when the test is about pure business validation/orchestration and not DB semantics.

Good unit candidates:

- Action transition table;
- field normalization;
- Action query validator;
- Dashboard size validator;
- lifecycle-relevant timestamp selection;
- assignable-user query validation and fixed eligibility, including SYSTEM exclusion;
- Activity DTO/presentation mapping.

### 5.2 API

Use:

```text
Vitest
+ Supertest
+ real Express middleware/router/service orchestration
+ mocked data-access boundary where appropriate
```

Do not mock auth/authorization away when proving a protected route.

API tests prove:

- route/path/method;
- auth/role;
- request validation;
- error mapping;
- response status/shape;
- idempotency orchestration;
- parent-resource safe 404;
- Dashboard parameter behavior.

### 5.3 PostgreSQL

Focused PG tests use real migrations/schema against a disposable test database.

Safety requirements remain the Lab 3 pattern:

- `NODE_ENV=test`;
- explicit `TEST_DATABASE_URL`;
- target must differ from normal development targets;
- database name must contain a clear test marker;
- no fallback to normal dev DB;
- no destructive reset against shared/normal DB;
- concurrent race tests use separate Prisma clients/connections.

### 5.4 UI

Use current frontend test stack:

```text
Vitest
React Testing Library
@testing-library/user-event
MSW / existing HTTP mocking pattern
```

Prove behavior, not implementation details.

### 5.5 E2E / responsive

Use repository-root pinned Playwright + Chromium.

E2E proves integrated journeys; unit/API/PG tests prove combinatorial rules.

Required viewports:

```text
1440 x 900
820 x 1180
390 x 844
```

### 5.6 Accessibility

Do not add a new accessibility dependency solely for Lab 4.

Automated tests verify concrete semantics:

- accessible names;
- keyboard activation;
- focus restoration;
- modal focus;
- disabled semantics;
- alerts;
- field error association;
- non-color text labels.

Manual/visual checklist supplements those assertions.

## 6. Planned Unit Tests

| ID | Requirement / AC | What It Tests | Expected Result | File | Final |
|---|---|---|---|---|---|
| UNIT-01 | BR-03, BR-24–33; AC-07–11 | Action transition table for every source/action pair. | Only approved transitions resolve; all others produce Action transition conflict. | `ActionTakenService.test.ts` | Not Run |
| UNIT-02 | BR-05–11; AC-02 | Description/Result/Follow-Up/Attachment Notes/Cancellation normalization and Unicode-code-point boundaries. | Exact valid boundaries pass; blank/over-limit/conditional-invalid values fail deterministically. | `ActionTakenService.test.ts` | Not Run |
| UNIT-03 | BR-22–23, BR-36; AC-06 | Assignee validation semantics. | Only active Staff/Admin targets are accepted by normalized service input. | `ActionTakenService.test.ts` | Not Run |
| UNIT-04 | BR-52–55; AC-21–23 | Ticket resolution gate calculation. | Requires >=1 `COMPLETED AND isMigrated=false`; any Planned/In-Progress blocks; Cancelled does not block; migrated Completed does not count. | `ActionTakenService.test.ts` | Not Run |
| UNIT-05 | BR-97–100; AC-29 | My Actions lifecycle-relevant timestamp and deterministic ordering helper. | Correct timestamp selected per status and deterministic tie break retained. | `DashboardQueryValidator.test.ts` | Not Run |
| UNIT-06 | BR-101; AC-31 | Dashboard size parser. | Omitted ->5; integers 1..20 accepted; 0,21,decimal,array/object/non-number rejected. | `DashboardQueryValidator.test.ts` | Not Run |
| UNIT-07 | FR-14; AC-03 | Action query search/filter/sort/page validator. | Only approved fields/operators/types pass; default newest-first order is injected. | `ActionTakenQueryValidator.test.ts` | Not Run |
| UNIT-08 | BR-113–120; AC-06, AC-33 | Assignable-user eligibility. | SYSTEM, inactive, deleted, and Requester users are excluded; active non-deleted Staff/Admin remain eligible. | `staffTicketReadService.test.ts` | Not Run |
| UNIT-09 | BR-65–72; AC-20, AC-24 | Activity typed DTO mapping. | Correct typed detail is emitted per event; `REQUESTER_RESOLUTION_CONFIRMED` has Requester actor and no invented status transition or child detail; no raw internal/JSON metadata. | `ActivityRepresentation.test.ts` | Not Run |
| UNIT-10 | BR-76–80; AC-14–16, AC-39 | Canonical Action idempotency identity/hash construction. | Hash includes method, concrete canonical resource path, normalized semantic body, and expectedVersion where applicable; equal semantics hash equally. | `ActionTakenService.test.ts` | Not Run |
| UNIT-11 | FR-51; BR-115; AC-33 | Assignable-user query validator using existing collection grammar. | name/email search, role/EQUAL filter, name/email/role sorts, defaults/bounds and publicId tie-break; unsupported keys/fields/operators/types rejected. | `AssignableUserQueryValidator.test.ts` | Not Run |

## 7. Planned API Tests

| ID | Requirement / AC | What It Tests | Expected Result | File | Final |
|---|---|---|---|---|---|
| API-01 | FR-04–05; AC-01 | Staff/Admin valid Action create, role guard, PLANNED default, server fields, first 201/replay 200. | Correct Action under correct Ticket; no client-controlled performer/date/status. | `actions-taken.api.test.ts` | Not Run |
| API-02 | BR-05–11; AC-02 | Action create/edit/complete/cancel field validation including Attachment Notes and Follow-Up invariant. | Safe `400 VALIDATION_ERROR` details; no mutation on invalid body. | `actions-taken.api.test.ts` | Not Run |
| API-03 | FR-02, FR-14; AC-03, AC-34 | Staff/Admin and Requester Action list query search/filter/sort/paging and `X-Pagination`. | Bounded projection includes `isMigrated` for both audiences; migrated historical Action appears in normal list responses with `isMigrated=true`; deterministic order and invalid-query safe 400. | `actions-taken.api.test.ts` | Not Run |
| API-04 | FR-02–03; AC-04 | Requester owned Action list/detail vs cross-owner/cross-parent. | Own 200; unavailable/cross-owner indistinguishable 404. | `actions-taken.api.test.ts` | Not Run |
| API-05 | FR-03; AC-05 | Requester direct calls to every Action mutation/Activity endpoint. | Mutation/Activity access forbidden; no state change. | `actions-taken.api.test.ts` | Not Run |
| API-06 | FR-07, FR-50, FR-52; AC-06 | Assign/reassign/unassign valid and invalid targets. | Valid 200; inactive/deleted/Requester/SYSTEM -> field validation; stale -> conflict. | `actions-taken.api.test.ts` | Not Run |
| API-07 | FR-08; AC-07–08 | Start unassigned/wrong actor/valid assignee/replay. | Unassigned invalid transition; wrong actor forbidden; valid start succeeds/replays safely. | `actions-taken.api.test.ts` | Not Run |
| API-08 | FR-09; AC-09 | Complete authority/result/follow-up/state behavior. | Only assignee/Ticket Owner on IN_PROGRESS with valid result succeeds. | `actions-taken.api.test.ts` | Not Run |
| API-09 | FR-10; AC-10 | Cancel authority/reason/source states. | Approved actor/source + reason succeeds; others rejected safely. | `actions-taken.api.test.ts` | Not Run |
| API-10 | FR-11; AC-11–12 | Terminal mutations and stale expectedVersion HTTP mapping. | Terminal -> invalid Action transition; stale -> generic 409 CONFLICT. | `actions-taken.api.test.ts` | Not Run |
| API-11 | FR-54–55; AC-14–15 | Action-create same-scope replay vs different payload. | Same actor/method/concrete path/key and request replays; changed semantic request -> IDEMPOTENCY_CONFLICT. | `actions-taken.api.test.ts` | Not Run |
| API-12 | FR-54; AC-16 | Start/Complete/Cancel repeat with same idempotency key. | Prior logical result replayed; no second mutation requested. | `actions-taken.api.test.ts` | Not Run |
| API-13 | FR-15–18; AC-17–18 | Existing Attachment eligibility for Action associations. | Existing Active same-Ticket Attachment accepted; Pending, removed/deleted, or cross-Ticket Attachment rejected; no Staff upload route exists. | `action-attachments.api.test.ts` | Not Run |
| API-14 | FR-19–24; AC-20, AC-24 | Ticket/Action Activity retrieval, paging, category filter, Requester prohibition. | Staff/Admin 200 bounded history includes `REQUESTER_RESOLUTION_CONFIRMED` when present; Requester forbidden. | `ticket-activity.api.test.ts` | Not Run |
| API-15 | FR-25–27; AC-21–23, AC-38 | Mark Resolved API gate cases, including migrated-only work after reopen. | Migrated Completed Action alone -> INVALID_STATUS_TRANSITION; a real non-migrated Completed Action with no open work permits resolve. | `ticket-workflow.api.test.ts` | Not Run |
| API-16 | FR-19, FR-28–30; BR-56, BR-65, BR-73; AC-19, AC-24–25 | Requester confirmation/Close + Admin parity/owner-only lifecycle matrix. | `looks-resolved` records confirmation timestamp and exactly one `REQUESTER_RESOLUTION_CONFIRMED` Activity by Requester while status remains `RESOLVED`; repeat adds none; Close requires confirmation and current Ticket Owner; Admin parity and owner-only rules hold. | `ticket-workflow.api.test.ts` | Not Run |
| API-17 | FR-31–35; AC-26–27 | Requester Dashboard role/ownership/shape/size validation. | Own data only; exact metrics/list shape; 1..20 bound. | `requester-dashboard.api.test.ts` | Not Run |
| API-18 | FR-36–41; AC-28–31 | Staff/Admin Dashboard role, metric/list shape, size validation. | Both roles receive same shape; Requester forbidden; invalid bounds rejected. | `staff-dashboard.api.test.ts` | Not Run |
| API-19 | FR-48–52; AC-06, AC-33 | Queryable assignable-user role/eligibility and DTO contract. | Staff/Admin 200 with publicId/name/email/role; Requester 403; inactive, deleted, Requester, SYSTEM rows excluded before count/paging; client filters cannot widen eligibility. | `assignable-users.api.test.ts` | Not Run |
| API-20 | Error contract; AC-02, AC-12, AC-15 | New INVALID_ACTION_TRANSITION and reuse of existing CONFLICT/INVALID_STATUS_TRANSITION/IDEMPOTENCY_CONFLICT. | Exact centralized safe envelope; no Prisma/internal leak. | `error-contract.api.test.ts` | Not Run |
| API-21 | FR-54–55; AC-39 | Same actor/key/payload across different concrete Ticket and Action paths. | Each path has independent identity/result; no replay returns the wrong Ticket or Action. | `actions-taken.api.test.ts` | Not Run |
| API-22 | FR-51; BR-115; AC-33 | Assignable-user search/searchFields, role filter, sorting, pagination and X-Pagination. | Bounded deterministic pages, correct totals/header, safe 400 for unsupported fields/operators and malformed/out-of-range query; role filter cannot expose Requesters. | `assignable-users.api.test.ts` | Not Run |
| API-23 | BR-107; AC-32 | Dashboard HTTP cache policy for both endpoints. | Requester and Staff/Admin responses retain `Cache-Control: no-store` despite client in-memory reuse. | `requester-dashboard.api.test.ts`, `staff-dashboard.api.test.ts` | Not Run |

## 8. Planned PostgreSQL Integration Tests

| ID | Requirement / AC | What It Tests | Expected Result | File | Final |
|---|---|---|---|---|---|
| PG-01 | Data model; AC-01 | Real schema constraints/relations for ActionTaken and creator/assignee/performer. | Valid rows commit; invalid FK/status/check combinations fail safely. Typed child families match every Activity enum; TICKET_ASSIGNED requires assignment and permits only optional NEW -> OPEN status, while reassignment/unassignment remain assignment-only; required children cannot be omitted, deleted, or moved away; non-snapshot status/priority previous values cannot be null. Parent and children may be assembled in one transaction. | `schema-contract.postgres.test.ts` | Pass |
| PG-02 | BR-121–130; AC-34–35 | Upgrade representative Lab 3 data through committed migration. | Existing Users, Tickets, Attachments, Public Comments, Internal Notes, and Idempotency records preserved; exactly one SYSTEM User, one snapshot per legacy Ticket, one synthetic `isMigrated=true` Completed Action per eligible legacy `RESOLVED`/`CLOSED` Ticket, none for ineligible Tickets; migrated Actions remain visible but do not count toward resolution. | `migration-upgrade.postgres.test.ts` | Blocked |
| PG-03 | BR-24–33; AC-08–11 | Real Action lifecycle timestamps/version/terminal behavior. | Committed DB state matches lifecycle contract. | `action-lifecycle.postgres.test.ts` | Not Run |
| PG-04 | BR-34–39; AC-06 | Assignment eligibility/version in real DB. | Valid assign/reassign/unassign commits; invalid target no state change. | `action-lifecycle.postgres.test.ts` | Not Run |
| PG-05 | BR-53, BR-75–83; AC-12 | Two connections update same Action version concurrently. | At most one wins current version; loser cannot overwrite. | `action-concurrency.postgres.test.ts` | Not Run |
| PG-06 | BR-36–37; AC-13 | Concurrent reassignment with same expectedVersion. | Exactly one assignment commit; Activity matches committed winner. | `action-concurrency.postgres.test.ts` | Not Run |
| PG-07 | BR-75–83; AC-14–15, AC-39 | Persistent Action-create identity `(actor, method, concrete path, key)` and replay/conflict. | One result per exact scope; path-specific replay/conflict remains correct after reconnect. | `action-idempotency.postgres.test.ts` | Not Run |
| PG-08 | BR-75–83; AC-16 | Concurrent/repeated lifecycle idempotency. | One lifecycle transition and one Activity; completed replay stable. | `action-idempotency.postgres.test.ts` | Not Run |
| PG-09 | BR-40–49; AC-17–18 | ActionTakenAttachment uniqueness, existing Active same-Ticket rules, cancellation preservation. | Eligible join rows persist; duplicates, unavailable, and cross-Ticket Attachments are rejected; terminal history preserved. | `action-attachments.postgres.test.ts` | Not Run |
| PG-10 | BR-63–74; AC-19–20, AC-24 | Business mutation + Activity atomic commit/rollback, including Requester resolution confirmation. | Forced Activity failure rolls back confirmation timestamp update; successful `looks-resolved` creates exactly one `REQUESTER_RESOLUTION_CONFIRMED` Activity with authenticated Requester actor; other normal mutations create exactly expected Activity. | `ticket-activity.postgres.test.ts` | Not Run |
| PG-11 | BR-52–55; AC-21–23 | Resolution gate under real data and concurrent Action changes. | Only non-migrated Completed Actions satisfy the gate; no Ticket resolves from an inconsistent/open Action set. | `ticket-resolution.postgres.test.ts` | Not Run |
| PG-12 | BR-84–102; AC-26–30 | Dashboard counts/lists vs direct DB queries in one repeatable-read snapshot. | DTO metrics exactly match DB truth; concurrent writes do not mix snapshots. | `dashboards.postgres.test.ts` | Not Run |
| PG-13 | BR-121–130; AC-34–35 | Fail or interrupt migration/backfill on representative Lab 3 fixture, verify rollout stops, apply documented state recovery, then retry deployment/backfill; repeat completed deployment. | Schema-dependent rollout stops on failure; recovery completes; all representative legacy User, Ticket, Attachment, Public Comment, Internal Note, and Idempotency rows survive; exactly one SYSTEM User and one snapshot per legacy Ticket; exactly one synthetic `COMPLETED`, `isMigrated=true` Action per eligible legacy `RESOLVED`/`CLOSED` Ticket and none for ineligible Tickets; no retry duplicates; migrated Actions remain excluded from resolution gate. | `migration-upgrade.postgres.test.ts` | Blocked |
| PG-14 | BR-131; AC-35 | Seed run twice. | Second run does not duplicate logical seed Users/Tickets/Actions/Activity. | `seed-idempotency.postgres.test.ts` | Pass |
| PG-15 | BR-52, BR-127; AC-38 | Legacy RESOLVED Ticket is migrated with one completed synthetic Action; Requester reopens; resolve is rejected; a real non-migrated Action is completed; resolve then succeeds. | Reopen succeeds; migrated-only resolve returns `INVALID_STATUS_TRANSITION`; resolve succeeds after non-migrated completion. | `ticket-resolution.postgres.test.ts` | Not Run |
| PG-16 | BR-76–83; AC-39 | Same actor/key/body against two Ticket paths and two Action paths. | Distinct concrete paths persist and replay only their own resource results. | `action-idempotency.postgres.test.ts` | Not Run |

## 9. Planned UI Component Tests

| ID | Requirement / AC | What It Tests | Expected Result | File | Final |
|---|---|---|---|---|---|
| UI-01 | FR-03–14; AC-02, AC-05 | Actions DataTable fields, role-visible row actions, filters/search/empty states. | Requester read-only; Staff/Admin state/permission controls correct. | `ActionsTaken.test.tsx` | Not Run |
| UI-02 | FR-04–06; AC-01–02 | Create/Edit CommonForm fields, defaults, conditional Follow-Up, Attachment Notes, dirty-state behavior. | Create defaults assignee=current user but can clear; Result absent on create; validation works. | `ActionForm.test.tsx` | Not Run |
| UI-03 | FR-07, FR-48–52; AC-06, AC-33 | Assign/Reassign through global User Lookup and separate confirmed Unassign. | Select row action sends eligible User through assignee mutation; no fake Unassigned row; Unassign has separate confirmation; stale/ineligible response is recoverable. | `ActionAssigneeSelection.test.tsx` | Not Run |
| UI-04 | FR-08–11; AC-07–11, AC-34 | Action Detail lifecycle controls and migrated historical context. | Start disabled unassigned; Start confirm; Complete/Cancel modals; terminal controls hidden; migrated record indicator remains visible. | `ActionDetail.test.tsx` | Not Run |
| UI-05 | AC-12 | Action edit stale conflict preservation. | Entered values remain; Reload latest offered; no silent discard. | `ActionForm.test.tsx` | Not Run |
| UI-06 | BR-65; AC-20, AC-24 | Activity timeline rendering/filter/oldest-first Action history/Load More. | Typed events, including `REQUESTER_RESOLUTION_CONFIRMED`, render readable confirmation narrative without implying Ticket status change; Requester Activity absent. | `ActivityTimeline.test.tsx` | Not Run |
| UI-07 | AC-21–25 | Ticket workflow controls + resolution feedback + Admin parity presentation. | Controls reflect current role/owner/status; backend error produces Refresh -> retry path. | `TicketWorkflow.test.tsx` | Not Run |
| UI-08 | AC-26–27, AC-31 | Requester Dashboard cards, recent table, URL size, mobile quick action conditions. | Correct labels/links/state; 5/10/20 query changes URL/request. | `RequesterDashboard.test.tsx` | Not Run |
| UI-09 | AC-28–31 | Staff/Admin Dashboard metrics, three compact DataTables, role-aware links. | Shared component renders both roles with correct destinations/columns. | `StaffDashboard.test.tsx` | Not Run |
| UI-10 | FR-42–44; BR-103–105; AC-32 | 30-second auto-refresh and manual Refresh single-flight. | Timer requests after 30 seconds; ticks/manual Refresh during pending request do not overlap or abort it; completion permits next future refresh without queued ticks. | `DashboardRefresh.test.tsx` | Not Run |
| UI-11 | BR-105–110; AC-32 | Initial vs background refresh failure, accepted success, and Last Updated. | Initial ErrorState/Retry; failed background refresh retains prior DTO with warning/Retry and unchanged time; success replaces visible DTO, clears warning, updates HH:mm:ss; no re-skeleton or persistent "Refreshing...". | `DashboardRefresh.test.tsx` | Not Run |
| UI-12 | FR-49; AC-33, AC-36 | Reusable Lookup open/close/selection, disabled field, field errors, keyboard/focus. | DataTable Select works by keyboard, selection updates managed value/display, close restores focus, disabled field prevents changes, errors associate with owning CommonForm control. | `LookupField.test.tsx`, `LookupModal.test.tsx`, `Accessibility.test.tsx` | Not Run |
| UI-13 | AC-36 | Modal focus, field error association, disabled semantics, accessible card links, non-color chips. | Semantic accessibility assertions pass. | `Accessibility.test.tsx` | Not Run |
| UI-14 | FR-42–43; BR-103–104; AC-32 | Hidden/visible document scheduling. | Hidden pauses polling; visible triggers immediate refresh/revalidation and restarts 30-second schedule without overlapping an active request. | `DashboardRefresh.test.tsx` | Not Run |
| UI-15 | FR-46; BR-109, BR-111; AC-32 | Fresh/stale cache on remount with controlled clock. | <=30-second successful cache renders immediately including exact 30-second boundary; >30-second stale cache may render while immediate revalidation occurs; remount does not advance success timestamp. | `DashboardRefresh.test.tsx` | Not Run |
| UI-16 | FR-46–47; BR-107, BR-111–112; AC-32 | Cache isolation and storage boundaries. | Different authenticated User/role/URL-query scopes never reuse each other's DTO; late responses do not replace current context; no Dashboard localStorage/sessionStorage/service-worker/HTTP cache persistence. | `DashboardRefresh.test.tsx` | Not Run |
| UI-17 | FR-49–51; BR-113–116; AC-33 | Reusable Lookup DataTable search, sort, page and exposed page-size changes. | Definition drives columns/API adapter; search follows existing debounce/query conventions, sorting/paging sends standard collection parameters; no per-page modal wiring or User Management actions. | `LookupModal.test.tsx` | Not Run |
| UI-18 | FR-49; BR-116, BR-120; AC-33 | Reusable Lookup loading, empty default, no-results, load failure and Retry. | Distinct states render safely; failure does not masquerade as empty or change saved value; Retry loads selectable rows. | `LookupModal.test.tsx` | Not Run |

## 10. Responsive and Visual Tests

| ID | Requirement / AC | What It Tests | Expected Result | File / Evidence | Final |
|---|---|---|---|---|---|
| RESP-01 | AC-36 | Requester Dashboard at 1440/820/390. | No overflow/clipping; mobile cards full-width; Quick Actions mobile only. | `responsive-visual.spec.ts` | Not Run |
| RESP-02 | AC-36 | Staff/Admin Dashboard and compact DataTables at all viewports. | Cards/tables remain usable with no page horizontal scroll. | `responsive-visual.spec.ts` | Not Run |
| RESP-03 | AC-36 | Ticket Actions, create/edit modal, Action Detail, assignee selection, Activity at all viewports. | Controls remain reachable/readable; modal/table/timeline layouts adapt. | `responsive-visual.spec.ts` | Not Run |
| VIS-01 | AC-36 | Zen Green consistency + desktop/tablet/mobile screenshot checklist. | Required screenshot directories populated; no accidental second visual system. | `artifacts/lab-04/screenshots/` | Not Run |

## 11. End-to-End Tests

| ID | Requirement / AC | Flow | Expected Result | File | Final |
|---|---|---|---|---|---|
| E2E-01 | AC-01, AC-04, AC-06, AC-08–10, AC-17, AC-19–20 | Staff claims/open Ticket -> create Action -> select assignee -> assignee starts with confirm -> edit -> associate existing eligible Attachment and enter Attachment Notes -> complete -> inspect Action/Ticket Activity -> Requester views Action read-only. | Full integrated Action workflow succeeds with correct permissions/history; no upload is added. | `actions-taken-flow.spec.ts` | Not Run |
| E2E-02 | AC-19, AC-21–25 | Open Action -> Mark Resolved rejected -> complete/cancel remaining work with >=1 non-migrated Completed Action -> Mark Resolved succeeds -> Requester Looks Resolved -> owner closes; Staff/Admin inspects Activity; exercise Administrator parity and owner-only rule. | Requester confirmation appears as `REQUESTER_RESOLUTION_CONFIRMED` with readable advisory narrative in Staff/Admin Activity; final Ticket lifecycle and gates work end-to-end; PG-15 covers migrated legacy reopen sequence. | `ticket-resolution.spec.ts` | Not Run |
| E2E-03 | AC-26–32 | Seed known role data -> Requester Dashboard counts/drill-down -> Staff Dashboard counts/My Actions/recent/urgent -> Administrator shared Dashboard -> size choices -> automatic 30-second refresh and manual Refresh -> remount/visibility revalidation -> recoverable refresh failure. | Cards/lists match seeded DB records and drill-down filters; refreshed DTO/time update, cache/visibility remain single-flight, and failure retains last good data. | `dashboards.spec.ts` | Not Run |

## 12. Migration / Data / Repository Evidence

| ID | Requirement / AC | Evidence | Expected Result | Final |
|---|---|---|---|---|
| DATA-01 | AC-34–35 | Inspect committed Prisma migration SQL/schema diff. | In-place additive/evolutionary migration; no destructive reset; restrictive FKs/indexes/checks documented. | Pass |
| DATA-02 | AC-34–35 | Rehearse documented failed/interrupted migration recovery on representative Lab 3 DB backup/fixture, including target preflight, failed-state inspection, correction or verified backup restore, and retry. | Legacy User/Ticket/Attachment/Public Comment/Internal Note/Idempotency rows preserved; exactly-once SYSTEM User, snapshot, and eligible synthetic Action counts explained; ineligible Tickets have none; `isMigrated=true` Actions remain excluded from resolution. | Blocked |
| DATA-03 | AC-35 | Run seed twice and record logical counts. | Same logical seed state after second run. | Pass |
| DATA-04 | AC-37 | Final release documentation inspection. | README plus completed `docs/lab-04/reviewer.md` and handout-required `docs/lab-04/ai-use.md` are accurate and contain no placeholder review results; owned by Final Hardening and Release. | Not Run |

## 13. Performance Smoke

### 13.1 Purpose

The performance smoke detects gross regressions such as unbounded in-memory filtering, N+1 explosion, or endpoints returning full collections.

It is explicitly **not a production SLA**.

### 13.2 Large synthetic dataset

The dedicated smoke dataset is intentionally large:

```text
Users          >= 1,000 synthetic users
Tickets        >= 100,000
Actions        >= 300,000
Activities     >= 500,000
Attachments    enough to exercise association joins without storing huge binary payloads
```

The generator must be deterministic/repeatable and must not run during ordinary `npm test`.

### 13.3 Smoke assertions

| ID | Requirement / AC | What It Tests | Expected Result | File | Final |
|---|---|---|---|---|---|
| PERF-01 | AC-37 | Requester Dashboard, Staff Dashboard, one Action collection page, one Activity page on large seeded DB. | Each returns within a generous configured CI regression ceiling (default 2s per measured query/request after warmup where environment supports it), returns bounded row counts, honors pagination/size, and does not load an entire collection into application memory. | `postgres/performance-smoke.postgres.test.ts` | Not Run |

If the course CI environment cannot reliably sustain the dataset, PERF-01 runs as an explicit dedicated verification command rather than weakening the dataset or turning the threshold into a claimed SLA. A Blocked result must document environment limits; it must not be silently reported as Pass.

## 14. Labs 1–3 Regression Gate

Lab 4 final verification runs complete earlier suites.

| ID | Scope | Expected Result | Final |
|---|---|---|---|
| REG-01 | Full server Lab 1–4 suite | All approved server regression passes. | Not Run |
| REG-02 | Full client Lab 1–4 suite | All approved UI/component regression passes. | Not Run |
| REG-03 | Lab 1–4 E2E suite | Authentication, Requester, Staff, Admin, Actions, Dashboards, responsive flows pass. | Not Run |

Tests whose premise was explicitly superseded by an approved later contract may be evolved, but equivalent-or-stronger coverage must remain. Do not delete a regression merely because it becomes inconvenient.

Critical preserved areas:

- auth/session/rate-limit;
- Requester ownership;
- Create Ticket + Ticket idempotency;
- My Tickets query/pagination;
- Ticket Detail safe 404;
- Pending/Active/Removed Attachments;
- binary preview/download;
- Staff Queue;
- Ticket ownership/priority/workflow;
- Public Comments;
- Internal Notes;
- User Management;
- CommonForm/DataTable;
- CORS/no-store/request correlation/error envelope;
- maintenance cleanup.

## 15. Acceptance Criterion Traceability

| AC | Planned evidence |
|---|---|
| AC-01 | UNIT-02, API-01, PG-01, E2E-01 |
| AC-02 | UNIT-02, API-02, UI-02 |
| AC-03 | UNIT-07, API-03 |
| AC-04 | API-04, E2E-01 |
| AC-05 | API-05, UI-01 |
| AC-06 | UNIT-03, UNIT-08, API-06, API-19, PG-04, UI-03 |
| AC-07 | UNIT-01, API-07, UI-04 |
| AC-08 | UNIT-01, API-07, PG-03, E2E-01 |
| AC-09 | UNIT-01–02, API-08, PG-03, E2E-01 |
| AC-10 | UNIT-01–02, API-09, PG-03, E2E-01 |
| AC-11 | UNIT-01, API-10, PG-03, UI-04 |
| AC-12 | API-10, PG-05, UI-05 |
| AC-13 | PG-06 |
| AC-14 | UNIT-10, API-11, PG-07 |
| AC-15 | UNIT-10, API-11, PG-07 |
| AC-16 | API-12, PG-08 |
| AC-17 | API-13, PG-09, E2E-01 |
| AC-18 | API-13, PG-09 |
| AC-19 | PG-10, E2E-01 |
| AC-20 | UNIT-09, API-14, PG-10, UI-06, E2E-01 |
| AC-21 | UNIT-04, API-15, PG-11, E2E-02 |
| AC-22 | UNIT-04, API-15, PG-11, E2E-02 |
| AC-23 | UNIT-04, API-15, PG-11, E2E-02 |
| AC-24 | UNIT-09, API-14, API-16, PG-10, UI-06, E2E-02 |
| AC-25 | API-16, UI-07, E2E-02 |
| AC-26 | API-17, PG-12, E2E-03 |
| AC-27 | API-17, UI-08, E2E-03 |
| AC-28 | API-18, PG-12, E2E-03 |
| AC-29 | UNIT-05, API-18, PG-12, UI-09 |
| AC-30 | PG-12 |
| AC-31 | UNIT-06, API-17–18, UI-08–09 |
| AC-32 | API-23, UI-10–11, UI-14–16, E2E-03 |
| AC-33 | UNIT-08, UNIT-11, API-19, API-22, UI-03, UI-12, UI-17–18 |
| AC-34 | API-03, UI-04, PG-02, PG-13, DATA-01–02 |
| AC-35 | PG-02, PG-13–14, DATA-02–03 |
| AC-36 | UI-12–13, RESP-01–03, VIS-01 |
| AC-37 | PERF-01, REG-01–03, DATA-04 |
| AC-38 | API-15, PG-15 |
| AC-39 | UNIT-10, API-21, PG-07, PG-16 |

No AC may be marked complete while every mapped evidence row is Not Run/Fail/Blocked unless the contract is explicitly amended.

## 16. Detailed Scenario Matrix

### 16.1 Action actor matrix

API tests must parameterize at least:

```text
Requester
unrelated IT Staff
Action creator
Action assignee
Ticket Owner
unrelated Administrator
Administrator Ticket Owner
inactive Staff target
SYSTEM User target
```

against:

```text
create
edit
assign
unassign
start
complete
cancel
read
activity read
```

### 16.2 Action status matrix

Test all Action operations against:

```text
PLANNED
IN_PROGRESS
COMPLETED
CANCELLED
```

including exact invalid transitions.

### 16.3 Ticket status Action-create matrix

Create must be tested for:

```text
NEW                    reject
OPEN                   allow
IN_PROGRESS            allow
WAITING_FOR_REQUESTER  allow
RESOLVED               reject
CLOSED                 reject
REOPENED               allow
CANCELLED              reject
```

### 16.4 Resolution datasets

At least:

```text
zero Actions                              reject
only Cancelled                            reject
one Planned                               reject
one In Progress                           reject
one Completed                             allow if Ticket source status valid
Completed + Cancelled                     allow
Completed + Planned                       reject
Completed + In Progress                   reject
multiple Completed + Cancelled            allow
```

### 16.5 Dashboard empty/nonzero

Requester:

```text
zero owned Tickets
only Cancelled
mixed Active/Waiting/Resolved/Closed
recent count < requested size
recent count > requested size
```

Staff/Admin:

```text
zero workload
unassigned Tickets
owned-by-me + owned-by-other
high IT priority
recently updated
urgent ordering
my Action currently assigned
my Action completed by me but reassigned later
Action satisfying both assigned/performed -> one row
```

## 17. Idempotency Test Details

Identity is `(authenticated user, HTTP method, concrete canonical resource path, Idempotency-Key)`. Path tests use actual Ticket/Action UUIDs, including `POST /api/tickets/<ticketPublicId>/actions` and `POST /api/tickets/<ticketPublicId>/actions/<actionPublicId>/complete`.

For each idempotent endpoint prove:

1. first request succeeds;
2. exact retry with same key/request returns prior logical result;
3. only one business mutation exists;
4. only one corresponding Activity exists;
5. same exact identity + changed normalized semantic body conflicts; the request hash includes method, concrete path, and `expectedVersion` where applicable;
6. different key + valid current request executes as a new logical operation where allowed;
7. process interruption/transaction rollback does not create a false completed record.

Lifecycle tests specifically prove replay happens before stale expectedVersion rejection for an already completed same-key request.

Reuse the same actor/key/payload against two Ticket UUIDs and two Action UUIDs. Each concrete path must create/replay only its own resource result; a response for one resource must never be returned for another path.

## 18. Activity Test Details

Activity tests use unique marker actors/action descriptions so events cannot be mistaken.

Only approved meaningful Ticket/Action mutations and migration snapshots produce TicketActivity. Requester `looks-resolved` is a Ticket mutation with `REQUESTER_RESOLUTION_CONFIRMED` Activity; a repeat with no Ticket change adds none. Tests reject duplicated Comments/Internal Notes or Attachment Notes, HTTP request logs, security telemetry, and unrelated generic events.

Prove:

- correct Ticket FK;
- correct `performedByUserId`;
- correct enum;
- correct typed child row;
- correct ActionTaken FK for Action events;
- no arbitrary JSON metadata;
- no update/delete route;
- chronological API sorting;
- Action-specific endpoint excludes unrelated Ticket events;
- Requester cannot read Activity;
- migration snapshot identifies SYSTEM User;
- normal Action migrated record does not falsely name SYSTEM as performer.

## 19. Global Lookup and Assignee Selection Test Details

Reusable component tests (UI-12, UI-17–18) exercise a supplied definition rather than a one-off Action picker:

- open, close, modal keyboard navigation/focus trap, and focus restoration;
- Name, Email, Role, Action columns through the existing DataTable, with explicit Select row action;
- successful selection updates managed value/display through getValue/getDisplayValue;
- search and existing debounce/commit behavior, sort changes, page changes, and page-size changes when exposed;
- standard search/searchFields/filters/sort/pageNumber/pageSize requests and X-Pagination mapping through the domain definition;
- loading, empty default, empty search/no-results, safe load failure, and Retry;
- disabled field cannot open/select/clear, and validation/server errors integrate with CommonForm;
- no User Management administrative actions and no fake Unassigned User row.

Integration/API tests (UI-02–03, UNIT-08, UNIT-11, API-06, API-19, API-22, PG-04) prove:

- Create defaults to authenticated eligible Staff/Admin and may clear before submit;
- persisted Assign/Reassign uses global User Lookup and the Action assignee endpoint; persisted Unassign is separate and confirmed;
- Staff/Admin access is allowed; Requester lookup access returns 403;
- active eligible Staff/Admin returned, with Requester, inactive, deleted, and SYSTEM excluded even under client query filters;
- name/email search, name/email/role sorting, role/EQUAL filtering, deterministic tie-break, bounded pages, and accurate X-Pagination;
- unsupported fields/operators and malformed queries fail safely;
- selected User becoming inactive/ineligible is rejected by mutation backend without changing saved assignment;
- existing Ticket-owner consumers still reach eligible users beyond the first page after the endpoint evolves; earlier-lab tests are intentionally updated only for the changed collection contract.

## 20. Dashboard Refresh Test Details

Use fake timers, controlled successful-response timestamps, deferred request completion, and document visibility changes. Apply shared behavior to Requester and Staff/Admin Dashboards. All scenarios remain Not Run until executed.

1. **UI-10:** successful initial request; advancing 30 seconds requests automatic refresh. Advancing another timer tick while pending starts no second request.
2. **UI-10:** manual Refresh while pending is disabled/ignored. The active request is not aborted to refresh. Completing it permits the next future scheduled/manual refresh, without replaying skipped ticks.
3. **UI-14:** hiding the document pauses scheduled polling. Returning visible requests immediate refresh/revalidation and restarts the normal schedule; an already-active request remains single-flight.
4. **UI-15:** remount with cache age below and exactly 30 seconds renders successful data immediately; age greater than 30 seconds may render stale success while requesting immediate revalidation. Cache reuse preserves original Last Updated.
5. **UI-16:** change authenticated User, role, and Dashboard URL/list-size query independently; no cache entry or late response from the previous scope replaces current-scope data. No previous User/role data renders during auth transitions.
6. **UI-11:** initial failure without success shows page-level ErrorState/Retry; background failure retains previous successful DTO with non-destructive warning/Retry, without blanking or advancing timestamp.
7. **UI-11:** accepted successful refresh immediately replaces visible metrics/lists, clears warning, and updates `Last updated HH:mm:ss` beside Refresh. No background skeleton or persistent "Refreshing..." indicator is added.
8. **API-23 / UI-16:** both Dashboard endpoints remain HTTP `Cache-Control: no-store`; client reuse is application memory only. No Dashboard cache read/write through localStorage/sessionStorage or service-worker/HTTP caching is introduced.

### 20.1 Delivery ownership

The final seven-Issue decomposition and dependency chain are in `specification.md` §14. GitHub Issues #77–#83 own this contract and implementation plan. #77 owns contract review, traceability, and freeze; #78 owns data foundation/migration; #79 owns Actions backend/API; #80 owns Actions UI/global Lookup; #81 owns Ticket workflow/resolution; #82 owns Dashboards; #83 owns final hardening, regression, and release evidence. Do not combine #78/#79 or split #83.

Each requirement and planned test has exactly one primary implementation Issue. Cross-layer contributors may add related coverage under their own Issue without changing primary ownership.

#### Primary FR / BR ownership

| Primary Issue | FR | BR |
|---|---|---|
| #78 | FR-01, FR-55, FR-57–60 | BR-01–04, BR-12–16, BR-40–41, BR-49, BR-64–70, BR-82, BR-121–131 |
| #79 | FR-02–11, FR-14–20, FR-23–24, FR-50–51, FR-53–54, FR-56 | BR-05–11, BR-17–19, BR-21–39, BR-42–48, BR-63, BR-71–81, BR-83, BR-114–115, BR-119–120 |
| #80 | FR-12–13, FR-21–22, FR-48–49, FR-52 | BR-20, BR-113, BR-116–118 |
| #81 | FR-25–30 | BR-50–62 |
| #82 | FR-31–47 | BR-84–112 |
| #83 | FR-61–63 | Final verification of all BRs; no duplicated primary rule ownership |

#### Primary AC ownership

| Primary Issue | AC |
|---|---|
| #78 | AC-34–35 |
| #79 | AC-01–20, AC-39 |
| #80 | AC-33 |
| #81 | AC-21–25, AC-38 |
| #82 | AC-26–32 |
| #83 | AC-36–37 |

Frozen rows PG-02, PG-13 and DATA-02 include actual exclusion of migrated Actions from resolution. Migration/data checks and the persistent `isMigrated` marker provide partial evidence only. These complete rows remain Blocked pending downstream #81 resolution-gate evidence (API-15, PG-11, PG-15, E2E-02); foundation execution alone does not complete AC-34 or these #78-owned acceptance rows.

The exact AC-to-test mapping remains in §15. Final integration ownership for E2E-01 belongs to #83 after #80 Action UI and #81 workflow Activity are ready.

#### Primary planned Test ownership

| Primary Issue | Planned Test IDs |
|---|---|
| #78 | PG-01, PG-02, PG-13, PG-14, DATA-01, DATA-02, DATA-03 |
| #79 | UNIT-01, UNIT-02, UNIT-03, UNIT-07, UNIT-08, UNIT-09, UNIT-10, UNIT-11, API-01–14, API-19–22, PG-03–10, PG-16 |
| #80 | UI-01–06, UI-12, UI-17–18, RESP-03 |
| #81 | UNIT-04, API-15–16, PG-11, PG-15, UI-07, E2E-02 |
| #82 | UNIT-05–06, API-17–18, API-23, PG-12, UI-08–11, UI-14–16, RESP-01–02, E2E-03 |
| #83 | UI-13, VIS-01, E2E-01, DATA-04, PERF-01, REG-01–03 |

PG-10 is owned by #79 for Action mutations; #81 contributes Ticket mutation cases. All test results remain `Not Run` until actually executed. Final release records remain `docs/lab-04/reviewer.md` and the handout-specific `docs/lab-04/ai-use.md`; screenshots remain under `artifacts/lab-04/screenshots/`. Contract review does not populate implementation, release, or test execution evidence.

## 21. Responsive / Visual Checklist

For each major screen and each required viewport verify:

- no page horizontal scroll;
- no clipped text required to understand a control;
- no overlapping cards/modals/feedback;
- readable status/priority text;
- visible focus;
- target buttons reachable;
- DataTable responsive layout usable;
- modal fits viewport;
- Action Detail stacks appropriately;
- assignee selection remains reachable and operable;
- Timeline does not collapse into unreadable layout;
- mobile Requester Quick Actions present only where specified;
- no desktop duplicate Quick Actions;
- Zen Green tokens/components reused;
- no unapproved color-only state meaning.

Major screens:

```text
Requester Dashboard
Staff Dashboard
Administrator Dashboard
Requester Ticket Detail + Actions
Staff/Admin Ticket Detail + Actions + Activity
Create Action
Edit Action
Action Detail
Assignee selection modal
Complete modal
Cancel modal
```

## 22. Command Matrix

Exact package scripts may evolve during implementation; final README must match committed scripts. Planned command families:

| Purpose | Directory | Planned command/evidence |
|---|---|---|
| Backend focused Lab 4 | `server/` | `npm test -- tests/lab-04/<file>` |
| Backend full | `server/` | `npm test` |
| Backend build | `server/` | `npm run build` |
| PG Lab 4 | `server/` | guarded `NODE_ENV=test TEST_DATABASE_URL=... npm test -- tests/lab-04/postgres` |
| Migration deploy rehearsal | `server/` | guarded `npx --no-install prisma migrate deploy` |
| Seed twice | `server/` | guarded `npm run prisma:seed` twice |
| Client focused Lab 4 | `client/` | `npm test -- tests/lab-04/<file>` |
| Client full | `client/` | `npm test` |
| Client build | `client/` | `npm run build` |
| Lab 4 E2E | root | `npm run test:e2e -- e2e/lab-04` |
| Responsive/visual | root | `npm run test:e2e -- e2e/lab-04/responsive-visual.spec.ts` |
| Performance smoke | `server/` | explicit guarded command targeting `performance-smoke.postgres.test.ts` |

Do not run migration/seed/performance setup against production or the normal shared development database.

## 23. Final Verification Order

Recommended release verification:

1. backend build;
2. client build;
3. Lab 4 unit/API;
4. guarded Lab 4 PG;
5. migration rehearsal from representative Lab 3 state;
6. seed twice;
7. Lab 4 UI component tests;
8. Lab 4 E2E;
9. responsive/visual evidence;
10. large-data PERF-01;
11. complete server regression;
12. complete client regression;
13. complete E2E regression;
14. `git diff --check`;
15. README/reviewer/evidence inspection.

## 24. Test Definition of Done

Testing is complete only when:

- every AC maps to executed evidence;
- required handout-named files exist and run;
- no mocked test claims real PostgreSQL behavior;
- migration and seed are tested on disposable DB state;
- concurrent Action races use separate real connections;
- idempotency replay does not duplicate Activity;
- Dashboard counts are compared against authoritative DB queries;
- assignment/backend eligibility race and queryable User collection are covered;
- reusable DataTable-backed Lookup states, query controls, Select, form errors, keyboard/focus, and separate confirmed Unassign are verified;
- Dashboard 30-second auto-refresh, single-flight, visibility, scoped fresh/stale in-memory cache, no-store/no-Web-Storage, Last Updated, and safe refresh failures are verified;
- all required viewports have screenshots/checklist evidence;
- Labs 1–3 regression is green;
- performance smoke is explicitly recorded as non-SLA;
- final statuses reflect real results rather than planned assumptions.


## Server regression repair evidence (2026-09-30)

Scope: repair the four supplied CI failures on `feature/78-lab4-data-foundation-migration`. No REST endpoint, Prisma schema, migration, or seed behavior was changed.

The inherited Lab 2 schema/seed tests now assert the approved Lab 4 `User.isSystem`, resource-scoped idempotency columns, foreign keys, checks and unique index, plus SYSTEM/Nora/Former Staff seed rows and their audit/deletion state. Lab 3 session fixtures select active non-system Users. Migrated-password provisioning uses the existing unprovisioned credential sentinel without requiring the Lab 4-only column; the SYSTEM sentinel cannot match it and is enforced by the database constraint. New Lab 4 coverage asserts provisioning preserves SYSTEM and already provisioned human records.

All PostgreSQL runs used the guarded disposable local `toktickit_lab3_test` container. `NODE_ENV=test`, `TEST_DATABASE_URL`, `DATABASE_URL`, and `DIRECT_URL` were explicitly set to the test target, with distinct captured baseline targets. Credentials were read privately from the local container and were not printed. The existing suites rebuilt only this disposable test schema.

| Command / check (server commands run from `server/`) | Observed result |
|---|---|
| `npm test -- tests/lab-02/postgres/migration-upgrade.postgres.test.ts tests/lab-03/postgres/auth-session.postgres.test.ts tests/lab-03/postgres/migration-upgrade.postgres.test.ts` before edits | Red: reproduced all four failures; 4 failed, 5 passed. |
| `npm test -- tests/lab-03/postgres/migration-upgrade.postgres.test.ts` after provisioning fix | Green: 1 passed; legacy human credentials provisioned and verified, repeat provisioning returned zero. |
| `npm test -- tests/lab-02/postgres/migration-upgrade.postgres.test.ts tests/lab-03/postgres/auth-session.postgres.test.ts tests/lab-03/postgres/migration-upgrade.postgres.test.ts tests/lab-04/postgres/seed-idempotency.postgres.test.ts` | Final focused run: 11 passed. An intermediate run exposed one additional stale check-count expectation (8 versus 10), corrected with explicit assertions for both new constraints. |
| `npm test` | 72 files, 1,064 tests passed. |
| `npm run build` in `server/` | Passed TypeScript build. |
| `npm run build` in `client/` | Passed TypeScript/Vite build; existing dependency annotation and chunk-size warnings. |
| `git diff --check` | Passed. |

Existing PostgreSQL concurrent-query deprecation warnings remain. No lint script exists in either application package. Browser E2E and client tests were not run for this backend/test-only repair. No peer review, commit, or push occurred. Changed files were reviewed for scope and secret exposure; no credentials were added.

## Issue #78 review follow-up evidence (2026-09-30)

The original transaction-interruption/rollback and repeated-backfill case remains. A second case in `migration-upgrade.postgres.test.ts` rehearses the supported Prisma recovery procedure through the installed CLI, with no mocked migration commands. Both cases reuse the representative legacy fixture and the same preservation/backfill assertions.

### Target, failure, inspection and recovery

All database commands use `NODE_ENV=test`, captured baseline targets, and explicit matching `TEST_DATABASE_URL`, `DATABASE_URL`, and `DIRECT_URL` overrides. The target guard runs before each Prisma command. The target is the disposable local `toktickit_lab3_test` database at `localhost:55433`; the recovery case creates a unique `lab4_upgrade_<run>_<pid>` schema. Credentials and full connection strings are omitted from this evidence. A temporary config reads only the explicit `DIRECT_URL` and points to disposable migration copies; it cannot fall back to the shared development database.

1. Read-only `npx --no-install prisma migrate status --config <rehearsal-config>` reports the expected database, host/port and unique schema. Exit 1 is checked as pending migrations, rather than a connection failure.
2. Apply the committed historical SQL to construct the Lab 3 fixture using its established schema/public search path, then baseline those four verified migrations with Prisma `migrate resolve --applied`. This is fixture setup, not recovery of an incomplete migration. Status returns 0 before adding the Lab 4 migration copy. Historical extension operator classes reside in `public`; deploying that historical chain using only Prisma's isolated schema search path failed during setup. No historical migration was edited.
3. Retain complete synthetic legacy row snapshots as the verified pre-migration fixture reference: two Users, four Tickets (`RESOLVED`, `CLOSED`, `CANCELLED`, `OPEN`), one Attachment with its bytes, one Public Comment, one Internal Note, and two Idempotency claims (`COMPLETED`, `PROCESSING`).
4. In the disposable Lab 4 SQL copy only, replace the final `COMMIT` with `ROLLBACK; SELECT 1 / 0;`. Prisma executes the whole migration, including schema/backfill, rolls it back and reports exit 1 / `P3018` / `division by zero`. An earlier fault raised inside the still-open transaction produced `current transaction is aborted` instead; ending the transaction before the deliberate error allows this engine version to persist useful failure logs. The committed migration is never changed.
5. Run read-only status again: exit 1, expected schema, and the failed Lab 4 migration name. Inspect its real `_prisma_migrations` entry: exactly one attempt, `finished_at=NULL`, `rolled_back_at=NULL`, and logs containing `division by zero`.
6. Restore the temporary SQL copy byte-for-byte from the approved committed migration. Deployment still exits 1 / `P3009`, proving a corrected file alone cannot bypass failed migration state. All legacy row snapshots remain unchanged. Inspect actual schema/data: no Lab 4 tables, enum types, `is_system`, or generalized idempotency columns survived. No partial effects need repair or a backup restore.
7. Run guarded `npx --no-install prisma migrate resolve --rolled-back 20260930000000_lab4_data_foundation --config <rehearsal-config>`, then `prisma migrate deploy`: both exit 0. Status returns 0 / `Database schema is up to date`. The failed attempt now has a rollback timestamp; a second attempt has a finish timestamp and a SHA-256 checksum matching the approved committed SQL.
8. Repeat `migrate deploy`: exit 0 / `No pending migrations`; both migration-state rows remain unchanged. Replay the committed duplicate-safe snapshot/child/synthetic-Action backfill statements. Counts and legacy data remain unchanged. Cleanup removes only the generated test schema and temporary migration copies; no database reset is used in the rehearsal.

Recovered counts: exactly one non-login SYSTEM User; four SYSTEM-authored snapshots with null previous state and the known current owner/status/priority; exactly two synthetic `COMPLETED`, `is_migrated=true` Actions on the legacy `RESOLVED`/`CLOSED` Tickets, with null assignee/performer and legacy `updated_at` timestamps. `CANCELLED`/`OPEN` Tickets have no synthetic Action. Full legacy row comparisons preserve bytes, timestamps, relationships, and Idempotency claims after normalizing the approved requester/user column rename. The stored Action rows are visible, and the explicit SQL predicate `status = 'COMPLETED' AND is_migrated = FALSE` returns zero.

### Final-state reconciliation and scope limit

PG-01 is **Pass**: the real schema contract test executed. PG-14 and DATA-03 are **Pass**: the seed ran twice and logical counts stayed at 12 human Users, 8 Tickets, 4 explicitly seeded Actions, 2 migrated Actions, 4 explicitly seeded Activity rows, 1 SYSTEM User, and 1 empty-ticket Requester. Explicitly seeded counts are separate from migration snapshot totals.

DATA-01 is **Pass** after inspection of the committed Prisma schema diff and Lab 4 SQL: one transaction adds the Action/Activity structures and `is_system`, renames the existing idempotency actor column in place and replaces its old constraints with resource-scoped constraints/indexes. Existing entities and binary data are retained. Restrictive foreign keys, same-Ticket triggers, SYSTEM non-login/singleton checks, and partial unique indexes for one migrated Action/snapshot per Ticket are present. No preserved-data reset, destructive table/column drop, or applied migration rewrite was introduced.

PG-02, PG-13 and DATA-02 are **Blocked** under their original frozen expectations. Migration, preservation, exactly-once backfill, real Prisma recovery, repeated deployment/backfill, and persistence of `isMigrated=true` passed as partial checks. The SQL predicate/data marker assertion does not prove REST resolution behavior. Actual migrated-Action exclusion still requires #81 integration evidence (API-15, PG-11, PG-15, E2E-02), which remains Not Run. No full Pass or completion of these acceptance rows is claimed. Other planned rows retain their previous state.

The Lab 4 follow-up section was removed from historical `docs/lab-02/ai-use.md`; this prompt and its results belong only in `docs/lab-04/ai-use.md`.

### Commands and observed results

This is test/documentation work with no production behavior change. No artificial failing production test was added. Initial rehearsal failures were fixture/engine diagnostics, not valid TDD Red evidence. The focused recovery case subsequently passed through the real failed-state/recovery sequence above.

| Command / check | Observed result |
|---|---|
| Guarded `npm test -- tests/lab-04/postgres/migration-upgrade.postgres.test.ts` from `server/` | 1 file, 2 tests passed: original rollback case and real Prisma recovery case. |
| Guarded `npm test -- tests/lab-04/postgres` from `server/` | 3 files, 5 tests passed. |
| Guarded `npm test` from `server/` | 72 files, 1,065 tests passed, including the added recovery case and inherited Labs 1–3 coverage. |
| `npm run build` from `server/` | Passed TypeScript build, including the rehearsal test. |
| `npm run build` from `client/` | Passed TypeScript/Vite build; existing dependency annotation and chunk-size warnings. |
| `git diff --check` | Passed. Changed files inspected for scope and secret exposure. |
| `git diff dae5116 -- docs/lab-02/ai-use.md` | Empty: historical pre-Lab-4 AI-use restored exactly. |

No lint script exists in either package. Client tests and browser E2E were not run for this test/documentation-only follow-up. Existing PostgreSQL concurrent-query and Vite annotation/chunk-size warnings remain. Before publication, PR #85 validation was reconciled to distinguish the prior published-head evidence (72 files / 1,064 tests) from the locally validated follow-up (72 files / 1,065 tests); its unconditional `Closes #78` was removed at that time pending resolution-gate evidence. A later review follow-up separated foundation and workflow proof, but that interpretation is superseded below: the frozen acceptance rows still require resolution exclusion. The subsequent user prompt authorized commit and push of this follow-up. No Issue closure or peer-review approval is claimed.


## 22. PR #85 Typed Activity Constraints and Acceptance Evidence

The review follow-up at `5e3c84f` treated PG-02, PG-13, and DATA-02 as foundation-only Pass rows. Review B-01 at `2b560e49` identified that interpretation as a frozen-contract contradiction. Their original expectations are restored and their complete Final states are Blocked. Foundation evidence covers legacy data/relationships, exactly one SYSTEM User and snapshot per legacy Ticket, exactly one eligible synthetic Action and none for ineligible Tickets, historical timestamps/null actors, persistent `isMigrated=true`, and duplicate-safe recovery/redeployment/backfill. Actual migrated-only Mark Resolved rejection still requires downstream #81 integration evidence through API-15, PG-11, PG-15, and E2E-02. Those workflow rows remain Not Run; no contract amendment, full AC-34 acceptance, or Issue closure is claimed.

New forward migration `20261001000000_lab4_activity_detail_constraints` adds deferred database constraint triggers on TicketActivity and all four typed child tables. It validates enum/detail pairing and required children, restricts null previous status/priority to migration snapshots, and checks updates/deletes/moves as well as inserts. It validates all existing Activity rows atomically and fails without deleting invalid legacy data. Existing applied migrations are unchanged. Cross-table cardinality cannot be expressed by Prisma models or a single-table CHECK; SQL constraint triggers enforce it without changing Prisma fields or generated Client output. Seed Activity parent/detail upserts now share a transaction. Both upgrade/recovery cases apply the new migration before duplicate-safe backfill replay.

PG-01 adds valid cases for every normal Activity enum and negative cases for every required child family, each missing snapshot child, mismatched Action/Ticket children, null non-snapshot previous values, parent enum updates, child deletion/movement, and previous-value updates. It accepts migration snapshots with null previous state and Requester confirmation without a child. Separate parent/child statements commit successfully inside one transaction. A missing-detail standalone append fails at commit and leaves no parent row.

TDD evidence: before production changes, the focused `TICKET_CLOSED` + null previous status regression failed because the invalid nested insert committed. After the new migration it passed. Broader checks exposed this Prisma adapter's masked deferred-commit error (`Transaction already closed: A rollback cannot be executed on a committed transaction.`); negative tests force `SET CONSTRAINTS ALL IMMEDIATE` inside the transaction to assert the actual database constraint message. A separate commit rejection plus absent-row assertion verifies durable rollback. The exact invalid row from the Red run was removed only from the disposable local test fixture. The recovery rehearsal initially exposed Prisma status reporting pending follow-up migrations before the failed-migration message; the follow-up copy is introduced after failed-state inspection so the original P3018/P3009 proof remains intact.

Observed validation on the guarded disposable `toktickit_lab3_test` target at `127.0.0.1:55433`, with explicit matching TEST_DATABASE_URL/DATABASE_URL/DIRECT_URL overrides:

- `npm test -- tests/lab-04/postgres`: 3 files / 5 tests passed, including expanded PG-01, both recovery cases, and seed reruns.
- Full server `npm test`: 72 files / 1,065 tests passed, including inherited Labs 1–3 PostgreSQL coverage.
- Server `npm run build`: passed TypeScript compilation.
- Client `npm run build`: passed TypeScript/Vite build; existing annotation/chunk-size warnings remain.
- Final guarded `npx --no-install prisma migrate status`: six migrations; local schema up to date after inherited fixture resets. Final focused rerun with privately captured actual baseline identities also passed (3 files / 5 tests).
- `git diff --check`: passed. In-scope diffs and the new migration were inspected for secrets and data preservation.
- Issue #78 and PR #85 bodies updated and read back exactly; the PR explicitly identifies these fixes as local/uncommitted pending publication and peer review.

No lint scripts exist. Client tests/browser E2E were not run: this change affects database constraints and seed, without frontend or REST endpoint changes. No shared database migration, commit, push, Issue closure, or peer-review approval is claimed. The Issue/PR synchronization distinguishes current published head from these locally validated, uncommitted fixes.

### PR #85 Claim contract correction at published head `e1044525`

The original typed Activity constraint fixes are published at `e10445254774e3e0659ffbc9b1b157d244d75bb7` (`fix: enforce typed Activity database constraints`); the preceding review follow-up records its historical pre-publication state. Its reported 3 PostgreSQL files / 5 tests and 72 server files / 1,065 tests apply to that published head. At validation time, the Claim correction below remained a separate local, uncommitted follow-up.

Frozen API §16.3 is unchanged. Additive migration `20261001010000_lab4_claim_activity_details` replaces only the validator function and revalidates existing Activity rows atomically. Applied migrations/checksums, deferred triggers, Prisma fields, restrictive relationships, and legacy data are preserved. Required status and allowed status are separate checks: `TICKET_ASSIGNED` still requires assignment and permits status only with `previousStatus=NEW` and `status=OPEN`; reassignment/unassignment remain assignment-only. No REST endpoint or frontend behavior was implemented here; #81 retains workflow ownership.

PG-01 now verifies assignment-only and assignment plus `NEW -> OPEN` commit; `RESOLVED -> CLOSED`, `NEW -> CLOSED`, `OPEN -> OPEN`, and null previous status reject on `TICKET_ASSIGNED`. Status-only assignment, reassignment/unassignment with status (with or without assignment), invalid updates to a Claim status, deletion of its required assignment, and changing its parent to reassignment also reject. Both upgrade/recovery rehearsals include the new forward migration.

TDD evidence: assignment-only committed before the fix, disproving a general assignment/FK failure. The paired Claim regression failed before production changes; Prisma initially masked the deferred commit error. `SET CONSTRAINTS ALL IMMEDIATE` exposed PostgreSQL `23514` with `Activity typed details must match its action and include required previous state`. After the forward migration, the focused test passed; expanded rejection checks then passed without further production changes.

Observed local follow-up validation, with privately captured baseline identities and matching TEST_DATABASE_URL/DATABASE_URL/DIRECT_URL overrides on guarded disposable `127.0.0.1:55433/toktickit_lab3_test`:

- Focused Red: `npm test -- tests/lab-04/postgres/schema-contract.postgres.test.ts`, 1 test failed on the approved Claim shape.
- Focused Green: same command, 1 test passed.
- `npm test -- tests/lab-04/postgres`: 3 files / 5 tests passed, including both recovery rehearsals and seed reruns.
- Full server `npm test`: 72 files / 1,065 tests passed, including inherited PostgreSQL suites.
- Server `npm run build`: passed TypeScript compilation.
- Client `npm run build`: passed TypeScript/Vite build; existing annotation/chunk-size warnings remain.
- Guarded `npx --no-install prisma migrate status`: seven migrations; local schema up to date.
- PR #85 and Issue #78 evidence bodies were updated and read back exactly; at validation time, published head was `e1044525`. Original typed Activity fixes awaited peer review; this separate local Claim correction awaited publication and peer review.
- `git diff --check`: passed; changed files and the new migration inspected for secret exposure and data preservation.

No lint scripts exist. Client tests/browser E2E were not run for this database-only correction. At validation-record time, no shared database deployment, commit, push, Issue closure, or peer-review approval was claimed. The Claim correction was later committed as `fix: allow Claim Activity status details` and pushed to `feature/78-lab4-data-foundation-migration` at the user's request. PR #85 peer review and #78 closure remain pending; no shared database deployment occurred.

## 23. PR #85 B-01/B-02 correction at `2b560e49` (2026-10-01)

PG-02, PG-13, and DATA-02 retain their complete frozen expected behavior, including actual exclusion of migrated Actions from resolution; Final is **Blocked** pending #81 integration evidence. Earlier foundation-only Pass interpretations are superseded, without weakening the frozen contract or changing migration/recovery implementation.

Fresh local evidence for the exact reviewed SHA is recorded in [verification-2b560e49.md](verification-2b560e49.md): Lab 4 PostgreSQL 3 files / 5 tests passed; full server 72 files / 1,065 tests passed; both builds, guarded seven-migration status before/after tests, and documentation checks passed. Saved sanitized logs are local artifacts, not published GitHub CI evidence. At evidence-collection time, no commit, push, remote Issue/PR update, shared database deployment, or peer-review approval occurred. The subsequent user prompt authorized commit and push of this documentation-only follow-up; it does not complete the Blocked rows or establish an independently witnessed CI result.
