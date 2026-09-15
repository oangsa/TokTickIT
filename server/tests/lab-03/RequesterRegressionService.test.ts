import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../src/http/errors.js";
import { applyRequesterTicketAction } from "../../src/services/ticketService.js";

const PUBLIC_ID = "05a214b4-b957-4ed7-a58e-73f4392b35ec";
const NOW = new Date("2026-09-14T00:00:00.000Z");

function ticketRow(overrides: Record<string, unknown> = {}) {
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
    currentStatus: "RESOLVED",
    requesterResolutionConfirmedAt: null,
    ownerUserId: 9,
    deleted: false,
    createdBy: "alice@example.test",
    createdAt: NOW,
    updatedBy: "alice@example.test",
    updatedAt: NOW,
    requester: { id: 3, publicId: "70000000-0000-4000-8000-000000000003", name: "Alice", email: "alice@example.test" },
    owner: { publicId: "70000000-0000-4000-8000-000000000009", name: "IT Staff", role: "IT_STAFF" },
    category: { id: 4, name: "Network" },
    relatedSystem: { id: 5, name: "VPN" },
    attachments: [],
    ...overrides,
  };
}

describe("Requester Ticket action state machine", () => {
  const tx = {
    ticket: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    tx.ticket.updateMany.mockResolvedValue({ count: 1 });
    tx.ticket.findUnique.mockResolvedValue(ticketRow());
  });

  it.each([
    ["NEW", "cancel"],
    ["OPEN", "cancel"],
    ["RESOLVED", "looks-resolved"],
    ["RESOLVED", "reopen"],
    ["CLOSED", "reopen"],
  ])("UNIT-18 @issue-4 allows %s/%s only through authenticated ownership", async (status, action) => {
    tx.ticket.findFirst.mockResolvedValue(ticketRow({ currentStatus: status }));

    await expect(applyRequesterTicketAction(prisma as never, 3, "alice@example.test", PUBLIC_ID, action as never)).resolves.toBeDefined();
    expect(tx.ticket.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { publicId: PUBLIC_ID, requesterId: 3, deleted: false } }));
  });

  it.each([
    ["IN_PROGRESS", "cancel"],
    ["OPEN", "looks-resolved"],
    ["NEW", "reopen"],
    ["CANCELLED", "reopen"],
  ])("UNIT-18 @issue-4 rejects invalid %s/%s transition", async (status, action) => {
    tx.ticket.findFirst.mockResolvedValue(ticketRow({ currentStatus: status }));

    await expect(applyRequesterTicketAction(prisma as never, 3, "alice@example.test", PUBLIC_ID, action as never)).rejects.toBeInstanceOf(ApiError);
    await expect(applyRequesterTicketAction(prisma as never, 3, "alice@example.test", PUBLIC_ID, action as never)).rejects.toMatchObject({ code: "INVALID_STATUS_TRANSITION" });
    expect(tx.ticket.updateMany).not.toHaveBeenCalled();
  });

  it("UNIT-18 @issue-4 cancels only NEW/OPEN and writes no client-owned fields", async () => {
    tx.ticket.findFirst.mockResolvedValue(ticketRow({ currentStatus: "OPEN" }));

    await applyRequesterTicketAction(prisma as never, 3, "alice@example.test", PUBLIC_ID, "cancel");

    expect(tx.ticket.updateMany).toHaveBeenCalledWith({
      where: { id: 42, deleted: false, currentStatus: { in: ["NEW", "OPEN"] } },
      data: { currentStatus: "CANCELLED", updatedBy: "alice@example.test" },
    });
  });

  it("UNIT-18 @issue-4 records Looks Resolved without changing status", async () => {
    tx.ticket.findFirst.mockResolvedValue(ticketRow({ currentStatus: "RESOLVED" }));

    await applyRequesterTicketAction(prisma as never, 3, "alice@example.test", PUBLIC_ID, "looks-resolved");

    const call = tx.ticket.updateMany.mock.calls[0]?.[0];
    expect(call.where).toEqual({ id: 42, deleted: false, currentStatus: "RESOLVED" });
    expect(call.data.currentStatus).toBeUndefined();
    expect(call.data.requesterResolutionConfirmedAt).toBeInstanceOf(Date);
  });

  it("UNIT-18 @issue-4 reopens atomically, clears owner/confirmation, and preserves priority", async () => {
    tx.ticket.findFirst.mockResolvedValue(ticketRow({ currentStatus: "CLOSED", requesterResolutionConfirmedAt: NOW }));
    tx.ticket.findUnique.mockResolvedValue(ticketRow({ currentStatus: "REOPENED", owner: null, ownerUserId: null, requesterResolutionConfirmedAt: null, itPriority: "HIGH" }));

    const result = await applyRequesterTicketAction(prisma as never, 3, "alice@example.test", PUBLIC_ID, "reopen");

    expect(tx.ticket.updateMany).toHaveBeenCalledWith({
      where: { id: 42, deleted: false, currentStatus: { in: ["RESOLVED", "CLOSED"] } },
      data: { currentStatus: "REOPENED", ownerUserId: null, requesterResolutionConfirmedAt: null, updatedBy: "alice@example.test" },
    });
    expect(result?.currentStatus).toBe("REOPENED");
    expect(result?.owner).toBeNull();
    expect(result?.itPriority).toBe("HIGH");
    expect(result?.requesterResolutionConfirmedAt).toBeNull();
  });

  it("UNIT-18 @issue-4 makes repeated Looks Resolved idempotent without another write", async () => {
    tx.ticket.findFirst.mockResolvedValue(ticketRow({ currentStatus: "RESOLVED", requesterResolutionConfirmedAt: NOW }));
    tx.ticket.findUnique.mockResolvedValue(ticketRow({ currentStatus: "RESOLVED", requesterResolutionConfirmedAt: NOW }));

    const result = await applyRequesterTicketAction(prisma as never, 3, "alice@example.test", PUBLIC_ID, "looks-resolved");

    expect(tx.ticket.updateMany).not.toHaveBeenCalled();
    expect(result?.requesterResolutionConfirmedAt).toBe(NOW.toISOString());
  });
});
