import { useAuth } from "../../auth/AuthProvider.js";
import { CompactTable, DashboardFrame, DashboardSkeleton, MetricCards, useDashboardSizes } from "./DashboardShared.js";
import { useDashboard } from "./useDashboard.js";
import type { StaffDashboardDTO, StaffRecentTicket, DashboardAction } from "./types.js";
import { DEFAULT_QUEUE_FILTERS, type QueueFilter } from "../Tickets/staffTickets.js";
import { PriorityChip } from "../Tickets/components/PriorityChip.js";
import { StatusChip } from "../Tickets/components/StatusChip.js";
import { ticketDateTime } from "../Tickets/ticketDate.js";
import type { IColumn } from "../../components/Maintain/DataTable.js";
const ticketColumns: IColumn<StaffRecentTicket>[] = [
  { key: "ticketNumber", label: "Ticket Number" }, { key: "summary", label: "Summary" }, { key: "requesterName", label: "Requester" },
  { key: "itPriority", label: "IT Priority", render: (_, row) => <PriorityChip value={row.itPriority} /> },
  { key: "currentStatus", label: "Status", render: (_, row) => <StatusChip value={row.currentStatus} /> },
  { key: "owner", label: "Owner", render: (_, row) => row.owner?.name ?? "Unassigned" },
  { key: "updatedAt", label: "Updated At", render: (_, row) => ticketDateTime(row.updatedAt) },
];
const actionColumns: IColumn<DashboardAction>[] = [
  { key: "description", label: "Description" }, { key: "ticketNumber", label: "Ticket" },
  { key: "status", label: "Status", render: (_, row) => <StatusChip value={row.status} /> },
  { key: "assignedTo", label: "Assigned To", render: (_, row) => row.assignedTo?.name ?? "Unassigned" },
  { key: "performedBy", label: "Performed By", render: (_, row) => row.performedBy?.name ?? "—" },
  { key: "activityAt", label: "Activity Time", render: (_, row) => ticketDateTime(row.activityAt) },
];
export default function StaffDashboard() {
  const { user } = useAuth();
  const sizes = useDashboardSizes(true);
  const state = useDashboard<StaffDashboardDTO>(`/api/dashboard?${sizes.query}`, sizes.scope);
  const data = state.data;
  const base = user?.role === "ADMINISTRATOR" ? "/admin/tickets" : "/staff/tickets";
  const drill = (filter: QueueFilter, nonTerminal = true) => `${base}?${new URLSearchParams({ filters: JSON.stringify([...(nonTerminal ? DEFAULT_QUEUE_FILTERS : []), filter]) })}`;
  const ticketLink = (row: StaffRecentTicket) => `${base}/${row.publicId}`;
  return <DashboardFrame {...state} hasData={!!data} loadingContent={<DashboardSkeleton tables={[
    { title: "My Actions Taken", columns: actionColumns.map((column) => column.label), size: sizes.size("myActionsSize") },
    { title: "Recently Updated Tickets", columns: ticketColumns.map((column) => column.label), size: sizes.size("recentTicketsSize") },
    { title: "Urgent Tickets", columns: ticketColumns.map((column) => column.label), size: sizes.size("urgentTicketsSize") },
  ]} />}>{data ? <>
    <MetricCards cards={[
      { label: "Unassigned", count: data.metrics.unassignedTickets, to: drill({ field: "ownerPublicId", condition: "ISNULL", value: "" }) },
      { label: "My Assigned", count: data.metrics.myAssignedTickets, to: drill({ field: "ownerPublicId", condition: "EQUAL", value: user!.publicId }) },
      { label: "In Progress", count: data.metrics.inProgressTickets, to: drill({ field: "currentStatus", condition: "EQUAL", value: "IN_PROGRESS" }, false) },
      { label: "Waiting for Requester", count: data.metrics.waitingForRequester, to: drill({ field: "currentStatus", condition: "EQUAL", value: "WAITING_FOR_REQUESTER" }, false) },
      { label: "High Priority", count: data.metrics.highPriorityTickets, to: drill({ field: "itPriority", condition: "EQUAL", value: "HIGH" }) },
    ]} />
    <CompactTable basePath={base} title="My Actions Taken" rows={data.myActions} columns={actionColumns} size={sizes.size("myActionsSize")} onSize={(size) => sizes.setSize("myActionsSize", size)} rowLink={(row) => `${base}/${row.ticketPublicId}/actions/${row.publicId}`} empty="No actions assigned to or performed by you" />
    <CompactTable basePath={base} title="Recently Updated Tickets" rows={data.recentTickets} columns={ticketColumns} size={sizes.size("recentTicketsSize")} onSize={(size) => sizes.setSize("recentTicketsSize", size)} rowLink={ticketLink} empty="No recent tickets" />
    <CompactTable basePath={base} title="Urgent Tickets" rows={data.urgentTickets} columns={ticketColumns} size={sizes.size("urgentTicketsSize")} onSize={(size) => sizes.setSize("urgentTicketsSize", size)} rowLink={ticketLink} empty="No urgent tickets" />
  </> : null}</DashboardFrame>;
}
