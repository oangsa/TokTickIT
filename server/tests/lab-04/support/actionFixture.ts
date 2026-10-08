import { vi } from "vitest";
import type { PrismaClient } from "../../../src/generated/prisma/client.js";
import { STAFF, REQUESTER, TICKET_ID, staffPrismaMock, staffTicketRow } from "../../lab-03/support/staffFixture.js";
export const ACTION_ID = "20000000-0000-4000-8000-000000000011";
export const createBody = { description: " Inspect cable ", assignedToUserPublicId: null, followUpRequired: false, followUpNote: null, attachmentNotes: null, attachmentIds: [] };
export function actionRow(overrides: Record<string, unknown> = {}) {
  return { id: 51, publicId: ACTION_ID, ticketId: 31, ticket: { publicId: TICKET_ID }, creatorUserId: STAFF.id, creator: STAFF,
    assignedToUserId: null, assignedTo: null, performedByUserId: null, performedBy: null, status: "PLANNED", description: "Inspect cable", result: null,
    followUpRequired: false, followUpNote: null, attachmentNotes: null, cancellationReason: null, attachments: [], isMigrated: false, version: 1,
    startedAt: null, completedAt: null, cancelledAt: null, createdAt: new Date("2026-10-01T00:00:00Z"), updatedAt: new Date("2026-10-01T00:00:00Z"), createdBy: STAFF.email, updatedBy: STAFF.email, ...overrides };
}
export function actionPrismaMock() {
  const base = staffPrismaMock().mock;
  const mock = { ...base,
    actionTaken: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    actionTakenAttachment: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
    ticketActivity: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    attachment: { ...base.attachment, findMany: vi.fn() },
    idempotencyRecord: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
  };
  mock.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback(mock));
  mock.ticket.findFirst.mockResolvedValue(staffTicketRow({ currentStatus: "OPEN", ownerUserId: STAFF.id, requesterId: REQUESTER.id }));
  mock.actionTaken.create.mockResolvedValue(actionRow());
  mock.actionTaken.findFirst.mockResolvedValue(actionRow());
  mock.actionTaken.updateMany.mockResolvedValue({ count: 1 });
  mock.actionTaken.count.mockResolvedValue(1);
  mock.actionTaken.findMany.mockResolvedValue([actionRow()]);
  mock.attachment.findMany.mockResolvedValue([]);
  mock.actionTakenAttachment.findMany.mockResolvedValue([]);
  mock.idempotencyRecord.findUnique.mockResolvedValue(null);
  mock.idempotencyRecord.create.mockImplementation(async () => ({ id: 61, processingStartedAt: new Date() }));
  mock.$queryRaw.mockResolvedValue([{ id: 61 }]);
  return { mock, prisma: mock as unknown as PrismaClient };
}
