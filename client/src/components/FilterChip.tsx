import { IconButton } from "./IconButton.js";

interface FilterChipProps {
  label: string;
  onRemove: () => void;
  removeLabel?: string;
}

/* Removable applied-filter chip (ui-spec Section 14.4). */
export function FilterChip({ label, onRemove, removeLabel }: FilterChipProps) {
  return (
    <span className="badge rounded-pill tt-chip">
      {label}
      <IconButton label={removeLabel ?? `Remove filter ${label}`} onClick={onRemove}>
        <span aria-hidden="true">×</span>
      </IconButton>
    </span>
  );
}
