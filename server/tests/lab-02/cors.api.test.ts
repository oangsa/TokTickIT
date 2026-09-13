import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

import {
  bearerToken,
  configureRequesterAuth,
  testUser,
  type RequesterTokens,
} from "./support/authenticatedRequester.js";

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  userSession: { findUnique: vi.fn() },
  developmentRequester: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  category: { findMany: vi.fn() },
  ticket: { findMany: vi.fn(), count: vi.fn() },
  /* The list read path takes its page and count in one snapshot. */
  $transaction: vi.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
}));

vi.mock("../../src/prisma.js", () => ({ getPrisma: () => prismaMock }));

import { app } from "../../src/app.js";
import { resolveAllowedOrigins } from "../../src/middleware/cors.js";

const ALICE = testUser({ id: 1, name: "Alice Johnson", email: "alice.johnson@example.com" });
let tokens: RequesterTokens;

beforeEach(async () => {
  vi.clearAllMocks();
  tokens = await configureRequesterAuth(prismaMock, [ALICE]);
  prismaMock.category.findMany.mockResolvedValue([]);
  prismaMock.ticket.findMany.mockResolvedValue([]);
  prismaMock.ticket.count.mockResolvedValue(0);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CORS (API-66, API-71)", () => {
  it("uses the Vite dev origin only in development and test", () => {
    expect(resolveAllowedOrigins({ NODE_ENV: "development" })).toEqual(["http://localhost:5173"]);
    expect(resolveAllowedOrigins({ NODE_ENV: "test" })).toEqual(["http://localhost:5173"]);
    expect(() => resolveAllowedOrigins({})).toThrow();
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
      .get("/api/health")
      .set("Origin", "http://localhost:5173");

    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(res.headers["access-control-allow-origin"]).not.toBe("*");
  });

  it("sends no allow-origin header for a disallowed origin", async () => {
    const res = await request(app).get("/api/health").set("Origin", "http://evil.example");

    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    expect(res.status).toBe(200);
  });

  it("serves origin-less requests normally", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("exposes the pagination and correlation headers", async () => {
    const res = await request(app)
      .get("/api/health")
      .set("Origin", "http://localhost:5173");

    expect(res.headers["access-control-expose-headers"]).toBe("X-Pagination,X-Request-Id");
  });

  it("makes both readable values present on a Ticket-list response", async () => {
    // The other half of API-66: the allowlist above only promises the headers
    // are readable, so the collection response has to actually carry them.
    const res = await request(app)
      .get("/api/users/me/tickets")
      .set("Origin", "http://localhost:5173")
      .set("Authorization", bearerToken(tokens, ALICE.id));

    expect(res.status).toBe(200);
    expect(res.headers["access-control-expose-headers"]).toBe("X-Pagination,X-Request-Id");
    expect(JSON.parse(res.headers["x-pagination"])).toMatchObject({
      pageNumber: 1,
      pageSize: 10,
      totalItems: 0,
    });
    expect(res.headers["x-request-id"]).toBeTruthy();
  });

  it("permits the authenticated Lab 3 request headers on preflight", async () => {
    const res = await request(app)
      .options("/api/users/me/tickets")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "Authorization");

    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-headers"]).toBe(
      "Authorization,Content-Type,Idempotency-Key,X-Request-Id",
    );
  });
});
