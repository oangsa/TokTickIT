import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { actionDatabase, type ActionDatabase } from "../support/actionDatabase.js";

let database: ActionDatabase;
beforeAll(async () => { database = await actionDatabase(); }, 120_000);
afterAll(async () => database?.close());

it("Ticket filter users include all distinct historical references across pages with own-Ticket isolation", async () => {
  const { first, service, requester, staff } = database;
  const ticket = await database.ticket();
  const otherTicket = await database.ticket();
  const users = await Promise.all(["Alice", "Bob", "Carol"].map((name) => first.user.create({ data: {
    name, email: `filter-${randomUUID()}@example.test`, role: "IT_STAFF", passwordHash: "unusable-synthetic-fixture", createdBy: "test", updatedBy: "test",
  } })));
  for (const user of users.slice(0, 2)) {
    const actor = { userId: user.id, userPublicId: user.publicId, email: user.email, role: user.role };
    const action = (await database.create(ticket.publicId, user.publicId)).action;
    await service.lifecycle(actor, ticket.publicId, action.publicId, "start", { expectedVersion: 1 }, randomUUID());
    await service.lifecycle(actor, ticket.publicId, action.publicId, "complete", { expectedVersion: 2, result: "Done", followUpRequired: false }, randomUUID());
  }
  await database.create(ticket.publicId, users[0].publicId);
  await database.create(otherTicket.publicId, users[2].publicId);
  await first.user.update({ where: { id: users[1].id }, data: { role: "REQUESTER", isActive: false, deleted: true } });
  for (const actor of [requester, staff]) for (const reference of ["assignedTo", "performedBy"]) {
    const firstPage = await service.filterUsers(actor, ticket.publicId, { reference, pageSize: "1" });
    const secondPage = await service.filterUsers(actor, ticket.publicId, { reference, pageSize: "1", pageNumber: "2" });
    expect(firstPage.items).toEqual([{ publicId: users[0].publicId, name: "Alice", role: "IT_STAFF" }]);
    expect(secondPage.items).toEqual([{ publicId: users[1].publicId, name: "Bob", role: "REQUESTER" }]);
    expect(firstPage.pagination).toMatchObject({ totalItems: 2, totalPages: 2, hasNextPage: true });
    expect((await service.filterUsers(actor, ticket.publicId, { reference, search: "Bob", searchFields: "name" })).items).toEqual(secondPage.items);
    expect((await service.filterUsers(actor, ticket.publicId, { reference, pageNumber: "3", pageSize: "1" })).items).toEqual([]);
  }
  await first.ticket.update({ where: { id: otherTicket.id }, data: { requesterId: staff.userId } });
  await expect(service.filterUsers(requester, otherTicket.publicId, { reference: "assignedTo" })).rejects.toMatchObject({ code: "NOT_FOUND" });
});
it("historical-user Role sorts use PostgreSQL enum order and publicId ASC ties across pages", async () => {
  const { first, service, staff, requester } = database;
  const ticket = await database.ticket();
  const referencedUsers = [];
  for (let index = 0; index < 4; index++) {
    const user = await first.user.create({ data: { name: `Role sort ${index}`, email: `role-sort-${randomUUID()}@example.test`, role: index === 3 ? "ADMINISTRATOR" : "IT_STAFF", passwordHash: "unusable-synthetic-fixture", createdBy: "test", updatedBy: "test" } });
    referencedUsers.push(user);
    const actor = { userId: user.id, userPublicId: user.publicId, email: user.email, role: user.role };
    const created = (await database.create(ticket.publicId, user.publicId)).action;
    await service.lifecycle(actor, ticket.publicId, created.publicId, "start", { expectedVersion: 1 }, randomUUID());
    await service.lifecycle(actor, ticket.publicId, created.publicId, "complete", { expectedVersion: 2, result: "Role sort fixture", followUpRequired: false }, randomUUID());
  }
  // Historical demoted/deleted identities remain filterable but cannot be newly assigned.
  await first.user.update({ where: { id: referencedUsers[0].id }, data: { role: "REQUESTER", isActive: false, deleted: true } });
  const staffIds = [referencedUsers[1].publicId, referencedUsers[2].publicId].sort();
  for (const actor of [staff, requester]) for (const reference of ["assignedTo", "performedBy"]) {
    for (const [direction, expected] of [
      ["asc", [referencedUsers[0].publicId, ...staffIds, referencedUsers[3].publicId]],
      ["desc", [referencedUsers[3].publicId, ...staffIds, referencedUsers[0].publicId]],
    ] as const) {
      const input = { reference, sort: `role:${direction}`, pageSize: "2" };
      const page1 = await service.filterUsers(actor, ticket.publicId, input);
      const page2 = await service.filterUsers(actor, ticket.publicId, { ...input, pageNumber: "2" });
      expect(page1.pagination.totalItems).toBe(4);
      expect(page2.pagination.totalItems).toBe(4);
      expect([...page1.items, ...page2.items].map((user) => user.publicId)).toEqual(expected);
    }
  }
});
