import { Ticket } from "lucide-react";

/* The TokTickIT identity mark (ui-spec Sections 5.1, 5.2, 6.2). */
export function BrandMark() {
  return (
    <Ticket
      className="tt-brand__mark"
      size={20}
      strokeWidth={1.4}
      aria-hidden="true"
      focusable="false"
    />
  );
}
