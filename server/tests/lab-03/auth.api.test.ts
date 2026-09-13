import { randomBytes } from "node:crypto";

import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: null as Record<string, unknown> | null,
  session: null as Record<string, unknown> | null,
  blocked: false,
}));

const prisma = vi.hoisted(() => ({
  user: {
    findUnique: async ({ where }: { where: Record<string, unknown> }) => {
      if (where.id !== undefined && state.user && where.id !== state.user.id) return null;
      if (where.email !== undefined && state.user && String(state.user.email).toLowerCase() !== String(where.email).toLowerCase()) return null;
      return state.user;
    },
    update: async ({ data }: { data: Record<string, unknown> }) => {
      state.user = { ...(state.user as Record<string, unknown>), ...data };
      return state.user;
    },
  },
  userSession: {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      state.session = { ...data, revokedAt: null, previousRefreshTokenHash: null, previousRefreshValidUntil: null };
      return state.session;
    },
    findUnique: async () => state.session,
    update: async ({ data }: { data: Record<string, unknown> }) => {
      state.session = { ...(state.session as Record<string, unknown>), ...data };
      return state.session;
    },
    updateMany: async ({ data }: { data: Record<string, unknown> }) => {
      if (state.session) state.session = { ...state.session, ...data };
      return { count: state.session ? 1 : 0 };
    },
  },
  loginRateLimitBucket: {
    findMany: async () => state.blocked ? [{ blockedUntil: new Date(Date.now() + 60_000) }] : [],
    deleteMany: async () => ({ count: 1 }),
  },
  $transaction: async <T>(callback: (tx: typeof prisma) => Promise<T>) => callback(prisma),
  $queryRaw: async () => [{ id: state.session?.id }],
  $executeRaw: async () => 1,
}));

vi.mock("../../src/prisma.js", () => ({ getPrisma: () => prisma }));

import { app } from "../../src/app.js";
import { generateInitialPassword } from "../../src/services/initialPasswordGenerator.js";
import { hashPassword } from "../../src/services/passwordService.js";

describe("authentication API @issue-2", () => {
  let testPassword: string;

  beforeEach(async () => {
    process.env.JWT_SECRET = randomBytes(32).toString("base64url");
    testPassword = generateInitialPassword();
    state.user = {
      id: 7,
      publicId: "10000000-0000-4000-8000-000000000001",
      name: "Alice Johnson",
      email: "alice@example.com",
      role: "REQUESTER",
      passwordHash: await hashPassword(testPassword),
      mustChangePassword: false,
      isActive: true,
      deleted: false,
    };
    state.session = null;
    state.blocked = false;
  });

  it("returns token data only and sets an opaque refresh cookie", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "Alice@Example.com", password: testPassword, rememberMe: true });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ accessToken: expect.any(String), expiresIn: 600 });
    expect(response.body).not.toHaveProperty("user");
    expect(response.headers["set-cookie"][0]).toContain("HttpOnly");
    expect(response.headers["set-cookie"][0]).toContain("Path=/api/auth");
    expect(response.headers["set-cookie"][0]).toContain("Max-Age=7776000");
  });

  it("uses the generic failure envelope for unknown credentials", async () => {
    state.user = null;
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "unknown@example.com", password: testPassword, rememberMe: false });
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ code: "AUTHENTICATION_FAILED", message: "Invalid email or password." });
  });

  it("blocks a rate-limited login without confirming the account", async () => {
    state.blocked = true;
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "unknown@example.com", password: testPassword, rememberMe: false });
    expect(response.status).toBe(429);
    expect(response.headers["retry-after"]).toBe("900");
    expect(response.body.code).toBe("RATE_LIMITED");
  });
});
