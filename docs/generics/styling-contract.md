# TokTickIT Global Styling Contract

## Authority and scope

This is the project-wide contract for TokTickIT visual design and shared-component composition. It applies to current and future screens independently of any lab. It defines tokens, layout, form presentation, table styling, feedback, responsiveness, and accessibility.

Feature specifications and API contracts separately define fields, permissions, workflow, validation limits, and behavior. Consult them when implementing a feature; do not copy another screen's domain rules merely to match its appearance. Existing pages are component-usage examples, not universal feature requirements.

Use React + TypeScript + Vite, Bootstrap, and the existing shared components. This contract does not authorize new dependencies or a bulk rewrite. Keep UI specifications unchanged unless explicitly asked to edit them; record shared styling guidance here.

## Visual foundations

[theme.css](../../client/src/styles/theme.css) owns `--tt-*` tokens and Bootstrap aliases. [components.css](../../client/src/styles/components.css) owns shared component treatments. Preserve import order in [main.tsx](../../client/src/main.tsx): Bootstrap, theme, then components. Bootstrap is precompiled: not every `--bs-*` variable affects every component; inspect the actual selector before adding overrides.

| Purpose | Existing token/value |
|---|---|
| Primary action | `--tt-green-primary`: `#006b3c` |
| Links, focus, secondary emphasis | `--tt-green-secondary`: `#0b7a46` |
| Active/hover pale surface | `--tt-green-pale`: `#eaf6ef` |
| Page / card | `--tt-page-bg`: `#f5f7f6`; `--tt-surface`: white |
| Text / secondary text | `--tt-text`: `#16241d`; `--tt-text-muted`: `#5b6b63` |
| Borders / read-only background | `--tt-border`: `#d7e0da`; `--tt-readonly-bg`: `#e6ece8` |
| Error / warning | `--tt-danger`: `#a3232b`; `--tt-warning`: `#8a5200` |
| Controls / surfaces | `--tt-radius-control`: 8px; `--tt-radius-surface`: 12px |
| Shell | `--tt-sidebar-width`: 240px; `--tt-content-max`: 1280px |

Use locally loaded Inter with the existing system fallback stack. Page headings are prominent; card headings are semibold; field labels sit above controls; helper text, counters, and metadata are secondary. Badges are pills with visible text. Avoid decorative display fonts, improvised colors, nested ornamental cards, and page-specific copies of shared styling.

Use Bootstrap spacing/grid utilities first. Desktop page/card padding is about 24px, tablet 20px, mobile 16px; section gaps about 24px and control spacing about 16–20px. Reuse token values for required custom CSS. Maintain visible focus and reduced-motion support; do not hide overflow as a substitute for a usable layout.

## Shell, page headers, and sections

Use [AppShell](../../client/src/components/AppShell.tsx) and [SidebarNav](../../client/src/components/SidebarNav.tsx) for authenticated navigation. Pages rendered inside the shell do not add another sidebar or main landmark. Login and the global error page use their specified standalone layouts. Preserve route focus and drawer focus restoration.

Use [PageHeader](../../client/src/components/PageHeader.tsx) with `title`, optional `subtitle`/`eyebrow`, and `actions`. It owns title sizing and responsive action placement. Use a real Link for navigation and a Button for mutation. Entity identifiers may use `titleClassName` for wrapping. Do not repeat a page title as an unnecessary card title.

Ticket Queue and User Management use title-only list headings, with available actions on the right and search/filter controls below. Neither supplies an eyebrow or subtitle. Actions wrap below at narrow widths. This applies to both Administrator and IT Staff uses of StaffTicketQueue; it does not remove subtitles from other page families.

Use [Card](../../client/src/components/Card.tsx) with `title`, optional `actions`, and `children`. A titled Card already supplies a section heading. Its actions render with that heading. Choose one owner for each card and heading: either a CommonForm section creates it or the page wraps the form in Card. Do not render both.

Current User pages place User Information in a full-width card. Edit User places Account Security below it, not in a sidebar. Staff Ticket Detail stacks Ticket Information, Assignment & Workflow, Attachments, and Communication. Fields within those sections can use responsive columns. Keep password controls reasonably constrained inside the full-width section; do not turn that one form's width into a global field width.

## Shared component selection

Paths below point to current implementations; inspect their TypeScript props before use.

