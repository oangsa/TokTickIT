import { beforeEach, expect, it, vi } from "vitest";
import request from "supertest";
import { STAFF, ADMIN, REQUESTER, TICKET_ID } from "../lab-03/support/staffFixture.js";
import { bearerToken, configureRequesterAuth, type RequesterTokens } from "../lab-02/support/authenticatedRequester.js";
import { actionPrismaMock, ACTION_ID } from "./support/actionFixture.js";
const { mock } = actionPrismaMock();
vi.mock("../../src/prisma.js", () => ({ getPrisma: () => mock }));
import { app } from "../../src/app.js";
let tokens: RequesterTokens;
beforeEach(async () => { Object.assign(mock, actionPrismaMock().mock); vi.clearAllMocks(); tokens = await configureRequesterAuth(mock, [STAFF, ADMIN, REQUESTER]); });
it("API-14 Ticket Activity returns typed direct array and deterministic paging", async () => {
  mock.ticketActivity.count.mockResolvedValue(1);
  mock.ticketActivity.findMany.mockResolvedValue([{ publicId: "activity-public", ticket: { publicId: TICKET_ID }, action: "ACTION_UPDATED", performedBy: STAFF,
    assignment: null, status: null, priority: null, actionTaken: { actionTaken: { publicId: ACTION_ID }, previousAssignee: null, assignedAssignee: null }, createdAt: new Date("2026-10-01T00:00:00Z") }]);
  const response = await request(app).get(`/api/tickets/${TICKET_ID}/activity`).query({ filters: JSON.stringify([{ field: "category", condition: "EQUAL", value: "Actions Taken" }]), sort: "createdAt:asc" }).set("Authorization", bearerToken(tokens, STAFF.id));
  expect(response.status).toBe(200);
  expect(response.body[0]).toMatchObject({ action: "ACTION_UPDATED", actionTaken: { publicId: ACTION_ID }, performedBy: { isSystem: false } });
  expect(response.body[0]).not.toHaveProperty("id");
  expect(JSON.parse(response.headers["x-pagination"])).toMatchObject({ totalItems: 1 });
});
it.each(["/activity", `/actions/${ACTION_ID}/activity`])("API-14 Staff/Admin Activity paging %s and Requester prohibition", async (suffix) => {
  mock.ticketActivity.count.mockResolvedValue(0);
  for (const user of [STAFF, ADMIN]) {
    const response = await request(app).get(`/api/tickets/${TICKET_ID}${suffix}`).set("Authorization", bearerToken(tokens, user.id));
    expect(response.status).toBe(200); expect(response.body).toEqual([]); expect(response.headers["cache-control"]).toBe("no-store");
    expect(JSON.parse(response.headers["x-pagination"])).toMatchObject({ totalItems: 0, pageSize: 10 });
  }
  expect((await request(app).get(`/api/tickets/${TICKET_ID}${suffix}`).set("Authorization", bearerToken(tokens, REQUESTER.id))).status).toBe(403);
});
it("API-14 Action parent mismatch safe 404, unknown categories/query keys safe 400", async () => {
  mock.actionTaken.findFirst.mockResolvedValue(null);
  const base = `/api/tickets/${TICKET_ID}`;
  expect((await request(app).get(`${base}/actions/${ACTION_ID}/activity`).set("Authorization", bearerToken(tokens, STAFF.id))).status).toBe(404);
  for (const query of [{ search: "x" }, { sort: "action:asc" }, { filters: JSON.stringify([{ field: "category", condition: "EQUAL", value: "Security" }]) }, { filters: JSON.stringify([{ field: "category", condition: "IN", value: ["Actions Taken"] }]) }, { pageSize: "101" }]) {
    const response = await request(app).get(`${base}/activity`).query(query).set("Authorization", bearerToken(tokens, STAFF.id));
    expect(response.status).toBe(400); expect(response.body.code).toBe("VALIDATION_ERROR");
  }
});
it("API-14 Requester confirmation is returned under workflow category; no invented child", async () => {
  mock.ticketActivity.count.mockResolvedValue(1);
  mock.ticketActivity.findMany.mockResolvedValue([{ publicId: ACTION_ID, ticket: { publicId: TICKET_ID }, action: "REQUESTER_RESOLUTION_CONFIRMED", performedBy: REQUESTER, assignment: null, status: null, priority: null, actionTaken: null, createdAt: new Date() }]);
  const response = await request(app).get(`/api/tickets/${TICKET_ID}/activity`).query({ filters: JSON.stringify([{ field: "category", condition: "EQUAL", value: "Ticket Workflow" }]) }).set("Authorization", bearerToken(tokens, STAFF.id));
  expect(response.status).toBe(200); expect(response.body[0]).toMatchObject({ action: "REQUESTER_RESOLUTION_CONFIRMED", performedBy: { role: "REQUESTER" } });
  expect(response.body[0]).not.toHaveProperty("statusChange");
  expect(mock.ticketActivity.count.mock.calls[0][0].where.AND[1].action.in).toContain("REQUESTER_RESOLUTION_CONFIRMED");
});
it("Activity has no public write/update/delete routes", async () => {
  for (const method of ["post", "patch", "delete"] as const) {
    expect((await request(app)[method](`/api/tickets/${TICKET_ID}/activity`).set("Authorization", bearerToken(tokens, STAFF.id)).send({})).status).toBe(404);
  }
  expect(mock.ticketActivity.create).not.toHaveBeenCalled();
});
