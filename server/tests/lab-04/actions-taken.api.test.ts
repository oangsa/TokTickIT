import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { STAFF, ADMIN, REQUESTER, TICKET_ID } from "../lab-03/support/staffFixture.js";
import { bearerToken, configureRequesterAuth, type RequesterTokens } from "../lab-02/support/authenticatedRequester.js";
import { actionPrismaMock, actionRow, createBody, ACTION_ID } from "./support/actionFixture.js";
const { mock } = actionPrismaMock();
vi.mock("../../src/prisma.js", () => ({ getPrisma: () => mock }));
import { app } from "../../src/app.js";
let tokens: RequesterTokens;
beforeEach(async () => { Object.assign(mock, actionPrismaMock().mock); vi.clearAllMocks(); tokens = await configureRequesterAuth(mock, [STAFF, ADMIN, REQUESTER]); mock.actionTaken.findFirst.mockResolvedValue(actionRow()); });
describe("Actions REST contract", () => {
  it("API-01 creates server-authored PLANNED Action plus Activity and completed idempotency result", async () => {
    const response = await request(app).post(`/api/tickets/${TICKET_ID}/actions`).set("Authorization", bearerToken(tokens, STAFF.id)).set("Idempotency-Key", randomUUID()).send(createBody);
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ publicId: ACTION_ID, ticketPublicId: TICKET_ID, status: "PLANNED", version: 1, result: null, performedBy: null });
    expect(response.body).not.toHaveProperty("id");
    expect(mock.ticketActivity.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "ACTION_CREATED", performedByUserId: STAFF.id }) }));
    expect(mock.idempotencyRecord.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "COMPLETED", actionTakenId: 51 }) }));
  });
});
it("API-04 Requester reads own scoped detail without internal Activity", async () => {
  const response = await request(app).get(`/api/users/me/tickets/${TICKET_ID}/actions/${ACTION_ID}`).set("Authorization", bearerToken(tokens, REQUESTER.id));
  expect(response.status).toBe(200);
  expect(response.body.publicId).toBe(ACTION_ID);
  expect(response.body).not.toHaveProperty("activities");
  expect(mock.ticket.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ requesterId: REQUESTER.id }) }));
});
it("API-03 returns bounded searchable Action list and X-Pagination", async () => {
  const response = await request(app).get(`/api/tickets/${TICKET_ID}/actions`).query({ search: " cable ", searchFields: "description,result,followUpNote,attachmentNotes", sort: "createdAt:asc" }).set("Authorization", bearerToken(tokens, STAFF.id));
  expect(response.status).toBe(200);
  expect(response.body[0]).toMatchObject({ publicId: ACTION_ID, isMigrated: false });
  expect(response.body[0]).not.toHaveProperty("result");
  expect(JSON.parse(response.headers["x-pagination"])).toMatchObject({ totalItems: 1 });
});
it.each([
  ["PLANNED", "start", 200], ["PLANNED", "complete", 409], ["PLANNED", "cancel", 200],
  ["IN_PROGRESS", "start", 409], ["IN_PROGRESS", "complete", 200], ["IN_PROGRESS", "cancel", 200],
  ["COMPLETED", "start", 409], ["COMPLETED", "complete", 409], ["COMPLETED", "cancel", 409],
  ["CANCELLED", "start", 409], ["CANCELLED", "complete", 409], ["CANCELLED", "cancel", 409],
])("API-07/08/09 state %s operation %s returns %i", async (status, operation, expected) => {
  const { actionRow } = await import("./support/actionFixture.js");
  mock.actionTaken.findFirst.mockResolvedValue(actionRow({ status, assignedToUserId: STAFF.id, assignedTo: STAFF }));
  const body = operation === "complete" ? { expectedVersion: 1, result: "Cable stable", followUpRequired: false, followUpNote: null }
    : operation === "cancel" ? { expectedVersion: 1, cancellationReason: "No longer needed" } : { expectedVersion: 1 };
  const response = await request(app).post(`/api/tickets/${TICKET_ID}/actions/${ACTION_ID}/${operation}`).set("Authorization", bearerToken(tokens, STAFF.id)).set("Idempotency-Key", randomUUID()).send(body);
  expect(response.status).toBe(expected);
  if (expected === 409) expect(response.body.code).toBe("INVALID_ACTION_TRANSITION");
});
it("API-06 permits unrelated Administrator assignment and appends ACTION_ASSIGNED", async () => {
  const response = await request(app).patch(`/api/tickets/${TICKET_ID}/actions/${ACTION_ID}/assignee`).set("Authorization", bearerToken(tokens, ADMIN.id)).send({ expectedVersion: 1, assignedToUserPublicId: STAFF.publicId });
  expect(response.status).toBe(200);
  expect(mock.actionTaken.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ assignedToUserId: STAFF.id, version: { increment: 1 } }) }));
  expect(mock.ticketActivity.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "ACTION_ASSIGNED" }) }));
});
it("assignment null-to-null returns unchanged Action without mutation, but stale version conflicts", async () => {
  const send = (version: number) => request(app).patch(`/api/tickets/${TICKET_ID}/actions/${ACTION_ID}/assignee`).set("Authorization", bearerToken(tokens, STAFF.id)).send({ expectedVersion: version, assignedToUserPublicId: null });
  expect((await send(1)).status).toBe(200);
  expect(mock.actionTaken.updateMany).not.toHaveBeenCalled(); expect(mock.ticketActivity.create).not.toHaveBeenCalled();
  expect((await send(2)).body.code).toBe("CONFLICT");
});
it("API-02 edit preserves omitted Result/Attachment Notes and writes occurrence-only Activity", async () => {
  const { assignedToUserPublicId: _assignee, attachmentNotes: _notes, ...fields } = createBody;
  const response = await request(app).patch(`/api/tickets/${TICKET_ID}/actions/${ACTION_ID}`).set("Authorization", bearerToken(tokens, STAFF.id)).send({ ...fields, expectedVersion: 1 });
  expect(response.status).toBe(200);
  const write = mock.actionTaken.updateMany.mock.calls[0][0];
  expect(write.data.description).toBe("Inspect cable");
  expect(write.data).not.toHaveProperty("result"); expect(write.data).not.toHaveProperty("attachmentNotes");
  expect(mock.ticketActivity.create.mock.calls[0][0].data.actionTaken.create).toEqual({ actionTakenId: 51 });
});

