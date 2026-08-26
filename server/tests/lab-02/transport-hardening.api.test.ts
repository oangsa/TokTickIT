import { Buffer } from "node:buffer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const prismaMock = vi.hoisted(() => ({
  developmentRequester: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  category: { findMany: vi.fn() },
  ticket: { findFirst: vi.fn() },
}));

vi.mock("../../src/prisma.js", () => ({ getPrisma: () => prismaMock }));

import { app } from "../../src/app.js";
import { ticketRow } from "./support/ticketPrismaMock.js";

const ALICE = {
  id: 1,
  name: "Alice Johnson",
  email: "alice.johnson@example.com",
  isActive: true,
  deleted: false,
  createdBy: "seed",
  createdAt: new Date("2026-08-20T01:00:00.000Z"),
  updatedBy: "seed",
  updatedAt: new Date("2026-08-20T01:00:00.000Z"),
};

const TICKET_PUBLIC_ID = "05a214b4-b957-4ed7-a58e-73f4392b35ec";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/* The wrapper `{"padding":""}` is 14 bytes. */
function jsonBodyOfExactly(totalBytes: number): string {
  return JSON.stringify({ padding: "a".repeat(totalBytes - 14) });
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.developmentRequester.findMany.mockResolvedValue([ALICE]);
  prismaMock.developmentRequester.findFirst.mockResolvedValue(ALICE);
  prismaMock.category.findMany.mockResolvedValue([]);
  prismaMock.ticket.findFirst.mockResolvedValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("transport hardening (API-72, API-74)", () => {
  it("lets a body at the 131,072-byte boundary reach the guard", async () => {
    expect(Buffer.byteLength(jsonBodyOfExactly(131072))).toBe(131072);

    const res = await request(app)
      .post("/api/tickets")
      .set("Content-Type", "application/json")
      .send(jsonBodyOfExactly(131072));

    // Reaching the requester guard is the proof it was not size-rejected.
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("REQUESTER_CONTEXT_INVALID");
  });

  it("rejects a body one byte over the boundary with 413", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .set("Content-Type", "application/json")
      .send(jsonBodyOfExactly(131073));

    expect(res.status).toBe(413);
    expect(res.body.code).toBe("PAYLOAD_TOO_LARGE");
    expect(res.body.error).toBe("Content Too Large");
    expect(res.body.details).toBeUndefined();
  });

  it("rejects malformed JSON within the limit with 400 BAD_REQUEST", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .set("Content-Type", "application/json")
      .send("{");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("BAD_REQUEST");
    expect(res.body.details).toBeUndefined();
  });

  it("classifies an invalid X-Requester-Id as REQUESTER_CONTEXT_INVALID", async () => {
    // API-72's `VALIDATION_ERROR` row needs a field-validating endpoint and is
    // owned by Issue #21. Requester context is deliberately not that row: it
    // carries its own protocol code so the client can tell the two apart.
    const res = await request(app).get("/api/categories").set("X-Requester-Id", "abc");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("REQUESTER_CONTEXT_INVALID");
  });

  it("sends Cache-Control: no-store on the bootstrap endpoint", async () => {
    const res = await request(app).get("/api/requesters");

    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("sends Cache-Control: no-store on a guarded endpoint", async () => {
    const res = await request(app).get("/api/categories").set("X-Requester-Id", "1");

    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("sends Cache-Control: no-store on an error response", async () => {
    const res = await request(app).get("/api/categories");

    expect(res.status).toBe(400);
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("merges Vary on a requester-scoped response without clobbering the CORS value", async () => {
    const res = await request(app)
      .get("/api/categories")
      .set("X-Requester-Id", "1")
      .set("Origin", "http://localhost:5173");

    const varyValues = res.headers.vary.split(/,\s*/);
    expect(varyValues).toContain("Origin");
    expect(varyValues).toContain("X-Requester-Id");
    expect(varyValues.filter((value) => value === "Origin")).toHaveLength(1);
  });

  it("varies a requester-scoped error response by X-Requester-Id too", async () => {
    const res = await request(app).get("/api/categories").set("Origin", "http://localhost:5173");

    expect(res.status).toBe(400);
    expect(res.headers.vary.split(/,\s*/)).toContain("X-Requester-Id");
  });

  it("does not vary the bootstrap response by X-Requester-Id", async () => {
    // `GET /api/requesters` returns the same body to every Requester and never
    // reads the header, so claiming to vary by it would be a false cache key
    // (api-spec Section 3.6).
    const res = await request(app)
      .get("/api/requesters")
      .set("Origin", "http://localhost:5173");

    const varyValues = res.headers.vary.split(/,\s*/);
    expect(varyValues).toContain("Origin");
    expect(varyValues).not.toContain("X-Requester-Id");
  });

  /*
   * Ticket Detail is requester-scoped and answers a 404 far more often than a
   * 200, so both answers have to carry the same transport treatment: an error
   * that skipped `no-store` would let a shared cache hand one Requester's
   * "not found" -- or another's Ticket -- to the next one.
   */
  it("sends Cache-Control: no-store on Ticket Detail", async () => {
    prismaMock.ticket.findFirst.mockResolvedValue(ticketRow());

    const res = await request(app).get(`/api/tickets/${TICKET_PUBLIC_ID}`).set("X-Requester-Id", "1");

    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("sends Cache-Control: no-store on the Ticket Detail 404", async () => {
    const res = await request(app).get(`/api/tickets/${TICKET_PUBLIC_ID}`).set("X-Requester-Id", "1");

    expect(res.status).toBe(404);
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("varies Ticket Detail by X-Requester-Id on both the hit and the miss", async () => {
    prismaMock.ticket.findFirst.mockResolvedValue(ticketRow());
    const hit = await request(app)
      .get(`/api/tickets/${TICKET_PUBLIC_ID}`)
      .set("X-Requester-Id", "1")
      .set("Origin", "http://localhost:5173");

    prismaMock.ticket.findFirst.mockResolvedValue(null);
    const miss = await request(app)
      .get(`/api/tickets/${TICKET_PUBLIC_ID}`)
      .set("X-Requester-Id", "1")
      .set("Origin", "http://localhost:5173");

    for (const res of [hit, miss]) {
      const varyValues = res.headers.vary.split(/,\s*/);
      expect(varyValues).toContain("Origin");
      expect(varyValues).toContain("X-Requester-Id");
      expect(varyValues.filter((value) => value === "Origin")).toHaveLength(1);
    }
  });
});
