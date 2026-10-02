import { afterAll, beforeAll, expect, it } from "vitest";
import { actionDatabase, type ActionDatabase } from "../support/actionDatabase.js";
import { createBody } from "../support/actionFixture.js";
import { ActionTakenService } from "../../../src/services/actionTakenService.js";
import { updateUser } from "../../../src/services/userService.js";
import type { PrismaClient } from "../../../src/generated/prisma/client.js";
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
it.each([{ role: "REQUESTER" }, { isActive: false }] as const)("PG-06 Action assignment racing User transition rolls back deadlock loser %#", async (change) => {
  const { first, second, other, admin } = database;
  const user = await first.user.create({ data: { name: "Race assignee", email: `race-${crypto.randomUUID()}@example.test`, role: "IT_STAFF", passwordHash: "unusable-synthetic-fixture", createdBy: "test", updatedBy: "test" } });
  const ticket = await database.ticket("OPEN", user.id);
  const created = (await database.create(ticket.publicId, null)).action;
  let signalTicket!: () => void;
  let signalUser!: () => void;
  const ticketLocked = new Promise<void>((resolve) => { signalTicket = resolve; });
  const userLocked = new Promise<void>((resolve) => { signalUser = resolve; });
  // Gates surround real queries; neither transaction's writes or locks are mocked.
  const actionClient = first.$extends({ query: { $queryRaw: async ({ args, query }) => {
    const rows = await query(args);
    if (args.strings.join(" ").includes("FROM ticket")) {
      signalTicket();
      await userLocked;
    }
    return rows;
  } } }) as unknown as PrismaClient;
  const userClient = second.$extends({ query: {
    user: { update: async ({ args, query }) => {
      const updated = await query(args);
      await ticketLocked;
      signalUser();
      return updated;
    } },
    ticket: { updateManyAndReturn: async ({ args, query }) => {
      // Wait until Action actually waits on User, then close the real lock cycle.
      const deadline = Date.now() + 2_000;
      while (true) {
        const waiting = await first.$queryRaw<{ waiting: boolean }[]>`SELECT EXISTS (
          SELECT 1 FROM pg_stat_activity WHERE datname = current_database()
          AND wait_event_type = 'Lock' AND query LIKE '%FROM "user"%FOR SHARE%'
        ) AS waiting`;
        if (waiting[0].waiting) break;
        if (Date.now() > deadline) throw new Error("Action did not wait on User lock");
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      return query(args);
    } },
  } }) as unknown as PrismaClient;
  const results = await Promise.allSettled([
    new ActionTakenService(actionClient).assign(other, ticket.publicId, created.publicId, { assignedToUserPublicId: user.publicId, expectedVersion: 1 }),
    updateUser(userClient, admin, user.publicId, change),
  ]);
  expect(results[0]).toMatchObject({ status: "rejected", reason: { code: "CONFLICT", statusCode: 409 } });
  expect(results[1].status).toBe("fulfilled");
  const persisted = await first.actionTaken.findUniqueOrThrow({ where: { publicId: created.publicId } });
  expect(persisted).toMatchObject({ version: 1, assignedToUserId: null, status: "PLANNED" });
  expect(await first.ticketActivity.count({ where: { ticketId: ticket.id, action: "ACTION_ASSIGNED" } })).toBe(0);
  expect((await first.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).ownerUserId).toBeNull();
  const unassignments = await first.ticketActivity.findMany({
    where: { ticketId: ticket.id, action: "TICKET_UNASSIGNED" }, include: { assignment: true },
  });
  expect(unassignments).toHaveLength(1);
  expect(unassignments[0]).toMatchObject({
    performedByUserId: admin.userId,
    assignment: { previousAssignedToUserId: user.id, assignedToUserId: null },
  });
  expect(await first.user.findUniqueOrThrow({ where: { id: user.id } })).toMatchObject(change);
}, 15_000);
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
