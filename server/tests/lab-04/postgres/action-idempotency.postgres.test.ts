import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { parseActionCreate } from "../../../src/services/actionTakenService.js";
import { hashIdempotencyRequest } from "../../../src/services/idempotencyRequest.js";
import { actionDatabase, type ActionDatabase } from "../support/actionDatabase.js";
import { createBody } from "../support/actionFixture.js";
let database: ActionDatabase;
beforeAll(async () => { database = await actionDatabase(); }, 120_000);
afterAll(async () => database?.close());
it("PG-07 persistent create identity/replay/conflict plus actor isolation", async () => {
  const { first, service, staff, other } = database;
  const ticket = await database.ticket(); const key = randomUUID();
  const body = { ...createBody, assignedToUserPublicId: staff.userPublicId };
  const firstResult = await service.create(staff, ticket.publicId, body, key);
  const replay = await service.create(staff, ticket.publicId.toUpperCase(), { ...body, description: "Inspect cable" }, key);
  expect(firstResult.status).toBe(201); expect(replay.status).toBe(200); expect(replay.action.publicId).toBe(firstResult.action.publicId);
  await expect(service.create(staff, ticket.publicId, { ...body, description: "Other work" }, key)).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  expect(await first.actionTaken.count({ where: { ticketId: ticket.id } })).toBe(1);
  const identity = await first.idempotencyRecord.findUniqueOrThrow({ where: { userId_method_resourcePath_key: { userId: staff.userId, method: "POST", resourcePath: `/api/tickets/${ticket.publicId}/actions`, key } } });
  expect(identity).toMatchObject({ status: "COMPLETED", ticketId: null, actionTakenId: expect.any(Number), completedAt: expect.any(Date), expiresAt: expect.any(Date) });
  const actorResult = await service.create(other, ticket.publicId, body, key);
  expect(actorResult.status).toBe(201); expect(actorResult.action.publicId).not.toBe(firstResult.action.publicId);
  expect(await first.ticketActivity.count({ where: { ticketId: ticket.id } })).toBe(2);
  await first.ticket.update({ where: { id: ticket.id }, data: { currentStatus: "CLOSED" } });
  expect((await service.create(staff, ticket.publicId, body, key)).status).toBe(200);
});
it("PG-08 concurrent same-key Create/Start/Complete/Cancel commit exactly once and replay before stale checks", async () => {
  const { first, service, secondService, staff } = database;
  const ticket = await database.ticket(); const key = randomUUID();
  const body = { ...createBody, assignedToUserPublicId: staff.userPublicId };
  const creates = await Promise.all([service.create(staff, ticket.publicId, body, key), secondService.create(staff, ticket.publicId, body, key)]);
  expect(creates.map((result) => result.status).sort()).toEqual([200, 201]);
  expect(creates[0].action.publicId).toBe(creates[1].action.publicId);
  for (const operation of ["start", "complete", "cancel"] as const) {
    const action = operation === "cancel" ? (await database.create(ticket.publicId)).action : creates[0].action;
    const payload = operation === "complete" ? { expectedVersion: 2, result: "Stable", followUpRequired: false } : operation === "cancel" ? { expectedVersion: 1, cancellationReason: "Unneeded" } : { expectedVersion: 1 };
    const lifecycleKey = randomUUID();
    const results = await Promise.all([
      service.lifecycle(staff, ticket.publicId, action.publicId, operation, payload, lifecycleKey),
      secondService.lifecycle(staff, ticket.publicId, action.publicId, operation, payload, lifecycleKey),
    ]);
    expect(results.every((result) => result.status === 200)).toBe(true); expect(results[0].action.version).toBe(payload.expectedVersion + 1);
    expect((await service.lifecycle(staff, ticket.publicId, action.publicId, operation, payload, lifecycleKey)).action.publicId).toBe(action.publicId);
    await expect(service.lifecycle(staff, ticket.publicId, action.publicId, operation, { ...payload, expectedVersion: payload.expectedVersion + 1 }, lifecycleKey)).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    const type = operation === "start" ? "ACTION_STARTED" : operation === "complete" ? "ACTION_COMPLETED" : "ACTION_CANCELLED";
    expect(await first.ticketActivity.count({ where: { ticketId: ticket.id, action: type } })).toBe(1);
  }
  expect(await first.actionTaken.count({ where: { ticketId: ticket.id } })).toBe(2);
});
it("PG-16 same actor/key/body against two Ticket paths and two Action paths never cross-replays", async () => {
  const { first, service, staff } = database;
  const tickets = await Promise.all([database.ticket(), database.ticket()]); const key = randomUUID();
  const body = { ...createBody, assignedToUserPublicId: staff.userPublicId };
  const results = [];
  for (const ticket of tickets) results.push(await service.create(staff, ticket.publicId, body, key));
  expect(results[0].action.publicId).not.toBe(results[1].action.publicId);
  for (const [index, ticket] of tickets.entries()) {
    const replay = await service.create(staff, ticket.publicId, body, key);
    expect(replay.action.publicId).toBe(results[index].action.publicId); expect(replay.action.ticketPublicId).toBe(ticket.publicId);
  }
  const sameTicketOther = (await database.create(tickets[0].publicId)).action;
  const startKey = randomUUID();
  for (const action of [results[0].action, sameTicketOther]) {
    const started = await service.lifecycle(staff, tickets[0].publicId, action.publicId, "start", { expectedVersion: 1 }, startKey);
    expect(started.action.publicId).toBe(action.publicId);
  }
  for (const action of [results[0].action, sameTicketOther]) expect((await service.lifecycle(staff, tickets[0].publicId, action.publicId, "start", { expectedVersion: 1 }, startKey)).action.publicId).toBe(action.publicId);
  expect(await first.idempotencyRecord.count({ where: { userId: staff.userId, key: startKey } })).toBe(2);
});
it("PROCESSING fencing recovery and completed expiry preserve existing policy", async () => {
  const { first, service, staff } = database;
  const ticket = await database.ticket(); const key = randomUUID(); const resourcePath = `/api/tickets/${ticket.publicId}/actions`;
  const body = { ...createBody, assignedToUserPublicId: null };
  const claim = await first.idempotencyRecord.create({ data: { userId: staff.userId, method: "POST", resourcePath, key, requestHash: hashIdempotencyRequest("POST", resourcePath, parseActionCreate(body)), status: "PROCESSING", processingStartedAt: new Date(Date.now() - 300_000), createdBy: staff.email, updatedBy: staff.email } });
  const recovered = await service.create(staff, ticket.publicId, body, key); expect(recovered.status).toBe(201);
  expect((await first.idempotencyRecord.findUniqueOrThrow({ where: { id: claim.id } })).status).toBe("COMPLETED");
  const expiredAt = new Date(Date.now() - 1);
  await first.idempotencyRecord.update({ where: { id: claim.id }, data: { completedAt: new Date(expiredAt.getTime() - 86_400_000), expiresAt: expiredAt } });
  const fresh = await service.create(staff, ticket.publicId, body, key);
  expect(fresh.status).toBe(201); expect(fresh.action.publicId).not.toBe(recovered.action.publicId);
  expect(await first.actionTaken.count({ where: { ticketId: ticket.id } })).toBe(2);
});
