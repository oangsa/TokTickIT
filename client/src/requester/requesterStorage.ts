/*
 * Lab 2 requester context (ui-spec Section 5.4).
 *
 * The selected Development Requester is a temporary testing mechanism stored in
 * `sessionStorage`. It is not authentication and carries no credentials.
 */

export interface StoredRequester {
  id: number;
  name: string;
}

export const REQUESTER_STORAGE_KEY = "toktickit.requester";

/*
 * Only `id` and `name` are validated: `id` is what Issue 20 sends as
 * `X-Requester-Id` and `name` is what the shell displays. Unknown keys survive
 * the round trip so a later Issue can widen the stored shape without changing
 * this module.
 */
function parseRequester(raw: string): StoredRequester | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }

  const candidate = parsed as Record<string, unknown>;

  if (typeof candidate.id !== "number" || !Number.isSafeInteger(candidate.id) || candidate.id <= 0) {
    return null;
  }

  if (typeof candidate.name !== "string" || candidate.name.trim() === "") {
    return null;
  }

  return candidate as unknown as StoredRequester;
}

export function readRequesterContext(): StoredRequester | null {
  let raw: string | null;

  try {
    raw = sessionStorage.getItem(REQUESTER_STORAGE_KEY);
  } catch {
    return null;
  }

  if (raw === null) {
    return null;
  }

  const requester = parseRequester(raw);

  if (requester === null) {
    clearRequesterContext();
  }

  return requester;
}

/*
 * Storage access is guarded on every path, not only on read: `setItem` throws in
 * the same situations `getItem` does (private-mode quota, blocked site data),
 * and this one is called from a click handler where the throw would escape.
 * The in-memory context still holds for the session; only persistence is lost.
 */
export function writeRequesterContext(requester: StoredRequester): void {
  try {
    sessionStorage.setItem(REQUESTER_STORAGE_KEY, JSON.stringify(requester));
  } catch {
    /* Persisting is best effort. */
  }
}

export function clearRequesterContext(): void {
  try {
    sessionStorage.removeItem(REQUESTER_STORAGE_KEY);
  } catch {
    /* Nothing to clear if storage is unreachable. */
  }
}
