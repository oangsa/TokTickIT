# Lab 4 UI Specification

## 1. Purpose

This document defines the implementation-ready user-interface contract for TokTickIT Lab 4.

Lab 4 must look and behave like a direct evolution of the completed Lab 3 application. The established Zen Green visual language, Bootstrap 5 layout constraints, shared `DataTable`, `CommonForm`, Card/Feedback/Collection components, AppShell/SidebarNav, route-focus behavior, validation placement, safe failure handling, and responsive/accessibility rules remain authoritative.

Lab 4 UI scope includes:

- role-specific Dashboard as authenticated home;
- Requester Dashboard;
- shared IT Staff/Administrator Dashboard;
- Actions Taken area on Ticket Detail;
- Action Taken create/edit modal;
- reusable global Lookup infrastructure and a DataTable-backed User lookup for Action assignee selection;
- Action Detail for Requester, IT Staff, and Administrator;
- Action assignment/reassignment/unassignment;
- Action Start/Complete/Cancel workflow;
- association of existing eligible Active same-Ticket Attachments with Actions;
- Ticket Activity and Action Activity timelines for Staff/Admin;
- final Ticket workflow/resolution feedback;
- loading, empty/no-results, validation, conflict, forbidden, not-found, stale-state, retry, and refresh failure states;
- desktop/tablet/mobile behavior;
- accessibility and visual evidence.

The handout illustrations are direction rather than pixel-perfect templates. Explicit handout requirements remain mandatory; this document resolves the implementation choices intentionally left open.

Ticket and Action Activity timelines implement the explicitly approved narrow auditability decision in `specification.md` §2.1; they are not a generic handout-mandated Activity system. They show meaningful Ticket/Action mutations and migration context only, not Comments, Internal Notes, Attachment events, HTTP/security telemetry, or general events.

## 2. Shared Visual and Component Contract

Lab 4 continues `docs/generics/styling-contract.md`.

Key anchors:

```text
Primary action          #006B3C
Secondary green         #0B7A46
Pale green              #EAF6EF
Page background         #F5F7F6
Surface                 white
Border                  #D7E0DA
Main text               #16241D
Muted text              #5B6B63
Danger                  #A3232B
Warning                 #8A5200
Control radius          8px
Surface radius          12px
Sidebar width           240px
Content max             ~1280px
Font                    Inter + existing fallbacks
```

Meaning must never depend on color alone.

### 2.1 Mandatory shared-component rule for tables

Every Lab 4 UI that presents tabular data uses the existing reusable TokTickIT `DataTable`.

This includes:

- Actions Taken collection;
- Dashboard compact Ticket tables;
- Dashboard My Actions table;
- global LookupModal, including Action assignee User lookup;

Do not build a one-off `<table>` for those screens.

Activity is chronological narrative data, not tabular data, and uses a timeline component.

### 2.2 Form foundation

New Action create/edit/completion forms use:

```text
FormSection<TValues>[]
useManagedForm
CommonForm
Zod
shared form constants
central server-field-error mapping
Navigation Guard where dirty state matters
```

The generic renderer does not own domain API calls, lifecycle rules, idempotency, or authorization.

### 2.3 Responsive evidence viewports

Required evidence:

```text
Desktop  1440 x 900
Tablet    820 x 1180
Mobile    390 x 844
```

All major Lab 4 screens must be inspected/captured at all three.

## 3. Routing and Role Home

### 3.1 Route map additions

```text
Shared authenticated
/dashboard

Requester
/tickets
/tickets/new
/tickets/:ticketPublicId
/tickets/:ticketPublicId/actions/:actionPublicId

IT Staff
/staff/tickets
/staff/tickets/:ticketPublicId
/staff/tickets/:ticketPublicId/actions/:actionPublicId

Administrator
/admin/users
/admin/users/new
/admin/users/:publicId
/admin/users/:publicId/edit
/admin/tickets
/admin/tickets/:ticketPublicId
/admin/tickets/:ticketPublicId/actions/:actionPublicId
```

### 3.2 Root route

After auth bootstrap:

```text
ANONYMOUS                -> /login
PASSWORD_CHANGE_REQUIRED -> /change-password
REQUESTER                -> /dashboard
IT_STAFF                 -> /dashboard
ADMINISTRATOR            -> /dashboard
```

`/dashboard` renders role-specific content after authoritative auth state is known.

### 3.3 Sidebar navigation

Requester:

```text
Dashboard
My Tickets
```

`Create Ticket` remains the existing prominent Requester action and is not duplicated as a desktop Dashboard quick action.

IT Staff:

```text
Dashboard
Ticket Queue
```

Administrator:

```text
Dashboard
User Management
Tickets
```

Dashboard is the first navigation item for all roles and receives normal active-page indication.

## 4. Dashboard Shared Behavior

### 4.1 Initial load and in-memory cache

Cache the last successful Dashboard DTO in application memory, scoped by at least authenticated User identity, role, and Dashboard URL/list-size query state.

- Age <=30 seconds: cached successful data may render immediately on remount.
- Age >30 seconds: stale successful data may render while immediate revalidation is requested under the single-flight rule.
- Without successful data for the current scope, show skeleton metric cards/table rows, preserving layout rather than a full-page spinner.
- Never render a previous User/role's data for another User. Late responses from a previous identity/role/query context must not replace the current view.
- No localStorage, sessionStorage, service-worker cache, or HTTP browser cache is used for this reuse. Dashboard API responses remain `Cache-Control: no-store`.

### 4.2 Refresh behavior

Dashboard automatically refreshes every 30 seconds and has an explicit manual Refresh button.

- At most one Dashboard request may be in flight.
- If a timer tick fires while a request is active, ignore that tick; do not queue a second request.
- Refresh while loading is disabled/ignored.
- Do not abort an active request merely to start another refresh. Let it finish; completion permits the next future refresh.
- When the browser document/tab becomes hidden, pause scheduled auto-refresh.
- When it becomes visible again, immediately refresh/revalidate as appropriate and restart the normal 30-second schedule, still enforcing single-flight.
- An accepted successful response immediately replaces the old displayed DTO and updates its scoped cache and Last Updated timestamp.

Do not blank or re-skeleton existing content during background refresh. Do not add a persistent "Refreshing..." indicator: new data appears immediately once the request finishes.

### 4.3 Refresh failure

Initial failure without successful data shows page-level ErrorState with Retry.

Background refresh failure with successful data already displayed:

- retains the last successful metrics/lists;
- shows a non-destructive warning;
- provides Retry under the same single-flight rule;
- does not blank the Dashboard or replace it with ErrorState.

### 4.4 Freshness label

Show localized time:

```text
Last updated HH:mm:ss    [Refresh]
```

The timestamp changes only when a successful Dashboard DTO is accepted. Cached data retains its original successful timestamp; remount, timer ticks, failed requests, and visibility changes do not independently advance it.

### 4.5 Compact-list page size

Dashboard compact lists offer:

```text
5
10
20
```

Selection is stored in browser URL query parameters.

Requester:

```text
/dashboard?recentTicketsSize=10
```

Staff/Admin:

```text
/dashboard?myActionsSize=5&recentTicketsSize=10&urgentTicketsSize=5
```

The UI does not assume those are the only values accepted by the backend; they are the approved presentation choices.

## 5. Requester Dashboard

### 5.1 Desktop composition

```text
PageHeader: Dashboard                         Last updated ... [Refresh]

[ Active Tickets ] [ Waiting for Me ] [ Resolved ] [ Closed ]

Recently Updated
┌──────────────────────────────────────────────────────────────────┐
│ DataTable: Ticket / Summary / Priority / Status / Updated At    │
└──────────────────────────────────────────────────────────────────┘
```

Metric cards fit one row when width permits.

### 5.2 Metric cards

Cards:

```text
Active Tickets
Waiting for Me
Resolved
Closed
```

Each whole card is an accessible link.

Card contents:

- metric label;
- large numeric count;
- concise visual affordance such as `View tickets`;
- accessible name includes metric and action;
- card remains keyboard focusable as one navigation target.

### 5.3 Drill-down

