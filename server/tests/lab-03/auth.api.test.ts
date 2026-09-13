import { randomBytes } from "node:crypto";

import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  passwordHash: "",
  users: [] as Array<Record<string, unknown>>,
  sessions: [] as Array<Record<string, unknown>>,
  blocked: false,
}));

const prisma = vi.hoisted(() => ({
  user: {
    findUnique: async ({ where }: { where: Record<string, unknown> }) => {
      if (where.id !== undefined) {
        return state.users.find((user) => user.id === where.id) ?? null;
      }
      if (where.email !== undefined) {
        const email = String(where.email).toLowerCase();
        return state.users.find((user) => String(user.email).toLowerCase() === email) ?? null;
      }
      return null;
    },
    update: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const index = state.users.findIndex((user) => user.id === where.id);
      if (index < 0) return null;
      state.users[index] = { ...state.users[index], ...data };
      return state.users[index];
    },
  },
  userSession: {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const session = {
        ...data,
        revokedAt: null,
        previousRefreshTokenHash: null,
        previousRefreshValidUntil: null,
      };
      state.sessions.push(session);
      return session;
    },
    findUnique: async ({ where }: { where: Record<string, unknown> }) =>
      state.sessions.find((session) => session.id === where.id) ?? null,
    update: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const index = state.sessions.findIndex((session) => session.id === where.id);
      if (index < 0) return null;
      state.sessions[index] = { ...state.sessions[index], ...data };
      return state.sessions[index];
    },
    updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      let count = 0;
      for (const [index, session] of state.sessions.entries()) {
        if (where.userId !== undefined && session.userId !== where.userId) continue;
        if (where.revokedAt === null && session.revokedAt !== null) continue;
        state.sessions[index] = { ...session, ...data };
        count += 1;
      }
      return { count };
    },
  },
  loginRateLimitBucket: {
    findMany: async () => state.blocked ? [{ blockedUntil: new Date(Date.now() + 60_000) }] : [],
    deleteMany: async () => ({ count: 1 }),
  },
  $transaction: async <T>(callback: (tx: typeof prisma) => Promise<T>) => callback(prisma),
  $queryRaw: async (...args: unknown[]) => {
    const sessionId = args[1];
    const session = state.sessions.find((candidate) => candidate.id === sessionId);
    return session ? [{ id: session.id }] : [];
  },
  $executeRaw: async () => 1,
}));

vi.mock("../../src/prisma.js", () => ({ getPrisma: () => prisma }));

import { app } from "../../src/app.js";
import { generateInitialPassword } from "../../src/services/initialPasswordGenerator.js";
import { JwtService } from "../../src/services/jwtService.js";
import {
  FULL_SESSION_MS,
  PREVIOUS_REFRESH_WINDOW_MS,
  REMEMBER_ABSOLUTE_MS,
  REMEMBER_IDLE_MS,
  RESTRICTED_SESSION_MS,
  refreshTokenHash,
} from "../../src/services/sessionService.js";
import { hashPassword, TEST_ARGON2_PROFILE } from "../../src/services/passwordService.js";

const ORIGIN = "http://localhost:5173";
const USER_PUBLIC_ID = "10000000-0000-4000-8000-000000000001";

function configureUser(overrides: Record<string, unknown> = {}): void {
  state.users = [{
    id: 7,
    publicId: USER_PUBLIC_ID,
    name: "Alice Johnson",
    email: "alice@example.com",
    role: "REQUESTER",
    passwordHash: state.passwordHash,
    mustChangePassword: false,
    isActive: true,
    deleted: false,
    ...overrides,
  }];
}

function refreshCookie(response: request.Response): string {
  const header = response.headers["set-cookie"];
  const setCookie = Array.isArray(header)
    ? header.find((value: string) => value.startsWith("toktickit_refresh="))
    : header?.startsWith("toktickit_refresh=")
      ? header
      : undefined;
  if (!setCookie) throw new Error("Expected refresh cookie");
  const value = setCookie.split(";", 1)[0]!.slice("toktickit_refresh=".length);
  return decodeURIComponent(value);
}

function cookieHeader(token: string): string {
  return `toktickit_refresh=${encodeURIComponent(token)}`;
}

