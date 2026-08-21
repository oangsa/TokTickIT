# Lab 2 REST API Specification

## 1. Purpose and Scope

This document defines the wire-level REST API contract for TokTickIT Lab 2. It refines the API behavior summarized in `docs/lab-02/specification.md` into exact routes, headers, query parameters, payloads, DTOs, validation behavior, ownership behavior, response statuses, and centralized errors.

The Lab 2 API supports:

- Development Requester bootstrap and requester context;
- active Category and Related System retrieval;
- Ticket creation;
- requester-owned Ticket listing, search, filtering, sorting, and pagination;
- requester-owned Ticket Detail retrieval;
- Pending Attachment pre-upload for initial Ticket creation;
- direct Attachment upload to an existing Ticket after creation;
- Attachment metadata retrieval;
- Attachment preview and download;
- batch Pending cleanup and Active soft removal; and
- Ticket-creation idempotency.

Real authentication is outside Lab 2. `X-Requester-Id` behaves operationally like the current Requester context/session after Development Requester selection, but it is **not** an authentication credential, authorization token, login session, or security boundary.

This is a production-oriented Lab 2 contract, not a production-ready deployment contract. While identity remains unauthenticated, the application is restricted to development/test networks, uses synthetic Requester identities only, and must not be exposed publicly.

---

## 2. API Base Path and Naming Conventions

### 2.1 Base Path

All Lab 2 endpoints use:

```text
/api
```

### 2.2 Resource Paths

The approved API surface is:

```text
GET    /api/requesters
GET    /api/categories
GET    /api/related-systems

GET    /api/tickets
POST   /api/tickets
GET    /api/tickets/:publicId
POST   /api/tickets/:publicId/attachments

POST   /api/attachments
GET    /api/attachments/:storageKey
GET    /api/attachments/:storageKey/preview
GET    /api/attachments/:storageKey/download
DELETE /api/attachments/collection
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
GET /api/requesters
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
| Valid Requester requests a resource outside their requester scope | `404 Not Found`, indistinguishable from unavailable |

`401 Unauthorized` is not used in Lab 2 because real authentication has not been introduced.

### 3.2 `Idempotency-Key`

`POST /api/tickets` requires:

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

### 3.4 CORS Request and Response Headers

CORS origins use exact scheme/host/port matching from the environment-configured `CORS_ALLOWED_ORIGINS` list. Wildcard origins are prohibited. The documented local Vite origin is permitted in development; outside development/test, missing or invalid allowlist configuration fails server startup. Requests without an `Origin` header continue normally because CORS is browser-origin hardening, not API authentication, authorization, or a privacy boundary.

The CORS policy explicitly permits these Lab 2 request headers and must not rely only on framework defaults:

```http
Access-Control-Allow-Headers: Content-Type, X-Requester-Id, Idempotency-Key, X-Request-Id
```

Browser JavaScript must be able to read Ticket pagination and request-correlation headers. Applicable CORS responses therefore expose:

```http
Access-Control-Expose-Headers: X-Pagination, X-Request-Id
```

### 3.5 Content Types

JSON requests use:

```http
Content-Type: application/json
```

File upload endpoints use:

```http
Content-Type: multipart/form-data; boundary=...
```

The HTTP client should generate the multipart boundary automatically.

Express accepts JSON bodies up to exactly `131,072` bytes. A larger JSON body returns `413 PAYLOAD_TOO_LARGE`; malformed JSON within the limit returns `400 BAD_REQUEST`; a syntactically/structurally parseable body with invalid fields returns `400 VALIDATION_ERROR`. Multipart parsing uses its own limits.

### 3.6 Cache Variation and Storage

Every requester-scoped Lab 2 response, including representative errors and binary responses, includes:

```http
Cache-Control: no-store
Vary: Origin, X-Requester-Id
```

Middleware must merge `Vary` values rather than overwrite values already applied by CORS. `GET /api/requesters` also uses `Cache-Control: no-store` because it returns the full synthetic Requester DTO.

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
SERVICE_UNAVAILABLE
```

A protocol-specific code may be used when the client must distinguish a special behavior. Lab 2 uses:

```text
IDEMPOTENCY_CONFLICT
```

Resource-specific error-code proliferation is intentionally avoided. `FORBIDDEN` remains available for future/non-ownership authorization failures, but Lab 2 requester-owned Ticket/Attachment scope failures use centralized `NOT_FOUND`.

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

