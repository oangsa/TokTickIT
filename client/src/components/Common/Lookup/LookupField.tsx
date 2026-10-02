import { forwardRef, useState } from "react";
import { Search, X } from "lucide-react";
import { IconButton } from "../IconButton.js";
import { LookupModal } from "./LookupModal.js";
import type { LookupDefinition } from "./types.js";

export interface LookupFieldProps {
  id: string;
  name?: string;
  label: string;
  value: string;
  displayValue?: string;
  definition: LookupDefinition;
  onChange: (value: string, displayValue: string) => void;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  describedBy?: string;
  clearable?: boolean;
  onBlur?: () => void;
}
export const LookupField = forwardRef<HTMLInputElement, LookupFieldProps>(function LookupField({ id, name, label, value, displayValue, definition, onChange, disabled, required, invalid, describedBy, clearable, onBlur }, ref) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<{ value: string; display: string }>();
  const display = !value ? "" : selected?.value === value ? selected.display : displayValue ?? value;
  return <>
    <div className="input-group">
      <input ref={ref} id={id} name={name} readOnly value={display} disabled={disabled} required={required} onBlur={onBlur} aria-invalid={invalid || undefined} aria-describedby={describedBy} className={`form-control${invalid ? " is-invalid" : ""}`} />
      <IconButton label={`Lookup ${label}`} disabled={disabled} className="btn-outline-secondary" onClick={() => !disabled && setOpen(true)}><Search size={16} aria-hidden="true" focusable="false" /></IconButton>
      {clearable && value && <IconButton label={`Clear ${label}`} disabled={disabled} className="btn-outline-secondary" onClick={() => { if (!disabled) { setSelected(undefined); onChange("", ""); } }}><X size={16} aria-hidden="true" focusable="false" /></IconButton>}
    </div>
    <LookupModal open={open && !disabled} definition={definition} disabled={disabled} onClose={() => setOpen(false)} onSelect={(row) => {
      if (disabled) return;
      const next = definition.getValue(row); const text = definition.getDisplayValue(row);
      setSelected({ value: next, display: text }); onChange(next, text); setOpen(false);
    }} />
  </>;
});
