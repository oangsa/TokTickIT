# Lab 2 UI Specification

## 1. Purpose

This document defines the implementation-ready user-interface contract for the Lab 2 TokTickIT Requester Ticketing MVP.

The Lab Sheet illustrations and the approved reference screenshots are treated as visual-direction references only. They establish the intended professional internal-business-application language, Zen Green palette, form density, table hierarchy, field treatment, and interaction style. They are not pixel-perfect templates.

Lab 2 UI scope includes:

- Development Requester Selection
- Application shell and navigation
- Create Ticket
- My Tickets
- Requester Ticket Detail
- Attachment upload, preview, download, and removal states
- Loading, empty, no-results, validation, success, and failure states
- Responsive desktop, tablet, and mobile behavior
- Accessibility and visual-inspection rules

The UI must not add later-lab functionality such as authentication, IT Staff controls, IT Priority, Ticket Owner editing, Public Comments, Internal Notes, Service Actions, Event Log, Resolution Summary, or status workflow.

---

## 2. Visual Direction

The visual language is a professional internal business application:

- compact but not cramped;
- strong information hierarchy;
- white bordered surfaces on a quiet near-white page background;
- Zen Green navigation and primary actions;
- labels above controls;
- readable table density;
- subtle read-only field backgrounds;
- small rounded status and priority badges;
- clear page titles and secondary navigation actions;
- consistent form, table, modal, empty-state, and error-state treatment.

The implementation may make minor aesthetic refinements provided that the final interface remains recognizably consistent with the Lab Sheet visual language and this document.

---

## 3. Design Tokens

### 3.1. Colors

| Token / Use | Value / Rule |
|---|---|
| Primary Green | `#006B3C` |
| Secondary Green | `#0B7A46` |
| Pale Green | `#EAF6EF` |
| Page Background | `#F5F7F6` |
| Surface / Card | White |
| Main Text | Dark charcoal-green; do not use pure black as the normal text color |
| Editable Field | White background with neutral border |
| Read-only Field | Soft gray-green or warm ivory background |
| Error | Dark red text/border |
| Warning | Amber |
| Success | Green with readable text; meaning must not depend on color alone |

Primary Green is used for application emphasis and primary actions. Secondary Green is used for active/focused elements, links, and hover states. Pale Green is used for selected states, success surfaces, status badges, and subtle section emphasis.

### 3.2. Typography

Primary typeface:

```css
font-family:
  "Inter",
  system-ui,
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  sans-serif;
```

Inter should be used when available. The implementation method used to load Inter is not prescribed by this specification; the application may use a web-font link, a font package, or another appropriate React/Vite-compatible approach. The system stack is the fallback.

Typography should remain restrained and business-like:

- page titles: strong bold heading;
- section/card titles: semibold;
- field labels: medium/semibold;
- body text: regular;
- helper text, counters, and metadata: smaller secondary text;
- table headers: medium/semibold;
- buttons: medium/semibold.

Do not use decorative display fonts.

### 3.3. Radius

| Component | Radius |
|---|---:|
| Inputs / selects / textareas | `8px` |
| Buttons | `8px` |
| Cards / surfaces | `12px` |
| Modals | `12px` |
| Badges | Pill / fully rounded |

### 3.4. Spacing

Desktop:

- page padding: approximately `24px`;
- card padding: approximately `24px`;
- form/control gap: approximately `16–20px`;
- major section gap: approximately `24px`.

Tablet:

- page padding: approximately `20px`;
- card padding: approximately `20px`.

Mobile:

- page padding: approximately `16px`;
- card padding: approximately `16px`.

Bootstrap spacing utilities or equivalent values may be used. The implementation does not need to hard-code every spacing value when the resulting rhythm matches these rules.

### 3.5. Main Content Width

On desktop, page content is centered in the available main-content area with a sensible maximum width of approximately:

```css
max-width: 1280px;
```

The sidebar is outside this content-width calculation.

---

## 4. Responsive Breakpoints

The Lab 2 responsive breakpoints are:

| Viewport | Required Behavior |
|---|---|
| Desktop `>= 992px` | Multi-column layout where specified; centered content with sensible max width |
| Tablet `768–991px` | Two columns where practical; Summary and Description receive sufficient width |
| Mobile `< 768px` | Fields stack vertically; controls remain touch-friendly; no horizontal page scroll |
| All sizes | No clipped labels, overlapping messages, hidden actions, or unreadable attachment names |

No page-level horizontal scrolling is permitted.

Responsive tables must hide lower-priority columns when required rather than forcing the page itself to scroll horizontally.

---

# 5. Application Shell

## 5.1. Desktop Shell

Desktop uses a persistent left sidebar.

Approximate sidebar width:

```text
240px
```

Conceptual structure:

```text
┌──────────────────┬───────────────────────────────────────┐
│ TokTickIT        │ Main page content                     │
│                  │                                       │
│ My Tickets       │                                       │
│ Create Ticket    │                                       │
│                  │                                       │
│                  │                                       │
│──────────────────│                                       │
│ Requester Name   │                                       │
│ Change Requester │                                       │
└──────────────────┴───────────────────────────────────────┘
```

Sidebar contents after a Requester is selected:

- TokTickIT identity;
- My Tickets;
- Create Ticket;
- selected Development Requester name;
- Change Requester action.

The selected page must have a clear active-navigation indication using the Zen Green language. Pale Green may be used as the active surface with Primary/Secondary Green text or icon treatment.

## 5.2. Mobile Shell

On mobile, the sidebar is collapsed by default.

The mobile header includes:

- TokTickIT identity;
- hamburger/menu control.

Activating the menu reveals the same navigation and requester actions available in the desktop sidebar.

The mobile navigation must:

- be keyboard accessible;
- expose the active route;
- have an accessible menu-control label;
- not obscure required page actions;
- close predictably after navigation.

## 5.3. Requester Switching

The sidebar displays the selected Requester name.

`Change Requester` runs the shared requester-switch path:

1. clears the stored requester context and the shared requester provider/context state;
2. clears the shared requester-scoped cache, cancels in-flight shared requester requests, and rejects any response that arrives from the previous Requester;
3. clears the requester-scoped feature state registered with the shared switch: the Create Ticket draft, Pending Attachment preparation, and idempotency/recovery state; the My Tickets rows and query/filter/sort/page/count state and its in-flight/stale list responses; Ticket Detail state and Detail requests; and Attachment lifecycle/request state;
4. returns the user to the Development Requester Selection screen;
5. must not display stale data belonging to the previous Requester while the new context loads.

The shared layer owns steps 1-2 and the registration seam. Each requester-scoped
feature owns clearing its own state in step 3 through that seam. Whatever the
owner, Requester A data must never render under Requester B.

## 5.4. Requester Context and Route Guard

The selected Development Requester is stored in `sessionStorage` and is treated as the temporary Lab 2 requester context only. It is not real authentication.

Route behavior:

- `/requesters` is the bootstrap route and does not require an existing Requester context;
- `/tickets`, `/tickets/new`, and `/tickets/:publicId` require a selected Requester context;
- `/` redirects to `/requesters` when no Requester is selected and to `/tickets` when a Requester context exists;
- `/error` is a standalone global error route and may render without the requester application shell.

If a guarded route is opened without a stored Requester context, redirect to `/requesters` before requester-specific data is rendered.

For API calls after selection, the frontend sends the stored Requester ID as `X-Requester-Id` on every Lab 2 endpoint except `GET /api/requesters`.

If an API response is `400` **and** its centralized error envelope carries `code: "REQUESTER_CONTEXT_INVALID"`, the frontend must:

1. clear the stored Requester context;
2. run the same shared requester-switch clearing described in Section 5.3;
3. redirect to `/requesters`; and
4. never render stale data from the invalid previous context.

The `code` is the only signal that triggers this. The frontend must **not** clear
the Requester context for an ordinary application `400` such as `BAD_REQUEST` or
`VALIDATION_ERROR`; a rejected form must never end the session. HTTP status alone
is not sufficient to make this decision.

---

# 6. Development Requester Selection

## 6.1. Screen Role

This screen is a Lab 2 testing mechanism. It must clearly explain that it is not real authentication and that secure authentication will be introduced in a later lab.

Requester identities are synthetic development/test data only. The unauthenticated Lab 2 application is restricted to development/test networks and must not be described as safe for public deployment; CORS origin restrictions are browser hardening rather than authentication or privacy protection.

Before a Requester is selected, the normal requester-specific sidebar identity section is not available.

## 6.2. Layout

Use a centered bordered card inspired by the approved form references.

Desktop card width should be approximately `480–560px`.

Conceptual layout:

```text
                    TokTickIT

           ┌───────────────────────────┐
           │ Select Development        │
           │ Requester                 │
           │                           │
           │ Lab 2 testing explanation│
           │                           │
           │ Development Requester *   │
           │ [ requester dropdown ▼ ]  │
           │                           │
           │              [ Continue ] │
           └───────────────────────────┘
```

On mobile, the card uses the available width minus normal page padding.

## 6.3. Requester Control

The dropdown contains active, non-deleted Development Requesters loaded from the backend.

The selector displays the Requester name.

The Continue button:

- is disabled until a Requester is selected;
- becomes enabled after a valid selection;
- uses the Primary button style.

## 6.4. Loading State

Requester loading uses a skeleton presentation rather than only a spinner.

During loading:

- selection controls are unavailable;
- Continue is disabled;
- layout dimensions remain stable to reduce visual shift.

## 6.5. Empty State

If there are no active Development Requesters:

```text
No active Development Requesters are available.

[ Retry ]
```

The dropdown and Continue button are unavailable.

## 6.6. API Failure State

A safe API-failure state must be shown without exposing backend internals.

The screen must provide a Retry action and remain usable for a later retry.

---

# 7. Shared Form Rules

## 7.1. Labels

Labels appear above controls.

Required fields use a red asterisk:

```text
Summary *
```

The asterisk supplements, but never replaces, validation text.

## 7.2. Editable Controls

Editable inputs:

- white background;
- clear neutral border;
- consistent height;
- `8px` radius;
- visible hover and focus states.

Description is the exception to standard control height.

## 7.3. Read-only Controls

Read-only values keep a form-control appearance but use a distinct soft gray-green or warm-ivory background.

They must not appear editable.

## 7.4. Focus

Keyboard focus must remain visibly identifiable.

Focus styling uses a high-contrast border/ring consistent with Secondary Green.

## 7.5. Disabled State

Disabled controls:

- are visually muted;
- remain readable;
- cannot be activated;
- must not look identical to enabled controls.

## 7.6. Invalid State

Invalid fields use:

- dark red border;
- dark red validation message immediately below the associated field;
- a non-color indicator where practical.

Validation errors are not shown only as a generic top-page message.

---

# 8. Validation Behavior

## 8.1. Timing

Validation behavior:

- do not display all errors immediately when the untouched form first renders;
- the first submit attempt validates all relevant fields;
- after a field has been touched or has failed validation, validate it on blur/change as appropriate;
- server validation errors are mapped back to the relevant field where possible.

## 8.2. Submit With Invalid Fields

When Submit is pressed and client-known validation fails:

1. do not call the API;
2. show field-associated validation messages;
3. scroll to and focus the first invalid field.

## 8.3. Validation Copy

Messages should explain the actual rule where possible.

Example:

```text
Summary must contain 3–150 characters.
```

