import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../src/http/errors.js";
import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { MAX_ATTACHMENT_BYTES } from "../../src/services/attachmentRules.js";
import { AttachmentService } from "../../src/services/attachmentService.js";

/*
 * UNIT-11 to UNIT-14. The service is exercised directly against a Prisma double
 * so the rules can be read without an HTTP request in the way; the same rules
 * are proved over the wire in `attachments.api.test.ts` and against a real
 * engine in the PostgreSQL suites.
 */

const ACTOR = "alice.johnson@example.com";
const REQUESTER_ID = 3;
const TICKET_PUBLIC_ID = "05a214b4-b957-4ed7-a58e-73f4392b35ec";
const PENDING_KEY = "eb87467e-b209-4a18-bbc6-c8c5a4dccf95";
const ACTIVE_KEY = "11111111-1111-4111-8111-111111111111";
const REMOVED_KEY = "22222222-2222-4222-8222-222222222222";

const tx = {
  ticket: { findFirst: vi.fn() },
  attachment: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
    updateMany: vi.fn(),
  },
};

const prisma = {
  attachment: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  $transaction: vi.fn(),
};

function service(): AttachmentService {
  return new AttachmentService(prisma as unknown as PrismaClient);
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 11,
    storageKey: PENDING_KEY,
    ticketId: null,
    uploadedByRequesterId: REQUESTER_ID,
    originalName: "vpn-error.png",
    extension: "png",
    mimeType: "image/png",
    sizeBytes: 12,
    removalReason: null,
    deleted: false,
    createdBy: ACTOR,
    createdAt: new Date("2026-08-20T08:10:00.000Z"),
    updatedBy: ACTOR,
    updatedAt: new Date("2026-08-20T08:10:00.000Z"),
    ticket: null,
    ...overrides,
  };
}

function upload(filename: string, size = 12) {
  return { filename, data: Buffer.alloc(size, 1) };
}

async function rejectionOf(work: Promise<unknown>): Promise<ApiError> {
  try {
    await work;
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    return error as ApiError;
  }

  throw new Error("Expected the call to reject.");
}

beforeEach(() => {
  vi.clearAllMocks();
  prisma.attachment.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
    row(data),
  );
  prisma.$transaction.mockImplementation(async (work: (client: typeof tx) => unknown) => work(tx));
  tx.attachment.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
    row(data),
  );
  tx.attachment.count.mockResolvedValue(0);
  tx.ticket.findFirst.mockResolvedValue({ id: 42, publicId: TICKET_PUBLIC_ID });
});

