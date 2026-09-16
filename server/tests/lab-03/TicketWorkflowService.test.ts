import { describe, expect, it, vi } from "vitest";
import { mutateStaffTicket, nextTicketStatus, type WorkflowAction } from "../../src/services/ticketWorkflowService.js";
import { TICKET_STATUSES } from "../../src/services/ticketQueryValidator.js";
import { actor, STAFF, staffPrismaMock, staffTicketRow, TICKET_ID } from "./support/staffFixture.js";

const allowed: Record<WorkflowAction, string[]> = { "start-work": ["OPEN", "REOPENED"], "request-information": ["OPEN", "IN_PROGRESS", "REOPENED"], "resume-work": ["WAITING_FOR_REQUESTER"], "mark-resolved": ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"], close: ["RESOLVED"], cancel: ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"] };
const target: Record<WorkflowAction, string> = { "start-work": "IN_PROGRESS", "request-information": "WAITING_FOR_REQUESTER", "resume-work": "IN_PROGRESS", "mark-resolved": "RESOLVED", close: "CLOSED", cancel: "CANCELLED" };
describe("UNIT-09/10 workflow @issue-5", () => {
  for (const action of Object.keys(allowed) as WorkflowAction[]) for (const status of TICKET_STATUSES) {
    it(`${action} from ${status}`, () => {
      if (allowed[action].includes(status)) expect(nextTicketStatus(action, status, new Date())).toBe(target[action]);
      else expect(() => nextTicketStatus(action, status, new Date())).toThrowError(expect.objectContaining({ code: "INVALID_STATUS_TRANSITION" }));
    });
  }
  it("requires requester confirmation before Close", () => expect(() => nextTicketStatus("close", "RESOLVED", null)).toThrow());
  it("enforces owner-only actions but permits non-owner Staff Cancel", async () => {
    const { prisma, mock } = staffPrismaMock();
    mock.ticket.findFirst.mockResolvedValue(staffTicketRow({ currentStatus: "OPEN" }));
    await expect(mutateStaffTicket(prisma, actor(), TICKET_ID, "start-work", {})).rejects.toMatchObject({ code: "FORBIDDEN" });
    await mutateStaffTicket(prisma, actor(), TICKET_ID, "cancel", {});
    expect(mock.ticket.updateMany).toHaveBeenCalledOnce();
  });
  it("passes the same transaction to comment writer and never swallows its failure", async () => {
    const { prisma, mock } = staffPrismaMock();
    mock.ticket.findFirst.mockResolvedValue(staffTicketRow({ currentStatus: "OPEN", ownerUserId: STAFF.id, owner: STAFF }));
    const writer = vi.fn().mockRejectedValue(new Error("comment failed"));
    await expect(mutateStaffTicket(prisma, actor(), TICKET_ID, "request-information", { content: " Need details " }, writer)).rejects.toThrow("comment failed");
    expect(writer).toHaveBeenCalledWith(mock, { ticketId: 31, authorUserId: STAFF.id, content: "Need details" });
  });
  it("fails closed without a production writer before Ticket mutation", async () => {
    const { prisma, mock } = staffPrismaMock();
    mock.ticket.findFirst.mockResolvedValue(staffTicketRow({ currentStatus: "OPEN", ownerUserId: STAFF.id, owner: STAFF }));
    await expect(mutateStaffTicket(prisma, actor(), TICKET_ID, "request-information", { content: "Details" })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(mock.ticket.updateMany).not.toHaveBeenCalled();
  });
  it("clears confirmation on resolution without changing owner or priority", async () => {
    const { prisma, mock } = staffPrismaMock();
    mock.ticket.findFirst.mockResolvedValue(staffTicketRow({ currentStatus: "REOPENED", ownerUserId: STAFF.id, owner: STAFF }));
    await mutateStaffTicket(prisma, actor(), TICKET_ID, "mark-resolved", {});
    expect(mock.ticket.updateMany.mock.calls[0][0].data).toEqual({ currentStatus: "RESOLVED", requesterResolutionConfirmedAt: null, updatedBy: STAFF.email });
  });
});