| Need | Component / module | Usage responsibility |
|---|---|---|
| Entity create/edit/view | [CommonForm](../../client/src/components/CommonForm.tsx), [useManagedForm](../../client/src/forms/useManagedForm.ts) | Typed sections, modes, field rendering, normal action row, validation mapping |
| Existing user fields | [UserForm](../../client/src/components/UserForm.tsx) | Reuse shared user config; preserve self-edit restrictions |
| Ticket information display | [TicketInformationForm](../../client/src/components/TicketInformationForm.tsx) | Format supplied values into a view-mode form; optional requester/audit fields |
| Small hand-composed control flows | [Form](../../client/src/components/Form.tsx), [FormField](../../client/src/components/FormField.tsx), [TextInput](../../client/src/components/TextInput.tsx), [Textarea](../../client/src/components/Textarea.tsx), [Select](../../client/src/components/Select.tsx) | Keep established specialized flows; these primitives do not supply managed validation or an API workflow |
| Focusable read-only value | [ReadOnlyField](../../client/src/components/ReadOnlyField.tsx) | `label`, `value`, optional `multiline`; preserves read-only control appearance |
| Actions | [Button](../../client/src/components/Button.tsx), [IconButton](../../client/src/components/IconButton.tsx) | Semantic variants, busy presentation, accessible icon labels |
| Lists | [DataTable](../../client/src/components/DataTable.tsx) | Columns, list header, toolbar, states, row actions, pagination |
| Filters / pagination | [FilterChip](../../client/src/components/FilterChip.tsx), [MultiSelect](../../client/src/components/MultiSelect.tsx), [Pagination](../../client/src/components/Pagination.tsx) | Reuse controls; page owns query semantics and filter commit behavior |
| Dialogs | [Modal](../../client/src/components/Modal.tsx) | `open`, `title`, `onClose`, `footer`; shared focus and dismissal mechanics |
| Labels / progress / feedback | [Badge](../../client/src/components/Badge.tsx), [Skeleton](../../client/src/components/Skeleton.tsx), [ValidationMessage](../../client/src/components/ValidationMessage.tsx), [SuccessMessage](../../client/src/components/SuccessMessage.tsx) | Visible state text and accessible feedback |
| Empty / failed region | [EmptyState](../../client/src/components/EmptyState.tsx), [ErrorState](../../client/src/components/ErrorState.tsx) | Explicit title/description and relevant action/retry |
| Upload lifecycle | [AttachmentSection](../../client/src/attachments/AttachmentSection.tsx), [AttachmentState](../../client/src/components/AttachmentState.tsx) | Pending/Active lifecycle, per-file feedback, preview, removal |
| Communication | [PublicComments](../../client/src/components/PublicComments.tsx), [InternalNotes](../../client/src/components/InternalNotes.tsx) | Keep audience, permissions, ordering, and pagination in specialized components |

## Form construction contract

For implementation, use the project [form-engineering skill](../../.agents/skills/form-engineering/SKILL.md), invoked as `$form-engineering`. It turns this contract into a workflow using the current component APIs.

### Ownership and reuse

New entity forms use typed values and `FormSection<TValues>[]` from [formTypes.ts](../../client/src/forms/formTypes.ts), `useManagedForm`, and CommonForm. Keep field labels, options, section metadata, and reusable limits in [constants/forms](../../client/src/constants/forms). Reuse the same entity configuration for create, edit, and view; adapt copies for mode-specific restrictions rather than mutating shared constants.

The page owns loading, API payload mapping, permissions, success navigation, dirty-navigation protection, and specialized workflows. The form component owns presentation. Zod owns client validation; config such as `required` or `maxLength` is not a substitute for schema rules or backend validation. Do not introduce a generic CRUD generator.

### Modes and field types

- `mode="create"`: supply explicit default values and a validated managed form. Set a domain action label such as Create User; CommonForm's generic default is Submit.
- `mode="edit"`: populate from the API and preserve user edits during refreshes. Default action label is Save Changes. Selectively disable immutable or permission-restricted controls.
- `mode="view"`: reuse normal field types with values. CommonForm disables built-in controls, suppresses required markers, validation feedback and counters, defaults both action buttons off, and blocks submission. Do not explicitly enable submit controls in view mode. Back/Edit navigation belongs in PageHeader.
- `disabled` is a separate presentation control, not authorization. Custom fields must honor it. A disabled form does not automatically disable every child or cancel action.

Built-in types are `text`, `email`, `password`, `number`, `date`, `textarea`, `select`, `radio`, `checkbox`, `switch`, `readonly`, `attachment`, and `lookup`. Use `custom` only for a control or workflow the built-ins cannot express. Pass through its supplied `id`, `describedBy`, `invalid`, and `disabled`; update the value through the provided `setValue`. CommonForm already renders its label and feedback, so avoid duplicating them.

