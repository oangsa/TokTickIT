import { describe, expect, it } from "vitest";
import { mutateStaffTicket } from "../../src/services/ticketWorkflowService.js";
import { actor, ADMIN, STAFF, staffPrismaMock, staffTicketRow, TICKET_ID } from "./support/staffFixture.js";

describe("UNIT-08 ownership @issue-5", () => {
  it("Claims unassigned NEW and changes owner/status in the same transaction", async () => {
    const { prisma, mock } = staffPrismaMock();
    await mutateStaffTicket(prisma, actor(), TICKET_ID, "claim", {});
    expect(mock.ticket.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ ownerUserId: null, currentStatus: "NEW" }), data: { ownerUserId: STAFF.id, currentStatus: "OPEN", updatedBy: STAFF.email } }));
  });
  it("rejects Administrator Claim before Ticket access", async () => {
    const { prisma, mock } = staffPrismaMock();
    await expect(mutateStaffTicket(prisma, actor(ADMIN), TICKET_ID, "claim", {})).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mock.ticket.findFirst).not.toHaveBeenCalled();
  });
  it("rejects stale expected owner and ineligible targets", async () => {
    const { prisma, mock } = staffPrismaMock();
    await expect(mutateStaffTicket(prisma, actor(), TICKET_ID, "owner", { ownerPublicId: STAFF.publicId, expectedOwnerPublicId: ADMIN.publicId })).rejects.toMatchObject({ code: "OWNERSHIP_CONFLICT" });
    mock.user.findFirst.mockResolvedValue(null);
    await expect(mutateStaffTicket(prisma, actor(), TICKET_ID, "owner", { ownerPublicId: STAFF.publicId, expectedOwnerPublicId: null })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(mock.ticket.updateMany).not.toHaveBeenCalled();
  });
  it("allows Administrator-owner unassignment while preserving status", async () => {
    const { prisma, mock } = staffPrismaMock();
    mock.ticket.findFirst.mockResolvedValue(staffTicketRow({ ownerUserId: ADMIN.id, owner: ADMIN, currentStatus: "IN_PROGRESS" }));
    await mutateStaffTicket(prisma, actor(ADMIN), TICKET_ID, "owner", { ownerPublicId: null, expectedOwnerPublicId: ADMIN.publicId });
    expect(mock.ticket.updateMany.mock.calls[0][0].data).toEqual({ ownerUserId: null, updatedBy: ADMIN.email });
  });
  it("rejects Administrator non-owner writes and maps serialization races to 409", async () => {
    const { prisma, mock } = staffPrismaMock();
    await expect(mutateStaffTicket(prisma, actor(ADMIN), TICKET_ID, "it-priority", { itPriority: "HIGH" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    mock.$transaction.mockRejectedValue({ code: "P2034" });
    await expect(mutateStaffTicket(prisma, actor(), TICKET_ID, "claim", {})).rejects.toMatchObject({ code: "OWNERSHIP_CONFLICT" });
  });
  it("rejects Claim and owner mutation on CANCELLED and CLOSED Tickets", async () => {
    const { prisma, mock } = staffPrismaMock();
    for (const currentStatus of ["CANCELLED", "CLOSED"] as const) {
      mock.ticket.findFirst.mockResolvedValue(staffTicketRow({ currentStatus, ownerUserId: null, owner: null }));
      await expect(mutateStaffTicket(prisma, actor(), TICKET_ID, "claim", {})).rejects.toMatchObject({ code: "INVALID_STATUS_TRANSITION" });
      await expect(mutateStaffTicket(prisma, actor(), TICKET_ID, "owner", { ownerPublicId: STAFF.publicId, expectedOwnerPublicId: null })).rejects.toMatchObject({ code: "INVALID_STATUS_TRANSITION" });
    }
    expect(mock.ticket.updateMany).not.toHaveBeenCalled();
  });
});
