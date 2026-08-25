import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from "react";

import { clearRecovery } from "../tickets/createTicketDraft.js";
import {
  StoredRequester,
  clearRequesterContext,
  readRequesterContext,
  writeRequesterContext,
} from "./requesterStorage.js";

interface RequesterContextValue {
  requester: StoredRequester | null;
  selectRequester: (requester: StoredRequester) => void;
  clearRequester: () => void;
}

const RequesterContext = createContext<RequesterContextValue | null>(null);

export function RequesterProvider({ children }: { children: ReactNode }) {
  const [requester, setRequester] = useState<StoredRequester | null>(readRequesterContext);

  const selectRequester = useCallback((selected: StoredRequester) => {
    writeRequesterContext(selected);
    setRequester(selected);
  }, []);

  /*
   * ui-spec Section 12.2 lists "Requester change" among the events that clear
   * the ambiguous-submission recovery record, and this is the one choke point
   * every change goes through: Change Requester in the shell, and the
   * context-invalidating 400. Unmounting the requester subtree drops in-memory
   * state but not `sessionStorage`, so the record is removed here rather than
   * left for the next Create Ticket mount to notice.
   */
  const clearRequester = useCallback(() => {
    clearRequesterContext();
    clearRecovery();
    setRequester(null);
  }, []);

  const value = useMemo(
    () => ({ requester, selectRequester, clearRequester }),
    [requester, selectRequester, clearRequester]
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
