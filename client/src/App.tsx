import { useEffect, useRef } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import { AppShell } from "./components/AppShell.js";
import CreateTicket from "./pages/CreateTicket.js";
import ErrorPage from "./pages/ErrorPage.js";
import MyTickets from "./pages/MyTickets.js";
import RequesterSelection from "./pages/RequesterSelection.js";
import RequesterTicketDetail from "./pages/RequesterTicketDetail.js";
import { NavigationGuardProvider } from "./navigation/NavigationGuard.js";
import { RequesterGuard } from "./requester/RequesterGuard.js";
import { RequesterProvider, useRequester } from "./requester/RequesterProvider.js";

/* `/` resolves against the stored Requester context (ui-spec Section 5.4). */
function RootRedirect() {
  const { requester } = useRequester();

  return <Navigate to={requester === null ? "/requesters" : "/tickets"} replace />;
}

function RouteFocusManager() {
  const { pathname } = useLocation();
  const previousPathname = useRef(pathname);

  useEffect(() => {
    if (previousPathname.current === pathname) {
      return;
    }

    previousPathname.current = pathname;
    /* An open drawer restores focus to its toggle; otherwise focus the new screen. */
    if (document.activeElement === document.getElementById("tt-menu-toggle")) {
      return;
    }

    const main = document.getElementById("tt-main") ??
      document.querySelector<HTMLElement>('main[tabindex="-1"]');

    if (!main?.hasAttribute("inert")) {
      main?.focus();
    }
  }, [pathname]);

  return null;
}

export default function App({ enableHistoryBlocking = false }: { enableHistoryBlocking?: boolean }) {
  return (
    <RequesterProvider>
      <NavigationGuardProvider enableHistoryBlocking={enableHistoryBlocking}>
        <RouteFocusManager />
        <Routes>
          <Route path="/" element={<RootRedirect />} />

          {/* Bootstrap and global error routes render without the requester shell. */}
          <Route path="/requesters" element={<RequesterSelection />} />
          <Route path="/error" element={<ErrorPage />} />

          {/*
            The guard sits outside the shell: the shell displays the selected
            Requester, so it must not render at all without a context.
          */}
          <Route element={<RequesterGuard />}>
            <Route element={<AppShell />}>
              <Route path="/tickets" element={<MyTickets />} />
              <Route path="/tickets/new" element={<CreateTicket />} />
              <Route path="/tickets/:publicId" element={<RequesterTicketDetail />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/error" replace state={{ status: 404 }} />} />
        </Routes>
      </NavigationGuardProvider>
    </RequesterProvider>
  );
}
