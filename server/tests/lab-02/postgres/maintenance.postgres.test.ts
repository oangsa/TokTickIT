import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

import { IdempotencyStatus, RequestedPriority } from "../../../src/generated/prisma/enums.js";
import type { PrismaClient } from "../../../src/generated/prisma/client.js";
import { MaintenanceService } from "../../../src/services/maintenanceService.js";
import { PENDING_ATTACHMENT_TTL_HOURS } from "../../../src/services/ticketService.js";
import {
  assertLab2TestDatabase,
  createTestPrisma,
  deployMigrations,
  resetTestSchema,
  type TestDatabaseTarget,
} from "./testDatabase.js";

/*
 * PG-06 and the maintenance half of PG-09.
 *
 * `FOR UPDATE SKIP LOCKED` is the whole safety argument for running cleanup
 * beside live traffic, and it is a claim about PostgreSQL's locking, not about
 * this code. So the race is played out for real: one connection holds a Pending
 * row the way a Ticket-create binding would, while the other runs the job.
 */

const ACTOR = "maintenance.test@example.com";
const HOUR_MS = 60 * 60 * 1000;

interface Fixture {
  requesterId: number;
  ticketId: number;
}

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * HOUR_MS);
}

async function createFixture(prisma: PrismaClient): Promise<Fixture> {
  const requester = await prisma.developmentRequester.create({
    data: { name: "Maintenance Requester", email: ACTOR, createdBy: "system", updatedBy: "system" },
  });
  const category = await prisma.category.create({
    data: { name: "Maintenance Category", createdBy: "system", updatedBy: "system" },
  });
  const relatedSystem = await prisma.relatedSystem.create({
    data: { name: "Maintenance System", createdBy: "system", updatedBy: "system" },
  });
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
  const ticket = await prisma.ticket.create({
    data: {
      publicId: randomUUID(),
      ticketNumber: `TKT-20260826-${suffix}`,
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      summary: "Maintenance fixture Ticket",
      requestedPriority: RequestedPriority.LOW,
      description: "A Ticket that owns Active Attachments cleanup must not touch.",
      createdBy: "system",
      updatedBy: "system",
    },
  });

  return { requesterId: requester.id, ticketId: ticket.id };
}

async function createAttachment(
  prisma: PrismaClient,
  fixture: Fixture,
  options: { createdAt?: Date; ticketId?: number | null; deleted?: boolean } = {},
): Promise<number> {
  const bound = options.ticketId ?? null;
  const row = await prisma.attachment.create({
    data: {
      storageKey: randomUUID(),
      ticketId: bound,
      uploadedByRequesterId: fixture.requesterId,
      originalName: "evidence.png",
      extension: "png",
      mimeType: "image/png",
      sizeBytes: 4,
      data: new Uint8Array([9, 9, 9, 9]),
      deleted: options.deleted ?? false,
      removalReason: options.deleted === true ? "Removed before the cleanup run." : null,
      createdBy: ACTOR,
      updatedBy: ACTOR,
      ...(options.createdAt ? { createdAt: options.createdAt } : {}),
    },
    select: { id: true },
  });

  return row.id;
}

async function createCompletedRecord(
  prisma: PrismaClient,
  fixture: Fixture,
  completedAt: Date,
): Promise<number> {
  const row = await prisma.idempotencyRecord.create({
    data: {
      requesterId: fixture.requesterId,
      key: randomUUID(),
      requestHash: "a".repeat(64),
      status: IdempotencyStatus.COMPLETED,
      processingStartedAt: new Date(completedAt.getTime() - 1000),
      ticketId: fixture.ticketId,
      completedAt,
      /* The CHECK enforces this exact relationship (BR-82). */
      expiresAt: new Date(completedAt.getTime() + 24 * HOUR_MS),
      createdBy: ACTOR,
      updatedBy: ACTOR,
    },
    select: { id: true },
  });

  return row.id;
}

async function exists(prisma: PrismaClient, id: number): Promise<boolean> {
  return (await prisma.attachment.count({ where: { id } })) === 1;
}