Avoid unhelpful messages such as only:

```text
Invalid.
```

---

# 9. Character Counters

Summary and Description counters are always visible.

Examples:

```text
42 / 150
483 / 2000
```

Counters should appear as secondary helper text and should not compete visually with validation messages.

---

# 10. Button Hierarchy

## 10.1. Primary

Primary buttons use solid Primary Green.

Examples:

- Continue
- Submit Ticket
- Create Ticket
- Apply

## 10.2. Secondary

Secondary buttons use a white/light surface with a neutral or Zen Green border.

Examples:

- Cancel
- Back
- Filters

## 10.3. Tertiary

Tertiary actions are text/link-like.

Examples:

- Clear Filters
- Reset

## 10.4. Destructive

Destructive actions use dark red styling.

Examples:

- Remove Selected
- Remove Attachment

Destructive meaning must not depend only on color; the action text must remain explicit.

## 10.5. Disabled

Disabled buttons use muted background/text and cannot be activated.

## 10.6. Busy

Busy buttons:

- preserve their original width and layout;
- remain disabled while processing;
- show a spinner/progress indicator;
- keep their original action text rather than changing to text such as `Submitting...`.

Example:

```text
[ spinner  Submit Ticket ]
```

---

# 11. Create Ticket

## 11.1. Page Header

Page header follows the approved internal-app hierarchy:

```text
Create Ticket
Describe your IT support request.
```

## 11.2. Main Layout

Create Ticket uses a large bordered form card.

Desktop/tablet structure:

```text
Create Ticket
────────────────────────────────────────

Ticket Information
┌────────────────────┬────────────────────┐
│ Ticket Number      │ Ticket Date        │
│ [ Assigned on      │ [ Assigned on      │
│   submission    ]  │   submission    ]  │
├────────────────────┴────────────────────┤
│ Requester                                │
│ [ Alice Johnson                       ] │
├────────────────────┬────────────────────┤
│ Category *         │ Related System *   │
│ [ dropdown       ] │ [ dropdown       ] │
├────────────────────┼────────────────────┤
│ Requested Priority *                    │
│ [ dropdown                           ]   │
├─────────────────────────────────────────┤
│ Summary *                               │
│ [                                   ]   │
│                             0 / 150     │
├─────────────────────────────────────────┤
│ Description *                           │
│ [                                   ]   │
│ [                                   ]   │
│ [                                   ]   │
│                            0 / 2000     │
└─────────────────────────────────────────┘

Attachments
...

                       [ Cancel ] [ Submit Ticket ]
```

Ticket Number and Ticket Date use two columns where practical. Before creation each is a disabled/read-only generated-value control with clear text such as `Assigned on submission`; no fake identifier or date is displayed.

Requester is a visible non-editable control populated from the selected Development Requester context. It is not a Ticket form input and cannot be changed without using the application-level Change Requester flow.

Category and Related System use two columns where practical.

Requested Priority may occupy a full row or an appropriately sized field beneath the classification row.

Summary and Description are full-width.

On mobile all fields stack vertically.

## 11.3. Generated and Context Fields

Before submission, Create Ticket visibly presents:

- Ticket Number as a disabled/read-only control containing `Assigned on submission` or equivalent explicit generated-value text;
- Ticket Date as a disabled/read-only control containing `Assigned on submission` or equivalent explicit generated-value text; and
- Requester as a disabled/read-only control containing the current Development Requester's name.

These controls use the approved read-only styling and semantics, remain keyboard/accessibility understandable, and are visually distinct from editable fields. They never become client-controlled request-body values:

```text
ticketNumber -> backend generated
Ticket Date  -> authoritative Ticket createdAt
Requester    -> derived from X-Requester-Id
```

Do not show fake generated values or pre-creation controls for Current Status, Public ID, or audit fields. After successful creation, preserve the approved navigation to Ticket Detail, where the real generated Ticket Number, authoritative Ticket Date, and Requester are clearly displayed with the non-intrusive success confirmation.

## 11.4. Description

Description:

- minimum visual height approximately `140px`;
- supports vertical resizing;
- must not allow resizing to break or overlap the layout.

## 11.5. Form Actions

Actions are grouped at the bottom-right:

```text
[ Cancel ] [ Submit Ticket ]
```

Cancel uses Secondary style.

Submit Ticket uses Primary style.

### Cancel / Discard Behavior

Cancel is a discard action for the current unsaved Ticket draft.

- An untouched empty form may cancel directly.
- If the draft is dirty and/or has known successfully pre-uploaded Pending Attachments, Cancel opens a confirmation dialog before leaving the page.
- If the user keeps editing, the dialog closes and the draft is unchanged.
- If discard is confirmed, the frontend performs best-effort cleanup of the Pending Attachment IDs still known to the draft using `DELETE /api/attachments/collection`, with an empty reason for each Pending item.
- A Pending card already removed from client state may remain for normal 24-hour orphan cleanup.
- Cleanup failure must not invent an Active-removal reason or soft-remove evidence that may already be bound to a Ticket. Any leftover unbound row remains eligible for orphan cleanup.
- After the confirmed discard flow, the Create Ticket draft is cleared and navigation returns to `/tickets`.

## 11.6. Submit Busy State

While submitting:

- Submit Ticket is disabled;
- a spinner appears inside the button;
- button text remains `Submit Ticket`;
- repeated submission is prevented.

Before submission, Submit Ticket is also unavailable while any intended selected file is `Uploading`, `Failed`, or `Invalid`. The user must successfully Retry it to `Pending` or explicitly Remove it from the final intended set. The request contains only the final prepared Pending `attachmentIds`.

## 11.7. Success

After successful creation:

- treat every referenced Pending Attachment returned by the Ticket transaction as Active;
- navigate to `/tickets/:publicId`;
- clearly show the generated Ticket Number on Ticket Detail;
- display a non-intrusive success confirmation.

---

# 12. Create Ticket Failure Behavior

## 12.1. Client / 4xx Validation Failure

Remain on Create Ticket.

Retain:

- form values;
- valid Pending Attachment state;
- field validation messages.

Focus the first relevant invalid field.

## 12.2. Unexpected 5xx Failure

Preserve non-file Ticket fields. Apply the API contract's best-effort Pending cleanup/recovery behavior to the IDs associated with the attempt. If cleanup confirms Pending rows were deleted, keep the file entries visible in `Failed`/`Retry Upload` state.

If completion remains ambiguous, retry the unchanged Ticket-create request with the same Idempotency Key. A completed `200` replay recovers the same Ticket and its Active Attachments without re-upload. Cleanup semantics must never invent removal reasons or soft-remove rows that may already be Active evidence.

While completion is ambiguous, persist a requester-scoped recovery record in `sessionStorage` containing the original Idempotency Key/client creation time and normalized original Ticket-create payload, including original normalized `attachmentIds`. After reload, offer an explicit Resume Submission Recovery action; never submit automatically on load. Clear the record on confirmed success, confirmed non-ambiguous failure, discard, Requester change, or expiry.

Automatic recovery uses a conservative deadline from initial client key creation and never reuses the key at or after 24 hours. A later attempt requires explicit user submission with a new key. A successful replay resolves the original Ticket identity but renders the freshly reconstructed current `TicketDTO`, so later Attachment additions/removals may appear.

---

# 13. My Tickets

## 13.1. Overall Layout

The approved list screenshots are visual references for hierarchy only.

Use:

- page title at upper-left;
- Create Ticket at upper-right on desktop;
- one main bordered card containing toolbar, table, result metadata, and pagination.

Conceptual desktop layout:

```text
My Tickets                                  [ + Create Ticket ]
View and manage your support requests.

┌───────────────────────────────────────────────────────────────┐
│ [ Search........................ ] [ Filters ] [ Sort by ▼ ]   │
│                                                               │
│ applied filter chips / Clear Filters                          │
│                                                               │
│ Ticket table                                                  │
│                                                               │
│ result count / page size / pagination                         │
└───────────────────────────────────────────────────────────────┘
```

On mobile, Create Ticket moves below the title and remains easy to tap.

## 13.2. Search

Placeholder:

```text
Search by ticket number, summary, or description...
```

Search requests are debounced by:

```text
SEARCH_DEBOUNCE_MS = 400
```

The search control provides lightweight guidance through the accessible
placeholder or equivalent helper text: `Search ticket number, summary, or
description`.

## 13.3. Search / Filter Logic in the UI

Search and committed filters represent the active query.

Any committed query change resets the page to page 1.

The frontend maps friendly filter controls to the API query contract without exposing the generic filter DSL. It exposes only the valid Ticket choices defined for the UI: Ticket Number/Summary/Description search and Category, Related System, Requested Priority, and Current Status filters. These controls are UX restrictions only, not an API validation or security boundary. The backend Ticket validator must still enforce the Ticket field/condition matrix and return `400` for disallowed direct API combinations before data-access execution; the shared QueryBuilder receives only validated/typed inputs.

My Tickets consumes `TicketListItemDTO[]`, not full `TicketDTO[]`. The list projection contains all fields required by the existing table and deliberately excludes Description, Requester fields, Attachments, and audit/lifecycle-only fields. Description remains searchable even though it is not returned in each list item.

A Ticket may match solely because its Description contains the search term,
even though Description is intentionally omitted from `TicketListItemDTO`.

The browser API client reads pagination from `X-Pagination` and request correlation from `X-Request-Id`. The server CORS response must expose both headers, and browser-visible integration/E2E behavior must verify they are readable rather than relying on framework defaults.

---

# 14. Filters

## 14.1. Filter Button

Toolbar includes:

```text
[ Filters (N) ]
```

where `N` is the number of currently applied filter selections.

## 14.2. Filter Modal

Use a single-column modal:

```text
┌──────────────────────────────────────┐
│ Filters                          ×   │
├──────────────────────────────────────┤
│ Category                             │
│ [ multi-select                    ]  │
│                                      │
│ Related System                       │
│ [ multi-select                    ]  │
│                                      │
│ Requested Priority                   │
│ [ multi-select                    ]  │
│                                      │
│ Status                               │
│ [ multi-select                    ]  │
├──────────────────────────────────────┤
│ Reset                  Cancel Apply  │
└──────────────────────────────────────┘
```

All four filters support multiple selections.

## 14.3. Draft State

Opening the modal creates a draft copy of the active filters.

- Cancel discards draft changes.
- Reset clears the draft values only.
- Reset does not fetch immediately.
- Apply commits the draft, resets to page 1, and fetches.
- Closing without Apply must not silently change the active query.

## 14.4. Applied Chips

Applied filters are represented by removable chips beneath the toolbar.

Example:

```text
[ Network × ] [ VPN × ] [ HIGH × ]     Clear Filters
```

Removing a chip:

- immediately removes that committed filter selection;
- resets to page 1;
- fetches the updated result.

## 14.5. Clear Filters

Clear Filters is available whenever search text or filters are active, regardless of whether the current query has results.

Clear Filters:

- clears search;
- clears committed filters;
- resets to page 1;
- preserves the current sort.

---

# 15. Sorting

Use a labeled dropdown:

```text
Sort by
[ Newest ▼ ]
```

Required options:

- Newest
- Oldest
- Ticket Number A–Z
- Ticket Number Z–A
- Summary A–Z
- Summary Z–A
- Priority High to Low
- Priority Low to High

Priority ordering is semantic:

