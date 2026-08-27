import { useCallback } from "react";

import {
  InvalidRequesterContextError,
  ApiRequestInit,
  apiFetch,
  apiFetchBlob,
  mergeSignals,
} from "../api.js";
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
 * Every request belongs to the Requester context that started it, so the token
 * is captured here rather than by each caller. It does two jobs:
 *
 * - its signal cancels the request when the Requester changes. A caller signal
 *   is merged with it, never substituted for it, so caller cancellation,
 *   Requester change, and the `apiFetch` timeout can all abort the request.
 * - its generation decides whether the recovery above may still run. A
 *   `REQUESTER_CONTEXT_INVALID` answer describes the Requester that sent the
 *   request; once another Requester is active that verdict is about someone
 *   else, and clearing on it would sign the current Requester out. Cancellation
 *   cannot cover this: the request may already have reached the server and the
 *   Promise settles anyway, so the generation is the correctness boundary.
 *
 * A caller whose own completion has side effects still checks its own captured
 * token with `isRequesterContextCurrent` before applying them.
 */
function useGuardedRequest() {
  const { requester, clearRequester, captureRequesterContext, isRequesterContextCurrent } =
    useRequester();

  return useCallback(
    async <T,>(
      send: (requesterId: number | undefined, signal: AbortSignal) => Promise<T>,
      callerSignal?: AbortSignal | null,
    ): Promise<T> => {
      const token = captureRequesterContext();

      try {
        return await send(
          requester?.id,
          callerSignal ? mergeSignals(token.signal, callerSignal) : token.signal,
        );
      } catch (error) {
        if (error instanceof InvalidRequesterContextError && isRequesterContextCurrent(token)) {
          clearRequester();
        }

        throw error;
      }
    },
    [requester, clearRequester, captureRequesterContext, isRequesterContextCurrent],
  );
}

export function useRequesterApi() {
  const guarded = useGuardedRequest();

  return useCallback(
    <T,>(path: string, init?: ApiRequestInit): Promise<T> =>
      guarded<T>(
        (requesterId, signal) => apiFetch<T>(path, { ...init, signal }, requesterId),
        init?.signal,
      ),
    [guarded],
  );
}

/*
 * The Attachment binary sibling (ui-spec Section 24). Preview and Download must
 * never navigate straight to the requester-scoped URL, because an `<img>`, an
 * `<iframe>`, or a plain link cannot attach `X-Requester-Id`. They come through
 * here instead, and inherit the same cancellation and context-invalidation rules
 * as every JSON request.
 */
export function useRequesterBlob() {
  const guarded = useGuardedRequest();

  return useCallback(
    (path: string, init?: ApiRequestInit): Promise<Blob> =>
      guarded<Blob>(
        (requesterId, signal) => apiFetchBlob(path, { ...init, signal }, requesterId),
        init?.signal,
      ),
    [guarded],
  );
}
