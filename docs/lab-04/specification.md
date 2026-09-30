# Lab 4 Sprint Engineering Specification

## 1. Sprint Goal

Deliver the final core TokTickIT service-desk increment by adding auditable Actions Taken under Tickets, enforcing the final Ticket-resolution rules, providing concise role-appropriate dashboards, and hardening the complete Labs 1–3 application without discarding previously approved behavior. IT Staff and Administrators can plan and record work through Actions Taken; Requesters can read Actions Taken for their own Tickets; one primary Ticket Owner continues to coordinate each Ticket while individual Actions may be assigned to different Staff/Admin users; backend-calculated dashboards provide operational summaries and drill-downs; and all authentication, authorization, Ticket, Attachment, Public Comment, Internal Note, User Management, responsive, accessibility, idempotency, and safe-error behavior remains covered by final regression.

## 2. Stakeholder Request Interpretation

Lab 4 turns TokTickIT from an authenticated Ticket-and-communication system into a complete service-desk workflow.

The completed increment must provide five coherent capabilities:

1. **Actions Taken:** a Ticket may contain multiple work records. Each Action has a server-authored date/time, description, result, automatically recorded performer, follow-up state/note, attachment notes, assignment, eligible existing Ticket Attachments, and lifecycle state.
2. **Ticket workflow completion:** Ticket status changes remain semantic backend-controlled actions. A Ticket cannot be formally marked `RESOLVED` until the required Actions Taken are complete.
3. **Role dashboards:** Requesters receive concise metrics and recent owned Tickets; IT Staff and Administrators receive operational workload metrics, current-user Actions Taken, recently updated Tickets, and urgent Tickets.
4. **Approved auditability decision:** Sprint 4 explicitly approves narrow, durable Ticket Activity for meaningful Ticket and Action mutations, appended in the same transaction. This is an engineering-contract decision, not a generic Activity requirement from the handout.
5. **Final hardening:** Labs 1–3 remain functional and are included in final regression, responsive, accessibility, migration, security, concurrency, and performance-smoke verification.

The existing Lab 3 authentication/session architecture, centralized error contract, collection query conventions, reusable `DataTable`, `CommonForm`, Zen Green styling contract, and PostgreSQL/Prisma migration discipline remain authoritative unless this Lab 4 contract explicitly evolves them.

### 2.1 Engineering-contract authority and handout interpretation

The Lab 4 handout's explicit requirements remain mandatory. Where the handout intentionally leaves model fields, assignment mechanics, lifecycle details, dashboard calculations, endpoint paths, concurrency rules, migration behavior, UI composition, or testing choices open, these four documents record the approved implementation decision:

- `docs/lab-04/specification.md`
- `docs/lab-04/api-spec.md`
- `docs/lab-04/ui-spec.md`
- `docs/lab-04/tests.md`

Resolve conflicts in this order: explicit Lab 4 handout requirements; these latest Lab 4 contract documents; the approved seven-Issue decomposition in §14; preserved Lab 3 contracts for behavior Lab 4 does not explicitly evolve; then current implementation as evidence only. Current code does not override an explicit requirement or approved contract decision.

The contract must not silently weaken an explicit handout requirement. In particular, the handout-required Action fields remain present even where this contract adds stronger structured support. Therefore `attachmentNotes` remains an Action field while structured Action-to-Attachment associations are also added.

TicketActivity is explicitly approved for this Sprint 4 contract as a narrow auditability design decision. The handout does not itself require a generic Activity system. Activity covers meaningful Ticket/Action mutations and one clearly labeled migration snapshot; it is not an HTTP log, comment/note mirror, security telemetry stream, or general event platform.

## 3. Scope

### Included

- Parent-child Ticket → Actions Taken relationship.
- `PLANNED`, `IN_PROGRESS`, `COMPLETED`, and `CANCELLED` Action lifecycle.
- Action assignment to active IT Staff or Administrators, including unassigned state.
- Action create/edit, assignment/reassignment/unassignment, start, complete, and cancel flows.
- Stable public UUID identity for Actions Taken.
- Server-authored Action date/time and lifecycle timestamps.
- Action Description, Result, Performed By, Follow-Up Required, Follow-Up Note, Attachment Notes, and associated Attachments.
- Existing Ticket Attachment storage reused for Action evidence through a many-to-many association.
- Association of existing Active same-Ticket Attachments through `ActionTakenAttachment`; Lab 3 Requester Attachment upload remains unchanged.
- Optimistic Action concurrency using `version` / `expectedVersion`.
- Generalized persistent idempotency for Action creation and Action lifecycle operations.
- Append-only normalized Ticket Activity for meaningful Ticket and Action mutations.
- Truthful migration snapshot Activity for legacy Tickets.
- Internal system User used only as the actor for migration-generated Activity.
- Final Ticket resolution gate based on Actions Taken.
- Lab 4 Administrator operational parity with IT Staff for Claim, IT Priority, Cancel, Action work, and dashboard access, while owner-only Ticket workflow actions remain owner-only.
- Requester Dashboard.
- Shared IT Staff/Administrator Dashboard.
- Backend-authoritative metric calculations and drill-downs to detailed views.
- Dashboard auto-refresh every 30 seconds plus manual Refresh, single-flight requests, hidden-tab pause/visible-tab revalidation, a scoped 30-second in-memory cache, and safe refresh failure handling.
- Reusable global Lookup infrastructure with a DataTable-backed User lookup as its first use; the existing assignable-user endpoint becomes a bounded queryable collection.
- Continued Zen Green, Bootstrap 5, responsive, keyboard/focus, safe-error, and accessibility behavior.
- Migration/backfill, idempotent seed, final Labs 1–3 regression, real PostgreSQL concurrency tests, performance smoke, E2E, and visual evidence.

### Excluded

- SLA/escalation/on-call scheduling.
- Notifications, email, SMS, push, or chat integrations.
- Inventory, parts, cost, billing, payroll, or time-sheet accounting.
- Multi-approval/signature workflows.
- Advanced BI/report builders, warehouses, exports, or custom analytics designers.
- Multi-tenant organizations or production-scale cloud operations.
- WebSocket/live-push dashboards.
- General application telemetry persisted into `TicketActivity`; the existing structured request logger remains responsible for request-level operational logging.
- Comment, Internal Note, Attachment lifecycle, read, and security-telemetry events in `TicketActivity`; general event-bus/platform behavior.
- Staff/Admin Ticket Attachment upload in Lab 4.
- Public edit/delete of Ticket Activity.
- Action delete.
- Rewriting completed/cancelled Actions; corrective work is recorded as a new Action.
- A second binary/file-storage subsystem dedicated to Actions.
- A generic CRUD generator.
- New product features not approved by this Sprint 4 contract.

### 3.1 Frozen Labs 1–3 regression boundary

Lab 4 is an increment. Unless explicitly evolved below, all approved Labs 1–3 behavior remains normative:

- authentication, first-login password change, access-token/refresh-session behavior, logout/logout-all, rate limiting, and active/inactive User enforcement;
- Requester identity derived only from authentication;
- Create Ticket, Pending/Active Attachment lifecycle, Ticket idempotency, My Tickets query behavior, Ticket Detail ownership protection, binary preview/download safety, and Removed/Gone handling;
- Public Comments and Internal Notes with their existing audience/append-only contracts;
- Staff Ticket Queue search/filter/sort/pagination and operational ordering;
- Ticket ownership and IT Priority;
- Administrator User Management and last-admin/self-protection rules;
- centralized safe API errors, request correlation, CORS/origin handling, and no-store transport;
- explicit maintenance cleanup;
- shared QueryBuilder validation boundary;
- `CommonForm`, `DataTable`, shared Feedback/Collection components, AppShell/SidebarNav, Navigation Guard, Zen Green styling, and responsive/accessibility conventions.