Card activation navigates to My Tickets with corresponding pre-applied filter state.

Expected semantic mapping:

```text
Active ->
  NEW, OPEN, IN_PROGRESS, WAITING_FOR_REQUESTER, REOPENED

Waiting for Me ->
  WAITING_FOR_REQUESTER

Resolved ->
  RESOLVED

Closed ->
  CLOSED
```

The browser route may use the existing My Tickets URL representation. The Dashboard must not invent a second Ticket list.

### 5.4 Recently Updated table

Columns:

```text
Ticket Number
Summary
Requested Priority
Status
Updated At
```

Row activation/View navigates to Requester Ticket Detail.

The table has:

- no full advanced filter toolbar;
- page-size selector 5/10/20;
- normal loading/empty/failure behavior;
- no unnecessary second pagination page control because the Dashboard endpoint returns top N only.

If `recentTickets` is empty:

```text
No recent tickets
Your recently updated tickets will appear here.
```

### 5.5 Mobile quick actions

On mobile only, display:

```text
Quick Actions
[ Create Ticket ]
[ View My Tickets ]
```

These are hidden on desktop/tablet where primary shell navigation is sufficiently visible.

### 5.6 Mobile layout

At 390px:

```text
Dashboard
Last updated ...
[Refresh]

[ Active Tickets          8 ]
[ Waiting for Me          2 ]
[ Resolved                3 ]
[ Closed                 12 ]

Quick Actions
[ Create Ticket ]
[ View My Tickets ]

Recently Updated
<responsive DataTable/card representation>
```

Metric cards are full-width, not two-per-row.

## 6. IT Staff / Administrator Dashboard

### 6.1 Shared component

IT Staff and Administrator use the same Dashboard implementation and DTO shape.

Role-aware link builder chooses:

```text
IT Staff       /staff/tickets/...
Administrator  /admin/tickets/...
```

Do not duplicate Dashboard business/rendering logic into separate Staff/Admin components.

### 6.2 Metrics

Five cards:

```text
Unassigned
My Assigned
In Progress
Waiting for Requester
High Priority
```

Each whole card is an accessible link to Ticket Queue/Tickets with corresponding pre-applied filters.

### 6.3 My Actions Taken

Compact `DataTable` columns:

```text
Description
Ticket
Status
Assigned To
Performed By
Activity Time
```

Rows include Action when current User is current assignee or performer.

View action navigates to role-specific Action Detail.

Page-size selector:

```text
5 / 10 / 20
```

### 6.4 Recently Updated Tickets

Compact `DataTable` columns:

```text
Ticket Number
Summary
Requester
IT Priority
Status
Owner
Updated At
```

Rows navigate to role-specific Ticket Detail.

### 6.5 Urgent Tickets

Same compact column set as Recently Updated.

The UI does not independently recalculate urgency. It trusts the backend collection.

### 6.6 Desktop composition

Preferred vertical hierarchy:

```text
Dashboard                                      Last updated ... [Refresh]

[Unassigned] [My Assigned] [In Progress] [Waiting] [High Priority]

My Actions Taken
<DataTable>

Recently Updated Tickets
<DataTable>

Urgent Tickets
<DataTable>
```

Avoid three narrow side-by-side tables.

### 6.7 Tablet/mobile

Metric cards wrap cleanly.

Compact tables use normal DataTable responsive behavior. No page-level horizontal scrolling is permitted.

At mobile width, sections remain in this order:

```text
metrics
My Actions
Recently Updated
Urgent
```

## 7. Ticket Detail Lab 4 Composition

### 7.1 Requester Ticket Detail

Approved order:

```text
Ticket Information
Attachments
Actions Taken
Public Comments
```

Requester does not see Internal Notes or Activity.

### 7.2 IT Staff / Administrator Ticket Detail

Approved order:

```text
Ticket Information
Assignment & Workflow
Attachments
Actions Taken
Public Comments
Internal Notes
Activity
```

The exact existing Staff Ticket Detail heading/card ownership rules remain from the styling contract.

### 7.3 Actions Taken section header

Card title:

```text
Actions Taken
```

