# Lab 2 Test Specification

## 1. Purpose

This document defines the planned verification contract for TokTickIT Lab 2. It is derived from and must remain consistent with:

- `specification.md`
- `api-spec.md`
- `ui-spec.md`

Every Acceptance Criterion `AC-01` through `AC-46` is mapped to at least one planned test in the traceability matrix at the end of this document.

The test plan intentionally separates:

- Unit tests for service/class/utility behavior;
- API tests for HTTP/application behavior;
- UI tests for React behavior;
- Responsive tests for layout behavior;
- Visual evidence screenshots;
- End-to-end Requester workflows.

## 2. Test ID and Result Conventions

Test IDs identify the test layer:

```text
UNIT-xx
API-xx
UI-xx
RESP-xx
VIS-xx
E2E-xx
DATA-xx
```

`DATA-xx` identifies planned schema, migration, seed, or other non-automated delivery evidence. These rows are recorded separately because mocked API tests do not prove PostgreSQL deployment behavior.

Initial `Final` value:

```text
Not Run
```

After execution, only these final values are used:

```text
Pass
Fail
Blocked
```

A planned test row may correspond to multiple concrete `it(...)` / parameterized cases inside one test file.

## 3. Test Directory and File Organization

Test files are grouped by Lab rather than colocated under source directories.

Paths in this document are package-relative. For example, backend tests live under the backend package's `tests/lab-02/`, and frontend tests live under the frontend package's `tests/lab-02/`.

### 3.1 Backend Unit and API Tests

```text
tests/
└── lab-02/
    ├── DevelopmentRequesterService.test.ts
    ├── CategoryService.test.ts
    ├── RelatedSystemService.test.ts
    ├── TicketNumber.test.ts
    ├── TicketService.test.ts
    ├── TicketQueryValidator.test.ts
    ├── QueryBuilder.test.ts
    ├── IdempotencyService.test.ts
    ├── AttachmentService.test.ts
    │
    ├── requester-context.api.test.ts
    ├── reference-data.api.test.ts
    ├── create-ticket.api.test.ts
    ├── ticket-idempotency.api.test.ts
    ├── my-tickets.api.test.ts
    ├── ticket-detail.api.test.ts
    ├── attachments-upload.api.test.ts
    ├── attachments-access.api.test.ts
    ├── attachments-delete.api.test.ts
    └── error-contract.api.test.ts
```

`TicketNumber.test.ts` tests the Ticket-number formatting/generation responsibility without requiring the implementation to expose a class specifically named `TicketNumberService` or `TicketNumberGenerator`.

`QueryBuilder.test.ts` tests the reusable global QueryBuilder utility pattern. Resource-specific query whitelisting, typed request normalization, fixed predicates, semantic Priority translation, and pagination do not become hard-coded Ticket rules inside the global QueryBuilder.

### 3.2 Frontend UI Tests

```text
tests/
└── lab-02/
    ├── RequesterSelection.test.tsx
    ├── ApplicationShell.test.tsx
    ├── CreateTicket.test.tsx
    ├── MyTickets.test.tsx
    ├── RequesterTicketDetail.test.tsx
    ├── AttachmentSection.test.tsx
    └── ErrorPage.test.tsx
```

### 3.3 Playwright Tests

```text
e2e/
└── lab-02/
    ├── requester-golden-path.spec.ts
    ├── requester-ownership.spec.ts
    ├── ticket-create-recovery.spec.ts
    └── responsive-visual.spec.ts
```

## 4. Tooling and Test Boundaries

### 4.1 Unit Tests

Use the project's TypeScript test runner (Vitest unless the implementation standardizes another equivalent runner).

Unit tests are grouped by service/class/utility responsibility. A service test file may cover all public operations for that service rather than creating one file per method.

Prisma/data-access dependencies are mocked.

### 4.2 API Tests

API tests use:

```text
Supertest
+ real Express application/router/middleware/controller/service behavior
+ mocked Prisma/data-access boundary
```

The API tests do **not** use a real PostgreSQL database.

Preferred boundary:

```text
HTTP
  -> Express middleware
  -> controller
  -> service
  -> repository / Prisma wrapper
  -> MOCK
```

Do not mock the service directly from the controller unless a test explicitly targets controller isolation.

For `$transaction(callback)` behavior, the Prisma mock invokes the callback with a transaction-client mock. Tests verify application transaction orchestration and all-or-nothing call behavior; they do not claim to prove PostgreSQL ACID semantics.

### 4.3 UI Tests

UI tests use:

```text
Vitest
+ React Testing Library
+ @testing-library/user-event
+ MSW
```

MSW represents the network boundary and is used for successful responses, validation errors, 403/404/409/500 behavior, delayed requests, and deterministic failure/recovery scenarios.

Fake timers are preferred for the 400 ms search debounce rather than real waiting.

### 4.4 Responsive / Visual / E2E

Use Playwright Chromium for the normal automated Lab 2 run.

Required viewports:

```text
Desktop  1440 x 900
Tablet    820 x 1180
Mobile    390 x 844
```

Responsive tests use behavioral/layout assertions.

Visual tests capture screenshot evidence but do not require pixel-perfect screenshot-diff baselines. The Lab Sheet/sample screens are visual-direction references, not pixel-identical implementation templates.

### 4.5 Command Matrix

Run commands from the package directory shown below. Final evidence must record the exact command, date, environment/database target, and result; these commands are not a claim that the planned Lab 2 tests already exist or pass.

| Purpose | Directory | Command | Evidence requirement |
| --- | --- | --- | --- |
| Install backend dependencies | `server/` | `npm install` | Dependencies install without changing the approved stack. |
| Apply Prisma migrations | `server/` | `npm run prisma:migrate` | Run against the designated Lab 2 PostgreSQL database using `DATABASE_URL` and `DIRECT_URL`; record migration output. |
| Seed reference data | `server/` | `npm run prisma:seed` | Record the first run and an unchanged repeat run; verify no duplicate rows or audit-timestamp churn. |
| Backend focused test | `server/` | `npm test -- tests/lab-02/<file>.test.ts` | Use for the owning Issue's focused test gate. |
| Backend full test suite | `server/` | `npm test` | Record the complete Vitest/Supertest result. |
| Backend typecheck/build | `server/` | `npm run build` | Record the TypeScript compilation result. |
| Install frontend dependencies | `client/` | `npm install` | Dependencies install without adding another UI framework or state library. |
| Frontend focused test | `client/` | `npm test -- tests/lab-02/<file>.test.tsx` | Use for the owning Issue's focused UI test gate. |
| Frontend full test suite | `client/` | `npm test` | Record the complete Vitest/React Testing Library result. |
| Frontend typecheck/build | `client/` | `npm run build` | Record the TypeScript and Vite build result. |
| Lab 2 E2E/responsive/visual suite | repository root after #25 adds Playwright config | `npx playwright test e2e/lab-02` | Record browser, viewport, screenshots, traces, and result; do not claim runnable before the #25 test setup exists. |