### 3.2 Explicit Lab 4 evolutions of Lab 3

The following Lab 3 rules are intentionally superseded:

- **Administrator operational permissions:** in Lab 4, Administrator performs IT Staff behavior for Claim, IT Priority, Cancel, Action Taken operations, assignable-user lookup, and the Staff operational dashboard. Administrator no longer requires Ticket ownership merely to Claim, triage priority, cancel, or work with Actions.
- **Owner-only Ticket lifecycle remains:** Start Work, Request Information, Resume Work, Mark Resolved, and Close still require the current Ticket Owner for both IT Staff and Administrator.
- **Ticket resolution:** Mark Resolved now additionally requires the Lab 4 Actions Taken resolution gate.
- **Action Attachment behavior:** Actions may associate eligible existing Active Attachments from the same Ticket. Lab 4 adds no Staff/Admin upload route; Lab 3 Requester upload behavior remains unchanged.
- **Dashboard scope:** role dashboards include 30-second auto-refresh and in-memory reuse under BR-103–BR-112.
- **Assignable User collection:** `/api/users/assignable` evolves from the Lab 3 unpaginated picker to the standard bounded collection query contract with email and `X-Pagination`. Existing consumers must be adapted without changing Ticket-owner mutation rules; see `api-spec.md` §15.
- **Global Lookup:** the callback-only form `lookup` field evolves into reusable definition-driven UI, with Action assignee as its first use.
- **Actions Taken:** the Lab 3 exclusion is removed.

## 4. Functional Requirements

### 4.1 Actions Taken

- **FR-01** A Ticket shall contain zero or more Actions Taken.
- **FR-02** Staff/Admin shall retrieve Actions Taken for accessible Tickets; Requesters shall retrieve all Actions Taken for their own Tickets.
- **FR-03** Requesters shall not create, edit, assign, start, complete, cancel, or otherwise mutate Actions Taken.
- **FR-04** IT Staff and Administrators shall create Actions Taken only on eligible non-terminal Tickets.
- **FR-05** A newly created Action shall start in `PLANNED`.
- **FR-06** A non-terminal Action shall support edit of Description, Result, Follow-Up state/note, Attachment Notes, and Attachment associations.
- **FR-07** An Action shall support assign, reassign, and unassign to an eligible active IT Staff or Administrator.
- **FR-08** An assigned `PLANNED` Action shall support Start by its current assignee.
- **FR-09** An `IN_PROGRESS` Action shall support Complete by its assignee or current Ticket Owner.
- **FR-10** A `PLANNED` or `IN_PROGRESS` Action shall support Cancel by its creator, assignee, or Ticket Owner.
- **FR-11** `COMPLETED` and `CANCELLED` Actions shall be immutable.
- **FR-12** Staff/Admin Action Detail shall show the Action, assignment/performer, dates, Result, Follow-Up, Attachment Notes, associated Attachments, and Action-specific Activity.
- **FR-13** Requester Action Detail shall provide the same approved Action information for an owned Ticket in read-only form, without internal Activity.
- **FR-14** Action collections shall support approved search, filters, sorting, pagination, deterministic ordering, loading, empty/no-results, and safe failure states.

### 4.2 Action Attachments

- **FR-15** Action evidence shall reuse existing Ticket Attachment storage and security behavior.
- **FR-16** A Ticket Attachment shall be associable with multiple Actions from the same Ticket.
- **FR-17** Staff/Admin may associate an Action with eligible existing Active Attachments belonging to the same Ticket; Lab 4 does not add Attachment upload behavior.
- **FR-18** Action Attachment associations shall remain after Action cancellation and shall be immutable after Action completion/cancellation.

### 4.3 Ticket Activity

- **FR-19** Meaningful Ticket and Action business mutations shall append durable Ticket Activity.
- **FR-20** Ticket Activity shall be append-only and shall have no public create/update/delete API.
- **FR-21** Staff/Admin Ticket Detail shall display Ticket Activity; Requesters shall not receive internal Ticket Activity.
- **FR-22** Action Detail for Staff/Admin shall display Activity associated with that Action.
- **FR-23** Activity shall record normalized typed relational details rather than arbitrary JSON payloads.
- **FR-24** Request-level technical logging shall continue through the existing request logger. Comments, Internal Notes, Attachment events, reads, security telemetry, and HTTP requests shall not be duplicated into Ticket Activity.

### 4.4 Ticket workflow and resolution

- **FR-25** Existing semantic Ticket workflow actions shall remain the only way to change Ticket status.
- **FR-26** Mark Resolved shall require at least one Action with `status = COMPLETED AND isMigrated = false`, and no remaining `PLANNED` or `IN_PROGRESS` Actions.
- **FR-27** `CANCELLED` Actions shall not block Ticket resolution, but a Ticket with only Cancelled Actions shall not satisfy the required completed-work condition.
- **FR-28** Requester `Problem Appears Resolved` shall remain advisory and shall not itself set Ticket status to `RESOLVED`.
- **FR-29** Close shall continue to require `RESOLVED` plus Requester resolution confirmation.
- **FR-30** Administrator shall perform IT Staff Claim, IT Priority, Cancel, Action assignment, and dashboard behavior; owner-only Ticket lifecycle actions remain owner-only.

### 4.5 Requester Dashboard

- **FR-31** Authenticated Requesters shall have a Dashboard containing only their own Ticket data.
- **FR-32** Requester Dashboard shall show Active, Waiting for Me, Resolved, and Closed counts.
- **FR-33** Requester Dashboard shall show a bounded Recently Updated Ticket collection.
- **FR-34** Requester metric cards shall drill into My Tickets with the corresponding approved filters where practical.
- **FR-35** Mobile Requester Dashboard shall additionally show quick actions for Create Ticket and View My Tickets without duplicating those controls on desktop.

### 4.6 Staff / Administrator Dashboard

- **FR-36** IT Staff and Administrators shall share one operational Dashboard component/API shape.
- **FR-37** The Dashboard shall show Unassigned, My Assigned, In Progress, Waiting for Requester, and High Priority Ticket metrics.
- **FR-38** The Dashboard shall show bounded My Actions Taken, Recently Updated Tickets, and Urgent Tickets collections.
- **FR-39** My Actions Taken shall include Actions currently assigned to the authenticated User or completed by that User without duplicate rows.
- **FR-40** Dashboard metric cards and compact rows shall drill into existing Queue/Ticket/Action detail views rather than duplicate full collection screens.
- **FR-41** Dashboard data shall be calculated by the backend from authoritative data in one consistent database snapshot.

### 4.7 Dashboard refresh and compact collection limits

- **FR-42** Dashboard shall automatically refresh every 30 seconds and provide a manual Refresh button; pause scheduling while hidden and immediately revalidate on becoming visible before restarting the normal schedule.
- **FR-43** At most one Dashboard request shall be in flight; ignore timer ticks and disable/ignore Refresh while loading. Do not abort an active request merely to refresh.
- **FR-44** An accepted successful Dashboard response shall immediately replace the displayed DTO and update Last Updated without re-skeletoning existing content or a persistent "Refreshing..." indicator.
- **FR-45** An initial Dashboard load failure without successful data shall use the page-level ErrorState with Retry.
- **FR-46** Dashboard shall reuse the last successful DTO in a 30-second application-memory cache scoped by authenticated User identity, role, and Dashboard URL/list-size query state. Fresh data (age <=30 seconds) may render immediately; stale data (age >30 seconds) may render during immediate revalidation. Background failure shall retain successful data with a non-destructive warning and Retry.
- **FR-47** Dashboard compact list limits shall be represented in browser URL state; the UI shall offer 5, 10, and 20 while the API accepts any integer from 1 through 20.

