import { beforeEach, describe, expect, it, vi } from "vitest";

import { IdempotencyService } from "../../src/services/idempotencyService.js";
import {
  FencedOutError,
  TICKET_NUMBER_ATTEMPTS,
  TicketService,
  toTicketDTO,
} from "../../src/services/ticketService.js";
import { TICKET_NUMBER_PATTERN } from "../../src/services/ticketNumber.js";

const NOW = new Date("2026-08-20T08:14:32.000Z");
const STARTED = new Date("2026-08-20T08:14:30.000Z");
const KEY = "550e8400-e29b-41d4-a716-446655440000";
const HASH = "a".repeat(64);
const ATTACHMENT_A = "eb87467e-b209-4a18-bbc6-c8c5a4dccf95";
const ATTACHMENT_B = "11111111-1111-4111-8111-111111111111";

const SEED_AUDIT = {
  createdBy: "alice.johnson@example.com",
  createdAt: NOW,
  updatedBy: "alice.johnson@example.com",
  updatedAt: NOW,
};

function pendingAttachment(overrides: Record<string, unknown> = {}) {
  return {
    id: 11,
    storageKey: ATTACHMENT_A,
    ticketId: null,
    uploadedByRequesterId: 3,
    originalName: "vpn-error.png",
    extension: "png",
    mimeType: "image/png",
    sizeBytes: 281304,
    removalReason: null,
    deleted: false,
    ...SEED_AUDIT,
    ...overrides,
  };
}

function ticketRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    publicId: "05a214b4-b957-4ed7-a58e-73f4392b35ec",
    ticketNumber: "TKT-20260820-A81F3C9D7B21",
    requesterId: 3,
    categoryId: 4,
    relatedSystemId: 5,
    summary: "Cannot connect to campus VPN",
    requestedPriority: "HIGH",
    description: "The VPN client fails after entering my credentials.",
    currentStatus: "NEW",
    deleted: false,
    ...SEED_AUDIT,
    requester: { id: 3, name: "Alice Johnson", email: "alice.johnson@example.com" },
    category: { id: 4, name: "Network" },
    relatedSystem: { id: 5, name: "VPN" },
    attachments: [],
    ...overrides,
  };
}

const tx = {
  category: { findFirst: vi.fn() },
  relatedSystem: { findFirst: vi.fn() },
  attachment: { findMany: vi.fn(), updateMany: vi.fn() },
  ticket: { create: vi.fn() },
  idempotencyRecord: { update: vi.fn() },
  $queryRaw: vi.fn(),
};

const prismaMock = {
  $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  ticket: { findUnique: vi.fn() },
};

let idempotency: IdempotencyService;
let service: TicketService;

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    requesterId: 3,
    actor: "alice.johnson@example.com",
    key: KEY,
    requestHash: HASH,
    recordId: 7,
    processingStartedAt: STARTED,
    now: NOW,
    payload: {
      categoryId: 4,
      relatedSystemId: 5,
      summary: "Cannot connect to campus VPN",
      requestedPriority: "HIGH" as const,
      description: "The VPN client fails after entering my credentials.",
      attachmentIds: [],
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) =>
    callback(tx),
  );
  idempotency = new IdempotencyService(prismaMock as never);
  vi.spyOn(idempotency, "lockAndVerify").mockResolvedValue(true);
  service = new TicketService(prismaMock as never, idempotency);

  tx.category.findFirst.mockResolvedValue({ id: 4, name: "Network" });
  tx.relatedSystem.findFirst.mockResolvedValue({ id: 5, name: "VPN" });
  tx.attachment.findMany.mockResolvedValue([]);
  tx.attachment.updateMany.mockResolvedValue({ count: 0 });
  tx.ticket.create.mockResolvedValue(ticketRow());
  tx.idempotencyRecord.update.mockResolvedValue({});
  prismaMock.ticket.findUnique.mockResolvedValue(ticketRow());
});

