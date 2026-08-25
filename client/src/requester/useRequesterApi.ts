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
 *
 * Every request also carries the current Requester context's abort signal, so a
 * Requester change cancels the in-flight work it owns. That is best effort: the
 * server may already have committed, and the Promise may still settle, so a
 * caller whose completion has side effects must additionally check its captured
 * token with `isRequesterContextCurrent` before applying them.
 */
export function useRequesterApi() {
  const { requester, clearRequester, captureRequesterContext } = useRequester();

  return useCallback(
    async <T,>(path: string, init?: ApiRequestInit): Promise<T> => {
      try {
        return await apiFetch<T>(
          path,
          { ...init, signal: init?.signal ?? captureRequesterContext().signal },
          requester?.id,
        );
      } catch (error) {
        if (error instanceof InvalidRequesterContextError) {
          clearRequester();
        }

        throw error;
      }
    },
    [requester, clearRequester, captureRequesterContext],
  );
}
