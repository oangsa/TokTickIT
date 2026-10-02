import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider.js";
import { useAuthenticatedApi } from "../../auth/useAuthenticatedApi.js";
import { fetchCollection } from "../../collections/fetchCollection.js";
import { Card } from "../../components/Common/Card.js";
import { Button } from "../../components/Common/Button.js";
import { Select } from "../../components/Common/Form/Select.js";
import { ErrorState } from "../../components/Common/Feedback/ErrorState.js";
import { ticketDateTime } from "../Tickets/ticketDate.js";
import { actionApiPath, type ActivityType, type TicketActivity } from "./types.js";

const EVENTS: Record<ActivityType, string> = {
  MIGRATED_TICKET_SNAPSHOT: "recorded a Ticket snapshot during migration.",
  TICKET_ASSIGNED: "assigned the Ticket.", TICKET_REASSIGNED: "reassigned the Ticket.", TICKET_UNASSIGNED: "unassigned the Ticket.",
  IT_PRIORITY_CHANGED: "changed the IT Priority.", TICKET_STARTED_WORK: "started work on the Ticket.", INFORMATION_REQUESTED: "requested information from the Requester.",
  TICKET_RESUMED: "resumed work on the Ticket.", TICKET_MARKED_RESOLVED: "marked the Ticket resolved.", REQUESTER_RESOLUTION_CONFIRMED: "confirmed the problem appears resolved.",
  TICKET_CLOSED: "closed the Ticket.", TICKET_CANCELLED: "cancelled the Ticket.", TICKET_REOPENED: "reopened the Ticket.",
  ACTION_CREATED: "created an Action.", ACTION_UPDATED: "updated an Action.", ACTION_ASSIGNED: "assigned an Action.", ACTION_REASSIGNED: "reassigned an Action.", ACTION_UNASSIGNED: "unassigned an Action.", ACTION_STARTED: "started an Action.", ACTION_COMPLETED: "completed an Action.", ACTION_CANCELLED: "cancelled an Action.",
};
export interface ActivityTimelineProps { ticketPublicId: string; actionPublicId?: string; refreshTrigger?: number | string }
export function ActivityTimeline({ ticketPublicId, actionPublicId, refreshTrigger = 0 }: ActivityTimelineProps) {
  const { user } = useAuth();
  const request = useAuthenticatedApi();
  const allowed = user?.role === "IT_STAFF" || user?.role === "ADMINISTRATOR";
  const [category, setCategory] = useState("All");
  const [rows, setRows] = useState<TicketActivity[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [busy, setBusy] = useState(true);
  const [failedPage, setFailedPage] = useState<number | null>(null);
  const generation = useRef(0);
  const lock = useRef(false);
  const path = actionPublicId ? `${actionApiPath(ticketPublicId, false, actionPublicId)}/activity` : `/api/tickets/${encodeURIComponent(ticketPublicId)}/activity`;
  async function load(nextPage: number, current: number) {
    if (!allowed || lock.current) return;
    lock.current = true; setBusy(true); setFailedPage(null);
    const query = new URLSearchParams({ sort: actionPublicId ? "createdAt:asc" : "createdAt:desc", pageNumber: String(nextPage), pageSize: "10" });
    if (!actionPublicId && category !== "All") query.set("filters", JSON.stringify([{ field: "category", condition: "EQUAL", value: category }]));
    try {
      const result = await fetchCollection<TicketActivity>(request, `${path}?${query}`);
      if (current !== generation.current) return;
      setRows((existing) => nextPage === 1 ? result.data : [...existing, ...result.data.filter((item) => !existing.some((row) => row.publicId === item.publicId))]);
      setPage(nextPage); setHasNext(result.hasNext ?? false);
    } catch { if (current === generation.current) setFailedPage(nextPage); }
    finally { if (current === generation.current) { lock.current = false; setBusy(false); } }
  }
  useEffect(() => {
    const current = ++generation.current; lock.current = false; setRows([]); setPage(1); setHasNext(false);
    if (allowed) void load(1, current);
    return () => { generation.current++; };
    // load reads this effect's query scope; later pages use the current render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed, user?.publicId, path, category, refreshTrigger, request]);
  if (!allowed) return null;
  const rolePath = user?.role === "ADMINISTRATOR" ? "/admin/tickets" : "/staff/tickets";
  return <Card title="Activity" actions={!actionPublicId && <Select id="activity-category" label="Activity category" value={category} onChange={(event) => setCategory(event.target.value)}>{["All", "Ticket Workflow", "Assignment", "Priority", "Actions Taken"].map((value) => <option key={value}>{value}</option>)}</Select>}>
    {busy && rows.length === 0 && <p role="status">Loading activity…</p>}
    {failedPage !== null && <ErrorState title="Activity could not be loaded." onRetry={() => void load(failedPage, generation.current)} />}
    {!busy && failedPage === null && rows.length === 0 && <p className="text-secondary">No activity available.</p>}
    <ol className="tt-activity list-unstyled mb-0">{rows.map((event) => <li key={event.publicId} className="border-start ps-3 pb-3 text-break">
      <time className="small text-secondary" dateTime={event.createdAt}>{ticketDateTime(event.createdAt)}</time>
      <p className="mb-1">{event.performedBy.isSystem ? "System" : event.performedBy.name} {EVENTS[event.action]}</p>
      {event.assignment && <p className="small mb-1">{event.action === "MIGRATED_TICKET_SNAPSHOT" ? "Owner at migration: " : `Owner: ${event.assignment.previousAssignedTo?.name ?? "Unassigned"} to `}{event.assignment.assignedTo?.name ?? "Unassigned"}.</p>}
      {event.actionTaken && <div className="small mb-1">{["ACTION_ASSIGNED", "ACTION_REASSIGNED", "ACTION_UNASSIGNED"].includes(event.action) && <p className="mb-1">Assignee: {event.actionTaken.previousAssignedTo?.name ?? "Unassigned"} to {event.actionTaken.assignedTo?.name ?? "Unassigned"}.</p>}{!actionPublicId && <Link to={`${rolePath}/${encodeURIComponent(ticketPublicId)}/actions/${encodeURIComponent(event.actionTaken.publicId)}`}>View Action</Link>}</div>}
      {event.statusChange && <p className="small mb-1">{event.action === "MIGRATED_TICKET_SNAPSHOT" ? "Status at migration: " : `Status: ${event.statusChange.previousStatus?.replaceAll("_", " ") ?? "Unknown"} to `}{event.statusChange.status.replaceAll("_", " ")}.</p>}
      {event.priorityChange && <p className="small mb-1">{event.action === "MIGRATED_TICKET_SNAPSHOT" ? "IT Priority at migration: " : `IT Priority: ${event.priorityChange.previousPriority ?? "Unknown"} to `}{event.priorityChange.priority}.</p>}
      {event.action === "MIGRATED_TICKET_SNAPSHOT" && <p className="small text-secondary">Historical snapshot only; earlier events were not reconstructed.</p>}
    </li>)}</ol>
    {hasNext && failedPage === null && <Button busy={busy} onClick={() => void load(page + 1, generation.current)}>Load More</Button>}
  </Card>;
}
