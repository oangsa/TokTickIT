# Lab 3 REST API Specification

## 1. Purpose and Scope

This document defines the wire-level REST API contract for TokTickIT Lab 3. It refines `docs/lab-03/specification.md` into exact route groups, authentication transport, cookies, headers, DTOs, query parameters, request bodies, authorization behavior, status codes, safe errors, lifecycle actions, pagination, and concurrency rules.

Lab 3 replaces the Lab 2 `X-Requester-Id` testing context with real authentication while preserving the Lab 2 Requester Ticket, Attachment, query, idempotency, centralized-error, request-correlation, and binary-safety behavior unless explicitly changed below.

Explicit handout MUST/fixed requirements remain mandatory. Where the handout leaves endpoint paths or mechanics open, this document is the approved implementation contract.

Shared contract anchors: the only User roles are `REQUESTER`, `IT_STAFF`, and
`ADMINISTRATOR`; the only Ticket statuses are `NEW`, `OPEN`,
`IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, and
`CANCELLED`; access JWTs are memory-only and PostgreSQL UserSession state is
authoritative; and the frontend CommonForm contract is typed sections/fields
with React Hook Form, `zodResolver`, shared constants, Bootstrap 5 semantic
spans, and centralized server-error mapping. Required visual evidence is
tracked under `docs/lab-03/evidence/screenshots/`; detailed UI/test rules remain
in the linked UI and test specifications.

---

## 2. API Base Path, Naming, and Success Style

### 2.1 Base path

All Lab 3 endpoints use:

```text
/api
```

### 2.2 JSON naming

JSON request/response properties use `camelCase`.

PostgreSQL remains `snake_case`; Prisma maps database fields to camelCase application properties.

### 2.3 Timestamps

All API timestamps are ISO-8601 UTC strings.

```json
{
  "createdAt": "2026-09-10T04:30:00.000Z"
}
```

Frontend display may use `Asia/Bangkok`.

### 2.4 Public identifiers

Directly addressable User, Ticket, and Comment/Note resources use opaque UUID public identifiers.

Internal numeric primary keys are not exposed merely because they exist in PostgreSQL/Prisma.

### 2.5 Success bodies

Normal successful JSON endpoints return the resource or resource array directly; there is no mandatory `{ "data": ... }` wrapper.

Two one-time credential operations are explicit exceptions:

```text
POST /api/admin/users
POST /api/admin/users/:publicId/initial-password
```

because they must deliver generated plaintext exactly once.

### 2.6 Primary route surface

```text
AUTH
POST /api/auth/login
POST /api/auth/refresh
GET  /api/auth/me
POST /api/auth/change-password
POST /api/auth/logout
POST /api/auth/logout-all

REFERENCE
GET /api/categories
GET /api/related-systems

REQUESTER
GET    /api/users/me/tickets
POST   /api/users/me/tickets
GET    /api/users/me/tickets/:publicId
POST   /api/users/me/tickets/:publicId/cancel
POST   /api/users/me/tickets/:publicId/looks-resolved
POST   /api/users/me/tickets/:publicId/reopen

POST   /api/users/me/attachments
GET    /api/users/me/attachments/:storageKey
GET    /api/users/me/attachments/:storageKey/preview
GET    /api/users/me/attachments/:storageKey/download
DELETE /api/users/me/attachments/collection
POST   /api/users/me/tickets/:publicId/attachments

STAFF / ADMIN TICKET RESOURCE
GET   /api/tickets
GET   /api/tickets/:publicId
POST  /api/tickets/:publicId/claim
PATCH /api/tickets/:publicId/owner
PATCH /api/tickets/:publicId/it-priority
POST  /api/tickets/:publicId/start-work
POST  /api/tickets/:publicId/request-information
POST  /api/tickets/:publicId/resume-work
POST  /api/tickets/:publicId/mark-resolved
POST  /api/tickets/:publicId/close
POST  /api/tickets/:publicId/cancel

PUBLIC COMMENTS
GET  /api/tickets/:publicId/comments
POST /api/tickets/:publicId/comments
GET  /api/tickets/:publicId/comments/:rootCommentPublicId/replies
POST /api/tickets/:publicId/comments/:commentPublicId/replies

INTERNAL NOTES
GET  /api/tickets/:publicId/internal-notes
POST /api/tickets/:publicId/internal-notes

STAFF / ADMIN ATTACHMENT READ
GET /api/tickets/:publicId/attachments
GET /api/tickets/:publicId/attachments/:storageKey/preview
GET /api/tickets/:publicId/attachments/:storageKey/download

