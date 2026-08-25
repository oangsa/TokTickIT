import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  COMPLETED_RETENTION_HOURS,
  IdempotencyService,
  PROCESSING_LEASE_SECONDS,
  isFresh,
  staleCutoff,
} from "../../src/services/idempotencyService.js";
import {
  hashCreateTicketPayload,
  parseCreateTicketRequest,
} from "../../src/services/ticketCreateRequest.js";

const prismaMock = {
  idempotencyRecord: {
    findUnique: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
    update: vi.fn(),
  },
};

const service = new IdempotencyService(prismaMock as never);

const KEY = "550e8400-e29b-41d4-a716-446655440000";
const HASH = "a".repeat(64);
const OTHER_HASH = "b".repeat(64);
const NOW = new Date("2026-08-20T08:00:00.000Z");
const STARTED = new Date("2026-08-20T07:55:00.000Z");

const INPUT = { requesterId: 3, key: KEY, requestHash: HASH, actor: "alice@example.com", now: NOW };

function processingRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    requesterId: 3,
    key: KEY,
    requestHash: HASH,
    status: "PROCESSING",
    processingStartedAt: STARTED,
    ticketId: null,
    completedAt: null,
    expiresAt: null,
    ...overrides,
  };
}

function completedRecord(overrides: Record<string, unknown> = {}) {
  return processingRecord({
    status: "COMPLETED",
    ticketId: 42,
    completedAt: new Date("2026-08-20T07:00:00.000Z"),
    expiresAt: new Date("2026-08-21T07:00:00.000Z"),
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// UNIT-10 (BR-18-24, AC-11-12, AC-42-43, AC-51-52, AC-65).
describe("canonical request hashing", () => {
  function hashOf(body: Record<string, unknown>): string {
    return parseCreateTicketRequest({
      categoryId: 4,
      relatedSystemId: 5,
      summary: "Cannot connect to campus VPN",
      requestedPriority: "HIGH",
      description: "The VPN client fails after entering my credentials.",
      ...body,
    }).requestHash;
  }

  const A = "00000000-0000-4000-8000-000000000000";
  const B = "f0f0f0f0-f0f0-4f0f-b0f0-f0f0f0f0f0f0";
  const C = "11111111-1111-4111-8111-111111111111";

  it("produces exactly 64 lowercase hexadecimal characters", () => {
    expect(hashOf({})).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for the same logical payload", () => {
    expect(hashOf({})).toBe(hashOf({}));
  });

  it("does not depend on the key order of the incoming JSON", () => {
    const forward = parseCreateTicketRequest({
      categoryId: 4,
      relatedSystemId: 5,
      summary: "Cannot connect to campus VPN",
      requestedPriority: "HIGH",
      description: "The VPN client fails after entering my credentials.",
    }).requestHash;
    const reversed = parseCreateTicketRequest({
      description: "The VPN client fails after entering my credentials.",
      requestedPriority: "HIGH",
      summary: "Cannot connect to campus VPN",
      relatedSystemId: 5,
      categoryId: 4,
    }).requestHash;

    expect(forward).toBe(reversed);
  });

  it("treats [A,B] and [B,A] as the same logical set", () => {
    expect(hashOf({ attachmentIds: [A, B] })).toBe(hashOf({ attachmentIds: [B, A] }));
  });

  it("treats [A,B] and [A,C] as different", () => {
    expect(hashOf({ attachmentIds: [A, B] })).not.toBe(hashOf({ attachmentIds: [A, C] }));
  });

  it("sorts lexicographically by the canonical lowercase string", () => {
    const { payload } = parseCreateTicketRequest({
      categoryId: 4,
      relatedSystemId: 5,
      summary: "Cannot connect to campus VPN",
      requestedPriority: "HIGH",
      description: "The VPN client fails after entering my credentials.",
      attachmentIds: [B, A],
    });

    expect(payload.attachmentIds).toEqual([A, B]);
  });

  it("normalizes uppercase UUIDs to canonical lowercase before hashing", () => {
    expect(hashOf({ attachmentIds: [A.toUpperCase()] })).toBe(hashOf({ attachmentIds: [A] }));
  });

  it("treats an omitted and an empty attachmentIds as the same", () => {
    expect(hashOf({})).toBe(hashOf({ attachmentIds: [] }));
  });

  it("rejects duplicates instead of silently deduplicating", () => {
    expect(() => hashOf({ attachmentIds: [A, A] })).toThrowError(
      expect.objectContaining({ code: "VALIDATION_ERROR" }),
    );
  });

  it("hashes the trimmed Summary and Description", () => {
    expect(hashOf({ summary: "  Cannot connect to campus VPN  " })).toBe(hashOf({}));
  });

  it("changes when a logical field changes", () => {
    expect(hashOf({ requestedPriority: "LOW" })).not.toBe(hashOf({}));
    expect(hashOf({ categoryId: 9 })).not.toBe(hashOf({}));
  });

  it("hashes a payload object directly to the same value", () => {
    const { payload, requestHash } = parseCreateTicketRequest({
      categoryId: 4,
      relatedSystemId: 5,
      summary: "Cannot connect to campus VPN",
      requestedPriority: "HIGH",
      description: "The VPN client fails after entering my credentials.",
    });

    expect(hashCreateTicketPayload(payload)).toBe(requestHash);
  });
});

describe("PROCESSING lease boundary", () => {
  it("uses PROCESSING_LEASE_SECONDS = 300", () => {
    expect(PROCESSING_LEASE_SECONDS).toBe(300);
    expect(staleCutoff(STARTED).toISOString()).toBe("2026-08-20T08:00:00.000Z");
  });

  it("treats 4m 59.999s as fresh and exactly 5m 00.000s as stale", () => {
    expect(isFresh(STARTED, new Date(STARTED.getTime() + 299_999))).toBe(true);
    expect(isFresh(STARTED, new Date(STARTED.getTime() + 300_000))).toBe(false);
    expect(isFresh(STARTED, new Date(STARTED.getTime() + 300_001))).toBe(false);
  });
});

describe("claim resolution", () => {
  it("establishes a PROCESSING claim when none exists", async () => {
    prismaMock.idempotencyRecord.findUnique.mockResolvedValue(null);
    prismaMock.idempotencyRecord.create.mockResolvedValue(
      processingRecord({ processingStartedAt: NOW }),
    );

    const resolution = await service.resolve(INPUT);

    expect(resolution).toEqual({ kind: "OWNED", recordId: 7, processingStartedAt: NOW });
    expect(prismaMock.idempotencyRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        requesterId: 3,
        key: KEY,
        requestHash: HASH,
        status: "PROCESSING",
        processingStartedAt: NOW,
      }),
    });
  });

  it("never sets ticketId, completedAt, or expiresAt on a new claim", async () => {
    prismaMock.idempotencyRecord.findUnique.mockResolvedValue(null);
    prismaMock.idempotencyRecord.create.mockResolvedValue(processingRecord());

    await service.resolve(INPUT);

    const { data } = prismaMock.idempotencyRecord.create.mock.calls[0][0];
    expect(data.ticketId).toBeUndefined();
    expect(data.completedAt).toBeUndefined();
    expect(data.expiresAt).toBeUndefined();
  });

  it("refetches when a concurrent insert wins the unique race", async () => {
    prismaMock.idempotencyRecord.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(completedRecord());
    prismaMock.idempotencyRecord.create.mockRejectedValue(Object.assign(new Error(), { code: "P2002" }));

    const resolution = await service.resolve(INPUT);

    expect(resolution).toEqual({ kind: "REPLAY", ticketId: 42 });
  });

  it("waits on a fresh same-hash PROCESSING claim", async () => {
    prismaMock.idempotencyRecord.findUnique.mockResolvedValue(
      processingRecord({ processingStartedAt: new Date(NOW.getTime() - 299_999) }),
    );

    expect(await service.resolve(INPUT)).toEqual({ kind: "WAIT" });
    expect(prismaMock.idempotencyRecord.updateMany).not.toHaveBeenCalled();
  });

  it("conflicts on a fresh different-hash PROCESSING claim without waiting", async () => {
    prismaMock.idempotencyRecord.findUnique.mockResolvedValue(
      processingRecord({ requestHash: OTHER_HASH, processingStartedAt: NOW }),
    );

    expect(await service.resolve(INPUT)).toEqual({ kind: "CONFLICT" });
  });

  it("atomically reclaims a stale same-hash claim and resets processingStartedAt", async () => {
    prismaMock.idempotencyRecord.findUnique
      .mockResolvedValueOnce(processingRecord())
      .mockResolvedValueOnce(processingRecord({ processingStartedAt: NOW }));
    prismaMock.idempotencyRecord.updateMany.mockResolvedValue({ count: 1 });

    const resolution = await service.resolve(INPUT);

    expect(resolution).toEqual({ kind: "OWNED", recordId: 7, processingStartedAt: NOW });
    expect(prismaMock.idempotencyRecord.updateMany).toHaveBeenCalledWith({
      where: {
        requesterId: 3,
        key: KEY,
        status: "PROCESSING",
        requestHash: HASH,
        processingStartedAt: { lte: new Date(NOW.getTime() - 300_000) },
      },
      data: { processingStartedAt: NOW, updatedBy: "alice@example.com" },
    });
  });

  it("conflicts on a stale different-hash claim and never deletes it", async () => {
    prismaMock.idempotencyRecord.findUnique.mockResolvedValue(
      processingRecord({ requestHash: OTHER_HASH }),
    );

    expect(await service.resolve(INPUT)).toEqual({ kind: "CONFLICT" });
    expect(prismaMock.idempotencyRecord.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.idempotencyRecord.updateMany).not.toHaveBeenCalled();
  });

  it("sends a losing reclaimer back to wait or replay", async () => {
    prismaMock.idempotencyRecord.findUnique
      .mockResolvedValueOnce(processingRecord())
      .mockResolvedValueOnce(processingRecord({ processingStartedAt: NOW }));
    prismaMock.idempotencyRecord.updateMany.mockResolvedValue({ count: 0 });

    // The winner already reset the lease, so the refetched claim is fresh again.
    expect(await service.resolve(INPUT)).toEqual({ kind: "WAIT" });
  });

  it("replays a completed same-hash claim before its logical expiry", async () => {
    prismaMock.idempotencyRecord.findUnique.mockResolvedValue(completedRecord());

    expect(await service.resolve(INPUT)).toEqual({ kind: "REPLAY", ticketId: 42 });
  });

  it("conflicts on a completed different-hash claim", async () => {
    prismaMock.idempotencyRecord.findUnique.mockResolvedValue(
      completedRecord({ requestHash: OTHER_HASH }),
    );

    expect(await service.resolve(INPUT)).toEqual({ kind: "CONFLICT" });
  });

  it("treats now == expiresAt as expired and re-establishes the claim", async () => {
    prismaMock.idempotencyRecord.findUnique
      .mockResolvedValueOnce(completedRecord({ expiresAt: NOW }))
      .mockResolvedValueOnce(null);
    prismaMock.idempotencyRecord.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.idempotencyRecord.create.mockResolvedValue(
      processingRecord({ processingStartedAt: NOW }),
    );

    const resolution = await service.resolve(INPUT);

    expect(resolution).toEqual({ kind: "OWNED", recordId: 7, processingStartedAt: NOW });
    expect(prismaMock.idempotencyRecord.deleteMany).toHaveBeenCalledWith({
      where: { id: 7, status: "COMPLETED", expiresAt: { lte: NOW } },
    });
  });

  it("still replays one millisecond before expiry", async () => {
    prismaMock.idempotencyRecord.findUnique.mockResolvedValue(
      completedRecord({ expiresAt: new Date(NOW.getTime() + 1) }),
    );

    expect(await service.resolve(INPUT)).toEqual({ kind: "REPLAY", ticketId: 42 });
    expect(prismaMock.idempotencyRecord.deleteMany).not.toHaveBeenCalled();
  });

  it("scopes the claim to the Requester as well as the key", async () => {
    prismaMock.idempotencyRecord.findUnique.mockResolvedValue(null);
    prismaMock.idempotencyRecord.create.mockResolvedValue(processingRecord());

    await service.resolve({ ...INPUT, requesterId: 4 });

    expect(prismaMock.idempotencyRecord.findUnique).toHaveBeenCalledWith({
      where: { requesterId_key: { requesterId: 4, key: KEY } },
    });
  });
});

