# Lab 3 Sprint Engineering Specification

## 1. Sprint Goal

Deliver the authenticated and role-aware TokTickIT Sprint 3 increment without discarding the completed Lab 2 Requester workflow. Real User accounts replace the temporary Development Requester selector; Requesters continue to create and manage only their own Tickets and permitted Attachments; IT Staff gain a prioritized Ticket Queue, ownership, IT Priority, status workflow, Public Comments, and Internal Notes; and Administrators gain intentionally minimal User Management. The sprint also hardens authentication/session handling, establishes backend-enforced authorization, evolves the PostgreSQL/Prisma model in place, and refactors the frontend into a reusable config-driven form foundation while preserving the established Zen Green and Bootstrap 5 UI system.

## 2. Stakeholder Request Interpretation

Lab 3 turns the Lab 2 development-only Requester context into a real authenticated application.

The completed increment must provide four coherent role experiences:

1. an authenticated Requester continues the Lab 2 Ticket and Attachment workflow using the signed-in User identity rather than a client-supplied Requester ID;
2. IT Staff work from a shared operational queue, claim or reassign work, update IT Priority, perform only approved lifecycle actions, communicate publicly, and record private Internal Notes;
3. Administrators manage User accounts, activation, one-role assignment, and initial-password resets without becoming IT Staff automatically; and
4. every protected behavior is enforced by the backend even when a frontend control is hidden or disabled.

The existing Lab 2 API, data, error, query, responsive, accessibility, Attachment, and idempotency contracts are preserved unless this Lab 3 contract explicitly evolves them.

### 2.1 Engineering-contract authority and handout interpretation

The Lab 3 handout's explicit normative requirements remain mandatory.

Where the handout intentionally leaves authentication mechanics, endpoint paths, authorization details, status transitions, pagination behavior, UI composition, or migration choices open, the Lab 3 engineering-contract documents record the approved implementation decision.

The engineering contract must not weaken or override an explicit handout MUST requirement without documented instructor/course approval.

The handout requires `docs/lab-03/specification.md`, `docs/lab-03/ui-spec.md`, and `docs/lab-03/api-spec.md` as the Spec DD deliverable. This specification intentionally follows the Lab 2 document style: numbered FR/BR/AC statements, exact engineering decisions, a separate detailed API contract, a separate detailed UI contract, and a product Definition of Done.

## 3. Scope

### Included

- Real email/password authentication.
- Active/inactive User enforcement.
- One role per User: Requester, IT Staff, or Administrator.
- Mandatory first-login password change for initial passwords.
- Short-lived access JWTs stored in frontend memory only.
- Stateful refresh sessions backed by PostgreSQL.
- Refresh-token rotation and reuse handling.
- Remember Me session behavior.
- Current-session logout and logout-all.
- PostgreSQL-backed login rate limiting.
- Backend role authorization on every protected endpoint.
- Removal of the Development Requester selector, Change Requester action, `sessionStorage` requester identity, and `X-Requester-Id`.
- Migration of Development Requester rows into real User rows while preserving Ticket ownership.
- Authenticated continuation of Lab 2 Requester Create Ticket, My Tickets, Ticket Detail, idempotency, and Attachment behavior.
- Public Comments with Facebook-like bounded threading and lazy loading.
- Requester `Problem Appears Resolved`, direct reopen/problem-still-exists, and permitted cancellation actions.
- IT Staff Ticket Queue with search, filters, sorting, pagination, assignment, and ownership visibility.
- IT Staff Ticket Detail with Ticket Owner, IT Priority, approved lifecycle actions, Public Comments, Internal Notes, and existing Attachments.
- Administrator read access to Tickets and Public Comments.
- Explicit Administrator Ticket-owner behavior where assignment grants operational permission only for that Ticket.
- Minimal User Management list/search/optional role filter/create/edit/activation/role/reset-initial-password flows.
- Prevention of duplicate emails, self-deactivation, self-role change, self initial-password reset, and removal/demotion/deactivation of the last active Administrator.
- Reusable collection-query conventions derived from the Lab 2 Ticket query contract.
- Reusable frontend form foundation using React Hook Form, Zod, typed config-driven fields, Bootstrap 5 layout, common server-error mapping, and shared form constants.
- Zen Green design continuity, Bootstrap 5, responsive behavior, accessibility, loading, validation, success, forbidden, conflict, and safe failure states.
- Committed Prisma migration, PostgreSQL-specific SQL where required, idempotent local development seed, and synthetic credentials.
- Maintenance cleanup for expired/revoked sessions and expired rate-limit state.

### Excluded

- Email invitations or email delivery of credentials.
- Password-reset email or reset links.
- Multi-factor authentication.
- Social login or single sign-on.
- Self-registration or Requester-created User accounts.
- Multiple roles assigned to one User.
- Departments, organizations, profile photos, or extended User-profile management.
- User deletion, bulk user operations, import/export, role history, and account-history screens.
- Account unlocking or Administrator approval workflows.
- IT Staff Actions Taken.
- Formal SLA calculation, escalation rules, notification services, dashboards, or KPI analytics beyond simple queue information.
- Multi-tenant organizations.
- Production-grade cloud/deployment changes.
- Session-management UI listing all devices/sessions.
- Password-history storage.
- Public Comment edit/delete.
- Internal Note edit/delete.
- Unlimited-depth comment trees.
- Staff Attachment upload/removal in Lab 3; Staff/Admin Ticket Detail reads existing Attachment evidence only.
- A generic CRUD-page generator. The reusable form renderer does not own business workflows.

### 3.1 Frozen Lab 2 regression boundary

Lab 3 changes the identity mechanism and adds the specified authenticated role
experiences. It does not discard the completed Lab 2 behavior. The following
assertions are normative regression requirements:

- **Create Ticket:** an authenticated Requester can submit the Lab 2 fields;
  server validation, Pending Attachment handling, submit busy/recovery,
  idempotency-key replay, same-key/different-payload conflict, and discard
  behavior remain intact.
- **My Tickets:** results are limited to the authenticated Requester’s
  non-deleted Tickets; Lab 2 search, filter, sort, 1-based pagination, empty,
  no-results, loading, and pagination metadata behavior remain intact.
- **Ticket Detail:** an authenticated Requester can open owned Tickets and
  owned Attachments; malformed, missing, deleted, and cross-owner resources
  retain the same safe indistinguishable `404 NOT_FOUND` behavior.
- **Attachments:** Pending pre-upload, existing-Ticket Active upload, metadata,
  preview/download, MIME and binary-safety headers, max-five enforcement,
  removal, Removed `410 GONE`, retry, and collection all-or-nothing behavior
  remain intact.
