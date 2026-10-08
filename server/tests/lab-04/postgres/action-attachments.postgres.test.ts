import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { actionDatabase, type ActionDatabase } from "../support/actionDatabase.js";
import { createBody } from "../support/actionFixture.js";
let database: ActionDatabase;
beforeAll(async () => { database = await actionDatabase(); }, 120_000);
afterAll(async () => database?.close());
it("PG-09 eligible existing evidence, unique pairs, multi-Action sharing, atomic desired-set diff and Cancel preservation", async () => {
  const { first, service, staff } = database;
  const ticket = await database.ticket(); const foreign = await database.ticket();
  const [one, two, three, pending, removed, deleted, crossTicket] = await Promise.all([
    database.file(ticket.id), database.file(ticket.id), database.file(ticket.id), database.file(null), database.file(ticket.id, { deleted: true, removalReason: "Removed" }), database.file(ticket.id, { deleted: true, removalReason: "Deleted fixture" }), database.file(foreign.id),
  ]);
  for (const file of [pending, removed, deleted, crossTicket]) {
    await expect(database.create(ticket.publicId, staff.userPublicId, [file.storageKey])).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await first.actionTaken.count({ where: { ticketId: ticket.id } })).toBe(0); expect(await first.ticketActivity.count({ where: { ticketId: ticket.id } })).toBe(0);
  }
  const action = (await database.create(ticket.publicId, staff.userPublicId, [one.storageKey, two.storageKey])).action;
  const shared = (await database.create(ticket.publicId, null, [one.storageKey])).action;
  expect(action.attachments.map((file) => file.attachmentId).sort()).toEqual([one.storageKey, two.storageKey].sort());
  expect(shared.attachments[0].attachmentId).toBe(one.storageKey);
  const row = await first.actionTaken.findUniqueOrThrow({ where: { publicId: action.publicId } });
  const original = await first.actionTakenAttachment.findMany({ where: { actionTakenId: row.id }, orderBy: { attachmentId: "asc" } });
  await expect(first.actionTakenAttachment.create({ data: { actionTakenId: row.id, attachmentId: one.id, createdBy: "test", updatedBy: "test" } })).rejects.toMatchObject({ code: "P2002" });
  const { assignedToUserPublicId: _assignee, ...editable } = createBody;
  for (const file of [pending, removed, deleted, crossTicket]) await expect(service.edit(staff, ticket.publicId, action.publicId, { ...editable, attachmentIds: [file.storageKey], expectedVersion: 1 })).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(await first.actionTakenAttachment.findMany({ where: { actionTakenId: row.id }, orderBy: { attachmentId: "asc" } })).toEqual(original);
  const edited = await service.edit(staff, ticket.publicId, action.publicId, { ...editable, attachmentIds: [two.storageKey, three.storageKey], expectedVersion: 1 });
  expect(edited.version).toBe(2);
  const joins = await first.actionTakenAttachment.findMany({ where: { actionTakenId: row.id }, orderBy: { attachmentId: "asc" } });
  expect(joins.map((join) => join.attachmentId)).toEqual([two.id, three.id].sort((left, right) => left - right));
  expect(joins.find((join) => join.attachmentId === two.id)).toEqual(original.find((join) => join.attachmentId === two.id));
  const cancelled = await service.lifecycle(staff, ticket.publicId, action.publicId, "cancel", { expectedVersion: 2, cancellationReason: "No longer needed" }, randomUUID());
  expect(cancelled.action.attachments.map((file) => file.attachmentId).sort()).toEqual([two.storageKey, three.storageKey].sort());
  expect(await first.actionTakenAttachment.findMany({ where: { actionTakenId: row.id }, orderBy: { attachmentId: "asc" } })).toEqual(joins);
  await expect(service.edit(staff, ticket.publicId, action.publicId, { ...editable, attachmentIds: [], expectedVersion: 3 })).rejects.toMatchObject({ code: "INVALID_ACTION_TRANSITION" });
});
