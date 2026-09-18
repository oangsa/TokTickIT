---
name: form-engineering
description: Construct or revise TokTickIT create, edit, and view forms using its CommonForm, typed field configuration, managed validation, and shared styling contract. Use for new project forms, mode reuse, field layouts, or form consistency; not for unrelated projects or backend-only work.
---

# TokTickIT Form Engineering

Build forms that belong to the existing application. This skill is specific to TokTickIT and does not authorize new domain behavior, endpoints, or dependencies.

## Read the relevant contract

Resolve paths from the TokTickIT repository root. When installed at `.agents/skills/form-engineering/`, that root is three directories above this file's directory.

1. Read applicable AGENTS.md and the requested lab/Issue requirements.
2. Read [global styling contract](../../../docs/generics/styling-contract.md), especially Form construction, Shared component selection, and Responsive acceptance.
3. Read the affected parts of `docs/lab-02/ui-spec.md` and `docs/lab-03/ui-spec.md`; Lab 3 Section 7 defines the managed-form foundation. Consult the current API specification for fields, validation, permissions, and success/failure behavior.
4. Inspect current `client/src/components/Common/Form/CommonForm.tsx`, `client/src/forms/formTypes.ts`, `client/src/forms/useManagedForm.ts`, and the closest entity form. Treat actual props as the implementation interface; do not copy stale sample APIs from memory.

Current lab behavior overrides superseded earlier-lab flows. If a required field, default, mutation, permission, or error behavior is unresolved, ask one concrete question before implementing that dependent portion. Do not invent an API to make a form appear complete.

## Choose the closest construction

| Request | Starting reference |
|---|---|
| Create/edit/view of one entity | `client/src/modules/Users/UserForm.tsx`, `client/src/constants/forms/user.ts`, and corresponding User pages |
| Read-only entity information | `client/src/modules/Tickets/components/TicketInformationForm.tsx`, `client/src/modules/Tickets/Staff/StaffTicketDetail.tsx` |
| Specialized upload workflow inside a form | `client/src/modules/Tickets/Requester/CreateTicket.tsx`, `client/src/modules/Tickets/attachments/AttachmentSection.tsx` |
| Authentication/password form | `client/src/modules/Auth/Login.tsx`, `client/src/modules/Auth/ChangePassword.tsx`, `client/src/constants/forms/auth.ts` |

Use typed `FormSection<TValues>[]` and `useManagedForm<TValues>` for new entity forms. Reuse an existing entity component when applicable. Create a thin entity wrapper only when it meaningfully shares fields or mode behavior; do not create a CRUD-page factory. Keep existing small specialized forms on shared primitives unless the requested change needs migration.

## Construct the form

- Define explicit form values and API mapping separately. Read-only/generated display values are not automatically request fields.
- Put reusable labels, limits, options, and sections in `client/src/constants/forms/`; use existing constants where correct. Use `Path<TValues>`-compatible field names, unique keys, and meaningful labels.
- Prefer built-in field types. Set `span` to `full`, `half`, `third`, or `quarter`; let CommonForm map Bootstrap classes. Long prose fields are full width. Related short values may share a row.
- Share the entity config across create, edit, and view. Adapt copies for permissions or mode-specific fields; do not mutate shared arrays.
- Supply a Zod schema to editable managed forms. Config `required`/`maxLength` supports semantics, not authoritative validation. Preserve backend constraints, numeric select values, normalization, and empty-value rules.
- Use `mode="view"` with normal field types for the same form shape without editing. Do not force submit/cancel buttons on. A schema may be omitted for display-only values. Reuse ReadOnlyField instead when the existing flow needs a focusable, copyable read-only control; the `readonly` config type currently renders plaintext output.
- Load/edit data deliberately with reset or controlled values. Do not reset a dirty form on incidental renders/refetches. After confirmed save, update the baseline; after failed save, retain input.

## Compose page and section layout

Use PageHeader once, then Card sections. CommonForm sections render Card by default. If a page owns Card, set the inner section to `card: false` and omit a repeated title. Never nest forms.

Keep primary information full width. Put secondary workflows such as Account Security below the information card, following EditUser. Staff Ticket Detail uses stacked Ticket Information, Assignment & Workflow, Attachments, and Communication. Do not reintroduce the earlier side-by-side password panel.

Reuse CommonForm's switch renderer: label above, switch centered beneath, aligned with neighboring labels. Do not invent checkbox labels or custom CSS positioning to mimic it. Actual rendered height needs visual verification; the switch wrapper minimum is not the same as the global control minimum.

Use Bootstrap utilities and existing `--tt-*` tokens. Keep shared styling in theme/components CSS instead of copying styles into each page. Use Lucide icons with decorative accessibility attributes; let shared buttons supply their existing icons and busy slots.

## Wire actions and validation correctly

CommonForm owns the normal submit/cancel row. Set domain labels and callbacks; the page owns API calls, permission restrictions, confirmations, and navigation. Keep one submission path.

CommonForm catches rejected `onSubmit` promises and maps configured field names using `form.mapServerErrors`. If the page handles an API exception itself, explicitly map safe field/form feedback there. Unknown fields become a safe form-level error. Do not display raw backend internals or swallow failures silently.

No errors on untouched render. Invalid submit must avoid the API and focus the first invalid field. ManagedForm enables error focus but does not guarantee every custom control supports it or implement a bespoke blur-validation policy. Forward/register focus support for custom inputs and test it. Preserve `noValidate`, labels, required state, `aria-invalid`, and helper/error associations.

Pass `submitting`, `submitDisabled`, `cancelDisabled`, and `disabled` deliberately. Busy submit disables the button, not all inputs/children or every programmatic submission path. Protect duplicate mutations according to the existing page pattern. Keep the normal action text while showing progress.

Preserve character semantics: Ticket text uses Unicode code-point counts; use `enforceMaxLength: false` when HTML maxlength would truncate differently and validate in the schema. Passwords are not trimmed or silently truncated. Use password visibility controls and autocomplete values appropriate to the existing authentication contract.

Custom fields receive `id`, `name`, `value`, `setValue`, `describedBy`, `invalid`, and `disabled`. Honor those props, do not duplicate CommonForm's outer label/feedback, and make view mode noninteractive. Built-in `attachment` is a file input, not the Ticket upload lifecycle. Use AttachmentSection for pending upload, retry, preview, binding, and cleanup; those remain feature responsibilities.

Register `useNavigationGuard` only where the feature requires dirty protection. Follow CreateUser/EditUser/CreateTicket for cancel, internal navigation, and discard; do not assume `isDirty` registers anything. Login and ChangePassword do not inherit generic discard dialogs. Do not copy Ticket's recovery/idempotency behavior into ordinary forms.

## Verify the outcome

Before editing, identify the expected modes, fields, payload, errors, permissions, success behavior, and affected tests. After implementation, run focused existing tests and add meaningful coverage for new behavior:

- expected values and controls in create/edit/view;
- invalid submit does not mutate; server errors map and focus correctly;
- view/restricted fields cannot change data;
- busy actions prevent repeated mutation and errors preserve input;
- dirty cancel/discard and successful reset behave as specified;
- custom controls preserve labels, keyboard behavior, and disabled mode.

Run the client build/typecheck through its actual package script. Use approved browser checks for label baselines, switches, card ownership, long content, action wrapping, and layout at 1440×900, 820×1180, and 390×844. DOM tests do not prove alignment. Report unavailable visual checks rather than claiming matching pixels.

Update the required AI-use record; update the global styling contract when shared conventions change. Read UI specifications as feature references, but do not modify them unless explicitly requested. Preserve unrelated changes. Do not commit or push unless authorized.