it.each(["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"])("API-01 Ticket create state %s", async (currentStatus) => {
  const { staffTicketRow } = await import("../lab-03/support/staffFixture.js");
  mock.ticket.findFirst.mockResolvedValue(staffTicketRow({ currentStatus }));
  const response = await request(app).post(`/api/tickets/${TICKET_ID}/actions`).set("Authorization", bearerToken(tokens, STAFF.id)).set("Idempotency-Key", randomUUID()).send(createBody);
  expect(response.status).toBe(["OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"].includes(currentStatus) ? 201 : 409);
  if (response.status === 409) { expect(response.body.code).toBe("INVALID_ACTION_TRANSITION"); expect(mock.actionTaken.create).not.toHaveBeenCalled(); }
});

it.each([
  ["post", "", "create"], ["patch", `/${ACTION_ID}`, "edit"], ["patch", `/${ACTION_ID}/assignee`, "assign"],
  ["post", `/${ACTION_ID}/start`, "start"], ["post", `/${ACTION_ID}/complete`, "complete"], ["post", `/${ACTION_ID}/cancel`, "cancel"],
  ["get", `/${ACTION_ID}/activity`, "activity"],
] as const)("API-05 Requester direct %s %s forbidden", async (method, suffix, _operation) => {
  const response = await request(app)[method](`/api/tickets/${TICKET_ID}/actions${suffix}`).set("Authorization", bearerToken(tokens, REQUESTER.id)).send({});
  expect(response.status).toBe(403); expect(response.body.code).toBe("FORBIDDEN");
  expect(mock.actionTaken.create).not.toHaveBeenCalled(); expect(mock.actionTaken.updateMany).not.toHaveBeenCalled(); expect(mock.ticketActivity.create).not.toHaveBeenCalled();
});
it("API-05 Requester Ticket Activity direct read forbidden", async () => {
  const response = await request(app).get(`/api/tickets/${TICKET_ID}/activity`).set("Authorization", bearerToken(tokens, REQUESTER.id));
  expect(response.status).toBe(403); expect(mock.ticketActivity.findMany).not.toHaveBeenCalled();
});
it.each([
  { description: " " }, { description: "😀".repeat(2001) }, { description: 1 }, { followUpRequired: "false" },
  { followUpRequired: true, followUpNote: null }, { followUpRequired: true, followUpNote: "😀".repeat(2001) },
  { attachmentNotes: "😀".repeat(2001) }, { assignedToUserPublicId: "bad" }, { attachmentIds: [ACTION_ID, ACTION_ID.toUpperCase()] },
  { attachmentIds: [5] }, { attachmentIds: null }, { result: "pre-filled" }, { creatorUserId: 1 }, { performedByUserPublicId: STAFF.publicId },
  { status: "COMPLETED" }, { createdAt: "2026-01-01T00:00:00Z" },
])("API-02 invalid create body %# causes no mutation", async (invalid) => {
  const response = await request(app).post(`/api/tickets/${TICKET_ID}/actions`).set("Authorization", bearerToken(tokens, STAFF.id)).set("Idempotency-Key", randomUUID()).send({ ...createBody, ...invalid });
  expect(response.status).toBe(400); expect(response.body.code).toBe("VALIDATION_ERROR"); expect(response.body.details).toEqual(expect.any(Array));
  expect(mock.actionTaken.create).not.toHaveBeenCalled(); expect(mock.ticketActivity.create).not.toHaveBeenCalled();
});
it.each([undefined, "bad-key"])("API-01 key required/UUID", async (key) => {
  let call = request(app).post(`/api/tickets/${TICKET_ID}/actions`).set("Authorization", bearerToken(tokens, STAFF.id));
  if (key) call = call.set("Idempotency-Key", key);
  const response = await call.send(createBody);
  expect(response.status).toBe(400); expect(response.body.details[0].field).toBe("Idempotency-Key"); expect(mock.actionTaken.create).not.toHaveBeenCalled();
});
it.each(["edit", "assignee", "start", "complete", "cancel"])("API-10 stale %s conflicts without update", async (operation) => {
  const { assignedToUserPublicId: _assignee, ...editable } = createBody;
  const body = operation === "edit" ? { ...editable, expectedVersion: 2 } : operation === "assignee" ? { assignedToUserPublicId: null, expectedVersion: 2 }
    : operation === "complete" ? { result: "Done", followUpRequired: false, expectedVersion: 2 } : operation === "cancel" ? { cancellationReason: "Unneeded", expectedVersion: 2 } : { expectedVersion: 2 };
  const suffix = operation === "edit" ? "" : `/${operation}`;
  const method = operation === "edit" || operation === "assignee" ? "patch" : "post";
  const response = await request(app)[method](`/api/tickets/${TICKET_ID}/actions/${ACTION_ID}${suffix}`).set("Authorization", bearerToken(tokens, STAFF.id)).set("Idempotency-Key", randomUUID()).send(body);
  expect(response.status).toBe(409); expect(response.body.code).toBe("CONFLICT"); expect(mock.actionTaken.updateMany).not.toHaveBeenCalled();
});
it.each([STAFF, ADMIN])("API-10 unrelated $role edit stays forbidden with stale or current version", async (user) => {
  const { staffTicketRow } = await import("../lab-03/support/staffFixture.js");
  const authorized = user === STAFF ? ADMIN : STAFF;
  mock.ticket.findFirst.mockResolvedValue(staffTicketRow({ ownerUserId: authorized.id }));
  mock.actionTaken.findFirst.mockResolvedValue(actionRow({ version: 2, creatorUserId: authorized.id, assignedToUserId: authorized.id, assignedTo: authorized }));
  const { assignedToUserPublicId: _assignee, ...editable } = createBody;
  for (const expectedVersion of [1, 2]) {
    const response = await request(app).patch(`/api/tickets/${TICKET_ID}/actions/${ACTION_ID}`).set("Authorization", bearerToken(tokens, user.id)).send({ ...editable, expectedVersion });
    expect(response.status).toBe(403); expect(response.body.code).toBe("FORBIDDEN");
  }
  expect(mock.actionTaken.updateMany).not.toHaveBeenCalled();
  expect(mock.actionTakenAttachment.deleteMany).not.toHaveBeenCalled(); expect(mock.actionTakenAttachment.createMany).not.toHaveBeenCalled();
  expect(mock.ticketActivity.create).not.toHaveBeenCalled();
});
it.each([STAFF, ADMIN].flatMap((user) => (["start", "complete", "cancel"] as const).map((operation) => ({ user, operation }))))("API-10 unrelated $user.role $operation stays forbidden with stale or current version", async ({ user, operation }) => {
  const { staffTicketRow } = await import("../lab-03/support/staffFixture.js");
  const authorized = user === STAFF ? ADMIN : STAFF;
  mock.ticket.findFirst.mockResolvedValue(staffTicketRow({ ownerUserId: authorized.id }));
  mock.actionTaken.findFirst.mockResolvedValue(actionRow({ version: 2, status: operation === "complete" ? "IN_PROGRESS" : "PLANNED", creatorUserId: authorized.id, assignedToUserId: authorized.id, assignedTo: authorized }));
  for (const expectedVersion of [1, 2]) {
    const body = operation === "complete" ? { expectedVersion, result: "Denied completion", followUpRequired: false }
      : operation === "cancel" ? { expectedVersion, cancellationReason: "Denied cancellation" } : { expectedVersion };
    const response = await request(app).post(`/api/tickets/${TICKET_ID}/actions/${ACTION_ID}/${operation}`).set("Authorization", bearerToken(tokens, user.id)).set("Idempotency-Key", randomUUID()).send(body);
    expect(response.status).toBe(403); expect(response.body.code).toBe("FORBIDDEN");
  }
  expect(mock.actionTaken.updateMany).not.toHaveBeenCalled(); expect(mock.ticketActivity.create).not.toHaveBeenCalled();
  expect(mock.idempotencyRecord.update).not.toHaveBeenCalled(); expect(mock.idempotencyRecord.deleteMany).toHaveBeenCalledTimes(2);
});
it.each(["COMPLETED", "CANCELLED"])("API-10 terminal %s edit/assignment forbidden", async (status) => {
  mock.actionTaken.findFirst.mockResolvedValue(actionRow({ status }));
  const { assignedToUserPublicId: _assignee, ...editable } = createBody;
  for (const [suffix, body] of [["", { ...editable, expectedVersion: 1 }], ["/assignee", { assignedToUserPublicId: null, expectedVersion: 1 }]] as const) {
    const response = await request(app).patch(`/api/tickets/${TICKET_ID}/actions/${ACTION_ID}${suffix}`).set("Authorization", bearerToken(tokens, STAFF.id)).send(body);
    expect(response.status).toBe(409); expect(response.body.code).toBe("INVALID_ACTION_TRANSITION");
  }
  expect(mock.actionTaken.updateMany).not.toHaveBeenCalled(); expect(mock.actionTakenAttachment.deleteMany).not.toHaveBeenCalled();
});
it("API-07 unassigned Start invalid transition; wrong actor forbidden", async () => {
  const send = () => request(app).post(`/api/tickets/${TICKET_ID}/actions/${ACTION_ID}/start`).set("Authorization", bearerToken(tokens, STAFF.id)).set("Idempotency-Key", randomUUID()).send({ expectedVersion: 1 });
  expect((await send()).body.code).toBe("INVALID_ACTION_TRANSITION");
  mock.actionTaken.findFirst.mockResolvedValue(actionRow({ assignedToUserId: ADMIN.id, assignedTo: ADMIN }));
  expect((await send()).body.code).toBe("FORBIDDEN"); expect(mock.actionTaken.updateMany).not.toHaveBeenCalled();
});
it("API-06 unavailable/ineligible selected assignee rejected", async () => {
  // A real eligibility predicate yields no row for each invalid target; PG-04 verifies all actual rows.
  mock.user.findFirst.mockResolvedValue(null);
  const response = await request(app).patch(`/api/tickets/${TICKET_ID}/actions/${ACTION_ID}/assignee`).set("Authorization", bearerToken(tokens, STAFF.id)).send({ assignedToUserPublicId: ADMIN.publicId, expectedVersion: 1 });
  expect(response.status).toBe(400); expect(response.body.details[0].field).toBe("assignedToUserPublicId"); expect(mock.actionTaken.updateMany).not.toHaveBeenCalled();
});
it.each(["reassign", "unassign", "same"])("API-06 %s Activity and version behavior", async (operation) => {
  mock.actionTaken.findFirst.mockResolvedValue(actionRow({ assignedToUserId: STAFF.id, assignedTo: STAFF }));
  const response = await request(app).patch(`/api/tickets/${TICKET_ID}/actions/${ACTION_ID}/assignee`).set("Authorization", bearerToken(tokens, ADMIN.id)).send({ expectedVersion: 1, assignedToUserPublicId: operation === "unassign" ? null : operation === "same" ? STAFF.publicId : ADMIN.publicId });
  expect(response.status).toBe(200);
  if (operation === "same") { expect(mock.ticketActivity.create).not.toHaveBeenCalled(); expect(mock.actionTaken.updateMany).not.toHaveBeenCalled(); }
  else expect(mock.ticketActivity.create.mock.calls[0][0].data).toMatchObject({ action: operation === "unassign" ? "ACTION_UNASSIGNED" : "ACTION_REASSIGNED", actionTaken: { create: { previousAssignedToUserId: STAFF.id, assignedToUserId: operation === "unassign" ? null : ADMIN.id } } });
});
it.each(["staff", "requester"])("API-04 %s malformed/cross-parent resources return safe 404", async (audience) => {
  const prefix = audience === "requester" ? "/api/users/me" : "/api";
  const user = audience === "requester" ? REQUESTER : STAFF;
  for (const path of [`${prefix}/tickets/bad/actions`, `${prefix}/tickets/${TICKET_ID}/actions/bad`]) {
    const response = await request(app).get(path).set("Authorization", bearerToken(tokens, user.id));
    expect(response.status).toBe(404); expect(response.body.code).toBe("NOT_FOUND");
  }
  mock.actionTaken.findFirst.mockResolvedValue(null);
  expect((await request(app).get(`${prefix}/tickets/${TICKET_ID}/actions/${ACTION_ID}`).set("Authorization", bearerToken(tokens, user.id))).status).toBe(404);
  mock.ticket.findFirst.mockResolvedValue(null);
  expect((await request(app).get(`${prefix}/tickets/${TICKET_ID}/actions`).set("Authorization", bearerToken(tokens, user.id))).status).toBe(404);
});
it.each(["/api", "/api/users/me"])("API-03 %s migrated list bounded and query validation safe", async (prefix) => {
  mock.actionTaken.findMany.mockResolvedValue([actionRow({ isMigrated: true, status: "COMPLETED" })]);
  const user = prefix.endsWith("me") ? REQUESTER : STAFF;
  const response = await request(app).get(`${prefix}/tickets/${TICKET_ID}/actions`).set("Authorization", bearerToken(tokens, user.id));
  expect(response.body[0]).toMatchObject({ isMigrated: true, status: "COMPLETED" });
  expect(Object.keys(response.body[0]).sort()).toEqual(["publicId", "ticketPublicId", "status", "description", "assignedTo", "performedBy", "followUpRequired", "isMigrated", "createdAt", "updatedAt", "version"].sort());
  const invalid = await request(app).get(`${prefix}/tickets/${TICKET_ID}/actions?sort=creator:asc`).set("Authorization", bearerToken(tokens, user.id));
  expect(invalid.status).toBe(400);
});
it.each(["creator", "assignee", "owner", "admin-owner", "unrelated-staff", "unrelated-admin"])("actor matrix %s obeys every Action authority", async (kind) => {
  const { testUser } = await import("../lab-02/support/authenticatedRequester.js");
  const { staffTicketRow } = await import("../lab-03/support/staffFixture.js");
  const assignee = { ...testUser({ id: 21, name: "Assignee", email: "assignee@example.test" }), role: "IT_STAFF" as const };
  const owner = { ...testUser({ id: 22, name: "Owner", email: "owner@example.test" }), role: "IT_STAFF" as const };
  const adminOwner = { ...testUser({ id: 23, name: "Admin Owner", email: "admin-owner@example.test" }), role: "ADMINISTRATOR" as const };
  const unrelated = { ...testUser({ id: 24, name: "Unrelated", email: "unrelated@example.test" }), role: "IT_STAFF" as const };
  const selected = kind === "creator" ? STAFF : kind === "assignee" ? assignee : kind === "owner" ? owner : kind === "admin-owner" ? adminOwner : kind === "unrelated-staff" ? unrelated : ADMIN;
  tokens = await configureRequesterAuth(mock, [STAFF, ADMIN, REQUESTER, assignee, owner, adminOwner, unrelated]);
  mock.ticket.findFirst.mockResolvedValue(staffTicketRow({ currentStatus: "OPEN", ownerUserId: kind === "admin-owner" ? adminOwner.id : owner.id }));
  mock.ticketActivity.count.mockResolvedValue(0);
  const base = `/api/tickets/${TICKET_ID}/actions`;
  const auth = bearerToken(tokens, selected.id);
  expect((await request(app).get(`${base}/${ACTION_ID}`).set("Authorization", auth)).status).toBe(200);
  expect((await request(app).get(`/api/tickets/${TICKET_ID}/activity`).set("Authorization", auth)).status).toBe(200);
  expect((await request(app).post(base).set("Authorization", auth).set("Idempotency-Key", randomUUID()).send(createBody)).status).toBe(201);
  const permittedEdit = ["creator", "assignee", "owner", "admin-owner"].includes(kind);
  const { assignedToUserPublicId: _id, ...editable } = createBody;
  for (const operation of ["edit", "assignee", "start", "complete", "cancel"] as const) {
    mock.actionTaken.findFirst.mockResolvedValue(actionRow({ assignedToUserId: assignee.id, assignedTo: assignee, status: operation === "complete" ? "IN_PROGRESS" : "PLANNED" }));
    const body = operation === "edit" ? { ...editable, expectedVersion: 1 } : operation === "assignee" ? { assignedToUserPublicId: null, expectedVersion: 1 }
      : operation === "complete" ? { result: "Done", followUpRequired: false, expectedVersion: 1 } : operation === "cancel" ? { cancellationReason: "No longer needed", expectedVersion: 1 } : { expectedVersion: 1 };
    const method = operation === "edit" || operation === "assignee" ? "patch" : "post";
    const allowed = operation === "assignee" || (operation === "start" ? kind === "assignee" : operation === "complete" ? ["assignee", "owner", "admin-owner"].includes(kind) : permittedEdit);
    const response = await request(app)[method](`${base}/${ACTION_ID}${operation === "edit" ? "" : `/${operation}`}`).set("Authorization", auth).set("Idempotency-Key", randomUUID()).send(body);
    expect(response.status, `${kind} ${operation}`).toBe(allowed ? 200 : 403);
  }
});

