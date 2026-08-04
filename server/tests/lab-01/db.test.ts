import "dotenv/config";

import { afterAll, describe, expect, it } from "vitest";

// Proves the runtime Prisma client (not just the CLI) can reach PostgreSQL.
// Skipped when DATABASE_URL is unset so a fresh clone still runs `npm test`.
const hasDatabase = Boolean(process.env["DATABASE_URL"]);

describe.skipIf(!hasDatabase)("prisma client", () => {
  let disconnect: (() => Promise<void>) | undefined;

  afterAll(async () => {
    await disconnect?.();
  });

  it("connects to PostgreSQL", async () => {
    const { prisma } = await import("../../src/db.js");
    disconnect = () => prisma.$disconnect();

    const rows = await prisma.$queryRaw<{ one: number }[]>`SELECT 1 AS one`;

    expect(rows[0]?.one).toBe(1);
  });
});
