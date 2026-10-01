import type { Prisma } from "../generated/prisma/client.js";
import { USER_SUMMARY_SELECT } from "./staffTicketReadService.js";
import { toUserSummary } from "./actionTakenRepresentation.js";
export const ACTIVITY_SELECT = {
  publicId: true, ticket: { select: { publicId: true } }, action: true, createdAt: true,
  performedBy: { select: { publicId: true, name: true, role: true, isSystem: true } },
  assignment: { select: { previousOwner: { select: USER_SUMMARY_SELECT }, assignedOwner: { select: USER_SUMMARY_SELECT } } },
  status: { select: { previousStatus: true, status: true } },
  priority: { select: { previousPriority: true, priority: true } },
  actionTaken: { select: { actionTaken: { select: { publicId: true } }, previousAssignee: { select: USER_SUMMARY_SELECT }, assignedAssignee: { select: USER_SUMMARY_SELECT } } },
} satisfies Prisma.TicketActivitySelect;
export type ActivityRow = Prisma.TicketActivityGetPayload<{ select: typeof ACTIVITY_SELECT }>;
export function toActivityDTO(row: ActivityRow) {
  return { publicId: row.publicId, ticketPublicId: row.ticket.publicId, action: row.action,
    performedBy: { publicId: row.performedBy.publicId, name: row.performedBy.name, role: row.performedBy.role, isSystem: row.performedBy.isSystem },
    ...(row.assignment ? { assignment: { previousAssignedTo: toUserSummary(row.assignment.previousOwner), assignedTo: toUserSummary(row.assignment.assignedOwner) } } : {}),
    ...(row.status ? { statusChange: { previousStatus: row.status.previousStatus, status: row.status.status } } : {}), ...(row.priority ? { priorityChange: { previousPriority: row.priority.previousPriority, priority: row.priority.priority } } : {}),
    ...(row.actionTaken ? { actionTaken: { publicId: row.actionTaken.actionTaken.publicId, previousAssignedTo: toUserSummary(row.actionTaken.previousAssignee), assignedTo: toUserSummary(row.actionTaken.assignedAssignee) } } : {}),
    createdAt: row.createdAt.toISOString() };
}
export type TicketActivityDTO = ReturnType<typeof toActivityDTO>;