```text
High to Low: HIGH → MEDIUM → LOW
Low to High: LOW → MEDIUM → HIGH
```

---

# 16. Ticket Table

## 16.1. Desktop Columns

Desktop uses a table with:

1. Ticket Number
2. Summary
3. Category
4. Related System
5. Priority
6. Status
7. Created At

The entire row opens Ticket Detail.

A chevron or equivalent visual affordance may be placed at the end of the row.

## 16.2. Row Interaction

Rows are:

- mouse clickable;
- keyboard accessible;
- visually focusable;
- activatable with Enter/Space where the chosen implementation pattern supports it.

Do not make keyboard users discover an invisible interaction.

## 16.3. Small-Screen Responsive Table

The smaller-screen representation remains a responsive table rather than switching to cards.

At `<768px`, keep:

- Ticket Number
- Summary
- Priority
- Status

Hide:

- Category
- Related System
- Created At

The page itself must not scroll horizontally.

Text may wrap or truncate safely with an accessible full-value mechanism where required.

---

# 17. Priority and Status Badges

## 17.1. Priority

Priority badges remain within the Zen Green visual language.

Suggested visual hierarchy:

- LOW: light/pale green;
- MEDIUM: medium Zen Green emphasis;
- HIGH: strongest/darkest Zen Green emphasis.

Every badge also includes the text label:

```text
LOW
MEDIUM
HIGH
```

Priority meaning must never depend on color alone.

## 17.2. Status

Lab 2 status:

```text
NEW
```

uses Pale Green background with dark green text.

The visible text `NEW` is always present.

---

# 18. My Tickets Pagination

## 18.1. Desktop

Desktop pagination includes:

```text
Showing 1–10 of 47

Rows per page [10 ▼]

‹ Previous   1  2  3  4  5   Next ›
```

Page-size presets:

- 10
- 20
- 30
- 50
- 100

## 18.2. Mobile

Use compact controls:

```text
Page 1 of 5
[ Previous ] [ Next ]

Rows per page [10 ▼]
```

Do not render a wide sequence of page-number buttons if it reduces usability.

---

# 19. My Tickets States

## 19.1. Loading

Desktop:

- table skeleton rows.

Small screens:

- responsive table-row skeletons.

The surrounding page structure remains visible.

Controls that cannot safely operate during the fetch are disabled.

## 19.2. Empty Dataset

When the Requester has no tickets at all:

```text
No tickets yet.
Create your first support ticket.

[ Create Ticket ]
```

## 19.3. No Results

When search/filter produces zero results:

```text
No tickets found.
Try changing your search or filters.

[ Clear Filters ]
```

Clear Filters is also available when an active search/filter has results.

## 19.4. Failure

Ticket-list API failure navigates to the global error experience.

The Back action from the global error page returns to:

```text
/tickets
```

---

# 20. Ticket Detail

## 20.1. Page Header

Header uses the selected layout:

```text
TKT-20260820-A81F3C9D7B21          [ Back to My Tickets ]
Ticket Detail
```

The Ticket Number is the strongest ticket-specific identifier.

## 20.2. Ticket Information Card

Ticket Detail uses a read-only form-style card.

Desktop/tablet use two columns where useful.

Summary and Description use full width.

Mobile stacks all fields.

Required visible information includes:

- Ticket Number
- Ticket Date displayed from `createdAt`
- Current Status
- Requested Priority
- Requester Name
- Requester Email
- Category
- Related System
- Summary
- Description

Conceptual layout:

```text
┌─────────────────────────────────────────────┐
│ Ticket Number      Ticket Date              │
│ Status             Requested Priority       │
│ Requester Name     Requester Email          │
│ Category           Related System           │
│                                             │
│ Summary                                     │
│                                             │
│ Description                                 │
└─────────────────────────────────────────────┘
```

Do not add later-lab fields.

## 20.3. Read-only Presentation

Every detail value retains a form-control visual shape with:

- distinct read-only background;
- readable text;
- no editable cursor/affordance;
- no enabled select behavior.

---

# 21. Attachment Section

## 21.1. Separation

Attachments are rendered in a separate card/section from Ticket Information.

Conceptual layout:

```text
Attachments  3/5                         [ Add Attachment ]
┌──────────────────────────────────────────────────────────────┐
│ attachment table                                             │
└──────────────────────────────────────────────────────────────┘
```

The count is:

```text
active attachments / 5
```

Removed attachments do not count toward the active limit.

At `5/5`, Add Attachment is disabled.

Do not add a separate explanatory paragraph such as “Maximum of 5 active attachments reached.”

## 21.2. Desktop Attachment Table

Desktop uses a table.

Recommended columns:

- selection checkbox
- File Name
- Type
- Size
- Uploaded At
- Status
- Actions

## 21.3. Smaller-Screen Attachment Table

Smaller screens retain a responsive table.

Lower-priority metadata may be hidden to preserve readability.

Filename, status, selection, and required actions must remain usable.

No page-level horizontal scrolling is allowed.

---

# 22. Adding Attachments

## 22.1. Create Ticket

Create Ticket uses a normal native file-picker action.

Multi-file selection may be used. The client validates selections locally, then pre-uploads each valid file individually through `POST /api/attachments`. Successful files become Pending and contribute their normalized IDs to the final Ticket-create payload. A failed/unready intended file must be retried successfully or explicitly removed before Submit Ticket is enabled; the UI must never silently create the Ticket as though it uploaded successfully.

## 22.2. Existing Ticket

Ticket Detail uses:

```text
[ Add Attachment ]
```

which opens the native file picker.

This post-create interaction uses `POST /api/tickets/:publicId/attachments` and directly adds one Active Attachment to the already-created Ticket. It is distinct from Create Ticket's standalone Pending pre-upload flow.