Malformed public route identifiers, valid-but-missing identifiers, and requester-owned resources outside the current Requester's scope intentionally use the same `404` response.

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
  "message": "The uploaded file exceeds the maximum allowed size of 5,242,880 bytes.",
  "error": "Content Too Large"
}
```

For an oversized JSON body, the same code/status uses safe generic copy stating that the request body exceeds the allowed size rather than claiming a file exceeded the Attachment limit.

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

#### 503 Service Unavailable

```json
{
  "statusCode": 503,
  "code": "SERVICE_UNAVAILABLE",
  "message": "The service is temporarily unable to complete the request.",
  "error": "Service Unavailable"
}
```

This status is used when bounded serialization/deadlock retries are exhausted. The response may include `Retry-After: 1`.

---

## 5. Shared DTOs

### 5.1 DevelopmentRequesterDTO

Lab 2 deliberately retains the full resource DTO for `GET /api/requesters` consistency. Because that endpoint is unauthenticated, every returned identity must be synthetic development/test data. Real identifiable or production personal data is prohibited until a future authenticated/authorized endpoint or reconsidered public projection is approved.

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

Lifecycle is represented without a separate status column:

```text
Pending -> ticketPublicId = null, deleted = false
Active  -> ticketPublicId = owning Ticket publicId, deleted = false
Removed -> ticketPublicId = owning Ticket publicId, deleted = true
```

### 5.5 TicketDTO

Successful Ticket creation and `GET /tickets/:publicId` return the full `TicketDTO`. `GET /tickets` uses the separate `TicketListItemDTO` projection defined below.

Related resource data is flattened rather than nested.

Category and Related System metadata in `TicketDTO` is historical Ticket metadata. Existing Tickets continue to resolve and return their related Category and Related System names even if those master records later become inactive or logically deleted. Inactive or logically deleted master records remain excluded from the active reference-data APIs used for a new Ticket-create attempt.

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

### 5.6 TicketListItemDTO

`GET /api/tickets` returns this bounded list projection:

```ts
interface TicketListItemDTO {
  publicId: string;
  ticketNumber: string;

  categoryId: number;
  categoryName: string;

  relatedSystemId: number;
  relatedSystemName: string;

  summary: string;

  requestedPriority: "LOW" | "MEDIUM" | "HIGH";
  currentStatus: "NEW";

