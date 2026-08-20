# Lab 2 Sprint Engineering Specification

## 1. Sprint Goal

Deliver the Requester-facing TokTickIT MVP for Lab 2. A selected Development Requester must be able to create an IT support Ticket with supporting Attachments, receive a backend-generated official Ticket Number, find and inspect their own Tickets, search/filter/sort/page through My Tickets, and manage permitted Attachments. The sprint also establishes a reusable Zen Green UI foundation, a production-oriented REST API contract, a traceable data model, and automated evidence that Requester ownership and failure behavior are enforced.

## 2. Stakeholder Request Interpretation

Lab 2 introduces the first complete Requester workflow before real authentication exists. The Development Requester selector is therefore a temporary testing context only; it must not be presented or implemented as secure authentication.

The implementation must provide four main Requester experiences:

1. select the current Development Requester;
2. create a Ticket and optionally pre-upload supporting Attachments;
3. locate and inspect the selected Requester's own Tickets; and
4. add, preview/download, and soft-remove permitted Attachments.

The system must preserve ownership separation in the backend, not only in the UI. It must also define reusable data, API, validation, loading, empty, error, logging, and responsive conventions that later labs can extend.

## 3. Scope

### Included

- Development Requester Selection screen for Lab 2 testing.
- Requester context stored for the browser session.
- Change Requester behavior.
- Create Ticket screen and Ticket submission workflow.
- Backend-generated official Ticket Number and backend-authoritative Ticket Date (`createdAt`), displayed after creation.
- Required Category, Related System, Requested Priority, Summary, and Description fields.
- Initial Ticket status of `NEW`.
- Pre-uploaded pending Attachments and later binding to a Ticket.
- Adding an Attachment to an existing Ticket.
- My Tickets list for the selected Requester only.
- Search, filtering, sorting, and pagination.
- Requester-owned Ticket Detail.
- Active and removed Attachment metadata.
- Attachment preview/download for owned pending and active Attachments; removed Attachments are unavailable for binary access.
- Batch Attachment removal with per-active-Attachment removal reasons; pending/orphan cleanup and active soft removal share one collection operation.
- Pending Attachment expiration and orphan cleanup.
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

## 4. Functional Requirements

- **FR-01** The application shall provide a Development Requester Selection screen before Requester-specific Ticket screens are used.
- **FR-02** The selector shall load only Development Requesters where `deleted = false` and `isActive = true`.
- **FR-03** The selected Development Requester shall be stored in `sessionStorage` and shown by name in the application shell.
- **FR-04** If no valid Requester context exists, direct access to Requester-specific pages shall redirect to `/requesters`.
- **FR-05** Changing Requester shall clear Requester-specific UI state before loading data for the newly selected Requester.
- **FR-06** If the stored Requester later becomes inactive or invalid, the frontend shall clear the stored selection and return to Requester Selection.

- **FR-07** The Create Ticket screen shall show only Requester-editable Category, Related System, Summary, Requested Priority, Description, and Attachment controls before submission. Backend-generated Ticket Number, Ticket Date (`createdAt`), Current Status, public ID, and audit fields are shown only after creation on Ticket Detail.
- **FR-08** The Requester shall be able to pre-upload permitted Attachments before submitting the Ticket.
- **FR-09** The frontend shall retain each successful pending Attachment identifier and include those identifiers in the Ticket creation request.
- **FR-10** The backend shall validate all referenced pending Attachments and bind them to the new Ticket in the same database transaction as Ticket creation.
- **FR-11** On successful Ticket creation, the frontend shall navigate to the new Ticket Detail screen and clearly display the official Ticket Number.
- **FR-12** The frontend shall prevent duplicate button submissions while a logical Ticket submission is in progress. An unchanged logical retry shall reuse the same Idempotency Key; if the user changes any logical request value after a failed attempt, including `attachmentIds` after re-upload, the frontend shall generate a new Idempotency Key before resubmission.

- **FR-13** My Tickets shall return only Tickets owned by the selected Development Requester.
- **FR-14** My Tickets shall support case-insensitive search using client-supplied, whitelisted search fields. The Lab 2 UI searches Ticket Number, Summary, and Description by sending those three `searchFields`.
- **FR-15** My Tickets shall support filtering by Category, Related System, Requested Priority, and Current Status.
- **FR-16** The backend query layer shall use reusable generic query-building utilities for validated filter, multi-field search, and ordering expressions, while each resource remains responsible for its own allowed-field/type rules, fixed predicates, and pagination behavior.
- **FR-17** My Tickets shall support Newest, Oldest, Ticket Number A-Z, Ticket Number Z-A, Summary A-Z, Summary Z-A, Priority High-to-Low, and Priority Low-to-High sorting.
- **FR-18** My Tickets shall support 1-based pagination and configurable page size.
- **FR-19** My Tickets shall provide separate empty-dataset and no-results presentations through one reusable Empty State component configured by props.
- **FR-20** My Tickets shall show skeleton loading states and shall never show stale data from a previously selected Requester while new Requester data is loading.

- **FR-21** Ticket Detail shall retrieve and display one Ticket only when it belongs to the selected Requester.
- **FR-22** Ticket Detail shall present Ticket information as read-only in Lab 2.
- **FR-23** Ticket Detail shall list active and soft-removed Attachment metadata.
- **FR-24** The Requester shall be able to add a permitted Attachment to an existing owned Ticket.
- **FR-25** The Requester shall be able to preview/download owned pending and active supported images/PDFs. Removed Attachments shall not expose binary preview/download.
- **FR-26** The Requester shall be able to select one or more owned active Attachments and remove them as one all-or-nothing batch only after entering a valid removal reason for each selected active Attachment.
- **FR-27** Removed Attachments shall remain visible as metadata but shall not be previewable or downloadable.

