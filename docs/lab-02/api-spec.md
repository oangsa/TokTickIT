# Lab 2 REST API Specification

## 1. Purpose and Scope

This document defines the wire-level REST API contract for TokTickIT Lab 2. It refines the API behavior summarized in `docs/lab-02/specification.md` into exact routes, headers, query parameters, payloads, DTOs, validation behavior, ownership behavior, response statuses, and centralized errors.

The Lab 2 API supports:

- Development Requester bootstrap and requester context;
- active Category and Related System retrieval;
- Ticket creation;
- requester-owned Ticket listing, search, filtering, sorting, and pagination;
- requester-owned Ticket Detail retrieval;
- pending Attachment upload;
- direct Attachment upload to an existing Ticket;
- Attachment metadata retrieval;
- Attachment preview and download;
- batch Attachment cleanup and soft removal; and
- Ticket-creation idempotency.

Real authentication is outside Lab 2. `X-Requester-Id` behaves operationally like the current Requester context/session after Development Requester selection, but it is **not** an authentication credential, authorization token, login session, or security boundary.

---

## 2. API Base Path and Naming Conventions

### 2.1 Base Path

All Lab 2 endpoints use:

```text
/api/v1
```

### 2.2 Resource Paths

The approved API surface is:

```text
GET    /api/v1/requesters
GET    /api/v1/categories
GET    /api/v1/related-systems

GET    /api/v1/tickets
POST   /api/v1/tickets
GET    /api/v1/tickets/:publicId
POST   /api/v1/tickets/:publicId/attachments

POST   /api/v1/attachments
GET    /api/v1/attachments/:storageKey
GET    /api/v1/attachments/:storageKey/preview
GET    /api/v1/attachments/:storageKey/download
DELETE /api/v1/attachments/collection
```

### 2.3 JSON Naming

JSON request and response properties use `camelCase`.

Examples:

```text
publicId
requesterId
relatedSystemId
requestedPriority
createdAt
```

PostgreSQL names remain `snake_case`, and Prisma maps database names to camelCase application properties.

### 2.4 Date and Time Representation

All API timestamps are ISO-8601 UTC strings.

Example:

```json
{
  "createdAt": "2026-08-20T07:30:00.000Z"
}
```

The frontend may format UTC timestamps to `Asia/Bangkok` for display. Ticket Number business-date generation separately uses `Asia/Bangkok` as defined in `specification.md`.

### 2.5 Success Response Style

Successful JSON endpoints return the resource or resource array directly. There is no mandatory `{ "data": ... }` success envelope.

Single-resource example:

```json
{
  "publicId": "2d34a521-00f6-4cff-a276-9ea61cf7853a",
  "ticketNumber": "TKT-20260820-A81F3C9D7B21"
}
```

Collection example:

```json
[
  {
    "id": 1,
    "name": "Hardware"
  },
  {
    "id": 2,
    "name": "Network"
  }
]
```

---

## 3. Common Request Headers

### 3.1 `X-Requester-Id`

`X-Requester-Id` is the temporary Lab 2 Requester context. It behaves operationally like the current Requester session after Requester selection, but it must never be described or implemented as real authentication.

The only bootstrap endpoint that does **not** require `X-Requester-Id` is:

```http
GET /api/v1/requesters
```

Every other Lab 2 endpoint requires it, including master/reference endpoints:

```http
X-Requester-Id: 3
```

The value is the positive integer primary key of the selected Development Requester.

Requester-context validation:

| Condition | Result |
|---|---|
| Header missing | `400 Bad Request` |
| Not an integer | `400 Validation Error` |
| Integer <= 0 | `400 Validation Error` |
| Requester does not exist | `400 Bad Request` |
| Requester is logically deleted | `400 Bad Request` |
| Requester is inactive | `400 Bad Request` |
| Valid Requester accesses another Requester's owned resource | `403 Forbidden` |

`401 Unauthorized` is not used in Lab 2 because real authentication has not been introduced.

### 3.2 `Idempotency-Key`

`POST /api/v1/tickets` requires:

```http
Idempotency-Key: 8e294972-f950-4db7-a83e-d3bbd55a8799
```

The value must be a valid UUID. Missing or malformed values return `400 Bad Request`.

The idempotency scope is:

```text
(requesterId, idempotencyKey)
```

### 3.3 `X-Request-Id`

Clients may send:

```http
X-Request-Id: 4c22442d-e38d-43e5-b957-edc19111d242
```

If the value is a valid UUID, the server reuses it. If it is missing or malformed, the server generates a new UUID instead of failing the request.

Every response, including errors, returns the resolved value:

```http
X-Request-Id: 4c22442d-e38d-43e5-b957-edc19111d242
```

### 3.4 Content Types

JSON requests use:

```http
Content-Type: application/json
```

File upload endpoints use:

```http
Content-Type: multipart/form-data; boundary=...
```

The HTTP client should generate the multipart boundary automatically.

---

## 4. Centralized Error Contract

### 4.1 Error Envelope

