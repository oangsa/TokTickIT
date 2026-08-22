import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

import { RequestedPriority } from "../../../src/generated/prisma/enums.js";
import type { PrismaClient } from "../../../src/generated/prisma/client.js";
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
