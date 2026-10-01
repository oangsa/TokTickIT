import { randomUUID } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
import request from "supertest";
import { STAFF, ADMIN, REQUESTER, TICKET_ID } from "../lab-03/support/staffFixture.js";
import { bearerToken, configureRequesterAuth, type RequesterTokens } from "../lab-02/support/authenticatedRequester.js";
import { actionPrismaMock, actionRow, createBody, ACTION_ID } from "./support/actionFixture.js";
const { mock } = actionPrismaMock();
vi.mock("../../src/prisma.js", () => ({ getPrisma: () => mock }));
import { app } from "../../src/app.js";
let tokens: RequesterTokens;
beforeEach(async () => { Object.assign(mock, actionPrismaMock().mock); tokens = await configureRequesterAuth(mock, [STAFF, ADMIN, REQUESTER]); });
it("API-13 create accepts same-Ticket Active evidence using public storage UUID and omits bytes", async () => {
  mock.attachment.findMany.mockResolvedValue([{ id: 71 }]);
  mock.actionTaken.create.mockResolvedValue(actionRow({ attachments: [{ attachment: { id: 71, storageKey: ACTION_ID, ticketId: 31, originalName: "evidence.txt", extension: "txt", mimeType: "text/plain", sizeBytes: 4, data: Buffer.from("test"), removalReason: null, deleted: false, createdBy: "fixture", updatedBy: "fixture", createdAt: new Date(), updatedAt: new Date() } }] }));
  const response = await request(app).post(`/api/tickets/${TICKET_ID}/actions`).set("Authorization", bearerToken(tokens, STAFF.id)).set("Idempotency-Key", randomUUID()).send({ ...createBody, attachmentIds: [ACTION_ID] });
  expect(response.status).toBe(201); expect(response.body.attachments[0].attachmentId).toBe(ACTION_ID);
  expect(response.body.attachments[0]).not.toHaveProperty("id"); expect(response.body.attachments[0]).not.toHaveProperty("data");
  expect(mock.attachment.findMany).toHaveBeenCalledWith({ where: { ticketId: 31, storageKey: { in: [ACTION_ID] }, deleted: false, removalReason: null }, select: { id: true } });
});
it("API-13 unavailable/cross-Ticket evidence returns safe 404 before mutation", async () => {
  const response = await request(app).post(`/api/tickets/${TICKET_ID}/actions`).set("Authorization", bearerToken(tokens, STAFF.id)).set("Idempotency-Key", randomUUID()).send({ ...createBody, attachmentIds: [ACTION_ID] });
  expect(response.status).toBe(404); expect(response.body.code).toBe("NOT_FOUND"); expect(mock.actionTaken.create).not.toHaveBeenCalled(); expect(mock.ticketActivity.create).not.toHaveBeenCalled();
});
it("API-13 edit diffs complete desired set atomically and preserves retained joins", async () => {
  const { assignedToUserPublicId: _assignee, ...editable } = createBody;
  mock.attachment.findMany.mockResolvedValue([{ id: 72 }, { id: 73 }]);
  mock.actionTakenAttachment.findMany.mockResolvedValue([{ attachmentId: 71 }, { attachmentId: 72 }]);
  const response = await request(app).patch(`/api/tickets/${TICKET_ID}/actions/${ACTION_ID}`).set("Authorization", bearerToken(tokens, STAFF.id)).send({ ...editable, expectedVersion: 1, attachmentIds: [TICKET_ID, ACTION_ID] });
  expect(response.status).toBe(200);
  expect(mock.actionTakenAttachment.deleteMany).toHaveBeenCalledWith({ where: { actionTakenId: 51, attachmentId: { in: [71] } } });
  expect(mock.actionTakenAttachment.createMany).toHaveBeenCalledWith({ data: [{ actionTakenId: 51, attachmentId: 73, createdBy: STAFF.email, updatedBy: STAFF.email }] });
});
it("API-13 Cancel preserves all association rows and no Staff upload route exists", async () => {
  const response = await request(app).post(`/api/tickets/${TICKET_ID}/actions/${ACTION_ID}/cancel`).set("Authorization", bearerToken(tokens, STAFF.id)).set("Idempotency-Key", randomUUID()).send({ expectedVersion: 1, cancellationReason: "No longer required" });
  expect(response.status).toBe(200); expect(mock.actionTakenAttachment.deleteMany).not.toHaveBeenCalled();
  const upload = await request(app).post(`/api/tickets/${TICKET_ID}/attachments`).set("Authorization", bearerToken(tokens, STAFF.id)).send({});
  expect(upload.status).toBe(404);
});