All API errors use this structure:

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "The request contains invalid values.",
  "error": "Bad Request",
  "details": [
    {
      "field": "summary",
      "message": "Summary must contain 3-150 characters."
    }
  ]
}
```

`details` is optional and is primarily used for validation errors. Multiple messages for the same field are permitted.

### 4.2 Central Error Codes

The shared error-code set is:

```text
BAD_REQUEST
VALIDATION_ERROR
FORBIDDEN
NOT_FOUND
GONE
CONFLICT
PAYLOAD_TOO_LARGE
UNSUPPORTED_MEDIA_TYPE
INTERNAL_SERVER_ERROR
```

A protocol-specific code may be used when the client must distinguish a special behavior. Lab 2 uses:

```text
IDEMPOTENCY_CONFLICT
```

Resource-specific error-code proliferation such as `TICKET_FORBIDDEN` and `ATTACHMENT_FORBIDDEN` is intentionally avoided.

### 4.3 Standard Errors

#### 400 Bad Request

```json
{
  "statusCode": 400,
  "code": "BAD_REQUEST",
  "message": "The request is invalid.",
  "error": "Bad Request"
}
```

#### 400 Validation Error

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "The request contains invalid values.",
  "error": "Bad Request",
  "details": [
    {
      "field": "pageSize",
      "message": "pageSize must be between 1 and 100."
    }
  ]
}
```

#### 403 Forbidden

```json
{
  "statusCode": 403,
  "code": "FORBIDDEN",
  "message": "You do not have access to this resource.",
  "error": "Forbidden"
}
```

#### 404 Not Found

```json
{
  "statusCode": 404,
  "code": "NOT_FOUND",
  "message": "The requested resource was not found.",
  "error": "Not Found"
}
```

Malformed public route identifiers and valid-but-missing identifiers intentionally use the same `404` response.

#### 409 Conflict

```json
{
  "statusCode": 409,
  "code": "CONFLICT",
  "message": "The requested operation conflicts with the current resource state.",
  "error": "Conflict"
}
```

#### 410 Gone

```json
{
  "statusCode": 410,
  "code": "GONE",
  "message": "This resource is no longer available.",
  "error": "Gone"
}
```

#### 413 Content Too Large

```json
{
  "statusCode": 413,
  "code": "PAYLOAD_TOO_LARGE",
  "message": "The uploaded file exceeds the maximum allowed size of 5 MB.",
  "error": "Content Too Large"
}
```

#### 415 Unsupported Media Type

```json
{
  "statusCode": 415,
  "code": "UNSUPPORTED_MEDIA_TYPE",
  "message": "The attachment file type is not supported.",
  "error": "Unsupported Media Type"
}
```

#### 500 Internal Server Error

```json
{
  "statusCode": 500,
  "code": "INTERNAL_SERVER_ERROR",
  "message": "An unexpected error occurred.",
  "error": "Internal Server Error"
}
```

Stack traces, SQL, Prisma/PostgreSQL internals, database credentials, binary data, and other sensitive implementation information must never be returned to the client.

---

## 5. Shared DTOs

### 5.1 DevelopmentRequesterDTO

```ts
interface DevelopmentRequesterDTO {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
  deleted: boolean;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
}
```

### 5.2 CategoryDTO

```ts
interface CategoryDTO {
  id: number;
  name: string;
  isActive: boolean;
  deleted: boolean;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
}
```

### 5.3 RelatedSystemDTO

```ts
interface RelatedSystemDTO {
  id: number;
  name: string;
  isActive: boolean;
  deleted: boolean;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
}
```

### 5.4 AttachmentDTO

The public Attachment identifier is `attachmentId`, whose value is the generated opaque `storageKey`. The internal numeric primary key is not exposed.

```ts
interface AttachmentDTO {
  attachmentId: string;
  ticketPublicId: string | null;
  originalName: string;
  extension: string;
  mimeType: string;
  sizeBytes: number;
  removalReason: string | null;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  deleted: boolean;
}
```

Binary content is never embedded in this DTO.

### 5.5 TicketDTO

`GET /tickets`, `GET /tickets/:publicId`, and successful Ticket creation share the same DTO. The collection endpoint therefore returns `TicketDTO[]` and includes Attachment metadata for each Ticket.

Related resource data is flattened rather than nested.

Category and Related System metadata in `TicketDTO` is historical Ticket metadata. Existing Tickets continue to resolve and return their related Category and Related System names even if those master records later become inactive or logically deleted. Inactive or logically deleted master records remain excluded from the active reference-data APIs used when creating a new Ticket.

```ts
interface TicketDTO {
  publicId: string;
  ticketNumber: string;

  requesterId: number;
  requesterName: string;
  requesterEmail: string;

  categoryId: number;
  categoryName: string;

  relatedSystemId: number;
  relatedSystemName: string;

  summary: string;
  description: string;
  requestedPriority: "LOW" | "MEDIUM" | "HIGH";
  currentStatus: "NEW";

  attachments: AttachmentDTO[];

  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  deleted: boolean;
}
```

There is no separate `ticketDate` property. `createdAt` is the authoritative Ticket Date.

The Ticket internal numeric primary key is not exposed.

---

## 6. Reference Data APIs

### 6.1 Retrieve Active Development Requesters

```http
GET /api/v1/requesters
```

`X-Requester-Id` is not required because this endpoint bootstraps the Development Requester Selection screen.

The endpoint returns only rows where:

```text
deleted = false
AND isActive = true
```

#### Success

```http
200 OK
```

```json
[
  {
    "id": 1,
    "name": "Alice Johnson",
    "email": "alice.johnson@example.com",
    "isActive": true,
    "deleted": false,
    "createdBy": "seed",
    "createdAt": "2026-08-20T01:00:00.000Z",
    "updatedBy": "seed",
    "updatedAt": "2026-08-20T01:00:00.000Z"
  }
]
```

