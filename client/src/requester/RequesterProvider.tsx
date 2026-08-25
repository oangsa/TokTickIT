import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from "react";

import { clearRecovery } from "../tickets/createTicketDraft.js";
import {
  StoredRequester,
  clearRequesterContext,
  readRequesterContext,
  writeRequesterContext,
} from "./requesterStorage.js";

/*
 * A handle on the Requester context that started a piece of requester-scoped
 * work. Runtime state only: it is never written to `sessionStorage`, because a
 * token restored after a reload would claim to be current for a context that
 * no longer exists.
 */
export interface RequesterContextToken {
  generation: number;
  signal: AbortSignal;
}

interface RequesterContextValue {
  requester: StoredRequester | null;
  selectRequester: (requester: StoredRequester) => void;
  clearRequester: () => void;
  captureRequesterContext: () => RequesterContextToken;
  isRequesterContextCurrent: (token: RequesterContextToken) => boolean;
}

const RequesterContext = createContext<RequesterContextValue | null>(null);

export function RequesterProvider({ children }: { children: ReactNode }) {
  const [requester, setRequester] = useState<StoredRequester | null>(readRequesterContext);

  /*
   * Requester-scoped async work outlives the context that started it: a POST
   * begun under Requester A can settle after B has been selected, and its
   * completion would otherwise navigate B away, clear B's recovery record, or
   * write A's over it. Every screen that starts such work captures the
   * generation first and checks it before applying any completion-side effect.
   *
   * A ref, not state: the check has to read the value at completion time, and a
   * stale callback would close over the value from the render that started it.
   */
  const generationRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const captureRequesterContext = useCallback((): RequesterContextToken => {
    abortRef.current ??= new AbortController();

    return { generation: generationRef.current, signal: abortRef.current.signal };
  }, []);

  const isRequesterContextCurrent = useCallback(
    (token: RequesterContextToken): boolean => token.generation === generationRef.current,
    [],
  );

  /*
   * The abort is best effort only. It cannot prove the server did not already
   * commit the request, and a Promise may still settle afterwards, so the
   * generation -- not the AbortController -- is what makes a stale completion
   * inert. Cancelling merely stops the browser waiting for a result nothing
   * will be allowed to use.
   */
  const invalidateRequesterContext = useCallback((): void => {
    generationRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const selectRequester = useCallback(
    (selected: StoredRequester) => {
      invalidateRequesterContext();
      writeRequesterContext(selected);
      setRequester(selected);
    },
    [invalidateRequesterContext],
  );

  /*
   * ui-spec Section 12.2 lists "Requester change" among the events that clear
   * the ambiguous-submission recovery record, and this is the one choke point
   * every change goes through: Change Requester in the shell, and the
   * context-invalidating 400. Unmounting the requester subtree drops in-memory
   * state but not `sessionStorage`, so the record is removed here rather than
   * left for the next Create Ticket mount to notice.
   */
  const clearRequester = useCallback(() => {
    invalidateRequesterContext();
    clearRequesterContext();
    clearRecovery();
    setRequester(null);
  }, [invalidateRequesterContext]);

  const value = useMemo(
    () => ({
      requester,
      selectRequester,
      clearRequester,
      captureRequesterContext,
      isRequesterContextCurrent,
    }),
    [
      requester,
      selectRequester,
      clearRequester,
      captureRequesterContext,
      isRequesterContextCurrent,
    ],
  );

  return <RequesterContext.Provider value={value}>{children}</RequesterContext.Provider>;
}

export function useRequester(): RequesterContextValue {
  const value = useContext(RequesterContext);

  if (value === null) {
    throw new Error("useRequester must be used inside a RequesterProvider.");
  }

  return value;
}
