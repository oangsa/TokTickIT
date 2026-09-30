import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "../../../src/generated/prisma/client.js";
import { provisionMigratedPasswords } from "../../../src/services/migratedPasswordProvisioning.js";
import {
  assertLab2TestDatabase,
  createTestPrisma,
  deployMigrations,
  runSeed,
  type TestDatabaseTarget,
} from "../../lab-02/postgres/testDatabase.js";

const TICKET_PUBLIC_IDS = [1, 2, 3, 4, 5, 6, 7, 8].map((id) => `10000000-0000-4000-8000-${id.toString().padStart(12, "0")}`);
const ACTION_PUBLIC_IDS = [1, 2, 3, 4].map((id) => `40000000-0000-4000-8000-${id.toString().padStart(12, "0")}`);
const ACTIVITY_PUBLIC_IDS = [1, 2, 3, 4].map((id) => `50000000-0000-4000-8000-${id.toString().padStart(12, "0")}`);
const USER_EMAILS = [
  "alice.johnson@example.com", "bob.smith@example.com", "carol.lee@example.com",
  "david.brown@example.com", "nora.evans@example.com", "eve.wilson@example.com", "iris.patel@example.com",
  "jon.bell@example.com", "kim.nguyen@example.com", "lee.carter@example.com",
  "former.staff@example.com", "morgan.admin@example.com",
];

describe("Lab 4 seed @issue-78", () => {
  let target: TestDatabaseTarget;
  let prisma: PrismaClient;

  beforeAll(async () => {
    target = assertLab2TestDatabase();
    if (!/(^|[_-])lab3([_-]|$)/i.test(target.databaseName)) {
      throw new Error("Lab 4 PostgreSQL tests require the guarded Lab 3 test database");
    }
    await deployMigrations(target);
    prisma = createTestPrisma(target);
  });

  afterAll(async () => prisma?.$disconnect());

  it("keeps seeded Users, Tickets, Actions, and Activity unchanged on second run", async () => {
    await runSeed(target);
    const first = await readLogicalCounts();
    await runSeed(target);
    const second = await readLogicalCounts();

    expect(first).toEqual({ users: 12, tickets: 8, actions: 4, migratedActions: 2, activities: 4, systemUsers: 1, emptyTicketRequesters: 1 });
    expect(second).toEqual(first);
  }, 120_000);

  it("leaves SYSTEM and provisioned human credentials unchanged during password provisioning", async () => {
    await runSeed(target);
    const before = await prisma.user.findMany({ orderBy: { id: "asc" } });
    expect(before.filter((user) => user.isSystem)).toHaveLength(1);
    expect(before.find((user) => user.isSystem)).toMatchObject({
      isActive: false,
      mustChangePassword: false,
      passwordHash: "!system-no-login",
    });

    expect(await provisionMigratedPasswords(prisma)).toBe(0);
    expect(await prisma.user.findMany({ orderBy: { id: "asc" } })).toEqual(before);
  }, 120_000);

  async function readLogicalCounts() {
    const [users, tickets, actions, migratedActions, activities, systemUsers, emptyTicketRequesters] = await Promise.all([
      prisma.user.count({ where: { email: { in: USER_EMAILS }, isSystem: false } }),
      prisma.ticket.count({ where: { publicId: { in: TICKET_PUBLIC_IDS } } }),
      prisma.actionTaken.count({ where: { publicId: { in: ACTION_PUBLIC_IDS } } }),
      prisma.actionTaken.count({ where: { isMigrated: true, ticket: { publicId: { in: [TICKET_PUBLIC_IDS[4]!, TICKET_PUBLIC_IDS[5]!] } } } }),
      prisma.ticketActivity.count({ where: { publicId: { in: ACTIVITY_PUBLIC_IDS } } }),
      prisma.user.count({ where: { isSystem: true } }),
      prisma.user.count({
        where: {
          email: "nora.evans@example.com",
          role: "REQUESTER",
          isActive: true,
          deleted: false,
          isSystem: false,
          requesterTickets: { none: {} },
        },
      }),
    ]);
    return { users, tickets, actions, migratedActions, activities, systemUsers, emptyTicketRequesters };
  }
});
