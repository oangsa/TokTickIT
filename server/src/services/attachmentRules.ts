import { ApiError } from "../http/errors.js";

/*
 * api-spec Section 11.3 / BR-46. Decimal 5 MB, not 5 MiB: the same literal is
 * enforced by the multipart parser, by this module, by the
 * `attachment_size_data_check` CHECK in the Lab 2 migration, and by the client
 * copy in `client/src/attachments/attachmentRules.ts`. The boundary is
 * inclusive -- 5,000,000 bytes is a valid Attachment and 5,000,001 is not.
 */
export const MAX_ATTACHMENT_BYTES = 5_000_000;

/*
 * A ceiling on how many unbound Pending Attachments one Requester may hold at
 * once.
 *
 * Nothing in api-spec fixes this number: the contract bounds Active Attachments
 * per Ticket (BR-47) and expires unbound ones after 24 hours (BR-54), but it
 * bounds nothing in between, so `POST /api/attachments` is the one write in the
 * feature a Requester can repeat without limit. At MAX_ATTACHMENT_BYTES each,
 * a browser tab left looping fills the `data` column faster than the daily
 * sweep empties it.
 *
 * 25 is five abandoned Create Ticket drafts' worth, which is well past what the
 * screen can prepare (five per draft, released on a confirmed discard) and far
 * short of what a loop would write. A Requester who genuinely reaches it is
 * holding orphans the sweep will clear.
 */
export const MAX_PENDING_ATTACHMENTS_PER_REQUESTER = 25;

/*
 * BR-44/BR-45. The filename extension is the Lab 2 type-validation authority and
 * the response MIME type is derived from it, because the multipart MIME value is
 * client-supplied and therefore not acceptance evidence. Magic-byte inspection
 * is explicitly outside Lab 2 (api-spec Section 11.1), so this mapping is
 * hardening, not proof of content.
 */
const EXTENSION_MIME_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
};

export const ALLOWED_EXTENSIONS = Object.keys(EXTENSION_MIME_TYPES);

/*
 * C0, DEL, and C1. CR, LF, and NUL are the ones the contract names (api-spec
 * Section 11.3.1): a newline in a filename would let a name break out of the
 * `Content-Disposition` header it is written into, and a NUL would truncate the
 * name for anything reading it as a C string. The rest of the control range is
 * rejected with them rather than left as the one class of unprintable character
 * a filename is allowed to carry.
 */
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F-\u009F]/;

export interface ResolvedUploadName {
  originalName: string;
  extension: string;
  mimeType: string;
}

function invalidName(message: string): ApiError {
  return new ApiError("VALIDATION_ERROR", [{ field: "file", message }]);
}

/*
 * api-spec Section 11.3.1 / BR-77. The order matters and each step has a reason:
 *
 * 1. Take the basename across BOTH separators. A client on Windows sends
 *    `C:\Users\alice\vpn-error.png`, one on POSIX sends `docs/vpn-error.png`,
 *    and a hostile one sends `../../etc/passwd`. Splitting on only one separator
 *    leaves the other's path text inside the stored name.
 * 2. Reject control characters before anything else looks at the value.
 * 3. Measure the COMPLETE basename, extension included, in UTF-8 bytes -- the
 *    unit `attachment_original_name_bytes_check` uses. A `.length` here would
 *    disagree with the CHECK on any non-ASCII name and turn a safe 400 into an
 *    insert-time 500.
 * 4. Only then read the extension, from the validated basename rather than from
 *    the raw multipart filename.
 *
 * An overlong or unsafe name is refused, never truncated: silently storing
 * `report.pd` for `report.pdf` would change which file the Requester attached.
 */
export function resolveUploadName(raw: string): ResolvedUploadName {
  const separator = Math.max(raw.lastIndexOf("/"), raw.lastIndexOf("\\"));
  const originalName = separator === -1 ? raw : raw.slice(separator + 1);

  if (CONTROL_CHARACTERS.test(originalName)) {
    throw invalidName("The file name must not contain control characters.");
  }

  const bytes = Buffer.byteLength(originalName, "utf8");

  if (bytes < 1 || bytes > 255) {
    throw invalidName("The file name must contain 1-255 UTF-8 bytes.");
  }

  const dot = originalName.lastIndexOf(".");

  if (dot === -1 || dot === originalName.length - 1) {
    throw invalidName("The file name must end with a supported file extension.");
  }

  const extension = originalName.slice(dot + 1).toLowerCase();
  const mimeType = EXTENSION_MIME_TYPES[extension];

  if (mimeType === undefined) {
    /*
     * A well-formed name carrying an unsupported extension is a media-type
     * refusal, not a malformed request (api-spec Section 4.3): the client sent a
     * valid file the API does not accept.
     */
    throw new ApiError(
      "UNSUPPORTED_MEDIA_TYPE",
      undefined,
      "The attachment file type is not supported.",
    );
  }

  return { originalName, extension, mimeType };
}

/*
 * The 413 copy for an oversized file, which api-spec Section 4.3 states
 * separately from the oversized-JSON-body copy so a client is never told a file
 * exceeded the Attachment limit when its JSON body did.
 */
export function payloadTooLargeError(): ApiError {
  return new ApiError(
    "PAYLOAD_TOO_LARGE",
    undefined,
    `The uploaded file exceeds the maximum allowed size of ${MAX_ATTACHMENT_BYTES.toLocaleString("en-US")} bytes.`,
  );
}

export const MIN_REMOVAL_REASON = 3;
export const MAX_REMOVAL_REASON = 200;

/*
 * api-spec Section 13.4 / `attachment_lifecycle_check`. The removal reason a
 * soft-removal writes.
 *
 * Counted in code points, not UTF-16 code units, because the CHECK is
 * `char_length(...)` and `VARCHAR(200)` is also counted in characters. A
 * `.length` here disagrees with both on any astral character: two emoji are 4
 * code units but 2 characters, so the app would accept a reason the CHECK then
 * rejects -- an update-time 500 where the contract requires a safe 400 -- and a
 * 200-character reason of emoji would be refused even though the column holds
 * it. Same rule, same unit, as Summary and Description in `ticketCreateRequest`.
 *
 * Control characters are refused for a second database reason: PostgreSQL `text`
 * cannot hold NUL at all, so a reason carrying one is a 500 rather than a value.
 * They are rejected as a class, exactly as a file name's are.
 *
 * Returns the message for an unusable reason, or `null` when it can be stored.
 */
export function removalReasonError(reason: string): string | null {
  if (CONTROL_CHARACTERS.test(reason)) {
    return "reason must not contain control characters.";
  }

  const length = [...reason].length;

  if (length < MIN_REMOVAL_REASON || length > MAX_REMOVAL_REASON) {
    return `reason must contain ${MIN_REMOVAL_REASON}-${MAX_REMOVAL_REASON} characters.`;
  }

  return null;
}