An empty active set returns:

```http
200 OK
```

```json
[]
```

### 6.2 Retrieve Active Categories

```http
GET /api/v1/categories
X-Requester-Id: 3
```

Returns only:

```text
deleted = false
AND isActive = true
```

#### Success

```http
200 OK
```

```json
[
  {
    "id": 2,
    "name": "Hardware",
    "isActive": true,
    "deleted": false,
    "createdBy": "seed",
    "createdAt": "2026-08-20T01:00:00.000Z",
    "updatedBy": "seed",
    "updatedAt": "2026-08-20T01:00:00.000Z"
  }
]
```

### 6.3 Retrieve Active Related Systems

```http
GET /api/v1/related-systems
X-Requester-Id: 3
```

Returns only:

```text
deleted = false
AND isActive = true
```

#### Success

```http
200 OK
```

```json
[
  {
    "id": 4,
    "name": "VPN",
    "isActive": true,
    "deleted": false,
    "createdBy": "seed",
    "createdAt": "2026-08-20T01:00:00.000Z",
    "updatedBy": "seed",
    "updatedAt": "2026-08-20T01:00:00.000Z"
  }
]
```

---

## 7. Ticket Creation API

### 7.1 Create Ticket

```http
POST /api/v1/tickets
X-Requester-Id: 3
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json
```

### 7.2 Request Body

```json
{
  "categoryId": 4,
  "relatedSystemId": 5,
  "summary": "Cannot connect to campus VPN",
  "requestedPriority": "HIGH",
  "description": "The VPN client fails after entering my credentials.",
  "attachmentIds": [
    "eb87467e-b209-4a18-bbc6-c8c5a4dccf95"
  ]
}
```

`attachmentIds` may be omitted or supplied as an empty array. Both normalize to no initial Attachments.

The client must not submit these backend-managed values:

```text
requesterId
publicId
ticketNumber
currentStatus
createdAt
updatedAt
createdBy
updatedBy
deleted
```

Requester ownership is derived from `X-Requester-Id`. Audit actors are derived by the backend from the selected Requester's email.

### 7.3 Field Validation

| Field | Rule |
|---|---|
| `categoryId` | required positive integer; must identify active, non-deleted Category |
| `relatedSystemId` | required positive integer; must identify active, non-deleted Related System |
| `summary` | required string; trim; 3-150 chars after trim |
| `requestedPriority` | required; `LOW`, `MEDIUM`, or `HIGH` |
| `description` | required string; trim; 10-2000 chars after trim |
| `attachmentIds` | optional array of Attachment storage-key UUIDs; maximum resulting active attachments is five |

Every referenced pending Attachment must:

- exist;
- belong to the current Requester;
- have `ticketId = null`;
- have `deleted = false`;
- not be expired;
- not already be bound to another Ticket.

Ticket creation and pending Attachment binding occur in one database transaction.

### 7.4 Successful First Submission

```http
201 Created
```

The response is one complete `TicketDTO`.

Example:

```json
{
  "publicId": "05a214b4-b957-4ed7-a58e-73f4392b35ec",
  "ticketNumber": "TKT-20260820-A81F3C9D7B21",
  "requesterId": 3,
  "requesterName": "Alice Johnson",
  "requesterEmail": "alice.johnson@example.com",
  "categoryId": 4,
  "categoryName": "Network",
  "relatedSystemId": 5,
  "relatedSystemName": "VPN",
  "summary": "Cannot connect to campus VPN",
  "description": "The VPN client fails after entering my credentials.",
  "requestedPriority": "HIGH",
  "currentStatus": "NEW",
  "attachments": [
    {
      "attachmentId": "eb87467e-b209-4a18-bbc6-c8c5a4dccf95",
      "ticketPublicId": "05a214b4-b957-4ed7-a58e-73f4392b35ec",
      "originalName": "vpn-error.png",
      "extension": "png",
      "mimeType": "image/png",
      "sizeBytes": 281304,
      "removalReason": null,
      "createdBy": "alice.johnson@example.com",
      "createdAt": "2026-08-20T08:10:00.000Z",
      "updatedBy": "alice.johnson@example.com",
      "updatedAt": "2026-08-20T08:14:32.000Z",
      "deleted": false
    }
  ],
  "createdBy": "alice.johnson@example.com",
  "createdAt": "2026-08-20T08:14:32.000Z",
  "updatedBy": "alice.johnson@example.com",
  "updatedAt": "2026-08-20T08:14:32.000Z",
  "deleted": false
}
```

### 7.5 Reused Bound Attachment

Attempting to bind an Attachment that is no longer pending results in:

```http
409 Conflict
```

### 7.6 Ticket Number Generation Failure

Ticket Number collisions are protected by a database unique constraint and a maximum of three generation attempts. Exhausting the bounded retry produces:

```http
500 Internal Server Error
```

using the safe centralized internal-error envelope.

### 7.7 Ticket-Creation Failure and Pending-Attachment Compensation

Pending Attachment cleanup is part of the Ticket-creation failure contract, not a separate business workflow.

For a `4xx` validation/business failure from `POST /api/v1/tickets`:

- the frontend keeps the current form values and valid pending `attachmentIds`;
- it does **not** automatically delete those pending Attachments; and
- an unchanged logical retry reuses the same Idempotency Key. If the user changes the logical payload, including replacing/re-uploading Attachments so that `attachmentIds` changes, the frontend generates a new Idempotency Key before the next create request.

For an unexpected `5xx` Ticket-creation failure:

1. the frontend preserves non-file form values;
2. the frontend performs a best-effort compensation attempt for the pending Attachment IDs associated with that create attempt by calling `DELETE /api/v1/attachments/collection`;
3. compensation items use the original Attachment IDs with `reason: ""` because the client is attempting pending/orphan cleanup, not an Active-Attachment soft removal;
4. if Ticket creation did not commit, those Attachments are still pending and the collection endpoint hard-deletes them, returning `204`; the frontend then marks those file entries as requiring re-upload;
5. if Ticket creation actually committed but the response was lost/ambiguous, the Attachments are already Active. The collection endpoint must not soft-remove them using an empty reason; validation/all-or-nothing semantics protect the bound evidence. The client must not invent a removal reason to force cleanup; and
6. when completion remains ambiguous, the original `POST /api/v1/tickets` may be retried with the same Idempotency Key and unchanged payload. A completed operation is recovered through the normal idempotent `200 OK` replay behavior.

If compensation succeeds and the user re-uploads files, the resulting `attachmentIds` change the logical create payload; the next submission therefore uses a new Idempotency Key.

---

## 8. Ticket Idempotency Contract

### 8.1 Scope

An Idempotency Key is unique within:

```text
(requesterId, key)
```

Two different Requesters may use the same UUID without conflict.

### 8.2 Request Equality

The server hashes a canonical normalized logical request rather than raw JSON bytes.

Normalization includes:

- stable object-property ordering;
- trimmed `summary`;
- trimmed `description`;
- typed numeric IDs;
- normalized enum values; and
- `attachmentIds` in their supplied array order.

Attachment array ordering is preserved and is not sorted during hashing.

### 8.3 Same Key and Same Payload After Completion

A completed retry does not create a second Ticket.

```http
200 OK
```

The same `TicketDTO` is returned.

No `Idempotency-Replayed` response header is required.

### 8.4 Same Key and Different Payload

```http
409 Conflict
```

```json
{
  "statusCode": 409,
  "code": "IDEMPOTENCY_CONFLICT",
  "message": "The Idempotency-Key has already been used with a different request.",
  "error": "Conflict"
}
```

### 8.5 Concurrent Same-Key Same-Payload Request

If a second request arrives while the first identical request is still processing, the second request waits for the in-flight operation instead of immediately returning conflict.

If the first request succeeds:

```text
first request  -> 201 Created
waiting request -> 200 OK with the same TicketDTO
```

If the first request fails, the waiter receives the same failure outcome for that in-flight attempt.

Waiting is bounded by the server's normal HTTP request timeout; no request waits indefinitely.

### 8.6 Concurrent Same-Key Different-Payload Request

A different payload using the same Requester/key is not equivalent to the in-flight request and returns:

```http
409 Conflict
```

with `IDEMPOTENCY_CONFLICT`.

### 8.7 Failed Attempts

`4xx` validation/business failures and `5xx` failures are not stored as permanently completed idempotency results.

A retry may execute validation/business logic again. An unchanged logical retry keeps the same Idempotency Key. If the logical payload is changed after a validation/business failure, the frontend must generate a new Idempotency Key.

### 8.8 Retention

Completed idempotency records are retained for 24 hours and may then be hard-deleted by system cleanup.

---

## 9. Ticket List API

### 9.1 Retrieve My Tickets

```http
GET /api/v1/tickets
X-Requester-Id: 3
```

The endpoint returns only non-deleted Tickets owned by the current Development Requester.

The response body is:

```text
TicketDTO[]
```

The list and detail endpoints intentionally share the same DTO, including Attachment metadata.

### 9.2 Query Parameters

Approved parameters:

| Parameter | Required | Default |
|---|---:|---|
| `search` | conditional | none |
| `searchFields` | required when non-blank `search` is present | none |
| `filters` | no | none |
| `sort` | no | `createdAt:desc` |
| `pageNumber` | no | `1` |
| `pageSize` | no | `10` |

### 9.3 Search

Search syntax:

```http
GET /api/v1/tickets?search=vpn&searchFields=ticketNumber,summary,description
```

`searchFields` is a comma-separated list.

Lab 2 searchable-field whitelist:

```text
ticketNumber
summary
description
```

`search` is trimmed and case-insensitive.

A non-blank `search` requires `searchFields`. Missing `searchFields` returns `400 Validation Error`.

A blank or whitespace-only `search` is treated as absent.

If `searchFields` is supplied without a non-blank `search`, it is ignored.

Search across multiple supplied fields uses logical `OR`:

```text
ticketNumber CONTAINS search
OR summary CONTAINS search
OR description CONTAINS search
```

Unknown or non-whitelisted search fields return `400 Validation Error` when search is active.

### 9.4 Filter Serialization

Filters use one URL-encoded JSON query parameter named `filters`.

Unencoded conceptual value:

```json
[
  {
    "field": "categoryId",
    "condition": "IN",
    "value": [1, 2]
  },
  {
    "field": "requestedPriority",
    "condition": "EQUAL",
    "value": "HIGH"
  }
]
```

