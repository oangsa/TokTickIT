import type { Prisma } from "../generated/prisma/client.js";
import { toAttachmentDTO } from "./ticketRepresentation.js";
import { USER_SUMMARY_SELECT, type UserSummaryDTO } from "./staffTicketReadService.js";

export const ACTION_LIST_SELECT = {
  publicId: true, ticket: { select: { publicId: true } }, status: true, description: true,
  assignedTo: { select: USER_SUMMARY_SELECT }, performedBy: { select: { publicId: true, name: true, role: true } },
  followUpRequired: true, isMigrated: true, createdAt: true, updatedAt: true, version: true,
} satisfies Prisma.ActionTakenSelect;
export const ACTION_DETAIL_INCLUDE = {
  ticket: { select: { publicId: true } }, creator: { select: { publicId: true, name: true } },
  assignedTo: { select: USER_SUMMARY_SELECT }, performedBy: { select: { publicId: true, name: true, role: true } },
  attachments: { orderBy: { attachmentId: "asc" }, include: { attachment: { omit: { data: true } } } },
} satisfies Prisma.ActionTakenInclude;
export type ActionDetailRow = Prisma.ActionTakenGetPayload<{ include: typeof ACTION_DETAIL_INCLUDE }>;
type ActionListRow = Prisma.ActionTakenGetPayload<{ select: typeof ACTION_LIST_SELECT }>;
export function toUserSummary(user: ActionListRow["assignedTo"]): UserSummaryDTO | null {
  return user && (user.role === "IT_STAFF" || user.role === "ADMINISTRATOR") ? { publicId: user.publicId, name: user.name, email: user.email, role: user.role } : null;
}
export function toActionListDTO(row: ActionListRow) {
  return { publicId: row.publicId, ticketPublicId: row.ticket.publicId, status: row.status, description: row.description,
    assignedTo: toUserSummary(row.assignedTo), performedBy: row.performedBy ? { publicId: row.performedBy.publicId, name: row.performedBy.name, role: row.performedBy.role } : null,
    followUpRequired: row.followUpRequired, isMigrated: row.isMigrated, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), version: row.version };
}
export type ActionTakenListItemDTO = ReturnType<typeof toActionListDTO>;
export function toActionDTO(row: ActionDetailRow) {
  return { ...toActionListDTO(row), result: row.result, followUpNote: row.followUpNote, attachmentNotes: row.attachmentNotes,
    cancellationReason: row.cancellationReason, creator: { publicId: row.creator.publicId, name: row.creator.name },
    attachments: row.attachments.map(({ attachment }) => toAttachmentDTO(attachment, row.ticket.publicId)),
    startedAt: row.startedAt?.toISOString() ?? null, completedAt: row.completedAt?.toISOString() ?? null, cancelledAt: row.cancelledAt?.toISOString() ?? null,
    createdBy: row.createdBy, updatedBy: row.updatedBy };
}
export type ActionTakenDTO = ReturnType<typeof toActionDTO>;
