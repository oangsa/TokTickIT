import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { ADMIN, REQUESTER, STAFF, staffPrismaMock, staffTicketRow, TICKET_ID } from "./support/staffFixture.js";
import { bearerToken, configureRequesterAuth, type RequesterTokens } from "../lab-02/support/authenticatedRequester.js";
const { mock } = staffPrismaMock();
vi.mock("../../src/prisma.js", () => ({ getPrisma: () => mock }));
import { app } from "../../src/app.js";
import { TICKET_STATUSES } from "../../src/services/ticketQueryValidator.js";
let tokens: RequesterTokens;
const path = `/api/tickets/${TICKET_ID}`;
beforeEach(async () => {
  vi.clearAllMocks();
  tokens = await configureRequesterAuth(mock, [STAFF, ADMIN, REQUESTER]);
  mock.ticket.findFirst.mockResolvedValue(staffTicketRow());
  mock.ticket.findUnique.mockResolvedValue(staffTicketRow());
  mock.ticket.updateMany.mockResolvedValue({ count: 1 });
  mock.user.findFirst.mockResolvedValue(STAFF);
});
describe("API-18–29/32/55 Staff detail and actions @issue-5", () => {
  const transitions = {
    "start-work": ["OPEN", "REOPENED"],
    "request-information": ["OPEN", "IN_PROGRESS", "REOPENED"],
    "resume-work": ["WAITING_FOR_REQUESTER"],
    "mark-resolved": ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"],
    close: ["RESOLVED"],
    cancel: ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"],
  };
  for (const [action, sources] of Object.entries(transitions)) {
    it.each(TICKET_STATUSES)(`API-25 ${action} from %s`, async (currentStatus) => {
      mock.ticket.findFirst.mockResolvedValue(staffTicketRow({ currentStatus, ownerUserId: STAFF.id, owner: STAFF, requesterResolutionConfirmedAt: new Date() }));
      const response = await request(app).post(`${path}/${action}`).set("Authorization", bearerToken(tokens, STAFF.id)).send({ content: "Please provide details" });
      if (!sources.includes(currentStatus)) {
        expect(response.status).toBe(409);
        expect(response.body.code).toBe("INVALID_STATUS_TRANSITION");
        expect(mock.ticket.updateMany).not.toHaveBeenCalled();
      } else if (action === "request-information") {
        expect(response.status).toBe(500); // Production remains fail-closed until Issue 6 composition.
        expect(mock.ticket.updateMany).not.toHaveBeenCalled();
      } else {
        expect(response.status).toBe(200);
        expect(mock.ticket.updateMany).toHaveBeenCalledOnce();
      }
    });
  }
  it("reads full Staff DTO and hides missing/malformed Tickets", async () => {
    const response = await request(app).get(path).set("Authorization", bearerToken(tokens, STAFF.id));
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ requesterPublicId: REQUESTER.publicId, owner: null, requestedPriority: "MEDIUM", itPriority: "HIGH", requesterResolutionConfirmedAt: null, attachments: [] });
    expect((await request(app).get(path).set("Authorization", bearerToken(tokens, REQUESTER.id))).status).toBe(403);
    expect((await request(app).get("/api/tickets/bad").set("Authorization", bearerToken(tokens, STAFF.id))).status).toBe(404);
  });
  it("Claim is Staff-only and stale expected-owner writes conflict", async () => {
    expect((await request(app).post(`${path}/claim`).set("Authorization", bearerToken(tokens, ADMIN.id))).status).toBe(403);
    expect((await request(app).post(`${path}/claim`).set("Authorization", bearerToken(tokens, STAFF.id))).status).toBe(200);
    const stale = await request(app).patch(`${path}/owner`).set("Authorization", bearerToken(tokens, STAFF.id)).send({ ownerPublicId: null, expectedOwnerPublicId: STAFF.publicId });
    expect(stale.status).toBe(409); expect(stale.body.code).toBe("OWNERSHIP_CONFLICT");
  });
  it("rejects Claim and owner mutation on CANCELLED and CLOSED Tickets with 409 INVALID_STATUS_TRANSITION", async () => {
    for (const currentStatus of ["CANCELLED", "CLOSED"] as const) {
      mock.ticket.findFirst.mockResolvedValue(staffTicketRow({ currentStatus, ownerUserId: null, owner: null }));
      const claimRes = await request(app).post(`${path}/claim`).set("Authorization", bearerToken(tokens, STAFF.id));
      expect(claimRes.status).toBe(409);
      expect(claimRes.body.code).toBe("INVALID_STATUS_TRANSITION");
      const ownerRes = await request(app).patch(`${path}/owner`).set("Authorization", bearerToken(tokens, STAFF.id)).send({ ownerPublicId: STAFF.publicId, expectedOwnerPublicId: null });
      expect(ownerRes.status).toBe(409);
      expect(ownerRes.body.code).toBe("INVALID_STATUS_TRANSITION");
    }
  });
  it("lookup access does not grant non-owner Administrators assignment permission", async () => {
    mock.user.findMany.mockResolvedValue([]);
    expect((await request(app).get("/api/users/assignable").set("Authorization", bearerToken(tokens, ADMIN.id))).status).toBe(200);
    expect((await request(app).patch(`${path}/owner`).set("Authorization", bearerToken(tokens, ADMIN.id)).send({ ownerPublicId: ADMIN.publicId, expectedOwnerPublicId: null })).status).toBe(403);
    expect(mock.ticket.updateMany).not.toHaveBeenCalled();
  });
  it("validates owner and priority bodies; priority never changes Requested Priority", async () => {
    expect((await request(app).patch(`${path}/owner`).set("Authorization", bearerToken(tokens, STAFF.id)).send({ ownerPublicId: null })).status).toBe(400);
    expect((await request(app).patch(`${path}/it-priority`).set("Authorization", bearerToken(tokens, STAFF.id)).send({ itPriority: "urgent" })).status).toBe(400);
    expect((await request(app).patch(`${path}/it-priority`).set("Authorization", bearerToken(tokens, STAFF.id)).send({ itPriority: "LOW" })).status).toBe(200);
    expect(mock.ticket.updateMany.mock.calls[0][0].data).toEqual({ itPriority: "LOW", updatedBy: STAFF.email });
  });
  it.each(["start-work", "resume-work", "mark-resolved", "close", "cancel"])("%s invalid transition returns 409 for owner", async (action) => {
    mock.ticket.findFirst.mockResolvedValue(staffTicketRow({ currentStatus: "CANCELLED", ownerUserId: STAFF.id, owner: STAFF }));
    const response = await request(app).post(`${path}/${action}`).set("Authorization", bearerToken(tokens, STAFF.id));
    expect(response.status).toBe(409); expect(response.body.code).toBe("INVALID_STATUS_TRANSITION");
  });
  it("API-55 lists metadata and serves protected preview/download with association guard", async () => {
    const storageKey = "20000000-0000-4000-8000-000000000011";
    expect((await request(app).get(`${path}/attachments`).set("Authorization", bearerToken(tokens, ADMIN.id))).body).toEqual([]);
    mock.attachment.findFirst.mockResolvedValue({ data: Buffer.from("fixture"), mimeType: "image/png", originalName: 'image".png' });
    for (const action of ["preview", "download"]) {
      const response = await request(app).get(`${path}/attachments/${storageKey}/${action}`).set("Authorization", bearerToken(tokens, ADMIN.id));
      expect(response.status).toBe(200);
      expect(response.headers["x-content-type-options"]).toBe("nosniff");
      expect(response.headers["content-disposition"]).toContain(action === "preview" ? "inline" : "attachment");
    }
    expect(mock.attachment.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { storageKey, ticket: { publicId: TICKET_ID, deleted: false }, deleted: false } }));
    mock.attachment.findFirst.mockResolvedValue(null);
    expect((await request(app).get(`${path}/attachments/${storageKey}/preview`).set("Authorization", bearerToken(tokens, STAFF.id))).status).toBe(404);
    mock.attachment.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ deleted: true });
    expect((await request(app).get(`${path}/attachments/${storageKey}/download`).set("Authorization", bearerToken(tokens, STAFF.id))).status).toBe(410);
    expect((await request(app).post(`${path}/attachments`).set("Authorization", bearerToken(tokens, STAFF.id))).status).toBe(404);
  });
});