Do not run migration or seed commands against production data. Use a disposable or explicitly designated Lab 2 PostgreSQL database for fresh-database evidence.

### 4.6 Deterministic Test Data

Automated tests use deterministic fixtures/mocks. The standard fixture set should include at least:

- active Requester Alice;
- active Requester Bob;
- inactive Requester Eve;
- active and inactive/deleted Category fixtures;
- active and inactive/deleted Related System fixtures;
- Requester-owned Tickets for ownership/list tests;
- valid Pending, Active, Removed, expired, and cross-owner Attachment fixtures;
- deterministic timestamps and UUIDs where assertions require exact values.

E2E may use a test-only fixture/reset mechanism or equivalent deterministic test dependency. Test-only reset behavior must not be exposed as a production API.

## 5. Reusable QueryBuilder Test Principle

The global QueryBuilder follows the reusable infrastructure/repository utility pattern:

```text
validated / normalized request features
        ↓
resource repository/service
        ├── fixed resource predicates
        ├── QueryBuilder filter expression
        ├── QueryBuilder multi-field search expression
        ├── QueryBuilder order expression
        └── resource-owned pagination
        ↓
Prisma
```

The QueryBuilder is responsible for generic expression construction. It must not silently authorize arbitrary client field names or contain Ticket-specific ownership/`deleted`/Priority rules.

Resource-specific validation/normalization must happen before untrusted query values reach QueryBuilder/Prisma.

The generic condition suite includes:

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

## 6. Planned Unit Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
| --- | --- | --- | --- | --- | --- | --- |
| UNIT-01 | Unit | FR-01–06, BR-12–17, AC-02, AC-05, AC-41 | DevelopmentRequesterService: active/non-deleted retrieval and requester-context validation. | Returns only valid active requesters; rejects unknown/inactive/deleted contexts with safe domain errors. | tests/lab-02/DevelopmentRequesterService.test.ts | Not Run |
| UNIT-02 | Unit | BR-07, BR-71–73, AC-10 | CategoryService: selectable master behavior and historical lookup behavior. | Active/non-deleted categories are selectable; inactive/deleted categories are rejected for new Ticket creation while historical metadata can still resolve. | tests/lab-02/CategoryService.test.ts | Not Run |
| UNIT-03 | Unit | BR-08, BR-71–73, AC-10 | RelatedSystemService: selectable master behavior and historical lookup behavior. | Active/non-deleted systems are selectable; inactive/deleted systems are rejected for new Ticket creation while historical metadata can still resolve. | tests/lab-02/RelatedSystemService.test.ts | Not Run |
| UNIT-04 | Unit | BR-01–03, AC-07 | Ticket Number formatting/generation helper: Bangkok date, format, uppercase 12-hex suffix, deterministic injected time/random behavior. | Generated candidate matches `TKT-YYYYMMDD-RRRRRRRRRRRR`; business date uses Asia/Bangkok. Persistence/collision retry is not owned by this helper. | tests/lab-02/TicketNumber.test.ts | Not Run |
| UNIT-05 | Unit | FR-07–12, BR-01–25, AC-06–12 | TicketService: creation rules, trimming, status NEW, requester/audit derivation, pending binding orchestration, collision retry orchestration, ownership/detail behavior. | Service enforces Ticket business rules, uses transaction boundary correctly, retries Ticket-number unique collisions at most three attempts, and maps ownership/not-found behavior safely. | tests/lab-02/TicketService.test.ts | Not Run |
| UNIT-06 | Unit | BR-26–43, AC-24–30 | Ticket query request validator/normalizer: field whitelist, condition compatibility, searchFields, typed number/date/enum/boolean/IN conversion, invalid query rejection. | Only approved fields/conditions reach query execution; invalid combinations/conversions fail before QueryBuilder/Prisma; normalized values are typed. | tests/lab-02/TicketQueryValidator.test.ts | Not Run |
| UNIT-07 | Unit | BR-28–33, DoD | Global QueryBuilder filter construction for `CONTAINS`, `STARTWITH`, `ENDWITH`, `EQUAL`, `NOTEQUAL`, `GREATER`, `LESSER`, `GREATEROREQUAL`, `LESSEROREQUAL`, `ISNULL`, `ISNOTNULL`, `IN`. | Validated filter inputs produce the expected generic Prisma filter expression; QueryBuilder does not bypass resource validation. | tests/lab-02/QueryBuilder.test.ts | Not Run |
| UNIT-08 | Unit | BR-26, BR-30, AC-24 | Global QueryBuilder multi-field search construction. | Whitelisted search fields are OR-combined and the search fragment can be AND-combined with resource filters/fixed predicates. | tests/lab-02/QueryBuilder.test.ts | Not Run |
| UNIT-09 | Unit | BR-34–35, AC-27–28 | Global QueryBuilder generic order construction plus resource-owned Ticket sort translation. | Generic asc/desc ordering is constructed correctly; Ticket-specific semantic priority ordering remains outside generic hard-coded QueryBuilder domain logic. | tests/lab-02/QueryBuilder.test.ts | Not Run |
| UNIT-10 | Unit | BR-18–24, AC-11–12, AC-42–43 | IdempotencyService: requester+key scope, canonical request hashing, replay/conflict, in-flight state, 24h retention, failure completion rules. | Equivalent normalized payloads replay; changed payload conflicts for completed key; different requesters may reuse UUID; 4xx/5xx are not permanently completed. | tests/lab-02/IdempotencyService.test.ts | Not Run |
| UNIT-11 | Unit | BR-44–50, BR-61–64, AC-13–16 | AttachmentService upload validation: allowed extensions, case normalization, max size, MIME derivation, duplicate original names. | Valid files create Pending metadata; unsupported extension/oversize fail with mapped domain errors; MIME comes from approved extension. | tests/lab-02/AttachmentService.test.ts | Not Run |
| UNIT-12 | Unit | BR-47, BR-50–56, AC-06, AC-18, AC-44 | AttachmentService lifecycle/binding: Pending → Active, ownership, expiry/deleted/bound checks, active-count limit. | Only valid owned Pending attachments bind; bound attachment becomes Active; removed attachments do not count toward the five-active limit. | tests/lab-02/AttachmentService.test.ts | Not Run |
| UNIT-13 | Unit | BR-59–60, BR-65, AC-20 | AttachmentService metadata/preview/download access rules. | Pending/Active owned binary access is allowed; Removed metadata remains readable but binary access is Gone; cross-owner access is forbidden. | tests/lab-02/AttachmentService.test.ts | Not Run |
| UNIT-14 | Unit | BR-57–59, AC-19 | AttachmentService collection deletion: Pending hard-delete, Active soft-remove, per-item reason, mixed batches, validation and all-or-nothing orchestration. | Valid mixed batch applies correct lifecycle action; invalid/missing/forbidden/removed/reason-invalid item causes no mutation; repeated remove is Not Found. | tests/lab-02/AttachmentService.test.ts | Not Run |
| UNIT-15 | Unit | BR-54–55, AC-17 | AttachmentService pending expiry/orphan cleanup. | Unbound Pending attachment is not expired before 24h and becomes cleanup-eligible at/after 24h; bound attachment is never orphan-cleaned. | tests/lab-02/AttachmentService.test.ts | Not Run |

