# Lab 4 REST API Specification

## 1. Purpose and Scope

This document defines the wire-level REST API contract for TokTickIT Lab 4. It refines `docs/lab-04/specification.md` into exact route groups, DTOs, query parameters, request bodies, validation, authorization, status codes, idempotency, optimistic concurrency, Activity behavior, Dashboard behavior, safe errors, and compatibility rules.

Lab 4 extends the completed Lab 3 API. All approved Lab 2/Lab 3 authentication, Requester Ticket, Attachment, Staff Queue, Public Comment, Internal Note, User Management, centralized error, request-correlation, no-store, and query contracts continue unless this document explicitly evolves them.

Shared anchors:

```text
API base path = /api

UserRole =
  REQUESTER
  IT_STAFF
  ADMINISTRATOR

TicketStatus =
  NEW
  OPEN
  IN_PROGRESS
  WAITING_FOR_REQUESTER
  RESOLVED
  CLOSED
  REOPENED
  CANCELLED

ActionTakenStatus =
  PLANNED
  IN_PROGRESS
  COMPLETED
  CANCELLED
```

## 2. General API Conventions

### 2.1 Base path

All endpoints use:

```text
/api
```

### 2.2 JSON naming

JSON request/response properties use `camelCase`.

PostgreSQL remains `snake_case`; Prisma maps DB fields to application camelCase.

### 2.3 Timestamps

All API timestamps are ISO-8601 UTC strings, for example:

```json
{
  "createdAt": "2026-09-28T12:30:45.123Z"
}
```

Frontend display may localize to the user's current locale/timezone.

### 2.4 Public identifiers

Directly addressable Ticket, User, Action Taken, Public Comment, Internal Note, and Activity resources use opaque UUID public identifiers where exposed.

Internal numeric PKs are not exposed merely because they exist.

### 2.5 Success bodies

Successful JSON endpoints return the resource/array/DTO directly. There is no mandatory top-level `{ "data": ... }` wrapper.

Collection pagination continues to use the existing browser-readable `X-Pagination` response header where the endpoint is a normal paged collection.

### 2.6 Authentication and transport

All Lab 4 business endpoints remain protected by the existing Lab 3 authenticated-session middleware and access JWT transport.

The backend remains authoritative for current User, role, active/deleted/system state, session stage, resource ownership, Ticket ownership, Action authorization, and assignee eligibility.

All protected responses retain:

```text
Cache-Control: no-store
```

Dashboard in-memory reuse is a client behavior and does not change HTTP caching.

### 2.7 Existing error envelope

The centralized envelope remains:

```json
{
  "statusCode": 409,
  "code": "CONFLICT",
  "message": "The requested operation conflicts with the current resource state.",
  "error": "Conflict"
}
```

Validation may include:

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "The request contains invalid values.",
  "error": "Bad Request",
  "details": [
    {
      "field": "description",
      "message": "Enter 1–2000 characters."
    }
  ]
}
```

Lab 4 adds only one Action-specific machine code:

```text
INVALID_ACTION_TRANSITION
```

Stale Action writes use generic `CONFLICT`.
Ticket resolution-gate failure uses existing `INVALID_STATUS_TRANSITION`.
Inactive/ineligible assignee uses `VALIDATION_ERROR`.

## 3. Primary Route Surface

```text
AUTH / REFERENCE / REQUESTER / STAFF / ADMIN
All approved Lab 3 routes remain.

LAB 4 REQUESTER ACTION READ
GET /api/users/me/tickets/:ticketPublicId/actions
GET /api/users/me/tickets/:ticketPublicId/actions/:actionPublicId

LAB 4 STAFF / ADMIN ACTIONS
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

ASSIGNABLE USER LOOKUP
GET /api/users/assignable
```

## 4. DTOs

### 4.1 User summary

```ts
interface UserSummaryDTO {
  publicId: string;
  name: string;
  email: string;
  role: "IT_STAFF" | "ADMINISTRATOR";
}
```

SYSTEM users and Requesters are never returned by assignable-user DTOs.

### 4.2 Attachment summary

Existing Attachment DTO and uploader ownership remain authoritative. Lab 4 does not change Attachment uploader fields or add an upload endpoint.

### 4.3 ActionTakenDTO

```ts
interface ActionTakenDTO {
  publicId: string;
  ticketPublicId: string;

  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

  description: string;
  result: string | null;

  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
  cancellationReason: string | null;

  creator: {
    publicId: string;
    name: string;
  };

  assignedTo: UserSummaryDTO | null;

  performedBy: {
    publicId: string;
    name: string;
    role: "IT_STAFF" | "ADMINISTRATOR";
  } | null;

  attachments: Attachment[];

