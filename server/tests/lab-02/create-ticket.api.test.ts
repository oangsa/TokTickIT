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
  tx,
} from "./support/ticketPrismaMock.js";
import { app } from "../../src/app.js";

function post(body: unknown) {
  return request(app)
    .post("/api/tickets")
    .set("X-Requester-Id", "3")
    .set("Idempotency-Key", KEY)
    .send(body as object);
}

function fieldsOf(body: { details?: { field: string }[] }): string[] {
  return (body.details ?? []).map((detail) => detail.field);
}

beforeEach(() => {
  arrangeHappyPath();
});

// API-06 (AC-08).
describe("Summary validation", () => {
  it.each([
    ["missing", undefined],
    ["blank", "   "],
    ["two characters", "ab"],
    ["151 characters", "a".repeat(151)],
    ["not a string", 12],
  ])("rejects a %s Summary without creating a Ticket", async (_label, summary) => {
    const res = await post({ ...VALID_BODY, summary });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(fieldsOf(res.body)).toContain("summary");
    expect(tx.ticket.create).not.toHaveBeenCalled();
  });

  it.each([
    ["three characters", "abc"],
    ["150 characters", "a".repeat(150)],
  ])("accepts a %s Summary", async (_label, summary) => {
    expect((await post({ ...VALID_BODY, summary })).status).toBe(201);
  });

  it("measures the boundary after trimming and stores the trimmed value", async () => {
    const res = await post({ ...VALID_BODY, summary: `  ${"a".repeat(150)}  ` });

    expect(res.status).toBe(201);
    expect(tx.ticket.create.mock.calls[0][0].data.summary).toBe("a".repeat(150));
  });
});

// API-07 (AC-09).
describe("Description validation", () => {
  it.each([
    ["missing", undefined],
    ["blank", "        "],
    ["nine characters", "a".repeat(9)],
    ["2001 characters", "a".repeat(2001)],
  ])("rejects a %s Description without creating a Ticket", async (_label, description) => {
    const res = await post({ ...VALID_BODY, description });

    expect(res.status).toBe(400);
    expect(fieldsOf(res.body)).toContain("description");
    expect(tx.ticket.create).not.toHaveBeenCalled();
  });

  it.each([
    ["ten characters", "a".repeat(10)],
    ["2000 characters", "a".repeat(2000)],
  ])("accepts a %s Description", async (_label, description) => {
    expect((await post({ ...VALID_BODY, description })).status).toBe(201);
  });

  it("stores the trimmed Description", async () => {
    await post({ ...VALID_BODY, description: `  ${"a".repeat(2000)}  ` });

    expect(tx.ticket.create.mock.calls[0][0].data.description).toBe("a".repeat(2000));
  });
});

