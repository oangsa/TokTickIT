# Lab 3 UI Specification

## 1. Purpose

This document defines the implementation-ready user-interface contract for TokTickIT Lab 3.

Lab 3 must look and behave like a direct evolution of the completed Lab 2 application. The established Zen Green visual language, Bootstrap 5 layout constraint, form density, card hierarchy, badges, validation placement, responsive behavior, accessible focus, and standalone error experience remain in force.

Lab 3 UI scope includes:

- Login;
- mandatory first-login Change Password;
- authenticated application shell;
- role-specific navigation;
- Requester regression for Create Ticket, My Tickets, Ticket Detail, and Attachments;
- Requester Public Comments and resolution/cancel/reopen actions;
- IT Staff Ticket Queue;
- IT Staff and Administrator Ticket Detail;
- Ticket Owner and IT Priority presentation;
- semantic Ticket lifecycle actions;
- Public Comments and Internal Notes;
- Administrator User Management;
- reusable config-driven CommonForm foundation;
- loading, saving, validation, empty, no-results, conflict, forbidden, not-found, session-ended, and safe failure feedback;
- desktop, tablet, and mobile layouts;
- accessibility and visual-inspection rules.

The Lab Sheet illustrations and Lab 2 screenshots are visual-direction references rather than pixel-perfect templates. Explicit Lab 3 handout requirements remain mandatory; this UI specification resolves the choices intentionally left open by the handout.

Shared contract anchors: the role enum is exactly `REQUESTER`, `IT_STAFF`, or
`ADMINISTRATOR`; Ticket status is exactly `NEW`, `OPEN`, `IN_PROGRESS`,
`WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, or `CANCELLED`;
AuthProvider uses in-memory access JWT state plus an authoritative PostgreSQL
session; and CommonForm uses typed fields, React Hook Form, `zodResolver`,
Bootstrap 5 spans, shared constants, and centralized server-error mapping.
The required committed visual evidence root is
`docs/lab-03/evidence/screenshots/`.

---

## 2. Visual Direction

The UI remains a professional internal business application:

- compact but not cramped;
- strong information hierarchy;
- white bordered surfaces on a quiet near-white page background;
- Zen Green navigation and primary actions;
- Bootstrap 5 responsive grid and utilities;
- labels above form controls;
- clearly differentiated editable and read-only controls;
- small readable status, priority, ownership, and role badges;
- clear operational ownership and lifecycle actions;
- restrained confirmation dialogs;
- explicit separation between public and internal communication;
- consistent empty, no-results, validation, busy, conflict, forbidden, and failure states.

New authentication, staff, and administrator screens must not look like a second application.

---

## 3. Design Tokens

### 3.1 Colors

Lab 2 tokens remain the baseline:

| Token / Use | Value / Rule |
|---|---|
| Primary Green | `#006B3C` |
| Secondary Green | `#0B7A46` |
| Pale Green | `#EAF6EF` |
| Page Background | `#F5F7F6` |
| Surface / Card | White |
| Main Text | Dark charcoal-green; normal body text is not pure black |
| Editable Field | White background with neutral border |
| Read-only Field | Soft gray-green or warm-ivory background |
| Error | Dark red text/border |
| Warning | Amber |
| Success | Green with readable text |
| Internal / Private | Distinct neutral or amber-accented treatment that cannot be confused with Public Comments |

Primary and secondary green remain application emphasis colors. Meaning must never depend on color alone.

### 3.2 Typography

Primary stack remains:

```css
font-family:
  "Inter",
  system-ui,
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  sans-serif;
```

Typography remains restrained and business-like:

- page titles: strong bold heading;
- card/section headings: semibold;
- field labels: medium/semibold;
- body: regular;
- metadata/helper text: smaller secondary text;
- table headers: medium/semibold;
- buttons: medium/semibold.

### 3.3 Radius

| Component | Radius |
|---|---:|
| Inputs / selects / textareas | `8px` |
| Buttons | `8px` |
| Cards / surfaces | `12px` |
| Modals | `12px` |
| Badges | Pill / fully rounded |

### 3.4 Spacing

Retain the Lab 2 rhythm:

- desktop page/card spacing around `24px`;
- tablet around `20px`;
- mobile around `16px`;
- form/control gap around `16-20px`;
- major section gap around `24px`.

Bootstrap 5 spacing utilities are preferred where they express the approved spacing cleanly.

### 3.5 Content width

Desktop main content remains centered within the available shell space with an approximate sensible maximum:

```css
max-width: 1280px;
```

The sidebar is outside that width calculation.

---

## 4. Responsive Breakpoints

| Viewport | Required behavior |
|---|---|
| Desktop `>= 992px` | Persistent sidebar; table-oriented Queue/User list; multi-column forms/detail where useful |
| Tablet `768-991px` | Collapsible navigation where needed; Queue may use stacked cards when a table becomes cramped; two-column forms where practical |
| Mobile `< 768px` | Drawer navigation; single-column forms; Queue cards; touch-friendly actions; no page-level horizontal scrolling |
| All sizes | No clipped labels, overlapping feedback, hidden required controls, unreadable comments/filenames, or inaccessible actions |

Required visual-evidence viewports remain:

```text
Desktop  1440 x 900
Tablet   820 x 1180
Mobile   390 x 844
```

---

# 5. Authentication Restoration and Routing

## 5.1 AuthProvider states

The client uses explicit authentication states:

```text
BOOTSTRAPPING
ANONYMOUS
PASSWORD_CHANGE_REQUIRED
AUTHENTICATED
```

Initial load:

```text
Application starts
      |
      v
BOOTSTRAPPING
      |
      +--> POST /api/auth/refresh
              |
              +--> success --> GET /api/auth/me
              |                  |
              |                  +--> restricted --> PASSWORD_CHANGE_REQUIRED
              |                  +--> full -------> AUTHENTICATED
              |
              +--> invalid ------> ANONYMOUS
```

During `BOOTSTRAPPING`:

- do not render AppShell;
- do not render protected page content;
- do not flash Login before refresh resolves;
- do not display stale User/role information;
- render a neutral application-level skeleton/loading state;
- do not start feature data requests whose authorization depends on unresolved identity.

## 5.2 Route map

```text
Public/auth-aware
/login
/change-password
/error

Requester
/tickets
/tickets/new
/tickets/:publicId

IT Staff
/staff/tickets
/staff/tickets/:publicId

Administrator
/admin/users
/admin/users/new
/admin/users/:publicId/edit
/admin/tickets
/admin/tickets/:publicId
```

Root `/` resolves only after authentication state is known:

```text
ANONYMOUS                -> /login
PASSWORD_CHANGE_REQUIRED -> /change-password
REQUESTER                -> /tickets
IT_STAFF                 -> /staff/tickets
ADMINISTRATOR             -> /admin/users
```

## 5.3 Guard order

Conceptual structure:

```text
AuthProvider
  |
  +-- public/auth-aware routes
  |
  +-- AuthGuard
       |
       +-- RequesterRoleGuard -> AppShell -> requester routes
       +-- ITStaffRoleGuard   -> AppShell -> staff routes
       +-- AdminRoleGuard     -> AppShell -> admin routes
```

The guard remains outside the role-specific shell content so forbidden or unauthenticated data never renders first.

## 5.4 Wrong-role navigation

An authenticated User who opens a role-forbidden route is sent to:

```text
/error
state = { status: 403 }
```

Reuse the Lab 2 standalone safe error architecture.

Do not silently redirect a forbidden User to an unrelated role home without feedback.

## 5.5 Session ended

If refresh/current-session state becomes invalid:

1. clear the in-memory access token and current User;
2. broadcast a same-origin session-ended event;
3. clear stale role-scoped feature state;
4. navigate to `/login`;
5. show safe session-ended feedback when useful.

`ACCESS_TOKEN_EXPIRED` is handled first by the central API/auth transport through one coordinated refresh and one retry. Components must not display a transient failure before that retry completes.

---

# 6. Application Shell

## 6.1 Desktop shell

Desktop retains the Lab 2 persistent left sidebar, approximately `240px`.

The bottom identity area changes from Development Requester context to authenticated identity:

```text
REQUESTER / IT STAFF / ADMINISTRATOR
Jane Doe
[role badge]

Change Password
Logout
```

The Development Requester name and `Change Requester` action are removed.

## 6.2 Requester navigation

```text
[ + Create Ticket ]

My Tickets
```

Preserve the Lab 2 distinction: Create Ticket starts work and is presented as the primary action; My Tickets is the standard destination/navigation row.

## 6.3 IT Staff navigation

```text
Ticket Queue
```

IT Staff do not receive User Management navigation.

## 6.4 Administrator navigation

```text
User Management
Tickets
```

Administrator Ticket pages are read-only unless that Administrator is explicitly assigned as the Ticket Owner, except Public Comment read/post and Internal Note read permissions defined by the authorization contract.

## 6.5 Role badge

The shell shows a clear role badge:

```text
REQUESTER
IT STAFF
ADMINISTRATOR
```

Role meaning never depends on badge color alone.

## 6.6 Mobile shell

Use the existing accessible hamburger/drawer behavior.

The drawer contains only destinations permitted for the current role and the same authenticated identity, Change Password, and Logout actions.

Frontend visibility is user feedback only; backend authorization remains authoritative.

---

# 7. Shared Config-Driven Form Foundation

## 7.1 Purpose

Lab 3 refactors repeated form rendering into a typed CommonForm foundation.

The goal is to centralize repeated rendering, validation presentation, state wiring, actions, and server-error mapping without moving business workflows into a single god component.

## 7.2 Architecture

```text
Feature Page
  |
  +-- form definition factory
  +-- Zod schema
  +-- useManagedForm
  |     +-- react-hook-form
  |     +-- zodResolver
  |     +-- values/errors/dirty/touched
  |     +-- first-invalid focus
  |     +-- setValue/setValues
  |
  +-- CommonForm
        +-- sections
        +-- typed field renderer
        +-- validation presentation
        +-- standard form actions
```

Feature pages retain:

- API calls;
- authentication/domain workflow;
- Ticket idempotency/recovery;
- Pending Attachment lifecycle;
- navigation outcomes;
- role/authorization-dependent business decisions.

## 7.3 Shared constants

Approved structure:

```text
client/src/constants/forms/
├── index.ts
├── auth.ts
├── ticket.ts
└── user.ts
```

Example:

```ts
export const TICKET_FORM_RULES = {
  summary: { minLength: 3, maxLength: 150 },
  description: { minLength: 10, maxLength: 2000 },
  publicComment: { minLength: 1, maxLength: 2000 },
  internalNote: { minLength: 1, maxLength: 4000 },
} as const;
```

Form config and Zod schemas use the same source constant when they share a domain boundary.

Validation message strings do not need to be global constants.

## 7.4 Validation ownership

The approved model is hybrid:

- field config owns presentation metadata and HTML semantics;
- Zod owns authoritative client validation;
- backend validation remains authoritative for the system.

Example config:

```ts
{
  key: "summary",
  name: "summary",
  label: "Summary",
  type: "text",
  required: true,
  showCount: true,
  maxLength: TICKET_FORM_RULES.summary.maxLength,
  span: "full",
}
```

Example schema:

```ts
z.string()
  .trim()
  .min(TICKET_FORM_RULES.summary.minLength)
  .max(TICKET_FORM_RULES.summary.maxLength)
```

`required`, `maxLength`, counters, and similar config values support presentation; a field does not become system-valid merely because its config metadata is satisfied.

## 7.5 Built-in field types

The shared renderer supports:

```text
text
email
password
number
date
textarea
select
radio
checkbox
switch
readonly
attachment
lookup
custom
```

Built-in fields are preferred.

### Lookup

`lookup` is a form-bound entity selection control whose picker UI is more specialized than a normal select.

Example future use:

```text
Ticket Owner
[ Bob Smith                         ] [ Lookup ]
```

The lookup ultimately updates the bound form value such as `ownerPublicId`.

### Custom

`custom` is reserved for a very specific feature control/workflow that does not reasonably fit a built-in field type.

It must not be used simply to avoid extending a reusable built-in renderer.

## 7.6 Attachment and Custom

A normal generic file input may use:

```text
type = attachment
```

The existing Create Ticket AttachmentSection may use:

```text
type = custom
```

because it owns Pending upload, retry, unresolved state, cleanup, preview, Active binding, and idempotency-coupled behavior.

CommonForm does not own those transitions.

## 7.7 Sections and layout

Forms receive:

```ts
FormSection<TValues>[]
```

A section may define:

```text
key
title
description
card
fields
```

Standard semantic field spans:

```text
full
half
third
quarter
```

The config remains clean and implementation-independent at call sites, while CommonForm maps those spans internally to Bootstrap 5 responsive grid classes.

Conceptual mapping:

```text
full    -> col-12
half    -> col-12 col-md-6
third   -> col-12 col-md-6 col-lg-4
quarter -> col-12 col-md-6 col-lg-3
```

Bootstrap 5 is the required underlying layout system.

## 7.8 Form actions