- **FR-28** Every Lab 2 API endpoint except the Development Requester bootstrap endpoint `GET /api/v1/requesters` shall require the temporary Requester context through `X-Requester-Id`.
- **FR-29** The backend shall enforce Requester ownership independently of frontend routing or UI state.
- **FR-30** The API shall use a centralized safe error response format and shall not expose stack traces, raw SQL, database credentials, or internal database error details.
- **FR-31** The server shall generate or propagate an `X-Request-Id` for request correlation and return it in the response.
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
- **BR-16** A cross-owner Ticket or Attachment access attempt produces `403 Forbidden` without returning the protected resource data.
- **BR-17** When Requester context changes, Requester-specific caches, list state, detail state, form state, and drafts that could reveal the previous Requester's data must be cleared before the new data is rendered.

### 5.2 Ticket Creation and Idempotency Rules

- **BR-18** `POST /api/v1/tickets` requires an `Idempotency-Key` generated by the frontend for one logical submission. The key must be a valid UUID.
- **BR-19** The same Requester using the same Idempotency Key with the same normalized logical payload shall not create a second Ticket. The first successful request returns `201 Created`; a completed replay returns `200 OK` with the same Ticket DTO. If an identical same-key request arrives while the first is still in flight, it waits within the normal HTTP request timeout and receives `200 OK` with the same Ticket after the first succeeds.
- **BR-20** Reusing the same Idempotency Key with a different request payload returns `409 Conflict` with code `IDEMPOTENCY_CONFLICT`.
- **BR-21** Idempotency records are persisted in PostgreSQL, unique by `(requesterId, key)`, store a canonical normalized request hash and resulting Ticket reference, and expire after 24 hours. `4xx` and `5xx` failures are not retained as permanently completed idempotency results; a concurrent identical waiter receives the same failure outcome for that in-flight attempt.
- **BR-22** Validation/business failures retain current form values and valid pending Attachment references so the Requester can correct and retry. Retrying an unchanged logical payload reuses the current Idempotency Key. If the user changes any logical payload value before retrying—including Category, Related System, Summary, Requested Priority, Description, or `attachmentIds` after removing/re-uploading files—the frontend must generate a new Idempotency Key before the next `POST /api/v1/tickets`.
- **BR-23** Unexpected server failures retain text/select values and trigger best-effort compensation for still-pending Attachments. Attachments confirmed deleted by compensation remain visible with a Retry Upload state. If Ticket creation completion is ambiguous, the frontend retries the unchanged logical request with the same Idempotency Key so that an already-completed Ticket can be recovered without re-uploading or removing bound Attachments.
- **BR-24** Cleanup may hard-delete only an Attachment whose `ticketId` is still null. A cleanup request must never delete an Attachment that has already been bound to a Ticket, even if the client incorrectly believes Ticket creation failed.
- **BR-25** Cancel/discard of the Create Ticket form requires confirmation when the draft contains entered values and/or known pending Attachments. Known pending Attachments still associated with the draft are cleaned up; already-removed client entries may be left for expiration cleanup.

### 5.3 Search, Filter, Sort, and Pagination Rules

- **BR-26** Search is case-insensitive across the client-supplied whitelisted `searchFields`. The Lab 2 UI sends `ticketNumber,summary,description`; multiple search fields are combined with logical `OR`.
- **BR-27** Search input is trimmed; a blank value after trimming is treated as no search filter. A non-blank `search` requires `searchFields`; `searchFields` supplied without a non-blank `search` is ignored.
- **BR-28** The external `filters` query parameter is a URL-encoded JSON array. After parsing, validation, and mapping, filters are represented internally as typed `{ field, condition, value }` expressions.
- **BR-29** Supported generic conditions are `CONTAINS`, `STARTWITH`, `ENDWITH`, `EQUAL`, `NOTEQUAL`, `GREATER`, `LESSER`, `GREATEROREQUAL`, `LESSEROREQUAL`, `ISNULL`, `ISNOTNULL`, and `IN`.
- **BR-30** Search-field matches form one `OR` group, and that group is combined with every filter expression using logical `AND`. Filter expressions are also combined with `AND`. `IN` is used for multi-value matching without nested `OR` groups.
- **BR-31** Resource-specific request/query validation shall whitelist allowed query fields and conditions and reject incompatible field/condition combinations before invalid input reaches service/repository query execution. A reusable global QueryBuilder utility may only receive validated/normalized query data and must not be used to bypass the resource-specific whitelist.
- **BR-32** HTTP query-string values are mapped to typed application query values before the Ticket service is called. Conversion includes approved number, date, enum, boolean, and multi-value conversions. Failed conversion produces `400 Bad Request`. After validation/normalization, repository code may use the reusable QueryBuilder to construct generic Prisma filter/search/order expressions from those trusted values.
- **BR-33** String search/filter conditions are case-insensitive.
- **BR-34** Default Ticket list ordering is `createdAt DESC`, then internal `id DESC` as the deterministic secondary sort.
- **BR-35** Priority sorting supports both High-to-Low (`HIGH`, `MEDIUM`, `LOW`) and Low-to-High (`LOW`, `MEDIUM`, `HIGH`).
- **BR-36** Pagination is 1-based. Default page size is 10.
- **BR-37** The backend accepts page sizes from 1 through 100. The frontend exposes 10, 20, 30, 50, and 100.
- **BR-38** Requesting a page beyond the final page returns `200 OK` with an empty collection.
- **BR-39** Invalid list query parameters return `400 Bad Request` with safe validation details.
- **BR-40** Pagination metadata is returned in `X-Pagination` and contains `pageNumber`, `pageSize`, `totalItems`, `totalPages`, `hasPreviousPage`, and `hasNextPage`.
- **BR-41** The global Clear Filters action clears search and applied filters, resets to page 1, and preserves the current sort.
- **BR-42** Search requests are triggered by a `400 ms` debounced live-search interaction. Filter modal changes are draft-only until Apply Filters is chosen.
- **BR-43** Applying filters resets pagination to page 1. Cancel discards draft filter changes. Reset clears the modal's draft filter values; the reset becomes active only after Apply Filters.

