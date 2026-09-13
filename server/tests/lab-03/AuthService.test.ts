import { describe, expect, it } from "vitest";

import { AuthService } from "../../src/services/authService.js";
import { hashPassword } from "../../src/services/passwordService.js";

interface AuthFakePrisma {
  user: { findUnique: () => Promise<Record<string, unknown>> };
  userSession: {
    create: (args: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
  };
  loginRateLimitBucket: {
    findMany: () => Promise<never[]>;
    deleteMany: () => Promise<{ count: number }>;
  };
  $transaction: <T>(callback: (tx: AuthFakePrisma) => Promise<T>) => Promise<T>;
  $queryRaw: () => Promise<never[]>;
  $executeRaw: () => Promise<number>;
}

describe("AuthService @issue-2", () => {
  it("creates a restricted session for an initial-password User", async () => {
    process.env.JWT_SECRET = "test-secret-that-is-at-least-32-characters-long";
    const passwordHash = await hashPassword("Aa1!test");
    const user = {
      id: 7,
      publicId: "10000000-0000-4000-8000-000000000001",
      name: "Alice Johnson",
      email: "alice@example.com",
      role: "REQUESTER" as const,
      passwordHash,
      mustChangePassword: true,
      isActive: true,
      deleted: false,
    };
    const prisma: AuthFakePrisma = {
      user: { findUnique: async () => user },
      userSession: {
        create: async ({ data }: { data: Record<string, unknown> }) => ({
          ...data,
          revokedAt: null,
          previousRefreshTokenHash: null,
          previousRefreshValidUntil: null,
        }),
      },
      loginRateLimitBucket: {
        findMany: async () => [],
        deleteMany: async () => ({ count: 1 }),
      },
      $transaction: async <T>(callback: (tx: typeof prisma) => Promise<T>) => callback(prisma),
      $queryRaw: async () => [],
      $executeRaw: async () => 1,
    };
    const result = await new AuthService(prisma as never).login({
      email: "ALICE@example.com",
      password: "Aa1!test",
      rememberMe: true,
      ipAddress: "127.0.0.1",
    });
    expect(result.token.expiresIn).toBe(600);
    expect(result.refreshToken).toContain(".");
    expect(result.persistent).toBe(false);
  });
});
