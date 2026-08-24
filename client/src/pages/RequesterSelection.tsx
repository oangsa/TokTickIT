import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { DevelopmentRequester, fetchRequesters } from "../api.js";
import { Button } from "../components/Button.js";
import { Card } from "../components/Card.js";
import { EmptyState } from "../components/EmptyState.js";
import { ErrorState } from "../components/ErrorState.js";
import { PageHeader } from "../components/PageHeader.js";
import { Select } from "../components/Select.js";
import { Skeleton } from "../components/Skeleton.js";
import { useRequester } from "../requester/RequesterProvider.js";

type LoadState = "loading" | "loaded" | "failed";

/*
 * Development Requester Selection (ui-spec Section 6). The four states are
 * loading, empty, failure, and loaded; each is built from the shared component
 * library rather than screen-local markup.
 */
export default function RequesterSelection() {
  const navigate = useNavigate();
  const { selectRequester } = useRequester();
  const [requesters, setRequesters] = useState<DevelopmentRequester[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [selectedId, setSelectedId] = useState("");
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let ignore = false;

    async function load(): Promise<void> {
      setLoadState("loading");
      setSelectedId("");

      try {
        const loaded = await fetchRequesters();

        /* A slower earlier response must never paint over a newer one. */
        if (!ignore) {
          setRequesters(loaded);
          setLoadState("loaded");
        }
      } catch {
        if (!ignore) {
          setRequesters([]);
          setLoadState("failed");
        }
      }
    }

    void load();

    return () => {
      ignore = true;
    };
  }, [reloadCount]);

  const retry = useCallback(() => setReloadCount((count) => count + 1), []);

  function handleContinue(): void {
    const selected = requesters.find((requester) => String(requester.id) === selectedId);

    if (selected === undefined) {
      return;
    }

    selectRequester({ id: selected.id, name: selected.name });
    navigate("/tickets");
  }

  return (
    <main tabIndex={-1} className="tt-main__inner" style={{ maxWidth: 560 }}>
      <p className="tt-brand h5">TokTickIT</p>
      <PageHeader
        title="Select a Development Requester"
        subtitle="This is a Lab 2 testing mechanism, not authentication. Secure authentication is introduced in a later lab."
      />
      <Card>
        {loadState === "loading" ? (
          <>
            {/* Skeleton is decorative and aria-hidden, so the screen owns the announcement (ui-spec 29.7). */}
            <p role="status" className="visually-hidden">
              Loading Development Requesters
            </p>
            <Skeleton width="12rem" height="1rem" />
            <Skeleton height="2.5rem" />
            <div className="d-flex justify-content-end">
              {/* Rendered disabled so the card height does not shift when loading ends (ui-spec 6.4). */}
              <Button variant="primary" disabled>
                Continue
              </Button>
            </div>
          </>
        ) : null}

        {loadState === "failed" ? (
          <ErrorState
            title="Development Requesters could not be loaded."
            description="Check that the TokTickIT API is running, then try again."
            onRetry={retry}
          />
        ) : null}

        {loadState === "loaded" && requesters.length === 0 ? (
          <EmptyState
            title="No active Development Requesters are available."
            action={
              <Button variant="secondary" onClick={retry}>
                Retry
              </Button>
            }
          />
        ) : null}

        {loadState === "loaded" && requesters.length > 0 ? (
          <>
            <Select
              label="Development Requester"
              required
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
            >
              <option value="">Select a Development Requester</option>
              {requesters.map((requester) => (
                /* BR-14: the selector displays the Requester name only. */
                <option key={requester.id} value={requester.id}>
                  {requester.name}
                </option>
              ))}
            </Select>
            <div className="d-flex justify-content-end">
              <Button variant="primary" onClick={handleContinue} disabled={selectedId === ""}>
                Continue
              </Button>
            </div>
          </>
        ) : null}
      </Card>
    </main>
  );
}
