# Lab 2 Sprint Engineering Specification

## 1. Sprint Goal

Deliver the Requester-facing TokTickIT MVP for Lab 2. A selected Development Requester must be able to create an IT support Ticket with supporting Attachments, receive a backend-generated official Ticket Number, find and inspect their own Tickets, search/filter/sort/page through My Tickets, and manage permitted Attachments. The sprint also establishes a reusable Zen Green UI foundation, a production-oriented REST API contract, a traceable data model, and automated evidence that Requester ownership and failure behavior are enforced.

## 2. Stakeholder Request Interpretation

Lab 2 introduces the first complete Requester workflow before real authentication exists. The Development Requester selector is therefore a temporary testing context only; it must not be presented or implemented as secure authentication.

The implementation must provide four main Requester experiences:

1. select the current Development Requester;
2. create a Ticket with optional pre-uploaded supporting Attachments;
3. locate and inspect the selected Requester's own Tickets; and
4. add, preview/download, and soft-remove permitted Attachments.

The system must preserve ownership separation in the backend, not only in the UI. It must also define reusable data, API, validation, loading, empty, error, logging, and responsive conventions that later labs can extend.

### Engineering-contract authority and handout interpretation

The Lab 2 handout's explicit normative requirements remain mandatory.

Where the handout intentionally leaves implementation behavior open, or provides
partial/illustrative API examples, screenshots, or payloads rather than a fixed
contract, these Lab 2 engineering-contract documents record the approved
implementation decision.

The engineering contract must not weaken or override an explicit handout MUST
requirement without documented instructor/course approval.

## 3. Scope

### Included

- Development Requester Selection screen for Lab 2 testing.
- Requester context stored for the browser session.
- Change Requester behavior.
- Create Ticket screen and Ticket submission workflow.
- Backend-generated official Ticket Number and backend-authoritative Ticket Date (`createdAt`), displayed after creation.
- Required Category, Related System, Requested Priority, Summary, and Description fields.
- Initial Ticket status of `NEW`.
- Pre-uploaded Pending Attachments and atomic binding during initial Ticket creation.
- Direct Attachment upload to an existing Ticket after creation.
- My Tickets list for the selected Requester only.
- Search, filtering, sorting, and pagination.
- Requester-owned Ticket Detail.
- Active and removed Attachment metadata.
- Attachment preview/download for owned Pending and Active Attachments; Removed Attachments are unavailable for binary access.
- Unified batch Pending cleanup and Active soft removal with per-Active-Attachment reasons.
- Pending Attachment expiration and orphan cleanup.
- An explicit idempotent maintenance CLI for expired Pending Attachments and logically expired `COMPLETED` Idempotency Records; production scheduling remains external to Lab 2. Stale `PROCESSING` recovery is request-driven through the approved `PROCESSING_LEASE_SECONDS = 300` claim lease and is not maintenance cleanup.
- Reusable Zen Green UI components and responsive behavior.
- Centralized request validation and error responses.
- Persistent idempotency protection for Ticket creation.
- PostgreSQL migrations, indexes, seed data, logging, request correlation, and automated tests.

### Excluded

- Real authentication, login/logout, passwords, password hashing, authentication sessions, tokens, or role-based authorization. The Lab 2 Requester context is a temporary testing context only.
- IT Staff dashboard, queue, claiming, reassignment, or IT Priority workflow.
- Public Comments, Internal Notes, and Actions Taken.
- Ticket lifecycle actions after creation, including status changes, resolution, closing, reopening, or cancellation.
- Administration screens for users, roles, Categories, Related Systems, or Requesters.
- Ticket deletion UI/API in Lab 2, even though the shared resource schema contains a `deleted` audit/lifecycle field.
- Deep file-signature or magic-byte inspection; Lab 2 attachment type acceptance is based on filename extension.
- Real production file-security controls such as malware scanning, content disarm/reconstruction, and stronger PDF isolation.
- Internet/public deployment of the unauthenticated Lab 2 application. Lab 2 is restricted to development/test networks.

## 4. Functional Requirements

- **FR-01** The application shall provide a Development Requester Selection screen before Requester-specific Ticket screens are used.
- **FR-02** The selector shall load only Development Requesters where `deleted = false` and `isActive = true`.
- **FR-03** The selected Development Requester shall be stored in `sessionStorage` and shown by name in the application shell.
- **FR-04** If no valid Requester context exists, direct access to Requester-specific pages shall redirect to `/requesters`.
- **FR-05** Changing Requester shall clear Requester-specific UI state before loading data for the newly selected Requester.
- **FR-06** If the stored Requester later becomes inactive or invalid, the frontend shall clear the stored selection and return to Requester Selection.

- **FR-07** The Create Ticket screen shall show Requester-editable Category, Related System, Summary, Requested Priority, Description, and Attachment controls plus non-editable Ticket Number, Ticket Date, and Requester context controls. Before submission, Ticket Number and Ticket Date clearly state that they are assigned on submission; Requester displays the selected Development Requester. These three values remain backend-controlled and are never client-controlled request-body fields. The resulting Ticket Detail shows the generated Ticket Number, authoritative Ticket Date (`createdAt`), Requester, Current Status, public ID-backed identity, and approved read-only data after creation.
- **FR-08** The Requester shall be able to select multiple permitted files and pre-upload each valid file through `POST /api/attachments` before submitting the Ticket.
- **FR-09** Each successful pre-upload shall create a Pending Attachment and the frontend shall include the final prepared Pending `attachmentIds` in `POST /api/tickets`.
- **FR-10** Ticket creation shall validate and bind every referenced Pending Attachment in the same database transaction as Ticket creation; either the Ticket and all referenced bindings commit or none of them do.
- **FR-11** Ticket submission shall remain unavailable while an intended selected file is Invalid, Failed, or Uploading. The Requester must successfully Retry or explicitly remove that file before submitting; after success, the frontend navigates to Ticket Detail and shows every referenced Attachment as Active.
- **FR-12** The frontend shall prevent duplicate submissions while a logical Ticket submission is in progress. An unchanged normalized logical payload reuses the same Idempotency Key; a changed payload, including a changed normalized `attachmentIds` set, uses a new key.

- **FR-13** My Tickets shall return only Tickets owned by the selected Development Requester.
- **FR-14** My Tickets shall support case-insensitive search using client-supplied, whitelisted search fields. The Lab 2 UI searches Ticket Number, Summary, and Description by sending those three `searchFields`.
- **FR-15** My Tickets shall support filtering by Category, Related System, Requested Priority, and Current Status.
- **FR-16** The shared/global backend QueryBuilder shall be a reusable infrastructure/repository utility for generic validated filter, multi-field search, and ordering expressions. It may support the approved generic condition vocabulary, but the resource-specific validation layer remains authoritative for allowed fields, allowed conditions per field, typed conversion, nullable/non-nullable compatibility, enum values, `IN` array shape, and search-field whitelists. Ticket ownership, the `deleted` predicate, Ticket priority semantics, Ticket-specific conversions/business rules, and pagination remain resource-owned; frontend filter choices are UX restrictions only.
- **FR-17** My Tickets shall support Newest, Oldest, Ticket Number A-Z, Ticket Number Z-A, Summary A-Z, Summary Z-A, Priority High-to-Low, and Priority Low-to-High sorting.
- **FR-18** My Tickets shall support 1-based pagination and configurable page size.
- **FR-19** My Tickets shall provide separate empty-dataset and no-results presentations through one reusable Empty State component configured by props.
- **FR-20** My Tickets shall show skeleton loading states and shall never show stale data from a previously selected Requester while new Requester data is loading.

- **FR-21** Ticket Detail shall retrieve and display one Ticket only when it belongs to the selected Requester.
- **FR-22** Ticket Detail shall present Ticket information as read-only in Lab 2.
- **FR-23** Ticket Detail shall list active and soft-removed Attachment metadata.
- **FR-24** The Requester shall be able to add a permitted Attachment to an existing owned Ticket.
- **FR-25** The Requester shall be able to preview/download owned Pending and Active supported images/PDFs. Removed Attachments shall not expose binary preview/download.
- **FR-26** The Requester shall be able to select one or more owned active Attachments and remove them as one all-or-nothing batch only after entering a valid removal reason for each selected active Attachment.
- **FR-27** Removed Attachments shall remain visible as metadata but shall not be previewable or downloadable.

- **FR-28** Every Lab 2 API endpoint except the Development Requester bootstrap endpoint `GET /api/requesters` shall require the temporary Requester context through `X-Requester-Id`.
- **FR-29** The backend shall enforce Requester ownership independently of frontend routing or UI state.
- **FR-30** The API shall use a centralized safe error response format and shall not expose stack traces, raw SQL, database credentials, or internal database error details.
- **FR-31** The server shall generate or propagate an `X-Request-Id` for request correlation and return it in the response. The Lab 2 CORS policy shall permit `Content-Type`, `X-Requester-Id`, `Idempotency-Key`, and `X-Request-Id` request headers and expose `X-Pagination` and `X-Request-Id` response headers to browser JavaScript.
- **FR-32** Reusable form primitives shall centralize labels, required markers, helper text, validation messages, character counts, disabled/busy states, and accessibility behavior while each business screen explicitly defines its own fields.
- **FR-33** Page-level Requester workflow failures such as Ticket-list load failure, `403`, `404`, and unexpected `500` shall use the standalone `/error` experience with no application sidebar and a Back action that returns to `/tickets`.

## 5. Business Rules

### 5.1 Ticket and Requester Rules

- **BR-01** The official Ticket Number is generated only by the backend and must be unique.
- **BR-02** Ticket Number format is `TKT-YYYYMMDD-RRRRRRRRRRRR`, where `YYYYMMDD` is the business date in `Asia/Bangkok` and the suffix is 12 uppercase hexadecimal random characters.
- **BR-03** The Ticket creation workflow shall retry Ticket Number generation when the database unique constraint reports a Ticket Number collision. At most three Ticket creation attempts are permitted for Ticket Number collision handling. Exhausting the retry limit results in a safe internal server error. The number-formatting/generation helper itself does not need database awareness.
- **BR-04** Ticket Date is the backend-authoritative Ticket `createdAt` timestamp. It is not an independently editable field.
- **BR-05** Every new Ticket starts with Current Status `NEW`.
- **BR-06** Requested Priority has no default. The Requester must explicitly choose one of `LOW`, `MEDIUM`, or `HIGH`.
- **BR-07** Category is required and must reference a non-deleted, active Category when a new Ticket is created.
- **BR-08** Related System is required and must reference a non-deleted, active Related System when a new Ticket is created.
- **BR-09** Category and Related System are independent reference resources; Lab 2 does not enforce a Category-to-System mapping.
- **BR-10** Summary is required, trimmed at both ends, and must contain 3-150 characters after trimming.
- **BR-11** Description is required, trimmed at both ends, and must contain 10-2000 characters after trimming.
- **BR-12** The Development Requester selector is a testing mechanism only and is not authentication.
- **BR-13** The selected Requester is stored in `sessionStorage`.
- **BR-14** The Requester selector displays Requester name only.
- **BR-15** Missing, unknown, inactive, or otherwise invalid `X-Requester-Id` context produces `400 Bad Request` using the centralized error envelope.
- **BR-16** A requester-owned Ticket or Attachment that is unavailable in the current Requester's scope produces the same centralized `404 Not Found` response whether it is missing or belongs to another Requester. The response must not disclose owner identity, cross-owner existence, or protected resource data.
- **BR-17** When Requester context changes, Requester-specific caches, list state, detail state, form state, and drafts that could reveal the previous Requester's data must be cleared before the new data is rendered.

### 5.2 Ticket Creation and Idempotency Rules

- **BR-18** `POST /api/tickets` requires an `Idempotency-Key` generated by the frontend for one logical submission. The key must be a valid UUID.
- **BR-19** The same Requester using the same Idempotency Key with the same canonical logical payload shall not create a second Ticket. Define `PROCESSING_LEASE_SECONDS = 300` and `STALE_CUTOFF = processingStartedAt + 300 seconds`. A new operation first owns the unique `(requesterId, key)` by inserting a `PROCESSING` claim with `processingStartedAt = now` before mutable business validation or Ticket/Attachment mutation. A claim is fresh when `now < STALE_CUTOFF` and stale/reclaim-eligible when `now >= STALE_CUTOFF`; therefore `4m 59.999s` is fresh and `5m 00.000s` is stale. An identical request against a fresh claim waits within the normal request timeout; against a stale claim it may atomically reclaim the existing claim and reset `processingStartedAt = now`. Each owner retains the exact `processingStartedAt` value representing its lease and must pass the approved `IDEMPOTENCY-FENCING-A` ownership check before any resource mutation. The first successful fenced owner transitions that claim to `COMPLETED` and returns `201 Created`; a completed replay returns `200 OK` for the same Ticket creation identity with a freshly reconstructed current `TicketDTO`.
- **BR-20** Reusing the same Idempotency Key with a different canonical logical payload returns `409 Conflict` with code `IDEMPOTENCY_CONFLICT`.
- **BR-21** Ticket-create canonicalization uses stable property ordering. After UUID syntax validation, each `attachmentId` is normalized to its canonical lowercase UUID string; duplicates are rejected after normalization; and the remaining strings are sorted lexicographically ascending by that canonical lowercase UUID string. This is not binary UUID ordering or implementation-dependent collection ordering. Omitted and empty `attachmentIds` both mean no initial Attachments. `[A, B]` and `[B, A]` are equal; `[A, B]` and `[A, C]` are different. The canonical logical request includes that sorted list, is encoded as UTF-8 bytes, hashed with SHA-256, and stored as exactly 64 lowercase hexadecimal characters in `request_hash VARCHAR(128)`.

  For example:

  ```text
  Submitted: ["f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f0f0", "00000000-0000-0000-0000-000000000000"]
  Canonical: ["00000000-0000-0000-0000-000000000000", "f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f0f0"]
  ```
