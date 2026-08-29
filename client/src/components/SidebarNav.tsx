import { Link, useMatch, useNavigate } from "react-router-dom";

import { useRequester } from "../requester/RequesterProvider.js";
import { BrandMark } from "./BrandMark.js";
import { Button } from "./Button.js";

interface SidebarNavProps {
  id: string;
  open: boolean;
  onNavigate: () => void;
}

/*
 * One navigation node serves both the desktop sidebar and the mobile drawer
 * (ui-spec Sections 5.1, 5.2). Rendering it twice would duplicate every
 * accessible name, so the viewport difference is handled in CSS.
 *
 * Active state is computed here rather than delegated to NavLink because a
 * Ticket Detail route must keep My Tickets active while Create Ticket must not,
 * and `aria-current` carries that state programmatically (Section 29.9).
 *
 * Create Ticket is shell navigation the Lab Sheet requires (Section 8), but it
 * is the application's primary action rather than a second list destination, so
 * it is a button above the navigation instead of a row inside it. The
 * `/tickets/new` match does double duty: it carries that item's own active
 * state, and it keeps My Tickets dark, since `/tickets/new` also matches the
 * Ticket Detail pattern.
 */
export function SidebarNav({ id, open, onNavigate }: SidebarNavProps) {
  const { requester, clearRequester } = useRequester();
  const navigate = useNavigate();

  const createTicketActive = Boolean(useMatch({ path: "/tickets/new", end: true }));
  const ticketsActive = useMatch({ path: "/tickets", end: true });
  const ticketDetailActive = useMatch({ path: "/tickets/:publicId", end: true });
  const myTicketsActive = Boolean(!createTicketActive && (ticketsActive || ticketDetailActive));

  function handleChangeRequester() {
    clearRequester();
    onNavigate();
    navigate("/requesters", { replace: true });
  }

  function linkClass(active: boolean): string {
    return `nav-link${active ? " active" : ""}`;
  }

  return (
    <nav id={id} aria-label="Main" className={`tt-sidebar${open ? " tt-sidebar--open" : ""}`}>
      <span className="tt-brand h5 mb-0">
        <BrandMark />
        TokTickIT
      </span>

      {/*
        A solid primary control, not a nav row: on the Create Ticket route it
        becomes an outlined "you are here" state instead, so the required active
        indication is visible without a filled button claiming to be an action
        the Requester has already taken (ui-spec Sections 5.1, 10.1).
      */}
      <Link
        to="/tickets/new"
        className={`btn w-100 ${createTicketActive ? "btn-outline-secondary tt-nav-action--current" : "btn-primary"}`}
        aria-current={createTicketActive ? "page" : undefined}
        onClick={onNavigate}
      >
        + Create Ticket
      </Link>

      <ul className="nav flex-column gap-1">
        <li className="nav-item">
          <Link
            to="/tickets"
            className={linkClass(myTicketsActive)}
            aria-current={myTicketsActive ? "page" : undefined}
            onClick={onNavigate}
          >
            My Tickets
          </Link>
        </li>
      </ul>

      <div className="tt-sidebar__footer">
        <p className="mb-2">
          <span className="tt-caption d-block">Requester</span>
          <span className="fw-semibold">{requester?.name}</span>
        </p>
        <Button variant="tertiary" className="px-0" onClick={handleChangeRequester}>
          Change Requester
        </Button>
      </div>
    </nav>
  );
}
