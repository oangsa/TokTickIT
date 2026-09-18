import { type ReactNode, useEffect, useState } from "react";
import { useLocation, useNavigate, useNavigationType, useParams } from "react-router-dom";

import { ApiResponseError, Ticket } from "../api.js";
import { useAuthenticatedApi } from "../auth/useAuthenticatedApi.js";
import { AttachmentSection } from "../attachments/AttachmentSection.js";
import { Card } from "../components/Card.js";
import { Button } from "../components/Button.js";
import { FormField } from "../components/FormField.js";
import { Modal } from "../components/Modal.js";
import { PageHeader } from "../components/PageHeader.js";
import { ReadOnlyField } from "../components/ReadOnlyField.js";
import { Skeleton } from "../components/Skeleton.js";
import { SuccessMessage } from "../components/SuccessMessage.js";
import { PublicComments } from "../components/PublicComments.js";
import { StatusChip } from "../components/StatusChip.js";
import { ticketDate, ticketDateTime } from "../tickets/ticketDate.js";

/*
 * Navigation state is caller-controlled, so it is narrowed the same way
 * `ErrorPage` narrows its status. The confirmation appears only when this number
 * matches the fetched Ticket, so caller state cannot claim that a different
 * Ticket was created. The heading falls back to it while the fetch is in flight,
 * which is the one moment there is nothing authoritative to show.
 */
function readCreatedTicketNumber(state: unknown): string | null {
  if (typeof state === "object" && state !== null) {
    const { created, ticketNumber } = state as { created?: unknown; ticketNumber?: unknown };

    if (created === true && typeof ticketNumber === "string" && ticketNumber !== "") {
      return ticketNumber;
    }
  }

  return null;
}

interface RequesterActionErrorProps {
  message: string;
  canReload: boolean;
  onReload: () => void;
}

function RequesterActionError({ message, canReload, onReload }: RequesterActionErrorProps) {
  return (
    <div className="alert alert-danger" role="alert">
      <p className="mb-2">{message}</p>
      {canReload ? (
        <Button variant="secondary" onClick={onReload}>
          Reload Ticket
        </Button>
      ) : null}
    </div>
  );
}

/*
 * Requester-owned Ticket Detail (ui-spec Section 20, api-spec Section 8.6).
 *
 * Ticket information and attachments remain read-only. Issue 6 inserts its
 * Public Comment surface through `communicationSlot`; Internal Notes never
 * enter this Requester page. Ownership is enforced by the endpoint, never here.
 */
export interface RequesterTicketDetailProps {
  communicationSlot?: (ticket: Ticket, reload: () => void) => ReactNode;
}

type RequesterAction = "cancel" | "looks-resolved" | "reopen";

