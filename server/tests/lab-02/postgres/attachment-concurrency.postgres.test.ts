import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

import { ApiError } from "../../../src/http/errors.js";
import { RequestedPriority } from "../../../src/generated/prisma/enums.js";
import type { PrismaClient } from "../../../src/generated/prisma/client.js";
import { AttachmentService } from "../../../src/services/attachmentService.js";
import {
  assertLab2TestDatabase,
  createTestPrisma,
  deployMigrations,
  resetTestSchema,
  type TestDatabaseTarget,
} from "./testDatabase.js";

/*
 * PG-05. The five-Active limit is a claim about what two connections can do at
 * the same moment, so it can only be settled by two connections. A mocked
 * `$transaction` proves the service asks for `Serializable`; only PostgreSQL
 * proves that asking for it is enough.
 *
 * The test asserts the observable outcome -- one 201, one 409, one new row, a
 * final Active count of five -- and never an exact backoff duration, which
 * api-spec Section 11.5 keeps outside the contract.
 */

const ACTOR = "concurrency.test@example.com";

interface Fixture {
  requesterId: number;
  ticketPublicId: string;
  ticketId: number;
}

function file(name: string) {
  return { filename: name, data: Buffer.alloc(16, 3) };
}

async function createFixture(prisma: PrismaClient): Promise<Fixture> {
  const requester = await prisma.developmentRequester.create({
    data: { name: "Concurrency Requester", email: ACTOR, createdBy: "system", updatedBy: "system" },
  });
  const category = await prisma.category.create({
    data: { name: "Concurrency Category", createdBy: "system", updatedBy: "system" },
  });
  const relatedSystem = await prisma.relatedSystem.create({
    data: { name: "Concurrency System", createdBy: "system", updatedBy: "system" },
  });
  const publicId = randomUUID();
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
  const ticket = await prisma.ticket.create({
    data: {
      publicId,
      ticketNumber: `TKT-20260826-${suffix}`,
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      summary: "Concurrent Attachment uploads",
      requestedPriority: RequestedPriority.HIGH,
      description: "A Ticket used to contend for the last Attachment slot.",
      createdBy: "system",
      updatedBy: "system",
    },
  });

  return { requesterId: requester.id, ticketPublicId: publicId, ticketId: ticket.id };
}

async function fillActiveAttachments(
  prisma: PrismaClient,
  fixture: Fixture,
  count: number,
): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await prisma.attachment.create({
      data: {
        storageKey: randomUUID(),
        ticketId: fixture.ticketId,
        uploadedByRequesterId: fixture.requesterId,
        originalName: `existing-${index}.png`,
        extension: "png",
        mimeType: "image/png",
        sizeBytes: 4,
        data: new Uint8Array([1, 2, 3, 4]),
        createdBy: ACTOR,
        updatedBy: ACTOR,
      },
    });
  }
}

function activeCount(prisma: PrismaClient, fixture: Fixture): Promise<number> {
  return prisma.attachment.count({ where: { ticketId: fixture.ticketId, deleted: false } });
}

describe.sequential("PG-05 concurrent direct Attachment uploads", () => {
  let target: TestDatabaseTarget;
  let prisma: PrismaClient;
  let connectionA: PrismaClient;
  let connectionB: PrismaClient;
  let fixture: Fixture;

  beforeAll(async () => {
    target = assertLab2TestDatabase();
    prisma = createTestPrisma(target);
    await resetTestSchema(target);
    await deployMigrations(target);
    /* Two independent clients, so the two attempts really are two sessions. */
    connectionA = createTestPrisma(target);
    connectionB = createTestPrisma(target);
    fixture = await createFixture(prisma);
  }, 120_000);

  afterAll(async () => {
    await Promise.all([prisma?.$disconnect(), connectionA?.$disconnect(), connectionB?.$disconnect()]);
  });

  it("lets exactly one of two uploads take the fifth slot", async () => {
    await fillActiveAttachments(prisma, fixture, 4);
    expect(await activeCount(prisma, fixture)).toBe(4);

    const attempt = (client: PrismaClient, name: string) =>
      new AttachmentService(client).createForTicket({
        requesterId: fixture.requesterId,
        actor: ACTOR,
        publicId: fixture.ticketPublicId,
        file: file(name),
      });

    const results = await Promise.allSettled([
      attempt(connectionA, "contender-a.png"),
      attempt(connectionB, "contender-b.png"),
    ]);

    const created = results.filter((result) => result.status === "fulfilled");
    const refused = results.filter((result) => result.status === "rejected");

    expect(created).toHaveLength(1);
    expect(refused).toHaveLength(1);

    /*
     * Whether the loser lost on a serialization failure and then re-read five,
     * or simply arrived second and read five, the answer it owes the client is
     * the same business conflict -- never a 500.
     */
    const reason = (refused[0] as PromiseRejectedResult).reason;
    expect(reason).toBeInstanceOf(ApiError);
    expect((reason as ApiError).statusCode).toBe(409);

    expect(await activeCount(prisma, fixture)).toBe(5);

    const names = await prisma.attachment.findMany({
      where: { ticketId: fixture.ticketId, originalName: { startsWith: "contender-" } },
      select: { originalName: true },
    });
    expect(names).toHaveLength(1);
  }, 60_000);

  it("frees exactly one slot when an Active Attachment is soft-removed", async () => {
    const removable = await prisma.attachment.findFirst({
      where: { ticketId: fixture.ticketId, deleted: false },
      select: { id: true },
    });

    await prisma.attachment.update({
      where: { id: removable?.id },
      data: { deleted: true, removalReason: "Freeing a slot for the replacement.", updatedBy: ACTOR },
    });

    expect(await activeCount(prisma, fixture)).toBe(4);

    await expect(
      new AttachmentService(connectionA).createForTicket({
        requesterId: fixture.requesterId,
        actor: ACTOR,
        publicId: fixture.ticketPublicId,
        file: file("replacement.png"),
      }),
    ).resolves.toMatchObject({ ticketPublicId: fixture.ticketPublicId, deleted: false });

    expect(await activeCount(prisma, fixture)).toBe(5);

    /* The Removed row is still there: soft removal retains its evidence. */
    expect(
      await prisma.attachment.count({ where: { ticketId: fixture.ticketId, deleted: true } }),
    ).toBe(1);
  }, 60_000);

  it("refuses a sixth Active Attachment once the limit is reached again", async () => {
    await expect(
      new AttachmentService(connectionB).createForTicket({
        requesterId: fixture.requesterId,
        actor: ACTOR,
        publicId: fixture.ticketPublicId,
        file: file("sixth.png"),
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(await activeCount(prisma, fixture)).toBe(5);
  }, 30_000);
});
