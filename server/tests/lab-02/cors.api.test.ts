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
import { resolveAllowedOrigins } from "../../src/middleware/cors.js";

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

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.developmentRequester.findMany.mockResolvedValue([ALICE]);
  prismaMock.developmentRequester.findFirst.mockResolvedValue(ALICE);
  prismaMock.category.findMany.mockResolvedValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// API-66's "Ticket-list response includes both readable values" half needs
// `GET /api/tickets`, which is Issue #22. This file covers the header policy
// only.
describe("CORS (API-66, API-71)", () => {
  it("falls back to the Vite dev origin in development, test, and unset environments", () => {
    expect(resolveAllowedOrigins({})).toEqual(["http://localhost:5173"]);
    expect(resolveAllowedOrigins({ NODE_ENV: "development" })).toEqual(["http://localhost:5173"]);
    expect(resolveAllowedOrigins({ NODE_ENV: "test" })).toEqual(["http://localhost:5173"]);
  });

  it("reads an exact comma-separated origin list", () => {
    expect(
      resolveAllowedOrigins({
        CORS_ALLOWED_ORIGINS: "https://a.example, https://b.example",
        NODE_ENV: "production",
      }),
    ).toEqual(["https://a.example", "https://b.example"]);
  });

  it("rejects a wildcard allowlist", () => {
    expect(() =>
      resolveAllowedOrigins({ CORS_ALLOWED_ORIGINS: "*", NODE_ENV: "production" }),
    ).toThrow();
  });

  it("fails startup when the allowlist is missing outside development and test", () => {
    expect(() => resolveAllowedOrigins({ NODE_ENV: "production" })).toThrow();
  });

  it("echoes an allowed origin and never a wildcard", async () => {
    const res = await request(app)
      .get("/api/requesters")
      .set("Origin", "http://localhost:5173");

    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(res.headers["access-control-allow-origin"]).not.toBe("*");
  });

  it("sends no allow-origin header for a disallowed origin", async () => {
    const res = await request(app).get("/api/requesters").set("Origin", "http://evil.example");

    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    expect(res.status).toBe(200);
  });

  it("serves origin-less requests normally", async () => {
    const res = await request(app).get("/api/requesters");

    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("exposes the pagination and correlation headers", async () => {
    const res = await request(app)
      .get("/api/requesters")
      .set("Origin", "http://localhost:5173");

    expect(res.headers["access-control-expose-headers"]).toBe("X-Pagination,X-Request-Id");
  });

  it("permits the four Lab 2 request headers on preflight", async () => {
    const res = await request(app)
      .options("/api/tickets")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "X-Requester-Id");

    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-headers"]).toBe(
      "Content-Type,X-Requester-Id,Idempotency-Key,X-Request-Id",
    );
  });
});