## 7. Planned API / Integration Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
| --- | --- | --- | --- | --- | --- | --- |
| API-01 | API | AC-05, AC-41, AC-46 | Requester-context middleware and bootstrap exception. | `GET /api/v1/requesters` works without `X-Requester-Id`; every other Lab 2 endpoint rejects missing, malformed, non-positive, unknown, inactive, or deleted context with safe 400 behavior. | tests/lab-02/requester-context.api.test.ts | Not Run |
| API-02 | API | AC-02, AC-41 | Retrieve active Development Requesters. | 200 raw array; only active/non-deleted requesters; full DTO shape; no requester header required. | tests/lab-02/reference-data.api.test.ts | Not Run |
| API-03 | API | BR-07, BR-71–73 | Retrieve active Categories. | 200 raw array; only active/non-deleted categories; valid requester header required. | tests/lab-02/reference-data.api.test.ts | Not Run |
| API-04 | API | BR-08, BR-71–73 | Retrieve active Related Systems. | 200 raw array; only active/non-deleted systems; valid requester header required. | tests/lab-02/reference-data.api.test.ts | Not Run |
| API-05 | API | AC-06, AC-07 | Create valid Ticket with zero-to-five Pending attachment IDs. | 201 complete flattened TicketDTO; status NEW; requester derived from header; generated Ticket Number; supplied Pending attachments returned as bound Active metadata; exactly one create workflow invoked. | tests/lab-02/create-ticket.api.test.ts | Not Run |
| API-06 | API | AC-08 | Summary validation boundaries and trimming. | Missing/blank/2/151+ invalid; 3 and 150 valid; safe 400 validation details; invalid Ticket not created. | tests/lab-02/create-ticket.api.test.ts | Not Run |
| API-07 | API | AC-09 | Description validation boundaries and trimming. | Missing/blank/9/2001+ invalid; 10 and 2000 valid; safe 400 validation details. | tests/lab-02/create-ticket.api.test.ts | Not Run |
| API-08 | API | AC-10 | Category validation. | Missing, malformed, unknown, inactive, or deleted Category fails safely; valid active Category proceeds. | tests/lab-02/create-ticket.api.test.ts | Not Run |
| API-09 | API | AC-10 | Related System validation. | Missing, malformed, unknown, inactive, or deleted system fails safely; valid active system proceeds. | tests/lab-02/create-ticket.api.test.ts | Not Run |
| API-10 | API | AC-10 | Requested Priority validation. | Missing/unknown values fail; LOW/MEDIUM/HIGH accepted; no default is silently applied. | tests/lab-02/create-ticket.api.test.ts | Not Run |
| API-11 | API | FR-28–29, BR-15–17 | Backend-managed Ticket fields / requester derivation. | Client cannot control requester/status/public/audit/deletion/generated values; ownership comes from `X-Requester-Id`. | tests/lab-02/create-ticket.api.test.ts | Not Run |
| API-12 | API | BR-18 | Idempotency-Key required UUID validation. | Missing or malformed key returns safe 400 before Ticket creation. | tests/lab-02/ticket-idempotency.api.test.ts | Not Run |
| API-13 | API | AC-11 | Completed same-key/same-payload replay. | First success 201; replay 200 same TicketDTO; no duplicate create. | tests/lab-02/ticket-idempotency.api.test.ts | Not Run |
| API-14 | API | AC-12 | Same requester/key with different payload. | 409 `IDEMPOTENCY_CONFLICT`; second Ticket not created. | tests/lab-02/ticket-idempotency.api.test.ts | Not Run |
| API-15 | API | BR-21 | Same UUID under different Requesters. | Same Idempotency-Key value is allowed in separate requester scopes. | tests/lab-02/ticket-idempotency.api.test.ts | Not Run |
| API-16 | API | BR-21 | Canonical logical request equivalence. | Property order and approved normalization do not create a false conflict; attachment ID order remains significant as contracted. | tests/lab-02/ticket-idempotency.api.test.ts | Not Run |
| API-17 | API | AC-42 | Concurrent same-key/same-payload success using controlled deferred mock. | Second request waits; first returns 201; waiter returns 200 same Ticket; one create operation. | tests/lab-02/ticket-idempotency.api.test.ts | Not Run |
| API-18 | API | AC-42 | Concurrent same-key/same-payload failure. | Controlled in-flight failure is observed by waiter as the same attempt failure; no permanent completion is recorded. | tests/lab-02/ticket-idempotency.api.test.ts | Not Run |
| API-19 | API | BR-21 | 4xx attempt is not persisted as completed idempotency result. | Retry may re-run validation/business logic; failed 4xx does not become completed replay. | tests/lab-02/ticket-idempotency.api.test.ts | Not Run |
| API-20 | API | BR-21, BR-23–24 | 5xx attempt is not persisted as completed idempotency result. | Retry may execute again/recover; failed 5xx is not a completed cached result. | tests/lab-02/ticket-idempotency.api.test.ts | Not Run |
| API-21 | API | AC-21 | My Tickets requester ownership/non-deleted scope. | Only non-deleted Tickets owned by current requester are returned. | tests/lab-02/my-tickets.api.test.ts | Not Run |
| API-22 | API | AC-24 | Search matching and normalization. | Case-insensitive search, trimming, supplied fields OR together, blank search = no search, searchFields without active search ignored. | tests/lab-02/my-tickets.api.test.ts | Not Run |
| API-23 | API | AC-24 | searchFields validation. | Nonblank search without searchFields and unknown/non-whitelisted active search field return 400. | tests/lab-02/my-tickets.api.test.ts | Not Run |
| API-24 | API | AC-25 | Valid URL-encoded JSON filters. | Valid filters are parsed/normalized and forwarded as typed expressions. | tests/lab-02/my-tickets.api.test.ts | Not Run |
| API-25 | API | AC-26 | Malformed filters JSON / non-array root. | 400 Validation Error before query execution. | tests/lab-02/my-tickets.api.test.ts | Not Run |
| API-26 | API | AC-26 | Unsupported filter field. | 400 before repository/Prisma call. | tests/lab-02/my-tickets.api.test.ts | Not Run |
| API-27 | API | AC-26 | Incompatible field/condition pair. | 400 before repository/Prisma call. | tests/lab-02/my-tickets.api.test.ts | Not Run |
| API-28 | API | AC-25–26 | Invalid `IN` values. | Empty/non-array/comma-string `IN` value fails; typed non-empty array accepted. | tests/lab-02/my-tickets.api.test.ts | Not Run |
| API-29 | API | AC-24–25 | Search/filter logical composition. | Search fields form one OR group; search group and each filter are AND-combined; multiple filters use AND. | tests/lab-02/my-tickets.api.test.ts | Not Run |
| API-30 | API | AC-27–28 | Ticket sorting. | Default `createdAt DESC, id DESC`; approved Ticket Number/Summary directions; semantic Priority order; malformed/unsupported sort returns 400. | tests/lab-02/my-tickets.api.test.ts | Not Run |
| API-31 | API | AC-29 | Pagination defaults and valid values. | Defaults page 1/size 10; pageSize 1–100 accepted. | tests/lab-02/my-tickets.api.test.ts | Not Run |
| API-32 | API | AC-29 | Invalid pagination values. | pageNumber <1, pageSize outside 1–100, and explicitly blank/invalid parse values return 400. | tests/lab-02/my-tickets.api.test.ts | Not Run |
| API-33 | API | AC-30 | Beyond-final-page behavior. | 200 with empty array; not treated as error. | tests/lab-02/my-tickets.api.test.ts | Not Run |
| API-34 | API | AC-30 | `X-Pagination` response contract. | Header contains pageNumber/pageSize/totalItems/totalPages/hasPreviousPage/hasNextPage with correct zero-item behavior. | tests/lab-02/my-tickets.api.test.ts | Not Run |
| API-35 | API | AC-21 | Owned Ticket Detail. | 200 complete shared TicketDTO for current requester's non-deleted Ticket. | tests/lab-02/ticket-detail.api.test.ts | Not Run |
| API-36 | API | AC-22 | Cross-owner Ticket Detail. | 403 with no protected resource data. | tests/lab-02/ticket-detail.api.test.ts | Not Run |
| API-37 | API | AC-23 | Missing, malformed, or logically deleted Ticket route identifier. | Centralized 404 behavior for all three cases. | tests/lab-02/ticket-detail.api.test.ts | Not Run |
| API-38 | API | BR-72–73 | Historical Category/System metadata on existing Ticket. | TicketDTO still returns historical Category/System names even when master becomes inactive/logically deleted; such masters remain excluded from selection APIs. | tests/lab-02/ticket-detail.api.test.ts | Not Run |
| API-39 | API | AC-13 | Valid Pending Attachment pre-upload. | 201 AttachmentDTO with opaque storage key, `ticketPublicId = null`, deleted false, derived MIME and audit metadata. | tests/lab-02/attachments-upload.api.test.ts | Not Run |
| API-40 | API | AC-14 | Unsupported Attachment extension. | 415 `UNSUPPORTED_MEDIA_TYPE`; no usable Attachment created. | tests/lab-02/attachments-upload.api.test.ts | Not Run |
| API-41 | API | AC-15 | Attachment larger than 5 MB. | 413 `PAYLOAD_TOO_LARGE`; no usable Attachment created. | tests/lab-02/attachments-upload.api.test.ts | Not Run |
| API-42 | API | BR-45 | MIME derived from approved extension. | jpg/jpeg/png/webp/pdf map to backend-approved MIME; multipart MIME is not acceptance authority. | tests/lab-02/attachments-upload.api.test.ts | Not Run |
| API-43 | API | AC-17 | Pending 24-hour expiry eligibility. | Attachment created beyond 24h is treated expired/cleanup-eligible; pre-24h remains valid, using controlled clock/mock data. | tests/lab-02/attachments-upload.api.test.ts | Not Run |
| API-44 | API | FR-24, BR-56 | Add valid Attachment to existing owned Ticket. | 201 AttachmentDTO bound directly to requested owned Ticket. | tests/lab-02/attachments-upload.api.test.ts | Not Run |
| API-45 | API | AC-18 | Five-active Attachment limit and replacement after removal. | At five active attachments add returns 409; after one is soft-removed, one replacement upload succeeds. | tests/lab-02/attachments-upload.api.test.ts | Not Run |
| API-46 | API | AC-22 | Add Attachment to cross-owner Ticket. | 403; no Attachment is bound. | tests/lab-02/attachments-upload.api.test.ts | Not Run |
| API-47 | API | AC-23 | Add Attachment to missing/malformed/deleted Ticket. | 404 using centralized not-found behavior. | tests/lab-02/attachments-upload.api.test.ts | Not Run |
| API-48 | API | AC-20, AC-23 | Attachment metadata lifecycle. | Pending/Active/Removed owned metadata = 200; Removed includes reason/deleted state; cross-owner 403; missing/malformed 404. | tests/lab-02/attachments-access.api.test.ts | Not Run |
| API-49 | API | AC-20, AC-22–23 | Attachment preview lifecycle. | Pending/Active owned = 200 inline binary with correct headers; Removed = 410; cross-owner 403; missing/malformed 404. | tests/lab-02/attachments-access.api.test.ts | Not Run |
| API-50 | API | AC-20, AC-22–23 | Attachment download lifecycle. | Pending/Active owned = 200 attachment binary with correct headers; Removed = 410; cross-owner 403; missing/malformed 404. | tests/lab-02/attachments-access.api.test.ts | Not Run |
| API-51 | API | BR-57–58 | Pending-only collection cleanup. | 204; owned Pending row/binary hard-delete behavior invoked; reason ignored. | tests/lab-02/attachments-delete.api.test.ts | Not Run |
| API-52 | API | AC-19 | Active-only collection soft removal. | 204; deleted=true, trimmed reason/audit update, binary/metadata retained. | tests/lab-02/attachments-delete.api.test.ts | Not Run |
| API-53 | API | AC-19 | Mixed Pending + Active batch. | 204; Pending hard-deleted and Active soft-removed in one transaction orchestration. | tests/lab-02/attachments-delete.api.test.ts | Not Run |
| API-54 | API | AC-19 | Collection all-or-nothing validation. | Any invalid/missing/forbidden/removed/reason-invalid item means no batch item is mutated. | tests/lab-02/attachments-delete.api.test.ts | Not Run |
| API-55 | API | AC-19 | Per-active-item removal reason validation. | Trimmed reason 3–200 accepted; missing/too-short/too-long active reason returns 400 and no mutation. | tests/lab-02/attachments-delete.api.test.ts | Not Run |
| API-56 | API | BR-57 | Duplicate Attachment IDs in collection. | 400 Validation Error; no mutation. | tests/lab-02/attachments-delete.api.test.ts | Not Run |
| API-57 | API | BR-57 | Empty collection items. | 400 Validation Error; no mutation. | tests/lab-02/attachments-delete.api.test.ts | Not Run |
| API-58 | API | BR-57 | Collection larger than 100 items. | 400 Validation Error; no mutation. | tests/lab-02/attachments-delete.api.test.ts | Not Run |
| API-59 | API | AC-23 | Malformed UUID inside collection JSON. | 400 request validation (distinct from malformed public route 404). | tests/lab-02/attachments-delete.api.test.ts | Not Run |
| API-60 | API | AC-19, AC-22 | Cross-owner item in collection. | 403 and entire batch remains unchanged. | tests/lab-02/attachments-delete.api.test.ts | Not Run |
| API-61 | API | AC-19–20 | Already Removed item in collection. | 404 and entire batch remains unchanged. | tests/lab-02/attachments-delete.api.test.ts | Not Run |
| API-62 | API | AC-39 | Centralized error envelope and safe public content. | Representative 400/403/404/409/410/413/415/500 responses contain standard fields; validation details are array; no stack/SQL/Prisma/secrets/binary leakage. | tests/lab-02/error-contract.api.test.ts | Not Run |
| API-63 | API | AC-40 | `X-Request-Id` propagation/generation. | Valid incoming UUID is echoed; missing/malformed gets generated UUID; success and error responses include resolved header. | tests/lab-02/error-contract.api.test.ts | Not Run |
| API-64 | API | AC-40 | Request-correlation logging safety using mocked logger/spies. | Logs correlate request ID/method/route/status/safe error info; binary data, secrets, DB URL, and unnecessarily sensitive payload content are not logged. | tests/lab-02/error-contract.api.test.ts | Not Run |
| API-65 | API | BR-74 | Ticket deletion route absence and default deletion state. | `DELETE /api/v1/tickets/:publicId` is not registered; a newly created Ticket has `deleted = false`. | tests/lab-02/create-ticket.api.test.ts | Not Run |

