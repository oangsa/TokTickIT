import { vi } from "vitest";

/*
 * One Prisma double shared by the three Ticket-create API suites. It is a module
 * singleton so `vi.mock("../../src/prisma.js")` in each suite can resolve it
 * lazily and still see the same object the test body arranges.
 *
 * `$transaction` runs the callback against `tx` directly: there is no rollback
 * to simulate, so a suite that needs "nothing was mutated" asserts on the mock
 * calls rather than on committed state. The PostgreSQL suites cover real
 * atomicity.
 */
export const tx = {
  category: { findFirst: vi.fn() },
  relatedSystem: { findFirst: vi.fn() },
  attachment: { findMany: vi.fn(), updateMany: vi.fn() },
  ticket: { create: vi.fn() },
  idempotencyRecord: { update: vi.fn() },
  $queryRaw: vi.fn(),
  $executeRawUnsafe: vi.fn(),
};

export const prismaMock = {
  developmentRequester: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() },
  category: { findMany: vi.fn() },
  relatedSystem: { findMany: vi.fn() },
  ticket: { findUnique: vi.fn() },
  attachment: { findMany: vi.fn() },
  idempotencyRecord: {
    findUnique: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
};

export const ALICE = {
  id: 3,
  name: "Alice Johnson",
  email: "alice.johnson@example.com",
  isActive: true,
  deleted: false,
  createdBy: "seed",
  createdAt: new Date("2026-08-20T01:00:00.000Z"),
  updatedBy: "seed",
  updatedAt: new Date("2026-08-20T01:00:00.000Z"),
};

export const KEY = "550e8400-e29b-41d4-a716-446655440000";
export const OTHER_KEY = "8e294972-f950-4db7-a83e-d3bbd55a8799";
export const ATTACHMENT_A = "eb87467e-b209-4a18-bbc6-c8c5a4dccf95";
export const ATTACHMENT_B = "11111111-1111-4111-8111-111111111111";

export const VALID_BODY = {
  categoryId: 4,
  relatedSystemId: 5,
  summary: "Cannot connect to campus VPN",
  requestedPriority: "HIGH",
  description: "The VPN client fails after entering my credentials.",
};

const TICKET_AUDIT = {
  createdBy: "alice.johnson@example.com",
  createdAt: new Date("2026-08-20T08:14:32.000Z"),
  updatedBy: "alice.johnson@example.com",
  updatedAt: new Date("2026-08-20T08:14:32.000Z"),
};

export function ticketRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    publicId: "05a214b4-b957-4ed7-a58e-73f4392b35ec",
    ticketNumber: "TKT-20260820-A81F3C9D7B21",
    requesterId: 3,
    categoryId: 4,
    relatedSystemId: 5,
    summary: VALID_BODY.summary,
    requestedPriority: "HIGH",
    description: VALID_BODY.description,
    currentStatus: "NEW",
    deleted: false,
    ...TICKET_AUDIT,
    requester: { id: 3, name: ALICE.name, email: ALICE.email },
    category: { id: 4, name: "Network" },
    relatedSystem: { id: 5, name: "VPN" },
    attachments: [],
    ...overrides,
  };
}

/*
 * `createdAt` defaults to the real current time, not the fixed Ticket audit
 * date: the route validates the 24-hour Pending window against `new Date()`, so
 * a frozen fixture date would make every Attachment expired.
 */
export function attachmentRow(overrides: Record<string, unknown> = {}) {
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
    ...TICKET_AUDIT,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function processingRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    requesterId: 3,
    key: KEY,
    requestHash: "",
    status: "PROCESSING",
    processingStartedAt: new Date(),
    ticketId: null,
    completedAt: null,
    expiresAt: null,
    ...overrides,
  };
}

/*
 * The default arrangement: a valid Requester, active master rows, no existing
 * claim, and a Ticket that inserts cleanly. Each suite overrides only the one
 * thing it is testing.
 */
export function arrangeHappyPath(): void {
  vi.clearAllMocks();

  prismaMock.developmentRequester.findMany.mockResolvedValue([ALICE]);
  prismaMock.developmentRequester.findFirst.mockResolvedValue(ALICE);
  prismaMock.category.findMany.mockResolvedValue([]);
  prismaMock.relatedSystem.findMany.mockResolvedValue([]);
  prismaMock.ticket.findUnique.mockResolvedValue(ticketRow());
  prismaMock.idempotencyRecord.findUnique.mockResolvedValue(null);
  prismaMock.idempotencyRecord.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) =>
      processingRecord({ requestHash: data.requestHash, processingStartedAt: data.processingStartedAt }),
  );
  prismaMock.idempotencyRecord.updateMany.mockResolvedValue({ count: 0 });
  prismaMock.idempotencyRecord.deleteMany.mockResolvedValue({ count: 1 });
  prismaMock.$transaction.mockImplementation(
    async (callback: (client: typeof tx) => unknown) => callback(tx),
  );

  tx.category.findFirst.mockResolvedValue({ id: 4, name: "Network" });
  tx.relatedSystem.findFirst.mockResolvedValue({ id: 5, name: "VPN" });
  tx.attachment.findMany.mockResolvedValue([]);
  /*
   * The binding UPDATE is guarded by `ticketId: null`, so the service compares
   * the affected count against the rows it read. The default reports every
   * targeted row as still Pending; a suite testing a lost binding race
   * overrides it with a lower count.
   */
  tx.attachment.updateMany.mockImplementation(
    async ({ where }: { where: { id: { in: number[] } } }) => ({ count: where.id.in.length }),
  );
  tx.ticket.create.mockResolvedValue(ticketRow());
  tx.idempotencyRecord.update.mockResolvedValue({});
  /* SAVEPOINT / RELEASE / ROLLBACK TO around each Ticket Number attempt. */
  tx.$executeRawUnsafe.mockResolvedValue(0);
  /* The fencing SELECT ... FOR UPDATE finds the owner's row. */
  tx.$queryRaw.mockResolvedValue([{ id: 7 }]);
}
