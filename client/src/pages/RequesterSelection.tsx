import { useEffect, useRef } from "react";

import { Card } from "../components/Card.js";
import { PageHeader } from "../components/PageHeader.js";

/*
 * Placeholder for the Development Requester Selection screen. Issue 20 replaces
 * this body with the real selector, the `GET /api/requesters` call, and the
 * loading, empty, and failure states.
 */
export default function RequesterSelection() {
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    mainRef.current?.focus();
  }, []);

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