- **Idempotency:** completed same-key/same-payload replay remains successful;
  same-key/different-payload remains `409 IDEMPOTENCY_CONFLICT`; processing
  claims and expiry behavior remain safe and deterministic.
- **Query mechanics:** the Lab 2 `search`, `searchFields`, URL-encoded JSON
  `filters`, `sort`, `pageNumber`, `pageSize`, direct-array, and browser-readable
  `X-Pagination` conventions remain the shared collection foundation.
- **Transport and errors:** request correlation, CORS/origin checks, `no-store`,
  safe centralized error envelopes, redaction, `GONE`, and
  `IDEMPOTENCY_CONFLICT` behavior remain unless this specification explicitly
  changes a route.
- **Maintenance cleanup:** the existing explicit, repeatable cleanup behavior
  remains safe; Lab 3 extends its eligible technical state to sessions and
  rate-limit rows without introducing an application background timer.

### 3.2 Non-negotiable Lab 3 prohibitions

The implementation must not reintroduce or silently change any of the following:

- `X-Requester-Id`, a Development Requester selector, Change Requester UI,
  requester identity in `sessionStorage`, or any client-supplied requester ID
  as an ownership authority;
- frontend-only authorization, role authority derived solely from a JWT, or a
  silent change to the approved access-JWT/authoritative-PostgreSQL-session
  architecture;
- a generic editable Ticket status dropdown or a silent Ticket state-machine
  change;
- Staff Attachment upload/removal, Public Comment or Internal Note editing or
  deletion, User deletion, or User self-registration;
- authentication architecture, persistence, or security behavior not recorded
  in these four Lab 3 contract documents; or
- any later-lab functionality or additional implementation Issue beyond Issues
  2–6 and final evidence Issue 7.

## 4. Functional Requirements

### 4.1 Authentication and session

- **FR-01** The application shall authenticate Users with email and password.
- **FR-02** Authentication shall succeed only for an active, non-deleted User with valid credentials.
- **FR-03** Invalid email, unknown User, inactive User, deleted User, and incorrect password shall produce the same safe login failure response.
- **FR-04** A User whose `mustChangePassword` flag is true shall receive only restricted authenticated access until a valid new password is saved.
- **FR-05** A restricted session shall allow only current-authenticated-user inspection, password change, refresh while the restricted session remains valid, and logout behavior.
- **FR-06** The client shall store the access JWT only in in-memory authentication state and shall never persist it in `localStorage` or `sessionStorage`.
- **FR-07** Refresh credentials shall be random opaque values stored only in an HttpOnly cookie on the browser side and as cryptographic hashes in PostgreSQL.
- **FR-08** The client shall restore authentication after reload by refreshing the session and then retrieving the authoritative current User before rendering protected content.
- **FR-09** The application shall support Remember Me and non-Remember session lifetimes according to the approved business rules.
- **FR-10** Logout shall revoke the current server session and clear browser authentication state even if the current access JWT has expired.
- **FR-11** Logout All shall revoke every active session for the authenticated User.
- **FR-12** Login attempts shall be protected by PostgreSQL-backed layered rate limiting.

### 4.2 Authorization and Requester regression

- **FR-13** The temporary Development Requester selector, Change Requester behavior, `sessionStorage` requester selection, and `X-Requester-Id` transport shall be removed.
- **FR-14** Requester ownership shall be derived exclusively from the authenticated User identity.
- **FR-15** A Requester shall continue to create Tickets using the Lab 2 Ticket fields, Pending Attachment workflow, idempotency behavior, validation, and failure recovery.
- **FR-16** My Tickets shall continue to return only the authenticated Requester's non-deleted Tickets and shall retain the Lab 2 search/filter/sort/pagination behavior.
- **FR-17** Requester Ticket Detail shall continue to protect Ticket and Attachment ownership and shall provide the approved resolution indication, direct reopen/problem-still-exists, and permitted cancellation actions. Public Comment behavior in that detail view is specified separately by FR-35–FR-39 and is delivered through the Issue 6 communication seam.
- **FR-18** Cross-Requester direct access to a protected Ticket or Attachment shall remain indistinguishable from an unavailable resource.

### 4.3 IT Staff Ticket Queue and Ticket operations

- **FR-19** IT Staff shall have a shared Ticket Queue showing Tickets across Requesters subject to the approved queue query contract.
- **FR-20** The Ticket Queue shall support search across Ticket Number, Summary, Description, and Requester Name.
- **FR-21** The Ticket Queue shall support approved filters for Status, IT Priority, Ticket Owner, Category, Requested Priority, Related System, and Created Date range.
- **FR-22** The Ticket Queue shall support sorting, 1-based pagination, browser-readable pagination metadata, and the approved operational default ordering.
- **FR-23** The default IT Staff Queue UI shall hide `CLOSED` and `CANCELLED` Tickets while providing an explicit way to include terminal Tickets.
- **FR-24** IT Staff shall be able to open Ticket Detail and see Requester information, Ticket information, Requested Priority, IT Priority, Current Status, Ticket Owner, and existing Attachments. Public Comment and Internal Note behavior in that detail view is specified separately by FR-35–FR-41 and is delivered through the Issue 6 communication seam.
- **FR-25** An IT Staff User shall be able to atomically claim an unassigned Ticket.
- **FR-26** Assignment of an unassigned `NEW` Ticket shall atomically set its owner and transition it to `OPEN`.
- **FR-27** Authorized IT Staff shall be able to assign, reassign, or unassign a Ticket using optimistic ownership concurrency checks.
- **FR-28** IT Staff shall be able to change IT Priority without modifying Requested Priority.
- **FR-29** Status changes shall be exposed as semantic business actions rather than an arbitrary status dropdown.
- **FR-30** Start Work, Request Information, Resume Work, Mark Resolved, and Close shall be available only to the current Ticket Owner.
- **FR-31** Request Information shall require a Public Comment message and shall create that comment and transition the Ticket to `WAITING_FOR_REQUESTER` in one transaction.
- **FR-32** Mark Resolved shall require confirmation and transition the Ticket to `RESOLVED`.
- **FR-33** Close shall be permitted only from `RESOLVED` after the Requester has confirmed that the problem appears resolved.
- **FR-34** Staff cancellation shall follow the approved transition matrix and confirmation behavior.

### 4.4 Public Comments and Internal Notes

- **FR-35** Requesters, IT Staff, and Administrators shall be able to retrieve Public Comments for Tickets they are authorized to view.
- **FR-36** Requesters, IT Staff, and Administrators shall be able to post Public Comments according to the authorization matrix.
- **FR-37** Public Comments shall support bounded Facebook-like replies with at most two visual nesting levels and reply-target metadata.
- **FR-38** Public Comments shall use lazy loading: root comments are paginated and each root may include a bounded reply preview with separately pageable additional replies.
- **FR-39** Public Comments shall be append-only and shall not support edit or delete in Lab 3.
- **FR-40** IT Staff and Administrators shall be able to read Internal Notes on permitted Tickets; only IT Staff and explicitly assigned Administrator owners shall be able to create Internal Notes.
- **FR-41** Internal Notes shall be flat, append-only, visually private, and inaccessible to Requesters.