### 4.8 Action assignee selection

- **FR-48** Action assignment shall use the queryable `/api/users/assignable` endpoint through a reusable User lookup definition.
- **FR-49** Action assignee shall be the first use of global definition-driven Lookup infrastructure, compatible with CommonForm, useManagedForm, typed FormSection/FormField, existing validation, and Bootstrap/Zen Green. LookupModal shall compose the existing DataTable and expose a Select row action.
- **FR-50** The endpoint shall return only active, non-deleted IT Staff/Administrators and shall exclude the SYSTEM User.
- **FR-51** Assignable users shall support the existing search, searchFields, filters, sort, pageNumber, pageSize, and X-Pagination conventions with resource-owned allowlists, bounded results, and deterministic ordering.
- **FR-52** Unassign shall remain a separate confirmed operation for persisted Actions.

### 4.9 Concurrency, idempotency, migration, and hardening

- **FR-53** Every editable Action mutation shall use optimistic concurrency through `expectedVersion`.
- **FR-54** Action creation and Start/Complete/Cancel shall use persistent idempotency identity `(authenticatedUser, HTTP method, concrete canonical resource path, Idempotency-Key)`; the request hash includes method, path, and normalized semantic body.
- **FR-55** The existing IdempotencyRecord design shall be generalized without weakening Lab 2 Ticket-create replay behavior.
- **FR-56** Business mutation and required Activity append shall commit atomically.
- **FR-57** The Prisma/PostgreSQL schema shall evolve in place without discarding Labs 1–3 data.
- **FR-58** Legacy resolved/closed Tickets shall be backfilled truthfully so they remain compatible with the new resolution invariant.
- **FR-59** Legacy Ticket Activity shall use an explicit migration snapshot rather than fabricated historical transitions.
- **FR-60** Seed behavior shall remain idempotent and shall include zero/one/multiple Actions and zero/non-zero Dashboard metric cases.
- **FR-61** All major Lab 4 screens shall use existing Zen Green/shared-component conventions and satisfy desktop/tablet/mobile/accessibility requirements.
- **FR-62** Complete Labs 1–3 regression shall pass as a final Lab 4 release gate.
- **FR-63** Lab 4 shall include a non-SLA database-backed performance smoke using a large synthetic dataset and bounded response assertions.

## 5. Business Rules

### 5.1 Action identity and fields

- **BR-01** `ActionTaken` uses an internal integer primary key and externally addressable opaque UUID `publicId`.
- **BR-02** Each Action belongs to exactly one non-deleted Ticket.
- **BR-03** Action status is exactly `PLANNED`, `IN_PROGRESS`, `COMPLETED`, or `CANCELLED`.
- **BR-04** `createdAt` is the authoritative Action Date/Time. It is server-generated and not editable.
- **BR-05** `description` is required, trimmed, and 1–2000 Unicode code points.
- **BR-06** `result` is nullable while `PLANNED`/`IN_PROGRESS`; when supplied it is trimmed and 1–2000 code points; it is mandatory when completing.
- **BR-07** `followUpRequired` is required Boolean state.
- **BR-08** If `followUpRequired=true`, `followUpNote` is required, trimmed, and 1–2000 code points.
- **BR-09** If `followUpRequired=false`, the server normalizes `followUpNote` to `null`.
- **BR-10** `attachmentNotes` remains an explicit handout-required optional text field. Blank input normalizes to `null`; nonblank input is trimmed and limited to 2000 code points.
- **BR-11** `cancellationReason` is null unless cancelling; cancellation requires trimmed 1–500 code points.
- **BR-12** `startedAt`, `completedAt`, and `cancelledAt` are nullable server-authored `timestamptz` values set only by their corresponding lifecycle transition.
- **BR-13** `version` starts at 1 and increments on each successful mutable Action operation.
- **BR-14** `creatorUserId` is a stable FK to the authenticated User who created the Action and is used for creator authorization. `createdBy/updatedBy` retain the project audit-text convention.
- **BR-15** `performedByUserId` remains null until normal completion; on completion it is set to the authenticated actor who actually completes the Action.
- **BR-16** Migrated synthetic Actions may have `performedByUserId=null` because the historical performer is unknown.

### 5.2 Action creation and eligibility

- **BR-17** Action creation is allowed only when Ticket status is `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, or `REOPENED`.
- **BR-18** Action creation is rejected for `NEW`, `RESOLVED`, `CLOSED`, and `CANCELLED`.
- **BR-19** IT Staff and Administrators may create Actions on accessible eligible Tickets.
- **BR-20** Create UI defaults assignee to the authenticated Staff/Admin but allows the value to be cleared before submission.
- **BR-21** Action assignee is nullable.
- **BR-22** A non-null Action assignee must be an active, non-deleted `IT_STAFF` or `ADMINISTRATOR`.
- **BR-23** Eligibility is revalidated by the mutation backend even when the User was previously returned by the assignable-user endpoint.

### 5.3 Action lifecycle and authorization

- **BR-24** Permitted Action transitions are:

| Current | Operation | Next | Authorized actor |
|---|---|---|---|
| `PLANNED` | Start | `IN_PROGRESS` | current Action assignee |
| `PLANNED` | Cancel | `CANCELLED` | creator, current Action assignee, or Ticket Owner |
| `IN_PROGRESS` | Complete | `COMPLETED` | current Action assignee or Ticket Owner |
| `IN_PROGRESS` | Cancel | `CANCELLED` | creator, current Action assignee, or Ticket Owner |

- **BR-25** `COMPLETED` and `CANCELLED` are terminal Action states.
- **BR-26** An unassigned `PLANNED` Action cannot Start.
- **BR-27** Start sets `startedAt=now`, clears no work fields, and increments `version`.
- **BR-28** Complete requires Result and valid Follow-Up state, sets `performedByUserId=actor`, `completedAt=now`, status `COMPLETED`, and increments `version`.
- **BR-29** Cancel requires `cancellationReason`, sets `cancelledAt=now`, status `CANCELLED`, and increments `version`.
- **BR-30** Invalid lifecycle operation returns `409 INVALID_ACTION_TRANSITION`.
- **BR-31** Stale `expectedVersion` returns existing generic `409 CONFLICT`.
- **BR-32** Terminal Actions reject edit, assignment, attachment-association, and lifecycle mutation.
- **BR-33** Correction of historical completed/cancelled work is recorded as another Action; terminal rows are not rewritten.

### 5.4 Action edit and assignment

- **BR-34** While non-terminal, creator, current assignee, or Ticket Owner may edit Description, Result, Follow-Up state/note, Attachment Notes, and attachment associations.
- **BR-35** Assignment mutation is separate from generic edit.
- **BR-36** Any authenticated IT Staff or Administrator with access to the Ticket may assign, reassign, or unassign a non-terminal Action.
- **BR-37** Assignment mutation uses `expectedVersion`, increments Action `version`, and records corresponding Activity.
- **BR-38** Unassign sets `assignedToUserId=null`; it does not change Action lifecycle status.
- **BR-39** Generic Action edit does not silently change assignment.

### 5.5 Attachment integration

- **BR-40** Existing `Attachment` continues to store binary data; no Action-specific binary table is created.
- **BR-41** `ActionTakenAttachment` is a join table with a unique `(actionTakenId, attachmentId)` pair.
- **BR-42** An associated Attachment must be Active, not removed/deleted, and belong to the same Ticket as the Action.
- **BR-43** A Ticket Attachment may be linked to multiple Actions.
- **BR-44** Lab 4 adds no Attachment upload route or uploader permission. Action associations use existing eligible Active Attachments; Lab 3 Requester upload behavior and uploader fields remain unchanged.
- **BR-45** Action edit supplies the desired complete attachment-ID set; the service diffs join rows transactionally.
- **BR-46** Cross-Ticket submitted attachment IDs are treated as unavailable to the caller and rejected with safe `404 NOT_FOUND`.
- **BR-47** Cancelling an Action preserves Action-Attachment links.
- **BR-48** Terminal Action associations are immutable.
- **BR-49** Attachment uploader naming and ownership remain unchanged from Lab 3; Lab 4 adds only Action-to-Attachment association rows.

### 5.6 Ticket resolution and Lab 4 Ticket authorization

- **BR-50** Ticket statuses remain `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, `CANCELLED`.
- **BR-51** The approved Lab 3 transition matrix remains in force except for the additional Mark Resolved precondition and Administrator permission evolution defined here.
- **BR-52** Mark Resolved requires:
  - Ticket current status is otherwise eligible under the Lab 3 matrix;
  - at least one Action has `status = COMPLETED AND isMigrated = false`;
  - zero Actions are `PLANNED`;
  - zero Actions are `IN_PROGRESS`.
