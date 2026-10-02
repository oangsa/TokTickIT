import { afterAll, beforeAll, expect, it } from "vitest";
import type { PrismaClient } from "../../../src/generated/prisma/client.js";
import { requesterDashboard, staffDashboard } from "../../../src/services/dashboardService.js";
import { actionDatabase, type ActionDatabase } from "../support/actionDatabase.js";
let database: ActionDatabase;
const sizes = { myActionsSize: 20, recentTicketsSize: 20, urgentTicketsSize: 20 };
beforeAll(async () => { database = await actionDatabase(); }, 60_000);
afterAll(async () => { await database?.close(); });
it("PG-12 empty database yields zero Requester and operational snapshots", async () => {
  expect(await database.first.ticket.count()).toBe(0);
  expect(await staffDashboard(database.first, database.staff.userId, sizes)).toEqual({ metrics: { unassignedTickets: 0, myAssignedTickets: 0, inProgressTickets: 0, waitingForRequester: 0, highPriorityTickets: 0 }, myActions: [], recentTickets: [], urgentTickets: [] });
  expect(await requesterDashboard(database.first, database.requester.userId)).toEqual({ metrics: { activeTickets: 0, waitingForRequester: 0, resolvedTickets: 0, closedTickets: 0 }, recentTickets: [] });
});
it("PG-12 every metric/list agrees with independent SQL including lifecycle ordering, deduplication, deleted parents, priorities and requester scope", async () => {
  const { first, requester, staff, other } = database;
  for (const [index, status] of (["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"] as const).entries()) {
    const ticket = await database.ticket(status, index % 2 ? staff.userId : null);
    await first.ticket.update({ where: { id: ticket.id }, data: { itPriority: status === "RESOLVED" || index % 2 ? "HIGH" : "LOW", ownerUserId: status === "RESOLVED" ? staff.userId : ticket.ownerUserId, updatedAt: new Date("2026-10-01"), createdAt: new Date("2026-09-01") } });
  }
  const foreign = await database.ticket("WAITING_FOR_REQUESTER");
  await first.ticket.update({ where: { id: foreign.id }, data: { requesterId: other.userId, itPriority: "HIGH" } });
  const deleted = await database.ticket("IN_PROGRESS"); await first.ticket.update({ where: { id: deleted.id }, data: { deleted: true, itPriority: "HIGH" } });
  const parent = await database.ticket("OPEN", null);
  await first.ticket.update({ where: { id: parent.id }, data: { itPriority: "HIGH", createdAt: new Date("2026-09-01"), updatedAt: new Date("2026-10-01") } });
  // Lifecycle rows have different event times; update time intentionally cannot select ordering.
  for (let index = 0; index < 24; index++) {
    const status = (["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const)[index % 4];
    const time = new Date(Date.UTC(2026, 9, 1, 0, index % 8));
    await first.actionTaken.create({ data: {
      ticketId: index === 23 ? deleted.id : parent.id, creatorUserId: staff.userId, assignedToUserId: index === 21 ? other.userId : staff.userId,
      performedByUserId: status === "COMPLETED" ? staff.userId : null, status, description: `Dashboard action ${index}`, followUpRequired: false,
      createdAt: status === "PLANNED" ? time : new Date("2026-09-01"), startedAt: status === "IN_PROGRESS" || status === "COMPLETED" ? time : null,
      completedAt: status === "COMPLETED" ? time : null, cancelledAt: status === "CANCELLED" ? time : null,
      result: status === "COMPLETED" ? "Verified" : null, cancellationReason: status === "CANCELLED" ? "Not needed" : null, createdBy: "test", updatedBy: "test",
    } });
  }
  const requesterResult = await requesterDashboard(first, requester.userId, 7);
  const requesterCounts = await first.$queryRaw<{ active: bigint; waiting: bigint; resolved: bigint; closed: bigint }[]>`
    SELECT count(*) FILTER (WHERE current_status IN ('NEW','OPEN','IN_PROGRESS','WAITING_FOR_REQUESTER','REOPENED')) AS active,
      count(*) FILTER (WHERE current_status='WAITING_FOR_REQUESTER') AS waiting,
      count(*) FILTER (WHERE current_status='RESOLVED') AS resolved, count(*) FILTER (WHERE current_status='CLOSED') AS closed
    FROM ticket WHERE NOT deleted AND requester_id=${requester.userId}`;
  const count = requesterCounts[0];
  expect(requesterResult.metrics).toEqual({ activeTickets: Number(count.active), waitingForRequester: Number(count.waiting), resolvedTickets: Number(count.resolved), closedTickets: Number(count.closed) });
  expect(requesterResult.metrics).toEqual({ activeTickets: 6, waitingForRequester: 1, resolvedTickets: 1, closedTickets: 1 });
  const ownRows = await first.$queryRaw<{ public_id: string }[]>`SELECT public_id FROM ticket WHERE NOT deleted AND requester_id=${requester.userId} ORDER BY updated_at DESC,id DESC LIMIT 7`;
  expect(requesterResult.recentTickets.map((row) => row.publicId)).toEqual(ownRows.map((row) => row.public_id));
  for (const actor of [staff, database.admin]) {
    const result = await staffDashboard(first, actor.userId, sizes);
    expect(result.metrics).toEqual({ unassignedTickets: 4, myAssignedTickets: actor === staff ? 4 : 0, inProgressTickets: 1, waitingForRequester: 2, highPriorityTickets: 5 });
    console.info("PG-12 independent DB comparison", { role: actor.role, metrics: result.metrics, limits: sizes });
    const counts = (await first.$queryRaw<{ unassigned: bigint; mine: bigint; progress: bigint; waiting: bigint; high: bigint }[]>`
      SELECT count(*) FILTER (WHERE owner_user_id IS NULL AND current_status NOT IN ('CLOSED','CANCELLED')) AS unassigned,
        count(*) FILTER (WHERE owner_user_id=${actor.userId} AND current_status NOT IN ('CLOSED','CANCELLED')) AS mine,
        count(*) FILTER (WHERE current_status='IN_PROGRESS') AS progress, count(*) FILTER (WHERE current_status='WAITING_FOR_REQUESTER') AS waiting,
        count(*) FILTER (WHERE it_priority='HIGH' AND current_status NOT IN ('CLOSED','CANCELLED')) AS high FROM ticket WHERE NOT deleted`)[0];
    expect(result.metrics).toEqual({ unassignedTickets: Number(counts.unassigned), myAssignedTickets: Number(counts.mine), inProgressTickets: Number(counts.progress), waitingForRequester: Number(counts.waiting), highPriorityTickets: Number(counts.high) });
    const recent = await first.$queryRaw<{ public_id: string }[]>`SELECT public_id FROM ticket WHERE NOT deleted AND current_status NOT IN ('CLOSED','CANCELLED') ORDER BY updated_at DESC,id DESC LIMIT 20`;
    const urgent = await first.$queryRaw<{ public_id: string }[]>`SELECT public_id FROM ticket WHERE NOT deleted AND current_status NOT IN ('CLOSED','CANCELLED') AND it_priority='HIGH' ORDER BY (owner_user_id IS NOT NULL), created_at ASC,id ASC LIMIT 20`;
    const actions = await first.$queryRaw<{ public_id: string; activity_at: Date }[]>`
      SELECT a.public_id, CASE a.status WHEN 'COMPLETED' THEN a.completed_at WHEN 'CANCELLED' THEN a.cancelled_at WHEN 'IN_PROGRESS' THEN a.started_at ELSE a.created_at END AS activity_at
      FROM action_taken a JOIN ticket t ON t.id=a.ticket_id WHERE NOT t.deleted AND (a.assigned_to_user_id=${actor.userId} OR a.performed_by_user_id=${actor.userId}) ORDER BY activity_at DESC,a.id DESC LIMIT 20`;
    expect(result.recentTickets.map((row) => row.publicId)).toEqual(recent.map((row) => row.public_id));
    expect(result.urgentTickets.map((row) => row.publicId)).toEqual(urgent.map((row) => row.public_id));
    expect(result.myActions.map((row) => [row.publicId, row.activityAt])).toEqual(actions.map((row) => [row.public_id, row.activity_at.toISOString()]));
    expect(new Set(result.myActions.map((row) => row.publicId)).size).toBe(result.myActions.length);
    const bounded = await staffDashboard(first, actor.userId, { myActionsSize: 1, recentTicketsSize: 2, urgentTicketsSize: 3 });
    expect(bounded.metrics).toEqual(result.metrics); expect(bounded.myActions).toEqual(result.myActions.slice(0, 1)); expect(bounded.recentTickets).toEqual(result.recentTickets.slice(0, 2)); expect(bounded.urgentTickets).toEqual(result.urgentTickets.slice(0, 3));
  }
});
it.each(["requester", "staff"])("PG-12 %s retains one REPEATABLE READ snapshot across a concurrent committed write", async (kind) => {
  const { first, second, requester, staff } = database;
  const ticket = await database.ticket("OPEN", null);
  const before = kind === "requester" ? await requesterDashboard(first, requester.userId) : await staffDashboard(first, staff.userId, sizes);
  let changed = false;
  const intercepted = new Proxy(first, { get(target, property) {
    if (property !== "$transaction") return Reflect.get(target, property);
    return (callback: (tx: unknown) => Promise<unknown>, options: unknown) => target.$transaction(async (tx) => {
      const count = tx.ticket.count.bind(tx.ticket);
      const wrapped = new Proxy(tx.ticket, { get(delegate, key) {
        if (key !== "count") return Reflect.get(delegate, key);
        return async (input: Parameters<typeof count>[0]) => {
          const value = await count(input);
          if (!changed) {
            changed = true;
            const isolation = await tx.$queryRaw<{ transaction_isolation: string }[]>`SHOW transaction_isolation`;
            expect(isolation[0].transaction_isolation).toBe("repeatable read");
            await second.ticket.update({ where: { id: ticket.id }, data: { currentStatus: "WAITING_FOR_REQUESTER", summary: "Concurrent committed change", itPriority: "HIGH" } });
          }
          return value;
        };
      } });
      return callback(new Proxy(tx, { get(value, key) { return key === "ticket" ? wrapped : Reflect.get(value, key); } }));
    }, options as { isolationLevel: "RepeatableRead" });
  } }) as PrismaClient;
  const during = kind === "requester" ? await requesterDashboard(intercepted, requester.userId) : await staffDashboard(intercepted, staff.userId, sizes);
  expect(during).toEqual(before);
  const after = kind === "requester" ? await requesterDashboard(first, requester.userId) : await staffDashboard(first, staff.userId, sizes);
  expect(after.metrics.waitingForRequester).toBe(before.metrics.waitingForRequester + 1);
  expect(after.recentTickets.find((row) => row.publicId === ticket.publicId)?.summary).toBe("Concurrent committed change");
});
