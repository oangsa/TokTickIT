import { useCallback, useMemo, useRef, useEffect, type ReactNode } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";

import {
  AuthContext,
  AuthStatus,
  type AuthContextValue,
} from "../../src/auth/AuthProvider.js";
import type { CurrentUserDTO } from "../../src/auth/authTypes.js";
import { authenticatedBlobRequest, authenticatedRequest, clearAccessToken, setAccessToken } from "../../src/auth/authTransport.js";
import { AppShell } from "../../src/components/AppShell.js";
import ErrorPage from "../../src/pages/ErrorPage.js";
import CreateTicket from "../../src/pages/CreateTicket.js";
import MyTickets from "../../src/pages/MyTickets.js";
import RequesterTicketDetail from "../../src/pages/RequesterTicketDetail.js";
import { NavigationGuardProvider } from "../../src/navigation/NavigationGuard.js";

export const TEST_USER: CurrentUserDTO = {
  publicId: "70000000-0000-4000-8000-000000000001",
  name: "Alice Johnson",
  email: "alice.johnson@example.com",
  role: "REQUESTER",
  isActive: true,
  mustChangePassword: false,
  sessionStage: "FULL",
};

function RouteFocusManager(): null {
  const { pathname } = useLocation();
  const previousPathname = useRef(pathname);

  useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    const main = document.getElementById("tt-main") ?? document.querySelector<HTMLElement>('main[tabindex="-1"]');
    if (!main?.hasAttribute("inert")) main?.focus();
  }, [pathname]);

  return null;
}

function TestAuthProvider({ children }: { children: ReactNode }): JSX.Element {
  setAccessToken("test-access-token", 600, false);

  const request = useCallback(
    <T,>(path: string, init?: RequestInit): Promise<T> => authenticatedRequest<T>(path, init),
    [],
  );
  const value = useMemo<AuthContextValue>(() => ({
    status: AuthStatus.AUTHENTICATED,
    authState: AuthStatus.AUTHENTICATED,
    state: { status: AuthStatus.AUTHENTICATED, user: TEST_USER },
    user: TEST_USER,
    currentUser: TEST_USER,
    isAuthenticated: true,
    passwordChangeCompleted: false,
    sessionEnded: false,
    login: async () => TEST_USER,
    logout: async () => clearAccessToken(false),
    logoutAll: async () => clearAccessToken(false),
    changePassword: async () => undefined,
    refresh: async () => TEST_USER,
    request,
    requestBlob: authenticatedBlobRequest,
  }), [request]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default function AuthenticatedRequesterApp({ enableHistoryBlocking = false }: { enableHistoryBlocking?: boolean }): JSX.Element {
  return (
    <TestAuthProvider>
      <NavigationGuardProvider enableHistoryBlocking={enableHistoryBlocking}>
        <RouteFocusManager />
        <Routes>
          <Route path="/" element={<Navigate to="/tickets" replace />} />
          <Route path="/error" element={<ErrorPage />} />
          <Route element={<AppShell />}>
            <Route path="/tickets" element={<MyTickets />} />
            <Route path="/tickets/new" element={<CreateTicket />} />
            <Route path="/tickets/:publicId" element={<RequesterTicketDetail />} />
          </Route>
          <Route path="*" element={<Navigate to="/error" replace state={{ status: 404 }} />} />
        </Routes>
      </NavigationGuardProvider>
    </TestAuthProvider>
  );
}
