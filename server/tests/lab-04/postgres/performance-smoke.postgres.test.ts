import { performance } from "node:perf_hooks";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "../../../src/generated/prisma/client.js";
import { requesterDashboard, staffDashboard } from "../../../src/services/dashboardService.js";
import { ActionTakenService } from "../../../src/services/actionTakenService.js";
import { listTicketActivity } from "../../../src/services/ticketActivityService.js";
import { assertLab2TestDatabase, createTestPrisma, deployMigrations, resetTestSchema } from "../../lab-02/postgres/testDatabase.js";

// Dedicated job only: ordinary npm test never generates this dataset.
describe.runIf(process.env.PERF01_RUN === "1")("PERF-01 large synthetic PostgreSQL smoke", () => {
  let prisma: PrismaClient;
  const queries: string[] = [];
  const ceiling = Number(process.env.PERF01_CEILING_MS ?? 2000);
  const actor = { userId: 1501, userPublicId: "", email: "perf-501@example.test", role: "IT_STAFF" as const };
  let ticketPublicId: string;

  beforeAll(async () => {
    const target = assertLab2TestDatabase();
    if (!target.databaseName.endsWith("_perf_test")) throw new Error("PERF-01 requires a separate disposable _perf_test database");
    if (!Number.isFinite(ceiling) || ceiling <= 0) throw new Error("PERF01_CEILING_MS must be positive");
    // This explicitly opted-in target holds disposable performance data only.
    await resetTestSchema(target);
    await deployMigrations(target);
    prisma = createTestPrisma(target, (query) => queries.push(query));
    const counts = await prisma.ticket.count();
    if (counts !== 0) throw new Error("PERF-01 requires a fresh migrated database without Tickets");
    // Set-based SQL avoids a million round trips and does not load fixture rows
    // into application memory. All SQL is static and targets guarded test data.
    await prisma.$executeRaw`
      INSERT INTO "user" (id, public_id, name, email, role, password_hash, must_change_password, created_by, updated_by)
      SELECT 1000+n, overlay(overlay(md5('perf-user-'||n) placing '4' from 13 for 1) placing '8' from 17 for 1)::uuid, 'Synthetic User '||n, 'perf-'||n||'@example.test',
        CASE WHEN n<=500 THEN 'REQUESTER' ELSE 'IT_STAFF' END::"UserRole", '!no-login', false, 'perf', 'perf'
      FROM generate_series(1,1000) n`;
    await prisma.category.create({ data: { id: 1001, name: "Performance synthetic", createdBy: "perf", updatedBy: "perf" } });
    await prisma.relatedSystem.create({ data: { id: 1001, name: "Performance synthetic", createdBy: "perf", updatedBy: "perf" } });
    await prisma.$executeRaw`
      INSERT INTO ticket (id, public_id, ticket_number, requester_id, owner_user_id, category_id, related_system_id,
        summary, description, requested_priority, it_priority, current_status, created_at, updated_at, created_by, updated_by)
      SELECT n, overlay(overlay(md5('perf-ticket-'||n) placing '4' from 13 for 1) placing '8' from 17 for 1)::uuid, 'TKT-20261007-'||lpad(n::text,12,'0'), 1001+(n-1)%500,
        CASE WHEN n%4=0 THEN NULL ELSE 1501+(n-1)%500 END, 1001, 1001, 'Synthetic Ticket '||n, 'Synthetic performance fixture',
        'MEDIUM'::"RequestedPriority", (ARRAY['LOW','MEDIUM','HIGH'])[1+n%3]::"TicketPriority",
        (ARRAY['NEW','OPEN','IN_PROGRESS','WAITING_FOR_REQUESTER','REOPENED','RESOLVED','CLOSED','CANCELLED'])[1+n%8]::"TicketStatus",
        '2026-10-01'::timestamptz+n*interval '1 second', '2026-10-01'::timestamptz+n*interval '1 second', 'perf', 'perf'
      FROM generate_series(1,100000) n`;
    await prisma.$executeRaw`
      INSERT INTO action_taken (id, public_id, ticket_id, creator_user_id, assigned_to_user_id, performed_by_user_id,
        status, description, result, cancellation_reason, follow_up_required, started_at, completed_at, cancelled_at,
        created_at, updated_at, created_by, updated_by)
      SELECT n, overlay(overlay(md5('perf-action-'||n) placing '4' from 13 for 1) placing '8' from 17 for 1)::uuid, CASE WHEN n<=1000 THEN 1 ELSE 1+(n-1)%100000 END, 1501, 1501+(n-1)%500,
        CASE WHEN n%4=2 THEN 1501+(n-1)%500 END, (ARRAY['PLANNED','IN_PROGRESS','COMPLETED','CANCELLED'])[1+n%4]::"ActionTakenStatus",
        'Synthetic Action '||n, CASE WHEN n%4=2 THEN 'Synthetic result' END, CASE WHEN n%4=3 THEN 'Synthetic cancellation' END, false,
        CASE WHEN n%4 IN (1,2) THEN '2026-10-01'::timestamptz+n*interval '1 second' END,
        CASE WHEN n%4=2 THEN '2026-10-01'::timestamptz+n*interval '1 second' END,
        CASE WHEN n%4=3 THEN '2026-10-01'::timestamptz+n*interval '1 second' END,
        '2026-10-01'::timestamptz+n*interval '1 second', '2026-10-01'::timestamptz+n*interval '1 second', 'perf', 'perf'
      FROM generate_series(1,300000) n`;
    // Keep typed Activity constraints enabled; insert parent and child atomically
    // in batches so deferred trigger queues stay bounded during preparation.
    for (let start = 1; start <= 500000; start += 10000) {
      const end = start + 9999;
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          INSERT INTO ticket_activity (id, public_id, ticket_id, performed_by_user_id, action, created_at, created_by, updated_by)
          SELECT n, overlay(overlay(md5('perf-activity-'||n) placing '4' from 13 for 1) placing '8' from 17 for 1)::uuid, a.ticket_id, 1501, 'ACTION_UPDATED'::"TicketActivityType",
            '2026-10-01'::timestamptz+n*interval '1 second', 'perf', 'perf'
          FROM generate_series(${start}::int,${end}::int) n JOIN action_taken a ON a.id=1+(n-1)%300000`;
        await tx.$executeRaw`
          INSERT INTO action_taken_activity (ticket_activity_id, action_taken_id)
          SELECT n, 1+(n-1)%300000 FROM generate_series(${start}::int,${end}::int) n`;
      }, { timeout: 60000 });
    }
    await prisma.$executeRaw`
      INSERT INTO attachment (id, storage_key, ticket_id, uploaded_by_user_id, original_name, extension, mime_type,
        size_bytes, data, created_by, updated_by)
      SELECT n, overlay(overlay(md5('perf-attachment-'||n) placing '4' from 13 for 1) placing '8' from 17 for 1)::uuid, 1, 1001, 'synthetic-'||n||'.txt', 'txt', 'text/plain', 4, '\\x74657374'::bytea, 'perf', 'perf'
      FROM generate_series(1,1000) n`;
    await prisma.$executeRaw`
      INSERT INTO action_taken_attachment (action_taken_id, attachment_id, created_by, updated_by)
      SELECT n, n, 'perf', 'perf' FROM generate_series(1,1000) n`;
    await prisma.$executeRaw`ANALYZE`;
    ticketPublicId = (await prisma.ticket.findUniqueOrThrow({ where: { id: 1 } })).publicId;
    actor.userPublicId = (await prisma.user.findUniqueOrThrow({ where: { id: actor.userId } })).publicId;
    console.info("PERF-01 environment", { node: process.version, ceilingMs: ceiling, target: `${new URL(target.url).host}/${target.databaseName}` });
    console.info("PERF-01 counts", { users: await prisma.user.count({ where: { isSystem: false } }), tickets: await prisma.ticket.count(), actions: await prisma.actionTaken.count(), activities: await prisma.ticketActivity.count(), attachmentJoins: await prisma.actionTakenAttachment.count() });
    expect(await prisma.user.count({ where: { isSystem: false } })).toBeGreaterThanOrEqual(1000);
    expect(await prisma.ticket.count()).toBeGreaterThanOrEqual(100000);
    expect(await prisma.actionTaken.count()).toBeGreaterThanOrEqual(300000);
    expect(await prisma.ticketActivity.count()).toBeGreaterThanOrEqual(500000);
  }, 600000);
  afterAll(async () => { await prisma?.$disconnect(); });

  async function measured<T>(name: string, run: () => Promise<T>, queryLimit: number): Promise<T> {
    await run(); // warmup is excluded
    queries.length = 0;
    const started = performance.now();
    const result = await run();
    const elapsedMs = performance.now() - started;
    const reads = queries.filter((sql) => /^SELECT/i.test(sql));
    const rowReads = reads.filter((sql) => !/COUNT\(/i.test(sql));
    expect(reads.length).toBeLessThanOrEqual(queryLimit);
    // Collection reads use LIMIT. Prisma relation hydration uses one bounded
    // IN query per relation over only those parent IDs, rather than N+1 reads.
    for (const sql of rowReads) {
      expect(sql).toMatch(/LIMIT| IN \(/i);
      expect(sql.match(/\$\d+/g)?.length ?? 0).toBeLessThanOrEqual(100);
    }
    console.info("PERF-01 probe", { name, elapsedMs: Math.round(elapsedMs), ceilingMs: ceiling, reads: reads.length, boundedReads: rowReads.length });
    expect(elapsedMs).toBeLessThanOrEqual(ceiling);
    return result;
  }
  it("Requester Dashboard remains scoped and bounded", async () => {
    const result = await measured("Requester Dashboard", () => requesterDashboard(prisma, 1001, 20), 5);
    expect(result.recentTickets).toHaveLength(20);
    expect(result.metrics.activeTickets + result.metrics.resolvedTickets + result.metrics.closedTickets).toBeLessThanOrEqual(200);
  });
  it("Staff Dashboard limits query-side rows across lifecycle groups and joins", async () => {
    const result = await measured("Staff Dashboard", () => staffDashboard(prisma, actor.userId, { myActionsSize: 20, recentTicketsSize: 20, urgentTicketsSize: 20 }), 5 + 3 * 3 + 4 * 4);
    expect(result.myActions).toHaveLength(20);
    expect(result.recentTickets).toHaveLength(20);
    expect(result.urgentTickets).toHaveLength(20);
  });
  it("Action collection honors pagination on a populated Ticket", async () => {
    // Parent check, count, page plus four batched summary relations.
    const result = await measured("Action page", () => new ActionTakenService(prisma).list(actor, ticketPublicId, { pageNumber: "2", pageSize: "20" }), 3 + 4);
    expect(result.items).toHaveLength(20);
    expect(result.pagination).toMatchObject({ pageNumber: 2, pageSize: 20, hasNextPage: true });
    const action = await prisma.actionTaken.findUniqueOrThrow({ where: { id: 1 }, select: { publicId: true } });
    const detail = await new ActionTakenService(prisma).detail(actor, ticketPublicId, action.publicId);
    expect(detail.attachments).toHaveLength(1);
    expect(detail.attachments[0]).not.toHaveProperty("data");
  });
  it("Activity page honors pagination and typed relation joins", async () => {
    // Parent/count/page plus at most eleven normalized detail/user relations.
    const result = await measured("Activity page", () => listTicketActivity(prisma, actor, ticketPublicId, { pageNumber: "2", pageSize: "20" }), 3 + 11);
    expect(result.items).toHaveLength(20);
    expect(result.pagination).toMatchObject({ pageNumber: 2, pageSize: 20, hasNextPage: true });
  });
});