- **BR-22** Ticket-create processing order is: parse; validate request shape/syntax; canonicalize the logical payload; compute the approved SHA-256 lowercase-hex hash; resolve, establish, or atomically reclaim the unique `(requesterId, Idempotency-Key)` claim and retain its exact ownership `processingStartedAt`; handle `PROCESSING`/`COMPLETED` replay or conflict; then enter one database transaction that locks the claim row and verifies `status = PROCESSING`, the expected `requestHash`, and exact expected `processingStartedAt`. While holding that claim-row lock, the fenced owner performs final mutable Category, Related System, and Pending-Attachment validation, creates the Ticket, binds all referenced Attachments, transitions the claim to `COMPLETED` with `ticketId`/completion/expiry values, and commits. The claim lock remains held through commit or rollback. If any ownership value differs, the old owner performs no Ticket/Attachment mutation and returns to normal same-hash `PROCESSING` wait/replay resolution. No resource mutation may occur before this fencing check. A claim abandoned in `PROCESSING` must therefore have no committed Ticket creation or Attachment mutation.
- **BR-23** A completed same-hash replay returns `200` before current Pending-state validation, so referenced Attachments becoming Active after the original commit does not invalidate replay. The replay resolves the stored `ticketId` and reconstructs the current `TicketDTO`; later Attachment additions/removals may therefore appear without changing the original create-request hash. A completed different-hash request returns `409 IDEMPOTENCY_CONFLICT`.
- **BR-24** Normal `4xx` Ticket-create failures preserve Ticket fields and valid Pending Attachments; unchanged logical retry reuses the key and changed logical payload uses a new key. Unexpected/ambiguous `5xx` handling uses best-effort Pending cleanup/recovery without ever soft-removing an Attachment that may already be Active; an unchanged ambiguous request may be retried with the same key to recover the committed Ticket.
- **BR-25** An untouched empty form may cancel directly. A dirty form and/or known Pending Attachments requires discard confirmation; confirmed discard performs best-effort cleanup of still-known Pending IDs, clears the Ticket draft and file state, and returns to `/tickets`. Unknown orphaned Pending rows remain eligible for 24-hour cleanup.

### 5.3 Search, Filter, Sort, and Pagination Rules

- **BR-26** Search is case-insensitive across the client-supplied whitelisted `searchFields`. The Lab 2 UI sends `ticketNumber,summary,description`; multiple search fields are combined with logical `OR`. A Ticket may match solely because its Description contains the search term, even though Description is intentionally omitted from `TicketListItemDTO`.
- **BR-27** Search input is trimmed; a blank value after trimming is treated as no search filter. A non-blank `search` requires `searchFields`; `searchFields` supplied without a non-blank `search` is ignored.
- **BR-28** The external `filters` query parameter is a URL-encoded JSON array. After parsing, validation, and mapping, filters are represented internally as typed `{ field, condition, value }` expressions.
- **BR-29** The reusable/global QueryBuilder may generically support `CONTAINS`, `STARTWITH`, `ENDWITH`, `EQUAL`, `NOTEQUAL`, `GREATER`, `LESSER`, `GREATEROREQUAL`, `LESSEROREQUAL`, `ISNULL`, `ISNOTNULL`, and `IN`. This capability is reusable infrastructure and does not grant every resource field every operator.
- **BR-30** Search-field matches form one `OR` group, and that group is combined with every filter expression using logical `AND`. Filter expressions are also combined with `AND`. `IN` is used for multi-value matching without nested `OR` groups.
- **BR-31** Resource-specific request/query validation shall remain authoritative and shall reject invalid input before it reaches QueryBuilder/Prisma query execution. The Ticket validator owns the Ticket field whitelist, Ticket field/condition permission matrix, typed value conversion, nullable/non-nullable compatibility, enum values, `IN` array shape, and the `ticketNumber`, `summary`, and `description` search-field whitelist. A reusable global QueryBuilder utility may only receive already validated/normalized/typed query data and must not be used to bypass these rules.

  The Lab 2 Ticket condition matrix is:

  | Ticket field(s) | Field category | Allowed conditions |
  |---|---|---|
  | `ticketNumber`, `summary`, `description` | String | `CONTAINS`, `STARTWITH`, `ENDWITH`, `EQUAL`, `NOTEQUAL`, `IN` |
  | `categoryId`, `relatedSystemId` | Reference/FK | `EQUAL`, `NOTEQUAL`, `IN` |
  | `requestedPriority`, `currentStatus` | Enum | `EQUAL`, `NOTEQUAL`, `IN` |
  | `createdAt`, `updatedAt` | DateTime | `EQUAL`, `NOTEQUAL`, `GREATER`, `LESSER`, `GREATEROREQUAL`, `LESSEROREQUAL` |

  The current Ticket whitelist contains no nullable filter fields, so `ISNULL` and `ISNOTNULL` are generic QueryBuilder capabilities but are not valid Ticket filter operations in Lab 2. Direct API clients that send a disallowed Ticket field/condition combination receive `400 Bad Request` before QueryBuilder/Prisma data-access execution; frontend restrictions provide good UX but are not the validation or security boundary. Requester ownership, `deleted = false`, semantic Priority ordering, pagination, and other Ticket-specific predicates/business rules remain outside QueryBuilder.

  The generic QueryBuilder receives already validated and typed internal input and
  constructs Prisma-compatible expressions for its supported generic operators. It
  does not own Ticket fields, Ticket condition permissions, conversions, enum or
  `IN` validation, `searchFields`, ownership/deleted predicates, semantic
  Priority ordering, or pagination. For example, `summary + ISNULL` may be
  representable by the generic infrastructure, but is invalid for the Lab 2
  Ticket resource; the Ticket validator returns `400 VALIDATION_ERROR` before
  QueryBuilder or Prisma receives that request. Generic QueryBuilder tests still
  cover `ISNULL`, `ISNOTNULL`, and the complete generic operator vocabulary.
- **BR-32** HTTP query-string values are mapped to typed application query values before the Ticket service is called. Conversion includes approved number, date, enum, boolean, and multi-value conversions. Failed conversion produces `400 Bad Request`. After validation/normalization, repository code may use the reusable QueryBuilder to construct generic Prisma filter/search/order expressions from those trusted values.
- **BR-33** String search/filter conditions are case-insensitive.
- **BR-34** Default Ticket list ordering is `createdAt DESC`, then internal `id DESC` as the deterministic secondary sort.
- **BR-35** Priority sorting supports both High-to-Low (`HIGH`, `MEDIUM`, `LOW`) and Low-to-High (`LOW`, `MEDIUM`, `HIGH`).
- **BR-36** Pagination is 1-based. Default page size is 10.
- **BR-37** The backend accepts page sizes from 1 through 100. The frontend exposes 10, 20, 30, 50, and 100.
- **BR-38** Requesting a page beyond the final page returns `200 OK` with an empty collection.
- **BR-39** Invalid list query parameters return `400 Bad Request` with safe validation details.
- **BR-40** Pagination metadata is returned in `X-Pagination` and contains `pageNumber`, `pageSize`, `totalItems`, `totalPages`, `hasPreviousPage`, and `hasNextPage`. CORS exposes `X-Pagination` and `X-Request-Id` so browser JavaScript can read both headers; allowed request headers explicitly include `Content-Type`, `X-Requester-Id`, `Idempotency-Key`, and `X-Request-Id` rather than relying only on framework defaults.
- **BR-41** The global Clear Filters action clears search and applied filters, resets to page 1, and preserves the current sort.
- **BR-42** Search requests are triggered by a `400 ms` debounced live-search interaction. Filter modal changes are draft-only until Apply Filters is chosen.
- **BR-43** Applying filters resets pagination to page 1. Cancel discards draft filter changes. Reset clears the modal's draft filter values; the reset becomes active only after Apply Filters.

### 5.4 Attachment Rules

- **BR-44** Permitted attachment extensions are JPG/JPEG, PNG, WEBP, and PDF.
- **BR-45** Attachment type validation is based on normalized filename extension only for Lab 2. Deep signature/magic-byte validation is outside the approved Lab 2 scope. The backend derives the response MIME type from the approved extension rather than trusting multipart MIME as the acceptance authority.
- **BR-46** Maximum attachment size is exactly `5,242,880` bytes per file (`MAX_ATTACHMENT_BYTES`, five binary mebibytes). The same constant is used by frontend validation, multipart parsing, backend validation, PostgreSQL constraints, documentation, and tests.
- **BR-47** A Ticket may have at most five active (`deleted = false`) Attachments. Soft-removed Attachments do not count toward this limit.
- **BR-48** Duplicate original filenames are allowed because storage identity is independent from the original filename.
- **BR-49** Attachment binary content is stored in PostgreSQL. The original filename is retained as metadata and a generated UUID storage key is used as the opaque public Attachment identifier.
- **BR-50** Each successful `POST /api/attachments` pre-upload creates one Pending Attachment with `ticketId = null`, `deleted = false`, and ownership tied to the uploading Development Requester.
- **BR-51** For a new Ticket-create attempt, every referenced Attachment must exist in the current Requester scope, be Pending (`ticketId = null`, `deleted = false`), unexpired, unbound, and within the maximum-five rule. An unavailable/cross-scope ID returns the approved safe `404`; an owned but non-Pending/non-bindable Attachment produces the approved `409` conflict/business validation behavior.
- **BR-52** Ticket row creation, Ticket Number persistence/collision handling, deterministic validation/locking and binding of all referenced Pending Attachments, relevant audit updates, and completion of the idempotency record occur in one database transaction. Failure rolls back the Ticket and every binding from that attempt; referenced rows remain Pending unless separately cleaned up.
- **BR-53** One Attachment may belong to only one Ticket. Attempting to reuse an already-bound Attachment ID on a new create attempt returns `409 Conflict`.
- **BR-54** Pending Attachments become cleanup-eligible 24 hours after creation. Pending-orphan cleanup hard-deletes the row and stored binary because it never became Ticket evidence; it must never remove Active or Removed Attachments.
- **BR-55** Removing a file card from Create Ticket removes it from the logical submission. Still-known Pending IDs are handled by discard/compensation cleanup where applicable; client-forgotten rows remain eligible for 24-hour orphan cleanup.
- **BR-56** Adding an Attachment to an existing owned Ticket uses `POST /api/tickets/:publicId/attachments` and directly creates an Active Attachment after enforcing the active-five limit. This post-create endpoint coexists with the standalone Pending pre-upload endpoint.
- **BR-57** Pending cleanup and Active removal use `DELETE /api/attachments/collection`. The batch contains 1-100 unique Attachment IDs. Pending owned Attachments are hard-deleted and ignore `reason`; Active owned Attachments are soft-removed and each requires its own trimmed 3-200 character reason. Mixed batches are permitted.
- **BR-58** Collection deletion is all-or-nothing. The complete batch is validated before mutation and processed transactionally, using deterministic ID order where practical. An unavailable/cross-scope item returns safe `404` and mutates nothing; malformed body UUIDs, duplicates, or invalid Active reasons return `400`; an already Removed item preserves the approved repeat-removal `404` behavior.
- **BR-59** A removed Attachment remains retrievable as metadata but preview and download are blocked. Attempting to delete an already removed Attachment again returns `404 Not Found` and causes the whole batch to remain unchanged.
- **BR-60** Owned Pending and Active JPG/JPEG/PNG/WEBP images and PDFs support browser preview where supported through a dedicated preview endpoint and a separate download endpoint.
- **BR-61** Invalid files in a multi-file selection are rejected individually; valid files may continue uploading.
- **BR-62** Unsupported extensions return `415 Unsupported Media Type`.
- **BR-63** Files larger than `5,242,880` bytes return `413 Content Too Large`.
- **BR-64** Operations that would exceed the five-active-Attachment limit return `409 Conflict`.
- **BR-65** Download/preview of a soft-removed Attachment returns `410 Gone`; a repeated delete attempt on an already removed Attachment returns `404 Not Found`.

