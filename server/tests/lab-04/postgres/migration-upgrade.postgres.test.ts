import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "../../../src/generated/prisma/client.js";
import { assertLab3TargetEnvironment } from "../../../src/databaseTargetGuard.js";

const migrationRoot = fileURLToPath(new URL("../../../prisma/migrations/", import.meta.url));
const migrations = [
  "20260808064543_add_category",
  "20260822000000_lab2_data_model",
  "20260826000000_ticket_number_varchar",
  "20260913000000_lab3_auth_foundation",
  "20260930000000_lab4_data_foundation",
];

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function statements(sql: string): string[] {
  const result: string[] = [];
  let start = 0;
  let state: "normal" | "single" | "double" | "line" | "block" | "dollar" = "normal";
  let dollarTag = "";
  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index];
    const next = sql[index + 1];
    if (state === "line") { if (character === "\n") state = "normal"; continue; }
    if (state === "block") { if (character === "*" && next === "/") { state = "normal"; index += 1; } continue; }
    if (state === "single") { if (character === "'" && next === "'") index += 1; else if (character === "'") state = "normal"; continue; }
    if (state === "double") { if (character === '"' && next === '"') index += 1; else if (character === '"') state = "normal"; continue; }
    if (state === "dollar") { if (sql.startsWith(dollarTag, index)) { state = "normal"; index += dollarTag.length - 1; } continue; }
    if (character === "-" && next === "-") { state = "line"; index += 1; }
    else if (character === "/" && next === "*") { state = "block"; index += 1; }
    else if (character === "'") state = "single";
    else if (character === '"') state = "double";
    else if (character === "$") {
      const tag = sql.slice(index).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/)?.[0];
      if (tag) { state = "dollar"; dollarTag = tag; index += tag.length - 1; }
    } else if (character === ";") {
      const statement = sql.slice(start, index + 1).replace(/--.*$/gm, "").trim();
      if (statement && !/^(BEGIN|COMMIT);?$/i.test(statement)) result.push(statement);
      start = index + 1;
    }
  }
  const trailing = sql.slice(start).replace(/--.*$/gm, "").trim();
  if (trailing && !/^(BEGIN|COMMIT);?$/i.test(trailing)) result.push(trailing);
  return result;
}

