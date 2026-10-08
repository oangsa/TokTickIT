import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import type { PrismaClient } from "../../../src/generated/prisma/client.js";
import { ActionTakenService } from "../../../src/services/actionTakenService.js";
import { applyRequesterTicketAction } from "../../../src/services/ticketService.js";
import { mutateStaffTicket } from "../../../src/services/ticketWorkflowService.js";
import { actionDatabase, type ActionDatabase } from "../support/actionDatabase.js";
import { createBody } from "../support/actionFixture.js";
let database: ActionDatabase;
beforeAll(async () => { database = await actionDatabase(); }, 120_000);
afterAll(async () => database?.close());
async function complete(ticketPublicId: string) {
  const { staff, service } = database;
  const created = (await database.create(ticketPublicId)).action;
  await service.lifecycle(staff, ticketPublicId, created.publicId, "start", { expectedVersion: 1 }, randomUUID());
  return (await service.lifecycle(staff, ticketPublicId, created.publicId, "complete", { expectedVersion: 2, result: "Verified working", followUpRequired: false }, randomUUID())).action;
}
it.each(["zero", "cancelled only", "migrated only", "planned", "in progress", "real completed", "real plus cancelled"])("PG-11 real dataset %s", async (dataset) => {
  const { first, staff, service } = database; const ticket = await database.ticket("IN_PROGRESS");
  if (["planned", "in progress", "real completed", "real plus cancelled"].includes(dataset)) await complete(ticket.publicId);
  if (["cancelled only", "planned", "in progress", "real plus cancelled"].includes(dataset)) {
    const action = (await database.create(ticket.publicId)).action;
    if (dataset.includes("cancelled")) await service.lifecycle(staff, ticket.publicId, action.publicId, "cancel", { expectedVersion: 1, cancellationReason: "Unneeded work" }, randomUUID());
    if (dataset === "in progress") await service.lifecycle(staff, ticket.publicId, action.publicId, "start", { expectedVersion: 1 }, randomUUID());
  }
  if (dataset === "migrated only") await first.actionTaken.create({ data: { ticketId: ticket.id, creatorUserId: staff.userId, status: "COMPLETED", isMigrated: true, followUpRequired: false, description: "Historical snapshot", result: "Historical work", completedAt: new Date(), createdBy: "test", updatedBy: "test" } });
  if (dataset === "real completed" || dataset === "real plus cancelled") {
    expect((await mutateStaffTicket(first, staff, ticket.publicId, "mark-resolved", {})).currentStatus).toBe("RESOLVED");
    expect(await first.ticketActivity.count({ where: { ticketId: ticket.id, action: "TICKET_MARKED_RESOLVED" } })).toBe(1);
  } else {
    await expect(mutateStaffTicket(first, staff, ticket.publicId, "mark-resolved", {})).rejects.toMatchObject({ code: "INVALID_STATUS_TRANSITION" });
    expect((await first.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).currentStatus).toBe("IN_PROGRESS");
    expect(await first.ticketActivity.count({ where: { ticketId: ticket.id, action: "TICKET_MARKED_RESOLVED" } })).toBe(0);
  }
});
it.each(["RESOLVED", "CLOSED"] as const)("PG-15 historical %s reopens with Actions intact, real new completion required", async (status) => {
  const { first, requester, staff } = database; const ticket = await database.ticket(status);
  const migrated = await first.actionTaken.create({ data: { ticketId: ticket.id, creatorUserId: staff.userId, status: "COMPLETED", isMigrated: true, followUpRequired: false, description: "Legacy work", result: "Snapshot", completedAt: new Date(), createdBy: "test", updatedBy: "test" } });
  const reopened = await applyRequesterTicketAction(first, requester.userId, requester.email, ticket.publicId, "reopen");
  expect(reopened).toMatchObject({ currentStatus: "REOPENED", owner: null, requesterResolutionConfirmedAt: null });
  await mutateStaffTicket(first, staff, ticket.publicId, "claim", {});
  await expect(mutateStaffTicket(first, staff, ticket.publicId, "mark-resolved", {})).rejects.toMatchObject({ code: "INVALID_STATUS_TRANSITION" });
  await complete(ticket.publicId);
  expect((await mutateStaffTicket(first, staff, ticket.publicId, "mark-resolved", {})).currentStatus).toBe("RESOLVED");
  expect(await first.actionTaken.findUniqueOrThrow({ where: { id: migrated.id } })).toEqual(migrated);
});
function barrier() {
  let release!: () => void; let entered!: () => void;
  return { wait: new Promise<void>((resolve) => { release = resolve; }), ready: new Promise<void>((resolve) => { entered = resolve; }), release: () => release(), enter: () => entered() };
}
async function waitForParentLock() {
  for (let attempt = 0; attempt < 100; attempt++) {
    const waiting = await database.first.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%FROM ticket%FOR %'`;
    if (Number(waiting[0].count) > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Expected real PostgreSQL parent-lock wait");
}
it.each(["resolution first", "Action create first"])("PG-11 %s serializes Action creation with gate", async (order) => {
  const { first, second, staff } = database; const ticket = await database.ticket("IN_PROGRESS"); await complete(ticket.publicId);
  const gate = barrier();
  let held = false;
  const paused = first.$extends({ query: { ticket: { async findFirst({ args, query }) {
    const row = await query(args);
    // Workflow includes relations; Action's locked read uses select. Its preliminary read must pass.
    if (!held && (order === "resolution first" ? Boolean(args.include) : Boolean(args.select))) {
      if (order === "Action create first") {
        // First select is preflight outside mutation; hold only the second read.
        if (!preflightSeen) { preflightSeen = true; return row; }
      }
      held = true; gate.enter(); await gate.wait;
    }
    return row;
  } } } }) as unknown as PrismaClient;
  let preflightSeen = false;
  const leading = order === "resolution first"
    ? mutateStaffTicket(paused, staff, ticket.publicId, "mark-resolved", {})
    : new ActionTakenService(paused).create(staff, ticket.publicId, createBody, randomUUID());
  await gate.ready;
  const trailing = order === "resolution first"
    ? new ActionTakenService(second).create(staff, ticket.publicId, createBody, randomUUID())
    : mutateStaffTicket(second, staff, ticket.publicId, "mark-resolved", {});
  const settled = Promise.allSettled([leading, trailing]);
  try { await waitForParentLock(); } finally { gate.release(); }
  const outcomes = await settled;
  expect(outcomes[0].status).toBe("fulfilled");
  expect(outcomes[1]).toMatchObject({ status: "rejected", reason: { code: order === "resolution first" ? "INVALID_ACTION_TRANSITION" : "INVALID_STATUS_TRANSITION" } });
  const saved = await first.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
  expect(saved.currentStatus).toBe(order === "resolution first" ? "RESOLVED" : "IN_PROGRESS");
  expect(await first.actionTaken.count({ where: { ticketId: ticket.id, status: { in: ["PLANNED", "IN_PROGRESS"] } } })).toBe(order === "resolution first" ? 0 : 1);
  expect(await first.ticketActivity.count({ where: { ticketId: ticket.id, action: "TICKET_MARKED_RESOLVED" } })).toBe(order === "resolution first" ? 1 : 0);
});
it.each(["complete", "cancel"] as const)("PG-11 resolution waits for concurrent Action %s before checking committed gate", async (operation) => {
  const { first, second, staff, service } = database; const ticket = await database.ticket("IN_PROGRESS");
  if (operation === "cancel") await complete(ticket.publicId);
  const action = (await database.create(ticket.publicId)).action;
  await service.lifecycle(staff, ticket.publicId, action.publicId, "start", { expectedVersion: 1 }, randomUUID());
  const gate = barrier(); let held = false;
  const paused = first.$extends({ query: { actionTaken: { async updateMany({ args, query }) {
    const result = await query(args);
    if (!held) { held = true; gate.enter(); await gate.wait; }
    return result;
  } } } }) as unknown as PrismaClient;
  const body = operation === "complete" ? { expectedVersion: 2, result: "Concurrent real work", followUpRequired: false } : { expectedVersion: 2, cancellationReason: "Unneeded remaining work" };
  const mutation = new ActionTakenService(paused).lifecycle(staff, ticket.publicId, action.publicId, operation, body, randomUUID());
  await gate.ready;
  const resolution = mutateStaffTicket(second, staff, ticket.publicId, "mark-resolved", {});
  const settled = Promise.allSettled([mutation, resolution]);
  try { await waitForParentLock(); } finally { gate.release(); }
  const results = await settled;
  expect(results.every((result) => result.status === "fulfilled")).toBe(true);
  expect((await first.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).currentStatus).toBe("RESOLVED");
  expect(await first.actionTaken.count({ where: { ticketId: ticket.id, status: { in: ["PLANNED", "IN_PROGRESS"] } } })).toBe(0);
  expect(await first.actionTaken.count({ where: { ticketId: ticket.id, status: "COMPLETED", isMigrated: false } })).toBeGreaterThanOrEqual(1);
  expect(await first.ticketActivity.count({ where: { ticketId: ticket.id, action: "TICKET_MARKED_RESOLVED" } })).toBe(1);
});
