import { createHash } from "node:crypto";

import { ApiError, ErrorDetail } from "../http/errors.js";

export const REQUESTED_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

export type RequestedPriority = (typeof REQUESTED_PRIORITIES)[number];

export const MAX_ATTACHMENTS = 5;

/*
 * Accepts any case so the value can be canonicalized to lowercase afterwards
 * (BR-21). `transport.ts` has its own copy for `X-Request-Id`; they are not
 * shared because that one guards a header and this one guards a body field, and
 * merging them would couple two unrelated contracts.
 */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface CreateTicketPayload {
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  requestedPriority: RequestedPriority;
  description: string;
  attachmentIds: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPositiveInteger(
  value: unknown,
  field: string,
  details: ErrorDetail[],
): number | undefined {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    details.push({ field, message: `${field} must be a positive integer.` });
    return undefined;
  }

  return value;
}

function readTrimmedText(
  value: unknown,
  field: string,
  min: number,
  max: number,
  details: ErrorDetail[],
): string | undefined {
  if (typeof value !== "string") {
    details.push({ field, message: `${field} must contain ${min}-${max} characters.` });
    return undefined;
  }

  /* Trim first: length is measured on the stored value, not the raw input. */
  const trimmed = value.trim();

  /*
   * Counted in code points, not UTF-16 code units, because the database CHECK
   * is `char_length(...)` and `VARCHAR(n)` is also counted in characters. A
   * `.length` here disagrees with both on any astral character: "\u{1F600}a" is
   * 3 code units but 2 characters, so the app would accept a Summary the CHECK
   * then rejects -- an insert-time 500 instead of a safe 400 -- and a 150-
   * character Summary of emoji would be refused even though the column holds it.
   */
  const length = [...trimmed].length;

  if (length < min || length > max) {
    details.push({ field, message: `${field} must contain ${min}-${max} characters.` });
    return undefined;
  }

  return trimmed;
}

/*
 * BR-21 / api-spec Section 8.2. The field is an optional array: omitted and `[]`
 * both mean no initial Attachments, and an explicit `null` is a type error like
 * any other non-array, not a third spelling of "none" -- accepting it would let
 * a client that serializes an absent list as `null` pass a shape the contract
 * does not define. Duplicates are rejected after lowercase normalization rather
 * than silently deduplicated, so `[A, A]` is a 400 and never a one-item set.
 * The survivors are sorted by their canonical lowercase string -- not by binary
 * UUID value and not by submission order -- so `[A,B]` and `[B,A]` hash equally.
 */
function readAttachmentIds(value: unknown, details: ErrorDetail[]): string[] | undefined {
  const field = "attachmentIds";

  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    details.push({ field, message: "attachmentIds must be an array of Attachment IDs." });
    return undefined;
  }

  if (value.length > MAX_ATTACHMENTS) {
    details.push({
      field,
      message: `attachmentIds must contain at most ${MAX_ATTACHMENTS} Attachment IDs.`,
    });
    return undefined;
  }

  const canonical: string[] = [];

  for (const entry of value) {
    if (typeof entry !== "string" || !UUID_PATTERN.test(entry)) {
      details.push({ field, message: "Each Attachment ID must be a valid UUID." });
      return undefined;
    }

    canonical.push(entry.toLowerCase());
  }

  if (new Set(canonical).size !== canonical.length) {
    details.push({ field, message: "Attachment IDs must not repeat." });
    return undefined;
  }

  return canonical.sort();
}

/*
 * api-spec Section 8.2. The canonical form is built by writing the properties
 * out in a fixed order, so it does not depend on the key order of the incoming
 * JSON. `JSON.stringify` on an object literal preserves insertion order for
 * string keys, which is what makes this stable.
 *
 * Result: exactly 64 lowercase hexadecimal characters.
 */
export function hashCreateTicketPayload(payload: CreateTicketPayload): string {
  const canonical = JSON.stringify({
    attachmentIds: payload.attachmentIds,
    categoryId: payload.categoryId,
    description: payload.description,
    relatedSystemId: payload.relatedSystemId,
    requestedPriority: payload.requestedPriority,
    summary: payload.summary,
  });

  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/*
 * api-spec Sections 7.3 and 8.2.1 steps 1-4: everything needed to canonicalize
 * and hash, and nothing that reads mutable state. Category and Related System
 * existence/activeness is deliberately NOT checked here -- that is the final
 * mutable validation, and it may only run inside the fenced claim transaction.
 *
 * Every field is collected before throwing so one response reports every
 * invalid field, which is what the UI needs to mark them all at once.
 */
export function parseCreateTicketRequest(body: unknown): {
  payload: CreateTicketPayload;
  requestHash: string;
} {
  const details: ErrorDetail[] = [];

  if (!isRecord(body)) {
    throw new ApiError("VALIDATION_ERROR", [
      { field: "body", message: "The request body must be a JSON object." },
    ]);
  }

  const categoryId = readPositiveInteger(body.categoryId, "categoryId", details);
  const relatedSystemId = readPositiveInteger(body.relatedSystemId, "relatedSystemId", details);
  const summary = readTrimmedText(body.summary, "summary", 3, 150, details);
  const description = readTrimmedText(body.description, "description", 10, 2000, details);
  const attachmentIds = readAttachmentIds(body.attachmentIds, details);

  const priority = body.requestedPriority;
  const requestedPriority = REQUESTED_PRIORITIES.includes(priority as RequestedPriority)
    ? (priority as RequestedPriority)
    : undefined;

  if (requestedPriority === undefined) {
    /* No default is applied: a missing Priority is an error, not MEDIUM. */
    details.push({
      field: "requestedPriority",
      message: `requestedPriority must be one of ${REQUESTED_PRIORITIES.join(", ")}.`,
    });
  }

  if (
    details.length > 0 ||
    categoryId === undefined ||
    relatedSystemId === undefined ||
    summary === undefined ||
    description === undefined ||
    attachmentIds === undefined ||
    requestedPriority === undefined
  ) {
    throw new ApiError("VALIDATION_ERROR", details);
  }

  const payload: CreateTicketPayload = {
    categoryId,
    relatedSystemId,
    summary,
    requestedPriority,
    description,
    attachmentIds,
  };

  return { payload, requestHash: hashCreateTicketPayload(payload) };
}

/* BR-18. The Idempotency-Key header must be a valid UUID; case is normalized. */
export function parseIdempotencyKey(header: string | undefined): string {
  if (header === undefined || !UUID_PATTERN.test(header.trim())) {
    throw new ApiError("VALIDATION_ERROR", [
      { field: "Idempotency-Key", message: "Idempotency-Key must be a valid UUID." },
    ]);
  }

  return header.trim().toLowerCase();
}