  createdAt: string;
}
```

The list projection intentionally excludes `description`, all Requester fields, `attachments`, `createdBy`, `updatedBy`, `updatedAt`, and `deleted`. Backend search may still match `description`; omission from the response does not remove it from the approved search whitelist. Historical Category and Related System names continue to resolve for existing list items even when those master records later become inactive or logically deleted.

---

## 6. Reference Data APIs

### 6.1 Retrieve Active Development Requesters

```http
GET /api/requesters
```

`X-Requester-Id` is not required because this endpoint bootstraps the Development Requester Selection screen.

The response uses the full `DevelopmentRequesterDTO` but may contain only synthetic development/test identities. CORS origin restriction does not make this data private or authenticated.

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
GET /api/categories
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
GET /api/related-systems
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
POST /api/tickets
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

`attachmentIds` is optional; omission and `[]` both mean no initial Attachments. It contains the final set of successfully prepared Pending Attachment storage-key UUIDs selected for this logical create request. Files themselves are not accepted by this endpoint.

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

### 7.3 Request and New-Attempt Validation

| Field | Rule |
|---|---|
| `categoryId` | required positive integer; must identify active, non-deleted Category |
| `relatedSystemId` | required positive integer; must identify active, non-deleted Related System |
| `summary` | required string; trim; 3-150 chars after trim |
| `requestedPriority` | required; `LOW`, `MEDIUM`, or `HIGH` |
| `description` | required string; trim; 10-2000 chars after trim |
| `attachmentIds` | optional array; at most five valid UUID/storage keys; duplicates rejected; normalized and sorted as an unordered logical set |

Syntactic validation required for canonicalization occurs before idempotency resolution. The server then computes the approved canonical SHA-256 hash and resolves, establishes, or atomically reclaims the unique idempotency claim. Only the winner of a new or reclaimed `PROCESSING` claim may continue. After `IDEMPOTENCY-FENCING-A` locks and verifies the claim inside the resource transaction, the final authoritative mutable check requires each referenced Attachment to exist in the current Requester scope, be Pending (`ticketId = null`, `deleted = false`), unexpired, unbound, and within the five-Attachment limit. Cross-scope/unavailable IDs return the same safe `404`; an owned Attachment that is no longer Pending/bindable returns `409 Conflict`.

After claim ownership and mutable validation, one database transaction creates the Ticket, persists/collision-checks its Ticket Number, revalidates/locks referenced Pending rows in deterministic sorted-ID order where practical, binds all referenced rows, applies relevant audit updates, and transitions the owned claim to `COMPLETED` with `ticketId`, `completedAt`, and `expiresAt`. Success leaves the Ticket and all referenced Attachments Active; failure leaves no Ticket or partial binding from that attempt. No Ticket creation or Attachment mutation may occur before claim ownership. Deterministic ordering reduces inconsistent lock ordering but is not claimed to prevent every PostgreSQL deadlock.

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

### 7.5 Reused or Non-bindable Attachment

For a new attempt, an owned Attachment that is already bound, expired, deleted, or otherwise no longer Pending/bindable returns:

```http
409 Conflict
```

### 7.6 Ticket Number Generation Failure

Ticket Number collisions are protected by a database unique constraint and a maximum of three generation attempts. Exhausting the bounded retry produces:

```http
500 Internal Server Error
```

using the safe centralized internal-error envelope.

### 7.7 Ticket-Creation Failure and Pending-Attachment Recovery

For a `4xx` validation/business failure from `POST /api/tickets`:

- the frontend keeps current Ticket fields and valid Pending Attachments;
- it does not automatically delete those Pending Attachments; and
- an unchanged canonical logical retry reuses the same Idempotency Key. Changing any logical field or the normalized Attachment-ID set uses a new key.

For an unexpected `5xx` Ticket-creation failure:

1. preserve non-file Ticket fields and the IDs associated with that attempt;
2. perform best-effort Pending cleanup through `DELETE /api/attachments/collection` using the original IDs and empty reasons, without inventing Active-removal reasons;
3. if the create did not commit, those rows remain Pending and may be hard-deleted, after which their file entries require Retry Upload;
4. if the create committed but the response was lost, the rows are already Active. Empty-reason Active validation and all-or-nothing semantics must prevent cleanup from soft-removing that Ticket evidence; and
5. when completion is ambiguous, retry the unchanged original `POST /api/tickets` with the same key. Completed replay returns `200` with the existing Ticket and Active Attachments, without re-upload.

If cleanup succeeds and files are re-uploaded, the resulting Attachment-ID set changes the logical payload and the next submission uses a new key.

---

## 8. Ticket Idempotency Contract

### 8.1 Scope

An Idempotency Key is unique within:

```text
(requesterId, key)
```

Two different Requesters may use the same UUID without conflict.

### 8.2 Request Equality

The server hashes a canonical normalized logical request rather than raw JSON bytes. The exact Lab 2 algorithm is:

```text
canonical normalized logical request
-> UTF-8 bytes
-> SHA-256
-> lowercase hexadecimal
```

The result is exactly 64 lowercase hexadecimal characters stored in `request_hash VARCHAR(128)`. The wider physical column intentionally permits a future algorithm migration, but the Lab 2 algorithm is not implementation-defined.

Normalization includes:

- stable object-property ordering;
- trimmed `summary`;
- trimmed `description`;
- typed numeric IDs;
- normalized enum values; and
- `attachmentIds` after UUID validation, normalization, duplicate rejection, and deterministic sorting.

Examples:

```text
same Requester + same key + same fields + [A,B] or [B,A] -> same canonical payload
same Requester + same key + same fields + [A,C] -> IDEMPOTENCY_CONFLICT
[A,A] -> 400 validation error, never silent deduplication
```

#### 8.2.1 Authoritative Processing Order

Ticket-create processing occurs in this order:

1. parse the request;
2. validate JSON structure, field types, enum syntax, and other rules needed for canonicalization;
3. normalize/canonicalize the logical payload;
4. compute the request hash;
5. resolve or establish the unique `(requesterId, Idempotency-Key)` claim;
6. handle `PROCESSING` or `COMPLETED` replay/conflict according to the contract below;
7. the winner retains the exact `processingStartedAt` representing its lease and enters the `IDEMPOTENCY-FENCING-A` transaction: lock the claim row and verify `status = PROCESSING`, the expected `requestHash`, and exact expected `processingStartedAt`; and
8. while retaining that lock, perform final mutable Category, Related System, and Pending-Attachment validation, create the Ticket, bind all referenced Pending Attachments, transition the claim to `COMPLETED`, and commit or roll back as one transaction.

For a new `(requesterId, key)`, the server first inserts:

```text
requester_id = current Requester
key = validated Idempotency-Key UUID
request_hash = approved SHA-256 lowercase-hex hash
status = PROCESSING
processing_started_at = current server/database time
ticket_id = null
completed_at = null
expires_at = null
```

The unique `(requester_id, key)` constraint determines which concurrent request owns the operation. Establishing that ownership precedes mutable validation, Ticket creation, and Attachment mutation.

Resolution behavior:

| Idempotency state | Hash relation | Result |
|---|---|---|
| fresh `PROCESSING` (`now < processingStartedAt + 5 minutes`) | same | Wait within the existing bounded/normal request-timeout behavior, then resolve the completed result if it becomes available; never start a second operation. |
| fresh `PROCESSING` | different | `409 IDEMPOTENCY_CONFLICT` without waiting for mutable state or performing mutation. |
| stale `PROCESSING` (`now >= processingStartedAt + 5 minutes`) | same | Attempt an atomic in-place reclaim. The single winner resets `processingStartedAt = now` and retries the operation after rerunning mutable validation; losing contenders refetch and follow normal fresh-Processing wait or completed-replay behavior. |
| stale `PROCESSING` | different | `409 IDEMPOTENCY_CONFLICT`; do not update or delete the claim to let the new payload use the key. |
| `COMPLETED` and `now < expiresAt` | same | Resolve stored `ticketId` and return a freshly reconstructed current `TicketDTO` with `200`; do not re-run mutable Category, Related System, or Pending-Attachment validation. |
| `COMPLETED` and `now < expiresAt` | different | `409 IDEMPOTENCY_CONFLICT` |
| `COMPLETED` and `now >= expiresAt` | any | Atomically lock and remove/replace the expired row, then allow the Requester/key to establish a new `PROCESSING` claim without a false unique-key conflict. |
| no claim | n/a | Insert the unique `PROCESSING` claim; only its owner continues to mutable validation and creation. |

Only a new or reclaimed `PROCESSING` owner that passes `IDEMPOTENCY-FENCING-A` validates that Category and Related System currently exist and are active/non-deleted and that every referenced Attachment is currently Pending/bindable. This final mutable validation runs inside the same transaction, after the claim row is locked and ownership is verified, and reclaim always reruns it. A completed same-hash replay is resolved before all current mutable-state validation because the original Pending Attachments became Active on success.

The database permits only these claim states:

```text
PROCESSING -> processing_started_at is non-null
              ticket_id/completed_at/expires_at are all null