  isMigrated: boolean;
  version: number;

  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;

  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
}
```

Requester responses use the same approved business fields, including creator/assignee/performer display data and associated Attachments, but never include internal Ticket Activity.

### 4.4 ActionTakenListItemDTO

Action collection endpoints return a bounded list projection rather than the full detail DTO for every row:

```ts
interface ActionTakenListItemDTO {
  publicId: string;
  ticketPublicId: string;
  status: ActionTakenDTO["status"];
  description: string;
  assignedTo: UserSummaryDTO | null;
  performedBy: ActionTakenDTO["performedBy"];
  followUpRequired: boolean;
  createdAt: string;
  updatedAt: string;
  version: number;
}
```

The list may omit large Result/Follow-Up/Attachment fields; they remain searchable where explicitly approved by the validator.

### 4.5 ActivityDTO

`TicketActivity` is an explicitly approved Sprint 4 auditability design decision, not a generic Activity system required by the handout. It is limited to meaningful Ticket/Action mutations and truthful migration snapshots. It does not duplicate Comments/Internal Notes or Attachment Notes, record HTTP requests or security telemetry, or act as a general event platform.

```ts
type TicketActivityType =
  | "MIGRATED_TICKET_SNAPSHOT"
  | "TICKET_ASSIGNED"
  | "TICKET_REASSIGNED"
  | "TICKET_UNASSIGNED"
  | "IT_PRIORITY_CHANGED"
  | "TICKET_STARTED_WORK"
  | "INFORMATION_REQUESTED"
  | "TICKET_RESUMED"
  | "TICKET_MARKED_RESOLVED"
  | "TICKET_CLOSED"
  | "TICKET_CANCELLED"
  | "TICKET_REOPENED"
  | "ACTION_CREATED"
  | "ACTION_UPDATED"
  | "ACTION_ASSIGNED"
  | "ACTION_REASSIGNED"
  | "ACTION_UNASSIGNED"
  | "ACTION_STARTED"
  | "ACTION_COMPLETED"
  | "ACTION_CANCELLED";
```

```ts
interface TicketActivityDTO {
  publicId: string;
  ticketPublicId: string;
  action: TicketActivityType;

  performedBy: {
    publicId: string;
    name: string;
    role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";
    isSystem: boolean;
  };

  assignment?: {
    previousAssignedTo: UserSummaryDTO | null;
    assignedTo: UserSummaryDTO | null;
  };

  statusChange?: {
    previousStatus: TicketStatus | null;
    status: TicketStatus;
  };

  priorityChange?: {
    previousPriority: "LOW" | "MEDIUM" | "HIGH" | null;
    priority: "LOW" | "MEDIUM" | "HIGH";
  };

  actionTaken?: {
    publicId: string;
    previousAssignedTo: UserSummaryDTO | null;
    assignedTo: UserSummaryDTO | null;
  };

  createdAt: string;
}
```

The API may omit a detail object when it is not relevant to the Activity type. It must never emit arbitrary raw JSON metadata.

### 4.6 RequesterDashboardDTO

```ts
interface RequesterDashboardDTO {
  metrics: {
    activeTickets: number;
    waitingForRequester: number;
    resolvedTickets: number;
    closedTickets: number;
  };

  recentTickets: Array<{
    publicId: string;
    ticketNumber: string;
    summary: string;
    requestedPriority: "LOW" | "MEDIUM" | "HIGH";
    currentStatus: TicketStatus;
    updatedAt: string;
  }>;
}
```

### 4.7 StaffDashboardDTO

```ts
interface StaffDashboardDTO {
  metrics: {
    unassignedTickets: number;
    myAssignedTickets: number;
    inProgressTickets: number;
    waitingForRequester: number;
    highPriorityTickets: number;
  };

  myActions: Array<{
    publicId: string;
    ticketPublicId: string;
    ticketNumber: string;
    description: string;
    status: ActionTakenStatus;
    assignedTo: UserSummaryDTO | null;
    performedBy: ActionTakenDTO["performedBy"];
    activityAt: string;
  }>;

  recentTickets: Array<{
    publicId: string;
    ticketNumber: string;
    summary: string;
    requesterName: string;
    itPriority: "LOW" | "MEDIUM" | "HIGH";
    currentStatus: TicketStatus;
    owner: UserSummaryDTO | null;
    updatedAt: string;
  }>;

