import type { Prisma } from "../generated/prisma/client.js";

/*
 * Everything the full TicketDTO needs in one query (api-spec Section 5.5).
 * Category and Related System are loaded by relation rather than re-validated,
 * because Ticket metadata is historical: a Ticket keeps resolving its names
 * after the master row goes inactive or is logically deleted (BR-72-73).
 *
 * `data` is omitted: the Attachment DTO carries `sizeBytes`, never the bytes.
 * Without this, every create, replay, and detail read pulls up to five
 * 5,000,000-byte blobs (MAX_ATTACHMENT_BYTES) into memory only to discard them.
 */
export const TICKET_DTO_INCLUDE = {
  requester: true,
  owner: { select: { publicId: true, name: true, role: true } },
  category: true,
  relatedSystem: true,
  attachments: { orderBy: { id: "asc" }, omit: { data: true } },
} satisfies Prisma.TicketInclude;

export type TicketWithRelations = Prisma.TicketGetPayload<{ include: typeof TICKET_DTO_INCLUDE }>;

type AttachmentRow = TicketWithRelations["attachments"][number];

export interface AttachmentDTO {
  attachmentId: string;
  ticketPublicId: string | null;
  originalName: string;
  extension: string;
  mimeType: string;
  sizeBytes: number;
  removalReason: string | null;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  deleted: boolean;
}

export interface TicketDTO {
  publicId: string;
  ticketNumber: string;
  requesterId: number;
  requesterPublicId: string;
  requesterName: string;
  requesterEmail: string;
  categoryId: number;
  categoryName: string;
  relatedSystemId: number;
  relatedSystemName: string;
  summary: string;
  description: string;
  requestedPriority: "LOW" | "MEDIUM" | "HIGH";
  itPriority: "LOW" | "MEDIUM" | "HIGH";
  currentStatus: "NEW" | "OPEN" | "IN_PROGRESS" | "WAITING_FOR_REQUESTER" | "RESOLVED" | "CLOSED" | "REOPENED" | "CANCELLED";
  owner: { publicId: string; name: string; role: "IT_STAFF" | "ADMINISTRATOR" } | null;
  requesterResolutionConfirmedAt: string | null;
  attachments: AttachmentDTO[];
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  deleted: boolean;
}

/*
 * The public Attachment identifier is the opaque storageKey, never the row id.
 *
 * Exported for `attachmentService.ts`, which answers the same DTO from the
 * standalone Attachment endpoints. One mapper, so a field can never be spelled
 * one way inside a Ticket and another way beside it.
 */
export function toAttachmentDTO(row: AttachmentRow, ticketPublicId: string | null): AttachmentDTO {
  return {
    attachmentId: row.storageKey,
    ticketPublicId: row.ticketId === null ? null : ticketPublicId,
    originalName: row.originalName,
    extension: row.extension,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    removalReason: row.removalReason,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt.toISOString(),
    deleted: row.deleted,
  };
}

export function toTicketDTO(ticket: TicketWithRelations): TicketDTO {
  return {
    publicId: ticket.publicId,
    ticketNumber: ticket.ticketNumber,
    requesterId: ticket.requesterId,
    requesterPublicId: ticket.requester.publicId,
    requesterName: ticket.requester.name,
    requesterEmail: ticket.requester.email,
    categoryId: ticket.categoryId,
    categoryName: ticket.category.name,
    relatedSystemId: ticket.relatedSystemId,
    relatedSystemName: ticket.relatedSystem.name,
    summary: ticket.summary,
    description: ticket.description,
    requestedPriority: ticket.requestedPriority,
    itPriority: ticket.itPriority,
    currentStatus: ticket.currentStatus,
    owner:
      ticket.owner == null ||
      (ticket.owner.role !== "IT_STAFF" && ticket.owner.role !== "ADMINISTRATOR")
        ? null
        : {
            publicId: ticket.owner.publicId,
            name: ticket.owner.name,
            role: ticket.owner.role,
          },
    requesterResolutionConfirmedAt: ticket.requesterResolutionConfirmedAt?.toISOString() ?? null,
    attachments: ticket.attachments.map((row) => toAttachmentDTO(row, ticket.publicId)),
    createdBy: ticket.createdBy,
    createdAt: ticket.createdAt.toISOString(),
    updatedBy: ticket.updatedBy,
    updatedAt: ticket.updatedAt.toISOString(),
    deleted: ticket.deleted,
  };
}
