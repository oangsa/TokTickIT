import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import type { Prisma, PrismaClient } from "../../../src/generated/prisma/client.js";
import { ActionTakenService } from "../../../src/services/actionTakenService.js";
import { listTicketActivity } from "../../../src/services/ticketActivityService.js";
import { actionDatabase, type ActionDatabase } from "../support/actionDatabase.js";
import { createBody } from "../support/actionFixture.js";
let database: ActionDatabase;
beforeAll(async () => { database = await actionDatabase(); }, 120_000);
afterAll(async () => database?.close());
function rejectActivity() {
  // Inject an actual PostgreSQL foreign-key rejection after business/joins writes.
  return database.first.$extends({ query: { ticketActivity: { async create({ args, query }) {
    (args.data as Prisma.TicketActivityUncheckedCreateInput).performedByUserId = -1;
    return query(args);
  } } } }) as unknown as PrismaClient;
}
function rejectIdempotencyResult() {
  return database.first.$extends({ query: { idempotencyRecord: { async update({ args, query }) {
    (args.data as Prisma.IdempotencyRecordUncheckedUpdateInput).actionTakenId = -1;
    return query(args);
  } } } }) as unknown as PrismaClient;
}
it("PG-10 real Activity FK failure rolls back Create, joins and idempotency result", async () => {
  const { first, staff } = database;
  const ticket = await database.ticket(); const file = await database.file(ticket.id); const key = randomUUID();
  await expect(database.create(ticket.publicId, staff.userPublicId, [file.storageKey], key, rejectActivity())).rejects.toThrow();
  expect(await first.actionTaken.count({ where: { ticketId: ticket.id } })).toBe(0);
  expect(await first.actionTakenAttachment.count({ where: { attachmentId: file.id } })).toBe(0);
  expect(await first.ticketActivity.count({ where: { ticketId: ticket.id } })).toBe(0);
  expect(await first.idempotencyRecord.count({ where: { userId: staff.userId, key } })).toBe(0);
  expect((await database.create(ticket.publicId, staff.userPublicId, [file.storageKey], key)).status).toBe(201);
});
it("PG-10 Activity failure rolls back edit plus desired join diff and assignment", async () => {
  const { first, staff, admin } = database;
  const ticket = await database.ticket(); const oldFile = await database.file(ticket.id); const newFile = await database.file(ticket.id);
  const action = (await database.create(ticket.publicId, staff.userPublicId, [oldFile.storageKey])).action;
  const saved = await first.actionTaken.findUniqueOrThrow({ where: { publicId: action.publicId } });
  const joins = await first.actionTakenAttachment.findMany({ where: { actionTakenId: saved.id } });
  const failing = new ActionTakenService(rejectActivity());
  const { assignedToUserPublicId: _id, ...editable } = createBody;
  await expect(failing.edit(staff, ticket.publicId, action.publicId, { ...editable, description: "Should roll back", attachmentIds: [newFile.storageKey], expectedVersion: 1 })).rejects.toThrow();
  expect(await first.actionTaken.findUniqueOrThrow({ where: { id: saved.id } })).toEqual(saved);
  expect(await first.actionTakenAttachment.findMany({ where: { actionTakenId: saved.id } })).toEqual(joins);
  await expect(failing.assign(admin, ticket.publicId, action.publicId, { assignedToUserPublicId: admin.userPublicId, expectedVersion: 1 })).rejects.toThrow();
  expect(await first.actionTaken.findUniqueOrThrow({ where: { id: saved.id } })).toEqual(saved);
  expect(await first.ticketActivity.count({ where: { ticketId: ticket.id } })).toBe(1);
});
it.each(["start", "complete", "cancel"] as const)("PG-10 failed idempotency completion rolls back %s, performer/timestamps and Activity", async (operation) => {
  const { first, staff, service } = database;
  const ticket = await database.ticket(); const action = (await database.create(ticket.publicId)).action;
  if (operation === "complete") await service.lifecycle(staff, ticket.publicId, action.publicId, "start", { expectedVersion: 1 }, randomUUID());
  const saved = await first.actionTaken.findUniqueOrThrow({ where: { publicId: action.publicId } }); const key = randomUUID();
  const count = await first.ticketActivity.count({ where: { ticketId: ticket.id } });
  const body = operation === "complete" ? { expectedVersion: saved.version, result: "Should not commit", followUpRequired: true, followUpNote: "Should not commit" } : operation === "cancel" ? { expectedVersion: saved.version, cancellationReason: "Should not commit" } : { expectedVersion: saved.version };
  await expect(new ActionTakenService(rejectIdempotencyResult()).lifecycle(staff, ticket.publicId, action.publicId, operation, body, key)).rejects.toThrow();
  expect(await first.actionTaken.findUniqueOrThrow({ where: { id: saved.id } })).toEqual(saved);
  expect(await first.ticketActivity.count({ where: { ticketId: ticket.id } })).toBe(count);
  expect(await first.idempotencyRecord.count({ where: { userId: staff.userId, key } })).toBe(0);
  expect((await service.lifecycle(staff, ticket.publicId, action.publicId, operation, body, key)).action.version).toBe(saved.version + 1);
});
it("PG-10 typed append-only service history, Action parent scope, categories and deterministic paging", async () => {
  const { first, service, staff, other, requester } = database;
  const ticket = await database.ticket(); const action = (await database.create(ticket.publicId, null)).action;
  const secondAction = (await database.create(ticket.publicId, null)).action;
  const assigned = await service.assign(other, ticket.publicId, action.publicId, { expectedVersion: 1, assignedToUserPublicId: staff.userPublicId });
  const { assignedToUserPublicId: _id, ...editable } = createBody;
  const edited = await service.edit(staff, ticket.publicId, action.publicId, { ...editable, expectedVersion: assigned.version });
  await service.lifecycle(staff, ticket.publicId, action.publicId, "start", { expectedVersion: edited.version }, randomUUID());
  const workflow = await first.ticketActivity.create({ data: { ticketId: ticket.id, performedByUserId: requester.userId, action: "REQUESTER_RESOLUTION_CONFIRMED", createdBy: "test", updatedBy: "test" } });
  const activities = await listTicketActivity(first, staff, ticket.publicId, { sort: "createdAt:asc" }, action.publicId);
  expect(activities.items.map((item) => item.action)).toEqual(["ACTION_CREATED", "ACTION_ASSIGNED", "ACTION_UPDATED", "ACTION_STARTED"]);
  expect(activities.items.every((item) => item.actionTaken?.publicId === action.publicId)).toBe(true);
  expect(activities.items[1].actionTaken).toMatchObject({ previousAssignedTo: null, assignedTo: { publicId: staff.userPublicId } });
  const untouched = await listTicketActivity(first, staff, ticket.publicId, {}, secondAction.publicId); expect(untouched.pagination.totalItems).toBe(1);
  const assignment = await listTicketActivity(first, staff, ticket.publicId, { filters: JSON.stringify([{ field: "category", condition: "EQUAL", value: "Assignment" }]) });
  expect(assignment.items.map((item) => item.action)).toEqual(["ACTION_ASSIGNED"]);
  const ticketWorkflow = await listTicketActivity(first, staff, ticket.publicId, { filters: JSON.stringify([{ field: "category", condition: "EQUAL", value: "Ticket Workflow" }]) });
  expect(ticketWorkflow.items.map((item) => item.publicId)).toEqual([workflow.publicId]); expect(ticketWorkflow.items[0]).not.toHaveProperty("statusChange");
  await expect(listTicketActivity(first, requester, ticket.publicId, {})).rejects.toMatchObject({ code: "FORBIDDEN" });
  const foreign = await database.ticket();
  await expect(listTicketActivity(first, staff, foreign.publicId, {}, action.publicId)).rejects.toMatchObject({ code: "NOT_FOUND" });
  const all = await listTicketActivity(first, staff, ticket.publicId, { sort: "createdAt:asc" });
  const pages = [];
  for (let page = 1; page <= all.items.length; page++) pages.push(...(await listTicketActivity(first, staff, ticket.publicId, { sort: "createdAt:asc", pageSize: "1", pageNumber: String(page) })).items);
  expect(pages.map((item) => item.publicId)).toEqual(all.items.map((item) => item.publicId));
  const stored = await first.ticketActivity.findMany({ where: { ticketId: ticket.id }, include: { actionTaken: true } });
  expect(stored.filter((item) => item.action.startsWith("ACTION_")).every((item) => item.actionTaken !== null)).toBe(true);
  const update = stored.find((item) => item.action === "ACTION_UPDATED")!.actionTaken!;
  expect(Object.keys(update).sort()).toEqual(["ticketActivityId", "actionTakenId", "previousAssignedToUserId", "assignedToUserId"].sort());
});
