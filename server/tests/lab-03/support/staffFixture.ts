import { vi } from "vitest";
import type { Prisma, PrismaClient } from "../../../src/generated/prisma/client.js";
import { testUser } from "../../lab-02/support/authenticatedRequester.js";
import type { TicketActor } from "../../../src/services/ticketWorkflowService.js";

export const STAFF = { ...testUser({ id: 11, name: "Staff User", email: "staff@example.test" }), role: "IT_STAFF" as const };
export const ADMIN = { ...testUser({ id: 12, name: "Admin User", email: "admin@example.test" }), role: "ADMINISTRATOR" as const };
export const REQUESTER = testUser({ id: 13, name: "Requester User", email: "requester@example.test" });
export const TICKET_ID = "10000000-0000-4000-8000-000000000011";
export const actor = (user = STAFF as typeof STAFF | typeof ADMIN): TicketActor => ({ userId: user.id, userPublicId: user.publicId, email: user.email, role: user.role });
export function staffTicketRow(overrides: Record<string, unknown> = {}) {
  return { id: 31, publicId: TICKET_ID, ticketNumber: "TKT-20260916-000000000011", requesterId: REQUESTER.id, requester: REQUESTER,
    ownerUserId: null, owner: null, categoryId: 1, category: { name: "Network" }, relatedSystemId: 1, relatedSystem: { name: "VPN" },
    summary: "VPN unavailable", description: "Cannot access VPN", requestedPriority: "MEDIUM", itPriority: "HIGH", currentStatus: "NEW",
    requesterResolutionConfirmedAt: null, attachments: [], deleted: false, createdAt: new Date("2026-09-16T00:00:00Z"), updatedAt: new Date("2026-09-16T00:00:00Z"), createdBy: "fixture", updatedBy: "fixture", ...overrides };
}
export function staffPrismaMock() {
  const mock = {
    ticket: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), updateMany: vi.fn() },
    user: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
    userSession: { findUnique: vi.fn() },
    attachment: { findFirst: vi.fn() },
    publicComment: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  mock.$transaction.mockImplementation(async (callback: (tx: Prisma.TransactionClient) => Promise<unknown>) => callback(mock as unknown as Prisma.TransactionClient));
  mock.ticket.findFirst.mockResolvedValue(staffTicketRow());
  mock.ticket.findUnique.mockResolvedValue(staffTicketRow());
  mock.ticket.updateMany.mockResolvedValue({ count: 1 });
  mock.user.findFirst.mockResolvedValue(STAFF);
  mock.ticket.findMany.mockResolvedValue([]);
  mock.ticket.count.mockResolvedValue(0);
  mock.user.findMany.mockResolvedValue([]);
  return { mock, prisma: mock as unknown as PrismaClient };
}

export function staffListRow(overrides: Record<string, unknown> = {}) {
  const row = staffTicketRow(overrides);
  return { publicId: row.publicId, ticketNumber: row.ticketNumber, requester: row.requester,
    categoryId: row.categoryId, category: row.category, summary: row.summary,
    requestedPriority: row.requestedPriority, itPriority: row.itPriority, currentStatus: row.currentStatus,
    owner: row.owner, createdAt: row.createdAt, updatedAt: row.updatedAt };
}
