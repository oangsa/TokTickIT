import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

import {
  ALICE,
  attachmentRow,
  prismaMock,
  ticketRow,
} from "./support/ticketPrismaMock.js";

vi.mock("../../src/prisma.js", () => ({ getPrisma: () => prismaMock }));

import { app } from "../../src/app.js";

const PUBLIC_ID = "05a214b4-b957-4ed7-a58e-73f4392b35ec";
const OTHER_PUBLIC_ID = "9f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f";

/*
 * Active and Removed differ only by `deleted` and `removalReason`: the
 * Attachment lifecycle has no status column (api-spec Section 5.4).
 */
const ACTIVE_ATTACHMENT = attachmentRow({ id: 11, ticketId: 42 });
const REMOVED_ATTACHMENT = attachmentRow({
  id: 12,
  ticketId: 42,
  storageKey: "11111111-1111-4111-8111-111111111111",
  originalName: "superseded-log.txt",
  extension: "txt",
  mimeType: "text/plain",
  sizeBytes: 4096,
  removalReason: "Replaced by a newer capture.",
  deleted: true,
});

function get(publicId: string, requesterId: number | null = ALICE.id) {
  const call = request(app).get(`/api/tickets/${publicId}`);

  return requesterId === null ? call : call.set("X-Requester-Id", String(requesterId));
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.developmentRequester.findFirst.mockResolvedValue(ALICE);
  prismaMock.ticket.findFirst.mockResolvedValue(
    ticketRow({ attachments: [ACTIVE_ATTACHMENT, REMOVED_ATTACHMENT] }),
  );
});

describe("API-35 owned Ticket Detail", () => {
  it("returns the full TicketDTO for the current Requester's non-deleted Ticket", async () => {
    const res = await get(PUBLIC_ID);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      publicId: PUBLIC_ID,
      ticketNumber: "TKT-20260820-A81F3C9D7B21",
      requesterId: ALICE.id,
      requesterName: ALICE.name,
      requesterEmail: ALICE.email,
      categoryId: 4,
      categoryName: "Network",
      relatedSystemId: 5,
      relatedSystemName: "VPN",
      summary: "Cannot connect to campus VPN",
      description: "The VPN client fails after entering my credentials.",
      requestedPriority: "HIGH",
      currentStatus: "NEW",
      createdBy: "alice.johnson@example.com",
      createdAt: "2026-08-20T08:14:32.000Z",
      updatedBy: "alice.johnson@example.com",
      updatedAt: "2026-08-20T08:14:32.000Z",
      deleted: false,
    });
  });

  it("carries active and removed Attachment metadata without the stored bytes", async () => {
    const res = await get(PUBLIC_ID);

    expect(res.body.attachments).toHaveLength(2);
    expect(res.body.attachments[0]).toMatchObject({
      attachmentId: ACTIVE_ATTACHMENT.storageKey,
      ticketPublicId: PUBLIC_ID,
      originalName: "vpn-error.png",
      extension: "png",
      mimeType: "image/png",
      sizeBytes: 281304,
      removalReason: null,
      deleted: false,
    });
    expect(res.body.attachments[1]).toMatchObject({
      attachmentId: REMOVED_ATTACHMENT.storageKey,
      ticketPublicId: PUBLIC_ID,
      originalName: "superseded-log.txt",
      removalReason: "Replaced by a newer capture.",
      deleted: true,
    });

    /* Section 5.4 exposes size, never content, and never the internal row id. */
    for (const attachment of res.body.attachments) {
      expect(attachment).not.toHaveProperty("data");
      expect(attachment).not.toHaveProperty("id");
      expect(attachment).not.toHaveProperty("storageKey");
    }

    const [[query]] = prismaMock.ticket.findFirst.mock.calls;
    expect(query.include.attachments.omit).toEqual({ data: true });
  });

  it("does not expose the internal Ticket primary key", async () => {
    const res = await get(PUBLIC_ID);

    expect(res.body).not.toHaveProperty("id");
    expect(res.body).not.toHaveProperty("requester");
    expect(res.body).not.toHaveProperty("category");
    expect(res.body).not.toHaveProperty("relatedSystem");
  });
});

