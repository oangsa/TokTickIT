import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { IconButton } from "./IconButton.js";
import { SidebarNav } from "./SidebarNav.js";

const SIDEBAR_ID = "tt-sidebar";
const MAIN_ID = "tt-main";

/*
 * The requester application shell (ui-spec Section 5). The mobile drawer is
 * React state plus CSS; Bootstrap's JavaScript bundle is deliberately not used.
 */
export function AppShell() {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const previousLocationKeyRef = useRef(location.key);

  const close = useCallback(() => {
    if (open) {
      toggleRef.current?.focus();
    }

    setOpen(false);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  /*
   * The drawer only exists below the desktop breakpoint. Above it the topbar and
   * the backdrop are both `d-lg-none`, so a drawer left open across a resize or a
   * tablet rotation keeps `inert` on the whole main region with no visible
   * backdrop and no pointer-reachable toggle to clear it — the page reads as a
   * normal desktop shell whose content simply does not respond (Section 5.2: the
   * navigation must not obscure required actions; Section 34: no hidden required
   * buttons). Escape still works, but it is not a discoverable way out.
   *
   * No focus restoration here: the toggle is `display: none` at this width, so
   * focusing it would be a no-op.
   */
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 992px)");

    function closeOnDesktop() {
      if (desktop.matches) {
        setOpen(false);
      }
    }

    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  useEffect(() => {
    if (previousLocationKeyRef.current === location.key) {
      return;
    }

    previousLocationKeyRef.current = location.key;

    if (open) {
      setOpen(false);
      toggleRef.current?.focus();
    }
  }, [location.key, open]);

  const toggleLabel = open ? "Close navigation menu" : "Open navigation menu";

  return (
    <>
      <a className="tt-skip-link" href={`#${MAIN_ID}`}>
        Skip to main content
      </a>

      <header className="tt-topbar d-lg-none">
        <IconButton
          ref={toggleRef}
          label={toggleLabel}
          aria-expanded={open}
          aria-controls={SIDEBAR_ID}
          onClick={() => setOpen((current) => !current)}
        >
          <span aria-hidden="true">☰</span>
        </IconButton>
        <span className="tt-brand">TokTickIT</span>
      </header>

      {open ? <div className="tt-backdrop d-lg-none" onClick={close} /> : null}

      <div className="tt-shell">
        <SidebarNav id={SIDEBAR_ID} open={open} onNavigate={close} />
        {/*
          The open drawer's backdrop hides the page visually but not from the
          tab order, so Tab past Change Requester lands on controls behind the
          dimmed overlay that cannot be seen or clicked. `inert` takes the whole
          main region out of focus and hit-testing for as long as the drawer is
          open (Section 5.2: the mobile navigation must not obscure required
          actions). Above the breakpoint `open` is always false, so the desktop
          shell never sets it.

          Spelled as a string: React 18 has no typed `inert` prop and forwards
          unknown attributes verbatim, so the attribute must be absent rather
          than `false` — React renders `inert="false"`, which is still inert.
        */}
        <main
          id={MAIN_ID}
          tabIndex={-1}
          className="tt-main"
          {...(open ? { inert: "" } : {})}
        >
          {/*
            No key is needed on the Outlet: RequesterGuard sits above this shell,
            so clearing the context unmounts the whole subtree and no list,
            detail, or draft state survives a Requester switch (Sections 5.3, 28).
          */}
          <div className="tt-main__inner">
            <Outlet />
          </div>
        </main>
      </div>
    </>
  );
}
