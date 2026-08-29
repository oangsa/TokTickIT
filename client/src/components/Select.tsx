import { SelectHTMLAttributes } from "react";

import { FormField, SharedFieldProps } from "./FormField.js";

type SelectProps = SharedFieldProps & SelectHTMLAttributes<HTMLSelectElement>;

/* Editable select control (ui-spec Section 7.2). */
export function Select({
  label,
  labelHidden,
  required,
  error,
  helpText,
  counter,
  id,
  className,
  children,
  "aria-describedby": externalDescribedBy,
  "aria-invalid": externalInvalid,
  ...rest
}: SelectProps) {
  return (
    <FormField label={label} labelHidden={labelHidden} required={required} error={error} helpText={helpText} counter={counter} id={id}>
      {({ id: fieldId, describedBy, invalid }) => (
        <select
          id={fieldId}
          className={["form-select", invalid ? "is-invalid" : null, className].filter(Boolean).join(" ")}
          aria-describedby={[describedBy, externalDescribedBy].filter(Boolean).join(" ") || undefined}
          aria-invalid={invalid || externalInvalid || undefined}
          required={required}
          {...rest}
        >
          {children}
        </select>
      )}
    </FormField>
  );
}