  urgentTickets: Array<{
    publicId: string;
    ticketNumber: string;
    summary: string;
    requesterName: string;
    itPriority: "HIGH";
    currentStatus: TicketStatus;
    owner: UserSummaryDTO | null;
    updatedAt: string;
  }>;
}
```

Administrator receives the same DTO as IT Staff.

## 5. Shared Query Contract

### 5.1 Existing convention

Normal queryable collections continue to use:

```text
search
searchFields
filters
sort
pageNumber
pageSize
```

`filters` is URL-encoded JSON using the existing expression vocabulary.
Resource validators own field/operator/type allowlists.
The shared QueryBuilder never owns authorization or role-specific business policy.

### 5.2 Paging

Unless a route below defines a smaller bound:

```text
pageNumber >= 1
1 <= pageSize <= 100
```

Paged collection responses set `X-Pagination`.

### 5.3 Action collection query

Approved search fields:

```text
description
result
followUpNote
attachmentNotes
```

Approved filters:

```text
status
assignedToUserPublicId
performedByUserPublicId
followUpRequired
createdAt
```

Approved sorting:

```text
createdAt
updatedAt
status
```

Default:

```text
createdAt:desc
id:desc tie-break
```

Requester Action collection applies Ticket ownership as a fixed backend predicate before/alongside user query expressions.

### 5.4 Activity query

Approved parameters:

```text
filters
sort
pageNumber
pageSize
```

Approved filter:

```text
category
```

UI category mapping:

```text
Ticket Workflow -> Ticket lifecycle Activity enum subset
Assignment      -> Ticket/Action assignment enum subset
Priority        -> IT_PRIORITY_CHANGED
Actions Taken   -> ACTION_* subset
All             -> no category filter
```

Approved sort:

```text
createdAt:asc
createdAt:desc
```

Default API sort:

```text
createdAt:desc, id:desc
```

Action Detail UI explicitly requests oldest-first for chronological narrative.

### 5.5 Assignable-user endpoint

Lab 4 upgrades `GET /api/users/assignable` to a bounded queryable collection using §5.1–5.2 and the existing User query conventions. It supports `search`, `searchFields`, `filters`, `sort`, `pageNumber`, `pageSize`, and browser-readable `X-Pagination`. A resource-specific validator owns the approved fields/operators; fixed eligibility remains service policy outside shared QueryBuilder. See §15.

## 6. Requester Action Read API

### 6.1 List Actions for owned Ticket

```http
GET /api/users/me/tickets/:ticketPublicId/actions
Authorization: Bearer <access-jwt>
```

Role:

```text
REQUESTER
```

Behavior:

1. validate authenticated Requester;
2. resolve a non-deleted Ticket owned by that Requester;
3. if Ticket is malformed/missing/deleted/not owned, return safe `404 NOT_FOUND`;
4. apply Action query validator;
5. return list projection + `X-Pagination`.

Success:

```text
200 OK
```

### 6.2 Read one Action

```http
GET /api/users/me/tickets/:ticketPublicId/actions/:actionPublicId
```

Role:

```text
REQUESTER
```

Ticket and Action parent relationship is validated together. An Action from another Ticket is not returned even if its UUID is valid.

Success:

```text
200 OK
```

Unavailable/cross-owner/cross-parent:

```text
404 NOT_FOUND
```

## 7. Staff/Admin Action Collection API

### 7.1 List Actions

```http
GET /api/tickets/:ticketPublicId/actions
```

Role:

```text
IT_STAFF | ADMINISTRATOR
```

Success:

```text
200 OK
X-Pagination: ...
```

### 7.2 Create Action

```http
POST /api/tickets/:ticketPublicId/actions
Authorization: Bearer <access-jwt>
Idempotency-Key: <uuid>
Content-Type: application/json
```

Role:

```text
IT_STAFF | ADMINISTRATOR
```

Request:

```json
{
  "description": "Inspect switch port and replace cable if required.",
  "assignedToUserPublicId": "0b5709b8-6ab7-4db8-b2e4-43caa2f957c4",
  "followUpRequired": false,
  "followUpNote": null,
  "attachmentNotes": "See the rack photo and switch-port screenshot.",
  "attachmentIds": [
    "2e4c4f78-f875-4e7a-96be-f8ca989ad028"
  ]
}
```

`assignedToUserPublicId` may be `null`.

`attachmentIds` is a deduplicated array of existing Active Attachment public IDs/storage identifiers belonging to the same Ticket, as defined by the existing Attachment DTO. Pending, removed, deleted, or cross-Ticket Attachments are ineligible. The final implementation must use one consistent public Attachment identifier; it must not expose internal numeric PKs.

Create validation:

```text
description          required, trimmed, 1–2000
assignedTo...        null or valid UUID of eligible User
followUpRequired     required boolean
followUpNote         required 1–2000 iff followUpRequired=true; otherwise null
attachmentNotes      null/blank->null or trimmed <=2000
attachmentIds        array, unique, same Ticket, Active and not removed/deleted
unknown properties   rejected according to existing body-validation style
```

Ticket status must be:

```text
OPEN
IN_PROGRESS
WAITING_FOR_REQUESTER
REOPENED
```

The service creates:

```text
status = PLANNED
creatorUserId = actor.userId
createdAt = now
version = 1
```

Success first execution:

```text
201 Created
```

Completed same-key/same-request replay:

```text
200 OK
```

Response:

```text
ActionTakenDTO
```

Conflicts/errors:

```text
400 VALIDATION_ERROR
401/403 existing auth/session errors
404 NOT_FOUND
409 IDEMPOTENCY_CONFLICT
409 INVALID_ACTION_TRANSITION   // Ticket state no longer allows Action creation if implemented through Action transition code
500 safe internal error
```

For an ineligible Ticket state, implementation may use `INVALID_ACTION_TRANSITION` or the existing generic conflict family only if all four contract documents use the same choice. This contract standardizes on:

```text
409 INVALID_ACTION_TRANSITION
```

for Action-domain lifecycle/state preconditions.

## 8. Staff/Admin Action Detail and Edit

### 8.1 Read Action

```http
GET /api/tickets/:ticketPublicId/actions/:actionPublicId
```

Success:

```text
200 OK
ActionTakenDTO
```

Malformed/missing/cross-parent:

```text
404 NOT_FOUND
```

### 8.2 Edit non-terminal Action

```http
PATCH /api/tickets/:ticketPublicId/actions/:actionPublicId
```

Request:

```json
{
  "description": "Inspect and replace damaged patch cable.",
  "result": "Link is stable after replacement.",
  "followUpRequired": true,
  "followUpNote": "Check switch error counters tomorrow.",
  "attachmentNotes": "Use rack photo and post-replacement link screenshot.",
  "attachmentIds": [
    "2e4c4f78-f875-4e7a-96be-f8ca989ad028",
    "9ad1e5b9-91cc-4c84-83d4-0c4994fd1f73"
  ],
  "expectedVersion": 4
}
```

Authorized actors:

```text
Action creator
OR current Action assignee
OR current Ticket Owner
```

Role must still be `IT_STAFF` or `ADMINISTRATOR`.

Assignment cannot be changed through this endpoint.

On success:

- server normalizes/validates fields;
- diffs Action-Attachment join rows in the same transaction;
- increments `version`;
- updates audit fields;
- appends `ACTION_UPDATED`;
- returns updated DTO.

Success:

```text
200 OK
```

Errors:

```text
400 VALIDATION_ERROR
403 FORBIDDEN
404 NOT_FOUND
409 CONFLICT                    // stale expectedVersion
409 INVALID_ACTION_TRANSITION  // terminal/non-editable state
```

## 9. Assignment API

### 9.1 Assign / reassign / unassign

```http
PATCH /api/tickets/:ticketPublicId/actions/:actionPublicId/assignee
```

Request:

```json
{
  "assignedToUserPublicId": "0b5709b8-6ab7-4db8-b2e4-43caa2f957c4",
  "expectedVersion": 4
}
```

Unassign:

```json
{
  "assignedToUserPublicId": null,
  "expectedVersion": 4
}
```

Role:

```text
IT_STAFF | ADMINISTRATOR
```

Any Staff/Admin with access to the Ticket may perform this mutation; Ticket ownership is not required.

Eligibility:

```text
isActive=true
deleted=false
isSystem=false
role IN (IT_STAFF, ADMINISTRATOR)
```

Inactive/deleted/Requester/SYSTEM/not-found target:

```text
400 VALIDATION_ERROR
details[].field = "assignedToUserPublicId"
```

Stale Action:

```text
409 CONFLICT
```

Terminal Action:

```text
409 INVALID_ACTION_TRANSITION
```

Activity:

```text
null -> user       ACTION_ASSIGNED
user A -> user B   ACTION_REASSIGNED
user -> null       ACTION_UNASSIGNED
```

Success:

```text
200 OK
ActionTakenDTO
```

## 10. Action Lifecycle API

All lifecycle endpoints:

- require authenticated Staff/Admin;
- require `Idempotency-Key`;
- require `expectedVersion`;
- use persistent idempotency before stale-version rejection for completed replay;
- perform Action mutation + Activity in one transaction;
- return the updated Action DTO.

### 10.1 Start

```http
POST /api/tickets/:ticketPublicId/actions/:actionPublicId/start
Idempotency-Key: <uuid>
```

Request:

```json
{
  "expectedVersion": 2
}
```

Preconditions:

```text
status = PLANNED
assignedToUserId != null
actor.userId = assignedToUserId
```

Success mutation:

```text
status = IN_PROGRESS
startedAt = now
version += 1
Activity = ACTION_STARTED
```

Success:

```text
200 OK
```

Unassigned/wrong Action status:

```text
409 INVALID_ACTION_TRANSITION
```

Wrong actor:

```text
403 FORBIDDEN
```

Stale non-replay:

```text
409 CONFLICT
```

### 10.2 Complete

```http
POST /api/tickets/:ticketPublicId/actions/:actionPublicId/complete
Idempotency-Key: <uuid>
```

Request:

```json
{
  "result": "Cable replaced and connection verified.",
  "followUpRequired": false,
  "followUpNote": null,
  "expectedVersion": 3
}
```

Preconditions:

```text
status = IN_PROGRESS
actor = Action assignee OR current Ticket Owner
result valid
follow-up invariant valid
```

Success mutation:

```text
status = COMPLETED
result = normalized request result
followUpRequired = request value
followUpNote = normalized request note
performedByUserId = actor.userId
completedAt = now
version += 1
Activity = ACTION_COMPLETED
```

Success:

```text
200 OK
```

### 10.3 Cancel

```http
POST /api/tickets/:ticketPublicId/actions/:actionPublicId/cancel
Idempotency-Key: <uuid>
```

Request:

```json
{
  "cancellationReason": "No longer required after the upstream fault was corrected.",
  "expectedVersion": 3
}
```

Preconditions:

```text
status IN (PLANNED, IN_PROGRESS)
actor = creator OR Action assignee OR Ticket Owner
```

Success mutation:

```text
status = CANCELLED
cancellationReason = normalized request reason
cancelledAt = now
version += 1
Attachment associations preserved
Activity = ACTION_CANCELLED
```

## 11. Action Attachment Eligibility

Lab 4 adds no `POST /api/tickets/:ticketPublicId/attachments` route for Staff/Admin. Existing Lab 3 Requester upload behavior remains unchanged. Action create/edit may associate only existing Active Attachments belonging to the same Ticket; Pending, removed/deleted, and cross-Ticket Attachments are unavailable. Existing preview/download routes remain authoritative.

## 12. Ticket Activity API

This API implements the explicitly approved narrow auditability decision in `specification.md` §2.1. The handout does not itself require a generic Activity system. Activity covers meaningful Ticket/Action mutations and explicit legacy snapshots; it excludes HTTP/security telemetry, Comments, Internal Notes, Attachment lifecycle/read events, and general event-platform behavior.

### 12.1 Ticket Activity

```http
GET /api/tickets/:ticketPublicId/activity
```

Role:

```text
IT_STAFF | ADMINISTRATOR
```

Query:

```text
filters
sort
pageNumber
pageSize
```

Success:

```text
200 OK
TicketActivityDTO[]
X-Pagination: ...
```

Requester:

```text
403 FORBIDDEN
```

### 12.2 Action-specific Activity

```http
GET /api/tickets/:ticketPublicId/actions/:actionPublicId/activity
```

Role:

```text
IT_STAFF | ADMINISTRATOR
```

The backend validates the Action belongs to the specified Ticket before querying related Activity.

Action Detail UI requests:

```text
sort=createdAt:asc
pageNumber=1
pageSize=10
```

Subsequent Load More increments pageNumber.

No Activity mutation endpoint exists.

## 13. Requester Dashboard API

```http
GET /api/users/me/dashboard?recentTicketsSize=5
```

Role:

```text
REQUESTER
```

Query:

```text
recentTicketsSize
```

Rules:

```text
optional
integer
1 <= value <= 20
default 5
```

Invalid:

```text
400 VALIDATION_ERROR
```

Calculation predicates are fixed by `specification.md` BR-84–BR-90.

The backend runs counts + recent collection in one PostgreSQL `REPEATABLE READ` transaction.

Success:

```text
200 OK
RequesterDashboardDTO
```

The endpoint is not a generic Ticket collection and does not accept Ticket search/filter/sort parameters.

## 14. Staff/Admin Dashboard API

```http
GET /api/dashboard?myActionsSize=5&recentTicketsSize=5&urgentTicketsSize=5
```

Role:

```text
IT_STAFF | ADMINISTRATOR
```

Each parameter:

```text
optional integer 1..20
default 5
```

Calculation rules are fixed by BR-91–BR-102.

`myActions` deduplicates rows satisfying:

```text
assignedToUserId = actor.userId
OR performedByUserId = actor.userId
```

and orders by lifecycle-relevant timestamp descending with deterministic tie-break.

Success:

```text
200 OK
StaffDashboardDTO
```

Counts and all compact lists come from one `REPEATABLE READ` snapshot.

### 14.1 Shared Dashboard refresh and client cache contract

Both Dashboard endpoints retain `Cache-Control: no-store`. The approved client cache is application memory only; it does not enable HTTP browser caching, service-worker caching, localStorage, or sessionStorage.

The client auto-refreshes every 30 seconds and exposes manual Refresh. At most one Dashboard request may be in flight: ignore timer ticks and disable/ignore Refresh while loading, without aborting the active request to start another. Let it finish; subsequent future refreshes may proceed. Pause scheduled refresh when the document is hidden; becoming visible triggers immediate refresh/revalidation and restarts the normal schedule under the same single-flight guard.

Cache the last successful DTO scoped by authenticated User identity, role, and Dashboard URL/list-size query state. Cache age <=30 seconds may render immediately on remount; age >30 seconds may render while immediate revalidation is requested. A previous User/role's data must never render for another User, including late responses after context changes.

Accepted success immediately replaces the displayed DTO and updates `Last updated HH:mm:ss` beside `[Refresh]`. Cache reuse preserves its original success time. Do not re-skeleton existing data or add a persistent "Refreshing..." indicator. Initial failure without successful data shows page-level ErrorState/Retry; background failure retains successful data with a non-destructive warning and Retry. Only accepted success changes Last Updated. See BR-103–BR-112 and `ui-spec.md` §4.

## 15. Assignable User API

The existing endpoint becomes the reusable global User Lookup data source, including Action assignees:

```http
GET /api/users/assignable
```

Role:

```text
IT_STAFF | ADMINISTRATOR
```

Fixed eligibility:

```text
isActive=true
deleted=false
isSystem=false
role IN (IT_STAFF, ADMINISTRATOR)
```

Success:

```text
200 OK
UserSummaryDTO[]
X-Pagination: {"pageNumber":1,"pageSize":10,"totalItems":2,"totalPages":1,"hasPreviousPage":false,"hasNextPage":false}
```

Each item contains `publicId`, `name`, `email`, and `role` (§4.1). Return the bounded array directly, with the existing browser-readable pagination header; no lookup-specific protocol or response envelope is introduced.

Queryable collection rules reuse the current User collection mechanics:

- `search`: trimmed, case-insensitive, at most 200 code points; nonblank search requires `searchFields`.
- `searchFields`: unique comma-separated subset of `name,email`.
- `filters`: URL-encoded JSON array using existing `{ field, condition, value }` expressions; the existing User filter is `role` with `EQUAL` and a valid UserRole, at most one expression. A Requester role filter yields no eligible rows; it never widens fixed eligibility.
- `sort`: `name:asc|desc`, `email:asc|desc`, or `role:asc|desc`; default `name:asc`, with `publicId:asc` tie-break on every order.
- `pageNumber`: positive integer, default 1; `pageSize`: integer 1–100, default 10.
- Unknown query keys, unsupported fields/operators, malformed expressions, and invalid pagination return safe `400 VALIDATION_ERROR`.

Example:

```http
GET /api/users/assignable?search=alex&searchFields=name,email&sort=name:asc&pageNumber=1&pageSize=10
```

The fixed eligibility predicate is ANDed with user queries and applies before pagination/counting. Requesters, inactive/deleted Users, and SYSTEM never appear. Staff/Admin may access this endpoint; Requester access returns `403 FORBIDDEN`. Action mutations independently revalidate eligibility and reject a stale/inactive selected User with `400 VALIDATION_ERROR` on `assignedToUserPublicId` (§9).

The global User definition maps these rows to DataTable columns Name, Email, Role, Action (Select). It exposes no User Management administrative actions. Persisted Unassign is a separate confirmed operation using the existing assignee mutation with null, never a fake User row. Create defaults to the authenticated eligible Staff/Admin and may clear assignment before submission.

This explicitly evolves Lab 3's unpaginated response while preserving existing item fields and adding email. Existing Ticket-owner consumers and affected earlier-lab tests must be adapted to bounded pagination without losing access to eligible users or changing ownership mutation policy.

## 16. Ticket Workflow Evolutions

### 16.1 Administrator parity

Lab 4 modifies the Staff/Admin behavior:

```text
Claim                  IT_STAFF | ADMINISTRATOR
Change IT Priority     IT_STAFF | ADMINISTRATOR
Cancel                 IT_STAFF | ADMINISTRATOR under Staff source-state rule
Action Taken work      IT_STAFF | ADMINISTRATOR under Action rules
Assignable lookup      IT_STAFF | ADMINISTRATOR
Operational dashboard  IT_STAFF | ADMINISTRATOR
```

Owner-only Ticket workflow remains:

```text
Start Work
Request Information
Resume Work
Mark Resolved
Close
```

for both Staff and Admin.

### 16.2 Mark Resolved gate

Before the existing `mark-resolved` update commits, backend checks the Action set for that Ticket in the same transaction/snapshot:

```text
completedNonMigratedCount >= 1
plannedCount = 0
inProgressCount = 0
```

Cancelled count is irrelevant to blocking.

If false:

```text
409 INVALID_STATUS_TRANSITION
```

The frontend may explain the known prerequisite but must not depend on a custom new error code.

### 16.3 Activity append

Ticket workflow operations append appropriate `TicketActivity` rows in the same transaction as their existing Ticket mutation where the action is in BR-65.

Examples:

```text
claim first owner        -> TICKET_ASSIGNED + status child if NEW->OPEN
reassign                 -> TICKET_REASSIGNED
unassign                 -> TICKET_UNASSIGNED
IT priority              -> IT_PRIORITY_CHANGED
start-work               -> TICKET_STARTED_WORK
request-information      -> INFORMATION_REQUESTED
resume-work              -> TICKET_RESUMED
mark-resolved            -> TICKET_MARKED_RESOLVED
close                    -> TICKET_CLOSED
cancel                   -> TICKET_CANCELLED
requester reopen         -> TICKET_REOPENED
```

Public Comment creation during Request Information remains its existing durable record; it is not duplicated as a separate generic comment Activity.

## 17. Idempotency Contract

### 17.1 Header

Required endpoints:

```text
POST /api/tickets/:ticketPublicId/actions
POST /api/tickets/:ticketPublicId/actions/:actionPublicId/start
POST /api/tickets/:ticketPublicId/actions/:actionPublicId/complete
POST /api/tickets/:ticketPublicId/actions/:actionPublicId/cancel
```

require:

```http
Idempotency-Key: <uuid>
```

Missing/malformed key:

```text
400 VALIDATION_ERROR
```

### 17.2 Scope

Persistent uniqueness:

```text
(authenticatedUserId, HTTP method, concrete canonical resource path, Idempotency-Key)
```

HTTP method is uppercase. Resource path includes the actual lowercase Ticket/Action public UUIDs, not route-template placeholders; exclude query parameters and trailing slash. Examples:

```text
POST /api/tickets/<ticketPublicId>/actions
POST /api/tickets/<ticketPublicId>/actions/<actionPublicId>/complete
```

Persistent uniqueness uses all four identity values. Existing Lab 2 Ticket-create records migrate with method `POST` and concrete path `/api/users/me/tickets`.

### 17.3 Request hash

Hash input includes uppercase HTTP method, concrete canonical resource path, and normalized semantic JSON, not raw body bytes.

For lifecycle operations it includes `expectedVersion`. Path UUIDs use canonical lowercase form; query parameters do not affect identity or hash.

### 17.4 Replay

Completed same request:

```text
return prior logical result
do not rerun mutation
do not append another Activity
```

Create first success may be `201`; replay is `200`.

Lifecycle first/replay both return `200`.

### 17.5 Conflict

Same scope/key with a different hash:

```text
409 IDEMPOTENCY_CONFLICT
```

### 17.6 Processing / failure

Existing deterministic PROCESSING timeout/expiry rules remain. A failed transaction must not leave a completed idempotency record pointing at an uncommitted mutation.

## 18. Optimistic Action Concurrency

Mutable endpoints carrying `expectedVersion`:

```text
PATCH Action edit
PATCH Action assignee
POST Start
POST Complete
POST Cancel
```

The mutation condition includes the previously read Action `version` and lifecycle state.

Conceptual update condition:

```text
WHERE
  id = :id
  AND version = :expectedVersion
  AND status = :expectedStatus
