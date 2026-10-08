import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../auth/AuthProvider.js";
import { useAuthenticatedApi } from "../../auth/useAuthenticatedApi.js";

interface Success<T> { data: T; updatedAt: number }
interface DashboardState<T> { scope: string; data?: T; updatedAt?: number; loading: boolean; error: boolean }
// Dashboard data stays in application memory only. Shared flight also covers remounts and scope transitions.
const cache = new Map<string, Success<unknown>>();
let inFlight: { scope: string; obsolete: boolean; promise: Promise<Success<unknown>> } | undefined;
const REFRESH_MS = 30_000;
export function useDashboard<T>(path: string, urlScope: string) {
  const { user } = useAuth();
  const callApi = useAuthenticatedApi();
  const scope = JSON.stringify([user?.publicId, user?.role, urlScope, path]);
  const cached = cache.get(scope) as Success<T> | undefined;
  const initial = (): DashboardState<T> => ({ scope, ...cached, loading: !cached || Date.now() - cached.updatedAt > REFRESH_MS, error: false });
  const [state, setState] = useState<DashboardState<T>>(initial);
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const refreshRef = useRef<() => void>();
  useEffect(() => {
    // A context change permanently retires the flight, even if that scope returns.
    // Same-scope remounts can still share a flight that has not been abandoned.
    if (inFlight && inFlight.scope !== scope) inFlight.obsolete = true;
    let active = true;
    let pending = false;
    const accepts = () => active && currentScope.current === scope;
    async function load() {
      if (pending || !accepts() || (inFlight && (inFlight.scope !== scope || inFlight.obsolete))) return;
      pending = true;
      setState((previous) => ({ ...(previous.scope === scope ? previous : { scope, ...cache.get(scope) as Success<T> | undefined }), loading: true, error: previous.scope === scope && !!previous.data && previous.error }));
      if (!inFlight) {
        const promise = (async () => ({ data: await callApi<T>(path, { cache: "no-store" }), updatedAt: Date.now() }))();
        const flight = { scope, obsolete: false, promise };
        inFlight = flight;
        const clear = () => { if (inFlight === flight) inFlight = undefined; };
        void promise.then(clear, clear);
      }
      try {
        const success = await inFlight.promise as Success<T>;
        if (accepts()) {
          cache.set(scope, success);
          setState({ scope, ...success, loading: false, error: false });
        }
      } catch {
        if (accepts()) setState((previous) => ({ ...previous, loading: false, error: true }));
      } finally { pending = false; }
    }
    refreshRef.current = () => { void load(); };
    async function initialize() {
      const success = cache.get(scope) as Success<T> | undefined;
      setState({ scope, ...success, loading: !success || Date.now() - success.updatedAt > REFRESH_MS, error: false });
      if (success && Date.now() - success.updatedAt <= REFRESH_MS && (inFlight?.scope !== scope || inFlight.obsolete)) return;
      // Only a new scope's initial load waits for a previous scope. Timer/manual triggers never queue.
      if (inFlight && (inFlight.scope !== scope || inFlight.obsolete)) {
        try { await inFlight.promise; } catch { /* The previous scope owns its failure. */ }
      }
      if (accepts()) await load();
    }
    void initialize();
    let timer: ReturnType<typeof setInterval> | undefined;
    function schedule() {
      if (timer !== undefined) clearInterval(timer);
      timer = undefined;
      if (document.visibilityState === "visible") timer = setInterval(() => { void load(); }, REFRESH_MS);
    }
    function visible() {
      if (document.visibilityState === "visible") void load();
      schedule();
    }
    schedule();
    document.addEventListener("visibilitychange", visible);
    return () => { active = false; if (timer !== undefined) clearInterval(timer); document.removeEventListener("visibilitychange", visible); };
  }, [scope, path, callApi]);
  const refresh = useCallback(() => refreshRef.current?.(), []);
  return { ...(state.scope === scope ? state : initial()), refresh };
}
