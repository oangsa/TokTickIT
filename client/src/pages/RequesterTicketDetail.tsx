import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useNavigationType, useParams } from "react-router-dom";

import {
  ApiResponseError,
  Attachment,
  InvalidRequesterContextError,
  Ticket,
} from "../api.js";
import { AttachmentState } from "../components/AttachmentState.js";
import { Card } from "../components/Card.js";
import { PageHeader } from "../components/PageHeader.js";
import { ReadOnlyField } from "../components/ReadOnlyField.js";
import { Skeleton } from "../components/Skeleton.js";
import { SuccessMessage } from "../components/SuccessMessage.js";
import { useRequesterApi } from "../requester/useRequesterApi.js";
import { ticketDate, ticketDateTime } from "../tickets/ticketDate.js";

/* BR-51: five Active Attachments per Ticket. Removed ones do not count. */
const MAX_ACTIVE_ATTACHMENTS = 5;

/*
 * `md` (768px) is the same cut My Tickets uses for secondary metadata. Issue
 * #24 adds the selection and action columns when their behavior exists.
 */
const SECONDARY_COLUMN = "d-none d-md-table-cell";

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

/*
 * Decimal units, because the rule the UI states to the user is decimal:
 * ui-spec Section 22.3 fixes the per-file limit at 5,000,000 bytes and calls it
 * "5 MB". Binary divisors would render a file at that exact limit as 4.8 MB,
 * next to a screen promising a maximum of 5 MB.
 */
function formatSize(bytes: number): string {
  if (bytes < 1000) {
    return `${bytes} B`;
  }

  const kilobytes = bytes / 1000;

  return kilobytes < 1000 ? `${kilobytes.toFixed(1)} KB` : `${(kilobytes / 1000).toFixed(1)} MB`;
}

function AttachmentRow({ attachment }: { attachment: Attachment }) {
  return (
    <tr>
      <td>
        {attachment.originalName}
        {/*
          Section 26 shows the removal reason as secondary metadata rather than
          as a permanently wide column of its own.
        */}
        {attachment.deleted && attachment.removalReason !== null ? (
          <div className="small text-secondary">Removal reason: {attachment.removalReason}</div>
        ) : null}
      </td>
      <td className={SECONDARY_COLUMN}>{attachment.extension.toUpperCase()}</td>
      <td>{formatSize(attachment.sizeBytes)}</td>
      <td className={SECONDARY_COLUMN}>{ticketDateTime(attachment.createdAt)}</td>
      <td>
        {/* The state name is the visible text, so it never reads by colour alone. */}
        <AttachmentState state={attachment.deleted ? "Removed" : "Active"} />
      </td>
    </tr>
  );
}

/* ui-spec Section 21: Attachments are a separate card from Ticket Information. */
function AttachmentsCard({ attachments }: { attachments: Attachment[] }) {
  const activeCount = attachments.filter((attachment) => !attachment.deleted).length;

  return (
    <Card className="mt-4" title={`Attachments ${activeCount}/${MAX_ACTIVE_ATTACHMENTS}`}>
      {attachments.length === 0 ? (
        <p className="text-secondary mb-0">No attachments.</p>
      ) : (
        <table className="table tt-table align-middle mb-0">
          <thead>
            <tr>
              <th scope="col">File Name</th>
              <th scope="col" className={SECONDARY_COLUMN}>
                Type
              </th>
              <th scope="col">Size</th>
              <th scope="col" className={SECONDARY_COLUMN}>
                Uploaded At
              </th>
              <th scope="col">Status</th>
            </tr>
          </thead>

          <tbody>
            {attachments.map((attachment) => (
              <AttachmentRow key={attachment.attachmentId} attachment={attachment} />
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

/*
 * Requester-owned Ticket Detail (ui-spec Section 20, api-spec Section 8.6).
 *
 * Read-only in Lab 2 (FR-22): no comments, internal notes, actions taken,
 * assignment, priority reassignment, status transition, or deletion controls
 * exist on this page. Ownership is enforced by the endpoint, never here -- a
 * client-side check would only decide what to draw, not what to serve.
 */
export default function RequesterTicketDetail() {
  const { publicId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const callApi = useRequesterApi();
  const [ticket, setTicket] = useState<Ticket | null>(null);
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
        const loaded = await callApi<Ticket>(`/api/tickets/${encodeURIComponent(publicId ?? "")}`);

        if (!ignore) {
          setTicket(loaded);
        }
      } catch (error) {
        if (ignore) {
          return;
        }

        /*
         * `useRequesterApi` has already cleared the context and `RequesterGuard`
         * is unmounting this subtree; navigating to the error page would race it.
         */
        if (error instanceof InvalidRequesterContextError) {
          return;
        }

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
  }, [callApi, navigate, publicId]);

  /* Section 20.1: the Ticket Number is the strongest ticket-specific identifier. */
  const heading = ticket?.ticketNumber ?? createdTicketNumber;

  return (
    <>
      <PageHeader
        title={heading ?? "Ticket Detail"}
        subtitle={heading === null ? undefined : "Ticket Detail"}
        actions={
          <Link className="btn btn-outline-secondary" to="/tickets">
            Back to My Tickets
          </Link>
        }
      />

      {/* Skeletons are decorative, so the screen owns the announcement. */}
      <p role="status" className="visually-hidden">
        {ticket === null ? "Loading ticket." : `Ticket ${ticket.ticketNumber} loaded.`}
      </p>

      {ticket === null ? (
        <Card>
          <Skeleton height="2.5rem" count={4} />
          <Skeleton height="8rem" />
        </Card>
      ) : (
        <>
          {createdTicketNumber !== ticket.ticketNumber ? null : (
            <SuccessMessage className="mb-4">
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
                <ReadOnlyField label="Current Status" value={ticket.currentStatus} />
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

          <AttachmentsCard attachments={ticket.attachments} />
        </>
      )}
    </>
  );
}