- **BR-53** `CANCELLED` Actions do not block resolution.
- **BR-54** A Ticket with only Cancelled Actions fails the completed-work requirement.
- **BR-55** Failure of the Actions Taken resolution gate returns existing `409 INVALID_STATUS_TRANSITION`.
- **BR-56** Requester `looks-resolved` remains advisory: it records confirmation time and does not set `RESOLVED`.
- **BR-57** Close remains valid only from `RESOLVED` after Requester confirmation.
- **BR-58** Reopen behavior remains Lab 3 behavior and clears Ticket owner as already specified; Actions remain historical.
- **BR-59** Administrator may Claim an unassigned Ticket under the same rule as IT Staff.
- **BR-60** IT Staff and Administrator may change IT Priority without being Ticket Owner.
- **BR-61** IT Staff and Administrator may Cancel under the Staff cancellation source-state rules.
- **BR-62** Start Work, Request Information, Resume Work, Mark Resolved, and Close remain current-Ticket-Owner-only for both IT Staff and Administrator.

### 5.7 Ticket Activity

- **BR-63** `TicketActivity` is append-only. No normal update/delete route exists.
- **BR-64** `TicketActivity.performedByUserId` is a non-null FK identifying the authenticated User or internal SYSTEM User that caused the database event.
- **BR-65** `TicketActivity.action` is an enum containing at least:

```text
MIGRATED_TICKET_SNAPSHOT
TICKET_ASSIGNED
TICKET_REASSIGNED
TICKET_UNASSIGNED
IT_PRIORITY_CHANGED
TICKET_STARTED_WORK
INFORMATION_REQUESTED
TICKET_RESUMED
TICKET_MARKED_RESOLVED
REQUESTER_RESOLUTION_CONFIRMED
TICKET_CLOSED
TICKET_CANCELLED
TICKET_REOPENED
ACTION_CREATED
ACTION_UPDATED
ACTION_ASSIGNED
ACTION_REASSIGNED
ACTION_UNASSIGNED
ACTION_STARTED
ACTION_COMPLETED
ACTION_CANCELLED
```

- **BR-66** Activity detail is normalized into typed child tables; arbitrary JSON metadata is not stored.
- **BR-67** `TicketAssignmentActivity` stores `previousAssignedToUserId?` and `assignedToUserId?` for Ticket assignment events.
- **BR-68** `TicketStatusActivity` stores `previousStatus?` and `status`; null previous value is permitted only for the explicit migration snapshot.
- **BR-69** `TicketPriorityActivity` stores `previousPriority?` and `priority`; null previous value is permitted only for the explicit migration snapshot.
- **BR-70** `ActionTakenActivity` stores the related `actionTakenId`; for Action assignment events it additionally stores `previousAssignedToUserId?` and `assignedToUserId?`.
- **BR-71** Normal Action field edits append `ACTION_UPDATED` but do not store a full before/after copy of every field.
- **BR-72** Public Comments, Internal Notes, and Attachments remain their own durable records and are not duplicated as Activity rows merely because they were created/read.
- **BR-73** Every Activity required by a mutation is inserted inside the same transaction as the mutation; if either part fails, neither commits. Requester `looks-resolved` updates `requesterResolutionConfirmedAt` and inserts one `REQUESTER_RESOLUTION_CONFIRMED` Activity with the authenticated Requester as actor in that same transaction. This event records confirmation of an already-resolved Ticket, not a status transition; it needs no typed detail child row. An idempotent repeat that leaves the Ticket unchanged adds no second Activity.
- **BR-74** Staff/Admin may retrieve Activity for accessible Tickets; Requesters are forbidden from Activity endpoints.

### 5.8 Idempotency and concurrency

- **BR-75** Action create, Start, Complete, and Cancel require a UUID `Idempotency-Key` header.
- **BR-76** Persistent idempotency identity is `(authenticatedUserId, HTTP method, concrete canonical resource path, Idempotency-Key)`. The path includes actual lowercase Ticket/Action public UUIDs, not only the route template; query parameters and trailing slashes are excluded.
- **BR-77** The request hash is derived from the uppercase HTTP method, concrete canonical resource path, and normalized semantic body, including `expectedVersion` where applicable.
- **BR-78** Same scope + same key + same normalized request replays the prior completed logical result without duplicating Action state or Activity.
- **BR-79** Same scope + same key + different normalized request returns `409 IDEMPOTENCY_CONFLICT`.
- **BR-80** A replay check occurs before applying optimistic-version rejection, so a repeated successful lifecycle request may replay even though the resource version has advanced.
- **BR-81** Generic edit and assignment rely on optimistic `expectedVersion`; they do not require an idempotency key.
- **BR-82** Generalized `IdempotencyRecord` preserves existing Ticket-create behavior and supports optional `ticketId` / `actionTakenId` result relations rather than arbitrary result JSON.
- **BR-83** Completed records identify the logical result; processing timeout/expiry behavior remains safe and deterministic under the existing idempotency policy.

### 5.9 Dashboard calculations

