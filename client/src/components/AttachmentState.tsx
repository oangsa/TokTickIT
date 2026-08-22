import { Badge, BadgeVariant } from "./Badge.js";

/*
 * Uploading/Failed/Invalid are client-local upload states; Pending/Active/
 * Removed are the persisted Attachment lifecycle (ui-spec Section 23.0).
 */
export type AttachmentStateName =
  | "Uploading"
  | "Failed"
  | "Invalid"
  | "Pending"
  | "Active"
  | "Removed";

const STATE_STYLE: Record<AttachmentStateName, { variant: BadgeVariant; className?: string }> = {
  Uploading: { variant: "neutral" },
  Failed: { variant: "neutral", className: "tt-attachment-state--error" },
  Invalid: { variant: "neutral", className: "tt-attachment-state--error" },
  Pending: { variant: "neutral", className: "tt-attachment-state--pending" },
  Active: { variant: "pale" },
  Removed: { variant: "neutral", className: "tt-attachment-state--removed" },
};

/*
 * Per-file Attachment state badge (ui-spec Section 23).
 *
 * The state name is always the visible text, so meaning never depends on colour
 * (Section 29.9); the pending, error, and removed treatments add a
 * border/border-style difference as a second, non-colour signal, so Uploading
 * and Pending do not collapse into one look (Section 34). Which actions each
 * state permits is owned by the Attachment table, not by this badge.
 */
export function AttachmentState({ state }: { state: AttachmentStateName }) {
  const { variant, className } = STATE_STYLE[state];

  return (
    <Badge variant={variant} className={className}>
      {state}
    </Badge>
  );
}
