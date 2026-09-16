import type { Ticket } from "../api.js";

export interface TicketOwnerDTO { publicId: string; name: string; role: "IT_STAFF" | "ADMINISTRATOR" }
export type StaffTicket = Ticket & { owner: TicketOwnerDTO | null; itPriority: Ticket["requestedPriority"]; requesterResolutionConfirmedAt: string | null };
export type StaffTicketListItemDTO = Pick<StaffTicket, "publicId" | "ticketNumber" | "requesterName" | "categoryId" | "categoryName" | "summary" | "requestedPriority" | "itPriority" | "currentStatus" | "owner" | "createdAt" | "updatedAt">;
export const STATUSES: Ticket["currentStatus"][] = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"];
export const PRIORITIES = ["HIGH", "MEDIUM", "LOW"] as const;
export const statusLabel = (status: string) => status.replaceAll("_", " ");
export interface QueueFilter { field: string; condition: string; value: string | number | string[] }
export const DEFAULT_QUEUE_FILTERS: QueueFilter[] = [
  { field: "currentStatus", condition: "NOTEQUAL", value: "CLOSED" },
  { field: "currentStatus", condition: "NOTEQUAL", value: "CANCELLED" },
];
export const ACTION_LABELS = {
  "start-work": "Start Work", "request-information": "Request Information", "resume-work": "Resume Work",
  "mark-resolved": "Mark Resolved", close: "Close Ticket", cancel: "Cancel Ticket", claim: "Claim Ticket",
} as const;
export type StaffAction = keyof typeof ACTION_LABELS;

export function availableStaffActions(ticket: StaffTicket, user: { publicId: string; role: string }): StaffAction[] {
  const actions: StaffAction[] = [];
  const owner = ticket.owner?.publicId === user.publicId;
  const staff = user.role === "IT_STAFF";
  if (!staff && user.role !== "ADMINISTRATOR") return actions;
  if (staff && !ticket.owner && !["CLOSED", "CANCELLED"].includes(ticket.currentStatus)) actions.push("claim");
  if (owner) {
    if (["OPEN", "REOPENED"].includes(ticket.currentStatus)) actions.push("start-work");
    if (["OPEN", "IN_PROGRESS", "REOPENED"].includes(ticket.currentStatus)) actions.push("request-information");
    if (ticket.currentStatus === "WAITING_FOR_REQUESTER") actions.push("resume-work");
    if (["IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"].includes(ticket.currentStatus)) actions.push("mark-resolved");
    if (ticket.currentStatus === "RESOLVED" && ticket.requesterResolutionConfirmedAt) actions.push("close");
  }
  if ((staff || owner) && ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"].includes(ticket.currentStatus)) actions.push("cancel");
  return actions;
}
