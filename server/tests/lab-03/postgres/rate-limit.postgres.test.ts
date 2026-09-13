import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PrismaClient } from "../../../src/generated/prisma/client.js";
import { assertLab3TestDatabase, createTestPrisma, type Lab3TestTarget } from "./testDatabase.js";
import {
  GLOBAL_FAILURE_LIMIT,
  ipBucketHash,
  LoginRateLimitService,
  PAIR_FAILURE_LIMIT,
  pairBucketHash,
  RATE_LIMIT_BLOCK_MS,
  RATE_LIMIT_WINDOW_MS,
} from "../../../src/services/loginRateLimitService.js";

describe("Lab 3 PostgreSQL rate limits @issue-2", () => {
  let target: Lab3TestTarget;
  let prisma: PrismaClient;
  beforeAll(() => { target = assertLab3TestDatabase(); prisma = createTestPrisma(target); });
  afterAll(async () => prisma?.$disconnect());

  it("PG-06 serializes concurrent pair and global bucket increments in PostgreSQL @issue-2", async () => {
    const emailPrefix = `pg-rate-${Date.now()}`;
    const globalIp = "198.51.100.20";
    const pairIp = "198.51.100.21";
    const service = new LoginRateLimitService(prisma);
    const now = new Date();

    try {
      await Promise.all(
        Array.from({ length: 30 }, (_, index) =>
          service.runLoginAttempt(
            `${emailPrefix}-${index}@example.com`,
            globalIp,
            now,
            async () => null,
          ),
        ),
      );
      const globalBucket = await prisma.loginRateLimitBucket.findFirst({
        where: { scope: "IP", bucketKeyHash: ipBucketHash(globalIp) },
      });
      expect(globalBucket?.failureCount).toBe(GLOBAL_FAILURE_LIMIT);
      expect(await service.isBlocked(`${emailPrefix}-next@example.com`, globalIp, now)).toBe(true);
      expect(
        await service.isBlocked(
          `${emailPrefix}-next@example.com`,
          globalIp,
          new Date(now.getTime() + RATE_LIMIT_BLOCK_MS),
        ),
      ).toBe(false);

      await Promise.all(
        Array.from({ length: 5 }, () =>
          service.runLoginAttempt(emailPrefix, pairIp, now, async () => null),
        ),
      );
      const pairBucket = await prisma.loginRateLimitBucket.findFirst({
        where: { scope: "EMAIL_IP", bucketKeyHash: pairBucketHash(emailPrefix, pairIp) },
      });
      expect(pairBucket?.failureCount).toBe(PAIR_FAILURE_LIMIT);
      expect((await service.runLoginAttempt(emailPrefix, pairIp, now, async () => null)).blocked).toBe(true);
      expect(await service.isBlocked(emailPrefix, pairIp, new Date(now.getTime() + RATE_LIMIT_BLOCK_MS))).toBe(false);

      const windowEmail = `${emailPrefix}-window@example.com`;
      const windowIp = "198.51.100.22";
      await service.runLoginAttempt(windowEmail, windowIp, now, async () => null);
      await service.runLoginAttempt(
        windowEmail,
        windowIp,
        new Date(now.getTime() + RATE_LIMIT_WINDOW_MS - 1),
        async () => null,
      );
      const withinWindowBucket = await prisma.loginRateLimitBucket.findFirst({
        where: { scope: "EMAIL_IP", bucketKeyHash: pairBucketHash(windowEmail, windowIp) },
      });
      expect(withinWindowBucket?.failureCount).toBe(2);

      const exactWindowBoundary = new Date(now.getTime() + RATE_LIMIT_WINDOW_MS);
      await service.runLoginAttempt(windowEmail, windowIp, exactWindowBoundary, async () => null);
      const resetBucket = await prisma.loginRateLimitBucket.findFirst({
        where: { scope: "EMAIL_IP", bucketKeyHash: pairBucketHash(windowEmail, windowIp) },
      });
      expect(resetBucket).toMatchObject({
        failureCount: 1,
        windowStartedAt: exactWindowBoundary,
        blockedUntil: null,
      });

      const successEmail = `${emailPrefix}-success@example.com`;
      const successIp = "198.51.100.23";
      await service.runLoginAttempt(successEmail, successIp, now, async () => null);
      const successfulAttempt = await service.runLoginAttempt(successEmail, successIp, now, async () => "authenticated");
      expect(successfulAttempt).toEqual({ blocked: false, value: "authenticated" });
      expect(
        await prisma.loginRateLimitBucket.findFirst({
          where: { scope: "EMAIL_IP", bucketKeyHash: pairBucketHash(successEmail, successIp) },
        }),
      ).toBeNull();
      expect(
        await prisma.loginRateLimitBucket.findFirst({
          where: { scope: "IP", bucketKeyHash: ipBucketHash(successIp) },
        }),
      ).toMatchObject({ failureCount: 1 });
    } finally {
      await prisma.loginRateLimitBucket.deleteMany({
        where: {
          OR: [
            { scope: "IP", bucketKeyHash: ipBucketHash(globalIp) },
            { scope: "IP", bucketKeyHash: ipBucketHash(pairIp) },
            { scope: "IP", bucketKeyHash: ipBucketHash("198.51.100.22") },
            { scope: "IP", bucketKeyHash: ipBucketHash("198.51.100.23") },
            {
              scope: "EMAIL_IP",
              bucketKeyHash: {
                in: Array.from({ length: 30 }, (_, index) =>
                  pairBucketHash(`${emailPrefix}-${index}@example.com`, globalIp),
                ).concat(
                  pairBucketHash(emailPrefix, pairIp),
                  pairBucketHash(`${emailPrefix}-window@example.com`, "198.51.100.22"),
                  pairBucketHash(`${emailPrefix}-success@example.com`, "198.51.100.23"),
                ),
              },
            },
          ],
        },
      });
    }
  });
});
