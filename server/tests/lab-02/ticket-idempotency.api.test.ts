import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("../../src/prisma.js", async () => {
  const { prismaMock } = await import("./support/ticketPrismaMock.js");
  return { getPrisma: () => prismaMock };
});

import {
  ATTACHMENT_A,
  ATTACHMENT_B,
  KEY,
  VALID_BODY,
  arrangeHappyPath,
  attachmentRow,
  prismaMock,
  processingRecord,
  ticketRow,
  tx,
} from "./support/ticketPrismaMock.js";
import { app } from "../../src/app.js";
import { hashCreateTicketPayload } from "../../src/services/ticketCreateRequest.js";

function post(body: unknown, options: { key?: string; requesterId?: string } = {}) {
  const req = request(app)
    .post("/api/tickets")
    .set("X-Requester-Id", options.requesterId ?? "3");

  if (options.key !== undefined) {
    req.set("Idempotency-Key", options.key);
  } else if (options.key === undefined && !("key" in options)) {
    req.set("Idempotency-Key", KEY);
  }

  return req.send(body as object);
}

/* The canonical hash the route will compute for VALID_BODY. */
function hashOf(overrides: Record<string, unknown> = {}): string {
  return hashCreateTicketPayload({
    categoryId: 4,
    relatedSystemId: 5,
    summary: VALID_BODY.summary,
    requestedPriority: "HIGH",
    description: VALID_BODY.description,
    attachmentIds: [],
    ...overrides,
  });
}

const NOW = () => new Date();

beforeEach(() => {
  arrangeHappyPath();
});

// API-12 (BR-18).
describe("Idempotency-Key validation", () => {
  it("rejects a missing key before any Ticket work", async () => {
    const res = await request(app).post("/api/tickets").set("X-Requester-Id", "3").send(VALID_BODY);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(res.body.details[0].field).toBe("Idempotency-Key");
    expect(prismaMock.idempotencyRecord.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it.each([
    ["malformed", "not-a-uuid"],
    ["truncated", "550e8400-e29b-41d4-a716"],
    ["blank", "   "],
  ])("rejects a %s key before any Ticket work", async (_label, key) => {
    const res = await post(VALID_BODY, { key });

    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe("Idempotency-Key");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("validates the key before the request body", async () => {
    const res = await post({ ...VALID_BODY, summary: "ab" }, { key: "not-a-uuid" });

    expect(res.body.details.map((d: { field: string }) => d.field)).toEqual(["Idempotency-Key"]);
  });
});

// API-13 (AC-11, AC-51, AC-65).
describe("completed same-key replay", () => {
  it("owns PROCESSING, completes the claim, and returns 201 on the first request", async () => {
    const res = await post(VALID_BODY);

    expect(res.status).toBe(201);
    expect(prismaMock.idempotencyRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: "PROCESSING", requestHash: hashOf() }),
    });
    expect(tx.idempotencyRecord.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: expect.objectContaining({ status: "COMPLETED", ticketId: 42 }),
    });
  });

  it("replays a completed same-hash claim with 200 and creates no second Ticket", async () => {
    prismaMock.idempotencyRecord.findUnique.mockResolvedValue(
      processingRecord({
        status: "COMPLETED",
        requestHash: hashOf(),
        ticketId: 42,
        completedAt: NOW(),
        expiresAt: new Date(Date.now() + 3_600_000),
      }),
    );

    const res = await post(VALID_BODY);

    expect(res.status).toBe(200);
    expect(res.body.publicId).toBe("05a214b4-b957-4ed7-a58e-73f4392b35ec");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(tx.ticket.create).not.toHaveBeenCalled();
  });

  it("reconstructs the current TicketDTO, so later Attachment changes appear", async () => {
    prismaMock.idempotencyRecord.findUnique.mockResolvedValue(
      processingRecord({
        status: "COMPLETED",
        requestHash: hashOf(),
        ticketId: 42,
        completedAt: NOW(),
        expiresAt: new Date(Date.now() + 3_600_000),
      }),
    );
    prismaMock.ticket.findUnique.mockResolvedValue(
      ticketRow({
        attachments: [
          attachmentRow({ id: 11, storageKey: ATTACHMENT_A, ticketId: 42 }),
          attachmentRow({ id: 12, storageKey: ATTACHMENT_B, ticketId: 42, deleted: true }),
        ],
      }),
    );

    const res = await post(VALID_BODY);

    expect(res.status).toBe(200);
    expect(res.body.attachments).toHaveLength(2);
    expect(res.body.attachments[1].deleted).toBe(true);
  });

  it("does not re-run mutable Category, System, or Pending validation on replay", async () => {
    prismaMock.idempotencyRecord.findUnique.mockResolvedValue(
      processingRecord({
        status: "COMPLETED",
        requestHash: hashOf(),
        ticketId: 42,
        completedAt: NOW(),
        expiresAt: new Date(Date.now() + 3_600_000),
      }),
    );
    tx.category.findFirst.mockResolvedValue(null);
    tx.relatedSystem.findFirst.mockResolvedValue(null);

    expect((await post(VALID_BODY)).status).toBe(200);
    expect(tx.category.findFirst).not.toHaveBeenCalled();
    expect(tx.attachment.findMany).not.toHaveBeenCalled();
  });
});

// API-14 (AC-12).
describe("same key with a different payload", () => {
  it.each([
    ["different Ticket fields", { summary: "A completely different problem" }],
    ["a different Attachment set", { attachmentIds: [ATTACHMENT_A] }],
  ])("returns 409 IDEMPOTENCY_CONFLICT for %s", async (_label, overrides) => {
    prismaMock.idempotencyRecord.findUnique.mockResolvedValue(
      processingRecord({
        status: "COMPLETED",
        requestHash: hashOf(),
        ticketId: 42,
        completedAt: NOW(),
        expiresAt: new Date(Date.now() + 3_600_000),
      }),
    );

    const res = await post({ ...VALID_BODY, ...overrides });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      statusCode: 409,
      code: "IDEMPOTENCY_CONFLICT",
      message: "The requested operation conflicts with the current resource state.",
      error: "Conflict",
    });
    expect(tx.ticket.create).not.toHaveBeenCalled();
    expect(tx.attachment.updateMany).not.toHaveBeenCalled();
  });
});

