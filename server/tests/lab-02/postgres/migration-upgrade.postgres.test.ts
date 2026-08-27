import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PrismaClient } from "../../../src/generated/prisma/client.js";
import {
  applyLab1Migration,
  assertLab2TestDatabase,
  createTestPrisma,
  deployMigrations,
  markLab1MigrationApplied,
  resetTestSchema,
  runSeed,
  type TestDatabaseTarget,
} from "./testDatabase.js";

interface ColumnRow {
  table_name: string;
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: string;
  column_default: string | null;
  character_maximum_length: number | null;
}

interface ConstraintRow {
  table_name: string;
  constraint_name: string;
  constraint_type: string;
}

interface ForeignKeyRow {
  conname: string;
  child_table: string;
  child_column: string;
  parent_table: string;
  parent_column: string;
  confdeltype: string;
  confupdtype: string;
}

interface CheckRow {
  conname: string;
  definition: string;
}

interface IndexRow {
  indexname: string;
  indexdef: string;
}

interface SeedSnapshot {
  id: number;
  label: string;
  name: string;
  is_active: boolean;
  deleted: boolean;
  created_by: string;
  created_at: string;
  updated_by: string;
  updated_at: string;
}

interface PreservedCategoryRow {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  deleted: boolean;
  created_by: string;
  updated_by: string;
}

type ExpectedColumnType = readonly [
  dataType: string,
  udtName: string,
  maximumLength: number | null,
];

interface ExpectedColumn {
  type: ExpectedColumnType;
  nullable?: boolean;
  defaultPattern?: RegExp;
}

const INTEGER = ["integer", "int4", null] as const;
const BOOLEAN = ["boolean", "bool", null] as const;
const TIMESTAMPTZ = ["timestamp with time zone", "timestamptz", null] as const;
const UUID = ["uuid", "uuid", null] as const;
const BYTEA = ["bytea", "bytea", null] as const;
const varchar = (length: number): ExpectedColumnType => [
  "character varying",
  "varchar",
  length,
];
const nativeEnum = (name: string): ExpectedColumnType => [
  "USER-DEFINED",
  name,
  null,
];
const column = (
  type: ExpectedColumnType,
  options: Omit<ExpectedColumn, "type"> = {},
): ExpectedColumn => ({ type, ...options });

const AUDIT_COLUMNS = {
  created_by: column(varchar(255)),
  created_at: column(TIMESTAMPTZ, { defaultPattern: /CURRENT_TIMESTAMP/ }),
  updated_by: column(varchar(255)),
  updated_at: column(TIMESTAMPTZ, { defaultPattern: /CURRENT_TIMESTAMP/ }),
};

const EXPECTED_COLUMNS = {
  development_requester: {
    id: column(INTEGER, { defaultPattern: /nextval/ }),
    name: column(varchar(100)),
    email: column(varchar(254)),
    is_active: column(BOOLEAN, { defaultPattern: /true/i }),
    deleted: column(BOOLEAN, { defaultPattern: /false/i }),
    ...AUDIT_COLUMNS,
  },
  category: {
    id: column(INTEGER, { defaultPattern: /nextval/ }),
    name: column(varchar(100)),
    is_active: column(BOOLEAN, { defaultPattern: /true/i }),
    deleted: column(BOOLEAN, { defaultPattern: /false/i }),
    ...AUDIT_COLUMNS,
  },
  related_system: {
    id: column(INTEGER, { defaultPattern: /nextval/ }),
    name: column(varchar(100)),
    is_active: column(BOOLEAN, { defaultPattern: /true/i }),
    deleted: column(BOOLEAN, { defaultPattern: /false/i }),
    ...AUDIT_COLUMNS,
  },
  ticket: {
    id: column(INTEGER, { defaultPattern: /nextval/ }),
    public_id: column(UUID),
    ticket_number: column(varchar(25)),
    requester_id: column(INTEGER),
    category_id: column(INTEGER),
    related_system_id: column(INTEGER),
    summary: column(varchar(150)),
    requested_priority: column(nativeEnum("RequestedPriority")),
    description: column(varchar(2000)),
    current_status: column(nativeEnum("TicketStatus"), { defaultPattern: /NEW/ }),
    deleted: column(BOOLEAN, { defaultPattern: /false/i }),
    ...AUDIT_COLUMNS,
  },
  attachment: {
    id: column(INTEGER, { defaultPattern: /nextval/ }),
    storage_key: column(UUID),
    ticket_id: column(INTEGER, { nullable: true }),
    uploaded_by_requester_id: column(INTEGER),
    original_name: column(varchar(255)),
    extension: column(varchar(10)),
    mime_type: column(varchar(50)),
    size_bytes: column(INTEGER),
    data: column(BYTEA),
    removal_reason: column(varchar(200), { nullable: true }),
    deleted: column(BOOLEAN, { defaultPattern: /false/i }),
    ...AUDIT_COLUMNS,
  },
  idempotency_record: {
    id: column(INTEGER, { defaultPattern: /nextval/ }),
    requester_id: column(INTEGER),
    key: column(UUID),
    request_hash: column(varchar(128)),
    status: column(nativeEnum("IdempotencyStatus")),
    processing_started_at: column(TIMESTAMPTZ),
    ticket_id: column(INTEGER, { nullable: true }),
    completed_at: column(TIMESTAMPTZ, { nullable: true }),
    expires_at: column(TIMESTAMPTZ, { nullable: true }),
    ...AUDIT_COLUMNS,
  },
} satisfies Record<string, Record<string, ExpectedColumn>>;