### 5.4 Attachment Rules

- **BR-44** Permitted attachment extensions are JPG/JPEG, PNG, WEBP, and PDF.
- **BR-45** Attachment type validation is based on normalized filename extension only for Lab 2. Deep signature/magic-byte validation is outside the approved Lab 2 scope. The backend derives the response MIME type from the approved extension rather than trusting multipart MIME as the acceptance authority.
- **BR-46** Maximum attachment size is 5 MB per file.
- **BR-47** A Ticket may have at most five active (`deleted = false`) Attachments. Soft-removed Attachments do not count toward this limit.
- **BR-48** Duplicate original filenames are allowed because storage identity is independent from the original filename.
- **BR-49** Attachment binary content is stored in PostgreSQL. The original filename is retained as metadata and a generated UUID storage key is used as the opaque public Attachment identifier.
- **BR-50** Each successful pre-upload creates one pending Attachment with `ticketId = null`, `deleted = false`, and ownership tied to the uploading Development Requester.
- **BR-51** Before binding pending Attachments to a new Ticket, the backend validates that every referenced Attachment exists, belongs to the selected Requester, is still pending, is not deleted, has not expired, and is not already bound to another Ticket.
- **BR-52** Ticket creation and binding of referenced pending Attachments occur in one database transaction. A bind failure rolls back the new Ticket and binding changes; previously uploaded pending Attachment rows remain pending for retry/cleanup.
- **BR-53** One Attachment record may belong to only one Ticket. Attempting to reuse an already-bound pending identifier returns `409 Conflict`.
- **BR-54** Pending Attachments expire after 24 hours. An expired orphan Attachment with `ticketId = null` has no business/audit value and may be hard-deleted, including its binary data.
- **BR-55** Removing an Attachment entry from the Create Ticket UI does not immediately delete the pending database row. The entry is removed from client state and normal 24-hour orphan cleanup handles the unused row.
- **BR-56** Adding an Attachment to an existing Ticket uses the Ticket Attachment nested endpoint and directly associates the validated upload with the owned Ticket.
- **BR-57** Pending/orphan cleanup and active Attachment removal use `DELETE /api/v1/attachments/collection`. The batch contains 1-100 unique Attachment IDs. Pending owned Attachments are hard-deleted; active owned Attachments are soft-removed and each active item requires its own trimmed 3-200 character removal reason.
- **BR-58** Attachment collection deletion is all-or-nothing. The backend validates the complete batch before mutating any row and commits all hard-delete/soft-delete changes in one database transaction. Active soft removal sets `deleted = true`, stores that item's `removalReason`, updates shared audit fields, and retains binary/metadata.
- **BR-59** A removed Attachment remains retrievable as metadata but preview and download are blocked. Attempting to delete an already removed Attachment again returns `404 Not Found` and causes the whole batch to remain unchanged.
- **BR-60** Owned pending and active JPG/JPEG/PNG/WEBP images and PDFs support browser preview where supported through a dedicated preview endpoint and a separate download endpoint.
- **BR-61** Invalid files in a multi-file selection are rejected individually; valid files may continue uploading.
- **BR-62** Unsupported extensions return `415 Unsupported Media Type`.
- **BR-63** Files larger than 5 MB return `413 Content Too Large`.
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
- The pre-submit form shows only Requester-editable fields; it does not show fake placeholders for Ticket Number, Ticket Date, Current Status, public ID, or audit values before creation.
- Summary and Description always show character counters. Description has an approximately 140 px minimum height and supports vertical resize without breaking layout.
- Submit is disabled and visibly busy while processing. Busy buttons retain their original action text and add a spinner.
- Cancel/discard requires confirmation when the draft contains entered values and/or known pending uploads; confirmed discard clears the draft, performs best-effort cleanup of known pending Attachment IDs, and returns to `/tickets`.
- Successful creation navigates to Ticket Detail and prominently presents the official Ticket Number.
- A `400` validation response keeps the form and valid pending Attachments, shows field-level errors, and focuses the first invalid field.
- A `5xx` response preserves non-file fields, safely cleans up still-pending binaries where possible, and retains filename rows/cards with a Retry Upload state.
- Per-file lifecycle/state presentation explicitly distinguishes Uploading, Invalid/Failed, Pending (`ticketId = null` after successful pre-upload), Active (bound and not deleted), and Removed (bound and soft-deleted). A Create Ticket pending file must not be labeled Active before Ticket binding succeeds.

### 6.4 My Tickets

