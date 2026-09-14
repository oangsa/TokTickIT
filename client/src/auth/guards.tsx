import { Navigate, Outlet, useLocation } from "react-router-dom";

import { AuthStatus, useAuth } from "./AuthProvider.js";
import type { UserRole } from "./authTypes.js";

export function AuthBootstrap() {
  return <main id="tt-main" tabIndex={-1} className="tt-bootstrap" aria-busy="true"><div className="tt-bootstrap__panel"><p className="text-center">Loading…</p></div></main>;
}

export function AuthGuard() {
  const { passwordChangeCompleted, sessionEnded, status } = useAuth();
  const location = useLocation();
  if (status === AuthStatus.BOOTSTRAPPING) return <AuthBootstrap />;
  if (status === AuthStatus.ANONYMOUS) return <Navigate to="/login" replace state={{ from: location.pathname, ...(passwordChangeCompleted ? { message: "Password changed successfully. Please sign in again." } : sessionEnded ? { message: "Your session has expired. Please sign in again." } : {}) }} />;
  if (status === AuthStatus.PASSWORD_CHANGE_REQUIRED && location.pathname !== "/change-password") return <Navigate to="/change-password" replace />;
  return <Outlet />;
}

export function RoleGuard({ roles }: { roles: readonly UserRole[] }) {
  const { status, user } = useAuth();
  if (status === AuthStatus.BOOTSTRAPPING) return <AuthBootstrap />;
  if (status !== AuthStatus.AUTHENTICATED || !user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/error" replace state={{ status: 403 }} />;
  return <Outlet />;
}

export function RequesterRoleGuard() {
  return <RoleGuard roles={["REQUESTER"]} />;
}

export function ITStaffRoleGuard() {
  return <RoleGuard roles={["IT_STAFF"]} />;
}

export function AdministratorRoleGuard() {
  return <RoleGuard roles={["ADMINISTRATOR"]} />;
}

export const AdminRoleGuard = AdministratorRoleGuard;
