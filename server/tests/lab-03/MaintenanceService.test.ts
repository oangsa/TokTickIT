import { describe, expect, it } from "vitest";

import { MaintenanceService } from "../../src/services/maintenanceService.js";

interface MaintenanceFakePrisma {
  userSession: { deleteMany: () => Promise<{ count: number }> };
  loginRateLimitBucket: { deleteMany: () => Promise<{ count: number }> };
  attachment: { deleteMany: () => Promise<{ count: number }> };
  idempotencyRecord: { deleteMany: () => Promise<{ count: number }> };
  $transaction: <T>(callback: (tx: MaintenanceFakePrisma) => Promise<T>) => Promise<T>;
  $queryRaw: () => Promise<unknown[]>;
}

describe("MaintenanceService @issue-2", () => {
  it("deletes expired technical state through repeatable service methods", async () => {
    const calls: string[] = [];
    let queryIndex = 0;
    const prisma: MaintenanceFakePrisma = {
      userSession: { deleteMany: async () => { calls.push("sessions"); return { count: 2 }; } },
      loginRateLimitBucket: { deleteMany: async () => { calls.push("rate-limits"); return { count: 3 }; } },
      attachment: { deleteMany: async () => ({ count: 0 }) },
      idempotencyRecord: { deleteMany: async () => ({ count: 0 }) },
      $transaction: async <T>(callback: (tx: MaintenanceFakePrisma) => Promise<T>) => callback(prisma),
      $queryRaw: async () => {
        const batches = [[{ id: "session-1" }], [], [{ id: 1 }], []];
        return batches[queryIndex++] ?? [];
      },
    };
    const service = new MaintenanceService(prisma as never);
    expect(await service.cleanupExpiredSessions(new Date())).toBe(2);
    expect(await service.cleanupExpiredRateLimitBuckets(new Date())).toBe(3);
    expect(calls).toEqual(["sessions", "rate-limits"]);
  });
});