- Uses a table on desktop and a responsive table on smaller screens; it does not switch to a mobile card layout.
- Desktop columns are Ticket Number, Summary, Category, Related System, Priority, Status, and Created At.
- At mobile widths the table keeps Ticket Number, Summary, Priority, and Status and hides lower-priority columns without page-level horizontal scrolling.
- The full row is mouse- and keyboard-operable for opening Ticket Detail.
- Provides Create Ticket, search, Filters, Sort, Clear Filters, and pagination.
- Search is live with a `400 ms` debounce and searches Ticket Number, Summary, and Description through the API `searchFields` contract.
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
- Images/PDFs preview in an in-app modal and active/pending permitted files may be downloaded according to the API contract.
- Attachment presentation distinguishes Uploading, Failed, Invalid, Pending, Active, and Removed; a successful Create Ticket pre-upload is Pending until binding succeeds.
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

### 7.2 Shared Audit Convention

All persistent resource tables include:

| PostgreSQL | Prisma | Type / Rule |
|---|---|---|
| `created_by` | `createdBy` | `VARCHAR(255)`, required |
| `created_at` | `createdAt` | `TIMESTAMPTZ`, required |
| `updated_by` | `updatedBy` | `VARCHAR(255)`, required |
| `updated_at` | `updatedAt` | `TIMESTAMPTZ`, required |

Business resources additionally include `deleted BOOLEAN NOT NULL DEFAULT false`.

Master/reference resources additionally include `is_active BOOLEAN NOT NULL DEFAULT true`.

### 7.3 Development Requester

Table: `development_requester`

Core fields:

- `id` - auto-increment numeric primary key.
- `name` - required.
- `email` - required and unique.
- `is_active` - required, default true.
- `deleted` - required, default false.
- shared audit fields.

Relationships: one Development Requester owns many Tickets and may upload many pending/active Attachments.

### 7.4 Category

Table: `category`

Core fields:

- `id` - auto-increment numeric primary key.
- `name` - required and unique.
- `is_active` - required, default true.
- `deleted` - required, default false.
- shared audit fields.

The existing Lab 1 Category model is migrated rather than replaced.

### 7.5 Related System

Table: `related_system`

Core fields:

- `id` - auto-increment numeric primary key.
- `name` - required and unique.
- `is_active` - required, default true.
- `deleted` - required, default false.
- shared audit fields.

No direct Category relationship is required in Lab 2.

### 7.6 Ticket

Table: `ticket`

Core fields:

- `id` - auto-increment numeric internal primary key.
- `public_id` - UUID, required, unique, generated by backend/database layer.
- `ticket_number` - required, unique.
- `requester_id` - required foreign key to Development Requester.
- `category_id` - required foreign key to Category.
- `related_system_id` - required foreign key to Related System.
- `summary` - required.
- `requested_priority` - required `RequestedPriority` enum.
- `description` - required.
- `current_status` - required `TicketStatus` enum with Lab 2 value `NEW`.
- `deleted` - required, default false.
- shared audit fields; `created_at` is the authoritative Ticket Date.

Enums:

```text
RequestedPriority = LOW | MEDIUM | HIGH
TicketStatus       = NEW
```

### 7.7 Attachment

Table: `attachment`

Core fields:

- `id` - auto-increment numeric internal primary key.
- `storage_key` - UUID, required, unique, public Attachment identifier.
- `ticket_id` - nullable foreign key to Ticket; null means pending upload.
- `uploaded_by_requester_id` - required foreign key to Development Requester for pending ownership validation.
- `original_name` - required.
- `extension` - required.
- `mime_type` - stored metadata used for response/preview behavior; not the Lab 2 acceptance authority for file type.
- `size_bytes` - required.
- `data` - required PostgreSQL binary (`BYTEA` / Prisma `Bytes`).
- `removal_reason` - nullable; required when a bound active Attachment is soft-removed.
- `deleted` - required, default false.
- shared audit fields.

Derived lifecycle:

- pending: `ticket_id IS NULL AND deleted = false`;
- active: `ticket_id IS NOT NULL AND deleted = false`;
- removed: `ticket_id IS NOT NULL AND deleted = true`.

No separate lifecycle status column is required.

### 7.8 Idempotency Record

Table: `idempotency_record`

Core fields:

- `id` - auto-increment numeric primary key.
- `requester_id` - required foreign key.
- `key` - required.
- `request_hash` - required.
- `ticket_id` - nullable/required after successful completion as appropriate to implementation state.
- `expires_at` - required.
- audit timestamps/actors as persistent technical audit fields.

Constraint: unique composite `(requester_id, key)`.

Idempotency records are technical records and are hard-deleted after expiration rather than soft-deleted.

### 7.9 Indexes and PostgreSQL Features

Enable:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

Required/justified indexes include:

- unique `ticket(ticket_number)`;
- unique `ticket(public_id)`;
- `ticket(requester_id, created_at)` for requester list/default ordering;
- `ticket(category_id)`;
- `ticket(related_system_id)`;
- `ticket(requested_priority)`;
- `ticket(current_status)`;
- `attachment(ticket_id)`;
- `attachment(uploaded_by_requester_id, ticket_id)`;
- unique `attachment(storage_key)`;
- unique `idempotency_record(requester_id, key)`;
- GIN trigram indexes on `ticket_number`, `summary`, and `description` to support case-insensitive substring/prefix/suffix search efficiently.

PostgreSQL-specific extensions/indexes that Prisma cannot fully express may be added through committed SQL in the Prisma migration.

### 7.10 Seed Data

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

Seed-created records use `created_by = "seed"` and `updated_by = "seed"`.

### 7.11 Migration Rule

All schema changes must be delivered through committed Prisma migrations. `prisma db push` alone is not sufficient for completion. A fresh database must be reproducible from migrations plus the idempotent seed.