COMPLETED  -> processing_started_at is non-null
              ticket_id/completed_at/expires_at are all non-null
              and expires_at = completed_at + 24 hours
```

No persistent `FAILED` state exists.

### 8.3 Same Key and Same Payload After Completion

A completed retry before logical expiry does not create a second Ticket. A Category/System may later become inactive/deleted and referenced Pending Attachments become Active on original commit; those mutable changes do not invalidate a completed same-hash replay.

```http
200 OK
```

The server resolves the stored `ticketId` and returns a freshly reconstructed current `TicketDTO` for the same Ticket creation identity without re-running mutable Category/System/Pending-Attachment validation. Later Attachment additions/removals may appear in that representation. Hash comparison continues to use only the normalized original create-request fields, including its original normalized `attachmentIds`, and never incorporates later resource mutations.

No `Idempotency-Replayed` response header is required.

### 8.4 Same Key and Different Normalized Payload

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

### 8.5 Concurrent Requests

The database uniqueness constraint on `(requesterId, key)` prevents concurrent requests from owning duplicate new attempts. The winner establishes `PROCESSING` before final mutable validation or mutation and retains the exact `processingStartedAt` lease value. A losing fresh same-hash request follows the bounded wait behavior and resolves the winner's completed record as `200`; a losing different-hash request returns `409 IDEMPOTENCY_CONFLICT`. Neither loser creates a Ticket or mutates an Attachment.

`PROCESSING_STALE_AFTER` is exactly five minutes. Freshness uses `now < processingStartedAt + 5 minutes`; stale begins at exact equality. For a stale same-hash claim, reclaim is an atomic conditional update equivalent to:

```sql
UPDATE idempotency_record
SET processing_started_at = :now,
    updated_at = :now,
    updated_by = :actor
WHERE requester_id = :requester_id
  AND key = :key
  AND status = 'PROCESSING'
  AND request_hash = :request_hash
  AND processing_started_at <= :now - INTERVAL '5 minutes'
RETURNING id;
```

The single returned row identifies the reclaim owner and its returned `processing_started_at` is that owner's exact lease/fencing value. PostgreSQL row locking and predicate re-evaluation ensure that two concurrent retries cannot both reclaim: after one update resets the lease, the other update returns no row, refetches authoritative state, and follows normal same-hash fresh-`PROCESSING` wait or `COMPLETED` replay behavior. A stale claim is updated in place, never deleted to permit a new payload under the same key.

#### 8.5.1 `IDEMPOTENCY-FENCING-A`

Before any Ticket or Attachment mutation, every new or reclaimed owner enters the same database transaction that will perform final mutable-state validation, Ticket creation, Pending-Attachment binding, and the `PROCESSING -> COMPLETED` transition. It locks the idempotency claim row using `SELECT ... FOR UPDATE` or an equivalent exclusive row lock and verifies all ownership values:

```text
status = PROCESSING
request_hash = owner's expected requestHash
processing_started_at = owner's exact retained processingStartedAt
```

The claim-row lock remains held through transaction commit or rollback. While it is held, a stale conditional reclaim targeting that row must wait and cannot complete. Two outcomes are valid:

- If the ownership values match, the current owner keeps the lock, performs final mutable Category/System/Pending-Attachment validation, creates/binds resources, updates the claim to `COMPLETED`, and commits atomically.
- If any ownership value differs, the old owner performs no final mutable validation with side effects and no Ticket/Attachment mutation, releases the transaction through rollback/clean exit, then returns to normal same-hash `PROCESSING` wait or `COMPLETED` replay resolution.

If the original owner obtains and holds the lock first, a reclaim waits and re-evaluates after that transaction finishes. If a stale retry reclaims first, the original owner's retained `processingStartedAt` no longer matches and fences it out before mutation. Thus an original slow owner cannot commit after its lease has been reclaimed. No persistent `FAILED` state is introduced.

### 8.6 Failed Attempts

`4xx` validation/business failures and confirmed `5xx` failures are not stored as completed idempotency results. A controlled failure removes the owned `PROCESSING` claim when it is safe to confirm that the Ticket/binding transaction did not commit; it never creates a persistent `FAILED` state.

A retry may execute validation/business logic again. An unchanged normalized logical retry keeps the same Idempotency Key. If the normalized logical payload is changed after a validation/business failure, the frontend must generate a new Idempotency Key.

If the server/process crashes after the claim is committed but before `COMPLETED`, the abandoned `PROCESSING` claim must have no committed Ticket or Attachment mutation. At five minutes it becomes eligible for same-hash atomic reclaim under Section 8.5. A stale claim cannot be reclaimed while a resource transaction currently holds its claim-row lock. If the original owner later resumes after a completed reclaim, Section 8.5.1 fences its old lease before mutation. Different-hash requests continue to conflict, and no persistent `FAILED` state is introduced.

### 8.7 Retention

For a successful operation, the server transitions the owned claim to `COMPLETED`, records `ticketId`/`completedAt`, and sets `expiresAt = completedAt + 24 hours`. Replay/conflict behavior applies only while `now < expiresAt`. At exact equality and afterward, the completed row is logically expired even when physical cleanup has not yet deleted it; the same Requester/key may represent a new operation. Idempotency resolution locks and atomically removes/replaces that expired `COMPLETED` row before establishing a new unique `PROCESSING` claim. Concurrent reuse and cleanup must resolve to one safe claimant without a false uniqueness error or duplicate Ticket creation. This 24-hour completed-result policy is separate from the five-minute `PROCESSING` lease: completed rows use `expiresAt`; Processing rows use `processingStartedAt` and are reclaimed only by same-hash request-time resolution.

The frontend uses a conservative automatic-retry deadline measured from initial client key creation and never automatically reuses that key at or after 24 hours. A later attempt requires explicit user submission and a new key.

---

## 9. Ticket List API

### 9.1 Retrieve My Tickets

```http
GET /api/tickets
X-Requester-Id: 3
```

The endpoint returns only non-deleted Tickets owned by the current Development Requester.

The response body is:

```text
TicketListItemDTO[]
```

Description remains searchable but is not returned. List items contain only the fields defined by `TicketListItemDTO`; in particular, they do not include Description, Requester fields, Attachment history, or audit/lifecycle-only fields.

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
GET /api/tickets?search=vpn&searchFields=ticketNumber,summary,description
```

