import { execFile } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "../../../src/generated/prisma/client.js";
import { assertLab3TargetEnvironment } from "../../../src/databaseTargetGuard.js";

import { ActionTakenService } from "../../../src/services/actionTakenService.js";
import { applyRequesterTicketAction } from "../../../src/services/ticketService.js";
import { mutateStaffTicket } from "../../../src/services/ticketWorkflowService.js";
import { createBody } from "../support/actionFixture.js";

const migrationRoot = fileURLToPath(new URL("../../../prisma/migrations/", import.meta.url));
const serverRoot = fileURLToPath(new URL("../../../", import.meta.url));
const detailMigration = "20261001000000_lab4_activity_detail_constraints";
const claimDetailMigration = "20261001010000_lab4_claim_activity_details";
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

  it.each(["transaction rollback", "Prisma failed-migration recovery"])("preserves Lab 3 rows and backfills truthful snapshots and eligible Actions after %s", async (recovery) => {
    const schemaName = `lab4_upgrade_${Date.now()}_${process.pid}`;
    const schema = quoteIdentifier(schemaName);
    const scopedUrl = new URL(assertLab3TargetEnvironment());
    scopedUrl.searchParams.set("schema", schemaName);
    const scoped = new PrismaClient({ adapter: new PrismaPg({ connectionString: scopedUrl.toString(), options: `-c search_path=${schemaName},public` }, { schema: schemaName }) });
    let rehearsalRoot: string | undefined;
    const lab4Migration = migrations.at(-1)!;
    const approvedSql = readFileSync(`${migrationRoot}${lab4Migration}/migration.sql`, "utf8");

    async function runPrisma(arguments_: string[]) {
      const env = {
        ...process.env,
        TEST_DATABASE_URL: scopedUrl.toString(),
        DATABASE_URL: scopedUrl.toString(),
        DIRECT_URL: scopedUrl.toString(),
      };
      assertLab3TargetEnvironment(env);
      return new Promise<{ code: number; output: string }>((resolve) => {
        execFile("npx", ["--no-install", "prisma", ...arguments_, "--config", `${rehearsalRoot}/prisma.config.ts`], {
          cwd: serverRoot, env, timeout: 30_000, maxBuffer: 2 * 1024 * 1024,
        }, (error, stdout, stderr) => resolve({
          code: error ? (typeof error.code === "number" ? error.code : -1) : 0,
          output: `${stdout}\n${stderr}`.replace(/postgres(?:ql)?:\/\/[^\s'"`]+/gi, "<DATABASE_URL>"),
        }));
      });
    }

    // Full fixture row snapshots verify data, bytes, timestamps and relationships.
    async function legacyRows(upgraded = false) {
      const rows: Record<string, unknown> = {};
      for (const table of ["user", "ticket", "attachment", "public_comment", "internal_note", "idempotency_record"]) {
        let value = "to_jsonb(legacy)";
        if (upgraded && table === "user") value += " - 'is_system'";
        if (upgraded && table === "idempotency_record") {
          value = "(to_jsonb(legacy) - 'user_id' - 'method' - 'resource_path' - 'action_taken_id') || jsonb_build_object('requester_id', legacy.user_id)";
        }
        rows[table] = await scoped.$queryRawUnsafe(
          `SELECT ${value} AS row FROM ${schema}.${quoteIdentifier(table)} AS legacy ${table === "user" ? "WHERE id IN (13, 14)" : ""} ORDER BY id`,
        );
      }
      return rows;
    }

    try {
      await prisma.$executeRawUnsafe(`CREATE SCHEMA ${schema}`);
      if (recovery === "Prisma failed-migration recovery") {
        // Only disposable copies are faulted; committed/applied SQL stays intact.
        rehearsalRoot = mkdtempSync(`${serverRoot}.lab4-recovery-`);
        cpSync(`${serverRoot}prisma/schema.prisma`, `${rehearsalRoot}/schema.prisma`);
        cpSync(`${migrationRoot}migration_lock.toml`, `${rehearsalRoot}/migrations/migration_lock.toml`, { recursive: true });
        for (const migration of migrations.slice(0, -1)) {
          cpSync(`${migrationRoot}${migration}`, `${rehearsalRoot}/migrations/${migration}`, { recursive: true });
        }
        writeFileSync(`${rehearsalRoot}/prisma.config.ts`, `import { defineConfig, env } from "prisma/config";
export default defineConfig({ schema: "schema.prisma", migrations: { path: "migrations" }, datasource: { url: env("DIRECT_URL") } });
`);
        const preflight = await runPrisma(["migrate", "status"]);
        expect(preflight.code).toBe(1); // Pending migrations, not a connection failure.
        expect(preflight.output).toContain(`database "${decodeURIComponent(scopedUrl.pathname.slice(1))}"`);
        expect(preflight.output).toContain(`schema "${schemaName}"`);
        expect(preflight.output).toContain(`${scopedUrl.hostname}:${scopedUrl.port || "5432"}`);
        expect(preflight.output).toContain("have not yet been applied");
      }
      for (const migration of migrations.slice(0, -1)) {
        await scoped.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(`SET LOCAL search_path TO ${schema}, public`);
          for (const statement of statements(readFileSync(`${migrationRoot}${migration}/migration.sql`, "utf8"))) {
            await tx.$executeRawUnsafe(statement);
          }
        });
      }
      if (rehearsalRoot) {
        // Baseline the verified Lab 3 fixture. Its extension operator classes
        // live in public, so historical SQL uses the same search path as above.
        for (const migration of migrations.slice(0, -1)) {
          const baseline = await runPrisma(["migrate", "resolve", "--applied", migration]);
          expect(baseline.code, baseline.output).toBe(0);
        }
        const baselineStatus = await runPrisma(["migrate", "status"]);
        expect(baselineStatus.code, baselineStatus.output).toBe(0);
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
      const backupFixture = await legacyRows();

      const lab4Statements = statements(approvedSql);
      if (rehearsalRoot) {
        const rehearsalSql = `${rehearsalRoot}/migrations/${lab4Migration}/migration.sql`;
        cpSync(`${migrationRoot}${lab4Migration}`, `${rehearsalRoot}/migrations/${lab4Migration}`, { recursive: true });
        expect(approvedSql).toMatch(/COMMIT;\s*$/);
        // End the transaction before raising the rehearsal error so Prisma can
        // persist failure logs instead of trying to write in an aborted transaction.
        writeFileSync(rehearsalSql, approvedSql.replace(/COMMIT;\s*$/, "ROLLBACK; -- rehearsal interruption discards schema and backfill\nSELECT 1 / 0; -- Prisma must record this failed deployment\n"));
        const failed = await runPrisma(["migrate", "deploy"]);
        expect(failed.code).toBe(1);
        expect(failed.output).toContain("P3018");
        expect(failed.output).toContain("division by zero");

        const failedStatus = await runPrisma(["migrate", "status"]);
        expect(failedStatus.code).toBe(1);
        expect(failedStatus.output).toContain(`schema "${schemaName}"`);
        expect(failedStatus.output).toContain("failed");
        expect(failedStatus.output).toContain(lab4Migration);
        const attempts = await scoped.$queryRawUnsafe<Array<{ finished_at: Date | null; rolled_back_at: Date | null; logs: string }>>(
          `SELECT finished_at, rolled_back_at, logs FROM ${schema}._prisma_migrations WHERE migration_name = '${lab4Migration}'`,
        );
        expect(attempts).toHaveLength(1);
        expect(attempts[0]).toMatchObject({ finished_at: null, rolled_back_at: null });
        expect(attempts[0]!.logs).toContain("division by zero");

        // Rollout must remain blocked even when the SQL copy is corrected.
        writeFileSync(rehearsalSql, approvedSql);
        const blocked = await runPrisma(["migrate", "deploy"]);
        expect(blocked.code).toBe(1);
        expect(blocked.output).toContain("P3009");
        expect(await legacyRows()).toEqual(backupFixture);
      } else {
        const interruptionPoint = lab4Statements.findIndex((statement) => statement.startsWith("CREATE TABLE action_taken_attachment"));
        await expect(scoped.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(`SET LOCAL search_path TO ${schema}, public`);
          for (const statement of lab4Statements.slice(0, interruptionPoint)) await tx.$executeRawUnsafe(statement);
          throw new Error("simulated deployment interruption");
        })).rejects.toThrow("simulated deployment interruption");
      }
      const rolledBack = await scoped.$queryRawUnsafe<Array<{ action_table: string | null; system_column: string | null }>>(
        `SELECT to_regclass('"${schemaName}".action_taken')::text AS action_table, (SELECT column_name FROM information_schema.columns WHERE table_schema = '${schemaName}' AND table_name = 'user' AND column_name = 'is_system') AS system_column`,
      );
      expect(rolledBack).toEqual([{ action_table: null, system_column: null }]);
      if (rehearsalRoot) {
        const schemaEffects = await scoped.$queryRawUnsafe<Array<{ name: string }>>(
          `SELECT table_name AS name FROM information_schema.tables WHERE table_schema = '${schemaName}' AND table_name IN ('action_taken', 'action_taken_attachment', 'ticket_activity', 'ticket_assignment_activity', 'ticket_status_activity', 'ticket_priority_activity', 'action_taken_activity')
           UNION ALL SELECT typname AS name FROM pg_type JOIN pg_namespace ON pg_namespace.oid = pg_type.typnamespace WHERE nspname = '${schemaName}' AND typname IN ('ActionTakenStatus', 'TicketActivityType')
           UNION ALL SELECT column_name AS name FROM information_schema.columns WHERE table_schema = '${schemaName}' AND table_name = 'idempotency_record' AND column_name IN ('user_id', 'method', 'resource_path', 'action_taken_id')`,
        );
        expect(schemaEffects).toEqual([]);
        const resolved = await runPrisma(["migrate", "resolve", "--rolled-back", lab4Migration]);
        expect(resolved.code, resolved.output).toBe(0);
        cpSync(`${migrationRoot}${detailMigration}`, `${rehearsalRoot}/migrations/${detailMigration}`, { recursive: true });
        cpSync(`${migrationRoot}${claimDetailMigration}`, `${rehearsalRoot}/migrations/${claimDetailMigration}`, { recursive: true });
        const recovered = await runPrisma(["migrate", "deploy"]);
        expect(recovered.code, recovered.output).toBe(0);
        expect(recovered.output).toContain("successfully applied");
        const status = await runPrisma(["migrate", "status"]);
        expect(status.code, status.output).toBe(0);
        expect(status.output).toContain("Database schema is up to date");
        const successfulRows = await scoped.$queryRawUnsafe<Array<{ checksum: string; finished_at: Date | null; rolled_back_at: Date | null }>>(
          `SELECT checksum, finished_at, rolled_back_at FROM ${schema}._prisma_migrations WHERE migration_name = '${lab4Migration}' ORDER BY started_at`,
        );
        expect(successfulRows).toHaveLength(2);
        expect(successfulRows[0]!.finished_at).toBeNull();
        expect(successfulRows[0]!.rolled_back_at).toBeInstanceOf(Date);
        expect(successfulRows[1]!.finished_at).toBeInstanceOf(Date);
        expect(successfulRows[1]!.rolled_back_at).toBeNull();
        expect(successfulRows[1]!.checksum).toBe(createHash("sha256").update(approvedSql).digest("hex"));
        const repeated = await runPrisma(["migrate", "deploy"]);
        expect(repeated.code, repeated.output).toBe(0);
        expect(repeated.output).toContain("No pending migrations");
        expect(await scoped.$queryRawUnsafe(`SELECT checksum, finished_at, rolled_back_at FROM ${schema}._prisma_migrations WHERE migration_name = '${lab4Migration}' ORDER BY started_at`)).toEqual(successfulRows);
      }

      await scoped.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL search_path TO ${schema}, public`);
        for (const statement of rehearsalRoot ? [] : lab4Statements) {
          await tx.$executeRawUnsafe(statement);
        }

        if (!rehearsalRoot) {
          for (const migration of [detailMigration, claimDetailMigration]) {
            for (const statement of statements(readFileSync(`${migrationRoot}${migration}/migration.sql`, "utf8"))) {
              await tx.$executeRawUnsafe(statement);
            }
          }
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
        const [nonMigratedCompletions] = await tx.$queryRawUnsafe<Array<{ count: bigint }>>(
          `SELECT count(*) FROM ${schema}.action_taken WHERE status = 'COMPLETED' AND is_migrated = FALSE`,
        );
        expect(nonMigratedCompletions!.count).toBe(0n);
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
      expect(await legacyRows(true)).toEqual(backupFixture);
      // #81 runtime exclusion contribution: use the Actions produced by the actual migration.
      const owner = await scoped.user.findUniqueOrThrow({ where: { id: 14 } });
      const requester = await scoped.user.findUniqueOrThrow({ where: { id: 13 } });
      const actor = { userId: owner.id, userPublicId: owner.publicId, email: owner.email, role: owner.role };
      const service = new ActionTakenService(scoped);
      for (const id of [21, 22]) {
        const ticket = await scoped.ticket.findUniqueOrThrow({ where: { id } });
        const history = await scoped.actionTaken.findMany({ where: { ticketId: id } });
        expect(history).toHaveLength(1);
        expect(history[0]).toMatchObject({ status: "COMPLETED", isMigrated: true, assignedToUserId: null, performedByUserId: null });
        await applyRequesterTicketAction(scoped, requester.id, requester.email, ticket.publicId, "reopen");
        await mutateStaffTicket(scoped, actor, ticket.publicId, "claim", {});
        await expect(mutateStaffTicket(scoped, actor, ticket.publicId, "mark-resolved", {})).rejects.toMatchObject({ code: "INVALID_STATUS_TRANSITION" });
        const created = (await service.create(actor, ticket.publicId, { ...createBody, assignedToUserPublicId: owner.publicId }, randomUUID())).action;
        await service.lifecycle(actor, ticket.publicId, created.publicId, "start", { expectedVersion: 1 }, randomUUID());
        await service.lifecycle(actor, ticket.publicId, created.publicId, "complete", { expectedVersion: 2, result: "New work verified", followUpRequired: false }, randomUUID());
        expect((await mutateStaffTicket(scoped, actor, ticket.publicId, "mark-resolved", {})).currentStatus).toBe("RESOLVED");
        expect(await scoped.actionTaken.findUniqueOrThrow({ where: { id: history[0].id } })).toEqual(history[0]);
      }

    } finally {
      try {
        await scoped.$disconnect();
      } finally {
        try {
          await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
        } finally {
          if (rehearsalRoot) rmSync(rehearsalRoot, { recursive: true, force: true });
        }
      }
    }
  }, 120_000);
});
