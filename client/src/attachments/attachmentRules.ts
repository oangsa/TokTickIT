/*
 * The client half of the Attachment upload rules (ui-spec Section 22.3).
 *
 * These mirror `server/src/services/attachmentRules.ts` exactly, and mirroring
 * is all they do: the backend re-validates every one of them, because a rule
 * enforced only here is a rule anyone can skip with a direct request. What this
 * copy buys is the Invalid state -- a file the user can be told about before it
 * is uploaded, rather than after a round trip.
 */

/* BR-46. Decimal 5 MB: exactly 5,000,000 bytes, inclusive. */
export const MAX_ATTACHMENT_BYTES = 5_000_000;

/* BR-47. Removed Attachments do not count toward it. */
export const MAX_ACTIVE_ATTACHMENTS = 5;

export const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "pdf"] as const;

/* The user-facing summary of the rules above (ui-spec Section 22.3). */
export const ATTACHMENT_RULES_TEXT =
  "JPG, JPEG, PNG, WEBP, or PDF. Up to 5 MB (5,000,000 bytes) per file, and up to 5 active attachments.";

const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F-\u009F]/;

/*
 * Decimal units, because the rule the UI states to the user is decimal: ui-spec
 * Section 22.3 fixes the per-file limit at 5,000,000 bytes and calls it "5 MB".
 * Binary divisors would render a file at that exact limit as 4.8 MB, next to a
 * screen promising a maximum of 5 MB.
 */
export function formatSize(bytes: number): string {
  if (bytes < 1000) {
    return `${bytes} B`;
  }

  const kilobytes = bytes / 1000;

  return kilobytes < 1000 ? `${kilobytes.toFixed(1)} KB` : `${(kilobytes / 1000).toFixed(1)} MB`;
}

export function fileExtension(name: string): string | null {
  const dot = name.lastIndexOf(".");

  return dot === -1 || dot === name.length - 1 ? null : name.slice(dot + 1).toLowerCase();
}

/*
 * Returns the reason a selection cannot become an Attachment, or `null` when it
 * can. A rejected file becomes an Invalid row and never leaves the browser; its
 * siblings are unaffected (ui-spec Section 23.3).
 */
export function validateSelectedFile(file: File): string | null {
  const separator = Math.max(file.name.lastIndexOf("/"), file.name.lastIndexOf("\\"));
  const basename = separator === -1 ? file.name : file.name.slice(separator + 1);

  if (CONTROL_CHARACTERS.test(basename)) {
    return "The file name contains characters that are not allowed.";
  }

  /* Measured in UTF-8 bytes, the unit the database column uses (BR-77). */
  if (new TextEncoder().encode(basename).length > 255) {
    return "The file name is longer than 255 bytes.";
  }

  const extension = fileExtension(basename);

  if (extension === null || !ALLOWED_EXTENSIONS.includes(extension as (typeof ALLOWED_EXTENSIONS)[number])) {
    return "Unsupported file type. Use JPG, JPEG, PNG, WEBP, or PDF.";
  }

  if (file.size === 0) {
    return "The file is empty.";
  }

  if (file.size > MAX_ATTACHMENT_BYTES) {
    return `The file is larger than the ${formatSize(MAX_ATTACHMENT_BYTES)} limit.`;
  }

  return null;
}