`searchFields` is a comma-separated list.

Lab 2 searchable-field whitelist:

```text
ticketNumber
summary
description
```

`search` is trimmed and case-insensitive.

The trimmed `search` value contains at most 200 characters. `searchFields` values must be unique and must remain within the resource whitelist.

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

At most 20 filter expressions are accepted in one request.

### 9.5 Filter Field Whitelist

The Ticket resource validator owns this Lab 2 field whitelist:

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

The shared/global QueryBuilder may be capable of constructing expressions for a broader generic field/operator vocabulary, but that capability does not expand the Ticket whitelist. The Lab 2 Requester UI exposes only Category, Related System, Requested Priority, and Current Status for good UX; direct API clients remain subject to the Ticket validator.

### 9.6 Generic QueryBuilder Condition Vocabulary

The reusable/global QueryBuilder may generically support these conditions:

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

This nullable-field example describes generic QueryBuilder input only; no current Lab 2 Ticket filter field is nullable.

Generic QueryBuilder support does not mean every Ticket field may use every condition. The Ticket-specific compatibility matrix in the next section is authoritative.

### 9.7 Ticket Condition Compatibility Matrix

| Ticket field(s) | Field category | Allowed conditions |
|---|---|---|
| `ticketNumber`, `summary`, `description` | String | `CONTAINS`, `STARTWITH`, `ENDWITH`, `EQUAL`, `NOTEQUAL`, `IN` |
| `categoryId`, `relatedSystemId` | Reference/FK | `EQUAL`, `NOTEQUAL`, `IN` |
| `requestedPriority`, `currentStatus` | Enum | `EQUAL`, `NOTEQUAL`, `IN` |
| `createdAt`, `updatedAt` | DateTime | `EQUAL`, `NOTEQUAL`, `GREATER`, `LESSER`, `GREATEROREQUAL`, `LESSEROREQUAL` |

The Ticket validator also owns typed value conversion, nullable/non-nullable compatibility, enum-value validation, `IN` array-shape and element validation, and the `ticketNumber`, `summary`, and `description` search-field whitelist. The current Ticket whitelist has no nullable filter fields, so `ISNULL` and `ISNOTNULL` are generic QueryBuilder capabilities but are not valid Ticket filter operations in Lab 2. An incompatible or otherwise disallowed Ticket field/condition pair is rejected with `400 Validation Error` before QueryBuilder/Prisma data-access execution.

Examples:

```text
summary + CONTAINS             valid
createdAt + GREATER            valid
summary + GREATER              invalid
categoryId + CONTAINS          invalid
```

### 9.8 `IN` Values

`IN` requires a JSON array containing 1-100 unique values. Every value must pass the resource field's typed conversion and enum/reference/string rules.

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

After Ticket-specific query-shape and permission validation, the backend maps parsed filter values to typed application values before the Ticket service executes. The QueryBuilder receives only those validated/typed values and does not own Ticket permissions, Requester ownership, `deleted = false`, semantic Priority ordering, Ticket-specific conversions/business rules, or pagination.

Examples:

```text
"2" -> number 2 for categoryId
"2026-08-20T00:00:00Z" -> Date for createdAt
"HIGH" -> RequestedPriority.HIGH
```

Failed conversion returns `400 Validation Error` and never reaches Prisma/database query construction.

Search/filter count and `IN` cardinality limits are enforced by the Ticket query validator before QueryBuilder or Prisma execution.

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
Access-Control-Expose-Headers: X-Pagination, X-Request-Id
```

The CORS exposure requirement makes both `X-Pagination` and `X-Request-Id` readable by browser JavaScript.

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
GET /api/tickets/:publicId
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

### 10.3 Unavailable in Current Requester Scope

A valid current Requester requesting another Requester's Ticket receives the same response as an unavailable Ticket:

```http
404 Not Found
```

The response does not disclose owner identity, cross-owner existence, or protected Ticket data.

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
MAX_ATTACHMENT_BYTES = 5,242,880 bytes per file (5 x 1024 x 1024)
```

Oversized uploads return `413 Content Too Large`.

