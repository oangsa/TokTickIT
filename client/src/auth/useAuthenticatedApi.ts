import { useCallback } from "react";

import type { AuthenticatedRequestInit } from "./authTransport.js";
import { useAuth } from "./AuthProvider.js";

export function useAuthenticatedApi() {
  const { request } = useAuth();

  return useCallback(
    <T,>(path: string, init?: AuthenticatedRequestInit): Promise<T> => request<T>(path, init),
    [request],
  );
}

export function useAuthenticatedBlob() {
  const { requestBlob } = useAuth();

  return useCallback(
    (path: string, init?: AuthenticatedRequestInit): Promise<Blob> =>
      requestBlob(path, init),
    [requestBlob],
  );
}