Staff/Admin header action:

```text
[ Create Action ]
```

Requester has no create control.

## 8. Actions Taken DataTable

### 8.1 Columns

Desktop columns:

```text
Status
Description
Assigned To
Performed By
Created At
Actions
```

`Description` may truncate visually with accessible full text/title where required, but the Action Detail remains the authoritative full view.

Do not place Result, Follow-Up Note, Attachment Notes, or attachment names into the dense table.

### 8.2 Row actions

Requester:

```text
View
```

Staff/Admin, depending on state/authorization:

```text
View
Edit
Assign/Reassign
Unassign (only when assigned)
```

Start/Complete/Cancel are intentionally not table-row actions; lifecycle controls are Action Detail only.

Terminal Action row:

```text
View
```

only.

### 8.3 Search

Search text covers:

```text
Description
Result
Follow-Up Note
Attachment Notes
```

Search uses the same DataTable query controls, not client-side filtering over the loaded page.

### 8.4 Filters

Approved filters:

```text
Status
Assigned To
Performed By
Follow-Up Required
Created Date
```

The implementation reuses existing filter components and commits only validated query expressions.

### 8.5 Sort

Default:

```text
Newest = createdAt desc
```

Available approved sorts should map only to API-supported fields.

### 8.6 Empty states

No Actions yet:

Requester:

```text
No actions recorded yet
Work recorded by IT Staff will appear here.
```

Staff/Admin:

```text
No actions recorded yet
Create an Action when work is ready to be planned or recorded.
[Create Action]
```

No search/filter result:

```text
No matching actions
Try changing your search or filters.
[Clear Filters]
```

## 9. Create Action Modal

### 9.1 Invocation

Staff/Admin Ticket Detail:

```text
Create Action
```

opens shared Modal containing `CommonForm`.

Modal keeps Ticket context visible in the underlying page and uses normal focus trap/restore behavior.

### 9.2 Fields

```text
Description *             textarea, full width, count 0/2000

Assigned To               global User Lookup, default authenticated Staff/Admin
                           may be cleared before submit

Follow-Up Required        switch

Follow-Up Note            textarea, conditional
                           required only when Follow-Up Required

Attachment Notes          textarea, optional, max 2000

Attachments               custom/shared attachment association control
                           [Select existing]
```

Result is intentionally absent from Create mode.

### 9.3 Attachment selection

Only existing Active Attachments belonging to the current Ticket are selectable, through an appropriate DataTable/selection modal or reusable attachment picker. Pending, removed/deleted, and cross-Ticket Attachments are unavailable. Lab 4 adds no upload control or Staff/Admin upload flow; Lab 3 Requester upload behavior remains unchanged.

The form stores selected Attachment public identifiers and sends them with Action create.

### 9.4 Create buttons

```text
[Cancel] [Create Action]
```

While submitting:

- submit shows busy state;
- duplicate submit is disabled;
- idempotency key is stable for the logical submission;
- Cancel cannot cause duplicate mutation.

### 9.5 Dirty close/navigation

If any form field or attachment selection is dirty and the user tries to dismiss/navigate away, use the existing Navigation Guard/confirmation pattern.

## 10. Edit Action Modal

### 10.1 Fields

```text
Description
Result
Follow-Up Required
Follow-Up Note
Attachment Notes
Attachments
```

Assignment is deliberately not editable inside the generic Edit form.

### 10.2 Save

Request carries current `expectedVersion`.

Stale conflict:

- keep the modal open;
- preserve all entered values;
- show conflict-level feedback;
- provide `Reload latest`.

`Reload latest` must not silently discard values without explicit user intent. A practical implementation may keep the local draft available for comparison/copy while refreshing the canonical Action.

### 10.3 Invalid transition/state change

If the Action became terminal or otherwise non-editable:

```text
This Action changed and can no longer be edited in its previous state.
[Refresh]
```

After Refresh, if mutation is valid again, user may try again. If terminal, form becomes read-only/closed as appropriate.

## 11. Action Assignee Selection

