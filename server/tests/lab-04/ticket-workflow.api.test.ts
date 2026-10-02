import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { ADMIN, REQUESTER, STAFF, staffTicketRow, TICKET_ID } from "../lab-03/support/staffFixture.js";
import { bearerToken, configureRequesterAuth, type RequesterTokens } from "../lab-02/support/authenticatedRequester.js";
import { actionPrismaMock } from "./support/actionFixture.js";
const { mock } = actionPrismaMock();
vi.mock("../../src/prisma.js", () => ({ getPrisma: () => mock }));
import { app } from "../../src/app.js";
let tokens: RequesterTokens;
const path = `/api/tickets/${TICKET_ID}`;
beforeEach(async () => {
  vi.clearAllMocks();
  tokens = await configureRequesterAuth(mock, [STAFF, ADMIN, REQUESTER]);
  mock.ticket.findFirst.mockResolvedValue(staffTicketRow());
  mock.ticket.findUnique.mockResolvedValue(staffTicketRow());
  mock.ticket.updateMany.mockResolvedValue({ count: 1 });
  mock.user.findFirst.mockResolvedValue(ADMIN);
});
describe("API-16 Administrator operational parity", () => {
  it.each(["claim", "it-priority", "cancel"])("non-owner Admin can %s", async (operation) => {
    const response = operation === "it-priority"
      ? await request(app).patch(`${path}/${operation}`).set("Authorization", bearerToken(tokens, ADMIN.id)).send({ itPriority: "LOW" })
      : await request(app).post(`${path}/${operation}`).set("Authorization", bearerToken(tokens, ADMIN.id));
    expect(response.status).toBe(200);
    expect(mock.ticket.updateMany).toHaveBeenCalledOnce();
  });
  it.each([STAFF, ADMIN])("$role non-owner cannot use owner lifecycle", async (user) => {
    mock.ticket.findFirst.mockResolvedValue(staffTicketRow({ currentStatus: "IN_PROGRESS", ownerUserId: 999 }));
    for (const operation of ["start-work", "request-information", "resume-work", "mark-resolved", "close"]) {
      const response = await request(app).post(`${path}/${operation}`).set("Authorization", bearerToken(tokens, user.id)).send({ content: "Details" });
      expect(response.status).toBe(403); expect(response.body.code).toBe("FORBIDDEN");
    }
    expect(mock.ticket.updateMany).not.toHaveBeenCalled(); expect(mock.ticketActivity.create).not.toHaveBeenCalled();
  });
});

