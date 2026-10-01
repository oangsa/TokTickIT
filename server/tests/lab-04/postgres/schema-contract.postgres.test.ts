import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ActionTakenStatus, TicketActivityType, TicketPriority, TicketStatus } from "../../../src/generated/prisma/enums.js";
import { PrismaClient, type Prisma } from "../../../src/generated/prisma/client.js";
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
    async function expectInvalidDetails(write: (tx: Prisma.TransactionClient) => Promise<unknown>) {
      await expect(prisma.$transaction(async (tx) => {
        await write(tx);
        await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
      })).rejects.toThrow("Activity typed details must match its action and include required previous state");
    }

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

    await expectInvalidDetails((tx) => tx.ticketActivity.create({
      data: {
        ticketId: ticket.id, performedByUserId: creator.id,
        action: TicketActivityType.TICKET_CLOSED, createdBy: "test", updatedBy: "test",
        status: { create: { previousStatus: null, status: TicketStatus.CLOSED } },
      },
    }));

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
        assignment: { create: { previousAssignedToUserId: null, assignedToUserId: creator.id } },
      },
    });
    expect(snapshot.performedByUserId).toBe(systemUser.id);
    const actionActivity = await prisma.ticketActivity.create({
      data: {
        ticketId: ticket.id, performedByUserId: performer.id,
        action: TicketActivityType.ACTION_COMPLETED, createdBy: performer.email, updatedBy: performer.email,
        actionTaken: { create: { actionTakenId: action.id } },
      },
    });
    await expect(prisma.ticketActivity.create({
      data: {
        ticketId: otherTicket.id, performedByUserId: performer.id,
        action: TicketActivityType.ACTION_COMPLETED, createdBy: performer.email, updatedBy: performer.email,
        actionTaken: { create: { actionTakenId: action.id } },
      },
    })).rejects.toBeDefined();

    const activityBase = {
      ticketId: ticket.id, performedByUserId: creator.id, createdBy: "test", updatedBy: "test",
    };
    const statusDetail = { create: { previousStatus: TicketStatus.RESOLVED, status: TicketStatus.CLOSED } };
    const priorityDetail = { create: { previousPriority: TicketPriority.MEDIUM, priority: TicketPriority.HIGH } };
    const assignmentDetail = { create: { previousAssignedToUserId: null, assignedToUserId: creator.id } };
    const actionDetail = { create: { actionTakenId: action.id } };

    // Frozen API §16.3: Claim may also record NEW -> OPEN on its assignment Activity.
    const assignmentOnly = await prisma.ticketActivity.create({
      data: { ...activityBase, action: TicketActivityType.TICKET_ASSIGNED, assignment: assignmentDetail },
      include: { assignment: true, status: true },
    });
    expect(assignmentOnly.assignment).toMatchObject({ assignedToUserId: creator.id });
    expect(assignmentOnly.status).toBeNull();
    const claim = await prisma.$transaction(async (tx) => {
      const activity = await tx.ticketActivity.create({
        data: { ...activityBase, action: TicketActivityType.TICKET_ASSIGNED, assignment: assignmentDetail,
          status: { create: { previousStatus: TicketStatus.NEW, status: TicketStatus.OPEN } } },
        include: { assignment: true, status: true },
      });
      await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
      return activity;
    });
    expect(claim.assignment).toMatchObject({ assignedToUserId: creator.id });
    expect(claim.status).toMatchObject({ previousStatus: TicketStatus.NEW, status: TicketStatus.OPEN });

    for (const transition of [
      { previousStatus: TicketStatus.RESOLVED, status: TicketStatus.CLOSED },
      { previousStatus: TicketStatus.NEW, status: TicketStatus.CLOSED },
      { previousStatus: TicketStatus.OPEN, status: TicketStatus.OPEN },
      { previousStatus: null, status: TicketStatus.OPEN },
    ]) {
      await expectInvalidDetails((tx) => tx.ticketActivity.create({
        data: { ...activityBase, action: TicketActivityType.TICKET_ASSIGNED,
          assignment: assignmentDetail, status: { create: transition } },
      }));
    }
    const claimStatus = { create: { previousStatus: TicketStatus.NEW, status: TicketStatus.OPEN } };
    await expectInvalidDetails((tx) => tx.ticketActivity.create({
      data: { ...activityBase, action: TicketActivityType.TICKET_ASSIGNED, status: claimStatus },
    }));
    for (const activityType of [TicketActivityType.TICKET_REASSIGNED, TicketActivityType.TICKET_UNASSIGNED]) {
      await expectInvalidDetails((tx) => tx.ticketActivity.create({
        data: { ...activityBase, action: activityType, status: claimStatus },
      }));
      await expectInvalidDetails((tx) => tx.ticketActivity.create({
        data: { ...activityBase, action: activityType, assignment: assignmentDetail, status: claimStatus },
      }));
    }
    await expectInvalidDetails((tx) => tx.ticketStatusActivity.update({
      where: { ticketActivityId: claim.id }, data: { status: TicketStatus.CLOSED },
    }));
    await expectInvalidDetails((tx) => tx.ticketAssignmentActivity.delete({ where: { ticketActivityId: claim.id } }));
    await expectInvalidDetails((tx) => tx.ticketActivity.update({
      where: { id: claim.id }, data: { action: TicketActivityType.TICKET_REASSIGNED },
    }));

    await expectInvalidDetails((tx) => tx.ticketActivity.create({
      data: { ...activityBase, action: TicketActivityType.IT_PRIORITY_CHANGED,
        priority: { create: { previousPriority: null, priority: TicketPriority.HIGH } } },
    }));
    await expectInvalidDetails((tx) => tx.ticketActivity.create({
      data: { ...activityBase, action: TicketActivityType.ACTION_COMPLETED, actionTaken: actionDetail, status: statusDetail },
    }));
    await expectInvalidDetails((tx) => tx.ticketActivity.create({
      data: { ...activityBase, action: TicketActivityType.TICKET_CLOSED, status: statusDetail, actionTaken: actionDetail },
    }));
    await expectInvalidDetails((tx) => tx.ticketActivity.create({
      data: { ...activityBase, action: TicketActivityType.REQUESTER_RESOLUTION_CONFIRMED, assignment: assignmentDetail },
    }));

    // Every normal enum requires its specified detail family; Claim status is optional above.
    const detailFamilies = [
      { actions: [TicketActivityType.TICKET_ASSIGNED, TicketActivityType.TICKET_REASSIGNED, TicketActivityType.TICKET_UNASSIGNED], detail: { assignment: assignmentDetail } },
      { actions: [TicketActivityType.TICKET_STARTED_WORK, TicketActivityType.INFORMATION_REQUESTED, TicketActivityType.TICKET_RESUMED, TicketActivityType.TICKET_MARKED_RESOLVED, TicketActivityType.TICKET_CLOSED, TicketActivityType.TICKET_CANCELLED, TicketActivityType.TICKET_REOPENED], detail: { status: statusDetail } },
      { actions: [TicketActivityType.IT_PRIORITY_CHANGED], detail: { priority: priorityDetail } },
      { actions: [TicketActivityType.ACTION_CREATED, TicketActivityType.ACTION_UPDATED, TicketActivityType.ACTION_ASSIGNED, TicketActivityType.ACTION_REASSIGNED, TicketActivityType.ACTION_UNASSIGNED, TicketActivityType.ACTION_STARTED, TicketActivityType.ACTION_COMPLETED, TicketActivityType.ACTION_CANCELLED], detail: { actionTaken: actionDetail } },
    ];
    for (const { actions, detail } of detailFamilies) {
      for (const activityType of actions) {
        await expectInvalidDetails((tx) => tx.ticketActivity.create({ data: { ...activityBase, action: activityType } }));
        const valid = await prisma.ticketActivity.create({ data: { ...activityBase, action: activityType, ...detail } });
        expect(valid.action).toBe(activityType);
      }
    }
    const confirmation = await prisma.ticketActivity.create({
      data: { ...activityBase, action: TicketActivityType.REQUESTER_RESOLUTION_CONFIRMED },
    });
    expect(confirmation.action).toBe(TicketActivityType.REQUESTER_RESOLUTION_CONFIRMED);
    for (const detail of [
      { status: { create: { previousStatus: null, status: TicketStatus.OPEN } }, priority: { create: { previousPriority: null, priority: TicketPriority.HIGH } } },
      { assignment: assignmentDetail, priority: { create: { previousPriority: null, priority: TicketPriority.HIGH } } },
      { assignment: assignmentDetail, status: { create: { previousStatus: null, status: TicketStatus.OPEN } } },
    ]) {
      await expectInvalidDetails((tx) => tx.ticketActivity.create({
        data: { ...activityBase, ticketId: otherTicket.id, action: TicketActivityType.MIGRATED_TICKET_SNAPSHOT, ...detail },
      }));
    }

    // Updates, deletes, and moves cannot invalidate an already valid representation.
    await expectInvalidDetails((tx) => tx.ticketActivity.update({
      where: { id: actionActivity.id }, data: { action: TicketActivityType.TICKET_CLOSED },
    }));
    await expectInvalidDetails((tx) => tx.actionTakenActivity.delete({ where: { ticketActivityId: actionActivity.id } }));
    await expectInvalidDetails((tx) => tx.ticketStatusActivity.update({
      where: { ticketActivityId: snapshot.id }, data: { ticketActivityId: confirmation.id },
    }));
    const normalStatus = await prisma.ticketActivity.create({
      data: { ...activityBase, action: TicketActivityType.TICKET_CLOSED, status: statusDetail },
    });
    await expectInvalidDetails((tx) => tx.ticketStatusActivity.update({
      where: { ticketActivityId: normalStatus.id }, data: { previousStatus: null },
    }));
    const normalPriority = await prisma.ticketActivity.create({
      data: { ...activityBase, action: TicketActivityType.IT_PRIORITY_CHANGED, priority: priorityDetail },
    });
    await expectInvalidDetails((tx) => tx.ticketPriorityActivity.update({
      where: { ticketActivityId: normalPriority.id }, data: { previousPriority: null },
    }));

    const invalidPublicId = randomUUID();
    await expect(prisma.ticketActivity.create({
      data: { ...activityBase, publicId: invalidPublicId, action: TicketActivityType.ACTION_COMPLETED },
    })).rejects.toBeDefined();
    expect(await prisma.ticketActivity.findUnique({ where: { publicId: invalidPublicId } })).toBeNull();

    // Separate statements may assemble valid children before commit (as migration does).
    await prisma.$transaction(async (tx) => {
      const parent = await tx.ticketActivity.create({ data: { ...activityBase, action: TicketActivityType.ACTION_STARTED } });
      await tx.actionTakenActivity.create({ data: { ticketActivityId: parent.id, actionTakenId: action.id } });
    });
    expect(await prisma.actionTakenActivity.findUnique({ where: { ticketActivityId: actionActivity.id } })).not.toBeNull();

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