Action assignee is the first use of the reusable global Lookup infrastructure in §12. It uses the reusable User definition backed by queryable `GET /api/users/assignable`; pages do not own bespoke modal/fetch/pagination wiring.

Owner clarification (2026-10-01): Action detail/list and Activity retain referenced Users after later assignment ineligibility, including a current `REQUESTER` role. Render their supplied identity; do not show a persisted assignment as Unassigned or hide historical references based on current role. Lookup still contains only eligible active, non-deleted, non-system Staff/Admin; reference visibility does not grant mutation permission or make the User selectable for a new assignment.

LookupModal composes the existing TokTickIT DataTable with columns:

```text
Name
Email
Role
Action: Select
```

Selection uses the explicit keyboard-accessible Select row action; whole-row-click must not be the only mechanism. No User Management create/edit/delete/activation actions are exposed.

The User lookup supports name/email search, name/email/role sorting, bounded pagination and page-size changes through existing DataTable query controls. Use existing search debounce/commit conventions. Default ordering is name ASC with publicId ASC tie-break, matching `api-spec.md` §15. Resource query mapping uses `search`, `searchFields`, `filters`, `sort`, `pageNumber`, `pageSize`, and `X-Pagination`; it does not invent a lookup-specific protocol.

Show distinct loading, empty default (no eligible users), no-results (no matching users), and safe load failure/Retry states. Failed loading must not look like a successful empty result or silently change assignment. Support keyboard navigation, modal focus trap, and focus restoration to the invoking control after close/selection.

Only `isActive=true`, `deleted=false`, `isSystem=false`, Staff/Admin rows appear. Requesters and SYSTEM never appear. The mutation backend revalidates eligibility even after successful lookup.

### 11.1 Assign/Reassign

From Action Detail and eligible Ticket Detail row action:

```text
[Assign] or [Reassign]
```

opens the global User Lookup populated by `/api/users/assignable`. Selecting an eligible Staff/Admin supplies its public ID to the Action assignee mutation endpoint after the existing confirmation below.

After selecting a User, show a concise confirmation if the page is changing an already-persisted assignment:

```text
Assign this Action to <name>?
[Cancel] [Assign]
```

For initial Create Action, assignee selection remains part of the create form and does not need a second assignment API call.

### 11.2 Unassign

Separate action:

```text
[Unassign]
```

Confirmation:

```text
Unassign this Action?
The Action will remain in its current status, but it cannot be started while unassigned.

[Keep Assignment] [Unassign]
```

Do not include an Unassigned fake User row in Lookup. Persisted Unassign is the separate confirmed action above and sends null through the assignee mutation endpoint. Create Action may clear its optional default assignment before submission without a persisted Unassign mutation.

### 11.3 Ineligible/stale selected User

If assignment returns field validation because the selected User became inactive/ineligible:

- keep current Action data;
- show safe assignment feedback;
- allow reopening selection;
- do not silently select another User.

## 12. Global Lookup Architecture and Form Integration

Approved conceptual structure (exact filenames may follow current conventions):

```text
client/src/components/Common/Lookup/
├── LookupField.tsx
├── LookupModal.tsx
└── types.ts

client/src/lookups/
├── userLookup.ts
└── index.ts
```

Keep generic Lookup UI separate from domain/resource lookup definitions. Action assignee is the first consumer, not a one-off Action-only picker. LookupModal composes `client/src/components/Maintain/DataTable.tsx` and the existing shared Modal rather than implementing another table/query-control system.

`LookupDefinition<T>` provides the resource's title, DataTable-compatible columns, `fetchData`, `getValue`, `getDisplayValue`, and useful search placeholder/labels and empty/no-results text. The User definition supplies name/email/role columns, public-ID value mapping, display mapping, supported query constants, and the API adapter translating DataTable query/result types to the existing collection API and `X-Pagination`. Generic UI receives that definition; it does not own User eligibility, endpoint paths, authorization, or mutation rules.

