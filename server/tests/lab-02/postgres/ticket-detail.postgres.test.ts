import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

import type { PrismaClient } from "../../../src/generated/prisma/client.js";
import { findTicketForRequester } from "../../../src/services/ticketService.js";
import {
  assertLab2TestDatabase,
  createTestPrisma,
  deployMigrations,
  resetTestSchema,
  type TestDatabaseTarget,
} from "./testDatabase.js";

/*
 * PG-16 (AC-21 to AC-23, BR-72-73). The engine-backed half of the Ticket Detail
 * read.
 *
 * `ticket-detail.api.test.ts` asserts the `where` object handed to a mocked
 * Prisma client. That proves the service composes the predicate it claims to;
 * it cannot prove PostgreSQL then applies it, and ownership is the one claim on
 * this endpoint that has to hold as an outcome rather than as the presence of a
 * `{ requesterId }` key:
 *
 * - another Requester's Ticket comes back as `null`, not as a row the route is
 *   trusted to discard afterwards;
 * - the same for a logically deleted Ticket;
 * - Category and Related System names still resolve after the master rows go
 *   inactive and deleted, which no mocked `include` can demonstrate;
 * - the Attachment `omit` leaves `data` out of the SELECT that actually runs.
 */

interface Fixture {
  aliceId: number;
  bobId: number;
  alicePublicId: string;
  aliceDeletedPublicId: string;
  bobPublicId: string;
  attachmentStorageKey: string;
}

function ticketNumber(suffix: string): string {
  const value = `TKT-20260820-${suffix}`;
  expect(value).toHaveLength(25);
  return value;
}

describe.sequential("Lab 2 Ticket Detail PostgreSQL read", () => {
  let target: TestDatabaseTarget;
  let prisma: PrismaClient;
  let fixture: Fixture;

  beforeAll(async () => {
    target = assertLab2TestDatabase();
    prisma = createTestPrisma(target);
    await resetTestSchema(target);
    await deployMigrations(target);

    const requester = (name: string, email: string) =>
      prisma.developmentRequester.create({
        data: { name, email, createdBy: "system", updatedBy: "system" },
      });

    const [alice, bob] = await Promise.all([
      requester("Detail Alice", "detail.alice@example.com"),
      requester("Detail Bob", "detail.bob@example.com"),
    ]);

    /* Inactive and logically deleted from the start: a Ticket keeps resolving
     * its historical names regardless of the master row's current state. */
    const [category, relatedSystem] = await Promise.all([
      prisma.category.create({
        data: {
          name: "Detail Legacy Category",
          isActive: false,
          deleted: true,
          createdBy: "system",
          updatedBy: "system",
        },
      }),
      prisma.relatedSystem.create({
        data: {
          name: "Detail Legacy System",
          isActive: false,
          deleted: true,
          createdBy: "system",
          updatedBy: "system",
        },
      }),
    ]);

    const ticket = (suffix: string, requesterId: number, deleted = false) =>
      prisma.ticket.create({
        data: {
          publicId: randomUUID(),
          ticketNumber: ticketNumber(suffix),
          requesterId,
          categoryId: category.id,
          relatedSystemId: relatedSystem.id,
          summary: `Detail ${suffix}`,
          description: "Seeded for the Ticket Detail read path.",
          requestedPriority: "HIGH",
          deleted,
          createdBy: "system",
          updatedBy: "system",
        },
      });

    const aliceTicket = await ticket("AAAAAAAAAAA1", alice.id);
    const aliceDeleted = await ticket("AAAAAAAAAAA2", alice.id, true);
    const bobTicket = await ticket("BBBBBBBBBBB1", bob.id);

    const attachment = await prisma.attachment.create({
      data: {
        storageKey: randomUUID(),
        ticketId: aliceTicket.id,
        uploadedByRequesterId: alice.id,
        originalName: "vpn-error.png",
        extension: "png",
        mimeType: "image/png",
        sizeBytes: 4,
        data: Buffer.from("PNG!"),
        createdBy: "system",
        updatedBy: "system",
      },
    });

    fixture = {
      aliceId: alice.id,
      bobId: bob.id,
      alicePublicId: aliceTicket.publicId,
      aliceDeletedPublicId: aliceDeleted.publicId,
      bobPublicId: bobTicket.publicId,
      attachmentStorageKey: attachment.storageKey,
    };
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("returns the owning Requester's non-deleted Ticket with its Attachment metadata", async () => {
    const detail = await findTicketForRequester(prisma, fixture.aliceId, fixture.alicePublicId);

    expect(detail?.ticketNumber).toBe(ticketNumber("AAAAAAAAAAA1"));
    expect(detail?.requesterName).toBe("Detail Alice");
    expect(detail?.attachments).toHaveLength(1);
    expect(detail?.attachments[0]).toMatchObject({
      attachmentId: fixture.attachmentStorageKey,
      ticketPublicId: fixture.alicePublicId,
      originalName: "vpn-error.png",
      sizeBytes: 4,
      deleted: false,
    });
  });

  /*
   * The outcome the mocked suite cannot reach: Bob's row exists, is not
   * deleted, and is asked for by its real identifier. The engine still answers
   * nothing, so the route's 404 is the database's verdict rather than a check
   * the handler could forget to make.
   */
  it("does not return another Requester's Ticket", async () => {
    expect(await findTicketForRequester(prisma, fixture.aliceId, fixture.bobPublicId)).toBeNull();
    expect(await findTicketForRequester(prisma, fixture.bobId, fixture.alicePublicId)).toBeNull();
  });

  it("does not return a logically deleted Ticket to its own Requester", async () => {
    expect(
      await findTicketForRequester(prisma, fixture.aliceId, fixture.aliceDeletedPublicId),
    ).toBeNull();
  });

  it("resolves historical Category and Related System names after both go inactive and deleted", async () => {
    const detail = await findTicketForRequester(prisma, fixture.aliceId, fixture.alicePublicId);

    expect(detail?.categoryName).toBe("Detail Legacy Category");
    expect(detail?.relatedSystemName).toBe("Detail Legacy System");
  });

  it("never selects the Attachment bytes", async () => {
    const logged: string[] = [];
    const logging = createTestPrisma(target, (sql) => logged.push(sql));

    try {
      await findTicketForRequester(logging, fixture.aliceId, fixture.alicePublicId);
    } finally {
      await logging.$disconnect();
    }

    const attachmentSelects = logged.filter((sql) => sql.includes('"public"."attachment"'));
    expect(attachmentSelects.length).toBeGreaterThan(0);
    expect(attachmentSelects.some((sql) => sql.includes("data"))).toBe(false);
  });
});
