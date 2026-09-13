import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash, randomUUID } from "node:crypto";

import type { PrismaClient } from "../../../src/generated/prisma/client.js";
import { assertLab3TestDatabase, createTestPrisma, type Lab3TestTarget } from "./testDatabase.js";
import { MaintenanceService } from "../../../src/services/maintenanceService.js";

describe("Lab 3 maintenance cleanup @issue-2", () => {
  let target: Lab3TestTarget;
  let prisma: PrismaClient;
  beforeAll(() => { target = assertLab3TestDatabase(); prisma = createTestPrisma(target); });
  afterAll(async () => prisma?.$disconnect());

  it("removes expired technical rows, preserves live rows, and is repeatable", async () => {
    const now = new Date();
    const liveUser = await prisma.user.findFirst({ where: { deleted: false } });
    if (!liveUser) throw new Error("Seeded User required for maintenance test");

    const sessionIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
    const bucketHashes = ["expired-blocked", "expired-window", "live-blocked", "live-window"].map((label) =>
      createHash("sha256").update(label).digest("hex"),
    );
    const future = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const old = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);

    try {
      const sessions = [
        { id: sessionIds[0], rememberMe: false, lastUsedAt: now, absoluteExpiresAt: new Date(now.getTime() - 1), revokedAt: null, revokeReason: null },
        { id: sessionIds[1], rememberMe: false, lastUsedAt: now, absoluteExpiresAt: future, revokedAt: new Date(now.getTime() - 1), revokeReason: "logout" },
        { id: sessionIds[2], rememberMe: true, lastUsedAt: old, absoluteExpiresAt: future, revokedAt: null, revokeReason: null },
        { id: sessionIds[3], rememberMe: true, lastUsedAt: now, absoluteExpiresAt: future, revokedAt: null, revokeReason: null },
      ];
      for (const [index, session] of sessions.entries()) {
        await prisma.userSession.create({
          data: {
            id: session.id,
            userId: liveUser.id,
            stage: "FULL",
            refreshTokenHash: createHash("sha256").update(`session-${index}-${randomUUID()}`).digest("hex"),
            rememberMe: session.rememberMe,
            createdAt: old,
            lastUsedAt: session.lastUsedAt,
            absoluteExpiresAt: session.absoluteExpiresAt,
            revokedAt: session.revokedAt,
            revokeReason: session.revokeReason,
          },
        });
      }

      const rateLimitBuckets = [
        { bucketKeyHash: bucketHashes[0], windowStartedAt: old, blockedUntil: new Date(now.getTime() - 1) },
        { bucketKeyHash: bucketHashes[1], windowStartedAt: new Date(now.getTime() - 16 * 60 * 1000), blockedUntil: null },
        { bucketKeyHash: bucketHashes[2], windowStartedAt: now, blockedUntil: future },
        { bucketKeyHash: bucketHashes[3], windowStartedAt: now, blockedUntil: null },
      ];
      for (const [index, bucket] of rateLimitBuckets.entries()) {
        await prisma.loginRateLimitBucket.create({
          data: {
            scope: index % 2 === 0 ? "IP" : "EMAIL_IP",
            bucketKeyHash: bucket.bucketKeyHash,
            windowStartedAt: bucket.windowStartedAt,
            failureCount: 1,
            blockedUntil: bucket.blockedUntil,
            updatedAt: now,
          },
        });
      }

      const first = await new MaintenanceService(prisma).run(now);
      expect(first).toEqual({ pendingAttachments: 0, idempotencyRecords: 0, sessions: 3, rateLimitBuckets: 2 });
      expect(await prisma.userSession.findUnique({ where: { id: sessionIds[3] } })).not.toBeNull();
      expect(await prisma.loginRateLimitBucket.count({ where: { bucketKeyHash: { in: [bucketHashes[2], bucketHashes[3]] } } })).toBe(2);

      const second = await new MaintenanceService(prisma).run(now);
      expect(second).toEqual({ pendingAttachments: 0, idempotencyRecords: 0, sessions: 0, rateLimitBuckets: 0 });
    } finally {
      await prisma.userSession.deleteMany({ where: { id: { in: sessionIds } } });
      await prisma.loginRateLimitBucket.deleteMany({ where: { bucketKeyHash: { in: bucketHashes } } });
    }
  });
});
