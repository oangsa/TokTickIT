import { API_URL, API_TIMEOUT_MS, ApiResponseError, mergeSignals, type ApiErrorDetail } from "../api.js";
import type { AuthTokenDTO } from "./authTypes.js";

interface ErrorEnvelope {
  code?: string;
  details?: ApiErrorDetail[];
}

export type AuthEvent =
  | { type: "ACCESS_UPDATED"; accessToken?: string; expiresIn?: number; sessionId?: string; sessionStartedAt?: number }
  | { type: "SESSION_ENDED"; sessionId?: string; sessionStartedAt?: number }
  | { type: "LOGOUT"; sessionId?: string; sessionStartedAt?: number };

interface AuthSession {
  id: string;
  startedAt: number;
}

interface RefreshOperation {
  targetSessionId: string;
  promise: Promise<string | null>;
}

let accessToken: string | null = null;
let authSession: AuthSession | null = null;
let refreshOperation: RefreshOperation | null = null;
const listeners = new Set<(event: AuthEvent) => void>();
let channel: BroadcastChannel | null = null;

function createSessionId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // Fall through to the non-persistent fallback when crypto is unavailable.
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function createSession(): AuthSession {
  return { id: createSessionId(), startedAt: Date.now() };
}

function sessionEvent<T extends "ACCESS_UPDATED" | "SESSION_ENDED" | "LOGOUT">(type: T): AuthEvent {
  return authSession === null
    ? { type }
    : { type, sessionId: authSession.id, sessionStartedAt: authSession.startedAt };
}

function isCurrentSession(sessionId: string | null): boolean {
  return sessionId !== null && authSession?.id === sessionId;
}

interface AccessUpdateWaiter {
  expectedToken: string | null;
  sessionId: string;
  timer?: ReturnType<typeof setTimeout>;
  resolve: (result: AccessUpdateWaitResult) => void;
}

interface AccessUpdateWaitResult {
  accessToken: string | null;
  timedOut: boolean;
}

const accessUpdateWaiters = new Set<AccessUpdateWaiter>();

function finishAccessUpdateWaiter(waiter: AccessUpdateWaiter, result: AccessUpdateWaitResult): void {
  if (!accessUpdateWaiters.delete(waiter)) return;
  if (waiter.timer !== undefined) clearTimeout(waiter.timer);
  waiter.resolve(result);
}

function notifyAccessUpdateWaiters(event: AuthEvent): void {
  for (const waiter of accessUpdateWaiters) {
    if (
      event.type === "ACCESS_UPDATED" &&
      event.sessionId === waiter.sessionId &&
      typeof event.accessToken === "string" &&
      event.accessToken !== waiter.expectedToken
    ) {
      finishAccessUpdateWaiter(waiter, { accessToken: event.accessToken, timedOut: false });
      continue;
    }

    if (
      (event.type === "SESSION_ENDED" || event.type === "LOGOUT") &&
      (event.sessionId === undefined || event.sessionId === waiter.sessionId || !isCurrentSession(waiter.sessionId))
    ) {
      finishAccessUpdateWaiter(waiter, { accessToken: null, timedOut: false });
      continue;
    }

    if (event.type === "ACCESS_UPDATED" && !isCurrentSession(waiter.sessionId)) {
      finishAccessUpdateWaiter(waiter, { accessToken: null, timedOut: false });
    }
  }
}

function waitForAccessUpdate(sessionId: string, expectedToken: string | null): Promise<AccessUpdateWaitResult> {
  if (isCurrentSession(sessionId) && accessToken !== null && accessToken !== expectedToken) {
    return Promise.resolve({ accessToken, timedOut: false });
  }

  return new Promise((resolve) => {
    const waiter: AccessUpdateWaiter = { expectedToken, sessionId, resolve };
    waiter.timer = setTimeout(() => finishAccessUpdateWaiter(waiter, { accessToken: null, timedOut: true }), API_TIMEOUT_MS);
    accessUpdateWaiters.add(waiter);
  });
}

function compareSessions(left: AuthSession, right: AuthSession): number {
  if (left.startedAt !== right.startedAt) return left.startedAt - right.startedAt;
  return left.id.localeCompare(right.id);
}

function remoteSession(event: AuthEvent): AuthSession | null {
  return typeof event.sessionId === "string" && event.sessionId !== ""
    ? { id: event.sessionId, startedAt: typeof event.sessionStartedAt === "number" ? event.sessionStartedAt : 0 }
    : null;
}

/*
 * ACCESS_UPDATED carries the short-lived bearer ephemerally. The session marker
 * lets a late refresh or logout from an older browser session become inert
 * instead of touching a new login. Refreshes in the same session keep the
 * marker stable.
 */