### 5.5 Shared Resource Lifecycle and Audit Rules

- **BR-66** PostgreSQL tables and columns use singular `snake_case` names. Prisma models/properties use normal model names and camelCase properties mapped to the PostgreSQL names.
- **BR-67** All persistent resource tables use audit fields `created_by VARCHAR(255)`, `created_at TIMESTAMPTZ`, `updated_by VARCHAR(255)`, and `updated_at TIMESTAMPTZ`.
- **BR-68** Requester-triggered audit actors store the Requester's email address rather than a foreign key.
- **BR-69** Seed operations use audit actor `seed`; automated system operations use audit actor `system`.
- **BR-70** Business resources include `deleted BOOLEAN NOT NULL DEFAULT false` as the common logical-deletion field.
- **BR-71** Master/reference resources also include `isActive`. `deleted` controls logical existence in normal operations; `isActive` controls availability for new business selection while preserving historical visibility.
- **BR-72** A master resource with `deleted = true` is excluded from normal master list/selection APIs, but an existing historical Ticket relation may still resolve its metadata for read-only historical display.
- **BR-73** A master resource with `deleted = false` and `isActive = false` remains historically visible but cannot be selected for a new Ticket.
- **BR-74** Lab 2 exposes no Ticket deletion operation; new Tickets have `deleted = false`.

### 5.6 Production-Oriented Operational and Safety Rules

- **BR-75** Ticket-list validation accepts at most 200 trimmed search characters, at most 20 filter expressions, unique resource-whitelisted `searchFields`, and 1-100 unique typed values in each `IN` expression. Excessive complexity returns centralized `400 VALIDATION_ERROR` before QueryBuilder or Prisma execution.
- **BR-76** Direct upload to an existing Ticket enforces the active-five limit inside one Prisma transaction at PostgreSQL `Serializable` isolation; Prisma's default PostgreSQL isolation must not be relied upon. The transaction covers both the current Active-Attachment count and the new Active-Attachment insert. Supported PostgreSQL serialization/deadlock transient failures may use a small, bounded, randomized backoff for a maximum of three total transaction attempts, including the first attempt. Exact retry-backoff milliseconds are intentionally implementation-defined and are not part of the Lab 2 wire/API contract; eligible retries must still use a small, bounded, randomized delay and never exceed three total attempts. Validation `400`, safe ownership/not-found `404`, business-limit `409`, payload-size `413`, unsupported-media `415`, and other ordinary business errors are not retried. If a retry observes five real Active Attachments, the result is `409 CONFLICT`; if all three attempts fail solely because of serialization/deadlock contention, the existing centralized safe `500 INTERNAL_SERVER_ERROR` is returned. Lab 2 does not define a Service Unavailable variant for this behavior.
- **BR-77** After cross-platform basename extraction using both `/` and `\\`, an Attachment `originalName` must contain 1-255 UTF-8 bytes including its extension, contain no control characters, and pass extension validation on the validated basename. Overlong/unsafe names return `400 VALIDATION_ERROR` and are never truncated.
- **BR-78** `GET /api/requesters` retains the full `DevelopmentRequesterDTO` for the Lab 2 resource DTO policy, but the unauthenticated dataset may contain only synthetic development/test identities. No real identifiable or production personal data may be loaded while the endpoint remains unauthenticated. CORS is browser-origin hardening only, never authentication, authorization, or a privacy boundary.
- **BR-79** The unauthenticated Lab 2 deployment is restricted to development/test networks and must not be publicly exposed. `X-Requester-Id` remains required and validated where specified but is not an access-control credential. Upload quotas/rate limiting are deferred until authenticated identity or an approved edge control exists.
- **BR-80** The server provides an idempotent maintenance CLI, exposed through an npm script, which cleans expired Pending Attachments and logically expired `COMPLETED` Idempotency Records. It does not select, delete, or reclaim `PROCESSING` rows; stale-claim recovery occurs only during request-time idempotency resolution. Lab 2 does not add an in-process timer; production scheduling is external.
- **BR-81** Pending cleanup processes at most 100 rows per batch using one captured cutoff timestamp and a parameterized PostgreSQL `FOR UPDATE SKIP LOCKED` selection for `ticket_id IS NULL`, `deleted = false`, and `created_at <= cutoff`. Ticket binding locks referenced Pending rows in deterministic storage-key order. Cleanup repeats safe batches until none remain and can never delete an Attachment after it becomes Active.
- **BR-82** Idempotency expiry is logical at `now >= expiresAt`, where `expiresAt = completedAt + 24 hours`, regardless of physical cleanup. Replay/conflict rules apply only while `now < expiresAt`; after logical expiry the same Requester/key may represent a new operation. Resolution atomically locks and removes/replaces an expired `COMPLETED` row before claiming the same unique `(requesterId, key)`, so an expired-but-not-cleaned row cannot cause a false uniqueness conflict; concurrent reuse/cleanup remains single-winner and safe. This 24-hour `COMPLETED` retention/expiry policy is independent of the `PROCESSING_LEASE_SECONDS = 300` `PROCESSING` lease, whose fresh/stale boundary remains `now < processingStartedAt + 300 seconds` versus `now >= processingStartedAt + 300 seconds`. A stale same-hash `PROCESSING` row is conditionally updated in place to reset `processingStartedAt`; it is never deleted to permit a different payload to reuse the key. A stale claim cannot be reclaimed while another transaction holds its claim-row lock. A stale different-hash request remains `409 IDEMPOTENCY_CONFLICT`. The atomic conditional reclaim permits exactly one concurrent owner; losing same-hash contenders refetch the claim and follow normal fresh-`PROCESSING` wait or completed-replay behavior. `IDEMPOTENCY-FENCING-A` prevents an original slow owner from committing after its lease has been reclaimed because its exact `processingStartedAt` ownership check fails before resource mutation. No persistent `FAILED` state exists.
- **BR-83** During an ambiguous create result, the frontend stores a requester-scoped recovery record in `sessionStorage` containing the Idempotency Key/client creation time and normalized original create payload. Reload may offer explicit recovery but must never silently submit. The record is cleared on success, confirmed non-ambiguous failure, discard, Requester change, or expiry; automatic key reuse never continues for 24 hours or more from client key creation.
- **BR-84** Binary responses include `X-Content-Type-Options: nosniff`, use safely encoded `Content-Disposition` with an ASCII fallback and RFC 5987 `filename*`, and never interpolate raw filenames. The frontend fetches binary responses with `X-Requester-Id`, checks status before consuming the body, uses temporary Blob object URLs, and revokes them when no longer needed. Extension-only validation remains Lab 2 hardening, not production file assurance.
- **BR-85** Requester-scoped Lab 2 responses, including relevant errors and binary responses, use `Cache-Control: no-store` and merge `Vary: Origin, X-Requester-Id`. The full synthetic Requester bootstrap also uses `no-store`.
- **BR-86** CORS uses an environment-configured exact-origin allowlist with no wildcard. The documented Vite origin is allowed for development; outside development/test the server fails startup when the allowlist is missing or invalid. Requests without `Origin` are handled normally because CORS is not API authentication.
- **BR-87** Express JSON parsing uses an exact `131,072`-byte limit. Oversized JSON returns `413 PAYLOAD_TOO_LARGE`; malformed JSON within the limit returns `400 BAD_REQUEST`; structurally valid JSON with invalid fields returns `400 VALIDATION_ERROR`. Multipart limits remain separate.
- **BR-88** Multipart upload accepts exactly one non-empty `file` part, uses bounded in-memory parsing, and applies explicit file/field/part/header limits before database work. Missing, duplicate, or unexpected file fields return centralized `400 VALIDATION_ERROR`.
- **BR-89** Structured request logging uses an explicit allowlist: request ID, method, route template, status, duration, and centralized error code. Numeric Requester ID and opaque Ticket/Attachment identifiers are included only when operationally necessary. Raw URLs/query strings, headers, bodies, search/filter values, filenames, names/emails, binary content, database URLs, raw SQL, and complete Prisma metadata are never logged. Unexpected error class/code/stack information is sanitized rather than assumed safe.
- **BR-90** `/error` renders approved safe navigation-state content when valid. Missing/invalid state renders generic `500` copy; Back targets `/tickets` with valid Requester context and `/requesters` otherwise. Arbitrary backend text is never rendered.

## 6. UI Specification Summary

The detailed visual contract belongs in `docs/lab-02/ui-spec.md`. This section defines the approved structural behavior that implementation must preserve. Lab Sheet/sample images are approved visual-direction references, not pixel-perfect templates.

### 6.1 Application Routes

- `/requesters` - Development Requester Selection.
- `/tickets` - My Tickets.
- `/tickets/new` - Create Ticket.
- `/tickets/:publicId` - Requester-owned Ticket Detail.
- `/error` - standalone global error experience using navigation state for safe error information.
- `/` redirects to `/requesters` when no valid Requester is selected and to `/tickets` when a valid Requester context exists.

### 6.2 Application Shell and Visual Foundation

- Desktop uses a persistent left sidebar of approximately 240 px containing TokTickIT, My Tickets, Create Ticket, the selected Requester name, and Change Requester.
- Mobile collapses the sidebar behind a keyboard-accessible hamburger/menu control.
- Active navigation uses the Zen Green language with clear non-color-only indication.
- Primary typography is Inter with system fallbacks.
- Controls/buttons use approximately 8 px radius; cards/modals use approximately 12 px radius; badges are pill-shaped.
- Desktop main content is centered within the available content area with a sensible maximum width of approximately 1280 px.

### 6.3 Create Ticket

- Uses reusable form primitives receiving props/config for presentation behavior.
- Required labels include visible red asterisks and field-local validation messages.
- The pre-submit form visibly includes non-editable Ticket Number and Ticket Date controls whose text states that each value is assigned on submission, plus a non-editable Requester control showing the selected Development Requester. It does not invent generated values or show pre-creation Current Status, public ID, or audit values.
- Summary and Description always show character counters. Description has an approximately 140 px minimum height and supports vertical resize without breaking layout.
- Submit is disabled and visibly busy while processing. Busy buttons retain their original action text and add a spinner.
- Cancel/discard requires confirmation when the draft is dirty and/or has known Pending Attachments; confirmed discard performs best-effort Pending cleanup, clears local state, and returns to `/tickets`. An untouched empty form may cancel directly.
- Valid selected files pre-upload individually. Each file visibly moves through Uploading, Failed, Invalid, and Pending; failed/unready intended files must be retried or explicitly removed before Ticket submission is available.
- Successful Ticket creation submits the final prepared Pending `attachmentIds`, atomically binds all of them, and navigates to Ticket Detail with the official Ticket Number and every referenced file Active.
- A Ticket-create `4xx` response keeps form fields and valid Pending Attachments, shows relevant validation, and focuses the first invalid field.
- An unexpected/ambiguous `5xx` preserves the approved compensation/recovery behavior: never invent an Active-removal reason, and allow same-key unchanged replay to recover a committed Ticket and its Active Attachments without re-upload.

### 6.4 My Tickets

- Uses a table on desktop and a responsive table on smaller screens; it does not switch to a mobile card layout.
- Desktop columns are Ticket Number, Summary, Category, Related System, Priority, Status, and Created At.
- At mobile widths the table keeps Ticket Number, Summary, Priority, and Status and hides lower-priority columns without page-level horizontal scrolling.
- The full row is mouse- and keyboard-operable for opening Ticket Detail.
- Provides Create Ticket, search, Filters, Sort, Clear Filters, and pagination.
- Search is live with `SEARCH_DEBOUNCE_MS = 400` and searches Ticket Number, Summary, and Description through the API `searchFields` contract.
- Filters open in a single-column Apply modal rather than exposing the backend generic filter DSL. Category, Related System, Requested Priority, and Current Status all support multi-select.
- Applied filter count and removable filter chips are shown. Clear Filters is available whenever search/filter state is active, whether the current query has results or no results; it resets search/filters/page while preserving sort.
- Sort options include Newest, Oldest, Ticket Number A-Z/Z-A, Summary A-Z/Z-A, and Priority in both semantic directions.
- Priority badges remain in the Zen Green visual language and always include text; `NEW` uses a Pale Green status badge with visible text.
- Loading uses table skeletons.
- A reusable Empty State component renders different content for true empty dataset versus search/filter no-results.
- Ticket-list page-load failure navigates to the standalone global error page.

### 6.5 Ticket Detail and Attachments

