import { ReactNode } from "react";

export type BadgeVariant = "pale" | "medium" | "strong" | "neutral";

interface BadgeProps {
  variant?: BadgeVariant;
  /*
   * How many of three segments are filled. Ordinal values (Priority) pass one;
   * categorical values (Status) leave it off and render text alone.
   */
  level?: 1 | 2 | 3;
  className?: string;
  children: ReactNode;
}

/*
 * Pill badge inside the Zen Green language (ui-spec Sections 3.3, 17).
 *
 * The variant is visual only. Mapping Priority or Status onto a variant belongs
 * to the screens that own those domains. The visible text is always the label,
 * so meaning never depends on colour (Section 29.9).
 *
 * The meter is aria-hidden: it restates the level the text already carries, so
 * announcing it would read the same value twice.
 */
export function Badge({ variant = "neutral", level, className, children }: BadgeProps) {
  const classes = ["badge", "rounded-pill", "tt-badge", `tt-badge--${variant}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes}>
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
