import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

import { binaryParser } from "./support/binaryResponse.js";
import { ALICE, attachmentRow, prismaMock, tx } from "./support/ticketPrismaMock.js";

vi.mock("../../src/prisma.js", () => ({ getPrisma: () => prismaMock }));

import { app } from "../../src/app.js";
import { MAX_ATTACHMENT_BYTES } from "../../src/services/attachmentRules.js";

const TICKET_PUBLIC_ID = "05a214b4-b957-4ed7-a58e-73f4392b35ec";
const PENDING_KEY = "eb87467e-b209-4a18-bbc6-c8c5a4dccf95";
const ACTIVE_KEY = "11111111-1111-4111-8111-111111111111";
const REMOVED_KEY = "22222222-2222-4222-8222-222222222222";
const UNKNOWN_KEY = "33333333-3333-4333-8333-333333333333";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function upload(path: string) {
  return request(app).post(path).set("X-Requester-Id", String(ALICE.id));
}

function get(path: string, requesterId: number = ALICE.id) {
  return request(app).get(path).set("X-Requester-Id", String(requesterId));
}

function removeCollection(body: unknown) {
  return request(app)
    .delete("/api/attachments/collection")
    .set("X-Requester-Id", String(ALICE.id))
    .send(body as object);
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.developmentRequester.findFirst.mockResolvedValue(ALICE);
  prismaMock.$transaction.mockImplementation(
    async (work: (client: typeof tx) => unknown) => work(tx),
  );
  prismaMock.attachment.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => attachmentRow(data),
  );
  tx.attachment.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
    attachmentRow({ ...data, id: 21 }),
  );
  tx.attachment.count.mockResolvedValue(0);
  tx.attachment.deleteMany.mockResolvedValue({ count: 1 });
  tx.attachment.updateMany.mockResolvedValue({ count: 1 });
  tx.ticket.findFirst.mockResolvedValue({ id: 42, publicId: TICKET_PUBLIC_ID });
});