- Ticket Detail header places the Ticket Number prominently with a Back to My Tickets action and a Ticket Detail title.
- Ticket information is presented as read-only form-style controls with distinct read-only backgrounds.
- Visible detail fields include Ticket Number, Ticket Date from `createdAt`, Current Status, Requested Priority, Requester Name, Requester Email, Category, Related System, Summary, and Description.
- Ticket Information and Attachments are separate cards/sections.
- Attachments use a responsive table. The section displays active count as `x/5`; removed Attachments do not count. Add Attachment is disabled at `5/5` without an additional maximum-limit paragraph.
- Images/PDFs preview in an in-app modal and active permitted files may be downloaded according to the API contract.
- Attachment presentation distinguishes Uploading, Failed, Invalid, Pending, Active, and Removed. Pending appears on Create Ticket; Active and Removed appear on Ticket Detail.
- Active Attachment rows have selection checkboxes. One or more selected active Attachments can be removed in one batch; the confirmation modal requires a separate 3-200 character reason for each selected item.
- Removed Attachments remain visible with metadata and removal reason, are not selectable, and do not expose Preview/Download/Remove actions.

### 6.6 Global Error Experience

- One `/error` route displays safe status-specific `403`, `404`, or `500` content from navigation state.
- The global error page is standalone and does not render the application sidebar.
- It must not reveal protected resource ownership or raw backend/internal details.
- For Requester workflow errors, Back navigates to `/tickets` rather than browser history.

### 6.7 Zen Green, Responsive, Accessibility, and Visual Evidence

Approved base tokens include primary green `#006B3C`, secondary green `#0B7A46`, pale green `#EAF6EF`, page background `#F5F7F6`, white surfaces/cards, dark charcoal-green text, white editable fields, distinct soft gray-green/warm-ivory read-only fields, dark-red validation treatment, amber warnings, and accessible green success treatment.

Responsive behavior:

- Desktop `>= 992px`: centered sensible maximum width and multi-column layout where appropriate.
- Tablet `768-991px`: two-column layout where practical; Summary and Description retain usable width.
- Mobile `< 768px`: fields stack vertically where relevant, tables hide lower-priority columns, controls remain touch-friendly, and the page has no horizontal scrolling.
- All sizes: no clipped labels, overlapping messages, hidden actions, or unreadable Attachment names.

Accessibility baseline includes semantic labels, keyboard-accessible controls, visible focus states, field-associated validation messages, accessible labels/tooltips for icon-only actions, modal focus management, non-color-only status communication, and live/status announcements for asynchronous upload/submission states where appropriate.

Required visual evidence uses desktop `1440x900`, tablet `820x1180`, and mobile `390x844` viewports for Create Ticket, My Tickets, and Ticket Detail, with additional important-state screenshots where useful.

## 7. Data Changes

### 7.1 Naming and Identifier Strategy

PostgreSQL uses singular `snake_case` table names and `snake_case` columns. Prisma exposes camelCase properties with `@map(...)` / `@@map(...)`.

Simple/reference resources use auto-increment numeric internal primary keys. Resources that are directly addressable by frontend route/API use an additional opaque public UUID rather than exposing their internal numeric key.

Examples:

- `ticket.id`: internal numeric primary key.
- `ticket.public_id`: unique UUID used by `/tickets/:publicId`.
- `attachment.id`: internal numeric primary key.
- `attachment.storage_key`: unique UUID used by Attachment APIs.
- `ticket.ticket_number`: unique business identifier, distinct from both internal ID and public UUID.

### 7.2 Authoritative Prisma/PostgreSQL Schema Contract

This section is the authoritative Lab 2 persistence contract. The Prisma schema and committed migration must implement these types, mappings, constraints, referential actions, checks, and indexes without inventing alternatives. PostgreSQL tables/columns use the singular `snake_case` names shown here; Prisma models/properties use the PascalCase/camelCase names and map to them with `@@map(...)`/`@map(...)`.

#### 7.2.1 Shared Audit Fields

Every persistent resource table, including `idempotency_record`, contains these fields:

| Prisma field/type | PostgreSQL column/type | Nullability | Generation/default | Constraint/meaning |
|---|---|---|---|---|
| `createdBy String` | `created_by VARCHAR(255)` | `NOT NULL` | Backend derives the actor; no database default | Actor string, intentionally not a Requester foreign key |
| `createdAt DateTime` | `created_at TIMESTAMPTZ` | `NOT NULL` | `@default(now())`; database `DEFAULT CURRENT_TIMESTAMP` | Immutable creation timestamp |
| `updatedBy String` | `updated_by VARCHAR(255)` | `NOT NULL` | Backend derives the actor; no database default | Actor string, intentionally not a Requester foreign key |
| `updatedAt DateTime` | `updated_at TIMESTAMPTZ` | `NOT NULL` | `@default(now()) @updatedAt`; database `DEFAULT CURRENT_TIMESTAMP` on insert and Prisma-maintained on update | Last-update timestamp |

Requester-triggered actors use the selected Requester's email. Seed/system actors use `seed`/`system` as already defined. The database never infers an actor and never creates an actor foreign key.

#### 7.2.2 Enums

Prisma and PostgreSQL use native enums with these exact values:

```text
RequestedPriority = LOW | MEDIUM | HIGH
TicketStatus       = NEW
IdempotencyStatus  = PROCESSING | COMPLETED
```

Lab 2 defines no persistent `FAILED` idempotency state.

#### 7.2.3 DevelopmentRequester

Prisma model `DevelopmentRequester` maps to PostgreSQL table `development_requester`.

| Prisma field/type | PostgreSQL column/type | Nullability | Generation/default | Constraint/FK/index |
|---|---|---|---|---|
| `id Int` | `id INTEGER` | `NOT NULL` | `@default(autoincrement())`; identity/sequence | Primary key |
| `name String` | `name VARCHAR(100)` | `NOT NULL` | Supplied by seed/application | — |
| `email String` | `email VARCHAR(254)` | `NOT NULL` | Supplied by seed/application | Unique |
| `isActive Boolean` | `is_active BOOLEAN` | `NOT NULL` | `@default(true)` / `DEFAULT true` | — |
| `deleted Boolean` | `deleted BOOLEAN` | `NOT NULL` | `@default(false)` / `DEFAULT false` | — |
| `createdBy`, `createdAt`, `updatedBy`, `updatedAt` | Shared audit columns | `NOT NULL` | Shared audit behavior | Section 7.2.1 |

Relationships: one Development Requester owns many Tickets, uploads many Pending or bound Attachments, and scopes many Idempotency Records. Those child foreign keys use the restrictive actions defined below.

#### 7.2.4 Category

Prisma model `Category` maps to PostgreSQL table `category`.

| Prisma field/type | PostgreSQL column/type | Nullability | Generation/default | Constraint/FK/index |
|---|---|---|---|---|
| `id Int` | `id INTEGER` | `NOT NULL` | Existing auto-increment identity/sequence | Primary key; existing Lab 1 IDs preserved |
| `name String` | `name VARCHAR(100)` | `NOT NULL` | Existing/application value | Unique |
| `isActive Boolean` | `is_active BOOLEAN` | `NOT NULL` | `@default(true)` / `DEFAULT true` | — |
| `deleted Boolean` | `deleted BOOLEAN` | `NOT NULL` | `@default(false)` / `DEFAULT false` | — |
| `createdBy`, `createdAt`, `updatedBy`, `updatedAt` | Shared audit columns | `NOT NULL` | Shared audit behavior for new/current rows; existing-row migration backfill uses `updatedAt = original createdAt`; existing `createdAt` values preserved | Section 7.2.1 |

The Lab 1 Category table/model is migrated in place. It is not dropped or recreated, and existing IDs, names, and original creation timestamps survive the migration.

Repository evidence for the Lab 1 baseline is the committed
`server/prisma/schema.prisma` and Category migration: the model/table currently
contains only `id`, `name`, and `createdAt`, with a unique `name`; the migration
creates the quoted `"Category"` table with `"id" SERIAL`, `"name" TEXT`, and
`"createdAt" TIMESTAMP(3)`, plus the unique name index. It does not currently
contain `isActive`, `deleted`, `createdBy`, `updatedBy`, or `updatedAt`.

The Lab 2 forward migration therefore preserves the existing `id`, `name`, and
`createdAt` values while introducing the new lifecycle and audit columns in
place. Existing valid rows receive `isActive = true` and `deleted = false`.
The newly required non-null `createdBy` and `updatedBy` actor values use the
already approved deterministic migration actor `seed`; original `createdAt`
values are not rewritten. For every existing Lab 1 row, the migration sets
`isActive = true`, `deleted = false`, `createdBy = seed`, `updatedBy = seed`,
and `updatedAt` to that row's preserved original `createdAt`. This existing-row
`updatedAt` backfill must not use migration execution time, `now()`,
`CURRENT_TIMESTAMP`, application-start time, or another nondeterministic
timestamp. The general `updatedAt` default in Section 7.2.1 applies to newly
inserted rows and does not replace this migration backfill rule.

#### 7.2.5 RelatedSystem

Prisma model `RelatedSystem` maps to PostgreSQL table `related_system`.

| Prisma field/type | PostgreSQL column/type | Nullability | Generation/default | Constraint/FK/index |
|---|---|---|---|---|
| `id Int` | `id INTEGER` | `NOT NULL` | `@default(autoincrement())`; identity/sequence | Primary key |
| `name String` | `name VARCHAR(100)` | `NOT NULL` | Supplied by seed/application | Unique |
| `isActive Boolean` | `is_active BOOLEAN` | `NOT NULL` | `@default(true)` / `DEFAULT true` | — |
| `deleted Boolean` | `deleted BOOLEAN` | `NOT NULL` | `@default(false)` / `DEFAULT false` | — |
| `createdBy`, `createdAt`, `updatedBy`, `updatedAt` | Shared audit columns | `NOT NULL` | Shared audit behavior | Section 7.2.1 |

No Category relationship or Category foreign key is present.

#### 7.2.6 Ticket

Prisma model `Ticket` maps to PostgreSQL table `ticket`.

| Prisma field/type | PostgreSQL column/type | Nullability | Generation/default | Constraint/FK/index |
|---|---|---|---|---|
| `id Int` | `id INTEGER` | `NOT NULL` | `@default(autoincrement())`; identity/sequence | Primary key |
| `publicId String @db.Uuid` | `public_id UUID` | `NOT NULL` | Backend generated | Unique |
| `ticketNumber String` | `ticket_number CHAR(25)` | `NOT NULL` | Backend generated | Unique; format check below |
| `requesterId Int` | `requester_id INTEGER` | `NOT NULL` | Derived from `X-Requester-Id` | FK to `development_requester(id)`, `ON DELETE RESTRICT`, `ON UPDATE RESTRICT` |
| `categoryId Int` | `category_id INTEGER` | `NOT NULL` | Validated request value | FK to `category(id)`, `ON DELETE RESTRICT`, `ON UPDATE RESTRICT`; indexed |
| `relatedSystemId Int` | `related_system_id INTEGER` | `NOT NULL` | Validated request value | FK to `related_system(id)`, `ON DELETE RESTRICT`, `ON UPDATE RESTRICT`; indexed |
| `summary String` | `summary VARCHAR(150)` | `NOT NULL` | Backend stores trimmed validated value | Trim/length check below; trigram indexed |
| `requestedPriority RequestedPriority` | `requested_priority RequestedPriority` | `NOT NULL` | Validated request value; no default | Indexed |
| `description String` | `description VARCHAR(2000)` | `NOT NULL` | Backend stores trimmed validated value | Trim/length check below; trigram indexed |
| `currentStatus TicketStatus` | `current_status TicketStatus` | `NOT NULL` | `@default(NEW)` / `DEFAULT 'NEW'` | Indexed |
| `deleted Boolean` | `deleted BOOLEAN` | `NOT NULL` | `@default(false)` / `DEFAULT false` | Included in requester-list partial index predicate |
| `createdBy`, `createdAt`, `updatedBy`, `updatedAt` | Shared audit columns | `NOT NULL` | Shared audit behavior | `createdAt` is the authoritative Ticket Date |

Required Ticket checks are equivalent to:

```sql
CHECK (ticket_number ~ '^TKT-[0-9]{8}-[0-9A-F]{12}$')
CHECK (summary = btrim(summary) AND char_length(summary) BETWEEN 3 AND 150)
CHECK (description = btrim(description) AND char_length(description) BETWEEN 10 AND 2000)
```

The Ticket Number remains `TKT-YYYYMMDD-RRRRRRRRRRRR`; its date uses `Asia/Bangkok` and its suffix is 12 uppercase hexadecimal characters.

#### 7.2.7 Attachment

Prisma model `Attachment` maps to PostgreSQL table `attachment`.