describe.sequential("PG-06 Pending cleanup against live binding", () => {
  let target: TestDatabaseTarget;
  let prisma: PrismaClient;
  let binder: PrismaClient;
  let fixture: Fixture;

  beforeAll(async () => {
    target = assertLab2TestDatabase();
    prisma = createTestPrisma(target);
    await resetTestSchema(target);
    await deployMigrations(target);
    binder = createTestPrisma(target);
    fixture = await createFixture(prisma);
  }, 120_000);

  afterAll(async () => {
    await Promise.all([prisma?.$disconnect(), binder?.$disconnect()]);
  });

  it("deletes an expired unbound Pending row and leaves a fresh one alone", async () => {
    const expired = await createAttachment(prisma, fixture, {
      createdAt: hoursAgo(PENDING_ATTACHMENT_TTL_HOURS + 1),
    });
    const fresh = await createAttachment(prisma, fixture, {
      createdAt: hoursAgo(PENDING_ATTACHMENT_TTL_HOURS - 1),
    });

    const removed = await new MaintenanceService(prisma).cleanupExpiredPendingAttachments();

    expect(removed).toBe(1);
    expect(await exists(prisma, expired)).toBe(false);
    expect(await exists(prisma, fresh)).toBe(true);
  }, 30_000);

  it("never selects an Active or a Removed Attachment, however old", async () => {
    const active = await createAttachment(prisma, fixture, {
      ticketId: fixture.ticketId,
      createdAt: hoursAgo(500),
    });
    const removedRow = await createAttachment(prisma, fixture, {
      ticketId: fixture.ticketId,
      deleted: true,
      createdAt: hoursAgo(500),
    });

    await new MaintenanceService(prisma).cleanupExpiredPendingAttachments();

    expect(await exists(prisma, active)).toBe(true);
    expect(await exists(prisma, removedRow)).toBe(true);
  }, 30_000);

  it("skips a row another transaction is binding, and never deletes it once Active", async () => {
    const contended = await createAttachment(prisma, fixture, {
      createdAt: hoursAgo(PENDING_ATTACHMENT_TTL_HOURS + 2),
    });

    let removedWhileLocked = -1;

    await binder.$transaction(async (tx) => {
      /* The binding transaction takes the row lock first, exactly as a
       * Ticket-create binding would before it flips `ticket_id`. */
      await tx.$executeRaw`SELECT id FROM attachment WHERE id = ${contended} FOR UPDATE`;

      /* Cleanup runs on its own connection while that lock is held. */
      removedWhileLocked = await new MaintenanceService(prisma).cleanupExpiredPendingAttachments();

      await tx.attachment.update({
        where: { id: contended },
        data: { ticketId: fixture.ticketId, updatedBy: ACTOR },
      });
    });

    /* SKIP LOCKED stepped over it rather than waiting on the binder. */
    expect(removedWhileLocked).toBe(0);
    expect(await exists(prisma, contended)).toBe(true);

    /* And now that it is Active, no later run may take it either. */
    await new MaintenanceService(prisma).cleanupExpiredPendingAttachments();

    const row = await prisma.attachment.findUnique({
      where: { id: contended },
      select: { ticketId: true, deleted: true },
    });
    expect(row).toMatchObject({ ticketId: fixture.ticketId, deleted: false });
  }, 60_000);

  it("clears a backlog larger than one batch and is idempotent on a rerun", async () => {
    const created: number[] = [];
    for (let index = 0; index < 105; index += 1) {
      created.push(
        await createAttachment(prisma, fixture, {
          createdAt: hoursAgo(PENDING_ATTACHMENT_TTL_HOURS + 3),
        }),
      );
    }

    const removed = await new MaintenanceService(prisma).cleanupExpiredPendingAttachments();

    expect(removed).toBe(created.length);
    expect(
      await prisma.attachment.count({ where: { id: { in: created } } }),
    ).toBe(0);

    /* A second run has nothing left to do and says so. */
    expect(await new MaintenanceService(prisma).cleanupExpiredPendingAttachments()).toBe(0);
  }, 120_000);
});

describe.sequential("PG-09 expired Idempotency Record cleanup", () => {
  let target: TestDatabaseTarget;
  let prisma: PrismaClient;
  let fixture: Fixture;

  beforeAll(async () => {
    target = assertLab2TestDatabase();
    prisma = createTestPrisma(target);
    await resetTestSchema(target);
    await deployMigrations(target);
    fixture = await createFixture(prisma);
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("removes a COMPLETED record past its 24-hour expiry and keeps one inside it", async () => {
    const expired = await createCompletedRecord(prisma, fixture, hoursAgo(25));
    const live = await createCompletedRecord(prisma, fixture, hoursAgo(1));

    const removed = await new MaintenanceService(prisma).cleanupExpiredIdempotencyRecords();

    expect(removed).toBe(1);
    expect(await prisma.idempotencyRecord.count({ where: { id: expired } })).toBe(0);
    expect(await prisma.idempotencyRecord.count({ where: { id: live } })).toBe(1);
  }, 30_000);

  it("treats a record expiring exactly at the cutoff as eligible", async () => {
    const now = new Date();
    const exact = await createCompletedRecord(prisma, fixture, new Date(now.getTime() - 24 * HOUR_MS));

    await new MaintenanceService(prisma).cleanupExpiredIdempotencyRecords(now);

    expect(await prisma.idempotencyRecord.count({ where: { id: exact } })).toBe(0);
  }, 30_000);

  it("never deletes or reclaims a PROCESSING claim, however stale", async () => {
    const claim = await prisma.idempotencyRecord.create({
      data: {
        requesterId: fixture.requesterId,
        key: randomUUID(),
        requestHash: "b".repeat(64),
        status: IdempotencyStatus.PROCESSING,
        /* Long past the 300-second lease: reclaim is request-time work. */
        processingStartedAt: hoursAgo(48),
        createdBy: ACTOR,
        updatedBy: ACTOR,
      },
      select: { id: true, processingStartedAt: true },
    });

    await new MaintenanceService(prisma).run();

    const after = await prisma.idempotencyRecord.findUnique({
      where: { id: claim.id },
      select: { status: true, processingStartedAt: true },
    });

    expect(after?.status).toBe(IdempotencyStatus.PROCESSING);
    expect(after?.processingStartedAt.getTime()).toBe(claim.processingStartedAt.getTime());
  }, 30_000);

  it("reports both counts from one run", async () => {
    await createAttachment(prisma, fixture, {
      createdAt: hoursAgo(PENDING_ATTACHMENT_TTL_HOURS + 1),
    });
    await createCompletedRecord(prisma, fixture, hoursAgo(30));

    expect(await new MaintenanceService(prisma).run()).toEqual({
      pendingAttachments: 1,
      idempotencyRecords: 1,
    });
  }, 30_000);
});