Evolve the existing callback-only `lookup` FormField into this definition-driven abstraction. LookupField owns opening/closing the reusable modal and connects selection/display/optional clear to the managed field. Keep compatibility with `CommonForm`, `useManagedForm`, typed `FormSection`/`FormField`, existing validation/server-field-error mapping, labels, `aria-describedby`, disabled semantics, Bootstrap, and Zen Green. Each page supplies a definition and managed value rather than rebuilding modal/fetch/pagination wiring. Disabled fields cannot open, select, or clear; field errors remain associated with the owning control.

Design inspiration: [maintenance-tracking-system LookupField](https://github.com/oangsa/maintenance-tracking-system/blob/HEAD/app/components/Common/LookupField/index.tsx), [ListPickerModal](https://github.com/oangsa/maintenance-tracking-system/blob/HEAD/app/components/Common/ListPickerModal/index.tsx), [resource definition](https://github.com/oangsa/maintenance-tracking-system/blob/HEAD/app/components/Common/LookupField/lookups/department.lookup.ts), and [column](https://github.com/oangsa/maintenance-tracking-system/blob/HEAD/app/constants/lookupColumn.constants.ts)/[query constants](https://github.com/oangsa/maintenance-tracking-system/blob/HEAD/app/constants/lookupQuery.constants.ts). Adapt the separation of reusable field/modal and domain definitions. Do not copy its table implementation, styling stack, query payload, or failure-as-empty behavior; use TokTickIT DataTable, Bootstrap, collection grammar, and safe Retry feedback.

## 13. Action Detail

### 13.1 Page header

Staff/Admin:

```text
Back to Ticket
Action Taken
Status chip
```

Header actions depend on authorization/state.

Requester:

```text
Back to Ticket
Action Taken
```

read-only.

### 13.2 Desktop layout

Two-column desktop layout:

```text
LEFT (~2/3)
  Action Information
  Result & Follow-Up
  Attachment Notes
  Attachments

RIGHT (~1/3)
  Status & Assignment
  Performed By
  Lifecycle Dates
  Actions
  Activity (Staff/Admin only)
```

On tablet/mobile all sections stack.

### 13.3 Action Information

Show:

```text
Action Date/Time
Description
Creator
Migrated Record indicator when isMigrated
```

Migrated record copy must make clear that historical details were generated during migration and may not identify the original performer.

### 13.4 Status & Assignment

Show:

```text
Status
Assigned To
Performed By
Created At
Started At
Completed At
Cancelled At
Version (not necessarily user-visible unless useful for support)
```

Do not expose internal numeric IDs.

### 13.5 Edit / assignment controls

Non-terminal authorized user may see:

```text
[Edit]
[Assign/Reassign]
[Unassign] when assigned
```

Terminal Actions hide these controls rather than rendering a row of disabled dead buttons.

## 14. Action Lifecycle Controls

Lifecycle controls appear on Action Detail only.

### 14.1 Start

Available when user is the assignee and Action is `PLANNED`.

If Action is unassigned:

```text
Start
```

is rendered disabled if the control area is otherwise visible. Do not add the previously proposed explanatory sentence under it.

Clicking an enabled Start opens confirmation:

```text
Start this Action?
This will move the Action to In Progress.

[Cancel] [Start Action]
```

Start is considered consequential enough to require confirmation.

### 14.2 Complete

Available when:

```text
status = IN_PROGRESS
actor = assignee OR Ticket Owner
```

Click opens modal:

```text
Complete Action

Result *                 textarea 1–2000
Follow-Up Required       switch
Follow-Up Note           conditional required

[Cancel] [Complete Action]
```

The completion request sends a stable idempotency key and current expected version.

### 14.3 Cancel

Available to approved creator/assignee/Ticket Owner while `PLANNED` or `IN_PROGRESS`.

Confirmation modal:

```text
Cancel Action

Cancellation Reason *    textarea 1–500

[Keep Action] [Cancel Action]
```

Danger styling may be used but must include explicit text.

### 14.4 Idempotent busy behavior

While Start/Complete/Cancel request is in progress:

- mutation buttons are busy/disabled;
- repeated browser click does not create a second logical request;
- same logical retry keeps the same idempotency key until definitive success/conflict/recovery decision.

## 15. Action Attachments

### 15.1 Display

Action Detail shows associated Attachments using existing attachment presentation/preview/download behavior.

### 15.2 Attachment Notes

A separate read-only/editable field labelled:

```text
Attachment Notes
```

remains visible even when structured associated files exist.

Do not silently rename it to `Attachments`.

### 15.3 Terminal behavior

Completed/Cancelled Action:

- attachment list remains visible;
- preview/download remains permitted according to existing Ticket access;
- association add/remove controls are hidden.

## 16. Ticket Activity Timeline

### 16.1 Staff/Admin Ticket Detail

Section title:

```text
Activity
```

Timeline includes Ticket and Action domain events returned by API.

### 16.2 Timeline item

Conceptual presentation:

```text
18:42
Alice assigned the Ticket to Bob.
```

or:

```text
19:02
Bob started Action "Inspect network port".
```

The API returns typed data; UI constructs readable text. Do not store presentation sentences in the DB as the sole audit representation.

For `REQUESTER_RESOLUTION_CONFIRMED`, render a narrative such as `<Requester name> confirmed the problem appears resolved.` This is a Requester confirmation, not a formal Ticket status change. Staff/Admin see it in Ticket Activity; Requesters still do not see the internal timeline. The event appears under Ticket Workflow filtering.

### 16.3 Category filter

Small filter:

```text
All
Ticket Workflow
Assignment
Priority
Actions Taken
```

This is not a full advanced DataTable toolbar.

### 16.4 Ordering

Ticket Activity may default newest-first on Ticket Detail if operationally useful, but Action Detail must request oldest-first as frozen below.

If implementation chooses newest-first for Ticket Detail, this must be documented consistently in tests. Action Detail ordering is fixed.

## 17. Action Activity Timeline

### 17.1 Staff/Admin only

Requester Action Detail does not render internal Activity.

### 17.2 Chronological order

Action Detail requests:

```text
createdAt ASC
```

so the story reads:

```text
Created
Assigned
Started
Updated
Completed
```

### 17.3 Pagination

Load first 10.

When more exists:

```text
[Load More]
```

Load More requests the next page and appends older-to-newer continuation in chronological order.

Do not render a DataTable pager for the timeline.

### 17.4 Empty

A normal Action should have Activity, but safe empty copy exists:

```text
No activity available.
```

## 18. Ticket Workflow UI Evolution

### 18.1 Backend remains authoritative

UI shows only actions that appear permitted from current DTO/role, but hidden/disabled controls are not authorization.

After any successful Ticket workflow mutation, refresh Ticket summary/workflow state and related Activity.

### 18.2 Mark Resolved gate

When current Ticket is otherwise eligible but open Actions remain, UI should prevent obvious invalid use where data is available.

The backend remains final authority.

If server returns `INVALID_STATUS_TRANSITION` because Action requirements changed:

```text
This Ticket cannot be marked resolved in its current state.
Complete or cancel all open Actions Taken and complete at least one real Action. Migrated historical Actions do not count as new work.

[Refresh Ticket]
```

Do not invent a separate resolution-specific API error code.

### 18.3 Requester Looks Resolved

Requester copy must not imply that this action formally changes Ticket status to `RESOLVED`.

Use wording consistent with existing Lab 3 confirmation semantics.

## 19. DataTable Contract in Lab 4

All Lab 4 DataTables preserve existing:

- PageHeader/toolbar ownership where applicable;
- search input debounce/commit conventions;
- sort controls;
- filter chips;
- loading;
- empty/no-results;
- invalid-query recovery;
- pagination;
- mobile responsive representation;
- accessible column/action labeling.

Feature-specific tables may omit toolbar capabilities they do not need, but they still use the shared component.

Dashboard compact tables:

- no advanced filters;
- no search unless explicitly added later through contract change;
- page-size only;
- top-N response rather than multipage Dashboard pagination.

## 20. Feedback and Recovery

### 20.1 Validation

Client and server validation errors render under their owning fields.

Unknown/unmatched safe form errors render at form level.

Invalid submit focuses first invalid control.

### 20.2 Stale `409 CONFLICT`

Action edit/assignment stale state:

- preserve entered values/selection;
- show conflict message;
- offer Reload latest;
- do not auto-overwrite with stale local values.

### 20.3 `INVALID_ACTION_TRANSITION`

Keep relevant modal/page state where possible.

Show state-change feedback and:

```text
[Refresh]
```

After refreshing canonical Action, user may explicitly try again if the operation is still allowed.

### 20.4 Forbidden

Wrong-role/direct route access uses existing forbidden/error-page experience.

Do not render protected data before redirect/error.

### 20.5 Not Found

Malformed/missing/cross-parent protected Action uses existing safe 404 experience.

### 20.6 Background Dashboard refresh failure

Keep last successful Dashboard and show retry banner/message.

## 21. Accessibility

Lab 4 must preserve:

- keyboard access to all buttons, links, cards, assignee controls, filters, modal actions, and Load More;
- visible focus;
- modal focus trap and focus restoration;
- route main-content focus behavior;
- semantic headings;
- form labels tied to controls;
- field errors associated through `aria-describedby`;
- `role="alert"` for important error feedback;
- appropriate `aria-live` only where existing patterns use it and duplicate announcements are avoided;
- non-color text for status/priority/role meaning;
- accessible names for icon-only actions;
- disabled controls use actual disabled semantics;
- assignee selection does not require click-only interaction;
- no keyboard trap in DataTable or timeline;
- reduced-motion compatibility.

## 22. Responsive Behavior

### 22.1 Desktop 1440×900

- persistent sidebar;
- metric cards in wide row where possible;
- Action Detail two columns;
- DataTables show full operational columns;
- modals sized for readable forms without exceeding viewport.

### 22.2 Tablet 820×1180

- navigation follows existing tablet shell behavior;
- metric cards wrap;
- Action Detail stacks where 2/3 + 1/3 becomes cramped;
- modal width respects viewport;
- DataTable responsive behavior prevents page overflow.

### 22.3 Mobile 390×844

- drawer navigation;
- one-column Dashboard cards;
- Requester mobile Quick Actions visible;
- CommonForm fields full width;
- modal behaves as mobile-safe dialog/sheet according to existing Modal constraints;
- no page-level horizontal scroll;
- DataTable uses existing responsive/card behavior;
- action button groups wrap vertically as required.

## 23. Visual Evidence

Required root:

```text
artifacts/lab-04/screenshots/
```

Recommended structure:

```text
requester-dashboard/
staff-dashboard/
admin-dashboard/
actions-taken/
action-create-edit/
action-detail/
assignee-selection/
ticket-activity/
```

At minimum capture all major Lab 4 screens at:

```text
1440×900
820×1180
390×844
```

Screenshots are evidence, not pixel-perfect golden snapshots.

## 24. UI Definition of Done

UI is complete when:

- Dashboard is correct role home and first nav item;
- Requester metrics/list/quick-action responsive rules match this spec;
- Staff/Admin metrics and three compact collections match backend data;
- Dashboard 30-second auto-refresh/manual Refresh, single-flight, hidden/visible behavior, scoped 30-second in-memory cache, HTTP no-store, Last Updated, and safe failures match §4;
- Actions Taken table uses DataTable and approved columns/query controls;
- Requester can view but cannot mutate Actions;
- Create/Edit use CommonForm Modal and preserve handout fields;
- global Lookup and reusable User definition integrate with CommonForm and DataTable Select actions, queryable assignable users, safe states, keyboard/focus, disabled controls, and field errors;
- assignment/unassignment flows are explicit and accessible;
- Start/Complete/Cancel exist only on Action Detail and use required confirmations/forms;
- terminal Actions expose no mutation controls;
- Action Attachments reuse existing presentation/security;
- Ticket/Action Activity timelines are readable and permissioned;
- Mark Resolved feedback explains that a real non-migrated Action must be completed and no Planned/In-Progress Actions may remain;
- all recoverable errors preserve useful user work;
- required viewport evidence exists;
- keyboard/focus/semantic/non-color checks pass;
- no clipped labels, overlaps, dead buttons, placeholder text, or page-level horizontal scrolling remain.
