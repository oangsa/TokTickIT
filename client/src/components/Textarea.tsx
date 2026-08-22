import { TextareaHTMLAttributes } from "react";

import { FormField, SharedFieldProps } from "./FormField.js";

type TextareaProps = SharedFieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>;

/*
 * Multi-line control. Description is the exception to the standard control
 * height and supports vertical resize (ui-spec Sections 7.2, 11.4, 36).
 */
export function Textarea({
  label,
  required,
  error,
  helpText,
  counter,
  id,
  className,
  rows = 5,
  ...rest
}: TextareaProps) {
  return (
    <FormField label={label} required={required} error={error} helpText={helpText} counter={counter} id={id}>
      {({ id: fieldId, describedBy, invalid }) => (
        <textarea
          id={fieldId}
          rows={rows}
          className={["form-control", "tt-textarea", invalid ? "is-invalid" : null, className]
            .filter(Boolean)
            .join(" ")}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          required={required}
          {...rest}
        />
      )}
    </FormField>
  );
}