async function loginRequest(options: { rememberMe?: boolean; password: string }): Promise<request.Response> {
  return request(app)
    .post("/api/auth/login")
    .send({
      email: "Alice@Example.com",
      password: options.password,
      rememberMe: options.rememberMe ?? false,
    });
}

describe("Auth API @issue-2", () => {
  let testPassword: string;

  beforeEach(async () => {
    process.env.JWT_SECRET = randomBytes(32).toString("base64url");
    testPassword = generateInitialPassword();
    state.passwordHash = await hashPassword(testPassword, TEST_ARGON2_PROFILE);
    configureUser();
    state.sessions = [];
    state.blocked = false;
  });

  it("API-01 valid active User login returns token data and opaque cookie @issue-2", async () => {
    const response = await loginRequest({ rememberMe: true, password: testPassword });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ accessToken: expect.any(String), expiresIn: 600 });
    expect(response.body).not.toHaveProperty("user");
    expect(response.headers["set-cookie"]?.[0]).toContain("HttpOnly");
    expect(response.headers["set-cookie"]?.[0]).toContain("Path=/api/auth");
    expect(response.headers["set-cookie"]?.[0]).toContain("Max-Age=7776000");
    expect(state.sessions[0]).toMatchObject({ stage: "FULL", rememberMe: true });
  });

  it("API-02 unknown, inactive, deleted, and wrong-password login failures are identical @issue-2", async () => {
    const cases: Array<() => void> = [
      () => { state.users = []; },
      () => { configureUser({ isActive: false }); },
      () => { configureUser({ deleted: true }); },
      () => { configureUser({ passwordHash: state.passwordHash + "x" }); },
    ];
    const responses: request.Response[] = [];

    for (const configure of cases) {
      state.sessions = [];
      configure();
      responses.push(await loginRequest({ password: testPassword }));
    }

    expect(responses.map((response) => response.status)).toEqual([401, 401, 401, 401]);
    expect(responses.map((response) => response.body)).toEqual([
      responses[0]!.body,
      responses[0]!.body,
      responses[0]!.body,
      responses[0]!.body,
    ]);
    expect(responses[0]!.body).toMatchObject({
      code: "AUTHENTICATION_FAILED",
      message: "Invalid email or password.",
    });
  });

  it("API-03 restricted login reports authoritative stage and blocks business routes @issue-2", async () => {
    configureUser({ mustChangePassword: true });
    const login = await loginRequest({ rememberMe: true, password: testPassword });
    const accessToken = login.body.accessToken as string;

    expect(login.status).toBe(200);
    expect(state.sessions[0]).toMatchObject({ stage: "PASSWORD_CHANGE_REQUIRED", rememberMe: false });

    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({
      publicId: USER_PUBLIC_ID,
      sessionStage: "PASSWORD_CHANGE_REQUIRED",
      mustChangePassword: true,
    });

    const refresh = await request(app)
      .post("/api/auth/refresh")
      .set("Origin", ORIGIN)
      .set("Cookie", cookieHeader(refreshCookie(login)));
    expect(refresh.status).toBe(200);

    const refreshedMe = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${refresh.body.accessToken}`);
    expect(refreshedMe.status).toBe(200);
    expect(refreshedMe.body.sessionStage).toBe("PASSWORD_CHANGE_REQUIRED");

    const protectedRoute = await request(app)
      .get("/api/categories")
      .set("Authorization", `Bearer ${refresh.body.accessToken}`);
    expect(protectedRoute.status).toBe(403);
    expect(protectedRoute.body.code).toBe("PASSWORD_CHANGE_REQUIRED");
  });

  it("API-04 restricted password change needs no current password and forces fresh login @issue-2", async () => {
    configureUser({ mustChangePassword: true });
    const login = await loginRequest({ password: testPassword });
    const newPassword = generateInitialPassword();

    const change = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${login.body.accessToken}`)
      .send({ newPassword });
    expect(change.status).toBe(204);
    expect(change.headers["set-cookie"]?.[0]).toContain("Max-Age=0");
    expect(state.users[0]?.mustChangePassword).toBe(false);
    expect(state.sessions[0]?.revokedAt).toBeInstanceOf(Date);

    const oldSession = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${login.body.accessToken}`);
    expect(oldSession.status).toBe(401);
    expect(oldSession.body.code).toBe("SESSION_INVALID");

    const freshLogin = await loginRequest({ password: newPassword });
    expect(freshLogin.status).toBe(200);
    expect(state.sessions.at(-1)).toMatchObject({ stage: "FULL" });
  });

  it("API-05 FULL password change validates currentPassword and revokes every session @issue-2", async () => {
    const firstLogin = await loginRequest({ password: testPassword });
    await loginRequest({ password: testPassword });
    const newPassword = generateInitialPassword();
    const wrongPassword = `${testPassword}x`;

    const missing = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${firstLogin.body.accessToken}`)
      .send({ newPassword });
    expect(missing.status).toBe(400);
    expect(missing.body.code).toBe("VALIDATION_ERROR");

    const wrongType = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${firstLogin.body.accessToken}`)
      .send({ currentPassword: 7, newPassword });
    expect(wrongType.status).toBe(400);
    expect(wrongType.body.code).toBe("VALIDATION_ERROR");

    const wrong = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${firstLogin.body.accessToken}`)
      .send({ currentPassword: wrongPassword, newPassword });
    expect(wrong.status).toBe(401);
    expect(wrong.body.code).toBe("AUTHENTICATION_FAILED");

    const same = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${firstLogin.body.accessToken}`)
      .send({ currentPassword: testPassword, newPassword: testPassword });
    expect(same.status).toBe(400);
    expect(same.body).toMatchObject({ code: "VALIDATION_ERROR" });
    expect(same.body.details).toEqual([
      { field: "newPassword", message: "New password must differ from the current password." },
    ]);

    const valid = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${firstLogin.body.accessToken}`)
      .send({ currentPassword: testPassword, newPassword });
    expect(valid.status).toBe(204);
    expect(state.sessions.every((session) => session.revokedAt instanceof Date)).toBe(true);
    expect((await loginRequest({ password: newPassword })).status).toBe(200);
  });

  it("API-06 enforces restricted, full, Remember idle, and Remember absolute boundaries without sleeping @issue-2", async () => {
    vi.useFakeTimers();
    const createdAt = new Date("2026-09-13T00:00:00.000Z");
    vi.setSystemTime(createdAt);

    configureUser({ mustChangePassword: true });
    const restricted = await loginRequest({ password: testPassword });
    vi.setSystemTime(createdAt.getTime() + RESTRICTED_SESSION_MS);
    expect((await request(app)
      .post("/api/auth/refresh")
      .set("Origin", ORIGIN)
      .set("Cookie", cookieHeader(refreshCookie(restricted)))).body.code).toBe("SESSION_INVALID");

    state.sessions = [];
    configureUser();
    vi.setSystemTime(createdAt);
    const full = await loginRequest({ password: testPassword });
    vi.setSystemTime(createdAt.getTime() + FULL_SESSION_MS);
    expect((await request(app)
      .post("/api/auth/refresh")
      .set("Origin", ORIGIN)
      .set("Cookie", cookieHeader(refreshCookie(full)))).body.code).toBe("SESSION_INVALID");

    state.sessions = [];
    vi.setSystemTime(createdAt);
    const rememberIdle = await loginRequest({ rememberMe: true, password: testPassword });
    vi.setSystemTime(createdAt.getTime() + REMEMBER_IDLE_MS);
    expect((await request(app)
      .post("/api/auth/refresh")
      .set("Origin", ORIGIN)
      .set("Cookie", cookieHeader(refreshCookie(rememberIdle)))).body.code).toBe("SESSION_INVALID");

    state.sessions = [];
    vi.setSystemTime(createdAt);
    const rememberAbsolute = await loginRequest({ rememberMe: true, password: testPassword });
    vi.setSystemTime(createdAt.getTime() + REMEMBER_ABSOLUTE_MS);
    expect((await request(app)
      .post("/api/auth/refresh")
      .set("Origin", ORIGIN)
      .set("Cookie", cookieHeader(refreshCookie(rememberAbsolute)))).body.code).toBe("SESSION_INVALID");
    vi.useRealTimers();
  });

  it("API-07 refresh rotates the current token and persists only hash transitions @issue-2", async () => {
    const login = await loginRequest({ password: testPassword });
    const oldToken = refreshCookie(login);
    const refresh = await request(app)
      .post("/api/auth/refresh")
      .set("Origin", ORIGIN)
      .set("Cookie", cookieHeader(oldToken));
    const newToken = refreshCookie(refresh);

    expect(refresh.status).toBe(200);
    expect(newToken).not.toBe(oldToken);
    expect(state.sessions[0]).toMatchObject({
      previousRefreshTokenHash: refreshTokenHash(oldToken),
      refreshTokenHash: refreshTokenHash(newToken),
    });
    expect(state.sessions[0]?.refreshTokenHash).not.toBe(oldToken);
  });

  it("API-08 rescues the immediately previous token through the exact deadline, then revokes reuse @issue-2", async () => {
    vi.useFakeTimers();
    const firstTime = new Date("2026-09-13T00:00:00.000Z");
    vi.setSystemTime(firstTime);
    const login = await loginRequest({ password: testPassword });
    const oldToken = refreshCookie(login);

    vi.setSystemTime(firstTime.getTime() + 60_000);
    const firstRefresh = await request(app)
      .post("/api/auth/refresh")
      .set("Origin", ORIGIN)
      .set("Cookie", cookieHeader(oldToken));
    expect(firstRefresh.status).toBe(200);

    vi.setSystemTime(firstTime.getTime() + 60_000 + PREVIOUS_REFRESH_WINDOW_MS);
    const rescued = await request(app)
      .post("/api/auth/refresh")
      .set("Origin", ORIGIN)
      .set("Cookie", cookieHeader(oldToken));
    expect(rescued.status).toBe(200);
    expect(state.sessions[0]?.revokedAt).toBeNull();

    vi.setSystemTime(firstTime.getTime() + 60_000 + PREVIOUS_REFRESH_WINDOW_MS + 1);
    const reused = await request(app)
      .post("/api/auth/refresh")
      .set("Origin", ORIGIN)
      .set("Cookie", cookieHeader(oldToken));
    expect(reused.status).toBe(401);
    expect(reused.body.code).toBe("SESSION_INVALID");
    expect(state.sessions[0]?.revokeReason).toBe("refresh_reuse");
    vi.useRealTimers();
  });

  it("API-09 logout authenticates the refresh cookie, ignores bearer expiry, and stays idempotent @issue-2", async () => {
    const login = await loginRequest({ password: testPassword });
    const token = refreshCookie(login);
    const sessionId = token.split(".")[0]!;

    const malformedTokens = [
      "not-a-refresh-token",
      "20000000-0000-4000-8000-000000000001",
      `${sessionId}.secret.extra`,
      `${"-".repeat(36)}.secret`,
      "200000000000-4000-8000-000000000001.secret",
      "20000000-0000-4000-8000-00000000000g.secret",
      "20000000-0000-5000-8000-000000000001.secret",
      `${sessionId}.`,
    ];
    for (const malformedToken of malformedTokens) {
      const malformedRefresh = await request(app)
        .post("/api/auth/refresh")
        .set("Origin", ORIGIN)
        .set("Cookie", cookieHeader(malformedToken));
      expect(malformedRefresh.status).toBe(401);
      expect(malformedRefresh.body.code).toBe("SESSION_INVALID");

      const malformedLogout = await request(app)
        .post("/api/auth/logout")
        .set("Origin", ORIGIN)
        .set("Cookie", cookieHeader(malformedToken));
      expect(malformedLogout.status).toBe(204);
      expect(malformedLogout.headers["set-cookie"]?.[0]).toContain("Max-Age=0");
      expect(state.sessions[0]?.revokedAt).toBeNull();
    }

    const fakeSecretLogout = await request(app)
      .post("/api/auth/logout")
      .set("Origin", ORIGIN)
      .set("Cookie", cookieHeader(`${sessionId}.fake-secret`));
    expect(fakeSecretLogout.status).toBe(204);
    expect(state.sessions[0]?.revokedAt).toBeNull();

    const logout = await request(app)
      .post("/api/auth/logout")
      .set("Origin", ORIGIN)
      .set("Authorization", "Bearer expired-or-malformed")
      .set("Cookie", cookieHeader(token));
    expect(logout.status).toBe(204);
    expect(state.sessions[0]?.revokedAt).toBeInstanceOf(Date);
    expect(logout.headers["set-cookie"]?.[0]).toContain("Max-Age=0");

    const repeated = await request(app)
      .post("/api/auth/logout")
      .set("Origin", ORIGIN)
      .set("Cookie", cookieHeader(token));
    expect(repeated.status).toBe(204);

    const missing = await request(app).post("/api/auth/logout").set("Origin", ORIGIN);
    expect(missing.status).toBe(204);
  });

  it("API-10 FULL logout-all revokes every User session and clears current cookie @issue-2", async () => {
    const first = await loginRequest({ password: testPassword });
    const second = await loginRequest({ password: testPassword });
    const logoutAll = await request(app)
      .post("/api/auth/logout-all")
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${second.body.accessToken}`);

    expect(logoutAll.status).toBe(204);
    expect(state.sessions.every((session) => session.revokedAt instanceof Date)).toBe(true);
    expect(logoutAll.headers["set-cookie"]?.[0]).toContain("Max-Age=0");
    expect((await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${first.body.accessToken}`)).body.code).toBe("SESSION_INVALID");
  });

  it("API-11 returns safe rate-limit errors with Retry-After @issue-2", async () => {
    state.blocked = true;
    const response = await loginRequest({ password: testPassword });

    expect(response.status).toBe(429);
    expect(response.headers["retry-after"]).toBe("900");
    expect(response.body).toMatchObject({
      code: "RATE_LIMITED",
      message: "Too many login attempts. Try again later.",
    });
    expect(response.body).not.toHaveProperty("accountExists");
  });

  it("API-12 rejects missing, malformed, bad-signature, expired, and revoked access credentials safely @issue-2", async () => {
    const missing = await request(app).get("/api/categories");
    expect(missing.status).toBe(401);
    expect(missing.body.code).toBe("UNAUTHENTICATED");

    const malformed = await request(app).get("/api/categories").set("Authorization", "Bearer not.a.jwt");
    expect(malformed.status).toBe(401);
    expect(malformed.body.code).toBe("UNAUTHENTICATED");

    const badSignature = await new JwtService(randomBytes(32).toString("base64url")).sign({
      userPublicId: USER_PUBLIC_ID,
      sessionId: "20000000-0000-4000-8000-000000000001",
    });
    const invalidSignature = await request(app)
      .get("/api/categories")
      .set("Authorization", `Bearer ${badSignature}`);
    expect(invalidSignature.status).toBe(401);
    expect(invalidSignature.body.code).toBe("UNAUTHENTICATED");

    const expired = await new JwtService().sign({
      userPublicId: USER_PUBLIC_ID,
      sessionId: "20000000-0000-4000-8000-000000000001",
      now: new Date("2020-01-01T00:00:00.000Z"),
    });
    const expiredResponse = await request(app)
      .get("/api/categories")
      .set("Authorization", `Bearer ${expired}`);
    expect(expiredResponse.status).toBe(401);
    expect(expiredResponse.body.code).toBe("ACCESS_TOKEN_EXPIRED");

    const login = await loginRequest({ password: testPassword });
    state.sessions[0]!.revokedAt = new Date();
    const revoked = await request(app)
      .get("/api/categories")
      .set("Authorization", `Bearer ${login.body.accessToken}`);
    expect(revoked.status).toBe(401);
    expect(revoked.body.code).toBe("SESSION_INVALID");
  });

  it("API-13 applies server-side role authorization to protected requester routes @issue-2", async () => {
    for (const role of ["IT_STAFF", "ADMINISTRATOR"]) {
      state.sessions = [];
      configureUser({ role });
      const login = await loginRequest({ password: testPassword });
      const response = await request(app)
        .get("/api/users/me/tickets")
        .set("Authorization", `Bearer ${login.body.accessToken}`);

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("FORBIDDEN");
    }
  });
});
