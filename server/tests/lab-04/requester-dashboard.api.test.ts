import { beforeEach, expect, it, vi } from "vitest";
import request from "supertest";
import { STAFF, ADMIN, REQUESTER } from "../lab-03/support/staffFixture.js";
import { bearerToken, configureRequesterAuth, type RequesterTokens } from "../lab-02/support/authenticatedRequester.js";
import { actionPrismaMock } from "./support/actionFixture.js";
const { mock } = actionPrismaMock();
vi.mock("../../src/prisma.js", () => ({ getPrisma: () => mock }));
import { app } from "../../src/app.js";
let tokens: RequesterTokens;
beforeEach(async () => {
  Object.assign(mock, actionPrismaMock().mock);
  mock.ticket.count.mockResolvedValue(0);
  mock.ticket.findMany.mockResolvedValue([]);
  tokens = await configureRequesterAuth(mock, [STAFF, ADMIN, REQUESTER]);
});
it("API-17 accepts every 1..20 size, rejects malformed or scope-widening query", async () => {
  for (let size = 1; size <= 20; size++) {
    const response = await request(app).get(`/api/users/me/dashboard?recentTicketsSize=${size}`).set("Authorization", bearerToken(tokens, REQUESTER.id));
    expect(response.status).toBe(200);
    expect(mock.ticket.findMany.mock.lastCall?.[0].take).toBe(size);
  }
  for (const query of ["recentTicketsSize=0", "recentTicketsSize=21", "recentTicketsSize=1.5", "recentTicketsSize=x", "recentTicketsSize=", "recentTicketsSize=5&recentTicketsSize=10", "recentTicketsSize[x]=5", "requesterId=2", "filters=[]"]) {
    const response = await request(app).get(`/api/users/me/dashboard?${query}`).set("Authorization", bearerToken(tokens, REQUESTER.id));
    expect(response.status).toBe(400); expect(response.body.code).toBe("VALIDATION_ERROR");
  }
});
it("API-17 denies anonymous, limited session, and Staff/Admin", async () => {
  expect((await request(app).get("/api/users/me/dashboard")).status).toBe(401);
  for (const user of [STAFF, ADMIN]) expect((await request(app).get("/api/users/me/dashboard").set("Authorization", bearerToken(tokens, user.id))).status).toBe(403);
});
it("API-17/23 Requester zero snapshot is compact, scoped, bounded and no-store", async () => {
  const response = await request(app).get("/api/users/me/dashboard").set("Authorization", bearerToken(tokens, REQUESTER.id));
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ metrics: { activeTickets: 0, waitingForRequester: 0, resolvedTickets: 0, closedTickets: 0 }, recentTickets: [] });
  expect(response.headers["cache-control"]).toBe("no-store");
  expect(mock.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "RepeatableRead" });
  expect(mock.ticket.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { requesterId: REQUESTER.id, deleted: false }, take: 5, orderBy: [{ updatedAt: "desc" }, { id: "desc" }] }));
  expect(mock.ticket.count.mock.calls.map(([input]) => input.where)).toEqual([
    { requesterId: REQUESTER.id, deleted: false, currentStatus: { in: ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"] } },
    ...["WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED"].map((currentStatus) => ({ requesterId: REQUESTER.id, deleted: false, currentStatus })),
  ]);
});
it("API-17 nonzero metrics come from counts; DTO excludes full Ticket fields", async () => {
  mock.ticket.count.mockResolvedValueOnce(7).mockResolvedValueOnce(2).mockResolvedValueOnce(3).mockResolvedValueOnce(4);
  mock.ticket.findMany.mockResolvedValue([{ id: 21, requesterId: REQUESTER.id, publicId: "ticket-public", ticketNumber: "TKT-20261001-000000000021", summary: "Synthetic recent", requestedPriority: "HIGH", currentStatus: "CANCELLED", updatedAt: new Date("2026-10-01"), description: "Full field excluded" }]);
  const response = await request(app).get("/api/users/me/dashboard").set("Authorization", bearerToken(tokens, REQUESTER.id));
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ metrics: { activeTickets: 7, waitingForRequester: 2, resolvedTickets: 3, closedTickets: 4 }, recentTickets: [{ publicId: "ticket-public", ticketNumber: "TKT-20261001-000000000021", summary: "Synthetic recent", requestedPriority: "HIGH", currentStatus: "CANCELLED", updatedAt: "2026-10-01T00:00:00.000Z" }] });
});
it("API-17 password-change guard blocks Dashboard before queries", async () => {
  const original = mock.userSession.findUnique.getMockImplementation()!;
  mock.userSession.findUnique.mockImplementation(async (input) => ({ ...await original(input), stage: "PASSWORD_CHANGE_REQUIRED" }));
  const response = await request(app).get("/api/users/me/dashboard").set("Authorization", bearerToken(tokens, REQUESTER.id));
  expect(response.status).toBe(403); expect(response.body.code).toBe("PASSWORD_CHANGE_REQUIRED"); expect(mock.ticket.count).not.toHaveBeenCalled();
});
