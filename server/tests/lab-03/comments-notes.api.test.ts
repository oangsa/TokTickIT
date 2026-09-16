import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStaffTicketsRouter } from "../../src/routes/staffTickets.js";
import { errorHandler } from "../../src/http/errors.js";
import { STAFF, staffPrismaMock, staffTicketRow, TICKET_ID } from "./support/staffFixture.js";
import { bearerToken, configureRequesterAuth } from "../lab-02/support/authenticatedRequester.js";
const { mock } = staffPrismaMock();
vi.mock("../../src/prisma.js", () => ({ getPrisma: () => mock }));
describe("API-26 Request Information transaction seam @issue-5", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.ticket.findFirst.mockResolvedValue(staffTicketRow({ ownerUserId: STAFF.id, owner: STAFF, currentStatus: "OPEN" }));
  });
  it("uses injected typed writer and trims the public message", async () => {
    const writer = vi.fn().mockResolvedValue(undefined);
    const app = express().use(express.json()).use("/api", createStaffTicketsRouter(writer)).use(errorHandler);
    const tokens = await configureRequesterAuth(mock, [STAFF]);
    const response = await request(app).post(`/api/tickets/${TICKET_ID}/request-information`).set("Authorization", bearerToken(tokens, STAFF.id)).send({ content: " More details please " });
    expect(response.status).toBe(200);
    expect(writer).toHaveBeenCalledWith(mock, { ticketId: 31, authorUserId: STAFF.id, content: "More details please" });
  });
  it.each(["", "   ", "x".repeat(2001), null])("validates comment content before Ticket access", async (content) => {
    const writer = vi.fn();
    const app = express().use(express.json()).use("/api", createStaffTicketsRouter(writer)).use(errorHandler);
    const tokens = await configureRequesterAuth(mock, [STAFF]);
    expect((await request(app).post(`/api/tickets/${TICKET_ID}/request-information`).set("Authorization", bearerToken(tokens, STAFF.id)).send({ content })).status).toBe(400);
    expect(mock.ticket.findFirst).not.toHaveBeenCalled(); expect(writer).not.toHaveBeenCalled();
  });
});