Distinguish view mode from the `readonly` field type: the latter currently renders an output with plaintext styling. The separate ReadOnlyField primitive renders a focusable read-only input/textarea. Use normal field types in view mode for matching create/edit/view shapes; preserve established ReadOnlyField uses when copyable read-only values are required.

### Grid and headings

| Semantic span | Bootstrap mapping |
|---|---|
| `full` | `col-12` |
| `half` | `col-12 col-md-6` |
| `third` | `col-12 col-md-6 col-lg-4` |
| `quarter` | `col-12 col-md-6 col-lg-3` |

Use full width for long Summary/Description text, paired columns for related short values, and one column on mobile. A section creates Card by default; set `card: false` when the page owns the surrounding Card. Omit section title when the outer Card already names it. Use vertical spacing between independent sections.

Switches use the same top-label baseline as adjacent fields, with the switch vertically centered beneath it. Reuse CommonForm's switch renderer; do not recreate a second label beside the switch. Its current wrapper has a 38px minimum while global controls have their own minimum height: verify actual alignment in a browser rather than assuming those numbers match.

### Validation, saving, and navigation

Do not show errors on untouched initial render. Invalid submit must not call the API; associate errors with fields and focus the first invalid control. Keep errors immediately below controls, before help/counters. Preserve `noValidate` so native validation bubbles do not bypass managed feedback.

`useManagedForm` accepts React Hook Form options and enables first-error focus; it does not install a navigation guard or a custom blur-validation policy. Specify and test timing when the feature needs more than its default submit/revalidate behavior.

CommonForm catches rejected `onSubmit` promises and maps known configured field names through [serverFieldErrors.ts](../../client/src/forms/serverFieldErrors.ts). Unknown details receive safe form-level feedback. If the page catches the rejection itself, it must map/show errors itself; do not swallow the rejection and expect CommonForm to see it. Use explicit handling for domain conflicts such as duplicate email when the API contract requires it.

Counters measure characters with `Array.from(value).length`. For code-point limits such as Ticket Summary/Description, use `enforceMaxLength: false` and matching schema validation so HTML's UTF-16 maxlength does not truncate valid input. Do not trim passwords or silently truncate them. Keep generated values out of editable payload fields.

Pass `submitting`, `submitDisabled`, and `cancelDisabled` according to the workflow. Busy state alone does not freeze all fields or children: pass `disabled` or field-level restrictions where required. Keep the normal button label with a spinner. Prevent duplicate mutations, preserve input on failure, and reset the dirty baseline only after confirmed success or authorized discard.

Use [NavigationGuard](../../client/src/navigation/NavigationGuard.tsx) for dirty Create Ticket/Create User/Edit User flows. `isDirty` alone does not block navigation. Login and Change Password do not automatically inherit discard dialogs. Specialized Ticket draft recovery and pending-attachment cleanup remain in the Ticket workflow; do not generalize those into every form.

## Lists, filters, and row actions

Use DataTable for the existing User Management and Staff/Admin Ticket Queue patterns. UserManagement demonstrates `fetchData` with `IFetchParams`/`IFetchResult`; StaffTicketQueue demonstrates controlled data and query props. Choose one ownership mode and do not duplicate fetching in both page and component. Preserve pagination metadata and API field mappings.

`IColumn<T>` defines `key`, `label`, optional `align`, `sortable`, `render`, and `style`. Mark unsupported sorts false and map supported keys to the resource contract. Shared CSS vertically centers all DataTable column headers. Ticket Queue retains fixed widths, a 25% second column, and wrapping; shared alignment does not mean equal column widths.

Supply `basePath` and `itemKey` for navigable rows. Preserve real view links, keyboard activation, hover/focus treatment, and safe handling of interactive children so clicking an action does not also activate the row. Configure view/edit/delete/create visibility explicitly; visual reuse does not authorize those operations. Create labels contain text only; DataTable adds its Plus icon.

Keep draft filter changes separate from applied filters: Cancel discards drafts, Apply commits and resets pagination. Search/filter reset and empty-state actions must follow the page contract; avoid duplicate Clear Filters controls. Distinguish true empty data from no matching results. My Tickets retains its existing specialized responsive table; this contract does not claim it already uses DataTable or authorize replacing it.

## Buttons, icons, badges, and dialogs

