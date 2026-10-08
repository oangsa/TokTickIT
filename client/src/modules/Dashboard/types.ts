import type { Ticket } from "../../api.js";
import type { ActionListItem, UserSummary } from "../Actions/types.js";
export type RequesterRecentTicket = Pick<Ticket, "publicId" | "ticketNumber" | "summary" | "requestedPriority" | "currentStatus" | "updatedAt">;
export interface RequesterDashboardDTO {
  metrics: { activeTickets: number; waitingForRequester: number; resolvedTickets: number; closedTickets: number };
  recentTickets: RequesterRecentTicket[];
}
export type StaffRecentTicket = Omit<RequesterRecentTicket, "requestedPriority"> & { requesterName: string; itPriority: Ticket["requestedPriority"]; owner: UserSummary | null };
export type DashboardAction = Pick<ActionListItem, "publicId" | "ticketPublicId" | "description" | "status" | "assignedTo" | "performedBy"> & { ticketNumber: string; activityAt: string };
export interface StaffDashboardDTO {
  metrics: { unassignedTickets: number; myAssignedTickets: number; inProgressTickets: number; waitingForRequester: number; highPriorityTickets: number };
  myActions: DashboardAction[]; recentTickets: StaffRecentTicket[]; urgentTickets: StaffRecentTicket[];
}
