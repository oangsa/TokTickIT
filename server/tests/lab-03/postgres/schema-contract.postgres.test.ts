import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PrismaClient } from "../../../src/generated/prisma/client.js";
import { assertLab3TestDatabase, createTestPrisma, type Lab3TestTarget } from "./testDatabase.js";

describe("Lab 3 schema contract @issue-2", () => {
  let target: Lab3TestTarget;
  let prisma: PrismaClient;
  beforeAll(() => { target = assertLab3TestDatabase(); prisma = createTestPrisma(target); });
  afterAll(async () => prisma?.$disconnect());

  it("has citext User email and all Issue 2 persistence tables", async () => {
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN
        ('user', 'user_session', 'login_rate_limit_bucket', 'public_comment', 'internal_note')
      ORDER BY table_name
    `;
    expect(tables.map((row) => row.table_name)).toEqual([
      "internal_note", "login_rate_limit_bucket", "public_comment", "user", "user_session",
    ]);
    const email = await prisma.$queryRaw<Array<{ udt_name: string }>>`
      SELECT udt_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user' AND column_name = 'email'
    `;
    expect(email).toEqual([{ udt_name: "citext" }]);
  });
});