## 8. API Contract

Detailed wire serialization and full DTO schemas belong in `docs/lab-02/api-spec.md`. All Lab 2 API routes use base path `/api/v1`. Successful JSON responses return a resource or resource array directly rather than a mandatory `{ "data": ... }` envelope. JSON fields use camelCase and timestamps are ISO-8601 UTC strings.

### 8.1 Request Context and Cross-Cutting Headers

`GET /api/v1/requesters` is the bootstrap exception and does not require a Requester context.

Every other Lab 2 endpoint requires:

```http
X-Requester-Id: <positive-development-requester-id>
```

The header behaves operationally like the current Lab 2 Requester context/session but is not authentication, an authorization token, or a security credential. Missing, malformed, non-positive, unknown, inactive, or deleted Requester context returns `400`; a valid Requester accessing another Requester's owned resource returns `403`.

Ticket creation additionally requires a valid UUID:

```http
Idempotency-Key: <uuid>
```

Every request receives a correlation ID. A valid incoming UUID `X-Request-Id` is reused; missing/malformed values are replaced by a server-generated UUID. Every response returns the resolved `X-Request-Id`.

### 8.2 Reference Data

```http
GET /api/v1/requesters
GET /api/v1/categories
GET /api/v1/related-systems
```

Successful response: `200 OK` with a direct DTO array. These list APIs return only `deleted = false` and `isActive = true` resources, while each returned master DTO contains its normal resource fields including audit/lifecycle fields. Categories and Related Systems require `X-Requester-Id`; the Requester bootstrap endpoint does not.

### 8.3 Create Ticket

```http
POST /api/v1/tickets
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
  "attachmentIds": ["<attachment-storage-key>"]
}
```

`attachmentIds` may be omitted or empty. Requester ID, public ID, Ticket Number, Current Status, timestamps, deletion flag, and audit fields are backend-derived/generated.

Success:

- first successful creation: `201 Created` with one complete `TicketDTO`;
- completed same Requester/key/same normalized payload replay: `200 OK` with the same `TicketDTO`;
- concurrent identical same-key request waits for the in-flight request within normal HTTP timeout, then returns `200` with the same Ticket after the first succeeds;
- same Requester/key with a different payload: `409 Conflict` with `IDEMPOTENCY_CONFLICT`.

`4xx`/`5xx` failures are not permanently cached as completed idempotency results.

### 8.4 Shared Ticket DTO

Ticket creation, Ticket list, and Ticket Detail share the same flattened `TicketDTO`. Related resources are represented through fields such as `requesterId`, `requesterName`, `requesterEmail`, `categoryId`, `categoryName`, `relatedSystemId`, and `relatedSystemName` rather than nested relation objects. The DTO includes Attachment metadata and audit/lifecycle fields. There is no separate `ticketDate` property; `createdAt` is the authoritative Ticket Date.

### 8.5 My Tickets

