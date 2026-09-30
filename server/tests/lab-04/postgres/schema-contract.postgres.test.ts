import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ActionTakenStatus, TicketActivityType, TicketPriority, TicketStatus } from "../../../src/generated/prisma/enums.js";
import { PrismaClient } from "../../../src/generated/prisma/client.js";
import { assertLab2TestDatabase, createRequesterUser, createTestPrisma, deployMigrations, type TestDatabaseTarget } from "../../lab-02/postgres/testDatabase.js";

describe("Lab 4 PostgreSQL schema @issue-78", () => {
  let target: TestDatabaseTarget;
  let prisma: PrismaClient;

  beforeAll(async () => {
    target = assertLab2TestDatabase();
    if (!/(^|[_-])lab3([_-]|$)/i.test(target.databaseName)) {
      throw new Error("Lab 4 PostgreSQL tests require the guarded Lab 3 test database");
    }
    await deployMigrations(target);
    prisma = createTestPrisma(target);
  });

  afterAll(async () => prisma?.$disconnect());

  it("persists typed Action/Activity relations and scopes idempotency by concrete resource", async () => {
    const suffix = randomUUID();
    const requester = await createRequesterUser(prisma, { name: "Schema Requester", email: `schema-${suffix}@example.test` });
    const creator = await createStaff(`creator-${suffix}@example.test`);
    const assignee = await createStaff(`assignee-${suffix}@example.test`);
    const performer = await createStaff(`performer-${suffix}@example.test`);
    const category = await prisma.category.create({ data: { name: `Schema ${suffix}`, createdBy: "test", updatedBy: "test" } });
    const relatedSystem = await prisma.relatedSystem.create({ data: { name: `Schema ${suffix}`, createdBy: "test", updatedBy: "test" } });
    const ticket = await prisma.ticket.create({
      data: {
        publicId: randomUUID(),
        ticketNumber: `TKT-20260930-${suffix.replaceAll("-", "").slice(0, 12).toUpperCase()}`,
        requesterId: requester.id,
        ownerUserId: creator.id,
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        summary: "Schema relation check",
        requestedPriority: "MEDIUM",
        itPriority: TicketPriority.HIGH,
        description: "Exercise Lab 4 relational constraints.",
        currentStatus: TicketStatus.OPEN,
        createdBy: "test",
        updatedBy: "test",
      },
    });
    const attachment = await prisma.attachment.create({
      data: {
        storageKey: randomUUID(), ticketId: ticket.id, uploadedByRequesterId: requester.id,
        originalName: "evidence.txt", extension: "txt", mimeType: "text/plain", sizeBytes: 4,
        data: Buffer.from("test"), createdBy: requester.email, updatedBy: requester.email,
      },
    });
    const otherTicket = await prisma.ticket.create({
      data: {
        publicId: randomUUID(),
        ticketNumber: `TKT-20260930-${suffix.replaceAll("-", "").slice(12, 24).toUpperCase()}`,
        requesterId: requester.id,
        ownerUserId: creator.id,
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        summary: "Other Ticket relation check",
        requestedPriority: "MEDIUM",
        itPriority: TicketPriority.MEDIUM,
        description: "Must not supply evidence to another Ticket.",
        currentStatus: TicketStatus.OPEN,
        createdBy: "test",
        updatedBy: "test",
      },
    });
    const otherAttachment = await prisma.attachment.create({
      data: {
        storageKey: randomUUID(), ticketId: otherTicket.id, uploadedByRequesterId: requester.id,
        originalName: "other-evidence.txt", extension: "txt", mimeType: "text/plain", sizeBytes: 4,
        data: Buffer.from("test"), createdBy: requester.email, updatedBy: requester.email,
      },
    });
    const startedAt = new Date();
    const completedAt = new Date(startedAt.getTime() + 1_000);
    const action = await prisma.actionTaken.create({
      data: {
        ticketId: ticket.id,
        creatorUserId: creator.id,
        assignedToUserId: assignee.id,
        performedByUserId: performer.id,
        status: ActionTakenStatus.COMPLETED,
        description: "Verify ActionTaken actor relations.",
        result: "All three User relations persisted.",
        followUpRequired: false,
        startedAt,
        completedAt,
        createdBy: creator.email,
        updatedBy: performer.email,
      },
      include: { creator: true, assignedTo: true, performedBy: true },
    });
    expect(action).toMatchObject({ creatorUserId: creator.id, assignedToUserId: assignee.id, performedByUserId: performer.id });
    await prisma.actionTakenAttachment.create({
      data: { actionTakenId: action.id, attachmentId: attachment.id, createdBy: creator.email, updatedBy: creator.email },
    });
    await expect(prisma.actionTakenAttachment.create({
      data: { actionTakenId: action.id, attachmentId: attachment.id, createdBy: creator.email, updatedBy: creator.email },
    })).rejects.toMatchObject({ code: "P2002" });
    await expect(prisma.actionTakenAttachment.create({
      data: { actionTakenId: action.id, attachmentId: otherAttachment.id, createdBy: creator.email, updatedBy: creator.email },
    })).rejects.toBeDefined();

    const systemUser = await prisma.user.findFirstOrThrow({ where: { isSystem: true } });
    await expect(prisma.user.update({ where: { id: systemUser.id }, data: { isActive: true } })).rejects.toBeDefined();
    const snapshot = await prisma.ticketActivity.create({
      data: {
        ticketId: ticket.id,
        performedByUserId: systemUser.id,
        action: TicketActivityType.MIGRATED_TICKET_SNAPSHOT,
        createdBy: "test",
        updatedBy: "test",
        status: { create: { previousStatus: null, status: TicketStatus.OPEN } },
        priority: { create: { previousPriority: null, priority: TicketPriority.HIGH } },
      },
    });
    expect(snapshot.performedByUserId).toBe(systemUser.id);
    await prisma.ticketAssignmentActivity.create({
      data: { ticketActivityId: snapshot.id, previousAssignedToUserId: null, assignedToUserId: creator.id },
    });

    const actionActivity = await prisma.ticketActivity.create({
      data: {
        ticketId: ticket.id,
        performedByUserId: performer.id,
        action: TicketActivityType.ACTION_COMPLETED,
        createdBy: performer.email,
        updatedBy: performer.email,
      },
    });
    const crossTicketActivity = await prisma.ticketActivity.create({
      data: {
        ticketId: otherTicket.id,
        performedByUserId: performer.id,
        action: TicketActivityType.ACTION_COMPLETED,
        createdBy: performer.email,
        updatedBy: performer.email,
      },
    });
    try {
      await expect(prisma.actionTakenActivity.create({
        data: { ticketActivityId: crossTicketActivity.id, actionTakenId: action.id },
      })).rejects.toBeDefined();
    } finally {
      await prisma.actionTakenActivity.deleteMany({ where: { ticketActivityId: crossTicketActivity.id } });
      await prisma.ticketActivity.delete({ where: { id: crossTicketActivity.id } });
    }

    await prisma.actionTakenActivity.create({
      data: { ticketActivityId: actionActivity.id, actionTakenId: action.id },
    });

    await expect(prisma.actionTaken.create({
      data: {
        ticketId: ticket.id, creatorUserId: creator.id, status: ActionTakenStatus.COMPLETED,
        description: "Invalid completion without lifecycle details.", result: "Missing performer and completion time.",
        followUpRequired: false, createdBy: creator.email, updatedBy: creator.email,
      },
    })).rejects.toBeDefined();
    await expect(prisma.actionTaken.create({
      data: {
        ticketId: ticket.id, creatorUserId: creator.id, status: ActionTakenStatus.PLANNED,
        description: "Invalid version.", followUpRequired: false, version: 0,
        createdBy: creator.email, updatedBy: creator.email,
      },
    })).rejects.toBeDefined();

    const key = randomUUID();
    const baseIdentity = { userId: requester.id, method: "POST", key, requestHash: "a".repeat(64), status: "PROCESSING" as const, processingStartedAt: new Date(), createdBy: requester.email, updatedBy: requester.email };
    const firstPath = `/api/tickets/${ticket.publicId}/actions`;
    const secondPath = `/api/tickets/${randomUUID()}/actions`;
    await prisma.idempotencyRecord.create({ data: { ...baseIdentity, resourcePath: firstPath } });
    await prisma.idempotencyRecord.create({ data: { ...baseIdentity, resourcePath: secondPath } });
    await expect(prisma.idempotencyRecord.create({ data: { ...baseIdentity, resourcePath: firstPath } })).rejects.toMatchObject({ code: "P2002" });
    await expect(prisma.idempotencyRecord.create({
      data: { ...baseIdentity, key: randomUUID(), resourcePath: `${firstPath}?include=action` },
    })).rejects.toBeDefined();
    await expect(prisma.idempotencyRecord.create({
      data: { ...baseIdentity, key: randomUUID(), resourcePath: `${firstPath}/` },
    })).rejects.toBeDefined();
    await expect(prisma.idempotencyRecord.create({
      data: {
        ...baseIdentity, key: randomUUID(), resourcePath: firstPath, status: "COMPLETED",
        completedAt: new Date(), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), ticketId: ticket.id,
      },
    })).rejects.toBeDefined();

    await expect(prisma.actionTaken.create({
      data: {
        ticketId: -1, creatorUserId: creator.id, status: ActionTakenStatus.PLANNED,
        description: "Invalid Ticket FK", followUpRequired: false, createdBy: creator.email, updatedBy: creator.email,
      },
    })).rejects.toMatchObject({ code: "P2003" });
  });

  async function createStaff(email: string) {
    return prisma.user.create({
      data: { name: "Schema Staff", email, role: "IT_STAFF", passwordHash: "!test", mustChangePassword: false, createdBy: "test", updatedBy: "test" },
    });
  }
});