ADMIN
GET   /api/admin/users
POST  /api/admin/users
GET   /api/admin/users/:publicId
PATCH /api/admin/users/:publicId
POST  /api/admin/users/:publicId/initial-password
```

The Lab 2 `/api/requesters` bootstrap endpoint and `X-Requester-Id` contract are removed.

---

## 3. Authentication Transport

### 3.1 Access JWT

Normal protected business endpoints require:

```http
Authorization: Bearer <access-jwt>
```

The access JWT:

- uses HS256;
- expires after 10 minutes;
- contains only `sub`, `sid`, `jti`, `iat`, and `exp`;
- does not carry authoritative role state;
- is stored only in frontend memory.

Conceptual claims:

```json
{
  "sub": "<user-public-uuid>",
  "sid": "<session-uuid>",
  "jti": "<jwt-uuid>",
  "iat": 1789012800,
  "exp": 1789013400
}
```

Every protected request validates the JWT signature/expiry and then loads the authoritative UserSession and User. A valid JWT whose session is revoked/expired or whose User is inactive is not sufficient for access.

### 3.2 Refresh credential

The refresh token is a cryptographically random opaque value.

Browser storage:

```text
HttpOnly cookie only
```

Server persistence:

```text
SHA-256 token hash only
```

Recommended cookie name:

```text
toktickit_refresh
```

Cookie attributes:

```text
HttpOnly
SameSite=Strict
Path=/api/auth
Secure when served over HTTPS
no Domain attribute
```

### 3.3 Remember Me

Login body explicitly carries:

```json
{
  "rememberMe": false
}
```

Full-session lifetime:

| Mode | Cookie | Idle | Absolute |
|---|---|---:|---:|
| Remember false | session cookie | — | 8 hours |
| Remember true | persistent | 30 days | 90 days |

Restricted password-change sessions always ignore Remember Me and expire absolutely after 15 minutes.

### 3.4 Refresh rotation

A successful refresh:

1. validates current/previous refresh token hash;
2. validates current UserSession/User state;
3. rotates to a new random refresh token;
4. moves the prior current hash into `previousRefreshTokenHash`;
5. sets `previousRefreshValidUntil = now + 30 seconds`;
6. returns a new access JWT;
7. sends the new refresh cookie.

If the immediately previous refresh token is presented again while:

```text
now <= previousRefreshValidUntil
```

the server takes the session-row lock, confirms the deadline, performs exactly
one fresh rotation, and returns the access JWT and refresh cookie from that
rotation. It does not revoke the session. A token that is no longer either the
current or immediately previous stored hash is not rescued by the deadline;
it is token reuse and revokes the session.

If that old token is presented after the 30-second ambiguity window, the session is revoked and `401 SESSION_INVALID` is returned.

### 3.5 Cross-tab coordination

The browser AuthProvider coordinates same-origin tabs using:

```text
navigator.locks
BroadcastChannel("toktickit-auth")
```

Conceptual broadcast events include:

```text
ACCESS_UPDATED
SESSION_ENDED
LOGOUT
```

No token is persisted to Web Storage.

### 3.6 Restricted session

A correct initial-password login creates:

```text
SessionStage = PASSWORD_CHANGE_REQUIRED
```

Permitted endpoints:

```text
GET  /api/auth/me
POST /api/auth/refresh
POST /api/auth/change-password
POST /api/auth/logout
```

Every normal protected application endpoint returns:

```text
403 PASSWORD_CHANGE_REQUIRED
```

The restricted session cannot exceed 15 minutes from creation.

### 3.7 Current User DTO retrieval

Login and refresh deliberately return token data only.

After either succeeds, the frontend retrieves:

```http
GET /api/auth/me
```

to obtain current User/role/session stage.

---

## 4. Common Request/Response Headers

### 4.1 Authorization

```http
Authorization: Bearer <jwt>
```

required unless the endpoint is explicitly cookie-authenticated/public.

### 4.2 `Idempotency-Key`

Authenticated Requester Ticket creation preserves the Lab 2 idempotency contract:

```http
Idempotency-Key: <uuid>
```

Scope evolves to:

```text
(authenticatedRequesterUserId, idempotencyKey)
```

No Requester identifier is supplied by the client.

### 4.3 `X-Request-Id`

Clients may send a UUID:

```http
X-Request-Id: <uuid>
```

Valid UUID is reused; missing/malformed is replaced by a server-generated UUID.

Every response returns:

```http
X-Request-Id: <resolved-uuid>
```

### 4.4 Pagination metadata

Queryable collections return:

```http
X-Pagination: {"pageNumber":1,"pageSize":10,"totalItems":47,"totalPages":5,"hasPreviousPage":false,"hasNextPage":true}
```

CORS exposes this header to browser JavaScript.

### 4.5 Cache control

Authenticated API responses use:

```http
Cache-Control: no-store
```

`Vary` values applied by CORS/auth transport must be merged rather than overwritten.

---

## 5. CORS and CSRF-related Rules

Allowed origins use exact scheme/host/port values from `CORS_ALLOWED_ORIGINS`; wildcard origins are prohibited.

Lab 3 browser CORS permits:

```http
Access-Control-Allow-Headers:
  Authorization,
  Content-Type,
  Idempotency-Key,
  X-Request-Id
```

Browser-readable response headers include:

```http
Access-Control-Expose-Headers:
  X-Pagination,
  X-Request-Id
