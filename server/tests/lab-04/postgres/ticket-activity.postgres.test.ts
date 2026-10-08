import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import type { Prisma, PrismaClient } from "../../../src/generated/prisma/client.js";
import { ActionTakenService } from "../../../src/services/actionTakenService.js";
import { createRootComment } from "../../../src/services/publicCommentService.js";
import { createInternalNote } from "../../../src/services/internalNoteService.js";
import { AttachmentService } from "../../../src/services/attachmentService.js";
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

import { applyRequesterTicketAction } from "../../../src/services/ticketService.js";
import { mutateStaffTicket } from "../../../src/services/ticketWorkflowService.js";
it("PG-10 confirmation timestamp and authenticated childless Activity commit once, repeat is read-only", async () => {
  const { first, second, requester, staff } = database;
  const ticket = await database.ticket("RESOLVED");
  const confirm = (client: PrismaClient) => applyRequesterTicketAction(client, requester.userId, requester.email, ticket.publicId, "looks-resolved");
  await Promise.all([confirm(first), confirm(second)]);
  const before = await first.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
  expect(before.currentStatus).toBe("RESOLVED"); expect(before.requesterResolutionConfirmedAt).toBeInstanceOf(Date);
  const events = await first.ticketActivity.findMany({ where: { ticketId: ticket.id }, include: { assignment: true, status: true, priority: true, actionTaken: true } });
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({ action: "REQUESTER_RESOLUTION_CONFIRMED", performedByUserId: requester.userId, createdBy: requester.email, assignment: null, status: null, priority: null, actionTaken: null });
  await confirm(first);
  expect(await first.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).toEqual(before);
  expect((await listTicketActivity(first, staff, ticket.publicId, {})).items).toMatchObject([{ action: "REQUESTER_RESOLUTION_CONFIRMED", performedBy: { publicId: requester.userPublicId, role: "REQUESTER" } }]);
  expect(await first.ticketActivity.count({ where: { ticketId: ticket.id } })).toBe(1);
});
it("PG-10 failed Activity append rolls back Requester confirmation timestamp", async () => {
  const { first, requester } = database; const ticket = await database.ticket("RESOLVED");
  await expect(applyRequesterTicketAction(rejectActivity(), requester.userId, requester.email, ticket.publicId, "looks-resolved")).rejects.toThrow();
  expect(await first.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).toEqual(ticket);
  expect(await first.ticketActivity.count({ where: { ticketId: ticket.id } })).toBe(0);
});
it("PG-10 failed workflow Activity rolls back status and required Public Comment", async () => {
  const { first, staff } = database; const ticket = await database.ticket();
  await expect(mutateStaffTicket(rejectActivity(), staff, ticket.publicId, "request-information", { content: "Provide diagnostic details" }, async (tx, input) => {
    await tx.publicComment.create({ data: input });
  })).rejects.toThrow();
  expect(await first.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).toEqual(ticket);
  expect(await first.publicComment.count({ where: { ticketId: ticket.id } })).toBe(0);
  expect(await first.ticketActivity.count({ where: { ticketId: ticket.id } })).toBe(0);
});
it("PG-10 complete Ticket workflow appends typed actor history and leaves normal comments/notes unduplicated", async () => {
  const { first, staff, admin, requester, service } = database; const ticket = await database.ticket("NEW", null);
  const mutate = (operation: Parameters<typeof mutateStaffTicket>[3], body: unknown = {}, actor = staff) => mutateStaffTicket(first, actor, ticket.publicId, operation, body, async (tx, input) => { await tx.publicComment.create({ data: input }); });
  await mutate("claim", {}, admin);
  await mutate("owner", { ownerPublicId: staff.userPublicId, expectedOwnerPublicId: admin.userPublicId }, admin);
  await mutate("owner", { ownerPublicId: null, expectedOwnerPublicId: staff.userPublicId });
  await mutate("owner", { ownerPublicId: staff.userPublicId, expectedOwnerPublicId: null });
  await mutate("it-priority", { itPriority: "HIGH" }, admin);
  await mutate("start-work"); await mutate("request-information", { content: "Diagnostic request" }); await mutate("resume-work");
  const created = (await database.create(ticket.publicId)).action;
  await service.lifecycle(staff, ticket.publicId, created.publicId, "start", { expectedVersion: 1 }, randomUUID());
  await service.lifecycle(staff, ticket.publicId, created.publicId, "complete", { expectedVersion: 2, result: "Work verified", followUpRequired: false }, randomUUID());
  await mutate("mark-resolved");
  await applyRequesterTicketAction(first, requester.userId, requester.email, ticket.publicId, "looks-resolved");
  await mutate("close"); await applyRequesterTicketAction(first, requester.userId, requester.email, ticket.publicId, "reopen");
  await mutate("cancel", {}, admin);
  const before = await first.ticketActivity.findMany({ where: { ticketId: ticket.id }, include: { assignment: true, status: true, priority: true }, orderBy: { id: "asc" } });
  expect(before.filter((item) => !item.action.startsWith("ACTION_")).map((item) => item.action)).toEqual([
    "TICKET_ASSIGNED", "TICKET_REASSIGNED", "TICKET_UNASSIGNED", "TICKET_ASSIGNED", "IT_PRIORITY_CHANGED", "TICKET_STARTED_WORK", "INFORMATION_REQUESTED", "TICKET_RESUMED", "TICKET_MARKED_RESOLVED", "REQUESTER_RESOLUTION_CONFIRMED", "TICKET_CLOSED", "TICKET_REOPENED", "TICKET_CANCELLED",
  ]);
  expect(before[0]).toMatchObject({ performedByUserId: admin.userId, assignment: { previousAssignedToUserId: null, assignedToUserId: admin.userId }, status: { previousStatus: "NEW", status: "OPEN" }, priority: null });
  expect(before[1]).toMatchObject({ performedByUserId: admin.userId, assignment: { previousAssignedToUserId: admin.userId, assignedToUserId: staff.userId }, status: null });
  expect(before[2]).toMatchObject({ assignment: { previousAssignedToUserId: staff.userId, assignedToUserId: null } });
  expect(before[4]).toMatchObject({ performedByUserId: admin.userId, priority: { previousPriority: "LOW", priority: "HIGH" }, assignment: null, status: null });
  for (const event of before.filter((item) => ["TICKET_STARTED_WORK", "INFORMATION_REQUESTED", "TICKET_RESUMED", "TICKET_MARKED_RESOLVED", "TICKET_CLOSED"].includes(item.action))) expect(event).toMatchObject({ performedByUserId: staff.userId, assignment: null, priority: null, status: { previousStatus: expect.any(String), status: expect.any(String) } });
  expect(before.find((item) => item.action === "TICKET_REOPENED")).toMatchObject({ performedByUserId: requester.userId, status: { previousStatus: "CLOSED", status: "REOPENED" }, assignment: null });
  await createRootComment(first, requester, ticket.publicId, "Ordinary comment");
  await createInternalNote(first, staff, ticket.publicId, "Ordinary note");
  await new AttachmentService(first).createForTicket({ publicId: ticket.publicId, requesterId: requester.userId, actor: requester.email, file: { filename: "ordinary.pdf", data: Buffer.from("%PDF synthetic test") } });
  expect(await first.ticketActivity.findMany({ where: { ticketId: ticket.id }, include: { assignment: true, status: true, priority: true }, orderBy: { id: "asc" } })).toEqual(before);
  await listTicketActivity(first, staff, ticket.publicId, {});
  expect(await first.ticketActivity.findMany({ where: { ticketId: ticket.id }, include: { assignment: true, status: true, priority: true }, orderBy: { id: "asc" } })).toEqual(before);
});
it.each(["claim", "owner", "it-priority", "start-work", "resume-work", "mark-resolved", "close", "cancel"] as const)("PG-10 Activity failure rolls back %s", async (operation) => {
  const { first, staff, service } = database;
  const status = operation === "claim" ? "NEW" : operation === "resume-work" ? "WAITING_FOR_REQUESTER" : operation === "mark-resolved" ? "IN_PROGRESS" : operation === "close" ? "RESOLVED" : "OPEN";
  const ticket = await database.ticket(status, operation === "claim" ? null : staff.userId);
  if (operation === "close") await applyRequesterTicketAction(first, database.requester.userId, database.requester.email, ticket.publicId, "looks-resolved");
  if (operation === "mark-resolved") {
    const created = (await database.create(ticket.publicId)).action;
    await service.lifecycle(staff, ticket.publicId, created.publicId, "start", { expectedVersion: 1 }, randomUUID());
    await service.lifecycle(staff, ticket.publicId, created.publicId, "complete", { expectedVersion: 2, result: "Verified", followUpRequired: false }, randomUUID());
  }
  const before = await first.ticket.findUniqueOrThrow({ where: { id: ticket.id } }); const count = await first.ticketActivity.count({ where: { ticketId: ticket.id } });
  const body = operation === "owner" ? { ownerPublicId: null, expectedOwnerPublicId: staff.userPublicId } : operation === "it-priority" ? { itPriority: "HIGH" } : {};
  await expect(mutateStaffTicket(rejectActivity(), staff, ticket.publicId, operation, body)).rejects.toThrow();
  expect(await first.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).toEqual(before);
  expect(await first.ticketActivity.count({ where: { ticketId: ticket.id } })).toBe(count);
});
it.each(["cancel", "reopen"] as const)("PG-10 Requester %s rolls back on Activity failure", async (operation) => {
  const { first, requester } = database; const ticket = await database.ticket(operation === "cancel" ? "OPEN" : "CLOSED");
  await expect(applyRequesterTicketAction(rejectActivity(), requester.userId, requester.email, ticket.publicId, operation)).rejects.toThrow();
  expect(await first.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).toEqual(ticket);
  expect(await first.ticketActivity.count({ where: { ticketId: ticket.id } })).toBe(0);
});
it("PG-10 transaction rechecks persisted actor role after authentication snapshot", async () => {
  const { first, staff } = database;
  const user = await first.user.create({ data: { name: "Stale Staff", email: `stale-${randomUUID()}@example.test`, role: "IT_STAFF", passwordHash: "unusable-test-fixture", createdBy: "test", updatedBy: "test" } });
  const actor = { ...staff, userId: user.id, userPublicId: user.publicId, email: user.email };
  const ticket = await database.ticket("OPEN", user.id);
  await first.user.update({ where: { id: user.id }, data: { role: "REQUESTER" } });
  await expect(mutateStaffTicket(first, actor, ticket.publicId, "start-work", {})).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(await first.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).toEqual(ticket);
  expect(await first.ticketActivity.count({ where: { ticketId: ticket.id } })).toBe(0);
});
