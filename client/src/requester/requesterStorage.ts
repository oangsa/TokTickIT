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

  if (typeof candidate.id !== "number" || !Number.isInteger(candidate.id) || candidate.id <= 0) {
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

  return raw === null ? null : parseRequester(raw);
}

export function writeRequesterContext(requester: StoredRequester): void {
  sessionStorage.setItem(REQUESTER_STORAGE_KEY, JSON.stringify(requester));
}

export function clearRequesterContext(): void {
  sessionStorage.removeItem(REQUESTER_STORAGE_KEY);
}