### 4.5 Administrator User Management

- **FR-42** Administrators shall have a User Management list showing Name, Email, Role, Status, and Edit.
- **FR-43** User Management shall support name/email search, optional role filtering, the shared collection pagination convention, and deterministic default ordering.
- **FR-44** Administrators shall be able to create a User with name, email, exactly one permitted role, activation state, and a server-generated initial password.
- **FR-45** Administrators shall be able to edit another User's name, email, role, and activation state subject to safety rules.
- **FR-46** Administrators shall be able to issue a new server-generated initial password for another User.
- **FR-47** User creation and initial-password reset shall show the plaintext generated password only once to the Administrator and shall never store plaintext in the database.
- **FR-48** Role changes, email changes, deactivation, normal password changes, and initial-password resets shall revoke the affected User's active sessions according to the approved rules.
- **FR-49** Administrator and IT Staff responsibilities shall remain conceptually separate; an Administrator gains operational Ticket permissions only when explicitly assigned as that Ticket's owner. Non-owner Administrators may still read Tickets, read/post Public Comments, and read Internal Notes as explicitly non-operational visibility/communication permissions.

### 4.6 Shared frontend form foundation

- **FR-50** Lab 3 shall refactor repeated frontend form presentation into a reusable typed `CommonForm` foundation.
- **FR-51** Form definitions shall use sections and typed field configuration rather than repeated per-page field markup where the shared renderer fits.
- **FR-52** Supported built-in field types shall include text, email, password, number, date, textarea, select, radio, checkbox, switch, readonly, attachment, lookup, and custom.
- **FR-53** Built-in field types shall be preferred; `lookup` shall represent form-bound entity selection requiring specialized lookup UI, and `custom` shall be reserved for genuinely feature-specific controls/workflows.
- **FR-54** Form definitions shall use semantic layout spans `full`, `half`, `third`, and `quarter`; the renderer shall map those spans to Bootstrap 5 responsive grid classes.
- **FR-55** React Hook Form and `zodResolver` shall own client form state and authoritative client validation, while config metadata supplies presentation semantics such as labels, required markers, counters, options, and layout.
- **FR-56** Shared form limits shall be exported from `client/src/constants/forms/` so config and Zod schemas use the same domain constants.
- **FR-57** `CommonForm` shall provide standard Submit/Cancel action behavior through props such as visibility, labels, busy/disabled states, and callbacks while allowing forms such as Login to hide actions they do not use.
- **FR-58** `useManagedForm` shall expose dirty state; each page shall decide whether dirty state participates in the shared Navigation Guard.
- **FR-59** Server validation details shall be mapped through one reusable helper into field-level React Hook Form errors, with unmatched errors presented at form level.
- **FR-60** Feature-specific workflows such as Ticket idempotency, Pending Attachment lifecycle, auth/session logic, and navigation shall remain outside the generic form renderer.

### 4.7 Data, API, and operational foundation

- **FR-61** The PostgreSQL/Prisma schema shall evolve in place from Lab 2 without discarding Category, Related System, Ticket, Attachment, or existing Requester-owned Ticket data.
- **FR-62** The API shall preserve the centralized safe error envelope and request correlation introduced in Lab 2.
- **FR-63** Protected endpoints shall distinguish unauthenticated, forbidden, invalid, unavailable, conflict, rate-limited, and unexpected failures without leaking protected resource existence.
- **FR-64** Queryable collection endpoints shall reuse the Lab 2 Ticket query mechanics while defining resource-specific field/type/operator whitelists.
- **FR-65** Seed data shall be idempotent, synthetic, local-development-only, and sufficient to exercise every Lab 3 role and workflow.
- **FR-66** An explicit maintenance command shall remove eligible expired/revoked session and rate-limit technical state without using an application background timer.

## 5. Business Rules

### 5.1 Authentication, passwords, and sessions

- **BR-01** Only an active, non-deleted User with valid credentials may authenticate.
- **BR-02** A User marked `mustChangePassword = true` cannot enter the normal application until a valid new password is saved.
- **BR-03** The authenticated User identity, not any Requester identifier supplied by the client, determines ownership of Requester operations.
- **BR-04** Public Comments are visible to authorized Requesters, IT Staff, and Administrators. Internal Notes are visible only to authorized IT Staff and Administrators.
- **BR-05** A Requester may indicate that the problem appears resolved but cannot formally set the Ticket to `RESOLVED` or `CLOSED`.
- **BR-06** Email matching and uniqueness are case-insensitive using PostgreSQL `citext`; the stored/displayed casing may be preserved.
- **BR-07** Login failure for unknown email, inactive/deleted account, or incorrect password returns the same generic message: `Invalid email or password.`
- **BR-08** Unknown-email login performs a dummy password-hash verification so the application does not intentionally create an obvious account-existence timing branch.
- **BR-09** Login rate limiting uses two PostgreSQL-backed scopes: `(normalizedEmail, IP)` allows 5 failed attempts in 15 minutes and then blocks that pair for 15 minutes; global IP allows 30 failed attempts in 15 minutes and then blocks that IP for 15 minutes.
- **BR-10** Successful login clears the email/IP pair failure state but does not erase the global IP failure history for the active window.
- **BR-11** Passwords contain 8-128 Unicode code points, are not trimmed, and must include at least one ASCII uppercase letter, one ASCII lowercase letter, one decimal digit, and one non-alphanumeric non-whitespace symbol. Spaces are allowed but do not satisfy the symbol rule.
- **BR-12** A newly chosen password must differ from the current/initial password. Lab 3 stores no password history, so an older non-current password may be reused later.
- **BR-13** Passwords are hashed with Argon2id. Normal runtime parameters are memory cost 32 MiB, time cost 2, parallelism 1. Automated tests may inject the explicit faster profile 8 MiB, time cost 1, parallelism 1.
- **BR-14** Password hashes are encoded Argon2id strings containing their salt/parameters. Plaintext passwords are never persisted or logged.
- **BR-15** Access tokens use JWT HS256 with a high-entropy server-only environment secret. JWT claims are minimal: `sub`, `sid`, `jti`, `iat`, and `exp`; role is not authoritative in the token.
- **BR-16** Access JWT lifetime is 10 minutes and the browser stores the token only in in-memory authentication state.
- **BR-17** Every protected request validates the JWT and then verifies the authoritative active UserSession and current active User/role in PostgreSQL. Database state is authoritative for revocation and role changes.
- **BR-18** Refresh credentials are cryptographically random opaque tokens. PostgreSQL stores only SHA-256 token hashes, never the refresh-token plaintext.
- **BR-19** Refresh rotation is strict. The session stores the current refresh-token hash plus the immediately previous hash and a 30-second ambiguity deadline.
- **BR-20** Reuse of the immediately previous refresh token while `now <= previousRefreshValidUntil` shall perform one fresh rotation under the session-row lock and shall not revoke the session. The response access JWT and refresh cookie belong to that rotation. A token no longer stored as either the current or immediately previous hash is reuse and, including after the 30-second window, revokes the session.
- **BR-21** Same-origin tabs coordinate refresh using `navigator.locks` and `BroadcastChannel("toktickit-auth")` so only one tab normally performs refresh while other tabs receive authentication-state updates.
- **BR-22** A non-Remember full session uses a session cookie and an absolute lifetime of 8 hours.
- **BR-23** A Remember full session uses a persistent cookie, a 30-day idle lifetime, and a 90-day absolute lifetime. Effective expiry is the earlier of `lastUsedAt + 30 days` and `createdAt + 90 days`.
- **BR-24** A restricted password-change session ignores Remember Me and has a 15-minute absolute lifetime. It may refresh only while that absolute lifetime remains valid.
- **BR-25** Login and refresh success return access-token data only. The frontend obtains current User identity/role/stage from `GET /api/auth/me`.
- **BR-26** Successful mandatory first-password change revokes the restricted session, clears auth credentials, and requires a fresh login.
- **BR-27** Successful normal password change requires the current password, revokes all active sessions for the User, clears the current browser credentials, and requires a fresh login.
- **BR-28** Current-session logout is idempotent, may authenticate from the refresh-session cookie when the access JWT is expired, revokes that session, clears the cookie, and returns success even if the session is already absent/revoked.
- **BR-29** Logout All requires authenticated full access and revokes all active sessions for the User.
- **BR-30** Refresh-cookie attributes are HttpOnly, SameSite=Strict, no Domain, Path `/api/auth`, and Secure when HTTPS is used. Cookie-authenticated mutation endpoints require an approved exact frontend Origin in addition to the configured CORS policy.
- **BR-31** JWT secrets, password peppers if later introduced, database credentials, and other authentication secrets are environment configuration and are never exposed to client code or committed.

