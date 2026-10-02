import { useRef, useState } from "react";
import { ApiResponseError, type Ticket } from "../../api.js";
import { useAuth } from "../../auth/AuthProvider.js";
import { useAuthenticatedApi } from "../../auth/useAuthenticatedApi.js";
import { Modal } from "../../components/Common/Modal.js";
import { Button } from "../../components/Common/Button.js";
import { CommonForm } from "../../components/Common/Form/CommonForm.js";
import { useManagedForm } from "../../forms/useManagedForm.js";
import { lifecycleSchema, completionSections, CANCEL_SECTIONS, type LifecycleValues } from "../../constants/forms/action.js";
import { actionApiPath, canEdit, isTerminal, type ActionTaken } from "./types.js";
export type LifecycleOperation = "start" | "complete" | "cancel";
export function ActionLifecycleModal({ action, ticket, operation, onClose, onSaved, onReload }: { action: ActionTaken; ticket: Ticket; operation: LifecycleOperation; onClose: () => void; onSaved: (action: ActionTaken) => void; onReload: (action: ActionTaken, ticket: Ticket) => void }) {
  const request = useAuthenticatedApi();
  const { user } = useAuth();
  const [canonical, setCanonical] = useState(action);
  const [currentTicket, setCurrentTicket] = useState(ticket);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const logical = useRef<{ body: string; key: string }>();
  const [feedback, setFeedback] = useState("");
  const [recovery, setRecovery] = useState(false);
  const form = useManagedForm<LifecycleValues>({ schema: lifecycleSchema(operation), defaultValues: { result: action.result ?? "", followUpRequired: action.followUpRequired, followUpNote: action.followUpNote ?? "", cancellationReason: "" } });
  const permitted = user?.role !== "REQUESTER" && user && (operation === "start" ? canonical.status === "PLANNED" && canonical.assignedTo?.publicId === user.publicId : operation === "cancel" ? canEdit(canonical, currentTicket, user) : operation === "complete" && canonical.status === "IN_PROGRESS" && [canonical.assignedTo?.publicId, currentTicket.owner?.publicId].includes(user.publicId));
  async function submit(values?: LifecycleValues) {
    if (lock.current || recovery || !permitted) return;
    lock.current = true; setBusy(true); setFeedback("");
    const body = JSON.stringify({ ...(operation === "cancel" && values ? { cancellationReason: values.cancellationReason.trim() } : {}), ...(operation === "complete" && values ? { result: values.result.trim(), followUpRequired: values.followUpRequired, followUpNote: values.followUpRequired ? values.followUpNote.trim() : null } : {}), expectedVersion: canonical.version });
    if (logical.current?.body !== body) logical.current = { body, key: crypto.randomUUID() };
    try {
      const updated = await request<ActionTaken>(`${actionApiPath(action.ticketPublicId, false, action.publicId)}/${operation}`, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": logical.current.key }, body });
      onSaved(updated);
    } catch (error) {
      const changed = error instanceof ApiResponseError && [403, 409].includes(error.status);
      if (error instanceof ApiResponseError && error.status === 400) form.mapServerErrors(error, new Set(["result", "followUpRequired", "followUpNote", "cancellationReason"]));
      setRecovery(changed); setFeedback(changed ? "This Action or your permission changed. Reload latest before trying again." : "The Action could not be completed. Your input is preserved. Please retry.");
    } finally { lock.current = false; setBusy(false); }
  }
  async function reload() {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try {
      const [loaded, loadedTicket] = await Promise.all([request<ActionTaken>(actionApiPath(action.ticketPublicId, false, action.publicId)), request<Ticket>(`/api/tickets/${encodeURIComponent(action.ticketPublicId)}`)]);
      setCanonical(loaded); setCurrentTicket(loadedTicket); onReload(loaded, loadedTicket); setRecovery(false); logical.current = undefined; setFeedback(isTerminal(loaded) ? "This Action is now read-only." : "Latest Action and Ticket loaded. Review before trying again.");
    }
    catch { setFeedback("Latest Action could not be loaded. Please retry."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <Modal open title={operation === "complete" ? "Complete Action" : operation === "cancel" ? "Cancel Action" : "Start this Action?"} onClose={() => !lock.current && onClose()} footer={operation !== "start" ? undefined : <><Button disabled={busy} onClick={onClose}>Cancel</Button><Button variant="primary" busy={busy} disabled={recovery || !permitted} onClick={() => void submit()}>Start Action</Button></>}>
    {operation !== "start" ? <CommonForm form={form} sections={operation === "cancel" ? CANCEL_SECTIONS : completionSections(form.watch("followUpRequired"))} onSubmit={submit} submitLabel={operation === "cancel" ? "Cancel Action" : "Complete Action"} cancelLabel={operation === "cancel" ? "Keep Action" : "Cancel"} onCancel={onClose} cancelDisabled={busy} submitting={busy} disabled={busy || !permitted} submitDisabled={recovery} /> : <p>This will move the Action to In Progress.</p>}
    {feedback && <p role="alert">{feedback}</p>}{recovery && <Button disabled={busy} onClick={() => void reload()}>Reload latest</Button>}
  </Modal>;
}
