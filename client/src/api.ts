export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

// ponytail: per-request timeout, not a total budget — worst case is 2x this
// across both calls. Share one AbortSignal if the total ever needs a cap.
export const API_TIMEOUT_MS = 8000;

export interface Category {
  id: number;
  name: string;
}

export interface SystemStatus {
  online: boolean;
  categories: Category[];
}

// Issue 2 + Issue 4 — call the backend.
// Steps: fetch `${API_URL}/api/health`; if not ok, throw.
//        then fetch `${API_URL}/api/categories`; if not ok, throw.
//        return { online: true, categories }.
// Throwing on failure lets the UI show a single Offline/error state.
export async function checkSystem(): Promise<SystemStatus> {
  const health = await fetch(`${API_URL}/api/health`, {
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  }).catch(() => {
    throw new Error(`Cannot reach the TokTickIT API at ${API_URL}.`);
  });
  if (!health.ok) {
    throw new Error(`Backend health check failed (HTTP ${health.status})`);
  }

  const response = await fetch(`${API_URL}/api/categories`, {
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  }).catch(() => {
    throw new Error(`Cannot reach the TokTickIT API at ${API_URL}.`);
  });
  if (!response.ok) {
    throw new Error(`Could not load categories (HTTP ${response.status})`);
  }

  const categories: Category[] = await response.json().catch(() => {
    throw new Error("Could not read the categories response.");
  });

  return { online: true, categories };
}

/*
 * A caller `signal` is merged with the per-request timeout rather than
 * replacing it, so a protected request can be cancelled while still keeping
 * its own deadline. Cancellation is best effort: an abort proves nothing about
 * whether the server committed, so callers still need an ignore flag or an
 * identity generation check before a settled Promise may touch current state.
 */
export interface ApiRequestInit extends Omit<RequestInit, "headers"> {
  headers?: Record<string, string>;
  /*
   * Reads the response itself, for the one thing the parsed body cannot carry:
   * a header. It runs only for a successful response, so error-path callers --
   * and the fetch doubles in the tests -- never need a `headers` object at all.
   */
  onResponse?: (response: Response) => void;
  /*
   * Overrides `API_TIMEOUT_MS` for the one class of request the default cannot fit:
   * an Attachment binary. The deadline covers the whole exchange, request body
   * included, so a 5,000,000-byte upload (BR-46) needs more than 5 Mbit/s of
   * sustained upstream to survive the default 8 seconds -- and an abort there
   * reads as "the upload did not complete" even though the server usually
   * committed the row. See `ATTACHMENT_TIMEOUT_MS`.
   */
  timeoutMs?: number;
}

export interface ApiErrorDetail {
  field: string;
  message: string;
}

/*
 * Carries the machine-readable parts of the centralized envelope so a form can
 * mark the fields the backend rejected. The `message` stays the generic client
 * string: backend `message` text is never surfaced to the UI (api-spec Section
 * 17), and `details[].message` is only used where the contract defines it as
 * safe field feedback.
 */
export class ApiResponseError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly details: ApiErrorDetail[];

  constructor(status: number, code: string | undefined, details: ApiErrorDetail[]) {
    super(`The request failed (HTTP ${status}).`);
    this.name = "ApiResponseError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/*
 * `AbortSignal.any` is not implemented in the jsdom the tests run under, so the
 * two signals are merged by hand and production takes the same path the tests
 * exercise. Whichever fires first wins.
 *
 * ponytail: a completed request leaves its `abort` listener on the caller's
 * signal until that signal is discarded. This is a handful of listeners, not a
 * leak worth managing for the current request lifetimes.
 * Swap in `AbortSignal.any` if the client ever drops jsdom or the count grows.
 */
export function mergeSignals(first: AbortSignal, second: AbortSignal): AbortSignal {
  const controller = new AbortController();

  for (const signal of [first, second]) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller.signal;
    }

    signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
  }

  return controller.signal;
}

/* api-spec Sections 5.2 and 5.3. Both master DTOs share the same shape. */
export interface MasterDataItem {
  id: number;
  name: string;
  isActive: boolean;
  deleted: boolean;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
}

/* api-spec Section 5.4. */
export interface Attachment {
  attachmentId: string;
  ticketPublicId: string | null;
  originalName: string;
  extension: string;
  mimeType: string;
  sizeBytes: number;
  removalReason: string | null;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  deleted: boolean;
}

/* api-spec Section 5.5. `createdAt` is the authoritative Ticket Date. */
export interface Ticket {
  publicId: string;
  ticketNumber: string;
  requesterId: number;
  requesterPublicId?: string;
  requesterName: string;
  requesterEmail: string;
  categoryId: number;
  categoryName: string;
  relatedSystemId: number;
  relatedSystemName: string;
  summary: string;
  description: string;
  requestedPriority: "LOW" | "MEDIUM" | "HIGH";
  itPriority?: "LOW" | "MEDIUM" | "HIGH";
  currentStatus: "NEW" | "OPEN" | "IN_PROGRESS" | "WAITING_FOR_REQUESTER" | "RESOLVED" | "CLOSED" | "REOPENED" | "CANCELLED";
  owner?: { publicId: string; name: string; role: "IT_STAFF" | "ADMINISTRATOR" } | null;
  requesterResolutionConfirmedAt?: string | null;
  attachments: Attachment[];
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  deleted: boolean;
}

/* api-spec Section 5.6. The bounded My Tickets projection: no Description, no
 * Requester, no Attachments, no audit or lifecycle fields. Description stays
 * searchable on the backend even though it never appears here. */
export interface TicketListItem {
  publicId: string;
  ticketNumber: string;
  categoryId: number;
  categoryName: string;
  relatedSystemId: number;
  relatedSystemName: string;
  summary: string;
  requestedPriority: "LOW" | "MEDIUM" | "HIGH";
  currentStatus: "NEW" | "OPEN" | "IN_PROGRESS" | "WAITING_FOR_REQUESTER" | "RESOLVED" | "CLOSED" | "REOPENED" | "CANCELLED";
  createdAt: string;
}

/* api-spec Section 9.13, carried in the `X-Pagination` response header. */
export interface PaginationMetadata {
  pageNumber: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

/*
 * The header is server-controlled, but it still crosses a parse boundary: a
 * proxy that drops it, or any malformed value, must leave the list rendering
 * rather than throwing inside a render path.
 */
export function readPaginationHeader(value: string | null): PaginationMetadata | null {
  if (value === null) {
    return null;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }

  const candidate = parsed as Record<string, unknown>;
  const numeric = ["pageNumber", "pageSize", "totalItems", "totalPages"] as const;

  if (numeric.some((key) => typeof candidate[key] !== "number")) {
    return null;
  }

  if (typeof candidate.hasPreviousPage !== "boolean" || typeof candidate.hasNextPage !== "boolean") {
    return null;
  }

  return candidate as unknown as PaginationMetadata;
}