The exact constant is shared by frontend validation, multipart parsing, backend validation, PostgreSQL checks, documentation, and tests. PostgreSQL also enforces `size_bytes = octet_length(data)` so metadata cannot bypass the binary limit.

### 11.3.1 Multipart Shape and Filename Validation

Each upload request contains exactly one non-empty file part named `file`. Missing files, duplicate `file` parts, and unexpected file fields return `400 VALIDATION_ERROR`. Parsing uses bounded in-memory storage and explicit limits for files, fields, parts, and header pairs; user filenames are never used as temporary filesystem paths.

The backend extracts a basename using both `/` and `\\` separators, rejects control characters including CR/LF/NUL, and then requires the complete basename (including extension) to contain 1-255 UTF-8 bytes. Extension validation operates on this validated basename, not the raw multipart filename. Overlong or unsafe names return `400 VALIDATION_ERROR` and are never truncated. The frontend may mirror this validation for UX, but the backend remains authoritative.

### 11.4 Pre-upload Pending Attachment

```http
POST /api/attachments
X-Requester-Id: 3
Content-Type: multipart/form-data
```

One request uploads exactly one non-empty multipart field:

```text
file
```

A successful request persists a valid temporary Pending Attachment:

```text
ticketId = null
deleted = false
```

The public identifier is the generated opaque UUID/storage key. Pending ownership is recorded for the uploading Requester. A Pending Attachment unbound for 24 hours becomes cleanup-eligible; Pending-orphan cleanup hard-deletes its row and binary and must never affect an Active or Removed Attachment.

#### Success

```http
201 Created
```

Body is the full `AttachmentDTO`, including:

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

### 11.5 Upload Attachment to Existing Ticket

