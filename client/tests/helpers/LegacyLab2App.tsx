/*
 * Test-only Lab 2 route composition. Issue 3 replaced the production App
 * route map with authenticated guards; these tests retain equivalent Lab 2
 * coverage without restoring the legacy requester selector to production.
 */
import { forwardRef, useCallback, useEffect, useRef, useState, type ForwardedRef } from "react";
import { ArrowLeftRight, Menu, Plus, Ticket, UserRound, X } from "lucide-react";
import { Link, Navigate, Outlet, Route, Routes, useLocation, useMatch, useNavigate, useNavigationType } from "react-router-dom";

import CreateTicket from "../../src/pages/CreateTicket.js";
import MyTickets from "../../src/pages/MyTickets.js";
import RequesterSelection from "../../src/pages/RequesterSelection.js";
import RequesterTicketDetail from "../../src/pages/RequesterTicketDetail.js";
import { NavigationGuardProvider, useNavigationGuard } from "../../src/navigation/NavigationGuard.js";
import { RequesterGuard } from "../../src/requester/RequesterGuard.js";
import { RequesterProvider, useRequester } from "../../src/requester/RequesterProvider.js";
import { BrandMark } from "../../src/components/BrandMark.js";
import { Button } from "../../src/components/Button.js";
import { IconButton } from "../../src/components/IconButton.js";

const SIDEBAR_ID = "tt-sidebar";
const MAIN_ID = "tt-main";
const TOGGLE_ID = "tt-menu-toggle";
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const ERROR_COPY = {
  403: { title: "Unable to open this page.", message: "You do not have access to the requested resource." },
  404: { title: "Page not found.", message: "The requested resource could not be found." },
  500: { title: "Something went wrong.", message: "Please try again later." },
} as const;

function LegacyErrorPage(): JSX.Element {
  const location = useLocation();
  const { requester } = useRequester();
  const mainRef = useRef<HTMLElement>(null);
  const restoredEntry = useNavigationType() === "POP";
  const candidate = typeof location.state === "object" && location.state !== null
    ? (location.state as { status?: unknown }).status
    : undefined;
  const status = restoredEntry || (candidate !== 403 && candidate !== 404 && candidate !== 500) ? 500 : candidate;
  const copy = ERROR_COPY[status];

  useEffect(() => {
    if (!restoredEntry) mainRef.current?.focus();
  }, [location.key, restoredEntry]);

  return (
    <main ref={mainRef} tabIndex={-1} className="tt-main__inner">
      <p className="tt-brand h5">TokTickIT</p>
      <div className="text-center py-5" role="alert">
        <p className="display-5 mb-3">{status}</p>
        <h1 className="h4">{copy.title}</h1>
        <p className="text-secondary">{copy.message}</p>
        <Link className="btn btn-outline-secondary" to={requester === null ? "/requesters" : "/tickets"}>Back</Link>
      </div>
    </main>
  );
}

interface SidebarProps {
  id: string;
  open: boolean;
  onNavigate: () => void;
}

const LegacySidebar = ({ id, open, onNavigate }: SidebarProps, ref: ForwardedRef<HTMLElement>) => {
  const { requester, clearRequester } = useRequester();
  const navigate = useNavigate();
  const { requestNavigation } = useNavigationGuard();
  const createTicketActive = Boolean(useMatch({ path: "/tickets/new", end: true }));
  const ticketsActive = useMatch({ path: "/tickets", end: true });
  const ticketDetailActive = useMatch({ path: "/tickets/:publicId", end: true });
  const myTicketsActive = Boolean(!createTicketActive && (ticketsActive || ticketDetailActive));

  function handleChangeRequester(): void {
    onNavigate();
    requestNavigation(() => {
      clearRequester();
      navigate("/requesters", { replace: true });
    });
  }

  function handleLinkClick(event: React.MouseEvent<HTMLAnchorElement>, destination: string): void {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    onNavigate();
    requestNavigation(() => navigate(destination));
  }

  return (
    <nav ref={ref} id={id} aria-label="Main" className={`tt-sidebar${open ? " tt-sidebar--open" : ""}`}>
      <span className="tt-brand tt-sidebar__brand h5 mb-0"><BrandMark />TokTickIT</span>
      <a
        href="/tickets/new"
        className={`btn w-100 ${createTicketActive ? "btn-outline-secondary tt-nav-action--current" : "btn-primary"}`}
        aria-current={createTicketActive ? "page" : undefined}
        onClick={(event) => {
          if (createTicketActive && event.button === 0 && !event.metaKey && !event.altKey && !event.ctrlKey && !event.shiftKey) event.preventDefault();
          if (createTicketActive) {
            onNavigate();
            return;
          }
          handleLinkClick(event, "/tickets/new");
        }}
      >
        <Plus className="tt-sidebar__icon" size={18} aria-hidden="true" focusable="false" />Create Ticket
      </a>
      <ul className="nav flex-column gap-1">
        <li className="nav-item">
          <a href="/tickets" className={`nav-link${myTicketsActive ? " active" : ""}`} aria-current={myTicketsActive ? "page" : undefined} onClick={(event) => handleLinkClick(event, "/tickets")}>
            <Ticket className="tt-sidebar__icon" size={18} aria-hidden="true" focusable="false" />My Tickets
          </a>
        </li>
      </ul>
      <div className="tt-sidebar__footer">
        <div className="tt-sidebar__identity">
          <span className="tt-sidebar__avatar" aria-hidden="true"><UserRound className="tt-sidebar__icon" size={18} aria-hidden="true" focusable="false" /></span>
          <p className="mb-0 tt-sidebar__requester"><span className="tt-sidebar__name fw-semibold">{requester?.name}</span><span className="tt-sidebar__caption">Requester</span></p>
        </div>
        <Button variant="tertiary" className="tt-sidebar__switch w-100" onClick={handleChangeRequester}>
          <ArrowLeftRight className="tt-sidebar__icon" size={18} aria-hidden="true" focusable="false" />Change Requester
        </Button>
      </div>
    </nav>
  );
};