Frontend construction example:

```ts
params.set("filters", JSON.stringify(filters));
```

Malformed JSON or a non-array root produces `400 Validation Error`.

An empty array is equivalent to no filters.

### 9.5 Filter Field Whitelist

The generic backend engine supports these Ticket filter fields in Lab 2:

```text
ticketNumber
summary
description
categoryId
relatedSystemId
requestedPriority
currentStatus
createdAt
updatedAt
```

The Lab 2 Requester UI exposes only Category, Related System, Requested Priority, and Current Status, but the backend contract intentionally supports the additional whitelisted fields for future advanced clients.

### 9.6 Filter Conditions

Supported conditions:

```text
CONTAINS
STARTWITH
ENDWITH
EQUAL
NOTEQUAL
GREATER
LESSER
GREATEROREQUAL
LESSEROREQUAL
ISNULL
ISNOTNULL
IN
```

All filter objects require:

```json
{
  "field": "...",
  "condition": "...",
  "value": "..."
}
```

For `ISNULL` and `ISNOTNULL`, `value` is ignored but remains present as an empty string:

```json
{
  "field": "someNullableField",
  "condition": "ISNULL",
  "value": ""
}
```

The current Ticket whitelist contains non-nullable business fields; `ISNULL` or `ISNOTNULL` must be rejected for a field where the schema makes that condition meaningless.

### 9.7 Condition Compatibility

| Field type | Allowed conditions |
|---|---|
| String | `CONTAINS`, `STARTWITH`, `ENDWITH`, `EQUAL`, `NOTEQUAL`, `IN`, `ISNULL`, `ISNOTNULL` when nullable |
| Enum | `EQUAL`, `NOTEQUAL`, `IN`, `ISNULL`, `ISNOTNULL` when nullable |
| Integer/FK | `EQUAL`, `NOTEQUAL`, `GREATER`, `LESSER`, `GREATEROREQUAL`, `LESSEROREQUAL`, `IN`, `ISNULL`, `ISNOTNULL` when nullable |
| DateTime | `EQUAL`, `NOTEQUAL`, `GREATER`, `LESSER`, `GREATEROREQUAL`, `LESSEROREQUAL`, `ISNULL`, `ISNOTNULL` when nullable |

An incompatible field/condition pair is rejected before service/repository execution.

Examples:

```text
summary + CONTAINS             valid
createdAt + GREATER            valid
summary + GREATER              invalid
categoryId + CONTAINS          invalid
```

### 9.8 `IN` Values

`IN` requires a non-empty JSON array.

Valid:

```json
{
  "field": "categoryId",
  "condition": "IN",
  "value": [1, 2, 4]
}
```

```json
{
  "field": "requestedPriority",
  "condition": "IN",
  "value": ["HIGH", "MEDIUM"]
}
```

Invalid:

```json
{
  "field": "categoryId",
  "condition": "IN",
  "value": "1,2,4"
}
```

### 9.9 Query Mapping

After query-shape validation, the backend maps parsed filter values to typed application values before the Ticket service executes.

Examples:

```text
"2" -> number 2 for categoryId
"2026-08-20T00:00:00Z" -> Date for createdAt
"HIGH" -> RequestedPriority.HIGH
```

Failed conversion returns `400 Validation Error` and never reaches Prisma/database query construction.

### 9.10 Filter Logic

Search and filters combine as:

```text
(searchField1 OR searchField2 OR ...)
AND filter1
AND filter2
AND ...
```

Individual filters are not grouped into arbitrary nested `OR` expressions in Lab 2. Multi-value matching uses `IN`.

### 9.11 Sorting

Sort syntax:

```http
?sort=createdAt:desc
```

Allowed directions:

```text
asc
desc
```

Sortable-field whitelist:

```text
createdAt
updatedAt
ticketNumber
summary
requestedPriority
currentStatus
categoryId
relatedSystemId
```

Default ordering:

```text
createdAt DESC
id DESC
```

The internal `id DESC` secondary sort is always used where needed for deterministic pagination but is not exposed as a public sortable field.

Priority ordering is semantic:

```text
requestedPriority:desc -> HIGH, MEDIUM, LOW
requestedPriority:asc  -> LOW, MEDIUM, HIGH
```

Malformed `sort`, unsupported fields, or unsupported directions return `400 Validation Error`.

### 9.12 Pagination

Parameters:

```http
?pageNumber=1&pageSize=20
```

Rules:

```text
pageNumber >= 1
1 <= pageSize <= 100
```

Defaults:

```text
pageNumber = 1
pageSize = 10
```

An out-of-range page is not an error. It returns `200 OK` with an empty array.

### 9.13 Pagination Response Header

Every successful Ticket collection response returns:

```http
X-Pagination: {"pageNumber":1,"pageSize":20,"totalItems":47,"totalPages":3,"hasPreviousPage":false,"hasNextPage":true}
```

Metadata schema:

```ts
interface PaginationMetadata {
  pageNumber: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}
```

Recommended computation:

```text
hasPreviousPage = totalPages > 0 && pageNumber > 1
hasNextPage     = pageNumber < totalPages
```

When `totalItems = 0`, `totalPages = 0` and both booleans are false.

### 9.14 Blank and Invalid Query Values

Approved behavior:

```text
search absent/blank      -> no search
filters absent           -> no filters
sort absent              -> default sort
pageNumber absent        -> 1
pageSize absent          -> 10
```

