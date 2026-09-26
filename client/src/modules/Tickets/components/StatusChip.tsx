import type { Ticket } from "../../../api.js";
import { Chip, type ChipProps, type ChipVariant } from "../../../components/Common/Chip.js";

export type StatusValue = Ticket["currentStatus"];

const STATUS_VARIANT: Record<StatusValue, ChipVariant> = {
  NEW: "subtle",
  OPEN: "subtle",
  IN_PROGRESS: "secondary",
  WAITING_FOR_REQUESTER: "secondary",
  RESOLVED: "secondary",
  CLOSED: "subtle",
  REOPENED: "secondary",
  CANCELLED: "destructive",
};

function statusLabel(value: StatusValue): string {
  return value.replaceAll("_", " ");
}

export interface StatusChipProps
  extends Omit<ChipProps, "children" | "level" | "variant"> {
  value: StatusValue;
  variant?: ChipVariant;
  label?: string;
}

export function StatusChip({ value, variant, label, ...rest }: StatusChipProps) {
  return (
    <Chip {...rest} variant={variant ?? STATUS_VARIANT[value]}>
      {label ?? statusLabel(value)}
    </Chip>
  );
}
