import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

import type { PrismaClient } from "../../../src/generated/prisma/client.js";
import { applyRequesterTicketAction } from "../../../src/services/ticketService.js";
import { mutateStaffTicket, type PublicCommentWriter, type TicketActor } from "../../../src/services/ticketWorkflowService.js";
import {
  createRequesterUser,
  createTestPrisma,
  deployMigrations,
  resetTestSchema,
  type TestDatabaseTarget,
  assertLab2TestDatabase,
} from "../../lab-02/postgres/testDatabase.js";

describe.sequential("Requester Ticket workflow PostgreSQL regression @issue-4", () => {
  let target: TestDatabaseTarget;
  let prisma: PrismaClient;
  let requesterId: number;
  let categoryId: number;
  let relatedSystemId: number;

  beforeAll(async () => {
    target = assertLab2TestDatabase();
    prisma = createTestPrisma(target);
    await resetTestSchema(target);
    await deployMigrations(target);

    const requester = await createRequesterUser(prisma, {
      name: "PG Workflow Requester",
      email: "pg.workflow.requester@example.test",
    });
    requesterId = requester.id;
    const [category, relatedSystem] = await Promise.all([
      prisma.category.create({ data: { name: "PG Workflow Category", createdBy: "system", updatedBy: "system" } }),
      prisma.relatedSystem.create({ data: { name: "PG Workflow System", createdBy: "system", updatedBy: "system" } }),
    ]);
    categoryId = category.id;
    relatedSystemId = relatedSystem.id;
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  async function makeTicket(currentStatus: "NEW" | "RESOLVED" | "CLOSED") {
    return prisma.ticket.create({
      data: {
        publicId: randomUUID(),
        ticketNumber: `TKT-20260914-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
        requesterId,
        categoryId,
        relatedSystemId,
        summary: "PG workflow fixture",
        requestedPriority: "MEDIUM",
        itPriority: "HIGH",
        description: "A PostgreSQL requester workflow fixture.",
        currentStatus,
        requesterResolutionConfirmedAt: currentStatus === "RESOLVED" ? null : undefined,
        createdBy: "system",
        updatedBy: "system",
      },
    });
  }

  it("PG-11 records Looks Resolved without changing RESOLVED status @issue-4", async () => {
    const ticket = await makeTicket("RESOLVED");
    const before = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    const result = await applyRequesterTicketAction(
      prisma,
      requesterId,
      "pg.workflow.requester@example.test",
      ticket.publicId,
      "looks-resolved",
    );

    expect(result?.currentStatus).toBe("RESOLVED");
    expect(result?.itPriority).toBe("HIGH");
    expect(result?.requesterResolutionConfirmedAt).not.toBeNull();
    const after = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(after?.currentStatus).toBe(before?.currentStatus);
    expect(after?.itPriority).toBe(before?.itPriority);
  });

  it("PG-11 cancels NEW and rejects a second cancel after terminal state @issue-4", async () => {
    const ticket = await makeTicket("NEW");
    const result = await applyRequesterTicketAction(
      prisma,
      requesterId,
      "pg.workflow.requester@example.test",
      ticket.publicId,
      "cancel",
    );
    expect(result?.currentStatus).toBe("CANCELLED");

    await expect(
      applyRequesterTicketAction(
        prisma,
        requesterId,
        "pg.workflow.requester@example.test",
        ticket.publicId,
        "cancel",
      ),
    ).rejects.toMatchObject({ code: "INVALID_STATUS_TRANSITION" });
  });
});

describe.sequential("PG-10 Request Information transaction seam @issue-5", () => {
  let prisma: PrismaClient;
  let staff: TicketActor;
  let requesterId: number;
  let categoryId: number;
  let relatedSystemId: number;
  beforeAll(async () => {
    const target = assertLab2TestDatabase();
    await resetTestSchema(target); await deployMigrations(target);
    prisma = createTestPrisma(target);
    const user = await prisma.user.create({ data: { name: "Workflow Staff", email: "workflow.staff@example.test", role: "IT_STAFF", passwordHash: "unusable-test-fixture", createdBy: "test", updatedBy: "test" } });
    staff = { userId: user.id, userPublicId: user.publicId, role: user.role, email: user.email };
    requesterId = (await createRequesterUser(prisma, { name: "Workflow Requester", email: "workflow.requester@example.test" })).id;
    categoryId = (await prisma.category.create({ data: { name: "Workflow", createdBy: "test", updatedBy: "test" } })).id;
    relatedSystemId = (await prisma.relatedSystem.create({ data: { name: "Workflow", createdBy: "test", updatedBy: "test" } })).id;
  }, 120_000);
  afterAll(async () => { await prisma?.$disconnect(); });
  async function ticket() {
    return prisma.ticket.create({ data: { publicId: randomUUID(), ticketNumber: `TKT-20260916-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`, requesterId, categoryId, relatedSystemId, ownerUserId: staff.userId, currentStatus: "OPEN", requestedPriority: "MEDIUM", itPriority: "HIGH", summary: "Workflow transaction", description: "Synthetic workflow fixture.", createdBy: "test", updatedBy: "test" } });
  }
  // Test-only implementation of the Issue 6 writer contract. Production
  // persistence remains Issue 6-owned and is deliberately not wired here.
  const writer: PublicCommentWriter = async (tx, input) => { await tx.publicComment.create({ data: input }); };
  it("commits Public Comment and WAITING status together", async () => {
    const row = await ticket();
    const updated = await mutateStaffTicket(prisma, staff, row.publicId, "request-information", { content: " Please provide details " }, writer);
    expect(updated).toMatchObject({ currentStatus: "WAITING_FOR_REQUESTER", itPriority: "HIGH", requestedPriority: "MEDIUM" });
    expect(await prisma.publicComment.findMany({ where: { ticketId: row.id } })).toMatchObject([{ content: "Please provide details", authorUserId: staff.userId }]);
    await prisma.publicComment.create({ data: { ticketId: row.id, authorUserId: requesterId, content: "Requester reply" } });
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: row.id } })).currentStatus).toBe("WAITING_FOR_REQUESTER");
    expect((await mutateStaffTicket(prisma, staff, row.publicId, "resume-work", {})).currentStatus).toBe("IN_PROGRESS");
  });
  it("rolls back Ticket change when comment insertion fails", async () => {
    const row = await ticket();
    await expect(mutateStaffTicket(prisma, staff, row.publicId, "request-information", { content: "Details" }, async (tx, input) => {
      await tx.publicComment.create({ data: { ...input, authorUserId: -1 } });
    })).rejects.toThrow();
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: row.id } })).currentStatus).toBe("OPEN");
    expect(await prisma.publicComment.count({ where: { ticketId: row.id } })).toBe(0);
  });
  it("rolls back both writes when transaction fails after comment insertion", async () => {
    const row = await ticket();
    await expect(mutateStaffTicket(prisma, staff, row.publicId, "request-information", { content: "Details" }, async (tx, input) => {
      await writer(tx, input);
      await tx.ticket.update({ where: { id: row.id }, data: { ownerUserId: -1 } });
    })).rejects.toThrow();
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: row.id } })).currentStatus).toBe("OPEN");
    expect(await prisma.publicComment.count({ where: { ticketId: row.id } })).toBe(0);
  });
  it("requires confirmation to close and consumes the Requester reopen seam", async () => {
    const row = await ticket();
    await mutateStaffTicket(prisma, staff, row.publicId, "start-work", {});
    await mutateStaffTicket(prisma, staff, row.publicId, "mark-resolved", {});
    await expect(mutateStaffTicket(prisma, staff, row.publicId, "close", {})).rejects.toMatchObject({ code: "INVALID_STATUS_TRANSITION" });
    await applyRequesterTicketAction(prisma, requesterId, "workflow.requester@example.test", row.publicId, "looks-resolved");
    expect((await mutateStaffTicket(prisma, staff, row.publicId, "close", {})).currentStatus).toBe("CLOSED");
    await applyRequesterTicketAction(prisma, requesterId, "workflow.requester@example.test", row.publicId, "reopen");
    const assigned = await mutateStaffTicket(prisma, staff, row.publicId, "owner", { ownerPublicId: staff.userPublicId, expectedOwnerPublicId: null });
    expect(assigned).toMatchObject({ currentStatus: "REOPENED", itPriority: "HIGH", requesterResolutionConfirmedAt: null });
    expect((await mutateStaffTicket(prisma, staff, row.publicId, "start-work", {})).currentStatus).toBe("IN_PROGRESS");
  });
});