export default function RequesterTicketDetail({ communicationSlot }: RequesterTicketDetailProps = {}) {
  const { publicId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const callApi = useAuthenticatedApi();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  /* Bumped after an Attachment add or removal, to re-read committed state. */
  const [reloadCount, setReloadCount] = useState(0);
  const [confirmAction, setConfirmAction] = useState<"cancel" | "reopen" | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionConflict, setActionConflict] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);
  /*
   * `location.state` is persisted in the history entry, so a reload or a Back
   * into this entry hands the creation state straight back. The confirmation
   * claims something just happened, so it is read only on the live navigation
   * that created the Ticket -- the same `POP` test `ErrorPage` applies to its
   * own status for the same reason.
   */
  const restoredEntry = useNavigationType() === "POP";
  const [createdTicketNumber] = useState(() =>
    restoredEntry ? null : readCreatedTicketNumber(location.state),
  );

  useEffect(() => {
    let ignore = false;

    /* A different Ticket must never render under the previous one's data. */
    setTicket(null);

    async function load() {
      try {
        const loaded = await callApi<Ticket>(`/api/users/me/tickets/${encodeURIComponent(publicId ?? "")}`);

        if (!ignore) {
          setTicket(loaded);
        }
      } catch (error) {
        if (ignore) {
          return;
        }

        /*
         * AuthGuard owns session invalidation; this page handles only ordinary
         * resource failures.
         */
        /*
         * Every page-level failure is the standalone `/error` experience
         * (ui-spec Section 19.4). Only the status crosses over: `ErrorPage`
         * owns the copy, so no backend text can reach the screen.
         */
        const status =
          error instanceof ApiResponseError && (error.status === 403 || error.status === 404)
            ? error.status
            : 500;

        /*
         * Replaced, not pushed: Back out of `/error` would return to the route
         * that just failed, which would fail again and push another entry.
         * `ErrorPage` treats `REPLACE` as a live navigation, so the status copy
         * still resolves.
         */
        navigate("/error", { state: { status }, replace: true });
      }
    }

    void load();

    return () => {
      ignore = true;
    };
  }, [callApi, navigate, publicId, reloadCount]);

  function openConfirmation(action: "cancel" | "reopen"): void {
    setActionError(null);
    setActionConflict(false);
    setConfirmAction(action);
  }

  function closeConfirmation(): void {
    if (actionBusy) return;
    setConfirmAction(null);
    setActionError(null);
    setActionConflict(false);
  }

  function reloadTicket(): void {
    setConfirmAction(null);
    setActionError(null);
    setActionConflict(false);
    setReloadCount((count) => count + 1);
  }

  async function runAction(action: RequesterAction): Promise<void> {
    if (publicId === undefined || actionBusy) return;
    setActionBusy(true);
    setActionError(null);
    setActionConflict(false);
    setConfirmationMessage(null);
    try {
      const updated = await callApi<Ticket>(
        `/api/users/me/tickets/${encodeURIComponent(publicId)}/${action}`,
        { method: "POST" },
      );
      setTicket(updated);
      setConfirmAction(null);
      setConfirmationMessage(
        action === "cancel"
          ? "This Ticket was cancelled."
          : action === "looks-resolved"
            ? "You confirmed that the problem appears resolved."
            : "This Ticket was reopened and returned to the IT queue.",
      );
    } catch (error) {
      const conflict = error instanceof ApiResponseError && error.status === 409;
      setActionConflict(conflict);
      setActionError(
        conflict && error instanceof ApiResponseError && error.code === "OWNERSHIP_CONFLICT"
          ? "Ticket ownership changed while you were viewing it. Reload the current Ticket before trying again."
          : conflict
            ? "Ticket changed while you were viewing it. Reload the current Ticket before trying again."
          : "The Ticket action could not be completed.",
      );
    } finally {
      setActionBusy(false);
    }
  }

  /* Section 20.1: the Ticket Number is the strongest ticket-specific identifier. */
  const heading = ticket?.ticketNumber ?? createdTicketNumber;

  return (
    <>
      <PageHeader
        title={heading ?? "Ticket Detail"}
        titleClassName="tt-ticket-no"
        {...(heading === null ? {} : { eyebrow: "Ticket Detail" })}
        backAction={{ to: `/tickets${location.search}`, label: "Back to My Tickets" }}
      />

      {/* Skeletons are decorative, so the screen owns the announcement. */}
      <p role="status" className="visually-hidden">
        {ticket === null ? "Loading ticket…" : `Ticket ${ticket.ticketNumber} loaded.`}
      </p>

      {ticket === null ? (
        <Card>
          <Skeleton height="2.5rem" count={4} />
          <Skeleton height="8rem" />
        </Card>
      ) : (
        <div className="tt-stack">
          {createdTicketNumber !== ticket.ticketNumber ? null : (
            <SuccessMessage>
              Ticket {ticket.ticketNumber} was created.
            </SuccessMessage>
          )}

          <Card title="Ticket Information">
            <div className="row g-3">
              <div className="col-12 col-md-6">
                <ReadOnlyField label="Ticket Number" value={ticket.ticketNumber} />
              </div>
              <div className="col-12 col-md-6">
                <ReadOnlyField label="Ticket Date" value={ticketDate(ticket.createdAt)} />
              </div>
              <div className="col-12 col-md-6">
                {/* Spelled out, never a colour alone (ui-spec Section 29.9). */}
                <FormField label="Current Status">
                  {({ id, describedBy }) => (
                    <output id={id} role="group" className="form-control-plaintext" aria-describedby={describedBy}>
                      <StatusChip value={ticket.currentStatus} />
                    </output>
                  )}
                </FormField>
              </div>
              <div className="col-12 col-md-6">
                <ReadOnlyField label="Requested Priority" value={ticket.requestedPriority} />
              </div>
              <div className="col-12 col-md-6">
                <ReadOnlyField label="Requester Name" value={ticket.requesterName} />
              </div>
              <div className="col-12 col-md-6">
                <ReadOnlyField label="Requester Email" value={ticket.requesterEmail} />
              </div>
              <div className="col-12 col-md-6">
                <ReadOnlyField label="Category" value={ticket.categoryName} />
              </div>
              <div className="col-12 col-md-6">
                <ReadOnlyField label="Related System" value={ticket.relatedSystemName} />
              </div>
            </div>

            <ReadOnlyField label="Summary" value={ticket.summary} />
            <ReadOnlyField label="Description" value={ticket.description} multiline />

            <div className="row g-3">
              <div className="col-12 col-md-4">
                <ReadOnlyField label="Created By" value={ticket.createdBy} />
              </div>
              <div className="col-12 col-md-4">
                <ReadOnlyField label="Updated By" value={ticket.updatedBy} />
              </div>
              <div className="col-12 col-md-4">
                <ReadOnlyField label="Last Updated" value={ticketDateTime(ticket.updatedAt)} />
              </div>
            </div>
          </Card>

          <Card title="Assignment & Workflow">
            <div className="row g-3">
              <div className="col-12 col-md-6">
                <ReadOnlyField label="IT Priority" value={ticket.itPriority ?? ticket.requestedPriority} />
              </div>
              <div className="col-12 col-md-6">
                <ReadOnlyField label="Ticket Owner" value={ticket.owner?.name ?? "Unassigned"} />
              </div>
            </div>
          </Card>

          {actionError && confirmAction === null ? (
            <RequesterActionError
              message={actionError}
              canReload={actionConflict}
              onReload={reloadTicket}
            />
          ) : null}
          {confirmationMessage ? <SuccessMessage>{confirmationMessage}</SuccessMessage> : null}

          {ticket.currentStatus === "NEW" || ticket.currentStatus === "OPEN" || ticket.currentStatus === "RESOLVED" || ticket.currentStatus === "CLOSED" ? (
            <Card title="Ticket Actions">
              <div className="d-flex flex-wrap gap-2">
                {ticket.currentStatus === "NEW" || ticket.currentStatus === "OPEN" ? (
                  <Button variant="destructive" disabled={actionBusy} onClick={() => openConfirmation("cancel")}>
                    Cancel Ticket
                  </Button>
                ) : null}
                {ticket.currentStatus === "RESOLVED" ? (
                  <Button variant="secondary" disabled={actionBusy || ticket.requesterResolutionConfirmedAt != null} onClick={() => void runAction("looks-resolved")}>
                    {ticket.requesterResolutionConfirmedAt == null ? "Problem appears resolved" : "Resolution confirmed"}
                  </Button>
                ) : null}
                {ticket.currentStatus === "RESOLVED" || ticket.currentStatus === "CLOSED" ? (
                  <Button variant="secondary" disabled={actionBusy} onClick={() => openConfirmation("reopen")}>
                    Problem Still Exists
                  </Button>
                ) : null}
              </div>
            </Card>
          ) : null}

          {communicationSlot ? (
            communicationSlot(ticket, () => setReloadCount((count) => count + 1))
          ) : (
            <Card title="Comments">
              <PublicComments
                key={`${ticket.publicId}-${ticket.updatedAt}-${ticket.currentStatus}`}
                ticketPublicId={ticket.publicId}
                onCommentAdded={() => setReloadCount((count) => count + 1)}
              />
            </Card>
          )}

          {/*
            Attachment behavior is shared with Create
            Ticket. A successful add or removal re-reads the Ticket rather than
            patching the list in place, so what is drawn is what committed.
          */}
          <AttachmentSection
            mode="detail"
            ticketPublicId={ticket.publicId}
            attachments={ticket.attachments}
            onChanged={() => setReloadCount((count) => count + 1)}
          />
        </div>
      )}

      <Modal
        open={confirmAction !== null}
        title={confirmAction === "cancel" ? "Cancel this Ticket?" : "Reopen this Ticket?"}
        onClose={closeConfirmation}
        footer={
          <>
            <Button variant="secondary" disabled={actionBusy} onClick={closeConfirmation}>
              {confirmAction === "cancel" ? "Keep Ticket" : "Cancel"}
            </Button>
            <Button
              variant={confirmAction === "cancel" ? "destructive" : "primary"}
              busy={actionBusy}
              onClick={() => confirmAction && void runAction(confirmAction)}
            >
              {confirmAction === "cancel" ? "Cancel Ticket" : "Reopen Ticket"}
            </Button>
          </>
        }
      >
        {actionError ? (
          <RequesterActionError
            message={actionError}
            canReload={actionConflict}
            onReload={reloadTicket}
          />
        ) : null}
        <p className="mb-0">
          {confirmAction === "cancel"
            ? "This action will stop further work on it."
            : "It will return to the IT queue as unassigned."}
        </p>
      </Modal>
    </>
  );
}