function applyRemoteEvent(event: AuthEvent): boolean {
  const remote = remoteSession(event);
  if (remote === null) {
    if (event.type === "SESSION_ENDED" || event.type === "LOGOUT") {
      accessToken = null;
      authSession = null;
    }
    notifyAccessUpdateWaiters(event);
    return true;
  }

  if (authSession !== null && authSession.id !== remote.id && compareSessions(remote, authSession) < 0) {
    return false;
  }

  const sessionChanged = authSession?.id !== remote.id;
  authSession = remote;
  if (sessionChanged) accessToken = null;
  if (event.type === "ACCESS_UPDATED" && typeof event.accessToken === "string" && event.accessToken !== "") {
    accessToken = event.accessToken;
  }
  if (event.type === "SESSION_ENDED" || event.type === "LOGOUT") accessToken = null;
  notifyAccessUpdateWaiters(event);
  return true;
}

function authChannel(): BroadcastChannel | null {
  if (channel !== null) return channel;
  if (typeof BroadcastChannel === "undefined") return null;
  try {
    const created = new BroadcastChannel("toktickit-auth");
    const handleMessage = (event: MessageEvent<AuthEvent>) => {
      const data = event.data;
      if (!data || typeof data.type !== "string") return;
      if (!applyRemoteEvent(data)) return;
      listeners.forEach((listener) => listener(data));
    };
    if (typeof created.addEventListener === "function") {
      created.addEventListener("message", handleMessage);
    } else {
      created.onmessage = handleMessage;
    }
    channel = created;
    return channel;
  } catch {
    channel = null;
    return null;
  }
}

function publish(event: AuthEvent, notifyLocal = true): void {
  try {
    authChannel()?.postMessage(event);
  } catch {
    // A closed or unavailable channel must not break authentication.
  }
  notifyAccessUpdateWaiters(event);
  if (notifyLocal) listeners.forEach((listener) => listener(event));
}

