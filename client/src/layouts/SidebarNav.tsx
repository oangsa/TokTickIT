import { forwardRef, useState } from "react";
import { KeyRound, LayoutList, LogOut, Plus, Ticket, UserRound, Users } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider.js";
import { useNavigationGuard } from "../navigation/NavigationGuard.js";
import { BrandMark } from "../components/Common/BrandMark.js";
import { Button } from "../components/Common/Button.js";
import { Chip } from "../components/Common/Chip.js";

interface SidebarNavProps {
  id: string;
  open: boolean;
  onNavigate: () => void;
}

export const SidebarNav = forwardRef<HTMLElement, SidebarNavProps>(function SidebarNav({ id, open, onNavigate }, ref) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { requestNavigation } = useNavigationGuard();
  const [logoutError, setLogoutError] = useState<string | null>(null);
  if (!user) return null;

  const roleLabel = user.role === "IT_STAFF" ? "IT STAFF" : user.role === "ADMINISTRATOR" ? "ADMINISTRATOR" : "REQUESTER";
  const pathname = location.pathname.replace(/\/+$/, "") || "/";
  const isActive = (path: string): boolean => {
    if (path === "/tickets") {
      return pathname === path || (pathname.startsWith("/tickets/") && pathname !== "/tickets/new");
    }
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  function navigateWithGuard(path: string): void {
    onNavigate();
    requestNavigation(() => navigate(path));
  }

  async function handleLogout(): Promise<void> {
    setLogoutError(null);
    try {
      await logout();
      onNavigate();
      navigate("/login", { replace: true, state: { message: "You have been signed out." } });
    } catch {
      setLogoutError("Unable to sign out right now. Please try again.");
    }
  }

  function requestLogout(): void {
    requestNavigation(() => {
      void handleLogout();
    });
  }

  const links = user.role === "REQUESTER"
    ? [{ path: "/tickets", label: "My Tickets", icon: Ticket }]
    : user.role === "IT_STAFF"
      ? [{ path: "/staff/tickets", label: "Ticket Queue", icon: LayoutList }]
      : [{ path: "/admin/users", label: "User Management", icon: Users }, { path: "/admin/tickets", label: "Tickets", icon: Ticket }];

  return <nav ref={ref} id={id} aria-label="Main" className={`tt-sidebar${open ? " tt-sidebar--open" : ""}`}>
    <span className="tt-brand tt-sidebar__brand h5 mb-0"><BrandMark />TokTickIT</span>
    {user.role === "REQUESTER" ? <Link to="/tickets/new" className={`btn w-100 ${isActive("/tickets/new") ? "btn-outline-secondary tt-nav-action--current" : "btn-primary"}`} aria-current={isActive("/tickets/new") ? "page" : undefined} onClick={(event) => { if (event.button !== 0 || event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) return; event.preventDefault(); navigateWithGuard("/tickets/new"); }}><Plus className="tt-sidebar__icon" size={18} aria-hidden="true" focusable="false" />Create Ticket</Link> : null}
    <ul className="nav flex-column gap-1 mt-3">{links.map(({ path, label, icon: Icon }) => <li className="nav-item" key={path}><Link to={path} className={`nav-link${isActive(path) ? " active" : ""}`} aria-current={isActive(path) ? "page" : undefined} onClick={(event) => { if (event.button !== 0 || event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) return; event.preventDefault(); navigateWithGuard(path); }}><Icon className="tt-sidebar__icon" size={18} aria-hidden="true" focusable="false" />{label}</Link></li>)}</ul>
    <div className="tt-sidebar__footer">
      <div className="tt-sidebar__identity"><span className="tt-sidebar__avatar" aria-hidden="true"><UserRound className="tt-sidebar__icon" size={18} aria-hidden="true" focusable="false" /></span><p className="mb-0 tt-sidebar__requester"><span className="tt-sidebar__name fw-semibold">{user.name}</span><span className="tt-sidebar__caption">{user.email}</span></p></div>
      <Chip variant="primary" className="align-self-start mt-2">{roleLabel}</Chip>
      {logoutError ? <div className="alert alert-danger py-2 mt-2 mb-0" role="alert">{logoutError}</div> : null}
      <Button variant="tertiary" className="tt-sidebar__switch w-100 mt-2" onClick={() => navigateWithGuard("/change-password")}><KeyRound className="tt-sidebar__icon" size={18} aria-hidden="true" focusable="false" />Change Password</Button>
      <Button variant="tertiary" className="tt-sidebar__switch tt-sidebar__switch--danger w-100" onClick={requestLogout}><LogOut className="tt-sidebar__icon" size={18} aria-hidden="true" focusable="false" />Logout</Button>
    </div>
  </nav>;
});