But explicitly supplied invalid parse values return `400`, for example:

```text
pageNumber=
pageSize=
sort=
filters=not-json
```

---

## 10. Ticket Detail API

### 10.1 Retrieve Owned Ticket

```http
GET /api/v1/tickets/:publicId
X-Requester-Id: 3
```

### 10.2 Success

Owned, non-deleted Ticket:

```http
200 OK
```

Body:

```text
TicketDTO
```

### 10.3 Ownership Failure

A valid current Requester requesting another Requester's Ticket receives:

```http
403 Forbidden
```

### 10.4 Missing, Deleted, or Malformed Route Identifier

All of the following produce the same centralized `404 NOT_FOUND` response:

- valid UUID with no Ticket;
- malformed UUID/path identifier;
- logically deleted Ticket.

This intentionally avoids revealing identifier-validity details through the public route contract.

---

## 11. Attachment Upload APIs

### 11.1 Allowed File Types

Filename extension is the Lab 2 type-validation source of truth.

Allowed normalized extensions:

```text
jpg
jpeg
png
webp
pdf
```

Deep magic-byte/file-signature validation is outside Lab 2.

### 11.2 MIME Mapping

The backend determines MIME type from the approved extension rather than trusting the multipart MIME value as authoritative.

```text
.jpg/.jpeg -> image/jpeg
.png       -> image/png
.webp      -> image/webp
.pdf       -> application/pdf
```

### 11.3 Maximum Size

Maximum file size:

```text
5 MB per file
```

Oversized uploads return `413 Content Too Large`.

### 11.4 Pre-upload Pending Attachment

```http
POST /api/v1/attachments
X-Requester-Id: 3
Content-Type: multipart/form-data
```

One request uploads exactly one file.

Multipart field:

```text
file
```

A successful upload creates a pending Attachment:

```text
ticketId = null
deleted = false
```

A Pending Attachment expires 24 hours after creation if it has not been bound to a Ticket. Expired orphan Attachments may be hard-deleted, including their stored binary data, by system cleanup.

#### Success

```http
201 Created
```

Body:

```json
{
  "attachmentId": "eb87467e-b209-4a18-bbc6-c8c5a4dccf95",
  "ticketPublicId": null,
  "originalName": "vpn-error.png",
  "extension": "png",
  "mimeType": "image/png",
  "sizeBytes": 281304,
  "removalReason": null,
  "createdBy": "alice.johnson@example.com",
  "createdAt": "2026-08-20T08:10:00.000Z",
  "updatedBy": "alice.johnson@example.com",
  "updatedAt": "2026-08-20T08:10:00.000Z",
  "deleted": false
}
```

### 11.5 Add Attachment to Existing Ticket

```http
POST /api/v1/tickets/:publicId/attachments
X-Requester-Id: 3
Content-Type: multipart/form-data
```

Multipart field:

```text
file
```

The backend validates:

- Ticket exists and is non-deleted;
- Ticket belongs to current Requester;
- file extension is allowed;
- file <= 5 MB; and
- resulting active Attachment count does not exceed five.

#### Success

```http
201 Created
```

Body:

```text
AttachmentDTO
```

#### Active Limit Exceeded

```http
409 Conflict
```

#### Cross-owner Ticket

```http
403 Forbidden
```

#### Ticket Missing/Malformed/Deleted

```http
404 Not Found
```

---

## 12. Attachment Metadata and Binary APIs

### 12.1 Retrieve Attachment Metadata

```http
GET /api/v1/attachments/:storageKey
X-Requester-Id: 3
```

The same `AttachmentDTO` representation is used for pending, active, and soft-removed Attachments.

#### Pending Owned Attachment

```http
200 OK
```

#### Active Owned Attachment

```http
200 OK
```

#### Removed Owned Attachment

```http
200 OK
```

The response includes:

```text
deleted = true
removalReason != null
```

#### Cross-owner Attachment

```http
403 Forbidden
```

#### Missing, Hard-deleted, or Malformed Identifier

```http
404 Not Found
```

### 12.2 Preview Attachment

```http
GET /api/v1/attachments/:storageKey/preview
X-Requester-Id: 3
```

Pending and active owned Attachments may be previewed.

Response headers include:

```http
Content-Type: <backend-derived MIME>
Content-Disposition: inline; filename="<safe original filename>"
Content-Length: <binary length>
```

Supported preview targets are JPG/JPEG, PNG, WEBP, and PDF where the browser supports inline rendering.

Removed owned Attachment:

```http
410 Gone
```

Cross-owner Attachment:

```http
403 Forbidden
```

Missing/hard-deleted/malformed identifier:

```http
404 Not Found
```

### 12.3 Download Attachment

```http
GET /api/v1/attachments/:storageKey/download
X-Requester-Id: 3
```

Pending and active owned Attachments may be downloaded.

Response headers include:

```http
Content-Type: <backend-derived MIME>
Content-Disposition: attachment; filename="<safe original filename>"
Content-Length: <binary length>
```

Removed owned Attachment:

```http
410 Gone
```

Cross-owner Attachment:

```http
403 Forbidden
```

Missing/hard-deleted/malformed identifier:

```http
404 Not Found
```

The filename in `Content-Disposition` must be safely encoded/sanitized for HTTP headers. The stored binary is addressed by opaque `storageKey`, not by user-supplied file paths.