## 8. Planned UI Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
| --- | --- | --- | --- | --- | --- | --- |
| UI-01 | UI | AC-02 | Requester Selection normal/loading/empty/failure states. | Skeleton while loading; active names only; test-not-authentication explanation; no-active and safe failure states provide Retry; Continue disabled until selection. | tests/lab-02/RequesterSelection.test.tsx | Not Run |
| UI-02 | UI | AC-03 | Requester selection persistence and navigation. | Selecting requester + Continue stores requester in sessionStorage, shows name in app context, and navigates to `/tickets`. | tests/lab-02/RequesterSelection.test.tsx | Not Run |
| UI-03 | UI | FR-03–05 | Application shell/navigation. | Desktop shell shows TokTickIT, My Tickets, Create Ticket, requester name, Change Requester, and active navigation semantics. | tests/lab-02/ApplicationShell.test.tsx | Not Run |
| UI-04 | UI | AC-01, AC-05, AC-46 | Requester route guard and invalid-context handling. | No valid stored context redirects requester routes to `/requesters` before requester data renders; defined invalid-context 400 clears context/state and redirects. | tests/lab-02/ApplicationShell.test.tsx | Not Run |
| UI-05 | UI | AC-04 | Change Requester behavior. | Clears prior requester context/cache/list/detail/draft state, avoids stale data, and returns to selector. | tests/lab-02/ApplicationShell.test.tsx | Not Run |
| UI-06 | UI | FR-07, UI contract | Create Ticket required fields and generated-field absence. | Editable Category/System/Priority/Summary/Description/Attachments + Cancel/Submit present; generated Ticket Number/Date/Status/public/audit fields not shown before submit. | tests/lab-02/CreateTicket.test.tsx | Not Run |
| UI-07 | UI | AC-08–10, AC-38 | Create Ticket client validation, counters, labels, first-invalid focus. | Errors not dumped on initial render; submit validates all; field-associated messages/counters/required semantics; invalid client-known form does not call API and focuses first invalid field. | tests/lab-02/CreateTicket.test.tsx | Not Run |
| UI-08 | UI | FR-12 | Create Ticket busy submission. | Delayed response causes disabled Submit with spinner while text remains `Submit Ticket`; duplicate click prevented. | tests/lab-02/CreateTicket.test.tsx | Not Run |
| UI-09 | UI | AC-06 | Create Ticket success. | Pending attachment IDs + Idempotency-Key sent; 201 navigates `/tickets/:publicId`; success indication; created Ticket data available to Detail. | tests/lab-02/CreateTicket.test.tsx | Not Run |
| UI-10 | UI | AC-10 | Create Ticket 400 validation retention. | Stay on form; text/select values and valid Pending attachment state retained; server field errors mapped; no global error redirect. | tests/lab-02/CreateTicket.test.tsx | Not Run |
| UI-11 | UI | BR-23–24 | 5xx with successful Pending compensation. | Ticket create failure + cleanup 204 preserves text/selects, leaves filenames visible as Retry Upload, and does not treat deleted Pending files as Active. | tests/lab-02/CreateTicket.test.tsx | Not Run |
| UI-12 | UI | BR-23–24 | Ambiguous Ticket-create recovery. | Unresolved/ambiguous completion does not immediately require re-upload; unchanged POST retries with same Idempotency-Key; recovered 200 Ticket navigates Detail with bound files Active. | tests/lab-02/CreateTicket.test.tsx | Not Run |
| UI-13 | UI | AC-43 | Frontend Idempotency-Key lifecycle. | First logical submission gets UUID; unchanged retry reuses it; any logical payload change including attachmentIds generates a new key. | tests/lab-02/CreateTicket.test.tsx | Not Run |
| UI-14 | UI | AC-45 | Create Ticket Cancel/discard. | Untouched empty draft can cancel directly; dirty/pending draft requires confirmation; confirm performs best-effort known-Pending cleanup, clears draft, returns `/tickets`; dismiss keeps draft. | tests/lab-02/CreateTicket.test.tsx | Not Run |
| UI-15 | UI | AC-33 | My Tickets loading/table/stale-data prevention. | Skeleton rows during load; required table structure; stale previous-requester Tickets never render during context change. | tests/lab-02/MyTickets.test.tsx | Not Run |
| UI-16 | UI | AC-34 | My Tickets empty dataset vs no-results states. | Shared EmptyState shows correct distinct copy/actions for true empty dataset and active-query no-results. | tests/lab-02/MyTickets.test.tsx | Not Run |
| UI-17 | UI | AC-39 | My Tickets load failure. | Page-level list failure navigates to standalone `/error` with safe state. | tests/lab-02/MyTickets.test.tsx | Not Run |
| UI-18 | UI | AC-24 | 400 ms search debounce and API query mapping. | No request before 400ms; one request at debounce boundary with `searchFields=ticketNumber,summary,description`; committed search resets page 1. | tests/lab-02/MyTickets.test.tsx | Not Run |
| UI-19 | UI | AC-31 | Filter modal multi-select draft/apply/cancel/reset. | Category/System/Priority/Status are multi-select; Cancel discards; Reset clears draft only; Apply commits/fetches and page resets to 1. | tests/lab-02/MyTickets.test.tsx | Not Run |
| UI-20 | UI | AC-31–32 | Filter count/chips/removal/Clear Filters. | Applied count + removable chips update; chip removal fetches page 1; Clear Filters available whenever query active, clears search/filters, preserves sort. | tests/lab-02/MyTickets.test.tsx | Not Run |
| UI-21 | UI | AC-28 | Sort control mapping. | All approved Newest/Oldest/Ticket Number/Summary/Priority options map to exact API sort semantics. | tests/lab-02/MyTickets.test.tsx | Not Run |
| UI-22 | UI | AC-29–30 | Pagination/page-size UI. | Page controls use X-Pagination state; 10/20/30/50/100 choices; navigation and page-size changes fetch correct query. | tests/lab-02/MyTickets.test.tsx | Not Run |
| UI-23 | UI | FR-21–23 | Ticket Detail read-only information. | Ticket Number, createdAt-as-Ticket-Date, status, priority, requester name/email, category/system, summary/description render read-only with no edit/status workflow. | tests/lab-02/RequesterTicketDetail.test.tsx | Not Run |
| UI-24 | UI | AC-39 | Ticket Detail page-load 403/404/500. | Navigates to standalone safe `/error`; requester workflow Back target is `/tickets`. | tests/lab-02/RequesterTicketDetail.test.tsx | Not Run |
| UI-25 | UI | AC-13, AC-16, AC-44 | Attachment per-file lifecycle presentation. | Uploading, Failed, Invalid, Pending, Active, Removed states are distinct; valid files can continue when sibling invalid; successful pre-upload before binding is Pending and bound Detail file is Active. | tests/lab-02/AttachmentSection.test.tsx | Not Run |
| UI-26 | UI | AC-18 | Attachment `x/5` count and Add behavior. | Count includes only active; Removed excluded; at 5/5 Add disabled; no extra max-limit explanatory paragraph. | tests/lab-02/AttachmentSection.test.tsx | Not Run |
| UI-27 | UI | AC-20, AC-38 | Attachment preview modal. | Active supported image/PDF opens modal; Download available; Escape/close works; focus trap/return and accessible modal semantics. | tests/lab-02/AttachmentSection.test.tsx | Not Run |
| UI-28 | UI | AC-19 | Batch Attachment selection. | Only Active rows selectable; selected count and Remove Selected behave correctly; Pending/Uploading/Failed/Invalid/Removed not selectable. | tests/lab-02/AttachmentSection.test.tsx | Not Run |
| UI-29 | UI | AC-19 | Per-selected-Attachment removal reasons. | One required 3–200 char trimmed reason per selected active file; invalid reason blocks delete request. | tests/lab-02/AttachmentSection.test.tsx | Not Run |
| UI-30 | UI | AC-19 | Atomic batch-removal UI failure. | Failed all-or-nothing API request leaves all selected rows in previous state; no partial Removed UI. | tests/lab-02/AttachmentSection.test.tsx | Not Run |
| UI-31 | UI | AC-39 | Global Error page variants. | 403/404/500 safe copy; standalone no sidebar; no backend internals; explicit Back routes `/tickets` rather than browser history. | tests/lab-02/ErrorPage.test.tsx | Not Run |
| UI-32 | UI | AC-38 | Shared accessibility contract across UI suites. | Semantic controls, labels/required/errors, keyboard operability, visible focus, aria-live for meaningful async states, icon accessible names, modal focus management, non-color-only states. | tests/lab-02/*.test.tsx | Not Run |

## 9. Planned Responsive Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
| --- | --- | --- | --- | --- | --- | --- |
| RESP-01 | Responsive | AC-35–37 | Create Ticket at 1440×900, 820×1180, 390×844. | Desktop/tablet approved column behavior; mobile stack; required controls/counters/actions usable; no page-level horizontal overflow/clipping. | e2e/lab-02/responsive-visual.spec.ts | Not Run |
| RESP-02 | Responsive | AC-35–37 | My Tickets responsive table and pagination. | Desktop full columns; mobile keeps Ticket Number/Summary/Priority/Status and hides Category/System/Created At; toolbar/pagination usable; no page-level horizontal overflow. | e2e/lab-02/responsive-visual.spec.ts | Not Run |
| RESP-03 | Responsive | AC-35–37 | Ticket Detail and Attachments responsive behavior. | Desktop/tablet read-only field layout; mobile stack; attachment table adapts while filename/selection/actions stay readable/operable; no page-level horizontal overflow. | e2e/lab-02/responsive-visual.spec.ts | Not Run |

## 10. Planned Visual Evidence

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
| --- | --- | --- | --- | --- | --- | --- |
| VIS-01 | Visual | AC-35–38 | Create Ticket screenshot evidence at all required viewports. | Screenshots saved under approved Create Ticket artifact directory and pass visual checklist; no pixel-perfect baseline requirement. | e2e/lab-02/responsive-visual.spec.ts | Not Run |
| VIS-02 | Visual | AC-35–38 | My Tickets screenshot evidence at all required viewports. | Screenshots saved under approved My Tickets artifact directory and pass visual checklist. | e2e/lab-02/responsive-visual.spec.ts | Not Run |
| VIS-03 | Visual | AC-35–38 | Ticket Detail screenshot evidence at all required viewports. | Screenshots saved under approved Ticket Detail artifact directory and pass visual checklist. | e2e/lab-02/responsive-visual.spec.ts | Not Run |

Required screenshot directories:

```text
artifacts/lab-02/screenshots/create-ticket/
artifacts/lab-02/screenshots/my-tickets/
artifacts/lab-02/screenshots/ticket-detail/
```

Useful additional supporting screenshots may include:

- filter modal;
- Create Ticket validation state;
- Removed Attachment state;
- Attachment preview modal;
- global error page.

These additional screenshots are supporting evidence unless the implementation team promotes them to required visual cases.

## 11. Planned End-to-End Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
| --- | --- | --- | --- | --- | --- | --- |
| E2E-01 | E2E | AC-02–03, AC-06, AC-13, AC-18–21, AC-24–25, AC-28–32, AC-44 | Full Requester golden path. | Select requester → create Ticket → pre-upload Pending → submit/bind Active → Detail → My Tickets → search/filter/sort/page → add attachment → preview/download → batch remove → Removed state/blocked binary access. | e2e/lab-02/requester-golden-path.spec.ts | Not Run |
| E2E-02 | E2E | AC-01, AC-04, AC-21–23, AC-39, AC-46 | Cross-requester ownership path. | Requester A creates Ticket; switch to B; direct-open A publicId → backend 403 → standalone error → Back `/tickets`; A data never shown to B. | e2e/lab-02/requester-ownership.spec.ts | Not Run |
| E2E-03 | E2E | AC-06, AC-11, AC-42–44 | Ambiguous Ticket-create recovery. | Pre-upload → create response becomes ambiguous → frontend retries unchanged request with same key → completed Ticket recovered → Detail shows Active attachment; no duplicate Ticket and no forced re-upload. | e2e/lab-02/ticket-create-recovery.spec.ts | Not Run |

## 12. Visual Inspection Checklist

For each required screen and viewport verify:

- Zen Green tokens and professional internal-application hierarchy are consistent;
- no clipped labels;
- no overlapping validation/helper text;
- no hidden required actions;
- no unintended page-level horizontal scrolling;
- editable and read-only fields are visually distinct;
- required markers remain visible;
- focus states remain visible;
- busy buttons preserve layout and retain action text;
- Summary and Description remain usable;
- My Tickets table shows the required columns for that viewport;
- status/priority meaning does not depend on color alone;
- true-empty and no-results content are distinguishable;
- Attachment filenames remain readable;
- Uploading, Failed, Invalid, Pending, Active, and Removed states are distinguishable;
- Removed Attachment actions are unavailable;
- batch selection and removal reasons remain understandable;
- modal controls are keyboard reachable;
- standalone error page has no requester sidebar;
- requester-workflow Back action targets `/tickets`.

## 13. Acceptance-Criteria Traceability Matrix

Every Acceptance Criterion maps to one or more planned tests.

| Acceptance Criterion | Planned Tests |
| --- | --- |
| AC-01 | UI-04, E2E-02 |
| AC-02 | API-02, UI-01, E2E-01 |
| AC-03 | UI-02, E2E-01 |
| AC-04 | UI-05, E2E-02 |
| AC-05 | UNIT-01, API-01, UI-04 |
| AC-06 | UNIT-05, API-05, UI-09, E2E-01 |
| AC-07 | UNIT-04, UNIT-05, API-05 |
| AC-08 | API-06, UI-07 |
| AC-09 | API-07, UI-07 |
| AC-10 | UNIT-02, UNIT-03, API-08, API-09, API-10, UI-07, UI-10 |
| AC-11 | UNIT-10, API-13, E2E-03 |
| AC-12 | UNIT-10, API-14 |
| AC-13 | UNIT-11, API-39, UI-25, E2E-01 |
| AC-14 | UNIT-11, API-40 |
| AC-15 | UNIT-11, API-41 |
| AC-16 | UI-25, E2E-01 |
| AC-17 | UNIT-15, API-43 |
| AC-18 | UNIT-12, API-45, UI-26, E2E-01 |
| AC-19 | UNIT-14, API-52, API-53, API-54, API-55, API-60, API-61, UI-28, UI-29, UI-30, E2E-01 |
| AC-20 | UNIT-13, API-48, API-49, API-50, UI-27, E2E-01 |
| AC-21 | API-21, API-35, E2E-01, E2E-02 |
| AC-22 | API-36, API-46, API-49, API-50, API-60, E2E-02 |
| AC-23 | API-37, API-47, API-48, API-49, API-50, API-59, E2E-02 |
| AC-24 | UNIT-06, UNIT-08, API-22, API-23, UI-18, E2E-01 |
| AC-25 | UNIT-06, UNIT-07, API-24, API-28, API-29, UI-19, UI-20, E2E-01 |
| AC-26 | UNIT-06, API-25, API-26, API-27, API-28 |
| AC-27 | UNIT-09, API-30 |
| AC-28 | UNIT-09, API-30, UI-21, E2E-01 |
| AC-29 | API-31, API-32, UI-22 |
| AC-30 | API-33, API-34, UI-22 |
| AC-31 | UI-19, UI-20, E2E-01 |
| AC-32 | UI-20, E2E-01 |
| AC-33 | UI-05, UI-15 |
| AC-34 | UI-16 |
| AC-35 | RESP-01, RESP-02, RESP-03, VIS-01, VIS-02, VIS-03 |
| AC-36 | RESP-01, RESP-02, RESP-03, VIS-01, VIS-02, VIS-03 |
| AC-37 | RESP-01, RESP-02, RESP-03, VIS-01, VIS-02, VIS-03 |
| AC-38 | UI-07, UI-27, UI-32, VIS-01, VIS-02, VIS-03 |
| AC-39 | API-62, UI-17, UI-24, UI-31, E2E-02 |
| AC-40 | API-63, API-64 |
| AC-41 | UNIT-01, API-01, API-02 |
| AC-42 | UNIT-10, API-17, API-18, E2E-03 |
| AC-43 | UNIT-10, UI-13, E2E-03 |
| AC-44 | UNIT-12, UI-25, E2E-01, E2E-03 |
| AC-45 | UI-14 |
| AC-46 | API-01, UI-04, E2E-02 |

## 14. Implementation-Issue Test Ownership and Close Gates

Feature-specific tests must be written and passing before the corresponding
Issue is closed. Issue #25 reruns these tests as final regression coverage; it
does not defer or replace a feature Issue's own close gate.

| Issue | Focused test paths required before close | Close gate |
| --- | --- | --- |
| #18 — Data model and seed | `server/tests/lab-02/CategoryService.test.ts`, `server/tests/lab-02/RelatedSystemService.test.ts`, fresh migration/seed smoke check | Forward-only migration and idempotent seed evidence pass without breaking Lab 1 checks. |
| #19 — UI foundation | `client/tests/lab-02/ApplicationShell.test.tsx` | Shell, routes, navigation, responsive/focus foundations, and Lab 1 client checks pass. |
| #20 — Requester context | `server/tests/lab-02/DevelopmentRequesterService.test.ts`, `server/tests/lab-02/requester-context.api.test.ts`, `client/tests/lab-02/RequesterSelection.test.tsx`, relevant `client/tests/lab-02/ApplicationShell.test.tsx` cases | Bootstrap/context validation, selection persistence, route guard, and requester-switching tests pass. |
| #21 — Ticket creation | `server/tests/lab-02/TicketNumber.test.ts`, `server/tests/lab-02/TicketService.test.ts`, `server/tests/lab-02/create-ticket.api.test.ts`, `server/tests/lab-02/ticket-idempotency.api.test.ts`, `client/tests/lab-02/CreateTicket.test.tsx` | Ticket creation, validation, idempotency, and Create Ticket tests pass. |
| #22 — My Tickets | `server/tests/lab-02/TicketQueryValidator.test.ts`, `server/tests/lab-02/QueryBuilder.test.ts`, `server/tests/lab-02/my-tickets.api.test.ts`, `client/tests/lab-02/MyTickets.test.tsx` | Query validation, query-builder boundary, list API, and My Tickets tests pass. |
| #23 — Ticket Detail | `server/tests/lab-02/ticket-detail.api.test.ts`, `client/tests/lab-02/RequesterTicketDetail.test.tsx`, applicable `client/tests/lab-02/ErrorPage.test.tsx` cases | Ownership, missing-resource, read-only detail, and standalone-error tests pass. |
| #24 — Attachment lifecycle | `server/tests/lab-02/AttachmentService.test.ts`, `server/tests/lab-02/attachments-upload.api.test.ts`, `server/tests/lab-02/attachments-access.api.test.ts`, `server/tests/lab-02/attachments-delete.api.test.ts`, `client/tests/lab-02/AttachmentSection.test.tsx` | Attachment lifecycle, ownership, atomic deletion, and UI-state tests pass. |

## 15. Non-Automated Delivery Evidence

Because automated API tests mock Prisma and do not connect to a real PostgreSQL database, the following Definition-of-Done evidence must be verified separately and must not be falsely claimed by mocked tests:

- committed Prisma migrations exist;
- a fresh PostgreSQL database can be reproduced from migrations plus the idempotent seed;
- PostgreSQL-specific `pg_trgm` extension/index migration SQL is committed;
- required uniqueness/index definitions are present;
- setup, migration, seed, run, and test commands are documented;
- client/server build and typecheck commands pass;
- no required planned test is skipped, disabled, or commented out;
- logs and public responses remain free of secrets, database URLs, Attachment binary data, raw SQL, and unsafe stack details.

### 15.1 Explicit Business-Rule Evidence

The following rules previously had only generic Definition-of-Done wording. Each now has an explicit proof ID and final-result slot.

| Rule | Evidence IDs | Required proof | Final |
| --- | --- | --- | --- |
| BR-66 | DATA-01 | Inspect Prisma mappings and committed migration SQL/table definitions for singular `snake_case` PostgreSQL names and camelCase Prisma properties. | Not Run |
| BR-67 | DATA-02 | Inspect every persistent resource model/migration for the four required audit columns, types, nullability, and timestamps. | Not Run |
| BR-68 | UNIT-05, API-11, DATA-03 | Assert requester-triggered writes derive audit actors from the Requester email and never from a client-supplied actor value. | Not Run |
| BR-69 | DATA-04 | Run the idempotent seed and system-operation smoke checks; verify `seed`/`system` audit actors and unchanged audit timestamps on an unchanged seed rerun. | Not Run |
| BR-70 | UNIT-02, UNIT-03, UNIT-12, API-21, API-37, API-52, DATA-05 | Verify business-resource `deleted` defaults to false, is used by normal visibility/ownership predicates, and is set only by the approved soft-delete lifecycle. | Not Run |
| BR-74 | API-65, DATA-06 | Verify no Ticket deletion operation is exposed and new Ticket persistence/output uses `deleted = false`. | Not Run |

## 16. Completion Rule

Lab 2 testing is complete only when:

1. every required planned automated test has a final result;
2. every `AC-01` through `AC-46` remains covered by at least one passing test;
3. required responsive and screenshot evidence has been captured;
4. required E2E flows pass;
5. all non-automated delivery evidence above is verified;
6. `tests.md`, `specification.md`, `api-spec.md`, and `ui-spec.md` remain mutually consistent.

If implementation architecture changes but externally observable behavior does not, filenames/class names may be updated to match the final code while preserving the same test responsibilities and AC traceability.
