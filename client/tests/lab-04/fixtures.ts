import type { Ticket, ApiRequestInit } from "../../src/api.js";
import type { ActionTaken } from "../../src/modules/Actions/types.js";
export const staff = { publicId: "10000000-0000-4000-8000-000000000001", name: "Alex Staff", email: "alex@example.test", role: "IT_STAFF" as const };
export const other = { ...staff, publicId: "10000000-0000-4000-8000-000000000002", name: "Other Staff" };
export const ticket: Ticket = { publicId: "20000000-0000-4000-8000-000000000001", ticketNumber: "TKT-20261001-000000000001", requesterId: 1, requesterName: "Requester", requesterEmail: "requester@example.test", categoryId: 1, categoryName: "Network", relatedSystemId: 1, relatedSystemName: "VPN", summary: "VPN issue", description: "Ticket details", requestedPriority: "MEDIUM", currentStatus: "OPEN", owner: staff, attachments: [], createdBy: "test", updatedBy: "test", createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z", deleted: false };
export const action: ActionTaken = { publicId: "30000000-0000-4000-8000-000000000001", ticketPublicId: ticket.publicId, creatorPublicId: staff.publicId, status: "PLANNED", description: "Inspect port", result: null, followUpRequired: false, followUpNote: null, attachmentNotes: "Rack photo", cancellationReason: null, creator: staff, assignedTo: staff, performedBy: null, attachments: [], isMigrated: false, version: 2, startedAt: null, completedAt: null, cancelledAt: null, createdBy: "test", updatedBy: "test", createdAt: ticket.createdAt, updatedAt: ticket.updatedAt };
export function paged<T>(items: T[], init?: ApiRequestInit, total = items.length, page = 1, size = 10) {
  init?.onResponse?.(new Response(null, { headers: { "X-Pagination": JSON.stringify({ pageNumber: page, pageSize: size, totalItems: total, totalPages: Math.ceil(total / size), hasPreviousPage: page > 1, hasNextPage: page * size < total }) } }));
  return items;
}