- **BR-84** Dashboard calculations exclude soft-deleted Tickets.
- **BR-85** Requester Dashboard is always fixed to the authenticated Requester's `requesterId`; client filters cannot widen ownership.
- **BR-86** Requester **Active Tickets** = own Tickets with status in `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `REOPENED`.
- **BR-87** Requester **Waiting for Me** = own `WAITING_FOR_REQUESTER` Tickets.
- **BR-88** Requester **Resolved** = own `RESOLVED` Tickets.
- **BR-89** Requester **Closed** = own `CLOSED` Tickets.
- **BR-90** Requester Recently Updated = top N own Tickets ordered `updatedAt DESC, id DESC`.
- **BR-91** Staff/Admin **Unassigned** = non-terminal Tickets with `ownerUserId IS NULL`.
- **BR-92** Staff/Admin **My Assigned** = non-terminal Tickets whose owner is the authenticated User.
- **BR-93** Staff/Admin **In Progress** = Tickets in `IN_PROGRESS`.
- **BR-94** Staff/Admin **Waiting for Requester** = Tickets in `WAITING_FOR_REQUESTER`.
- **BR-95** Staff/Admin **High Priority** = non-terminal Tickets with `itPriority=HIGH`.
- **BR-96** Non-terminal for Dashboard workload means any status except `CLOSED` or `CANCELLED`.
- **BR-97** My Actions Taken includes each Action once when `assignedToUserId=currentUser OR performedByUserId=currentUser`.
- **BR-98** My Actions ordering uses lifecycle-relevant event time:
  - `COMPLETED` → `completedAt`;
  - `CANCELLED` → `cancelledAt`;
  - `IN_PROGRESS` → `startedAt`;
  - `PLANNED` → `createdAt`;
  then `id DESC` as deterministic tie-break.
- **BR-99** Recently Updated Tickets = non-terminal Tickets ordered `updatedAt DESC, id DESC`.
- **BR-100** Urgent Tickets = non-terminal `itPriority=HIGH`, unassigned first, then `createdAt ASC, id ASC`.
- **BR-101** Dashboard list-size query values are integers 1–20; omitted values default to 5.
- **BR-102** Dashboard metrics and all compact collections are read from one PostgreSQL `REPEATABLE READ` transaction/snapshot.

### 5.10 Dashboard client behavior

- **BR-103** Dashboard schedules auto-refresh every 30 seconds in addition to manual Refresh. Hidden documents pause scheduled refresh; becoming visible triggers immediate refresh/revalidation and restarts the normal schedule, subject to single-flight.
- **BR-104** Only one Dashboard request may be in flight. Ignore timer ticks and disable/ignore manual Refresh while loading; allow the active request to finish rather than aborting it to start another. Completion permits the next future refresh; skipped ticks do not queue duplicate requests.
- **BR-105** An accepted successful response immediately replaces the displayed DTO and updates its in-memory cache entry and success timestamp.
- **BR-106** Initial-load failure without successful data uses page-level safe ErrorState with Retry.
- **BR-107** Dashboard API responses use `Cache-Control: no-store`.
- **BR-108** Background refresh failure with successful data displayed retains that DTO, shows a non-destructive warning, and exposes Retry; it does not blank the Dashboard.
- **BR-109** Display `Last updated HH:mm:ss` beside `[Refresh]`, localized to the User. The timestamp changes only when a successful DTO is accepted; cache reuse preserves its original success timestamp.
- **BR-110** Background refresh never replaces existing content with skeletons and never adds a persistent "Refreshing..." indicator. New data appears immediately when an eligible response succeeds.
- **BR-111** Cache only the last successful Dashboard DTO per authenticated User identity, role, and Dashboard URL/list-size query state in application memory. Age <=30 seconds may render immediately; age >30 seconds may render while immediate revalidation is requested under single-flight. Never render another User/role’s data, including late responses after an identity/role/query change. No localStorage, sessionStorage, service-worker cache, or HTTP browser cache is used for Dashboard reuse; HTTP remains no-store.
- **BR-112** Browser URL stores compact list-size selections; UI offers 5, 10, 20.

### 5.11 Action assignee selection

- **BR-113** The reusable User lookup definition fetches `/api/users/assignable` using the existing collection-query mechanics; API/domain policy stays outside the generic Lookup renderer.
- **BR-114** The endpoint returns active, non-deleted IT Staff/Administrators and excludes the SYSTEM User.
- **BR-115** Assignable-user query validation supports search/searchFields (name, email), filters under the existing User role/EQUAL convention, sort (name, email, role), pageNumber/pageSize, and X-Pagination. Use name ASC by default and publicId ASC as deterministic tie-break; resource validation owns field/operator/type allowlists, never shared QueryBuilder authorization.
- **BR-116** Global LookupField/LookupModal and domain lookup definitions remain separate. LookupDefinition<T> supplies title, columns, fetchData, getValue, getDisplayValue, and useful search/empty labels. LookupModal composes DataTable with Name, Email, Role, Action columns and explicit Select row action; it supports search, sorting, pagination, loading, empty/no-results, safe failure/Retry, keyboard operation, and focus restoration without User Management actions.
- **BR-117** Create Action defaults the optional assignee to authenticated eligible Staff/Admin and allows clearing before creation; no fake Unassigned User row is added to Lookup.
- **BR-118** Persisted Action unassignment is a separate confirmed operation, not a user lookup result.
- **BR-119** Assignment mutation revalidates target eligibility on the backend.
- **BR-120** A target that becomes inactive or otherwise ineligible produces safe validation feedback without changing Action state.

### 5.12 Migration, SYSTEM user, and seed

- **BR-121** Schema migration, including failed/interrupted attempts and recovery, preserves all existing Users, Tickets, Attachments, Idempotency records, Public Comments, and Internal Notes. A failed migration stops deployment before schema-dependent application code is considered deployed; never use destructive `prisma migrate reset` against the preserved Lab 3 database.
- **BR-122** User receives `isSystem Boolean @default(false)`; normal authentication, User Management, assignable lookup, and human-facing user lists exclude `isSystem=true`.
- **BR-123** Migration/seed provides exactly one identifiable internal SYSTEM User with no usable login path, `isActive=false`, `mustChangePassword=false`, `isSystem=true`, and a non-usable/synthetic credential hash. A PostgreSQL partial unique constraint on `isSystem=true` prevents a second SYSTEM User.
- **BR-124** Every legacy Ticket receives exactly one `MIGRATED_TICKET_SNAPSHOT` Activity written by the SYSTEM User at migration execution time, including after recovery/retry. A PostgreSQL partial unique constraint on `(ticketId)` for that Activity type prevents duplicate snapshots.
- **BR-125** The snapshot records only known current state—current owner, current Ticket status, and current IT Priority—using normalized child rows; it does not fabricate prior actors, timestamps, or transitions.
- **BR-126** Existing `RESOLVED` and `CLOSED` Tickets receive exactly one synthetic `COMPLETED` Action as visible historical/migration context, including after recovery/retry; other legacy statuses receive none. A PostgreSQL partial unique constraint on `(ticketId)` for `isMigrated=true` prevents a second synthetic Action. It is never proof of new work and never satisfies BR-52.
- **BR-127** Synthetic Action `createdAt` and `completedAt` use the legacy Ticket's `updatedAt` as the best available historical approximation and are marked `isMigrated=true`; resolution checks exclude these Actions.
- **BR-128** Synthetic Action `assignedToUserId` and `performedByUserId` remain null because historical assignment/performer is unknown.
- **BR-129** Migration wording must visibly identify the record as migrated/system-generated and must not claim a person performed work that was never recorded.
- **BR-130** `CANCELLED` legacy Tickets do not receive a synthetic Completed Action.
- **BR-131** Seed is idempotent and demonstrates zero/one/multiple Actions, all major Ticket statuses/priorities, assigned/unassigned ownership, eligible/ineligible Users, and zero/non-zero Dashboard states.

**Failed migration recovery procedure (BR-121, BR-123–BR-127):** Stop rollout and retain the verified pre-migration backup/restore point. With the repository's guarded target environment, set `DIRECT_URL` to the intended database and run read-only `prisma migrate status`; confirm its reported datasource, inspect the failed entry and logs in `_prisma_migrations`, and inspect actual schema/data before changing migration state. For a transactionally rolled-back migration with no partial schema/data effects, fix the cause in the approved migration, mark the failed attempt rolled back with Prisma's supported `prisma migrate resolve --rolled-back <migration-name>`, then run guarded `prisma migrate deploy` again. If partial effects exist, first reconcile them against the approved migration using a reviewed, non-destructive forward repair; mark the migration applied with `prisma migrate resolve --applied <migration-name>` only after every schema and backfill effect has been verified. If safe reconciliation cannot be proven, restore the verified pre-migration backup/restore point and rerun the corrected approved migration. Never mark an incomplete migration applied, edit an already successfully applied migration, or use `prisma migrate reset` on preserved data. Repeat the duplicate-safe backfill/seed only after schema state is sound; identify migration rows by stable legacy Ticket identity and enforce one SYSTEM User, one snapshot per legacy Ticket, and one synthetic migrated Completed Action per eligible legacy Ticket. Verify legacy row preservation and the resolution exclusion after recovery.

## 6. Data Model Increment

### 6.1 Enums

```text
ActionTakenStatus =
  PLANNED
  IN_PROGRESS
  COMPLETED
  CANCELLED