```

Credentialed browser requests are enabled for the refresh cookie.

Cookie-authenticated mutation endpoints (`refresh`, cookie-based `logout`, and equivalent cookie session operations) additionally validate the request `Origin` against the exact approved frontend-origin set. SameSite=Strict is defense-in-depth, not the only CSRF control.

CORS is not authentication.

---

## 6. Centralized Error Contract

### 6.1 Envelope

Every API error uses the Lab 2 structure:

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "The request contains invalid values.",
  "error": "Bad Request",
  "details": [
    {
      "field": "email",
      "message": "Enter a valid email address."
    }
  ]
}
```

`details` is optional and may contain multiple field messages.

### 6.2 Codes

Approved Lab 3 codes:

```text
400 BAD_REQUEST
400 VALIDATION_ERROR

401 UNAUTHENTICATED
401 AUTHENTICATION_FAILED
401 ACCESS_TOKEN_EXPIRED
401 SESSION_INVALID

403 FORBIDDEN
403 PASSWORD_CHANGE_REQUIRED

404 NOT_FOUND

409 CONFLICT
409 DUPLICATE_EMAIL
409 OWNERSHIP_CONFLICT
409 INVALID_STATUS_TRANSITION
409 IDEMPOTENCY_CONFLICT

410 GONE

413 PAYLOAD_TOO_LARGE
415 UNSUPPORTED_MEDIA_TYPE

429 RATE_LIMITED

500 INTERNAL_SERVER_ERROR
```

### 6.3 Safe authentication failure

Invalid credentials/inactive/unknown/deleted User:

```http
401 Unauthorized
```

```json
{
  "statusCode": 401,
  "code": "AUTHENTICATION_FAILED",
  "message": "Invalid email or password.",
  "error": "Unauthorized"
}
```

### 6.4 Password change required

```http
403 Forbidden
```

```json
{
  "statusCode": 403,
  "code": "PASSWORD_CHANGE_REQUIRED",
  "message": "A password change is required before continuing.",
  "error": "Forbidden"
}
```

### 6.5 Rate limited

```http
429 Too Many Requests
Retry-After: 900
```

```json
{
  "statusCode": 429,
  "code": "RATE_LIMITED",
  "message": "Too many login attempts. Try again later.",
  "error": "Too Many Requests"
}
```

The response never confirms that an email exists.

### 6.6 Scope-hiding Not Found

Requester-owned Ticket/Attachment access uses identical `404 NOT_FOUND` for:

- malformed public route identity;
- missing resource;
- deleted/unavailable resource;
- resource owned by a different Requester.

No owner/existence detail is returned.

### 6.7 Conflict examples

Ownership race:

```json
{
  "statusCode": 409,
  "code": "OWNERSHIP_CONFLICT",
  "message": "The Ticket ownership changed. Reload the Ticket and try again.",
  "error": "Conflict"
}
```

Invalid lifecycle action:

```json
{
  "statusCode": 409,
  "code": "INVALID_STATUS_TRANSITION",
  "message": "The requested Ticket action is not valid in the current status.",
  "error": "Conflict"
}
```

Duplicate email:

```json
{
  "statusCode": 409,
  "code": "DUPLICATE_EMAIL",
  "message": "A User with this email already exists.",
  "error": "Conflict"
}
```

### 6.8 Unexpected failure safety

Never return stack traces, SQL, Prisma/PostgreSQL internals, password hashes, refresh-token material, JWT secrets, database credentials, or protected cross-owner existence information.

The generated initial password appears only in the explicit successful one-time Admin credential responses.

---

## 7. Shared DTOs

### 7.1 AuthTokenDTO

```ts
interface AuthTokenDTO {
  accessToken: string;
  expiresIn: 600;
}
```

### 7.2 CurrentUserDTO

```ts
type UserRole = "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";
type SessionStage = "PASSWORD_CHANGE_REQUIRED" | "FULL";

interface CurrentUserDTO {
  publicId: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: true;
  mustChangePassword: boolean;
  sessionStage: SessionStage;
}
```

### 7.3 UserDTO

```ts
interface UserDTO {
  publicId: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
}
```

Internal ID, password hash, deleted legacy flag, session data, and security metadata are not exposed.

### 7.4 UserListItemDTO

```ts
interface UserListItemDTO {
  publicId: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}
```

### 7.5 TicketOwnerDTO

```ts
interface TicketOwnerDTO {
  publicId: string;
  name: string;
  role: "IT_STAFF" | "ADMINISTRATOR";
}
```

### 7.6 TicketDTO evolution

The Lab 2 flattened TicketDTO is preserved and extended conceptually with:

```ts
interface TicketDTO {
  publicId: string;
  ticketNumber: string;

  requesterPublicId: string;
  requesterName: string;
  requesterEmail: string;

  categoryId: number;
  categoryName: string;

  relatedSystemId: number;
  relatedSystemName: string;

  summary: string;
  description: string;

  requestedPriority: "LOW" | "MEDIUM" | "HIGH";
  itPriority: "LOW" | "MEDIUM" | "HIGH";

  currentStatus:
    | "NEW"
    | "OPEN"
    | "IN_PROGRESS"
    | "WAITING_FOR_REQUESTER"
    | "RESOLVED"
    | "CLOSED"
    | "REOPENED"
    | "CANCELLED";

  owner: TicketOwnerDTO | null;
  requesterResolutionConfirmedAt: string | null;

  attachments: AttachmentDTO[];

  createdAt: string;
  updatedAt: string;
  deleted: boolean;
}
```

Legacy numeric Requester ID is not required in new Lab 3 frontend DTOs.

### 7.7 StaffTicketListItemDTO

```ts
interface StaffTicketListItemDTO {
  publicId: string;
  ticketNumber: string;
  requesterName: string;

  categoryId: number;
  categoryName: string;

  summary: string;

  requestedPriority: "LOW" | "MEDIUM" | "HIGH";
  itPriority: "LOW" | "MEDIUM" | "HIGH";
  currentStatus: TicketDTO["currentStatus"];

  owner: TicketOwnerDTO | null;

  createdAt: string;
  updatedAt: string;
}
```

Description may be searchable without being serialized in each list row.

### 7.8 PublicCommentDTO

```ts
interface PublicCommentAuthorDTO {
  publicId: string;
  name: string;
  role: UserRole;
}

interface PublicCommentDTO {
  publicId: string;
  content: string;
  author: PublicCommentAuthorDTO;
  parentCommentPublicId: string | null;

  replyTo: {
    commentPublicId: string;
    userPublicId: string;
    name: string;
  } | null;

  depth: 0 | 1 | 2;
  createdAt: string;
}
```

### 7.9 RootPublicCommentDTO

```ts
interface RootPublicCommentDTO extends PublicCommentDTO {
  depth: 0;
  replyCount: number;
  replies: PublicCommentDTO[]; // max 3 preview entries
}
```

### 7.10 InternalNoteDTO

```ts
interface InternalNoteDTO {
  publicId: string;
  content: string;
  author: PublicCommentAuthorDTO;
  createdAt: string;
}
```

### 7.11 AttachmentDTO

The Lab 2 AttachmentDTO, lifecycle, binary headers, preview/download rules, max-five Active limit, removal evidence, and 5,000,000-byte limit remain authoritative unless an endpoint path below explicitly changes.

---

## 8. Authentication APIs

### 8.1 Login

```http
POST /api/auth/login
Content-Type: application/json
```

```json
{
  "email": "alice.johnson@example.com",
  "password": "<PASSWORD>",
  "rememberMe": false
}
```

Success:

```http
200 OK
Set-Cookie: toktickit_refresh=...; HttpOnly; SameSite=Strict; Path=/api/auth
```

```json
{
  "accessToken": "<jwt>",
  "expiresIn": 600
}
```

The client then calls `/api/auth/me`.

Unknown/inactive/deleted/wrong-password failures are indistinguishable.

### 8.2 Refresh

```http
POST /api/auth/refresh
Cookie: toktickit_refresh=...
```

No request body.

Success:

```http
200 OK
Set-Cookie: toktickit_refresh=<rotated>; ...
```

```json
{
  "accessToken": "<jwt>",
  "expiresIn": 600
}
```

Failures include `401 SESSION_INVALID` for absent/unrecognized/expired/revoked session or token reuse outside the ambiguity window.

### 8.3 Current authenticated User

```http
GET /api/auth/me
Authorization: Bearer <jwt>
```

Available to restricted and full sessions.

Success: `CurrentUserDTO`.

### 8.4 Change password

```http
POST /api/auth/change-password
Authorization: Bearer <jwt>
Content-Type: application/json
```

Restricted-session body:

```json
{
  "newPassword": "<NEW_PASSWORD>"
}
```

Full-session body:

```json
{
  "currentPassword": "<CURRENT_PASSWORD>",
  "newPassword": "<NEW_PASSWORD>"
}
```

`confirmPassword` is frontend-only.

Password rules:

- 8-128 Unicode code points;
- no trimming;
- uppercase, lowercase, digit, non-whitespace symbol;
- spaces allowed but do not satisfy symbol;
- new password differs from current.

Success:

```http
204 No Content
```

Side effects:

- update Argon2id hash;
- set `mustChangePassword=false`;
- revoke all User sessions;
- clear refresh cookie;
- require new Login.

### 8.5 Logout

```http
POST /api/auth/logout
Cookie: toktickit_refresh=...
```

Success is idempotent:

```http
204 No Content
```

Bearer token may be absent/expired.

### 8.6 Logout All

```http
POST /api/auth/logout-all
Authorization: Bearer <FULL-session jwt>
```

Success:

```http
204 No Content
```

All User sessions are revoked; current cookie is cleared.

---

## 9. Reference Data APIs

```http
GET /api/categories
GET /api/related-systems
Authorization: Bearer <FULL-session jwt>
```

Existing Lab 2 active/non-deleted semantics and direct DTO arrays remain.