## 22.3. File Rules Presented to Users

The UI should clearly reflect supported Lab 2 rules:

- JPG / JPEG
- PNG
- WEBP
- PDF
- maximum 5 MB per file
- exact technical limit `5,000,000` bytes (`MAX_ATTACHMENT_BYTES`, decimal 5 MB)
- maximum 5 active attachments per ticket
- filename basename 1-255 UTF-8 bytes including extension, with no control characters

The UI must not imply support for other types.

---

# 23. Per-File Attachment States

Each file has its own UI state. The UI must distinguish persisted Attachment lifecycle from temporary client upload state.

## 23.0. Pending vs Active Lifecycle

The lifecycle terms are:

| UI / persisted state | Meaning | Where it appears | Binary actions | Removal behavior | Counts toward 5 active? |
|---|---|---|---|---|---:|
| Uploading | Client upload request is still in flight; no usable persisted Attachment ID yet | Create Ticket or Add Attachment interaction | No | Client may cancel/remove the local entry where supported | No |
| Invalid / Failed | Client-local selection/upload failure; not a usable persisted Attachment | Create Ticket or Add Attachment interaction | No | Remove local entry / retry upload | No |
| Pending | Pre-upload succeeded and returned an `attachmentId`, but `ticketId = null` | Create Ticket draft | Preview and Download allowed for owner | Remove from final draft; known IDs are cleanup candidates and forgotten rows expire | Not yet, but no more than five may be prepared for initial create |
| Active | Bound to a Ticket (`ticketId != null`, `deleted = false`) | Ticket Detail | Preview and Download allowed | Selectable for batch soft removal with required reason | Yes |
| Removed | Bound and soft-removed (`ticketId != null`, `deleted = true`) | Ticket Detail | No | Cannot be selected or removed again | No |

A successfully pre-uploaded Create Ticket file is labeled `Pending`, never `Active`, until the Ticket-create transaction binds it. A client-forgotten Pending row is an orphan eligible for 24-hour cleanup.

## 23.1. Uploading

Example:

```text
vpn-error.png
Uploading... [spinner]
```

Preview and Download controls are unavailable until the upload completes. A local cancel/remove affordance may be used only to remove the in-progress client entry; it is not the same operation as soft-removing an Active Attachment.

## 23.2. Failed

Example:

```text
vpn-error.png
Upload failed.

[ Retry ] [ Remove ]
```

## 23.3. Invalid

Example:

```text
malware.exe
Unsupported file type.

[ Remove ]
```

An invalid file does not invalidate other valid files selected at the same time.

## 23.4. Pending

After a successful Create Ticket pre-upload, the file is backed by the returned `attachmentId` and shown as `Pending`.

Pending files:

- may be previewed/downloaded by the current Requester;
- remain in the final Ticket-create `attachmentIds` while selected;
- are not Ticket evidence because `ticketId` remains null;
- become Active only after atomic Ticket creation/binding; and
- may be explicitly removed from the final intended set; still-known IDs are handled by cleanup flows and forgotten rows remain eligible for 24-hour orphan cleanup.

## 23.5. Active

Active files support the permitted actions:

- Preview
- Download
- selection for removal

## 23.6. Removed

Removed files remain visible with metadata and a `Removed` status.

Preview, Download, and removal selection are unavailable.

---

# 24. Attachment Preview

Preview opens in an in-app modal.

Preview and Download never navigate directly to the requester-scoped binary URL because direct image/iframe/navigation requests cannot attach `X-Requester-Id`. The API client fetches the binary with the current requester header, verifies `response.ok` before reading the body, creates a temporary Blob object URL, and revokes the URL when the modal closes, content is replaced, or the component unmounts.

Conceptual layout:

```text
┌──────────────────────────────────────┐
│ vpn-error.png                    ×   │
│                                      │
│         image/PDF preview            │
│                                      │
│                     [ Download ]     │
└──────────────────────────────────────┘
```

Images:

- fit responsively within the modal;
- preserve aspect ratio.

PDFs:

- use the browser-supported inline preview where available.

Download uses the already-known `AttachmentDTO.originalName` as the browser download filename rather than parsing `Content-Disposition`. Its temporary Blob URL is revoked after the download is initiated. Extension-only validation, `nosniff`, and Blob rendering are Lab 2 hardening only; stronger content inspection/isolation remains required before production use.

The modal must:

- trap focus while open;
- close with an explicit close action;
- support Escape where appropriate;
- return focus to the invoking control after close.

---

# 25. Batch Attachment Removal

## 25.1. Selection

Attachment rows have checkboxes.

Only active attachments may be selected.

Uploading, failed, invalid, and removed files are not selectable for active-ticket removal.

When one or more active attachments are selected:

```text
2 selected                     [ Remove Selected ]
```

## 25.2. Removal Modal

Each selected attachment receives its own required reason.

Example:

```text
Remove 2 Attachments

screenshot.png
Reason *
[ Wrong screenshot                         ]

report.pdf
Reason *
[ Duplicate document                       ]

                     [ Cancel ] [ Remove ]
```

Each reason:

- is required for an active attached resource;
- is trimmed;
- must contain 3–200 characters.

The final Remove action uses Destructive styling.

## 25.3. Transactional Failure

Because removal is an all-or-nothing backend collection operation, the UI must not mark only some selected rows as removed if the API call fails.

On failure:

- preserve the previous active state;
- present safe failure feedback;
- allow the user to correct/retry as appropriate.

---

# 26. Removed Attachment Row

Removed rows remain in the table but use muted presentation.

Example:

```text
old-file.pdf | PDF | 400 KB | Removed | —
```

Removal reason is shown as expanded/secondary metadata rather than as a permanently wide table column.

Example:

```text
Removal reason: Duplicate document
```

