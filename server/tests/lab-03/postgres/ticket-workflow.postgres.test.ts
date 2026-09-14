import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

import type { PrismaClient } from "../../../src/generated/prisma/client.js";
import { applyRequesterTicketAction } from "../../../src/services/ticketService.js";
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
