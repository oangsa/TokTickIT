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

const REQUESTER_CONTEXT_ENVELOPE = {
  statusCode: 400,
  code: "REQUESTER_CONTEXT_INVALID",
  message: "The requester context is invalid.",
  error: "Bad Request",
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.developmentRequester.findMany.mockResolvedValue([ALICE]);
  prismaMock.developmentRequester.findFirst.mockResolvedValue(ALICE);
  prismaMock.category.findMany.mockResolvedValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("requester context guard (API-01)", () => {
  it("lets the bootstrap endpoint through without requester context", async () => {
    const res = await request(app).get("/api/requesters");

    expect(res.status).toBe(200);
  });

  it("lets the health check through without requester context", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", service: "TokTickIT API" });
  });

  it("exempts the bootstrap and health routes the way Express routes them", async () => {
    // Express matches paths case-insensitively and dispatches HEAD to GET
    // handlers. An exemption that missed either would answer with the
    // context-invalidating code, and the client would throw away a valid
    // stored Requester over a URL the router would have served.
    const upperHealth = await request(app).get("/api/HEALTH");
    const upperBootstrap = await request(app).get("/api/Requesters");
    const headBootstrap = await request(app).head("/api/requesters");

    expect(upperHealth.status).toBe(200);
    expect(upperBootstrap.status).toBe(200);
    expect(headBootstrap.status).toBe(200);
  });

  it("rejects a guarded route when the header is missing", async () => {
    const res = await request(app).get("/api/categories");

    expect(res.status).toBe(400);
    expect(res.body).toEqual(REQUESTER_CONTEXT_ENVELOPE);
  });

  it("rejects a non-integer header with REQUESTER_CONTEXT_INVALID", async () => {
    const res = await request(app).get("/api/categories").set("X-Requester-Id", "abc");

    expect(res.status).toBe(400);
    expect(res.body).toEqual(REQUESTER_CONTEXT_ENVELOPE);
  });

  it("rejects a decimal header with REQUESTER_CONTEXT_INVALID", async () => {
    const res = await request(app).get("/api/categories").set("X-Requester-Id", "1.5");

    expect(res.status).toBe(400);
    expect(res.body).toEqual(REQUESTER_CONTEXT_ENVELOPE);
  });

  it("rejects an unsafe integer header with REQUESTER_CONTEXT_INVALID", async () => {
    const res = await request(app)
      .get("/api/categories")
      .set("X-Requester-Id", "99999999999999999999");

    expect(res.status).toBe(400);
    expect(res.body).toEqual(REQUESTER_CONTEXT_ENVELOPE);
  });

  it("rejects zero and negative headers with REQUESTER_CONTEXT_INVALID", async () => {
    const zero = await request(app).get("/api/categories").set("X-Requester-Id", "0");
    const negative = await request(app).get("/api/categories").set("X-Requester-Id", "-3");

    for (const res of [zero, negative]) {
      expect(res.status).toBe(400);
      expect(res.body).toEqual(REQUESTER_CONTEXT_ENVELOPE);
    }
  });

  it("rejects an unknown, deleted, or inactive Requester with REQUESTER_CONTEXT_INVALID", async () => {
    // Unknown, `deleted: true`, and `isActive: false` all resolve to `null`
    // through `findSelectableById`, which is exactly why they are
    // indistinguishable to the client.
    prismaMock.developmentRequester.findFirst.mockResolvedValue(null);

    const res = await request(app).get("/api/categories").set("X-Requester-Id", "999");

    expect(res.status).toBe(400);
    expect(res.body).toEqual(REQUESTER_CONTEXT_ENVELOPE);
  });

  it("accepts a valid active Requester and reaches the route", async () => {
    const res = await request(app).get("/api/categories").set("X-Requester-Id", "1");

    expect(res.status).toBe(200);
    expect(prismaMock.category.findMany).toHaveBeenCalled();
  });

  it("carries the same code and generic message on every rejection", async () => {
    const missing = await request(app).get("/api/categories");
    const nonInteger = await request(app).get("/api/categories").set("X-Requester-Id", "abc");
    prismaMock.developmentRequester.findFirst.mockResolvedValue(null);
    const unknown = await request(app).get("/api/categories").set("X-Requester-Id", "999");

    for (const res of [missing, nonInteger, unknown]) {
      expect(res.body.code).toBe("REQUESTER_CONTEXT_INVALID");
      expect(res.body.message).toBe("The requester context is invalid.");
      expect(JSON.stringify(res.body)).not.toContain(ALICE.name);
      expect(JSON.stringify(res.body)).not.toContain(ALICE.email);
    }
  });
});