CommonForm owns the normal action row through props such as:

```text
showSubmitButton
showCancelButton
submitLabel
cancelLabel
submitting
submitDisabled
cancelDisabled
onSubmit
onCancel
```

Defaults favor normal Create/Edit forms.

Examples:

Login:

```text
showCancelButton = false
submitLabel = Sign in
```

Create User:

```text
showCancelButton = true
submitLabel = Create User
```

Change Password:

```text
showCancelButton = false
submitLabel = Change Password
```

Busy actions:

- remain disabled while processing;
- preserve their normal label;
- show a spinner/progress indicator;
- preserve button dimensions where practical.

## 7.9 Server validation mapping

One reusable helper maps centralized API `details[]` to React Hook Form errors.

Known field example:

```text
details.email -> email field error
```

Unknown/unbound errors become safe form-level feedback.

The first invalid relevant field receives focus after a failed form submission.

## 7.10 Dirty state

`useManagedForm` exposes `isDirty`.

The page decides whether to register the Navigation Guard.

Examples:

- Create Ticket: yes;
- Create User: yes;
- Edit User: yes;
- Login: no discard dialog merely because an email was typed;
- Change Password: no generic navigation guard unless a later specific security/UX rule requires it.

---

# 8. Login

## 8.1 Screen role

Login is the unauthenticated entry point for all roles.

It renders outside the authenticated AppShell.

## 8.2 Layout

Desktop uses a centered bordered card approximately:

```text
420-520px
```

Conceptual layout:

```text
               TokTickIT

      ┌──────────────────────────┐
      │ Sign in                  │
      │                          │
      │ Email *                  │
      │ [                      ] │
      │                          │
      │ Password *               │
      │ [                    👁 ] │
      │                          │
      │ [ ] Remember me          │
      │                          │
      │          [ Sign in ]     │
      └──────────────────────────┘
```

On mobile the card uses the available width within normal page padding.

## 8.3 Validation and safe failure

Client validation:

- Email required and valid format;
- Password required;
- Remember Me is boolean;
- Password is not trimmed.

Server authentication failure displays:

```text
Invalid email or password.
```

Do not display different UI copy for unknown, inactive, deleted, or incorrect-password cases.

Rate-limit failure displays safe retry guidance without confirming whether an account exists.

## 8.4 Password visibility

If a password visibility icon is provided:

- it must be keyboard-operable;
- it must have an accessible programmatic name;
- it must have a visible tooltip/equivalent hover/focus label;
- toggling visibility must not modify the password value.

## 8.5 Busy state

While Login is submitting:

- repeated submit is prevented;
- Sign in remains disabled;
- a spinner is shown while preserving the action label;
- controls that would create an inconsistent second submission are disabled appropriately;
- layout does not jump.

## 8.6 Success routing

After Login returns an access token, the client retrieves `/api/auth/me`.

Then:

```text
PASSWORD_CHANGE_REQUIRED -> /change-password
REQUESTER                -> /tickets
IT_STAFF                 -> /staff/tickets
ADMINISTRATOR             -> /admin/users
```

---

# 9. Change Password

## 9.1 Mandatory first-login mode

Restricted-session screen:

```text
Change Password
You must choose a new password before continuing.

New Password *
[                              ]

Confirm New Password *
[                              ]

Password requirements...
                         [ Change Password ]
```

The initial password is not requested a second time because the restricted session was established only after correct Login credential verification.

The normal AppShell and role pages do not render.

## 9.2 Full-session normal mode

Opened from the authenticated shell.

Fields:

```text
Current Password *
New Password *
Confirm New Password *
```

## 9.3 Password guidance

Visible requirements communicate:

- 8-128 characters;
- at least one uppercase letter;
- at least one lowercase letter;
- at least one number;
- at least one symbol;
- spaces are allowed but do not count as the required symbol;
- the new password must differ from the current password.

Do not trim, normalize, or silently rewrite password content.

## 9.4 Confirmation field

`Confirm New Password` is frontend validation only.

Mismatch is shown locally and no API call occurs.

## 9.5 Success

On successful password change:

```text
Password changed successfully.
Please sign in again.
```

All relevant credentials/session state are cleared and the User returns to Login.

---

# 10. Requester Regression

## 10.1 Removed Development Requester UI

Remove:

```text
/requesters
Development Requester Selection
Change Requester
sessionStorage requester identity
X-Requester-Id UI assumptions
```

Requester identity is now supplied by AuthProvider and the authenticated backend session.

## 10.2 Create Ticket

Preserve Lab 2:

- generated Ticket Number and Ticket Date read-only controls;
- Category;
- Related System;
- Requested Priority;
- Summary/Description counters;
- Pending Attachment pre-upload;
- unresolved file blocking;
- idempotent submit/recovery;
- discard confirmation;
- `4xx` field retention;
- ambiguous `5xx` recovery;
- successful navigation to Ticket Detail.

Requester read-only field displays the authenticated User name.

Remove Lab 2 copy that tells the User to change Requester through navigation.

The Create Ticket field markup should be migrated to CommonForm where appropriate while the specialized Ticket Attachment workflow remains feature-owned.

## 10.3 My Tickets

Preserve the Lab 2 Requester list behavior unless explicitly changed by this contract:

- responsive table;
- own-Ticket scope;
- search;
- filters;
- sorting;
- pagination;
- clear filters;
- empty vs no-results;
- skeletons;
- full-row navigation;
- safe failures.

Requester ownership now comes from authenticated identity.

## 10.4 Requester Ticket Detail

Preserve:

- Ticket Information;
- Requested Priority;
- status badge;
- Requester information;
- Category/System;
- Summary/Description;
- Attachment section;
- preview/download/removal behavior for owned attachments.

Add:

- Public Comments;
- Looks Resolved;
- Problem Still Exists;
- permitted Requester Cancel.

Internal Notes never render for Requester.

---

# 11. Requester Ticket Actions

## 11.1 Cancel

Visible only for the authenticated Requester's own Ticket in:

```text
NEW
OPEN
```

Confirmation:

```text
Cancel this Ticket?
This action will stop further work on it.

[ Keep Ticket ] [ Cancel Ticket ]
```

The final cancel action uses destructive styling.

## 11.2 Looks Resolved

Visible only while status is:

```text
RESOLVED
```

It must not look like the Requester is formally changing status to Closed.

Suggested copy:

```text
Problem appears resolved
```

After success:

```text
You confirmed that the problem appears resolved.
```

The Ticket remains `RESOLVED`.

## 11.3 Problem Still Exists

Visible while:

```text
RESOLVED
CLOSED
```

Confirmation:

