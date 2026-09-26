import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient, type Prisma } from "../../../src/generated/prisma/client.js";
import { provisionMigratedPasswordsInTransaction } from "../../../src/services/migratedPasswordProvisioning.js";
import { TEST_ARGON2_PROFILE, verifyPassword } from "../../../src/services/passwordService.js";
import { assertLab3TestDatabase, createTestPrisma, type Lab3TestTarget } from "./testDatabase.js";

const migrationRoot = fileURLToPath(new URL("../../../prisma/migrations/", import.meta.url));
const lab3Migration = `${migrationRoot}20260913000000_lab3_auth_foundation/migration.sql`;
const lab2Migrations = [
  `${migrationRoot}20260808064543_add_category/migration.sql`,
  `${migrationRoot}20260822000000_lab2_data_model/migration.sql`,
  `${migrationRoot}20260826000000_ticket_number_varchar/migration.sql`,
];

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

/* Split committed migration scripts without breaking DO $$...$$ blocks. */
function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let statementStart = 0;
  let state: "normal" | "single" | "double" | "line-comment" | "block-comment" | "dollar" = "normal";
  let dollarTag = "";

  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index];
    const nextCharacter = sql[index + 1];

    if (state === "line-comment") {
      if (character === "\n") state = "normal";
      continue;
    }
    if (state === "block-comment") {
      if (character === "*" && nextCharacter === "/") {
        state = "normal";
        index += 1;
      }
      continue;
    }
    if (state === "single") {
      if (character === "'" && nextCharacter === "'") {
        index += 1;
      } else if (character === "'") {
        state = "normal";
      }
      continue;
    }
    if (state === "double") {
      if (character === '"' && nextCharacter === '"') {
        index += 1;
      } else if (character === '"') {
        state = "normal";
      }
      continue;
    }
    if (state === "dollar") {
      if (sql.startsWith(dollarTag, index)) {
        state = "normal";
        index += dollarTag.length - 1;
      }
      continue;
    }

    if (character === "-" && nextCharacter === "-") {
      state = "line-comment";
      index += 1;
    } else if (character === "/" && nextCharacter === "*") {
      state = "block-comment";
      index += 1;
    } else if (character === "'") {
      state = "single";
    } else if (character === '"') {
      state = "double";
    } else if (character === "$") {
      const tag = sql.slice(index).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/)?.[0];
      if (tag) {
        state = "dollar";
        dollarTag = tag;
        index += tag.length - 1;
      }
    } else if (character === ";") {
      const statement = sql.slice(statementStart, index + 1).trim();
      if (statement) statements.push(statement);
      statementStart = index + 1;
    }
  }

  const trailingStatement = sql.slice(statementStart).trim();
  if (trailingStatement) statements.push(trailingStatement);
  return statements;
}

function isTransactionControl(statement: string): boolean {
  const normalized = statement
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--.*$/gm, "")
    .replace(/;\s*$/, "")
    .trim()
    .toUpperCase();
  return normalized === "BEGIN" || normalized === "COMMIT";
}

