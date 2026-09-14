import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

import type { PrismaClient } from "../../../src/generated/prisma/client.js";
import { applyRequesterTicketAction, findTicketForRequester } from "../../../src/services/ticketService.js";
import {
  createRequesterUser,
  createTestPrisma,
  deployMigrations,
  resetTestSchema,
  type TestDatabaseTarget,
  assertLab2TestDatabase,
} from "../../lab-02/postgres/testDatabase.js";

describe.sequential("authenticated Requester PostgreSQL regression @issue-4", () => {
  let target: TestDatabaseTarget;
  let prisma: PrismaClient;
  let aliceId: number;
  let alicePublicId: string;
  let bobId: number;
  let aliceTicketPublicId: string;
  let bobTicketPublicId: string;

  beforeAll(async () => {
    target = assertLab2TestDatabase();
    prisma = createTestPrisma(target);
    await resetTestSchema(target);
    await deployMigrations(target);

    const [alice, bob, owner] = await Promise.all([
      createRequesterUser(prisma, { name: "PG Auth Alice", email: "pg.auth.alice@example.test" }),
      createRequesterUser(prisma, { name: "PG Auth Bob", email: "pg.auth.bob@example.test" }),
      prisma.user.create({
        data: {
          name: "PG Auth Owner",
          email: "pg.auth.owner@example.test",
          role: "IT_STAFF",
          passwordHash: "test-only-unused-password-hash",
          mustChangePassword: false,
          createdBy: "system",
          updatedBy: "system",
        },
      }),
    ]);
    aliceId = alice.id;
    alicePublicId = alice.publicId;
    bobId = bob.id;

    const [category, relatedSystem] = await Promise.all([
      prisma.category.create({ data: { name: "PG Auth Category", createdBy: "system", updatedBy: "system" } }),
      prisma.relatedSystem.create({ data: { name: "PG Auth System", createdBy: "system", updatedBy: "system" } }),
    ]);

    const makeTicket = (requesterId: number, suffix: string, ownerUserId?: number) =>
      prisma.ticket.create({
        data: {
          publicId: randomUUID(),
          ticketNumber: `TKT-20260914-${suffix}`,
          requesterId,
          ownerUserId,
          categoryId: category.id,
          relatedSystemId: relatedSystem.id,
          summary: `PG Requester ${suffix}`,
          requestedPriority: "HIGH",
          itPriority: "HIGH",
          description: "Authenticated Requester regression fixture.",
          currentStatus: "RESOLVED",
          requesterResolutionConfirmedAt: new Date("2026-09-14T00:00:00.000Z"),
          createdBy: "system",
          updatedBy: "system",
        },
      });

    const [aliceTicket, bobTicket] = await Promise.all([
      makeTicket(alice.id, "AAAAAAA00001", owner.id),
      makeTicket(bob.id, "BBBBBBB00001"),
    ]);
    aliceTicketPublicId = aliceTicket.publicId;
    bobTicketPublicId = bobTicket.publicId;
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("PG-16 returns only the authenticated User-owned Ticket @issue-4", async () => {
    const detail = await findTicketForRequester(prisma, aliceId, aliceTicketPublicId);

    expect(detail).toMatchObject({
      publicId: aliceTicketPublicId,
      requesterPublicId: alicePublicId,
      requesterName: "PG Auth Alice",
      currentStatus: "RESOLVED",
      itPriority: "HIGH",
    });
    expect(await findTicketForRequester(prisma, aliceId, bobTicketPublicId)).toBeNull();
    expect(await findTicketForRequester(prisma, bobId, aliceTicketPublicId)).toBeNull();
  });

  it("PG-16 replays requester Reopen atomically and preserves priority @issue-4", async () => {
    const updated = await applyRequesterTicketAction(
      prisma,
      aliceId,
      "pg.auth.alice@example.test",
      aliceTicketPublicId,
      "reopen",
    );

    expect(updated).toMatchObject({
      publicId: aliceTicketPublicId,
      currentStatus: "REOPENED",
      itPriority: "HIGH",
      owner: null,
      requesterResolutionConfirmedAt: null,
    });

    const persisted = await prisma.ticket.findUnique({ where: { publicId: aliceTicketPublicId } });
    expect(persisted).toMatchObject({
      requesterId: aliceId,
      currentStatus: "REOPENED",
      ownerUserId: null,
      itPriority: "HIGH",
      requesterResolutionConfirmedAt: null,
    });
  });
});