describe("UNIT-11 pre-upload validation", () => {
  it("creates an owned, unbound Pending Attachment with derived metadata", async () => {
    const attachment = await service().createPending({
      requesterId: REQUESTER_ID,
      actor: ACTOR,
      file: upload("vpn-error.png", 281304),
    });

    expect(prisma.attachment.create).toHaveBeenCalledTimes(1);
    const { data } = prisma.attachment.create.mock.calls[0][0];
    expect(data).toMatchObject({
      ticketId: null,
      uploadedByRequesterId: REQUESTER_ID,
      originalName: "vpn-error.png",
      extension: "png",
      mimeType: "image/png",
      sizeBytes: 281304,
      createdBy: ACTOR,
      updatedBy: ACTOR,
    });
    /* The stored length is the binary's own length, never a client claim. */
    expect(data.data.length).toBe(281304);
    expect(attachment.ticketPublicId).toBeNull();
    expect(attachment.deleted).toBe(false);
  });

  it.each([
    ["photo.JPG", "jpg", "image/jpeg"],
    ["photo.JpEg", "jpeg", "image/jpeg"],
    ["screen.PNG", "png", "image/png"],
    ["shot.WebP", "webp", "image/webp"],
    ["report.Pdf", "pdf", "application/pdf"],
  ])("accepts %s case-insensitively and derives its MIME type", async (name, extension, mime) => {
    await service().createPending({ requesterId: REQUESTER_ID, actor: ACTOR, file: upload(name) });

    expect(prisma.attachment.create.mock.calls[0][0].data).toMatchObject({
      originalName: name,
      extension,
      mimeType: mime,
    });
  });

  it.each([
    ["docs/nested/vpn-error.png", "vpn-error.png"],
    ["C:\\Users\\alice\\vpn-error.png", "vpn-error.png"],
    ["../../etc/passwd.png", "passwd.png"],
    ["..\\..\\windows\\system32\\config.pdf", "config.pdf"],
  ])("takes the basename of %s across both separators", async (raw, expected) => {
    await service().createPending({ requesterId: REQUESTER_ID, actor: ACTOR, file: upload(raw) });

    expect(prisma.attachment.create.mock.calls[0][0].data.originalName).toBe(expected);
  });

  it.each([
    ["a carriage return", "vpn\r-error.png"],
    ["a line feed", "vpn\n-error.png"],
    ["a NUL", "vpn\u0000-error.png"],
    ["a control character", "vpn\u0007-error.png"],
  ])("rejects %s in the file name", async (_label, filename) => {
    const error = await rejectionOf(
      service().createPending({ requesterId: REQUESTER_ID, actor: ACTOR, file: upload(filename) }),
    );

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(prisma.attachment.create).not.toHaveBeenCalled();
  });

  it("accepts a 255-byte name and refuses a 256-byte one without truncating it", async () => {
    const longest = `${"a".repeat(251)}.png`;
    expect(Buffer.byteLength(longest, "utf8")).toBe(255);

    await service().createPending({
      requesterId: REQUESTER_ID,
      actor: ACTOR,
      file: upload(longest),
    });
    expect(prisma.attachment.create.mock.calls[0][0].data.originalName).toBe(longest);

    const error = await rejectionOf(
      service().createPending({
        requesterId: REQUESTER_ID,
        actor: ACTOR,
        file: upload(`${"a".repeat(252)}.png`),
      }),
    );

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(prisma.attachment.create).toHaveBeenCalledTimes(1);
  });

  it("measures the name in UTF-8 bytes rather than characters", async () => {
    /* 128 two-byte characters plus ".png" is 260 bytes but only 132 characters. */
    const name = `${"é".repeat(128)}.png`;
    expect([...name].length).toBeLessThan(255);
    expect(Buffer.byteLength(name, "utf8")).toBeGreaterThan(255);

    const error = await rejectionOf(
      service().createPending({ requesterId: REQUESTER_ID, actor: ACTOR, file: upload(name) }),
    );

    expect(error.code).toBe("VALIDATION_ERROR");
  });

  it("refuses an unsupported extension as a media-type failure", async () => {
    const error = await rejectionOf(
      service().createPending({
        requesterId: REQUESTER_ID,
        actor: ACTOR,
        file: upload("malware.exe"),
      }),
    );

    expect(error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
    expect(error.statusCode).toBe(415);
    expect(error.message).toBe("The attachment file type is not supported.");
    expect(prisma.attachment.create).not.toHaveBeenCalled();
  });

  it.each(["no-extension", "trailing-dot."])("refuses %s", async (filename) => {
    const error = await rejectionOf(
      service().createPending({ requesterId: REQUESTER_ID, actor: ACTOR, file: upload(filename) }),
    );

    expect(error.code).toBe("VALIDATION_ERROR");
  });

  it.each([
    ["a zero-byte file", 0, "VALIDATION_ERROR"],
    ["4,999,999 bytes", MAX_ATTACHMENT_BYTES - 1, null],
    ["5,000,000 bytes", MAX_ATTACHMENT_BYTES, null],
    ["5,000,001 bytes", MAX_ATTACHMENT_BYTES + 1, "PAYLOAD_TOO_LARGE"],
  ])("handles %s at the exact contract boundary", async (_label, size, expected) => {
    const call = service().createPending({
      requesterId: REQUESTER_ID,
      actor: ACTOR,
      file: upload("vpn-error.png", size),
    });

    if (expected === null) {
      await call;
      expect(prisma.attachment.create.mock.calls[0][0].data.sizeBytes).toBe(size);
      return;
    }

    const error = await rejectionOf(call);
    expect(error.code).toBe(expected);
    /* No usable Attachment is created for a refused file. */
    expect(prisma.attachment.create).not.toHaveBeenCalled();
  });

  it("states the exact byte limit in the oversized-file message", async () => {
    const error = await rejectionOf(
      service().createPending({
        requesterId: REQUESTER_ID,
        actor: ACTOR,
        file: upload("vpn-error.png", MAX_ATTACHMENT_BYTES + 1),
      }),
    );

    expect(error.message).toBe(
      "The uploaded file exceeds the maximum allowed size of 5,000,000 bytes.",
    );
  });

  it("allows duplicate original file names, because identity is the storage key", async () => {
    await service().createPending({
      requesterId: REQUESTER_ID,
      actor: ACTOR,
      file: upload("vpn-error.png"),
    });
    await service().createPending({
      requesterId: REQUESTER_ID,
      actor: ACTOR,
      file: upload("vpn-error.png"),
    });

    const [first, second] = prisma.attachment.create.mock.calls;
    expect(second[0].data.originalName).toBe(first[0].data.originalName);
    expect(second[0].data.storageKey).not.toBe(first[0].data.storageKey);
  });
});

describe("UNIT-12 lifecycle, binding, and the five-Active limit", () => {
  it("adds an Active Attachment to an owned Ticket inside one Serializable transaction", async () => {
    const attachment = await service().createForTicket({
      requesterId: REQUESTER_ID,
      actor: ACTOR,
      publicId: TICKET_PUBLIC_ID,
      file: upload("vpn-error.png"),
    });

    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
    expect(tx.attachment.create.mock.calls[0][0].data).toMatchObject({ ticketId: 42 });
    expect(attachment.ticketPublicId).toBe(TICKET_PUBLIC_ID);
    expect(attachment.deleted).toBe(false);
  });

  it("counts only Active rows, so Removed ones do not consume a slot", async () => {
    await service().createForTicket({
      requesterId: REQUESTER_ID,
      actor: ACTOR,
      publicId: TICKET_PUBLIC_ID,
      file: upload("vpn-error.png"),
    });

    expect(tx.attachment.count).toHaveBeenCalledWith({
      where: { ticketId: 42, deleted: false },
    });
  });

  it("conflicts at five Active Attachments without inserting", async () => {
    tx.attachment.count.mockResolvedValue(5);

    const error = await rejectionOf(
      service().createForTicket({
        requesterId: REQUESTER_ID,
        actor: ACTOR,
        publicId: TICKET_PUBLIC_ID,
        file: upload("vpn-error.png"),
      }),
    );

    expect(error.statusCode).toBe(409);
    expect(tx.attachment.create).not.toHaveBeenCalled();
  });

  it("resolves the Ticket with ownership and the soft-delete flag in the where", async () => {
    await service().createForTicket({
      requesterId: REQUESTER_ID,
      actor: ACTOR,
      publicId: TICKET_PUBLIC_ID,
      file: upload("vpn-error.png"),
    });

    expect(tx.ticket.findFirst.mock.calls[0][0].where).toEqual({
      publicId: TICKET_PUBLIC_ID,
      requesterId: REQUESTER_ID,
      deleted: false,
    });
  });

  it.each([
    ["a Ticket that does not resolve", TICKET_PUBLIC_ID, true],
    ["a malformed Ticket identifier", "not-a-uuid", false],
  ])("answers 404 for %s", async (_label, publicId, reaches) => {
    tx.ticket.findFirst.mockResolvedValue(null);

    const error = await rejectionOf(
      service().createForTicket({
        requesterId: REQUESTER_ID,
        actor: ACTOR,
        publicId,
        file: upload("vpn-error.png"),
      }),
    );

    expect(error.statusCode).toBe(404);
    /* A malformed identifier never reaches the `@db.Uuid` column. */
    expect(prisma.$transaction).toHaveBeenCalledTimes(reaches ? 1 : 0);
  });
});

describe("UNIT-12 bounded Serializable retry", () => {
  function serializationFailure() {
    return Object.assign(new Error("could not serialize access"), { code: "40001" });
  }

  /*
   * The shape the pg driver adapter actually raises: no `code` of its own, the
   * SQLSTATE nested under `cause.originalCode`, and a message that says only
   * `TransactionWriteConflict`. Pinned because matching only the flat `code`
   * spelling let a losing upload escape as a 500 instead of retrying.
   */
  function driverAdapterConflict() {
    return Object.assign(new Error("TransactionWriteConflict"), {
      name: "DriverAdapterError",
      cause: {
        kind: "TransactionWriteConflict",
        originalCode: "40001",
        originalMessage: "could not serialize access due to read/write dependencies",
      },
    });
  }

  it("retries a serialization failure and succeeds within three attempts", async () => {
    prisma.$transaction
      .mockRejectedValueOnce(serializationFailure())
      .mockImplementationOnce(async (work: (client: typeof tx) => unknown) => work(tx));

    await service().createForTicket({
      requesterId: REQUESTER_ID,
      actor: ACTOR,
      publicId: TICKET_PUBLIC_ID,
      file: upload("vpn-error.png"),
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it("recognises the driver adapter's own spelling of a write conflict", async () => {
    prisma.$transaction
      .mockRejectedValueOnce(driverAdapterConflict())
      .mockImplementationOnce(async (work: (client: typeof tx) => unknown) => work(tx));

    await service().createForTicket({
      requesterId: REQUESTER_ID,
      actor: ACTOR,
      publicId: TICKET_PUBLIC_ID,
      file: upload("vpn-error.png"),
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it("stops after three total attempts and lets the centralized 500 answer", async () => {
    prisma.$transaction.mockRejectedValue(serializationFailure());

    await expect(
      service().createForTicket({
        requesterId: REQUESTER_ID,
        actor: ACTOR,
        publicId: TICKET_PUBLIC_ID,
        file: upload("vpn-error.png"),
      }),
    ).rejects.toThrow(/serialize/);

    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
  });

  it.each([
    ["a business conflict", new ApiError("CONFLICT")],
    ["a safe not-found", new ApiError("NOT_FOUND")],
  ])("never retries %s", async (_label, thrown) => {
    prisma.$transaction.mockRejectedValue(thrown);

    await expect(
      service().createForTicket({
        requesterId: REQUESTER_ID,
        actor: ACTOR,
        publicId: TICKET_PUBLIC_ID,
        file: upload("vpn-error.png"),
      }),
    ).rejects.toBe(thrown);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe("UNIT-13 metadata, preview, and download access", () => {
  it("scopes every read to Pending ownership or the owning Ticket", async () => {
    prisma.attachment.findFirst.mockResolvedValue(row());

    await service().findMetadata(REQUESTER_ID, PENDING_KEY);

    expect(prisma.attachment.findFirst.mock.calls[0][0].where).toEqual({
      storageKey: PENDING_KEY,
      OR: [
        { ticketId: null, uploadedByRequesterId: REQUESTER_ID },
        { ticket: { requesterId: REQUESTER_ID, deleted: false } },
      ],
    });
  });

  it("reports a Pending Attachment with a null Ticket public identifier", async () => {
    prisma.attachment.findFirst.mockResolvedValue(row());

    const attachment = await service().findMetadata(REQUESTER_ID, PENDING_KEY);

    expect(attachment).toMatchObject({
      attachmentId: PENDING_KEY,
      ticketPublicId: null,
      deleted: false,
      removalReason: null,
    });
  });

  it("keeps Removed metadata readable, with its reason and deleted flag", async () => {
    prisma.attachment.findFirst.mockResolvedValue(
      row({
        storageKey: REMOVED_KEY,
        ticketId: 42,
        deleted: true,
        removalReason: "Duplicate document.",
        ticket: { publicId: TICKET_PUBLIC_ID },
      }),
    );

    const attachment = await service().findMetadata(REQUESTER_ID, REMOVED_KEY);

    expect(attachment).toMatchObject({
      ticketPublicId: TICKET_PUBLIC_ID,
      deleted: true,
      removalReason: "Duplicate document.",
    });
  });

  it.each([
    ["an unavailable or out-of-scope key", PENDING_KEY, true],
    ["a malformed key", "not-a-uuid", false],
  ])("returns null for %s", async (_label, key, reaches) => {
    prisma.attachment.findFirst.mockResolvedValue(null);

    expect(await service().findMetadata(REQUESTER_ID, key)).toBeNull();
    expect(prisma.attachment.findFirst).toHaveBeenCalledTimes(reaches ? 1 : 0);
  });

  it("serves the binary of a Pending or Active owned Attachment", async () => {
    prisma.attachment.findFirst.mockResolvedValue({
      data: new Uint8Array([1, 2, 3]),
      mimeType: "image/png",
      originalName: "vpn-error.png",
      sizeBytes: 3,
      deleted: false,
    });

    const binary = await service().findBinary(REQUESTER_ID, ACTIVE_KEY);

    expect(binary).toEqual({
      data: Buffer.from([1, 2, 3]),
      mimeType: "image/png",
      originalName: "vpn-error.png",
      sizeBytes: 3,
    });
  });

  it("answers Gone for a Removed owned Attachment", async () => {
    prisma.attachment.findFirst.mockResolvedValue({
      data: new Uint8Array([1]),
      mimeType: "application/pdf",
      originalName: "old.pdf",
      sizeBytes: 1,
      deleted: true,
    });

    const error = await rejectionOf(service().findBinary(REQUESTER_ID, REMOVED_KEY));

    expect(error.statusCode).toBe(410);
    expect(error.code).toBe("GONE");
  });

  it("returns null rather than Gone when the binary is not in scope at all", async () => {
    prisma.attachment.findFirst.mockResolvedValue(null);

    expect(await service().findBinary(REQUESTER_ID, ACTIVE_KEY)).toBeNull();
  });
});

describe("UNIT-14 unified collection deletion", () => {
  const PENDING = { id: 11, storageKey: PENDING_KEY, ticketId: null, deleted: false };
  const ACTIVE = { id: 12, storageKey: ACTIVE_KEY, ticketId: 42, deleted: false };
  const REMOVED = { id: 13, storageKey: REMOVED_KEY, ticketId: 42, deleted: true };

  beforeEach(() => {
    tx.attachment.deleteMany.mockResolvedValue({ count: 1 });
    tx.attachment.updateMany.mockResolvedValue({ count: 1 });
  });

  function remove(items: { attachmentId: string; reason: string }[]) {
    return service().deleteCollection({ requesterId: REQUESTER_ID, actor: ACTOR, items });
  }

  it("hard-deletes a Pending row and ignores its reason", async () => {
    tx.attachment.findMany.mockResolvedValue([PENDING]);

    await remove([{ attachmentId: PENDING_KEY, reason: "" }]);

    expect(tx.attachment.deleteMany).toHaveBeenCalledWith({
      where: { id: 11, ticketId: null, deleted: false },
    });
    expect(tx.attachment.updateMany).not.toHaveBeenCalled();
  });

  it("soft-removes an Active row with a trimmed reason and refreshed audit fields", async () => {
    tx.attachment.findMany.mockResolvedValue([ACTIVE]);

    await remove([{ attachmentId: ACTIVE_KEY, reason: "  Duplicate document.  " }]);

    const [call] = tx.attachment.updateMany.mock.calls;
    expect(call[0].where).toEqual({ id: 12, deleted: false });
    expect(call[0].data).toMatchObject({
      deleted: true,
      removalReason: "Duplicate document.",
      updatedBy: ACTOR,
    });
    expect(call[0].data.updatedAt).toBeInstanceOf(Date);
    /* The binary and the metadata stay: a Removed row is retained evidence. */
    expect(tx.attachment.deleteMany).not.toHaveBeenCalled();
  });

  it("commits a mixed batch in one transaction, in sorted identifier order", async () => {
    tx.attachment.findMany.mockResolvedValue([ACTIVE, PENDING]);

    await remove([
      { attachmentId: ACTIVE_KEY, reason: "Wrong screenshot." },
      { attachmentId: PENDING_KEY, reason: "" },
    ]);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.attachment.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.attachment.deleteMany).toHaveBeenCalledTimes(1);
    /* "11111111-..." sorts before "eb87467e-...", so the Active row is locked first. */
    expect(tx.attachment.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.attachment.deleteMany.mock.invocationCallOrder[0],
    );
  });

  it.each([
    ["an already Removed item", [REMOVED], REMOVED_KEY],
    ["an unavailable or out-of-scope item", [], PENDING_KEY],
  ])("answers 404 for %s and mutates nothing", async (_label, found, key) => {
    tx.attachment.findMany.mockResolvedValue(found);

    const error = await rejectionOf(remove([{ attachmentId: key, reason: "A valid reason." }]));

    expect(error.statusCode).toBe(404);
    expect(tx.attachment.deleteMany).not.toHaveBeenCalled();
    expect(tx.attachment.updateMany).not.toHaveBeenCalled();
  });

  it("leaves the whole batch unchanged when one item is unavailable", async () => {
    tx.attachment.findMany.mockResolvedValue([PENDING]);

    const error = await rejectionOf(
      remove([
        { attachmentId: PENDING_KEY, reason: "" },
        { attachmentId: ACTIVE_KEY, reason: "Wrong screenshot." },
      ]),
    );

    expect(error.statusCode).toBe(404);
    expect(tx.attachment.deleteMany).not.toHaveBeenCalled();
  });

  it.each([
    ["a missing reason", ""],
    ["a reason of two characters", "no"],
    ["a whitespace-only reason", "     "],
    ["a reason of 201 characters", "a".repeat(201)],
    /*
     * 4 UTF-16 code units but 2 characters. A `.length` check would accept it
     * and PostgreSQL's `char_length` CHECK would then reject the UPDATE -- a 500
     * where the contract requires this 400.
     */
    ["a reason of two astral characters", "\u{1F600}\u{1F600}"],
    ["a reason of 201 astral characters", "\u{1F600}".repeat(201)],
    /* PostgreSQL `text` cannot hold NUL at all. */
    ["a reason carrying a control character", "ab\u0000cd"],
  ])("rejects %s on an Active item without mutating", async (_label, reason) => {
    tx.attachment.findMany.mockResolvedValue([ACTIVE]);

    const error = await rejectionOf(remove([{ attachmentId: ACTIVE_KEY, reason }]));

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details?.[0]?.field).toBe("items[0].reason");
    expect(tx.attachment.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    ["three characters", "abc"],
    ["200 characters", "a".repeat(200)],
  ])("accepts a trimmed reason of %s", async (_label, reason) => {
    tx.attachment.findMany.mockResolvedValue([ACTIVE]);

    await remove([{ attachmentId: ACTIVE_KEY, reason }]);

    expect(tx.attachment.updateMany).toHaveBeenCalledTimes(1);
  });

  it("refuses to hard-delete a row that stopped being Pending under the batch", async () => {
    tx.attachment.findMany.mockResolvedValue([PENDING]);
    /* The guarded delete matches nothing: a concurrent create bound the row. */
    tx.attachment.deleteMany.mockResolvedValue({ count: 0 });

    const error = await rejectionOf(remove([{ attachmentId: PENDING_KEY, reason: "" }]));

    expect(error.statusCode).toBe(409);
  });
});