---

## 10. Requester Ticket APIs

### 10.1 My Tickets

```http
GET /api/users/me/tickets
Authorization: Bearer <Requester jwt>
```

The authenticated User is the fixed ownership predicate.

The Lab 2 Ticket collection grammar remains supported.

No Requester parameter can expand scope.

### 10.2 Create Ticket

```http
POST /api/users/me/tickets
Authorization: Bearer <Requester jwt>
Idempotency-Key: <uuid>
Content-Type: application/json
```

```json
{
  "categoryId": 1,
  "relatedSystemId": 4,
  "summary": "Cannot access VPN",
  "requestedPriority": "HIGH",
  "description": "The VPN client rejects my connection after sign-in.",
  "attachmentIds": ["<pending-storage-key>"]
}
```

Backend-derived:

```text
requester = authenticated User
itPriority = requestedPriority
currentStatus = NEW
owner = null
requesterResolutionConfirmedAt = null
```

Lab 2 idempotency/canonical Attachment-ID behavior remains.

Success:

- first creation: `201 TicketDTO`;
- completed same-key/same-payload replay: `200 TicketDTO`;
- same key/different payload: `409 IDEMPOTENCY_CONFLICT`.

### 10.3 Requester Ticket Detail

```http
GET /api/users/me/tickets/:publicId
```

Owned non-deleted Ticket: `200 TicketDTO`.

Malformed/missing/deleted/cross-owner: same safe `404 NOT_FOUND`.

### 10.4 Requester Cancel

```http
POST /api/users/me/tickets/:publicId/cancel
```

Permitted for own `NEW` or `OPEN`.

Success returns updated TicketDTO.

Invalid current status: `409 INVALID_STATUS_TRANSITION`.

### 10.5 Looks Resolved

```http
POST /api/users/me/tickets/:publicId/looks-resolved
```

Permitted only in `RESOLVED`.

Sets `requesterResolutionConfirmedAt`; status remains `RESOLVED`.

Repeated confirmation may return the current Ticket idempotently.

### 10.6 Problem Still Exists / Reopen

```http
POST /api/users/me/tickets/:publicId/reopen
```

Permitted from `RESOLVED` or `CLOSED`.

Transaction:

```text
currentStatus = REOPENED
ownerUserId = null
requesterResolutionConfirmedAt = null
```

Priorities are preserved.

---

## 11. Requester Attachment APIs

These are the authenticated evolution of Lab 2 Attachment behavior.

### 11.1 Pre-upload Pending

```http
POST /api/users/me/attachments
Authorization: Bearer <access-jwt>
Content-Type: multipart/form-data
```

Preserve Lab 2 file rules, Pending state, and errors.

### 11.2 Metadata / Preview / Download

```http
GET /api/users/me/attachments/:storageKey
GET /api/users/me/attachments/:storageKey/preview
GET /api/users/me/attachments/:storageKey/download
```

Authenticated Requester ownership replaces `X-Requester-Id`.

Removed binary access remains `410 Gone`.

### 11.3 Existing-Ticket upload

```http
POST /api/users/me/tickets/:publicId/attachments
Content-Type: multipart/form-data
```

Preserve Lab 2 direct Active upload/max-five/concurrency rules.

### 11.4 Collection cleanup/removal

```http
DELETE /api/users/me/attachments/collection
Content-Type: application/json
```

Preserve Lab 2 all-or-nothing behavior for Pending hard delete and Active soft removal with per-Active 3-200 character reason.

---

## 12. Staff/Admin Ticket Queue

### 12.1 Retrieve Queue

```http
GET /api/tickets
Authorization: Bearer <IT Staff or Administrator jwt>
```

Requester: `403 FORBIDDEN`.

### 12.2 Search

Approved fields:

```text
ticketNumber
summary
description
requesterName
```

Example:

```text
?search=vpn&searchFields=ticketNumber,summary,description,requesterName
```

### 12.3 Filters

Approved fields:

```text
currentStatus
itPriority
requestedPriority
ownerPublicId
categoryId
relatedSystemId
createdAt
```

Created Date range uses the Queue compatibility matrix below. Two filters may
express a range, for example `GREATEROREQUAL` plus `LESSEROREQUAL`.

### 12.3.1 Queue filter compatibility matrix

The Queue validator owns this exact resource-specific matrix. Conditions use
the Lab 2 vocabulary. `IN` requires a non-empty array of 1–100 uniquely typed
values. `ISNULL` and `ISNOTNULL` require `value = ""`.