describe("IDEMPOTENCY-FENCING-A", () => {
  const fencing = { requesterId: 3, key: KEY, requestHash: HASH, processingStartedAt: STARTED };

  it("passes when status, hash, and exact lease all match", async () => {
    const tx = { $queryRaw: vi.fn().mockResolvedValue([{ id: 7 }]) };

    expect(await service.lockAndVerify(tx as never, fencing)).toBe(true);
  });

  it("fails when the row no longer matches, which fences out an old owner", async () => {
    const tx = { $queryRaw: vi.fn().mockResolvedValue([]) };

    expect(await service.lockAndVerify(tx as never, fencing)).toBe(false);
  });

  it("locks the row with FOR UPDATE and binds all three ownership values", async () => {
    const tx = { $queryRaw: vi.fn().mockResolvedValue([{ id: 7 }]) };

    await service.lockAndVerify(tx as never, fencing);

    const [strings, ...values] = tx.$queryRaw.mock.calls[0];
    expect(strings.join("?")).toContain("FOR UPDATE");
    expect(values).toEqual([3, KEY, HASH, STARTED]);
  });
});

describe("completion and release", () => {
  it("sets expiresAt to completedAt plus 24 hours", async () => {
    const tx = { idempotencyRecord: { update: vi.fn().mockResolvedValue({}) } };

    await service.complete(tx as never, {
      recordId: 7,
      ticketId: 42,
      now: NOW,
      actor: "alice@example.com",
    });

    expect(COMPLETED_RETENTION_HOURS).toBe(24);
    expect(tx.idempotencyRecord.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: {
        status: "COMPLETED",
        ticketId: 42,
        completedAt: NOW,
        expiresAt: new Date("2026-08-21T08:00:00.000Z"),
        updatedBy: "alice@example.com",
      },
    });
  });

  it("removes only its own PROCESSING claim rather than storing FAILED", async () => {
    prismaMock.idempotencyRecord.deleteMany.mockResolvedValue({ count: 1 });

    await service.release({ requesterId: 3, key: KEY, processingStartedAt: STARTED });

    // The processingStartedAt predicate is what stops an old owner from
    // deleting a claim a stale retry has already reclaimed.
    expect(prismaMock.idempotencyRecord.deleteMany).toHaveBeenCalledWith({
      where: { requesterId: 3, key: KEY, status: "PROCESSING", processingStartedAt: STARTED },
    });
  });
});
