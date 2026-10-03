import { Link } from "react-router-dom";
import { CompactTable, DashboardFrame, DashboardSkeleton, MetricCards, useDashboardSizes } from "./DashboardShared.js";
import { useDashboard } from "./useDashboard.js";
import type { RequesterDashboardDTO, RequesterRecentTicket } from "./types.js";
import { INITIAL_QUERY, writeTicketQuery } from "../Tickets/ticketListQuery.js";
import { PriorityChip } from "../Tickets/components/PriorityChip.js";
import { StatusChip } from "../Tickets/components/StatusChip.js";
import { ticketDateTime } from "../Tickets/ticketDate.js";
import type { IColumn } from "../../components/Maintain/DataTable.js";
const columns: IColumn<RequesterRecentTicket>[] = [
  { key: "ticketNumber", label: "Ticket Number" }, { key: "summary", label: "Summary" },
  { key: "requestedPriority", label: "Requested Priority", render: (_, row) => <PriorityChip value={row.requestedPriority} /> },
  { key: "currentStatus", label: "Status", render: (_, row) => <StatusChip value={row.currentStatus} /> },
  { key: "updatedAt", label: "Updated At", render: (_, row) => ticketDateTime(row.updatedAt) },
];
export default function RequesterDashboard() {
  const sizes = useDashboardSizes();
  const state = useDashboard<RequesterDashboardDTO>(`/api/users/me/dashboard?${sizes.query}`, sizes.scope);
  const data = state.data;
  const drill = (currentStatus: string[]) => `/tickets?${writeTicketQuery({ ...INITIAL_QUERY, currentStatus })}`;
  return <DashboardFrame {...state} hasData={!!data} loadingContent={<DashboardSkeleton requester tables={[{ title: "Recently Updated", columns: columns.map((column) => column.label), size: sizes.size("recentTicketsSize") }]} />}>{data ? <>
    <MetricCards requester cards={[
      { label: "Active Tickets", count: data.metrics.activeTickets, to: drill(["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"]) },
      { label: "Waiting for Me", count: data.metrics.waitingForRequester, to: drill(["WAITING_FOR_REQUESTER"]) },
      { label: "Resolved", count: data.metrics.resolvedTickets, to: drill(["RESOLVED"]) },
      { label: "Closed", count: data.metrics.closedTickets, to: drill(["CLOSED"]) },
    ]} />
    <section className="d-md-none mb-4" aria-label="Quick Actions"><h2 className="h5">Quick Actions</h2><div className="d-grid gap-2"><Link className="btn btn-primary" to="/tickets/new">Create Ticket</Link><Link className="btn btn-outline-secondary" to="/tickets">View My Tickets</Link></div></section>
    <CompactTable basePath="/tickets" title="Recently Updated" rows={data.recentTickets} columns={columns} size={sizes.size("recentTicketsSize")} onSize={(size) => sizes.setSize("recentTicketsSize", size)} rowLink={(row) => `/tickets/${row.publicId}`} empty="No recent tickets" emptyDescription="Your recently updated tickets will appear here." />
  </> : null}</DashboardFrame>;
}