| Queue field | Category | Allowed conditions | Value/cardinality |
|---|---|---|---|
| `currentStatus` | enum | `EQUAL`, `NOTEQUAL`, `IN` | one enum or `IN` array |
| `itPriority` | enum | `EQUAL`, `NOTEQUAL`, `IN` | one enum or `IN` array |
| `requestedPriority` | enum | `EQUAL`, `NOTEQUAL`, `IN` | one enum or `IN` array |
| `ownerPublicId` | nullable UUID reference | `EQUAL`, `NOTEQUAL`, `IN`, `ISNULL`, `ISNOTNULL` | one UUID, `IN` array, or empty string for null tests |
| `categoryId` | non-null integer reference | `EQUAL`, `NOTEQUAL`, `IN` | one integer or `IN` array |
| `relatedSystemId` | non-null integer reference | `EQUAL`, `NOTEQUAL`, `IN` | one integer or `IN` array |
| `createdAt` | UTC datetime | `EQUAL`, `NOTEQUAL`, `GREATER`, `LESSER`, `GREATEROREQUAL`, `LESSEROREQUAL` | one ISO-8601 UTC timestamp |

Unknown Queue fields, conditions, malformed values, wrong cardinality, invalid
enum/reference values, and unsupported null tests return `400 VALIDATION_ERROR`
before QueryBuilder or Prisma execution. Queue search fields are only the four
fields listed in Section 12.2. Queue sort fields are exactly
`createdAt`, `updatedAt`, `ticketNumber`, `itPriority`, and `currentStatus`.

### 12.4 Sorting

Explicit sort:

```text
sort=<field>:<asc|desc>
```

Approved fields include:

```text
createdAt
updatedAt
ticketNumber
itPriority
currentStatus
```

No explicit sort => operational default:

1. unassigned first;
2. IT Priority HIGH -> MEDIUM -> LOW;
3. createdAt ASC;
4. internal id ASC.

### 12.5 Pagination

```text
pageNumber >= 1
pageSize 1-100
default pageSize = 10
```

Response: `StaffTicketListItemDTO[]` plus `X-Pagination`.

### 12.6 Terminal visibility

The API can retrieve terminal statuses.

Initial Staff UI commits filters that exclude `CLOSED` and `CANCELLED`.

---

## 13. Staff/Admin Ticket Detail and Actions

### 13.1 Retrieve

```http
GET /api/tickets/:publicId
```

IT Staff/Admin only.

### 13.2 Claim

```http
POST /api/tickets/:publicId/claim
```

IT Staff only.

Precondition: owner null.

If current status is `NEW`, owner assignment and `NEW -> OPEN` commit together.

Race: `409 OWNERSHIP_CONFLICT`.

### 13.3 Assign / Reassign / Unassign

```http
PATCH /api/tickets/:publicId/owner
Content-Type: application/json
```

```json
{
  "ownerPublicId": "<eligible-user-uuid-or-null>",
  "expectedOwnerPublicId": "<current-owner-uuid-or-null>"
}
```

Eligible target: active IT Staff or Administrator.

IT Staff may assign/reassign/unassign.

Admin non-owner cannot mutate owner.

Admin current owner may reassign/unassign their Ticket.

Expected-owner mismatch => `409 OWNERSHIP_CONFLICT`.

Assign from null while `NEW` => `OPEN`.

Unassign otherwise preserves status.

### 13.4 IT Priority

```http
PATCH /api/tickets/:publicId/it-priority
```

```json
{
  "itPriority": "HIGH"
}
```

Permitted to IT Staff and explicit Admin owner.

Requested Priority remains unchanged.

### 13.5 Start Work

```http
POST /api/tickets/:publicId/start-work
```

Owner only.

```text
OPEN -> IN_PROGRESS
REOPENED -> IN_PROGRESS
```

### 13.6 Request Information

```http
POST /api/tickets/:publicId/request-information
Content-Type: application/json
```

```json
{
  "content": "Please attach a screenshot of the VPN error."
}
```

Owner only.

Allowed from `OPEN`, `IN_PROGRESS`, `REOPENED`.

One transaction creates Public Comment and moves to `WAITING_FOR_REQUESTER`.

### 13.7 Resume Work

```http
POST /api/tickets/:publicId/resume-work
```

Owner only.

```text
WAITING_FOR_REQUESTER -> IN_PROGRESS
```

### 13.8 Mark Resolved

```http
POST /api/tickets/:publicId/mark-resolved
```

Owner only.

Allowed from `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `REOPENED`.

Sets `RESOLVED` and clears any current resolution-confirmation timestamp.

### 13.9 Close

```http
POST /api/tickets/:publicId/close
```

Owner only.

Requires `RESOLVED` and Requester resolution confirmation.

### 13.10 Cancel

```http
POST /api/tickets/:publicId/cancel
```

Authorized operational actor only.

Allowed from `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `REOPENED`.

`CANCELLED` is terminal.

---

## 14. Public Comment APIs

### 14.1 Authorization

Read: own Requester Ticket, IT Staff, or Administrator.

Post: own Requester Ticket, IT Staff, or Administrator including Admin non-owner.

### 14.2 Root comments

```http
GET /api/tickets/:publicId/comments?pageNumber=1&pageSize=10
```

Defaults:

```text
root order = createdAt DESC, id DESC
pageSize = 10
reply preview max = 3
preview order = oldest first
```

Returns `RootPublicCommentDTO[]` plus `X-Pagination`.

### 14.3 Create root comment