```

Successful update increments `version`.

If no row changes after passing initial existence/authorization checks:

```text
409 CONFLICT
```

The service reloads only where needed for the response; it does not silently retry a stale user mutation.

Real PostgreSQL concurrency tests must prove this behavior.

## 19. Migration and Backfill API-Relevant Behavior

### 19.1 Legacy Actions

Existing `RESOLVED`/`CLOSED` Tickets receive a migrated Action with:

```text
status = COMPLETED
isMigrated = true
createdAt = ticket.updatedAt
completedAt = ticket.updatedAt
assignedTo = null
performedBy = null
```

The normal Action read API exposes `isMigrated=true`, allowing UI to label it clearly.
Resolution-gate queries must exclude every Action where `isMigrated=true`; this record is historical/migration context, never proof of new work.

### 19.2 Legacy Activity

Every legacy Ticket gets one:

```text
MIGRATED_TICKET_SNAPSHOT
```

performed by the internal SYSTEM User.

Normal User Management and assignable lookup never return the SYSTEM User.

### 19.3 No fabricated public history

No API may present inferred previous owners/status timestamps as factual legacy events. Only the explicit migration snapshot is returned.

## 20. Validation Summary

| Field | Rule |
|---|---|
| `description` | required, trim, 1–2000 code points |
| `result` | nullable before Complete; trim, 1–2000 when present; required on Complete |
| `followUpRequired` | Boolean |
| `followUpNote` | required 1–2000 iff follow-up true; else null |
| `attachmentNotes` | optional; trim; blank→null; <=2000 |
| `cancellationReason` | required on Cancel; trim; 1–500 |
| `assignedToUserPublicId` | null or eligible active Staff/Admin UUID |
| `attachmentIds` | unique array of existing Active, same-Ticket, not removed/deleted Attachment public IDs |
| `expectedVersion` | positive safe integer matching current Action version |
| Dashboard sizes | integer 1–20 |
| `Idempotency-Key` | UUID |

Validation details use existing safe field-level messages; raw DB/Prisma details never reach the client.

## 21. Authorization Matrix

| Capability | Requester | IT Staff | Administrator |
|---|---:|---:|---:|
| Read Actions on own Ticket | Yes | — | — |
| Read Actions on accessible Ticket | — | Yes | Yes |
| Create Action | No | Yes | Yes |
| Edit non-terminal Action | No | Creator/assignee/Ticket owner | Creator/assignee/Ticket owner |
| Assign/reassign/unassign Action | No | Yes | Yes |
| Start Action | No | Assignee only | Assignee only |
| Complete Action | No | Assignee or Ticket owner | Assignee or Ticket owner |
| Cancel Action | No | Creator/assignee/Ticket owner | Creator/assignee/Ticket owner |
| Read Ticket Activity | No | Yes | Yes |
| Read Action Activity | No | Yes | Yes |
| Requester Dashboard | Own data | No | No |
| Operational Dashboard | No | Yes | Yes |
| Assignable lookup | No | Yes | Yes |
| Claim Ticket | No | Yes | Yes |
| Change IT Priority | No | Yes | Yes |
| Owner-only Ticket workflow | Requester-specific actions only | Ticket owner | Ticket owner |
| Staff-style Ticket Cancel | Existing Requester cancel only | Yes | Yes |

Frontend visibility does not grant authority. Direct API tests must prove the table.

## 22. Error Mapping

Lab 4 expected errors include:

| Scenario | HTTP / code |
|---|---|
| malformed JSON / malformed protocol | 400 `BAD_REQUEST` |
| field/query validation | 400 `VALIDATION_ERROR` |
| no valid auth | existing 401 codes |
| wrong role/actor | 403 `FORBIDDEN` |
| missing/malformed/cross-parent protected resource | 404 `NOT_FOUND` |
| removed Attachment where existing contract applies | 410 `GONE` |
| stale Action version | 409 `CONFLICT` |
| illegal Action lifecycle/state precondition | 409 `INVALID_ACTION_TRANSITION` |
| Ticket status/resolution gate violation | 409 `INVALID_STATUS_TRANSITION` |
| same idempotency key/different request | 409 `IDEMPOTENCY_CONFLICT` |
| file too large | 413 `PAYLOAD_TOO_LARGE` |
| unsupported media type | 415 `UNSUPPORTED_MEDIA_TYPE` |
| unexpected server failure | 500 `INTERNAL_SERVER_ERROR` |

`INVALID_ACTION_TRANSITION` definition:

```json
{
  "statusCode": 409,
  "code": "INVALID_ACTION_TRANSITION",
  "message": "The requested Action Taken operation is not valid in the current state.",
  "error": "Conflict"
}
```

## 23. Transaction Boundaries

The following must be one transaction each:

```text
Action create
  -> idempotency claim/result
  -> Action row
  -> attachment join rows
  -> ACTION_CREATED Activity

