import { beforeEach, describe, expect, it, vi } from "vitest";

import { findTicketForRequester } from "../../src/services/ticketService.js";

const PUBLIC_ID = "05a214b4-b957-4ed7-a58e-73f4392b35ec";

function ticketRow(overrides: Record<string, unknown> = {}) {
  const now = new Date("2026-09-14T00:00:00.000Z");
  return {
    id: 42,
    publicId: PUBLIC_ID,
    ticketNumber: "TKT-20260914-A81F3C9D7B21",
    requesterId: 3,
    categoryId: 4,
    relatedSystemId: 5,
    summary: "VPN access",
    requestedPriority: "HIGH",
    itPriority: "HIGH",
    description: "The VPN client fails after sign-in.",
    currentStatus: "NEW",
    requesterResolutionConfirmedAt: null,
    ownerUserId: null,
    deleted: false,
    createdBy: "alice@example.test",
    createdAt: now,
    updatedBy: "alice@example.test",
    updatedAt: now,
    requester: { id: 3, publicId: "70000000-0000-4000-8000-000000000003", name: "Alice", email: "alice@example.test" },
    owner: null,
    category: { id: 4, name: "Network" },
    relatedSystem: { id: 5, name: "VPN" },
    attachments: [],
    ...overrides,
  };
}

describe("authenticated Requester resource boundary", () => {
  const prisma = { ticket: { findFirst: vi.fn() } };

  beforeEach(() => vi.clearAllMocks());

  it("UNIT-07 @issue-4 uses authenticated numeric User FK in ownership predicate and never a supplied scope", async () => {
    prisma.ticket.findFirst.mockResolvedValue(ticketRow());

    const result = await findTicketForRequester(prisma as never, 3, PUBLIC_ID);

    expect(result?.requesterPublicId).toBe("70000000-0000-4000-8000-000000000003");
    expect(prisma.ticket.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { publicId: PUBLIC_ID, requesterId: 3, deleted: false },
    }));
  });

  it("UNIT-07 @issue-4 returns same null scope result for malformed or missing public IDs", async () => {
    prisma.ticket.findFirst.mockResolvedValue(null);

    await expect(findTicketForRequester(prisma as never, 3, "not-a-uuid")).resolves.toBeNull();
    await expect(findTicketForRequester(prisma as never, 3, PUBLIC_ID)).resolves.toBeNull();
    expect(prisma.ticket.findFirst).toHaveBeenCalledTimes(1);
  });

  it("UNIT-07 @issue-4 fails closed before Prisma when authenticated User FK is unresolved", async () => {
    await expect(findTicketForRequester(prisma as never, 0, PUBLIC_ID)).rejects.toThrow();
    expect(prisma.ticket.findFirst).not.toHaveBeenCalled();
  });
});
