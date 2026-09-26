import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  userSession: { findUnique: vi.fn() },
  category: { findMany: vi.fn() },
}));

vi.mock("../../src/prisma.js", () => ({ getPrisma: () => prismaMock }));

import { app } from "../../src/app.js";
import {
  bearerToken,
  configureRequesterAuth,
  testUser,
  type RequesterTokens,
} from "./support/authenticatedRequester.js";

const ALICE = testUser({ id: 1, name: "Alice Johnson", email: "alice.johnson@example.com" });
let tokens: RequesterTokens;

beforeEach(async () => {
  vi.clearAllMocks();
  tokens = await configureRequesterAuth(prismaMock, [ALICE]);
  prismaMock.category.findMany.mockResolvedValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("authenticated transport replacement for requester context (API-01)", () => {
  it("keeps health public without a User session", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", service: "TokTickIT API" });
    expect(prismaMock.userSession.findUnique).not.toHaveBeenCalled();
  });

  it("keeps the public health route case-insensitive and HEAD-compatible", async () => {
    const upperHealth = await request(app).get("/api/HEALTH");
    const headHealth = await request(app).head("/api/health");

    expect(upperHealth.status).toBe(200);
    expect(headHealth.status).toBe(200);
  });

  it("rejects a protected route when the bearer token is missing", async () => {
    const res = await request(app).get("/api/categories");

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHENTICATED");
    expect(prismaMock.category.findMany).not.toHaveBeenCalled();
  });

  it("does not treat X-Requester-Id as authentication", async () => {
    const res = await request(app).get("/api/categories").set("X-Requester-Id", "1");

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHENTICATED");
    expect(res.headers["x-requester-id"]).toBeUndefined();
    expect(prismaMock.category.findMany).not.toHaveBeenCalled();
  });

  it("rejects a malformed bearer token before querying the session", async () => {
    const res = await request(app)
      .get("/api/categories")
      .set("Authorization", "Bearer not-a-jwt");

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHENTICATED");
    expect(prismaMock.userSession.findUnique).not.toHaveBeenCalled();
  });

  it("accepts a current authenticated User and reaches the protected route", async () => {
    const res = await request(app)
      .get("/api/categories")
      .set("Authorization", bearerToken(tokens, ALICE.id));

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    expect(prismaMock.userSession.findUnique).toHaveBeenCalled();
    expect(prismaMock.category.findMany).toHaveBeenCalled();
  });
});
