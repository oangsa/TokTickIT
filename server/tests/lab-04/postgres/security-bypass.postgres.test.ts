import { randomBytes, randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import app from "../../../src/app.js";
import { getPrisma } from "../../../src/prisma.js";
import { JwtService } from "../../../src/services/jwtService.js";
import { SessionService } from "../../../src/services/sessionService.js";
import type { TicketActor } from "../../../src/services/ticketWorkflowService.js";
import { actionDatabase, type ActionDatabase } from "../support/actionDatabase.js";
import { createBody } from "../support/actionFixture.js";

let database: ActionDatabase;
const tokens = new Map<number, string>();
const logs: string[] = [];
const log = vi.spyOn(console, "log").mockImplementation((value: unknown) => { logs.push(String(value)); });
beforeAll(async () => {
  process.env.JWT_SECRET = randomBytes(32).toString("hex");
  database = await actionDatabase();
  for (const actor of [database.requester, database.staff, database.other, database.admin]) {
    const { session } = await new SessionService(database.first).create({ userId: actor.userId, stage: "FULL", rememberMe: false });
    tokens.set(actor.userId, await new JwtService().sign({ userPublicId: actor.userPublicId, sessionId: session.id }));
  }
}, 30000);
afterAll(async () => { log.mockRestore(); await database?.close(); await getPrisma().$disconnect(); });

function bearer(actor: TicketActor) { return `Bearer ${tokens.get(actor.userId)}`; }
function safe(response: request.Response, status: number, code?: string) {
  expect(response.status).toBe(status);
  expect(response.headers["cache-control"]).toBe("no-store");
  expect(response.headers["x-request-id"]).toBeTruthy();
  expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|refreshTokenHash|stack|PrismaClient|postgresql:\/\//i);
  if (code) expect(response.body).toMatchObject({ statusCode: status, code });
}

it("direct API role/resource/Attachment/Activity bypass matrix uses real persisted sessions and data", async () => {
  const { first, requester, staff, other, admin } = database;
  const ticket = await database.ticket();
  const differentTicket = await database.ticket();
  const foreignTicket = await database.ticket();
  await first.ticket.update({ where: { id: foreignTicket.id }, data: { requesterId: other.userId } });
  const active = await database.file(ticket.id);
  const cross = await database.file(differentTicket.id);
  const pending = await database.file(null);
  const removed = await database.file(ticket.id, { deleted: true, removalReason: "Synthetic removed" });
  const action = (await database.create(ticket.publicId, other.userPublicId, [active.storageKey])).action;
  const path = `/api/tickets/${ticket.publicId}/actions/${action.publicId}`;
  await first.internalNote.create({ data: { ticketId: ticket.id, authorUserId: staff.userId, content: "Private synthetic release note" } });
  const before = await first.ticketActivity.count({ where: { ticketId: ticket.id } });

  safe(await request(app).get(path), 401, "UNAUTHENTICATED");
  for (const actor of [staff, other, admin]) {
    safe(await request(app).get(path).set("Authorization", bearer(actor)), 200);
    safe(await request(app).get(`/api/tickets/${ticket.publicId}/activity`).set("Authorization", bearer(actor)), 200);
    safe(await request(app).get(`${path}/activity`).set("Authorization", bearer(actor)), 200);
    safe(await request(app).get("/api/dashboard").set("Authorization", bearer(actor)), 200);
    safe(await request(app).get("/api/users/me/dashboard").set("Authorization", bearer(actor)), 403, "FORBIDDEN");
  }
  const ownPath = `/api/users/me/tickets/${ticket.publicId}/actions`;
  const own = await request(app).get(`${ownPath}/${action.publicId}`).set("Authorization", bearer(requester));
  safe(own, 200);
  expect(JSON.stringify(own.body)).not.toContain("Private synthetic release note");
  safe(await request(app).get(`/api/users/me/tickets/${foreignTicket.publicId}/actions`).set("Authorization", bearer(requester)), 404, "NOT_FOUND");
  safe(await request(app).get(`/api/users/me/tickets/${differentTicket.publicId}/actions/${action.publicId}`).set("Authorization", bearer(requester)), 404, "NOT_FOUND");
  safe(await request(app).get(`/api/tickets/${differentTicket.publicId}/actions/${action.publicId}`).set("Authorization", bearer(staff)), 404, "NOT_FOUND");
  safe(await request(app).get(`/api/tickets/${differentTicket.publicId}/actions/${action.publicId}/activity`).set("Authorization", bearer(admin)), 404, "NOT_FOUND");
  for (const endpoint of [path, `${path}/activity`, `/api/tickets/${ticket.publicId}/activity`, `/api/tickets/${ticket.publicId}/internal-notes`, "/api/dashboard", "/api/users/assignable", "/api/admin/users"]) {
    safe(await request(app).get(endpoint).set("Authorization", bearer(requester)), 403, "FORBIDDEN");
  }
  safe(await request(app).get("/api/users/me/dashboard").set("Authorization", bearer(requester)), 200);
  for (const operation of ["start", "complete", "cancel"]) {
    safe(await request(app).post(`${path}/${operation}`).set("Authorization", bearer(requester)).set("Idempotency-Key", randomUUID()).send({ expectedVersion: 1 }), 403, "FORBIDDEN");
  }
  safe(await request(app).post(`/api/tickets/${ticket.publicId}/actions`).set("Authorization", bearer(requester)).send(createBody), 403, "FORBIDDEN");
  safe(await request(app).patch(path).set("Authorization", bearer(requester)).send({}), 403, "FORBIDDEN");
  safe(await request(app).patch(`${path}/assignee`).set("Authorization", bearer(requester)).send({}), 403, "FORBIDDEN");
  for (const actor of [admin, other]) {
    safe(await request(app).post(`/api/tickets/${ticket.publicId}/start-work`).set("Authorization", bearer(actor)), 403, "FORBIDDEN");
    safe(await request(app).post(`${path}/start`).set("Authorization", bearer(actor)).set("Idempotency-Key", randomUUID()).send({ expectedVersion: 1 }), actor === other ? 200 : 403, actor === other ? undefined : "FORBIDDEN");
  }
  // Admin role alone does not grant edit/complete permission on this Action.
  safe(await request(app).patch(path).set("Authorization", bearer(admin)).send({ ...createBody, expectedVersion: 2, result: null, assignedToUserPublicId: undefined }), 403, "FORBIDDEN");
  safe(await request(app).post(`${path}/complete`).set("Authorization", bearer(admin)).set("Idempotency-Key", randomUUID()).send({ expectedVersion: 2, result: "Synthetic result", followUpRequired: false }), 403, "FORBIDDEN");
  for (const file of [cross, pending, removed]) {
    safe(await request(app).post(`/api/tickets/${ticket.publicId}/actions`).set("Authorization", bearer(staff)).set("Idempotency-Key", randomUUID()).send({ ...createBody, assignedToUserPublicId: staff.userPublicId, attachmentIds: [file.storageKey] }), 404, "NOT_FOUND");
  }
  safe(await request(app).get(`/api/tickets/${differentTicket.publicId}/attachments/${active.storageKey}/preview`).set("Authorization", bearer(staff)), 404, "NOT_FOUND");
  safe(await request(app).get(`/api/tickets/${ticket.publicId}/attachments/${active.storageKey}/preview`).set("Authorization", bearer(staff)), 200);
  for (const method of ["post", "patch", "delete"] as const) {
    safe(await request(app)[method](`/api/tickets/${ticket.publicId}/activity`).set("Authorization", bearer(admin)).send({}), 404, "NOT_FOUND");
  }
  // Only the allowed Start above appended an audit row; denied/read calls do not.
  expect(await first.ticketActivity.count({ where: { ticketId: ticket.id } })).toBe(before + 1);
  const system = await first.user.findFirstOrThrow({ where: { isSystem: true } });
  const { session } = await new SessionService(first).create({ userId: system.id, stage: "FULL", rememberMe: false });
  const forgedSystem = await new JwtService().sign({ userPublicId: system.publicId, sessionId: session.id });
  safe(await request(app).get("/api/dashboard").set("Authorization", `Bearer ${forgedSystem}`), 401, "SESSION_INVALID");
  for (const actor of [staff, admin]) {
    const lookup = await request(app).get("/api/users/assignable?pageSize=100").set("Authorization", bearer(actor));
    safe(lookup, 200);
    expect(lookup.body.some((row: { publicId: string }) => row.publicId === system.publicId)).toBe(false);
  }
  for (const line of logs) {
    const parsed = JSON.parse(line) as Record<string, unknown>;
    expect(Object.keys(parsed).sort()).toEqual(["durationMs", "errorCode", "method", "requestId", "route", "status"]);
    expect(line).not.toMatch(/@example|Bearer|Private synthetic|password|refreshToken|authorization/i);
  }
}, 30000);