describe("API-15 resolution actor/source/Action matrix", () => {
  const datasets = [
    ["zero", []], ["cancelled only", [{ status: "CANCELLED", isMigrated: false }]],
    ["migrated only", [{ status: "COMPLETED", isMigrated: true }]],
    ["planned", [{ status: "COMPLETED", isMigrated: false }, { status: "PLANNED", isMigrated: false }]],
    ["in progress", [{ status: "COMPLETED", isMigrated: false }, { status: "IN_PROGRESS", isMigrated: false }]],
    ["real completed", [{ status: "COMPLETED", isMigrated: false }]],
    ["real plus cancelled", [{ status: "COMPLETED", isMigrated: false }, { status: "CANCELLED", isMigrated: false }]],
  ] as const;
  for (const user of [STAFF, ADMIN]) for (const currentStatus of ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"] as const) {
    it.each(datasets)(`${user.role} owner from ${currentStatus}: %s`, async (name, actions) => {
      const row = staffTicketRow({ currentStatus, ownerUserId: user.id, owner: user });
      mock.ticket.findFirst.mockResolvedValue(row);
      mock.ticket.findUnique.mockResolvedValue({ ...row, currentStatus: "RESOLVED" });
      mock.actionTaken.count.mockImplementation(async ({ where }) => actions.filter((item) =>
        typeof where.status === "string" ? item.status === where.status && item.isMigrated === where.isMigrated : where.status.in.includes(item.status)).length);
      const response = await request(app).post(`${path}/mark-resolved`).set("Authorization", bearerToken(tokens, user.id));
      const permitted = name === "real completed" || name === "real plus cancelled";
      expect(response.status).toBe(permitted ? 200 : 409);
      if (permitted) {
        expect(response.body).toMatchObject({ currentStatus: "RESOLVED", owner: { publicId: user.publicId }, requesterResolutionConfirmedAt: null });
        expect(mock.ticketActivity.create).toHaveBeenCalledOnce();
      } else {
        expect(response.body).toMatchObject({ code: "INVALID_STATUS_TRANSITION" });
        expect(mock.ticket.updateMany).not.toHaveBeenCalled(); expect(mock.ticketActivity.create).not.toHaveBeenCalled();
      }
    });
  }
  it.each(["RESOLVED", "CLOSED"])("migrated legacy %s reopens, rejects, then real completion permits resolution", async (currentStatus) => {
    let row = staffTicketRow({ currentStatus, ownerUserId: STAFF.id, owner: STAFF, requesterResolutionConfirmedAt: new Date() });
    let realCompleted = false;
    mock.user.findFirst.mockResolvedValue(STAFF);
    mock.ticket.findFirst.mockImplementation(async () => row);
    mock.ticket.findUnique.mockImplementation(async () => row);
    mock.ticket.updateMany.mockImplementation(async ({ data }) => { row = { ...row, ...data, owner: data.ownerUserId === null ? null : STAFF }; return { count: 1 }; });
    mock.actionTaken.count.mockImplementation(async ({ where }) => where.status === "COMPLETED" && !where.isMigrated && realCompleted ? 1 : 0);
    const reopened = await request(app).post(`/api/users/me/tickets/${TICKET_ID}/reopen`).set("Authorization", bearerToken(tokens, REQUESTER.id));
    expect(reopened.status).toBe(200); expect(reopened.body).toMatchObject({ currentStatus: "REOPENED", owner: null, requesterResolutionConfirmedAt: null });
    expect((await request(app).post(`${path}/claim`).set("Authorization", bearerToken(tokens, STAFF.id))).status).toBe(200);
    expect((await request(app).post(`${path}/mark-resolved`).set("Authorization", bearerToken(tokens, STAFF.id))).body.code).toBe("INVALID_STATUS_TRANSITION");
    realCompleted = true;
    const resolved = await request(app).post(`${path}/mark-resolved`).set("Authorization", bearerToken(tokens, STAFF.id));
    expect(resolved.status).toBe(200); expect(resolved.body.currentStatus).toBe("RESOLVED");
  });
});
it("API-16 Requester confirmation stays advisory, repeats once, owner Close requires confirmation", async () => {
  let row = staffTicketRow({ currentStatus: "RESOLVED", ownerUserId: STAFF.id, owner: STAFF });
  mock.ticket.findFirst.mockImplementation(async ({ where }) => where.requesterId && where.requesterId !== row.requesterId ? null : row);
  mock.ticket.findUnique.mockImplementation(async () => row);
  mock.ticket.updateMany.mockImplementation(async ({ data }) => { row = { ...row, ...data }; return { count: 1 }; });
  const owner = bearerToken(tokens, STAFF.id); const requester = bearerToken(tokens, REQUESTER.id);
  expect((await request(app).post(`${path}/close`).set("Authorization", owner)).status).toBe(409);
  for (let repeat = 0; repeat < 2; repeat++) {
    const confirmed = await request(app).post(`/api/users/me/tickets/${TICKET_ID}/looks-resolved`).set("Authorization", requester);
    expect(confirmed.status).toBe(200); expect(confirmed.body.currentStatus).toBe("RESOLVED"); expect(confirmed.body.requesterResolutionConfirmedAt).not.toBeNull();
  }
  expect(mock.ticketActivity.create).toHaveBeenCalledOnce();
  expect(mock.ticketActivity.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "REQUESTER_RESOLUTION_CONFIRMED", performedByUserId: REQUESTER.id }) });
  expect((await request(app).post(`${path}/close`).set("Authorization", bearerToken(tokens, ADMIN.id))).status).toBe(403);
  const closed = await request(app).post(`${path}/close`).set("Authorization", owner);
  expect(closed.status).toBe(200); expect(closed.body.currentStatus).toBe("CLOSED");
});
