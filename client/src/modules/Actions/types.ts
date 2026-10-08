import type { Attachment, Ticket } from "../../api.js";
import type { UserRole } from "../../auth/authTypes.js";
export interface UserSummary { publicId: string; name: string; email: string; role: UserRole }
export type ActionStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export interface ActionListItem {
  publicId: string; ticketPublicId: string; creatorPublicId: string; status: ActionStatus; description: string;
  assignedTo: UserSummary | null; performedBy: Pick<UserSummary, "publicId" | "name" | "role"> | null;
  followUpRequired: boolean; isMigrated: boolean; createdAt: string; updatedAt: string; version: number;
}
export interface ActionTaken extends ActionListItem {
  result: string | null; followUpNote: string | null; attachmentNotes: string | null; cancellationReason: string | null;
  creator: { publicId: string; name: string }; attachments: Attachment[];
  startedAt: string | null; completedAt: string | null; cancelledAt: string | null; createdBy: string; updatedBy: string;
}
export type ActivityType = "MIGRATED_TICKET_SNAPSHOT" | "TICKET_ASSIGNED" | "TICKET_REASSIGNED" | "TICKET_UNASSIGNED" | "IT_PRIORITY_CHANGED" | "TICKET_STARTED_WORK" | "INFORMATION_REQUESTED" | "TICKET_RESUMED" | "TICKET_MARKED_RESOLVED" | "REQUESTER_RESOLUTION_CONFIRMED" | "TICKET_CLOSED" | "TICKET_CANCELLED" | "TICKET_REOPENED" | "ACTION_CREATED" | "ACTION_UPDATED" | "ACTION_ASSIGNED" | "ACTION_REASSIGNED" | "ACTION_UNASSIGNED" | "ACTION_STARTED" | "ACTION_COMPLETED" | "ACTION_CANCELLED";
export interface TicketActivity {
  publicId: string; ticketPublicId: string; action: ActivityType; createdAt: string;
  performedBy: Pick<UserSummary, "publicId" | "name" | "role"> & { isSystem: boolean };
  assignment?: { previousAssignedTo: UserSummary | null; assignedTo: UserSummary | null };
  actionTaken?: { publicId: string; previousAssignedTo: UserSummary | null; assignedTo: UserSummary | null };
  statusChange?: { previousStatus: Ticket["currentStatus"] | null; status: Ticket["currentStatus"] };
  priorityChange?: { previousPriority: Ticket["requestedPriority"] | null; priority: Ticket["requestedPriority"] };
}
export const isTerminal = (action: Pick<ActionListItem, "status">) => action.status === "COMPLETED" || action.status === "CANCELLED";
export function canEdit(action: ActionTaken, ticket: Ticket, user: Pick<UserSummary, "publicId" | "role">) {
  return user.role !== "REQUESTER" && !isTerminal(action) && [action.creator.publicId, action.assignedTo?.publicId, ticket.owner?.publicId].includes(user.publicId);
}
export function actionApiPath(ticketPublicId: string, requester = false, actionPublicId?: string) {
  return `${requester ? "/api/users/me/tickets" : "/api/tickets"}/${encodeURIComponent(ticketPublicId)}/actions${actionPublicId ? `/${encodeURIComponent(actionPublicId)}` : ""}`;
}