| Prisma field/type | PostgreSQL column/type | Nullability | Generation/default | Constraint/FK/index |
|---|---|---|---|---|
| `id Int` | `id INTEGER` | `NOT NULL` | `@default(autoincrement())`; identity/sequence | Primary key |
| `storageKey String @db.Uuid` | `storage_key UUID` | `NOT NULL` | Backend generated | Unique |
| `ticketId Int?` | `ticket_id INTEGER` | Nullable | `NULL` for Pending; set during binding/direct upload | FK to `ticket(id)`, `ON DELETE RESTRICT`, `ON UPDATE RESTRICT`; general and Active partial indexes |
| `uploadedByRequesterId Int` | `uploaded_by_requester_id INTEGER` | `NOT NULL` | Derived from current Requester | FK to `development_requester(id)`, `ON DELETE RESTRICT`, `ON UPDATE RESTRICT`; composite lookup index with `ticket_id` |
| `originalName String` | `original_name VARCHAR(255)` | `NOT NULL` | Validated basename supplied by upload | UTF-8 byte-length check below |
| `extension String` | `extension VARCHAR(10)` | `NOT NULL` | Backend-normalized approved extension | Application-owned extension validation |
| `mimeType String` | `mime_type VARCHAR(50)` | `NOT NULL` | Backend-derived from extension | Application-owned MIME derivation |
| `sizeBytes Int` | `size_bytes INTEGER` | `NOT NULL` | Backend-derived from accepted binary | Size/content checks below |
| `data Bytes` | `data BYTEA` | `NOT NULL` | Accepted upload binary | Size/content checks below |
| `removalReason String?` | `removal_reason VARCHAR(200)` | Nullable | `NULL` until soft removal; backend stores trimmed reason | Lifecycle check below |
| `deleted Boolean` | `deleted BOOLEAN` | `NOT NULL` | `@default(false)` / `DEFAULT false` | Lifecycle check and partial-index predicates |
| `createdBy`, `createdAt`, `updatedBy`, `updatedAt` | Shared audit columns | `NOT NULL` | Shared audit behavior | Pending-cleanup index uses `createdAt` |

`ticketId` is deliberately nullable. The exact persisted lifecycle states are:

```text
Pending  -> ticket_id IS NULL,     deleted = false, removal_reason IS NULL
Active   -> ticket_id IS NOT NULL, deleted = false, removal_reason IS NULL
Removed  -> ticket_id IS NOT NULL, deleted = true,  removal_reason is trimmed and 3-200 characters
```

Required Attachment checks are equivalent to:

```sql
CHECK (octet_length(original_name) BETWEEN 1 AND 255)
CHECK (
  size_bytes > 0
  AND size_bytes <= 5242880
  AND size_bytes = octet_length(data)
)
CHECK (
  (ticket_id IS NULL AND deleted = false AND removal_reason IS NULL)
  OR
  (ticket_id IS NOT NULL AND deleted = false AND removal_reason IS NULL)
  OR
  (
    ticket_id IS NOT NULL
    AND deleted = true
    AND removal_reason IS NOT NULL
    AND removal_reason = btrim(removal_reason)
    AND char_length(removal_reason) BETWEEN 3 AND 200
  )
)
```

The database rejects every other lifecycle combination and does not silently trim or normalize values. The application still validates first and returns the approved friendly API errors. Filename extension validation, control-character rejection, basename handling, and MIME derivation remain application-owned. `MAX_ATTACHMENT_BYTES` is exactly `5,242,880` bytes (5 MiB) in every layer.

#### 7.2.8 IdempotencyRecord

Prisma model `IdempotencyRecord` maps to PostgreSQL table `idempotency_record`.

| Prisma field/type | PostgreSQL column/type | Nullability | Generation/default | Constraint/FK/index |
|---|---|---|---|---|
| `id Int` | `id INTEGER` | `NOT NULL` | `@default(autoincrement())`; identity/sequence | Primary key |
| `requesterId Int` | `requester_id INTEGER` | `NOT NULL` | Current Requester | FK to `development_requester(id)`, `ON DELETE RESTRICT`, `ON UPDATE RESTRICT`; composite unique key |
| `key String @db.Uuid` | `key UUID` | `NOT NULL` | Validated `Idempotency-Key` | Unique with `requester_id` |
| `requestHash String` | `request_hash VARCHAR(128)` | `NOT NULL` | Backend-generated SHA-256 lowercase hex | Current-algorithm check below |
| `status IdempotencyStatus` | `status IdempotencyStatus` | `NOT NULL` | New claims use `PROCESSING` | State check below |
| `processingStartedAt DateTime` | `processing_started_at TIMESTAMPTZ` | `NOT NULL` | Backend sets server/database time when the claim is inserted and resets it when a stale same-hash claim is reclaimed; no database default | `PROCESSING_LEASE_SECONDS = 300`; retained unchanged when the row becomes Completed |
| `ticketId Int?` | `ticket_id INTEGER` | Nullable | `NULL` while Processing; set on completion | FK to `ticket(id)`, `ON DELETE RESTRICT`, `ON UPDATE RESTRICT` |
| `completedAt DateTime?` | `completed_at TIMESTAMPTZ` | Nullable | `NULL` while Processing; server completion time | State/expiry check below |
| `expiresAt DateTime?` | `expires_at TIMESTAMPTZ` | Nullable | `NULL` while Processing; completion + 24 hours | State/expiry check; cleanup index |
| `createdBy`, `createdAt`, `updatedBy`, `updatedAt` | Shared audit columns | `NOT NULL` | Shared audit behavior; technical actors follow the approved actor rules | Section 7.2.1 |

Required Idempotency Record constraints are:

```sql
UNIQUE (requester_id, key)
CHECK (request_hash ~ '^[0-9a-f]{64}$')
CHECK (
  (
    status = 'PROCESSING'
    AND processing_started_at IS NOT NULL
    AND ticket_id IS NULL
    AND completed_at IS NULL
    AND expires_at IS NULL
  )
  OR
  (
    status = 'COMPLETED'
    AND processing_started_at IS NOT NULL
    AND ticket_id IS NOT NULL
    AND completed_at IS NOT NULL
    AND expires_at IS NOT NULL
    AND expires_at = completed_at + INTERVAL '24 hours'
  )
)
```

The physical hash column remains `VARCHAR(128)` so a later migration can change algorithms deliberately, but Lab 2 always computes `canonical normalized logical request -> UTF-8 bytes -> SHA-256 -> lowercase hexadecimal`, producing exactly 64 lowercase hexadecimal characters. `PROCESSING_LEASE_SECONDS = 300`; fresh means `now < processing_started_at + 300 seconds`, and stale/reclaim-eligible begins at exact equality, `now >= processing_started_at + 300 seconds`. This time-relative rule is enforced by request-time conditional claim logic rather than a PostgreSQL `CHECK`; a check against changing `now` would not be a stable row invariant. A same-hash reclaim atomically updates the existing row's `processing_started_at` and technical update-audit fields. The exact `processing_started_at` value is also the fencing ownership value: the resource transaction locks the claim and compares it exactly before final mutable validation or mutation. No separate stale-scan index is required because resolution uses the unique `(requester_id, key)` lookup. Idempotency records are technical records and are hard-deleted only under the approved logically expired `COMPLETED` policy; stale `PROCESSING` rows are not deleted for key reuse, and no `deleted` column or persistent `FAILED` state is present.

#### 7.2.9 Referential Actions

All Lab 2 business/history foreign keys use `onDelete: Restrict` and `onUpdate: Restrict`, implemented as PostgreSQL `ON DELETE RESTRICT` / `ON UPDATE RESTRICT` (or equivalent `NO ACTION` behavior). This applies at minimum to:

- `ticket.requester_id`;
- `ticket.category_id`;
- `ticket.related_system_id`;
- `attachment.ticket_id`;
- `attachment.uploaded_by_requester_id`;
- `idempotency_record.requester_id`; and
- `idempotency_record.ticket_id`.

No foreign key may cascade-delete historical Ticket, Attachment, or Idempotency evidence.

### 7.3 Indexes and PostgreSQL Features

Enable:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

Required/justified indexes include:

- unique `ticket(ticket_number)`;
- unique `ticket(public_id)`;
- partial `ticket(requester_id, created_at DESC, id DESC) WHERE deleted = false` for requester list/default ordering;
- `ticket(category_id)`;
- `ticket(related_system_id)`;
- `ticket(requested_priority)`;
- `ticket(current_status)`;
- `attachment(ticket_id)`;
- partial `attachment(ticket_id) WHERE ticket_id IS NOT NULL AND deleted = false` for active-count/max-five enforcement;
- partial `attachment(created_at, id) WHERE ticket_id IS NULL AND deleted = false` for bounded Pending cleanup;
- `attachment(uploaded_by_requester_id, ticket_id)`;
- unique `attachment(storage_key)`;
- unique `idempotency_record(requester_id, key)`;
- `idempotency_record(expires_at, id)` for cleanup;
- GIN trigram indexes on `ticket_number`, `summary`, and `description` to support case-insensitive substring/prefix/suffix search efficiently.

The general `attachment(ticket_id)` index is retained because Ticket Detail retrieves both Active and Removed history; the Active partial index serves the separate max-five/count path. PostgreSQL-specific checks, extensions, and indexes that Prisma cannot fully express must be added through committed SQL in the Prisma migration. Fresh-schema/migration evidence verifies their presence, but acceptance never depends on PostgreSQL choosing an exact query plan.

### 7.4 Seed Data

Seed is idempotent and uses stable unique business keys (`Category.name`, `RelatedSystem.name`, `DevelopmentRequester.email`). An unchanged rerun must not create duplicates or mutate audit timestamps merely because the seed executed again.

Required Categories, all initially active/non-deleted:

1. Account and Access
2. Hardware
3. Software
4. Network

Related Systems, all initially active/non-deleted:

1. Corporate Laptop
2. Desktop Workstation
3. Printer
4. Campus Wi-Fi
5. VPN
6. Email
7. Learning Management System

Development Requesters:

- Alice Johnson - `alice.johnson@example.com` - active.
- Bob Smith - `bob.smith@example.com` - active.
- Carol Lee - `carol.lee@example.com` - active.
- David Brown - `david.brown@example.com` - active.
- Eve Wilson - `eve.wilson@example.com` - inactive.

All Lab 2 Development Requesters are synthetic test identities. Real names,
emails, or production personal data are prohibited while `GET /api/requesters`
remains unauthenticated.

Seed-created records use `created_by = "seed"` and `updated_by = "seed"`.

### 7.5 Migration Rule

All schema changes must be delivered through committed Prisma migrations. `prisma db push` alone is not sufficient for completion. A fresh database must be reproducible from migrations plus the idempotent seed.

The Lab 1 Category table is migrated forward in place rather than dropped/recreated. Based on the committed Lab 1 evidence, the migration starts from the existing `id`, `name`, and `createdAt` columns, preserves each value exactly, and may rename/alter them to the Lab 2 mapped snake_case/type convention without recreating the table. For every existing row it adds/backfills `isActive = true`, `deleted = false`, `createdBy = seed`, `updatedBy = seed`, and `updatedAt` equal to the original preserved `createdAt`; the existing-row `updatedAt` value is never migration time, `now()`, `CURRENT_TIMESTAMP`, application-start time, or another nondeterministic timestamp. It then enforces the required `NOT NULL` constraints. Verification covers both a fresh database and a populated Lab 1 database upgraded through the committed migration.

## 8. API Contract

Detailed wire serialization and full DTO schemas belong in `docs/lab-02/api-spec.md`. All Lab 2 API routes use base path `/api`. Successful JSON responses return a resource or resource array directly rather than a mandatory `{ "data": ... }` envelope. JSON fields use camelCase and timestamps are ISO-8601 UTC strings.

### 8.1 Request Context and Cross-Cutting Headers

`GET /api/requesters` is the bootstrap exception and does not require a Requester context.

Every other Lab 2 endpoint requires:

```http
X-Requester-Id: <positive-development-requester-id>
```

The header behaves operationally like the current Lab 2 Requester context/session but is not authentication, an authorization token, or a security credential. Missing, malformed, non-positive, unknown, inactive, or deleted Requester context returns `400`; a requester-owned resource outside the valid current Requester's scope returns the same centralized `404` as an unavailable resource.

Ticket creation additionally requires a valid UUID:

```http
Idempotency-Key: <uuid>
```

Every request receives a correlation ID. A valid incoming UUID `X-Request-Id` is reused; missing/malformed values are replaced by a server-generated UUID. Every response returns the resolved `X-Request-Id`.

The CORS policy explicitly permits `Content-Type`, `X-Requester-Id`, `Idempotency-Key`, and `X-Request-Id` request headers and exposes these browser-readable response headers:

```http
Access-Control-Expose-Headers: X-Pagination, X-Request-Id
```

### 8.2 Reference Data

```http
GET /api/requesters
GET /api/categories
GET /api/related-systems
```