describe("Lab 4 migration upgrade @issue-78", () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    const target = assertLab3TargetEnvironment();
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: target }) });
  });

  afterAll(async () => prisma?.$disconnect());

  it("preserves Lab 3 rows and backfills truthful snapshots and eligible Actions", async () => {
    const schemaName = `lab4_upgrade_${Date.now()}_${process.pid}`;
      const schema = quoteIdentifier(schemaName);
    const scopedUrl = new URL(assertLab3TargetEnvironment());
    scopedUrl.searchParams.set("schema", schemaName);
    const scoped = new PrismaClient({ adapter: new PrismaPg({ connectionString: scopedUrl.toString() }) });

    try {
      await prisma.$executeRawUnsafe(`CREATE SCHEMA ${schema}`);
      for (const migration of migrations.slice(0, -1)) {
        await scoped.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(`SET LOCAL search_path TO ${schema}, public`);
          for (const statement of statements(readFileSync(`${migrationRoot}${migration}/migration.sql`, "utf8"))) {
            await tx.$executeRawUnsafe(statement);
          }
        });
      }

      await scoped.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL search_path TO ${schema}, public`);
        await tx.$executeRawUnsafe(`INSERT INTO category (id, name, created_by, updated_by) VALUES (11, 'Legacy', 'fixture', 'fixture')`);
        await tx.$executeRawUnsafe(`INSERT INTO related_system (id, name, created_by, updated_by) VALUES (12, 'Legacy', 'fixture', 'fixture')`);
        await tx.$executeRawUnsafe(`
          INSERT INTO "user" (id, public_id, name, email, role, password_hash, must_change_password, created_by, updated_by)
          VALUES (13, '13000000-0000-4000-8000-000000000001', 'Requester', 'requester@example.test', 'REQUESTER', '!fixture', false, 'fixture', 'fixture'),
                 (14, '14000000-0000-4000-8000-000000000001', 'Owner', 'owner@example.test', 'IT_STAFF', '!fixture', false, 'fixture', 'fixture')
        `);
        await tx.$executeRawUnsafe(`
          INSERT INTO ticket (id, public_id, ticket_number, requester_id, owner_user_id, category_id, related_system_id, summary, requested_priority, it_priority, description, current_status, created_by, updated_by, updated_at)
          VALUES
            (21, '21000000-0000-4000-8000-000000000001', 'TKT-20260101-000000000021', 13, 14, 11, 12, 'Resolved legacy ticket', 'HIGH', 'HIGH', 'Legacy ticket description.', 'RESOLVED', 'fixture', 'fixture', '2026-01-02 03:04:05+00'),
            (22, '22000000-0000-4000-8000-000000000001', 'TKT-20260101-000000000022', 13, NULL, 11, 12, 'Closed legacy ticket', 'LOW', 'MEDIUM', 'Legacy ticket description.', 'CLOSED', 'fixture', 'fixture', '2026-02-03 04:05:06+00'),
            (23, '23000000-0000-4000-8000-000000000001', 'TKT-20260101-000000000023', 13, NULL, 11, 12, 'Cancelled legacy ticket', 'MEDIUM', 'LOW', 'Legacy ticket description.', 'CANCELLED', 'fixture', 'fixture', '2026-03-04 05:06:07+00'),
            (24, '24000000-0000-4000-8000-000000000001', 'TKT-20260101-000000000024', 13, NULL, 11, 12, 'Open legacy ticket', 'LOW', 'LOW', 'Legacy ticket description.', 'OPEN', 'fixture', 'fixture', '2026-04-05 06:07:08+00')
        `);
        await tx.$executeRawUnsafe(`INSERT INTO attachment (id, storage_key, ticket_id, uploaded_by_user_id, original_name, extension, mime_type, size_bytes, data, created_by, updated_by)
          VALUES (31, '31000000-0000-4000-8000-000000000001', 21, 13, 'legacy.txt', 'txt', 'text/plain', 4, decode('74657374', 'hex'), 'fixture', 'fixture');
        `);
        await tx.$executeRawUnsafe(`INSERT INTO public_comment (id, ticket_id, author_user_id, content) VALUES (41, 21, 13, 'Legacy comment')`);
        await tx.$executeRawUnsafe(`INSERT INTO internal_note (id, ticket_id, author_user_id, content) VALUES (51, 21, 14, 'Legacy note')`);
        await tx.$executeRawUnsafe(`INSERT INTO idempotency_record (id, requester_id, key, request_hash, status, processing_started_at, ticket_id, completed_at, expires_at, created_by, updated_by) VALUES (61, 13, '61000000-0000-4000-8000-000000000001', repeat('a', 64), 'COMPLETED', '2026-01-02 03:04:05+00', 21, '2026-01-02 03:05:05+00', '2026-01-03 03:05:05+00', 'fixture', 'fixture')`);
        await tx.$executeRawUnsafe(`INSERT INTO idempotency_record (id, requester_id, key, request_hash, status, processing_started_at, created_by, updated_by) VALUES (62, 13, '62000000-0000-4000-8000-000000000001', repeat('b', 64), 'PROCESSING', '2026-04-05 06:07:08+00', 'fixture', 'fixture')`);
      });

      const beforeUpgrade = await scoped.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL search_path TO ${schema}, public`);
        return tx.$queryRawUnsafe<Array<{ users: bigint; tickets: bigint; attachments: bigint; attachment_relation: bigint; comments: bigint; comment_relation: bigint; notes: bigint; note_relation: bigint; idem: bigint; idem_ticket_relation: bigint }>>(
          `SELECT (SELECT count(*) FROM ${schema}."user" WHERE id IN (13,14)) AS users, (SELECT count(*) FROM ${schema}.ticket WHERE id BETWEEN 21 AND 24) AS tickets, (SELECT count(*) FROM ${schema}.attachment WHERE id = 31) AS attachments, (SELECT count(*) FROM ${schema}.attachment WHERE id = 31 AND ticket_id = 21 AND uploaded_by_user_id = 13) AS attachment_relation, (SELECT count(*) FROM ${schema}.public_comment WHERE id = 41) AS comments, (SELECT count(*) FROM ${schema}.public_comment WHERE id = 41 AND ticket_id = 21 AND author_user_id = 13) AS comment_relation, (SELECT count(*) FROM ${schema}.internal_note WHERE id = 51) AS notes, (SELECT count(*) FROM ${schema}.internal_note WHERE id = 51 AND ticket_id = 21 AND author_user_id = 14) AS note_relation, (SELECT count(*) FROM ${schema}.idempotency_record WHERE id IN (61,62)) AS idem, (SELECT count(*) FROM ${schema}.idempotency_record WHERE id = 61 AND requester_id = 13 AND ticket_id = 21) AS idem_ticket_relation`,
        );
      });
      expect(beforeUpgrade[0]).toMatchObject({
        users: 2n, tickets: 4n, attachments: 1n, attachment_relation: 1n,
        comments: 1n, comment_relation: 1n, notes: 1n, note_relation: 1n,
        idem: 2n, idem_ticket_relation: 1n,
      });

      const lab4Statements = statements(readFileSync(`${migrationRoot}${migrations.at(-1)}/migration.sql`, "utf8"));
      const interruptionPoint = lab4Statements.findIndex((statement) => statement.startsWith("CREATE TABLE action_taken_attachment"));
      await expect(scoped.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL search_path TO ${schema}, public`);
        for (const statement of lab4Statements.slice(0, interruptionPoint)) await tx.$executeRawUnsafe(statement);
        throw new Error("simulated deployment interruption");
      })).rejects.toThrow("simulated deployment interruption");
      const rolledBack = await scoped.$queryRawUnsafe<Array<{ action_table: string | null; system_column: string | null }>>(
        `SELECT to_regclass('"${schemaName}".action_taken')::text AS action_table, (SELECT column_name FROM information_schema.columns WHERE table_schema = '${schemaName}' AND table_name = 'user' AND column_name = 'is_system') AS system_column`,
      );
      expect(rolledBack).toEqual([{ action_table: null, system_column: null }]);

      await scoped.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL search_path TO ${schema}, public`);
        for (const statement of lab4Statements) {
          await tx.$executeRawUnsafe(statement);
        }

        const backfillStatements = lab4Statements.filter((statement) =>
          statement.startsWith("INSERT INTO ticket_activity") ||
          statement.startsWith("INSERT INTO ticket_assignment_activity") ||
          statement.startsWith("INSERT INTO ticket_status_activity") ||
          statement.startsWith("INSERT INTO ticket_priority_activity") ||
          statement.startsWith("INSERT INTO action_taken ("),
        );
        for (const statement of backfillStatements) await tx.$executeRawUnsafe(statement);

        const systemUsers = await tx.$queryRawUnsafe<Array<{ id: number; is_active: boolean; must_change_password: boolean; is_system: boolean; password_hash: string }>>(
          `SELECT id, is_active, must_change_password, is_system, password_hash FROM ${schema}."user" WHERE is_system`,
        );
        expect(systemUsers).toHaveLength(1);
        expect(systemUsers[0]).toMatchObject({ is_active: false, must_change_password: false, is_system: true, password_hash: "!system-no-login" });

        const snapshots = await tx.$queryRawUnsafe<Array<{ ticket_id: number; actor: number; created_at: Date; previous_status: string | null; status: string; previous_priority: string | null; priority: string; assigned_to_user_id: number | null }>>(
          `SELECT a.ticket_id, a.performed_by_user_id AS actor, a.created_at, s.previous_status::text AS previous_status, s.status::text AS status, p.previous_priority::text AS previous_priority, p.priority::text AS priority, owner.assigned_to_user_id FROM ${schema}.ticket_activity a JOIN ${schema}.ticket_status_activity s ON s.ticket_activity_id = a.id JOIN ${schema}.ticket_priority_activity p ON p.ticket_activity_id = a.id JOIN ${schema}.ticket_assignment_activity owner ON owner.ticket_activity_id = a.id WHERE a.action = 'MIGRATED_TICKET_SNAPSHOT' ORDER BY a.ticket_id`,
        );
        expect(snapshots).toHaveLength(4);
        expect(snapshots.map(({ ticket_id, previous_status, status }) => ({ ticket_id, previous_status, status }))).toEqual([
          { ticket_id: 21, previous_status: null, status: "RESOLVED" },
          { ticket_id: 22, previous_status: null, status: "CLOSED" },
          { ticket_id: 23, previous_status: null, status: "CANCELLED" },
          { ticket_id: 24, previous_status: null, status: "OPEN" },
        ]);
        expect(new Set(snapshots.map((row) => row.actor))).toEqual(new Set([systemUsers[0]!.id]));
        expect(new Set(snapshots.map((row) => row.created_at.toISOString())).size).toBe(1);
        expect(snapshots.map((row) => row.previous_priority)).toEqual([null, null, null, null]);
        expect(snapshots.map((row) => row.priority)).toEqual(["HIGH", "MEDIUM", "LOW", "LOW"]);
        expect(snapshots.map((row) => row.assigned_to_user_id)).toEqual([14, null, null, null]);

        const actions = await tx.$queryRawUnsafe<Array<{ ticket_id: number; creator_user_id: number; status: string; description: string; result: string; is_migrated: boolean; assigned_to_user_id: number | null; performed_by_user_id: number | null; created_at: Date; completed_at: Date }>>(
          `SELECT ticket_id, creator_user_id, status::text AS status, description, result, is_migrated, assigned_to_user_id, performed_by_user_id, created_at, completed_at FROM ${schema}.action_taken ORDER BY ticket_id`,
        );
        expect(actions).toHaveLength(2);
        expect(actions.map((row) => row.ticket_id)).toEqual([21, 22]);
        for (const action of actions) {
          expect(action).toMatchObject({
            creator_user_id: systemUsers[0]!.id,
            status: "COMPLETED",
            description: "Migrated historical completion. Original work details and performer were not recorded.",
            result: "Ticket was marked resolved or closed before Action Taken history was introduced.",
            is_migrated: true,
            assigned_to_user_id: null,
            performed_by_user_id: null,
          });
          const [ticket] = await tx.$queryRawUnsafe<Array<{ updated_at: Date }>>(`SELECT updated_at FROM ${schema}.ticket WHERE id = ${action.ticket_id}`);
          expect(action.created_at).toEqual(ticket!.updated_at);
          expect(action.completed_at).toEqual(ticket!.updated_at);
        }

        const preserved = await tx.$queryRawUnsafe<Array<{ users: bigint; tickets: bigint; attachments: bigint; attachment_relation: bigint; comments: bigint; comment_relation: bigint; notes: bigint; note_relation: bigint; idem: bigint; idem_ticket_relation: bigint; idem_processing_claim: bigint; idem_hash: string; idem_status: string }>>(
          `SELECT (SELECT count(*) FROM ${schema}."user" WHERE id IN (13,14)) AS users, (SELECT count(*) FROM ${schema}.ticket WHERE id BETWEEN 21 AND 24) AS tickets, (SELECT count(*) FROM ${schema}.attachment WHERE id = 31 AND encode(data, 'hex') = '74657374') AS attachments, (SELECT count(*) FROM ${schema}.attachment WHERE id = 31 AND ticket_id = 21 AND uploaded_by_user_id = 13) AS attachment_relation, (SELECT count(*) FROM ${schema}.public_comment WHERE id = 41) AS comments, (SELECT count(*) FROM ${schema}.public_comment WHERE id = 41 AND ticket_id = 21 AND author_user_id = 13) AS comment_relation, (SELECT count(*) FROM ${schema}.internal_note WHERE id = 51) AS notes, (SELECT count(*) FROM ${schema}.internal_note WHERE id = 51 AND ticket_id = 21 AND author_user_id = 14) AS note_relation, (SELECT count(*) FROM ${schema}.idempotency_record WHERE id IN (61,62) AND user_id = 13) AS idem, (SELECT count(*) FROM ${schema}.idempotency_record WHERE id = 61 AND user_id = 13 AND ticket_id = 21) AS idem_ticket_relation, (SELECT count(*) FROM ${schema}.idempotency_record WHERE id = 62 AND user_id = 13 AND method = 'POST' AND resource_path = '/api/users/me/tickets' AND status = 'PROCESSING' AND ticket_id IS NULL AND request_hash = repeat('b', 64) AND processing_started_at = '2026-04-05 06:07:08+00'::timestamptz) AS idem_processing_claim, (SELECT request_hash FROM ${schema}.idempotency_record WHERE id = 61) AS idem_hash, (SELECT status::text FROM ${schema}.idempotency_record WHERE id = 61) AS idem_status`,
        );
        expect(preserved[0]).toMatchObject({
          users: 2n, tickets: 4n, attachments: 1n, attachment_relation: 1n,
          comments: 1n, comment_relation: 1n, notes: 1n, note_relation: 1n,
          idem: 2n, idem_ticket_relation: 1n, idem_processing_claim: 1n,
        });
        expect(preserved[0]).toMatchObject({ idem_hash: "a".repeat(64), idem_status: "COMPLETED" });

        const replayable = await tx.$queryRawUnsafe<Array<{ ticket_id: number; request_hash: string; status: string; ticket_public_id: string }>>(
          `SELECT r.ticket_id, r.request_hash, r.status::text AS status, t.public_id::text AS ticket_public_id FROM ${schema}.idempotency_record r JOIN ${schema}.ticket t ON t.id = r.ticket_id WHERE r.user_id = 13 AND r.method = 'POST' AND r.resource_path = '/api/users/me/tickets' AND r.key = '61000000-0000-4000-8000-000000000001' AND r.expires_at > '2026-01-02 03:10:00+00'::timestamptz`,
        );
        expect(replayable).toEqual([{
          ticket_id: 21,
          request_hash: "a".repeat(64),
          status: "COMPLETED",
          ticket_public_id: "21000000-0000-4000-8000-000000000001",
        }]);
      });
    } finally {
      await scoped.$disconnect();
      await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    }
  }, 120_000);
});