// API-15 (BR-21).
describe("key scope", () => {
  it("allows the same UUID under a different Requester", async () => {
    prismaMock.developmentRequester.findFirst.mockResolvedValue({
      id: 4,
      name: "Bob Smith",
      email: "bob.smith@example.com",
      isActive: true,
      deleted: false,
    });

    const res = await post(VALID_BODY, { requesterId: "4" });

    expect(res.status).toBe(201);
    expect(prismaMock.idempotencyRecord.findUnique).toHaveBeenCalledWith({
      where: { requesterId_key: { requesterId: 4, key: KEY } },
    });
  });
});

// API-16 (BR-18-21, AC-65).
describe("canonical request equivalence", () => {
  it("hashes [A,B] and [B,A] identically", async () => {
    tx.attachment.findMany.mockResolvedValue([
      attachmentRow({ id: 11, storageKey: ATTACHMENT_A }),
      attachmentRow({ id: 12, storageKey: ATTACHMENT_B }),
    ]);

    await post({ ...VALID_BODY, attachmentIds: [ATTACHMENT_A, ATTACHMENT_B] });
    const forward = prismaMock.idempotencyRecord.create.mock.calls[0][0].data.requestHash;

    arrangeHappyPath();
    tx.attachment.findMany.mockResolvedValue([
      attachmentRow({ id: 11, storageKey: ATTACHMENT_A }),
      attachmentRow({ id: 12, storageKey: ATTACHMENT_B }),
    ]);

    await post({ ...VALID_BODY, attachmentIds: [ATTACHMENT_B, ATTACHMENT_A] });
    const reversed = prismaMock.idempotencyRecord.create.mock.calls[0][0].data.requestHash;

    expect(forward).toBe(reversed);
    expect(forward).toMatch(/^[0-9a-f]{64}$/);
  });

  it("hashes [A] and [B] differently", async () => {
    tx.attachment.findMany.mockResolvedValue([attachmentRow({ storageKey: ATTACHMENT_A })]);
    await post({ ...VALID_BODY, attachmentIds: [ATTACHMENT_A] });
    const first = prismaMock.idempotencyRecord.create.mock.calls[0][0].data.requestHash;

    arrangeHappyPath();
    tx.attachment.findMany.mockResolvedValue([attachmentRow({ storageKey: ATTACHMENT_B })]);
    await post({ ...VALID_BODY, attachmentIds: [ATTACHMENT_B] });
    const second = prismaMock.idempotencyRecord.create.mock.calls[0][0].data.requestHash;

    expect(first).not.toBe(second);
  });

  it("rejects duplicate Attachment IDs instead of deduplicating them", async () => {
    const res = await post({ ...VALID_BODY, attachmentIds: [ATTACHMENT_A, ATTACHMENT_A] });

    expect(res.status).toBe(400);
    expect(prismaMock.idempotencyRecord.create).not.toHaveBeenCalled();
  });
});

