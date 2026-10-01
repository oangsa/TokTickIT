import { afterAll, beforeAll, expect, it } from "vitest";
import { actionDatabase, type ActionDatabase } from "../support/actionDatabase.js";
import { createBody } from "../support/actionFixture.js";
let database: ActionDatabase;
beforeAll(async () => { database = await actionDatabase(); }, 120_000);
afterAll(async () => database?.close());
it("PG-05 two independent PostgreSQL connections compete for same Action edit version", async () => {
  const { first, second, staff, service, secondService } = database;
  const pids = await Promise.all([first.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`, second.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`]);
  expect(pids[0][0].pid).not.toBe(pids[1][0].pid);
  for (let race = 0; race < 3; race++) {
    const ticket = await database.ticket();
    const created = (await database.create(ticket.publicId)).action;
    const { assignedToUserPublicId: _id, ...editable } = createBody;
    const results = await Promise.allSettled([
      service.edit(staff, ticket.publicId, created.publicId, { ...editable, description: "First winner", expectedVersion: 1 }),
      secondService.edit(staff, ticket.publicId, created.publicId, { ...editable, description: "Second winner", expectedVersion: 1 }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({ reason: { code: "CONFLICT" } });
    const row = await first.actionTaken.findUniqueOrThrow({ where: { publicId: created.publicId } });
    expect(row.version).toBe(2);
    const winner = results.find((result) => result.status === "fulfilled")!;
    if (winner.status === "fulfilled") expect(row.description).toBe(winner.value.description);
    expect(await first.ticketActivity.count({ where: { ticketId: ticket.id, action: "ACTION_UPDATED" } })).toBe(1);
  }
});
it("PG-06 competing assignment changes have one winner, version increment, and Activity", async () => {
  const { first, staff, other, admin, service, secondService } = database;
  for (let race = 0; race < 3; race++) {
    const ticket = await database.ticket();
    const created = (await database.create(ticket.publicId, null)).action;
    const results = await Promise.allSettled([
      service.assign(other, ticket.publicId, created.publicId, { assignedToUserPublicId: staff.userPublicId, expectedVersion: 1 }),
      secondService.assign(admin, ticket.publicId, created.publicId, { assignedToUserPublicId: admin.userPublicId, expectedVersion: 1 }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({ reason: { code: "CONFLICT" } });
    const row = await first.actionTaken.findUniqueOrThrow({ where: { publicId: created.publicId } });
    expect(row.version).toBe(2);
    expect([staff.userId, admin.userId]).toContain(row.assignedToUserId);
    expect(await first.ticketActivity.count({ where: { ticketId: ticket.id, action: "ACTION_ASSIGNED" } })).toBe(1);
  }
});
