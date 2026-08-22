import { ReactNode } from "react";

export type BadgeVariant = "pale" | "medium" | "strong" | "neutral";

interface BadgeProps {
  variant?: BadgeVariant;
  className?: string;
  children: ReactNode;
}

/*
 * Pill badge inside the Zen Green language (ui-spec Sections 3.3, 17).
 *
 * The variant is visual only. Mapping Priority or Status onto a variant belongs
 * to the screens that own those domains. The visible text is always the label,
 * so meaning never depends on colour (Section 29.9).
 */
export function Badge({ variant = "neutral", className, children }: BadgeProps) {
  const classes = ["badge", "rounded-pill", "tt-badge", `tt-badge--${variant}`, className]
    .filter(Boolean)
    .join(" ");

  return <span className={classes}>{children}</span>;
}
