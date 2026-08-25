/*
 * Create Ticket draft, canonical payload, and ambiguous-submission recovery
 * (ui-spec Sections 11.5, 12.1, 12.2; BR-21, BR-24).
 */

export type RequestedPriority = "LOW" | "MEDIUM" | "HIGH";

export interface CreateTicketDraft {
  categoryId: string;
  relatedSystemId: string;
  summary: string;
  requestedPriority: string;
  description: string;
  /* The seam Issue #24 writes: the final prepared Pending Attachment IDs. */
  attachmentIds: string[];
}

export const EMPTY_DRAFT: CreateTicketDraft = {
  categoryId: "",
  relatedSystemId: "",
  summary: "",
  requestedPriority: "",
  description: "",
  attachmentIds: [],
};

export interface CreateTicketPayload {
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  requestedPriority: RequestedPriority;
  description: string;
  attachmentIds: string[];
}

/*
 * BR-21. Mirrors the server's canonicalization -- trimmed text, typed IDs,
 * lowercase Attachment IDs sorted lexicographically -- so `[A,B]` and `[B,A]`
 * produce the same signature and therefore reuse the same Idempotency Key.
 * This is a key-reuse decision only; the authoritative hash is the server's.
 */
export function toPayload(draft: CreateTicketDraft): CreateTicketPayload {
  return {
    categoryId: Number(draft.categoryId),
    relatedSystemId: Number(draft.relatedSystemId),
    summary: draft.summary.trim(),
    requestedPriority: draft.requestedPriority as RequestedPriority,
    description: draft.description.trim(),
    attachmentIds: [...draft.attachmentIds].map((id) => id.toLowerCase()).sort(),
  };
}

/*
 * Normalizes `attachmentIds` itself rather than trusting the caller to have run
 * `toPayload` first. A restored recovery record or an Issue #24 caller that
 * hands over an unsorted set must still produce the same signature, or a
 * reordered but logically identical retry would mint a new Idempotency Key.
 */
export function payloadSignature(payload: CreateTicketPayload): string {
  return JSON.stringify({
    attachmentIds: [...payload.attachmentIds].map((id) => id.toLowerCase()).sort(),
    categoryId: payload.categoryId,
    description: payload.description,
    relatedSystemId: payload.relatedSystemId,
    requestedPriority: payload.requestedPriority,
    summary: payload.summary,
  });
}

export function isDirty(draft: CreateTicketDraft): boolean {
  return payloadSignature(toPayload(draft)) !== payloadSignature(toPayload(EMPTY_DRAFT));
}

/* ui-spec Section 12.2 and api-spec Section 8.7: never reuse a key at 24 hours. */
export const RECOVERY_DEADLINE_MS = 24 * 60 * 60 * 1000;

export const RECOVERY_STORAGE_KEY = "toktickit.createTicketRecovery";

export interface RecoveryRecord {
  /* Requester-scoped: a record from another Requester is never resumed. */
  requesterId: number;
  idempotencyKey: string;
  /* Epoch milliseconds of initial client key creation, not of the failure. */
  keyCreatedAt: number;
  payload: CreateTicketPayload;
}

function isPayload(value: unknown): value is CreateTicketPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.categoryId === "number" &&
    typeof candidate.relatedSystemId === "number" &&
    typeof candidate.summary === "string" &&
    typeof candidate.description === "string" &&
    (candidate.requestedPriority === "LOW" ||
      candidate.requestedPriority === "MEDIUM" ||
      candidate.requestedPriority === "HIGH") &&
    Array.isArray(candidate.attachmentIds) &&
    candidate.attachmentIds.every((id) => typeof id === "string")
  );
}

/*
 * Only the approved fields are persisted: the Requester, the key and its
 * creation time, and the normalized original payload including its normalized
 * `attachmentIds`. No file content and no response data.
 *
 * Every storage call is guarded the same way `requesterStorage` guards its own:
 * `sessionStorage` throws outright in a browser configured to block site data.
 */
export function writeRecovery(record: RecoveryRecord): void {
  try {
    sessionStorage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify(record));
  } catch {
    /* Persisting is best effort; the in-memory attempt still holds. */
  }
}

export function clearRecovery(): void {
  try {
    sessionStorage.removeItem(RECOVERY_STORAGE_KEY);
  } catch {
    /* Nothing to clear if storage is unreachable. */
  }
}

/*
 * Returns a resumable record only. A record belonging to another Requester, or
 * one whose key has reached the 24-hour deadline, is discarded rather than
 * offered: reusing it would either leak across Requesters or reuse an expired
 * key. The caller still needs an explicit user action to submit it.
 */
export function readRecovery(requesterId: number, now: number): RecoveryRecord | null {
  let raw: string | null;

  try {
    raw = sessionStorage.getItem(RECOVERY_STORAGE_KEY);
  } catch {
    return null;
  }

  if (raw === null) {
    return null;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    clearRecovery();
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) {
    clearRecovery();
    return null;
  }

  const candidate = parsed as Record<string, unknown>;

  if (
    typeof candidate.idempotencyKey !== "string" ||
    typeof candidate.keyCreatedAt !== "number" ||
    typeof candidate.requesterId !== "number" ||
    !isPayload(candidate.payload)
  ) {
    clearRecovery();
    return null;
  }

  if (candidate.requesterId !== requesterId) {
    clearRecovery();
    return null;
  }

  if (now - candidate.keyCreatedAt >= RECOVERY_DEADLINE_MS) {
    clearRecovery();
    return null;
  }

  return candidate as unknown as RecoveryRecord;
}