---

## 13. Attachment Collection Delete API

### 13.1 Endpoint

Both orphan cleanup and bound Attachment soft removal use the same batch endpoint:

```http
DELETE /api/v1/attachments/collection
X-Requester-Id: 3
Content-Type: application/json
```

The backend determines lifecycle behavior from current persisted state instead of requiring the client to choose a delete mode.

### 13.2 Request Body

```json
{
  "items": [
    {
      "attachmentId": "uuid-a",
      "reason": ""
    },
    {
      "attachmentId": "uuid-b",
      "reason": "Uploaded the wrong document."
    }
  ]
}
```

Schema:

```ts
interface AttachmentDeleteItem {
  attachmentId: string;
  reason: string;
}

interface AttachmentCollectionDeleteRequest {
  items: AttachmentDeleteItem[];
}
```

### 13.3 Collection Validation

Rules:

```text
1 <= items.length <= 100
attachmentId values must be unique inside the request
attachmentId must be valid UUID format
```

An empty array returns `400 Validation Error`.

Duplicate Attachment IDs return `400 Validation Error`.

A malformed Attachment ID in this JSON body is a request validation failure and returns `400`, unlike malformed public route identifiers, which intentionally return `404`.

### 13.4 Lifecycle Determination

For each item, after ownership/state validation:

#### Pending / Orphan Attachment

```text
ticketId = null
deleted = false
```

Behavior:

```text
hard delete Attachment row + binary
reason is ignored and may be ""
```

#### Active Bound Attachment

```text
ticketId != null
deleted = false
```

Behavior:

```text
soft delete only
set deleted = true
store trimmed removalReason
update updatedBy to Requester email
update updatedAt
retain metadata and binary
```

For an active bound Attachment, `reason` is required after trimming and must contain 3-200 characters.

#### Already Removed Attachment

```text
deleted = true
```

The resource is treated as not available for another deletion operation:

```http
404 Not Found
```

### 13.5 Mixed Pending and Active Request

One request may contain both pending and active Attachments.

Example behavior:

```text
A pending -> hard delete
B active  -> soft delete
C pending -> hard delete
```

### 13.6 Ownership

Every item must belong to the current Development Requester, either as the pending-upload owner or through the owned Ticket to which it is bound.

A cross-owner item returns:

```http
403 Forbidden
```

### 13.7 Transaction Semantics

The collection operation is all-or-nothing.

The backend validates the entire request before applying mutations. If any item is invalid, missing, forbidden, already removed, or lacks a required active-removal reason, no item in the batch is modified.

All successful hard-delete and soft-delete mutations are committed in one database transaction.

### 13.8 Success

```http
204 No Content
```

No response body is returned.

---

## 14. Ownership Rules

### 14.1 Ticket Ownership

A Ticket is accessible only when:

```text
ticket.requesterId == X-Requester-Id
```

Cross-owner request:

```http
403 Forbidden
```

### 14.2 Attachment Ownership

Pending Attachment ownership is determined by the Requester who uploaded it.

Bound Attachment ownership is determined by the owning Ticket's Requester.

The backend must enforce ownership on metadata, preview, download, addition, Ticket binding, and collection deletion.

Frontend route protection is not sufficient evidence of ownership enforcement.

### 14.3 Removed Attachment Exception

A removed owned Attachment remains available through the metadata endpoint for historical display but is unavailable through preview/download and cannot be removed again.

---

## 15. HTTP Status Matrix

| Operation / Condition | Status |
|---|---:|
| Successful GET | `200` |
| Successful first Ticket creation | `201` |
| Successful idempotent completed replay | `200` |
| Successful pending Attachment upload | `201` |
| Successful existing-Ticket Attachment upload | `201` |
| Successful Attachment collection delete | `204` |
| Ticket-list page beyond final page | `200` + `[]` |
| Empty active master/reference list | `200` + `[]` |
| Invalid JSON/request structure | `400` |
| Invalid field validation | `400` |
| Missing/invalid/inactive/deleted Requester context | `400` |
| Invalid Ticket-list query/filter/sort/pagination | `400` |
| Malformed UUID inside request JSON | `400` |
| Cross-owner resource access | `403` |
| Missing resource | `404` |
| Malformed public route UUID/storage key | `404` |
| Logically deleted Ticket | `404` |
| Re-delete already removed Attachment | `404` |
| Reuse already-bound pending Attachment | `409` |
| Exceed five active Attachments | `409` |
| Same Idempotency Key with different payload | `409` + `IDEMPOTENCY_CONFLICT` |
| Preview/download removed Attachment | `410` |
| Attachment > 5 MB | `413` |
| Unsupported Attachment extension | `415` |
| Unexpected safe server failure | `500` |
| Ticket Number generation retries exhausted | `500` |

---

## 16. Validation Boundary and Mapping Pipeline

HTTP input must not be passed directly into Prisma query construction.

Approved request pipeline:

```text
HTTP request
  -> route/query/body parser
  -> request-shape validator
  -> field/condition whitelist validator
  -> compatibility validator
  -> query/request mapper
  -> typed application DTO
  -> service/business rules
  -> repository/Prisma
  -> PostgreSQL
```

The mapper performs typed conversion according to approved field metadata. Invalid conversion is rejected before database access.

