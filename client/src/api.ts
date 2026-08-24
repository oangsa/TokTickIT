const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

// ponytail: per-request timeout, not a total budget — worst case is 2x this
// across both calls. Share one AbortSignal if the total ever needs a cap.
const TIMEOUT_MS = 8000;

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
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch(() => {
    throw new Error(`Cannot reach the TokTickIT API at ${API_URL}.`);
  });
  if (!health.ok) {
    throw new Error(`Backend health check failed (HTTP ${health.status})`);
  }

  const response = await fetch(`${API_URL}/api/categories`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
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

/* api-spec Section 5.1. Every field is synthetic development/test data. */
export interface DevelopmentRequester {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
  deleted: boolean;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
}

/*
 * Thrown only for the defined context-invalidating 400 (api-spec Section 3.1):
 * an error envelope carrying `code: "REQUESTER_CONTEXT_INVALID"`. An ordinary
 * BAD_REQUEST/VALIDATION_ERROR must never produce this, or submitting a bad
 * form would wipe the session.
 */
export class InvalidRequesterContextError extends Error {
  constructor() {
    super("The stored Development Requester is no longer valid.");
    this.name = "InvalidRequesterContextError";
  }
}

/*
 * `signal` is deliberately not accepted: `apiFetch` installs its own timeout
 * signal and a caller's would be silently overwritten by it. Cancel-on-unmount
 * is done with the `ignore` flag pattern in the effect instead (see
 * `RequesterSelection`), which is what keeps a stale response from painting
 * over a newer one. If a real abort is ever needed, merge the two signals here
 * rather than re-widening this type.
 */
export interface ApiRequestInit extends Omit<RequestInit, "headers" | "signal"> {
  headers?: Record<string, string>;
}

interface ErrorEnvelope {
  code?: string;
}

export async function apiFetch<T>(
  path: string,
  init?: ApiRequestInit,
  requesterId?: number,
): Promise<T> {
  const headers: Record<string, string> = { ...init?.headers };

  if (requesterId !== undefined) {
    headers["X-Requester-Id"] = String(requesterId);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch(() => {
    throw new Error(`Cannot reach the TokTickIT API at ${API_URL}.`);
  });

  if (!response.ok) {
    const envelope: ErrorEnvelope | null = await response.json().catch(() => null);

    if (envelope?.code === "REQUESTER_CONTEXT_INVALID") {
      throw new InvalidRequesterContextError();
    }

    /* Backend `message` text is never surfaced to the UI. */
    throw new Error(`The request failed (HTTP ${response.status}).`);
  }

  return (await response.json().catch(() => {
    throw new Error("Could not read the API response.");
  })) as T;
}

/* The one Lab 2 endpoint that must not send X-Requester-Id (api-spec Section 3.1). */
export function fetchRequesters(): Promise<DevelopmentRequester[]> {
  return apiFetch<DevelopmentRequester[]>("/api/requesters");
}
