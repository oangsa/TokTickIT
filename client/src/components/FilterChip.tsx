import { X } from "lucide-react";

import { Chip } from "./Chip.js";
import { IconButton } from "./IconButton.js";

interface FilterChipProps {
  label: string;
  onRemove: () => void;
  removeLabel?: string;
}

/* Removable applied-filter chip (ui-spec Section 14.4). */
export function FilterChip({ label, onRemove, removeLabel }: FilterChipProps) {
  return (
    <Chip variant="subtle">
      {label}
      <IconButton label={removeLabel ?? "Remove filter " + label} onClick={onRemove}>
        <X size={14} strokeWidth={1.75} aria-hidden="true" focusable="false" />
      </IconButton>
    </Chip>
  );
}
