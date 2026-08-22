import { ReactNode } from "react";

interface ValidationMessageProps {
  id?: string;
  children: ReactNode;
}

/*
 * Field-associated validation message (ui-spec Section 7.6). The message text
 * itself is the non-colour indicator, and the glyph is decorative.
 *
 * No `role="alert"`: FormField already points the control's `aria-describedby`
 * here, which is what Section 29.4 asks for, and an assertive live region would
 * additionally interrupt once per failed field when Section 8.2 validates the
 * whole form on submit.
 */
export function ValidationMessage({ id, children }: ValidationMessageProps) {
  return (
    <p id={id} className="invalid-feedback d-block tt-validation mb-0">
      <span aria-hidden="true">⚠ </span>
      {children}
    </p>
  );
}