```text
Reopen this Ticket?
It will return to the IT queue as unassigned.

[ Cancel ] [ Reopen Ticket ]
```

Success UI immediately reflects:

```text
Status: REOPENED
Owner: Unassigned
```

---

# 12. IT Staff Ticket Queue

## 12.1 Page header and desktop layout

```text
Ticket Queue
Find and prioritize support work.
```

Main card:

```text
┌────────────────────────────────────────────────────────────┐
│ [ Search......................... ] [ Filters ] [ Sort ▼ ] │
│                                                            │
│ active filter chips / Clear Filters                        │
│                                                            │
│ Ticket table                                               │
│                                                            │
│ result count / rows per page / pagination                  │
└────────────────────────────────────────────────────────────┘
```

## 12.2 Desktop columns

Primary columns:

1. Ticket Number
2. Summary + Category
3. IT Priority
4. Status
5. Owner
6. Created

Requested Priority is available in Ticket Detail and filtering rather than creating another permanent primary column.

Last Updated may be available for sorting or secondary metadata without being a permanent column.

This intentionally avoids an unreadable mega-grid.

## 12.3 Summary + Category cell

The primary text is Summary.

Category renders as secondary metadata within the same cell.

Example:

```text
VPN disconnects after sign-in
Network
```

## 12.4 Owner presentation

Examples:

```text
Alice IT
Unassigned
Admin User
```

Unassigned is explicit text, not an empty cell.

## 12.5 Row interaction

The full row may open Staff Ticket Detail if implemented accessibly.

Required behavior:

- mouse-operable;
- keyboard focusable;
- visible focus;
- clear interaction affordance;
- Enter/Space behavior where the chosen row pattern supports it;
- accessible full-value behavior for safely truncated content.

## 12.6 Smaller screens

Tablet/mobile use stacked Ticket cards instead of forcing the desktop mega-grid.

Example:

```text
TKT-20260910-A81F3C9D7B21
VPN disconnects after login

HIGH        IN PROGRESS
Owner: Alice IT
Category: Network
Created: 10 Sep 2026

[ Open Ticket ]
```

No page-level horizontal scrolling is allowed.

---

# 13. Queue Search, Filters, Sorting, and Pagination

## 13.1 Search

Placeholder:

```text
Search ticket number, summary, description, or requester...
```

Search fields:

```text
ticketNumber
summary
description
requesterName
```

Use the existing debounced list-search pattern where practical.

A search/query change resets page to 1.

## 13.2 Filters

Primary visible filters:

```text
Status
IT Priority
Owner
Category
```

More Filters:

```text
Requested Priority
Related System
Created From
Created To
```

The UI maps friendly controls to the resource query contract.

It must not expose raw filter JSON.

## 13.3 Filter modal/draft behavior

Reuse the Lab 2 draft/apply pattern:

- opening creates draft filter state;
- Cancel discards draft changes;
- Reset clears only the draft until Apply;
- Apply commits and resets page 1;
- committed filters are represented by count/chips;
- removing a committed chip applies immediately;
- Clear Filters is available whenever search/filter state is active.

## 13.4 Default terminal filtering

Initial committed UI state excludes:

```text
CLOSED
CANCELLED
```

The UI offers a clear way to include all statuses/terminal Tickets.

Terminal Tickets are not hidden permanently by the API.

## 13.5 Sorting

User-facing options include:

- Operational Priority — default;
- Newest;
- Oldest;
- IT Priority High to Low;
- IT Priority Low to High;
- Status as approved;
- Ticket Number A-Z;
- Ticket Number Z-A.

Operational Priority means:

```text
Unassigned first
HIGH -> MEDIUM -> LOW
Oldest Created first
```

## 13.6 Pagination

Desktop follows the established Lab 2 pattern:

```text
Showing 1-10 of 47
Rows per page [10 ▼]
Previous  1 2 3 4 5  Next
```

Default page size:

```text
10
```

The API supports 1-100.

The UI may reuse presets:

```text
10
20
30
50
100
```

Mobile uses compact:

```text
Page 1 of 5
[ Previous ] [ Next ]
Rows per page [10 ▼]
```

## 13.7 Loading

Desktop:

- table skeleton rows.

Tablet/mobile:

- Ticket-card skeletons.

Existing previous-query rows must not be displayed as if they belong to the newly committed query when doing so would misrepresent current filters.

## 13.8 Empty and no-results

True queue empty:

```text
No Tickets are currently available.
```

Search/filter no-results:

```text
No Tickets match your search or filters.
Try changing the current query.
```

When filters/search are active, the toolbar retains Clear Filters.

---

# 14. IT Staff / Administrator Ticket Detail

## 14.1 Page header

```text
TKT-20260910-A81F3C9D7B21      [ Back to Ticket Queue ]
Ticket Detail
```

Ticket Number remains the strongest human-facing Ticket identifier.

## 14.2 Information grouping

Use separate cards/sections:

```text
Ticket Information
Assignment & Workflow
Attachments
Communication
```

Ticket Information remains primarily read-only.

## 14.3 Ticket Information

Visible data includes:

- Ticket Number;
- Ticket Date;
- Current Status;
- Requested Priority;
- Requester Name;
- Requester Email;
- Category;
- Related System;
- Summary;
- Description.

IT Priority and Owner belong in the operational section rather than being mixed into Requester-submitted information.

## 14.4 Assignment & Workflow

Conceptual:

```text
Assignment & Workflow

Requested Priority   HIGH      [read-only]
IT Priority          HIGH      [editable if permitted]

Ticket Owner         Alice IT  [Lookup / Change if permitted]
Current Status       IN PROGRESS

[ Request Information ] [ Mark Resolved ] ...
```

Do not render a generic editable Current Status dropdown.

## 14.5 Administrator modes

### Admin non-owner

Permitted UI:

- Queue read;
- Ticket read;
- Public Comment read/post;
- Internal Note read;
- Attachment read.

Unavailable:

- Claim;
- assign/reassign/unassign;
- IT Priority edit;
- lifecycle action buttons;
- Internal Note composer.

### Admin assigned owner

Permitted in addition:

- reassign/unassign;
- IT Priority edit;
- owner-only lifecycle actions;
- Internal Note composer.

Still unavailable:

- Claim.

The UI must not suggest that every Administrator is IT Staff.

---

# 15. Ticket Ownership UI

## 15.1 Claim

For IT Staff on an unassigned Ticket:

```text
Owner: Unassigned                       [ Claim Ticket ]
```

No confirmation is required.

Claim may show a localized busy state.

An ownership race displays a recoverable conflict rather than silently overwriting another owner.

