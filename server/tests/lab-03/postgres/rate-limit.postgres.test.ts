import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PrismaClient } from "../../../src/generated/prisma/client.js";
import { assertLab3TestDatabase, createTestPrisma, type Lab3TestTarget } from "./testDatabase.js";
import { ipBucketHash, LoginRateLimitService, pairBucketHash } from "../../../src/services/loginRateLimitService.js";

describe("Lab 3 PostgreSQL rate limits @issue-2", () => {
  let target: Lab3TestTarget;
  let prisma: PrismaClient;
  beforeAll(() => { target = assertLab3TestDatabase(); prisma = createTestPrisma(target); });
  afterAll(async () => prisma?.$disconnect());

  it("serializes concurrent pair and global bucket increments in PostgreSQL", async () => {
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
      expect(globalBucket?.failureCount).toBe(30);
      expect(await service.isBlocked(`${emailPrefix}-next@example.com`, globalIp, now)).toBe(true);

      await Promise.all(
        Array.from({ length: 5 }, () =>
          service.runLoginAttempt(emailPrefix, pairIp, now, async () => null),
        ),
      );
      const pairBucket = await prisma.loginRateLimitBucket.findFirst({
        where: { scope: "EMAIL_IP", bucketKeyHash: pairBucketHash(emailPrefix, pairIp) },
      });
      expect(pairBucket?.failureCount).toBe(5);
      expect((await service.runLoginAttempt(emailPrefix, pairIp, now, async () => null)).blocked).toBe(true);
    } finally {
      await prisma.loginRateLimitBucket.deleteMany({
        where: {
          OR: [
            { scope: "IP", bucketKeyHash: ipBucketHash(globalIp) },
            { scope: "IP", bucketKeyHash: ipBucketHash(pairIp) },
            {
              scope: "EMAIL_IP",
              bucketKeyHash: {
                in: Array.from({ length: 30 }, (_, index) =>
                  pairBucketHash(`${emailPrefix}-${index}@example.com`, globalIp),
                ).concat(pairBucketHash(emailPrefix, pairIp)),
              },
            },
          ],
        },
      });
    }
  });
});