```

`TicketActivityType` contains the values in BR-65.

### 6.2 ActionTaken

Conceptual Prisma shape:

```text
ActionTaken
- id Int PK
- publicId UUID UNIQUE
- ticketId Int FK -> Ticket
- creatorUserId Int FK -> User
- assignedToUserId Int? FK -> User
- performedByUserId Int? FK -> User
- status ActionTakenStatus
- description varchar(2000)
- result varchar(2000)?
- followUpRequired boolean
- followUpNote varchar(2000)?
- attachmentNotes varchar(2000)?
- cancellationReason varchar(500)?
- isMigrated boolean default false
- version int default 1
- startedAt timestamptz?
- completedAt timestamptz?
- cancelledAt timestamptz?
- createdBy varchar(255)
- createdAt timestamptz
- updatedBy varchar(255)
- updatedAt timestamptz
```

Required indexes include:

```text
(ticketId, createdAt DESC, id DESC)
(assignedToUserId, status)
(performedByUserId, completedAt)
(status, ticketId)
```

### 6.3 ActionTakenAttachment

```text
ActionTakenAttachment
- actionTakenId FK -> ActionTaken
- attachmentId FK -> Attachment
- createdBy
- createdAt
- updatedBy
- updatedAt

PK/UNIQUE (actionTakenId, attachmentId)
```

All FKs use restrictive update/delete behavior. Removal of an Attachment remains governed by existing Attachment business rules; association reads ignore deleted/removed evidence where the existing Attachment contract requires it.

### 6.4 TicketActivity family

```text
TicketActivity
- id Int PK
- publicId UUID UNIQUE
- ticketId FK -> Ticket
- performedByUserId FK -> User NOT NULL
- action TicketActivityType
- createdBy
- createdAt
- updatedBy
- updatedAt
```

Typed children:

```text
TicketAssignmentActivity
- ticketActivityId PK/FK
- previousAssignedToUserId?
- assignedToUserId?

TicketStatusActivity
- ticketActivityId PK/FK
- previousStatus?
- status

TicketPriorityActivity
- ticketActivityId PK/FK
- previousPriority?
- priority

ActionTakenActivity
- ticketActivityId PK/FK
- actionTakenId FK
- previousAssignedToUserId?
- assignedToUserId?
```

An Activity may have the child rows appropriate to its enum. Normal services enforce the enum/detail pairing and database checks should prevent impossible orphan child rows.

### 6.5 User increment

```text
User.isSystem Boolean @default(false)
```

Human-facing queries always include `isSystem=false`.

### 6.6 IdempotencyRecord evolution

The existing table is generalized in place:

```text
IdempotencyRecord
- userId FK -> User
- key UUID
- method varchar(...)
- resourcePath varchar(...)
- requestHash
- status
- processingStartedAt
- ticketId?
- actionTakenId?
- completedAt?
- expiresAt?
- four audit fields

UNIQUE (userId, method, resourcePath, key)
```

Existing `requesterId` records migrate to `userId`. Existing Ticket-create records preserve their `ticketId` and migrate with method `POST` and resource path `/api/users/me/tickets`. New Action create/lifecycle records use `actionTakenId` once completed. A completed record may reference the logical Ticket or Action result appropriate to its resource path.

## 7. Complete Ticket Status Matrix

The Lab 3 status set remains unchanged.

| From | Action | To | Actor / Lab 4 note |
|---|---|---|---|
| `NEW` | Claim/assign first owner | `OPEN` | IT Staff or Administrator; owner set atomically |
| `NEW` | Cancel | `CANCELLED` | IT Staff/Admin under Staff cancel policy; Requester may cancel own Ticket under existing rule |
| `OPEN` | Start Work | `IN_PROGRESS` | current Ticket Owner |
| `OPEN` | Request Information | `WAITING_FOR_REQUESTER` | current Ticket Owner + required Public Comment |
| `OPEN` | Cancel | `CANCELLED` | approved Requester/Staff/Admin rule |
| `IN_PROGRESS` | Request Information | `WAITING_FOR_REQUESTER` | current Ticket Owner + required Public Comment |
| `IN_PROGRESS` | Mark Resolved | `RESOLVED` | current Ticket Owner + BR-52 resolution gate |
| `IN_PROGRESS` | Cancel | `CANCELLED` | IT Staff/Admin cancellation rule |
| `WAITING_FOR_REQUESTER` | Resume Work | `IN_PROGRESS` | current Ticket Owner |
| `WAITING_FOR_REQUESTER` | Mark Resolved | `RESOLVED` | current Ticket Owner + BR-52 resolution gate |
| `WAITING_FOR_REQUESTER` | Cancel | `CANCELLED` | approved Staff/Admin rule |
| `RESOLVED` | Looks Resolved | `RESOLVED` | Requester confirmation timestamp only |
| `RESOLVED` | Close | `CLOSED` | current Ticket Owner after Requester confirmation |
| `RESOLVED` | Problem Still Exists | `REOPENED` | Requester; clears confirmation and owner per Lab 3 |
| `CLOSED` | Problem Still Exists | `REOPENED` | Requester; clears confirmation and owner per Lab 3 |
| `REOPENED` | Start Work | `IN_PROGRESS` | current Ticket Owner |
| `REOPENED` | Request Information | `WAITING_FOR_REQUESTER` | current Ticket Owner |
| `REOPENED` | Mark Resolved | `RESOLVED` | current Ticket Owner + BR-52 resolution gate |
| `REOPENED` | Cancel | `CANCELLED` | approved Staff/Admin rule |
| `CANCELLED` | — | — | terminal |

Assignment/reassignment/unassignment and IT Priority mutations do not themselves change status except the existing first-owner `NEW → OPEN` rule.

## 8. Dashboard Contract Summary

### 8.1 Requester

Metrics:

```text
Active Tickets
Waiting for Me
Resolved
Closed
```

Recent list columns:

```text
Ticket Number
Summary
Requested Priority
Status
Updated At
```

Default list size is 5; browser UI offers 5/10/20. Cards drill into My Tickets with equivalent pre-applied filters.

### 8.2 IT Staff / Administrator

Metrics:

```text
Unassigned
My Assigned
In Progress
Waiting for Requester
High Priority
```

Compact collections:

```text
My Actions Taken
Recently Updated Tickets
Urgent Tickets
```

Staff/Admin share the same Dashboard component and API DTO. Role-aware links target `/staff/...` or `/admin/...`.

## 9. API Specification Summary

Exact wire-level details are defined in `api-spec.md`. Primary Lab 4 additions are:

```text
REQUESTER ACTION READ
GET /api/users/me/tickets/:ticketPublicId/actions
GET /api/users/me/tickets/:ticketPublicId/actions/:actionPublicId

STAFF/ADMIN ACTIONS
GET   /api/tickets/:ticketPublicId/actions
POST  /api/tickets/:ticketPublicId/actions
GET   /api/tickets/:ticketPublicId/actions/:actionPublicId
PATCH /api/tickets/:ticketPublicId/actions/:actionPublicId
PATCH /api/tickets/:ticketPublicId/actions/:actionPublicId/assignee
POST  /api/tickets/:ticketPublicId/actions/:actionPublicId/start
POST  /api/tickets/:ticketPublicId/actions/:actionPublicId/complete
POST  /api/tickets/:ticketPublicId/actions/:actionPublicId/cancel

ACTIVITY
GET /api/tickets/:ticketPublicId/activity
GET /api/tickets/:ticketPublicId/actions/:actionPublicId/activity

DASHBOARDS
GET /api/users/me/dashboard
GET /api/dashboard