## 15.2 Owner lookup

Owner mutation uses the shared `lookup` field/control pattern when appropriate.

Only active eligible IT Staff/Administrator users appear as valid selections.

The display includes enough context to distinguish Users, at minimum name and role.

## 15.3 Reassign

Replacing another owner requires confirmation:

```text
Reassign this Ticket?

Current owner: Alice IT
New owner: Bob IT

[ Cancel ] [ Reassign ]
```

## 15.4 Unassign

Confirmation:

```text
Unassign this Ticket?
The Ticket will return to the queue without changing its current status.

[ Cancel ] [ Unassign ]
```

## 15.5 Ownership conflict

`409 OWNERSHIP_CONFLICT` is handled locally:

```text
Ticket ownership changed while you were viewing it.
Reload the current Ticket before trying again.

[ Reload Ticket ]
```

Do not navigate to generic 500.

---

# 16. IT Priority

Requested Priority is always read-only after Ticket creation.

IT Priority:

- uses `LOW`, `MEDIUM`, `HIGH`;
- begins equal to Requested Priority;
- is editable by IT Staff;
- is editable by an Administrator only when that Administrator owns the Ticket;
- uses a badge/text treatment consistent with Requested Priority;
- never changes Requested Priority.

Saving IT Priority uses localized busy feedback and does not freeze unrelated Ticket sections unless required for state consistency.

---

# 17. Semantic Status Actions

## 17.1 General rule

Do not expose arbitrary status editing.

Render only semantic actions valid for the current status, ownership, and role.

Possible actions:

```text
Claim Ticket
Start Work
Request Information
Resume Work
Mark Resolved
Close Ticket
Cancel Ticket
```

The backend remains authoritative even if stale UI temporarily exposes an action that has become invalid.

## 17.2 Start Work

Owner-only.

Visible when status is:

```text
OPEN
REOPENED
```

No confirmation required.

## 17.3 Request Information

Owner-only.

Available from:

```text
OPEN
IN_PROGRESS
REOPENED
```

Opens a small required-message form:

```text
Request information from Requester

Message *
[                                         ]
[                                         ]

[ Cancel ] [ Request Information ]
```

Successful operation adds the Public Comment and changes status to `WAITING_FOR_REQUESTER`.

The message follows Public Comment validation.

## 17.4 Resume Work

Owner-only.

Visible when:

```text
WAITING_FOR_REQUESTER
```

A Requester Public Comment does not automatically Resume Work.

The owner decides when the supplied information is sufficient.

## 17.5 Mark Resolved

Owner-only.

Confirmation:

```text
Mark this Ticket as resolved?
The Requester will be asked to confirm whether the problem appears resolved.

[ Cancel ] [ Mark Resolved ]
```

## 17.6 Close

Owner-only.

Visible/available only when:

```text
Status = RESOLVED
Requester resolution confirmation = received
```

Close requires confirmation.

## 17.7 Cancel

Staff/Admin-owner Cancel requires confirmation and is shown only in statuses allowed by the workflow contract.

`CANCELLED` shows no further lifecycle action.

---

# 18. Public Comments

## 18.1 Visual direction

Public Comments are shared Ticket communication and should feel familiar and conversational, Facebook-like without becoming a social-network feature set.

Each item shows:

```text
Author Name   [Role]   Time
Comment content

Reply
```

No Edit/Delete actions.

Persisted content is plain text.

## 18.2 Root ordering and lazy loading

Root comments render:

```text
newest -> oldest
```

Initial page:

```text
10 root comments
```

Bottom action:

```text
[ Load more comments ]
```

Do not fetch the entire history on first render.

## 18.3 Reply preview

Each root may initially show up to three replies in:

```text
oldest -> newest
```

When more exist, use count-aware copy such as:

```text
View 5 more replies
```

Additional replies are loaded independently from root pagination.

## 18.4 Visual depth

Maximum visual depth:

```text
0 = root
1 = reply
2 = reply-to-reply
```

A reply to a depth-2 target remains at visual depth 2.

Example:

```text
Alice: VPN still fails
└─ Bob: Can you retry?
   └─ Alice: Still failing
   └─ @Alice Carol: I restarted the gateway
   └─ @Carol Alice: Works now
```

`@Name` is rendered from reply-target metadata. It is not automatically inserted into persisted comment content.

## 18.5 Reply composer

Selecting Reply identifies the target:

```text
Replying to Alice
[ text... ]

[ Cancel Reply ] [ Reply ]
```

The User does not need to type an `@mention` manually to establish reply semantics.

## 18.6 Validation

- trimmed content length 1-2000;
- whitespace-only rejected;
- character counter may be displayed;
- line breaks preserved;
- HTML/Markdown is not interpreted;
- submit uses localized busy state;
- safe failure retains typed content where practical.

## 18.7 Permissions in UI

Requester:

- own Ticket only.

IT Staff:

- all permitted Ticket reads/posts.

Administrator:

- permitted Ticket reads/posts even when not owner.

The Public Comment region must never reveal Internal Notes.

---

# 19. Internal Notes

## 19.1 Separation from Public Comments

Staff/Admin Ticket Detail uses clearly separated tabs:

```text
[ Public Comments ] [ Internal Notes ]
```

The Internal Notes tab contains a persistent warning such as:

```text
Internal — visible only to IT Staff and Administrators.
Do not place information here that should be sent to the Requester.
```

The composer must not look so similar to Public Comments that a User can easily confuse which audience will see the message.

## 19.2 Note list

Internal Notes are flat.

Default visual ordering is newest-first.

Use lazy pagination/Load More according to the API collection contract.

Each note shows:

- author;
- role;
- creation time;
- plain-text content.

No Reply/Edit/Delete action.

## 19.3 Composer permissions

Visible to:

- IT Staff;
- explicitly assigned Administrator owner.

Admin non-owner can read but does not see an enabled composer.

Requester has no Internal Notes tab or content.

## 19.4 Validation

```text
trimmed 1-4000 characters
```

Whitespace-only content is invalid.

---

# 20. Attachments in Lab 3

Requester Attachment UI preserves the Lab 2 lifecycle and visual contract:

```text
Uploading
Invalid
Failed
Pending
Active
Removed
```

Create Ticket may place the specialized AttachmentSection inside CommonForm through a `custom` field because its workflow is not a generic file input.

A normal/simple form may use the built-in `attachment` field.

Requester Ticket Detail retains:

- Active count `x/5`;
- Add Attachment;
- Preview;
- Download;
- active removal with reason;
- Removed evidence;
- safe binary behavior.

Staff/Admin Ticket Detail displays existing Attachment evidence and permitted Preview/Download actions.

