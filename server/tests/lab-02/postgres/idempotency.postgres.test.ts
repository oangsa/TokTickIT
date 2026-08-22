import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

import type { PrismaClient } from "../../../src/generated/prisma/client.js";
import {
  IdempotencyStatus,
  RequestedPriority,
} from "../../../src/generated/prisma/enums.js";
import {
  assertLab2TestDatabase,
  createTestPrisma,
  deployMigrations,
  resetTestSchema,
  type TestDatabaseTarget,
} from "./testDatabase.js";

interface Fixture {
  requesterId: number;
  ticketId: number;
}

interface IdempotencyInsert {
  requesterId: number;
  key: string;
  requestHash: string;
  status: "PROCESSING" | "COMPLETED";
  processingStartedAt: Date | null;
  ticketId: number | null;
  completedAt: Date | null;
  expiresAt: Date | null;
}

async function createFixture(prisma: PrismaClient): Promise<Fixture> {
  const requester = await prisma.developmentRequester.create({
    data: {
      name: "Idempotency Test Requester",
      email: "idempotency.test@example.com",
      createdBy: "system",
      updatedBy: "system",
    },
  });
  const category = await prisma.category.create({
    data: { name: "Idempotency Test Category", createdBy: "system", updatedBy: "system" },
  });
  const relatedSystem = await prisma.relatedSystem.create({
    data: { name: "Idempotency Test System", createdBy: "system", updatedBy: "system" },
  });
  const ticket = await prisma.ticket.create({
    data: {
      publicId: randomUUID(),
      ticketNumber: "TKT-20260822-123456ABCDEF",
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      summary: "Idempotency fixture",
      requestedPriority: RequestedPriority.MEDIUM,
      description: "A valid idempotency database fixture.",
      createdBy: "system",
      updatedBy: "system",
    },
  });

  return { requesterId: requester.id, ticketId: ticket.id };
}

async function insertIdempotency(
  prisma: PrismaClient,
  record: IdempotencyInsert,
): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO idempotency_record (
      requester_id, "key", request_hash, status, processing_started_at,
      ticket_id, completed_at, expires_at, created_by, updated_by
    ) VALUES (
      ${record.requesterId},
      ${record.key}::uuid,
      ${record.requestHash},
      ${record.status}::"IdempotencyStatus",
      ${record.processingStartedAt},
      ${record.ticketId},
      ${record.completedAt},
      ${record.expiresAt},
      'system',
      'system'
    )
  `;
}

function processingRecord(requesterId: number, key = randomUUID()): IdempotencyInsert {
  return {
    requesterId,
    key,
    requestHash: "a".repeat(64),
    status: "PROCESSING",
    processingStartedAt: new Date("2026-08-22T00:00:00.000Z"),
    ticketId: null,
    completedAt: null,
    expiresAt: null,
  };
}

function completedRecord(
  requesterId: number,
  ticketId: number,
  key = randomUUID(),
): IdempotencyInsert {
  const completedAt = new Date("2026-08-22T01:00:00.000Z");
  return {
    requesterId,
    key,
    requestHash: "b".repeat(64),
    status: "COMPLETED",
    processingStartedAt: new Date("2026-08-22T00:00:00.000Z"),
    ticketId,
    completedAt,
    expiresAt: new Date(completedAt.getTime() + 24 * 60 * 60 * 1000),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasSqlState(error: unknown, expectedSqlState: string): boolean {
  if (!isRecord(error)) {
    return false;
  }

  if (
    typeof error.message === "string" &&
    error.message.includes(`Code: \`${expectedSqlState}\``)
  ) {
    return true;
  }

  const meta = error.meta;
  if (!isRecord(meta) || !isRecord(meta.driverAdapterError)) {
    return false;
  }

  const cause = meta.driverAdapterError.cause;
  return isRecord(cause) && cause.originalCode === expectedSqlState;
}

async function expectDatabaseReject(
  action: () => Promise<unknown>,
  expectedSqlState: string,
): Promise<void> {
  let error: unknown;
  try {
    await action();
  } catch (caughtError) {
    error = caughtError;
  }

  expect(hasSqlState(error, expectedSqlState)).toBe(true);
}