const ForwardedLegacySidebar = forwardRef<HTMLElement, SidebarProps>(LegacySidebar);

function LegacyAppShell() {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const location = useLocation();
  const previousLocationKeyRef = useRef(location.key);

  const close = useCallback(() => {
    if (open) toggleRef.current?.focus();
    setOpen(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        close();
        return;
      }
      if (event.key !== "Tab") return;
      const elements = Array.from(sidebarRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
      if (elements.length === 0) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    sidebarRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [close, open]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 992px)");
    function closeOnDesktop(): void {
      if (desktop.matches) setOpen(false);
    }
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  useEffect(() => {
    if (previousLocationKeyRef.current === location.key) return;
    previousLocationKeyRef.current = location.key;
    if (open) {
      setOpen(false);
      toggleRef.current?.focus();
    }
  }, [location.key, open]);

  const toggleLabel = open ? "Close navigation menu" : "Open navigation menu";

  return (
    <>
      <a className="tt-skip-link" href={`#${MAIN_ID}`}>Skip to main content</a>
      <header className="tt-topbar d-lg-none">
        <IconButton ref={toggleRef} id={TOGGLE_ID} label={toggleLabel} aria-expanded={open} aria-controls={SIDEBAR_ID} onClick={() => setOpen((current) => !current)}>
          {open ? <X size={20} aria-hidden="true" focusable="false" /> : <Menu size={20} aria-hidden="true" focusable="false" />}
        </IconButton>
        <span className="tt-brand"><BrandMark />TokTickIT</span>
      </header>
      {open ? <button type="button" className="tt-backdrop d-lg-none" aria-label="Dismiss navigation menu" onClick={close} /> : null}
      <div className="tt-shell">
        <ForwardedLegacySidebar ref={sidebarRef} id={SIDEBAR_ID} open={open} onNavigate={close} />
        <main id={MAIN_ID} tabIndex={-1} className="tt-main" {...(open ? { inert: "" } : {})}>
          <div className="tt-main__inner"><Outlet /></div>
        </main>
      </div>
    </>
  );
}

function RootRedirect(): JSX.Element {
  const { requester } = useRequester();
  return <Navigate to={requester === null ? "/requesters" : "/tickets"} replace />;
}

function RouteFocusManager(): null {
  const { pathname } = useLocation();
  const previousPathname = useRef(pathname);

  useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    if (document.activeElement === document.getElementById(TOGGLE_ID)) return;
    const main = document.getElementById(MAIN_ID) ?? document.querySelector<HTMLElement>('main[tabindex="-1"]');
    if (!main?.hasAttribute("inert")) main?.focus();
  }, [pathname]);

  return null;
}

export default function LegacyLab2App({ enableHistoryBlocking = false }: { enableHistoryBlocking?: boolean }): JSX.Element {
  return (
    <RequesterProvider>
      <NavigationGuardProvider enableHistoryBlocking={enableHistoryBlocking}>
        <RouteFocusManager />
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/requesters" element={<RequesterSelection />} />
          <Route path="/error" element={<LegacyErrorPage />} />
          <Route element={<RequesterGuard />}>
            <Route element={<LegacyAppShell />}>
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
