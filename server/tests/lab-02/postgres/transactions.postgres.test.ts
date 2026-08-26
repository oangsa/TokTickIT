import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

import { RequestedPriority } from "../../../src/generated/prisma/enums.js";
import type { PrismaClient } from "../../../src/generated/prisma/client.js";
import { AttachmentService } from "../../../src/services/attachmentService.js";
import { runCreateTicket } from "../../../src/services/createTicketFlow.js";
import { parseCreateTicketRequest } from "../../../src/services/ticketCreateRequest.js";
import {
  assertLab2TestDatabase,
  createTestPrisma,
  deployMigrations,
  resetTestSchema,
  type TestDatabaseTarget,
} from "./testDatabase.js";

interface Fixture {
  requesterId: number;
  categoryId: number;
  relatedSystemId: number;
  ticketId: number;
}

interface TicketOptions {
  publicId?: string;
  ticketNumber?: string;
  summary?: string;
  description?: string;
}

interface AttachmentOptions {
  data?: Uint8Array<ArrayBuffer>;
  storageKey?: string;
  sizeBytes?: number;
  ticketId?: number | null;
  deleted?: boolean;
  removalReason?: string | null;
  originalName?: string;
}

function createBytes(length: number, value = 0x61): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(length));
  bytes.fill(value);
  return bytes;
}

async function createFixture(prisma: PrismaClient): Promise<Fixture> {
  const requester = await prisma.developmentRequester.create({
    data: {
      name: "Attachment Test Requester",
      email: "attachment.test@example.com",
      createdBy: "system",
      updatedBy: "system",
    },
  });
  const category = await prisma.category.create({
    data: { name: "Attachment Test Category", createdBy: "system", updatedBy: "system" },
  });
  const relatedSystem = await prisma.relatedSystem.create({
    data: { name: "Attachment Test System", createdBy: "system", updatedBy: "system" },
  });
  const ticket = await prisma.ticket.create({
    data: {
      publicId: randomUUID(),
      ticketNumber: "TKT-20260822-ABCDEF123456",
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      summary: "Attachment fixture",
      requestedPriority: RequestedPriority.HIGH,
      description: "A valid attachment database fixture.",
      createdBy: "system",
      updatedBy: "system",
    },
  });

  return {
    requesterId: requester.id,
    categoryId: category.id,
    relatedSystemId: relatedSystem.id,
    ticketId: ticket.id,
  };
}

async function createTicket(
  prisma: PrismaClient,
  fixture: Fixture,
  options: TicketOptions = {},
) {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
  return prisma.ticket.create({
    data: {
      publicId: options.publicId ?? randomUUID(),
      ticketNumber: options.ticketNumber ?? `TKT-20260822-${suffix}`,
      requesterId: fixture.requesterId,
      categoryId: fixture.categoryId,
      relatedSystemId: fixture.relatedSystemId,
      summary: options.summary ?? "Valid Ticket summary",
      requestedPriority: RequestedPriority.MEDIUM,
      description: options.description ?? "A valid Ticket constraint test description.",
      createdBy: "system",
      updatedBy: "system",
    },
  });
}

