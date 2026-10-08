import { useMemo, useRef, useState } from "react";
import { ApiResponseError } from "../../api.js";
import { useAuthenticatedApi } from "../../auth/useAuthenticatedApi.js";
import { LookupModal } from "../../components/Common/Lookup/LookupModal.js";
import { Modal } from "../../components/Common/Modal.js";
import { Button } from "../../components/Common/Button.js";
import { userLookup, type AssignableUser } from "../../lookups/index.js";
import { actionApiPath, isTerminal, type ActionTaken } from "./types.js";

export interface ActionAssigneeSelectionProps { action: ActionTaken; unassign?: boolean; onClose: () => void; onSaved: (action: ActionTaken) => void }
export function ActionAssigneeSelection({ action, unassign = false, onClose, onSaved }: ActionAssigneeSelectionProps) {
  const request = useAuthenticatedApi();
  const definition = useMemo(() => userLookup(request), [request]);
  const [canonical, setCanonical] = useState(action);
  const [selection, setSelection] = useState<AssignableUser | null>(null);
  const [lookupOpen, setLookupOpen] = useState(!unassign);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [feedback, setFeedback] = useState("");
  const [recovery, setRecovery] = useState<"conflict" | "transition" | "eligibility" | null>(null);
  async function save() {
    if (lock.current || recovery || isTerminal(canonical) || (!unassign && !selection)) return;
    lock.current = true; setBusy(true); setFeedback("");
    try {
      const updated = await request<ActionTaken>(`${actionApiPath(action.ticketPublicId, false, action.publicId)}/assignee`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assignedToUserPublicId: unassign ? null : selection?.publicId, expectedVersion: canonical.version }) });
      onSaved(updated);
    } catch (error) {
      if (error instanceof ApiResponseError && error.code === "CONFLICT") { setRecovery("conflict"); setFeedback("This Action changed. Your selection is preserved. Reload latest before assigning again."); }
      else if (error instanceof ApiResponseError && error.status === 400) { setRecovery("eligibility"); setFeedback("The selected User is no longer eligible. Choose another User."); }
      else if (error instanceof ApiResponseError && [403, 409].includes(error.status)) { setRecovery("transition"); setFeedback("This Action or your permission changed. Refresh its current state."); }
      else setFeedback("Assignment could not be saved. Your selection is preserved. Please retry.");
    } finally { lock.current = false; setBusy(false); }
  }
  async function reload() {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try {
      const loaded = await request<ActionTaken>(actionApiPath(action.ticketPublicId, false, action.publicId));
      setCanonical(loaded); setRecovery(null); setFeedback(isTerminal(loaded) ? "This Action is now read-only." : "Latest Action loaded. Review your retained selection before confirming.");
    } catch { setFeedback("Latest Action could not be loaded. Please retry."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <>
    <LookupModal open={lookupOpen} definition={definition} onClose={onClose} onSelect={(row) => { setSelection(row); setLookupOpen(false); setRecovery(null); setFeedback(""); }} />
    <Modal open={!lookupOpen} title={unassign ? "Unassign this Action?" : `Assign this Action to ${selection?.name ?? "selected User"}?`} onClose={() => !lock.current && onClose()} footer={<><Button disabled={busy} onClick={onClose}>{unassign ? "Keep Assignment" : "Cancel"}</Button><Button variant="primary" busy={busy} disabled={Boolean(recovery) || isTerminal(canonical)} onClick={() => void save()}>{unassign ? "Unassign" : "Assign"}</Button></>}>
      <p>{unassign ? "The Action will remain in its current status, but it cannot be started while unassigned." : `Current assignment: ${canonical.assignedTo?.name ?? "Unassigned"}. Selected User: ${selection?.name ?? "None"}.`}</p>
      {feedback && <p role="alert">{feedback}</p>}
      {recovery === "eligibility" && <Button disabled={busy} onClick={() => setLookupOpen(true)}>Choose another User</Button>}
      {(recovery === "conflict" || recovery === "transition") && <Button disabled={busy} onClick={() => void reload()}>{recovery === "conflict" ? "Reload latest" : "Refresh"}</Button>}
    </Modal>
  </>;
}
