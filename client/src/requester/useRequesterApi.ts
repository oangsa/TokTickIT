import { useCallback } from "react";

import { InvalidRequesterContextError, ApiRequestInit, apiFetch } from "../api.js";
import { useRequester } from "./RequesterProvider.js";

/*
 * ui-spec Section 5.4. `clearRequester()` alone completes the recovery:
 * `RequesterGuard` redirects to `/requesters` on a null context, and because
 * the guard sits above `AppShell`, clearing unmounts the whole requester
 * subtree — list, detail, draft, and Attachment state go with it. No explicit
 * navigate is needed; this is the same mechanism Change Requester already uses.
 * Unmounting only drops in-memory state, so `clearRequester` also removes the
 * requester-scoped `sessionStorage` records itself.
 */
export function useRequesterApi() {
  const { requester, clearRequester } = useRequester();

  return useCallback(
    async <T,>(path: string, init?: ApiRequestInit): Promise<T> => {
      try {
        return await apiFetch<T>(path, init, requester?.id);
      } catch (error) {
        if (error instanceof InvalidRequesterContextError) {
          clearRequester();
        }

        throw error;
      }
    },
    [requester, clearRequester],
  );
}
