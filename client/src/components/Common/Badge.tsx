import { Chip, type ChipProps, type ChipVariant } from "./Chip.js";

/*
 * Compatibility export for older lab imports. New code uses Chip; existing
 * Badge callers still receive Chip markup through the new variants.
 */
export type BadgeVariant =
  | ChipVariant
  | "pale"
  | "medium"
  | "strong"
  | "neutral";

export type BadgeProps = Omit<ChipProps, "variant"> & {
  variant?: BadgeVariant;
};

function toChipVariant(variant: BadgeVariant): ChipVariant {
  switch (variant) {
    case "pale":
      return "subtle";
    case "medium":
      return "secondary";
    case "strong":
      return "primary";
    case "neutral":
      return "outline";
    default:
      return variant;
  }
}

export function Badge({ variant = "outline", ...rest }: BadgeProps) {
  return (
    <Chip
      {...rest}
      variant={toChipVariant(variant)}
    />
  );
}