describe.sequential("Lab 2 IdempotencyRecord PostgreSQL contract", () => {
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

  it("accepts lowercase SHA-256 hashes and valid PROCESSING/COMPLETED states", async () => {
    const key = randomUUID();
    const processing = processingRecord(fixture.requesterId, key);
    await expect(insertIdempotency(prisma, processing)).resolves.toBeUndefined();

    const completedAt = new Date("2026-08-22T01:00:00.000Z");
    await expect(
      prisma.idempotencyRecord.update({
        where: {
          requesterId_key: { requesterId: fixture.requesterId, key },
        },
        data: {
          status: IdempotencyStatus.COMPLETED,
          ticketId: fixture.ticketId,
          completedAt,
          expiresAt: new Date(completedAt.getTime() + 24 * 60 * 60 * 1000),
          updatedBy: "system",
        },
      }),
    ).resolves.toMatchObject({
      status: IdempotencyStatus.COMPLETED,
      processingStartedAt: processing.processingStartedAt,
      ticketId: fixture.ticketId,
      completedAt,
    });

    await expect(
      insertIdempotency(prisma, completedRecord(fixture.requesterId, fixture.ticketId)),
    ).resolves.toBeUndefined();
  }, 30_000);

  it("rejects uppercase, malformed, and wrong-length hashes", async () => {
    for (const requestHash of ["A".repeat(64), "g".repeat(64), "a".repeat(63)]) {
      await expectDatabaseReject(
        () =>
          insertIdempotency(prisma, {
            ...processingRecord(fixture.requesterId),
            requestHash,
          }),
        "23514",
      );
    }
  }, 30_000);

  it("rejects invalid PROCESSING state combinations", async () => {
    await expectDatabaseReject(() =>
      insertIdempotency(prisma, {
        ...processingRecord(fixture.requesterId),
        ticketId: fixture.ticketId,
      }),
      "23514",
    );
    await expectDatabaseReject(() =>
      insertIdempotency(prisma, {
        ...processingRecord(fixture.requesterId),
        completedAt: new Date("2026-08-22T01:00:00.000Z"),
      }),
      "23514",
    );
    await expectDatabaseReject(() =>
      insertIdempotency(prisma, {
        ...processingRecord(fixture.requesterId),
        expiresAt: new Date("2026-08-23T01:00:00.000Z"),
      }),
      "23514",
    );
    await expectDatabaseReject(() =>
      insertIdempotency(prisma, {
        ...processingRecord(fixture.requesterId),
        processingStartedAt: null,
      }),
      "23502",
    );
  }, 30_000);

  it("rejects incomplete or incorrectly expiring COMPLETED state combinations", async () => {
    await expectDatabaseReject(() =>
      insertIdempotency(prisma, {
        ...completedRecord(fixture.requesterId, fixture.ticketId),
        ticketId: null,
      }),
      "23514",
    );
    await expectDatabaseReject(() =>
      insertIdempotency(prisma, {
        ...completedRecord(fixture.requesterId, fixture.ticketId),
        completedAt: null,
      }),
      "23514",
    );
    await expectDatabaseReject(() =>
      insertIdempotency(prisma, {
        ...completedRecord(fixture.requesterId, fixture.ticketId),
        expiresAt: null,
      }),
      "23514",
    );
    await expectDatabaseReject(() =>
      insertIdempotency(prisma, {
        ...completedRecord(fixture.requesterId, fixture.ticketId),
        expiresAt: new Date("2026-08-23T00:59:59.999Z"),
      }),
      "23514",
    );
  }, 30_000);

  it("enforces unique requester/key identity and restrictive historical foreign keys", async () => {
    const duplicateKey = randomUUID();
    await insertIdempotency(prisma, processingRecord(fixture.requesterId, duplicateKey));
    await expectDatabaseReject(
      () => insertIdempotency(prisma, processingRecord(fixture.requesterId, duplicateKey)),
      "23505",
    );

    const requesterOnlyForEvidence = await prisma.developmentRequester.create({
      data: {
        name: "Requester FK Evidence",
        email: "requester.fk.evidence@example.com",
        createdBy: "system",
        updatedBy: "system",
      },
    });
    await expect(
      insertIdempotency(
        prisma,
        processingRecord(requesterOnlyForEvidence.id, duplicateKey),
      ),
    ).resolves.toBeUndefined();
    await expectDatabaseReject(
      () => prisma.developmentRequester.delete({ where: { id: requesterOnlyForEvidence.id } }),
      "23503",
    );

    await insertIdempotency(prisma, completedRecord(fixture.requesterId, fixture.ticketId));
    await expectDatabaseReject(
      () => prisma.ticket.delete({ where: { id: fixture.ticketId } }),
      "23503",
    );
  }, 30_000);
});
