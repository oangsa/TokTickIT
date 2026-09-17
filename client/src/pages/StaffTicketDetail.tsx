import { type ReactNode, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { ApiResponseError } from "../api.js";
import { useAuth } from "../auth/AuthProvider.js";
import { useAuthenticatedApi } from "../auth/useAuthenticatedApi.js";
import { AttachmentDownloadButton, AttachmentPreviewModal, type PreviewTarget } from "../attachments/AttachmentPreviewModal.js";
import { Badge } from "../components/Badge.js";
import { Button } from "../components/Button.js";
import { Card } from "../components/Card.js";
import { CommonForm } from "../components/CommonForm.js";
import { useManagedForm } from "../forms/useManagedForm.js";
import { REQUEST_INFORMATION_SECTIONS, TICKET_FORM_RULES, type RequestInformationValues } from "../constants/forms/ticket.js";
import { Modal } from "../components/Modal.js";
import { PageHeader } from "../components/PageHeader.js";
import { PublicComments } from "../components/PublicComments.js";
import { InternalNotes } from "../components/InternalNotes.js";
import { ticketDateTime } from "../tickets/ticketDate.js";
import { ACTION_LABELS, availableStaffActions, PRIORITIES, statusLabel, type StaffAction, type StaffTicket, type TicketOwnerDTO } from "../tickets/staffTickets.js";

export interface StaffTicketDetailProps {
  communicationSlot?: (ticket: StaffTicket, reload: () => void) => ReactNode;
}
type PendingAction = StaffAction | "owner" | null;

export default function StaffTicketDetail({ communicationSlot }: StaffTicketDetailProps = {}) {
  const { publicId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const callApi = useAuthenticatedApi();
  const [ticket, setTicket] = useState<StaffTicket | null>(null);
  const [owners, setOwners] = useState<TicketOwnerDTO[]>([]);
  const [ownerPublicId, setOwnerPublicId] = useState("");
  const [lookupOpen, setLookupOpen] = useState(false);
  const [lookupError, setLookupError] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const messageForm = useManagedForm<RequestInformationValues>({
    schema: z.object({ content: z.string().trim().refine((value) => [...value].length >= TICKET_FORM_RULES.publicComment.minLength && [...value].length <= TICKET_FORM_RULES.publicComment.maxLength, "Enter a message of 1–2000 characters.") }),
    defaultValues: { content: "" },
  });
  const content = messageForm.watch("content");
  const resetMessage = messageForm.reset;
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [reloadCount, setReloadCount] = useState(0);
  const [activeTab, setActiveTab] = useState<"comments" | "notes">("comments");
  const [preview, setPreview] = useState<PreviewTarget | null>(null);
  const generation = useRef(0);
  const basePath = `/api/tickets/${encodeURIComponent(publicId ?? "")}`;
  const queuePath = user?.role === "ADMINISTRATOR" ? "/admin/tickets" : "/staff/tickets";

  useEffect(() => {
    const current = ++generation.current;
    setTicket(null); setError(""); setConflict(false); setPendingAction(null); setLookupOpen(false); setPreview(null); setBusy(false); setSuccess("");
    resetMessage({ content: "" });
    async function load() {
      try {
        const loaded = await callApi<StaffTicket>(basePath);
        if (current === generation.current) { setTicket(loaded); setOwnerPublicId(loaded.owner?.publicId ?? ""); }
      } catch (failure) {
        if (current === generation.current) navigate("/error", { state: { status: failure instanceof ApiResponseError && [403, 404].includes(failure.status) ? failure.status : 500 } });
      }
    }
    void load();
    return () => { generation.current++; };
  }, [basePath, reloadCount, callApi, navigate, resetMessage]);
  const operational = user?.role === "IT_STAFF" || (user?.role === "ADMINISTRATOR" && ticket?.owner?.publicId === user.publicId);
  const terminal = ticket?.currentStatus === "CLOSED" || ticket?.currentStatus === "CANCELLED";
  function reload() { setReloadCount((count) => count + 1); }
  async function openLookup() {
    if (terminal) return;
    setLookupOpen(true); setLookupError(false); setOwnerPublicId(ticket?.owner?.publicId ?? "");
    const current = generation.current;
    try {
      const users = await callApi<TicketOwnerDTO[]>("/api/users/assignable");
      if (current === generation.current) setOwners(users);
    } catch { if (current === generation.current) setLookupError(true); }
  }
  async function mutate(action: StaffAction | "owner" | "it-priority", body?: object) {
    if (busy || conflict) return;
    const current = generation.current;
    setBusy(true); setError(""); setSuccess("");
    try {
      const updated = await callApi<StaffTicket>(`${basePath}/${action}`, { method: action === "owner" || action === "it-priority" ? "PATCH" : "POST", ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
      if (current !== generation.current) return;
      setTicket(updated); setOwnerPublicId(updated.owner?.publicId ?? ""); setPendingAction(null); setLookupOpen(false); messageForm.reset(); setSuccess("Ticket updated.");
    } catch (failure) {
      if (current !== generation.current) return;
      const needsReload = failure instanceof ApiResponseError && [403, 409].includes(failure.status);
      setConflict(needsReload);
      setError(failure instanceof ApiResponseError && failure.code === "OWNERSHIP_CONFLICT"
        ? "Ticket ownership changed while you were viewing it. Reload the current Ticket before trying again."
        : failure instanceof ApiResponseError && failure.code === "INVALID_STATUS_TRANSITION"
          ? "This action is no longer valid for the current Ticket status. Reload the Ticket."
          : failure instanceof ApiResponseError && failure.status === 403 ? "Your permission to change this Ticket has changed. Reload the Ticket."
            : "The Ticket could not be updated. Your changes have not been confirmed. Try again.");
    } finally { if (current === generation.current) setBusy(false); }
  }
  function selectAction(action: StaffAction) {
    if (["mark-resolved", "close", "cancel", "request-information"].includes(action)) { setError(""); setPendingAction(action); }
    else void mutate(action);
  }
  function saveOwner() {
    setLookupOpen(false);
    if (!ticket || terminal) return;
    if (ticket.owner) setPendingAction("owner");
    else void mutate("owner", { ownerPublicId: ownerPublicId || null, expectedOwnerPublicId: null });
  }
  const errorView = error && <div className="alert alert-danger" role="alert"><p>{error}</p>{conflict && <Button onClick={reload}>Reload Ticket</Button>}</div>;
  if (!ticket || ticket.publicId.toLowerCase() !== publicId?.toLowerCase()) return <p role="status">Loading Ticket…</p>;
  const actionTitle = pendingAction === "owner" ? ownerPublicId ? "Reassign" : "Unassign" : pendingAction ? ACTION_LABELS[pendingAction] : "";
  return <div className="tt-staff-page">
    <PageHeader title={ticket.ticketNumber} eyebrow="Ticket Detail" actions={<Link to={queuePath}>Back to Ticket Queue</Link>} />
    {success && <p role="status" className="alert alert-success">{success}</p>}
    {!pendingAction && errorView}
    <div className="row g-4">
      <div className="col-12 col-xl-7"><Card title="Ticket Information"><dl className="row mb-0">
        {[["Ticket Date", ticketDateTime(ticket.createdAt)], ["Requester Name", ticket.requesterName], ["Requester Email", ticket.requesterEmail], ["Category", ticket.categoryName], ["Related System", ticket.relatedSystemName], ["Requested Priority", ticket.requestedPriority], ["Summary", ticket.summary], ["Description", ticket.description]].map(([label, value]) => <div className="col-12 mb-3" key={label}><dt>{label}</dt><dd className="text-break mb-0" style={{ whiteSpace: "pre-wrap" }}>{value}</dd></div>)}
      </dl></Card></div>
      <div className="col-12 col-xl-5"><Card title="Assignment & Workflow">
        <p>Current Status: <Badge>{statusLabel(ticket.currentStatus)}</Badge></p>
        <p>Owner: <Badge>{ticket.owner?.name ?? "Unassigned"}</Badge></p>
        {operational && !terminal && <Button disabled={busy || conflict} onClick={() => void openLookup()}>Change Owner</Button>}
        <div className="my-3">{operational ? <><label className="form-label" htmlFor="staff-it-priority">IT Priority</label><select id="staff-it-priority" className="form-select" disabled={busy || conflict} value={ticket.itPriority} onChange={(event) => void mutate("it-priority", { itPriority: event.target.value })}>{PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}</select></> : <><span className="form-label d-block">IT Priority</span><div><Badge>{ticket.itPriority}</Badge></div></>}</div>
        <p>Requester confirmation: {ticket.requesterResolutionConfirmedAt ? `Received ${ticketDateTime(ticket.requesterResolutionConfirmedAt)}` : "Not received"}</p>
        {!operational && <p className="text-secondary">Ticket operations are read-only unless you are the assigned owner.</p>}
        <div className="d-flex flex-wrap gap-2">{user && availableStaffActions(ticket, user).map((action) => <Button key={action} disabled={busy || conflict} busy={busy} variant={action === "cancel" ? "destructive" : "secondary"} onClick={() => selectAction(action)}>{ACTION_LABELS[action]}</Button>)}</div>
      </Card></div>
      <div className="col-12"><Card title="Attachments">{ticket.attachments.length === 0 ? <p>No Attachments.</p> : <ul className="list-unstyled mb-0">{ticket.attachments.map((attachment) => <li className="d-flex flex-wrap align-items-center gap-2 border-bottom py-3" key={attachment.attachmentId}><span className="text-break me-auto">{attachment.originalName}</span>{attachment.deleted ? <span>Removed — {attachment.removalReason}</span> : <><Button onClick={() => setPreview(attachment)}>Preview {attachment.originalName}</Button><AttachmentDownloadButton attachmentId={attachment.attachmentId} originalName={attachment.originalName} basePath={`${basePath}/attachments`} /></>}</li>)}</ul>}</Card></div>
      <div className="col-12"><Card title="Communication">
        {communicationSlot ? (
          communicationSlot(ticket, reload)
        ) : (
          <div>
            <ul className="nav nav-tabs mb-3" role="tablist">
              <li className="nav-item" role="presentation">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "comments"}
                  className={`nav-link ${activeTab === "comments" ? "active" : ""}`}
                  onClick={() => setActiveTab("comments")}
                >
                  Public Comments
                </button>
              </li>
              <li className="nav-item" role="presentation">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "notes"}
                  className={`nav-link ${activeTab === "notes" ? "active" : ""}`}
                  onClick={() => setActiveTab("notes")}
                >
                  Internal Notes
                </button>
              </li>
            </ul>
            {activeTab === "comments" ? (
              <PublicComments
                key={`${ticket.publicId}-${ticket.updatedAt}-${ticket.currentStatus}`}
                ticketPublicId={ticket.publicId}
                onCommentAdded={reload}
              />
            ) : (
              <InternalNotes
                key={`${ticket.publicId}-${ticket.updatedAt}-${ticket.currentStatus}`}
                ticketPublicId={ticket.publicId}
                ticketOwnerPublicId={ticket.owner?.publicId}
                onNoteAdded={reload}
              />
            )}
          </div>
        )}
      </Card></div>
    </div>
    <AttachmentPreviewModal target={preview} onClose={() => setPreview(null)} basePath={`${basePath}/attachments`} />
    <Modal open={lookupOpen} title="Choose Ticket Owner" onClose={() => !busy && setLookupOpen(false)} footer={<><Button onClick={() => setLookupOpen(false)}>Cancel</Button><Button variant="primary" disabled={lookupError || busy || terminal || ownerPublicId === (ticket.owner?.publicId ?? "")} onClick={saveOwner}>Apply Owner</Button></>}>
      {lookupError && <p role="alert">Assignable Users could not be loaded. Close and retry.</p>}
      <label className="form-label" htmlFor="staff-owner">Ticket Owner</label><select id="staff-owner" className="form-select" value={ownerPublicId} onChange={(event) => setOwnerPublicId(event.target.value)}><option value="">Unassigned</option>{owners.map((owner) => <option key={owner.publicId} value={owner.publicId}>{owner.name} ({statusLabel(owner.role)})</option>)}</select>
    </Modal>
    <Modal open={pendingAction !== null} title={pendingAction === "request-information" ? "Request information from Requester" : `${actionTitle} this Ticket?`} onClose={() => !busy && setPendingAction(null)} footer={pendingAction === "request-information" ? undefined : <><Button disabled={busy} onClick={() => setPendingAction(null)}>Cancel</Button><Button variant={pendingAction === "cancel" ? "destructive" : "primary"} busy={busy} disabled={conflict} onClick={() => {
      if (pendingAction) void mutate(pendingAction, pendingAction === "owner" ? { ownerPublicId: ownerPublicId || null, expectedOwnerPublicId: ticket.owner?.publicId ?? null } : undefined);
    }}>{actionTitle}</Button></>}>
      {pendingAction === "request-information" ? <CommonForm form={messageForm} sections={REQUEST_INFORMATION_SECTIONS} onSubmit={(values) => mutate("request-information", values)} onCancel={() => setPendingAction(null)} submitLabel="Request Information" submitting={busy} cancelDisabled={busy} submitDisabled={conflict || [...content.trim()].length < 1 || [...content.trim()].length > 2000} /> : pendingAction === "owner" ? <><p>Current owner: {ticket.owner?.name ?? "Unassigned"}</p><p>New owner: {owners.find((owner) => owner.publicId === ownerPublicId)?.name ?? "Unassigned"}</p>{!ownerPublicId && <p>The Ticket will return to the queue without changing its current status.</p>}</> : <p>{pendingAction === "mark-resolved" ? "The Requester will be asked to confirm whether the problem appears resolved." : pendingAction === "close" ? "The Ticket will be closed after Requester confirmation." : "Cancellation is permanent. This Ticket cannot be reopened."}</p>}
      {errorView}
    </Modal>
  </div>;
}
