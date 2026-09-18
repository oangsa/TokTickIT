import { useEffect, useRef } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import { AuthProvider, AuthStatus, roleHome, useAuth } from "./auth/AuthProvider.js";
import { AuthGuard, RoleGuard } from "./auth/guards.js";
import { NavigationGuardProvider } from "./navigation/NavigationGuard.js";
import { AppShell } from "./layouts/AppShell.js";
import ChangePassword from "./modules/Auth/ChangePassword.js";
import ErrorPage from "./modules/System/ErrorPage.js";
import Login from "./modules/Auth/Login.js";
import UnavailablePage from "./modules/System/UnavailablePage.js";
import CreateTicket from "./modules/Tickets/Requester/CreateTicket.js";
import MyTickets from "./modules/Tickets/Requester/MyTickets.js";
import RequesterTicketDetail from "./modules/Tickets/Requester/RequesterTicketDetail.js";
import StaffTicketQueue from "./modules/Tickets/Staff/StaffTicketQueue.js";
import StaffTicketDetail from "./modules/Tickets/Staff/StaffTicketDetail.js";
import UserManagement from "./modules/Users/UserManagement.js";
import CreateUser from "./modules/Users/CreateUser.js";
import EditUser from "./modules/Users/EditUser.js";
import ViewUser from "./modules/Users/ViewUser.js";

/* `/` resolves against the authenticated role after bootstrap. */
function RootRedirect() {
  const { status, user } = useAuth();
  if (status === AuthStatus.BOOTSTRAPPING) return <main id="tt-main" tabIndex={-1} className="tt-bootstrap" aria-busy="true"><div className="tt-bootstrap__panel"><p className="text-center">Loading…</p></div></main>;
  if (status === AuthStatus.ANONYMOUS || !user) return <Navigate to="/login" replace />;
  if (status === AuthStatus.PASSWORD_CHANGE_REQUIRED) return <Navigate to="/change-password" replace />;
  return <Navigate to={roleHome(user.role)} replace />;
}

function RouteFocusManager() {
  const { pathname } = useLocation();
  const previousPathname = useRef(pathname);

  useEffect(() => {
    if (previousPathname.current === pathname) {
      return;
    }

    previousPathname.current = pathname;
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
  return <AuthProvider><NavigationGuardProvider enableHistoryBlocking={enableHistoryBlocking}><RouteFocusManager /><Routes>
    <Route path="/" element={<RootRedirect />} />
    <Route path="/login" element={<Login />} />
    <Route path="/change-password" element={<ChangePassword />} />
    <Route path="/error" element={<ErrorPage />} />
    <Route element={<AuthGuard />}>
      <Route element={<RoleGuard roles={["REQUESTER"]} />}><Route element={<AppShell />}>
        <Route path="/tickets" element={<MyTickets />} />
        <Route path="/tickets/new" element={<CreateTicket />} />
        <Route path="/tickets/:publicId" element={<RequesterTicketDetail />} />
      </Route></Route>
      <Route element={<RoleGuard roles={["IT_STAFF"]} />}><Route element={<AppShell />}>
        <Route path="/staff/tickets" element={<StaffTicketQueue />} />
        <Route path="/staff/tickets/:publicId" element={<StaffTicketDetail />} />
      </Route></Route>
      <Route element={<RoleGuard roles={["ADMINISTRATOR"]} />}><Route element={<AppShell />}>
        <Route path="/admin/users" element={<UserManagement />} />
        <Route path="/admin/users/new" element={<CreateUser />} />
        <Route path="/admin/users/:publicId" element={<ViewUser />} />
        <Route path="/admin/users/:publicId/edit" element={<EditUser />} />
        <Route path="/admin/tickets" element={<StaffTicketQueue />} />
        <Route path="/admin/tickets/:publicId" element={<StaffTicketDetail />} />
      </Route></Route>
    </Route>
    <Route path="*" element={<Navigate to="/error" replace state={{ status: 404 }} />} />
  </Routes></NavigationGuardProvider></AuthProvider>;
}