```http
POST /api/tickets/:publicId/comments
```

```json
{
  "content": "The issue still occurs after reboot."
}
```

Trimmed 1-2000, plain text.

Success: `201 PublicCommentDTO`.

### 14.4 Retrieve replies

```http
GET /api/tickets/:publicId/comments/:rootCommentPublicId/replies?pageNumber=1&pageSize=5
```

Default oldest-first.

Response: `PublicCommentDTO[]` plus `X-Pagination`.

### 14.5 Create reply

```http
POST /api/tickets/:publicId/comments/:commentPublicId/replies
```

```json
{
  "content": "Works after the restart."
}
```

Server determines structural depth:

- target depth 0 -> new depth 1;
- target depth 1 -> new depth 2;
- target depth 2 -> new depth 2 under target's depth-1 structural parent.

`replyTo` identifies the exact clicked target for UI `@Name`; content is not modified.

---

## 15. Internal Note APIs

### 15.1 Retrieve

```http
GET /api/tickets/:publicId/internal-notes?pageNumber=1&pageSize=10
```

IT Staff/Admin may read.

Requester gets `403 FORBIDDEN` with no note content.

Flat direct array + `X-Pagination`.

### 15.2 Create

```http
POST /api/tickets/:publicId/internal-notes
```

```json
{
  "content": "Gateway restart completed; monitoring next response."
}
```

IT Staff may create.

Admin may create only when current Ticket owner.

Trimmed 1-4000, plain text, append-only.

Success: `201 InternalNoteDTO`.

---

## 16. Staff/Admin Attachment Read

```http
GET /api/tickets/:publicId/attachments
GET /api/tickets/:publicId/attachments/:storageKey/preview
GET /api/tickets/:publicId/attachments/:storageKey/download
```

IT Staff/Admin readers may inspect existing Attachment evidence.

Lab 2 `nosniff`, Content-Disposition, derived MIME, no-store, Removed `410`, and binary safety remain.

No Staff/Admin upload/removal API is added in Lab 3.

---

## 17. Administrator User APIs

### 17.1 User collection

```http
GET /api/admin/users
```

Admin only.

Shared collection grammar.

Approved search fields:

```text
name
email
```

Approved UI filter:

```text
role
```

The User-list validator owns this exact query surface:

| Surface | Allowed values |
|---|---|
| `searchFields` | `name`, `email`; values are unique and combine with OR |
| `filters[].field` | `role` only |
| `filters[].condition` for `role` | `EQUAL` only; value is one exact `UserRole` |
| `sort` | `name:asc`, `name:desc`, `email:asc`, or `email:desc` |
| `pageNumber` | positive integer; default `1` |
| `pageSize` | integer `1–100`; default `10` |

Non-blank `search` requires at least one approved search field and is trimmed
to 200 characters. Malformed filters, unknown fields/conditions, duplicate
search fields, invalid role values, unsupported sort fields, and invalid page
values return `400 VALIDATION_ERROR` before QueryBuilder or Prisma execution.
An empty filter array is equivalent to no filters. `IN` is not accepted for the
User `role` filter. Omitted `sort` means `name ASC`, then `publicId ASC`.

Default:

```text
pageNumber = 1
pageSize = 10
name ASC
deterministic tie-break
```

Response: `UserListItemDTO[]` + `X-Pagination`.

### 17.2 Create User

```http
POST /api/admin/users
```

```json
{
  "name": "Nora Example",
  "email": "nora@example.com",
  "role": "REQUESTER",
  "isActive": true
}
```

The server generates a cryptographically secure 16-character initial password containing uppercase/lowercase/digit/symbol.

Success:

```http
201 Created
```

```json
{
  "user": {
    "publicId": "<uuid>",
    "name": "Nora Example",
    "email": "nora@example.com",
    "role": "REQUESTER",
    "isActive": true,
    "mustChangePassword": true,
    "createdAt": "...",
    "updatedAt": "..."
  },
  "initialPassword": "<shown-once-value>"
}
```

Duplicate email: `409 DUPLICATE_EMAIL`.

### 17.3 Retrieve User

```http
GET /api/admin/users/:publicId
```

Success: `UserDTO`.

### 17.4 Edit User

```http
PATCH /api/admin/users/:publicId
```

Allowed request fields:

```text
name
email
role
isActive
```

Unknown fields rejected.

Security side effects:

- email change -> revoke target sessions;
- role change -> revoke target sessions;
- deactivation -> revoke sessions and unassign owner-ineligible Tickets;
- owner-capable -> Requester role change -> unassign owned Tickets;
- self-deactivation -> reject;
- self-role change -> reject;
- last active Admin demotion/deactivation -> reject.

Coupled changes are transactional.

### 17.5 Reset initial password

```http
POST /api/admin/users/:publicId/initial-password
```

Self target rejected.

Success:

```json
{
  "initialPassword": "<shown-once-value>"
}
```

Side effects:

```text
new Argon2id hash
mustChangePassword = true
all target sessions revoked
```

---