async function createAttachment(
  prisma: PrismaClient,
  fixture: Fixture,
  options: AttachmentOptions = {},
) {
  const data = options.data ?? createBytes(10);
  return prisma.attachment.create({
    data: {
      storageKey: options.storageKey ?? randomUUID(),
      ticketId: options.ticketId ?? null,
      uploadedByRequesterId: fixture.requesterId,
      originalName: options.originalName ?? "document.bin",
      extension: ".bin",
      mimeType: "application/octet-stream",
      sizeBytes: options.sizeBytes ?? data.length,
      data,
      removalReason: options.removalReason ?? null,
      deleted: options.deleted ?? false,
      createdBy: "system",
      updatedBy: "system",
    },
  });
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

describe.sequential("Lab 2 Attachment PostgreSQL invariants", () => {
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

  it("accepts Pending, Active, and Removed lifecycle states", async () => {
    await expect(createAttachment(prisma, fixture)).resolves.toBeDefined();
    await expect(
      createAttachment(prisma, fixture, { ticketId: fixture.ticketId }),
    ).resolves.toBeDefined();
    await expect(
      createAttachment(prisma, fixture, {
        ticketId: fixture.ticketId,
        deleted: true,
        removalReason: "Requester removed file",
      }),
    ).resolves.toBeDefined();
  }, 30_000);

  it("allows Pending cleanup and keeps removal metadata attached on soft removal", async () => {
    const pendingAttachment = await createAttachment(prisma, fixture);
    await expect(
      prisma.attachment.delete({ where: { id: pendingAttachment.id } }),
    ).resolves.toBeDefined();

    // Soft removal is the normal bound-file removal path: the Ticket binding
    // and the reason both survive it.
    const activeAttachment = await createAttachment(prisma, fixture, {
      ticketId: fixture.ticketId,
    });
    await expect(
      prisma.attachment.update({
        where: { id: activeAttachment.id },
        data: { deleted: true, removalReason: "Requester removed file" },
      }),
    ).resolves.toMatchObject({
      ticketId: fixture.ticketId,
      deleted: true,
      removalReason: "Requester removed file",
    });

    // The lifecycle CHECK is what keeps removal metadata attached: a bound row
    // cannot be marked removed without a trimmed 3-200 character reason.
    const secondActiveAttachment = await createAttachment(prisma, fixture, {
      ticketId: fixture.ticketId,
    });
    await expectDatabaseReject(
      () =>
        prisma.attachment.update({
          where: { id: secondActiveAttachment.id },
          data: { deleted: true },
        }),
      "23514",
    );
  }, 30_000);

  it("rejects invalid lifecycle combinations and removal reasons", async () => {
    for (const options of [
      { deleted: true },
      { removalReason: "Pending file reason" },
      { deleted: true, removalReason: "Requester removed file" },
      { ticketId: fixture.ticketId, removalReason: "Active file reason" },
      { ticketId: fixture.ticketId, deleted: true },
      { ticketId: fixture.ticketId, deleted: true, removalReason: "ab" },
      {
        ticketId: fixture.ticketId,
        deleted: true,
        removalReason: "  not trimmed  ",
      },
    ]) {
      await expectDatabaseReject(() => createAttachment(prisma, fixture, options), "23514");
    }

    await expectDatabaseReject(
      () =>
        createAttachment(prisma, fixture, {
          ticketId: fixture.ticketId,
          deleted: true,
          removalReason: "r".repeat(201),
        }),
      "22001",
    );
  }, 30_000);

  it("accepts exact removal-reason length boundaries", async () => {
    for (const removalReason of ["abc", "r".repeat(200)]) {
      await expect(
        createAttachment(prisma, fixture, {
          ticketId: fixture.ticketId,
          deleted: true,
          removalReason,
        }),
      ).resolves.toBeDefined();
    }
  }, 30_000);

  it("enforces the exact binary size boundaries and data-length invariant", async () => {
    await expectDatabaseReject(
      () => createAttachment(prisma, fixture, { data: createBytes(0), sizeBytes: 0 }),
      "23514",
    );

    for (const size of [4_999_999, 5_000_000]) {
      await expect(
        createAttachment(prisma, fixture, {
          data: createBytes(size),
          sizeBytes: size,
        }),
      ).resolves.toBeDefined();
    }

    await expectDatabaseReject(
      () =>
        createAttachment(prisma, fixture, {
          data: createBytes(5_000_001),
          sizeBytes: 5_000_001,
        }),
      "23514",
    );
    await expectDatabaseReject(
      () =>
        createAttachment(prisma, fixture, {
          data: createBytes(10),
          sizeBytes: 9,
        }),
      "23514",
    );
  }, 120_000);

  it("enforces the exact 1-255 UTF-8-byte originalName boundaries", async () => {
    for (const originalName of ["a", `${"é".repeat(127)}a`]) {
      await expect(
        createAttachment(prisma, fixture, { originalName }),
      ).resolves.toBeDefined();
    }

    await expectDatabaseReject(
      () => createAttachment(prisma, fixture, { originalName: "" }),
      "23514",
    );
    await expectDatabaseReject(
      () => createAttachment(prisma, fixture, { originalName: "é".repeat(128) }),
      "23514",
    );
  }, 30_000);

  it("enforces exact Ticket format and trimmed length boundaries", async () => {
    await expect(
      createTicket(prisma, fixture, {
        summary: "abc",
        description: "1234567890",
      }),
    ).resolves.toBeDefined();
    await expect(
      createTicket(prisma, fixture, {
        summary: "s".repeat(150),
        description: "d".repeat(2000),
      }),
    ).resolves.toBeDefined();

    for (const options of [
      { ticketNumber: "TKT-20260822-abcdef123456" },
      { summary: "ab" },
      { summary: " abc" },
      { description: "123456789" },
      { description: " valid description " },
    ]) {
      await expectDatabaseReject(() => createTicket(prisma, fixture, options), "23514");
    }

    await expectDatabaseReject(
      () => createTicket(prisma, fixture, { summary: "s".repeat(151) }),
      "22001",
    );
    await expectDatabaseReject(
      () => createTicket(prisma, fixture, { description: "d".repeat(2001) }),
      "22001",
    );
  }, 30_000);

  it("rejects duplicate authoritative unique keys", async () => {
    await expectDatabaseReject(() =>
      prisma.developmentRequester.create({
        data: {
          name: "Duplicate Requester Email",
          email: "attachment.test@example.com",
          createdBy: "system",
          updatedBy: "system",
        },
      }),
      "23505",
    );
    await expectDatabaseReject(() =>
      prisma.category.create({
        data: {
          name: "Attachment Test Category",
          createdBy: "system",
          updatedBy: "system",
        },
      }),
      "23505",
    );
    await expectDatabaseReject(() =>
      prisma.relatedSystem.create({
        data: {
          name: "Attachment Test System",
          createdBy: "system",
          updatedBy: "system",
        },
      }),
      "23505",
    );

    const publicId = randomUUID();
    const ticketNumber = "TKT-20260822-ABCDEFABCDEF";
    await expect(
      createTicket(prisma, fixture, { publicId, ticketNumber }),
    ).resolves.toBeDefined();
    await expectDatabaseReject(() =>
      createTicket(prisma, fixture, {
        publicId,
        ticketNumber: "TKT-20260822-123456789ABC",
      }),
      "23505",
    );
    await expectDatabaseReject(() =>
      createTicket(prisma, fixture, {
        publicId: randomUUID(),
        ticketNumber,
      }),
      "23505",
    );

    const storageKey = randomUUID();
    await expect(
      createAttachment(prisma, fixture, { storageKey }),
    ).resolves.toBeDefined();
    await expectDatabaseReject(() =>
      createAttachment(prisma, fixture, { storageKey }),
      "23505",
    );
  }, 30_000);
});

/*
 * PG-03 (BR-21-24, BR-52, AC-06, AC-11). The failure is injected at the
 * Attachment-binding step, after the claim is fenced and the Ticket row is
 * inserted, so the rollback under test is a real PostgreSQL rollback of a
 * partially written transaction rather than a simulated one.
 */
function withFailingBinding(client: PrismaClient): PrismaClient {
  return new Proxy(client, {
    get(target, property, receiver) {
      if (property !== "$transaction") {
        return Reflect.get(target, property, receiver);
      }

      return (callback: (tx: unknown) => unknown) =>
        (target as PrismaClient).$transaction((tx) =>
          Promise.resolve(
            callback(
              new Proxy(tx as object, {
                get(txTarget, txProperty) {
                  if (txProperty === "attachment") {
                    return new Proxy(Reflect.get(txTarget, txProperty) as object, {
                      get(delegate, method) {
                        if (method === "updateMany") {
                          return async () => {
                            throw new Error("injected binding failure");
                          };
                        }

                        const value = Reflect.get(delegate, method);
                        return typeof value === "function" ? value.bind(delegate) : value;
                      },
                    });
                  }

                  /*
                   * Bound to the transaction client: `$queryRaw` and the model
                   * delegates lose `this` when read through a bare Reflect.get.
                   */
                  const value = Reflect.get(txTarget, txProperty);
                  return typeof value === "function" ? value.bind(txTarget) : value;
                },
              }),
            ),
          ),
        );
    },
  }) as PrismaClient;
}

describe.sequential("Lab 2 Ticket-create transaction rollback", () => {
  let target: TestDatabaseTarget;
  let prisma: PrismaClient;
  let requesterId: number;
  let categoryId: number;
  let relatedSystemId: number;

  const ACTOR = "rollback.test@example.com";

  beforeAll(async () => {
    target = assertLab2TestDatabase();
    prisma = createTestPrisma(target);

    const requester = await prisma.developmentRequester.create({
      data: { name: "Rollback Test Requester", email: ACTOR, createdBy: "system", updatedBy: "system" },
    });
    const category = await prisma.category.create({
      data: { name: `Rollback Category ${randomUUID()}`, createdBy: "system", updatedBy: "system" },
    });
    const relatedSystem = await prisma.relatedSystem.create({
      data: { name: `Rollback System ${randomUUID()}`, createdBy: "system", updatedBy: "system" },
    });

    requesterId = requester.id;
    categoryId = category.id;
    relatedSystemId = relatedSystem.id;
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("leaves no Ticket, binding, or COMPLETED result when the transaction fails", async () => {
    const key = randomUUID();
    const summary = `Rollback ${key}`;

    const attachment = await prisma.attachment.create({
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

    const payload = {
      categoryId,
      relatedSystemId,
      summary,
      requestedPriority: "HIGH" as const,
      description: "The VPN client fails after entering my credentials.",
      attachmentIds: [attachment.storageKey],
    };

    await expect(
      runCreateTicket(withFailingBinding(prisma), {
        requesterId,
        actor: ACTOR,
        key,
        payload,
      }),
    ).rejects.toThrowError("injected binding failure");

    /* No partial Ticket survived the rollback. */
    expect(await prisma.ticket.findMany({ where: { summary } })).toHaveLength(0);

    /* The referenced row is still Pending and still retryable. */
    const afterFailure = await prisma.attachment.findUnique({
      where: { storageKey: attachment.storageKey },
    });
    expect(afterFailure?.ticketId).toBeNull();
    expect(afterFailure?.deleted).toBe(false);

    /*
     * BR-24 and api-spec Section 8.6: the owned claim is removed rather than
     * persisted as FAILED, so the unchanged retry below may run again.
     */
    expect(
      await prisma.idempotencyRecord.findUnique({
        where: { requesterId_key: { requesterId, key } },
      }),
    ).toBeNull();
  }, 30_000);

  /*
   * AC-08/AC-09. The mocked API suites prove what the validator accepts, but
   * only real PostgreSQL runs `ticket_summary_check` / `ticket_description_check`,
   * which count with `char_length` -- characters, not UTF-16 code units. So the
   * two layers can only be shown to agree here.
   *
   * An astral character is one character and two code units, so a `.length`
   * bound disagrees with the CHECK in both directions: it would let a
   * two-character Summary through to an insert-time 500, and refuse a
   * 150-character one the column holds fine. Both boundaries are driven through
   * `parseCreateTicketRequest` so the test fails if the two ever diverge again.
   */
  it("accepts the validator's maximum Summary and Description as real characters", async () => {
    const summary = "\u{1F600}".repeat(150);
    const description = "\u{1F600}".repeat(2000);

    const { payload } = parseCreateTicketRequest({
      categoryId,
      relatedSystemId,
      summary,
      requestedPriority: "LOW",
      description,
    });

    const { status, ticket } = await runCreateTicket(prisma, {
      requesterId,
      actor: ACTOR,
      key: randomUUID(),
      payload,
    });

    expect(status).toBe(201);
    expect(ticket.summary).toBe(summary);
    expect(ticket.description).toBe(description);

    /* What the CHECK counts, and what `.length` would have reported instead. */
    const [stored] = await prisma.$queryRaw<{ summary: number; description: number }[]>`
      SELECT char_length(summary) AS summary, char_length(description) AS description
      FROM ticket WHERE public_id = ${ticket.publicId}::uuid
    `;
    expect(Number(stored.summary)).toBe(150);
    expect(Number(stored.description)).toBe(2000);
    expect(summary.length).toBe(300);
  }, 30_000);

  /*
   * The other direction: a Summary the validator must reject because the CHECK
   * would. If `readTrimmedText` ever counts code units again this insert is what
   * it reaches, and the client sees a 500 instead of a safe 400.
   */
  it("rejects a two-character astral Summary that the CHECK would refuse", async () => {
    expect(() =>
      parseCreateTicketRequest({
        categoryId,
        relatedSystemId,
        summary: "\u{1F600}a",
        requestedPriority: "LOW",
        description: "A description well past the ten-character minimum.",
      }),
    ).toThrowError();

    await expect(
      prisma.ticket.create({
        data: {
          publicId: randomUUID(),
          ticketNumber: `TKT-20260822-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
          requesterId,
          categoryId,
          relatedSystemId,
          summary: "\u{1F600}a",
          requestedPriority: RequestedPriority.LOW,
          description: "A description well past the ten-character minimum.",
          createdBy: ACTOR,
          updatedBy: ACTOR,
        },
      }),
    ).rejects.toThrowError(/ticket_summary_check/);
  }, 30_000);

  /*
   * BR-03. A unique violation puts the whole PostgreSQL transaction into the
   * aborted state (SQLSTATE `25P02`), in which every later statement fails, so
   * the bounded Ticket Number retry only works if each failed attempt is rolled
   * back to its savepoint first. This reproduces `insertTicket`'s statement
   * sequence: without the rollback the second insert cannot run at all.
   */
  it("lets a Ticket insert retry after a unique violation inside the same transaction", async () => {
    const taken = `TKT-20260822-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
    const free = `TKT-20260822-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;

    function ticketData(ticketNumber: string, summary: string) {
      return {
        publicId: randomUUID(),
        ticketNumber,
        requesterId,
        categoryId,
        relatedSystemId,
        summary,
        requestedPriority: RequestedPriority.LOW,
        description: "A savepoint retry test description.",
        createdBy: ACTOR,
        updatedBy: ACTOR,
      };
    }

    await prisma.ticket.create({ data: ticketData(taken, `Occupier ${taken}`) });

    const retried = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SAVEPOINT ticket_number_attempt");

      let collided = false;
      try {
        await tx.ticket.create({ data: ticketData(taken, `Collides ${taken}`) });
      } catch (error) {
        collided = (error as { code?: string }).code === "P2002";
      }

      expect(collided).toBe(true);
      await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT ticket_number_attempt");

      /* Fails with 25P02 if the savepoint rollback above is removed. */
      return tx.ticket.create({ data: ticketData(free, `Retried ${free}`) });
    });

    expect(retried.ticketNumber).toBe(free);
    expect(await prisma.ticket.findMany({ where: { ticketNumber: taken } })).toHaveLength(1);
  }, 30_000);

  /*
   * BR-51 under concurrency. The Pending read inside the create transaction is
   * not locking, so a competing writer can bind the same row after that read.
   * The competitor here is an open transaction holding the row lock: the create
   * reads the row as Pending from the committed snapshot, then blocks on its
   * binding UPDATE until the competitor commits, and must re-check Pending
   * state under the lock instead of silently moving the Attachment across.
   */
  it("refuses to rebind an Attachment a competing writer took after the Pending read", async () => {
    const key = randomUUID();
    const summary = `Contended binding ${key}`;

    const attachment = await prisma.attachment.create({
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

    /* The Ticket the competitor binds the row to. */
    const winner = await prisma.ticket.create({
      data: {
        publicId: randomUUID(),
        ticketNumber: `TKT-20260822-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
        requesterId,
        categoryId,
        relatedSystemId,
        summary: `Winner ${key}`,
        requestedPriority: RequestedPriority.LOW,
        description: "Holds the contended Attachment binding.",
        createdBy: ACTOR,
        updatedBy: ACTOR,
      },
    });

    let releaseCompetitor: () => void = () => {};
    const competitorCommitted = prisma.$transaction(
      async (tx) => {
        await tx.attachment.update({
          where: { id: attachment.id },
          data: { ticketId: winner.id, updatedBy: ACTOR },
        });
        /* Row lock held, change uncommitted, until the create is blocked on it. */
        await new Promise<void>((resolve) => (releaseCompetitor = resolve));
      },
      { timeout: 20_000 },
    );

    const created = runCreateTicket(prisma, {
      requesterId,
      actor: ACTOR,
      key,
      payload: {
        categoryId,
        relatedSystemId,
        summary,
        requestedPriority: "HIGH" as const,
        description: "The VPN client fails after entering my credentials.",
        attachmentIds: [attachment.storageKey],
      },
    });

    /* Long enough for the create to reach the binding UPDATE and block there. */
    await new Promise((resolve) => setTimeout(resolve, 500));
    releaseCompetitor();
    await competitorCommitted;

    await expect(created).rejects.toMatchObject({ code: "CONFLICT", statusCode: 409 });

    /* The competitor keeps the Attachment and the losing Ticket never existed. */
    const bound = await prisma.attachment.findUnique({ where: { id: attachment.id } });
    expect(bound?.ticketId).toBe(winner.id);
    expect(await prisma.ticket.findMany({ where: { summary } })).toHaveLength(0);
    expect(
      await prisma.idempotencyRecord.findUnique({
        where: { requesterId_key: { requesterId, key } },
      }),
    ).toBeNull();
  }, 60_000);

  it("lets the unchanged retry succeed with the same key and the same Pending rows", async () => {
    const key = randomUUID();
    const summary = `Rollback retry ${key}`;

    const attachment = await prisma.attachment.create({
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

    const payload = {
      categoryId,
      relatedSystemId,
      summary,
      requestedPriority: "HIGH" as const,
      description: "The VPN client fails after entering my credentials.",
      attachmentIds: [attachment.storageKey],
    };

    await expect(
      runCreateTicket(withFailingBinding(prisma), { requesterId, actor: ACTOR, key, payload }),
    ).rejects.toThrowError("injected binding failure");

    const retry = await runCreateTicket(prisma, { requesterId, actor: ACTOR, key, payload });

    expect(retry.status).toBe(201);
    expect(retry.ticket.attachments.map((row) => row.attachmentId)).toEqual([
      attachment.storageKey,
    ]);

    const tickets = await prisma.ticket.findMany({ where: { summary } });
    expect(tickets).toHaveLength(1);

    const bound = await prisma.attachment.findUnique({
      where: { storageKey: attachment.storageKey },
    });
    expect(bound?.ticketId).toBe(tickets[0].id);

    const claim = await prisma.idempotencyRecord.findUnique({
      where: { requesterId_key: { requesterId, key } },
    });
    expect(claim?.status).toBe("COMPLETED");
    expect(claim?.ticketId).toBe(tickets[0].id);
  }, 30_000);
});

/*
 * PG-04. The collection endpoint mixes an irreversible hard delete with a
 * reversible soft removal in one transaction, so "all or nothing" is the only
 * property that keeps a failed batch from destroying a Pending row while leaving
 * an Active one untouched. A mocked `$transaction` cannot show that; a real
 * ROLLBACK can.
 */
describe.sequential("PG-04 mixed Attachment batch rollback", () => {
  let target: TestDatabaseTarget;
  let prisma: PrismaClient;
  let fixture: Fixture;

  const BATCH_ACTOR = "collection.rollback@example.com";

  beforeAll(async () => {
    target = assertLab2TestDatabase();
    prisma = createTestPrisma(target);

    /* Its own identities: the suite shares one database across describes, and
     * `development_requester.email` is unique. */
    const requester = await prisma.developmentRequester.create({
      data: { name: "Batch Rollback Requester", email: BATCH_ACTOR, createdBy: "system", updatedBy: "system" },
    });
    const category = await prisma.category.create({
      data: { name: `Batch Category ${randomUUID()}`, createdBy: "system", updatedBy: "system" },
    });
    const relatedSystem = await prisma.relatedSystem.create({
      data: { name: `Batch System ${randomUUID()}`, createdBy: "system", updatedBy: "system" },
    });
    const suffix = randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
    const ticket = await prisma.ticket.create({
      data: {
        publicId: randomUUID(),
        ticketNumber: `TKT-20260826-${suffix}`,
        requesterId: requester.id,
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        summary: "Batch rollback fixture",
        requestedPriority: RequestedPriority.MEDIUM,
        description: "A Ticket owning the Active Attachment in the mixed batch.",
        createdBy: "system",
        updatedBy: "system",
      },
    });

    fixture = {
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      ticketId: ticket.id,
    };
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  /*
   * The failure is injected inside the transaction, after the first mutation has
   * already been issued: the second `updateMany` raises where a lost race, a
   * constraint, or a dropped connection would.
   */
  function clientFailingAfter(mutations: number): PrismaClient {
    let seen = 0;

    return new Proxy(prisma, {
      get(realClient, property, receiver) {
        if (property !== "$transaction") {
          return Reflect.get(realClient, property, receiver);
        }

        return (work: (tx: unknown) => Promise<unknown>) =>
          realClient.$transaction(async (tx) =>
            work(
              new Proxy(tx, {
                get(realTx, txProperty, txReceiver) {
                  if (txProperty !== "attachment") {
                    return Reflect.get(realTx, txProperty, txReceiver);
                  }

                  return new Proxy(realTx.attachment, {
                    get(model, operation, modelReceiver) {
                      const original = Reflect.get(model, operation, modelReceiver);

                      if (operation !== "deleteMany" && operation !== "updateMany") {
                        return original;
                      }

                      return async (args: unknown) => {
                        seen += 1;

                        if (seen > mutations) {
                          throw new Error("Injected failure after the batch began mutating.");
                        }

                        return (original as (input: unknown) => Promise<unknown>)(args);
                      };
                    },
                  });
                },
              }),
            ),
          );
      },
    }) as PrismaClient;
  }

  it("commits a mixed Pending hard delete and Active soft removal together", async () => {
    const pending = await createAttachment(prisma, fixture, { originalName: "draft.bin" });
    const active = await createAttachment(prisma, fixture, {
      ticketId: fixture.ticketId,
      originalName: "evidence.bin",
    });

    await new AttachmentService(prisma).deleteCollection({
      requesterId: fixture.requesterId,
      actor: BATCH_ACTOR,
      items: [
        { attachmentId: pending.storageKey, reason: "" },
        { attachmentId: active.storageKey, reason: "Uploaded the wrong document." },
      ],
    });

    expect(await prisma.attachment.count({ where: { id: pending.id } })).toBe(0);

    const removed = await prisma.attachment.findUnique({ where: { id: active.id } });
    expect(removed).toMatchObject({
      deleted: true,
      removalReason: "Uploaded the wrong document.",
      updatedBy: BATCH_ACTOR,
      ticketId: fixture.ticketId,
    });
    /* The binary is retained: a Removed Attachment is evidence, not a tombstone. */
    expect(removed?.data.length).toBeGreaterThan(0);
  }, 30_000);

  it("leaves no partial hard deletion or soft removal when the batch fails midway", async () => {
    const pending = await createAttachment(prisma, fixture, { originalName: "keep-draft.bin" });
    const active = await createAttachment(prisma, fixture, {
      ticketId: fixture.ticketId,
      originalName: "keep-evidence.bin",
    });

    await expect(
      new AttachmentService(clientFailingAfter(1)).deleteCollection({
        requesterId: fixture.requesterId,
        actor: BATCH_ACTOR,
        items: [
          { attachmentId: pending.storageKey, reason: "" },
          { attachmentId: active.storageKey, reason: "Uploaded the wrong document." },
        ],
      }),
    ).rejects.toThrow(/Injected failure/);

    /* The Pending row survives even though its delete was issued first. */
    const survivor = await prisma.attachment.findUnique({ where: { id: pending.id } });
    expect(survivor).not.toBeNull();
    expect(survivor).toMatchObject({ ticketId: null, deleted: false });

    const untouched = await prisma.attachment.findUnique({ where: { id: active.id } });
    expect(untouched).toMatchObject({
      deleted: false,
      removalReason: null,
      updatedBy: "system",
    });
  }, 30_000);
});

/*
 * The AttachmentService query shapes, executed by a real engine.
 *
 * These calls combine `omit` with `include` and use `omit` on a `create`, and
 * every other test of them runs against a Prisma double that would accept any
 * shape at all. A mock cannot say whether Prisma builds valid SQL from them, and
 * an invalid one would be a 500 on the most ordinary request in the feature.
 */
describe.sequential("AttachmentService query shapes against PostgreSQL", () => {
  let target: TestDatabaseTarget;
  let prisma: PrismaClient;
  let fixture: Fixture;

  const SHAPE_ACTOR = "query.shapes@example.com";

  beforeAll(async () => {
    target = assertLab2TestDatabase();
    prisma = createTestPrisma(target);

    const requester = await prisma.developmentRequester.create({
      data: { name: "Query Shape Requester", email: SHAPE_ACTOR, createdBy: "system", updatedBy: "system" },
    });
    const category = await prisma.category.create({
      data: { name: `Shape Category ${randomUUID()}`, createdBy: "system", updatedBy: "system" },
    });
    const relatedSystem = await prisma.relatedSystem.create({
      data: { name: `Shape System ${randomUUID()}`, createdBy: "system", updatedBy: "system" },
    });
    const suffix = randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
    const ticket = await prisma.ticket.create({
      data: {
        publicId: randomUUID(),
        ticketNumber: `TKT-20260826-${suffix}`,
        requesterId: requester.id,
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        summary: "Attachment query shapes",
        requestedPriority: RequestedPriority.LOW,
        description: "A Ticket used to exercise the bound-Attachment read shapes.",
        createdBy: "system",
        updatedBy: "system",
      },
    });

    fixture = {
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      ticketId: ticket.id,
    };
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("creates a Pending Attachment and reads it back without its bytes", async () => {
    const service = new AttachmentService(prisma);

    const created = await service.createPending({
      requesterId: fixture.requesterId,
      actor: SHAPE_ACTOR,
      file: { filename: "shape.png", data: Buffer.from([1, 2, 3, 4]) },
    });

    expect(created).toMatchObject({
      ticketPublicId: null,
      originalName: "shape.png",
      extension: "png",
      mimeType: "image/png",
      sizeBytes: 4,
      deleted: false,
    });
    expect(created).not.toHaveProperty("data");

    const metadata = await service.findMetadata(fixture.requesterId, created.attachmentId);
    expect(metadata).toMatchObject({ attachmentId: created.attachmentId, ticketPublicId: null });
    expect(metadata).not.toHaveProperty("data");

    const binary = await service.findBinary(fixture.requesterId, created.attachmentId);
    expect(binary?.data).toEqual(Buffer.from([1, 2, 3, 4]));
    /* `size_bytes = octet_length(data)` is a database CHECK, not a claim. */
    expect(binary?.sizeBytes).toBe(binary?.data.length);
  }, 30_000);

  it("resolves the owning Ticket public id for a bound Attachment", async () => {
    const service = new AttachmentService(prisma);
    const ticket = await prisma.ticket.findUnique({
      where: { id: fixture.ticketId },
      select: { publicId: true },
    });

    const created = await service.createForTicket({
      requesterId: fixture.requesterId,
      actor: SHAPE_ACTOR,
      publicId: ticket?.publicId ?? "",
      file: { filename: "bound.pdf", data: Buffer.from([5, 6]) },
    });

    expect(created.ticketPublicId).toBe(ticket?.publicId);

    const metadata = await service.findMetadata(fixture.requesterId, created.attachmentId);
    expect(metadata?.ticketPublicId).toBe(ticket?.publicId);
  }, 30_000);

  it("hides an Attachment owned by another Requester behind the same empty answer", async () => {
    const service = new AttachmentService(prisma);
    const other = await prisma.developmentRequester.create({
      data: {
        name: "Other Requester",
        email: `other-${randomUUID()}@example.com`,
        createdBy: "system",
        updatedBy: "system",
      },
    });

    const mine = await service.createPending({
      requesterId: fixture.requesterId,
      actor: SHAPE_ACTOR,
      file: { filename: "private.png", data: Buffer.from([7]) },
    });

    /* Ownership holds as an outcome, not as the presence of a predicate object. */
    expect(await service.findMetadata(other.id, mine.attachmentId)).toBeNull();
    expect(await service.findBinary(other.id, mine.attachmentId)).toBeNull();
    await expect(
      service.deleteCollection({
        requesterId: other.id,
        actor: "other@example.com",
        items: [{ attachmentId: mine.attachmentId, reason: "" }],
      }),
    ).rejects.toMatchObject({ statusCode: 404 });

    expect(
      await prisma.attachment.count({ where: { storageKey: mine.attachmentId } }),
    ).toBe(1);
  }, 30_000);

  it("retains the binary and the reason across a soft removal", async () => {
    const service = new AttachmentService(prisma);
    const ticket = await prisma.ticket.findUnique({
      where: { id: fixture.ticketId },
      select: { publicId: true },
    });

    const created = await service.createForTicket({
      requesterId: fixture.requesterId,
      actor: SHAPE_ACTOR,
      publicId: ticket?.publicId ?? "",
      file: { filename: "removable.pdf", data: Buffer.from([8, 9, 10]) },
    });

    await service.deleteCollection({
      requesterId: fixture.requesterId,
      actor: SHAPE_ACTOR,
      items: [{ attachmentId: created.attachmentId, reason: "  Duplicate document.  " }],
    });

    const metadata = await service.findMetadata(fixture.requesterId, created.attachmentId);
    expect(metadata).toMatchObject({
      deleted: true,
      removalReason: "Duplicate document.",
      updatedBy: SHAPE_ACTOR,
    });

    /* Readable as metadata, unavailable as bytes (BR-59, BR-65). */
    await expect(
      service.findBinary(fixture.requesterId, created.attachmentId),
    ).rejects.toMatchObject({ statusCode: 410 });

    const stored = await prisma.attachment.findUnique({
      where: { storageKey: created.attachmentId },
      select: { data: true },
    });
    expect(stored?.data.length).toBe(3);

    /* And it cannot be removed a second time. */
    await expect(
      service.deleteCollection({
        requesterId: fixture.requesterId,
        actor: SHAPE_ACTOR,
        items: [{ attachmentId: created.attachmentId, reason: "Removing it again." }],
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  }, 30_000);
});
