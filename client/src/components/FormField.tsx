import { ReactNode, useId } from "react";

import { CharacterCounter } from "./CharacterCounter.js";
import { ValidationMessage } from "./ValidationMessage.js";

export interface FieldRenderProps {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
}

export interface SharedFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  helpText?: string;
  counter?: { value: number; max: number };
}

interface FormFieldProps extends SharedFieldProps {
  id?: string;
  children: (props: FieldRenderProps) => ReactNode;
}

/*
 * Shared label, required marker, helper text, counter, and error wrapper
 * (ui-spec Sections 7.1, 7.6, 9, 29.3). This component owns the
 * `aria-describedby` wiring so every control associates the same way.
 *
 * The red asterisk is decorative; the control's native `required` attribute
 * carries the requirement programmatically (Section 29.3).
 *
 * The shared `Form` wrapper supplies `noValidate` for forms built on these
 * fields. Without it, the browser's own bubble pre-empts the field-associated
 * message and first-invalid focus Section 8.2 requires.
 *
 * The error renders immediately after the control, before the help/counter row:
 * Section 7.6 puts the validation message directly below its field, and a
 * counter between the two would break that adjacency on exactly the fields
 * (Summary, Description) that carry both.
 */
export function FormField({ label, required, error, helpText, counter, id, children }: FormFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const helpId = `${fieldId}-help`;
  const counterId = `${fieldId}-counter`;
  const errorId = `${fieldId}-error`;

  const describedBy =
    [helpText ? helpId : null, counter ? counterId : null, error ? errorId : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div className="mb-3">
      <label className="form-label fw-medium" htmlFor={fieldId}>
        {label}
        {required ? (
          <span className="tt-required" aria-hidden="true">
            {" *"}
          </span>
        ) : null}
      </label>

      {children({ id: fieldId, describedBy, invalid: Boolean(error) })}

      {error ? <ValidationMessage id={errorId}>{error}</ValidationMessage> : null}

      <div className="d-flex justify-content-between gap-3">
        {helpText ? (
          <span id={helpId} className="form-text">
            {helpText}
          </span>
        ) : (
          <span />
        )}
        {counter ? <CharacterCounter id={counterId} value={counter.value} max={counter.max} /> : null}
      </div>
    </div>
  );
}