describe("API-39 standalone Pending pre-upload", () => {
  it("returns 201 and the full Pending AttachmentDTO", async () => {
    const res = await upload("/api/attachments").attach("file", PNG, {
      filename: "vpn-error.png",
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      ticketPublicId: null,
      originalName: "vpn-error.png",
      extension: "png",
      mimeType: "image/png",
      sizeBytes: PNG.length,
      removalReason: null,
      createdBy: ALICE.email,
      updatedBy: ALICE.email,
      deleted: false,
    });
    /* The public identifier is the opaque storage key, never the row id. */
    expect(res.body.attachmentId).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body).not.toHaveProperty("id");
    expect(res.body).not.toHaveProperty("data");

    const { data } = prismaMock.attachment.create.mock.calls[0][0];
    expect(data.ticketId).toBeNull();
    expect(data.uploadedByRequesterId).toBe(ALICE.id);
  });

  it("requires a valid Requester context", async () => {
    const res = await request(app)
      .post("/api/attachments")
      .attach("file", PNG, { filename: "vpn-error.png" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("REQUESTER_CONTEXT_INVALID");
    expect(prismaMock.attachment.create).not.toHaveBeenCalled();
  });
});

describe("API-40 unsupported Attachment extension", () => {
  it.each(["malware.exe", "notes.txt", "archive.zip", "sheet.xlsx"])(
    "refuses %s with 415 and creates nothing",
    async (filename) => {
      const res = await upload("/api/attachments").attach("file", PNG, { filename });

      expect(res.status).toBe(415);
      expect(res.body.code).toBe("UNSUPPORTED_MEDIA_TYPE");
      expect(res.body.message).toBe("The attachment file type is not supported.");
      expect(prismaMock.attachment.create).not.toHaveBeenCalled();
    },
  );
});

describe("API-41 Attachment size boundaries", () => {
  it.each([
    ["4,999,999", MAX_ATTACHMENT_BYTES - 1],
    ["5,000,000", MAX_ATTACHMENT_BYTES],
  ])("accepts a file of exactly %s bytes", async (_label, size) => {
    const res = await upload("/api/attachments").attach("file", Buffer.alloc(size, 7), {
      filename: "large.pdf",
    });

    expect(res.status).toBe(201);
    expect(res.body.sizeBytes).toBe(size);
  });

  it("refuses 5,000,001 bytes with 413 and creates no usable Attachment", async () => {
    const res = await upload("/api/attachments").attach(
      "file",
      Buffer.alloc(MAX_ATTACHMENT_BYTES + 1, 7),
      { filename: "too-large.pdf" },
    );

    expect(res.status).toBe(413);
    expect(res.body.code).toBe("PAYLOAD_TOO_LARGE");
    expect(res.body.message).toBe(
      "The uploaded file exceeds the maximum allowed size of 5,000,000 bytes.",
    );
    expect(prismaMock.attachment.create).not.toHaveBeenCalled();
  });
});

describe("API-42 MIME derived from the approved extension", () => {
  it.each([
    ["photo.jpg", "jpg", "image/jpeg"],
    ["photo.jpeg", "jpeg", "image/jpeg"],
    ["screen.png", "png", "image/png"],
    ["shot.webp", "webp", "image/webp"],
    ["report.pdf", "pdf", "application/pdf"],
  ])("maps %s to %s", async (filename, extension, mimeType) => {
    const res = await upload("/api/attachments").attach("file", PNG, { filename });

    expect(res.body).toMatchObject({ extension, mimeType });
  });

  it("ignores the multipart MIME value the client supplied", async () => {
    const res = await upload("/api/attachments").attach("file", PNG, {
      filename: "vpn-error.png",
      contentType: "application/x-msdownload",
    });

    expect(res.status).toBe(201);
    expect(res.body.mimeType).toBe("image/png");
  });
});

describe("API-43 cleanup is not reachable over HTTP", () => {
  it.each([
    ["post", "/api/attachments/cleanup"],
    ["post", "/api/maintenance/cleanup"],
    ["delete", "/api/attachments/expired"],
  ])("does not expose %s %s", async (method, path) => {
    const res = await request(app)
      [method as "post" | "delete"](path)
      .set("X-Requester-Id", String(ALICE.id));

    expect(res.status).toBe(404);
  });
});

describe("API-44 direct upload to an existing owned Ticket", () => {
  it("returns 201 with the Attachment bound to the requested Ticket", async () => {
    const res = await upload(`/api/tickets/${TICKET_PUBLIC_ID}/attachments`).attach("file", PNG, {
      filename: "vpn-error.png",
    });

    expect(res.status).toBe(201);
    expect(res.body.ticketPublicId).toBe(TICKET_PUBLIC_ID);
    expect(res.body.deleted).toBe(false);
    expect(tx.attachment.create.mock.calls[0][0].data.ticketId).toBe(42);
  });

  it("runs the Active count and the insert in one Serializable transaction", async () => {
    await upload(`/api/tickets/${TICKET_PUBLIC_ID}/attachments`).attach("file", PNG, {
      filename: "vpn-error.png",
    });

    expect(prismaMock.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
  });
});

describe("API-45 five-Active limit and replacement after removal", () => {
  it("returns 409 at five Active Attachments", async () => {
    tx.attachment.count.mockResolvedValue(5);

    const res = await upload(`/api/tickets/${TICKET_PUBLIC_ID}/attachments`).attach("file", PNG, {
      filename: "sixth.png",
    });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CONFLICT");
    expect(tx.attachment.create).not.toHaveBeenCalled();
  });

  it("accepts one replacement once a slot is freed by a soft removal", async () => {
    tx.attachment.count.mockResolvedValue(4);

    const res = await upload(`/api/tickets/${TICKET_PUBLIC_ID}/attachments`).attach("file", PNG, {
      filename: "replacement.png",
    });

    expect(res.status).toBe(201);
    /* Removed rows are excluded from the count, which is what frees the slot. */
    expect(tx.attachment.count).toHaveBeenCalledWith({ where: { ticketId: 42, deleted: false } });
  });
});

describe("API-46 and API-47 unavailable Ticket targets", () => {
  it.each([
    ["outside the current Requester scope", TICKET_PUBLIC_ID],
    ["missing", "9f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f"],
  ])("answers the same 404 for a Ticket that is %s", async (_label, publicId) => {
    tx.ticket.findFirst.mockResolvedValue(null);

    const res = await upload(`/api/tickets/${publicId}/attachments`).attach("file", PNG, {
      filename: "vpn-error.png",
    });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "The requested resource was not found.",
      error: "Not Found",
    });
    expect(tx.attachment.create).not.toHaveBeenCalled();
  });

  it("answers 404 for a malformed Ticket identifier without querying", async () => {
    const res = await upload("/api/tickets/not-a-uuid/attachments").attach("file", PNG, {
      filename: "vpn-error.png",
    });

    expect(res.status).toBe(404);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("excludes a logically deleted Ticket through the query predicate", async () => {
    await upload(`/api/tickets/${TICKET_PUBLIC_ID}/attachments`).attach("file", PNG, {
      filename: "vpn-error.png",
    });

    expect(tx.ticket.findFirst.mock.calls[0][0].where).toEqual({
      publicId: TICKET_PUBLIC_ID,
      requesterId: ALICE.id,
      deleted: false,
    });
  });
});

describe("API-48 Attachment metadata lifecycle", () => {
  it("returns 200 for an owned Pending Attachment with a null Ticket public id", async () => {
    prismaMock.attachment.findFirst.mockResolvedValue(attachmentRow({ ticket: null }));

    const res = await get(`/api/attachments/${PENDING_KEY}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ attachmentId: PENDING_KEY, ticketPublicId: null });
  });

  it("identifies the owning Ticket for an Active Attachment", async () => {
    prismaMock.attachment.findFirst.mockResolvedValue(
      attachmentRow({ storageKey: ACTIVE_KEY, ticketId: 42, ticket: { publicId: TICKET_PUBLIC_ID } }),
    );

    const res = await get(`/api/attachments/${ACTIVE_KEY}`);

    expect(res.body).toMatchObject({
      attachmentId: ACTIVE_KEY,
      ticketPublicId: TICKET_PUBLIC_ID,
      deleted: false,
    });
  });

  it("keeps a Removed Attachment readable with its reason", async () => {
    prismaMock.attachment.findFirst.mockResolvedValue(
      attachmentRow({
        storageKey: REMOVED_KEY,
        ticketId: 42,
        deleted: true,
        removalReason: "Duplicate document.",
        ticket: { publicId: TICKET_PUBLIC_ID },
      }),
    );

    const res = await get(`/api/attachments/${REMOVED_KEY}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ deleted: true, removalReason: "Duplicate document." });
  });

  it("never selects the stored bytes for a metadata read", async () => {
    prismaMock.attachment.findFirst.mockResolvedValue(attachmentRow({ ticket: null }));

    await get(`/api/attachments/${PENDING_KEY}`);

    expect(prismaMock.attachment.findFirst.mock.calls[0][0].omit).toEqual({ data: true });
  });

  it.each([
    ["an out-of-scope or unavailable identifier", UNKNOWN_KEY],
    ["a malformed identifier", "not-a-uuid"],
  ])("answers the same safe 404 for %s", async (_label, key) => {
    prismaMock.attachment.findFirst.mockResolvedValue(null);

    const res = await get(`/api/attachments/${key}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });
});

describe("API-49 and API-50 preview and download lifecycle", () => {
  function binaryRow(overrides: Record<string, unknown> = {}) {
    return {
      data: new Uint8Array(PNG),
      mimeType: "image/png",
      originalName: "vpn-error.png",
      sizeBytes: PNG.length,
      deleted: false,
      ...overrides,
    };
  }

  it.each([
    ["preview", "inline"],
    ["download", "attachment"],
  ])("serves an owned Attachment through %s as %s", async (route, disposition) => {
    prismaMock.attachment.findFirst.mockResolvedValue(binaryRow());

    const res = await get(`/api/attachments/${ACTIVE_KEY}/${route}`).buffer(true).parse(binaryParser);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("image/png");
    expect(res.headers["content-disposition"]).toContain(`${disposition};`);
    expect(res.headers["content-length"]).toBe(String(PNG.length));
    expect(res.body).toEqual(PNG);
  });

  it.each(["preview", "download"])("answers 410 for a Removed Attachment on %s", async (route) => {
    prismaMock.attachment.findFirst.mockResolvedValue(binaryRow({ deleted: true }));

    const res = await get(`/api/attachments/${REMOVED_KEY}/${route}`);

    expect(res.status).toBe(410);
    expect(res.body.code).toBe("GONE");
    expect(res.body.message).toBe("This resource is no longer available.");
  });

  it.each(["preview", "download"])(
    "answers 404 on %s for an unavailable or out-of-scope Attachment",
    async (route) => {
      prismaMock.attachment.findFirst.mockResolvedValue(null);

      const res = await get(`/api/attachments/${UNKNOWN_KEY}/${route}`);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("NOT_FOUND");
    },
  );

  it.each(["preview", "download"])("answers 404 on %s for a malformed identifier", async (route) => {
    const res = await get(`/api/attachments/not-a-uuid/${route}`);

    expect(res.status).toBe(404);
    expect(prismaMock.attachment.findFirst).not.toHaveBeenCalled();
  });

  it("scopes the binary read to Pending ownership or the owning Ticket", async () => {
    prismaMock.attachment.findFirst.mockResolvedValue(binaryRow());

    await get(`/api/attachments/${ACTIVE_KEY}/preview`).buffer(true).parse(binaryParser);

    expect(prismaMock.attachment.findFirst.mock.calls[0][0].where).toEqual({
      storageKey: ACTIVE_KEY,
      OR: [
        { ticketId: null, uploadedByRequesterId: ALICE.id },
        { ticket: { requesterId: ALICE.id, deleted: false } },
      ],
    });
  });
});

describe("API-51 to API-53 collection deletion behavior", () => {
  const PENDING_ROW = { id: 11, storageKey: PENDING_KEY, ticketId: null, deleted: false };
  const ACTIVE_ROW = { id: 12, storageKey: ACTIVE_KEY, ticketId: 42, deleted: false };

  it("hard-deletes a Pending row and ignores its reason", async () => {
    tx.attachment.findMany.mockResolvedValue([PENDING_ROW]);

    const res = await removeCollection({ items: [{ attachmentId: PENDING_KEY, reason: "" }] });

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
    expect(tx.attachment.deleteMany).toHaveBeenCalledWith({
      where: { id: 11, ticketId: null, deleted: false },
    });
  });

  it("soft-removes an Active row and retains its metadata", async () => {
    tx.attachment.findMany.mockResolvedValue([ACTIVE_ROW]);

    const res = await removeCollection({
      items: [{ attachmentId: ACTIVE_KEY, reason: "  Duplicate document.  " }],
    });

    expect(res.status).toBe(204);
    expect(tx.attachment.updateMany.mock.calls[0][0].data).toMatchObject({
      deleted: true,
      removalReason: "Duplicate document.",
      updatedBy: ALICE.email,
    });
    expect(tx.attachment.deleteMany).not.toHaveBeenCalled();
  });

  it("commits a mixed Pending and Active batch together", async () => {
    tx.attachment.findMany.mockResolvedValue([PENDING_ROW, ACTIVE_ROW]);

    const res = await removeCollection({
      items: [
        { attachmentId: PENDING_KEY, reason: "" },
        { attachmentId: ACTIVE_KEY, reason: "Wrong screenshot." },
      ],
    });

    expect(res.status).toBe(204);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.attachment.deleteMany).toHaveBeenCalledTimes(1);
    expect(tx.attachment.updateMany).toHaveBeenCalledTimes(1);
  });
});

describe("API-54 to API-61 collection validation", () => {
  const ACTIVE_ROW = { id: 12, storageKey: ACTIVE_KEY, ticketId: 42, deleted: false };

  it.each([
    ["an empty items array", { items: [] }],
    ["a missing items array", {}],
    ["a non-array items value", { items: "all" }],
  ])("rejects %s with 400 and no mutation", async (_label, body) => {
    const res = await removeCollection(body);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(res.body.details)).toBe(true);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a batch larger than 100 items", async () => {
    const items = Array.from({ length: 101 }, (_unused, index) => ({
      attachmentId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      reason: "A valid reason.",
    }));

    const res = await removeCollection({ items });

    expect(res.status).toBe(400);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("accepts a batch of exactly 100 items", async () => {
    const items = Array.from({ length: 100 }, (_unused, index) => ({
      attachmentId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      reason: "",
    }));
    tx.attachment.findMany.mockResolvedValue(
      items.map((item, index) => ({
        id: index + 1,
        storageKey: item.attachmentId,
        ticketId: null,
        deleted: false,
      })),
    );

    const res = await removeCollection({ items });

    expect(res.status).toBe(204);
  });

  it("rejects duplicate Attachment IDs rather than deduplicating them", async () => {
    const res = await removeCollection({
      items: [
        { attachmentId: PENDING_KEY, reason: "" },
        { attachmentId: PENDING_KEY.toUpperCase(), reason: "" },
      ],
    });

    expect(res.status).toBe(400);
    expect(res.body.details[0].message).toBe("Attachment IDs must not repeat.");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a malformed UUID in the JSON body with 400, unlike a malformed route id", async () => {
    const res = await removeCollection({ items: [{ attachmentId: "not-a-uuid", reason: "" }] });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(res.body.details[0].field).toBe("items[0].attachmentId");
  });

  it.each([
    ["a missing reason", ""],
    ["a two-character reason", "no"],
    ["a 201-character reason", "a".repeat(201)],
  ])("rejects %s for an Active item and mutates nothing", async (_label, reason) => {
    tx.attachment.findMany.mockResolvedValue([ACTIVE_ROW]);

    const res = await removeCollection({ items: [{ attachmentId: ACTIVE_KEY, reason }] });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(tx.attachment.updateMany).not.toHaveBeenCalled();
  });

  it("leaves the whole batch unchanged when one item is out of scope", async () => {
    tx.attachment.findMany.mockResolvedValue([ACTIVE_ROW]);

    const res = await removeCollection({
      items: [
        { attachmentId: ACTIVE_KEY, reason: "Wrong screenshot." },
        { attachmentId: UNKNOWN_KEY, reason: "Not mine." },
      ],
    });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
    expect(tx.attachment.updateMany).not.toHaveBeenCalled();
    expect(tx.attachment.deleteMany).not.toHaveBeenCalled();
  });

  it("answers 404 for an already Removed item and leaves the batch unchanged", async () => {
    tx.attachment.findMany.mockResolvedValue([
      { id: 13, storageKey: REMOVED_KEY, ticketId: 42, deleted: true },
    ]);

    const res = await removeCollection({
      items: [{ attachmentId: REMOVED_KEY, reason: "Removing it again." }],
    });

    expect(res.status).toBe(404);
    expect(tx.attachment.updateMany).not.toHaveBeenCalled();
  });

  it("scopes every item to this Requester through the ownership branches", async () => {
    tx.attachment.findMany.mockResolvedValue([ACTIVE_ROW]);

    await removeCollection({ items: [{ attachmentId: ACTIVE_KEY, reason: "Wrong screenshot." }] });

    expect(tx.attachment.findMany.mock.calls[0][0].where).toEqual({
      storageKey: { in: [ACTIVE_KEY] },
      OR: [
        { ticketId: null, uploadedByRequesterId: ALICE.id },
        { ticket: { requesterId: ALICE.id, deleted: false } },
      ],
    });
  });
});

describe("API-69 direct-upload Serializable retry mapping", () => {
  function serializationFailure() {
    return Object.assign(new Error("could not serialize access"), { code: "40001" });
  }

  function post() {
    return upload(`/api/tickets/${TICKET_PUBLIC_ID}/attachments`).attach("file", PNG, {
      filename: "vpn-error.png",
    });
  }

  it("retries a transient serialization failure and still returns 201", async () => {
    prismaMock.$transaction
      .mockRejectedValueOnce(serializationFailure())
      .mockImplementationOnce(async (work: (client: typeof tx) => unknown) => work(tx));

    const res = await post();

    expect(res.status).toBe(201);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(2);
  });

  it("returns 409 when a retry observes five Active rows", async () => {
    /* The first attempt never reaches the count: it dies on contention. The
     * retry runs against a Ticket that reached its limit in the meantime. */
    tx.attachment.count.mockResolvedValue(5);
    prismaMock.$transaction
      .mockRejectedValueOnce(serializationFailure())
      .mockImplementationOnce(async (work: (client: typeof tx) => unknown) => work(tx));

    const res = await post();

    expect(res.status).toBe(409);
    expect(tx.attachment.create).not.toHaveBeenCalled();
  });

  it("returns the centralized 500 after three contended attempts, never a 503", async () => {
    prismaMock.$transaction.mockRejectedValue(serializationFailure());

    const res = await post();

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      statusCode: 500,
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred.",
      error: "Internal Server Error",
    });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(3);
  });

  it.each([
    ["a business conflict", 5, 409],
    ["an unavailable Ticket", 0, 404],
  ])("does not retry %s", async (_label, activeCount, status) => {
    tx.attachment.count.mockResolvedValue(activeCount);

    if (status === 404) {
      tx.ticket.findFirst.mockResolvedValue(null);
    }

    const res = await post();

    expect(res.status).toBe(status);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe("API-70 multipart boundary and binary hardening", () => {
  it("refuses a request with no file part", async () => {
    const res = await upload("/api/attachments");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(prismaMock.attachment.create).not.toHaveBeenCalled();
  });

  it("refuses a second file part named file", async () => {
    const res = await upload("/api/attachments")
      .attach("file", PNG, { filename: "first.png" })
      .attach("file", PNG, { filename: "second.png" });

    expect(res.status).toBe(400);
    expect(prismaMock.attachment.create).not.toHaveBeenCalled();
  });

  it("refuses a file part under an unexpected field name", async () => {
    const res = await upload("/api/attachments").attach("document", PNG, {
      filename: "vpn-error.png",
    });

    expect(res.status).toBe(400);
    expect(prismaMock.attachment.create).not.toHaveBeenCalled();
  });

  it("refuses a companion text field alongside the file", async () => {
    const res = await upload("/api/attachments")
      .field("note", "extra")
      .attach("file", PNG, { filename: "vpn-error.png" });

    expect(res.status).toBe(400);
    expect(prismaMock.attachment.create).not.toHaveBeenCalled();
  });

  it("refuses a JSON body on an upload route", async () => {
    const res = await upload("/api/attachments")
      .set("Content-Type", "application/json")
      .send({ file: "vpn-error.png" });

    expect(res.status).toBe(400);
    expect(prismaMock.attachment.create).not.toHaveBeenCalled();
  });

  it.each([
    ["a POSIX path", "docs/nested/vpn-error.png", "vpn-error.png"],
    ["a Windows path", "C:\\Users\\alice\\vpn-error.png", "vpn-error.png"],
    ["a traversal attempt", "../../etc/passwd.png", "passwd.png"],
  ])("stores only the basename of %s", async (_label, filename, expected) => {
    const res = await upload("/api/attachments").attach("file", PNG, { filename });

    expect(res.status).toBe(201);
    expect(res.body.originalName).toBe(expected);
  });

  it("keeps a Unicode file name intact", async () => {
    const res = await upload("/api/attachments").attach("file", PNG, {
      filename: "รายงาน-ปัญหา.png",
    });

    expect(res.status).toBe(201);
    expect(res.body.originalName).toBe("รายงาน-ปัญหา.png");
  });

  it("refuses a file name longer than 255 UTF-8 bytes", async () => {
    const res = await upload("/api/attachments").attach("file", PNG, {
      filename: `${"a".repeat(252)}.png`,
    });

    expect(res.status).toBe(400);
    expect(prismaMock.attachment.create).not.toHaveBeenCalled();
  });

  it("writes safe dual filename parameters and hardened headers on a binary response", async () => {
    prismaMock.attachment.findFirst.mockResolvedValue({
      data: new Uint8Array(PNG),
      mimeType: "image/png",
      originalName: 'รายงาน "ปัญหา".png',
      sizeBytes: PNG.length,
      deleted: false,
    });

    const res = await get(`/api/attachments/${ACTIVE_KEY}/download`)
      .buffer(true)
      .parse(binaryParser);

    const disposition = res.headers["content-disposition"];
    expect(disposition).toMatch(/^attachment; filename="[\x20-\x7E]*"; filename\*=UTF-8''/);
    /* The quoted fallback carries no raw quote that could end the header early. */
    expect(disposition.slice(0, disposition.indexOf("filename*"))).not.toContain('".png"');
    expect(disposition).toContain("%E0%B8%A3");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.headers["content-type"]).toBe("image/png");
    expect(res.headers["content-length"]).toBe(String(PNG.length));
  });

  it("merges the requester-scoped variation into Vary rather than replacing it", async () => {
    prismaMock.attachment.findFirst.mockResolvedValue({
      data: new Uint8Array(PNG),
      mimeType: "image/png",
      originalName: "vpn-error.png",
      sizeBytes: PNG.length,
      deleted: false,
    });

    const res = await get(`/api/attachments/${ACTIVE_KEY}/preview`)
      .buffer(true)
      .parse(binaryParser);

    const vary = res.headers.vary.split(",").map((value: string) => value.trim());
    expect(vary).toContain("Origin");
    expect(vary).toContain("X-Requester-Id");
  });
});
