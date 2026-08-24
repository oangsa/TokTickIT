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
}));

vi.mock("../../src/prisma.js", () => ({ getPrisma: () => prismaMock }));

import { app } from "../../src/app.js";

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

const REQUESTER_CONTEXT_DETAILS = [
  { field: "X-Requester-Id", message: "The requester context is invalid." },
];

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

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("BAD_REQUEST");
    expect(res.body.details).toEqual(REQUESTER_CONTEXT_DETAILS);
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

  it("classifies an invalid X-Requester-Id as VALIDATION_ERROR", async () => {
    // The request-body half of API-72's `VALIDATION_ERROR` row needs a
    // field-validating endpoint and is owned by Issue #21.
    const res = await request(app).get("/api/categories").set("X-Requester-Id", "abc");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
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

  it("merges Vary without clobbering the CORS value", async () => {
    const res = await request(app)
      .get("/api/requesters")
      .set("Origin", "http://localhost:5173");

    const varyValues = res.headers.vary.split(/,\s*/);
    expect(varyValues).toContain("Origin");
    expect(varyValues).toContain("X-Requester-Id");
    expect(varyValues.filter((value) => value === "Origin")).toHaveLength(1);
  });
});
