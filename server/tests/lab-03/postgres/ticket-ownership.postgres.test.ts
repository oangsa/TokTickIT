import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient, TicketStatus } from "../../../src/generated/prisma/client.js";
import { mutateStaffTicket, type TicketActor } from "../../../src/services/ticketWorkflowService.js";
import { listAssignableUsers, listStaffTickets } from "../../../src/services/staffTicketReadService.js";
import { parseStaffQueueQuery } from "../../../src/services/staffQueueQueryValidator.js";
import { assertLab2TestDatabase, createTestPrisma, deployMigrations, resetTestSchema } from "../../lab-02/postgres/testDatabase.js";

describe.sequential("PG-07–09 real ownership concurrency and Queue @issue-5", () => {
  let first: PrismaClient;
  let second: PrismaClient;
  let staff: TicketActor;
  let other: TicketActor;
  let admin: TicketActor;
  let requesterId: number;
  let categoryId: number;
  let relatedSystemId: number;
  beforeAll(async () => {
    const target = assertLab2TestDatabase();
    await resetTestSchema(target); await deployMigrations(target);
    first = createTestPrisma(target); second = createTestPrisma(target);
    const users = await Promise.all((["IT_STAFF", "IT_STAFF", "ADMINISTRATOR", "REQUESTER"] as const).map((role, index) => first.user.create({ data: { name: "Same Name", email: `issue5-${index}@example.test`, role, passwordHash: "unusable-test-fixture", mustChangePassword: false, createdBy: "test", updatedBy: "test" } })));
    [staff, other, admin] = users.slice(0, 3).map((user) => ({ userId: user.id, userPublicId: user.publicId, email: user.email, role: user.role }));
    requesterId = users[3].id;
    categoryId = (await first.category.create({ data: { name: "Issue 5 Category", createdBy: "test", updatedBy: "test" } })).id;
    relatedSystemId = (await first.relatedSystem.create({ data: { name: "Issue 5 System", createdBy: "test", updatedBy: "test" } })).id;
  }, 120_000);
  afterAll(async () => { await first?.$disconnect(); await second?.$disconnect(); });
  async function ticket(status: TicketStatus = "NEW", ownerUserId: number | null = null) {
    return first.ticket.create({ data: { publicId: randomUUID(), ticketNumber: `TKT-20260916-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`, requesterId, categoryId, relatedSystemId, summary: "Concurrency fixture", description: "Synthetic concurrency fixture.", currentStatus: status, ownerUserId, requestedPriority: "MEDIUM", itPriority: "HIGH", createdBy: "test", updatedBy: "test" } });
  }
  it("PG-07 concurrent Claims have one winner and atomic NEW to OPEN", async () => {
    const row = await ticket();
    const results = await Promise.allSettled([mutateStaffTicket(first, staff, row.publicId, "claim", {}), mutateStaffTicket(second, other, row.publicId, "claim", {})]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({ reason: { code: "OWNERSHIP_CONFLICT" } });
    expect(await first.ticket.findUnique({ where: { id: row.id } })).toMatchObject({ currentStatus: "OPEN", ownerUserId: expect.any(Number), requestedPriority: "MEDIUM", itPriority: "HIGH" });
  });
  it("PG-08 competing expected-owner reassign/unassign cannot overwrite winner", async () => {
    const row = await ticket("IN_PROGRESS", staff.userId);
    const results = await Promise.allSettled([
      mutateStaffTicket(first, staff, row.publicId, "owner", { ownerPublicId: other.userPublicId, expectedOwnerPublicId: staff.userPublicId }),
      mutateStaffTicket(second, other, row.publicId, "owner", { ownerPublicId: null, expectedOwnerPublicId: staff.userPublicId }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({ reason: { code: "OWNERSHIP_CONFLICT" } });
    expect((await first.ticket.findUniqueOrThrow({ where: { id: row.id } })).currentStatus).toBe("IN_PROGRESS");
  });
  it("PG-09 assignment opens NEW; reopened assignment preserves priorities and status", async () => {
    for (const status of ["NEW", "REOPENED"] as const) {
      const row = await ticket(status);
      const updated = await mutateStaffTicket(first, staff, row.publicId, "owner", { ownerPublicId: admin.userPublicId, expectedOwnerPublicId: null });
      expect(updated).toMatchObject({ currentStatus: status === "NEW" ? "OPEN" : "REOPENED", requestedPriority: "MEDIUM", itPriority: "HIGH", owner: { publicId: admin.userPublicId } });
      if (status === "REOPENED") expect((await mutateStaffTicket(first, admin, row.publicId, "start-work", {})).currentStatus).toBe("IN_PROGRESS");
    }
  });
  it("rejects Claim on unassigned CANCELLED and CLOSED Tickets and leaves state untouched", async () => {
    for (const status of ["CANCELLED", "CLOSED"] as const) {
      const row = await ticket(status);
      await expect(mutateStaffTicket(first, staff, row.publicId, "claim", {})).rejects.toMatchObject({ code: "INVALID_STATUS_TRANSITION" });
      const after = await first.ticket.findUniqueOrThrow({ where: { id: row.id } });
      expect(after.ownerUserId).toBeNull();
      expect(after.currentStatus).toBe(status);
    }
  });
  it("assignable lookup includes zero-Ticket eligible Users and excludes inactive/deleted/Requester", async () => {
    const createUser = (extra: object) => first.user.create({ data: { name: "Same Name", email: `${randomUUID()}@example.test`, role: "IT_STAFF", passwordHash: "unusable-test-fixture", createdBy: "test", updatedBy: "test", ...extra } });
    const zero = await createUser({});
    const inactive = await createUser({ isActive: false });
    const deleted = await createUser({ deleted: true });
    const rows = await listAssignableUsers(first);
    expect(rows.some((row) => row.publicId === zero.publicId)).toBe(true);
    expect(rows.some((row) => [inactive.publicId, deleted.publicId].includes(row.publicId))).toBe(false);
    expect(rows.every((row) => row.role !== ("REQUESTER" as string))).toBe(true);
    expect(rows.map((row) => row.publicId)).toEqual(rows.map((row) => row.publicId).sort());
    for (const row of rows) expect(Object.keys(row).sort()).toEqual(["name", "publicId", "role"]);
    for (const publicId of [inactive.publicId, deleted.publicId]) {
      const row = await ticket();
      await expect(mutateStaffTicket(first, staff, row.publicId, "owner", { ownerPublicId: publicId, expectedOwnerPublicId: null })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    }
  });
  it("Queue default order, search and owner filters execute against PostgreSQL", async () => {
    const category = await first.category.create({ data: { name: "Ordering fixture", createdBy: "test", updatedBy: "test" } });
    const created = [];
    for (const [ownerUserId, itPriority] of [[staff.userId, "HIGH"], [null, "LOW"], [null, "HIGH"], [other.userId, "LOW"], [null, "MEDIUM"]] as const) {
      const row = await ticket();
      created.push(await first.ticket.update({ where: { id: row.id }, data: { categoryId: category.id, ownerUserId, itPriority } }));
    }
    const filters = JSON.stringify([{ field: "categoryId", condition: "EQUAL", value: category.id }]);
    const firstPage = await listStaffTickets(first, parseStaffQueueQuery({ filters, pageSize: "3", search: "Same Name", searchFields: "requesterName" }));
    expect(firstPage.items.map((row) => row.publicId)).toEqual([created[2].publicId, created[4].publicId, created[1].publicId]);
    expect(firstPage.items[0]).not.toHaveProperty("description"); expect(firstPage.items[0]).not.toHaveProperty("id");
    const nextPage = await listStaffTickets(first, parseStaffQueueQuery({ filters, pageSize: "3", pageNumber: "2" }));
    expect(nextPage.items.map((row) => row.publicId)).toEqual([created[0].publicId, created[3].publicId]);
    const owned = await listStaffTickets(first, parseStaffQueueQuery({ filters: JSON.stringify([{ field: "ownerPublicId", condition: "EQUAL", value: other.userPublicId }]) }));
    expect(owned.items.every((row) => row.owner?.publicId === other.userPublicId)).toBe(true);
  });
});