Lab 3 does not add Staff/Admin Attachment upload/removal controls.

---

# 21. Administrator User Management List

## 21.1 Overall layout

```text
User Management                              [ + Create User ]
Manage access to TokTickIT.

┌─────────────────────────────────────────────────────────┐
│ [ Search name or email........ ] [ Role ▼ ]             │
│                                                         │
│ Name | Email | Role | Status | Edit                     │
│                                                         │
│ results / rows per page / pagination                    │
└─────────────────────────────────────────────────────────┘
```

The page remains intentionally simple.

## 21.2 Columns

Desktop columns:

1. Name
2. Email
3. Role
4. Status
5. Edit

Do not add:

- department;
- organization;
- profile image;
- account history;
- role history;
- bulk selection;
- export;
- last-login analytics.

## 21.3 Search

Search placeholder:

```text
Search by name or email...
```

Search is limited to:

```text
name
email
```

## 21.4 Role filter

One optional role filter:

```text
Any Role
Requester
IT Staff
Administrator
```

This is not an advanced multi-filter admin console.

## 21.5 Default order

```text
Name A-Z
```

with deterministic tie-break from the backend.

## 21.6 Pagination

Although the handout does not require User-list pagination, Lab 3 intentionally reuses the project collection standard.

Use the same pagination component/pattern as Ticket lists.

Default page size is 10.

---

# 22. Create User

## 22.1 Route

```text
/admin/users/new
```

This is a dedicated page, not a modal.

## 22.2 Page layout

```text
Create User
Create an account for TokTickIT.

User Information
┌────────────────────┬────────────────────┐
│ Name *             │ Email *            │
│ [                ] │ [                ] │
├────────────────────┼────────────────────┤
│ Role *             │ Status             │
│ [ Requester ▼ ]    │ [ Active ▼ ]       │
└────────────────────┴────────────────────┘

                         [ Cancel ] [ Create User ]
```

Uses CommonForm.

## 22.3 Field behavior

Name and Email:

```text
span = half
```

Role and Status:

```text
span = half
```

Mobile collapses every field to full width through CommonForm Bootstrap mapping.

Status defaults to Active.

Initial password is not an editable field because it is server-generated.

## 22.4 Dirty navigation

If the form is dirty, the following use the shared discard guard:

- Cancel;
- sidebar navigation;
- browser/back navigation supported by the app guard;
- other in-app route changes.

Untouched form may leave directly.

Confirmation:

```text
Discard unsaved changes?
Your User changes will be lost.

[ Keep Editing ] [ Discard ]
```

## 22.5 Successful creation

Remain on `/admin/users/new`, replace the editable form with a success state:

```text
User created successfully.

Initial Password
[ <shown-once-value> ] [ Copy ]

This password is shown only once.
The User must change it at first login.

[ Done ]
```

`Done` navigates to `/admin/users`.

The plaintext password must not be placed in:

- URL/query string;
- router/history state;
- localStorage/sessionStorage;
- logs;
- a re-fetchable User field.

## 22.6 Copy action

Copy has:

- visible label or accessible icon/label pair;
- keyboard operation;
- confirmation such as `Password copied`;
- no automatic persistent storage.

---

# 23. Edit User

## 23.1 Route

```text
/admin/users/:publicId/edit
```

## 23.2 Form reuse

Reuse the User form-definition factory with:

```text
mode = edit
```

Editable:

- Name;
- Email;
- Role;
- Status.

The page may disable or omit unsafe controls based on the current User/target User, but backend validation remains authoritative.

## 23.3 Session-affecting edits

When Email, Role, or activation changes, the UI communicates that the target User's active sessions will be ended.

Role changes require confirmation.

Deactivation requires confirmation.

## 23.4 Self-management safety

For the currently authenticated Administrator:

- Name: editable;
- Email: editable;
- Role: cannot change self role;
- Status: cannot deactivate self;
- Set New Initial Password: unavailable for self.

If self Email changes successfully, the current session is revoked according to the API contract and the UI returns to Login.

## 23.5 Last active Administrator

When the target is the last active Administrator:

- demotion is unavailable or clearly blocked;
- deactivation is unavailable or clearly blocked;
- stale UI attempts that reach the backend display the safe conflict response.

The UI must never claim the action succeeded when the backend protected the invariant.

## 23.6 Account Security section

```text
Account Security

Set a new initial password for this User.
The User will be signed out and must change it the next time they sign in.

[ Set New Initial Password ]
```

Self-target action is absent/disabled.

## 23.7 Reset confirmation

```text
Set a new initial password?
All active sessions for this User will end.
The new password will be shown once.

[ Cancel ] [ Set New Initial Password ]
```

After success, display the same one-time password panel pattern used after Create User.

## 23.8 Dirty navigation

Edit User uses the same shared dirty guard as Create User.

A successful save resets the dirty baseline to the persisted values.

---

# 24. Confirmation Dialog Set

Confirmation is required for:

- Requester Cancel Ticket;
- IT Staff/Admin-owner Cancel Ticket;
- Unassign Ticket;
- Reassign away from an existing owner;
- Mark Resolved;
- Close Ticket;
- Requester Problem Still Exists / Reopen;
- Administrator deactivation;
- Administrator role change;
- Administrator Set New Initial Password;
- dirty Create/Edit User discard.

No separate confirmation is required for:

- Claim;
- Start Work;
- Resume Work;
- normal Public Comment;
- Internal Note;
- IT Priority change.

Request Information uses its required-message dialog/form instead of a second confirmation after message entry.

Confirmations must:

- state the action in the title;
- state the important side effect;
- use explicit action labels, not generic `Yes`;
- trap focus;
- return focus to the invoking control after close;
- use destructive styling only for destructive meanings.

---

# 25. Loading, Saving, Success, and Conflict States

## 25.1 Loading

Use skeletons for data-heavy content:

- auth bootstrap;
- Ticket Queue rows/cards;
- Ticket Detail;
- User list;
- Edit User initial data;
- Comment/Note loading regions;
- Attachment tables.

Use spinner/busy buttons for short mutations.

## 25.2 Saving

Localized operations such as IT Priority, comment, note, and owner changes show localized busy state.

Do not freeze unrelated read-only content unnecessarily.

## 25.3 Success

Use non-intrusive success feedback for:

- IT Priority saved;
- ownership updated;
- status action complete;
- comment/reply/note posted;
- User saved;
- password copied.

One-time password creation/reset is intentionally prominent rather than a transient toast because the value cannot be fetched again.

## 25.4 Empty vs no-results

Retain the Lab 2 EmptyState principle:

- same reusable presentation component;
- different copy/actions for true empty dataset and filtered no-results.

## 25.5 Ownership/status conflict

Expected `409` conflicts remain local when the User can recover by refreshing current Ticket state.

Examples:

```text
Ownership changed. Reload Ticket.
Ticket status changed. Reload Ticket.
```

Do not send normal business conflicts to the generic 500 page.

## 25.6 Duplicate email

`409 DUPLICATE_EMAIL` maps to the Email field when possible:

```text
A User with this email already exists.
```

Form values remain available.

## 25.7 Forbidden after stale permission

A stale page may expose a control that becomes forbidden because role/session state changed elsewhere.

On `403`:

- do not retain optimistic success;
- refresh authoritative identity/Ticket state as appropriate;
- use safe local feedback or the global 403 route depending on whether the whole page or one action became forbidden.

---

# 26. Global Error Experience

## 26.1 Route

Reuse:

```text
/error
```

The page is standalone and does not render an authenticated role sidebar.

## 26.2 Safe variants

### 403

```text
403

Unable to open this page.
You do not have access to the requested resource.

[ Back ]
```

### 404

```text
404

Page not found.
The requested resource could not be found.

[ Back ]
```

### 500

```text
500

Something went wrong.
Please try again later.

[ Back ]
```

Never render arbitrary backend title/message text.

## 26.3 Role-aware Back

Do not blindly rely on browser history.

Suggested fixed targets:

```text
Requester      -> /tickets
IT Staff       -> /staff/tickets
Administrator  -> /admin/users
Anonymous      -> /login
```

A page-specific explicit safe Back action may use its known role list route.

## 26.4 Protected-resource safety

Do not expose:

- another Requester's ownership;
- hidden Ticket existence;
- Internal Note existence/content to Requester;
- password/security internals;
- raw stack/database errors.

---

# 27. Accessibility

## 27.1 Semantic controls

Prefer semantic HTML controls.

Custom lookup, switches, clickable list rows/cards, threaded Reply controls, and dialogs must implement equivalent keyboard and accessibility semantics rather than relying on generic clickable containers.

## 27.2 Labels

Every control has an associated accessible label.

Placeholder is never the only label.

Required state is exposed both visually and programmatically.

## 27.3 Validation

Validation messages are associated with their fields.

The first invalid field receives focus after submit validation fails.

Form-level errors use an appropriate alert/status region.

## 27.4 Route focus

Preserve the Lab 2 route-focus behavior: after normal route navigation, focus moves to the new main page content unless a modal/drawer focus-restoration path owns focus.

## 27.5 Modals

Opening a modal:

- moves focus into it;
- traps focus while open;
- provides an explicit close/cancel mechanism;
- supports Escape where appropriate.

Closing returns focus to the invoking control.

## 27.6 Icon-only controls

Every interactive icon-only control provides:

- an accessible programmatic name;
- a visible tooltip/equivalent hover/focus label.

This applies at minimum to:

- password visibility;
- mobile menu;
- modal close;
- Copy if icon-only;
- Attachment preview/download/remove;
- pagination icon controls;
- other icon-only row actions.

## 27.7 Async feedback

Use `aria-live` or status regions where appropriate for:

- Login failure/rate limit;
- auth/session-ended state;
- password change;
- queue result updates;
- owner/priority/status mutations;
- comment/reply/note posting;
- lazy-loading additional comments/replies;
- one-time password copied;
- Attachment upload lifecycle.

## 27.8 Color

The following meanings never depend on color alone:

- Role;
- Ticket Status;
- Requested Priority;
- IT Priority;
- error;
- warning;
- success;
- ownership/unassigned;
- Internal/private communication;
- removed Attachment state.

Visible text remains.

---

# 28. Responsive Rules by Screen

## 28.1 Login / Change Password

Desktop/tablet:

- centered constrained card.

Mobile:

- full available width within normal page padding;
- password guidance wraps;
- no clipped visibility/control buttons;
- primary action remains touch-friendly.

## 28.2 Requester forms/detail

Preserve Lab 2 responsive behavior.

CommonForm semantic spans collapse to full width on mobile through Bootstrap 5 mapping.

## 28.3 IT Staff Queue

Desktop:

- table.

Tablet/mobile:

- stacked Ticket cards;
- filters use modal/collapsible/drawer behavior that fits available width;
- compact pagination.

## 28.4 Staff/Admin Ticket Detail

Desktop:

- grouped cards;
- two-column metadata where useful.

Tablet/mobile:

- single-column workflow;
- buttons wrap/stack safely;
- owner lookup remains usable;
- semantic status actions do not overflow;
- comments/notes remain readable.

## 28.5 Public Comments

Mobile:

- indentation is capped so depth 2 retains useful text width;
- Reply target is still visible;
- Load More/View More controls remain touch-friendly;
- long author names do not hide role/time/action controls.

## 28.6 Internal Notes

Mobile:

- persistent Internal warning remains visible;
- tab labels remain understandable;
- textarea/composer uses full width;
- note metadata wraps safely.

## 28.7 User Management

Desktop:

- table.

Tablet/mobile:

- a responsive compact table or cards may be used if needed;
- Name, Email, Role, Status, and Edit remain discoverable;
- no page-level horizontal scroll.

Create/Edit User:

- all semantic spans collapse to full-width mobile controls.

---

# 29. Reusable UI Components

Expected reusable component categories include:

- AuthProvider and route guards;
- AppShell/sidebar/drawer;
- PageHeader;
- Card/surface;
- CommonForm;
- `useManagedForm`;
- typed field renderer;
- text/email/password/number/date field;
- Textarea;
- Select;
- Radio;
- Checkbox;
- Switch;
- ReadOnly;
- Attachment field;
- Lookup field;
- Custom escape hatch;
- common server-error mapping;
- Button/busy states;
- confirmation/modal;
- Badge;
- Skeleton;
- EmptyState;
- ErrorState;
- filter chips/modal;
- Pagination;
- Ticket Queue row/card;
- PublicComment thread item;
- InternalNote item;
- one-time password panel;
- existing specialized AttachmentSection.

Do not build a generic CRUD-page generator.

---

# 30. Visual Inspection Evidence

Required screenshot categories follow the Lab 3 handout and Lab 2 evidence discipline.

Tracked structure:

```text
docs/lab-03/evidence/screenshots/authentication/
docs/lab-03/evidence/screenshots/staff-queue/
docs/lab-03/evidence/screenshots/staff-ticket-detail/
docs/lab-03/evidence/screenshots/user-management/
```

Requester regression evidence may be captured additionally where needed.

