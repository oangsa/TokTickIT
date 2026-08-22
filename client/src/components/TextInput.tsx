import { InputHTMLAttributes } from "react";

import { FormField, SharedFieldProps } from "./FormField.js";

type TextInputProps = SharedFieldProps & InputHTMLAttributes<HTMLInputElement>;

/* Editable text control (ui-spec Section 7.2). */
export function TextInput({ label, required, error, helpText, counter, id, className, ...rest }: TextInputProps) {
  return (
    <FormField label={label} required={required} error={error} helpText={helpText} counter={counter} id={id}>
      {({ id: fieldId, describedBy, invalid }) => (
        <input
          id={fieldId}
          type="text"
          className={["form-control", invalid ? "is-invalid" : null, className].filter(Boolean).join(" ")}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          required={required}
          {...rest}
        />
      )}
    </FormField>
  );
}