## 18. Shared Collection Query Contract

### 18.1 Query fields

```text
search=<text>
searchFields=a,b,c
filters=<URL-encoded JSON array>
sort=<field>:<asc|desc>
pageNumber=<positive integer>
pageSize=<1-100>
```

### 18.2 Search

Non-blank search requires approved `searchFields`.

Blank search => no search.

SearchFields without active search => ignored.

Approved fields combine through OR.

### 18.3 Filters

Decoded example:

```json
[
  {
    "field": "itPriority",
    "condition": "IN",
    "value": ["HIGH", "MEDIUM"]
  },
  {
    "field": "createdAt",
    "condition": "GREATEROREQUAL",
    "value": "2026-09-01T00:00:00Z"
  }
]
```

Expressions combine through AND.

Every resource owns whitelist/type/operator/nullability/cardinality conversion.

The resource matrices in Sections 12.3.1 and 17.1 are normative; this shared
section does not authorize combinations absent from those matrices. Unknown
resource fields or conditions are rejected with `400 VALIDATION_ERROR`, never
silently ignored.

### 18.4 Sort

Client supplies one visible sort expression unless a resource explicitly extends it.

Backend always adds deterministic tie-break.

### 18.5 Pagination

```text
DEFAULT_PAGE_NUMBER = 1
DEFAULT_PAGE_SIZE = 10
MAX_PAGE_SIZE = 100
```

No arbitrary page-number ceiling.

Out-of-range valid page => `200 []`.

### 18.6 Metadata

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

serialized through `X-Pagination`.

---

## 19. Authorization Matrix

| Operation | Requester | IT Staff | Admin non-owner | Admin assigned owner |
|---|---:|---:|---:|---:|
| Login/current User/logout | yes | yes | yes | yes |
| Requester My Tickets/Create | own role only | no | no | no |
| Ticket read | own | yes | yes | yes |
| Staff/Admin Queue | no | yes | yes | yes |
| Public Comment read | own | yes | yes | yes |
| Public Comment post | own | yes | yes | yes |
| Internal Note read | no | yes | yes | yes |
| Internal Note create | no | yes | no | yes |
| Claim | no | yes | no | no |
| Assign/reassign/unassign | no | yes | no | yes |
| IT Priority change | no | yes | no | yes |
| Start/Request Info/Resume/Resolve/Close | no | owner only | no | owner only |
| Looks Resolved/Reopen | own | no | no | no |
| Requester Cancel | own NEW/OPEN | no | no | no |
| Staff/Admin Cancel | no | authorized flow | no | owner |
| Existing Attachment read | own | yes | yes | yes |
| Requester Attachment mutate | own | no | no | no |
| User Management | no | no | yes | yes |

Backend enforcement is authoritative. Frontend visibility is feedback only.

---

## 20. Concurrency and Transaction Boundaries

Required transactions include:

- Ticket create + Pending Attachment binding + idempotency completion;
- Claim owner assignment + optional `NEW -> OPEN`;
- assign/reassign/unassign expected-owner check + mutation;
- Request Information comment + status change;
- Reopen status + owner null + confirmation clear;
- User deactivation/role change + session revocation + owner unassignment where required;
- initial-password reset + session revocation;
- concurrency-safe last-active-Administrator protection.

Stale expected state returns `409`, never silent last-write-wins.

---

## 21. Logging and Sensitive Data

Structured logs retain request correlation and safe allowlisting.

Never log:

- Login password;
- one-time initial password;
- password hash;
- Authorization JWT;
- refresh token/cookie/hash;
- full raw headers;
- sensitive request bodies;
- Attachment binary;
- raw SQL/database URL;
- Internal Note content unless explicitly approved later.

Opaque IDs may be logged when operationally necessary.

---

## 22. Maintenance Cleanup

An explicit idempotent command removes only eligible technical state such as expired/revoked sessions and expired login-rate-limit buckets.

No Express background timer is required.

Concurrent cleanup must not invalidate a currently valid session.

---

## 23. Final API Decisions

- Short-lived HS256 access JWT in memory.
- Opaque HttpOnly refresh cookie with hash-only DB persistence.
- Authoritative UserSession + User check on every protected request.
- 10-minute access JWT.
- 8-hour non-Remember session.
- 30-day idle / 90-day absolute Remember session.
- 15-minute restricted first-password-change session.
- 30-second refresh ambiguity window.
- Login/refresh return token data only; `/auth/me` returns identity.
- `X-Requester-Id` removed.
- Requester routes under `/api/users/me`.
- Staff/shared Ticket operations under `/api/tickets`.
- Admin User Management under `/api/admin/users`.
- Semantic lifecycle endpoints, not generic status patch.
- Concurrency-safe Claim/owner mutations.
- Request Information atomically creates Public Comment.
- Public Comments use bounded threading and lazy loading.
- Internal Notes are flat/private/append-only.
- Queryable collections reuse Ticket-style grammar and `X-Pagination`.
- Lab 2 centralized error envelope is retained and extended.
