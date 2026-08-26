import type { NextFunction, Request, Response } from "express";
import multer, { MulterError } from "multer";

import { MAX_ATTACHMENT_BYTES, payloadTooLargeError } from "../services/attachmentRules.js";
import { ApiError } from "./errors.js";

/*
 * api-spec Section 11.3.1. Bounded in-memory parsing with explicit limits.
 *
 * `memoryStorage` is what keeps "user filenames are never used as temporary
 * filesystem paths" true by construction rather than by discipline: nothing is
 * written to disk at all, so there is no path for a name to influence. The file
 * is held in a Buffer and goes straight into the `data` BYTEA column.
 *
 * Busboy's counters fail a part when they REACH their limit, not when they pass
 * it, so each bound here is one above the value it is meant to permit:
 * `fileSize` is `MAX_ATTACHMENT_BYTES + 1` so a file of exactly 5,000,000 bytes
 * parses and 5,000,001 does not, and `parts` is 2 so the one `file` part is
 * allowed through. Verified rather than assumed -- the off-by-one is the whole
 * difference between accepting and refusing a file at the exact contract
 * boundary, and `attachmentService` re-checks the exact limit regardless.
 *
 * The remaining counts are the ones the contract requires but leaves to the
 * implementation. One file, no companion fields, and a header-pair ceiling well
 * above the two or three a real part carries.
 *
 * `preservePath` keeps the client's raw filename intact so `resolveUploadName`
 * is the one place a basename is derived. Multer's own stripping uses
 * `path.basename`, which on this platform does not treat `\` as a separator, so
 * a Windows-style path would survive it -- the contract requires both.
 *
 * `defParamCharset` must be utf8. Busboy's default is latin1, which would decode
 * a UTF-8 filename into mojibake and then measure the wrong byte length against
 * the 255-byte rule.
 */
const parseSingleFile = multer({
  storage: multer.memoryStorage(),
  preservePath: true,
  defParamCharset: "utf8",
  limits: {
    fileSize: MAX_ATTACHMENT_BYTES + 1,
    files: 1,
    fields: 0,
    parts: 2,
    headerPairs: 20,
  },
}).single("file");

function invalidPart(message: string): ApiError {
  return new ApiError("VALIDATION_ERROR", [{ field: "file", message }]);
}

/*
 * Multer signals every bounded-parse refusal as a `MulterError` with a code.
 * They are translated here so a handler downstream only ever sees an `ApiError`,
 * and so an unexpected non-Multer parse failure stays an internal error instead
 * of leaking parser text.
 */
function classifyUploadError(error: unknown): ApiError {
  if (!(error instanceof MulterError)) {
    return error instanceof ApiError ? error : new ApiError("INTERNAL_SERVER_ERROR");
  }

  if (error.code === "LIMIT_FILE_SIZE") {
    return payloadTooLargeError();
  }

  /*
   * `LIMIT_UNEXPECTED_FILE` covers both a second `file` part and a file part
   * under any other name; the count and part limits cover the rest. All of them
   * are the same public outcome: the request did not carry exactly one `file`.
   */
  return invalidPart("The request must contain exactly one non-empty file part named 'file'.");
}

/*
 * A request that is not multipart at all passes straight through multer, so the
 * missing-file check below is what answers it. That is deliberate: api-spec
 * Section 11.3.1 makes a missing file part a 400, and 415 is reserved for a file
 * whose extension is not supported.
 */
export function uploadSingleFile(req: Request, res: Response, next: NextFunction): void {
  parseSingleFile(req, res, (error: unknown) => {
    if (error !== undefined && error !== null) {
      next(classifyUploadError(error));
      return;
    }

    if (req.file === undefined) {
      next(invalidPart("The request must contain exactly one non-empty file part named 'file'."));
      return;
    }

    /*
     * An empty part is refused here rather than at the database, where
     * `attachment_size_data_check` would turn it into an insert-time 500.
     */
    if (req.file.buffer.length === 0) {
      next(invalidPart("The uploaded file must not be empty."));
      return;
    }

    next();
  });
}