async function inSchema<T>(
  prisma: PrismaClient,
  schemaName: string,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const schema = quoteIdentifier(schemaName);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL search_path TO ${schema}, public`);
    return work(tx);
  });
}

async function applyMigration(
  prisma: PrismaClient,
  schemaName: string,
  migrationPath: string,
): Promise<void> {
  const statements = splitSqlStatements(readFileSync(migrationPath, "utf8"));
  await inSchema(prisma, schemaName, async (tx) => {
    for (const statement of statements) {
      if (!isTransactionControl(statement)) await tx.$executeRawUnsafe(statement);
    }
  });
}

const legacyFixtureStatements = [
  `
    INSERT INTO category (id, name, created_at, is_active, deleted, created_by, updated_by, updated_at)
    VALUES (101, 'Legacy category', TIMESTAMPTZ '2026-01-02 03:04:05+00', TRUE, FALSE, 'legacy', 'legacy', TIMESTAMPTZ '2026-01-02 03:04:05+00')
  `,
  `
    INSERT INTO related_system (id, name, is_active, deleted, created_by, updated_by, updated_at)
    VALUES (201, 'Legacy system', TRUE, FALSE, 'legacy', 'legacy', TIMESTAMPTZ '2026-01-02 03:04:05+00')
  `,
  `
    INSERT INTO development_requester (id, name, email, is_active, deleted, created_by, updated_by, updated_at)
    VALUES
      (301, 'Legacy Requester', 'legacy.requester@example.com', TRUE, FALSE, 'legacy', 'legacy', TIMESTAMPTZ '2026-01-02 03:04:05+00'),
      (302, 'Deleted Requester', 'deleted.requester@example.com', FALSE, TRUE, 'legacy', 'legacy', TIMESTAMPTZ '2026-01-02 03:04:05+00')
  `,
  `
    INSERT INTO ticket (
      id, public_id, ticket_number, requester_id, category_id, related_system_id,
      summary, requested_priority, description, current_status, deleted,
      created_by, updated_by, updated_at
    ) VALUES (
      401, '40000000-0000-4000-8000-000000000001', 'TKT-20260102-ABCDEF123456', 301, 101, 201,
      'Legacy ticket', 'HIGH', 'Legacy ticket description is long enough.', 'NEW', FALSE,
      'legacy', 'legacy', TIMESTAMPTZ '2026-01-02 03:04:05+00'
    )
  `,
  `
    INSERT INTO attachment (
      id, storage_key, ticket_id, uploaded_by_requester_id, original_name, extension,
      mime_type, size_bytes, data, removal_reason, deleted, created_by, updated_by, updated_at
    ) VALUES
      (501, '50000000-0000-4000-8000-000000000001', NULL, 301, 'pending.txt', 'txt', 'text/plain', 7, decode('70656e64696e67', 'hex'), NULL, FALSE, 'legacy', 'legacy', TIMESTAMPTZ '2026-01-02 03:04:05+00'),
      (502, '50000000-0000-4000-8000-000000000002', 401, 301, 'active.txt', 'txt', 'text/plain', 6, decode('616374697665', 'hex'), NULL, FALSE, 'legacy', 'legacy', TIMESTAMPTZ '2026-01-02 03:04:05+00'),
      (503, '50000000-0000-4000-8000-000000000003', 401, 301, 'removed.txt', 'txt', 'text/plain', 7, decode('72656d6f766564', 'hex'), 'legacy cleanup', TRUE, 'legacy', 'legacy', TIMESTAMPTZ '2026-01-02 03:04:05+00')
  `,
  `
    INSERT INTO idempotency_record (
      id, requester_id, key, request_hash, status, processing_started_at, ticket_id,
      completed_at, expires_at, created_by, updated_by, updated_at
    ) VALUES
      (601, 301, '60000000-0000-4000-8000-000000000001', repeat('a', 64), 'COMPLETED', TIMESTAMPTZ '2026-01-02 03:04:05+00', 401, TIMESTAMPTZ '2026-01-02 04:04:05+00', TIMESTAMPTZ '2026-01-03 04:04:05+00', 'legacy', 'legacy', TIMESTAMPTZ '2026-01-02 04:04:05+00'),
      (602, 301, '60000000-0000-4000-8000-000000000002', repeat('b', 64), 'PROCESSING', TIMESTAMPTZ '2026-01-02 03:04:05+00', NULL, NULL, NULL, 'legacy', 'legacy', TIMESTAMPTZ '2026-01-02 03:04:05+00')
  `,
  "SELECT setval(pg_get_serial_sequence('category', 'id'), 101, TRUE)",
  "SELECT setval(pg_get_serial_sequence('related_system', 'id'), 201, TRUE)",
  "SELECT setval(pg_get_serial_sequence('development_requester', 'id'), 302, TRUE)",
  "SELECT setval(pg_get_serial_sequence('ticket', 'id'), 401, TRUE)",
  "SELECT setval(pg_get_serial_sequence('attachment', 'id'), 503, TRUE)",
  "SELECT setval(pg_get_serial_sequence('idempotency_record', 'id'), 602, TRUE)",
];

describe("Lab 3 populated migration @issue-2", () => {
  let target: Lab3TestTarget;
  let prisma: PrismaClient;

  beforeAll(() => {
    target = assertLab3TestDatabase();
    prisma = createTestPrisma(target);
  });
  afterAll(async () => prisma?.$disconnect());

  it("PG-01 keeps numeric User/Ticket/Attachment/Idempotency ownership linked @issue-2", async () => {
    const schemaName = `lab3_upgrade_${Date.now()}_${process.pid}`;
    const schema = quoteIdentifier(schemaName);
    const upgradedUrl = new URL(target.url);
    upgradedUrl.searchParams.set("schema", schemaName);
    const migratedPrisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: upgradedUrl.toString() }),
    });

    try {
      await prisma.$executeRawUnsafe(`CREATE SCHEMA ${schema}`);
      for (const migration of lab2Migrations) {
        await applyMigration(migratedPrisma, schemaName, migration);
      }
      await inSchema(migratedPrisma, schemaName, async (tx) => {
        for (const statement of legacyFixtureStatements) {
          await tx.$executeRawUnsafe(statement);
        }
      });
      await applyMigration(migratedPrisma, schemaName, lab3Migration);

      await inSchema(migratedPrisma, schemaName, async (tx) => {
        const categories = await tx.$queryRawUnsafe<Array<{ id: number; name: string }>>(
          `SELECT id, name FROM ${schema}.category WHERE id = 101`,
        );
        expect(categories).toEqual([{ id: 101, name: "Legacy category" }]);

        const relatedSystems = await tx.$queryRawUnsafe<Array<{ id: number; name: string }>>(
          `SELECT id, name FROM ${schema}.related_system WHERE id = 201`,
        );
        expect(relatedSystems).toEqual([{ id: 201, name: "Legacy system" }]);

        const users = await tx.$queryRawUnsafe<Array<{ id: number; email: string; is_active: boolean; deleted: boolean }>>(
          `SELECT id, email::text AS email, is_active, deleted FROM ${schema}."user" WHERE id IN (301, 302) ORDER BY id`,
        );
        expect(users).toEqual([
          { id: 301, email: "legacy.requester@example.com", is_active: true, deleted: false },
          { id: 302, email: "deleted.requester@example.com", is_active: false, deleted: true },
        ]);

        const migrationCredentials: Record<string, string> = {};
        const unprovisionedUsers = await tx.$queryRawUnsafe<Array<{
          id: number;
          name: string;
          email: string;
          password_hash: string;
          must_change_password: boolean;
        }>>(
          `SELECT id, name, email::text AS email, password_hash, must_change_password FROM ${schema}."user" WHERE id IN (301, 302) ORDER BY id`,
        );
        expect(unprovisionedUsers).toHaveLength(2);
        expect(unprovisionedUsers.every((user) => user.password_hash.startsWith("!migrated-password-unprovisioned:"))).toBe(true);
        expect(new Set(unprovisionedUsers.map((user) => user.password_hash)).size).toBe(2);
        expect(unprovisionedUsers.every((user) => user.must_change_password)).toBe(true);
        expect(await verifyPassword(unprovisionedUsers[0]!.password_hash, "Legacy Requester@passWorD!123")).toBe(false);

        expect(await provisionMigratedPasswordsInTransaction(tx, {
          profile: TEST_ARGON2_PROFILE,
          persistHandoff: (credentials) => Object.assign(migrationCredentials, credentials),
        })).toBe(2);
        expect(new Set(Object.values(migrationCredentials)).size).toBe(2);

        const provisionedUsers = await tx.$queryRawUnsafe<Array<{
          id: number;
          name: string;
          email: string;
          password_hash: string;
          must_change_password: boolean;
        }>>(
          `SELECT id, name, email::text AS email, password_hash, must_change_password FROM ${schema}."user" WHERE id IN (301, 302) ORDER BY id`,
        );
        expect(provisionedUsers.every((user) => /^\$argon2id\$/.test(user.password_hash))).toBe(true);
        expect(provisionedUsers.every((user) => user.must_change_password)).toBe(true);
        for (const user of provisionedUsers) {
          const password = migrationCredentials[user.email];
          if (!password) {
            throw new Error("Migrated password handoff missing test credential");
          }
          expect(await verifyPassword(user.password_hash, password)).toBe(true);
          expect(await verifyPassword(user.password_hash, `${user.name}@passWorD!123`)).toBe(false);
        }
        expect(await provisionMigratedPasswordsInTransaction(tx)).toBe(0);

        const ticket = (await tx.$queryRawUnsafe<Array<{
          id: number;
          public_id: string;
          ticket_number: string;
          requester_id: number;
          category_id: number;
          related_system_id: number;
          summary: string;
          requested_priority: string;
          it_priority: string;
          description: string;
          current_status: string;
          deleted: boolean;
        }>>(
          `SELECT id, public_id, ticket_number, requester_id, category_id, related_system_id, summary, requested_priority::text AS requested_priority, it_priority::text AS it_priority, description, current_status::text AS current_status, deleted FROM ${schema}.ticket WHERE id = 401`,
        ))[0];
        expect(ticket).toEqual({
          id: 401,
          public_id: "40000000-0000-4000-8000-000000000001",
          ticket_number: "TKT-20260102-ABCDEF123456",
          requester_id: 301,
          category_id: 101,
          related_system_id: 201,
          summary: "Legacy ticket",
          requested_priority: "HIGH",
          it_priority: "HIGH",
          description: "Legacy ticket description is long enough.",
          current_status: "NEW",
          deleted: false,
        });

        const attachments = await tx.$queryRawUnsafe<Array<{
          id: number;
          storage_key: string;
          ticket_id: number | null;
          uploaded_by_user_id: number;
          size_bytes: number;
          data_hex: string;
          deleted: boolean;
          removal_reason: string | null;
        }>>(
          `SELECT id, storage_key, ticket_id, uploaded_by_user_id, size_bytes, encode(data, 'hex') AS data_hex, deleted, removal_reason FROM ${schema}.attachment WHERE id IN (501, 502, 503) ORDER BY id`,
        );
        expect(attachments).toEqual([
          { id: 501, storage_key: "50000000-0000-4000-8000-000000000001", ticket_id: null, uploaded_by_user_id: 301, size_bytes: 7, data_hex: "70656e64696e67", deleted: false, removal_reason: null },
          { id: 502, storage_key: "50000000-0000-4000-8000-000000000002", ticket_id: 401, uploaded_by_user_id: 301, size_bytes: 6, data_hex: "616374697665", deleted: false, removal_reason: null },
          { id: 503, storage_key: "50000000-0000-4000-8000-000000000003", ticket_id: 401, uploaded_by_user_id: 301, size_bytes: 7, data_hex: "72656d6f766564", deleted: true, removal_reason: "legacy cleanup" },
        ]);

        const idempotencyRecords = await tx.$queryRawUnsafe<Array<{
          id: number;
          requester_id: number;
          key: string;
          request_hash: string;
          ticket_id: number | null;
          status: string;
        }>>(
          `SELECT id, requester_id, key, request_hash, ticket_id, status::text AS status FROM ${schema}.idempotency_record WHERE id IN (601, 602) ORDER BY id`,
        );
        expect(idempotencyRecords).toEqual([
          { id: 601, requester_id: 301, key: "60000000-0000-4000-8000-000000000001", request_hash: "a".repeat(64), ticket_id: 401, status: "COMPLETED" },
          { id: 602, requester_id: 301, key: "60000000-0000-4000-8000-000000000002", request_hash: "b".repeat(64), ticket_id: null, status: "PROCESSING" },
        ]);

        const foreignKeys = await tx.$queryRaw<Array<{ child_table: string; child_column: string; parent_table: string }>>`
          SELECT child.relname AS child_table,
                 child_column.attname AS child_column,
                 parent.relname AS parent_table
          FROM pg_constraint
          JOIN pg_class AS child ON child.oid = conrelid
          JOIN pg_class AS parent ON parent.oid = confrelid
          JOIN pg_namespace AS child_schema ON child_schema.oid = child.relnamespace
          JOIN pg_attribute AS child_column
            ON child_column.attrelid = conrelid AND child_column.attnum = conkey[1]
          WHERE contype = 'f'
            AND child_schema.nspname = ${schemaName}
            AND child.relname IN ('ticket', 'attachment', 'idempotency_record')
          ORDER BY child_table, child_column
        `;
        expect(foreignKeys.filter((row) => row.child_column === "requester_id" || row.child_column === "uploaded_by_user_id")).toEqual([
          { child_table: "attachment", child_column: "uploaded_by_user_id", parent_table: "user" },
          { child_table: "idempotency_record", child_column: "requester_id", parent_table: "user" },
          { child_table: "ticket", child_column: "requester_id", parent_table: "user" },
        ]);
      });
    } finally {
      try {
        await migratedPrisma.$disconnect();
      } finally {
        await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      }
    }
  }, 120_000);
});