### 5.2 User and Administrator rules

- **BR-32** Each User has exactly one role: `REQUESTER`, `IT_STAFF`, or `ADMINISTRATOR`.
- **BR-33** User creation defaults to `isActive = true`; the Administrator may explicitly choose Inactive before creation.
- **BR-34** Administrator-created and Administrator-reset initial passwords are 16-character cryptographically secure generated values containing uppercase, lowercase, digit, and symbol characters.
- **BR-35** A newly created or reset User has `mustChangePassword = true`.
- **BR-36** Creating a User returns the new User DTO and generated initial password once; resetting an initial password returns only the generated initial password once.
- **BR-37** Duplicate email addresses are rejected case-insensitively.
- **BR-38** An Administrator cannot deactivate their own account.
- **BR-39** An Administrator cannot change their own role through User Management.
- **BR-40** An Administrator cannot reset their own initial password through User Management; normal Change Password is used instead.
- **BR-41** The last active Administrator cannot be deactivated or changed to a non-Administrator role.
- **BR-42** Role changes revoke all active sessions for the affected User.
- **BR-43** Email changes revoke all active sessions for the affected User.
- **BR-44** Deactivation atomically sets `isActive = false`, revokes all active sessions, and unassigns the User from Tickets where active-owner eligibility would otherwise be violated.
- **BR-45** Changing an owner-eligible User to Requester also unassigns that User from owned Tickets in the same transaction.
- **BR-46** User deletion is not exposed. Deactivation is the Lab 3 lifecycle action.

### 5.3 Ticket ownership, priorities, and status

