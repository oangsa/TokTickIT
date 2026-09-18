import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createStaffFixture, loginStaffFixture } from "./staff-fixture.js";

test("E2E-05 Administrator User Management golden path @issue-6", async ({ page }) => {
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

    // Done button returns to users list
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/users$/);

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