Removed rows:

- are not selectable;
- do not expose Preview;
- do not expose Download;
- do not expose Remove.

---

# 27. Global Error Experience

## 27.1. Route

Use one route:

```text
/error
```

Error information is carried in navigation state rather than sensitive URL query parameters.

Possible state fields:

```text
status
title
message
backPath
```

If navigation state is missing or invalid, including after reload or direct navigation, render the safe generic `500` variant. Never render arbitrary backend-provided title/message text.

## 27.2. Shell

The global error page is standalone.

Do not render the application sidebar.

TokTickIT branding may remain minimal, but requester navigation is not shown.

## 27.3. Error Variants

Use the same global layout with safe status-specific copy.

Requester-owned Ticket/Attachment routes use the safe `404` variant when a resource is missing or outside the current Requester's scope. The API and UI must not reveal that another Requester owns the resource. The generic `403` variant remains available for future or non-ownership authorization failures.

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

Do not expose ticket ownership, internal IDs, stack traces, SQL details, or raw backend error content.

## 27.4. Back Behavior

For requester workflow errors:

```text
Back → /tickets
```

When no valid Requester context exists, fallback Back behavior targets `/requesters` instead. Do not rely on browser history in either case.

Do not rely on browser history for this action because history may return to the same failing route.

---

# 28. Loading Rules

Loading states must not display requester data from a previous requester context.

Use skeleton loading for data-heavy screens:

- Requester selector;
- My Tickets table;
- Ticket Detail information card where data is not yet available;
- Attachment table where data is not yet available.

Skeletons should resemble the final layout without creating distracting animation.

---

# 29. Accessibility

## 29.1. Semantics

Use semantic HTML controls where possible.

Do not emulate buttons with non-interactive elements unless all semantics and keyboard behavior are correctly provided.

## 29.2. Labels

Every form control has an associated accessible label.

Placeholder text is not a substitute for a label.

## 29.3. Required Fields

Required state must be exposed programmatically in addition to the visible red asterisk.

## 29.4. Validation

Validation messages must be associated with their fields.

## 29.5. Keyboard

All primary workflows must be operable by keyboard, including:

- sidebar/mobile menu;
- Requester selection;
- Create Ticket form;
- search;
- filters;
- sort;
- table-row navigation;
- pagination;
- attachment selection;
- preview modal;
- removal modal;
- global Back action.

## 29.6. Focus

Visible focus is mandatory.

Opening a modal moves focus into it.

Closing a modal returns focus to the invoking control.

## 29.7. Async Feedback

Use an appropriate `aria-live` or status region for meaningful asynchronous state such as:

- upload completion/failure;
- ticket creation success;
- retry/failure messages;
- filter/search result updates where useful.

## 29.8. Icons

Icons may support visible text.

An icon must not replace unclear action text.

Every interactive icon-only control MUST provide both:

- an accessible programmatic name such as `aria-label` or an equivalent semantic label; and
- a visible tooltip or equivalent hover/focus text label communicating the action to sighted users.

The tooltip/equivalent label must be available on hover and keyboard focus where supported by the chosen implementation. This applies to navigation/menu controls, Attachment preview/download/remove controls, close/dismiss buttons, pagination icon buttons, filter/search auxiliary icons, mobile sidebar toggles, modal controls, and any other button whose visible content is only an icon. An icon shape, color, `title` alone, or `aria-label` alone is not sufficient.

## 29.9. Color

Do not communicate Priority, Status, error, warning, success, or removed state by color alone.

Text labels are always present.

---

# 30. Responsive Rules by Screen

## 30.1. Requester Selection

Desktop/tablet:

- centered card;
- constrained width.

Mobile:

- full available width within page padding;
- no side-by-side form controls.

## 30.2. Create Ticket

Desktop:

- Ticket Number and Ticket Date may share a generated/read-only row;
- Requester remains visibly non-editable;
- Category and Related System may be two columns;
- Summary and Description full width.

Tablet:

- generated/context fields remain visible and clearly read-only;
- two columns where practical;
- Summary/Description remain sufficiently wide.

Mobile:

- all fields stack;
- generated Ticket Number/Date and Requester remain visible before editable fields;
- action buttons remain touch-friendly;
- no clipped counter or validation text.

## 30.3. My Tickets

Desktop:

- full table columns;
- full pagination.

Tablet:

- hide lower-priority columns if required before content becomes cramped.

Mobile:

- retain responsive table;
- show Ticket Number, Summary, Priority, Status;
- compact pagination.

## 30.4. Ticket Detail

Desktop/tablet:

- read-only two-column field layout where useful.

Mobile:

- stack all read-only fields.

## 30.5. Attachments

Desktop:

- full attachment table.

Tablet/mobile:

- responsive table;
- hide lower-priority metadata when necessary;
- filename and primary actions remain readable and operable.

---

# 31. Reusable UI Components

The implementation should use reusable components for repeated presentation behavior without building a generic CRUD engine.

Expected reusable component categories include:

- application shell/sidebar;
- page header;
- card/surface;
- form field wrapper;
- text input;
- select;
- textarea;
- read-only field;
- validation message;
- character counter;
- primary/secondary/tertiary/destructive button;
- busy button;
- badge;
- skeleton;
- empty state;
- error state;
- modal;
- filter chip;
- pagination;
- attachment table/row state.

Business forms explicitly compose the fields required by Lab 2.

---

# 32. Empty State Component

Use one reusable `EmptyState` component with content supplied by props.

## 32.1. True Empty Dataset

```text
No tickets yet.
Create your first support ticket.

[ Create Ticket ]
```

## 32.2. Search / Filter No Results

```text
No tickets found.
Try changing your search or filters.

[ Clear Filters ]
```

The component is shared; the meaning and actions are not.

---