// API-17 (AC-42, AC-65).
describe("concurrent claims", () => {
  it("sends the loser of the unique-insert race to replay rather than a second create", async () => {
    prismaMock.idempotencyRecord.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(
        processingRecord({
          status: "COMPLETED",
          requestHash: hashOf(),
          ticketId: 42,
          completedAt: NOW(),
          expiresAt: new Date(Date.now() + 3_600_000),
        }),
      );
    prismaMock.idempotencyRecord.create.mockRejectedValue(
      Object.assign(new Error("unique"), { code: "P2002" }),
    );

    const res = await post(VALID_BODY);

    expect(res.status).toBe(200);
    expect(tx.ticket.create).not.toHaveBeenCalled();
    expect(tx.attachment.updateMany).not.toHaveBeenCalled();
  });

  it("conflicts a different-hash contender against a fresh PROCESSING claim", async () => {
    prismaMock.idempotencyRecord.findUnique.mockResolvedValue(
      processingRecord({ requestHash: "f".repeat(64), processingStartedAt: NOW() }),
    );

    const res = await post(VALID_BODY);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("IDEMPOTENCY_CONFLICT");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

// API-18 (BR-21-24).
describe("controlled failure", () => {
  it("removes its own PROCESSING claim and stores no COMPLETED result", async () => {
    tx.category.findFirst.mockResolvedValue(null);

    const res = await post(VALID_BODY);

    expect(res.status).toBe(400);
    expect(tx.idempotencyRecord.update).not.toHaveBeenCalled();
    expect(prismaMock.idempotencyRecord.deleteMany).toHaveBeenCalledWith({
      where: {
        requesterId: 3,
        key: KEY,
        status: "PROCESSING",
        processingStartedAt: expect.any(Date),
      },
    });
  });

  it("never writes a FAILED status", async () => {
    tx.relatedSystem.findFirst.mockResolvedValue(null);

    await post(VALID_BODY);

    const written = [
      ...prismaMock.idempotencyRecord.create.mock.calls,
      ...prismaMock.idempotencyRecord.updateMany.mock.calls,
      ...tx.idempotencyRecord.update.mock.calls,
    ].map((call) => JSON.stringify(call[0]));

    expect(written.join(" ")).not.toContain("FAILED");
  });

  it("creates no Ticket or binding when the transaction fails", async () => {
    tx.attachment.findMany.mockResolvedValue([attachmentRow({ deleted: true })]);

    const res = await post({ ...VALID_BODY, attachmentIds: [ATTACHMENT_A] });

    expect(res.status).toBe(409);
    expect(tx.ticket.create).not.toHaveBeenCalled();
    expect(tx.attachment.updateMany).not.toHaveBeenCalled();
  });
});

// API-19 (BR-22, AC-42, AC-65).
describe("IDEMPOTENCY-FENCING-A", () => {
  it("locks and verifies the claim before any mutable validation", async () => {
    await post(VALID_BODY);

    const [strings, ...values] = tx.$queryRaw.mock.calls[0];
    expect(strings.join("?")).toContain("FOR UPDATE");
    expect(values[0]).toBe(3);
    expect(values[1]).toBe(KEY);
    expect(values[2]).toBe(hashOf());
    expect(values[3]).toBeInstanceOf(Date);
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.category.findFirst.mock.invocationCallOrder[0],
    );
  });

  it("performs no mutation when the ownership values no longer match", async () => {
    // A stale retry reclaimed the lease while this owner was working, so the
    // fencing SELECT matches no row.
    tx.$queryRaw.mockResolvedValue([]);
    prismaMock.idempotencyRecord.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValue(
        processingRecord({
          status: "COMPLETED",
          requestHash: hashOf(),
          ticketId: 42,
          completedAt: NOW(),
          expiresAt: new Date(Date.now() + 3_600_000),
        }),
      );

    const res = await post(VALID_BODY);

    expect(tx.ticket.create).not.toHaveBeenCalled();
    expect(tx.attachment.updateMany).not.toHaveBeenCalled();
    expect(tx.idempotencyRecord.update).not.toHaveBeenCalled();
    /* Fenced out, then resumed normal resolution and found the winner's result. */
    expect(res.status).toBe(200);
  });

  it("runs the Pending-Attachment lookup only after the lock is held", async () => {
    tx.attachment.findMany.mockResolvedValue([attachmentRow({ storageKey: ATTACHMENT_A })]);

    await post({ ...VALID_BODY, attachmentIds: [ATTACHMENT_A] });

    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.attachment.findMany.mock.invocationCallOrder[0],
    );
  });
});

// API-20 (BR-23-24).
describe("ambiguous 5xx recovery", () => {
  it("recovers the committed Ticket when the unchanged request is retried", async () => {
    // First attempt: the transaction commits but the caller never sees it.
    expect((await post(VALID_BODY)).status).toBe(201);

    // The unchanged retry with the same key finds the COMPLETED claim.
    arrangeHappyPath();
    prismaMock.idempotencyRecord.findUnique.mockResolvedValue(
      processingRecord({
        status: "COMPLETED",
        requestHash: hashOf(),
        ticketId: 42,
        completedAt: NOW(),
        expiresAt: new Date(Date.now() + 3_600_000),
      }),
    );

    const replay = await post(VALID_BODY);

    expect(replay.status).toBe(200);
    expect(replay.body.publicId).toBe("05a214b4-b957-4ed7-a58e-73f4392b35ec");
    expect(tx.ticket.create).not.toHaveBeenCalled();
  });
});

// API-76 (BR-19-24, BR-82, AC-65).
describe("PROCESSING lease and reclaim", () => {
  it("reclaims a claim stale by exactly 300 seconds and resets the lease", async () => {
    const started = new Date(Date.now() - 300_000);
    prismaMock.idempotencyRecord.findUnique
      .mockResolvedValueOnce(processingRecord({ requestHash: hashOf(), processingStartedAt: started }))
      .mockResolvedValue(processingRecord({ requestHash: hashOf(), processingStartedAt: NOW() }));
    prismaMock.idempotencyRecord.updateMany.mockResolvedValue({ count: 1 });

    const res = await post(VALID_BODY);

    expect(res.status).toBe(201);
    expect(prismaMock.idempotencyRecord.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "PROCESSING", requestHash: hashOf() }),
      }),
    );
    /* Reclaimed in place, never deleted. */
    expect(prismaMock.idempotencyRecord.deleteMany).not.toHaveBeenCalled();
  });

  it("conflicts on a stale different-hash claim without deleting it", async () => {
    prismaMock.idempotencyRecord.findUnique.mockResolvedValue(
      processingRecord({
        requestHash: "f".repeat(64),
        processingStartedAt: new Date(Date.now() - 600_000),
      }),
    );

    const res = await post(VALID_BODY);

    expect(res.status).toBe(409);
    expect(prismaMock.idempotencyRecord.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.idempotencyRecord.updateMany).not.toHaveBeenCalled();
  });

  it("replaces a logically expired COMPLETED row instead of failing the unique key", async () => {
    prismaMock.idempotencyRecord.findUnique
      .mockResolvedValueOnce(
        processingRecord({
          status: "COMPLETED",
          requestHash: "f".repeat(64),
          ticketId: 41,
          completedAt: new Date(Date.now() - 90_000_000),
          expiresAt: new Date(Date.now() - 3_600_000),
        }),
      )
      .mockResolvedValue(null);

    const res = await post(VALID_BODY);

    expect(res.status).toBe(201);
    expect(prismaMock.idempotencyRecord.deleteMany).toHaveBeenCalledWith({
      where: { id: 7, status: "COMPLETED", expiresAt: { lte: expect.any(Date) } },
    });
    expect(prismaMock.idempotencyRecord.create).toHaveBeenCalled();
  });
});
