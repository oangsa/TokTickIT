import { ReactNode } from "react";
import { Check } from "lucide-react";

interface SuccessMessageProps {
  children: ReactNode;
  className?: string;
}

/*
 * Non-intrusive success confirmation (ui-spec Sections 3.1, 11.7, 29.7).
 *
 * `role="status"` announces the message politely when it appears rather than
 * interrupting. The visible text carries the meaning, so the Pale Green surface
 * is never the only signal and the glyph stays decorative (Section 29.9).
 */
export function SuccessMessage({ children, className }: SuccessMessageProps) {
  return (
    <p role="status" className={["tt-success", "mb-0", className].filter(Boolean).join(" ")}>
      <Check size={16} strokeWidth={2} aria-hidden="true" focusable="false" />
      <span>{children}</span>
    </p>
  );
}
