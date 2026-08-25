import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

import type { PrismaClient } from "../../../src/generated/prisma/client.js";
import {
  IdempotencyStatus,
  RequestedPriority,
} from "../../../src/generated/prisma/enums.js";
import { runCreateTicket } from "../../../src/services/createTicketFlow.js";
import {
  IdempotencyService,
  PROCESSING_LEASE_SECONDS,
} from "../../../src/services/idempotencyService.js";
import {
  CreateTicketPayload,
  hashCreateTicketPayload,
} from "../../../src/services/ticketCreateRequest.js";
import { FencedOutError, TicketService } from "../../../src/services/ticketService.js";
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

/*
 * PG-01, PG-02, PG-09, PG-11, PG-12. These drive `runCreateTicket` -- the same
 * code path a real request uses -- against real PostgreSQL connections, so the
 * unique-claim race, the conditional reclaim, and `IDEMPOTENCY-FENCING-A` are
 * exercised by the database rather than by a mock.
 *
 * "Separate connections" is what makes these meaningful: each caller gets its
 * own `PrismaClient`, so two attempts really do contend for the claim row.
 */
describe.sequential("Lab 2 Ticket-create idempotency concurrency", () => {
  let target: TestDatabaseTarget;
  let prisma: PrismaClient;
  let connections: PrismaClient[];
  let requesterId: number;
  let categoryId: number;
  let relatedSystemId: number;

  const ACTOR = "concurrency.test@example.com";

  function payload(overrides: Partial<CreateTicketPayload> = {}): CreateTicketPayload {
    return {
      categoryId,
      relatedSystemId,
      summary: "Cannot connect to campus VPN",
      requestedPriority: "HIGH",
      description: "The VPN client fails after entering my credentials.",
      attachmentIds: [],
      ...overrides,
    };
  }

  async function pendingAttachment(): Promise<string> {
    const created = await prisma.attachment.create({
      data: {
        storageKey: randomUUID(),
        uploadedByRequesterId: requesterId,
        originalName: "vpn-error.png",
        extension: "png",
        mimeType: "image/png",
        sizeBytes: 4,
        data: Buffer.from([1, 2, 3, 4]),
        createdBy: ACTOR,
        updatedBy: ACTOR,
      },
    });

    return created.storageKey;
  }

  async function claimFor(key: string) {
    return prisma.idempotencyRecord.findUnique({
      where: { requesterId_key: { requesterId, key } },
    });
  }

  function ticketsFor(key: string) {
    return prisma.ticket.findMany({ where: { requesterId, summary: { contains: key.slice(0, 8) } } });
  }

  beforeAll(async () => {
    target = assertLab2TestDatabase();
    prisma = createTestPrisma(target);
    connections = [createTestPrisma(target), createTestPrisma(target), createTestPrisma(target)];

    const requester = await prisma.developmentRequester.create({
      data: {
        name: "Concurrency Test Requester",
        email: ACTOR,
        createdBy: "system",
        updatedBy: "system",
      },
    });
    const category = await prisma.category.create({
      data: { name: `Concurrency Category ${randomUUID()}`, createdBy: "system", updatedBy: "system" },
    });
    const relatedSystem = await prisma.relatedSystem.create({
      data: { name: `Concurrency System ${randomUUID()}`, createdBy: "system", updatedBy: "system" },
    });

    requesterId = requester.id;
    categoryId = category.id;
    relatedSystemId = relatedSystem.id;
  }, 120_000);

  afterAll(async () => {
    await Promise.all(connections.map((client) => client.$disconnect()));
  });

  // PG-01.
  it("lets exactly one of two concurrent same-payload attempts create the Ticket", async () => {
    const key = randomUUID();
    const attachmentId = await pendingAttachment();
    const body = payload({ summary: `Concurrent ${key}`, attachmentIds: [attachmentId] });

    const [first, second] = await Promise.all(
      connections.slice(0, 2).map((client) =>
        runCreateTicket(client, { requesterId, actor: ACTOR, key, payload: body }),
      ),
    );

    /* One 201 owner, one 200 waiter/replay, and the same Ticket identity. */
    expect([first.status, second.status].sort()).toEqual([200, 201]);
    expect(first.ticket.publicId).toBe(second.ticket.publicId);

    const created = await prisma.ticket.findMany({ where: { summary: `Concurrent ${key}` } });
    expect(created).toHaveLength(1);

    /* The referenced Pending row bound once, to that one Ticket. */
    const attachment = await prisma.attachment.findUnique({ where: { storageKey: attachmentId } });
    expect(attachment?.ticketId).toBe(created[0].id);

    const claim = await claimFor(key);
    expect(claim?.status).toBe(IdempotencyStatus.COMPLETED);
    expect(claim?.ticketId).toBe(created[0].id);
    expect(claim?.expiresAt?.getTime()).toBe(
      (claim?.completedAt?.getTime() ?? 0) + 24 * 60 * 60 * 1000,
    );
  }, 30_000);

  // PG-02.
  it("conflicts a concurrent different-payload contender without a second Ticket", async () => {
    const key = randomUUID();
    const summary = `Conflicting ${key}`;

    const results = await Promise.allSettled([
      runCreateTicket(connections[0], {
        requesterId,
        actor: ACTOR,
        key,
        payload: payload({ summary }),
      }),
      runCreateTicket(connections[1], {
        requesterId,
        actor: ACTOR,
        key,
        payload: payload({ summary, description: "A different description entirely." }),
      }),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({
      code: "IDEMPOTENCY_CONFLICT",
      statusCode: 409,
    });

    expect(await prisma.ticket.findMany({ where: { summary } })).toHaveLength(1);
  }, 30_000);

  // PG-02, different Attachment set.
  it("conflicts a different Attachment set under the same key", async () => {
    const key = randomUUID();
    const summary = `Attachment conflict ${key}`;
    const first = await pendingAttachment();
    const second = await pendingAttachment();

    await runCreateTicket(connections[0], {
      requesterId,
      actor: ACTOR,
      key,
      payload: payload({ summary, attachmentIds: [first] }),
    });

    await expect(
      runCreateTicket(connections[1], {
        requesterId,
        actor: ACTOR,
        key,
        payload: payload({ summary, attachmentIds: [second] }),
      }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });

    expect(await prisma.ticket.findMany({ where: { summary } })).toHaveLength(1);
    /* The second Attachment was never bound by the rejected attempt. */
    const unbound = await prisma.attachment.findUnique({ where: { storageKey: second } });
    expect(unbound?.ticketId).toBeNull();
  }, 30_000);

  // PG-09.
  it("replaces a logically expired COMPLETED row for two racing reuse callers", async () => {
    const key = randomUUID();
    const summary = `Expired reuse ${key}`;

    /* An expired-but-not-cleaned completed row for this requester/key. */
    const stale = await prisma.ticket.create({
      data: {
        publicId: randomUUID(),
        ticketNumber: `TKT-20260820-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`,
        requesterId,
        categoryId,
        relatedSystemId,
        summary: `Stale ${key}`,
        requestedPriority: RequestedPriority.LOW,
        description: "A Ticket from the expired attempt.",
        createdBy: ACTOR,
        updatedBy: ACTOR,
      },
    });
    const completedAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await insertIdempotency(prisma, {
      requesterId,
      key,
      requestHash: "c".repeat(64),
      status: "COMPLETED",
      processingStartedAt: completedAt,
      ticketId: stale.id,
      completedAt,
      expiresAt: new Date(completedAt.getTime() + 24 * 60 * 60 * 1000),
    });

    const results = await Promise.allSettled(
      connections.slice(0, 2).map((client) =>
        runCreateTicket(client, { requesterId, actor: ACTOR, key, payload: payload({ summary }) }),
      ),
    );

    /* No false unique-key error, and exactly one new logical operation wins. */
    for (const result of results) {
      expect(result.status).toBe("fulfilled");
    }
    expect(await prisma.ticket.findMany({ where: { summary } })).toHaveLength(1);

    const claim = await claimFor(key);
    expect(claim?.status).toBe(IdempotencyStatus.COMPLETED);
    expect(claim?.ticketId).not.toBe(stale.id);
  }, 30_000);

  // PG-11.
  it("lets exactly one of two concurrent retries reclaim a stale same-hash claim", async () => {
    const key = randomUUID();
    const summary = `Stale reclaim ${key}`;
    const body = payload({ summary });
    const requestHash = hashCreateTicketPayload(body);

    /* Abandoned at exactly the 300-second boundary: reclaim-eligible. */
    const abandonedAt = new Date(Date.now() - PROCESSING_LEASE_SECONDS * 1000);
    await insertIdempotency(prisma, {
      requesterId,
      key,
      requestHash,
      status: "PROCESSING",
      processingStartedAt: abandonedAt,
      ticketId: null,
      completedAt: null,
      expiresAt: null,
    });

    const results = await Promise.all(
      connections.slice(0, 2).map((client) =>
        runCreateTicket(client, { requesterId, actor: ACTOR, key, payload: body }),
      ),
    );

    expect(results.map((result) => result.status).sort()).toEqual([200, 201]);
    expect(results[0].ticket.publicId).toBe(results[1].ticket.publicId);
    expect(await prisma.ticket.findMany({ where: { summary } })).toHaveLength(1);

    const claim = await claimFor(key);
    expect(claim?.status).toBe(IdempotencyStatus.COMPLETED);
    /* Reclaimed in place: the lease was reset, not the row recreated. */
    expect(claim?.processingStartedAt.getTime()).toBeGreaterThan(abandonedAt.getTime());
  }, 30_000);

  it("treats a claim 1 ms inside the lease as fresh and does not reclaim it", async () => {
    const key = randomUUID();
    const body = payload({ summary: `Fresh lease ${key}` });
    const startedAt = new Date(Date.now() - (PROCESSING_LEASE_SECONDS * 1000 - 1));
    await insertIdempotency(prisma, {
      requesterId,
      key,
      requestHash: hashCreateTicketPayload(body),
      status: "PROCESSING",
      processingStartedAt: startedAt,
      ticketId: null,
      completedAt: null,
      expiresAt: null,
    });

    const service = new IdempotencyService(connections[0]);
    const resolution = await service.resolve({
      requesterId,
      key,
      requestHash: hashCreateTicketPayload(body),
      actor: ACTOR,
      now: new Date(startedAt.getTime() + PROCESSING_LEASE_SECONDS * 1000 - 1),
    });

    expect(resolution.kind).toBe("WAIT");
    const claim = await claimFor(key);
    expect(claim?.processingStartedAt.getTime()).toBe(startedAt.getTime());
  }, 30_000);

  // PG-12.
  it("fences out an old owner that resumes after its lease was reclaimed", async () => {
    const key = randomUUID();
    const summary = `Fenced owner ${key}`;
    const body = payload({ summary });
    const requestHash = hashCreateTicketPayload(body);

    /* A owns the claim with a lease that is already stale. */
    const staleLease = new Date(Date.now() - PROCESSING_LEASE_SECONDS * 1000 - 1000);
    await insertIdempotency(prisma, {
      requesterId,
      key,
      requestHash,
      status: "PROCESSING",
      processingStartedAt: staleLease,
      ticketId: null,
      completedAt: null,
      expiresAt: null,
    });

    /* B reclaims, obtains a new lease, and completes the whole operation. */
    const winner = await runCreateTicket(connections[0], {
      requesterId,
      actor: ACTOR,
      key,
      payload: body,
    });
    expect(winner.status).toBe(201);

    /*
     * A resumes with its old retained lease. The fencing SELECT matches no row,
     * so it performs no mutation and falls back to normal resolution, which now
     * finds B's COMPLETED claim.
     */
    const idempotency = new IdempotencyService(connections[1]);
    const tickets = new TicketService(connections[1], idempotency);

    await expect(
      tickets.create({
        requesterId,
        actor: ACTOR,
        key,
        requestHash,
        recordId: 0,
        processingStartedAt: staleLease,
        payload: body,
        now: new Date(),
      }),
    ).rejects.toBeInstanceOf(FencedOutError);

    /* Exactly one Ticket, and the claim still points at B's. */
    const created = await prisma.ticket.findMany({ where: { summary } });
    expect(created).toHaveLength(1);
    expect(created[0].publicId).toBe(winner.ticket.publicId);

    const claim = await claimFor(key);
    expect(claim?.status).toBe(IdempotencyStatus.COMPLETED);
    expect(claim?.ticketId).toBe(created[0].id);
  }, 30_000);

  it("never leaves a FAILED status behind", async () => {
    const statuses = await prisma.idempotencyRecord.findMany({ select: { status: true } });

    for (const row of statuses) {
      expect([IdempotencyStatus.PROCESSING, IdempotencyStatus.COMPLETED]).toContain(row.status);
    }
  });
});
