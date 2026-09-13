import { describe, expect, it } from "vitest";

import {
  GLOBAL_FAILURE_LIMIT,
  ipBucketHash,
  LoginRateLimitService,
  normalizeLoginEmail,
  PAIR_FAILURE_LIMIT,
  pairBucketHash,
  RATE_LIMIT_BLOCK_MS,
  RATE_LIMIT_WINDOW_MS,
} from "../../src/services/loginRateLimitService.js";

describe("UNIT-05 LoginRateLimitService @issue-2", () => {
  it("exposes the exact PostgreSQL-backed limits and normalization", () => {
    expect(normalizeLoginEmail(" Alice@Example.COM ")).toBe("alice@example.com");
    expect(PAIR_FAILURE_LIMIT).toBe(5);
    expect(GLOBAL_FAILURE_LIMIT).toBe(30);
    expect(RATE_LIMIT_WINDOW_MS).toBe(15 * 60 * 1000);
    expect(RATE_LIMIT_BLOCK_MS).toBe(15 * 60 * 1000);
  });

  it("uses normalized, hashed bucket keys and an exclusive block expiry boundary", async () => {
    expect(pairBucketHash(" Alice@Example.COM ", " 127.0.0.1 "))
      .toBe(pairBucketHash("alice@example.com", "127.0.0.1"));
    expect(ipBucketHash(" 127.0.0.1 ")).toBe(ipBucketHash("127.0.0.1"));

    const blockedUntil = new Date("2026-09-13T00:15:00.000Z");
    const prisma = {
      loginRateLimitBucket: {
        findMany: async () => [{ blockedUntil }],
      },
    };
    const service = new LoginRateLimitService(prisma as never);

    await expect(service.isBlocked("alice@example.com", "127.0.0.1", new Date("2026-09-13T00:14:59.999Z")))
      .resolves.toBe(true);
    await expect(service.isBlocked("alice@example.com", "127.0.0.1", blockedUntil))
      .resolves.toBe(false);
  });

  it("clears only the normalized email/IP bucket after a successful login", async () => {
    let capturedWhere: unknown;
    const prisma = {
      loginRateLimitBucket: {
        deleteMany: async ({ where }: { where: unknown }) => {
          capturedWhere = where;
          return { count: 1 };
        },
      },
    };
    await new LoginRateLimitService(prisma as never).clearPair(" Alice@Example.COM ", " 127.0.0.1 ");
    expect(capturedWhere).toEqual({
      scope: "EMAIL_IP",
      bucketKeyHash: pairBucketHash("alice@example.com", "127.0.0.1"),
    });
  });
});
