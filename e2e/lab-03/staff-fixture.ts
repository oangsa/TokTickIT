import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { assertLab3TargetEnvironment } from "../../server/src/databaseTargetGuard.js";
import { createTestPrisma } from "../../server/tests/lab-03/postgres/testDatabase.js";
import { hashPassword } from "../../server/src/services/passwordService.js";

export async function createStaffFixture(count = 1) {
  const url = assertLab3TargetEnvironment({ ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL, DIRECT_URL: process.env.TEST_DATABASE_URL });
  const prisma = createTestPrisma({ url, databaseName: new URL(url).pathname.slice(1) });
  const suffix = randomUUID();
  const password = `Synthetic-${randomUUID()}!`;
  const passwordHash = await hashPassword(password);
  const users = [];
  for (const [name, role] of [["Workflow Staff", "IT_STAFF"], ["Workflow Requester", "REQUESTER"], ["Workflow Administrator", "ADMINISTRATOR"]] as const) {
    users.push(await prisma.user.create({ data: { name, email: `${role.toLowerCase()}-${suffix}@example.test`, role, passwordHash, mustChangePassword: false, createdBy: "issue5-e2e", updatedBy: "issue5-e2e" } }));
  }
  const [staff, requester, admin] = users;
  const category = await prisma.category.create({ data: { name: `Workflow ${suffix.slice(0, 8)}`, createdBy: "issue5-e2e", updatedBy: "issue5-e2e" } });
  const system = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true, deleted: false } });
  const tickets = [];
  for (let index = 0; index < count; index++) {
    tickets.push(await prisma.ticket.create({ data: { publicId: randomUUID(), ticketNumber: `TKT-20260916-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`, requesterId: requester.id, categoryId: category.id, relatedSystemId: system.id, summary: index === 0 ? "VPN disconnects after login" : `Support request ${index + 1}`, description: "Synthetic workflow fixture for Staff Queue verification.", requestedPriority: "MEDIUM", itPriority: index % 2 ? "MEDIUM" : "HIGH", currentStatus: "NEW", createdBy: "issue5-e2e", updatedBy: "issue5-e2e" } }));
  }
  return {
    prisma, staff, requester, admin, password, tickets, category,
    async dispose() {
      const ids = tickets.map((ticket) => ticket.id);
      await prisma.publicComment.deleteMany({ where: { ticketId: { in: ids }, parentCommentId: { not: null } } });
      await prisma.publicComment.deleteMany({ where: { ticketId: { in: ids } } });
      await prisma.internalNote.deleteMany({ where: { ticketId: { in: ids } } });
      await prisma.attachment.deleteMany({ where: { ticketId: { in: ids } } });
      await prisma.ticket.deleteMany({ where: { id: { in: ids } } });
      await prisma.userSession.deleteMany({ where: { userId: { in: users.map((user) => user.id) } } });
      await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
      await prisma.category.delete({ where: { id: category.id } });
      await prisma.$disconnect();
    },
  };
}

export async function loginStaffFixture(page: Page, fixture: Awaited<ReturnType<typeof createStaffFixture>>, administrator = false) {
  await page.goto("/login");
  await page.getByLabel("Email *", { exact: true }).fill(administrator ? fixture.admin.email : fixture.staff.email);
  await page.getByLabel("Password *", { exact: true }).fill(fixture.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(administrator ? /\/admin\/users$/ : /\/staff\/tickets$/);
  if (administrator) await page.goto("/admin/tickets");
  await expect(page.getByRole("heading", { name: "Ticket Queue", exact: true })).toBeVisible();
}