LOOKUP
GET /api/users/assignable
```

All prior approved APIs continue unless explicitly evolved here.

## 10. UI Specification Summary

Exact screen/component behavior is defined in `ui-spec.md`.

Key decisions:

- `/dashboard` is the authenticated role home for Requester, IT Staff, and Administrator.
- Dashboard is the first Sidebar item for every role.
- Every tabular UI uses the reusable TokTickIT `DataTable`.
- Actions Taken is a dedicated Ticket Detail section.
- Create/Edit Action uses `CommonForm` in a Modal.
- Assignment uses the global DataTable-backed User Lookup; Unassign is a separate confirmed action, never a fake User row.
- Start/Complete/Cancel lifecycle controls are available on Action Detail only.
- Start is disabled when the Action is unassigned and requires confirmation.
- Complete opens a Result/Follow-Up form.
- Cancel requires a cancellation reason.
- Terminal Actions hide mutation controls.
- Activity uses a chronological timeline rather than a table.
- Requester does not see internal Activity.
- desktop/tablet/mobile evidence viewports remain 1440×900, 820×1180, and 390×844.

## 11. Acceptance Criteria

- **AC-01** Given permitted Staff/Admin and valid data, creating an Action persists one `PLANNED` Action under the correct Ticket with authenticated creator, approved/default-or-null assignee, server Action Date/Time, and no duplicate on replay.
- **AC-02** Action Description, Result, Follow-Up, Attachment Notes, and cancellation validation boundaries are enforced by client and backend; invalid submit does not mutate data.
- **AC-03** Action collection search/filter/sort/pagination returns only approved fields/resources with deterministic ordering and safe invalid-query handling.
- **AC-04** Requester can view all Actions belonging to an owned Ticket and receives safe unavailable behavior for another Requester's Ticket/Action.
- **AC-05** Requester cannot mutate Actions even when directly calling Staff/Admin endpoints.
- **AC-06** Assign/reassign/unassign accepts only active non-deleted Staff/Admin and rejects Requester, inactive, deleted, SYSTEM, malformed, or stale targets.
- **AC-07** Unassigned `PLANNED` Action cannot Start; frontend disables Start and backend independently rejects bypass.
- **AC-08** Current Action assignee can Start a valid `PLANNED` Action; status, `startedAt`, version, idempotency result, and Activity are correct.
- **AC-09** Complete requires `IN_PROGRESS`, valid Result/Follow-Up, and assignee-or-Ticket-Owner authority; `performedByUserId`, `completedAt`, status, version, and Activity are correct.
- **AC-10** Cancel requires approved actor and cancellation reason; status, `cancelledAt`, version, preserved attachments, and Activity are correct.
- **AC-11** Completed/Cancelled Actions reject later edit/assignment/attachment/lifecycle mutations.
- **AC-12** Stale `expectedVersion` returns `409 CONFLICT` and cannot overwrite current Action state.
- **AC-13** Concurrent Action assignment/reassignment produces one committed current version and no silent lost update.
- **AC-14** Same authenticated actor/method/concrete resource path/Idempotency-Key + same normalized Action-create request returns the same logical Action without duplication.
- **AC-15** Same idempotency identity + different normalized request returns `409 IDEMPOTENCY_CONFLICT`.
- **AC-16** Retried Start/Complete/Cancel replays safely and does not duplicate timestamps, state changes, or Activity.
- **AC-17** Eligible existing Active Attachment from a Ticket may be linked to multiple Actions; Lab 3 Requester upload behavior is unchanged.
- **AC-18** Cross-Ticket, Pending, Removed, or otherwise unavailable Attachment association is safely rejected; terminal association sets are immutable.
- **AC-19** Required business mutation and Ticket Activity are atomic: both commit or neither commits.
- **AC-20** Ticket/Action Activity is append-only, correctly ordered/filterable, and unavailable to Requesters.
- **AC-21** Mark Resolved fails when no non-migrated Completed Action exists, including Tickets with only migrated Completed Actions.
- **AC-22** Mark Resolved fails while any Planned or In-Progress Action exists.
- **AC-23** Mark Resolved succeeds when at least one non-migrated Action is Completed and none are Planned/In Progress; Cancelled Actions do not block, and migrated Completed Actions do not count as new work.
- **AC-24** Requester resolution confirmation remains advisory: it records the confirmation timestamp and exactly one `REQUESTER_RESOLUTION_CONFIRMED` Activity atomically without changing Ticket status; Close still requires confirmation and current Ticket Owner authority.
- **AC-25** Administrator can Claim, change IT Priority, Cancel, and perform Action work like IT Staff while owner-only Ticket lifecycle actions remain owner-only.
- **AC-26** Requester Dashboard counts only authenticated Requester's Tickets and matches BR-86–BR-90.
- **AC-27** Requester recent list is bounded/deterministic, size input 1–20 is honored, UI size state is URL-addressable, and card/list drill-downs preserve ownership.
- **AC-28** Staff/Admin Dashboard metrics match BR-91–BR-100 against authoritative database state.
- **AC-29** My Actions includes assigned-to-me or completed-by-me Actions once each and uses lifecycle-relevant ordering.
- **AC-30** One Dashboard response represents one consistent PostgreSQL snapshot.
- **AC-31** Dashboard API accepts list-size integers 1–20 and rejects invalid values; UI exposes 5/10/20 without making those three values an API-only constraint.
- **AC-32** Dashboard auto-refreshes every 30 seconds with manual Refresh, ignores ticks/manual refresh during active requests without aborting them, pauses while hidden, and revalidates on visibility return. Scoped <=30-second successful cache renders immediately; stale cache may render during immediate revalidation. Cache is isolated by User/role/query and exists only in memory; HTTP remains no-store. Success replaces DTO/Last Updated; initial failure shows ErrorState/Retry and background failure retains data with warning/Retry, without re-skeletoning or a persistent "Refreshing..." indicator.
- **AC-33** Action assignee uses reusable definition-driven global Lookup integrated with CommonForm and a DataTable Select row action. User lookup supports name/email search, name/email/role sorting, pagination and X-Pagination under existing query conventions, fixed Staff/Admin eligibility, safe invalid-query/load failure recovery, keyboard/focus/disabled/field-error states, and separate confirmed Unassign; backend rejects stale/ineligible targets.
- **AC-34** Successful migration and recovery after a failed/interrupted attempt preserve all Lab 3 rows and backfill each legacy `RESOLVED`/`CLOSED` Ticket with exactly one visible `isMigrated=true` Completed Action using approved timestamps; ineligible legacy Tickets receive none, and migrated Actions remain excluded from the resolution gate after retry.
- **AC-35** Successful migration and recovery create exactly one internal SYSTEM User and one truthful SYSTEM-authored Ticket snapshot Activity per legacy Ticket without fabricated history or retry duplicates; repeated seed does not duplicate logical seed data.
- **AC-36** Major Lab 4 screens satisfy Zen Green, keyboard/focus, semantic/non-color state, and responsive requirements at required desktop/tablet/mobile viewports.
- **AC-37** Complete Labs 1–3 regression and the Lab 4 large-data bounded-query performance smoke pass before release.
- **AC-38** For a legacy `RESOLVED` Ticket with a migrated Completed Action, Requester reopen succeeds, Mark Resolved is rejected, and Mark Resolved succeeds only after a real non-migrated Action completes.
- **AC-39** Reusing the same actor, Idempotency-Key, and normalized payload on different concrete Ticket/Action paths never replays a result for the wrong resource.

Every AC is mapped to planned tests/evidence in `tests.md`.

## 12. Assumptions and Decisions

1. **Action Date/Time means server creation time.** A separate user-editable scheduled/action time is not introduced.
2. **Actions are assignable work items.** Assignment is optional; the Create UI defaults to current Staff/Admin but allows clear/unassigned.
3. **Performed By means actual completer.** It is automatically set when a normal Action reaches `COMPLETED`.
4. **Attachment Notes remain a text field.** Actions may associate existing eligible Active same-Ticket Attachments; Lab 4 adds no Staff/Admin upload capability.
5. **Action attachments are existing Ticket Attachments.** The join table avoids duplicate binary storage and allows one file to support multiple Actions.
6. **Terminal Action history is immutable.** Correction is another Action.
7. **Administrators perform IT Staff operational behavior in Lab 4.** Ticket-owner coordination still controls owner-only Ticket lifecycle actions.
8. **Dashboard is operational, not BI.** It provides fixed backend-defined metrics and bounded lists with drill-down.
9. **Dashboard API is domain-oriented.** Backend accepts `1–20`; UI happens to offer 5/10/20.
10. **TicketActivity is an approved Sprint 4 auditability engineering decision.** It records meaningful Ticket/Action mutations plus explicit migration snapshots, not HTTP logs, Comments/Notes, Attachment events, security telemetry, or general events.
11. **Legacy history is not fabricated.** Migration snapshot explicitly identifies unknown prior history.
12. **SYSTEM User is internal infrastructure.** It cannot be used as a normal human account or assignee.
13. **All tables use shared DataTable.** Timeline/metric/card presentations are not tabular and are not forced into DataTable.
14. **Performance smoke is not an SLA.** The large-data test detects gross regression/unbounded processing; it does not promise production latency.
15. **Lab 4 AI-use filename exception.** Final Lab 4 delivery uses the handout-required `docs/lab-04/ai-use.md`. Lab 2 uses `ai-use.md`, Lab 3 uses `ai_use.md`, and `AGENTS.md` names `ai_use.md`; keep those historical files unchanged and treat the handout as Lab 4 authority.
16. **Dashboard freshness is client-side only.** The approved 30-second in-memory cache and auto-refresh coexist with HTTP `Cache-Control: no-store`; only accepted success changes Last Updated.
17. **Lookup is reusable infrastructure.** Generic UI composes DataTable; resource definitions own columns, query mapping, and API access. Action assignee is the first consumer; see `ui-spec.md` §12 for reference-design adaptation.

## 13. Product Definition of Done

Lab 4 is complete only when all of the following are true:

- committed migration upgrades the real Lab 3 schema without destructive reset or data loss, and its documented failed/interrupted recovery is rehearsed against representative legacy data;
- migration/backfill rules in BR-121–BR-130 pass against representative legacy data;
- migrated Completed Actions remain visible but never satisfy the resolution gate, including after a legacy Ticket is reopened;
- idempotent seed can run repeatedly without duplicate logical seed rows;
- Action Taken create/edit/assignment/lifecycle/attachment flows work end-to-end;
- Action attachment associations use only existing eligible Active same-Ticket Attachments; no Staff/Admin upload endpoint is added;
- Action version conflicts, idempotency replay/conflict, and real PostgreSQL race tests pass;
- Ticket Activity is append-only, correctly permissioned, and atomic with required mutations;
- Ticket Mark Resolved enforces the complete Actions Taken resolution gate on the backend;
- Requester Dashboard and Staff/Admin Dashboard metrics match database truth and drill down correctly;
- global LookupField/LookupModal and reusable User definition integrate with CommonForm and DataTable; the bounded queryable assignable-user endpoint revalidates eligibility on mutation;
- Dashboard 30-second auto-refresh, manual Refresh, single-flight, visibility behavior, scoped 30-second in-memory cache, HTTP no-store, Last Updated, and failure recovery match BR-103–BR-112;
- all new and evolved endpoints obey the centralized error/transport/security contracts;
- all required UI states exist: loading, empty/no-results, validation, success, forbidden, not-found, conflict, invalid transition, safe initial failure, and recoverable refresh failure;
- important recoverable form failures preserve user input;
- desktop 1440×900, tablet 820×1180, and mobile 390×844 evidence exists for all major Lab 4 screens;
- screenshot evidence is stored under `artifacts/lab-04/screenshots/`;
- keyboard operation, focus restoration, modal focus, accessible names, alerts/live regions where appropriate, and non-color state cues are verified;
- no page-level horizontal scrolling, clipped actions, overlapping feedback, dead controls, placeholder implementation text, or console errors remain;
- complete Lab 1, Lab 2, Lab 3, and Lab 4 backend/client/E2E suites pass;
- large-data performance smoke passes its explicitly non-SLA regression ceiling and bounded-response assertions;
- README documents current migration, seed, run, test, evidence, and demonstration commands;
- Final Hardening and Release Issue provides completed `docs/lab-04/reviewer.md` and `docs/lab-04/ai-use.md` records; contract work does not add placeholder review evidence;
- `specification.md`, `api-spec.md`, `ui-spec.md`, and `tests.md` remain mutually consistent with the final implementation.

## 14. Final Seven-Issue Decomposition

The final approved plan contains exactly seven Issues. These numbers are planning positions, not newly created GitHub Issue numbers. Feature work enters `lab4-staging` through the existing scoped feature-branch/peer-review workflow.

1. **Sprint 4 Engineering Contract** — `specification.md`, `api-spec.md`, `ui-spec.md`, `tests.md`, and FR/BR/AC/Test contract freeze.
2. **Lab 4 Data Foundation & Migration** — ActionTaken, ActionTakenAttachment, normalized TicketActivity tables, SYSTEM User, IdempotencyRecord evolution, migration/backfill, seed, and migration/PG tests.
3. **Actions Taken Backend & REST API** — Action list/detail/create/edit, assignment, Start/Complete/Cancel, Action concurrency/idempotency, existing Attachment association, Requester read-only Action APIs, Activity APIs/writes, queryable assignable-user API, and backend/API/PG tests.
4. **Actions Taken UI & Global Lookup** — Actions Taken DataTable, Create/Edit modal, Action Detail, global Lookup abstraction, DataTable-backed Lookup, assign/reassign/unassign UI, existing Attachment association UI, Activity timelines, and component/responsive/accessibility tests.
5. **Final Ticket Workflow & Resolution Rules** — non-migrated completed-work resolution gate, final Ticket transition matrix, Admin operational parity, owner-only lifecycle actions, Requester confirmation, workflow Activity, authorization/concurrency tests, and ticket-resolution E2E.
6. **Role Dashboards** — Requester and Staff/Admin Dashboards, exact backend calculations, drill-down, URL list sizes, auto-refresh every 30 seconds, manual Refresh, hidden-tab behavior, single-flight behavior, 30-second in-memory cache, and Dashboard API/PG/UI/E2E tests.
7. **Final Hardening, Regression & Release Verification** — Labs 1–4 regression, final PG suite, E2E, accessibility, responsive evidence under `artifacts/lab-04/screenshots/`, performance smoke, README, `docs/lab-04/reviewer.md`, `docs/lab-04/ai-use.md`, AC → Test → Evidence reconciliation, and release integration/readiness.

### 14.1 Primary dependency chain

```text
#1 Engineering Contract
        |
        v
#2 Data Foundation & Migration
        |
        v
#3 Actions Backend & REST API
        |
        v
#4 Actions UI & Global Lookup
        |
        v
#5 Final Ticket Workflow
        |
        v
#6 Role Dashboards
        |
        v
#7 Hardening / Regression / Release
```

Implementation may overlap when dependencies are stable, but this remains the primary planning/dependency structure. Keep #2 and #3 separate; keep #7 as one Issue. The contract phase does not create implementation or populate reviewer, AI-use, screenshot, or test-result evidence.
