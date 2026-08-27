import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { CLEANUP_BATCH_SIZE, MaintenanceService } from "../../src/services/maintenanceService.js";
import { PENDING_ATTACHMENT_TTL_HOURS } from "../../src/services/ticketService.js";

/*
 * UNIT-16. The orchestration is what is under test here: one captured cutoff,
 * bounded batches, repeat-until-empty, and the rows the job is allowed to touch.
 * That `FOR UPDATE SKIP LOCKED` genuinely skips a locked row is a claim about
 * PostgreSQL, so it is proved in `maintenance.postgres.test.ts` instead.
 */

const NOW = new Date("2026-08-26T12:00:00.000Z");

const tx = {
  attachment: { deleteMany: vi.fn() },
  idempotencyRecord: { deleteMany: vi.fn() },
  $queryRaw: vi.fn(),
};

const prisma = { $transaction: vi.fn() };

function service(): MaintenanceService {
  return new MaintenanceService(prisma as unknown as PrismaClient);
}

/* The tagged template arrives as (strings, ...values); this reassembles it. */
function queryText(call: unknown[]): string {
  return (call[0] as unknown as string[]).join(" ? ");
}

function queryParams(call: unknown[]): unknown[] {
  return call.slice(1);
}

function rows(count: number): { id: number }[] {
  return Array.from({ length: count }, (_unused, index) => ({ id: index + 1 }));
}

beforeEach(() => {
  vi.clearAllMocks();
  prisma.$transaction.mockImplementation(async (work: (client: typeof tx) => unknown) => work(tx));
  tx.$queryRaw.mockResolvedValue([]);
  tx.attachment.deleteMany.mockResolvedValue({ count: 0 });
  tx.idempotencyRecord.deleteMany.mockResolvedValue({ count: 0 });
});

describe("UNIT-16 expired Pending Attachment cleanup", () => {
  it("selects only unbound, non-removed rows older than the 24-hour cutoff", async () => {
    await service().cleanupExpiredPendingAttachments(NOW);

    const [call] = tx.$queryRaw.mock.calls;
    const text = queryText(call);

    expect(text).toContain("FROM attachment");
    expect(text).toContain("ticket_id IS NULL");
    expect(text).toContain("deleted = false");
    expect(text).toContain("FOR UPDATE SKIP LOCKED");

    const cutoff = queryParams(call)[0] as Date;
    expect(cutoff.getTime()).toBe(
      NOW.getTime() - PENDING_ATTACHMENT_TTL_HOURS * 60 * 60 * 1000,
    );
  });

  it("bounds each batch to 100 rows", async () => {
    await service().cleanupExpiredPendingAttachments(NOW);

    expect(CLEANUP_BATCH_SIZE).toBe(100);
    expect(queryParams(tx.$queryRaw.mock.calls[0])).toContain(CLEANUP_BATCH_SIZE);
  });

  it("repeats full batches until one comes back empty, reusing the same cutoff", async () => {
    tx.$queryRaw
      .mockResolvedValueOnce(rows(CLEANUP_BATCH_SIZE))
      .mockResolvedValueOnce(rows(7))
      .mockResolvedValueOnce([]);
    tx.attachment.deleteMany
      .mockResolvedValueOnce({ count: CLEANUP_BATCH_SIZE })
      .mockResolvedValueOnce({ count: 7 });

    const removed = await service().cleanupExpiredPendingAttachments(NOW);

    expect(removed).toBe(CLEANUP_BATCH_SIZE + 7);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(3);
    /* Each batch is its own transaction, so a long backlog holds no long lock. */
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);

    const cutoffs = tx.$queryRaw.mock.calls.map((call) => (queryParams(call)[0] as Date).getTime());
    expect(new Set(cutoffs).size).toBe(1);
  });

  it("repeats the lifecycle guard on the delete, not only on the selection", async () => {
    tx.$queryRaw.mockResolvedValueOnce(rows(2)).mockResolvedValueOnce([]);
    tx.attachment.deleteMany.mockResolvedValueOnce({ count: 2 });

    await service().cleanupExpiredPendingAttachments(NOW);

    expect(tx.attachment.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: [1, 2] }, ticketId: null, deleted: false },
    });
  });

  it("does nothing and reports nothing when there is no expired row", async () => {
    expect(await service().cleanupExpiredPendingAttachments(NOW)).toBe(0);
    expect(tx.attachment.deleteMany).not.toHaveBeenCalled();
  });
});

describe("UNIT-16 expired Idempotency Record cleanup", () => {
  it("selects only COMPLETED records at or past their logical expiry", async () => {
    await service().cleanupExpiredIdempotencyRecords(NOW);

    const [call] = tx.$queryRaw.mock.calls;
    const text = queryText(call);

    expect(text).toContain("FROM idempotency_record");
    expect(text).toContain("status = 'COMPLETED'");
    expect(text).toContain("expires_at <=");
    expect(text).toContain("FOR UPDATE SKIP LOCKED");
    expect(queryParams(call)[0]).toBe(NOW);
  });

  it("never selects, deletes, or reclaims a PROCESSING record", async () => {
    await service().run(NOW);

    for (const call of tx.$queryRaw.mock.calls) {
      expect(queryText(call)).not.toContain("PROCESSING");
    }

    for (const call of tx.idempotencyRecord.deleteMany.mock.calls) {
      expect(call[0].where.status).toBe("COMPLETED");
    }
  });

  it("treats a record expiring exactly now as eligible", async () => {
    tx.$queryRaw.mockResolvedValueOnce(rows(1)).mockResolvedValueOnce([]);
    tx.idempotencyRecord.deleteMany.mockResolvedValueOnce({ count: 1 });

    await service().cleanupExpiredIdempotencyRecords(NOW);

    expect(tx.idempotencyRecord.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: [1] }, status: "COMPLETED", expiresAt: { lte: NOW } },
    });
  });
});

describe("UNIT-16 run orchestration", () => {
  it("reports both counts and stays idempotent on a second run", async () => {
    tx.$queryRaw
      .mockResolvedValueOnce(rows(3))
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(rows(2))
      .mockResolvedValueOnce([]);
    tx.attachment.deleteMany.mockResolvedValueOnce({ count: 3 });
    tx.idempotencyRecord.deleteMany.mockResolvedValueOnce({ count: 2 });

    expect(await service().run(NOW)).toEqual({ pendingAttachments: 3, idempotencyRecords: 2 });

    vi.clearAllMocks();
    prisma.$transaction.mockImplementation(async (work: (client: typeof tx) => unknown) =>
      work(tx),
    );
    tx.$queryRaw.mockResolvedValue([]);

    expect(await service().run(NOW)).toEqual({ pendingAttachments: 0, idempotencyRecords: 0 });
  });
});