- **BR-47** Requested Priority is immutable after Requester submission.
- **BR-48** IT Priority uses `LOW | MEDIUM | HIGH`, is initialized from Requested Priority, and may later be changed only by IT Staff or an explicitly assigned Administrator owner.
- **BR-49** A Ticket may have zero or one primary owner. An owner must be an active IT Staff or Administrator User.
- **BR-50** Claim applies only to an unassigned Ticket and assigns the current IT Staff User.
- **BR-51** Claim/assignment of an unassigned `NEW` Ticket atomically sets the owner and changes status to `OPEN`.
- **BR-52** Assignment/reassignment/unassignment uses optimistic concurrency by supplying the expected current owner. A mismatch returns `409 OWNERSHIP_CONFLICT`.
- **BR-53** Unassignment does not otherwise change status. For example, `IN_PROGRESS` may become unassigned while remaining `IN_PROGRESS`.
- **BR-54** IT Staff may assign/reassign a Ticket to an eligible active IT Staff or Administrator owner. Replacing an existing owner requires confirmation in the UI.
- **BR-55** Administrators cannot Claim. A normal Administrator is read-only for Ticket operations; Ticket read, Public Comment read/post, and Internal Note read remain non-operational permissions. An Administrator explicitly assigned as owner receives the same owner-only Ticket operational permissions defined by the authorization matrix.
- **BR-56** Owner-only operational actions are Start Work, Request Information, Resume Work, Mark Resolved, and Close.
- **BR-57** The required status set is `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, and `CANCELLED`.
- **BR-58** Status transitions use semantic actions and the following matrix:

| Current status | Action | New status | Actor |
|---|---|---|---|
| `NEW` | Claim / assign | `OPEN` | IT Staff assignment authority |
| `NEW` | Cancel | `CANCELLED` | Requester owner or authorized IT Staff |
| `OPEN` | Start Work | `IN_PROGRESS` | current Ticket Owner |
| `OPEN` | Request Information | `WAITING_FOR_REQUESTER` | current Ticket Owner |
| `OPEN` | Cancel | `CANCELLED` | Requester owner or authorized IT Staff/Administrator owner |
| `IN_PROGRESS` | Request Information | `WAITING_FOR_REQUESTER` | current Ticket Owner |
| `IN_PROGRESS` | Mark Resolved | `RESOLVED` | current Ticket Owner |
| `IN_PROGRESS` | Cancel | `CANCELLED` | authorized IT Staff/Administrator owner |
| `WAITING_FOR_REQUESTER` | Resume Work | `IN_PROGRESS` | current Ticket Owner |
| `WAITING_FOR_REQUESTER` | Mark Resolved | `RESOLVED` | current Ticket Owner |
| `WAITING_FOR_REQUESTER` | Cancel | `CANCELLED` | authorized IT Staff/Administrator owner |
| `RESOLVED` | Looks Resolved | unchanged | authenticated Requester owner |
| `RESOLVED` | Close | `CLOSED` | current Ticket Owner after Requester confirmation |
| `RESOLVED` | Problem Still Exists | `REOPENED` | authenticated Requester owner |
| `CLOSED` | Problem Still Exists | `REOPENED` | authenticated Requester owner |
| `REOPENED` | Start Work | `IN_PROGRESS` | current Ticket Owner |
| `REOPENED` | Request Information | `WAITING_FOR_REQUESTER` | current Ticket Owner |
| `REOPENED` | Mark Resolved | `RESOLVED` | current Ticket Owner |
| `REOPENED` | Cancel | `CANCELLED` | authorized IT Staff/Administrator owner |
| `CANCELLED` | — | terminal | — |

- **BR-59** `Problem Appears Resolved` is available to the Requester only while status is `RESOLVED`. It records `requesterResolutionConfirmedAt` and does not change Ticket status.
- **BR-60** Close is permitted only while status is `RESOLVED` and `requesterResolutionConfirmedAt` is non-null.
- **BR-61** Requester `Problem Still Exists` is permitted from `RESOLVED` or `CLOSED`; it changes status to `REOPENED`, clears `requesterResolutionConfirmedAt`, and sets owner to null.
- **BR-62** Reopening does not reset Requested Priority or IT Priority.
- **BR-63** A Requester may cancel only their own Ticket in `NEW` or `OPEN`.
- **BR-64** Authorized IT Staff/Administrator owners may cancel according to the matrix. Cancel, Close, Unassign, Reassign-away, Problem Still Exists, and Mark Resolved require UI confirmation.
- **BR-65** Request Information requires a trimmed Public Comment message and commits comment creation plus the status transition in one transaction.
- **BR-66** A Requester posting a Public Comment while status is `WAITING_FOR_REQUESTER` does not automatically change status; the current owner decides when to Resume Work.
- **BR-67** Invalid lifecycle actions return `409 INVALID_STATUS_TRANSITION`.

### 5.4 Public Comments and Internal Notes

- **BR-68** Public Comment content is plain text, trimmed, 1-2000 characters, preserves line breaks, and is rendered escaped without Markdown or HTML interpretation.
- **BR-69** Internal Note content is plain text, trimmed, 1-4000 characters, preserves line breaks, and is rendered escaped without Markdown or HTML interpretation.
- **BR-70** Public Comments and Internal Notes are append-only in Lab 3. No edit/delete endpoint or UI is provided.
- **BR-71** Every comment/note author and creation timestamp are derived by the backend.
- **BR-72** Public Comments support visual depths 0, 1, and 2 only.
- **BR-73** A reply to a depth-2 comment remains at depth 2: its structural parent is the target's depth-1 ancestor and `replyToCommentId` records the exact clicked comment. The UI renders the target author's `@Name` as metadata and does not prepend it to persisted `content`.
- **BR-74** Root Public Comments are ordered newest-first. Replies inside one thread are ordered oldest-first.
- **BR-75** Root Public Comments default to 10 per page. Each root may include the first three replies as a preview plus `replyCount`. Additional replies are retrieved in pages of 5.
- **BR-76** Internal Notes are flat and are retrieved as a paginated operational list; no reply/thread relationship exists.
- **BR-77** Requesters cannot access Internal Notes. A forbidden Internal Notes request returns no note content.

### 5.5 Collection query standard

- **BR-78** The Lab 2 Ticket collection query contract is the project standard for queryable collections: `search`, `searchFields`, URL-encoded JSON `filters`, `sort`, `pageNumber`, and `pageSize`. The resource-specific Queue and User matrices in `api-spec.md` are normative extensions of that contract.
- **BR-79** Collection success bodies remain direct DTO arrays; pagination metadata is returned through browser-readable `X-Pagination`.
- **BR-80** Collection validators are resource-specific. Shared QueryBuilder capability does not automatically permit a field/operator/type combination for a resource; unsupported fields, operators, types, nullability, or cardinality are rejected before data access.
- **BR-81** Page numbers are 1-based, default page size is 10, maximum page size is 100, and an out-of-range valid page returns `200 []` with correct pagination metadata.
- **BR-82** User Management default ordering is `name ASC` then deterministic public/internal identifier ascending.
- **BR-83** IT Staff Queue search fields are Ticket Number, Summary, Description, and Requester Name.
- **BR-84** IT Staff Queue UI filters are Status, IT Priority, Owner, Category, Requested Priority, Related System, and Created Date range.
- **BR-85** IT Staff Queue default operational ordering is: unassigned first; IT Priority `HIGH -> MEDIUM -> LOW`; oldest `createdAt` first; deterministic internal ID tie-break.
- **BR-86** The initial Queue UI excludes `CLOSED` and `CANCELLED` through its committed filter state; the API itself does not make terminal Tickets undiscoverable.

### 5.6 Form-foundation rules

- **BR-87** Client form validation uses a hybrid contract: field configuration owns presentation metadata; Zod owns authoritative client validation.
- **BR-88** Shared form constants live under `client/src/constants/forms/`, including domain-specific `auth`, `ticket`, and `user` modules exported through `index.ts`.
- **BR-89** The same constant is referenced by field config and Zod schema when both need a shared boundary such as max length.
- **BR-90** `CommonForm` uses sections and discriminated field types and maps semantic field span to Bootstrap 5 layout internally.
- **BR-91** Standard spans are `full`, `half`, `third`, and `quarter`; they map to responsive Bootstrap 5 grid classes with mobile full-width behavior.
- **BR-92** `attachment` is a built-in generic field type, but the existing Ticket `AttachmentSection` may use `custom` because its Pending/Active lifecycle, retry, cleanup, and idempotency coupling are feature-specific.
- **BR-93** `lookup` is a first-class bound field type for specialized entity selection. `custom` remains an escape hatch and must not replace ordinary built-in fields merely to avoid extending the shared renderer.
- **BR-94** Standard form action props include submit/cancel visibility, labels, busy states, disabled states, and callbacks. Forms may hide unused actions such as Login Cancel.
- **BR-95** The generic form layer never owns Ticket idempotency, Attachment lifecycle transitions, authentication transport, API navigation outcomes, or domain authorization.

## 6. UI Specification Summary

The detailed visual and interaction contract is defined in `docs/lab-03/ui-spec.md`.

Lab 3 preserves the Lab 2 Zen Green visual foundation and Bootstrap 5 constraint. Authentication and role-specific navigation are integrated into the existing AppShell rather than introducing a second design system.

### 6.1 Route structure

```text
/login
/change-password
/error

/tickets
/tickets/new
/tickets/:publicId

/staff/tickets
/staff/tickets/:publicId