async function readSeedSnapshot(
  prisma: PrismaClient,
  tableName: "category" | "related_system" | "development_requester",
): Promise<SeedSnapshot[]> {
  if (tableName === "category") {
    return prisma.$queryRaw<SeedSnapshot[]>`
      SELECT id, name AS label, name, is_active, deleted, created_by,
             to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.MS') AS created_at,
             updated_by,
             to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.MS') AS updated_at
      FROM category
      ORDER BY id
    `;
  }

  if (tableName === "related_system") {
    return prisma.$queryRaw<SeedSnapshot[]>`
      SELECT id, name AS label, name, is_active, deleted, created_by,
             to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.MS') AS created_at,
             updated_by,
             to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.MS') AS updated_at
      FROM related_system
      ORDER BY id
    `;
  }

  return prisma.$queryRaw<SeedSnapshot[]>`
    SELECT id, email AS label, name, is_active, deleted, created_by,
           to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.MS') AS created_at,
           updated_by,
           to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.MS') AS updated_at
    FROM development_requester
    ORDER BY id
  `;
}

describe.sequential("Lab 2 migration and seed PostgreSQL contract", () => {
  let target: TestDatabaseTarget;
  let prisma: PrismaClient;

  beforeAll(async () => {
    target = assertLab2TestDatabase();
    prisma = createTestPrisma(target);
    await resetTestSchema(target);
    await deployMigrations(target);
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("creates the required fresh schema, constraints, indexes, and native enums", async () => {
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('development_requester', 'category', 'related_system', 'ticket', 'attachment', 'idempotency_record')
      ORDER BY table_name
    `;
    expect(tables.map((row) => row.table_name)).toEqual([
      "attachment",
      "category",
      "development_requester",
      "idempotency_record",
      "related_system",
      "ticket",
    ]);

    const columns = await prisma.$queryRaw<ColumnRow[]>`
      SELECT table_name, column_name, data_type, udt_name, is_nullable,
             column_default, character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('development_requester', 'category', 'related_system', 'ticket', 'attachment', 'idempotency_record')
    `;
    const columnByName = new Map(
      columns.map((column) => [`${column.table_name}.${column.column_name}`, column]),
    );
    const expectedColumnByName = new Map<string, ExpectedColumn>();
    for (const [tableName, expectedColumns] of Object.entries(EXPECTED_COLUMNS)) {
      for (const [columnName, expectedColumn] of Object.entries(expectedColumns)) {
        expectedColumnByName.set(`${tableName}.${columnName}`, expectedColumn);
      }
    }
    expect([...columnByName.keys()].sort()).toEqual(
      [...expectedColumnByName.keys()].sort(),
    );
    for (const [key, expectedColumn] of expectedColumnByName) {
      const column = columnByName.get(key);
      expect(column).toBeDefined();
      expect(column?.data_type).toBe(expectedColumn.type[0]);
      expect(column?.udt_name).toBe(expectedColumn.type[1]);
      expect(column?.character_maximum_length).toBe(expectedColumn.type[2]);
      expect(column?.is_nullable).toBe(expectedColumn.nullable ? "YES" : "NO");
      if (expectedColumn.defaultPattern) {
        expect(column?.column_default).toMatch(expectedColumn.defaultPattern);
      } else {
        expect(column?.column_default).toBeNull();
      }
    }

    const enumValues = await prisma.$queryRaw<Array<{ type_name: string; enum_label: string }>>`
      SELECT t.typname AS type_name, e.enumlabel AS enum_label
      FROM pg_type t
      JOIN pg_enum e ON e.enumtypid = t.oid
      WHERE t.typname IN ('RequestedPriority', 'TicketStatus', 'IdempotencyStatus')
      ORDER BY t.typname, e.enumsortorder
    `;
    expect(enumValues).toEqual([
      { type_name: "IdempotencyStatus", enum_label: "PROCESSING" },
      { type_name: "IdempotencyStatus", enum_label: "COMPLETED" },
      { type_name: "RequestedPriority", enum_label: "LOW" },
      { type_name: "RequestedPriority", enum_label: "MEDIUM" },
      { type_name: "RequestedPriority", enum_label: "HIGH" },
      { type_name: "TicketStatus", enum_label: "NEW" },
    ]);

    const constraints = await prisma.$queryRaw<ConstraintRow[]>`
      SELECT table_name, constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_schema = 'public'
        AND table_name IN (
          'development_requester',
          'category',
          'related_system',
          'ticket',
          'attachment',
          'idempotency_record'
        )
    `;
    const constraintByName = new Map(
      constraints.map((constraint) => [constraint.constraint_name, constraint]),
    );
    const expectedConstraintTypes = {
      development_requester_pkey: "PRIMARY KEY",
      development_requester_email_key: "UNIQUE",
      category_pkey: "PRIMARY KEY",
      related_system_pkey: "PRIMARY KEY",
      related_system_name_key: "UNIQUE",
      ticket_pkey: "PRIMARY KEY",
      ticket_public_id_key: "UNIQUE",
      ticket_ticket_number_key: "UNIQUE",
      ticket_ticket_number_format_check: "CHECK",
      ticket_summary_check: "CHECK",
      ticket_description_check: "CHECK",
      attachment_pkey: "PRIMARY KEY",
      attachment_storage_key_key: "UNIQUE",
      attachment_original_name_bytes_check: "CHECK",
      attachment_size_data_check: "CHECK",
      attachment_lifecycle_check: "CHECK",
      idempotency_record_pkey: "PRIMARY KEY",
      idempotency_record_requester_key_key: "UNIQUE",
      idempotency_record_request_hash_check: "CHECK",
      idempotency_record_state_check: "CHECK",
    };
    for (const [name, type] of Object.entries(expectedConstraintTypes)) {
      expect(constraintByName.get(name)?.constraint_type).toBe(type);
    }

    const categoryIndexes = await prisma.$queryRaw<IndexRow[]>`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'category'
    `;
    expect(categoryIndexes.find((index) => index.indexname === "category_name_key")?.indexdef).toContain("UNIQUE INDEX");

    const foreignKeys = await prisma.$queryRaw<ForeignKeyRow[]>`
      SELECT
        conname,
        conrelid::regclass::text AS child_table,
        child_column.attname AS child_column,
        confrelid::regclass::text AS parent_table,
        parent_column.attname AS parent_column,
        confdeltype::text,
        confupdtype::text
      FROM pg_constraint
      JOIN pg_attribute AS child_column
        ON child_column.attrelid = conrelid
        AND child_column.attnum = conkey[1]
      JOIN pg_attribute AS parent_column
        ON parent_column.attrelid = confrelid
        AND parent_column.attnum = confkey[1]
      WHERE contype = 'f'
        AND conrelid IN ('ticket'::regclass, 'attachment'::regclass, 'idempotency_record'::regclass)
    `;
    expect(foreignKeys.sort((left, right) => left.conname.localeCompare(right.conname))).toEqual([
      {
        conname: "attachment_ticket_id_fkey",
        child_table: "attachment",
        child_column: "ticket_id",
        parent_table: "ticket",
        parent_column: "id",
        confdeltype: "r",
        confupdtype: "r",
      },
      {
        conname: "attachment_uploaded_by_requester_id_fkey",
        child_table: "attachment",
        child_column: "uploaded_by_requester_id",
        parent_table: "development_requester",
        parent_column: "id",
        confdeltype: "r",
        confupdtype: "r",
      },
      {
        conname: "idempotency_record_requester_id_fkey",
        child_table: "idempotency_record",
        child_column: "requester_id",
        parent_table: "development_requester",
        parent_column: "id",
        confdeltype: "r",
        confupdtype: "r",
      },
      {
        conname: "idempotency_record_ticket_id_fkey",
        child_table: "idempotency_record",
        child_column: "ticket_id",
        parent_table: "ticket",
        parent_column: "id",
        confdeltype: "r",
        confupdtype: "r",
      },
      {
        conname: "ticket_category_id_fkey",
        child_table: "ticket",
        child_column: "category_id",
        parent_table: "category",
        parent_column: "id",
        confdeltype: "r",
        confupdtype: "r",
      },
      {
        conname: "ticket_related_system_id_fkey",
        child_table: "ticket",
        child_column: "related_system_id",
        parent_table: "related_system",
        parent_column: "id",
        confdeltype: "r",
        confupdtype: "r",
      },
      {
        conname: "ticket_requester_id_fkey",
        child_table: "ticket",
        child_column: "requester_id",
        parent_table: "development_requester",
        parent_column: "id",
        confdeltype: "r",
        confupdtype: "r",
      },
    ]);

    const checks = await prisma.$queryRaw<CheckRow[]>`
      SELECT conname, pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE contype = 'c'
        AND conrelid IN ('ticket'::regclass, 'attachment'::regclass, 'idempotency_record'::regclass)
    `;
    expect(checks).toHaveLength(8);
    expect(checks.find((check) => check.conname === "ticket_ticket_number_format_check")?.definition).toContain("TKT-");
    expect(checks.find((check) => check.conname === "attachment_size_data_check")?.definition).toContain("5000000");
    expect(checks.find((check) => check.conname === "idempotency_record_state_check")?.definition).toContain("24:00:00");

    const indexes = await prisma.$queryRaw<IndexRow[]>`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename IN ('ticket', 'attachment', 'idempotency_record')
    `;
    const indexByName = new Map(indexes.map((index) => [index.indexname, index.indexdef]));
    for (const name of [
      "ticket_requester_created_at_id_active_idx",
      "ticket_category_id_idx",
      "ticket_related_system_id_idx",
      "ticket_requested_priority_idx",
      "ticket_current_status_idx",
      "attachment_ticket_id_idx",
      "attachment_active_ticket_id_idx",
      "attachment_pending_created_at_id_idx",
      "attachment_uploader_ticket_idx",
      "idempotency_record_expires_at_id_idx",
      "ticket_ticket_number_trgm_idx",
      "ticket_summary_trgm_idx",
      "ticket_description_trgm_idx",
    ]) {
      expect(indexByName.has(name)).toBe(true);
    }
    const expectedIndexFragments = {
      ticket_requester_created_at_id_active_idx: [
        "(requester_id, created_at DESC, id DESC)",
        "deleted = false",
      ],
      ticket_category_id_idx: ["(category_id)"],
      ticket_related_system_id_idx: ["(related_system_id)"],
      ticket_requested_priority_idx: ["(requested_priority)"],
      ticket_current_status_idx: ["(current_status)"],
      attachment_ticket_id_idx: ["(ticket_id)"],
      attachment_active_ticket_id_idx: [
        "(ticket_id)",
        "ticket_id IS NOT NULL",
        "deleted = false",
      ],
      attachment_pending_created_at_id_idx: [
        "(created_at, id)",
        "ticket_id IS NULL",
        "deleted = false",
      ],
      attachment_uploader_ticket_idx: [
        "(uploaded_by_requester_id, ticket_id)",
      ],
      idempotency_record_expires_at_id_idx: ["(expires_at, id)"],
    };
    for (const [name, fragments] of Object.entries(expectedIndexFragments)) {
      for (const fragment of fragments) {
        expect(indexByName.get(name)).toContain(fragment);
      }
    }
    expect(indexByName.get("ticket_requester_created_at_id_active_idx")).toContain("WHERE (deleted = false)");
    expect(indexByName.get("attachment_active_ticket_id_idx")).toContain("ticket_id IS NOT NULL");
    expect(indexByName.get("attachment_pending_created_at_id_idx")).toContain("ticket_id IS NULL");
    for (const name of ["ticket_ticket_number_trgm_idx", "ticket_summary_trgm_idx", "ticket_description_trgm_idx"]) {
      expect(indexByName.get(name)?.toLowerCase()).toContain("gin");
      expect(indexByName.get(name)).toContain("gin_trgm_ops");
    }

    /*
     * Existing is not the same as reachable. `ticket_ticket_number_trgm_idx`
     * was created on the expression `(ticket_number::text)`, because
     * `gin_trgm_ops` refuses a `character` column -- and every assertion above
     * passed while the planner could never use it, since Prisma emits
     * `ticket_number ILIKE $1` with no cast. `enable_seqscan = off` removes the
     * cost question and leaves only the structural one: can this index serve
     * the search the application actually issues?
     */
    for (const column of ["ticket_number", "summary", "description"]) {
      const plan = await prisma.$transaction(async (tx) => {
        /* LOCAL, so the setting dies with the transaction rather than riding a
         * pooled connection into another test. */
        await tx.$executeRawUnsafe("SET LOCAL enable_seqscan = off");

        return tx.$queryRawUnsafe<Array<Record<string, string>>>(
          `EXPLAIN (COSTS OFF) SELECT id FROM ticket WHERE ${column} ILIKE '%abcdef%'`,
        );
      });

      const text = plan.map((row) => Object.values(row).join(" ")).join("\n");

      expect(text).toContain(`ticket_${column}_trgm_idx`);
    }

    const extensions = await prisma.$queryRaw<Array<{ extname: string }>>`
      SELECT extname FROM pg_extension WHERE extname = 'pg_trgm'
    `;
    expect(extensions).toEqual([{ extname: "pg_trgm" }]);
  }, 120_000);

  it("seeds all reference data idempotently without audit churn", async () => {
    await runSeed(target);
    const first = {
      categories: await readSeedSnapshot(prisma, "category"),
      systems: await readSeedSnapshot(prisma, "related_system"),
      requesters: await readSeedSnapshot(prisma, "development_requester"),
    };

    expect(first.categories.map((row) => row.label)).toEqual([
      "Account and Access",
      "Hardware",
      "Software",
      "Network",
    ]);
    expect(first.systems.map((row) => row.label)).toEqual([
      "Corporate Laptop",
      "Desktop Workstation",
      "Printer",
      "Campus Wi-Fi",
      "VPN",
      "Email",
      "Learning Management System",
    ]);
    expect(first.requesters.map(({ label, name, is_active }) => ({
      email: label,
      name,
      isActive: is_active,
    }))).toEqual([
      {
        email: "alice.johnson@example.com",
        name: "Alice Johnson",
        isActive: true,
      },
      {
        email: "bob.smith@example.com",
        name: "Bob Smith",
        isActive: true,
      },
      {
        email: "carol.lee@example.com",
        name: "Carol Lee",
        isActive: true,
      },
      {
        email: "david.brown@example.com",
        name: "David Brown",
        isActive: true,
      },
      {
        email: "eve.wilson@example.com",
        name: "Eve Wilson",
        isActive: false,
      },
    ]);
    for (const rows of Object.values(first)) {
      for (const row of rows) {
        expect(row.deleted).toBe(false);
        expect(row.created_by).toBe("seed");
        expect(row.updated_by).toBe("seed");
      }
    }

    await runSeed(target);
    const second = {
      categories: await readSeedSnapshot(prisma, "category"),
      systems: await readSeedSnapshot(prisma, "related_system"),
      requesters: await readSeedSnapshot(prisma, "development_requester"),
    };
    expect(second).toEqual(first);
  }, 120_000);

  it("upgrades populated Lab 1 Categories in place and preserves original timestamps", async () => {
    await resetTestSchema(target);
    await applyLab1Migration(target);

    const beforeOid = await prisma.$queryRaw<Array<{ oid: string }>>`
      SELECT '"Category"'::regclass::oid::text AS oid
    `;
    await prisma.$executeRaw`
      INSERT INTO "Category" ("id", "name", "createdAt") VALUES
        (101, 'Account and Access', TIMESTAMP '2024-01-02 03:04:05.678'),
        (202, 'Hardware', TIMESTAMP '2025-02-03 04:05:06.789'),
        (303, 'Software', TIMESTAMP '2026-03-04 05:06:07.890'),
        (404, 'Network', TIMESTAMP '2027-04-05 06:07:08.901')
    `;
    const before = await prisma.$queryRaw<Array<{ id: number; name: string; created_at: string }>>`
      SELECT id, name,
             to_char("createdAt", 'YYYY-MM-DD HH24:MI:SS.MS') AS created_at
      FROM "Category"
      ORDER BY id
    `;

    await markLab1MigrationApplied(target);
    await deployMigrations(target);

    const afterOid = await prisma.$queryRaw<Array<{ oid: string }>>`
      SELECT 'category'::regclass::oid::text AS oid
    `;
    expect(afterOid).toEqual(beforeOid);

    const after = await prisma.$queryRaw<PreservedCategoryRow[]>`
      SELECT id, name,
             to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.MS') AS created_at,
             to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.MS') AS updated_at,
             is_active, deleted, created_by, updated_by
      FROM category
      ORDER BY id
    `;
    expect(after).toEqual(
      before.map((row) => ({
        ...row,
        updated_at: row.created_at,
        is_active: true,
        deleted: false,
        created_by: "seed",
        updated_by: "seed",
      })),
    );

    await runSeed(target);
    const afterSeed = await prisma.$queryRaw<PreservedCategoryRow[]>`
      SELECT id, name,
             to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.MS') AS created_at,
             to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.MS') AS updated_at,
             is_active, deleted, created_by, updated_by
      FROM category
      ORDER BY id
    `;
    expect(afterSeed).toEqual(after);
  }, 120_000);

  it("rejects over-length Lab 1 Category names without changing the original table", async () => {
    await resetTestSchema(target);
    await applyLab1Migration(target);

    const originalName = "x".repeat(101);
    await prisma.$executeRaw`
      INSERT INTO "Category" ("name", "createdAt")
      VALUES (${originalName}, TIMESTAMP '2026-08-22 06:07:08.901')
    `;
    const beforeOid = await prisma.$queryRaw<Array<{ oid: string }>>`
      SELECT '"Category"'::regclass::oid::text AS oid
    `;

    await markLab1MigrationApplied(target);
    await expect(deployMigrations(target)).rejects.toBeDefined();

    const afterOid = await prisma.$queryRaw<Array<{ oid: string }>>`
      SELECT '"Category"'::regclass::oid::text AS oid
    `;
    const categories = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT "name" AS name FROM "Category"
    `;
    expect(afterOid).toEqual(beforeOid);
    expect(categories).toEqual([{ name: originalName }]);
  }, 120_000);

  it("rolls back earlier Category changes when a later migration statement fails", async () => {
    await resetTestSchema(target);
    await applyLab1Migration(target);
    await prisma.$executeRaw`
      INSERT INTO "Category" ("name", "createdAt")
      VALUES ('Hardware', TIMESTAMP '2026-08-22 06:07:08.901')
    `;
    await prisma.$executeRawUnsafe(
      `CREATE TYPE "RequestedPriority" AS ENUM ('CONFLICT')`,
    );
    const beforeOid = await prisma.$queryRaw<Array<{ oid: string }>>`
      SELECT '"Category"'::regclass::oid::text AS oid
    `;

    await markLab1MigrationApplied(target);
    await expect(deployMigrations(target)).rejects.toBeDefined();

    const afterOid = await prisma.$queryRaw<Array<{ oid: string }>>`
      SELECT '"Category"'::regclass::oid::text AS oid
    `;
    const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'Category'
      ORDER BY ordinal_position
    `;
    expect(afterOid).toEqual(beforeOid);
    expect(columns.map((column) => column.column_name)).toEqual([
      "id",
      "name",
      "createdAt",
    ]);
  }, 120_000);
});
