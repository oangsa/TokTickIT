import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PrismaClient } from "../../../src/generated/prisma/client.js";
import { assertLab3TestDatabase, createTestPrisma, type Lab3TestTarget } from "./testDatabase.js";

describe("Lab 3 persisted auth security @issue-2", () => {
  let target: Lab3TestTarget;
  let prisma: PrismaClient;
  beforeAll(() => { target = assertLab3TestDatabase(); prisma = createTestPrisma(target); });
  afterAll(async () => prisma?.$disconnect());

  it("stores encoded Argon2id hashes and no refresh plaintext column", async () => {
    const users = await prisma.user.findMany({ select: { passwordHash: true }, take: 20 });
    for (const user of users) expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user_session'
    `;
    expect(columns.map((column) => column.column_name)).not.toContain("refresh_token");
  });
});