/admin/users
/admin/users/new
/admin/users/:publicId/edit
/admin/tickets
/admin/tickets/:publicId
```

### 6.2 Authentication shell behavior

- `/login`, `/change-password`, and `/error` may render outside the full authenticated application shell.
- Protected routes render only after `AuthProvider` bootstrap finishes.
- Bootstrap performs refresh, then `GET /api/auth/me`.
- No protected page, stale User state, Login flash, or role-specific AppShell content is rendered while authentication is `BOOTSTRAPPING`.
- Wrong-role navigation uses the existing standalone `/error` experience with safe `403` content.
- Invalid/expired session state returns to `/login`.
- The shell shows authenticated name, role badge, permitted navigation, Change Password, and Logout.

### 6.3 Requester

- Create Ticket, My Tickets, and Requester Ticket Detail preserve Lab 2 structure and Attachment behavior.
- Development Requester selection/change UI is removed.
- Requester identity fields now come from authentication and are read-only.
- Ticket Detail adds Public Comments, Looks Resolved, Problem Still Exists, and permitted Cancel.

### 6.4 IT Staff Queue

Desktop primary columns:

```text
Ticket #
Summary + Category
IT Priority
Status
Owner
Created
```

The UI provides Search, Filters, More Filters, Sort, page size, pagination, clear active filter state, owner/status/priority badges, and an open-detail interaction while avoiding a mega-grid.

### 6.5 IT Staff/Admin Ticket Detail

- Ticket information remains grouped and mostly read-only.
- Ticket Owner uses eligible-owner selection/assignment behavior.
- IT Priority is editable only when authorized.
- Status is controlled through semantic action buttons.
- Public Comments and Internal Notes are separate tabs with strongly distinct labeling.
- Internal Notes carry a persistent private-visibility warning.
- Existing Attachments remain visible and binary-readable according to authorization.
- Admin non-owner and Admin-owner modes render different operational controls.

### 6.6 Administrator User Management

- `/admin/users` provides list/search/role filter/pagination and Create User.
- `/admin/users/new` and `/admin/users/:publicId/edit` are dedicated pages using the shared form foundation.
- Successful Create User replaces the form with a one-time initial-password success state; the plaintext password is not passed in router/history state.
- Edit includes a separate Set New Initial Password security action.
- Dirty Create/Edit forms use the shared Navigation Guard.
- User Management remains intentionally simple despite using the common collection-query plumbing.

## 7. Data Changes

### 7.1 Naming and identifier strategy

PostgreSQL uses singular `snake_case` table/column naming. Prisma exposes PascalCase models and camelCase fields using `@@map(...)` and `@map(...)`.

Business resources retain numeric internal IDs for joins/performance and use opaque UUID `publicId` values when directly addressable by API/frontend routes.

### 7.2 Enums

Final Lab 3 enums include:

```text
UserRole =
  REQUESTER
  IT_STAFF
  ADMINISTRATOR

SessionStage =
  PASSWORD_CHANGE_REQUIRED
  FULL

RequestedPriority =
  LOW
  MEDIUM
  HIGH

TicketPriority =
  LOW
  MEDIUM
  HIGH

TicketStatus =
  NEW
  OPEN
  IN_PROGRESS
  WAITING_FOR_REQUESTER
  RESOLVED
  CLOSED
  REOPENED
  CANCELLED
```

Existing Lab 2 idempotency enum remains:

```text
IdempotencyStatus =
  PROCESSING
  COMPLETED