Successful response: `200 OK` with a direct DTO array. These list APIs return only `deleted = false` and `isActive = true` resources, while each returned master DTO contains its normal resource fields including audit/lifecycle fields. Categories and Related Systems require `X-Requester-Id`; the Requester bootstrap endpoint does not.

### 8.3 Create Ticket

```http
POST /api/tickets
X-Requester-Id: <id>
Idempotency-Key: <uuid>
Content-Type: application/json
```

Request body contains only client-controlled Ticket fields:

```json
{
  "categoryId": 1,
  "relatedSystemId": 4,
  "summary": "Cannot access VPN",
  "requestedPriority": "HIGH",
  "description": "The VPN client rejects my connection after sign-in.",
  "attachmentIds": [
    "<attachment-storage-key-a>",
    "<attachment-storage-key-b>"
  ]
}
```

`attachmentIds` is optional; omitted and empty mean no initial Attachments. After
UUID syntax validation, each value is normalized to its canonical lowercase UUID
string, duplicate values are rejected, and the remaining values are sorted in
lexicographically ascending order by that canonical lowercase string. The
sorted list is the unordered logical set included in canonicalization before
the UTF-8 SHA-256 lowercase-hex hash. Requester ID, public ID, Ticket Number,
Current Status, timestamps, deletion flag, and audit fields are
backend-derived/generated.

Success:

- first successful creation: `201 Created` with one complete `TicketDTO`;
- completed unexpired same Requester/key/same normalized payload replay: `200 OK` for the same Ticket identity with a freshly reconstructed current `TicketDTO`;
- same Requester/key with a different payload: `409 Conflict` with `IDEMPOTENCY_CONFLICT`.

`4xx`/`5xx` failures are not permanently cached as completed idempotency results.

Request parsing, syntactic validation, canonicalization (including sorted `attachmentIds`), approved SHA-256 lowercase-hex hashing, and idempotency claim resolution/ownership occur before final mutable Category, Related System, or Pending-Attachment validation. A completed same-hash replay returns immediately and remains valid after referenced Attachments become Active. The new or atomically reclaimed same-hash owner retains its exact `processingStartedAt`, then enters one transaction that locks and fences the claim, reruns final current Category/System/Pending-Attachment validation, creates the Ticket, binds every referenced Pending Attachment, and transitions the claim to `COMPLETED`. The lock is held through commit/rollback. A mismatched old owner performs no resource mutation and returns to normal same-hash resolution. An abandoned `PROCESSING` claim has no committed resource mutation.

### 8.4 Ticket DTO Projections

Ticket creation and Ticket Detail return the full flattened `TicketDTO`, including Requester fields, Description, Attachment metadata, and audit/lifecycle fields. My Tickets returns the bounded `TicketListItemDTO` projection containing public/Ticket identity, historical Category/System IDs and names, Summary, Priority, Status, and `createdAt`. It excludes Description, Requester fields, Attachments, audit-only fields, `updatedAt`, and `deleted`. Backend search may still search Description even though Description is not serialized in list items; a Ticket may match solely because its Description contains the search term. There is no separate `ticketDate` property; `createdAt` is the authoritative Ticket Date.

### 8.5 My Tickets

```http
GET /api/tickets
X-Requester-Id: <id>
```

Approved query contract:

- `search=<text>`;
- `searchFields=ticketNumber,summary,description` is required when non-blank search is active; `searchFields` without search is ignored;
- `filters=<URL-encoded JSON array>` where each object is `{ field, condition, value }`;
- `sort=<field>:<asc|desc>`;
- `pageNumber`, 1-based;
- `pageSize`, 1-100.

Search fields use `OR`; the resulting search group is combined with every filter through `AND`. Filter expressions also combine with `AND`; `IN` provides multi-value matching. The API validates field/condition compatibility and maps query values to typed application values before database query construction.

Default sort is `createdAt DESC`, then internal `id DESC`. The backend exposes the extended whitelisted filter/sort fields defined in `api-spec.md`, while the Lab 2 UI presents only its approved friendly controls.

Successful response: `200 OK` with `TicketListItemDTO[]` and:

```http
X-Pagination: {"pageNumber":1,"pageSize":10,"totalItems":47,"totalPages":5,"hasPreviousPage":false,"hasNextPage":true}
```

An out-of-range page returns `200 OK` with `[]` and valid pagination metadata.

### 8.6 Ticket Detail

```http
GET /api/tickets/:publicId
X-Requester-Id: <id>
```

- owned non-deleted Ticket: `200 OK` with `TicketDTO`;
- Ticket outside the current Requester's scope: centralized `404 Not Found` without disclosing owner identity or cross-owner existence;
- missing, logically deleted, or malformed public route identifier: the same centralized `404 Not Found`.

### 8.7 Pre-upload Pending Attachment

```http
POST /api/attachments
X-Requester-Id: <id>
Content-Type: multipart/form-data
```

Exactly one multipart `file` is validated and stored as Pending (`ticketId = null`, `deleted = false`). Success is `201 Created` with `AttachmentDTO` and `ticketPublicId: null`. Unbound Pending rows become cleanup-eligible after 24 hours.

### 8.8 Upload Attachment to an Existing Ticket

```http
POST /api/tickets/:publicId/attachments
X-Requester-Id: <id>
Content-Type: multipart/form-data
```

One multipart `file` is directly validated and stored Active against the owned Ticket. This endpoint is only for adding to an already-created Ticket, including later additions from Ticket Detail; it is not the initial-create pre-upload endpoint. Success: `201 Created` with `AttachmentDTO`. A Ticket outside the current Requester's scope returns the same centralized `404` as a missing Ticket.

### 8.9 Attachment Metadata, Preview, and Download

```http
GET /api/attachments/:storageKey
GET /api/attachments/:storageKey/preview
GET /api/attachments/:storageKey/download
X-Requester-Id: <id>
```

Metadata uses the same `AttachmentDTO` for Pending, Active, and Removed states and returns `200 OK` for owned metadata. Pending returns `ticketPublicId: null`; bound states return the owning Ticket public ID.

Owned Pending and Active preview/download return binary `200` responses. Preview uses `Content-Disposition: inline`; download uses `Content-Disposition: attachment`. MIME is derived by the backend from the approved extension. Removed owned preview/download returns `410 Gone`. An Attachment outside the current Requester's scope and a missing/malformed public route identity all return the same centralized `404`.

### 8.10 Attachment Collection Cleanup and Removal

```http
DELETE /api/attachments/collection
X-Requester-Id: <id>
Content-Type: application/json
```

Conceptual request:

```json
{
  "items": [
    { "attachmentId": "uuid-a", "reason": "Duplicate screenshot." },
    { "attachmentId": "uuid-b", "reason": "Uploaded the wrong document." }
  ]
}
```

The request contains 1-100 unique Attachment IDs. The backend derives behavior from persisted lifecycle:

- Pending owned Attachment: hard-delete row and binary; ignore `reason`;
- Active owned Attachment: soft-delete and retain row/binary/metadata/audit evidence; require a trimmed 3-200 character reason;
- Removed Attachment: approved repeat-removal `404` behavior.

Mixed Pending and Active batches are permitted.

The entire collection operation is validated first and is all-or-nothing. If any item is invalid, unavailable in the current Requester's scope, already removed, or has an invalid required reason, no item is mutated. A syntactically valid unavailable/cross-owner item returns `404`; malformed UUID inside the JSON body remains `400`. Successful mutations commit in one database transaction and return `204 No Content`.

### 8.11 Validation and Error Envelope

Centralized error shape:

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

`details` is optional and is an array when present.

Central error codes include:

- `BAD_REQUEST` / `VALIDATION_ERROR` - 400;
- `FORBIDDEN` - 403;
- `NOT_FOUND` - 404;
- `CONFLICT` - 409;
- `GONE` - 410;
- `PAYLOAD_TOO_LARGE` - 413;
- `UNSUPPORTED_MEDIA_TYPE` - 415;
- `INTERNAL_SERVER_ERROR` - 500;

A specific code is allowed where the frontend must distinguish protocol behavior, such as `IDEMPOTENCY_CONFLICT`.

Attachment status mapping includes unsupported extension `415`, file larger than `5,242,880` bytes `413`, active-limit or non-bindable conflict `409`, removed preview/download `410`, repeat removal of an already Removed Attachment `404`, and exhausted serialization/deadlock retries `500 INTERNAL_SERVER_ERROR`.

Raw PostgreSQL/Prisma errors, stack traces, secrets, raw SQL, and binary content are never returned to the client.

## 9. Acceptance Criteria

- **AC-01** Given no valid Development Requester is selected, when the user opens a Requester-specific route, then the application redirects to `/requesters` and does not render Requester Ticket data.
- **AC-02** Given active and inactive/non-deleted Requesters exist, when Requester Selection loads, then only active and non-deleted Requesters appear and the UI clearly states that the selector is for Lab 2 testing rather than authentication.
- **AC-03** Given a Requester is selected, when the user continues, then the Requester name is shown in the shell and the selection is retained in `sessionStorage` for the browser session.
- **AC-04** Given Requester A is currently selected, when the user changes to Requester B, then A-specific UI state is cleared before B-specific data is displayed.
- **AC-05** Given the stored Requester becomes inactive or invalid, when the app validates/uses that context, then it clears the selection and returns to Requester Selection.

- **AC-06** Given valid Ticket fields and zero to five prepared Pending Attachments, when the Requester submits their IDs, then one transaction creates exactly one `NEW` Ticket and binds every referenced Attachment Active; if creation/binding fails, no Ticket or partial binding from that attempt remains.
- **AC-07** Given a created Ticket, when its Ticket Number is inspected, then it matches `TKT-YYYYMMDD-RRRRRRRRRRRR`, the date uses `Asia/Bangkok`, the suffix is 12 uppercase hex characters, and the value is unique.
- **AC-08** Given Summary shorter than 3 or longer than 150 characters after trimming, when submission is attempted, then validation fails and no invalid Ticket is created.
- **AC-09** Given Description shorter than 10 or longer than 2000 characters after trimming, when submission is attempted, then validation fails and no invalid Ticket is created.
- **AC-10** Given Category, Related System, or Requested Priority is missing/invalid/inactive/deleted, when submission is attempted, then validation fails and the current form values remain available for correction.
- **AC-11** Given the same Requester repeats the same canonical Ticket payload, including the same normalized/sorted Attachment-ID set, with the same Idempotency Key after successful creation, when the retry reaches the backend, then the existing full `TicketDTO` is returned with `200`, no duplicate is created, and current Pending validation is not rerun after those Attachments became Active.
- **AC-12** Given an Idempotency Key was used with one canonical logical payload, when the same Requester reuses the key with different Ticket fields or a different logical Attachment-ID set, then the API returns `409` with `IDEMPOTENCY_CONFLICT`; `[A,B]` and `[B,A]` remain equal, while duplicate IDs return `400`.

- **AC-13** Given a permitted non-empty file no larger than `5,242,880` bytes is selected before Ticket submission, when `POST /api/attachments` succeeds, then PostgreSQL stores one owned Pending Attachment and the frontend receives a full `AttachmentDTO` with its opaque storage key and `ticketPublicId: null`.
- **AC-14** Given a file with an unsupported extension, when upload is attempted, then the API returns `415` and does not create a usable Attachment.
- **AC-15** Given a file larger than `5,242,880` bytes, when upload is attempted, then the API returns `413` and does not create a usable Attachment.
- **AC-16** Given a multi-file selection contains valid and invalid/failed files, when files are processed, then valid files may pre-upload Pending, each invalid/failed file shows its own state, and Ticket submission remains blocked until every intended file is Pending or explicitly removed.
- **AC-17** Given a Pending Attachment remains unbound for 24 hours, when orphan cleanup runs, then its row and binary may be hard-deleted, while Active and Removed Ticket evidence is never touched by Pending-orphan cleanup.
- **AC-18** Given a Ticket has five active Attachments, when another Attachment is added, then the API returns `409`; after one Attachment is soft-removed, one replacement Attachment can be added.
- **AC-19** Given a batch of owned Pending and/or Active Attachments, when `DELETE /api/attachments/collection` receives unique valid IDs and valid per-Active 3-200 character reasons, then it returns `204` and atomically hard-deletes Pending rows/binaries while soft-removing Active rows and retaining their evidence. If any item is invalid, unavailable/cross-scope, already Removed, or has an invalid required Active reason, no item is modified; unavailable/cross-scope returns safe `404`.
- **AC-20** Given an owned Pending or Active Attachment, when preview/download is requested, then the binary is available with correct inline/download behavior; given a Removed owned Attachment, metadata remains available while preview/download returns `410` and another deletion returns `404`.