// UNIT-05 / UNIT-15 (FR-07-12, BR-01-25, BR-52, AC-06-12, AC-43-45).
describe("TicketService.create", () => {
  it("derives every backend-managed field the client may not send", async () => {
    await service.create(baseInput());

    const { data } = tx.ticket.create.mock.calls[0][0];
    expect(data.requesterId).toBe(3);
    expect(data.currentStatus).toBe("NEW");
    expect(data.deleted).toBe(false);
    expect(data.createdBy).toBe("alice.johnson@example.com");
    expect(data.updatedBy).toBe("alice.johnson@example.com");
    expect(data.publicId).toMatch(/^[0-9a-f-]{36}$/);
    expect(data.ticketNumber).toMatch(TICKET_NUMBER_PATTERN);
  });

  it("returns the full TicketDTO reconstructed from committed state", async () => {
    const dto = await service.create(baseInput());

    expect(dto.publicId).toBe("05a214b4-b957-4ed7-a58e-73f4392b35ec");
    expect(dto.ticketNumber).toBe("TKT-20260820-A81F3C9D7B21");
    expect(dto.requesterName).toBe("Alice Johnson");
    expect(dto.categoryName).toBe("Network");
    expect(dto.relatedSystemName).toBe("VPN");
    expect(dto.currentStatus).toBe("NEW");
    expect(dto.attachments).toEqual([]);
  });

  it("runs fencing before any mutable validation or mutation", async () => {
    vi.mocked(idempotency.lockAndVerify).mockResolvedValue(false);

    await expect(service.create(baseInput())).rejects.toBeInstanceOf(FencedOutError);
    expect(tx.category.findFirst).not.toHaveBeenCalled();
    expect(tx.ticket.create).not.toHaveBeenCalled();
    expect(tx.attachment.updateMany).not.toHaveBeenCalled();
    expect(tx.idempotencyRecord.update).not.toHaveBeenCalled();
  });

  it("passes the exact retained ownership values to the fencing check", async () => {
    await service.create(baseInput());

    expect(idempotency.lockAndVerify).toHaveBeenCalledWith(tx, {
      requesterId: 3,
      key: KEY,
      requestHash: HASH,
      processingStartedAt: STARTED,
    });
  });

  it("creates the Ticket, binds Attachments, and completes the claim in one transaction", async () => {
    tx.attachment.findMany.mockResolvedValue([
      pendingAttachment({ id: 11, storageKey: ATTACHMENT_A }),
      pendingAttachment({ id: 12, storageKey: ATTACHMENT_B }),
    ]);

    await service.create(
      baseInput({
        payload: { ...baseInput().payload, attachmentIds: [ATTACHMENT_A, ATTACHMENT_B] },
      }),
    );

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.attachment.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [11, 12] } },
      data: { ticketId: 42, updatedBy: "alice.johnson@example.com" },
    });
    expect(tx.idempotencyRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 7 } }),
    );
  });

  it("does not touch Attachments when none are referenced", async () => {
    await service.create(baseInput());

    expect(tx.attachment.findMany).not.toHaveBeenCalled();
    expect(tx.attachment.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a Category that is no longer active at commit time", async () => {
    tx.category.findFirst.mockResolvedValue(null);

    await expect(service.create(baseInput())).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      details: [{ field: "categoryId", message: expect.any(String) }],
    });
    expect(tx.ticket.create).not.toHaveBeenCalled();
  });

  it("rejects a Related System that is no longer active at commit time", async () => {
    tx.relatedSystem.findFirst.mockResolvedValue(null);

    await expect(service.create(baseInput())).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      details: [{ field: "relatedSystemId", message: expect.any(String) }],
    });
  });

  it("asks only for active, non-deleted master rows", async () => {
    await service.create(baseInput());

    expect(tx.category.findFirst).toHaveBeenCalledWith({
      where: { id: 4, deleted: false, isActive: true },
    });
    expect(tx.relatedSystem.findFirst).toHaveBeenCalledWith({
      where: { id: 5, deleted: false, isActive: true },
    });
  });

  it("returns the same safe 404 for a missing or cross-scope Attachment", async () => {
    tx.attachment.findMany.mockResolvedValue([]);

    await expect(
      service.create(
        baseInput({ payload: { ...baseInput().payload, attachmentIds: [ATTACHMENT_A] } }),
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(tx.ticket.create).not.toHaveBeenCalled();
  });

  it("scopes the Attachment lookup to the current Requester", async () => {
    tx.attachment.findMany.mockResolvedValue([pendingAttachment()]);

    await service.create(
      baseInput({ payload: { ...baseInput().payload, attachmentIds: [ATTACHMENT_A] } }),
    );

    expect(tx.attachment.findMany).toHaveBeenCalledWith({
      where: { storageKey: { in: [ATTACHMENT_A] }, uploadedByRequesterId: 3 },
      orderBy: { id: "asc" },
    });
  });

  it.each([
    ["already bound", { ticketId: 99 }],
    ["logically deleted", { deleted: true }],
    ["expired past its 24-hour Pending window", { createdAt: new Date(NOW.getTime() - 86_400_001) }],
  ])("conflicts on an owned Attachment that is %s", async (_label, overrides) => {
    tx.attachment.findMany.mockResolvedValue([pendingAttachment(overrides)]);

    await expect(
      service.create(
        baseInput({ payload: { ...baseInput().payload, attachmentIds: [ATTACHMENT_A] } }),
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(tx.ticket.create).not.toHaveBeenCalled();
  });

  it("accepts an Attachment one millisecond inside its Pending window", async () => {
    tx.attachment.findMany.mockResolvedValue([
      pendingAttachment({ createdAt: new Date(NOW.getTime() - 86_399_999) }),
    ]);

    await expect(
      service.create(
        baseInput({ payload: { ...baseInput().payload, attachmentIds: [ATTACHMENT_A] } }),
      ),
    ).resolves.toBeDefined();
  });

  it("retries a Ticket Number collision within the bounded attempt limit", async () => {
    const collision = Object.assign(new Error(), {
      code: "P2002",
      meta: { target: ["ticket_number"] },
    });
    tx.ticket.create.mockRejectedValueOnce(collision).mockResolvedValueOnce(ticketRow());

    await expect(service.create(baseInput())).resolves.toBeDefined();
    expect(tx.ticket.create).toHaveBeenCalledTimes(2);
  });

  it("gives up after three attempts rather than retrying forever", async () => {
    const collision = Object.assign(new Error(), {
      code: "P2002",
      meta: { target: ["ticket_number"] },
    });
    tx.ticket.create.mockRejectedValue(collision);

    await expect(service.create(baseInput())).rejects.toBe(collision);
    expect(TICKET_NUMBER_ATTEMPTS).toBe(3);
    expect(tx.ticket.create).toHaveBeenCalledTimes(3);
  });

  it("does not retry a unique violation on another column", async () => {
    const other = Object.assign(new Error(), { code: "P2002", meta: { target: ["public_id"] } });
    tx.ticket.create.mockRejectedValue(other);

    await expect(service.create(baseInput())).rejects.toBe(other);
    expect(tx.ticket.create).toHaveBeenCalledTimes(1);
  });
});

describe("toTicketDTO", () => {
  it("exposes the storage key as attachmentId and never the row id", () => {
    const dto = toTicketDTO(
      ticketRow({ attachments: [pendingAttachment({ ticketId: 42 })] }) as never,
    );

    expect(dto.attachments[0].attachmentId).toBe(ATTACHMENT_A);
    expect(dto.attachments[0]).not.toHaveProperty("id");
    expect(dto.attachments[0]).not.toHaveProperty("storageKey");
    expect(dto.attachments[0]).not.toHaveProperty("data");
  });

  it("reports a bound Attachment against its owning Ticket publicId", () => {
    const dto = toTicketDTO(
      ticketRow({ attachments: [pendingAttachment({ ticketId: 42 })] }) as never,
    );

    expect(dto.attachments[0].ticketPublicId).toBe("05a214b4-b957-4ed7-a58e-73f4392b35ec");
  });

  it("reports an unbound Attachment as ticketPublicId null", () => {
    const dto = toTicketDTO(ticketRow({ attachments: [pendingAttachment()] }) as never);

    expect(dto.attachments[0].ticketPublicId).toBeNull();
  });

  it("serializes timestamps as ISO-8601 UTC strings and omits the row id", () => {
    const dto = toTicketDTO(ticketRow() as never);

    expect(dto.createdAt).toBe("2026-08-20T08:14:32.000Z");
    expect(dto.updatedAt).toBe("2026-08-20T08:14:32.000Z");
    expect(dto).not.toHaveProperty("id");
    expect(dto).not.toHaveProperty("ticketDate");
  });

  it("keeps historical Category and Related System names", () => {
    const dto = toTicketDTO(
      ticketRow({ category: { id: 4, name: "Retired Network" } }) as never,
    );

    expect(dto.categoryName).toBe("Retired Network");
  });
});