function persistentClaims() {
  const claims = new Map<string, Record<string, unknown>>();
  const identity = (value: Record<string, unknown>) => JSON.stringify([value.userId, value.method, value.resourcePath, value.key]);
  mock.idempotencyRecord.findUnique.mockImplementation(async ({ where }: { where: { userId_method_resourcePath_key: Record<string, unknown> } }) => claims.get(identity(where.userId_method_resourcePath_key)) ?? null);
  mock.idempotencyRecord.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
    const row = { ...data, id: 61 + claims.size, ticketId: null, actionTakenId: null, expiresAt: null };
    claims.set(identity(data), row); return row;
  });
  mock.idempotencyRecord.update.mockImplementation(async ({ where, data }: { where: { id: number }; data: Record<string, unknown> }) => {
    const row = [...claims.values()].find((entry) => entry.id === where.id)!;
    Object.assign(row, data); return row;
  });
  return claims;
}
it("API-11 create same normalized request replays; changed payload conflicts", async () => {
  persistentClaims();
  const key = randomUUID();
  const send = (description: string) => request(app).post(`/api/tickets/${TICKET_ID}/actions`).set("Authorization", bearerToken(tokens, STAFF.id)).set("Idempotency-Key", key).send({ ...createBody, description });
  expect((await send(" Inspect cable ")).status).toBe(201);
  expect((await send("Inspect cable")).status).toBe(200);
  const conflict = await send("Different cable"); expect(conflict.status).toBe(409); expect(conflict.body.code).toBe("IDEMPOTENCY_CONFLICT");
  expect(mock.actionTaken.create).toHaveBeenCalledTimes(1); expect(mock.ticketActivity.create).toHaveBeenCalledTimes(1);
});
it.each(["start", "complete", "cancel"] as const)("API-12 %s completed replay precedes stale version/state", async (operation) => {
  persistentClaims();
  const key = randomUUID();
  const body = operation === "complete" ? { expectedVersion: 1, result: "Done", followUpRequired: false } : operation === "cancel" ? { expectedVersion: 1, cancellationReason: "No need" } : { expectedVersion: 1 };
  mock.actionTaken.findFirst.mockResolvedValue(actionRow({ status: operation === "complete" ? "IN_PROGRESS" : "PLANNED", assignedToUserId: STAFF.id, assignedTo: STAFF }));
  const send = () => request(app).post(`/api/tickets/${TICKET_ID}/actions/${ACTION_ID}/${operation}`).set("Authorization", bearerToken(tokens, STAFF.id)).set("Idempotency-Key", key).send(body);
  expect((await send()).status).toBe(200);
  mock.actionTaken.findFirst.mockResolvedValue(actionRow({ status: operation === "start" ? "IN_PROGRESS" : operation === "complete" ? "COMPLETED" : "CANCELLED", version: 2 }));
  expect((await send()).status).toBe(200);
  expect(mock.actionTaken.updateMany).toHaveBeenCalledTimes(1); expect(mock.ticketActivity.create).toHaveBeenCalledTimes(1);
});
it("API-21 same actor/key/body creates independent concrete Ticket results", async () => {
  const claims = persistentClaims();
  const { staffTicketRow } = await import("../lab-03/support/staffFixture.js");
  const secondTicket = "10000000-0000-4000-8000-000000000022";
  const key = randomUUID();
  const results: ReturnType<typeof actionRow>[] = [];
  mock.ticket.findFirst.mockImplementation(async ({ where }: { where: { publicId: string } }) => staffTicketRow({ id: where.publicId === TICKET_ID ? 31 : 32, publicId: where.publicId, currentStatus: "OPEN" }));
  mock.actionTaken.create.mockImplementation(async ({ data }: { data: { ticketId: number } }) => {
    const row = actionRow({ id: 51 + results.length, publicId: randomUUID(), ticket: { publicId: data.ticketId === 31 ? TICKET_ID : secondTicket } }); results.push(row); return row;
  });
  mock.actionTaken.findFirst.mockImplementation(async ({ where }: { where: { id: number } }) => results.find((row) => row.id === where.id));
  for (const [index, ticket] of [TICKET_ID, secondTicket, TICKET_ID, secondTicket].entries()) {
    const response = await request(app).post(`/api/tickets/${ticket.toUpperCase()}/actions/?ignored=yes`).set("Authorization", bearerToken(tokens, STAFF.id)).set("Idempotency-Key", key).send(createBody);
    expect(response.status).toBe(index < 2 ? 201 : 200);
    expect(response.body.ticketPublicId).toBe(ticket);
  }
  expect(results).toHaveLength(2); expect(claims.size).toBe(2); expect(results[0].publicId).not.toBe(results[1].publicId);
});
it("API-21 same actor/key/body Start has independent concrete Action results", async () => {
  const claims = persistentClaims();
  const otherAction = "20000000-0000-4000-8000-000000000022";
  const key = randomUUID();
  let current = ACTION_ID;
  mock.actionTaken.findFirst.mockImplementation(async () => actionRow({ id: current === ACTION_ID ? 51 : 52, publicId: current, assignedToUserId: STAFF.id, assignedTo: STAFF }));
  for (const id of [ACTION_ID, otherAction, ACTION_ID, otherAction]) {
    current = id;
    const response = await request(app).post(`/api/tickets/${TICKET_ID}/actions/${id}/start`).set("Authorization", bearerToken(tokens, STAFF.id)).set("Idempotency-Key", key).send({ expectedVersion: 1 });
    expect(response.status).toBe(200); expect(response.body.publicId).toBe(id);
  }
  expect(claims.size).toBe(2); expect(mock.actionTaken.updateMany).toHaveBeenCalledTimes(2); expect(mock.ticketActivity.create).toHaveBeenCalledTimes(2);
});
it("database serialization failure maps to safe 409 CONFLICT", async () => {
  mock.actionTaken.updateMany.mockRejectedValue({ code: "P2034", message: "private SQL" });
  const response = await request(app).patch(`/api/tickets/${TICKET_ID}/actions/${ACTION_ID}/assignee`).set("Authorization", bearerToken(tokens, STAFF.id)).send({ expectedVersion: 1, assignedToUserPublicId: STAFF.publicId });
  expect(response.status).toBe(409); expect(response.body.code).toBe("CONFLICT"); expect(JSON.stringify(response.body)).not.toContain("SQL");
});
it("no-op same assignee returns unchanged even when target no longer eligible; no mutation revalidation", async () => {
  mock.actionTaken.findFirst.mockResolvedValue(actionRow({ assignedToUserId: STAFF.id, assignedTo: STAFF }));
  mock.user.findFirst.mockResolvedValue(null);
  const response = await request(app).patch(`/api/tickets/${TICKET_ID}/actions/${ACTION_ID}/assignee`).set("Authorization", bearerToken(tokens, ADMIN.id)).send({ expectedVersion: 1, assignedToUserPublicId: STAFF.publicId });
  expect(response.status).toBe(200); expect(mock.user.findFirst).not.toHaveBeenCalled(); expect(mock.actionTaken.updateMany).not.toHaveBeenCalled();
});
it.each([
  ["edit", { description: " ", followUpRequired: false, attachmentIds: [], expectedVersion: 1 }],
  ["edit", { description: "Valid", followUpRequired: false, attachmentIds: [], result: " ", expectedVersion: 1 }],
  ["edit", { description: "Valid", followUpRequired: false, attachmentIds: [], assignedToUserPublicId: null, expectedVersion: 1 }],
  ["edit", { description: "Valid", followUpRequired: false, expectedVersion: 1 }],
  ["edit", { description: "Valid", followUpRequired: true, followUpNote: " ", attachmentIds: [], expectedVersion: 1 }],
  ["complete", { result: " ", followUpRequired: false, expectedVersion: 1 }],
  ["complete", { result: "😀".repeat(2001), followUpRequired: false, expectedVersion: 1 }],
  ["complete", { result: "Valid", followUpRequired: true, followUpNote: null, expectedVersion: 1 }],
  ["complete", { result: "Valid", followUpRequired: false, performedByUserId: 11, expectedVersion: 1 }],
  ["cancel", { cancellationReason: " ", expectedVersion: 1 }],
  ["cancel", { cancellationReason: "😀".repeat(501), expectedVersion: 1 }],
  ["start", { startedAt: "2026-01-01T00:00:00Z", expectedVersion: 1 }],
] as const)("API-02 invalid %s body %# rejects without update", async (operation, body) => {
  const method = operation === "edit" ? "patch" : "post";
  const response = await request(app)[method](`/api/tickets/${TICKET_ID}/actions/${ACTION_ID}${operation === "edit" ? "" : `/${operation}`}`).set("Authorization", bearerToken(tokens, STAFF.id)).set("Idempotency-Key", randomUUID()).send(body);
  expect(response.status).toBe(400); expect(response.body.code).toBe("VALIDATION_ERROR"); expect(mock.actionTaken.updateMany).not.toHaveBeenCalled(); expect(mock.ticketActivity.create).not.toHaveBeenCalled();
});
it.each([undefined, 0, -1, 1.5, "1", Number.MAX_SAFE_INTEGER + 1])("invalid expectedVersion %s rejected safely", async (expectedVersion) => {
  const response = await request(app).post(`/api/tickets/${TICKET_ID}/actions/${ACTION_ID}/start`).set("Authorization", bearerToken(tokens, STAFF.id)).set("Idempotency-Key", randomUUID()).send({ expectedVersion });
  expect(response.status).toBe(400); expect(response.body.details[0].field).toBe("expectedVersion"); expect(mock.actionTaken.updateMany).not.toHaveBeenCalled();
});
it("No generic status/assignment edit, Action delete, or arbitrary status endpoint", async () => {
  const auth = bearerToken(tokens, STAFF.id); const path = `/api/tickets/${TICKET_ID}/actions/${ACTION_ID}`;
  expect((await request(app).delete(path).set("Authorization", auth)).status).toBe(404);
  expect((await request(app).patch(`${path}/status`).set("Authorization", auth).send({ status: "COMPLETED" })).status).toBe(404);
  expect((await request(app).patch(path).set("Authorization", auth).send({ status: "COMPLETED", expectedVersion: 1 })).status).toBe(400);
  expect(mock.actionTaken.updateMany).not.toHaveBeenCalled();
});
it("Authentication required on new Action routes", async () => {
  expect((await request(app).get(`/api/tickets/${TICKET_ID}/actions`)).status).toBe(401);
  expect((await request(app).post(`/api/tickets/${TICKET_ID}/actions`).send(createBody)).status).toBe(401);
});
