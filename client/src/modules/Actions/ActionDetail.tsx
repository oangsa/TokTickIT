import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ApiResponseError, type Ticket } from "../../api.js";
import { useAuth } from "../../auth/AuthProvider.js";
import { useAuthenticatedApi } from "../../auth/useAuthenticatedApi.js";
import { Card } from "../../components/Common/Card.js";
import { Button } from "../../components/Common/Button.js";
import { ReadOnlyField } from "../../components/Common/Form/ReadOnlyField.js";
import { PageHeader } from "../../components/Maintain/PageHeader.js";
import { StatusChip } from "../Tickets/components/StatusChip.js";
import { AttachmentDownloadButton, AttachmentPreviewModal, type PreviewTarget } from "../Tickets/attachments/AttachmentPreviewModal.js";
import { ticketDateTime } from "../Tickets/ticketDate.js";
import { ActivityTimeline } from "./ActivityTimeline.js";
import { ActionForm } from "./ActionForm.js";
import { ActionAssigneeSelection } from "./ActionAssigneeSelection.js";
import { ActionLifecycleModal, type LifecycleOperation } from "./ActionLifecycleModal.js";
import { actionApiPath, canEdit, isTerminal, type ActionTaken } from "./types.js";

export default function ActionDetail() {
  const { ticketPublicId = "", actionPublicId = "" } = useParams();
  const { user } = useAuth();
  const request = useAuthenticatedApi();
  const navigate = useNavigate();
  const requester = user?.role === "REQUESTER";
  const ticketApi = `${requester ? "/api/users/me/tickets" : "/api/tickets"}/${encodeURIComponent(ticketPublicId)}`;
  const basePath = requester ? "/tickets" : user?.role === "ADMINISTRATOR" ? "/admin/tickets" : "/staff/tickets";
  const [action, setAction] = useState<ActionTaken | null>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [preview, setPreview] = useState<PreviewTarget | null>(null);
  const [pending, setPending] = useState<"edit" | "assign" | "unassign" | LifecycleOperation | null>(null);
  const generation = useRef(0);
  useEffect(() => {
    const current = ++generation.current;
    setAction(null); setTicket(null); setPreview(null); setPending(null);
    async function load() {
      try {
        const [loadedTicket, loadedAction] = await Promise.all([request<Ticket>(ticketApi), request<ActionTaken>(actionApiPath(ticketPublicId, requester, actionPublicId))]);
        if (current === generation.current) { setTicket(loadedTicket); setAction(loadedAction); }
      } catch (error) {
        if (current === generation.current) navigate("/error", { replace: true, state: { status: error instanceof ApiResponseError && [403, 404].includes(error.status) ? error.status : 500 } });
      }
    }
    void load(); return () => { generation.current++; };
  }, [ticketApi, ticketPublicId, actionPublicId, requester, user?.publicId, request, navigate]);
  if (!action || !ticket || action.publicId.toLowerCase() !== actionPublicId.toLowerCase() || ticket.publicId.toLowerCase() !== ticketPublicId.toLowerCase()) return <p role="status">Loading Action…</p>;
  const permittedEdit = Boolean(user && canEdit(action, ticket, user));
  const ownerOrAssignee = user && [action.assignedTo?.publicId, ticket.owner?.publicId].includes(user.publicId);
  function saved(updated: ActionTaken) { setAction(updated); setPending(null); }
  function reloaded(updated: ActionTaken, updatedTicket: Ticket) { setAction(updated); setTicket(updatedTicket); }
  return <>
    <PageHeader title="Action Taken" backAction={{ to: `${basePath}/${encodeURIComponent(ticketPublicId)}`, label: "Back to Ticket" }} actions={<StatusChip value={action.status} />} />
    <div className="row g-4">
      <div className="col-12 col-lg-8 d-flex flex-column gap-4">
        <Card title="Action Information">
          {action.isMigrated && <div className="alert alert-info"><strong>Migrated Record</strong><p className="mb-0">Historical details were generated during migration and may not identify the original performer. This Action does not satisfy the Ticket resolution requirement.</p></div>}
          <ReadOnlyField label="Action Date/Time" value={ticketDateTime(action.createdAt)} />
          <ReadOnlyField label="Description" value={action.description} multiline />
          <ReadOnlyField label="Creator" value={action.creator.name} />
        </Card>
        <Card title="Result & Follow-Up"><ReadOnlyField label="Result" value={action.result ?? "Not recorded"} multiline /><ReadOnlyField label="Follow-Up Required" value={action.followUpRequired ? "Yes" : "No"} />{action.followUpRequired && <ReadOnlyField label="Follow-Up Note" value={action.followUpNote ?? "Not recorded"} multiline />}{action.cancellationReason && <ReadOnlyField label="Cancellation Reason" value={action.cancellationReason} multiline />}</Card>
        <Card title="Attachment Notes"><ReadOnlyField label="Attachment Notes" value={action.attachmentNotes ?? "Not recorded"} multiline /></Card>
        <Card title="Attachments">
          {action.attachments.length === 0 ? <p className="text-secondary mb-0">No Attachments.</p> : <ul className="list-unstyled mb-0">{action.attachments.map((file) => <li key={file.attachmentId} className="d-flex flex-wrap gap-2 align-items-center border-bottom py-3"><span className="text-break me-auto">{file.originalName}</span>{file.deleted ? <span>Removed — {file.removalReason}</span> : <><Button onClick={() => setPreview(file)}>Preview {file.originalName}</Button><AttachmentDownloadButton attachmentId={file.attachmentId} originalName={file.originalName} basePath={`${ticketApi}/attachments`} /></>}</li>)}</ul>}
        </Card>
      </div>
      <div className="col-12 col-lg-4 d-flex flex-column gap-4">
        <Card title="Status & Assignment"><StatusChip value={action.status} /><ReadOnlyField label="Assigned To" value={action.assignedTo?.name ?? "Unassigned"} /><ReadOnlyField label="Performed By" value={action.performedBy?.name ?? "Unknown"} /><ReadOnlyField label="Created At" value={ticketDateTime(action.createdAt)} />{(["startedAt", "completedAt", "cancelledAt"] as const).map((key) => <ReadOnlyField key={key} label={{ startedAt: "Started At", completedAt: "Completed At", cancelledAt: "Cancelled At" }[key]} value={action[key] ? ticketDateTime(action[key]) : "Not recorded"} />)}</Card>
        {!requester && !isTerminal(action) && <Card title="Actions"><div className="d-flex flex-wrap gap-2">
          {permittedEdit && <Button onClick={() => setPending("edit")}>Edit</Button>}
          <Button onClick={() => setPending("assign")}>{action.assignedTo ? "Reassign" : "Assign"}</Button>
          {action.assignedTo && <Button onClick={() => setPending("unassign")}>Unassign</Button>}
          {action.status === "PLANNED" && (!action.assignedTo || action.assignedTo.publicId === user?.publicId) && <Button disabled={!action.assignedTo} onClick={() => setPending("start")}>Start</Button>}
          {action.status === "IN_PROGRESS" && ownerOrAssignee && <Button variant="primary" onClick={() => setPending("complete")}>Complete</Button>}
          {permittedEdit && <Button variant="destructive" onClick={() => setPending("cancel")}>Cancel Action</Button>}
        </div></Card>}
        {!requester && <ActivityTimeline ticketPublicId={ticketPublicId} actionPublicId={actionPublicId} refreshTrigger={action.version} />}
      </div>
    </div>
    {pending === "edit" && <ActionForm ticket={ticket} action={action} onClose={() => setPending(null)} onSaved={saved} />}
    {(pending === "assign" || pending === "unassign") && <ActionAssigneeSelection action={action} unassign={pending === "unassign"} onClose={() => setPending(null)} onSaved={saved} />}
    {(pending === "start" || pending === "complete" || pending === "cancel") && <ActionLifecycleModal action={action} ticket={ticket} operation={pending} onClose={() => setPending(null)} onSaved={saved} onReload={reloaded} />}
    <AttachmentPreviewModal target={preview} onClose={() => setPreview(null)} basePath={`${ticketApi}/attachments`} />
  </>;
}