Action edit
  -> optimistic check
  -> field update
  -> attachment join diff
  -> ACTION_UPDATED Activity

Action assignee
  -> optimistic check
  -> eligibility recheck
  -> assignment update
  -> assignment Activity

Start/Complete/Cancel
  -> idempotency
  -> optimistic/lifecycle/authorization checks
  -> Action mutation
  -> Activity

Ticket workflow mutation
  -> existing Ticket mutation
  -> required Public Comment where applicable
  -> Lab 4 Activity
  -> resolution-gate checks where applicable
```

Transactions that can conflict under real concurrent writes use the existing project pattern of PostgreSQL-aware isolation and map serialization/retry conflicts to the approved safe conflict code rather than leaking Prisma errors.

## 24. Dashboard Query Isolation

Dashboard endpoints use:

```text
REPEATABLE READ
```

because multiple counts/lists must describe one snapshot.

They do not return full Ticket collections and do not perform unbounded in-memory filtering.

Representative DB-side indexes should support:

```text
Ticket(ownerUserId, currentStatus, ...)
Ticket(currentStatus, itPriority, ...)
Ticket(updatedAt, id)
ActionTaken(assignedToUserId, status, ...)
ActionTaken(performedByUserId, completedAt, ...)
```

Exact final indexes belong to the migration and may be adjusted from query plans without changing API semantics.

## 25. Compatibility and Regression

All prior routes continue to follow Lab 3 contracts unless explicitly evolved here.

Required compatibility checks include:

- existing Requester Ticket create/list/detail;
- existing requester attachments;
- existing Ticket idempotency;
- Ticket-owner selection adapted to the queryable assignable-user response and pagination, preserving ownership mutation rules;
- Staff Queue;
- Staff/Admin Ticket read;
- Public Comments;
- Internal Notes;
- User Management;
- auth/session transport;
- request correlation;
- centralized errors;
- CORS/no-store;
- maintenance cleanup.

The generalized IdempotencyRecord migration must preserve completed Lab 2 Ticket-create records and their replay behavior.

## 26. API Definition of Done

The API contract is complete when:

- every route above exists with the specified role guard;
- DTOs do not expose internal numeric IDs unnecessarily;
- Action lifecycle and version checks are backend-enforced;
- idempotency replay/conflict is deterministic;
- Activity writes are atomic with their business mutations;
- Requester ownership remains fixed on requester-scoped routes;
- Dashboard metrics match the exact business formulas and HTTP remains no-store despite scoped client in-memory reuse;
- assignable-user search/filter/sort/pagination and X-Pagination obey §15, with fixed eligibility and mutation revalidation;
- assignable lookup cannot return ineligible/system users;
- Activity endpoints are unavailable to Requesters;
- all invalid resource relationships fail safely;
- new errors are centralized;
- all prior API regression tests remain green.