Required viewports:

```text
1440 x 900
820 x 1180
390 x 844
```

Important states to capture include:

- Login;
- invalid Login/safe failure;
- mandatory Change Password;
- authenticated shell for each role;
- Staff Queue populated;
- Staff Queue filtered/no-results;
- Staff Ticket Detail unassigned;
- Staff Ticket Detail owned/in progress;
- Request Information;
- Mark Resolved;
- Requester resolution confirmation/reopen;
- Public Comment thread;
- Internal Notes;
- Create User;
- one-time initial password;
- Edit User;
- deactivate/reset/role confirmations;
- safe 403/404 as useful.

---

# 31. Visual Inspection Checklist

For every major screen and required viewport, verify:

- Zen Green tokens remain consistent;
- Bootstrap 5 responsive layout is used as required;
- Inter/system typography matches Lab 2;
- authenticated name and role are visible in AppShell;
- unauthorized navigation destinations are not presented;
- role badges contain visible text;
- Ticket status badges contain visible text;
- Requested Priority and IT Priority are visually distinct/labelled;
- Owner/Unassigned is explicit;
- editable and read-only fields are visually distinct;
- CommonForm labels, asterisks, counters, descriptions, and errors align;
- no clipped validation;
- no overlapping messages;
- no hidden required action;
- no unintended horizontal page overflow;
- Staff Queue remains readable and is not a mega-grid;
- mobile Queue cards retain Ticket identity/status/priority/owner;
- semantic lifecycle actions are understandable without a status dropdown;
- confirmation copy identifies important side effects;
- Public Comments and Internal Notes cannot be visually confused;
- reply depth remains readable on mobile;
- reply target `@Name` is understandable;
- Internal warning remains visible;
- Requester never sees Internal Notes;
- one-time password warning and Copy action are clear;
- plaintext password is not left in navigation/history/persistent UI after leaving success state;
- busy buttons preserve layout;
- loading skeletons resemble final regions;
- empty and no-results have different copy;
- expected conflicts provide a recovery action;
- visible focus remains clear;
- modal focus enters and returns correctly;
- icon-only actions have accessible names plus visible hover/focus labels;
- standalone global error has no authenticated sidebar;
- no stale User/role/protected content flashes during auth bootstrap.

---

# 32. Screen-State Summary

| Screen | Initial / Loading | Normal | Empty / No Results | Validation / Conflict | Failure | Success |
|---|---|---|---|---|---|---|
| Login | Neutral page / submit busy | Credential form | N/A | Field errors, generic auth error, rate limit | Safe local feedback | Route after `/auth/me` |
| Change Password | Submit busy | Restricted/full form | N/A | Password rules/current mismatch | Safe local feedback | Sign in again |
| Create Ticket | Lab 2 reference-data/loading behavior | CommonForm + specialized Attachments | N/A | Field/file/idempotency recovery | Lab 2 safe behavior | Ticket Detail |
| My Tickets | Table skeleton | Authenticated own list | True empty / no-results | Query validation safe | Lab 2 error behavior | N/A |
| Staff Queue | Table/card skeleton | Search/filter/sort/page | True empty / no-results | Query validation | Safe/global | N/A |
| Staff/Admin Ticket Detail | Skeleton | Grouped info/workflow | Comments/notes/attachments may be empty | Ownership/status conflict | Safe/global | Local updated state |
| Public Comments | Region loader | Root/reply thread | No comments | Content validation | Local retry | Appended item |
| Internal Notes | Region loader | Private flat list | No notes | Content/permission | Local/forbidden | Appended note |
| User Management | List skeleton | List/search/filter/page | No Users / no-results | Query validation | Safe/global | N/A |
| Create User | Normal page | Editable CommonForm | N/A | Field/duplicate errors | Local safe feedback | One-time password state |
| Edit User | Skeleton | Editable CommonForm + security | N/A | Duplicate/safety conflict | Safe feedback | Saved/reset state |
| Global Error | N/A | Safe 403/404/500 | N/A | N/A | Standalone | Role-aware Back |

---

# 33. Final UI Decisions

The following decisions are part of the Lab 3 UI contract:

- Reuse the Lab 2 Zen Green and Bootstrap 5 design system.
- Replace Development Requester selection/context with real AuthProvider and role guards.
- Do not render protected shell/content during auth bootstrap.
- Login and Change Password render outside the normal authenticated shell.
- Reuse standalone `/error` for role-forbidden 403 and safe 404/500.
- Requester keeps `/tickets` routes.
- IT Staff uses `/staff/tickets`.
- Administrator uses `/admin/users` and `/admin/tickets`.
- AppShell shows authenticated name, role, Change Password, and Logout.
- Administrator and IT Staff remain visibly/functionally distinct unless Administrator is explicit Ticket Owner.
- Staff Queue desktop uses six primary columns and avoids a mega-grid.
- Staff Queue tablet/mobile uses stacked cards.
- Queue default sort is operational priority and initial filtering hides Closed/Cancelled.
- Ticket status changes use semantic actions rather than an arbitrary dropdown.
- Request Information requires a Public Comment message.
- Mark Resolved, Close, Cancel, Unassign, replacing owner, Reopen, role change, deactivation, and initial-password reset require confirmation.
- Claim, Start Work, Resume Work, normal comment/note posting, and IT Priority change do not require confirmation.
- Public Comments use newest-first root pagination and Facebook-like bounded replies.
- Root page size is 10; reply preview is at most 3; more replies page by 5 oldest-first.
- Replying to a depth-2 comment keeps visual depth 2 and shows target `@Name` from metadata.
- Internal Notes use a separate tab with persistent private warning.
- Requester never sees Internal Notes.
- User Management uses a simple list plus dedicated Create/Edit routes.
- Create User success remains on the same route and shows the generated initial password once.
- Edit User contains a separate Account Security section for initial-password reset.
- Create/Edit User use dirty-navigation confirmation.
- Config-driven CommonForm uses React Hook Form + Zod with hybrid metadata/validation ownership.
- Shared form constants live under `client/src/constants/forms/`.
- Built-in fields include `attachment` and `lookup`; `custom` is reserved for very specific workflows.
- Semantic spans `full`, `half`, `third`, and `quarter` map internally to Bootstrap 5 responsive classes.
- CommonForm owns standard Submit/Cancel action rendering through props such as `showSubmitButton` and `showCancelButton`.
- Pages own whether dirty form state activates NavigationGuard.
- Existing Ticket AttachmentSection may remain a custom-rendered field because its lifecycle is feature-specific.
- Screenshot evidence uses `1440x900`, `820x1180`, and `390x844`.