export function subscribeAuthEvents(listener: (event: AuthEvent) => void): () => void {
  listeners.add(listener);
  authChannel();
  return () => listeners.delete(listener);
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getAuthSessionId(): string | null {
  return authSession?.id ?? null;
}

export function beginAuthSession(): void {
  accessToken = null;
  authSession = createSession();
}

export function setAccessToken(token: string, expiresIn?: number, broadcast = true): void {
  authSession ??= createSession();
  accessToken = token;
  if (broadcast) {
    publish({
      type: "ACCESS_UPDATED",
      accessToken: token,
      expiresIn,
      sessionId: authSession.id,
      sessionStartedAt: authSession.startedAt,
    }, false);
  }
}

export function clearAccessToken(broadcast = true): void {
  const event = sessionEvent("SESSION_ENDED");
  accessToken = null;
  authSession = null;
  if (broadcast) publish(event);
}

async function readEnvelope(response: Response): Promise<ErrorEnvelope | null> {
  return (await response.json().catch(() => null)) as ErrorEnvelope | null;
}

function errorFromResponse(response: Response, envelope: ErrorEnvelope | null): ApiResponseError {
  return new ApiResponseError(response.status, envelope?.code, Array.isArray(envelope?.details) ? envelope.details : []);
}

export function isInvalidSessionError(error: unknown): boolean {
  return error instanceof ApiResponseError && error.status === 401 &&
    (error.code === "SESSION_INVALID" || error.code === "UNAUTHENTICATED");
}

function authSignal(signal?: AbortSignal | null): AbortSignal {
  const timeout = AbortSignal.timeout(API_TIMEOUT_MS);
  return signal ? mergeSignals(timeout, signal) : timeout;
}

async function refreshRequest(): Promise<{ accessToken: string; expiresIn?: number }> {
  const response = await fetch(`${API_URL}/api/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json" },
    signal: authSignal(),
  }).catch(() => {
    throw new Error(`Cannot reach the TokTickIT API at ${API_URL}.`);
  });
  if (!response.ok) {
    const envelope = await readEnvelope(response);
    throw errorFromResponse(response, envelope);
  }
  const token = (await response.json().catch(() => null)) as Partial<AuthTokenDTO> | null;
  if (!token || typeof token.accessToken !== "string") {
    throw new Error("The authentication response is invalid.");
  }
  return {
    accessToken: token.accessToken,
    expiresIn: typeof token.expiresIn === "number" ? token.expiresIn : undefined,
  };
}

export async function refreshAccessToken(expectedToken?: string | null, expectedSessionId?: string | null): Promise<string | null> {
  if (refreshOperation !== null) {
    const existing = refreshOperation;
    const existingResult = await existing.promise.catch(() => null);

    if (expectedSessionId !== undefined && !isCurrentSession(expectedSessionId)) return null;
    if (authSession !== null && authSession.id !== existing.targetSessionId) {
      return refreshAccessToken(expectedToken, expectedSessionId);
    }
    if (expectedToken !== undefined && accessToken !== expectedToken) {
      return isCurrentSession(existing.targetSessionId) ? accessToken : null;
    }
    return existingResult;
  }

  if (expectedSessionId !== undefined && !isCurrentSession(expectedSessionId)) return null;
  if (authSession === null) authSession = createSession();
  const targetSessionId = authSession.id;
  if (expectedToken !== undefined && accessToken !== expectedToken) {
    return isCurrentSession(targetSessionId) ? accessToken : null;
  }

  const refresh = async (): Promise<string | null> => {
    const lockManager = typeof navigator !== "undefined" ? navigator.locks : undefined;
    // Each tab keeps its bearer in memory. The lock serializes refresh-cookie
    // rotation, while BroadcastChannel carries the short-lived bearer only
    // ephemerally so another tab can reuse the refresh result without rotating again.
    const runRefresh = async (): Promise<string | null> => {
      if (!isCurrentSession(targetSessionId)) return null;
      if (expectedToken !== undefined && accessToken !== expectedToken) {
        return isCurrentSession(targetSessionId) ? accessToken : null;
      }

      const tokenAtStart = accessToken;
      try {
        const result = await refreshRequest();
        if (!isCurrentSession(targetSessionId)) return null;
        if (accessToken !== tokenAtStart) return accessToken;
        setAccessToken(result.accessToken, result.expiresIn);
        return result.accessToken;
      } catch (error) {
        /* A late failure must not clear a session that replaced this request. */
        if (!isCurrentSession(targetSessionId)) return null;
        if (accessToken !== tokenAtStart) return accessToken;
        if (isInvalidSessionError(error)) clearAccessToken();
        throw error;
      }
    };

    const acquireRefreshLock = async (): Promise<string | null> => {
      if (!lockManager?.request) return runRefresh();

      return lockManager.request("toktickit-auth-refresh", { ifAvailable: true }, async (lock) => {
        if (lock !== null) return runRefresh();

        const waited = await waitForAccessUpdate(targetSessionId, expectedToken ?? accessToken);
        if (waited.accessToken !== null) return waited.accessToken;
        if (!waited.timedOut || !isCurrentSession(targetSessionId)) return null;
        return acquireRefreshLock();
      });
    }

    return acquireRefreshLock();
  };

  const promise = refresh().finally(() => {
    if (refreshOperation?.promise === promise) refreshOperation = null;
  });
  refreshOperation = { targetSessionId, promise };
  return promise;
}

export async function publicAuthRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  const response = await fetch(`${API_URL}${path}`, { ...init, credentials: "include", headers, signal: authSignal(init.signal) }).catch(() => {
    throw new Error(`Cannot reach the TokTickIT API at ${API_URL}.`);
  });
  if (!response.ok) {
    throw errorFromResponse(response, await readEnvelope(response));
  }
  if (response.status === 204) return undefined as T;
  return (await response.json().catch(() => { throw new Error("Could not read the API response."); })) as T;
}

async function requestWithToken(path: string, init: RequestInit, token: string | null): Promise<Response> {
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  else headers.delete("Authorization");
  headers.set("Accept", "application/json");
  return fetch(`${API_URL}${path}`, { ...init, credentials: "include", headers, signal: authSignal(init.signal) }).catch(() => {
    throw new Error(`Cannot reach the TokTickIT API at ${API_URL}.`);
  });
}

export async function authenticatedRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const originalToken = accessToken;
  const originalSessionId = getAuthSessionId();
  let retriedAfterRefresh = false;
  let retryToken: string | null = null;
  let response = await requestWithToken(path, init, originalToken);
  let envelope = response.ok ? null : await readEnvelope(response);

  if (!response.ok && response.status === 401 && envelope?.code === "ACCESS_TOKEN_EXPIRED") {
    retriedAfterRefresh = true;
    const refreshed = originalSessionId === null
      ? await refreshAccessToken(originalToken)
      : await refreshAccessToken(originalToken, originalSessionId);
    if (refreshed === null) throw errorFromResponse(response, envelope);
    retryToken = refreshed;
    response = await requestWithToken(path, init, refreshed);
    envelope = response.ok ? null : await readEnvelope(response);
  }

  if (!response.ok) {
    if (response.status === 401 && (retriedAfterRefresh || envelope?.code === "SESSION_INVALID" || envelope?.code === "UNAUTHENTICATED")) {
      const failedToken = retriedAfterRefresh ? retryToken : originalToken;
      if (isCurrentSession(originalSessionId) && (failedToken === null || accessToken === failedToken)) clearAccessToken();
    }
    throw errorFromResponse(response, envelope);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json().catch(() => { throw new Error("Could not read the API response."); })) as T;
}

export function broadcastLogout(): void {
  const event = sessionEvent("LOGOUT");
  clearAccessToken(false);
  publish(event);
}
