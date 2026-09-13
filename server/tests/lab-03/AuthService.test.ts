import { randomBytes } from "node:crypto";

import argon2 from "argon2";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "../../src/http/errors.js";
import { AuthService } from "../../src/services/authService.js";
import { generateInitialPassword } from "../../src/services/initialPasswordGenerator.js";
import { hashPassword, TEST_ARGON2_PROFILE } from "../../src/services/passwordService.js";

const USER = {
  id: 7,
  publicId: "10000000-0000-4000-8000-000000000001",
  name: "Alice Johnson",
  email: "alice@example.com",
  role: "REQUESTER" as const,
  isActive: true,
  deleted: false,
};

interface AuthFakePrisma {
  user: {
    findUnique: () => Promise<Record<string, unknown> | null>;
    update: (args: { data: Record<string, unknown> }) => Promise<Record<string, unknown> | null>;
  };
  userSession: {
    create: (args: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
    findUnique: () => Promise<Record<string, unknown> | null>;
    update: (args: { data: Record<string, unknown> }) => Promise<Record<string, unknown> | null>;
    updateMany: (args: { data: Record<string, unknown> }) => Promise<{ count: number }>;
  };
  loginRateLimitBucket: {
    findMany: () => Promise<never[]>;
    deleteMany: () => Promise<{ count: number }>;
  };
  $transaction: <T>(callback: (tx: AuthFakePrisma) => Promise<T>) => Promise<T>;
  $queryRaw: () => Promise<never[]>;
  $executeRaw: () => Promise<number>;
}

function fakePrisma(user: Record<string, unknown>, passwordHash: string) {
  let currentUser: Record<string, unknown> | null = { ...user, passwordHash };
  let currentSession: Record<string, unknown> | null = null;
  const prisma: AuthFakePrisma = {
    user: {
      findUnique: async () => currentUser,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        currentUser = { ...(currentUser as Record<string, unknown>), ...data };
        return currentUser;
      },
    },
    userSession: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        currentSession = {
          ...data,
          revokedAt: null,
          previousRefreshTokenHash: null,
          previousRefreshValidUntil: null,
        };
        return currentSession;
      },
      findUnique: async () => currentSession,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        currentSession = { ...(currentSession as Record<string, unknown>), ...data };
        return currentSession;
      },
      updateMany: async ({ data }: { data: Record<string, unknown> }) => {
        if (currentSession) currentSession = { ...currentSession, ...data };
        return { count: currentSession ? 1 : 0 };
      },
    },
    loginRateLimitBucket: {
      findMany: async () => [],
      deleteMany: async () => ({ count: 1 }),
    },
    $transaction: async <T>(callback: (tx: typeof prisma) => Promise<T>) => callback(prisma),
    $queryRaw: async () => [],
    $executeRaw: async () => 1,
  };
  return {
    prisma,
    getUser: () => currentUser,
    getSession: () => currentSession,
  };
}

describe("UNIT-06 AuthService @issue-2", () => {
  it("creates a restricted session and ignores Remember Me for an initial-password User", async () => {
    process.env.JWT_SECRET = randomBytes(32).toString("base64url");
    const initialPassword = generateInitialPassword();
    const fake = fakePrisma(
      { ...USER, mustChangePassword: true },
      await hashPassword(initialPassword, TEST_ARGON2_PROFILE),
    );
    const result = await new AuthService(fake.prisma as never, TEST_ARGON2_PROFILE).login({
      email: "ALICE@example.com",
      password: initialPassword,
      rememberMe: true,
      ipAddress: "127.0.0.1",
    });

    expect(result.token.expiresIn).toBe(600);
    expect(result.refreshToken).toContain(".");
    expect(result.persistent).toBe(false);
    expect(fake.getSession()).toMatchObject({
      stage: "PASSWORD_CHANGE_REQUIRED",
      rememberMe: false,
    });
  });

  it("derives context stage from the loaded UserSession instead of caller input", async () => {
    const now = new Date("2026-09-13T00:00:00.000Z");
    const fake = fakePrisma(USER, await hashPassword(generateInitialPassword(), TEST_ARGON2_PROFILE));
    fake.prisma.userSession.findUnique = async () => ({
      id: "20000000-0000-4000-8000-000000000001",
      userId: USER.id,
      stage: "PASSWORD_CHANGE_REQUIRED",
      rememberMe: false,
      revokedAt: null,
      lastUsedAt: now,
      absoluteExpiresAt: new Date(now.getTime() + 60_000),
    });

    const context = await new AuthService(fake.prisma as never, TEST_ARGON2_PROFILE).context(
      "20000000-0000-4000-8000-000000000001",
      USER.publicId,
      now,
    );
    expect(context.stage).toBe("PASSWORD_CHANGE_REQUIRED");
  });

  it("allows restricted password change without currentPassword and validates FULL requests", async () => {
    const currentPassword = generateInitialPassword();
    const fake = fakePrisma(USER, await hashPassword(currentPassword, TEST_ARGON2_PROFILE));
    const service = new AuthService(fake.prisma as never, TEST_ARGON2_PROFILE);
    const now = new Date("2026-09-13T00:00:00.000Z");
    const restrictedSession = {
      id: "20000000-0000-4000-8000-000000000001",
      userId: USER.id,
      stage: "PASSWORD_CHANGE_REQUIRED",
      rememberMe: false,
      revokedAt: null,
      lastUsedAt: now,
      absoluteExpiresAt: new Date(now.getTime() + 60_000),
    };
    fake.prisma.userSession.findUnique = async () => restrictedSession;
    const restricted = await service.context(restrictedSession.id, USER.publicId, now);
    await service.changePassword(restricted, { newPassword: generateInitialPassword() }, now);
    expect(fake.getUser()?.mustChangePassword).toBe(false);

    fake.prisma.userSession.findUnique = async () => ({ ...restrictedSession, stage: "FULL" });
    const full = await service.context(restrictedSession.id, USER.publicId, now);
    await expect(service.changePassword(full, { newPassword: generateInitialPassword() }, now))
      .rejects.toBeInstanceOf(ApiError);
    await expect(service.changePassword(full, { newPassword: generateInitialPassword() }, now))
      .rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("uses dummy verification and the same safe failure for unknown users", async () => {
    const fake = fakePrisma(USER, await hashPassword(generateInitialPassword(), TEST_ARGON2_PROFILE));
    fake.prisma.user.findUnique = async () => null;
    const service = new AuthService(fake.prisma as never, TEST_ARGON2_PROFILE);
    const verifySpy = vi.spyOn(argon2, "verify");

    try {
      await expect(service.login({
        email: "unknown@example.com",
        password: "WrongAa1!",
        rememberMe: false,
        ipAddress: "127.0.0.1",
      })).rejects.toMatchObject({ code: "AUTHENTICATION_FAILED" });
      expect(verifySpy).toHaveBeenCalledTimes(1);
      expect(verifySpy).toHaveBeenCalledWith(
        expect.stringContaining("$argon2id$v=19$m=8192,p=1,t=1$"),
        "WrongAa1!",
      );
    } finally {
      verifySpy.mockRestore();
    }
  });
});
