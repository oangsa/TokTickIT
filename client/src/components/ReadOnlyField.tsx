import { FormField } from "./FormField.js";

interface ReadOnlyFieldProps {
  label: string;
  value: string;
  helpText?: string;
  id?: string;
  /*
   * Ticket Detail Description is a read-only field holding up to 2000 characters
   * (ui-spec Sections 20.2, 20.3). A single-line input would show one scrolling
   * line of it, so multi-line values render as a read-only textarea that keeps
   * the same form-control shape and read-only treatment.
   */
  multiline?: boolean;
  rows?: number;
}

/*
 * Read-only values keep the form-control shape but use a distinct background so
 * they never look editable (ui-spec Sections 7.3, 20.3).
 *
 * `readOnly` rather than `disabled`: the value stays in the tab order and in the
 * accessibility tree.
 */
export function ReadOnlyField({ label, value, helpText, id, multiline, rows = 5 }: ReadOnlyFieldProps) {
  return (
    <FormField label={label} helpText={helpText} id={id}>
      {({ id: fieldId, describedBy }) =>
        multiline ? (
          <textarea
            id={fieldId}
            rows={rows}
            className="form-control tt-readonly tt-readonly--multiline"
            value={value}
            readOnly
            aria-describedby={describedBy}
          />
        ) : (
          <input
            id={fieldId}
            type="text"
            className="form-control tt-readonly"
            value={value}
            readOnly
            aria-describedby={describedBy}
          />
        )
      }
    </FormField>
  );
}
