import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from "react";

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

  const clearRequester = useCallback(() => {
    clearRequesterContext();
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
