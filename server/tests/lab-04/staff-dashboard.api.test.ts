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
  mock.ticket.count.mockResolvedValue(0); mock.ticket.findMany.mockResolvedValue([]); mock.actionTaken.findMany.mockResolvedValue([]);
  tokens = await configureRequesterAuth(mock, [STAFF, ADMIN, REQUESTER]);
});
it.each([STAFF, ADMIN])("API-18/23 operational snapshot for $role has zero shape, query bounds and no-store", async (user) => {
  const response = await request(app).get("/api/dashboard?myActionsSize=7&recentTicketsSize=9&urgentTicketsSize=11").set("Authorization", bearerToken(tokens, user.id));
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ metrics: { unassignedTickets: 0, myAssignedTickets: 0, inProgressTickets: 0, waitingForRequester: 0, highPriorityTickets: 0 }, myActions: [], recentTickets: [], urgentTickets: [] });
  expect(response.headers["cache-control"]).toBe("no-store");
  expect(mock.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "RepeatableRead" });
  const nonTerminal = { deleted: false, currentStatus: { notIn: ["CLOSED", "CANCELLED"] } };
  expect(mock.ticket.count.mock.calls.map(([input]) => input.where)).toEqual([
    { ...nonTerminal, ownerUserId: null }, { ...nonTerminal, ownerUserId: user.id },
    { deleted: false, currentStatus: "IN_PROGRESS" }, { deleted: false, currentStatus: "WAITING_FOR_REQUESTER" }, { ...nonTerminal, itPriority: "HIGH" },
  ]);
  expect(mock.ticket.findMany.mock.calls.map(([input]) => input.take)).toEqual([9, 11, 11]);
  expect(mock.actionTaken.findMany).toHaveBeenCalledTimes(4);
  for (const [input] of mock.actionTaken.findMany.mock.calls) {
    expect(input.take).toBe(7); expect(input.where.ticket).toEqual({ deleted: false });
    expect(input.where.OR).toEqual([{ assignedToUserId: user.id }, { performedByUserId: user.id }]);
  }
});
it("API-18 operational Dashboard denies Requester/anonymous and rejects invalid sizes for each field", async () => {
  expect((await request(app).get("/api/dashboard")).status).toBe(401);
  expect((await request(app).get("/api/dashboard").set("Authorization", bearerToken(tokens, REQUESTER.id))).status).toBe(403);
  for (const field of ["myActionsSize", "recentTicketsSize", "urgentTicketsSize"]) for (const value of ["0", "21", "1.5", "", "abc"]) {
    const response = await request(app).get(`/api/dashboard?${field}=${value}`).set("Authorization", bearerToken(tokens, STAFF.id));
    expect(response.status).toBe(400); expect(response.body.code).toBe("VALIDATION_ERROR");
  }
});
it("API-18 nonzero lifecycle DTO is bounded, sorted and contains only public User fields", async () => {
  mock.ticket.count.mockResolvedValueOnce(5).mockResolvedValueOnce(3).mockResolvedValueOnce(1).mockResolvedValueOnce(2).mockResolvedValueOnce(4);
  mock.actionTaken.findMany.mockImplementation(async ({ where }) => {
    const index = ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"].indexOf(where.status);
    const time = new Date(Date.UTC(2026, 9, 1, 10 + index));
    return [{ id: 50 + index, publicId: `action-${index}`, ticket: { publicId: "ticket-public", ticketNumber: "TKT-20261001-000000000021" }, description: where.status,
      status: where.status, assignedTo: STAFF, performedBy: where.status === "COMPLETED" ? STAFF : null,
      createdAt: new Date("2026-09-01"), startedAt: time, completedAt: time, cancelledAt: time,
    }];
  });
  const response = await request(app).get("/api/dashboard?myActionsSize=3").set("Authorization", bearerToken(tokens, STAFF.id));
  expect(response.status).toBe(200);
  expect(response.body.metrics).toEqual({ unassignedTickets: 5, myAssignedTickets: 3, inProgressTickets: 1, waitingForRequester: 2, highPriorityTickets: 4 });
  expect(response.body.myActions.map((row: { publicId: string; activityAt: string }) => [row.publicId, row.activityAt])).toEqual([["action-3", "2026-10-01T13:00:00.000Z"], ["action-2", "2026-10-01T12:00:00.000Z"], ["action-1", "2026-10-01T11:00:00.000Z"]]);
  expect(response.body.myActions[0].assignedTo).toEqual({ publicId: STAFF.publicId, name: STAFF.name, email: STAFF.email, role: STAFF.role });
  expect(response.body.myActions[1].performedBy).toEqual({ publicId: STAFF.publicId, name: STAFF.name, role: STAFF.role });
});