```

### 7.3 User

Lab 2 `DevelopmentRequester` is evolved/renamed in place to `User` so existing numeric IDs and Ticket foreign keys remain valid.

Required final logical fields:

| Field | PostgreSQL intent | Meaning |
|---|---|---|
| `id` | integer PK | preserved internal identity |
| `publicId` | UUID unique, not null | external/API identity |
| `name` | `VARCHAR(100)` | display name |
| `email` | `CITEXT` unique, not null | case-insensitive login/uniqueness |
| `role` | `UserRole` not null | exactly one role |
| `passwordHash` | bounded text/varchar not null | encoded Argon2id hash |
| `mustChangePassword` | boolean not null | restricted first-login flag |
| `isActive` | boolean not null | account activation |
| `deleted` | boolean not null | retained legacy logical-removal field; no Lab 3 delete API |
| audit fields | existing audit convention | preserved |

### 7.4 UserSession

Required logical fields:

| Field | Meaning |
|---|---|
| opaque session UUID | JWT `sid` lookup identity |
| `userId` | restrictive FK to User |
| `stage` | `PASSWORD_CHANGE_REQUIRED` or `FULL` |
| `rememberMe` | full-session lifetime mode |
| `refreshTokenHash` | SHA-256 of current refresh token |
| `previousRefreshTokenHash` | immediately previous hash, nullable |
| `previousRefreshValidUntil` | 30-second ambiguity boundary, nullable |
| `createdAt` | session creation |
| `lastUsedAt` | refresh/approved activity reference |
| `absoluteExpiresAt` | hard session deadline |
| `revokedAt` | nullable revocation time |
| `revokeReason` | safe bounded server reason, nullable |
| `userAgent` | bounded optional session metadata |
| `ipAddress` | optional IP metadata |

### 7.5 LoginRateLimitBucket

Logical fields:

```text
id
scope                EMAIL_IP | IP
bucketKeyHash
windowStartedAt
failureCount
blockedUntil?
updatedAt
```

### 7.6 Ticket changes

Existing Ticket rows and public IDs are preserved.

New/changed fields:

| Field | Rule |
|---|---|
| `requesterId` | same numeric FK now references User |
| `ownerUserId` | nullable restrictive FK to User |
| `itPriority` | `LOW | MEDIUM | HIGH`, initialized from Requested Priority |
| `currentStatus` | expanded TicketStatus enum |
| `requesterResolutionConfirmedAt` | nullable timestamp; clear on reopen |

Migrated Lab 2 Tickets use:

```text
ownerUserId = null
itPriority = requestedPriority
currentStatus = existing NEW
requesterResolutionConfirmedAt = null
```

### 7.7 Attachment changes

Existing Attachment data and binary evidence are preserved.

`uploadedByRequesterId` evolves to a User uploader relationship while preserving existing numeric values.

### 7.8 PublicComment

Logical fields:

```text
id
publicId UUID unique
ticketId FK
authorUserId FK
parentCommentId FK nullable
replyToCommentId FK nullable
content VARCHAR(2000)
createdAt TIMESTAMPTZ
```

### 7.9 InternalNote

Logical fields:

```text
id
publicId UUID unique
ticketId FK
authorUserId FK
content VARCHAR(4000)
createdAt TIMESTAMPTZ
```

### 7.10 IdempotencyRecord

The Lab 2 Ticket-create idempotency model and concurrency behavior remain valid. Its Requester relationship evolves from DevelopmentRequester to User without changing logical ownership.

### 7.11 Migration from Lab 2

The committed migration shall:

1. preserve Category, Related System, Ticket, Attachment, and IdempotencyRecord data;
2. evolve/rename DevelopmentRequester to User without changing existing internal IDs;
3. add and backfill unique User public UUIDs;
4. convert email uniqueness to case-insensitive `citext`;
5. assign migrated Requesters the `REQUESTER` role;
6. backfill encoded Argon2id hashes for documented synthetic local-development initial credentials and set `mustChangePassword = true`;
7. retarget Ticket Requester, Attachment uploader, and IdempotencyRecord Requester foreign keys to User;
8. add Ticket ownership, IT Priority, full status enum, and Requester-resolution-confirmation fields;
9. create UserSession, login-rate-limit, PublicComment, and InternalNote tables;
10. preserve all existing Ticket ownership by Requester;
11. remove no historical Ticket/Attachment evidence; and
12. support both a fresh database and a populated Lab 2 database upgraded forward.

### 7.12 Seed data

Seed is idempotent.

Minimum Users:

- at least four active Requesters;
- at least one inactive Requester;
- at least three active IT Staff;
- at least one inactive IT Staff;
- at least one active Administrator.

Seed also creates realistic Tickets across statuses, Requested/IT priorities, assigned/unassigned owners, Public Comments, and Internal Notes.

Credentials are synthetic local-development data only.

## 8. API Contract

The exact wire contract is defined in `docs/lab-03/api-spec.md`.

All endpoints use `/api`, JSON uses camelCase, timestamps use ISO-8601 UTC, and normal success resources/arrays are direct responses.

### 8.1 Primary route groups

```text
/api/auth/...
/api/users/me/...
/api/tickets/...
/api/admin/users/...
```

### 8.2 Centralized errors

Approved status/code families include:

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

Requester cross-owner Ticket/Attachment access remains `404 NOT_FOUND`.

### 8.3 Collection responses

Queryable collection endpoints follow the shared Ticket-style contract and return direct DTO arrays plus `X-Pagination`.

## 9. Acceptance Criteria

- **AC-01** Valid active User Login creates server session/refresh cookie and returns only short-lived access-token data.
- **AC-02** Unknown email, inactive/deleted account, and incorrect password produce the same generic `401 AUTHENTICATION_FAILED`.
- **AC-03** Initial-password User receives restricted state and normal app APIs return `403 PASSWORD_CHANGE_REQUIRED`.
- **AC-04** Mandatory password change saves a valid different password, revokes the restricted session, and requires fresh Login.
- **AC-05** Normal password change revokes all User sessions and requires fresh Login.
- **AC-06** Non-Remember sessions expire by 8 hours; Remember sessions expire by the earlier of 30 days idle or 90 days absolute.
- **AC-07** Refresh rotates credentials and access JWT is never persisted in Web Storage.
- **AC-08** Previous-token reuse within 30 seconds does not falsely revoke; reuse afterward revokes the session.
- **AC-09** Same-origin tabs coordinate refresh/logout through the approved lock/broadcast behavior.
- **AC-10** Logout remains successful with expired access JWT when the refresh session identifies the current session.
- **AC-11** Logout All invalidates every active session for that User.
- **AC-12** Login rate-limit boundaries return `429 RATE_LIMITED` with safe `Retry-After`.
- **AC-13** Anonymous protected API/UI access is rejected before protected content renders.
- **AC-14** Wrong-role UI uses safe 403 and backend independently rejects the forbidden API.
- **AC-15** Requester Ticket ownership derives from authenticated identity, never a client requesterId.
- **AC-16** Cross-Requester Ticket/Attachment access returns safe indistinguishable `404`.
- **AC-17** Lab 2 Requester Ticket/Attachment/idempotency workflow continues under auth without selector or `X-Requester-Id`.
- **AC-18** Reload with valid refresh session shows no Login/stale-role flash during AuthProvider bootstrap.
- **AC-19** Claiming unassigned `NEW` atomically sets owner and `OPEN`.
- **AC-20** Ownership race produces one valid mutation and `409 OWNERSHIP_CONFLICT` for stale expected state.
- **AC-21** Assignment accepts only active eligible IT Staff/Administrator owners.
- **AC-22** Unassign preserves current status.
- **AC-23** Non-owner IT Staff cannot perform owner-only lifecycle actions.
- **AC-24** Admin non-owner cannot perform IT operations; Admin owner gains approved owner-only operations.
- **AC-25** IT Priority change never changes Requested Priority.
- **AC-26** Only BR-58 lifecycle transitions succeed; invalid transitions return `409 INVALID_STATUS_TRANSITION`.
- **AC-27** Request Information commits Public Comment + Waiting status together or neither.
- **AC-28** Requester comment while Waiting does not auto-resume.
- **AC-29** Mark Resolved moves to `RESOLVED` and exposes Requester confirmation.
- **AC-30** Close is blocked until Requester resolution confirmation exists.
- **AC-31** Requester reopen from Resolved/Closed produces `REOPENED`, owner null, confirmation cleared.
- **AC-32** Requester Cancel succeeds only for own NEW/OPEN Ticket.
- **AC-33** CANCELLED is terminal.
- **AC-34** Valid Public Comment 1-2000 succeeds with backend author/time; whitespace/over-limit fails.
- **AC-35** Root comments are newest-first, default 10, with up to three oldest-first reply previews and reply count.
- **AC-36** Additional replies paginate by 5 oldest-first.
- **AC-37** Reply to depth 2 remains visual depth 2 and records exact reply target for metadata mention.
- **AC-38** No comment/reply edit/delete exists and content renders escaped plain text.
- **AC-39** IT Staff/Admin may read Internal Notes; Requester receives no note content.
- **AC-40** Valid Internal Note 1-4000 succeeds; notes are flat/append-only.
- **AC-41** Queue search uses approved four fields with OR search + AND filters.
- **AC-42** Queue filters validate to typed resource-owned expressions before QueryBuilder.
- **AC-43** Default queue order is unassigned, HIGH->LOW, oldest, deterministic tie-break.
- **AC-44** Initial Queue UI hides CLOSED/CANCELLED but can reveal them.
- **AC-45** Page size 1-100 works and out-of-range page returns `200 []` plus valid pagination.
- **AC-46** Invalid query field/operator/type is rejected before data-access execution.
- **AC-47** User list search/role filter uses shared collection mechanics and default name ascending.
- **AC-48** Create User creates one role, Active default, must-change flag, and returns one-time 16-char initial password.
- **AC-49** Case-insensitive duplicate email returns `409 DUPLICATE_EMAIL`.
- **AC-50** Valid User edit persists and performs required session-revocation/unassignment side effects transactionally.
- **AC-51** Admin self-deactivation, self-role change, and self initial-password reset are rejected.
- **AC-52** Last active Admin cannot be deactivated or demoted.
- **AC-53** Initial-password reset revokes target sessions, sets must-change, and returns new password once.
- **AC-54** Non-Admin User Management access is forbidden.
- **AC-55** Dirty Create/Edit User navigation asks for discard confirmation; untouched leaves directly.
- **AC-56** Create User success keeps one-time password out of URL/router history/persistent storage.
- **AC-57** CommonForm renders supported typed fields and maps semantic spans to Bootstrap 5 responsive classes.
- **AC-58** Zod/RHF validation blocks invalid submit, shows field errors, and focuses first invalid.
- **AC-59** Central server error mapping sends known details to fields and unknown errors to form level.
- **AC-60** Specialized Ticket AttachmentSection may render through custom without moving lifecycle into CommonForm.
- **AC-61** Major screens work at desktop/tablet/mobile without clipping/overlap/horizontal overflow.
- **AC-62** Primary workflows remain keyboard operable with visible focus and accessible labels.
- **AC-63** Public Comments and Internal Notes are clearly visually distinct with persistent private-note warning.
- **AC-64** Safe failures never expose raw database/auth secrets/protected cross-owner information.
- **AC-65** Populated Lab 2 database migrates without losing Requester ownership or existing Category/System/Ticket/Attachment/idempotency data.
- **AC-66** Maintenance cleanup removes only eligible expired technical state and is safely repeatable.

## 10. Definition of Done

### 10.1 Product Completion

Lab 3 is product-complete only when all of the following are true:

- All approved FR, BR, AC, API, data, UI, responsive, accessibility, authentication, and authorization requirements are implemented.
- `specification.md`, `tests.md`, `ui-spec.md`, and `api-spec.md` remain mutually consistent.
- Every `AC-01` through `AC-66` maps to at least one planned test/evidence item in `tests.md`.
- Real authentication fully replaces the Development Requester selector and `X-Requester-Id`.
- Password/session/refresh/rate-limit/revocation behavior is covered by automated tests.
- Backend authorization covers every role/capability boundary.
- Real PostgreSQL tests cover migration, `citext`, sessions, ownership/status, comments/notes, and Admin safety.
- Requester regression proves Lab 2 Ticket/Attachment/idempotency behavior still works under auth.
- Ticket workflow covers the complete transition matrix and concurrency conflicts.
- Comment tests cover pagination, bounded threading, permissions, validation, and append-only behavior.
- Internal Note tests cover visibility, creation permission, validation, and pagination.
- Admin tests cover listing/search/filter/create/edit/activation/deactivation/safety/reset/non-Admin denial.
- CommonForm tests cover built-ins, semantic Bootstrap spans, RHF/Zod behavior, server-error mapping, actions, lookup/attachment/custom, dirty state, and accessibility.
- E2E covers authentication/first password change/logout, Requester regression, Staff workflow, and Administrator User Management.
- Required screenshots cover major Lab 3 screens at `1440x900`, `820x1180`, and `390x844`.
- Client and server build/typecheck pass.
- All required test suites pass with no skipped/disabled replacement evidence.
- Prisma migrations and idempotent seed reproduce a fresh database and correctly upgrade a populated Lab 2 database.
- No password plaintext, refresh token, JWT secret, database credential, or real personal secret is committed or logged.
- Centralized errors, request correlation, no-store, CORS, and structured logging remain consistent.

### 10.2 Course Delivery / Engineering Workflow

- `lab3-staging` is created from completed Lab 2 `main`.
- Sprint 3 work is decomposed into reasonable GitHub Issues before implementation.
- Each implementation Issue uses its own
  `feature/<actual-issue-number>-<short-kebab-name>` feature branch.
- Feature branches enter `lab3-staging` through peer-reviewed Pull Requests.
- Focused tests identified in `tests.md` pass before each implementation Issue is Done.
- Review comments/approvals are recorded in `reviewer.md`.
- Integration/regression/E2E testing completes on `lab3-staging`.
- One release PR merges `lab3-staging` into `main`.
- No direct development occurs on `main` or `lab3-staging`.
- Required `docs/lab-03/` files and screenshot evidence under
  `docs/lab-03/evidence/screenshots/` are committed.
- Final `main` remains grading source of truth.

## 11. Assumptions and Decisions

1. **Hybrid authentication:** short-lived access JWT + authoritative PostgreSQL session.
2. **Role authority:** current DB User/role/session is authoritative.
3. **Refresh security:** browser plaintext only in HttpOnly cookie; DB hash only.
4. **Separate `/auth/me`:** Login/refresh return token data only.
5. **Restricted first-login stage:** authenticated enough to change password, not normal workflow.
6. **Fresh login after password change:** mandatory/normal password change ends sessions.
7. **No password history:** only same-as-current is prohibited.
8. **One User/one role:** no multi-role model.
9. **User public UUID:** internal numeric IDs remain private.
10. **Case-insensitive email:** PostgreSQL `citext`.
11. **Admin/IT separation:** Admin gets operational Ticket permissions only by explicit ownership; non-owner Ticket read, Public Comment read/post, and Internal Note read remain non-operational permissions.
12. **Eligible owner:** active IT Staff or Administrator; Claim remains IT Staff self-assignment.
13. **Semantic status API:** business actions replace generic status editing.
14. **Requester resolution semantics:** confirmation timestamp never directly sets Resolved/Closed.
15. **Requester reopen:** Resolved/Closed can become Reopened and unassigned.
16. **Public Comments:** Facebook-like bounded 2-level visual threading with reply-target metadata.
17. **Comment pagination:** root comments and replies lazy-load independently.
18. **Internal Notes:** flat private operational stream.
19. **Ticket query standard:** collections reuse Lab 2 grammar/metadata with resource-specific whitelists.
20. **User Management simplicity:** shared plumbing, deliberately simple UI.
21. **Authenticated Attachment migration:** Requester Attachment routes move under `/api/users/me/...` while preserving Lab 2 behavior.
22. **Form refactor:** Lab 3 introduces typed CommonForm to avoid duplicated Login/Password/User/Ticket form behavior.
23. **Hybrid form validation:** config = presentation; Zod = authoritative client validation.
24. **Bootstrap layout abstraction:** semantic spans map to Bootstrap 5 internally.
25. **Custom field discipline:** custom only for very specific workflows; built-ins first.
26. **Maintenance:** explicit command, not app timer.
27. **Pre-implementation document:** final implementation/test evidence is intentionally deferred to `tests.md`, `reviewer.md`, and later evidence updates.