```http
GET /api/v1/tickets
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

Successful response: `200 OK` with `TicketDTO[]` and:

```http
X-Pagination: {"pageNumber":1,"pageSize":10,"totalItems":47,"totalPages":5,"hasPreviousPage":false,"hasNextPage":true}
```

An out-of-range page returns `200 OK` with `[]` and valid pagination metadata.

### 8.6 Ticket Detail

```http
GET /api/v1/tickets/:publicId
X-Requester-Id: <id>
```

- owned non-deleted Ticket: `200 OK` with `TicketDTO`;
- cross-owner Ticket: `403 Forbidden`;
- missing, logically deleted, or malformed public route identifier: centralized `404 Not Found`.

### 8.7 Pending Attachment Upload

```http
POST /api/v1/attachments
X-Requester-Id: <id>
Content-Type: multipart/form-data
```

One request uploads exactly one multipart field named `file`. Success: `201 Created` with the full `AttachmentDTO`. The public `attachmentId` is the opaque `storageKey`, never the numeric internal ID.

### 8.8 Add Attachment to Existing Ticket

```http
POST /api/v1/tickets/:publicId/attachments
X-Requester-Id: <id>
Content-Type: multipart/form-data
```

One multipart `file` is directly validated and bound to the owned Ticket. Success: `201 Created` with `AttachmentDTO`.

### 8.9 Attachment Metadata, Preview, and Download

```http
GET /api/v1/attachments/:storageKey
GET /api/v1/attachments/:storageKey/preview
GET /api/v1/attachments/:storageKey/download
X-Requester-Id: <id>
```

Metadata uses the same `AttachmentDTO` for pending, active, and removed states and returns `200 OK` for owned metadata.

Owned pending and active preview/download return binary `200` responses. Preview uses `Content-Disposition: inline`; download uses `Content-Disposition: attachment`. MIME is derived by the backend from the approved extension. Removed preview/download returns `410 Gone`. Cross-owner access returns `403`; missing/hard-deleted/malformed public route identity returns `404`.

### 8.10 Attachment Collection Delete / Cleanup

```http
DELETE /api/v1/attachments/collection
X-Requester-Id: <id>
Content-Type: application/json
```

Conceptual request:

```json
{
  "items": [
    { "attachmentId": "uuid-a", "reason": "" },
    { "attachmentId": "uuid-b", "reason": "Uploaded the wrong document." }
  ]
}
```

The request contains 1-100 unique Attachment IDs and may mix pending and active items. The backend determines persisted lifecycle per item:

- pending owned Attachment: hard-delete row and binary; reason is ignored;
- active bound owned Attachment: soft-remove and require that item's trimmed 3-200 character reason;
- already removed Attachment: `404 Not Found`.

The entire collection operation is validated first and is all-or-nothing. If any item is invalid, missing, forbidden, already removed, or has an invalid required reason, no item is mutated. Successful mutations commit in one database transaction and return `204 No Content`.

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
- `INTERNAL_SERVER_ERROR` - 500.

A specific code is allowed where the frontend must distinguish protocol behavior, such as `IDEMPOTENCY_CONFLICT`.

Attachment status mapping includes unsupported extension `415`, file larger than 5 MB `413`, active-limit conflict `409`, removed preview/download `410`, and re-delete of an already removed Attachment `404`.

Raw PostgreSQL/Prisma errors, stack traces, secrets, raw SQL, and binary content are never returned to the client.

## 9. Acceptance Criteria

- **AC-01** Given no valid Development Requester is selected, when the user opens a Requester-specific route, then the application redirects to `/requesters` and does not render Requester Ticket data.
- **AC-02** Given active and inactive/non-deleted Requesters exist, when Requester Selection loads, then only active and non-deleted Requesters appear and the UI clearly states that the selector is for Lab 2 testing rather than authentication.
- **AC-03** Given a Requester is selected, when the user continues, then the Requester name is shown in the shell and the selection is retained in `sessionStorage` for the browser session.
- **AC-04** Given Requester A is currently selected, when the user changes to Requester B, then A-specific UI state is cleared before B-specific data is displayed.
- **AC-05** Given the stored Requester becomes inactive or invalid, when the app validates/uses that context, then it clears the selection and returns to Requester Selection.

- **AC-06** Given valid Ticket fields and zero to five valid pending Attachments, when the Requester submits the Ticket, then exactly one Ticket is created with status `NEW`, the pending Attachments are bound, and the UI navigates to Ticket Detail showing the generated Ticket Number.
- **AC-07** Given a created Ticket, when its Ticket Number is inspected, then it matches `TKT-YYYYMMDD-RRRRRRRRRRRR`, the date uses `Asia/Bangkok`, the suffix is 12 uppercase hex characters, and the value is unique.
- **AC-08** Given Summary shorter than 3 or longer than 150 characters after trimming, when submission is attempted, then validation fails and no invalid Ticket is created.
- **AC-09** Given Description shorter than 10 or longer than 2000 characters after trimming, when submission is attempted, then validation fails and no invalid Ticket is created.
- **AC-10** Given Category, Related System, or Requested Priority is missing/invalid/inactive/deleted, when submission is attempted, then validation fails and the current form values remain available for correction.
- **AC-11** Given the same Requester repeats the same Ticket creation payload with the same Idempotency Key after successful creation, when the retry reaches the backend, then no duplicate Ticket is created and the existing Ticket is returned.
- **AC-12** Given an Idempotency Key was used with one payload, when the same Requester reuses the key with a different payload, then the API returns `409` with `IDEMPOTENCY_CONFLICT`.

- **AC-13** Given a permitted file <= 5 MB is selected, when pre-upload succeeds, then PostgreSQL stores one pending Attachment and the frontend receives its opaque storage key.
- **AC-14** Given a file with an unsupported extension, when upload is attempted, then the API returns `415` and does not create a usable Attachment.
- **AC-15** Given a file larger than 5 MB, when upload is attempted, then the API returns `413` and does not create a usable Attachment.
- **AC-16** Given a multi-file selection contains valid and invalid files, when files are processed, then invalid files show their own errors while valid files can continue uploading.
- **AC-17** Given an Attachment is pending for longer than 24 hours without being bound to a Ticket, when orphan cleanup runs, then the pending record and binary may be hard-deleted.
- **AC-18** Given a Ticket has five active Attachments, when another Attachment is added, then the API returns `409`; after one Attachment is soft-removed, one replacement Attachment can be added.
- **AC-19** Given one or more selected active owned Attachments, when the Requester supplies a valid 3-200 character reason for each selected item and confirms batch removal, then `DELETE /api/v1/attachments/collection` returns `204`, all selected active Attachments are soft-removed in one transaction, their binaries/metadata are retained, and each reason/audit update is persisted. If any item in the batch is invalid, missing, forbidden, already removed, or has an invalid required reason, no item is modified.
- **AC-20** Given an owned pending or active Attachment, when preview/download is requested, then the binary is available with the correct inline/download behavior; given a removed owned Attachment, when metadata is requested, then metadata is returned, while preview/download returns `410` with no binary and another delete attempt returns `404`.

- **AC-21** Given Requester A owns Tickets, when Requester A opens My Tickets, then only A's non-deleted Tickets are returned.
- **AC-22** Given Requester B is selected, when B requests a Ticket or Attachment owned by A, then the backend returns `403` and does not return the protected resource data.
- **AC-23** Given a valid but missing or malformed Ticket/Attachment public route identifier, when the resource route is requested, then the API returns centralized `404 Not Found` behavior.
- **AC-24** Given search text and whitelisted `searchFields`, when My Tickets search runs, then the supplied fields are OR-matched case-insensitively; the Lab 2 UI supplies Ticket Number/Summary/Description. A non-blank search without `searchFields` returns `400`, blank/whitespace search behaves as no search, and `searchFields` without active search is ignored.
- **AC-25** Given supported filter expressions, when Category/Related System/Priority/Status filters are applied, then the backend validates/maps them into typed expressions and combines the expressions with `AND`; multi-value matches can use `IN`.
- **AC-26** Given an incompatible field/condition/type conversion, when list query validation occurs, then the API returns `400` before the invalid query reaches the database layer.
- **AC-27** Given no explicit sort is supplied, when My Tickets loads, then Tickets are ordered by `createdAt DESC` and internal `id DESC`.
- **AC-28** Given the user chooses an approved sorting option, when the list is retrieved, then Ticket Number and Summary support both A-Z/Z-A directions and Priority supports HIGH-MEDIUM-LOW or LOW-MEDIUM-HIGH as selected.
- **AC-29** Given a page size from 1-100, when My Tickets is requested, then it is accepted; the UI offers 10, 20, 30, 50, and 100 and defaults to 10.
- **AC-30** Given a requested page is beyond the available range, when My Tickets is retrieved, then the API returns `200` with an empty collection and valid `X-Pagination` metadata.
- **AC-31** Given the filter modal is opened, when the user edits the multi-select Category, Related System, Priority, or Status draft and cancels, then applied filters do not change; when Apply is chosen, then the draft becomes active, removable chips/count update, and pagination resets to page 1.
- **AC-32** Given search or any filter is active, whether the list currently has results or no results, when Clear Filters is chosen, then search and filters are cleared, page is reset to 1, and the current sort is preserved.
- **AC-33** Given My Tickets is loading, when data is pending, then skeleton placeholders are shown and stale Ticket data from a previous Requester is not shown.
- **AC-34** Given the selected Requester has no Tickets, when My Tickets loads, then the reusable Empty State renders the empty-dataset content; given Tickets exist but search/filter returns none, then the same component renders no-results content.

- **AC-35** Given a supported desktop viewport, when Create Ticket, My Tickets, and Ticket Detail render, then the approved multi-column/table layout is usable without clipping or overlap.
- **AC-36** Given a tablet viewport, when the same screens render, then two-column layout is used where practical and long text fields remain usable.
- **AC-37** Given a mobile viewport, when the same screens render, then forms/detail fields stack appropriately, controls remain touch-friendly, My Tickets remains a responsive table showing Ticket Number, Summary, Priority, and Status, lower-priority columns are hidden, and there is no page-level horizontal scrolling.
- **AC-38** Given keyboard-only interaction, when the user navigates Requester selection, forms, filters, dialogs, pagination, and Attachment controls, then all required actions remain operable with visible focus and associated accessible labels/errors.
- **AC-39** Given a page-level ownership, missing-resource, Ticket-list load, or unexpected failure, when the frontend handles the error, then it uses the standalone `/error` experience with safe status-specific content, no application sidebar, no internal stack/database detail, and Back returns to `/tickets`; field/local operation validation remains near the relevant control where specified.
- **AC-40** Given any server request, when it is processed, then the response provides `X-Request-Id` and server logs can correlate method, route, status, request ID, and safe error information without logging secrets or Attachment binary data.
- **AC-41** Given no Requester is selected, when `GET /api/v1/requesters` is called, then it can bootstrap the selector without `X-Requester-Id`; given any other Lab 2 endpoint, when Requester context is missing, malformed, non-positive, unknown, inactive, or deleted, then the API returns safe `400` behavior.
- **AC-42** Given two concurrent Ticket-create requests from the same Requester use the same Idempotency Key and identical normalized payload, when the second arrives while the first is in flight, then it waits within normal request timeout and, after a successful first request, returns `200` with the same Ticket without creating a duplicate; if the in-flight attempt fails, the waiter receives the same failure outcome.
- **AC-43** Given a Ticket-create attempt fails, when the Requester retries without changing the logical request payload, then the same Idempotency Key is reused; when any logical request value changes before retry—including `attachmentIds` after re-upload—the frontend generates a new Idempotency Key.
- **AC-44** Given a file has successfully pre-uploaded on Create Ticket but is not yet bound, when the draft renders, then the UI identifies it as Pending rather than Active; after successful Ticket creation/binding, the same non-deleted Attachment is Active on Ticket Detail.
- **AC-45** Given a Create Ticket draft contains entered values or known pending Attachments, when Cancel is chosen, then the UI requests discard confirmation; when discard is confirmed, the draft is cleared, known pending IDs receive best-effort pending cleanup, and the user returns to `/tickets`.
- **AC-46** Given no valid Requester context is stored, when a requester-specific route is opened, then the UI redirects to `/requesters` before requester data renders; given a stored Requester context later produces the defined invalid-context `400`, then the frontend clears requester-specific state/context and redirects to `/requesters`.

## 10. Definition of Done

### 10.1 Product Completion

Lab 2 is product-complete only when all of the following are true:

- All approved FR, BR, AC, API, data, UI, responsive, and accessibility requirements in the engineering contract are implemented.
- `specification.md`, `tests.md`, `ui-spec.md`, and `api-spec.md` are current and mutually consistent.
- Every Acceptance Criterion maps to at least one planned test in `tests.md`.
- Unit tests cover the reusable global QueryBuilder plus the resource-specific query validator/normalizer. Coverage includes every supported generic condition, including `IN`, valid type conversions, invalid field/condition/type combinations, multi-field search construction, and ordering construction. Resource-specific fixed predicates and pagination remain covered in their owning service/repository/API tests.
- API/integration tests cover Ticket creation, completed and concurrent Idempotency replay/conflict/failure behavior, global Requester-context requirements and bootstrap exception, ownership, search/searchFields/filter/sort/pagination validation, Ticket Detail, pending Attachment upload/binding, pending/active preview/download, Attachment limits, invalid extension/size, mixed pending/active collection deletion, all-or-nothing batch failure, re-delete `404`, removed metadata, and blocked removed preview/download.
- UI tests cover sidebar/mobile navigation, Requester route guards/session-context invalidation, required controls, labels, validation placement, busy/disabled states, skeletons, empty/no-results states, 400 ms search debounce, multi-select filter modal/chips/Clear Filters behavior, responsive Ticket-table columns, form retention, Create Ticket discard confirmation/cleanup intent, explicit Pending-vs-Active Attachment presentation, per-file Attachment states, batch-removal reasons/selection, `x/5` attachment count, preview modal, and standalone global-error behavior.
- E2E testing covers at least:
  1. the full Requester golden path from Requester selection through Ticket creation, Attachment upload, My Tickets, Ticket Detail, search/filter, removal, and blocked removed download; and
  2. a multi-Requester ownership path proving cross-owner direct access is rejected.
- Required visual checks/screenshots at desktop `1440x900`, tablet `820x1180`, and mobile `390x844` pass with no clipping, overlap, unintended horizontal scroll, hidden actions, or unreadable Attachment names.
- Client build/typecheck passes.
- Server build/typecheck passes.
- All unit, API/integration, UI, and required E2E tests pass from documented commands.
- No required test is skipped, disabled, commented out, or replaced by unrelated evidence.
- Prisma schema changes, committed migrations, PostgreSQL-specific index/extension migration SQL, and idempotent seeds reproduce a fresh database correctly.
- Current setup, migration, seed, run, and test commands are documented in README or the required Lab 2 documentation.
- Centralized logging is implemented with request correlation; logs do not contain Attachment binary data, secrets, database URLs, or unnecessarily sensitive full request payloads.
- Safe error mapping is used consistently for expected and unexpected failures.

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
8. **Attachment database storage:** Lab 2 stores Attachment binary content in PostgreSQL so Ticket/Attachment state is self-contained and transactional at binding time. `storageKey` keeps public storage identity independent from the physical storage implementation.
9. **Two-phase Attachment workflow:** Initial Attachments are uploaded before Ticket creation and later referenced by storage key. This separates upload and Ticket REST resources while allowing the Ticket creation transaction to validate and bind all pending Attachments consistently.
10. **Pending orphan hard deletion:** A pending file that never became Ticket evidence has no useful historical role and may be hard-deleted after cancellation/compensation/expiration. An Attachment that became Ticket evidence is soft-removed instead.
11. **Extension-only file acceptance:** Lab 2 accepts/rejects the fixed attachment types by normalized filename extension. More advanced file-signature validation is deferred.
12. **Global reusable QueryBuilder, simple Requester UI:** Lab 2 follows the reusable QueryBuilder pattern used by the provided reference implementations: a shared infrastructure/repository utility constructs generic filter, multi-field search, and order expressions, while each resource supplies/owns its validated request parameters, field/type whitelist, fixed predicates, special domain semantics, and pagination. The Requester UI still exposes understandable search/dropdown/filter controls rather than a database-like advanced filter builder.
13. **REST collection queries:** Ticket search/filter/sort/pagination remain `GET /api/v1/tickets` query semantics. Search uses explicit `searchFields`; filters use a URL-encoded JSON array; the backend reconstructs validated query values into typed application objects instead of using a JSON-body search action endpoint.
14. **Centralized errors:** Common HTTP semantics use centralized codes such as `FORBIDDEN`, `NOT_FOUND`, `GONE`, and `CONFLICT`. More specific codes are reserved for behavior the frontend truly needs to distinguish, such as Idempotency Key conflicts.
15. **Malformed public route identifiers:** Malformed UUID/storage-key route values intentionally produce the same `404` behavior as a valid-but-missing public identifier. Body/query validation may still return `400` where the identifier is an explicit request field rather than a public route identity.
16. **PostgreSQL-specific search optimization:** `pg_trgm` GIN indexes are an accepted production-oriented PostgreSQL dependency for the approved case-insensitive substring/prefix/suffix search behavior.
17. **Reusable UI primitives:** Form and Empty State presentation is centralized through reusable components/props, but Lab 2 does not introduce a generic CRUD screen generator; each business screen retains explicit field and behavior definitions.

18. **Requester-context header scope:** `GET /api/v1/requesters` is the only bootstrap endpoint without `X-Requester-Id`; all other Lab 2 endpoints require the temporary context even though it is not real authentication.
19. **Shared flattened DTOs:** Ticket creation, list, and detail intentionally share one full flattened `TicketDTO`, including Attachment metadata and audit/lifecycle fields, rather than nested relation objects or separate list/detail DTOs.
20. **Unified Attachment collection deletion:** Pending hard deletion and active soft removal intentionally share `DELETE /api/v1/attachments/collection`. Persisted lifecycle determines behavior, active items carry per-item reasons, and mixed batches are transactional/all-or-nothing.
21. **Approved UI references:** Lab Sheet/sample screenshots guide visual language, spacing, form/table density, and hierarchy only. `ui-spec.md` is the implementation contract and later-lab controls shown in illustrations are not part of Lab 2.
22. **QueryBuilder responsibility boundary:** The global QueryBuilder is a reusable query-expression utility, not a Ticket-specific service. It should remain unaware of Ticket ownership, `deleted = false`, semantic Priority ordering, or other domain rules unless such behavior is supplied through resource-owned validated input/translation. Repository/request-feature code remains responsible for page-number/page-size calculations and resource-specific fixed query clauses. `IN` is part of the Lab 2 generic condition set even if older reference implementations do not yet implement it.