// API-08 (AC-10).
describe("Category validation", () => {
  it.each([
    ["missing", undefined],
    ["malformed", "4"],
    ["zero", 0],
    ["negative", -4],
    ["fractional", 4.5],
  ])("rejects a %s categoryId before the transaction", async (_label, categoryId) => {
    const res = await post({ ...VALID_BODY, categoryId });

    expect(res.status).toBe(400);
    expect(fieldsOf(res.body)).toContain("categoryId");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it.each([
    ["unknown", null],
    ["inactive or deleted", null],
  ])("rejects an %s Category at commit time", async (_label, row) => {
    tx.category.findFirst.mockResolvedValue(row);

    const res = await post(VALID_BODY);

    expect(res.status).toBe(400);
    expect(fieldsOf(res.body)).toContain("categoryId");
    expect(tx.ticket.create).not.toHaveBeenCalled();
  });

  it("proceeds with a valid active Category", async () => {
    expect((await post(VALID_BODY)).status).toBe(201);
    expect(tx.category.findFirst).toHaveBeenCalledWith({
      where: { id: 4, deleted: false, isActive: true },
    });
  });
});

// API-09 (AC-10).
describe("Related System validation", () => {
  it.each([
    ["missing", undefined],
    ["malformed", "5"],
    ["zero", 0],
  ])("rejects a %s relatedSystemId before the transaction", async (_label, relatedSystemId) => {
    const res = await post({ ...VALID_BODY, relatedSystemId });

    expect(res.status).toBe(400);
    expect(fieldsOf(res.body)).toContain("relatedSystemId");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects an unknown, inactive, or deleted Related System at commit time", async () => {
    tx.relatedSystem.findFirst.mockResolvedValue(null);

    const res = await post(VALID_BODY);

    expect(res.status).toBe(400);
    expect(fieldsOf(res.body)).toContain("relatedSystemId");
    expect(tx.ticket.create).not.toHaveBeenCalled();
  });
});

// API-10 (AC-10).
describe("Requested Priority validation", () => {
  it.each([
    ["missing", undefined],
    ["unknown", "URGENT"],
    ["lowercase", "high"],
    ["null", null],
  ])("rejects a %s requestedPriority", async (_label, requestedPriority) => {
    const res = await post({ ...VALID_BODY, requestedPriority });

    expect(res.status).toBe(400);
    expect(fieldsOf(res.body)).toContain("requestedPriority");
    expect(tx.ticket.create).not.toHaveBeenCalled();
  });

  it.each(["LOW", "MEDIUM", "HIGH"])("accepts %s", async (requestedPriority) => {
    const res = await post({ ...VALID_BODY, requestedPriority });

    expect(res.status).toBe(201);
    expect(tx.ticket.create.mock.calls[0][0].data.requestedPriority).toBe(requestedPriority);
  });

  it("applies no silent default when Priority is absent", async () => {
    await post({ ...VALID_BODY, requestedPriority: undefined });

    expect(tx.ticket.create).not.toHaveBeenCalled();
  });
});

// API-11 (FR-28-29, BR-15-17).
describe("backend-managed fields", () => {
  it("ignores every client-supplied backend-managed value", async () => {
    const res = await post({
      ...VALID_BODY,
      requesterId: 999,
      publicId: "00000000-0000-4000-8000-000000000000",
      ticketNumber: "TKT-19990101-DEADBEEFCAFE",
      currentStatus: "CLOSED",
      deleted: true,
      createdBy: "attacker@example.com",
      updatedBy: "attacker@example.com",
      createdAt: "1999-01-01T00:00:00.000Z",
      updatedAt: "1999-01-01T00:00:00.000Z",
    });

    expect(res.status).toBe(201);

    const { data } = tx.ticket.create.mock.calls[0][0];
    expect(data.requesterId).toBe(3);
    expect(data.publicId).not.toBe("00000000-0000-4000-8000-000000000000");
    expect(data.ticketNumber).not.toBe("TKT-19990101-DEADBEEFCAFE");
    expect(data.currentStatus).toBe("NEW");
    expect(data.deleted).toBe(false);
    expect(data.createdBy).toBe("alice.johnson@example.com");
    expect(data.updatedBy).toBe("alice.johnson@example.com");
    expect(data.createdAt).toBeUndefined();
    expect(data.updatedAt).toBeUndefined();
  });

  it("derives ownership from X-Requester-Id, not from the body", async () => {
    prismaMock.developmentRequester.findFirst.mockResolvedValue({
      id: 4,
      name: "Bob Smith",
      email: "bob.smith@example.com",
      isActive: true,
      deleted: false,
    });

    await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", "4")
      .set("Idempotency-Key", KEY)
      .send({ ...VALID_BODY, requesterId: 3 });

    const { data } = tx.ticket.create.mock.calls[0][0];
    expect(data.requesterId).toBe(4);
    expect(data.createdBy).toBe("bob.smith@example.com");
  });
});

// API-65 (BR-74).
describe("Ticket deletion route and default deletion state", () => {
  it("does not register DELETE /api/tickets/:publicId", async () => {
    const res = await request(app)
      .delete("/api/tickets/05a214b4-b957-4ed7-a58e-73f4392b35ec")
      .set("X-Requester-Id", "3");

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });

  it("creates a Ticket with deleted = false", async () => {
    const res = await post(VALID_BODY);

    expect(res.body.deleted).toBe(false);
  });
});

// API-67 (BR-16, BR-51, AC-22).
describe("Attachment references", () => {
  it("returns the same safe 404 for an Attachment outside the Requester scope", async () => {
    tx.attachment.findMany.mockResolvedValue([]);

    const res = await post({ ...VALID_BODY, attachmentIds: [ATTACHMENT_A] });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "The requested resource was not found.",
      error: "Not Found",
    });
    expect(tx.ticket.create).not.toHaveBeenCalled();
  });

  it("never discloses the owner or existence of a cross-scope Attachment", async () => {
    tx.attachment.findMany.mockResolvedValue([]);

    const res = await post({ ...VALID_BODY, attachmentIds: [ATTACHMENT_A] });

    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain(ATTACHMENT_A);
    expect(serialized).not.toContain("Alice");
    expect(serialized).not.toContain("@example.com");
  });

  it("conflicts on an owned Attachment that is no longer bindable", async () => {
    tx.attachment.findMany.mockResolvedValue([attachmentRow({ ticketId: 99 })]);

    const res = await post({ ...VALID_BODY, attachmentIds: [ATTACHMENT_A] });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CONFLICT");
    expect(tx.ticket.create).not.toHaveBeenCalled();
  });

  it("rejects more than five Attachment IDs before the transaction", async () => {
    const ids = [
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000002",
      "00000000-0000-4000-8000-000000000003",
      "00000000-0000-4000-8000-000000000004",
      "00000000-0000-4000-8000-000000000005",
      "00000000-0000-4000-8000-000000000006",
    ];

    const res = await post({ ...VALID_BODY, attachmentIds: ids });

    expect(res.status).toBe(400);
    expect(fieldsOf(res.body)).toContain("attachmentIds");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("accepts exactly five Attachment IDs", async () => {
    const ids = [
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000002",
      "00000000-0000-4000-8000-000000000003",
      "00000000-0000-4000-8000-000000000004",
      "00000000-0000-4000-8000-000000000005",
    ];
    tx.attachment.findMany.mockResolvedValue(
      ids.map((storageKey, index) => attachmentRow({ id: 20 + index, storageKey })),
    );

    expect((await post({ ...VALID_BODY, attachmentIds: ids })).status).toBe(201);
  });

  it.each([
    ["a malformed UUID", ["not-a-uuid"]],
    ["a non-array value", ATTACHMENT_A],
    ["a duplicate after normalization", [ATTACHMENT_A, ATTACHMENT_A.toUpperCase()]],
  ])("rejects %s", async (_label, attachmentIds) => {
    const res = await post({ ...VALID_BODY, attachmentIds });

    expect(res.status).toBe(400);
    expect(fieldsOf(res.body)).toContain("attachmentIds");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("reports every invalid field in one response", async () => {
    const res = await post({
      categoryId: 0,
      relatedSystemId: 0,
      summary: "ab",
      requestedPriority: "URGENT",
      description: "short",
      attachmentIds: [ATTACHMENT_A, ATTACHMENT_A],
    });

    expect(res.status).toBe(400);
    expect(fieldsOf(res.body).sort()).toEqual(
      [
        "attachmentIds",
        "categoryId",
        "description",
        "relatedSystemId",
        "requestedPriority",
        "summary",
      ].sort(),
    );
  });

  it("rejects a non-object body", async () => {
    const res = await post([ATTACHMENT_B]);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });
});