Use Button variants `primary`, `secondary`, `tertiary`, and `destructive`. Button defaults to `type="button"`; explicitly use submit when needed. Pass `busy` consistently to preserve the progress slot and keep the original label. Navigation uses Link styled with existing button classes, not a nested button.

Use `lucide-react` (current library) or approved `react-icons`; no hand-drawn SVG, Unicode interface icons, CSS icons, or data-URI icons. Decorative icons have `aria-hidden="true"` and `focusable="false"`. Icon-only controls need an accessible name and visible hover/focus explanation; IconButton is the reusable button choice. Do not duplicate an icon in its label.

Badge variants are visual, not business rules. Keep status/role/priority words visible; ordinal `level` indicators are optional for priority, not categorical status. Do not communicate danger, success, privacy, or disabled state through color alone.

Use Modal for confirmations, filters, and supported previews. Keep focus inside while open, return focus on close, and retain an explicit cancel/close action. Page state determines whether dismissal is allowed during a mutation. Destructive copy names the action and consequence; do not add confirmation dialogs to ordinary actions without a requirement.

## Attachments, communication, and state feedback

Attachments stay separate from Ticket Information. Reuse AttachmentSection for per-file Uploading, Invalid, Failed, Pending, Active, and Removed states; the generic `attachment` field is only a file input. Display the active count and per-file actions according to the feature contract. Keep upload, retry, cleanup, and removal behavior in the specialized workflow. Removed evidence stays readable without active file actions. Never silently submit while an intended attachment remains unresolved.

Public Comments render plain text with preserved line breaks and capped reply indentation; lazy root/reply loading remains separate. Internal Notes are a distinct staff/admin region with a persistent audience warning. Hide the composer for unauthorized users without removing permitted read access or that warning. Never expose Internal Note content to Requesters. Styling cannot grant permission.

Keep the page structure visible during data loading; Skeleton should resemble the final content. Use localized busy state for mutations, safe inline feedback for recoverable failures, SuccessMessage/status regions for completion, and EmptyState/ErrorState where appropriate. Do not replace all failure paths with a generic inline alert: collection/detail routes may require the standalone `/error` experience. Use safe fixed error variants and role-aware Back destinations; do not leak raw backend details or private resource existence.

## Responsive and accessibility acceptance

Desktop starts at 992px, tablet at 768px, mobile below 768px. These are page-layout rules, not a mandate that every dense table switch at 992px: StaffTicketQueue's custom-card branch currently shows its desktop table at Bootstrap `xl` (1200px). Preserve page-specific responsive behavior and test intermediate widths.

At 1440×900, 820×1180, and 390×844 verify: readable labels and values; no page-level horizontal scroll; safe action wrapping; visible focus; full-width mobile fields; accessible filter/dialog controls; long names, ticket numbers, filenames, and messages. My Tickets and attachments retain compact responsive tables; Queue uses cards when narrow. Do not hide essential actions to make a layout fit.

Use associated labels rather than placeholders alone, programmatic required/invalid state, linked helper/error text, semantic headings, keyboard-operable rows and controls, and appropriate status/alert regions. Verify modal focus entry/trap/return, route focus, password visibility, and custom field semantics. Never remove focus outlines without an equivalent visible indicator.

## Working examples and verification

Read the relevant example, not every page:

- User entity reuse: UserForm with CreateUser, EditUser, and ViewUser.
- Read-only ticket information: TicketInformationForm and StaffTicketDetail.
- Specialized form integration: CreateTicket with custom AttachmentSection.
- Small security forms: Login and ChangePassword with shared constants.
- Controlled list versus callback list: StaffTicketQueue and UserManagement.

For a UI change, run the affected client tests and `npm run build` in `client/`; run backend/API tests only when those paths change, subject to repository completion rules. Exercise meaningful behavior: invalid submissions, error mapping, busy controls, dirty cancellation, view-mode restrictions, and mode-specific payloads. For visual changes, use approved Playwright/browser checks at the required viewports when available. Passing DOM tests or TypeScript does not prove visual alignment.

Record commands actually run, warnings, and unverified browser behavior in the repository's required evidence and AI-use records. Update this global contract when approved shared styling changes. Do not modify UI specifications unless explicitly requested.

Reference rationale: AXONS separates PageHeader from its low-level DataTable inside Maintain/Table. Maintenance Tracking places the list title, create action, toolbar, and table in Common/DataTable. TokTickIT follows the latter ownership for its shared list container and uses shared PageHeader/Card primitives for forms, with Bootstrap rather than either reference's UI framework.
