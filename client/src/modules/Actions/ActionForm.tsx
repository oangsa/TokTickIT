import { useEffect, useMemo, useRef, useState } from "react";
import { ApiResponseError, type Ticket } from "../../api.js";
import type { ActionTaken } from "./types.js";
import { actionApiPath, canEdit, isTerminal } from "./types.js";
import { useAuth } from "../../auth/AuthProvider.js";
import { useAuthenticatedApi } from "../../auth/useAuthenticatedApi.js";
import { Modal } from "../../components/Common/Modal.js";
import { Button } from "../../components/Common/Button.js";
import { CommonForm } from "../../components/Common/Form/CommonForm.js";
import { useManagedForm } from "../../forms/useManagedForm.js";
import { actionFormSchema, actionSections, type ActionFormValues } from "../../constants/forms/action.js";
import { AttachmentSelection } from "./AttachmentSelection.js";
import { userLookup } from "../../lookups/index.js";
import { useNavigationGuard, type NavigationAction } from "../../navigation/NavigationGuard.js";

export interface ActionFormProps { ticket: Ticket; action?: ActionTaken; onClose: () => void; onSaved: (action: ActionTaken) => void }
export function ActionForm({ ticket, action, onClose, onSaved }: ActionFormProps) {
  const { user } = useAuth();
  const request = useAuthenticatedApi();
  const definition = useMemo(() => userLookup(request), [request]);
  const form = useManagedForm<ActionFormValues>({ schema: actionFormSchema, defaultValues: {
    description: action?.description ?? "", result: action?.result ?? "", assignedToUserPublicId: action?.assignedTo?.publicId ?? user?.publicId ?? "", followUpRequired: action?.followUpRequired ?? false, followUpNote: action?.followUpNote ?? "", attachmentNotes: action?.attachmentNotes ?? "", attachmentIds: action?.attachments.map((file) => file.attachmentId) ?? [],
  } });
  const [canonical, setCanonical] = useState(action);
  const [currentTicket, setCurrentTicket] = useState(ticket);
  const [recovery, setRecovery] = useState<"conflict" | "transition" | null>(null);
  const [latest, setLatest] = useState<ActionTaken | null>(null);
  const editable = Boolean(user && user.role !== "REQUESTER" && (canonical ? canEdit(canonical, currentTicket, user) : ["OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"].includes(currentTicket.currentStatus)));
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const logicalRequest = useRef<{ fingerprint: string; key: string }>();
  const [discard, setDiscard] = useState<NavigationAction | null>(null);
  const guard = useNavigationGuard();
  const { register, cancelNavigation } = guard;
  useEffect(() => register({ dirty: form.isDirty || busy, onBlockedNavigation: (next) => { if (!inFlight.current) setDiscard(() => next); } }), [form.isDirty, busy, register]);
  useEffect(() => {
    if (!form.isDirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [form.isDirty]);
  function close() { if (!inFlight.current) { if (form.isDirty) setDiscard(() => onClose); else onClose(); } }
  async function submit(values: ActionFormValues) {
    if (inFlight.current || recovery || !editable) return;
    inFlight.current = true; setBusy(true);
    const body = { description: values.description.trim(), ...(canonical ? { result: values.result.trim() || null, expectedVersion: canonical.version } : { assignedToUserPublicId: values.assignedToUserPublicId || null }),
      followUpRequired: values.followUpRequired, followUpNote: values.followUpRequired ? values.followUpNote.trim() : null,
      attachmentNotes: values.attachmentNotes.trim() || null, attachmentIds: values.attachmentIds };
    const fingerprint = JSON.stringify(body);
    if (logicalRequest.current?.fingerprint !== fingerprint) logicalRequest.current = { fingerprint, key: crypto.randomUUID() };
    try {
      const updated = await request<ActionTaken>(actionApiPath(ticket.publicId, false, canonical?.publicId), { method: canonical ? "PATCH" : "POST", headers: { "Content-Type": "application/json", ...(!canonical ? { "Idempotency-Key": logicalRequest.current.key } : {}) }, body: fingerprint });
      logicalRequest.current = undefined; form.reset(values); onSaved(updated);
    } catch (error) {
      const stale = error instanceof ApiResponseError && error.code === "CONFLICT";
      const transition = error instanceof ApiResponseError && ["INVALID_ACTION_TRANSITION", "INVALID_STATUS_TRANSITION", "FORBIDDEN"].includes(error.code ?? "");
      if (stale || transition) setRecovery(stale ? "conflict" : "transition");
      form.mapServerErrors(error, new Set(["description", "result", "assignedToUserPublicId", "followUpRequired", "followUpNote", "attachmentNotes", "attachmentIds"]), stale ? "This Action changed. Your draft is preserved. Reload latest before saving again." : transition ? "This Action changed and can no longer be edited in its previous state. Refresh its current state." : "The Action could not be saved. Your draft is preserved. Check selected files and retry.");
    } finally { inFlight.current = false; setBusy(false); }
  }
  async function reloadLatest() {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true);
    try {
      const loadedTicket = await request<Ticket>(`/api/tickets/${encodeURIComponent(ticket.publicId)}`);
      setCurrentTicket(loadedTicket);
      if (!canonical) {
        setRecovery(null);
        form.setFormError(["OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"].includes(loadedTicket.currentStatus) ? "Latest Ticket loaded. Your draft is retained; review before retrying." : "This Ticket is no longer eligible for new Actions. Your draft remains available to copy.");
        return;
      }
      const loaded = await request<ActionTaken>(actionApiPath(ticket.publicId, false, canonical.publicId));
      setCanonical(loaded); setLatest(loaded); setRecovery(null); logicalRequest.current = undefined;
      form.setFormError(isTerminal(loaded) ? "This Action is now read-only. Your draft remains available to copy." : "Latest saved Action loaded. Your draft is retained; review it before saving.");
    } catch { form.setFormError("Latest Action could not be loaded. Your draft is preserved. Please retry."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  const sections = actionSections(definition, user?.name ?? "", form.watch("followUpRequired"), Boolean(action));
  sections[0].fields = [...sections[0].fields, { key: "attachmentIds", name: "attachmentIds", label: "Attachments", type: "custom", render: (field) => <AttachmentSelection ticket={currentTicket} field={field} selected={form.watch("attachmentIds")} inputRef={form.register("attachmentIds").ref} /> }];
  return <>
    <Modal open title={action ? "Edit Action" : "Create Action"} size="lg" onClose={close}>
      <CommonForm form={form} sections={sections} onSubmit={submit} onCancel={close} submitLabel={action ? "Save Changes" : "Create Action"} submitting={busy} cancelDisabled={busy} submitDisabled={Boolean(recovery) || !editable} disabled={busy || !editable} >
        {recovery && <Button disabled={busy} onClick={() => void reloadLatest()}>{recovery === "conflict" ? "Reload latest" : "Refresh"}</Button>}
        {latest && <details className="mt-3"><summary>Latest saved Action (your draft is retained)</summary><p className="text-break">{latest.description}</p><p className="text-break">{latest.result}</p><p className="text-break">{latest.followUpNote}</p><p className="text-break">{latest.attachmentNotes}</p></details>}
      </CommonForm>
    </Modal>
    <Modal open={discard !== null} title="Discard changes?" onClose={() => { setDiscard(null); cancelNavigation(); }} footer={<><Button onClick={() => { setDiscard(null); cancelNavigation(); }}>Keep Editing</Button><Button variant="destructive" onClick={() => { const next = discard; setDiscard(null); next?.(); }}>Discard Changes</Button></>}><p>Your unsaved Action changes will be discarded.</p></Modal>
  </>;
}
