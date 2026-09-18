import type { Ticket } from "../api.js";
import { Chip, type ChipProps, type ChipVariant } from "./Chip.js";

export type PriorityValue = Ticket["requestedPriority"];

const PRIORITY_LEVEL: Record<PriorityValue, 1 | 2 | 3> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
};

const PRIORITY_VARIANT: Record<PriorityValue, ChipVariant> = {
  LOW: "subtle",
  MEDIUM: "secondary",
  HIGH: "primary",
};

export interface PriorityChipProps
  extends Omit<ChipProps, "children" | "level" | "variant"> {
  value: PriorityValue;
  variant?: ChipVariant;
  showMeter?: boolean;
}

/*
 * Priority owns its ordinal mapping. Callers can explicitly request outline
 * when a contextual neutral treatment is needed; semantic defaults keep lists
 * consistent and preserve the priority meter.
 */
export function PriorityChip({
  value,
  variant,
  showMeter,
  ...rest
}: PriorityChipProps) {
  const resolvedVariant = variant ?? PRIORITY_VARIANT[value];
  const resolvedShowMeter = showMeter ?? resolvedVariant !== "outline";

  return (
    <Chip
      {...rest}
      variant={resolvedVariant}
      level={resolvedShowMeter ? PRIORITY_LEVEL[value] : undefined}
    >
      {value}
    </Chip>
  );
}