describe("API-36 requester scope", () => {
  /*
   * The proof that scope cannot be widened is the predicate itself: ownership
   * and the soft-delete flag are part of the query, so no header, route, or
   * hand-made request reaches a row that fails them.
   */
  it("scopes the read by Requester and non-deleted state inside the query", async () => {
    await get(PUBLIC_ID);

    expect(prismaMock.ticket.findFirst).toHaveBeenCalledTimes(1);
    const [[query]] = prismaMock.ticket.findFirst.mock.calls;
    expect(query.where).toEqual({
      publicId: PUBLIC_ID,
      requesterId: ALICE.id,
      deleted: false,
    });
  });

  it("answers another Requester's Ticket exactly as it answers a missing one", async () => {
    prismaMock.ticket.findFirst.mockResolvedValue(null);

    const outOfScope = await get(OTHER_PUBLIC_ID);
    const missing = await get("7c9e6679-7425-40de-944b-e07fc1f90ae7");

    expect(outOfScope.status).toBe(404);
    expect(outOfScope.body).toEqual({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "The requested resource was not found.",
      error: "Not Found",
    });
    /* Byte-identical: nothing in the answer can be read as an ownership signal. */
    expect(outOfScope.text).toBe(missing.text);
  });

  it("logs one route template for both an owned hit and a hidden miss", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    let routes: unknown[] = [];

    try {
      await get(PUBLIC_ID);
      prismaMock.ticket.findFirst.mockResolvedValue(null);
      await get(OTHER_PUBLIC_ID);

      routes = log.mock.calls.map(([line]) => JSON.parse(String(line)).route);
    } finally {
      log.mockRestore();
    }

    expect(routes).toEqual(["/api/tickets/:publicId", "/api/tickets/:publicId"]);
  });
});

describe("API-37 unusable route identifiers", () => {
  it.each([
    ["malformed", "not-a-uuid"],
    ["malformed with the right shape but a bad variant", "05a214b4-b957-0ed7-058e-73f4392b35ec"],
  ])("returns the centralized 404 for a %s identifier without reading the table", async (_label, publicId) => {
    const res = await get(publicId);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
    /* `publicId` is @db.Uuid: a failed cast would be a 500 that names the column. */
    expect(prismaMock.ticket.findFirst).not.toHaveBeenCalled();
  });

  it("returns the centralized 404 for a logically deleted Ticket", async () => {
    /* `deleted: false` is in the where, so a soft-deleted row simply misses. */
    prismaMock.ticket.findFirst.mockResolvedValue(null);

    const res = await get(PUBLIC_ID);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
    expect(res.body).not.toHaveProperty("details");
  });
});

describe("API-38 historical Category and Related System metadata", () => {
  it("still resolves the names after the master rows go inactive and deleted", async () => {
    prismaMock.ticket.findFirst.mockResolvedValue(
      ticketRow({
        category: { id: 4, name: "Network", isActive: false, deleted: true },
        relatedSystem: { id: 5, name: "VPN", isActive: false, deleted: true },
      }),
    );

    const res = await get(PUBLIC_ID);

    expect(res.status).toBe(200);
    expect(res.body.categoryName).toBe("Network");
    expect(res.body.relatedSystemName).toBe("VPN");

    /* BR-72-73: the join is never re-validated for active or deleted state. */
    const [[query]] = prismaMock.ticket.findFirst.mock.calls;
    expect(query.include.category).toBe(true);
    expect(query.include.relatedSystem).toBe(true);
  });
});

describe("Requester context on Ticket Detail", () => {
  it.each([
    ["missing", null],
    ["unknown", 404],
  ])("rejects a %s Requester before any Ticket is read", async (label, requesterId) => {
    if (label === "unknown") {
      prismaMock.developmentRequester.findFirst.mockResolvedValue(null);
    }

    const res = await get(PUBLIC_ID, requesterId as number | null);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("REQUESTER_CONTEXT_INVALID");
    expect(prismaMock.ticket.findFirst).not.toHaveBeenCalled();
  });
});