Unknown request fields, unsupported filter fields, unsupported conditions, invalid enums, invalid date values, and incompatible condition/field pairs are safe client errors rather than raw database errors.

---

## 17. Logging and Error Safety

The API uses centralized request/error handling.

Server-side logging should include:

```text
X-Request-Id
HTTP method
route
response status
central error code
safe contextual identifiers
full internal error for unexpected 5xx diagnostics
```

The server must not log or return:

```text
Attachment binary contents
DATABASE_URL
credentials/secrets
raw sensitive payloads
raw SQL as a public response
stack traces as a public response
```

Database/Prisma errors must be mapped to the centralized public error contract.

---

## 18. Endpoint Summary

| Method | Endpoint | `X-Requester-Id` | Purpose | Success |
|---|---|---:|---|---:|
| GET | `/api/v1/requesters` | No | Bootstrap active Development Requesters | 200 |
| GET | `/api/v1/categories` | Yes | Active Category resources | 200 |
| GET | `/api/v1/related-systems` | Yes | Active Related System resources | 200 |
| GET | `/api/v1/tickets` | Yes | My Tickets query | 200 |
| POST | `/api/v1/tickets` | Yes | Create Ticket | 201 / replay 200 |
| GET | `/api/v1/tickets/:publicId` | Yes | Owned Ticket Detail | 200 |
| POST | `/api/v1/tickets/:publicId/attachments` | Yes | Add Attachment to existing Ticket | 201 |
| POST | `/api/v1/attachments` | Yes | Pre-upload pending Attachment | 201 |
| GET | `/api/v1/attachments/:storageKey` | Yes | Attachment metadata | 200 |
| GET | `/api/v1/attachments/:storageKey/preview` | Yes | Inline binary preview | 200 |
| GET | `/api/v1/attachments/:storageKey/download` | Yes | Attachment download | 200 |
| DELETE | `/api/v1/attachments/collection` | Yes | Hard-delete pending / soft-remove active batch | 204 |

---

## 19. Representative Requests

### 19.1 My Tickets with Search, Filter, Sort, and Pagination

Conceptual filters before URL encoding:

```json
[
  {
    "field": "categoryId",
    "condition": "IN",
    "value": [1, 2]
  },
  {
    "field": "requestedPriority",
    "condition": "EQUAL",
    "value": "HIGH"
  }
]
```

Request concept:

```http
GET /api/v1/tickets?search=vpn&searchFields=ticketNumber,summary,description&filters=<URL_ENCODED_JSON>&sort=createdAt:desc&pageNumber=1&pageSize=20
X-Requester-Id: 3
```

Response:

```http
200 OK
X-Pagination: {"pageNumber":1,"pageSize":20,"totalItems":4,"totalPages":1,"hasPreviousPage":false,"hasNextPage":false}
X-Request-Id: 7af44238-c13f-4b77-b9c8-a3cf5272a99f
```

```json
[
  {
    "publicId": "05a214b4-b957-4ed7-a58e-73f4392b35ec",
    "ticketNumber": "TKT-20260820-A81F3C9D7B21",
    "requesterId": 3,
    "requesterName": "Alice Johnson",
    "requesterEmail": "alice.johnson@example.com",
    "categoryId": 4,
    "categoryName": "Network",
    "relatedSystemId": 5,
    "relatedSystemName": "VPN",
    "summary": "Cannot connect to campus VPN",
    "description": "The VPN client fails after entering my credentials.",
    "requestedPriority": "HIGH",
    "currentStatus": "NEW",
    "attachments": [],
    "createdBy": "alice.johnson@example.com",
    "createdAt": "2026-08-20T08:14:32.000Z",
    "updatedBy": "alice.johnson@example.com",
    "updatedAt": "2026-08-20T08:14:32.000Z",
    "deleted": false
  }
]
```

### 19.2 Create Ticket with Pending Attachment IDs

```http
POST /api/v1/tickets
X-Requester-Id: 3
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json
```

```json
{
  "categoryId": 4,
  "relatedSystemId": 5,
  "summary": "Cannot connect to campus VPN",
  "requestedPriority": "HIGH",
  "description": "The VPN client fails after entering my credentials.",
  "attachmentIds": [
    "eb87467e-b209-4a18-bbc6-c8c5a4dccf95"
  ]
}
```

### 19.3 Delete Mixed Pending and Active Attachments

```http
DELETE /api/v1/attachments/collection
X-Requester-Id: 3
Content-Type: application/json
```

```json
{
  "items": [
    {
      "attachmentId": "e3bb4607-fd10-447a-a4fc-26f2529a9270",
      "reason": ""
    },
    {
      "attachmentId": "eb87467e-b209-4a18-bbc6-c8c5a4dccf95",
      "reason": "Uploaded the wrong screenshot."
    }
  ]
}
```

If the first is still pending, it is hard-deleted. If the second is active and bound to an owned Ticket, it is soft-removed. Both changes commit together or neither change is applied.

---

## 20. Lab 3 Transition Note

`X-Requester-Id` exists only to simulate the current Requester context in Lab 2. The REST resource design, public Ticket/Attachment identifiers, ownership checks, audit fields, and centralized errors are intended to remain reusable when Lab 3 introduces real authentication.

When authentication is introduced, the backend should derive Requester identity from the authenticated principal instead of trusting a client-provided Requester context header. Lab 2 must not represent the current header as secure authentication before that migration occurs.
