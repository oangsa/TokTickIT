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
