import { useEffect, useRef } from "react";
import { useNavigationType } from "react-router-dom";

import { Card } from "../components/Card.js";
import { PageHeader } from "../components/PageHeader.js";

/*
 * Placeholder for the Development Requester Selection screen. Issue 20 replaces
 * this body with the real selector, the `GET /api/requesters` call, and the
 * loading, empty, and failure states.
 */
export default function RequesterSelection() {
  const mainRef = useRef<HTMLElement>(null);
  /*
   * A client-side route change replaces the whole screen, so focus has to follow
   * it or it drops to `document.body` and the keyboard user restarts from the top
   * of the document — that is the Change Requester and route-guard case. Landing
   * here as the document's own entry is different: focus is already where the
   * browser put it, and pulling it into `<main>` would talk over the page title
   * for a screen reader (Section 29.6). `POP` is exactly that first entry, and a
   * later reload of `/requesters`.
   *
   * Deliberately not router state: `clearRequester` and `navigate` land in the
   * same batch, React flushes the urgent context update before the router's
   * transition, and `RequesterGuard`'s own stateless `<Navigate replace>` gets
   * there first — any flag passed from the sidebar is lost on the way.
   */
  const focusMain = useNavigationType() !== "POP";

  useEffect(() => {
    if (focusMain) {
      mainRef.current?.focus();
    }
  }, [focusMain]);

  return (
    <main ref={mainRef} tabIndex={-1} className="tt-main__inner" style={{ maxWidth: 560 }}>
      <p className="tt-brand h5">TokTickIT</p>
      <PageHeader
        title="Select a Development Requester"
        subtitle="This is a Lab 2 testing mechanism, not authentication. Secure authentication is introduced in a later lab."
      />
      <Card>
        <p className="text-secondary mb-0">The Requester selector is added in Issue 20.</p>
      </Card>
    </main>
  );
}