- **AC-21** Given Requester A owns Tickets, when Requester A opens My Tickets, then only A's non-deleted Tickets are returned.
- **AC-22** Given Requester B attempts to access a Ticket or Attachment outside B's requester scope, when the request is processed, then the API returns the same centralized `404 Not Found` behavior used for an unavailable resource and does not disclose owner identity, cross-owner existence, or protected resource data.
- **AC-23** Given a valid but missing or malformed Ticket/Attachment public route identifier, when the resource route is requested, then the API returns centralized `404 Not Found` behavior.
- **AC-24** Given search text and whitelisted `searchFields`, when My Tickets search runs, then the supplied fields are OR-matched case-insensitively; the Lab 2 UI supplies Ticket Number/Summary/Description. A non-blank search without `searchFields` returns `400`, blank/whitespace search behaves as no search, and `searchFields` without active search is ignored.
- **AC-25** Given a Ticket filter expression using the Ticket-specific field/condition matrix, when Category/Related System/Priority/Status or another approved Ticket filter is applied, then the backend validates/maps it into a typed expression and combines expressions with `AND`; multi-value matches can use `IN`. Generic QueryBuilder capability does not expand the Ticket matrix.
- **AC-26** Given an unsupported Ticket field, disallowed Ticket field/condition combination, invalid nullable/non-nullable use, invalid enum value, invalid `IN` array shape, or failed type conversion, when list query validation occurs, then a direct API request returns `400` before the invalid query reaches QueryBuilder/Prisma data-access execution. Frontend filter restrictions are not sufficient validation.
- **AC-27** Given no explicit sort is supplied, when My Tickets loads, then Tickets are ordered by `createdAt DESC` and internal `id DESC`.
- **AC-28** Given the user chooses an approved sorting option, when the list is retrieved, then Ticket Number and Summary support both A-Z/Z-A directions and Priority supports HIGH-MEDIUM-LOW or LOW-MEDIUM-HIGH as selected.
- **AC-29** Given a page size from 1-100, when My Tickets is requested, then it is accepted; the UI offers 10, 20, 30, 50, and 100 and defaults to 10.
- **AC-30** Given a requested page is beyond the available range, when My Tickets is retrieved, then the API returns `200` with an empty `TicketListItemDTO[]` and valid browser-readable `X-Pagination` metadata.
- **AC-31** Given the filter modal is opened, when the user edits the multi-select Category, Related System, Priority, or Status draft and cancels, then applied filters do not change; when Apply is chosen, then the draft becomes active, removable chips/count update, and pagination resets to page 1.
- **AC-32** Given search or any filter is active, whether the list currently has results or no results, when Clear Filters is chosen, then search and filters are cleared, page is reset to 1, and the current sort is preserved.
- **AC-33** Given My Tickets is loading, when data is pending, then skeleton placeholders are shown and stale Ticket data from a previous Requester is not shown.
- **AC-34** Given the selected Requester has no Tickets, when My Tickets loads, then the reusable Empty State renders the empty-dataset content; given Tickets exist but search/filter returns none, then the same component renders no-results content.

- **AC-35** Given a supported desktop viewport, when Create Ticket, My Tickets, and Ticket Detail render, then the approved multi-column/table layout is usable without clipping or overlap.
- **AC-36** Given a tablet viewport, when the same screens render, then two-column layout is used where practical and long text fields remain usable.
- **AC-37** Given a mobile viewport, when the same screens render, then forms/detail fields stack appropriately, controls remain touch-friendly, My Tickets remains a responsive table showing Ticket Number, Summary, Priority, and Status, lower-priority columns are hidden, and there is no page-level horizontal scrolling.
- **AC-38** Given keyboard-only interaction, when the user navigates Requester selection, forms, filters, dialogs, pagination, and Attachment controls, then all required actions remain operable with visible focus and associated accessible labels/errors.
- **AC-39** Given a page-level ownership, missing-resource, Ticket-list load, or unexpected failure, when the frontend handles the error, then it uses the standalone `/error` experience with safe status-specific content, no application sidebar, no internal stack/database detail, and Back returns to `/tickets`; field/local operation validation remains near the relevant control where specified.
- **AC-40** Given any server request, when it is processed, then the response provides a browser-readable `X-Request-Id`, CORS exposes both `X-Request-Id` and `X-Pagination` and permits the approved Lab 2 request headers, and server logs can correlate method, route, status, request ID, and safe error information without logging secrets or Attachment binary data.
- **AC-41** Given no Requester is selected, when `GET /api/requesters` is called, then it can bootstrap the selector without `X-Requester-Id`; given any other Lab 2 endpoint, when Requester context is missing, malformed, non-positive, unknown, inactive, or deleted, then the API returns safe `400` behavior.
- **AC-42** Given two concurrent same-key/same-canonical-payload Ticket-create requests reference the same Pending Attachments, when both resolve, then the unique `PROCESSING` claim has exactly one owner before mutable validation or mutation, exactly one Ticket and one `COMPLETED` logical operation exist, each referenced Attachment is bound once, and the waiter/replay returns the same Ticket according to the approved `201`/`200` contract. A concurrent different-hash request returns `409 IDEMPOTENCY_CONFLICT` without creating or mutating resources.
- **AC-43** Given a Ticket-create attempt is ambiguous, when the Requester retries the unchanged canonical request with the same Idempotency Key, then completed replay returns `200` with the same Ticket and its now-Active Attachments without duplicate Ticket creation, re-upload, or rerunning Pending-state validation.
- **AC-44** Given files are selected on Create Ticket, when each valid pre-upload succeeds, then the UI identifies it as Pending rather than Active; Failed/Invalid/Uploading intended files block submit until retried or removed, and after atomic Ticket creation/binding every referenced file appears Active on Ticket Detail.
- **AC-45** Given an untouched empty Create Ticket form, Cancel may leave directly; given a dirty draft and/or known Pending Attachments, Cancel requests confirmation, and confirmed discard clears local draft/file state, performs best-effort cleanup of still-known Pending IDs, and returns to `/tickets` without endangering Active evidence.
- **AC-46** Given no valid Requester context is stored, when a requester-specific route is opened, then the UI redirects to `/requesters` before requester data renders; given a stored Requester context later produces the defined invalid-context `400`, then the frontend clears requester-specific state/context and redirects to `/requesters`.

- **AC-47** Given an existing Ticket has four Active Attachments, when two valid direct uploads race, then the Active count and Attachment insert are protected by one PostgreSQL `Serializable` transaction per attempt and the maximum-five rule produces exactly one `201`, one `409`, exactly one new Attachment, and five Active rows. Supported serialization/deadlock failures may use a small bounded randomized backoff for at most three total transaction attempts; exact retry-backoff milliseconds are intentionally implementation-defined and are not part of the Lab 2 wire/API contract. Validation, scope/not-found, business-limit, payload-size, unsupported-media, and other ordinary business errors are not retried. If all three attempts fail solely because of serialization/deadlock contention, the centralized safe result is `500 INTERNAL_SERVER_ERROR`; no Service Unavailable variant is introduced.
- **AC-48** Given expired Pending Attachments and logically expired `COMPLETED` Idempotency Records exist, when the idempotent maintenance CLI runs, then it uses safe batches, removes only eligible rows, never selects/deletes/reclaims `PROCESSING` rows, and can be rerun safely; request-time stale-claim recovery remains separate, and a concurrent Pending-binding race results in cleanup or binding but never deletion after Active binding.
- **AC-49** Given a populated Lab 1 Category table containing the repository-confirmed `id`, `name`, and `createdAt` columns, when the Lab 2 migration is applied, then the Category table is migrated in place without drop/recreate, existing `id`, `name`, and original `createdAt` values are preserved exactly, and existing valid rows receive `isActive = true`, `deleted = false`, `createdBy = seed`, `updatedBy = seed`, and `updatedAt` equal to their original preserved `createdAt`. The migration does not use migration-time or other nondeterministic timestamps for existing Category `updatedAt` values. A fresh database remains reproducible from migrations and seed.
- **AC-50** Given unauthenticated Requester bootstrap remains enabled, when Requester data is seeded/returned, then the existing full `DevelopmentRequesterDTO` contains synthetic development/test identities only; documentation states CORS is browser hardening rather than a security/privacy boundary and prohibits public deployment or real personal data.
- **AC-51** Given a completed Ticket create is replayed after an Attachment was added or removed, when the same original normalized payload/key is submitted before expiry, then the same Ticket identity returns with `200`, no duplicate is created, and the freshly reconstructed `TicketDTO` contains the current Attachment representation without changing the original request hash.
- **AC-52** Given a completed idempotency record, replay/conflict behavior applies while `now < completedAt + 24h`; at and after exact expiry the record is logically expired even if not physically deleted and the key may represent a new operation. Boundary tests cover immediately before, exactly at, after, expired-but-not-cleaned replacement, and concurrent reuse/cleanup without false uniqueness failure or duplicate creation.
- **AC-53** Given a Ticket-create result is ambiguous, when the page reloads before the conservative client deadline, then an explicit requester-scoped recovery action can reuse the stored original key/payload; the app never submits on load and clears recovery on success, terminal failure, discard, Requester change, or expiry.
- **AC-54** Given owned Pending/Active binary access, responses use derived MIME, `nosniff`, safe ASCII/RFC 5987 disposition filenames, `no-store`, and appropriate `Vary`; the client checks HTTP success, creates a temporary Blob URL, uses `AttachmentDTO.originalName` for downloads, and revokes every URL.
- **AC-55** Given an oversized Ticket-list query, when search exceeds 200 trimmed characters, filters exceed 20, search fields repeat/leave the whitelist, or `IN` contains outside 1-100 unique typed values, then `400 VALIDATION_ERROR` occurs before QueryBuilder/Prisma execution.
- **AC-56** Given Attachment persistence, PostgreSQL rejects invalid Pending/Active/Removed combinations, untrimmed/invalid Removed reasons, names outside 1-255 UTF-8 bytes, binary sizes outside 1-5,242,880 bytes, or `size_bytes` unequal to `octet_length(data)`.
- **AC-57** Given CORS configuration, exact allowed origins receive approved headers, disallowed origins do not, wildcard origin is absent, missing/invalid allowlist fails startup outside development/test, and origin-less API callers are not treated as authenticated or rejected merely by CORS.
- **AC-58** Given multipart or JSON input, exactly one valid non-empty bounded `file` part is accepted; missing/duplicate/unexpected/unsafe file input receives `400` or `413` as specified; JSON over 131,072 bytes receives `413`, malformed JSON within the limit receives `400 BAD_REQUEST`, and valid-shape field errors receive `400 VALIDATION_ERROR`.
- **AC-59** Given successful and failing requests containing sensitive marker values, structured logs contain only allowlisted correlation/transport/error fields plus operationally necessary opaque IDs and contain none of the prohibited markers, raw URLs/queries, headers, bodies, names/emails, filenames, binary data, SQL, database URLs, or complete Prisma metadata.
- **AC-60** Given requester-scoped or bootstrap responses and representative errors, `Cache-Control: no-store` is present and `Vary` safely includes `Origin` and `X-Requester-Id` where requester context affects representation.
- **AC-61** Given `/error` is opened with missing/invalid navigation state, then safe generic `500` content renders without arbitrary backend text; Back targets `/tickets` with valid Requester context and `/requesters` otherwise.
- **AC-62** Given Lab 2 E2E tooling is installed, then pinned local `@playwright/test` at the repository root coordinates `client/`, `server/`, PostgreSQL, Chromium, and approved viewports without npm workspaces or implicit `npx` downloads; pinned MSW remains in the client package.
- **AC-63** Given the committed Lab 2 migration, then fresh-schema evidence contains the approved unique, general Attachment-history, Active-count, Ticket-list, Pending-cleanup, idempotency-cleanup, and trigram indexes; acceptance does not depend on an exact PostgreSQL planner choice.
- **AC-64** Given the committed Lab 2 schema, when its tables are inspected and constraint boundaries are exercised, then every authoritative Prisma/PostgreSQL field type, nullability/default, primary/unique key, restrictive foreign key, Ticket trim/length/format check, Attachment byte/size/lifecycle check, Idempotency state/hash/expiry check, and required index in Section 7 is present and rejects invalid persisted states.
- **AC-65** Given canonical Ticket-create input, when the idempotency hash is computed and claims transition, then UTF-8 SHA-256 produces deterministic 64-character lowercase hexadecimal output, canonical lowercase UUID strings are sorted lexicographically ascending after validation and duplicate rejection, `[A,B]` equals `[B,A]` while different/duplicate sets behave as specified, only valid `PROCESSING` and `COMPLETED` database states persist, and a valid fenced claim transitions `PROCESSING -> COMPLETED` atomically with final mutable validation, Ticket creation, and binding while its claim-row lock remains held. With `PROCESSING_LEASE_SECONDS = 300`, fresh same-hash `PROCESSING` means `now < processingStartedAt + 300 seconds`, stale/reclaim-eligible begins at `now >= processingStartedAt + 300 seconds`, and two concurrent stale same-hash retries produce exactly one conditional reclaim owner with `processingStartedAt` reset, exactly one Ticket/binding result, and one normal waiter/replay; different-hash requests conflict whether the claim is fresh or stale. If an original slow owner resumes after reclaim with its old `processingStartedAt`, its fencing check fails before mutation and only the reclaim owner may create, bind, and complete.
- **AC-66** Given Create Ticket, Ticket Detail, badges, and Attachment states render, when automated UI contract tests inspect meaningful semantics/classes, then Create visibly contains non-editable generated Ticket Number/Date and selected Requester controls, editable/read-only/invalid/disabled/busy/button-hierarchy states are distinguishable, Ticket Detail remains read-only, status/priority retain visible text, and Pending/Active/Removed/Invalid/Failed Attachment states use their approved visual and semantic treatments without relying on color alone.

