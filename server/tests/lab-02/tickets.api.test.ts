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
  ticketRow,
  tx,
} from "./support/ticketPrismaMock.js";
import { app } from "../../src/app.js";
import { TICKET_NUMBER_PATTERN } from "../../src/services/ticketNumber.js";

function post(body: unknown, key = KEY) {
  return request(app)
    .post("/api/tickets")
    .set("X-Requester-Id", "3")
    .set("Idempotency-Key", key)
    .send(body as object);
}

beforeEach(() => {
  arrangeHappyPath();
});

// API-05 (AC-06, AC-07). The handout's required delivery smoke case.
describe("POST /api/tickets", () => {
  it("creates a Ticket and returns 201 with the full TicketDTO", async () => {
    const res = await post(VALID_BODY);

    expect(res.status).toBe(201);
    expect(Object.keys(res.body).sort()).toEqual(
      [
        "attachments",
        "categoryId",
        "categoryName",
        "createdAt",
        "createdBy",
        "currentStatus",
        "deleted",
        "description",
        "publicId",
        "relatedSystemId",
        "relatedSystemName",
        "requestedPriority",
        "requesterEmail",
        "requesterId",
        "requesterName",
        "summary",
        "ticketNumber",
        "updatedAt",
        "updatedBy",
      ].sort(),
    );
  });

  it("derives Requester, status, and Ticket Number in the backend", async () => {
    const res = await post(VALID_BODY);

    expect(res.body.requesterId).toBe(3);
    expect(res.body.requesterName).toBe("Alice Johnson");
    expect(res.body.requesterEmail).toBe("alice.johnson@example.com");
    expect(res.body.currentStatus).toBe("NEW");
    expect(res.body.deleted).toBe(false);
    expect(tx.ticket.create.mock.calls[0][0].data.ticketNumber).toMatch(TICKET_NUMBER_PATTERN);
  });

  it("uses createdAt as the authoritative Ticket Date with no ticketDate field", async () => {
    const res = await post(VALID_BODY);

    expect(res.body.createdAt).toBe("2026-08-20T08:14:32.000Z");
    expect(res.body).not.toHaveProperty("ticketDate");
  });

  it("treats an omitted attachmentIds as no initial Attachments", async () => {
    const res = await post(VALID_BODY);

    expect(res.status).toBe(201);
    expect(res.body.attachments).toEqual([]);
    expect(tx.attachment.updateMany).not.toHaveBeenCalled();
  });

  it("treats an empty attachmentIds the same as an omitted one", async () => {
    const res = await post({ ...VALID_BODY, attachmentIds: [] });

    expect(res.status).toBe(201);
    expect(res.body.attachments).toEqual([]);
    expect(tx.attachment.updateMany).not.toHaveBeenCalled();
  });

  it("binds every supplied Pending Attachment as Active in the create transaction", async () => {
    const bound = [
      attachmentRow({ id: 11, storageKey: ATTACHMENT_A, ticketId: 42 }),
      attachmentRow({ id: 12, storageKey: ATTACHMENT_B, ticketId: 42 }),
    ];
    tx.attachment.findMany.mockResolvedValue([
      attachmentRow({ id: 11, storageKey: ATTACHMENT_A }),
      attachmentRow({ id: 12, storageKey: ATTACHMENT_B }),
    ]);
    const { prismaMock } = await import("./support/ticketPrismaMock.js");
    prismaMock.ticket.findUnique.mockResolvedValue(ticketRow({ attachments: bound }));

    const res = await post({ ...VALID_BODY, attachmentIds: [ATTACHMENT_A, ATTACHMENT_B] });

    expect(res.status).toBe(201);
    expect(tx.attachment.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [11, 12] }, ticketId: null, deleted: false },
      data: { ticketId: 42, updatedBy: "alice.johnson@example.com" },
    });
    expect(res.body.attachments.map((a: { attachmentId: string }) => a.attachmentId)).toEqual([
      ATTACHMENT_A,
      ATTACHMENT_B,
    ]);
    expect(res.body.attachments[0].ticketPublicId).toBe(res.body.publicId);
  });

  it("requires valid requester context", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .set("Idempotency-Key", KEY)
      .send(VALID_BODY);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("REQUESTER_CONTEXT_INVALID");
    expect(tx.ticket.create).not.toHaveBeenCalled();
  });
});
