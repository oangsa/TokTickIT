import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createStaffFixture, loginStaffFixture } from "./staff-fixture.js";

test("E2E-05 Administrator User Management golden path @issue-6", async ({ page, context }) => {
  const fixture = await createStaffFixture();
  const suffix = randomUUID().slice(0, 8);
  const targetEmail = `target-${suffix}@example.test`;
  const duplicateEmail = targetEmail;

  try {
    // 1. Administrator logs in and lands on User Management
    await loginStaffFixture(page, fixture, true);
    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/admin\/users$/);
    await expect(page.getByRole("heading", { name: "User Management", exact: true })).toBeVisible();

    // 2. Search & filter controls
    const searchInput = page.getByPlaceholder("Search by name or email…");
    await searchInput.fill("Workflow Staff");
    await expect(page.getByRole("cell", { name: "Workflow Staff", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Workflow Requester", exact: true })).toHaveCount(0);

    // Search for Requester
    await searchInput.fill("Workflow Requester");
    await expect(page.getByRole("cell", { name: "Workflow Requester", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Workflow Staff", exact: true })).toHaveCount(0);

    // Keep fixture users on the same page even when other test users exist.
    await searchInput.fill("Workflow");

    // Filter by role through the modal, then remove its active chip.
    await expect(page.getByRole("cell", { name: "Workflow Staff", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Filters", exact: true }).click();
    const filterDialog = page.getByRole("dialog", { name: "Filter User Management" });
    const roleSelect = page.getByLabel("Filter by role");
    await roleSelect.selectOption("IT_STAFF");
    await filterDialog.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(filterDialog).not.toBeVisible();
    await expect(page.getByRole("cell", { name: "Workflow Staff", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Workflow Requester", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Remove filter Role: IT Staff" }).click();
    await expect(page.getByRole("cell", { name: "Workflow Requester", exact: true })).toBeVisible();

    // 3. Create User
    await page.getByRole("link", { name: "Create User", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/users\/new$/);
    await expect(page.getByRole("heading", { name: "Create User", exact: true })).toBeVisible();

    await page.getByLabel("Name *").fill("Target User");
    await page.getByLabel("Email *").fill(targetEmail);
    await page.getByLabel("Role *").selectOption("REQUESTER");
    await page.getByRole("button", { name: "Create User", exact: true }).click();

    // One-time initial password panel is shown
    await expect(page.getByTestId("initial-password-panel")).toBeVisible();
    const initialPasswordInput = page.getByLabel("One-time initial password");
    await expect(initialPasswordInput).toBeVisible();
    const initialPassword = await initialPasswordInput.inputValue();
    expect(initialPassword.length).toBe(16);
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.getByRole("button", { name: "Copy initial password" }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(initialPassword);
    expect(await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }))).not.toContain(initialPassword);

    // Done button returns to users list
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/users$/);
    await expect(page.getByTestId("initial-password-panel")).toHaveCount(0);

    // 4. Duplicate email validation
    await page.getByRole("link", { name: "Create User", exact: true }).click();
    await page.getByLabel("Name *").fill("Duplicate User");
    await page.getByLabel("Email *").fill(duplicateEmail);
    await page.getByLabel("Role *").selectOption("REQUESTER");
    await page.getByRole("button", { name: "Create User", exact: true }).click();
    await expect(page.getByText("A user with this email address already exists.")).toBeVisible();
    await page.getByRole("link", { name: "Back to Users" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Discard", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/users$/);

    // 5. Edit User
    await searchInput.fill(targetEmail);
    const targetRow1 = page.locator("tr", { has: page.getByRole("cell", { name: targetEmail, exact: true }) });
    await expect(targetRow1).toBeVisible();
    await targetRow1.getByRole("link", { name: "Edit" }).click();
    await expect(page).toHaveURL(/\/admin\/users\/[^/]+\/edit$/);
    await expect(page.getByRole("heading", { name: /Edit / })).toBeVisible();

    // Update name
    await page.getByLabel("Name *").fill("Target User Updated");
    await page.getByRole("button", { name: "Save Changes", exact: true }).click();
    await expect(page.getByText("User updated successfully.")).toBeVisible();

    // 6. Administrator Self-Management Safety
    await page.goto("/admin/users");
    await searchInput.fill(fixture.admin.email);
    const adminRow = page.locator("tr", { has: page.getByRole("cell", { name: fixture.admin.email, exact: true }) });
    await expect(adminRow).toBeVisible();
    await adminRow.getByRole("link", { name: "Edit" }).click();
    await expect(page.getByText("You are editing your own administrator profile.")).toBeVisible();
    await expect(page.getByLabel("Role *")).toBeDisabled();
    await expect(page.getByLabel("Active", { exact: true })).toBeDisabled();
    await expect(page.getByText("An Administrator cannot reset their own initial password.")).toBeVisible();

    // 7. Reset Initial Password for target user
    await page.goto("/admin/users");
    await searchInput.fill(targetEmail);
    const targetRow2 = page.locator("tr", { has: page.getByRole("cell", { name: targetEmail, exact: true }) });
    await expect(targetRow2).toBeVisible();
    await targetRow2.getByRole("link", { name: "Edit" }).click();

    await page.getByRole("button", { name: "Set New Initial Password", exact: true }).click();
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();
    await modal.getByRole("button", { name: "Set New Initial Password", exact: true }).click();

    await expect(page.getByTestId("reset-initial-password-panel")).toBeVisible();
    const resetPasswordInput = page.getByTestId("reset-initial-password-panel").getByLabel("One-time initial password");
    const newInitialPassword = await resetPasswordInput.inputValue();
    expect(newInitialPassword.length).toBe(16);

    // 8. Target forced password change on next login
    await page.getByRole("button", { name: "Logout" }).click();
    await expect(page).toHaveURL(/\/login$/);

    // Sign in as target user with new initial password
    await page.getByLabel("Email *").fill(targetEmail);
    await page.getByLabel("Password *").fill(newInitialPassword);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();

    // Must be redirected to /change-password
    await expect(page).toHaveURL(/\/change-password$/);
    await expect(page.getByRole("heading", { name: "Change Password", exact: true })).toBeVisible();

    const permanentPassword = `Permanent-${randomUUID()}!`;
    await page.getByLabel("New Password *", { exact: true }).fill(permanentPassword);
    await page.getByLabel("Confirm New Password *", { exact: true }).fill(permanentPassword);
    await page.getByRole("button", { name: "Change Password", exact: true }).click();

    // Forced fresh login after password change
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel("Email *").fill(targetEmail);
    await page.getByLabel("Password *").fill(permanentPassword);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();

    // Requester role lands on /tickets
    await expect(page).toHaveURL(/\/tickets$/);
  } finally {
    // Clean up created target user
    await fixture.prisma.userSession.deleteMany({ where: { user: { email: targetEmail } } });
    await fixture.prisma.user.deleteMany({ where: { email: targetEmail } });
    await fixture.dispose();
  }
});

test("E2E-05 User list paginates and deactivation revokes owner session @issue-6", async ({ page, browser }) => {
  const fixture = await createStaffFixture();
  const extraUsers = Array.from({ length: 11 }, (_, index) => ({
    name: `Page Fixture ${String(index).padStart(2, "0")}`,
    email: `page-${index}-${randomUUID()}@example.test`, role: "REQUESTER" as const,
    passwordHash: fixture.requester.passwordHash, mustChangePassword: false,
    createdBy: "issue6-e2e", updatedBy: "issue6-e2e",
  }));
  const staffContext = await browser.newContext();
  const staffPage = await staffContext.newPage();
  try {
    await fixture.prisma.user.createMany({ data: extraUsers });
    await fixture.prisma.ticket.update({ where: { id: fixture.tickets[0].id }, data: { ownerUserId: fixture.staff.id, currentStatus: "OPEN" } });
    await loginStaffFixture(staffPage, fixture);
    await loginStaffFixture(page, fixture, true);
    await page.goto("/admin/users");
    await page.getByPlaceholder("Search by name or email…").fill("Page Fixture");
    await expect(page.locator("table tbody tr")).toHaveCount(10);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.locator("table tbody tr")).toHaveCount(1);
    await expect(page.getByRole("cell", { name: "Page Fixture 10" })).toBeVisible();

    await page.goto(`/admin/users/${fixture.staff.publicId}/edit`);
    await page.getByLabel("Active", { exact: true }).uncheck();
    await page.getByRole("button", { name: "Save Changes" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByText("User updated successfully.")).toBeVisible();
    expect(await fixture.prisma.ticket.findUniqueOrThrow({ where: { id: fixture.tickets[0].id } })).toMatchObject({ ownerUserId: null });
    await staffPage.reload();
    await expect(staffPage).toHaveURL(/\/login$/);
  } finally {
    await staffContext.close();
    await fixture.prisma.userSession.deleteMany({ where: { user: { email: { in: extraUsers.map((user) => user.email) } } } });
    await fixture.prisma.user.deleteMany({ where: { email: { in: extraUsers.map((user) => user.email) } } });
    await fixture.dispose();
  }
});

test("E2E-05 concurrent Administrator deactivation preserves last active Administrator @issue-6", async ({ page, browser }) => {
  const fixture = await createStaffFixture();
  const secondAdmin = await fixture.prisma.user.create({ data: {
    name: "Other Workflow Administrator", email: `other-admin-${randomUUID()}@example.test`,
    role: "ADMINISTRATOR", passwordHash: fixture.admin.passwordHash, mustChangePassword: false,
    createdBy: "issue6-e2e", updatedBy: "issue6-e2e",
  } });
  const otherContext = await browser.newContext();
  const otherPage = await otherContext.newPage();
  const activeSeedAdmins = await fixture.prisma.user.findMany({
    where: { role: "ADMINISTRATOR", isActive: true, id: { notIn: [fixture.admin.id, secondAdmin.id] } },
    select: { id: true },
  });
  try {
    await loginStaffFixture(page, fixture, true);
    await otherPage.goto("/login");
    await otherPage.getByLabel("Email *").fill(secondAdmin.email);
    await otherPage.getByLabel("Password *").fill(fixture.password);
    await otherPage.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(otherPage).toHaveURL(/\/admin\/users$/);
    await page.goto(`/admin/users/${secondAdmin.publicId}/edit`);
    await otherPage.goto(`/admin/users/${fixture.admin.publicId}/edit`);
    await expect(page.getByLabel("Active", { exact: true })).toBeChecked();
    await expect(otherPage.getByLabel("Active", { exact: true })).toBeChecked();
    await fixture.prisma.user.updateMany({ where: { id: { in: activeSeedAdmins.map((admin) => admin.id) } }, data: { isActive: false } });
    for (const editor of [page, otherPage]) {
      await editor.getByLabel("Active", { exact: true }).uncheck();
      await editor.getByRole("button", { name: "Save Changes" }).click();
      await expect(editor.getByRole("dialog", { name: "Deactivate user account?" })).toBeVisible();
    }
    const results = await Promise.all([
      page.waitForResponse((response) => response.url().includes("/api/admin/users/") && response.request().method() === "PATCH"),
      otherPage.waitForResponse((response) => response.url().includes("/api/admin/users/") && response.request().method() === "PATCH"),
      page.getByRole("dialog").getByRole("button", { name: "Confirm" }).click(),
      otherPage.getByRole("dialog").getByRole("button", { name: "Confirm" }).click(),
    ]);
    const responseStatuses = [results[0].status(), results[1].status()];
    expect(responseStatuses.filter((status) => status === 200)).toHaveLength(1);
    const rejectedStatus = responseStatuses[0] === 200 ? responseStatuses[1] : responseStatuses[0];
    expect([401, 409]).toContain(rejectedStatus);
    expect(await fixture.prisma.user.count({ where: { role: "ADMINISTRATOR", isActive: true } })).toBe(1);
    const rejectedPage = responseStatuses[0] === rejectedStatus ? page : otherPage;
    if (rejectedStatus === 401) {
      const deactivatedAdmin = responseStatuses[0] === 200 ? secondAdmin : fixture.admin;
      expect(await fixture.prisma.user.findUniqueOrThrow({
        where: { id: deactivatedAdmin.id },
        select: { isActive: true, role: true },
      })).toMatchObject({ isActive: false, role: "ADMINISTRATOR" });
      expect(await fixture.prisma.userSession.count({
        where: { userId: deactivatedAdmin.id, revokedAt: null },
      })).toBe(0);
      await expect(rejectedPage).toHaveURL(/\/login$/);
      await expect(rejectedPage.getByText("Your session has expired. Please sign in again.", { exact: true })).toBeVisible();
    } else {
      await expect(rejectedPage.getByRole("alert")).toContainText(`The request failed (HTTP ${rejectedStatus}).`);
    }
  } finally {
    await fixture.prisma.user.updateMany({ where: { id: { in: activeSeedAdmins.map((admin) => admin.id) } }, data: { isActive: true } });
    await otherContext.close();
    await fixture.prisma.userSession.deleteMany({ where: { userId: secondAdmin.id } });
    await fixture.prisma.user.delete({ where: { id: secondAdmin.id } });
    await fixture.dispose();
  }
});

test("E2E-06 Non-Administrator roles cannot access User Management @issue-6", async ({ page }) => {
  const fixture = await createStaffFixture();

  try {
    // Requester cannot access /admin/users
    await page.goto("/login");
    await page.getByLabel("Email *").fill(fixture.requester.email);
    await page.getByLabel("Password *").fill(fixture.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/tickets$/);

    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/error$/);
    await expect(page.getByText("Unable to open this page.")).toBeVisible();

    // Clear session and log in as IT Staff
    await page.context().clearCookies();
    await page.goto("/login");
    await page.getByLabel("Email *").fill(fixture.staff.email);
    await page.getByLabel("Password *").fill(fixture.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/staff\/tickets$/);

    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/error$/);
    await expect(page.getByText("Unable to open this page.")).toBeVisible();
  } finally {
    await fixture.dispose();
  }
});