# 33. Visual Inspection Evidence

Automated UI contract assertions complement, rather than replace, screenshots and manual inspection. Vitest/React Testing Library tests assert only meaningful contract states/classes: generated/context read-only controls, editable/read-only distinction, required/invalid/error semantics, primary/secondary and disabled/busy button states, read-only Ticket Detail fields, textual priority/status badge state, and Pending/Active/Removed/Invalid/Failed Attachment presentation. Tests must not lock the implementation to every incidental Bootstrap or custom class.

Required screenshot viewports:

```text
Desktop  1440 × 900
Tablet   820 × 1180
Mobile   390 × 844
```

Required screenshot directories:

```text
artifacts/lab-02/screenshots/create-ticket/
artifacts/lab-02/screenshots/my-tickets/
artifacts/lab-02/screenshots/ticket-detail/
```

Important additional states may also be captured where useful, including:

- filter modal;
- validation state;
- removed attachment;
- attachment preview;
- global error page.

---

# 34. Visual Inspection Checklist

For each required screen and viewport, verify:

- Zen Green tokens are applied consistently;
- Inter or approved fallback stack is used;
- page hierarchy matches the professional internal-app direction;
- sidebar/navigation is aligned and active state is obvious;
- no clipped labels;
- no overlapping validation messages;
- no hidden required buttons;
- no unintended page-level horizontal scrolling;
- editable and read-only fields are visually distinct;
- required asterisks are visible;
- focus states remain visible;
- busy buttons preserve layout;
- Summary/Description have sufficient width;
- Ticket table remains readable;
- mobile/small-screen table exposes the specified key columns;
- priority/status badges include text;
- empty and no-results states are visually distinct by content;
- attachment filenames remain readable;
- Uploading, Failed, Invalid, Pending, Active, and Removed states are visually distinct;
- removed attachment actions are unavailable;
- batch-selection state remains understandable;
- modal controls are reachable by keyboard;
- global error page has no application sidebar;
- Back from requester workflow errors returns to `/tickets`.

---

# 35. Screen-State Summary

| Screen | Initial / Loading | Normal | Empty / No Results | Validation | Failure | Success |
|---|---|---|---|---|---|---|
| Requester Selection | Skeleton | Requester dropdown | No active requesters | Selection required | Safe retry state | Continue to requester app |
| Create Ticket | Reference-data/loading state as required | Editable form + Pending pre-upload Attachments | N/A | Field/file errors; unresolved intended files block submit | 4xx retains fields/Pending; 5xx compensation + same-key recovery | Atomic Ticket/binding, then Detail with all referenced files Active |
| My Tickets | Table skeleton | Search/filter/sort/table/pagination | True empty or no-results | Invalid query handled safely | Global error page | N/A |
| Ticket Detail | Read-only skeleton | Read-only info + attachments | Attachment section may have zero active files | Attachment removal reason validation | Global error for page load; local attachment operation feedback | Attachment add/remove updates state |
| Global Error | N/A | Status-specific safe message | N/A | N/A | Standalone error screen | Back to `/tickets` |

---

# 36. Final UI Decisions

The following decisions are part of the Lab 2 UI contract:

- Inter with system fallbacks.
- `8px` controls/buttons, `12px` cards/modals, pill badges.
- Main content approximately `1280px` max width on desktop.
- Desktop left sidebar, approximately `240px`.
- Mobile hamburger/collapsible sidebar navigation.
- Pale Green active navigation treatment.
- Centered Requester Selection card.
- Requester Selection uses skeleton loading.
- Requester-specific routes are guarded by the `sessionStorage` requester context; a `400` carrying `REQUESTER_CONTEXT_INVALID` clears the context before redirecting to `/requesters`, and no other `400` does.
- Create Ticket may cancel an untouched empty form directly; dirty/Pending drafts require confirmation and best-effort cleanup of still-known Pending IDs.
- Create Ticket pre-uploads valid selected files through `POST /api/attachments`, blocks submission while an intended file is unresolved, and submits the final Pending `attachmentIds` for atomic Ticket creation/binding.
- Existing Ticket additions continue to use `POST /api/tickets/:publicId/attachments` and become Active directly.
- Create Ticket displays non-editable Ticket Number and Ticket Date controls with explicit `Assigned on submission` text and a non-editable selected Requester control; it never invents generated values or sends these controls as client-managed fields.
- Summary and Description always show counters.
- Description supports vertical resize.
- My Tickets uses a desktop/responsive table rather than mobile cards.
- Small-screen Ticket table keeps Ticket Number, Summary, Priority, Status.
- Search debounce is `400ms`.
- Filters use an Apply modal with draft state.
- Category, Related System, Priority, and Status are multi-select filters.
- Applied filters use count + removable chips.
- Clear Filters remains available when a search/filter is active whether results exist or not.
- Priority badges stay within the Zen Green visual language.
- Ticket Detail uses read-only form-style fields.
- Requester Name and Requester Email are visible in Ticket Detail.
- Ticket Information and Attachments are separate cards.
- Attachment presentation remains a responsive table.
- Attachment preview uses an in-app image/PDF modal.
- Batch attachment removal uses row checkboxes and one reason per selected active attachment.
- Removed attachment metadata remains visible.
- Attachment limit is displayed as `x/5`; no extra maximum-limit paragraph is shown.
- Global 403/404/500 errors share one standalone `/error` experience.
- Lab 2 requester-owned resource scope failures use the same safe 404 experience as unavailable resources; generic 403 rendering remains reusable for future/non-ownership failures.
- The global error page does not render the sidebar.
- Requester-workflow Back action from global errors returns to `/tickets`.
- Busy buttons keep the original action text and add a spinner.
- Screenshot evidence uses `1440×900`, `820×1180`, and `390×844`.