```http
POST /api/tickets/:publicId/attachments
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
- non-empty file <= `5,242,880` bytes; and
- resulting active Attachment count does not exceed five.

The active-count check and insert execute in one Prisma transaction at PostgreSQL `Serializable` isolation. Serialization/deadlock conflicts receive at most three bounded retries with small randomized backoff. Retry exhaustion returns `503 SERVICE_UNAVAILABLE` and may include `Retry-After: 1`.

This endpoint directly persists the new Attachment as Active for an already-created owned Ticket. It is used after the Ticket exists, including later Ticket Detail management. It is distinct from `POST /api/attachments`, which creates Pending rows for initial Ticket creation.

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

#### Ticket Outside Current Requester Scope

```http
404 Not Found
```

#### Ticket Missing/Malformed/Deleted

```http
404 Not Found
```

---

## 12. Attachment Metadata and Binary APIs

### 12.1 Retrieve Attachment Metadata

```http
GET /api/attachments/:storageKey
X-Requester-Id: 3
```

The same `AttachmentDTO` representation is used for Pending, Active, and Removed Attachments.

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

#### Attachment Outside Current Requester Scope

```http
404 Not Found
```

#### Missing or Malformed Identifier

```http
404 Not Found
```

### 12.2 Preview Attachment

```http
GET /api/attachments/:storageKey/preview
X-Requester-Id: 3
```

Pending and Active owned Attachments may be previewed.

Response headers include:

```http
Content-Type: <backend-derived MIME>
Content-Disposition: inline; filename="<safe ASCII fallback>"; filename*=UTF-8''<RFC-5987-encoded-name>
Content-Length: <binary length>
X-Content-Type-Options: nosniff
Cache-Control: no-store
Vary: Origin, X-Requester-Id
```

Supported preview targets are JPG/JPEG, PNG, WEBP, and PDF where the browser supports inline rendering.

Removed owned Attachment:

```http
410 Gone
```

Attachment outside the current Requester scope:

```http
404 Not Found
```

Missing/malformed identifier:

```http
404 Not Found
```

### 12.3 Download Attachment

```http
GET /api/attachments/:storageKey/download
X-Requester-Id: 3
```

Pending and Active owned Attachments may be downloaded.

Response headers include:

```http
Content-Type: <backend-derived MIME>
Content-Disposition: attachment; filename="<safe ASCII fallback>"; filename*=UTF-8''<RFC-5987-encoded-name>
Content-Length: <binary length>
X-Content-Type-Options: nosniff
Cache-Control: no-store
Vary: Origin, X-Requester-Id
```

Removed owned Attachment:

```http
410 Gone
```

Attachment outside the current Requester scope:

```http
404 Not Found
```

Missing/malformed identifier:

```http
404 Not Found
```

The filename in `Content-Disposition` must be safely encoded/sanitized for HTTP headers and must never interpolate unsafe raw filename text. The stored binary is addressed by opaque `storageKey`, not by user-supplied file paths.

Because requester-scoped binary requests require `X-Requester-Id`, the frontend fetches preview/download data through its API client, verifies the HTTP result before consuming the body, creates a temporary Blob object URL, and revokes it on close/replacement/unmount or immediately after a download is initiated. Downloads use the already-known `AttachmentDTO.originalName` for the UI filename rather than parsing `Content-Disposition`.

These controls are Lab 2 hardening only. Extension-based validation, `nosniff`, and Blob rendering do not replace future file-signature inspection, malware scanning, or stronger PDF/content isolation required before production use.

---

## 13. Attachment Collection Delete API

### 13.1 Endpoint

Pending cleanup and Active Attachment soft removal use this unified batch endpoint:

```http
DELETE /api/attachments/collection
X-Requester-Id: 3
Content-Type: application/json
```

The backend determines behavior from each row's current persisted lifecycle. Mixed Pending and Active batches are permitted.

### 13.2 Request Body

```json
{
  "items": [
    {
      "attachmentId": "uuid-a",
      "reason": "Duplicate screenshot."
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

### 13.4 Lifecycle Behavior

#### Pending Attachment

```text
ticketId = null
deleted = false
```

Behavior:

```text
hard delete row and stored binary
reason is ignored and may be empty
```

#### Active Attachment

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

`reason` is required after trimming and must contain 3-200 characters.

#### Already Removed Attachment

```text
deleted = true
```

The resource is treated as not available for another deletion operation:

```http
404 Not Found
```

### 13.5 Mixed Pending and Active Batch

One request may combine Pending hard deletion and Active soft removal. The complete batch is validated before mutation and is committed all-or-nothing.

### 13.6 Ownership

Every item must belong to the current Development Requester, directly through its Pending upload owner or through its bound Ticket.

An item outside the current Requester's scope returns the same response as an unavailable item:

```http
404 Not Found
```

The entire batch remains unchanged.

### 13.7 Transaction Semantics

The collection operation is all-or-nothing.

The backend validates the entire request before applying mutations. If any item is invalid, unavailable in the current Requester's scope, already removed, or lacks a required active-removal reason, no item in the batch is modified. A syntactically valid unavailable/cross-owner item returns `404`; malformed UUID syntax inside the JSON body remains `400`.

All successful hard-delete and soft-delete mutations are committed in one database transaction. Validated IDs should be processed in deterministic sorted order where practical; this reduces inconsistent lock ordering without claiming to prevent every possible PostgreSQL deadlock.

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

Missing, deleted, or outside-current-scope request:

```http
404 Not Found
```

These cases use the same centralized response and do not disclose whether another Requester owns the resource.

### 14.2 Attachment Ownership

Pending Attachment ownership is determined by the uploading Requester. Bound Attachment ownership is determined by the owning Ticket's Requester.

The backend must enforce ownership on pre-upload, metadata, preview, download, Ticket binding, direct existing-Ticket upload, and collection deletion.

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
| Successful Pending Attachment pre-upload | `201` |
| Successful existing-Ticket Attachment upload | `201` |
| Successful Attachment collection delete | `204` |
| Ticket-list page beyond final page | `200` + `[]` |
| Empty active master/reference list | `200` + `[]` |
| Invalid JSON/request structure | `400` |
| Invalid field validation | `400` |
| Missing/invalid/inactive/deleted Requester context | `400` |
| Invalid Ticket-list query/filter/sort/pagination | `400` |
| Malformed UUID inside request JSON | `400` |
| Resource outside current Requester scope | `404`, same as unavailable |
| Missing resource | `404` |
| Malformed public route UUID/storage key | `404` |
| Logically deleted Ticket | `404` |
| Re-delete already removed Attachment | `404` |
| Reuse owned non-Pending/non-bindable Attachment on a new attempt | `409` |
| Exceed five active Attachments | `409` |
| Same Idempotency Key with different normalized payload | `409` + `IDEMPOTENCY_CONFLICT` |
| Preview/download removed Attachment | `410` |
| Attachment > 5,242,880 bytes | `413` |
| Unsupported Attachment extension | `415` |
| Serializable/deadlock retries exhausted | `503` + `SERVICE_UNAVAILABLE` |
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

For Ticket creation, immutable/syntactic parsing, normalization, hashing, and idempotency resolution precede mutable service/business validation. The generic pipeline above applies to new attempts after replay/conflict/wait resolution; it must not cause completed replays to revalidate current Category/System/Attachment state.

The mapper performs typed conversion according to approved field metadata. Invalid conversion is rejected before database access.

Unknown request fields, unsupported filter fields, unsupported conditions, invalid enums, invalid date values, and incompatible condition/field pairs are safe client errors rather than raw database errors.

Frontend filter controls expose only the valid Ticket choices for good UX, but they are not an API validation or security boundary. Direct clients receive `400 Validation Error` for disallowed Ticket field/condition combinations before the resource service/repository invokes Prisma or other data-access execution. The global QueryBuilder receives only the resulting validated/typed inputs and remains a generic expression-construction utility.

---

## 17. Logging and Error Safety

The API uses centralized request/error handling.

Normal server-side structured logging uses an explicit allowlist:

```text
X-Request-Id
HTTP method
route template (never the raw URL/query string)
response status
central error code
duration
numeric Requester ID or opaque Ticket/Attachment identifiers only where operationally necessary
```

The server must not log:

```text
raw URL/query string
raw request headers
request or response bodies
search/filter values
original filenames
Requester names/emails
Attachment binary contents
DATABASE_URL
credentials/secrets
raw SQL
complete Prisma error objects/metadata
```

Unexpected errors may record a sanitized error class/stable code and sanitized internal stack information. Error messages and stacks must not be assumed safe merely because they remain server-side. Database/Prisma errors must be mapped to the centralized public error contract; stack traces, SQL, credentials, and internal metadata are never returned publicly.

### 17.1 Operational Maintenance CLI

Expired Pending Attachments and logically expired `COMPLETED` Idempotency Records are cleaned by the idempotent server maintenance command `npm run maintenance:cleanup`. This is not an HTTP endpoint and no in-process timer is introduced. Production scheduling remains external to Lab 2. The command does not select, delete, or reclaim `PROCESSING` rows; five-minute stale recovery is request-driven under Section 8.5.

Each Pending-cleanup transaction captures one cutoff timestamp, selects at most 100 rows satisfying `ticket_id IS NULL`, `deleted = false`, and `created_at <= cutoff` through parameterized `FOR UPDATE SKIP LOCKED`, and hard-deletes the selected rows/binaries. Ticket binding locks referenced Pending rows in deterministic storage-key order; cleanup skips rows currently being bound. Invocations repeat safe batches until none remain and can be retried.

Idempotency cleanup processes at most 100 logically expired `COMPLETED` rows per transaction using `status = 'COMPLETED'`, `expires_at <= now`, and `FOR UPDATE SKIP LOCKED`. Logical expiry applies at that boundary even if a row remains physically present. Cleanup and request-time expired-row replacement use compatible row locking so either path may remove the old technical record while only one new logical operation can claim the requester/key. Parameterized raw SQL is permitted for bounded `SKIP LOCKED` cleanup because Prisma does not directly express that selection; all other persistence continues through Prisma where it can correctly express the operation. The CLI does not participate in the separately approved request-time stale-`PROCESSING` reclaim.

---

## 18. Endpoint Summary

| Method | Endpoint | `X-Requester-Id` | Purpose | Success |
|---|---|---:|---|---:|
| GET | `/api/requesters` | No | Bootstrap active Development Requesters | 200 |
| GET | `/api/categories` | Yes | Active Category resources | 200 |
| GET | `/api/related-systems` | Yes | Active Related System resources | 200 |
| GET | `/api/tickets` | Yes | My Tickets query | 200 |
| POST | `/api/tickets` | Yes | Create Ticket | 201 / replay 200 |
| GET | `/api/tickets/:publicId` | Yes | Owned Ticket Detail | 200 |
| POST | `/api/tickets/:publicId/attachments` | Yes | Add Attachment to existing Ticket | 201 |
| POST | `/api/attachments` | Yes | Pre-upload one Pending Attachment | 201 |
| GET | `/api/attachments/:storageKey` | Yes | Attachment metadata | 200 |
| GET | `/api/attachments/:storageKey/preview` | Yes | Inline binary preview | 200 |
| GET | `/api/attachments/:storageKey/download` | Yes | Attachment download | 200 |
| DELETE | `/api/attachments/collection` | Yes | Hard-delete Pending and/or soft-remove Active batch | 204 |

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
GET /api/tickets?search=vpn&searchFields=ticketNumber,summary,description&filters=<URL_ENCODED_JSON>&sort=createdAt:desc&pageNumber=1&pageSize=20
X-Requester-Id: 3
```

Response:

```http
200 OK
X-Pagination: {"pageNumber":1,"pageSize":20,"totalItems":4,"totalPages":1,"hasPreviousPage":false,"hasNextPage":false}
X-Request-Id: 7af44238-c13f-4b77-b9c8-a3cf5272a99f
Access-Control-Expose-Headers: X-Pagination, X-Request-Id
```

```json
[
  {
    "publicId": "05a214b4-b957-4ed7-a58e-73f4392b35ec",
    "ticketNumber": "TKT-20260820-A81F3C9D7B21",
    "categoryId": 4,
    "categoryName": "Network",
    "relatedSystemId": 5,
    "relatedSystemName": "VPN",
    "summary": "Cannot connect to campus VPN",
    "requestedPriority": "HIGH",
    "currentStatus": "NEW",
    "createdAt": "2026-08-20T08:14:32.000Z"
  }
]
```

### 19.2 Create Ticket

```http
POST /api/tickets
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

Before this request, upload each final intended file separately as Pending:

```http
POST /api/attachments
X-Requester-Id: 3
Content-Type: multipart/form-data
```

Ticket creation canonicalizes the sorted IDs, resolves idempotency, and for a new attempt atomically creates the Ticket and binds all referenced Pending Attachments.

### 19.3 Clean Up Pending and Soft-remove Active Attachments

```http
DELETE /api/attachments/collection
X-Requester-Id: 3
Content-Type: application/json
```

```json
{
  "items": [
    {
      "attachmentId": "e3bb4607-fd10-447a-a4fc-26f2529a9270",
      "reason": "Duplicate screenshot."
    },
    {
      "attachmentId": "eb87467e-b209-4a18-bbc6-c8c5a4dccf95",
      "reason": "Uploaded the wrong screenshot."
    }
  ]
}
```

Pending items are hard-deleted and Active items are soft-removed together, or none of the batch changes are applied. Each Active item requires a valid reason; a Pending item's reason is ignored.

---

## 20. Lab 3 Transition Note

`X-Requester-Id` exists only to simulate the current Requester context in Lab 2. The REST resource design, public Ticket/Attachment identifiers, ownership checks, audit fields, and centralized errors are intended to remain reusable when Lab 3 introduces real authentication.

When authentication is introduced, the backend should derive Requester identity from the authenticated principal instead of trusting a client-provided Requester context header. Lab 2 must not represent the current header as secure authentication before that migration occurs.
