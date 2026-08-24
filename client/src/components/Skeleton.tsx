interface SkeletonProps {
  width?: string;
  height?: string;
  count?: number;
  className?: string;
}

/*
 * Skeleton loading for data-heavy screens (ui-spec Section 28).
 *
 * Skeletons are decoration and are hidden from assistive technology. The screen
 * that renders them owns the `role="status"` loading announcement (Section 29.7).
 */
export function Skeleton({ width = "100%", height = "1rem", count = 1, className }: SkeletonProps) {
  return (
    <>
      {Array.from({ length: count }, (_unused, index) => (
        <span
          key={index}
          className={["tt-skeleton", "mb-2", className].filter(Boolean).join(" ")}
          style={{ width, height }}
          aria-hidden="true"
        />
      ))}
    </>
  );
}
