import { FormField } from "./FormField.js";

interface ReadOnlyFieldProps {
  label: string;
  value: string;
  helpText?: string;
  id?: string;
}

/*
 * Read-only values keep the form-control shape but use a distinct background so
 * they never look editable (ui-spec Sections 7.3, 20.3).
 *
 * `readOnly` rather than `disabled`: the value stays in the tab order and in the
 * accessibility tree.
 */
export function ReadOnlyField({ label, value, helpText, id }: ReadOnlyFieldProps) {
  return (
    <FormField label={label} helpText={helpText} id={id}>
      {({ id: fieldId, describedBy }) => (
        <input
          id={fieldId}
          type="text"
          className="form-control tt-readonly"
          value={value}
          readOnly
          aria-describedby={describedBy}
        />
      )}
    </FormField>
  );
}