## 10. Definition of Done

### 10.1 Product Completion

Lab 2 is product-complete only when all of the following are true:

- All approved FR, BR, AC, API, data, UI, responsive, and accessibility requirements in the engineering contract are implemented.
- `specification.md`, `tests.md`, `ui-spec.md`, and `api-spec.md` are current and mutually consistent.
- Every Acceptance Criterion `AC-01` through `AC-66` maps to at least one planned test or explicit migration/delivery evidence in `tests.md`.
- Unit tests cover the reusable global QueryBuilder plus the resource-specific query validator/normalizer. Coverage includes every supported generic condition, including `ISNULL`, `ISNOTNULL`, and `IN`, valid type conversions, the complete Ticket-specific field/condition matrix, invalid field/condition/type combinations, multi-field search construction, and ordering construction. Resource-specific fixed predicates and pagination remain covered in their owning service/repository/API tests.
- Mocked API/integration tests cover PROCESSING claim-before-mutation, exact canonical SHA-256 hashing, fresh wait, the exact `now < processingStartedAt + 300 seconds` versus `now >= processingStartedAt + 300 seconds` stale same-hash reclaim boundary, stale different-hash conflict, exact lease fencing, old-owner no-mutation behavior, final mutable revalidation under the claim lock, Pending pre-upload, Ticket creation with sorted `attachmentIds`, atomic binding and claim completion, replay-before-mutable-state validation, current-state replay, CORS/header exposure, Requester context, safe scope-hiding `404`, `TicketListItemDTO`, list querying, Ticket Detail, existing-Ticket direct upload, Pending/Active preview/download, 24-hour expiry, limits, validation, mixed collection deletion, repeat-removal `404`, and Removed evidence.
- Focused real-PostgreSQL integration tests use only a guarded dedicated `TEST_DATABASE_URL` and prove authoritative field/check/FK/index constraints, unique PROCESSING claim ownership, same-key concurrency/binding, different-payload conflict, exactly-one-owner concurrent stale reclaim, old-owner fencing after reclaim, valid PROCESSING-to-COMPLETED transition, invalid idempotency-state rejection, Ticket-plus-binding rollback, and mixed Pending-hard-delete/Active-soft-remove rollback. They never fall back to development `DATABASE_URL`.
- UI tests cover sidebar/mobile navigation, Requester guards, visible generated Ticket Number/Date and Requester context, contract-significant editable/read-only/invalid/button/badge/Attachment presentation states, required controls, validation, busy states, list behavior, Pending pre-upload states and Retry, unresolved-file submit blocking, discard cleanup, `4xx` retention, `5xx` compensation/recovery, same-key ambiguous replay, Active-after-create behavior, batch removal, preview, and global errors.
- E2E testing covers at least:
  1. the full Requester golden path from Requester selection through Pending pre-upload, atomic Ticket creation/binding, My Tickets, Ticket Detail, search/filter, removal, and blocked Removed download;
  2. ambiguous same-key replay recovery after a committed Ticket/binding with no duplicate or forced re-upload; and
  3. a multi-Requester ownership path proving cross-scope direct access receives the safe `404`.
- Required visual checks/screenshots at desktop `1440x900`, tablet `820x1180`, and mobile `390x844` pass with no clipping, overlap, unintended horizontal scroll, hidden actions, or unreadable Attachment names.
- Client build/typecheck passes.
- Server build/typecheck passes.
- All unit, API/integration, UI, and required E2E tests pass from documented commands.
- No required test is skipped, disabled, commented out, or replaced by unrelated evidence.
- Prisma schema changes, committed migrations, PostgreSQL-specific index/extension migration SQL, and idempotent seeds reproduce a fresh database correctly.
- Current setup, migration, seed, run, and test commands are documented in README or the required Lab 2 documentation.
- Centralized logging is implemented with request correlation; logs do not contain Attachment binary data, secrets, database URLs, or unnecessarily sensitive full request payloads.
- Safe error mapping is used consistently for expected and unexpected failures.
- The application is documented and configured as a development/test-network-only, production-oriented Lab 2 system rather than production-ready or publicly deployable software.
- Locally pinned MSW and Playwright tooling is installed in the approved package locations; no required test command implicitly downloads its runner.

### 10.2 Course Delivery / Engineering Workflow

- Lab 2 work is decomposed into appropriate GitHub Issues.
- `lab2-staging` is created from completed Lab 1 `main`.
- Each Issue is implemented on its own feature branch.
- Each implementation Issue #18–#24 meets its focused-test close gate in
  `tests.md` before it is marked Done; Issue #25 reruns those tests as final
  regression coverage and does not substitute for the earlier gates.
- Feature branches enter `lab2-staging` through peer-reviewed Pull Requests.
- Review comments are addressed and required approvals are recorded.
- Integration testing is completed on `lab2-staging`.
- One release Pull Request merges `lab2-staging` into `main`.
- Development is not performed directly on `main` or `lab2-staging`.
- Required Lab 2 repository documents and screenshot artifacts are committed.
- The final `main` branch is the source of truth for grading evidence.

## 11. Assumptions and Decisions

1. **Temporary Requester context:** `X-Requester-Id` and the selector simulate identity only. They intentionally do not provide authentication/security guarantees; Lab 3 will replace this mechanism with real authentication.
2. **Opaque public identifiers:** Numeric primary keys remain internal for simple relationships/performance. Directly addressable resources expose UUID-based public identifiers so frontend URLs do not reveal sequential database IDs.
3. **Ticket Number vs public ID:** Ticket Number is the human-facing official business reference; `publicId` is the opaque route/API identity. They serve different purposes.
4. **Random Ticket Number suffix:** A 48-bit (12 hex character) random suffix removes the arbitrary daily capacity limit of a short sequential counter. Ticket Number formatting/generation is kept separate from persistence concerns; the Ticket creation workflow handles database unique-collision retries with a three-attempt bound.
5. **Business timezone:** Ticket Number date formatting uses `Asia/Bangkok`; persistent timestamps use PostgreSQL `TIMESTAMPTZ`.
6. **Audit actor strings:** `created_by`/`updated_by` intentionally store actor strings instead of foreign keys so future system/configuration/authentication actors can be represented without coupling every resource audit column to the current Development Requester table. Requester actions use email; seed/system actions use `seed`/`system`.
7. **`deleted` vs `isActive`:** `deleted` means logically removed from normal resource use. `isActive = false` means the master record still exists and remains historically readable but is unavailable for new selections.
8. **Attachment database storage:** Lab 2 stores Attachment binary content in PostgreSQL. `storageKey` keeps public storage identity independent from the physical storage implementation.
9. **Two-stage initial Attachment workflow:** `POST /api/attachments` pre-uploads one file as Pending. `POST /api/tickets` references the final prepared `attachmentIds` and atomically creates the Ticket plus binds every referenced Pending row. This prevents partial initial Ticket/Attachment success.
10. **Existing-Ticket direct upload:** `POST /api/tickets/:publicId/attachments` remains the distinct post-create operation that directly adds one Active Attachment to an already-created owned Ticket.
11. **Extension-only file acceptance:** Lab 2 accepts/rejects the fixed attachment types by normalized filename extension. More advanced file-signature validation is deferred.
12. **Global reusable QueryBuilder, simple Requester UI:** Lab 2 follows the reusable QueryBuilder pattern used by the provided reference implementations: a shared infrastructure/repository utility constructs generic filter, multi-field search, and order expressions from already validated/typed inputs, while each resource supplies/owns its field whitelist, field/condition permission matrix, typed conversions, search-field whitelist, fixed predicates, special domain semantics, and pagination. The Requester UI exposes only valid Ticket choices as a UX aid rather than a database-like advanced filter builder; direct API clients remain subject to backend validation.
13. **REST collection queries:** Ticket search/filter/sort/pagination remain `GET /api/tickets` query semantics. Search uses explicit `searchFields`; filters use a URL-encoded JSON array; the backend reconstructs validated query values into typed application objects instead of using a JSON-body search action endpoint.
14. **Centralized errors:** Common HTTP semantics use centralized codes such as `FORBIDDEN`, `NOT_FOUND`, `GONE`, and `CONFLICT`. More specific codes are reserved for behavior the frontend truly needs to distinguish, such as Idempotency Key conflicts.
15. **Malformed public route identifiers:** Malformed UUID/storage-key route values intentionally produce the same `404` behavior as a valid-but-missing public identifier. Body/query validation may still return `400` where the identifier is an explicit request field rather than a public route identity.
16. **PostgreSQL-specific search optimization:** `pg_trgm` GIN indexes are an accepted production-oriented PostgreSQL dependency for the approved case-insensitive substring/prefix/suffix search behavior.
17. **Reusable UI primitives:** Form and Empty State presentation is centralized through reusable components/props, but Lab 2 does not introduce a generic CRUD screen generator; each business screen retains explicit field and behavior definitions.

18. **Requester-context header scope:** `GET /api/requesters` is the only bootstrap endpoint without `X-Requester-Id`; all other Lab 2 endpoints require the temporary context even though it is not real authentication.
19. **Ticket DTO projections:** Ticket creation and detail share the full flattened `TicketDTO`. My Tickets uses `TicketListItemDTO` so retained Attachment history, Description, Requester data, and audit-only fields do not make list responses unnecessarily unbounded. Historical Category/System names remain present, and Description remains searchable without being returned.
20. **Unified Attachment collection deletion:** `DELETE /api/attachments/collection` hard-deletes Pending rows and soft-removes Active rows in one transactional/all-or-nothing operation. Reasons are ignored for Pending items and required per Active item.
21. **Approved UI references:** Lab Sheet/sample screenshots guide visual language, spacing, form/table density, and hierarchy only. `ui-spec.md` is the implementation contract and later-lab controls shown in illustrations are not part of Lab 2.
22. **QueryBuilder responsibility boundary:** The global QueryBuilder is a reusable query-expression utility, not a Ticket-specific service. It may support the approved generic operator vocabulary, but it receives only resource-validated/typed input and remains unaware of Ticket field whitelists, field/condition permissions, Requester ownership, `deleted = false`, semantic Priority ordering, Ticket-specific conversions/business rules, or pagination. Those responsibilities remain in Ticket validation/service/repository code. `IN`, `ISNULL`, and `ISNOTNULL` are part of the Lab 2 generic condition set even though the current Ticket matrix permits neither null-check operator.
23. **Handout and engineering-contract authority:** The Lab 2 handout's explicit normative requirements remain mandatory. Where the handout intentionally leaves implementation behavior open, or provides partial/illustrative API examples, screenshots, or payloads rather than a fixed contract, these Lab 2 engineering-contract documents record the approved implementation decision. The engineering contract must not weaken or override an explicit handout MUST requirement without documented instructor/course approval. Handout API snippets and payload examples remain partial and illustrative unless the handout explicitly states that an example is a fixed requirement; the approved wire details are recorded in `docs/lab-02/api-spec.md` within that authority boundary.
24. **Production-oriented boundary:** Lab 2 adopts production-quality correctness, migration, concurrency, validation, observability, and test practices, but remains non-public and not production-ready because identity is unauthenticated and file inspection is extension-based.
25. **Full synthetic Requester DTO:** The bootstrap keeps the full resource DTO for Lab 2 consistency. This is acceptable only with synthetic identities; CORS is not the reason the data is safe.
26. **Current-state idempotent replay:** The idempotency record retains Ticket identity rather than a serialized response snapshot. Replay reconstructs current `TicketDTO` state while comparing only the immutable normalized original create request.
27. **External maintenance scheduling:** Lab 2 supplies a safe idempotent cleanup command, not an application timer or deployment scheduler.
28. **Generic QueryBuilder retained:** The broader generic operator vocabulary remains intentional reference infrastructure for future labs/projects, while resource validators enforce concrete field/operator/type/cardinality limits.
29. **Pinned repository-wide E2E tooling:** A minimal private root package is approved solely for pinned Playwright orchestration across client/server/database; it does not create a workspace or relocate application dependencies.
