import type { HTMLAttributes, ReactNode } from "react";

export type ChipVariant = "primary" | "secondary" | "subtle" | "outline" | "destructive";
export type ChipLevel = 1 | 2 | 3;

export interface ChipProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  variant?: ChipVariant;
  level?: ChipLevel;
  children: ReactNode;
}

/*
 * Shared pill surface. Domain meaning belongs in PriorityChip/StatusChip;
 * Chip only owns the visual contract and optional ordinal meter.
 */
export function Chip({
  variant = "outline",
  level,
  className,
  children,
  ...rest
}: ChipProps) {
  const classes = ["badge", "rounded-pill", "tt-chip", "tt-chip--" + variant, className]
    .filter(Boolean)
    .join(" ");

  return (
    <span {...rest} className={classes}>
      {level === undefined ? null : (
        <span className="tt-level" aria-hidden="true">
          {[1, 2, 3].map((segment) => (
            <span key={segment} className={segment <= level ? "tt-level__on" : undefined} />
          ))}
        </span>
      )}
      {children}
    </span>
  );
}
