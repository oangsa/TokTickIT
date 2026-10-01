import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { parseActionQuery } from "../../../src/services/actionTakenQueryValidator.js";
import { listAssignableUsers } from "../../../src/services/staffTicketReadService.js";
import { parseAssignableUserQuery } from "../../../src/services/assignableUserQueryValidator.js";
import { actionDatabase, type ActionDatabase } from "../support/actionDatabase.js";
import { createBody } from "../support/actionFixture.js";
import { updateUser } from "../../../src/services/userService.js";
import { listTicketActivity } from "../../../src/services/ticketActivityService.js";
let database: ActionDatabase;
beforeAll(async () => { database = await actionDatabase(); }, 120_000);
afterAll(async () => database?.close());
it("PG-03 completed Action preserves performer identity and current role after real User demotion", async () => {
  const { first, service, staff, other, admin, requester } = database;
  const user = await first.user.create({ data: { name: "Historical performer", email: `performer-${randomUUID()}@example.test`, role: "IT_STAFF", passwordHash: "unusable-synthetic-fixture", createdBy: "test", updatedBy: "test" } });
  const performer = { userId: user.id, userPublicId: user.publicId, email: user.email, role: user.role };
  const ticket = await database.ticket();
  const created = (await database.create(ticket.publicId, user.publicId)).action;
  await service.lifecycle(performer, ticket.publicId, created.publicId, "start", { expectedVersion: 1 }, randomUUID());
  const completed = (await service.lifecycle(performer, ticket.publicId, created.publicId, "complete", { expectedVersion: 2, result: "Verified repair", followUpRequired: false }, randomUUID())).action;
  expect(completed).toMatchObject({ status: "COMPLETED", version: 3, performedBy: { publicId: user.publicId, name: user.name, role: "IT_STAFF" } });
  const planned = (await database.create(ticket.publicId, user.publicId)).action;
  const before = await first.actionTaken.findMany({ where: { ticketId: ticket.id }, orderBy: { id: "asc" } });
  expect(before.find((action) => action.publicId === completed.publicId)?.performedByUserId).toBe(user.id);
  const historyBefore = await first.ticketActivity.findMany({ where: { ticketId: ticket.id }, orderBy: { id: "asc" }, include: { actionTaken: true } });

  const updatedUser = await updateUser(first, admin, user.publicId, { role: "REQUESTER" });
  const summary = { publicId: user.publicId, name: user.name, role: "REQUESTER" };
  for (const actor of [other, requester]) {
    expect(await service.detail(actor, ticket.publicId, completed.publicId)).toMatchObject({ status: "COMPLETED", version: 3, performedBy: summary, completedAt: completed.completedAt });
    const listed = await service.list(actor, ticket.publicId, {});
    expect(listed.items.find((action) => action.publicId === completed.publicId)).toMatchObject({ status: "COMPLETED", version: 3, performedBy: summary });
  }
  const history = await listTicketActivity(first, other, ticket.publicId, {}, completed.publicId);
  expect(history.items.find((item) => item.action === "ACTION_COMPLETED")?.performedBy).toMatchObject(summary);
  const demoted = { ...performer, role: updatedUser.role };
  const { assignedToUserPublicId: _assignee, ...editable } = createBody;
  await expect(service.create(demoted, ticket.publicId, createBody, randomUUID())).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(service.edit(demoted, ticket.publicId, planned.publicId, { ...editable, expectedVersion: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(service.assign(demoted, ticket.publicId, planned.publicId, { expectedVersion: 1, assignedToUserPublicId: staff.userPublicId })).rejects.toMatchObject({ code: "FORBIDDEN" });
  for (const operation of ["start", "complete", "cancel"] as const) {
    const body = operation === "complete" ? { expectedVersion: 1, result: "Denied", followUpRequired: false } : operation === "cancel" ? { expectedVersion: 1, cancellationReason: "Denied" } : { expectedVersion: 1 };
    await expect(service.lifecycle(demoted, ticket.publicId, planned.publicId, operation, body, randomUUID())).rejects.toMatchObject({ code: "FORBIDDEN" });
  }
  expect((await listAssignableUsers(first, parseAssignableUserQuery({ search: user.email, searchFields: "email" }))).items).toEqual([]);
  expect(await first.actionTaken.findMany({ where: { ticketId: ticket.id }, orderBy: { id: "asc" } })).toEqual(before);
  expect(await first.ticketActivity.findMany({ where: { ticketId: ticket.id }, orderBy: { id: "asc" }, include: { actionTaken: true } })).toEqual(historyBefore);
});
it.each([{ role: "REQUESTER" }, { isActive: false }] as const)("PG-04 real User transition preserves Action assignments and historical references %#", async (change) => {
  const { first, service, staff, other, admin, requester } = database;
  const user = await first.user.create({ data: { name: "Referenced assignee", email: `reference-${randomUUID()}@example.test`, role: "IT_STAFF", passwordHash: "unusable-synthetic-fixture", createdBy: "test", updatedBy: "test" } });
  const ticket = await database.ticket();
  const planned = (await database.create(ticket.publicId, null)).action;
  const assigned = await service.assign(staff, ticket.publicId, planned.publicId, { expectedVersion: 1, assignedToUserPublicId: user.publicId });
  const terminal = (await database.create(ticket.publicId, user.publicId)).action;
  await service.lifecycle(staff, ticket.publicId, terminal.publicId, "cancel", { expectedVersion: 1, cancellationReason: "Historical assignment fixture" }, randomUUID());
  const before = await first.actionTaken.findMany({ where: { ticketId: ticket.id }, orderBy: { id: "asc" } });
  const activityCount = await first.ticketActivity.count({ where: { ticketId: ticket.id } });

  const updatedUser = await updateUser(first, admin, user.publicId, change);
  const summary = { publicId: user.publicId, name: user.name, email: user.email, role: updatedUser.role };
  expect(await first.actionTaken.findMany({ where: { ticketId: ticket.id }, orderBy: { id: "asc" } })).toEqual(before);
  expect(await first.ticketActivity.count({ where: { ticketId: ticket.id } })).toBe(activityCount);
  for (const actor of [other, requester]) {
    expect((await service.detail(actor, ticket.publicId, assigned.publicId)).assignedTo).toEqual(summary);
    expect((await service.detail(actor, ticket.publicId, terminal.publicId)).assignedTo).toEqual(summary);
    expect((await service.list(actor, ticket.publicId, {})).items.every((item) => item.assignedTo?.publicId === user.publicId && item.assignedTo.role === updatedUser.role)).toBe(true);
  }
  const history = await listTicketActivity(first, other, ticket.publicId, {}, assigned.publicId);
  expect(history.items.find((item) => item.action === "ACTION_ASSIGNED")?.actionTaken?.assignedTo).toEqual(summary);
  await expect(service.lifecycle(other, ticket.publicId, assigned.publicId, "start", { expectedVersion: assigned.version }, randomUUID())).rejects.toMatchObject({ code: "FORBIDDEN" });
  const noOp = await service.assign(other, ticket.publicId, assigned.publicId, { expectedVersion: assigned.version, assignedToUserPublicId: user.publicId });
  expect(noOp).toMatchObject({ version: assigned.version, assignedTo: summary });
  expect(await first.ticketActivity.count({ where: { ticketId: ticket.id } })).toBe(activityCount);

  const lookup = await listAssignableUsers(first, parseAssignableUserQuery({ search: user.email, searchFields: "email" }));
  expect(lookup.items).toEqual([]);
  expect(lookup.pagination.totalItems).toBe(0);
  const unassigned = (await database.create(ticket.publicId, null)).action;
  await expect(service.assign(other, ticket.publicId, unassigned.publicId, { expectedVersion: 1, assignedToUserPublicId: user.publicId })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  await expect(database.create(ticket.publicId, user.publicId)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  const reassigned = await service.assign(other, ticket.publicId, assigned.publicId, { expectedVersion: assigned.version, assignedToUserPublicId: admin.userPublicId });
  expect(reassigned).toMatchObject({ version: assigned.version + 1, assignedTo: { publicId: admin.userPublicId } });
  const reassignmentHistory = await listTicketActivity(first, other, ticket.publicId, {}, assigned.publicId);
  expect(reassignmentHistory.items.find((item) => item.action === "ACTION_REASSIGNED")?.actionTaken?.previousAssignedTo).toEqual(summary);
});
it("PG-03 persists server lifecycle fields, version, performer, immutable terminals and stale writes", async () => {
  const { first, service, staff, other, admin } = database;
  const ticket = await database.ticket("OPEN", admin.userId);
  const { action } = await database.create(ticket.publicId, other.userPublicId);
  expect(action).toMatchObject({ status: "PLANNED", version: 1, result: null, performedBy: null, startedAt: null, completedAt: null, cancelledAt: null });
  expect(action.creator.publicId).toBe(staff.userPublicId);
  await expect(service.lifecycle(staff, ticket.publicId, action.publicId, "start", { expectedVersion: 1 }, randomUUID())).rejects.toMatchObject({ code: "FORBIDDEN" });
  const startTime = new Date();
  const started = await service.lifecycle(other, ticket.publicId, action.publicId, "start", { expectedVersion: 1 }, randomUUID());
  expect(started.action).toMatchObject({ status: "IN_PROGRESS", version: 2 });
  expect(new Date(started.action.startedAt!).getTime()).toBeGreaterThanOrEqual(startTime.getTime());
  await expect(service.assign(staff, ticket.publicId, action.publicId, { expectedVersion: 1, assignedToUserPublicId: staff.userPublicId })).rejects.toMatchObject({ code: "CONFLICT" });
  const completed = await service.lifecycle(admin, ticket.publicId, action.publicId, "complete", { expectedVersion: 2, result: " Verified stable ", followUpRequired: true, followUpNote: " Check tomorrow " }, randomUUID());
  expect(completed.action).toMatchObject({ status: "COMPLETED", version: 3, result: "Verified stable", followUpNote: "Check tomorrow", performedBy: { publicId: admin.userPublicId } });
  expect(completed.action.completedAt).not.toBeNull(); expect(completed.action.startedAt).toBe(started.action.startedAt);
  const saved = await first.actionTaken.findUniqueOrThrow({ where: { publicId: action.publicId } });
  expect(saved.performedByUserId).toBe(admin.userId);
  const { assignedToUserPublicId: _id, ...editable } = createBody;
  await expect(service.edit(staff, ticket.publicId, action.publicId, { ...editable, expectedVersion: 3 })).rejects.toMatchObject({ code: "INVALID_ACTION_TRANSITION" });
  await expect(service.assign(staff, ticket.publicId, action.publicId, { expectedVersion: 3, assignedToUserPublicId: null })).rejects.toMatchObject({ code: "INVALID_ACTION_TRANSITION" });
  for (const operation of ["start", "complete", "cancel"] as const) {
    const body = operation === "complete" ? { expectedVersion: 3, result: "Wrong", followUpRequired: false } : operation === "cancel" ? { expectedVersion: 3, cancellationReason: "Wrong" } : { expectedVersion: 3 };
    await expect(service.lifecycle(admin, ticket.publicId, action.publicId, operation, body, randomUUID())).rejects.toMatchObject({ code: "INVALID_ACTION_TRANSITION" });
  }
  expect(await first.actionTaken.findUniqueOrThrow({ where: { id: saved.id } })).toEqual(saved);
  expect(await first.ticketActivity.count({ where: { ticketId: ticket.id } })).toBe(3);
  for (const inProgress of [false, true]) {
    const cancelled = (await database.create(ticket.publicId)).action;
    if (inProgress) await service.lifecycle(staff, ticket.publicId, cancelled.publicId, "start", { expectedVersion: 1 }, randomUUID());
    const result = await service.lifecycle(staff, ticket.publicId, cancelled.publicId, "cancel", { expectedVersion: inProgress ? 2 : 1, cancellationReason: " No longer needed " }, randomUUID());
    expect(result.action).toMatchObject({ status: "CANCELLED", cancellationReason: "No longer needed", performedBy: null, version: inProgress ? 3 : 2 });
    expect(result.action.cancelledAt).not.toBeNull();
  }
});
it("PG-04 assign/reassign/unassign, no-op stale check, and actual target eligibility", async () => {
  const { first, service, staff, other, admin, requester } = database;
  const ticket = await database.ticket();
  const created = (await database.create(ticket.publicId, null)).action;
  await expect(service.lifecycle(staff, ticket.publicId, created.publicId, "start", { expectedVersion: 1 }, randomUUID())).rejects.toMatchObject({ code: "INVALID_ACTION_TRANSITION" });
  const unchanged = await service.assign(other, ticket.publicId, created.publicId, { expectedVersion: 1, assignedToUserPublicId: null });
  expect(unchanged.version).toBe(1);
  expect(await first.ticketActivity.count({ where: { ticketId: ticket.id } })).toBe(1);
  const assigned = await service.assign(other, ticket.publicId, created.publicId, { expectedVersion: 1, assignedToUserPublicId: staff.userPublicId });
  expect(assigned).toMatchObject({ version: 2, assignedTo: { publicId: staff.userPublicId } });
  await first.user.update({ where: { id: staff.userId }, data: { isActive: false } });
  expect((await service.assign(admin, ticket.publicId, created.publicId, { expectedVersion: 2, assignedToUserPublicId: staff.userPublicId })).version).toBe(2);
  await first.user.update({ where: { id: staff.userId }, data: { isActive: true } });
  const same = await service.assign(admin, ticket.publicId, created.publicId, { expectedVersion: 2, assignedToUserPublicId: staff.userPublicId }); expect(same.version).toBe(2);
  await expect(service.assign(admin, ticket.publicId, created.publicId, { expectedVersion: 1, assignedToUserPublicId: staff.userPublicId })).rejects.toMatchObject({ code: "CONFLICT" });
  const reassigned = await service.assign(other, ticket.publicId, created.publicId, { expectedVersion: 2, assignedToUserPublicId: admin.userPublicId }); expect(reassigned.version).toBe(3);
  const unassigned = await service.assign(staff, ticket.publicId, created.publicId, { expectedVersion: 3, assignedToUserPublicId: null }); expect(unassigned).toMatchObject({ version: 4, assignedTo: null });
  const inactive = await first.user.update({ where: { id: other.userId }, data: { isActive: false } });
  const deleted = await first.user.create({ data: { ...database.users[2], id: undefined, publicId: randomUUID(), email: `${randomUUID()}@example.test`, deleted: true } });
  const system = await first.user.findFirstOrThrow({ where: { isSystem: true } });
  for (const publicId of [inactive.publicId, deleted.publicId, system.publicId, requester.userPublicId, randomUUID()]) {
    await expect(service.assign(staff, ticket.publicId, created.publicId, { expectedVersion: 4, assignedToUserPublicId: publicId })).rejects.toMatchObject({ code: "VALIDATION_ERROR", details: [{ field: "assignedToUserPublicId", message: expect.any(String) }] });
    await expect(database.create(ticket.publicId, publicId)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  }
  const events = await first.ticketActivity.findMany({ where: { ticketId: ticket.id }, orderBy: { id: "asc" }, include: { actionTaken: true } });
  expect(events.map((event) => event.action)).toEqual(["ACTION_CREATED", "ACTION_ASSIGNED", "ACTION_REASSIGNED", "ACTION_UNASSIGNED"]);
  expect(events[2].actionTaken).toMatchObject({ previousAssignedToUserId: staff.userId, assignedToUserId: admin.userId });
  await first.user.update({ where: { id: other.userId }, data: { isActive: true } });
});
it("real Action query searches large omitted fields and fixes Requester parent scope", async () => {
  const { service, staff, requester, first } = database;
  const ticket = await database.ticket();
  const action = (await database.create(ticket.publicId)).action;
  const { assignedToUserPublicId: _assignee, ...editable } = createBody;
  await service.edit(staff, ticket.publicId, action.publicId, { ...editable, description: "Cable", result: "MARKER_RESULT", followUpRequired: true, followUpNote: "MARKER_FOLLOW", attachmentNotes: "MARKER_NOTES", expectedVersion: 1 });
  for (const field of ["result", "followUpNote", "attachmentNotes"] as const) {
    const result = await service.list(requester, ticket.publicId, { search: "marker", searchFields: field });
    expect(result.items).toHaveLength(1); expect(result.items[0]).not.toHaveProperty(field);
  }
  const selected = await service.list(staff, ticket.publicId, { filters: JSON.stringify([{ field: "assignedToUserPublicId", condition: "EQUAL", value: staff.userPublicId }, { field: "followUpRequired", condition: "EQUAL", value: true }]), pageSize: "1" });
  expect(selected.pagination.totalItems).toBe(1);
  const foreign = await database.ticket();
  await first.ticket.update({ where: { id: foreign.id }, data: { requesterId: staff.userId } });
  await expect(service.list(requester, foreign.publicId, {})).rejects.toMatchObject({ code: "NOT_FOUND" });
  await expect(service.detail(requester, ticket.publicId, randomUUID())).rejects.toMatchObject({ code: "NOT_FOUND" });
  await expect(service.detail(staff, foreign.publicId, action.publicId)).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(parseActionQuery({ sort: "status:asc" }).order[1].field).toBe("id");
});
it("real assignable lookup has accurate eligibility, role/search, bounded pages and tie-break", async () => {
  const { first, users } = database;
  const marker = randomUUID();
  const publicIds: string[] = [];
  for (let index = 0; index < 12; index++) publicIds.push((await first.user.create({ data: { name: `Same ${marker}`, email: `lookup-${marker}-${index}@example.test`, role: index % 2 ? "IT_STAFF" : "ADMINISTRATOR", passwordHash: "unused-synthetic", createdBy: "test", updatedBy: "test" } })).publicId);
  await first.user.create({ data: { ...users[1], id: undefined, publicId: randomUUID(), email: `inactive-${marker}@example.test`, name: `Same ${marker}`, isActive: false } });
  await first.user.create({ data: { ...users[1], id: undefined, publicId: randomUUID(), email: `deleted-${marker}@example.test`, name: `Same ${marker}`, deleted: true } });
  const input = { search: ` ${marker.toUpperCase()} `, searchFields: "name,email", pageSize: "10" };
  const page1 = await listAssignableUsers(first, parseAssignableUserQuery(input));
  const page2 = await listAssignableUsers(first, parseAssignableUserQuery({ ...input, pageNumber: "2" }));
  expect(page1.pagination).toMatchObject({ totalItems: 12, hasNextPage: true }); expect(page2.items).toHaveLength(2);
  expect([...page1.items, ...page2.items].map((item) => item.publicId)).toEqual(publicIds.sort());
  const requester = await listAssignableUsers(first, parseAssignableUserQuery({ ...input, filters: JSON.stringify([{ field: "role", condition: "EQUAL", value: "REQUESTER" }]) })); expect(requester.items).toEqual([]);
  for (const role of ["IT_STAFF", "ADMINISTRATOR"]) {
    const result = await listAssignableUsers(first, parseAssignableUserQuery({ ...input, sort: "role:desc", filters: JSON.stringify([{ field: "role", condition: "EQUAL", value: role }]) }));
    expect(result.pagination.totalItems).toBe(6); expect(result.items.every((item) => item.role === role)).toBe(true);
  }
});
